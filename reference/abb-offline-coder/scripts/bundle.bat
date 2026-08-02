@echo off
REM ============================================================================
REM bundle.bat — 一键完整打包（Windows 零参数）
REM ============================================================================
REM 用途：在已配置好的源 Windows 设备上一键打包整套环境为单个 zip。
REM 用法：scripts\bundle.bat
REM
REM 实际工作交给 package_offline.ps1（默认行为：含全部 Ollama 模型 + wheels +
REM KB + PDF + 嵌入模型），并在产物旁生成还原脚本和 SHA256。
REM ============================================================================

chcp 65001 >nul
setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0.."
cd /d "%PROJECT_ROOT%"

echo ==^> ABB Agent 一键完整打包 (Windows)
echo ==^> 项目目录: %CD%
echo.

REM 检查 PowerShell 是否可用
where powershell >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 powershell.exe
  exit /b 1
)

REM 调用 PowerShell 实现（默认行为 = 含全部内容，不传任何 -SkipXxx 参数）
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0package_offline.ps1"
if errorlevel 1 (
  echo [错误] 打包失败
  exit /b 1
)

REM 找出最新产物并生成 SHA256
for /f "delims=" %%f in ('dir /b /od dist\abb-agent-offline-*.zip 2^>nul') do set "LATEST=%%f"
if defined LATEST (
  echo.
  echo ==^> 生成 SHA256
  certutil -hashfile "dist\!LATEST!" SHA256 | findstr /v "SHA256\|CertUtil" > "dist\!LATEST!.sha256"
  echo   dist\!LATEST!
  for %%A in ("dist\!LATEST!") do echo   大小: %%~zA 字节
  echo   校验: dist\!LATEST!.sha256
  echo.
  echo ==^> 完成。拷到新设备后:
  echo     1) 解压 zip
  echo     2) 双击 OFFLINE_INSTALL.md 按指引操作
  echo     3) 或直接执行 scripts\install.bat /offline
)

endlocal
