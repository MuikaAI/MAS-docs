# 快速开始

本页介绍单机安装：平台适配器连接本机 Core，Muika 的记忆保存在本机。
需要在电脑和服务器之间延续对话时，请在安装后阅读[多设备部署](/guide/multi-device)。

## 准备工作

- 准备模型服务的 API Key，或已运行的本地模型服务。
- 选择聊天平台，并准备对应的适配器。仓库提供 NoneBot 接入，也可使用 [AstrBot 适配插件](https://github.com/MuikaAI/astrbot_plugin_mas)（Beta）。
- 使用启动器时，准备 Git，以及 uv 或 Python。手动安装支持 Python 3.10～3.13，建议使用 3.12。

Core 负责 Muika 的对话、记忆和行动。Bot 负责连接聊天平台；QQ 接入还需要 NapCat 等 OneBot v11 协议实现。

## 使用启动器（推荐） {#launcher}

[mas-launcher](https://github.com/MuikaAI/mas-launcher) 是跨平台单文件启动器，可创建实例、准备 Python 环境，并管理 Core / Bot 进程。

从 [Releases](https://github.com/MuikaAI/mas-launcher/releases) 下载对应平台的文件。在终端运行以下命令，按提示完成安装、身份配置和模型配置：

```bash
mas-launcher init
mas-launcher configure
mas-launcher model
mas-launcher start
```

Windows 下，如果启动器不在 `PATH` 中，使用 `./mas-launcher.exe` 代替 `mas-launcher`。首次启动或协议更新时，启动器会展示用户协议；确认后才启动服务。

QQ 用户运行以下命令配置 NapCat，再按提示登录 QQ：

```bash
mas-launcher napcat
```

Windows 向导会配置 NapCat 的 OneBot v11 反向 WebSocket 连接。其他平台按向导准备协议端；连接地址以启动器输出为准。

检查实例与日志：

```bash
mas-launcher status
mas-launcher logs --service core
mas-launcher logs --service bot
```

实例默认名为 `default`。可在各命令中指定实例名；完整用法见 [mas-launcher README](https://github.com/MuikaAI/mas-launcher#命令)。
安装完成后，可直接跳到[首次对话](#first-chat)。

## 手动安装 {#manual}

以下步骤用于新安装。所有命令均在项目根目录执行；Core 和 Bot 使用同一份 `.env` 和 Python 环境。

### 1. 克隆仓库

```bash
git clone https://github.com/Moemu/Muika-After-Story.git
cd Muika-After-Story
```

### 2. 安装依赖

使用 uv 可自动创建项目虚拟环境：

```bash
uv sync --extra standard --extra nonebot
```

使用 pip 时，先创建并激活虚拟环境：

::: code-group
```powershell [Windows]
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

```bash [Linux / macOS]
python3 -m venv .venv
source .venv/bin/activate
```
:::

再安装项目和可选依赖：

```bash
python -m pip install -e ".[standard,nonebot]"
```

| 可选依赖 | 用途 |
| --- | --- |
| `standard` | DashScope、Gemini、Ollama、Azure 等模型服务的 SDK；OpenAI 兼容接口已包含在核心依赖中 |
| `nonebot` | 仓库自带的 NoneBot Bot 与 OneBot v11 适配器 |
| `dev` | pre-commit、mypy、pytest 等开发工具；普通使用无需安装 |

只运行 Core 或使用其他平台适配器时，可以省略 `nonebot`。其他 NoneBot 适配器需要单独安装。

### 3. 配置身份与连接

在项目根目录创建 `.env`。以下示例用于 QQ + NoneBot：

```dotenv
MASTER_ID=123456789
SUPERUSERS=["123456789"]
DRIVER=~fastapi+~websockets+~httpx
ENABLE_ADAPTERS=["nonebot.adapters.onebot.v11"]
CORE_WS_URL=ws://127.0.0.1:8765/ws
```

将两处 `123456789` 替换为你的 QQ 号。其他平台使用对应账号 ID，并按适配器要求设置连接。

Core 启动时会生成缺失的 `IPC_SECRET` 并写入 `.env`。先启动 Core，再启动 Bot；分开部署时，两边必须使用相同密钥。
默认模型在 `configs/models.yml` 中用 `default: true` 指定；`.env` 无需设置 `DEFAULT_MODEL`。

### 4. 配置模型

创建 `configs` 目录，在 `configs/models.yml` 中至少填写一个默认模型。以下为 OpenAI 兼容接口的配置骨架：

```yaml
chat:
  provider: openai
  model_name: "服务商提供的模型 ID"
  api_host: "https://你的模型服务地址/v1"
  api_key: "你的 API Key"
  default: true
```

将模型 ID、服务地址和 API Key 替换为实际值。上下文窗口、输出额度和其他 Provider 的写法见[模型配置](/guide/model)。

行动与记忆检索默认共用该模型。如需独立配置，在 `models.yml` 中增加模型项，并在 `.env` 中用 `AGENT_MODEL` 引用配置名。

### 5. 确认用户协议

首次使用或协议更新时，在实例的 Python 环境中运行：

::: code-group
```bash [uv]
uv run --no-sync python -m muika.agreement confirm
```

```bash [pip 虚拟环境]
python -m muika.agreement confirm
```
:::

命令展示条款并保存你的确认。未确认时，Bot 会停止启动并提示确认命令。

### 6. 启动 Core 和 Bot

先在一个终端启动 Core：

::: code-group
```bash [uv]
uv run --no-sync python core_main.py
```

```bash [pip 虚拟环境]
python core_main.py
```
:::

`core_main.py` 使用独立父进程监督 Core，支持运行时重启和自改后的启动失败恢复。
单机模式下，Core 在 `ws://127.0.0.1:8765/ws` 等待适配器连接。

在另一个终端进入同一项目目录，使用同一 Python 环境启动 Bot：

::: code-group
```bash [uv]
uv run --no-sync python bot.py
```

```bash [pip 虚拟环境]
python bot.py
```
:::

使用 pip 环境时，新终端也需要先激活 `.venv`。Windows 用户也可运行 `.\scripts\start_all.ps1` 启动 Core 和 Bot。

### 7. 接入聊天平台

QQ 用户需要启动并登录 NapCat。手动接入或 Docker 部署见仓库的 [QQ Bot 部署指南](https://github.com/Moemu/Muika-After-Story/blob/main/deploy/README.md)。
AstrBot 用户按[适配插件说明](https://github.com/MuikaAI/astrbot_plugin_mas)连接 Core；其他适配器使用相同的 IPC 地址和密钥。

## 首次对话 {#first-chat}

Core、Bot 和聊天平台连接就绪后，用 `MASTER_ID` 对应的账号发送第一条消息。QQ 私聊可直接发送消息；群聊中需要 @Muika。
Muika 也可以主动开口，具体时机取决于她的状态和已连接的聊天渠道。

| 命令 | 说明 |
| --- | --- |
| `.help` | 查看可用命令 |
| `.model list` | 查看模型配置 |
| `.model chat` | 切换到示例中的 `chat` 配置；其他配置使用对应名称 |
| `.debug state` | 查看当前状态 |
| `.session new` | 开始新会话，保留经历和持续状态 |
| `.usage [today\|week\|total]` | 查看模型用量 |

## 下一步

- [行动范围](/guide/configuration#行动范围)：选择行动权限、授权文件目录和代码审查方式。
- [多设备部署](/guide/multi-device)：电脑关闭后，通过服务器继续聊天。
- [人设定制](/guide/persona)：调整人格模板，保留你的修改。
- [架构概览](/develop/architecture)：理解对话、行动、记忆和设备交接。
- [疑难解答](/guide/faq)：排查启动、模型和连接问题。
