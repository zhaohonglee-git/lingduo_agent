#!/usr/bin/env bash
# 在"有网工作站"上打包离线部署包，可拷贝到工业 PC 直接使用。
#
# 用法：
#   bash scripts/package_offline.sh                       # 默认含全部 Ollama 模型
#   bash scripts/package_offline.sh --skip-ollama         # 不含 Ollama 模型（轻量）
#   bash scripts/package_offline.sh --ollama-only qwen    # 只含 qwen 系列模型
#   bash scripts/package_offline.sh --no-wheels           # 不下载 wheel（用现有 .venv）
#
# 产物：abb-agent-offline-<date>.tar.gz
#   - 项目代码
#   - Python wheels (除非 --no-wheels)
#   - sentence-transformers 嵌入模型
#   - 已构建的 ChromaDB 向量库
#   - ollama 模型（按选项过滤）

set -euo pipefail

SKIP_OLLAMA=0
OLLAMA_FILTER=""
NO_WHEELS=0
for arg in "$@"; do
  case "$arg" in
    --skip-ollama) SKIP_OLLAMA=1 ;;
    --no-wheels) NO_WHEELS=1 ;;
    --ollama-only) OLLAMA_FILTER="next" ;;
    *)
      if [ "$OLLAMA_FILTER" = "next" ]; then
        OLLAMA_FILTER="$arg"
      fi
      ;;
  esac
done

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

DATE_TAG=$(date +%Y%m%d_%H%M)
OUTPUT_DIR="dist/offline-bundle-$DATE_TAG"
echo "==> 打包到: $OUTPUT_DIR"
echo "==> 选项: SKIP_OLLAMA=$SKIP_OLLAMA, OLLAMA_FILTER=${OLLAMA_FILTER:-(全部)}, NO_WHEELS=$NO_WHEELS"
mkdir -p "$OUTPUT_DIR"

# 1) 下载所有 Python 依赖 wheel
if [ "$NO_WHEELS" -eq 0 ]; then
  echo "==> 下载依赖 wheel"
  pip download -r requirements.txt -d "$OUTPUT_DIR/wheels/" || echo "  (wheel 下载有警告，继续)"
else
  echo "==> 跳过 wheel 下载（--no-wheels）"
fi

# 2) 复制项目代码（不含 .venv / data / models）
echo "==> 复制项目代码"
rsync -a --exclude='.venv' --exclude='.git' --exclude='dist' \
  --exclude='__pycache__' --exclude='*.pyc' \
  --exclude='data/raw' --exclude='data/chroma_db' --exclude='data/parsed' \
  --exclude='logs' --exclude='output' --exclude='models' \
  abb_agent scripts pyproject.toml requirements.txt requirements-dev.txt \
  README.md PROJECT_STATUS.md .gitignore "$OUTPUT_DIR/"
[ -d docs ] && rsync -a docs "$OUTPUT_DIR/"
[ -d examples ] && rsync -a examples "$OUTPUT_DIR/"

# 3) 复制嵌入模型
if [ -d "models/embeddings" ]; then
  echo "==> 复制嵌入模型"
  mkdir -p "$OUTPUT_DIR/models"
  cp -r models/embeddings "$OUTPUT_DIR/models/"
fi

# 4) 复制向量库
if [ -d "data/chroma_db" ]; then
  echo "==> 复制向量库"
  mkdir -p "$OUTPUT_DIR/data"
  cp -r data/chroma_db "$OUTPUT_DIR/data/"
fi

# 5) 复制 Ollama 模型 (可选 - 体积大)
if [ "$SKIP_OLLAMA" -eq 1 ]; then
  echo "==> 跳过 Ollama 模型（--skip-ollama）"
elif [ -d "$HOME/.ollama/models" ]; then
  if [ -n "$OLLAMA_FILTER" ]; then
    echo "==> 复制 Ollama 模型 (按 $OLLAMA_FILTER 过滤)"
    mkdir -p "$OUTPUT_DIR/ollama_models/manifests"
    mkdir -p "$OUTPUT_DIR/ollama_models/blobs"

    # 找出过滤匹配的 manifest 文件
    matched_manifests=$(find "$HOME/.ollama/models/manifests" -type f -name "*" 2>/dev/null | grep -i "$OLLAMA_FILTER" || true)
    if [ -z "$matched_manifests" ]; then
      echo "  ⚠ 没有匹配 '$OLLAMA_FILTER' 的模型"
    else
      # 收集需要的 blob SHA
      needed_blobs=$(echo "$matched_manifests" | while read m; do
        cp --parents "$m" "$OUTPUT_DIR/ollama_models/" 2>/dev/null || \
          rsync -aR "${m#/}" "$OUTPUT_DIR/ollama_models/" || true
        grep -oE 'sha256:[a-f0-9]+' "$m" | sed 's/sha256://'
      done | sort -u)
      echo "  匹配到 $(echo "$needed_blobs" | wc -w) 个 blob"
      for sha in $needed_blobs; do
        blob_file="$HOME/.ollama/models/blobs/sha256-$sha"
        if [ -f "$blob_file" ]; then
          cp "$blob_file" "$OUTPUT_DIR/ollama_models/blobs/" 2>/dev/null || true
        fi
      done
    fi
  else
    echo "==> 复制全部 Ollama 模型 (可能需要几分钟，可能数 GB)"
    mkdir -p "$OUTPUT_DIR/ollama_models"
    cp -r "$HOME/.ollama/models" "$OUTPUT_DIR/ollama_models/"
  fi
fi

# 7) 复制 ABB 手册（如果有）
if [ -d "data/raw/pdf" ] && [ "$(ls -A data/raw/pdf 2>/dev/null)" ]; then
  echo "==> 复制 ABB 手册（${OUTPUT_DIR}/data/raw/pdf/）"
  mkdir -p "$OUTPUT_DIR/data/raw/pdf"
  cp data/raw/pdf/*.pdf "$OUTPUT_DIR/data/raw/pdf/" 2>/dev/null || true
fi

# 8) 添加离线安装说明
cat > "$OUTPUT_DIR/OFFLINE_INSTALL.md" <<'EOF'
# ABB Agent 离线安装说明

## 工业 PC 端步骤

1. **解压本目录** 到工业 PC，例如：`C:\ABB-Agent`

2. **安装 Ollama**（如果还未安装）：
   - Mac/Linux: `curl -fsSL https://ollama.com/install.sh | sh`
   - Windows: 从 https://ollama.com/download 下载安装包

3. **导入 Ollama 模型**（若本包含模型）：
   - 把 `ollama_models/` 目录内容拷贝到：
     - Mac/Linux: `~/.ollama/models/`
     - Windows: `%USERPROFILE%\.ollama\models\`
   - 若没有，按需运行 `ollama pull qwen2.5-coder:3b-instruct-q4_K_M`

4. **安装 Python 依赖**：
   - Mac/Linux: `bash scripts/install.sh --offline`
   - Windows: `scripts\install.bat /offline`

5. **启动 Ollama 服务**（新终端常开）：
   ```
   ollama serve
   ```

6. **验证**：
   ```
   abb-agent doctor      # 应所有项目都是绿色 ✓
   abb-agent kb status   # 显示切片数
   ```

7. **使用**：
   ```
   abb-agent gen "对 600x400 矩形面做 Z 字扫描喷涂，行距 50mm"
   abb-agent chat        # 多轮对话
   ```

## 故障排查

- `abb-agent doctor` 报 "本地模型未找到"：检查 ollama list，必要时 `ollama pull <model>`
- "向量库为空"：运行 `python scripts/build_knowledge_base.py`
- 推理太慢：换用更小模型 `export ABB_AGENT_LLM_MODEL_NAME="qwen2.5-coder:3b-instruct-q4_K_M"`
EOF

# 9) 打 tar.gz
TARBALL="dist/abb-agent-offline-$DATE_TAG.tar.gz"
echo "==> 打包 $TARBALL"
tar -czf "$TARBALL" -C dist "offline-bundle-$DATE_TAG"

du -sh "$TARBALL"
du -sh "$OUTPUT_DIR"
echo ""
echo "==> 完成。把 $TARBALL 拷贝到工业 PC 即可"
