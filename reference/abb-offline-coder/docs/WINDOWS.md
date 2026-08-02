# Windows 部署指南

> 本项目**完全支持 Windows**。工业 PC 通常运行 Windows 10/11，本指南覆盖在 Windows 下的安装、使用与离线打包。

## 兼容性确认

| 项 | 支持 | 说明 |
|----|------|------|
| Windows 10 / 11 | ✅ | 主目标平台 |
| Windows Server 2019+ | ✅ | 同上 |
| Python 3.10 / 3.11 / 3.12 / 3.13 | ✅ | 3.10+ 均可 |
| Ollama Windows | ✅ | 官方支持，从 ollama.com/download 下载 |
| ChromaDB (向量库) | ✅ | 内嵌持久化，跨平台 |
| PyMuPDF (PDF 解析) | ✅ | 跨平台 |
| sentence-transformers (嵌入) | ✅ | 跨平台，CPU 推理 |
| 中文 prompt / 中文路径 | ✅ | 已显式声明 UTF-8 |
| .mod 文件输出 | ✅ | 自动用 CRLF 换行（RobotStudio 兼容） |

## 快速开始（有网环境）

### 1. 安装 Python 3.10+

从 https://www.python.org/downloads/ 下载安装。

**注意安装时勾选 "Add Python to PATH"**（必须）。

验证：
```cmd
python --version
```
应显示 `Python 3.10.x` 或更高。

### 2. 克隆/解压项目

```cmd
cd C:\
git clone <repo> ABB-Agent
cd ABB-Agent
```

或解压离线包 `abb-agent-offline-<日期>.zip` 到 `C:\ABB-Agent`。

### 3. 安装依赖

```cmd
scripts\install.bat
```

或离线模式（需先在有网环境备好 `wheels\` 目录）：
```cmd
scripts\install.bat /offline
```

### 4. 安装 Ollama

下载 Windows 版安装包：https://ollama.com/download

安装后**重启终端**确保 `ollama` 命令可识别。

### 5. 启动 Ollama 服务（保持开启）

新开一个 CMD 窗口运行：
```cmd
ollama serve
```

保持此窗口不关闭。

### 6. 拉取本地模型（首次需联网）

```cmd
ollama pull qwen2.5-coder:7b-instruct-q4_K_M
```

工业 PC 规格较低时用 3B 版本（约 2GB，推理更快）：
```cmd
ollama pull qwen2.5-coder:3b-instruct-q4_K_M
```

### 7. 准备 ABB 资料

把 ABB 官方手册、内部 .mod 示例放入：

```
data\raw\pdf\        - PDF 手册（如 RAPID Reference Manual）
data\raw\code\       - .mod / .sys / .pgf 示例代码
data\raw\html\       - 离线 HTML 文档
```

### 8. 构建知识库

```cmd
.venv\Scripts\activate.bat
python scripts\build_knowledge_base.py
```

完成后约 1-3 分钟（取决于 PDF 数量）。

### 9. 健康检查

```cmd
abb-agent doctor
```

所有项应显示 ✓。

### 10. 开始使用

```cmd
abb-agent gen "对 600x400 矩形面做 Z 字扫描喷涂，行距 50mm"
```

或多轮对话：
```cmd
abb-agent chat
```

生成的 .mod 文件保存在 `output\` 目录。

## 离线部署（工业 PC 步骤）

### 在有网工作站上打包

```cmd
.venv\Scripts\activate.bat
powershell -ExecutionPolicy Bypass -File scripts\package_offline.ps1
```

产物：`dist\abb-agent-offline-<日期>.zip`

打包选项：
```cmd
REM 跳过 Ollama 模型（轻量包，~200MB）
powershell -ExecutionPolicy Bypass -File scripts\package_offline.ps1 -SkipOllama

REM 只打包包含 'qwen' 的模型
powershell -ExecutionPolicy Bypass -File scripts\package_offline.ps1 -OllamaFilter qwen

REM 跳过 wheels（不预下载 Python 依赖）
powershell -ExecutionPolicy Bypass -File scripts\package_offline.ps1 -NoWheels
```

### 在工业 PC 上部署

1. 解压 `abb-agent-offline-<日期>.zip` 到 `C:\ABB-Agent`
2. 安装 Python 3.10+（勾选 Add to PATH）
3. 安装 Ollama（https://ollama.com/download）
4. 若包内有 `ollama_models\`：
   - 复制内容到 `%USERPROFILE%\.ollama\models\`
   - （命令）`xcopy ollama_models %USERPROFILE%\.ollama\models\ /E /I`
5. 安装依赖：`scripts\install.bat /offline`
6. 启动 Ollama：`ollama serve`（新窗口）
7. 验证：`abb-agent doctor`
8. 开干：`abb-agent gen "..."`

## 常用命令速查

| 命令 | 说明 |
|------|------|
| `abb-agent version` | 显示版本 |
| `abb-agent doctor` | 健康体检 |
| `abb-agent kb status` | 知识库状态 |
| `abb-agent kb build` | 构建/增量更新知识库 |
| `abb-agent kb inspect "查询"` | 测试检索质量 |
| `abb-agent gen "需求"` | 单次生成 |
| `abb-agent chat` | 多轮对话 |
| `abb-agent gen "需求" -o my.mod` | 指定输出路径 |

## 配置（Windows 环境变量）

设置永久环境变量（控制面板 → 系统 → 高级 → 环境变量），或临时：

```cmd
set ABB_AGENT_LLM_MODEL_NAME=qwen2.5-coder:3b-instruct-q4_K_M
set ABB_AGENT_LLM_TEMPERATURE=0.4
abb-agent gen "你的需求"
```

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ABB_AGENT_LLM_MODEL_NAME` | qwen2.5-coder:7b-instruct-q4_K_M | LLM 模型名 |
| `ABB_AGENT_LLM_FALLBACK_MODEL` | qwen2.5-coder:3b-instruct-q4_K_M | 备选模型 |
| `ABB_AGENT_LLM_TEMPERATURE` | 0.2 | 生成温度 0-1 |
| `ABB_AGENT_LLM_OLLAMA_HOST` | http://localhost:11434 | Ollama 地址 |
| `ABB_AGENT_EMBED_DEVICE` | cpu | 嵌入模型设备(cpu/cuda) |
| `ABB_AGENT_RAG_TOP_K_FINAL` | 5 | 检索返回数量 |

## 故障排查

### "python 不是内部或外部命令"
没把 Python 加入 PATH。卸载后重装并勾选 "Add Python to PATH"，或手动添加：
```
C:\Users\<你>\AppData\Local\Programs\Python\Python311\
C:\Users\<你>\AppData\Local\Programs\Python\Python311\Scripts\
```

### "ollama 不是内部或外部命令"
Ollama 没装好或没重启终端。从 https://ollama.com/download 重新安装。

### "无法连接 Ollama"
启动服务：另开 CMD 运行 `ollama serve`，保持窗口。

### "Building wheel for ... failed"
缺少 Visual C++ Build Tools。安装：
- https://visualstudio.microsoft.com/visual-cpp-build-tools/
- 勾选 "C++ build tools"

或用预编译 wheel：
```cmd
pip install --only-binary=:all: -r requirements.txt
```

### 中文路径乱码
确认终端是 UTF-8 编码：
```cmd
chcp 65001
```

`install.bat` 已自动设置。

### 生成代码慢
- 用 3B 模型代替 7B：`set ABB_AGENT_LLM_MODEL_NAME=qwen2.5-coder:3b-instruct-q4_K_M`
- 减少 RAG 上下文：`set ABB_AGENT_RAG_TOP_K_FINAL=3`
- 关闭 few-shot：`abb-agent gen "..." --no-few-shot`

### RobotStudio 导入 .mod 提示"语法错误"
- 用 `abb-agent doctor` 确认校验报告无 ERROR
- 检查生成代码中 `tooldata` / `wobjdata` 名称是否与您工作站一致
- 必要时手动调整 robtarget 坐标

## 性能基准（工业 PC：i5-8500 + 16GB RAM + 无 GPU）

| 操作 | 时间 |
|------|------|
| 冷启动 (load model) | 8-15 秒 |
| 知识库检索 Top-5 | < 0.5 秒 |
| LLM 推理 Qwen 7B | 15-30 秒 |
| LLM 推理 Qwen 3B | 5-12 秒 |
| 后处理 + 校验 | < 0.2 秒 |
| **端到端单次生成 (7B)** | **20-35 秒** |
| **端到端单次生成 (3B)** | **8-15 秒** |

## 与 RobotStudio 协作

1. 用 `abb-agent gen` 生成 `output\PaintProgram_<时间>.mod`
2. 在 RobotStudio 中：
   - 打开"控制器" → "RAPID" → "T_ROB1"
   - 右键 "模块" → "加载模块"
   - 选择生成的 `.mod` 文件
3. 仿真验证：F5 启动，单步执行检查路径
4. 调整 robtarget 坐标到实际示教点位
5. 同步到真实机器人控制器

> 重要：**所有生成代码必须经过仿真验证后才能上机**。AI 不能替代现场工程师的安全判断。

## Windows 已知限制

- ⚠️ `package_offline.sh` (Bash 版) 不适用，请用 `package_offline.ps1`
- ⚠️ 路径中含空格时建议加引号：`abb-agent gen "你的需求" -o "C:\My Output\program.mod"`
- ⚠️ 防火墙首次会询问 Python/Ollama 网络权限，允许"专用网络"即可
