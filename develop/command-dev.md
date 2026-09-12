# 命令开发

Muika-After-Story 的命令系统使用 [Arclet Alconna](https://github.com/ArcletProject/Alconna) 作为命令解析器。命令是用户通过聊天直接调用的 `.xxx` 或 `/xxx` 指令。

这也太眼熟了，不就是 [Nonebot-Plugin-Alconna](https://github.com/nonebot/plugin-alconna) 吗

## 快速开始

```python
from arclet.alconna import Alconna, Args
from muika.plugin.command import on_alconna

# 注册命令
register = on_alconna(
    Alconna(".echo", Args["message", str]),
    aliases=[".say"],
    priority=10,
)

@register.handle()
async def echo(message: str):
    await register.finish(f"你说: {message}")
```

## on_alconna 参数

```python
def on_alconna(
    alc: Alconna,          # Alconna 命令解析器
    aliases: list = [],    # 命令别名列表
    priority: int = 0,     # 匹配优先级（数值越小越先匹配）
) -> CommandRegistry:
```

### 优先级

当多个命令可能匹配同一输入时，**priority 越小越优先匹配**。内置命令的优先级：

| 命令 | 优先级 |
|------|--------|
| `.help` | 0 |
| `.model` | 10 |
| `.debug` | 10 |
| `.session` | 10 |

## CommandRegistry API

`on_alconna()` 返回一个 `CommandRegistry` 对象：

### handle() — 默认处理器

```python
@register.handle()
async def handler(*args, **kwargs):
    await register.finish("处理完成")
```

### assign() — 子命令路由

```python
register = on_alconna(
    Alconna(".config",
        Args["action", str],
        Args["key", str],
        Args["value", str]
    )
)

@register.assign("action", "set")
async def config_set(key: str, value: str):
    # 用户输入: .config set theme dark
    ...

@register.assign("action", "get")
async def config_get(key: str):
    # 用户输入: .config get theme
    ...
```

### finish() — 发送回复并终止

```python
await register.finish("回复消息")
```

`finish()` 支持多参数，每个参数为一条消息：

```python
await register.finish("第一段", "第二段")
```

调用 `finish()` 后会抛出内部 `FinishedException`，终止当前命令的处理链。

## 依赖注入

命令处理器可以声明需要的组件，系统会自动注入：

| 可注入类型 | 说明 |
|-----------|------|
| `Muika` | 事件循环实例 |
| `MuikaState` | 当前情绪状态 |
| `MuikaBrain` | 大脑实例（可访问 LLM） |
| `MemoryManager` | 记忆管理器 |
| `Executor` | 消息发送器 |
| `TopicManager` | 话题管理器 |
| `Agent` | 行动半身 |

```python
from muika.core.state import MuikaState
from muika.core.memory import MemoryManager

@register.handle()
async def handler(state: MuikaState, memory: MemoryManager):
    await register.finish(
        f"当前情绪: mood={state.mood}, loneliness={state.loneliness:.2f}",
        f"记忆条数: {len(memory.facts)}"
    )
```

## 资源处理

命令可以返回二进制资源（图片、文件等），由 Executor 自动保存到 `data/downloads/` 并转发给用户：

```python
from muika.models import Resource

@register.handle()
async def handler():
    img = Resource.from_path("path/to/image.png")
    await register.finish("这是生成的图片：", img)
```

## 完整示例

一个带子命令的天气查询插件：

```python
from arclet.alconna import Alconna, Args
from muika.plugin.command import on_alconna

register = on_alconna(
    Alconna(".weather", Args["city#城市名", str]),
    aliases=[".天气"],
    priority=20,
)

@register.handle()
async def weather(city: str = "北京"):
    # 实际开发中这里调用天气 API
    result = f"{city}: 晴, 25°C"
    await register.finish(result)
```

用户调用：`.weather 上海` → Muika 回复: `上海: 晴, 25°C`
