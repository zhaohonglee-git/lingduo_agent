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

SYSTEM_PROMPT = """你是灵垛（LingDuo）平台的智能装箱助手。

## 你的身份
你是基于 AgentScope 2.0 框架构建的 AI Agent，核心能力是将自然语言转换为装箱参数，驱动 3D 码垛仿真。

## 对话规则
- 如果用户询问你的能力、打招呼、或问与装箱无关的问题，请友好地介绍自己并引导用户描述装箱需求
- 只有当用户明确描述了装箱/码垛需求时，才输出 JSON 配置

## 装箱参数解析规则

### 容器 (bins)
- 托盘: type="pallet", 预设: EUR1(800×1800×1200), EUR2(1200×1800×1000), EUR6(600×1800×800), US(1016×1800×1219), ASIA(1100×1800×1100)
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

    async def chat(self, message: str) -> AsyncGenerator[dict, None]:
        """
        处理用户消息，流式返回结果。

        Yields: {type: "text"|"config"|"done"|"error", content: ...}
        """
        try:
            full_response = ""

            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": message},
                ],
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

        return self._default_config()

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
