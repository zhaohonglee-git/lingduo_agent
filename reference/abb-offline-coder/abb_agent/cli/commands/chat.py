"""chat 子命令：多轮对话模式。"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.syntax import Syntax

from abb_agent.agent import Agent, ChatSession
from abb_agent.config import get_config

app = typer.Typer(help="多轮对话模式")
console = Console()

_BANNER = """[bold cyan]ABB 喷涂机器人 AI 助手 (对话模式)[/bold cyan]
键入需求开始。指令：
  /save <path>   - 保存当前代码
  /reset         - 重置对话
  /show          - 显示当前代码
  /quit          - 退出
"""


@app.callback(invoke_without_command=True)
def chat_default() -> None:
    """启动交互式对话。"""
    console.print(Panel.fit(_BANNER))
    session = ChatSession()
    with Agent() as agent:
        while True:
            try:
                user_input = Prompt.ask("[bold green]你[/bold green]").strip()
            except (EOFError, KeyboardInterrupt):
                console.print("\n[yellow]再见![/yellow]")
                break

            if not user_input:
                continue
            if user_input.startswith("/"):
                if _handle_command(user_input, session):
                    break
                continue

            with console.status("思考中..."):
                result = agent.chat_turn(session, user_input)

            console.print("[bold magenta]助手[/bold magenta]:")
            if result.code:
                console.print(Syntax(result.code, "rapid", theme="monokai", line_numbers=True, word_wrap=True))
            if result.explanation and result.explanation != result.code:
                console.print(result.explanation)
            if not result.validation.is_valid:
                console.print("[yellow]⚠ 校验有问题:[/yellow]")
                console.print(result.validation.format_summary())


def _handle_command(cmd: str, session: ChatSession) -> bool:
    """处理 / 开头指令；返回 True 表示退出。"""
    parts = cmd.split(maxsplit=1)
    name = parts[0].lower()
    arg = parts[1] if len(parts) > 1 else ""

    if name in {"/quit", "/exit", "/q"}:
        console.print("[yellow]再见![/yellow]")
        return True
    if name == "/reset":
        session.reset()
        console.print("[cyan]对话已重置[/cyan]")
        return False
    if name == "/show":
        if session.last_code:
            console.print(Syntax(session.last_code, "rapid", theme="monokai", line_numbers=True))
        else:
            console.print("[dim]尚未生成代码[/dim]")
        return False
    if name == "/save":
        if not session.last_code:
            console.print("[red]没有可保存的代码[/red]")
            return False
        out = Path(arg) if arg else _default_save_path()
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(session.last_code, encoding="utf-8")
        console.print(f"[green]已保存到 {out}[/green]")
        return False

    console.print(f"[red]未知指令: {name}[/red]")
    return False


def _default_save_path() -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return get_config().paths.output_dir / f"chat_{ts}.mod"
