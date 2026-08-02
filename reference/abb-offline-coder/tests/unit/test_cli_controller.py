"""CLI 层 controller 透传与 doctor 显示。

CLI 集成测试只验证「命令行参数解析正确 + 字符串显示正确」，不真正调用 Agent
（会触发 Ollama / Chroma 等重资源依赖，集成测试范畴）。
"""
from __future__ import annotations

from typer.testing import CliRunner

from abb_agent.cli.commands.doctor import _check_controller_mode
from abb_agent.cli.commands.gen import app as gen_app
from abb_agent.cli.main import app as main_app

runner = CliRunner()


def test_controller_check_irc5p_branch() -> None:
    label, status, detail = _check_controller_mode("IRC5P", ("doSprayOn", "doFanOn", "doAtomOn"))
    assert "IRC5P" in detail
    assert "doSprayOn" in detail
    assert "✓" in status


def test_controller_check_irc5_branch_hints_at_irc5p() -> None:
    label, status, detail = _check_controller_mode("IRC5", ("doSprayOn",))
    assert "IRC5" in detail
    # 应给出切到 IRC5P 的提示
    assert "IRC5P" in detail


def test_gen_help_lists_controller_flag() -> None:
    result = runner.invoke(gen_app, ["--help"])
    assert result.exit_code == 0
    assert "--controller" in result.stdout
    assert "IRC5P" in result.stdout


def test_gen_help_lists_strict_tcp_flag() -> None:
    result = runner.invoke(gen_app, ["--help"])
    assert result.exit_code == 0
    assert "--strict-tcp" in result.stdout


def test_gen_rejects_invalid_controller() -> None:
    result = runner.invoke(gen_app, ["dummy query", "--controller", "FANUC"])
    assert result.exit_code != 0


def test_main_app_doctor_subcommand_registered() -> None:
    result = runner.invoke(main_app, ["doctor", "--help"])
    assert result.exit_code == 0


def test_gen_help_lists_bundle_flag() -> None:
    result = runner.invoke(gen_app, ["--help"])
    assert result.exit_code == 0
    assert "--bundle" in result.stdout
