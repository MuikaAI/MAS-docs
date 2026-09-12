# 快速开始

本指南将帮助你从零开始部署 Muika-After-Story。

## 环境要求

- **Python** ≥ 3.12
- **包管理器** — pip / PDM / uv 任选其一
- **一个 LLM API Key** — 推荐 DeepSeek、Qwen 或 Gemini
- **一个消息平台** — QQ（需 Nonebot2 适配器）、Telegram 等

## 安装

### 1. 克隆仓库

```bash
git clone https://github.com/Moemu/Muika-After-Story.git
cd Muika-After-Story
```

### 2. 安装依赖

选择你偏好的包管理器：

::: code-group
```bash [pip]
pip install ".[standard,bot]"
```

```bash [pdm]
pdm install
```

```bash [uv]
uv sync
```
:::

项目依赖分为三组可选包：

| 组 | 说明 |
|----|------|
| `dev` | 开发工具（pre-commit、pytest、Alembic 等） |
| `standard` | 标准 LLM Provider（OpenAI、DashScope、Gemini 等） |
| `bot` | Bot 侧依赖（Nonebot2 及适配器） |

`pip install .` 仅安装核心依赖。使用 `pip` 时需显式指定 `.[dev,standard,bot]` 以获得完整功能。`pdm install` 和 `uv sync` 默认安装所有依赖组。

## 配置

### 3. 创建 .env 文件

在项目根目录创建 `.env` 文件，至少配置以下核心项：

```ini
# 你的用户 ID（Muika 只会和你一人对话）
MASTER_ID=你的QQ号或其他平台ID

# 默认使用的模型配置名称（对应 configs/models.yml 中的配置）
DEFAULT_MODEL=deepseek

# IPC 通信密钥（首次启动自动生成，也可手动指定）
IPC_SECRET=your-secret-here
```

详细的配置项说明请参阅 [配置参考](/guide/configuration)。

### 4. 配置模型

编辑 `configs/models.yml`，填入你的 API Key。至少配置一个默认模型：

```yaml
- name: deepseek
  provider: openai_compatible
  model: deepseek-chat
  api_key: sk-your-api-key-here
  api_host: https://api.deepseek.com
  default: true
```

更多模型配置请参阅 [模型配置](/guide/model)。

## 启动

Muika-After-Story 采用**双进程架构**，需要分别启动 Core 和 Bot。

### 启动 Core（大脑）

::: code-group
```bash [pdm]
pdm run python core_main.py
```

```bash [uv]
uv run python core_main.py
```

```bash [pip]
python core_main.py
```
:::

Core 进程负责 AI 逻辑——包括大脑（MuikaBrain）、行动半身（Agent）、记忆系统和事件循环。启动后会在 `ws://127.0.0.1:8765/ws` 等待 Bot 连接。

### 启动 Bot（身体）

::: code-group
```bash [pdm]
pdm run python bot.py
```

```bash [uv]
uv run python bot.py
```

```bash [pip]
python bot.py
```
:::

Bot 进程负责对接聊天平台，连接 Core 后将用户消息转发给 Core，并将 Core 的回复发送给用户。

> **提示**：也可以使用 `scripts/start_all.ps1`（Windows）一键启动两个进程。

## 首次对话

一切就绪后，在你的聊天平台上向 Muika 发送第一条消息。

或者，等她说第一句话。

### 试试这些命令

| 命令 | 说明 |
|------|------|
| `.help` | 查看所有可用命令 |
| `.model list` | 查看可切换的模型列表 |
| `.model deepseek` | 切换到指定的模型 |
| `.debug state` | 查看 Muika 当前的情绪状态 |
| `.session new` | 开始新会话，保留经历和持续状态 |
| `.usage [today\|week\|total]` | 按模型汇总今天、近一周或全部历史用量 |

## 下一步

- [配置参考](/guide/configuration) — 了解所有配置项
- [人设定制](/guide/persona) — 自定义 Muika 的性格模板
- [架构概览](/develop/architecture) — 深入理解系统设计
