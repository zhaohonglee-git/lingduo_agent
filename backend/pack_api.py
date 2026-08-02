"""
灵垛 Tools — @cratefit/pack 的 Python 工具封装

每个工具函数通过 subprocess 调用 Node.js pack_tool.mjs，
将结果返回为 dict，供 AgentScope ReActAgent 使用。
"""
import json
import subprocess
from pathlib import Path
from typing import Any

_TOOL_SCRIPT = str(Path(__file__).parent / "tools" / "pack_tool.mjs")
_TIMEOUT = 30


def _call(action: str, **params: Any) -> dict:
    """调用 Node.js pack 工具"""
    try:
        r = subprocess.run(
            ["node", _TOOL_SCRIPT],
            input=json.dumps({"action": action, **params}, ensure_ascii=False),
            capture_output=True, text=True, timeout=_TIMEOUT,
            cwd=str(Path(__file__).parent / "tools" / "pack-service"),
        )
        if r.returncode != 0:
            return {"success": False, "error": r.stderr.strip() or r.stdout.strip()}
        return json.loads(r.stdout.strip())
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"计算超时（{_TIMEOUT}秒）"}
    except FileNotFoundError:
        return {"success": False, "error": "未找到 Node.js 运行环境"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================================
# 对外暴露的工具函数
# ============================================================================

def calculate_packing(
    items: list[dict],
    scene_type: str = "pallet",
    bins: list[dict] | None = None,
    pallet_size: str = "EUR1",
    pallet_max_height: float = 1800,
    pallet_max_weight: float | None = None,
    container_size: str = "40ft",
    options: dict | None = None,
) -> dict:
    """
    执行3D装箱计算，支持4种场景。

    Args:
        items: 物品列表 [{"id":"box1","width":400,"height":300,"depth":200,"quantity":25,"weight":10}]
        scene_type: "pallet"|"box"|"container"|"truck"
        bins: 容器列表（box场景需要）
        pallet_size: 托盘标准 EUR1/EUR2/EUR3/EUR6/US/US_GROCERY/ASIA/AUSTRALIA
        pallet_max_height: 最大堆叠高度mm
        pallet_max_weight: 最大承重kg
        container_size: 集装箱标准 20ft/40ft/40ftHC/45ftHC
        options: 装箱选项 {algorithm, enhancer, features, constraints, ...}

    Returns:
        {success: bool, data: {packed, unpacked, stats}}
    """
    params: dict[str, Any] = {"items": items, "options": options or {}}

    if scene_type == "pallet":
        params["palletSize"] = pallet_size
        if pallet_max_height:
            params["maxHeight"] = pallet_max_height
        if pallet_max_weight:
            params["maxWeight"] = pallet_max_weight
        return _call("packPallet", **params)

    elif scene_type == "box":
        if not bins:
            return {"success": False, "error": "box 场景需要提供 bins 参数"}
        params["bins"] = bins
        return _call("pack", **params)

    elif scene_type == "container":
        params["containerSize"] = container_size
        return _call("packContainer", **params)

    elif scene_type == "truck":
        return _call("packTruck", **params)

    return {"success": False, "error": f"不支持的场景: {scene_type}"}


def compare_algorithms(
    bins: list[dict],
    items: list[dict],
    time_budget_ms: int = 3000,
) -> dict:
    """
    用4种算法分别计算并对比结果。

    Returns:
        {success, data: {results: [{algorithm, utilization, packedItems, durationMs}], bestAlgorithm}}
    """
    algorithms = ["extreme-point", "layer-building", "wall-building", "eb-afit"]
    results = []
    best = None
    best_util = 0

    import time
    for algo in algorithms:
        start = time.time()
        r = _call("pack", bins=bins, items=items,
                   options={"algorithm": algo, "timeBudgetMs": time_budget_ms})
        duration = (time.time() - start) * 1000

        if r.get("success"):
            s = r["data"]["stats"]
            entry = {
                "algorithm": algo,
                "utilization": s["avgUtilization"],
                "packedItems": s["packedItems"],
                "unpackedItems": s["unpackedItems"],
                "durationMs": round(duration, 0),
                "binsUsed": s["totalBins"],
            }
            results.append(entry)
            if s["avgUtilization"] > best_util:
                best_util = s["avgUtilization"]
                best = algo
        else:
            results.append({"algorithm": algo, "error": r.get("error"), "durationMs": round(duration, 0)})

    return {
        "success": True,
        "data": {
            "results": results,
            "bestAlgorithm": best,
            "bestUtilization": best_util,
        },
    }


def get_pallet_standards() -> dict:
    """获取托盘标准尺寸"""
    return _call("palletStandards")


def get_container_standards() -> dict:
    """获取集装箱标准尺寸"""
    return _call("containerStandards")
