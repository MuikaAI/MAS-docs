# 模型配置

Muika-After-Story 支持多种 LLM 后端，通过 `configs/models.yml` 统一管理。配置文件支持**热更新**——修改后无需重启 Core 即可生效。

## 配置文件格式

`models.yml` 是一个 YAML 字典，每个**键**是模型配置名（用于命令和配置引用），**值**是模型配置对象。

```yaml
# 键 = 配置名，用于 .model 命令和配置引用
my-model-name:
  provider: openai             # 必填：Provider 名称
  model_name: deepseek-chat    # 必填：模型名称
  api_key: sk-xxxx             # 必填：API Key
  default: true                # 可选：设为默认模型
  context_window: 131072        # 输入、输出及协议的总窗口；按实际服务覆盖
  max_tokens: 4096              # 输出额度
```

## 所有配置字段

### 核心字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `provider` | `str` | — | **必填**。模型提供者名称，对应 `muika/llm/providers/` 下的模块。可选值见下方 Provider 列表。 |
| `model_name` | `str` | `""` | **必填**。要使用的模型名称，如 `deepseek-chat`、`gemini-2.5-flash`。 |
| `api_key` | `str` | `""` | API 密钥。在线服务必填。 |
| `default` | `bool` | `false` | 是否设为默认模型。多个配置可同时设为 `true`。 |
| `api_host` | `str` | `""` | 自定义 API 地址。适用于 OpenAI-compatible Provider。 |

### 生成参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `max_tokens` | `int` | `4096` | 最大回复 Token 数。 |
| `context_window` | `int` | `131072` | 每模型总上下文预算；实际服务窗口较小时必须覆盖。 |
| `temperature` | `float` | `0.75` | 温度系数（0-2），越高越随机。 |
| `top_p` | `float` | `0.95` | Nucleus 采样阈值。 |
| `top_k` | `float` | `3` | Top-K 采样。 |
| `frequency_penalty` | `float`（可选） | — | 频率惩罚。 |
| `presence_penalty` | `float`（可选） | — | 存在惩罚。 |
| `repetition_penalty` | `float`（可选） | — | 重复惩罚。 |
| `stream` | `bool` | `false` | 是否启用流式输出。建议角色扮演场景开启。 |

### 高级功能

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `multimodal` | `bool` | `false` | 是否支持多模态（图片等）。 |
| `online_search` | `bool` | `false` | 启用原生联网搜索。 |
| `content_security` | `bool` | `false` | 启用内容安全审核。 |
| `enable_thinking` | `bool`（可选） | — | 启用思考模式。 |
| `thinking_budget` | `int`（可选） | — | 思考 Token 预算。 |
| `incremental_output` | `bool` | `=stream` | DashScope：增量输出。 |
| `extra_body` | `dict`（可选） | — | OpenAI：额外请求体参数。 |

### 本地模型

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `model_path` | `str` | `""` | 本地模型路径。 |
| `adapter_path` | `str` | `""` | 微调模型或适配器路径。 |

### 成本估算（每 1M Tokens）

| 字段 | 类型 | 说明 |
|------|------|------|
| `input_price` | `float`（可选） | 每百万输入 Token 价格（USD）。 |
| `output_price` | `float`（可选） | 每百万输出 Token 价格（USD）。 |
| `cached_price` | `float`（可选） | 每百万缓存命中 Token 价格（USD）。 |

用于 `.usage` 命令统计 Token 费用。

## Provider 列表

### OpenAI-Compatible

最通用的 Provider，适用于所有兼容 OpenAI API 的服务。

```yaml
deepseek:
  provider: openai
  model_name: deepseek-chat
  api_key: sk-xxxxxxxx
  api_host: https://api.deepseek.com
  default: true
  stream: true
  max_tokens: 1024
  temperature: 0.9
  extra_body: {"thinking": {"type": "enabled"}}
  input_price: 0.14
  output_price: 0.28
```

### DashScope（阿里百炼）

适用于通义千问系列模型。

```yaml
qwen:
  provider: dashscope
  model_name: qwen-plus
  api_key: sk-xxxxxxxx
  stream: true
  multimodal: false
  enable_thinking: true
  thinking_budget: 4000
```

### Gemini（Google）

```yaml
gemini:
  provider: gemini
  model_name: gemini-2.5-flash
  api_key: AIzaxxxxxxxx
  stream: true
  multimodal: true
  online_search: true
  content_security: true
```

### Ollama（本地）

```yaml
ollama:
  provider: ollama
  model_name: qwen2.5:7b
  api_host: http://localhost:11434
  stream: true
```

### Azure AI Inference

```yaml
azure:
  provider: azure
  model_name: your-deployment-name
  api_key: xxxxxxxx
  api_host: https://your-resource.services.ai.azure.com
  stream: true
```

## 热更新机制

`ModelConfigManager` 使用 `watchdog` 监听 `configs/models.yml` 的文件变化：

1. **修改即生效**：保存配置文件后，1 秒冷却期内触发重载
2. **自动通知**：所有注册了监听器的组件（如 `MuikaBrain`）会收到新旧配置对比
3. **无需重启**：模型切换完全在运行时完成

你也可以在聊天中通过 `.model <name>` 或 `.model list` 命令手动切换模型。

## 多模型策略建议

| 场景 | 推荐配置 |
|------|---------|
| 日常对话 | 高温度（0.8-0.9）、启用 thinking 的模型 |
| 管家/工具调用 | 低温度（0.2-0.5）、启用 function_call 的模型 |
| 工作摘要与日记 | 低成本快速模型（如 DeepSeek-Flash） |
| 多模态 | 启用 multimodal 的 Gemini 或 Qwen 模型 |

## 自动上下文压缩

主人格、行动模型、工作摘要和做梦都按各自模型窗口检查请求。
输入达到可用额度的 80% 时，压缩较早的完整对话或工具交互，目标回到 60%。
输出、明确配置的独立思考额度和协议余量会先被预留。原始材料继续保存。
多模态与文本 token 数是估算；服务仍拒绝长度时，只压缩并重试模型请求一次。
压缩失败时警告并保留完整历史，继续主请求；服务端实际拒绝长度时仍返回失败。
按服务实际窗口设置 `context_window`，不要依靠截断当前请求来避开限制。

`SESSION_SUMMARIZE_MODEL` 同时用于工作摘要和每日做梦。工作摘要不会变成日记或强化事实。
行动、检索、日记和摘要在下一次调用边界读取命名模型的新配置，包括只修改窗口的情况。
有效摘要超过目标长度但仍在可用空间内时会直接使用；失败的行动压缩会等待明显新增内容再尝试。
所选的私有思考深度保持不变。参见[记忆系统](../develop/memory-system.md)。
