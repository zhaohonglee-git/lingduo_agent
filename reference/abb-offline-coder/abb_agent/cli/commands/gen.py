"""gen 子命令：单次生成 RAPID 代码。"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax

from abb_agent.agent import Agent
from abb_agent.config import get_config
from abb_agent.rapid.system_bundle import bundle_for_controller

app = typer.Typer(help="单次生成 RAPID 代码")
console = Console()


class ControllerOption(str, Enum):
    """Typer 不直接支持 Literal，用 Enum 桥接。"""

    IRC5 = "IRC5"
    IRC5P = "IRC5P"


def _default_output_path() -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return get_config().paths.output_dir / f"PaintProgram_{ts}.mod"


@app.callback(invoke_without_command=True)
def gen_default(
    query: str = typer.Argument(..., help="中文需求描述"),
    output: Path = typer.Option(
        None, "--output", "-o", help="输出 .mod 文件路径（默认 output/PaintProgram_*.mod）"
    ),
    no_few_shot: bool = typer.Option(False, "--no-few-shot", help="禁用 few-shot 示例（更快但效果差）"),
    show_context: bool = typer.Option(False, "--show-context", help="显示检索到的上下文"),
    controller: ControllerOption = typer.Option(
        None,
        "--controller",
        "-c",
        help="目标控制器；IRC5P 启用 PaintL/PaintC + brushdata 工艺校验",
        case_sensitive=False,
    ),
    strict_tcp: bool = typer.Option(
        False,
        "--strict-tcp",
        help="若 tooldata 仍为默认占位 TCP 则视为错误（上控制器前应开启）",
    ),
    bundle: bool = typer.Option(
        False,
        "--bundle",
        "-b",
        help="输出 Pack&Go 完整目录（.mod + .pgf + BASE.sys + README）而非单文件",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        help="bundle 模式下覆盖目标目录已存在的 BASE.sys/T_ROB1.pgf（默认拒绝）",
    ),
) -> None:
    """单次生成代码。"""
    out_path = output or _default_output_path()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    eff_controller = controller.value if controller is not None else None

    with Agent() as agent:
        active = eff_controller or get_config().rapid.controller
        console.print(Panel.fit(
            f"[bold cyan]需求:[/bold cyan] {query}\n"
            f"[bold cyan]控制器:[/bold cyan] {active}"
            + ("  [yellow](strict TCP)[/yellow]" if strict_tcp else "")
            + ("  [magenta](bundle)[/magenta]" if bundle else "")
        ))
        with console.status("正在检索 + 生成代码..."):
            result = agent.generate_code(
                query,
                save_to=None if bundle else out_path,
                include_few_shot=not no_few_shot,
                controller=eff_controller,
                strict_tcp=strict_tcp,
            )

    bundle_dir: Path | None = None
    files: dict[str, Path] = {}
    if bundle:
        # bundle 模式下 out_path 视为「目录前缀」，把扩展名去掉
        bundle_dir = out_path.with_suffix("")
        try:
            files = bundle_for_controller(
                bundle_dir,
                result.code,
                controller=active,
                force=force,
            )
        except FileExistsError as exc:
            console.print(f"[red]✗[/red] {exc}")
            console.print("[dim]提示：加 --force 强制覆盖，或换一个 -o 输出路径[/dim]")
            raise typer.Exit(code=1)

    console.rule("[bold]生成结果[/bold]")
    console.print(Syntax(result.code, "rapid", theme="monokai", line_numbers=True, word_wrap=True))

    if result.explanation:
        console.rule("[bold]说明[/bold]")
        console.print(result.explanation)

    if show_context:
        console.rule("[bold]检索上下文[/bold]")
        console.print(result.context.text[:1500] + ("..." if len(result.context.text) > 1500 else ""))

    console.rule("[bold]校验报告[/bold]")
    console.print(result.validation.format_summary())

    console.rule("[bold]统计[/bold]")
    console.print(f"模型: {result.model_used}")
    console.print(f"耗时: {result.duration_ms} ms")
    console.print(f"任务类别: {result.rewritten_query.category.value}")
    if bundle and bundle_dir is not None:
        console.print(f"已生成 Pack&Go 目录: [green]{bundle_dir}[/green]")
        for role, path in files.items():
            console.print(f"  [cyan]{role:8s}[/cyan] {path.relative_to(bundle_dir)}")
        console.print("\n[dim]下一步：阅读目录中的 README.md，按方式 1–3 加载到控制器[/dim]")
    else:
        console.print(f"已保存到: [green]{out_path}[/green]")
