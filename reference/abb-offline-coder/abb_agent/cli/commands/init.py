"""init 子命令：首次安装引导。"""
from __future__ import annotations

import typer
from rich.console import Console
from rich.panel import Panel

from abb_agent.config import get_config
from abb_agent.llm.ollama_client import OllamaClient

app = typer.Typer(help="首次安装引导")
console = Console()


@app.callback(invoke_without_command=True)
def init_default() -> None:
    """检查环境、引导用户完成初始化。"""
    cfg = get_config()
    cfg.paths.ensure_dirs()

    console.print(
        Panel.fit(
            "[bold cyan]ABB Agent 首次初始化[/bold cyan]\n\n"
            "本流程会：\n"
            "  1. 确认目录结构\n"
            "  2. 检查 Ollama 服务\n"
            "  3. 校验本地模型\n"
            "  4. 提示如何放置 ABB 资料\n"
            "  5. 显示当前控制器模式 + 上线前 IO/TCP 检查清单\n"
        )
    )

    console.print("\n[bold]步骤 1/4 - 检查目录结构[/bold]")
    for name, path in (
        ("数据目录", cfg.paths.data_dir),
        ("原始资料目录", cfg.paths.raw_dir),
        ("向量库目录", cfg.paths.chroma_dir),
        ("输出目录", cfg.paths.output_dir),
        ("模型目录", cfg.paths.models_dir),
    ):
        console.print(f"  - {name}: {path}")

    console.print("\n[bold]步骤 2/4 - 检查 Ollama 服务[/bold]")
    client = OllamaClient()
    if client.health_check():
        console.print("  [green]✓[/green] Ollama 在线 @ " + cfg.llm.ollama_host)
    else:
        console.print("  [red]✗[/red] Ollama 未启动")
        console.print("    请先：[cyan]ollama serve[/cyan]")
        console.print("    Mac/Linux 安装: [cyan]curl -fsSL https://ollama.com/install.sh | sh[/cyan]")
        console.print("    Windows 安装: 下载 https://ollama.com/download")
        return

    console.print("\n[bold]步骤 3/4 - 校验本地模型[/bold]")
    try:
        models = client.list_models()
    except Exception as exc:
        console.print(f"  [red]✗[/red] 列出模型失败: {exc}")
        return
    primary = cfg.llm.model_name
    fallback = cfg.llm.fallback_model
    if primary in models:
        console.print(f"  [green]✓[/green] 主模型已就绪: {primary}")
    elif fallback in models:
        console.print(f"  [yellow]△[/yellow] 主模型缺失，但已有备选: {fallback}")
    else:
        console.print(f"  [red]✗[/red] 缺少模型，请运行：")
        console.print(f"    [cyan]ollama pull {primary}[/cyan]")
        console.print(f"    [cyan]ollama pull {fallback}[/cyan]  (备选，更小)")

    console.print("\n[bold]步骤 4/5 - 准备 ABB 资料[/bold]")
    console.print(f"  请将资料放入：[cyan]{cfg.paths.raw_dir}[/cyan]")
    console.print("    - PDF 手册放在 [cyan]raw/pdf/[/cyan]")
    console.print("    - .mod 示例代码放在 [cyan]raw/code/[/cyan]")
    console.print("    - HTML 离线页放在 [cyan]raw/html/[/cyan]")
    console.print("\n  放好后运行：[cyan]abb-agent kb build[/cyan] 构建向量库")

    console.print("\n[bold]步骤 5/5 - 控制器模式与上线前清单[/bold]")
    console.print(f"  当前控制器: [bold]{cfg.rapid.controller}[/bold]")
    console.print(f"  IO 白名单 ({len(cfg.rapid.io_whitelist)} 项): "
                  f"{', '.join(cfg.rapid.io_whitelist)}")
    if cfg.rapid.controller == "IRC5":
        console.print(
            "\n  [yellow]提示[/yellow]：若目标是 IRC5P（Paint 选项），运行前设环境变量："
        )
        console.print('    [cyan]export ABB_AGENT_RAPID_CONTROLLER=IRC5P[/cyan]')
        console.print(
            "  或在 gen 时加 [cyan]--controller IRC5P[/cyan]，否则生成的代码将走 SetDO 风格。"
        )
    else:
        console.print("  [green]✓[/green] IRC5P 模式已启用，生成代码会用 PaintL/PaintC + brushdata")
    console.print(
        "\n  [yellow]上控制器前必做[/yellow]："
    )
    console.print("    1. 用 4 点法重新标定 [cyan]tSprayGun[/cyan] 的 TCP（默认 [0,0,200] 是占位）")
    console.print("    2. 用 RobotStudio 打开控制器 EIO.cfg，把实际信号名喂给：")
    console.print('       [cyan]export ABB_AGENT_RAPID_IO_WHITELIST=\'["doSpray","doFan",...]\'[/cyan]')
    console.print("    3. 跑 [cyan]abb-agent gen --controller IRC5P --strict-tcp --bundle ...[/cyan]")
    console.print("       会生成完整 Pack&Go 目录（含 .mod / .pgf / BASE.sys / README）")

    console.print("\n[green]初始化引导完毕[/green]")
