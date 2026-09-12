# API 参考

本文档列出 Muika 核心模块中最重要的公共 API。作为快速参考，不覆盖所有内部方法。

## Muika — 事件循环

`muika/core/loop.py`

```python
class Muika:
    event_queue: asyncio.Queue
    """事件队列，接收来自 IPC 和调度的各类 Event"""

    async def loop(self) -> None:
        """运行核心事件循环。"""

    async def create_event(self, event: Event) -> None:
        """向事件队列推送一个事件。"""
```

**生命周期**：`CoreBootstrap` 创建 `Muika` 实例 → 在后台运行 `loop()` → 事件循环在后台持续运行直到 SIGTERM。

## MuikaBrain — 人格回复生成

`muika/core/brain.py`

```python
class MuikaBrain:
    async def generate_reply(
        self, event, state: MuikaState, memory: MemoryManager,
        resources: list[Resource] | None = None,
        recalled_memories: RecallResult | None = None,
        adapters: list[AdapterInfo] | None = None,
        god_mode: bool = False, now: datetime | None = None, task_context: str = ""
    ) -> str:
        """
        生成 Muika 的对话回复。

        构建完整 System Prompt（模板 + 记忆 + 检索结果 + 持续状态），
        调用 LLM 生成回复文本。返回的文本可能包含
        <agent>、<memory> 和 <state> 等私有标签。

        :returns: 原始 LLM 回复文本
        """

    async def expand_topic(
        self, topic, state: MuikaState, memory: MemoryManager
    ) -> str:
        """
        将话题种子展开为自然的主动发言。

        使用轻量级独立 Prompt，不包含 Agent 标签。
        包含时间感知的语调指引。
        """
```

## MuikaState — 情绪状态机

`muika/core/state.py`

```python
@dataclass
class MuikaState:
    mood: Literal["calm", "lonely", "bored"]
    """当前情绪标签"""

    attention: float   # 0-1
    """注意力水平（用户发消息时 → 1.0，随时间衰减）"""

    loneliness: float  # 0-1
    """孤独度（随时间上升，用户互动 → 0，发言后 -0.35）"""

    boredom: float     # 0-1
    """无聊度（随时间上升，持续互动降低）"""

    curiosity: float   # 0-1
    """好奇心（随时间缓慢衰减）"""

    last_interaction: Optional[datetime]
    """最后一次用户互动时间"""

    last_proactive_at: Optional[datetime]
    """最后一次主动发言时间（用于冷却）"""

    active_topic: Optional[ActiveTopicState]
    """当前活跃话题状态"""

    def tick_state(self, event: Event, dt: float):
        """
        推进情绪状态。

        :param event: 当前事件
        :param dt: 距离上次 tick 的秒数
        """
```

## MemoryManager — 素材、事实、日记和状态

`muika/core/memory.py` 和 `memory_models.py` 提供显式数据类型。

```python
class MemoryManager:
    facts: dict[int, Fact]
    recent_turns: deque[SessionTurn]

    async def load(self) -> None: ...
    async def new_session(self) -> None: ...
    async def add_context(self, role, content, resources=None, *, timestamp=None, source=None) -> int: ...
    async def add_material(self, kind, content, *, timestamp=None, resources=None, source=None) -> int: ...
    async def update_state(self, update: StateUpdate) -> None: ...
    async def forget_memory(self, category: MemoryCategory, key: str) -> None: ...
    async def search(self, query: MemoryQuery, *, limit: int = 30) -> list[RecallHit]: ...
    async def read_source(self, ref: str, *, offset: int = 0, limit: int = 6000) -> str: ...
    def get_memory_prompt(self, budget: int = 2048) -> str: ...
```

`session` 返回当前会话元信息；`persistent` 返回长期情绪、失衡度和意愿。
`MemoryCategory` 保留 `user`、`self`、`world`、`relation`。`MemoryLayer` 分类参数已移除。
日记和工作摘要使用不同入口。完整说明见[记忆系统](./memory-system.md)。

## Agent — 行动半身

`muika/core/agent/agent.py` 组装行动提示。`AgentTasks` 负责持久任务、执行边界和结果事件。
`MemoryReasoner.recall(question, memory)` 检索相关记忆；`dream(day, memory)` 整理当天日记。
记忆笔记直接落库，不再调用分类模型。普通会话结束不调用日记模型。

## Executor — 消息执行器

`muika/core/executor.py`

```python
class Executor:
    async def send_message(self, message: str, resources=None, target: str | None = None) -> None:
        """
        分段发送长消息。在自然断点处分割（段落 → 中文标点），
        段间延迟 1.5 秒。资源仅附加到最后一段。
        """
```

## TopicManager — 话题管理

`muika/core/topic_manager.py`

```python
class TopicManager:
    async def get_next_topic(self, state: MuikaState) -> Optional[BaseTopic]:
        """
        选择下一个主动话题。考虑：权重、冷却、近期惩罚、用户参与度。
        优先从 EventTopic 队列（RSS）选择，其次从静态话题库选择。
        """

    async def record_topic_used(self, topic_id: str, *, user_engaged: bool) -> None:
        """记录话题使用历史（影响未来权重）。"""

    def enqueue_event(self, topic: EventTopic) -> None:
        """将从 RSS 摘要生成的话题放入优先队列。"""
```

## on_function_call — 工具注册

`muika/plugin/func_call/caller.py`

```python
def on_function_call(
    description: str,
    params: Optional[Type[BaseModel]] = None,
    *, read_only: bool = False
) -> Caller:
    """
    将函数注册为 Agent 可调用的工具。

    函数签名自动转换为 LLM 的 JSON Schema 工具定义。
    """

def get_function_list() -> list[dict]:
    """获取所有已注册工具（JSON Schema 格式），传给 LLM。"""

def get_function_calls() -> dict[str, Caller]:
    """获取所有已注册工具（Caller 对象），供手动调用。"""
```

## on_alconna — 命令注册

`muika/plugin/command.py`

```python
def on_alconna(
    alc: Alconna,
    *, aliases: set[str] | None = None,
    priority: int = 10
) -> CommandRegistry:
    """
    注册一个对话命令。

    :param alc: Arclet Alconna 命令解析器
    :param aliases: 命令别名
    :param priority: 匹配优先级（越小越优先）
    """
```

## PluginMetadata — 插件元数据

`muika/plugin/models.py`

```python
@dataclass
class PluginMetadata:
    name: str                  # 插件名称
    description: str           # 插件描述
    usage: str                 # 用法说明
    homepage: Optional[str]    # 项目主页
    config: Optional[Type[BaseModel]]  # 插件配置类
    extra: dict                # 额外信息
```
