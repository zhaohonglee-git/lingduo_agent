"""CLI 入口 - Typer 主程序。

abb-agent <subcommand> [options]
"""
from __future__ import annotations

import sys

import typer
from loguru import logger
from rich.console import Console

from abb_agent import __version__
from abb_agent.cli.commands import chat, doctor, gen, init, kb

app = typer.Typer(
    name="abb-agent",
    help="ABB 喷涂机器人离线 AI 编程助手",
    no_args_is_help=True,
    pretty_exceptions_show_locals=False,
)
console = Console()


# 子命令注册
app.add_typer(gen.app, name="gen", help="单次生成 RAPID 代码")
app.add_typer(chat.app, name="chat", help="多轮对话模式")
app.add_typer(kb.app, name="kb", help="知识库管理 (build/status/clear)")
app.add_typer(init.app, name="init", help="首次安装引导")
app.add_typer(doctor.app, name="doctor", help="检查依赖与配置")


@app.callback()
def main_callback(
    verbose: bool = typer.Option(False, "--verbose", "-v", help="详细日志"),
) -> None:
    """ABB 喷涂机器人离线 AI 编程助手。"""
    logger.remove()
    level = "DEBUG" if verbose else "INFO"
    logger.add(sys.stderr, level=level, format="<level>{level}</level> | {message}")


@app.command()
def version() -> None:
    """显示版本号。"""
    console.print(f"abb-agent [bold green]v{__version__}[/bold green]")


if __name__ == "__main__":
    app()
