"""喷涂场景专用 RAPID 代码片段生成器。

这些函数提供"参数化模板"能力 —— LLM 可以选择性调用它们生成关键代码块，
保证语法 100% 正确。即使 LLM 表现差，关键路径仍可用。

所有函数都是纯函数，返回 RAPID 代码字符串。

controller 参数控制输出风格：
  - "IRC5"  (默认)：通用控制器，用 MoveL + SetDO 实现喷涂开关
  - "IRC5P"：IRC5 Paint 控制器，用 PaintL/PaintC + brushdata 走 ABB Paint 工艺
"""
from __future__ import annotations

from dataclasses import dataclass

from abb_agent.config import ControllerKind


@dataclass(frozen=True)
class Pose:
    """笛卡尔位姿 (x,y,z + 欧拉/四元数)。这里用四元数表达。"""

    x: float
    y: float
    z: float
    q1: float = 1.0
    q2: float = 0.0
    q3: float = 0.0
    q4: float = 0.0

    def to_robtarget_pos(self) -> str:
        return f"[{self.x},{self.y},{self.z}]"

    def to_robtarget_orient(self) -> str:
        return f"[{self.q1},{self.q2},{self.q3},{self.q4}]"


@dataclass(frozen=True)
class BrushParams:
    """笔刷/喷涂工艺参数。"""

    flow_rate: int = 80
    fan_width: int = 300
    atom_pressure: int = 50
    pre_open_ms: int = 50
    post_close_ms: int = 50


def brush_data_decl(
    name: str = "bdMain",
    params: BrushParams | None = None,
    *,
    controller: ControllerKind = "IRC5",
) -> str:
    """生成 brushdata 声明。

    - IRC5  (默认)：无 Paint 选项的通用控制器，用 num/PERS 表示工艺参数。
    - IRC5P：使用 ABB Paint 原生 brushdata 类型，可被 PaintL/PaintC 直接消费。

    注意：brushdata 字段顺序随 RobotWare Paint 版本略有差异，下面采用 ABB 5.x/6.x
    常见结构 [flow, fan, atom, preOpen, postClose, brushOnTime, accept_brush, name, table_idx]。
    上控制器前请对照实际 RobotWare 文档校核字段顺序。
    """
    p = params or BrushParams()
    if controller == "IRC5P":
        return (
            f"    ! [WARNING] brushdata 字段顺序随 RobotWare Paint 版本不同。\n"
            f"    ! 下面的 9 字段布局是基于 ABB Paint 5.x/6.x 常见模式的推断，\n"
            f"    ! 上控制器前必须在 RobotStudio 中打开 Brush Table 对照校核！\n"
            f"    ! 字段顺序: flow, fan, atom, preOpen, postClose, brushOnTime, "
            f"accept_brush, name, brush_table_idx\n"
            f"    PERS brushdata {name} := ["
            f"{p.flow_rate}, {p.fan_width}, {p.atom_pressure}, "
            f"{p.pre_open_ms}, {p.post_close_ms}, 0, "
            f"FALSE, \"{name}\", 0];"
        )
    return (
        f"    ! 喷涂工艺参数 - {name}\n"
        f"    PERS num {name}_flow := {p.flow_rate};        ! 流量百分比\n"
        f"    PERS num {name}_fan := {p.fan_width};         ! 扇幅宽度 mm\n"
        f"    PERS num {name}_atom := {p.atom_pressure};    ! 雾化压力 kPa\n"
        f"    PERS num {name}_preOpen := {p.pre_open_ms};   ! 喷枪提前开 ms\n"
        f"    PERS num {name}_postClose := {p.post_close_ms};! 喷枪延迟关 ms"
    )


def robtarget_decl(name: str, pose: Pose, conf: str = "[0,0,0,0]", extax: str = "[9E9,9E9,9E9,9E9,9E9,9E9]") -> str:
    """生成 robtarget 声明。"""
    return (
        f"CONST robtarget {name} := ["
        f"{pose.to_robtarget_pos()},"
        f"{pose.to_robtarget_orient()},"
        f"{conf},{extax}];"
    )


def linear_scan(
    start: Pose,
    end: Pose,
    *,
    speed: str = "vPaint",
    zone: str = "z10",
    tool: str = "tSprayGun",
    wobj: str = "wobjPart",
    spray_signal: str = "doSprayOn",
    controller: ControllerKind = "IRC5",
    brush: str = "bdMain",
) -> str:
    """生成「定位 → 喷涂直线段」RAPID 片段。

    IRC5  (默认): MoveL 定位 → SetDO 开 → MoveL 喷 → SetDO 关。
    IRC5P:       MoveL 定位 → PaintL（brushdata 自动调度工艺）。
    """
    if controller == "IRC5P":
        return (
            f"        ! 直线扫描喷涂段 (IRC5P PaintL)\n"
            f"        MoveL {robtarget_inline(start)}, v500, fine, {tool}\\WObj:={wobj};\n"
            f"        PaintL {robtarget_inline(end)}, {speed}, {brush}, {zone}, "
            f"{tool}\\WObj:={wobj};"
        )
    return (
        f"        ! 直线扫描喷涂段\n"
        f"        MoveL {robtarget_inline(start)}, v200, fine, {tool}\\WObj:={wobj};\n"
        f"        SetDO {spray_signal}, 1;\n"
        f"        MoveL {robtarget_inline(end)}, {speed}, {zone}, {tool}\\WObj:={wobj};\n"
        f"        SetDO {spray_signal}, 0;"
    )


def robtarget_inline(pose: Pose, conf: str = "[0,0,0,0]") -> str:
    """生成内联 robtarget 字面量。"""
    return (
        f"[{pose.to_robtarget_pos()},{pose.to_robtarget_orient()},"
        f"{conf},[9E9,9E9,9E9,9E9,9E9,9E9]]"
    )


def zigzag_scan(
    origin: Pose,
    width: float,
    height: float,
    *,
    row_spacing: float = 50.0,
    speed: str = "vPaint",
    zone: str = "z10",
    tool: str = "tSprayGun",
    wobj: str = "wobjPart",
    spray_signal: str = "doSprayOn",
    controller: ControllerKind = "IRC5",
    brush: str = "bdMain",
) -> str:
    """Z 字扫描喷涂。

    工件坐标系下从 origin 开始，沿 X 方向往返，每次 Y 偏移 row_spacing。

    IRC5  : 行间 MoveL 定位 + SetDO 切换喷涂状态。
    IRC5P : 行间 MoveL 定位 + PaintL 走工艺（brushdata 自动管理开关枪时序）。
    """
    num_rows = int(height / row_spacing) + 1
    is_paint = controller == "IRC5P"
    header = "        ! Z 字扫描喷涂" + (" (IRC5P PaintL)" if is_paint else "")
    lines = [header]
    for i in range(num_rows):
        y_off = i * row_spacing
        # 偶数行向右，奇数行向左
        x_start = origin.x if i % 2 == 0 else origin.x + width
        x_end = origin.x + width if i % 2 == 0 else origin.x
        p_start = Pose(x_start, origin.y + y_off, origin.z, origin.q1, origin.q2, origin.q3, origin.q4)
        p_end = Pose(x_end, origin.y + y_off, origin.z, origin.q1, origin.q2, origin.q3, origin.q4)

        # 行起点：高速定位（不喷）
        lines.append(
            f"        MoveL {robtarget_inline(p_start)}, v500, fine, {tool}\\WObj:={wobj};"
        )
        if is_paint:
            lines.append(
                f"        PaintL {robtarget_inline(p_end)}, {speed}, {brush}, {zone}, "
                f"{tool}\\WObj:={wobj};"
            )
        else:
            lines.append(f"        SetDO {spray_signal}, 1;")
            lines.append(
                f"        MoveL {robtarget_inline(p_end)}, {speed}, {zone}, {tool}\\WObj:={wobj};"
            )
            lines.append(f"        SetDO {spray_signal}, 0;")
    return "\n".join(lines)


def trigg_io_setup(
    trigg_name: str,
    distance_mm: float,
    signal: str = "doSprayOn",
    value: int = 1,
) -> str:
    """TriggIO 同步喷枪开关。

    用于把 IO 切换精确锁定到路径上的某个距离点，避免普通 SetDO 的时延误差。
    """
    return (
        f"        ! TriggIO 触发 - 距离起点 {distance_mm}mm 时切换 {signal}\n"
        f"        VAR triggdata {trigg_name};\n"
        f"        TriggIO {trigg_name}, {distance_mm} \\DOp:={signal}, {value};"
    )


def trigg_l_movement(
    target: str,
    trigg_data: str,
    *,
    speed: str = "vPaint",
    zone: str = "z10",
    tool: str = "tSprayGun",
    wobj: str = "wobjPart",
) -> str:
    """带触发的直线移动。"""
    return (
        f"        TriggL {target}, {speed}, {trigg_data}, {zone}, "
        f"{tool}\\WObj:={wobj};"
    )


def tcp_calibration_program(name: str = "CalibrateSprayTCP") -> str:
    """生成喷枪 TCP 校准程序模板。

    使用 4 点法：选定空间中固定参考点（如校准针尖），让喷枪 TCP 从 4 个不同
    姿态接触该点，机器人控制器自动计算 TCP 偏移。
    """
    return (
        f"PROC {name}()\n"
        f"        ! 喷枪 TCP 校准 - 4 点法\n"
        f"        ! 操作步骤：\n"
        f"        !   1. 在空间中固定一根校准针（参考点）\n"
        f"        !   2. 手动将喷枪嘴对准针尖（不同姿态 4 次）\n"
        f"        !   3. 每次到位后按下示教器按钮记录该点\n"
        f"        !   4. 4 点采集后控制器自动算出 TCP\n"
        f"        ! 推荐：在示教器中使用 \"Hand Guide\" 配合 Define 功能完成\n"
        f"        ConfL\\Off;\n"
        f"        SingArea\\Wrist;\n"
        f"        TPWrite \"请按示教器引导，依次到达 4 个校准位姿\";\n"
        f"        WaitTime 1;\n"
        f"        ! 校准结果会自动写入 tSprayGun.tframe\n"
        f"    ENDPROC"
    )


def arc_segment(
    p_start: Pose,
    p_mid: Pose,
    p_end: Pose,
    *,
    speed: str = "vPaint",
    zone: str = "z10",
    tool: str = "tSprayGun",
    wobj: str = "wobjPart",
    controller: ControllerKind = "IRC5",
    brush: str = "bdMain",
) -> str:
    """圆弧路径段。IRC5 用 MoveC；IRC5P 用 PaintC（带 brushdata）。"""
    if controller == "IRC5P":
        return (
            f"        PaintC {robtarget_inline(p_mid)}, {robtarget_inline(p_end)}, "
            f"{speed}, {brush}, {zone}, {tool}\\WObj:={wobj};"
        )
    return (
        f"        MoveC {robtarget_inline(p_mid)}, {robtarget_inline(p_end)}, "
        f"{speed}, {zone}, {tool}\\WObj:={wobj};"
    )
