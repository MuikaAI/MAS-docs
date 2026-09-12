# 工具开发

工具（Function Call）是 Agent 可调用的 Python 函数。通过 `@on_function_call` 装饰器注册后，函数会被自动转换为 LLM 可理解的 JSON Schema 工具定义。

## 快速开始

```python
from muika.plugin.func_call import on_function_call

@on_function_call(description="获取指定城市的天气信息")
async def get_weather(city: str) -> str:
    """返回城市天气"""
    # 实际开发中调用天气 API
    return f"{city}: 晴, 25°C"
```

只需这一个装饰器，你的函数就对 Agent 可见了。

## 工作原理

1. **注册时**：装饰器将函数签名提取为 `Caller` 对象，存入全局注册表
2. **启动时**：`get_function_list()` 遍历注册表，将每个函数的签名转换为 JSON Schema
3. **执行时**：Agent 将工具定义传给 LLM；共享执行层校验并执行调用，Provider 只处理模型协议

```
Muika 输出 <agent>帮我查一下北京的天气</agent>
     ↓
Agent 将命令 + 工具列表发给 LLM
     ↓
LLM 决定调用 get_weather(city="北京")
     ↓
共享执行层调用工具 → 获得返回值 "北京: 晴, 25°C"
     ↓
Agent 将结果作为报告返回给 Muika
```

## on_function_call 装饰器

```python
def on_function_call(
    description: str,                          # 必填：函数描述（给 LLM 看的）
    params: Optional[Type[BaseModel]] = None,  # 可选：Pydantic 参数模型
    *, read_only: bool = False,                # 是否只读；用于恢复时核对结果
) -> Caller: ...
```

### 基本用法

函数的参数签名自动转换为 JSON Schema：

```python
@on_function_call(description="在指定目录中列出所有文件")
async def list_directory(path: str, pattern: str = "*") -> str:
    ...
```

自动生成：
```json
{
  "name": "list_directory",
  "description": "在指定目录中列出所有文件",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {"type": "string"},
      "pattern": {"type": "string", "default": "*"}
    },
    "required": ["path"]
  }
}
```

### 使用 Pydantic 参数模型

对复杂参数，使用 Pydantic 模型可获得更精准的 Schema：

```python
from pydantic import BaseModel

class WeatherParams(BaseModel):
    city: str
    """城市名称"""
    unit: str = "celsius"
    """温度单位：celsius 或 fahrenheit"""

@on_function_call(
    description="获取指定城市的天气",
    params=WeatherParams
)
async def get_weather(city: str, unit: str = "celsius") -> str:
    return f"{city}: 25°{unit}"
```

## 公共依赖注入

工具与命令使用同一套参数绑定。工具函数可通过类型声明接收运行时依赖，依赖不会暴露给模型作为参数。

```python
from muika.core.state import MuikaState

@on_function_call(description="Read Muika's current mood.", read_only=True)
async def current_mood(state: MuikaState) -> str:
    return state.mood
```

常用的可注入类型：

| 类型 | 说明 |
| --- | --- |
| `MuikaState` | 当前状态；`memory` 指向同一记忆管理器 |
| `MemoryManager` | 素材、日记、事实与持续状态 |
| `Executor` | 消息与资源发送器 |
| `ToolContext` | 当前任务 ID、文件版本和本次调用资源，来自 `muika.plugin.func_call.context` |

旧的 `_context.get_state()` 和 `get_resources()` 私有接口已移除。不要在工具调用结束后长期持有 `ToolContext`。

## 工具安全分级

工具按安全级别分为两级：

### Tier 1 — 只读操作（默认安全）

- `list_directory`、`read_file` — 文件系统只读
- `list_processes`、`get_focused_window`、`get_system_status` — 系统信息
- `read_clipboard` — 剪贴板只读

### Tier 2 — 写入操作（需配置开关）

- `write_file`、`edit_file`、`delete_file` → 需 `ENABLE_FILE_WRITE=true` + `FS_ALLOWED_PATHS` 白名单
- `execute_python` → 需 `ENABLE_CODE_EXECUTION=true`
- `execute_shell` → 需 `ENABLE_SHELL_EXECUTION=true`
- `send_desktop_notification` → 桌面通知

**双重安全闸门**：Tier 2 工具在函数内部检查全局开关，即使 LLM 试图调用，也会被拒绝执行。

## 编写安全工具的最佳实践

```python
from pathlib import Path

from muika.config import mas_config
from muika.llm.utils.tools import ToolError

@on_function_call(description="写入内容到文件")
async def write_file(path: str, content: str) -> str | ToolError:
    # 1. 检查全局开关
    if not mas_config.enable_file_write:
        return ToolError("File writing is disabled.")

    # 2. 路径白名单验证
    allowed = [Path(p).resolve() for p in mas_config.fs_allowed_paths]
    target = Path(path).resolve()
    if not any(target.is_relative_to(directory) for directory in allowed):
        return ToolError("The path is outside the allowed directories.")

    # 3. 执行操作
    target.write_text(content, encoding="utf-8")
    return f"文件已写入: {path}"
```

## 注意事项

- **函数必须可序列化**：LLM 通过 JSON 传参，参数类型限于 str / int / float / bool / list / dict
- **异步为佳**：注册时若非协程会自动包装，但建议直接写 `async def`
- **返回值**：普通成功结果可以返回字符串；错误用 `ToolError`，结构化状态或多模态资源用 `ToolResult`
- **异常处理**：工具函数抛出的异常会被 Agent 捕获并报告，不会 crash Core
- **清除上下文**：工具作用域结束时自动恢复外层上下文，不在不同调用之间共用资源列表

`execute_python` 和 `execute_shell` 默认等待 3 秒。返回 `running` 表示进程仍在执行，需用 `wait_process` 继续等待并核对退出状态。
`read_file` 支持行范围，`find_files` 和 `search_files` 用于定位内容；完整任务输出可用 `read_task_output` 续读。
