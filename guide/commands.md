# 命令参考

Muika-After-Story 内置了一套对话命令系统，在聊天中直接发送即可触发。命令前缀为 `.` 或 `/`。

## 内置命令一览

### .help — 查看帮助

列出当前所有可用命令及其简要说明。

```
.help
```

### .model — 模型管理

切换或查看当前使用的 LLM 模型。

| 子命令 | 说明 |
|--------|------|
| `.model list` | 列出 `configs/models.yml` 中所有可用的模型配置，并标注当前使用的模型 |
| `.model <name>` | 切换到指定的模型配置，如 `.model deepseek` |

```
.model list
.model deepseekflash
```

模型切换即时生效，下一次对话将使用新模型。

### .debug — 调试工具

查看和修改 Muika 的内部状态，用于调试和观测。

| 子命令 | 说明 |
|--------|------|
| `.debug state` | 查看当前情绪状态：mood、loneliness、boredom、curiosity、attention |
| `.debug state-set <param> <value>` | 手动设置情绪参数值 |
| `.debug topic` | 查看当前活跃话题和话题历史 |
| `.debug topic-reset` | 重置话题系统状态 |

```
.debug state
.debug topic
```

### .session — 会话管理

| 子命令 | 说明 |
|--------|------|
| `.session new`、`.new`、`.clear` | 结束当前工作会话并开始新会话，保留经历与持续状态 |
| `.session summarize` | 手动整理已有素材为日记，与 `.reflect` 使用同一入口 |

```
.session new
```

会话结束不生成日记，也不增加事实权重。原文已逐轮保存；重启和新会话会保留关系、情绪及未竟意愿。
自动日记在本地时间 05:00 后的空闲阶段整理前一天，并补做积压日期。详见[记忆系统](/develop/memory-system)。

### .reflect — 整理日记

手动整理尚未覆盖的素材，包括今天已有的经历。同一天的新素材会更新当天日记；没有新素材时不重复生成。

```text
.reflect
```

### .usage — 用量统计

按模型汇总所选时段的 Token 使用量、缓存命中和费用。默认统计今天，不再逐日分段。

```
.usage
.usage today
.usage week
.usage total
```

`today` 表示今天；`week` 包含今天在内的 7 个本地自然日；`total` 表示全部历史。
费用按 `configs/models.yml` 中的价格设置估算。

### .status — 状态卡片（独立插件）

安装并加载 [MAS-Plugin-Status](https://github.com/MuikaAI/MAS-Plugin-Status) 后可使用 `.status` 或 `/status`。
卡片显示会话估算 token、模型总窗口和占比；日模型用量使用 K、M、B 单位。
此占比只计会话正文、附件和工作摘要，不等同于完整模型请求的占用。

## 命令系统架构

命令系统基于 **Arclet Alconna** 解析器，支持：

- **别名**：为命令注册多个别名
- **子命令路由**：通过 `CommandRegistry.assign()` 注册子命令处理器
- **依赖注入**：命令处理器可声明需要注入的组件（`Muika`、`MuikaState`、`MuikaBrain`、`MemoryManager`、`Executor`、`TopicManager`、`Agent`）
- **优先级**：通过 `priority` 参数控制命令匹配顺序
- **资源持久化**：命令产生的二进制资源自动保存到 `data/downloads/`

## 命令前缀

命令以 `.` 或 `/` 开头。Bot 进程在检测到这两种前缀时，会将消息作为 `CommandEvent` 发送给 Core，不经 Brain 处理。

## 开发自定义命令

详见 [命令开发](/develop/command-dev)。
