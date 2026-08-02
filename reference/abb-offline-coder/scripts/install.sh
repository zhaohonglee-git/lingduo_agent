#!/usr/bin/env bash
# ABB Agent 安装脚本 (macOS / Linux)
#
# 使用方法：
#   bash scripts/install.sh             # 有网在线安装
#   bash scripts/install.sh --offline   # 离线模式（依赖打包）

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

OFFLINE_MODE=0
for arg in "$@"; do
  case "$arg" in
    --offline) OFFLINE_MODE=1 ;;
  esac
done

echo "==> ABB Agent 安装"
echo "==> 项目目录: $PROJECT_ROOT"
echo "==> 离线模式: $OFFLINE_MODE"

# 1) 检查 Python 3.10+
PYTHON="${PYTHON:-python3}"
PY_VER=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "==> Python: $($PYTHON --version)"
case "$PY_VER" in
  3.10|3.11|3.12|3.13) ;;
  *) echo "需要 Python 3.10 或更高版本" && exit 1 ;;
esac

# 2) 创建虚拟环境
if [ ! -d ".venv" ]; then
  echo "==> 创建虚拟环境 .venv"
  "$PYTHON" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

# 3) 升级 pip
echo "==> 升级 pip"
python -m pip install --upgrade pip wheel setuptools

# 4) 安装依赖
if [ "$OFFLINE_MODE" -eq 1 ]; then
  echo "==> 离线安装依赖（从 wheels/ 目录）"
  if [ ! -d "wheels" ]; then
    echo "缺少 wheels/ 目录。请先在有网环境运行：" >&2
    echo "  pip download -r requirements.txt -d wheels/" >&2
    exit 1
  fi
  pip install --no-index --find-links wheels -r requirements.txt
else
  echo "==> 在线安装依赖"
  pip install -r requirements.txt
fi

# 5) 安装本项目（开发模式）
echo "==> 安装 abb-agent 包"
pip install -e .

# 6) 检查 Ollama
if ! command -v ollama >/dev/null 2>&1; then
  echo "==> 未检测到 ollama"
  if [ "$OFFLINE_MODE" -eq 0 ]; then
    case "$(uname -s)" in
      Linux|Darwin)
        echo "==> 自动安装 ollama"
        curl -fsSL https://ollama.com/install.sh | sh
        ;;
      *) echo "请手动安装 ollama: https://ollama.com/download" ;;
    esac
  else
    echo "==> 离线模式：请预先安装 ollama 并放置在 PATH 中"
  fi
else
  echo "==> ollama 已安装: $(ollama --version 2>/dev/null || echo unknown)"
fi

echo ""
echo "==> 安装完成"
echo ""
echo "下一步："
echo "  1) 启动 ollama 服务：[新终端] ollama serve"
echo "  2) 拉取模型（首次）：python scripts/download_models.py"
echo "  3) 把 ABB 资料放入 data/raw/{pdf,code,html}/"
echo "  4) 构建知识库：python scripts/build_knowledge_base.py"
echo "  5) 体检：abb-agent doctor"
echo "  6) 生成代码：abb-agent gen \"你的需求\""
