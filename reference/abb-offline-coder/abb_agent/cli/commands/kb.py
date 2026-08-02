"""kb 子命令：知识库管理。"""
from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from abb_agent.config import get_config
from abb_agent.knowledge.builder import KnowledgeBuilder
from abb_agent.rag.vector_store import VectorStore

app = typer.Typer(help="知识库管理")
console = Console()


@app.command("build")
def build_command(
    pdf_dir: Path = typer.Option(None, help="PDF 资料目录，默认 data/raw/pdf"),
    mod_dir: Path = typer.Option(None, help=".mod 示例目录，默认 data/raw/code"),
    html_dir: Path = typer.Option(None, help="HTML 文件目录，默认 data/raw/html"),
    jsonl: Path = typer.Option(None, help="预备好的 documents.jsonl"),
    reset: bool = typer.Option(False, "--reset", help="构建前清空向量库"),
) -> None:
    """从本地资料构建向量知识库。"""
    builder = KnowledgeBuilder()
    if reset:
        if not typer.confirm("⚠ 这将清空现有向量库，确认?"):
            console.print("[yellow]已取消[/yellow]")
            return
        builder.reset()

    written = 0
    if pdf_dir or (get_config().paths.raw_dir / "pdf").exists():
        written += builder.build_from_pdf(pdf_dir)
    if mod_dir or (get_config().paths.raw_dir / "code").exists():
        written += builder.build_from_mod(mod_dir)
    if html_dir or (get_config().paths.raw_dir / "html").exists():
        written += builder.build_from_html_files(html_dir)
    if jsonl:
        written += builder.build_from_jsonl(jsonl)

    console.print(f"[green]✓[/green] 写入 {written} 个切片")
    show_status()


@app.command("status")
def status_command() -> None:
    """显示知识库当前状态。"""
    show_status()


@app.command("clear")
def clear_command() -> None:
    """清空向量库。"""
    if not typer.confirm("⚠ 这将永久删除向量库内容，确认?"):
        console.print("[yellow]已取消[/yellow]")
        return
    builder = KnowledgeBuilder()
    builder.reset()
    console.print("[green]✓[/green] 向量库已清空")


@app.command("inspect")
def inspect_command(
    query: str = typer.Argument(..., help="测试查询"),
    top_k: int = typer.Option(5, help="返回 top-k 结果"),
) -> None:
    """用一个查询测试检索质量。"""
    from abb_agent.rag.query_rewriter import rewrite
    from abb_agent.rag.retriever import HybridRetriever

    rew = rewrite(query)
    retriever = HybridRetriever()
    results = retriever.retrieve(rew.for_retrieval(), top_k=top_k)

    console.print(f"[cyan]改写后:[/cyan] {rew.rewritten}")
    console.print(f"[cyan]任务类别:[/cyan] {rew.category.value}")
    console.print(f"[cyan]共 {len(results)} 条结果:[/cyan]")

    table = Table(show_lines=True)
    table.add_column("Rank", style="cyan", width=4)
    table.add_column("Score", style="green", width=6)
    table.add_column("Source", style="yellow", width=18)
    table.add_column("Title", style="magenta")
    table.add_column("Snippet", style="white")
    for r in results:
        snippet = r.chunk.text.replace("\n", " ")[:120]
        table.add_row(
            str(r.rank),
            f"{r.score:.3f}",
            r.chunk.source_type.value,
            r.chunk.title[:30],
            snippet,
        )
    console.print(table)


def show_status() -> None:
    store = VectorStore()
    table = Table(title="知识库状态")
    table.add_column("项", style="cyan")
    table.add_column("值", style="green")
    table.add_row("向量库路径", str(get_config().paths.chroma_dir))
    table.add_row("切片总数", str(store.count()))
    table.add_row("集合名", get_config().rag.collection_name)
    console.print(table)
