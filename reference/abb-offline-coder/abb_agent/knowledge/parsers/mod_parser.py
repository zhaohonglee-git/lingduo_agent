"""RAPID .mod / .sys / .pgf 源代码解析器。

把示例代码按"过程 PROC ... ENDPROC"和"FUNC ... ENDFUNC"切分，
每个过程作为一个独立 Chunk，便于检索"如何写 X 类过程"。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

from abb_agent.rag.models import Document, SourceType

_PROC_BLOCK_RE = re.compile(
    r"(?P<head>PROC\s+(?P<name>[A-Za-z][A-Za-z0-9_]*)\s*\([^)]*\)\s*)"
    r"(?P<body>.*?)"
    r"(?P<tail>ENDPROC)",
    re.DOTALL | re.IGNORECASE,
)
_FUNC_BLOCK_RE = re.compile(
    r"(?P<head>FUNC\s+\S+\s+(?P<name>[A-Za-z][A-Za-z0-9_]*)\s*\([^)]*\)\s*)"
    r"(?P<body>.*?)"
    r"(?P<tail>ENDFUNC)",
    re.DOTALL | re.IGNORECASE,
)
_MODULE_NAME_RE = re.compile(r"^\s*MODULE\s+([A-Za-z][A-Za-z0-9_]*)", re.MULTILINE)


@dataclass(frozen=True)
class RapidProcedure:
    name: str
    kind: str
    body: str
    full_text: str


def parse_mod(file_path: Path, *, source_type: SourceType = SourceType.CODE_EXAMPLE) -> list[Document]:
    """解析单个 .mod 文件，返回多个 Document（每个 PROC/FUNC 一个）。"""
    text = file_path.read_text(encoding="utf-8", errors="replace")
    module_match = _MODULE_NAME_RE.search(text)
    module_name = module_match.group(1) if module_match else file_path.stem

    procedures = _extract_procedures(text)
    if not procedures:
        # 整个模块作为一个文档
        return [
            Document(
                source_type=source_type,
                title=f"{module_name}",
                content=text,
                file_path=str(file_path),
                language="en",
                extra={"module": module_name, "source_file": file_path.name},
            )
        ]

    docs: list[Document] = []
    for proc in procedures:
        docs.append(
            Document(
                source_type=source_type,
                title=f"{module_name}.{proc.name}",
                content=proc.full_text,
                file_path=str(file_path),
                language="en",
                extra={
                    "module": module_name,
                    "procedure": proc.name,
                    "kind": proc.kind,
                    "source_file": file_path.name,
                },
            )
        )

    logger.debug("MOD {} 解析出 {} 个过程", file_path.name, len(docs))
    return docs


def _extract_procedures(text: str) -> list[RapidProcedure]:
    procs: list[RapidProcedure] = []
    for m in _PROC_BLOCK_RE.finditer(text):
        full = m.group(0)
        procs.append(
            RapidProcedure(
                name=m.group("name"),
                kind="PROC",
                body=m.group("body"),
                full_text=full,
            )
        )
    for m in _FUNC_BLOCK_RE.finditer(text):
        full = m.group(0)
        procs.append(
            RapidProcedure(
                name=m.group("name"),
                kind="FUNC",
                body=m.group("body"),
                full_text=full,
            )
        )
    return procs


def parse_mod_directory(directory: Path, *, source_type: SourceType = SourceType.CODE_EXAMPLE) -> list[Document]:
    """批量解析目录下所有 .mod / .sys / .pgf 文件。"""
    docs: list[Document] = []
    patterns = ["*.mod", "*.sys", "*.pgf"]
    for pat in patterns:
        for f in sorted(directory.glob(pat)):
            try:
                docs.extend(parse_mod(f, source_type=source_type))
            except Exception as exc:
                logger.error("解析 MOD {} 失败: {}", f, exc)
    return docs
