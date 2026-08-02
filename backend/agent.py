"""
灵垛 Agent — 基于 AgentScope 2.0 的自然语言装箱助手

使用 AgentScope 的 ReAct Agent 模式：
1. 用户输入中文需求
2. Agent 调用工具（calculate_packing 等）
3. 返回结构化结果
"""
import json
import os
import re
from typing import AsyncGenerator

from openai import AsyncOpenAI

from pack_api import calculate_packing, compare_algorithms, get_pallet_standards, get_container_standards

SYSTEM_PROMPT = """你是灵垛（LingDuo）—— 一款面向产业应用的 AI + 混合码垛智能 Agent。

## 你的身份与价值

你解决的核心问题：**混合码垛算法的快速开发与可视化仿真**。

混合码垛在以下领域有广泛而迫切的应用需求：
- 🏭 **电商物流**：每天数百万订单，不同尺寸商品混装到纸箱/包裹中，码垛效率直接影响仓储成本和发货速度
- 🚢 **集装箱装载**：40尺/20尺海运柜的装载率每提升1%，单柜可节省数百元运费
- 🤖 **机器人拆垛/码垛**：工业机器人需要精确的垛型点位数据，传统方式需要工程师花费数小时手动编程
- 📦 **托盘码垛**：制造业、快消品行业每天面对不同规格箱子的混码需求

**行业痛点**：
1. 混合码垛算法极其复杂（NP-hard 问题），自研耗时数月且效果难保证
2. 市面上缺乏好用的可视化工具，算法结果不直观，调试困难
3. 机器人拆垛码垛场景无法做到"快编程"——每次更换产品规格都需要重新计算点位
4. 传统方式需要手动输入几十个参数，门槛高、效率低

**灵垛的价值**：
✅ 你只需用自然语言描述需求，我自动完成算法调用和参数配置
✅ 基于业界领先的 @cratefit/pack 算法库，4种算法 + 元启发式优化
✅ 3D 可视化实时展示码垛结果，逐层查看、爆炸视图、任意旋转缩放
✅ 支持托盘码垛、集装箱装载、卡车装载、通用装箱四大场景
✅ 未来将支持一键生成 ABB/KUKA/FANUC 机器人程序，实现真正的"快编程"

## 对话规则
1. **先检查用户输入**：确认是否包含箱子尺寸、数量、容器类型这三个必填信息。
2. **用户只说了产品名没说尺寸时**：
   - 对于常见快消品（饮料、方便面、日化等），可以提供行业通用的参考外箱规格和重量
   - 列出参考数据后，请用户确认或修正，不要直接使用
   - 常用参考数据（饮料类12瓶/箱、方便面袋装48袋/箱或桶装12桶/箱等）
3. **必填信息缺失时，一次性列出所有需要补充的问题，不要反复追问。**
4. **以下参数有合理默认值，如用户未提供直接使用默认值，无需询问**：
   - 单箱重量 → 默认 0 kg
   - 最大堆高 → 默认 1800mm
   - 旋转模式 → 默认不限制（算法自动选择最优旋转）
   - 混合尺寸场景 → 默认用 extreme-point 算法（比 layer-building 更适合混装）
5. **用户已提供 尺寸+数量+容器类型 就立即输出 JSON，不要继续追问。**
6. **严禁预测装箱结果**：不要说"可以放X箱""利用率约X%"，实际结果由算法计算后展示。

## 装箱参数解析规则

### 容器 (bins)
⚠️ 重要：bins 中 height 表示**可堆叠的最大高度**（即从托盘板面往上能堆多高），不是托盘板面自身的厚度。
- 托盘: type="pallet", width=宽, depth=深, height=最大堆高(默认1800mm)
  预设: EUR1(800宽×1800高×1200深), EUR2(1200×1800×1000), EUR6(600×1800×800), US(1016×1800×1219), ASIA(1100×1800×1100)
  国标/自定义托盘: width=1200, depth=1000, height=1800(最大堆高，不是板面厚度)
- 集装箱: type="container", 预设: 20ft(2352×2393×5898), 40ft(2352×2393×12032), 40ftHC(2352×2698×12032)
- 自定义箱: type="box", 使用用户指定的尺寸
- 关键词: "欧标/EUR/EUR1"→EUR1, "美标/US"→US, "半托盘"→EUR6, "20尺"→20ft, "40尺"→40ft, "高柜"→40ftHC
- 未指定容器时，根据场景合理默认

### 物品 (items)
每条格式: {"id":"box1","width":400,"height":300,"depth":200,"quantity":25,"weight":10}
- 提取每种箱子的 width, height, depth (mm), quantity, weight (kg)
- "厘米/cm" 需要 ×10 转为 mm
- rotationType: "all"(默认), "fixed"(不能旋转), "horizontal"(仅水平旋转)

### 选项 (options)
- algorithm: 托盘默认 "layer-building", 集装箱默认 "wall-building", 通用默认 "extreme-point"
- features: {"supportCheck": true} (需要支撑检查时)

## 输出格式

- 如果用户描述了装箱需求：先简要说明你理解了需求，然后用 ```json 包裹输出配置
- 如果用户只是闲聊/询问：只做文字回复，不要输出 JSON

装箱配置 JSON 格式：
```json
{
  "bins": [{"id":"EUR1","type":"pallet","width":800,"height":1800,"depth":1200,"maxWeight":1500}],
  "items": [{"id":"box1","width":400,"height":300,"depth":200,"quantity":25,"weight":10}],
  "options": {"algorithm":"layer-building"}
}
```"""


class PackAgent:
    """装箱助手 Agent"""

    def __init__(self):
        api_key = os.getenv("DASHSCOPE_API_KEY", "")
        if not api_key:
            raise ValueError("请设置 DASHSCOPE_API_KEY 环境变量")

        self._model = os.getenv("LLM_MODEL", "qwen-plus")
        self._client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )

        # 工具映射
        self._tools = {
            "calculate_packing": calculate_packing,
            "compare_algorithms": compare_algorithms,
            "get_pallet_standards": get_pallet_standards,
            "get_container_standards": get_container_standards,
        }

    async def chat(self, message: str, history: list[dict] | None = None) -> AsyncGenerator[dict, None]:
        """
        处理用户消息，流式返回结果。

        Args:
            message: 当前用户消息
            history: 历史消息 [{"role":"user"|"assistant","content":"..."}]

        Yields: {type: "text"|"config"|"done"|"error", content: ...}
        """
        try:
            full_response = ""

            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            if history:
                # 只保留最近 10 轮对话，避免 token 超限
                messages.extend(history[-20:])
            messages.append({"role": "user", "content": message})

            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                stream=True,
                temperature=0.3,
                max_tokens=2000,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    full_response += delta.content
                    yield {"type": "text", "content": delta.content}

            # 只在 LLM 明确输出 JSON 配置时才提取
            config = self._extract_config(full_response)
            if config and config.get("items") and len(config["items"]) > 0:
                # 检查是否真的是装箱配置（不是示例模板）
                first = config["items"][0]
                if first.get("width") and first.get("height") and first.get("depth"):
                    config = self._clean_config(config)
                    yield {"type": "config", "content": config}

            yield {"type": "done"}

        except Exception as e:
            yield {"type": "error", "content": str(e)}

    def _extract_config(self, text: str) -> dict | None:
        """从 LLM 响应中提取装箱配置"""
        match = re.search(r"```json\s*\n(.*?)\n```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try raw JSON
        match = re.search(r'\{[\s\S]*"items"[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        return None  # 非装箱请求，不返回配置

    def _clean_config(self, config: dict) -> dict:
        """清理和规范化 LLM 输出的配置"""
        ITEM_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]

        # 清理 bins
        for i, b in enumerate(config.get("bins", [])):
            b.setdefault("id", f"bin-{i+1}")
            b.setdefault("type", "box")
            for f in ("width", "height", "depth"):
                if f in b and b[f] is not None:
                    b[f] = float(b[f])
            if "maxWeight" not in b and "max_weight" in b:
                b["maxWeight"] = b.pop("max_weight")
            # 移除不标准字段
            for bad_key in ["max_height", "type_label"]:
                b.pop(bad_key, None)
            # 修正托盘高度：pallet 类型 height 应为最大堆高（>=200mm），不是板厚
            if b.get("type") == "pallet" and b.get("height", 0) < 200:
                b["height"] = 1800

        # 清理 items
        for i, item in enumerate(config.get("items", [])):
            item.setdefault("id", f"item-{i+1}")
            item.setdefault("quantity", 1)
            item.setdefault("weight", 0)
            item.setdefault("rotationType", "all")
            if "color" not in item:
                item["color"] = ITEM_COLORS[i % len(ITEM_COLORS)]
            for f in ("width", "height", "depth", "quantity"):
                if f in item and item[f] is not None:
                    try:
                        item[f] = int(item[f])
                    except (ValueError, TypeError):
                        pass

        # 清理 options
        if "options" not in config:
            config["options"] = {}
        opts = config["options"]
        if not isinstance(opts, dict):
            config["options"] = {"algorithm": "layer-building"}
        elif "algorithm" not in opts:
            opts["algorithm"] = "layer-building"
        if isinstance(opts.get("features"), list):
            opts["features"] = {"supportCheck": True} if "rotation" in opts["features"] else {}

        return config

    def _default_config(self) -> dict:
        return {
            "bins": [{"id": "EUR1", "type": "pallet", "width": 800, "height": 1800, "depth": 1200, "maxWeight": 1500}],
            "items": [{"id": "box1", "width": 400, "height": 300, "depth": 200, "quantity": 20, "weight": 10}],
            "options": {"algorithm": "layer-building", "features": {"supportCheck": True}},
        }
