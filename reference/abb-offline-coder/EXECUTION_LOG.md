# 本次执行记录 (2026-05-16)

> "开始" — 用户要求全部执行 4 项后续优化

## 执行项目

### ✅ 1. 搜集并下载 10 本 ABB 官方手册

从 ABB 官方资料库 (`library.e.abb.com` / `search.abb.com`) 直接下载：

| # | 文件 | 大小 | 文档号 |
|---|------|------|--------|
| 1 | RAPID_Instructions_Functions_Datatypes.pdf | 7.9 MB | 3HAC16581 |
| 2 | RAPID_Overview_RW6.pdf | 2.8 MB | 3HAC050947 |
| 3 | RAPID_Kernel_RW6.pdf | 1.2 MB | 3HAC050946 |
| 4 | Painting_PowerPac_Operating_Manual.pdf | 3.3 MB | 3HNA019758 |
| 5 | Paint_Application_Equipment.pdf | 1.8 MB | - |
| 6 | IRB52_Compact_Painting_Specialist.pdf | 747 KB | 9AKK104295D8227 |
| 7 | IRB5710_Product_Manual.pdf | 34 MB | 3HAC075184 |
| 8 | IRB5400_HighPerformance_Datasheet.pdf | 855 KB | - |
| 9 | IRB5400_Process_Datasheet.pdf | 263 KB | - |
| 10 | IRB5400_Slim_Datasheet.pdf | 400 KB | - |
| | **合计** | **54 MB** | |

### ✅ 2. 重建知识库

```
解析 27 个 PDF 章节 → 切片 7497 条 → 嵌入入 ChromaDB
耗时：约 65 秒
KB 大小：52 MB
```

新增切片数：7497 - 6475 = **1022 个**（来自新追加的 5 本手册）

### ✅ 3. 检索质量验证

| 测试查询 | 命中关键资料 |
|---------|-------------|
| "BrushData 喷涂工艺参数 流量 雾化" | Painting Tab 中 Brush properties；Air Flow Sensor |
| "TCP 校准 工具坐标定义" | **`MToolTCPCalib`** 官方指令文档（小模型不知道的专业名称） |

### ✅ 4. 用 RAG-注入的知识做端到端生成

**输入**：`"用 MToolTCPCalib 指令写一个 4 点 TCP 校准例程"`

**模型**：gemma4:e4b（替代尚未到位的 Qwen）

**输出**：[output/PaintProgram_20260516_141918.mod](output/PaintProgram_20260516_141918.mod)
- ✓ 正确使用 `MToolTCPCalib`（从 KB 注入）
- ✓ 引导操作员通过 `Calibration > Define Tool > MToolTCPCalib` 流程
- ✓ tooldata 声明完整
- ✓ 语法校验通过

### ✅ 5. 离线打包成功

```bash
bash scripts/package_offline.sh --skip-ollama --no-wheels
```

**产物**：[dist/abb-agent-offline-20260516_1426.tar.gz](dist/abb-agent-offline-20260516_1426.tar.gz)
- 压缩大小：**192 MB**
- 解压后：300 MB / 129 文件
- 包含：源码 + bge 嵌入模型 + ChromaDB 向量库 + 10 本 PDF 手册 + 文档

#### 包内构成

| 部分 | 大小 |
|------|------|
| abb_agent/ 源码 | 220 KB |
| data/raw/pdf/ 10 本手册 | 54 MB |
| data/chroma_db/ 向量库 | 52 MB |
| models/embeddings/ bge 模型 | 92 MB（含 safetensors 等共 184M） |
| docs / scripts / 配置 | ~50 KB |

#### package_offline.sh 新增选项

```bash
--skip-ollama        # 不打包 Ollama 模型（默认会拷贝全部，可能数 GB）
--ollama-only qwen   # 只打包匹配 'qwen' 的模型
--no-wheels          # 不预下载 Python wheels
```

### ⚠️ 6. Qwen2.5-Coder 主模型下载受阻

**Qwen 7B Q4 (4.5GB)**：下载到 4.4G/4.7G 后卡住不动（疑似网络限速 + 磁盘空间紧张），最终放弃。

**Qwen 3B Q4 (2GB)**：下载到 1.9G/2G 后同样卡住，进程仍存活但无进度。

**应对**：
- 用 `gemma4:e4b`（本机已有，9.6GB）作为代用模型
- 已验证生成质量足够（能正确引用 RAG 注入的 `MToolTCPCalib` 等专业指令）
- 用户后续可在网络稳定时重试：`ollama pull qwen2.5-coder:7b-instruct-q4_K_M`

**根因分析**：
- 磁盘空间一度耗尽（系统盘 100%），杀掉 7B partial 后恢复
- ollama 没有 verbose 进度输出，难以判断卡在哪一步

### ✅ 7. 增加 Few-shot 示例

往 `painting_few_shot.md` 追加示例 6：参数化 Z 字扫描（FOR 循环复用版本），便于 LLM 学习如何把扫描封装成可复用过程。

### ✅ 8. 67 个单元测试无回归

```
67 passed in 0.46s
```

---

## 当前项目最终状态

```
代码        37 文件 3664 行
测试        67/67 通过
ABB 手册    10 本 / 54 MB（来自 ABB 官方资料库）
向量库      7497 切片 / 52 MB
嵌入模型    bge-small-zh-v1.5 / 92 MB (已下载)
生成成功    4 个 .mod 文件示例
离线包      dist/abb-agent-offline-20260516_1426.tar.gz / 192 MB
LLM         gemma4:e4b（替代主模型 Qwen，可正常工作）
```

## 下次启动步骤（工业 PC）

```bash
# 1. 拷贝离线包到工业 PC，解压
tar -xzf abb-agent-offline-20260516_1426.tar.gz
cd offline-bundle-20260516_1426

# 2. 安装 Python 依赖（需有网，或自带 wheels）
bash scripts/install.sh

# 3. 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh  # Mac/Linux
#   或 https://ollama.com/download (Windows)

# 4. 拉取模型（首次需有网，约 4.5GB）
ollama serve &                                       # 启服务
ollama pull qwen2.5-coder:7b-instruct-q4_K_M       # 拉主模型
#   或备选：ollama pull qwen2.5-coder:3b-instruct-q4_K_M

# 5. 验证
abb-agent doctor      # 应全部 ✓
abb-agent kb status   # 显示 7497 切片

# 6. 使用
abb-agent gen "对 600x400 矩形面做 Z 字扫描喷涂，行距 50mm"
```

## 这次执行额外修复

1. **package_offline.sh**：
   - 添加 `--skip-ollama` / `--ollama-only` / `--no-wheels` 参数
   - 修复重复打印 "复制向量库"
   - 包含 `OFFLINE_INSTALL.md` + `PROJECT_STATUS.md`
   - 自动包含 `data/raw/pdf/` 手册

2. **painting_few_shot.md**：
   - 追加示例 6（参数化 Z 字扫描）

3. **磁盘清理**：
   - 删除 Qwen 7B 卡死的 4.4GB partial
