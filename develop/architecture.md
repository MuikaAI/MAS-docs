# 架构概览

Muika-After-Story 采用**双进程分离架构**：Core（大脑）与 Bot（身体）通过 WebSocket IPC 通信。这种设计将 AI 逻辑与平台适配完全解耦，让你可以为任何聊天平台编写 Bot 适配器而无需修改 Core。

## 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                          用户端                                  │
│               (QQ / Telegram / ...)                              │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Bot 进程 (muika_bot)                                            │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Nonebot2      │→│ SessionManager│→│ IpcClient            │   │
│  │ 适配层         │  │ 合并快速输入   │  │ WebSocket 客户端     │   │
│  └───────────────┘  └──────────────┘  └──────────┬───────────┘   │
└──────────────────────────────────────────────────┼────────────────┘
                         │ WebSocket JSON
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Core 进程 (muika)                                               │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ CoreWsServer │→│  事件队列    │→│ Muika 事件循环           │ │
│  │ ws:8765/ws  │  │              │  │ 每 5s tick 状态机        │ │
│  └─────────────┘  └──────────────┘  └────┬─────────┬──────────┘ │
│                                          │         │            │
│                    ┌─────────────────────┘         │            │
│                    ▼                               ▼            │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │ emotional 管线          │  │ topic 管线                   │  │
│  │ MuikaBrain 生成回复      │  │ TopicManager 选择话题       │  │
│  │ → Butler 执行工具        │  │ → DigestAgent (RSS)        │  │
│  │ → 记忆分类存储           │  │ → Brain.expand_topic()     │  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
│          │                                                        │
│          ▼                                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Executor 消息分段发送 → SendMessage → CoreWsServer → Bot   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ MuikaState       │  │ MemoryManager    │  │ ButlerAgent    │  │
│  │ 情绪状态机        │  │ 四层记忆        │  │ 工具执行       │  │
│  │ loneliness /     │  │ CORE / STATE /   │  │ 记忆分类       │  │
│  │ boredom /        │  │ PREFERENCE /     │  │ 会话总结       │  │
│  │ curiosity        │  │ ARCHIVE          │  │ 偏好匹配       │  │
│  └──────────────────┘  └────────┬─────────┘  └────────────────┘  │
│                                 │                                │
│                                 ▼                                │
│                          ┌──────────┐                            │
│                          │ SQLite   │                            │
│                          │ 数据库   │                            │
│                          └──────────┘                            │
└──────────────────────────────────────────────────────────────────┘
```

> 注：架构图中的箭头表示数据流方向。用户消息从聊天平台进入 Bot 进程，经 IPC 转发至 Core 事件循环，由状态机决策后进入相应管线处理，最终经 Executor 送回用户。

## 双进程设计

### Core 进程 — "大脑"

Core 拥有全部 AI 逻辑，不依赖任何聊天平台框架。它通过 `core_main.py` 启动：

- **事件循环** (`Muika`)：监听事件队列，每 5 秒 tick 一次情绪状态
- **大脑** (`MuikaBrain`)：构建 System Prompt，调用 LLM 生成 Muika 的回复
- **管家** (`ButlerAgent`)：处理 `<Butler:>` 标签中的工具指令，分类记忆
- **状态机** (`MuikaState`)：追踪 loneliness、boredom、curiosity、attention
- **记忆系统** (`MemoryManager`)：四层记忆的读写和注入
- **IPC 服务端** (`CoreWsServer`)：等待 Bot 连接

### Bot 进程 — "身体"

Bot 基于 Nonebot2，负责对接聊天平台。它通过 `bot.py` 启动：

- **消息接收**：从 QQ/Telegram 等平台获取用户消息
- **消息合并** (`SessionManager`)：在 `INPUT_TIMEOUT` 时间内合并用户快速连续发送的消息
- **IPC 客户端** (`IpcClient`)：连接 Core，转发消息，接收回复
- **自动重连**：断开后指数退避重连，最多 5 次

## 事件循环

Core 的事件循环是整个系统的"心跳"。每次循环：

1. **收集事件**：从队列中取事件，5 秒超时 → `TimeTickEvent`
2. **更新状态**：`state.tick_state()` 推进情绪参数
3. **决策管线**：

| 触发条件 | 管线 | 行为 |
|---------|------|------|
| `UserMessageEvent` | **emotional** | Brain 生成回复 → Butler 执行工具 → 发送 |
| `SessionBootstrapEvent` | **emotional** | 新会话启动，注入记忆 → 生成欢迎语 |
| `ScheduledTriggerEvent` | **emotional** | 定时提醒触发 |
| `loneliness > 0.8` | **emotional** | 孤独驱动主动发言 |
| `boredom > 0.6` 或 `curiosity > threshold` | **topic** | 话题驱动主动发言 |
| 纯 idle | **none** | 仅衰减状态，不调用 LLM |

## Brain ↔ Butler 协作

这是 Muika 最核心的设计模式——"大小姐与管家"的双角色协作：

1. Brain 生成 Muika 的回复（自然语言 + 可能包含 `<Butler:>` 和 `<memory>` 标签）
2. Loop 解析回复中的标签
3. `<memory>` 标签 → Butler 分类后存入记忆系统
4. `<Butler: command>` 标签 → Butler 调用 LLM（带工具列表）执行命令
5. Butler 报告被注入对话上下文 `[Butler reports]`
6. 如需继续，Brain 再次生成回复（最多 4 轮 inner loop）

## 会话生命周期

```
[Bot 连接] → SessionBootstrap → 注入记忆 → 生成欢迎语
     ↓
[用户消息] → Brain 回复 → Butler 执行 → 发送消息
     ↓                          ↑
[idle 30min] → 自动存档 → [用户回归] → 新 Session (Resume)
     ↓
[Session 结束] → Butler 生成日记摘要 → ARCHIVE 层写入
```

## IPC 协议

Core 与 Bot 通过 WebSocket 传输 JSON 消息。消息分为两类流向：

- **Bot → Core**：`UserMessageEvent` / `CommandEvent` / `SessionBootstrapEvent` / `SessionEndEvent`
- **Core → Bot**：`SendMessage` / `CommandResult` / `ActionResponse` / `ErrorMessage`

每个消息都有 `IPCMessage` 信封（id + type + ts）。详见 [IPC 协议](/develop/ipc)。

## 下一步

- [IPC 协议](/develop/ipc) — 消息格式详情与客户端实现指南
- [记忆系统](/develop/memory-system) — 四层记忆深入解析
- [插件开发](/develop/plugin-dev) — 开始扩展 Muika
