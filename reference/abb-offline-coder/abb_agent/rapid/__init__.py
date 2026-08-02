"""RAPID 后处理层 - 校验、模板、喷涂助手、格式化。"""

from abb_agent.rapid.formatter import format_code
from abb_agent.rapid.module_template import (
    ModuleSkeleton,
    empty_painting_skeleton,
    ensure_main_proc,
    wrap_in_module,
)
from abb_agent.rapid.painting_helpers import (
    BrushParams,
    Pose,
    arc_segment,
    brush_data_decl,
    linear_scan,
    robtarget_decl,
    robtarget_inline,
    tcp_calibration_program,
    trigg_io_setup,
    trigg_l_movement,
    zigzag_scan,
)
from abb_agent.rapid.validator import (
    Severity,
    ValidationIssue,
    ValidationReport,
    validate,
)

__all__ = [
    "BrushParams",
    "ModuleSkeleton",
    "Pose",
    "Severity",
    "ValidationIssue",
    "ValidationReport",
    "arc_segment",
    "brush_data_decl",
    "empty_painting_skeleton",
    "ensure_main_proc",
    "format_code",
    "linear_scan",
    "robtarget_decl",
    "robtarget_inline",
    "tcp_calibration_program",
    "trigg_io_setup",
    "trigg_l_movement",
    "validate",
    "wrap_in_module",
    "zigzag_scan",
]
