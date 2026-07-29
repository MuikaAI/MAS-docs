# 工具开发

工具（Function Call）是 Butler Agent 可调用的 Python 函数。通过 `@on_function_call` 装饰器注册后，函数会被自动转换为 LLM 可理解的 JSON Schema 工具定义。

## 快速开始

```python
from muika.plugin.func_call import on_function_call

@on_function_call(description="获取指定城市的天气信息")
async def get_weather(city: str) -> str:
    """返回城市天气"""
    # 实际开发中调用天气 API
    return f"{city}: 晴, 25°C"
```

只需这一个装饰器，你的函数就对 Butler 可见了。

## 工作原理

1. **注册时**：装饰器将函数签名提取为 `Caller` 对象，存入全局注册表
2. **启动时**：`get_function_list()` 遍历注册表，将每个函数的签名转换为 JSON Schema
3. **执行时**：Butler 将所有工具传给 LLM，LLM 选择工具 → Provider 执行 → Butler 获得报告

```
Muika 输出 <Butler: 帮我查一下北京的天气>
     ↓
Butler 将命令 + 工具列表发给 LLM
     ↓
LLM 决定调用 get_weather(city="北京")
     ↓
Provider 执行 → 获得返回值 "北京: 晴, 25°C"
     ↓
Butler 将结果作为报告返回给 Muika
```

## on_function_call 装饰器

```python
def on_function_call(
    description: str,                          # 必填：函数描述（给 LLM 看的）
    params: Optional[Type[BaseModel]] = None,  # 可选：Pydantic 参数模型
) -> Caller:
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
async def get_weather(params: WeatherParams) -> str:
    return f"{params.city}: 25°{params.unit}"
```

## Butler 上下文

工具函数可以通过全局上下文访问 Muika 的运行时状态：

```python
from muika.plugin.func_call._context import get_state, get_resources

@on_function_call(description="发送桌面通知")
async def send_notification(title: str, message: str) -> str:
    state = get_state()           # 当前 MuikaState
    resources = get_resources()    # 资源列表（可追加图片等）

    # 使用 state.loneliness 等情绪信息做决策
    ...
    return "通知已发送"
```

可用的上下文函数：

| 函数 | 返回值 | 说明 |
|------|--------|------|
| `get_state()` | `MuikaState` | 当前情绪状态 |
| `get_resources()` | `list[dict]` | 资源列表（可 mutate 追加） |

## 工具安全分级

工具按安全级别分为两级：

### Tier 1 — 只读操作（默认安全）

- `list_directory`、`read_file` — 文件系统只读
- `list_processes`、`get_focused_window`、`get_system_status` — 系统信息
- `read_clipboard` — 剪贴板只读

### Tier 2 — 写入操作（需配置开关）

- `write_file`、`edit_file`、`delete_file` → 需 `ENABLE_FILE_WRITE=true` + `FS_ALLOWED_PATHS` 白名单
- `execute_python` → 需 `ENABLE_CODE_EXECUTION=true`
- `send_desktop_notification` → 桌面通知

**双重安全闸门**：Tier 2 工具在函数内部检查全局开关，即使 LLM 试图调用，也会被拒绝执行。

## 编写安全工具的最佳实践

```python
from muika.config import mas_config

@on_function_call(description="写入内容到文件")
async def write_file(path: str, content: str) -> str:
    # 1. 检查全局开关
    if not mas_config.enable_file_write:
        return "错误：文件写入功能未启用。请在 .env 中设置 ENABLE_FILE_WRITE=true"

    # 2. 路径白名单验证
    from pathlib import Path
    allowed = [Path(p).resolve() for p in mas_config.fs_allowed_paths]
    target = Path(path).resolve()
    if not any(str(target).startswith(str(a)) for a in allowed):
        return f"错误：路径 {path} 不在允许的白名单中"

    # 3. 执行操作
    target.write_text(content, encoding="utf-8")
    return f"文件已写入: {path}"
```

## 注意事项

- **函数必须可序列化**：LLM 通过 JSON 传参，参数类型限于 str / int / float / bool / list / dict
- **异步为佳**：注册时若非协程会自动包装，但建议直接写 `async def`
- **返回值应为字符串**：Butler 期望获得可读的报告文本
- **异常处理**：工具函数抛出的异常会被 Butler 捕获并报告，不会 crash Core
- **清除上下文**：`execute_command()` 在 finally 块中自动清除 Butler 上下文，工具函数不应长期持有上下文
