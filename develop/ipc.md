# IPC 协议

Muika-After-Story 的 Core 和 Bot 进程通过 WebSocket 传输 JSON 消息进行通信。本章详细介绍消息格式、协议规范和客户端实现。

## 协议概览

```
┌──────────────┐          WebSocket (JSON)         ┌──────────────┐
│   Bot 进程    │ ◄══════════════════════════════► │  Core 进程    │
│  (Nonebot2)  │    ws://127.0.0.1:8765/ws        │   (Muika)    │
└──────────────┘                                   └──────────────┘
    IpcClient                                          CoreWsServer
    (客户端)                                           (服务端)
```

- **传输层**：WebSocket
- **数据格式**：JSON
- **认证**：`X-Auth-Token` HTTP Header（预共享密钥 `IPC_SECRET`）
- **单连接**：Core 同时只接受一个 Bot 连接（单用户设计）

## 消息信封

所有消息共享 `IPCMessage` 基类的三个字段：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "user_message",
  "ts": "2025-07-29T14:30:00"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `str` (UUID) | 消息唯一标识，自动生成 |
| `type` | `str` | 消息类型鉴别器（决定消息体的结构） |
| `ts` | `str` (ISO 8601) | 消息时间戳 |

## Bot → Core（上行消息）

### UserMessageEvent — 用户对话消息

用户发送了一条聊天消息。

```json
{
  "type": "user_message",
  "message": "今天天气真好",
  "resources": [
    {"url": "https://example.com/photo.jpg", "mimetype": "image/jpeg"}
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | `str` | 是 | 消息文本 |
| `resources` | `list[dict]` | 否 | 多模态资源（图片、文件等） |

### CommandEvent — 命令

用户发送了以 `.` 或 `/` 开头的命令。

```json
{
  "type": "command",
  "raw": ".debug state"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `raw` | `str` | 是 | 原始命令文本（含前缀） |

### SessionBootstrapEvent — 请求新会话

Bot 已连接到聊天平台，请求 Core 创建新会话。

```json
{
  "type": "session_bootstrap"
}
```

无额外字段。Core 收到后会：
1. 判断是首次对话还是 Resume 模式
2. 注入相应记忆层
3. 生成欢迎语或回归问候

### SessionEndEvent — 请求结束会话

用户主动请求结束当前会话。

```json
{
  "type": "session_end"
}
```

Core 收到后结束工作会话。原始素材已逐轮保存，日记在到期后的空闲阶段按自然日整理。

## Core → Bot（下行消息）

### SendMessage — 发送 LLM 回复

Core 要求 Bot 向用户发送一条 LLM 消息。

```json
{
  "type": "send_message",
  "content": "嗯，今天确实是个好天气呢 [微笑]",
  "resources": []
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | `str` | 是 | 文本内容 |
| `resources` | `list[dict]` | 否 | 多模态资源 |

### CommandResult — 命令执行结果

Core 返回命令处理结果。

```json
{
  "type": "command_result",
  "content": "当前模型: deepseek\n可选模型: deepseek, deepseekflash, qwen, gemini",
  "resources": []
}
```

### ActionResponse — 确认响应

Core 对上行事件的确认（不发送给用户）。

```json
{
  "type": "action_response",
  "action": "session_bootstrap",
  "status": "ok"
}
```

### ErrorMessage — 错误

Core 报告处理过程中的错误。

```json
{
  "type": "error",
  "message": "模型调用失败",
  "detail": "Connection timeout to API endpoint"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `message` | `str` | 错误简述 |
| `detail` | `str`（可选） | 详细错误信息 |

## 消息流时序

```
Bot                              Core
 │                                │
 │── SessionBootstrapEvent ──────►│  1. 请求新会话
 │                                │  2. 判断 first / resume
 │                                │  3. 注入记忆
 │◄─────── SendMessage ──────────│  4. 欢迎语 / 回归问候
 │                                │
 │── UserMessageEvent ───────────►│  5. 用户发消息
 │                                │  6. State tick
 │                                │  7. Brain 生成回复
 │                                │  8. Agent 执行工具（如有）
 │◄─────── SendMessage ──────────│  9. 发送回复
 │                                │
 │          ... (持续对话) ...     │
 │                                │
 │── SessionEndEvent ────────────►│ 10. 请求结束
 │                                │ 11. 结束工作会话
 │                                │ 12. 保留素材与状态
 │◄─────── ActionResponse ───────│ 13. 确认
```

## 编写 Bot 适配器

你可以为任何聊天平台编写 Bot 适配器。以下是实现一个 IPC 客户端的最小步骤：

### 步骤 1：创建 WebSocket 连接

```python
import aiohttp
from aiohttp import WSMsgType

session = aiohttp.ClientSession()
headers = {"X-Auth-Token": "your-ipc-secret"}
ws = await session.ws_connect("ws://127.0.0.1:8765/ws", headers=headers)
```

### 步骤 2：发送 Session Bootstrap

```python
import json, uuid
from datetime import datetime

def make_envelope(msg_type: str, **kwargs) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "type": msg_type,
        "ts": datetime.now().isoformat(),
        **kwargs,
    }

# 请求新会话
await ws.send_json(make_envelope("session_bootstrap"))
```

### 步骤 3：注册消息处理器

```python
async def handle_send_message(data: dict):
    content = data["content"]
    resources = data.get("resources", [])
    # 调用你的平台 API 发送消息
    await your_platform_send(content, resources)

# 接收循环
async for msg in ws:
    if msg.type == WSMsgType.TEXT:
        data = json.loads(msg.data)
        if data["type"] == "send_message":
            await handle_send_message(data)
        elif data["type"] == "command_result":
            await handle_command_result(data)
        elif data["type"] == "error":
            logger.error(f"Core error: {data['message']}")
```

### 步骤 4：转发用户消息

```python
# 用户发送消息时
await ws.send_json(make_envelope(
    "user_message",
    message="用户的消息内容",
    resources=[]  # 可选的多模态资源
))

# 用户发送命令时
await ws.send_json(make_envelope(
    "command",
    raw=".debug state"
))
```

### 步骤 5：实现重连

```python
import asyncio

async def connect_with_retry():
    retry = 0
    while retry < 5:
        try:
            await connect_once()
            return
        except Exception as e:
            retry += 1
            delay = min(1.0 * (2 ** (retry - 1)), 30.0)
            logger.warning(f"重连中 ({retry}/5), {delay:.1f}s 后重试...")
            await asyncio.sleep(delay)
    logger.error("重连失败，放弃")
```

### 步骤 6：消息暂存

当 Core 不可用时，将待发送事件暂存：

```python
from collections import deque

pending_events = deque(maxlen=100)

async def send_or_queue(msg_type: str, **kwargs):
    msg = make_envelope(msg_type, **kwargs)
    if ws and not ws.closed:
        await ws.send_json(msg)
    else:
        pending_events.append(msg)

# 重连后发送暂存消息
async def flush_pending():
    while pending_events:
        await ws.send_json(pending_events.popleft())
```

## 安全注意事项

- `IPC_SECRET` 会在 Core 首次启动时自动生成并写入 `.env`，确保使用随机强密钥
- Core 默认只监听 `127.0.0.1`——如果 Core 和 Bot 不在同一机器，需注意网络暴露风险
- WebSocket 连接无 TLS（本地通信），不适合公网传输——如需跨公网部署，建议使用 SSH 隧道或 VPN
