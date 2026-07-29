# API 参考

本文档列出 Muika 核心模块中最重要的公共 API。作为快速参考，不覆盖所有内部方法。

## Muika — 事件循环

`muika/core/loop.py`

```python
class Muika:
    event_queue: asyncio.Queue
    """事件队列，接收来自 IPC 和调度的各类 Event"""

    async def start(self):
        """启动事件循环（asyncio background task）。"""

    async def push_event(self, event: Event):
        """向事件队列推送一个事件。"""
```

**生命周期**：`CoreBootstrap` 创建 `Muika` 实例 → 调用 `start()` → 事件循环在后台持续运行直到 SIGTERM。

## MuikaBrain — 人格回复生成

`muika/core/brain.py`

```python
class MuikaBrain:
    async def generate_reply(
        self, event, state: MuikaState, memory: MemoryManager,
        resources: list, injected_preferences: str
    ) -> str:
        """
        生成 Muika 的对话回复。

        构建完整 System Prompt（模板 + 记忆 + 偏好），
        调用 LLM 生成回复文本。返回的文本可能包含
        <Butler:> 和 <memory> 标签。

        :returns: 原始 LLM 回复文本
        """

    async def expand_topic(
        self, topic, state: MuikaState, memory: MemoryManager
    ) -> str:
        """
        将话题种子展开为自然的主动发言。

        使用轻量级独立 Prompt，不包含 Butler 标签。
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

## MemoryManager — 四层记忆

`muika/core/memory.py`

```python
class MemoryManager:
    records: dict[str, MemoryRecord]
    """CORE / STATE / PREFERENCE 层记忆"""

    archives: list[ArchiveEntry]
    """ARCHIVE 层 — 历史会话摘要"""

    session: SessionState
    """当前会话元信息（session_id, is_first_session, started_at）"""

    recent_turns: deque[SessionTurn]
    """当前 Session 的对话记录"""

    async def load(self):
        """从 DB 加载所有记忆。有历史数据则 is_first_session=False。"""

    def new_session(self):
        """创建新 Session（自动判断 first/resume）。"""

    def add_context(self, role, content, resources=None):
        """记录一条对话到 recent_turns。"""

    async def upsert_memory(self, layer, category, key, value, expires_at=None):
        """插入或覆盖一条记忆（自动持久化到 DB）。"""

    async def forget_memory(self, layer, category, key):
        """删除一条记忆（自动持久化到 DB）。"""

    def get_memory_prompt(self) -> str:
        """构建注入 System Prompt 的完整记忆上下文。"""

    def get_preference_records(self) -> list[MemoryRecord]:
        """返回所有 PREFERENCE 层记录，供 Butler 检索。"""
```

### 枚举类型

```python
class MemoryLayer(str, Enum):
    CORE = "core"           # 核心身份记忆
    STATE = "state"         # 关系状态记忆
    PREFERENCE = "preference"  # 偏好档案
    ARCHIVE = "archive"     # 历史会话摘要

class MemoryCategory(str, Enum):
    USER = "user"           # 关于用户
    SELF = "self"           # 关于自身
    WORLD = "world"         # 世界/环境
    RELATION = "relation"   # 关系/交互
```

## ButlerAgent — 管家 Agent

`muika/core/butler/agent.py`

```python
class ButlerAgent:
    async def execute_command(
        self, command: str, state: MuikaState, executor: Executor
    ) -> tuple[str, list[Resource]]:
        """
        执行 <Butler:> 标签中的自然语言命令。

        将命令 + 所有注册工具传给 LLM，由 Provider 处理工具调用分发。
        :returns: (报告文本, 资源列表)
        """

    async def fetch_relevant_preferences(
        self, user_input: str, preferences: list[MemoryRecord]
    ) -> list[MemoryRecord]:
        """
        语义匹配：返回与当前用户输入相关的偏好记录。
        每轮用户消息到达时调用。
        """

    async def classify_and_store_memory(
        self, content: str, state: MuikaState
    ):
        """
        分类并存储 <memory> 标签中的原始记忆内容。
        使用 LLM 将内容分类为 (layer, category, key)。
        """

    async def summarize_session(
        self, turns: list[SessionTurn]
    ) -> str:
        """
        生成会话日记摘要，供 ARCHIVE 层存储。
        """
```

## Executor — 消息执行器

`muika/core/executor.py`

```python
class Executor:
    async def send_message(self, content: str, resources=None):
        """
        分段发送长消息。在自然断点处分割（段落 → 中文标点），
        段间延迟 1.5 秒。资源仅附加到最后一段。
        """

    async def schedule(self, intent) -> str:
        """调度未来事件（延迟消息、提醒等）。"""
```

## TopicManager — 话题管理

`muika/core/topic_manager.py`

```python
class TopicManager:
    async def get_next_topic(self, state: MuikaState) -> Optional[Topic]:
        """
        选择下一个主动话题。考虑：权重、冷却、近期惩罚、用户参与度。
        优先从 EventTopic 队列（RSS）选择，其次从静态话题库选择。
        """

    async def record_topic_used(self, topic: Topic, user_engaged: bool):
        """记录话题使用历史（影响未来权重）。"""

    async def enqueue_event_topic(self, topic: EventTopic):
        """将从 RSS 摘要生成的话题放入优先队列。"""
```

## on_function_call — 工具注册

`muika/plugin/func_call/caller.py`

```python
def on_function_call(
    description: str,
    params: Optional[Type[BaseModel]] = None
) -> Caller:
    """
    将函数注册为 Butler Agent 可调用的工具。

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
    aliases: list[str] = [],
    priority: int = 0
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
