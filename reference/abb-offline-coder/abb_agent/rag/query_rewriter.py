"""查询改写器 - 把用户的中文自然语言需求改写为更适合检索的形式。

策略：基于词典 + 规则的轻量改写（不调 LLM，速度快）。
- 同义词映射：中文术语 → ABB 官方术语 / RAPID 指令
- 任务类型识别：扫描 / 校准 / IO 控制 / 工艺参数
- 关键词增强：把识别到的 RAPID 关键词加入查询

后续如果效果不够，可以替换为 LLM-based 查询改写。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum


class TaskCategory(str, Enum):
    LINEAR_SCAN = "linear_scan"
    ZIGZAG_SCAN = "zigzag_scan"
    ARC_SCAN = "arc_scan"
    TCP_CALIBRATION = "tcp_calibration"
    BRUSH_CONFIG = "brush_config"
    IO_CONTROL = "io_control"
    GENERAL = "general"


# 中文 → 检索关键词（含官方英文术语）
# 注意 key 已对原查询做了「移除空格」处理后再匹配
_CN_TO_EN = {
    "直线扫描": "linear scan MoveL straight path",
    "z字扫描": "zigzag scan back forth raster pattern",
    "z字": "zigzag scan back forth raster pattern",
    "之字扫描": "zigzag scan back forth raster pattern",
    "之字": "zigzag scan back forth raster pattern",
    "弓字扫描": "zigzag scan back forth raster pattern",
    "弓字": "zigzag scan back forth raster pattern",
    "圆弧": "MoveC arc circular path",
    "圆弧扫描": "MoveC arc scan circular trajectory",
    "校准": "calibration TCP toolframe calibrate",
    "标定": "calibration TCP toolframe calibrate",
    "TCP": "TCP tool center point toolframe tooldata",
    "工具坐标": "tooldata tool coordinate frame",
    "工件坐标": "wobjdata work object coordinate frame",
    "喷枪": "spray gun spray tool paint",
    "喷涂": "painting spray paint coating",
    "流量": "flow rate paint volume brushdata flow",
    "扇幅": "fan width spray pattern width",
    "雾化": "atomization atom pressure",
    "工艺": "process recipe brushdata painting parameters",
    "开关": "SetDO Reset signal digital output gun on off",
    "信号": "signaldo signaldi digital signal IO",
    "数字输出": "SetDO digital output signal",
    "同步": "TriggIO TriggL TriggData synchronized trigger distance",
    "触发": "TriggIO TriggL TriggData trigger event distance",
    "笔刷": "brushdata brush table painting parameters",
    "笔刷表": "brushdata brush table painting parameters",
    "速度": "speeddata v50 v100 v200 v500 speed",
    "转弯区": "zonedata fine z1 z5 z10 zone corner",
    "圆角": "zonedata corner zone fine z",
    "目标点": "robtarget target position pose",
    "关节": "jointtarget joint axis angle",
    "等待": "WaitTime WaitDI WaitDO wait",
    "延时": "WaitTime delay",
    "重叠": "overlap row spacing zigzag",
    "行距": "row spacing line distance",
    "幅宽": "fan width spray width",
}

# 任务类别识别规则（基于关键词）
# 注意：分类前会把空格移除，所以 "Z 字" 也会匹配 "Z字"
_CATEGORY_PATTERNS: list[tuple[TaskCategory, re.Pattern[str]]] = [
    (TaskCategory.ZIGZAG_SCAN, re.compile(r"(Z字|z字|之字|弓字|来回|往复|raster|zigzag)", re.IGNORECASE)),
    (TaskCategory.LINEAR_SCAN, re.compile(r"(直线|沿[XYxy]|linear|linescan|linepath)", re.IGNORECASE)),
    (TaskCategory.ARC_SCAN, re.compile(r"(圆弧|曲面|curve|arc|MoveC)", re.IGNORECASE)),
    (TaskCategory.TCP_CALIBRATION, re.compile(r"(校准|标定|TCP|calibrat)", re.IGNORECASE)),
    (TaskCategory.BRUSH_CONFIG, re.compile(r"(笔刷|流量|扇幅|雾化|工艺|brushdata|brushtable)", re.IGNORECASE)),
    (TaskCategory.IO_CONTROL, re.compile(r"(开关|信号|数字输出|IO|SetDO|TriggIO)", re.IGNORECASE)),
]


@dataclass(frozen=True)
class RewrittenQuery:
    """改写后的查询包装。"""

    original: str
    rewritten: str
    category: TaskCategory
    extracted_keywords: tuple[str, ...] = field(default_factory=tuple)

    def for_retrieval(self) -> str:
        """提供给 retriever 使用的最终文本。"""
        return f"{self.rewritten}\n关键词: {' '.join(self.extracted_keywords)}"


def rewrite(query: str) -> RewrittenQuery:
    """把中文需求改写为检索友好的形式。

    保留原始中文（向量检索友好），追加英文术语（BM25 友好），附加任务类别。
    """
    extras: list[str] = []
    keywords: set[str] = set()

    # 归一化：移除空格 + 小写，让 "Z 字" 和 "Z字" 都能命中
    normalized = re.sub(r"\s+", "", query).lower()
    for cn, en in _CN_TO_EN.items():
        if cn.lower() in normalized:
            extras.append(en)
            keywords.update(en.split())

    category = _classify_category(query)
    rewritten = query
    if extras:
        rewritten = f"{query}\n[英文术语映射]: {'; '.join(extras)}"
    rewritten += f"\n[任务类别]: {category.value}"

    return RewrittenQuery(
        original=query,
        rewritten=rewritten,
        category=category,
        extracted_keywords=tuple(sorted(keywords)),
    )


def _classify_category(query: str) -> TaskCategory:
    """返回首个命中的任务类别。匹配前先移除空格以兼容 'Z 字' / 'Z字'。"""
    normalized = re.sub(r"\s+", "", query)
    for cat, pattern in _CATEGORY_PATTERNS:
        if pattern.search(normalized):
            return cat
    return TaskCategory.GENERAL
