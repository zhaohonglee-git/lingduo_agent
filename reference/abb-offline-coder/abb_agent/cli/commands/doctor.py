"""doctor 子命令：检查依赖与配置健康。"""
from __future__ import annotations

import shutil
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from abb_agent.config import get_config
from abb_agent.llm.ollama_client import OllamaClient

app = typer.Typer(help="检查环境健康")
console = Console()


@app.callback(invoke_without_command=True)
def doctor_default() -> None:
    """运行全面体检。"""
    cfg = get_config()
    table = Table(title="abb-agent 健康检查")
    table.add_column("检查项", style="cyan")
    table.add_column("状态")
    table.add_column("详情")

    table.add_row(*_check_python())
    table.add_row(*_check_disk_space(cfg.paths.data_dir))
    table.add_row(*_check_ollama(cfg.llm.ollama_host))
    table.add_row(*_check_models(cfg.llm.model_name, cfg.llm.fallback_model))
    table.add_row(*_check_chroma(cfg.paths.chroma_dir))
    table.add_row(*_check_embedder(cfg.embed.cache_dir, cfg.embed.model_name))
    table.add_row(*_check_controller_mode(cfg.rapid.controller, cfg.rapid.io_whitelist))

    console.print(table)


def _check_controller_mode(controller: str, io_whitelist: tuple[str, ...]) -> tuple[str, str, str]:
    """显示当前控制器模式与 IO 白名单。

    IRC5P 是带 ABB Paint 选项的目标控制器，IRC5 是通用。
    选错模式上线会导致 PaintL/brushdata 校验偏离实际。
    """
    if controller == "IRC5P":
        status = "[green]✓[/green]"
        detail = f"IRC5P (Paint 选项) | IO 白名单: {', '.join(io_whitelist[:3])}…"
    else:
        status = "[cyan]i[/cyan]"
        detail = f"IRC5 通用 | 上 IRC5P 前请 ABB_AGENT_RAPID_CONTROLLER=IRC5P 或加 --controller IRC5P"
    return ("控制器模式", status, detail)


def _check_python() -> tuple[str, str, str]:
    import sys
    v = sys.version_info
    ok = v >= (3, 10)
    status = "[green]✓[/green]" if ok else "[red]✗[/red]"
    return ("Python 版本", status, f"{v.major}.{v.minor}.{v.micro} (>= 3.10 required)")


def _check_disk_space(path: Path) -> tuple[str, str, str]:
    if not path.exists():
        return ("磁盘空间", "[yellow]?[/yellow]", f"路径不存在: {path}")
    usage = shutil.disk_usage(path)
    free_gb = usage.free / (1024**3)
    ok = free_gb > 10
    status = "[green]✓[/green]" if ok else "[yellow]△[/yellow]"
    return ("磁盘空间", status, f"可用 {free_gb:.1f} GB (建议 > 10GB)")


def _check_ollama(host: str) -> tuple[str, str, str]:
    try:
        client = OllamaClient()
        if client.health_check():
            return ("Ollama 服务", "[green]✓[/green]", f"在线 @ {host}")
        return ("Ollama 服务", "[red]✗[/red]", f"无响应 @ {host}")
    except Exception as exc:
        return ("Ollama 服务", "[red]✗[/red]", str(exc))


def _check_models(primary: str, fallback: str) -> tuple[str, str, str]:
    try:
        client = OllamaClient()
        models = client.list_models()
    except Exception as exc:
        return ("本地模型", "[red]✗[/red]", str(exc))
    if primary in models:
        return ("本地模型", "[green]✓[/green]", f"主模型: {primary}")
    if fallback in models:
        return ("本地模型", "[yellow]△[/yellow]", f"备选模型: {fallback}")
    return ("本地模型", "[red]✗[/red]", f"未找到 {primary} 或 {fallback}")


def _check_chroma(path: Path) -> tuple[str, str, str]:
    if not path.exists():
        return ("向量库", "[yellow]△[/yellow]", "未构建 - 运行 abb-agent kb build")
    try:
        from abb_agent.rag.vector_store import VectorStore
        store = VectorStore()
        count = store.count()
    except Exception as exc:
        return ("向量库", "[red]✗[/red]", str(exc))
    if count == 0:
        return ("向量库", "[yellow]△[/yellow]", "空 - 添加资料后运行 abb-agent kb build")
    return ("向量库", "[green]✓[/green]", f"{count} 切片")


def _check_embedder(cache_dir: Path, model_name: str) -> tuple[str, str, str]:
    if not cache_dir.exists():
        return ("嵌入模型", "[yellow]△[/yellow]", "首次使用时会自动下载")
    has_files = any(cache_dir.rglob("*.bin")) or any(cache_dir.rglob("*.safetensors"))
    if has_files:
        return ("嵌入模型", "[green]✓[/green]", f"{model_name} 已下载")
    return ("嵌入模型", "[yellow]△[/yellow]", "缓存目录存在但无模型文件")
