# 插件开发

Muika-After-Story 的插件系统允许你以 Python 包的形式扩展 Muika 的能力。插件可以注册**命令**（用户可直接调用的 `.xxx` 指令）和**工具**（Butler Agent 可调用的函数）。

其实就和你写 Nonebot 的插件是一样的（）

## 插件结构

一个最小化的插件是一个包含 `__init__.py` 的目录：

```
plugins/
└── my-plugin/
    ├── __init__.py      # 插件入口，暴露 metadata
    ├── commands.py      # 命令注册
    └── tools.py         # Butler 工具注册
```

## PluginMetadata

每个插件必须在模块顶层暴露一个 `metadata` 对象：

```python
# plugins/my-plugin/__init__.py

from muika.plugin.models import PluginMetadata

metadata = PluginMetadata(
    name="My Plugin",
    description="一个示例插件",
    usage="安装后自动生效，使用 .mycommand 调用",
    homepage="https://github.com/username/my-plugin",
)
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 插件名称 |
| `description` | 是 | 插件描述 |
| `usage` | 是 | 用法说明 |
| `homepage` | 否 | 项目主页链接 |
| `config` | 否 | Pydantic 配置类（插件级配置） |
| `extra` | 否 | 额外信息字典 |

## 插件加载流程

`CoreBootstrap` 启动时调用 `load_plugins()`：

1. 扫描 `muika/builtin_plugins/` — 内置命令（始终加载）
2. 扫描配置的 `PLUGINS_DIR`（默认 `plugins/`）— 用户插件
3. 对每个 `.py` 文件或包目录，调用 `importlib` 加载
4. 提取 `metadata` 属性，注册到全局 `_plugins` 字典

> **插件不需手动注册**。只要文件在插件目录中，就会被自动扫描加载。

## 插件数据目录

每个插件可以拥有自己的数据目录：

```python
from muika.plugin.loader import get_plugin_data_dir

data_dir = get_plugin_data_dir()
# → data/plugin/my_plugin/
```

插件通过调用栈自省自动识别自身身份，无需传递插件名。

## 插件类型

按功能分为两类：

### 命令插件

注册用户可直接调用的对话命令。详见 [命令开发](/develop/command-dev)。

```python
from arclet.alconna import Alconna, Args
from muika.plugin.command import on_alconna

register = on_alconna(
    Alconna(".mycommand", Args["arg", str]),
    aliases=[".mc"],
    priority=10,
)

@register.handle()
async def handle(arg: str):
    await register.finish(f"收到参数: {arg}")
```

### 工具插件

注册 Butler Agent 可调用的函数。详见 [工具开发](/develop/func-call-dev)。

```python
from muika.plugin.func_call import on_function_call

@on_function_call(
    description="执行某个操作",
    params={"param1": "参数说明"}
)
async def my_tool(param1: str) -> str:
    return f"操作完成: {param1}"
```

## 查看已加载插件

```python
from muika.plugin.loader import get_plugins

plugins = get_plugins()
for plugin in plugins:
    print(f"{plugin.name} - {plugin.meta.description}")
```

## 插件开发最佳实践

1. **一个插件一个目录**：不要在一个文件中混合多个插件
2. **最小化依赖**：插件应尽可能少地依赖第三方包
3. **处理异常**：工具函数中的异常会被 Butler 捕获并报告，不要让它 crash 整个 Core
4. **尊重安全边界**：工具函数无法绕过 `FS_ALLOWED_PATHS` 和 `ENABLE_FILE_WRITE` 等全局安全开关
