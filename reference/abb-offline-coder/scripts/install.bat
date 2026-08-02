@echo off
REM ABB Agent Windows 安装脚本
REM 工业 PC 上常用 Windows，故提供此脚本
REM 用法：
REM   scripts\install.bat           - 在线安装
REM   scripts\install.bat /offline  - 离线模式

REM 切换控制台到 UTF-8，避免中文乱码
chcp 65001 >nul

setlocal enabledelayedexpansion
set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

set "OFFLINE=0"
if "%1"=="/offline" set "OFFLINE=1"

echo ==^> ABB Agent 安装 (Windows)
echo ==^> 项目目录: %CD%
echo ==^> 离线模式: %OFFLINE%

REM 检查 Python
where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Python，请安装 Python 3.10+: https://www.python.org/downloads/
  echo        安装时务必勾选 "Add Python to PATH"
  exit /b 1
)

REM 检查 Python 版本 (>= 3.10)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set "PY_VER=%%v"
echo ==^> Python 版本: %PY_VER%
for /f "tokens=1,2 delims=." %%a in ("%PY_VER%") do (
  set "PY_MAJOR=%%a"
  set "PY_MINOR=%%b"
)
if %PY_MAJOR% LSS 3 (
  echo [错误] 需要 Python 3.10 或更高版本
  exit /b 1
)
if %PY_MAJOR% EQU 3 if %PY_MINOR% LSS 10 (
  echo [错误] 需要 Python 3.10 或更高版本（当前 %PY_VER%）
  exit /b 1
)

REM 创建虚拟环境
if not exist .venv (
  echo ==^> 创建虚拟环境 .venv
  python -m venv .venv
  if errorlevel 1 (
    echo [错误] 虚拟环境创建失败
    exit /b 1
  )
)
call .venv\Scripts\activate.bat

REM 升级 pip / wheel / setuptools
echo ==^> 升级 pip
python -m pip install --upgrade pip wheel setuptools

REM 安装依赖
if "%OFFLINE%"=="1" (
  echo ==^> 离线安装依赖（从 wheels\ 目录）
  if not exist wheels (
    echo [错误] 缺少 wheels\ 目录
    echo        请先在有网环境运行: pip download -r requirements.txt -d wheels\
    exit /b 1
  )
  pip install --no-index --find-links wheels -r requirements.txt
  if errorlevel 1 (
    echo [错误] 离线依赖安装失败
    exit /b 1
  )
) else (
  echo ==^> 在线安装依赖
  pip install -r requirements.txt
  if errorlevel 1 (
    echo [错误] 依赖安装失败
    exit /b 1
  )
)

REM 安装本项目（不用 build isolation，避免重复下载 setuptools）
echo ==^> 安装 abb-agent 包
pip install --no-build-isolation -e .
if errorlevel 1 (
  echo [错误] 项目安装失败
  exit /b 1
)

REM 检查 Ollama
where ollama >nul 2>nul
if errorlevel 1 (
  echo ==^> 未检测到 ollama
  echo     请从 https://ollama.com/download 下载并安装 Windows 版
  echo     安装后重启此终端即可识别到 ollama 命令
) else (
  for /f %%v in ('ollama --version 2^>nul') do set "OLLAMA_VER=%%v"
  echo ==^> ollama 已安装: %OLLAMA_VER%
)

echo.
echo ==^> 安装完成
echo.
echo 下一步：
echo   1) 启动 Ollama 服务（保持开启，新窗口）:
echo        ollama serve
echo   2) 拉取模型（首次需要联网，约 4.5GB）:
echo        ollama pull qwen2.5-coder:7b-instruct-q4_K_M
echo        ollama pull qwen2.5-coder:3b-instruct-q4_K_M  (更小，备选)
echo   3) 把 ABB 资料放入 data\raw\pdf\ 等目录
echo   4) 构建知识库:
echo        python scripts\build_knowledge_base.py
echo   5) 健康体检:
echo        abb-agent doctor
echo   6) 生成代码:
echo        abb-agent gen "对 600x400 矩形面做 Z 字扫描喷涂，行距 50mm"

endlocal
