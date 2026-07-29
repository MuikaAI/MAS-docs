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
| `.session end` | 手动结束当前会话，触发存档流程 |

```
.session end
```

结束会话后，Butler 会生成本次会话的日记总结并存入 ARCHIVE 记忆层。下次 Resume 时会注入最近 3 条存档。

### .usage — 用量统计

查看各模型和插件的 Token 使用量及费用统计。

```
.usage
```

## 命令系统架构

命令系统基于 **Arclet Alconna** 解析器，支持：

- **别名**：为命令注册多个别名
- **子命令路由**：通过 `CommandRegistry.assign()` 注册子命令处理器
- **依赖注入**：命令处理器可声明需要注入的组件（`Muika`、`MuikaState`、`MuikaBrain`、`MemoryManager`、`Executor`、`TopicManager`、`ButlerAgent`）
- **优先级**：通过 `priority` 参数控制命令匹配顺序
- **资源持久化**：命令产生的二进制资源自动保存到 `data/downloads/`

## 命令前缀

命令以 `.` 或 `/` 开头。Bot 进程在检测到这两种前缀时，会将消息作为 `CommandEvent` 发送给 Core，不经 Brain 处理。

## 开发自定义命令

详见 [命令开发](/develop/command-dev)。
