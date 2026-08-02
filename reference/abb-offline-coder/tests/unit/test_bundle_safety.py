"""H2/H3: bundle 防覆盖、MANIFEST.ok 原子标志。"""
from __future__ import annotations

from pathlib import Path

import pytest

from abb_agent.rapid.system_bundle import bundle_for_controller


def test_bundle_creates_manifest_ok(tmp_path: Path) -> None:
    """成功写完后必须存在 MANIFEST.ok。"""
    code = "MODULE M\n    PROC main()\n    ENDPROC\nENDMODULE\n"
    out = bundle_for_controller(tmp_path, code, controller="IRC5")
    assert "manifest" in out
    assert out["manifest"].name == "MANIFEST.ok"
    assert out["manifest"].exists()


def test_bundle_refuses_to_overwrite_existing_files(tmp_path: Path) -> None:
    code = "MODULE M\n    PROC main()\n    ENDPROC\nENDMODULE\n"
    bundle_for_controller(tmp_path, code, controller="IRC5")

    # 第二次同目录应抛错
    code2 = "MODULE M2\n    PROC main()\n    ENDPROC\nENDMODULE\n"
    with pytest.raises(FileExistsError):
        bundle_for_controller(tmp_path, code2, controller="IRC5")


def test_bundle_overwrites_when_force_true(tmp_path: Path) -> None:
    code = "MODULE M\n    PROC main()\n    ENDPROC\nENDMODULE\n"
    bundle_for_controller(tmp_path, code, controller="IRC5")

    code2 = "MODULE M2\n    PROC main()\n    ENDPROC\nENDMODULE\n"
    out = bundle_for_controller(tmp_path, code2, controller="IRC5", force=True)
    assert out["module"].name == "M2.mod"


def test_bundle_manifest_deleted_before_rewrite(tmp_path: Path) -> None:
    """force 覆盖时旧 MANIFEST.ok 应被刷新（防止操作员看到旧标志认为新写入完成）。"""
    code = "MODULE M\n    PROC main()\n    ENDPROC\nENDMODULE\n"
    out1 = bundle_for_controller(tmp_path, code, controller="IRC5")
    mtime1 = out1["manifest"].stat().st_mtime

    import time
    time.sleep(0.02)  # 保证 mtime 不同

    code2 = "MODULE M\n    PROC main()\n        Stop;\n    ENDPROC\nENDMODULE\n"
    out2 = bundle_for_controller(tmp_path, code2, controller="IRC5", force=True)
    mtime2 = out2["manifest"].stat().st_mtime
    assert mtime2 > mtime1
