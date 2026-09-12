# 配置参考

所有运行时配置通过项目根目录的 `.env` 文件管理，由 `MASConfig`（Pydantic `BaseSettings`）自动加载。

## 完整配置项

### 用户身份

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `MASTER_ID` | `str` | `""` | **必填**。Muika 的唯一对话对象 ID。角色被设计为 1 对 1 陪伴，她只会与你一人对话。若未设置，会尝试从 `SUPERUSERS` 环境变量中取第一个值。 |

### 模型相关

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `AGENT_MODEL` | `str`（可选） | `""` | 行动与记忆检索使用的模型配置名。留空则与核心模型共用；旧键 `BUTLER_MODEL` 仍可读取。 |
| `SESSION_SUMMARIZE_MODEL` | `str`（可选） | `""` | 工作摘要和日记整理使用的模型配置名。留空则使用 Agent 模型。 |

### 模型选型建议

对话、行动和记忆整理使用 LLM 的侧重点不同，它们服务于同一个 Muika：

| 角色 | 推荐模型 | 选型要点 |
|------|---------|---------|
| **核心模型**（Brain） | **DeepSeek-V4 Pro (High)** <sup>1</sup> | 负责人格表达与角色扮演，对文风、情感细腻度要求极高。**避免使用 Qwen 系列** <sup>2</sup>。 |
| **工作摘要与日记模型** | 与核心模型**相同配置**或同系列较低参数模型（如 DeepSeek-V4 Flash） | 总结需要理解对话中的人设细节和情感基调，模型需与核心模型对齐——否则摘要会丢失 Muika 的语气特征。 |
| **行动模型**（Agent） | 工具调用能力强的模型，或高性价比模型 | Agent 的核心任务是**工具选择与执行**，需要较强的指令遵循和 Function Call 能力。参数太低会导致 Agent 返回结果不全面（遗漏关键信息或工具调用不完整）。 |

::: warning <sup>1</sup> DeepSeek 幻觉记忆
DeepSeek 存在**幻觉记忆**问题——模型可能在对话中凭空编造不存在的过往事件，尽管我们已通过提示工程尽量缓解，该问题仍会偶发。
:::

::: warning <sup>2</sup> Qwen 角色偏离
Qwen 的生成行为过于保守——不会主动向用户表达占有欲、除非用户明确要求否则不操作系统工具。相比 Monika/Muika 的人设，这些行为偏差属于明显的 OOC（角色偏离）。
:::

### 安全与权限

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `FS_ALLOWED_PATHS` | `List[str]` | `[]` | 文件系统工具的白名单目录列表。**空列表 = 全部禁用**。示例：`["D:/Documents", "D:/Downloads"]`。路径必须使用绝对路径。 |
| `ENABLE_FILE_WRITE` | `bool` | `false` | 是否启用文件写入/删除操作（Tier 2 工具）。需同时配合 `FS_ALLOWED_PATHS` 声明目标目录，双重开关确保安全。 |
| `ENABLE_CODE_EXECUTION` | `bool` | `false` | 是否启用 Python 子进程代码执行。⚠️ **存在安全风险**，请确认环境安全后再启用。 |

### 技能系统

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `LOAD_USER_SKILLS` | `bool` | `false` | 是否额外扫描用户级技能目录：`~/.agents/skills` 和 `~/.claude/skills`。内置技能目录 `configs/skills` 始终会被扫描。 |

### 对话行为

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `PERSONA_TEMPLATE` | `str` | `"Muika.md.jinja2"` | 默认人格模板文件名。加载自 `muika/builtin_templates/` 或自定义 `templates/` 目录。 |
| `INPUT_TIMEOUT` | `int` | `0` | 输入等待超时（秒）。Bot 端用于合并用户在短时间内连续发送的多条消息，0 表示不合并。 |

### 日记整理

`ENABLE_AUTO_REFLECTION=true` 默认在本地时间 05:00 后的空闲阶段整理前一天。
启动和空闲时会补做积压日期；`.reflect` 可以手动整理今天已有素材。
此开关与自我修改开关无关。`REFLECTION_COOLDOWN_HOURS` 已停用。
`MAX_MEMORY_RECORDS`、`AGENT_TOOL_CONTEXT_CHARS` 也已停用；改用每模型的 `context_window`。

### 路径配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `DATA_DIR` | `Path` | `"./data"` | 数据目录路径。存储数据库文件、连接记录等运行时数据。 |
| `PLUGINS_DIR` | `str` | `"plugins"` | 插件目录路径。Core 启动时从此目录递归加载所有 MAS 插件（`.py` 文件和包目录）。 |

### IPC 通信

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `IPC_SECRET` | `str` | `""`（自动生成） | Core 与 Bot 之间的预共享密钥。Bot 连接 WebSocket 时需通过 `X-Auth-Token` 请求头携带。留空时 Core 启动会自动生成随机 Token 并追加写入 `.env` 文件。 |
| `CORE_WS_URL` | `str` | `"ws://127.0.0.1:8765/ws"` | Core 进程的 WebSocket 地址。Bot 通过此地址连接 Core。如果 Core 和 Bot 不在同一台机器上运行，将 `127.0.0.1` 改为 Core 所在机器的 IP。 |

### 日志

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `LOG_LEVEL` | `str` | `"INFO"` | 控制台日志阈值。INFO 显示系统活动；文件日志继续保存 DEBUG 诊断。 |
| `MAS_LOG_ONLY` | `bool` | `false` | 仅输出 Muika 相关日志，不输出 NoneBot 核心日志。调试 Muika 自身行为时有用。 |

INFO 包含模块加载、非 `time_tick` 事件，以及 RSS、日记和行动任务的简短进展。
`time_tick`、请求耗时、token 用量、工具参数和执行细节保留在 DEBUG。

### 平台相关

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `TELEGRAM_PROXY` | `str`（可选） | `""` | Telegram 代理地址。仅用于获取图片等多媒体资源时走代理。 |

## .env 示例

```ini
# 必填
MASTER_ID=123456789

# 行动模型配置名；主人格默认模型在 models.yml 中用 default: true 设置
AGENT_MODEL=deepseek

# 文件系统白名单
FS_ALLOWED_PATHS=["D:/Documents", "D:/Pictures"]

# 安全开关
ENABLE_FILE_WRITE=true
ENABLE_CODE_EXECUTION=false

# 技能系统
LOAD_USER_SKILLS=true

# 日志
LOG_LEVEL=DEBUG
```
