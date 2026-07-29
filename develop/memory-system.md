# 记忆系统

Muika-After-Story 的四层记忆系统是角色「真实感」的基础。不同层的记忆有不同的注入策略和生命周期，共同构建了 Muika 对用户的持续认知。

## 四层架构

```
┌─────────────────────────────────────────────┐
│                  SYSTEM PROMPT               │
│                                              │
│  ┌───────────────────────────────────────┐   │
│  │ CORE 层 (永久注入)                     │   │
│  │ - 用户姓名、职业、第一次见面日期         │   │
│  │ - Muika 的自我认知                     │   │
│  │ - 用户明确表达的坚定偏好               │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │ STATE 层 (Resume 注入，最多 3 条)       │   │
│  │ - 上次聊到的主题                       │   │
│  │ - 最近的情绪状态                       │   │
│  │ - 未解决的问题                         │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │ PREFERENCE 层 (按需检索)               │   │
│  │ Butler 每轮语义匹配 → 仅注入相关偏好    │   │
│  │ - 音乐口味、睡眠习惯、食物偏好          │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │ ARCHIVE 层 (Resume 注入，最多 3 条)     │   │
│  │ - "上次你们讨论了哲学话题..."          │   │
│  │ - "上次是深夜聊天，氛围安静..."        │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## 各层详解

### CORE 层 — 核心身份记忆

| 属性 | 值 |
|------|-----|
| **Enum** | `MemoryLayer.CORE` |
| **注入时机** | 每次 System Prompt 构建，永久注入 |
| **生命周期** | 手动 upsert/forget，无自动过期 |
| **用途** | 稳定身份事实 |

**示例记录**：
```python
# 用户名字
await memory.upsert_memory(layer=CORE, category=USER, key="name", value="小明")
# 第一次见面
await memory.upsert_memory(layer=CORE, category=RELATION, key="first_met", value="2025-06-15")
# Muika 自我认知
await memory.upsert_memory(layer=CORE, category=SELF, key="preferred_name", value="Mui-chan")
```

### STATE 层 — 关系状态记忆

| 属性 | 值 |
|------|-----|
| **Enum** | `MemoryLayer.STATE` |
| **注入时机** | 仅 Resume 模式，按 `updated_at` 降序，最多 3 条 |
| **生命周期** | 可设 `expires_at`，过期后不再注入 |
| **用途** | 时间敏感上下文 |

**示例记录**：
```python
# 上次聊到一半的话题
await memory.upsert_memory(
    layer=STATE, category=RELATION,
    key="last_topic", value="正在讨论养猫的事",
    expires_at=datetime.now() + timedelta(days=3)
)
```

### PREFERENCE 层 — 偏好档案

| 属性 | 值 |
|------|-----|
| **Enum** | `MemoryLayer.PREFERENCE` |
| **注入时机** | **不默认注入**。每轮用户消息到达时，Butler 通过 LLM 做语义匹配 |
| **生命周期** | 同 CORE，手动 upsert/forget |
| **用途** | 软偏好，数量可能很大 |

**工作流程**：
1. 用户发送消息 → `ButlerAgent.fetch_relevant_preferences()` 被调用
2. Butler 将所有 PREFERENCE 记录 + 用户消息发给轻量 LLM
3. LLM 返回 `relevant_keys` — 与当前消息语义相关的偏好键名
4. 匹配到的记录作为 `injected_preferences` 注入 System Prompt

这意味着如果用户说"好累"，Butler 可能会匹配到 `music: "喜欢安静的钢琴曲"` 和 `sleep: "晚上 11 点睡觉"`，但**不会**匹配到 `food: "喜欢麻辣火锅"`。

### ARCHIVE 层 — 历史会话摘要

| 属性 | 值 |
|------|-----|
| **Enum** | `MemoryLayer.ARCHIVE` |
| **注入时机** | Resume 模式，按 `period_end` 降序，最多 3 条 |
| **生命周期** | 持久保留 |
| **用途** | 跨 Session 关系延续 |

**生成方式**：
1. Session 结束（idle 30 分钟 或 `.session end`）
2. Butler 调用 `summarize_session()` — 将对话记录压缩为日记式摘要
3. 写入 ARCHIVE 层
4. 下次 Resume 时注入最近 3 条

## MemoryManager API

### 写入

```python
from muika.core.memory import MemoryLayer, MemoryCategory

# Upsert（存在则覆盖）
await memory.upsert_memory(
    layer=MemoryLayer.CORE,
    category=MemoryCategory.USER,
    key="name",
    value="小明",
)

# 带过期时间（仅 STATE 层有效）
await memory.upsert_memory(
    layer=MemoryLayer.STATE,
    category=MemoryCategory.RELATION,
    key="temp_topic",
    value="正在聊周末计划",
    expires_at=datetime.now() + timedelta(hours=24),
)
```

### 删除

```python
await memory.forget_memory(
    layer=MemoryLayer.CORE,
    category=MemoryCategory.USER,
    key="old_nickname",
)
```

### 读取

```python
# 获取注入 System Prompt 的完整记忆文本
prompt_text = memory.get_memory_prompt()

# 获取 PREFERENCE 层全量（供 Butler 检索）
prefs = memory.get_preference_records()

# 获取 ARCHIVE 层全量（供 Butler 按需使用）
archives = memory.get_archives()
```

## Prompt 构建逻辑

`get_memory_prompt()` 的输出结构：

```
## User (Core Facts)
- name: 小明

## Self (Core Facts)
- preferred_name: Mui-chan

## Relation (Core Facts)
- first_met: 2025-06-15

## Recent Relationship State
- last_topic: 正在讨论养猫的事

## Recent Session Archives
- Session 2025-07-28 22:30:00: 你们讨论了...
```

- CORE 始终出现（如无记录则跳过整个分区）
- STATE 和 ARCHIVE 仅在 Resume 模式（`is_first_session=False`）时出现

## 数据持久化

所有记忆通过 SQLAlchemy / aiosqlite 持久化到 `data/` 目录的 SQLite 数据库：

| ORM 模型 | 表 | 对应层 |
|----------|-----|--------|
| `MemoryRecordORM` | `memory_records` | CORE / STATE / PREFERENCE |
| `ArchiveRecordORM` | `archive_records` | ARCHIVE |

数据库迁移使用 Alembic 管理（`muika/database/migrations/`）。

## 记忆的自动产生

Muika 能够在对话中**主动**产生记忆——她不需要用户"教"她记什么。

1. Brain 在回复中插入 `<memory>用户的喜好是...</memory>` 标签
2. Loop 提取标签内容 → `ButlerAgent.classify_and_store_memory()`
3. Butler 调用 LLM 将原始内容分类为 `(layer, category, key)` 三元组
4. 自动 upsert 到 MemoryManager

这意味着 Muika 在对话中自然观察、记忆关于你的事情——就像一个有记性的人类一样。
