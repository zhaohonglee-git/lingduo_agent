# ABB Agent Windows 离线打包脚本 (PowerShell)
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\package_offline.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\package_offline.ps1 -SkipOllama
#   powershell -ExecutionPolicy Bypass -File scripts\package_offline.ps1 -SkipOllama -NoWheels

param(
    [switch]$SkipOllama = $false,
    [switch]$NoWheels = $false,
    [string]$OllamaFilter = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$dateTag = Get-Date -Format "yyyyMMdd_HHmm"
$outputDir = "dist\offline-bundle-$dateTag"

Write-Host "==> ABB Agent 离线打包 (Windows)" -ForegroundColor Cyan
Write-Host "==> 项目目录: $projectRoot"
Write-Host "==> 输出: $outputDir"
Write-Host "==> 选项: SkipOllama=$SkipOllama, NoWheels=$NoWheels, OllamaFilter=$OllamaFilter"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# 1) 下载所有 Python 依赖 wheel
if (-not $NoWheels) {
    Write-Host "==> 下载依赖 wheel" -ForegroundColor Green
    $wheelsDir = "$outputDir\wheels"
    New-Item -ItemType Directory -Force -Path $wheelsDir | Out-Null
    pip download -r requirements.txt -d $wheelsDir
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "  wheel 下载有警告，继续打包"
    }
} else {
    Write-Host "==> 跳过 wheel 下载（-NoWheels）" -ForegroundColor Yellow
}

# 2) 复制项目代码
Write-Host "==> 复制项目代码" -ForegroundColor Green
$excludes = @('.venv', '.git', 'dist', '__pycache__', '*.pyc', 'logs', 'output', 'models')
robocopy abb_agent "$outputDir\abb_agent" /E /XD __pycache__ /NFL /NDL /NJH /NJS | Out-Null
robocopy scripts "$outputDir\scripts" /E /NFL /NDL /NJH /NJS | Out-Null
Copy-Item pyproject.toml, requirements.txt, requirements-dev.txt -Destination $outputDir -Force
if (Test-Path README.md) { Copy-Item README.md -Destination $outputDir -Force }
if (Test-Path PROJECT_STATUS.md) { Copy-Item PROJECT_STATUS.md -Destination $outputDir -Force }
if (Test-Path .gitignore) { Copy-Item .gitignore -Destination $outputDir -Force }
if (Test-Path docs) {
    robocopy docs "$outputDir\docs" /E /NFL /NDL /NJH /NJS | Out-Null
}
if (Test-Path examples) {
    robocopy examples "$outputDir\examples" /E /NFL /NDL /NJH /NJS | Out-Null
}

# 3) 复制嵌入模型
if (Test-Path "models\embeddings") {
    Write-Host "==> 复制嵌入模型" -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path "$outputDir\models" | Out-Null
    robocopy models\embeddings "$outputDir\models\embeddings" /E /NFL /NDL /NJH /NJS | Out-Null
}

# 4) 复制向量库
if (Test-Path "data\chroma_db") {
    Write-Host "==> 复制向量库" -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path "$outputDir\data" | Out-Null
    robocopy data\chroma_db "$outputDir\data\chroma_db" /E /NFL /NDL /NJH /NJS | Out-Null
}

# 5) 复制 ABB 手册
if (Test-Path "data\raw\pdf") {
    $pdfs = Get-ChildItem "data\raw\pdf\*.pdf" -ErrorAction SilentlyContinue
    if ($pdfs.Count -gt 0) {
        Write-Host "==> 复制 ABB 手册（$($pdfs.Count) 本）" -ForegroundColor Green
        New-Item -ItemType Directory -Force -Path "$outputDir\data\raw\pdf" | Out-Null
        Copy-Item "data\raw\pdf\*.pdf" -Destination "$outputDir\data\raw\pdf\"
    }
}

# 6) 复制 Ollama 模型
if (-not $SkipOllama) {
    $ollamaDir = "$env:USERPROFILE\.ollama\models"
    if (Test-Path $ollamaDir) {
        Write-Host "==> 复制 Ollama 模型 (可能耗时)" -ForegroundColor Green
        if ($OllamaFilter -ne "") {
            Write-Host "    按 '$OllamaFilter' 过滤" -ForegroundColor Yellow
            $manifests = Get-ChildItem "$ollamaDir\manifests" -Recurse -File | Where-Object { $_.FullName -match $OllamaFilter }
            if ($manifests.Count -eq 0) {
                Write-Warning "    没有匹配的模型"
            } else {
                # 复制匹配的 manifests，收集对应 blob SHA
                $blobShas = @{}
                foreach ($m in $manifests) {
                    $relativePath = $m.FullName.Substring($ollamaDir.Length + 1)
                    $destPath = "$outputDir\ollama_models\$relativePath"
                    New-Item -ItemType Directory -Force -Path (Split-Path $destPath -Parent) | Out-Null
                    Copy-Item $m.FullName -Destination $destPath -Force
                    # 抓取 sha256 引用
                    $content = Get-Content $m.FullName -Raw
                    $matches = [regex]::Matches($content, 'sha256:([a-f0-9]+)')
                    foreach ($mm in $matches) {
                        $blobShas[$mm.Groups[1].Value] = $true
                    }
                }
                New-Item -ItemType Directory -Force -Path "$outputDir\ollama_models\blobs" | Out-Null
                foreach ($sha in $blobShas.Keys) {
                    $blobFile = "$ollamaDir\blobs\sha256-$sha"
                    if (Test-Path $blobFile) {
                        Copy-Item $blobFile -Destination "$outputDir\ollama_models\blobs\"
                    }
                }
                Write-Host "    已打包 $($blobShas.Count) 个 blob"
            }
        } else {
            Write-Host "    复制全部 Ollama 模型" -ForegroundColor Yellow
            New-Item -ItemType Directory -Force -Path "$outputDir\ollama_models" | Out-Null
            robocopy $ollamaDir "$outputDir\ollama_models" /E /NFL /NDL /NJH /NJS | Out-Null
        }
    }
} else {
    Write-Host "==> 跳过 Ollama 模型（-SkipOllama）" -ForegroundColor Yellow
}

# 7) 写入离线安装说明
$installGuide = @'
# ABB Agent 离线安装说明 (Windows)

## 步骤

1. 解压本目录到工业 PC，例如 C:\ABB-Agent

2. 安装 Python 3.10+ (https://www.python.org/downloads/)
   注意安装时勾选 "Add Python to PATH"

3. 安装 Ollama (https://ollama.com/download)

4. 若本包含 ollama_models\ 子目录：
   把里面内容复制到 %USERPROFILE%\.ollama\models\

5. 安装 Python 依赖：
   scripts\install.bat /offline

6. 启动 Ollama 服务（新终端常开）：
   ollama serve

7. 验证：
   abb-agent doctor

8. 使用：
   abb-agent gen "对 600x400 矩形面做 Z 字扫描喷涂，行距 50mm"
'@
$installGuide | Out-File "$outputDir\OFFLINE_INSTALL.md" -Encoding utf8

# 8) 打 zip
Write-Host "==> 压缩为 zip" -ForegroundColor Cyan
$tarball = "dist\abb-agent-offline-$dateTag.zip"
if (Test-Path $tarball) { Remove-Item $tarball }
Compress-Archive -Path $outputDir -DestinationPath $tarball -CompressionLevel Optimal

$sizeMB = [math]::Round((Get-Item $tarball).Length / 1MB, 1)
Write-Host ""
Write-Host "==> 完成！" -ForegroundColor Green
Write-Host "    压缩包: $tarball ($sizeMB MB)"
Write-Host "    把它拷贝到工业 PC 即可"
