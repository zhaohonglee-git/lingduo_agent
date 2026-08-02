#!/usr/bin/env bash
# ============================================================================
# bundle.sh  —  一键完整打包（零参数 / 智能默认）
# ============================================================================
# 用途：在「已配置好的源设备」上跑这一条命令，把整套环境（代码 + 模型 +
#       向量库 + 手册 + 依赖 wheels）压成一个文件，拷到新设备上还原即可。
#
# 用法：
#   bash scripts/bundle.sh
#
# 输出：
#   dist/abb-bundle-<date>.tar.gz
#   dist/abb-bundle-<date>.tar.gz.sha256
#
# 在目标设备上还原：
#   tar -xzf abb-bundle-<date>.tar.gz
#   cd abb-bundle-<date>
#   bash restore.sh
# ============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

DATE_TAG=$(date +%Y%m%d_%H%M)
STAGE="dist/abb-bundle-$DATE_TAG"
TARBALL="dist/abb-bundle-$DATE_TAG.tar.gz"

# 输出颜色
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RESET='\033[0m'

step() { printf "${BLUE}==>${RESET} ${1}\n"; }
ok()   { printf "${GREEN}  ✓${RESET} ${1}\n"; }
warn() { printf "${YELLOW}  △${RESET} ${1}\n"; }

step "ABB Agent 一键完整打包"
step "项目根：$PROJECT_ROOT"
step "暂存到：$STAGE"
mkdir -p "$STAGE"

# ----------------------------------------------------------------------------
# 1) 源代码 + 文档
# ----------------------------------------------------------------------------
step "1/7  复制源代码 + 文档"
rsync -a \
  --exclude='.venv' --exclude='.git' --exclude='dist' \
  --exclude='__pycache__' --exclude='*.pyc' \
  --exclude='data/raw' --exclude='data/chroma_db' --exclude='data/parsed' \
  --exclude='logs' --exclude='output' --exclude='models' \
  --exclude='.playwright-mcp' --exclude='.pytest_cache' \
  --exclude='.coverage' \
  abb_agent scripts pyproject.toml requirements.txt requirements-dev.txt \
  README.md LICENSE .gitignore "$STAGE/"
[ -d docs ]     && rsync -a docs "$STAGE/"
[ -d examples ] && rsync -a examples "$STAGE/"
[ -f PROJECT_STATUS.md ] && cp PROJECT_STATUS.md "$STAGE/"
[ -f EXECUTION_LOG.md ]  && cp EXECUTION_LOG.md  "$STAGE/"
ok "代码 + 文档已暂存"

# ----------------------------------------------------------------------------
# 2) Python wheels (离线安装用)
# ----------------------------------------------------------------------------
step "2/7  预下载 Python wheels (可离线安装)"
if pip download --quiet -r requirements.txt -d "$STAGE/wheels/" 2>/dev/null; then
  count=$(ls "$STAGE/wheels/" 2>/dev/null | wc -l | tr -d ' ')
  ok "已收集 $count 个 wheel"
else
  warn "wheel 下载失败（可能无网），目标设备上需联网安装依赖"
fi

# ----------------------------------------------------------------------------
# 3) 嵌入模型 (bge-small-zh)
# ----------------------------------------------------------------------------
step "3/7  打包嵌入模型 (bge-small-zh)"
if [ -d "models/embeddings" ]; then
  mkdir -p "$STAGE/models"
  cp -r models/embeddings "$STAGE/models/"
  ok "已打包 ($(du -sh models/embeddings | awk '{print $1}'))"
else
  warn "models/embeddings 不存在 — 目标设备首次运行会自动从 HuggingFace 拉取"
fi

# ----------------------------------------------------------------------------
# 4) 向量库 (ChromaDB 持久化)
# ----------------------------------------------------------------------------
step "4/7  打包向量库 (ChromaDB)"
if [ -d "data/chroma_db" ] && [ -n "$(ls -A data/chroma_db 2>/dev/null)" ]; then
  mkdir -p "$STAGE/data"
  cp -r data/chroma_db "$STAGE/data/"
  count=$(python3 -c "
import chromadb
from chromadb.config import Settings
c = chromadb.PersistentClient(path='data/chroma_db', settings=Settings(anonymized_telemetry=False))
try:
    col = c.get_collection('abb_rapid_knowledge')
    print(col.count())
except: print('?')
" 2>/dev/null || echo "?")
  ok "已打包 ($(du -sh data/chroma_db | awk '{print $1}'), $count 个切片)"
else
  warn "data/chroma_db 为空 — 目标设备需放 PDF 后跑 build_knowledge_base.py"
fi

# ----------------------------------------------------------------------------
# 5) ABB 官方手册 PDF (注意版权)
# ----------------------------------------------------------------------------
step "5/7  打包 ABB 官方手册 PDF"
if [ -d "data/raw/pdf" ] && ls data/raw/pdf/*.pdf >/dev/null 2>&1; then
  mkdir -p "$STAGE/data/raw/pdf"
  cp data/raw/pdf/*.pdf "$STAGE/data/raw/pdf/"
  count=$(ls data/raw/pdf/*.pdf | wc -l | tr -d ' ')
  size=$(du -sh data/raw/pdf | awk '{print $1}')
  ok "已打包 $count 本手册 ($size)"
  warn "手册受 ABB 版权 — 仅供本机离线使用，请勿再分发"
else
  warn "无 PDF 手册可打包"
fi

# ----------------------------------------------------------------------------
# 6) Ollama 模型 (LLM 主体, 通常最大)
# ----------------------------------------------------------------------------
step "6/7  打包 Ollama 模型 (LLM)"
OLLAMA_DIR="${OLLAMA_MODELS:-$HOME/.ollama/models}"
if [ -d "$OLLAMA_DIR" ]; then
  size=$(du -sh "$OLLAMA_DIR" | awk '{print $1}')
  step "    源大小: $size — 复制中（可能数 GB，需要一些时间）"
  mkdir -p "$STAGE/ollama_models"
  cp -r "$OLLAMA_DIR/." "$STAGE/ollama_models/"
  ok "Ollama 模型已打包"
else
  warn "未找到 $OLLAMA_DIR — 目标设备需自行 ollama pull"
fi

# ----------------------------------------------------------------------------
# 7) 写入还原脚本 + 自描述清单
# ----------------------------------------------------------------------------
step "7/7  生成还原脚本 + 清单"

cat > "$STAGE/restore.sh" <<'RESTORE_EOF'
#!/usr/bin/env bash
# ============================================================================
# restore.sh — 在新设备上一键还原 ABB Agent 完整环境
# 用法：bash restore.sh
# ============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RESET='\033[0m'
step() { printf "${BLUE}==>${RESET} ${1}\n"; }
ok()   { printf "${GREEN}  ✓${RESET} ${1}\n"; }
warn() { printf "${YELLOW}  △${RESET} ${1}\n"; }

step "ABB Agent 一键还原"

# 1) Python 检查
step "1/5  检查 Python (>= 3.10)"
PYTHON="${PYTHON:-python3}"
if ! "$PYTHON" -c "import sys; assert sys.version_info >= (3,10)" 2>/dev/null; then
  echo "需要 Python 3.10 或以上"; exit 1
fi
ok "$($PYTHON --version)"

# 2) 虚拟环境 + 离线安装
step "2/5  创建 .venv 并安装依赖"
"$PYTHON" -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --quiet --upgrade pip wheel setuptools 2>/dev/null || true
if [ -d wheels ]; then
  pip install --quiet --no-index --find-links wheels -r requirements.txt
  ok "已用本地 wheels 离线安装"
else
  pip install --quiet -r requirements.txt
  ok "已联网安装"
fi
pip install --quiet --no-build-isolation -e .
ok "abb-agent 已安装"

# 3) 导入 Ollama 模型
step "3/5  导入 Ollama 模型"
if [ -d ollama_models ]; then
  TARGET="${OLLAMA_MODELS:-$HOME/.ollama/models}"
  mkdir -p "$TARGET"
  cp -rn ollama_models/. "$TARGET/"
  ok "已合并到 $TARGET"
else
  warn "无 Ollama 模型，需自行 ollama pull"
fi

# 4) 验证向量库 + 嵌入
step "4/5  检查向量库 + 嵌入模型"
[ -d data/chroma_db ] && ok "向量库已就位" || warn "向量库缺失"
[ -d models/embeddings ] && ok "嵌入模型已就位" || warn "嵌入模型首次使用时自动下载"

# 5) 启动建议
step "5/5  完成 — 推荐验证"
echo ""
echo "  ${GREEN}下一步：${RESET}"
echo "    1) 另开终端启动 Ollama 服务："
echo "         ollama serve"
echo "    2) 健康体检："
echo "         source .venv/bin/activate"
echo "         abb-agent doctor"
echo "    3) 生成第一段代码："
echo "         abb-agent gen \"对 600x400 矩形面做 Z 字扫描喷涂\""
RESTORE_EOF
chmod +x "$STAGE/restore.sh"

# Windows 版还原脚本
cat > "$STAGE/restore.bat" <<'RESTORE_BAT_EOF'
@echo off
REM ============================================================================
REM restore.bat — Windows 一键还原
REM ============================================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==^> ABB Agent 一键还原 (Windows)

REM 1) Python 检查
where python >nul 2>nul
if errorlevel 1 ( echo 需要 Python 3.10+: https://www.python.org/downloads/ & exit /b 1 )
python --version

REM 2) 虚拟环境
if not exist .venv ( python -m venv .venv )
call .venv\Scripts\activate.bat
python -m pip install --quiet --upgrade pip wheel setuptools

REM 3) 安装依赖
if exist wheels (
  pip install --quiet --no-index --find-links wheels -r requirements.txt
  echo   离线安装完成
) else (
  pip install --quiet -r requirements.txt
)
pip install --quiet --no-build-isolation -e .

REM 4) 导入 Ollama 模型
if exist ollama_models (
  set "TARGET=%USERPROFILE%\.ollama\models"
  if not exist "!TARGET!" mkdir "!TARGET!"
  xcopy /E /I /Y /Q ollama_models "!TARGET!" >nul
  echo   Ollama 模型已合并到 !TARGET!
) else (
  echo   无 Ollama 模型 — 需自行 ollama pull
)

echo.
echo ==^> 还原完成。下一步：
echo     1) 新窗口启动: ollama serve
echo     2) 自检:      abb-agent doctor
echo     3) 生成:      abb-agent gen "你的需求"
endlocal
RESTORE_BAT_EOF

# 清单
cat > "$STAGE/MANIFEST.txt" <<EOF
ABB Agent Bundle
================
打包时间: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
打包来源: $PROJECT_ROOT
源 commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)

内容清单：
$(cd "$STAGE" && du -sh */ *.* 2>/dev/null | sort -h)

总大小（解压后）：$(du -sh "$STAGE" | awk '{print $1}')

还原方式：
  Mac/Linux:  bash restore.sh
  Windows:    restore.bat /offline
EOF
ok "清单已写入"

# ----------------------------------------------------------------------------
# 打包成 tar.gz + 算 SHA256
# ----------------------------------------------------------------------------
step "压缩为 tar.gz（可能需要几分钟）"
tar -czf "$TARBALL" -C dist "abb-bundle-$DATE_TAG"

if command -v shasum >/dev/null; then
  shasum -a 256 "$TARBALL" > "$TARBALL.sha256"
elif command -v sha256sum >/dev/null; then
  sha256sum "$TARBALL" > "$TARBALL.sha256"
fi

# ----------------------------------------------------------------------------
# 报告
# ----------------------------------------------------------------------------
echo ""
printf "${GREEN}════════════════════════════════════════════════════════════════${RESET}\n"
printf "${GREEN}打包完成${RESET}\n"
printf "${GREEN}════════════════════════════════════════════════════════════════${RESET}\n"
echo ""
echo "  📦 $TARBALL"
echo "     大小: $(du -sh "$TARBALL" | awk '{print $1}')"
[ -f "$TARBALL.sha256" ] && echo "     校验: $(cat "$TARBALL.sha256" | awk '{print $1}')"
echo ""
echo "  🚚 拷贝到新设备后："
echo "     tar -xzf abb-bundle-$DATE_TAG.tar.gz"
echo "     cd abb-bundle-$DATE_TAG"
echo "     bash restore.sh        # Mac/Linux"
echo "     restore.bat            # Windows"
echo ""
