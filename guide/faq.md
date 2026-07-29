# 疑难解答

## 启动与连接

### Core 启动后 Bot 无法连接

**症状**：`bot.py` 启动后报 WebSocket 连接失败。

**检查步骤**：
1. 确认 Core 进程已完全启动（看到 `[Core] WebSocket server started on ws://127.0.0.1:8765/ws` 日志）
2. 检查 `.env` 中 `CORE_WS_URL` 配置是否正确
3. 如果 Core 和 Bot 不在同一台机器，将 `127.0.0.1` 改为 Core 所在机器的实际 IP
4. 检查防火墙是否阻止了 8765 端口
5. 确认 `IPC_SECRET` 在 `.env` 中存在且 Core 和 Bot 使用同一份 `.env`

### IPC_SECRET 相关问题

**症状**：Bot 连接被 Core 拒绝（401 Unauthorized）。

**原因**：Core 自动生成的 `IPC_SECRET` 写入 `.env` 后，Bot 读取的是旧的 `.env`（未刷新）。

**解决**：删除 `.env` 中的 `IPC_SECRET` 行，重启 Core 让它重新生成，然后重启 Bot。

## 模型配置

### "指定的模型配置不存在"

**症状**：`.model xxx` 返回 "指定的模型配置不存在"。

**原因**：命令中的名称与 `models.yml` 中的键名不匹配。

**解决**：使用 `.model list` 查看所有可用配置名，确保完全一致（区分大小写）。

### API 调用返回错误

**症状**：对话无响应，日志中有 API 错误。

**常见原因**：
- API Key 过期或余额不足
- `api_host` 配置错误（确认 URL 正确，注意末尾不要有多余的斜杠）
- 模型名称错误（不同 Provider 的模型名格式不同）
- 网络无法访问 API 端点（国内访问 OpenAI 可能需要代理）

### 热更新不生效

**症状**：修改 `models.yml` 后模型未切换。

- 文件保存后有 1 秒冷却期才会触发重载
- `watchdog` 依赖操作系统文件事件——某些网络文件系统（如 WSL 跨系统路径）可能不触发
- 手动 `.model <name>` 命令总是即时生效，可作为替代方案

## 对话行为

### Muika 不回复

**症状**：发送消息后没有响应。

**可能原因**：
1. Bot 进程崩溃或与 Core 断开
2. Core 的事件循环卡在某个耗时的 Butler 操作中
3. LLM API 调用超时

**排查**：查看 Core 日志，定位事件是否被正确接收和处理。

### 回复质量差/跑题

**症状**：Muika 的回复不符合人设或答非所问。

**建议**：
- 检查当前模型配置——低温度（< 0.5）可能导致回复过于单调
- 查看 `.debug state` ——极端情绪状态可能影响回复风格
- 尝试切换模型：`.model <other-model>`
- 检查记忆系统是否积攒了过多无关记忆，考虑清理

### 主动话题太频繁或太少

主动话题频率由状态机参数控制，关键常量位于 `muika/core/constants.py`：

- `PROACTIVE_COOLDOWN`：1 小时（两次主动话题的最小间隔）
- `TIME_TO_FULL_LONELINESS`：3 小时（loneliness 从 0 到 1 的时间）
- `TIME_TO_FULL_BOREDOM`：2 小时（boredom 从 0 到 1 的时间）

如需深度调整，直接修改这些常量并重启 Core。

## 记忆系统

### 记忆混乱

**症状**：Muika "记错"了信息。

- 使用 `.session end` 手动结束会话，触发 ARCHIVE 写入
- 检查 `data/` 目录下的 SQLite 数据库，手动清理错误记录
- CORE 层的记忆可通过 Butler 的 memory 工具修改（让 Muika "忘记"某些事）

## 性能

### Core 内存占用过高

- 检查 `MAX_MEMORY_RECORDS` 配置——过大的值会在 prompt 中注入过多历史
- 对话历史在内存中以 deque 存储，长时间运行后会自动轮转

### LLM 调用延迟大

- 确认使用 `stream: true`（流式输出可减少感知延迟）
- 检查 `enable_thinking` 配置——思考模式会增加首 Token 延迟
- 使用更快的模型（如 flash 版本）
