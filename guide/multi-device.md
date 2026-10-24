# 多设备部署

让 Muika 在电脑和服务器之间继续同一段关系。电脑关闭后，服务器继续处理对话；电脑重新连接时，两边补齐已有经历。
电脑不需要公网 IP，只需主动连接服务器。

只在一台电脑使用 MAS 时，继续按[快速开始](/guide/getting-started)操作即可。以下配置均为可选配置。

## 准备两台设备

| 位置 | 运行什么 | 用途 |
| --- | --- | --- |
| 常驻服务器 | 聊天入口、一个 Muika Core、聊天机器人 | 接收消息；电脑关闭后继续聊天 |
| 日常电脑 | 一个 Muika Core | 平时聊天，使用电脑上的文件和程序 |

Core 是运行 Muika 的程序。聊天入口负责连接各设备，保存已收到的事件。聊天机器人负责连接 QQ、Telegram 等聊天平台。

**电脑关闭后要继续聊天，机器人及其连接聊天平台所需的程序也必须保持运行。**
可以使用现有接入方式和多个 Bot，各 Bot 仍负责识别你在对应平台的账号。

两台设备使用相同的 MAS 代码和 `IPC_SECRET`。密钥用于验证连接，不要公开。
每台设备使用自己的 `data`、模型配置、人格模板和插件目录，不要用网盘同步正在运行的数据库。

## 1. 启动常驻服务器

按[快速开始](/guide/getting-started)安装 MAS，按[模型配置](/guide/model)准备 `configs/models.yml`。
服务器与电脑各安装一份，不要共同打开同一个数据库文件。

在服务器项目目录创建 `.env`：

```dotenv
MASTER_ID=你的主账号ID
IPC_SECRET=与你电脑相同的连接密钥
GATEWAY_URL=ws://127.0.0.1:8765/cores
CORE_NODE_NAME=server
CORE_PRIORITY=0
LOCAL_FALLBACK=false
```

在一个终端启动聊天入口：

```bash
python -m muika.ipc.gateway
```

看到 `Chat and Core connections are ready` 表示入口已开放。
在另一个终端启动服务器上的 Muika：

```bash
python core_main.py --port 8767
```

两个程序都需要保持运行。`core_main.py` 负责监督 Core 的重启与启动失败恢复。
Core 的 `8767` 端口只用于本机连接，不需要对外开放。使用 uv 安装时，在命令前加 `uv run --no-sync`。

### 让电脑连接入口

如果已有 HTTPS 反向代理，将整个入口转发到 `http://127.0.0.1:8765`，并开启 WebSocket 转发。
需要转发 `/cores`、`/ws`、`/health` 和 `/attachments/`；上传大小限制至少为 20 MiB。
公网连接使用 `wss://`，不要直接公开未加密的聊天入口。

没有域名或反向代理时，可以先在电脑上使用 SSH 隧道：

```bash
ssh -N -L 18765:127.0.0.1:8765 用户名@服务器地址
```

保持这个终端运行。以下示例使用隧道地址；使用域名时，将地址换成 `wss://你的域名/cores`。

## 2. 连接日常电脑

保留电脑原有的模型、模板、插件和 `data`。在电脑 `.env` 中增加：

```dotenv
GATEWAY_URL=ws://127.0.0.1:18765/cores
CORE_NODE_NAME=pc
CORE_PRIORITY=100
LOCAL_FALLBACK=true
```

`IPC_SECRET` 与服务器相同。然后按平时的方式启动 Core：

```bash
python core_main.py
```

首次连接会同步已有记忆。电脑同步完成后成为主要活动设备；服务器留在后台，收到已保存的经历和状态。
同一份经历不会在备用设备上再次调用模型或执行工具。

只有这台日常电脑设置 `LOCAL_FALLBACK=true`。其他设备保留 `false`，避免入口断开后每台设备都各自活动。

## 3. 连接聊天机器人

机器人保留原有平台配置，只需调整连接 Muika 的地址：

```dotenv
CORE_WS_URL=ws://127.0.0.1:8765/ws
IPC_SECRET=与你各设备相同的连接密钥
```

这段配置适用于与入口运行在同一台服务器上的 Bot。其他位置的 Bot 使用其能够访问的入口地址。
有多个 Bot 时，给每个 Bot 设置不同的 `CLIENT_NAME`。
使用 Docker 运行 Bot 时，按 [Bot 部署](/guide/bot-deployment)选择平台、构建镜像并启动。

如果电脑上也有本地 Bot，可以为它配置备用连接：

```dotenv
CORE_WS_URL=ws://127.0.0.1:18765/ws
CORE_FALLBACK_URLS=["ws://127.0.0.1:8765/ws"]
```

入口失联时，这个 Bot 会连接本机 Muika；入口恢复后会自动返回。备用地址只能填写该 Bot 能访问的入口地址；服务器上的 Bot 无法连接已关闭的电脑。

聊天附件会上传到当前入口，并下载到使用它的设备。每个附件最多 20 MiB。
临时文件和 Bot 事件中的二进制附件可通过这条路径保存；任务目录、完整工具输出和插件文件仍留在原设备。

## 4. 查看和切换设备

在聊天中发送：

```text
.nodes list
.nodes handoff server
.nodes handoff pc
.nodes help
```

列表会显示活动设备和可连接的设备。切换命令提交请求后，可以再发 `.nodes list` 确认当前活动设备。
目标设备需要在线并完成同步。Muika 也能查看设备和请求交接，她会收到设备变化事件，并自行决定是否回应。

切换后，她使用新设备本地的工具、插件和权限。
电脑上的文件不会因此出现在服务器上；正在执行的动作也不会移动到另一台设备。
突然中断的动作会记录失败，可能已经产生的文件或其他影响需要在原设备查看，不会自动重做。

多设备模式下创建的提醒会保存到本地日志，由当前活动设备处理；切换设备后恢复尚未处理的提醒，不会重复触发同一次提醒。重复提醒按各次到期时间继续触发。

## 断开和重新连接时会怎样

| 情况 | 你会看到什么 |
| --- | --- |
| 电脑关闭，服务器仍在线 | 服务器接管，聊天继续；电脑工具暂时不可用 |
| 入口不可连接，电脑仍运行 | 指定电脑继续本地活动；配置了本地备用地址的 Bot 可继续聊天 |
| 入口恢复 | 两边补齐经历，前台电脑保留当前感受；旧回复和旧动作不会重新发送或执行 |
| 电脑与服务器之间的网络断开 | 两边可能各自留下经历，重连时保留两段历史 |
| 电脑和服务器都关闭 | 没有运行中的 Muika，无法继续回复 |
| 聊天平台或 Bot 停止运行 | 对应渠道无法聊天，其他仍在线的 Bot 可以继续使用 |

服务器失联后，远端 Bot 无法凭空连接你的电脑。需要独立可用的本地 Bot 或其他本地接入方式，才能继续与电脑上的 Muika 对话。
服务器保存的入口日志仍是单份数据；本方案不提供服务器的自动替换或数据库集群。

入口会保存已收到的输入。Bot 尚未送达入口的消息只在内存暂存，最多 100 条；Bot 重启会丢失这些暂存消息。
发送失败会记录错误日志。MAS 不等待聊天平台的投递确认，也不自动重发历史输出。

## 用 Docker 启动服务器

仓库提供服务器示例，包含聊天入口、一个服务器 Core 和聊天机器人，三个容器共用同一镜像，直接使用项目根目录的 `.env` 作为共享配置。
先准备 `configs/models.yml`，确认项目根目录 `.env` 中已有 `MASTER_ID` 和与电脑相同的 `IPC_SECRET`：

```dotenv
MASTER_ID=你的主账号ID
IPC_SECRET=与你电脑相同的连接密钥
```

机器人的平台配置也写在 `.env` 中，按 [Bot 部署](/guide/bot-deployment)填写；OneBot 之外的适配器包用构建参数 `BOT_EXTRA_DEPENDENCIES` 追加。服务器上的 Bot 由 Compose 自动设置容器网络内的入口地址，无需手写 `CORE_WS_URL`。不需要聊天机器人时，用 `docker compose -f deploy/multi-device.compose.yml stop bot` 停止它。

然后在项目根目录执行：

```bash
docker compose --env-file .env -f deploy/multi-device.compose.yml up -d --build
docker compose -f deploy/multi-device.compose.yml logs -f
```

服务器以 Caddy 等外部反向代理收发连接时，追加站点级覆盖文件，把入口接入代理所在的网络：

```bash
docker compose --env-file .env -f deploy/multi-device.compose.yml -f deploy/multi-device.edge.yml up -d --build
```

入口仅开放在服务器的 `127.0.0.1:8765`。电脑仍按上面的 SSH 隧道或 HTTPS 方式连接。
数据保存在独立 Docker 卷中。`docker compose down` 不删除数据；不要加 `--volumes`，除非确实要清空记忆和入口记录。

该示例为 Core 设置了 190 秒退出宽限期。退出行为及单独运行容器的停止命令见 [Core 退出](/guide/bot-deployment#core-shutdown)。

## 保留旧记忆与返回单机模式

启用前，停止原 Core，备份整个 `data` 和自己的配置、模板、插件。
本地数据库会进行常规结构升级。首次连接入口时，已有记忆会自动纳入同步。

要回到单机模式，停止 Core，删除 `.env` 中的 `GATEWAY_URL`，把 Bot 的 `CORE_WS_URL` 改回本机地址，再启动。
已经同步到这台设备的经历仍在本地。多设备模式的持久提醒在单机模式中不会自动启动。

要运行启用前的旧代码，请使用启用前的备份；旧代码不保证读取新数据库结构。

## 排查连接问题

先执行 `.nodes list`，再分别查看入口、Core 和 Bot 的日志。
检查密钥是否一致、设备名称是否重复，以及 `/cores` 与 `/ws` 是否写反。
名称重复或同步协议不兼容时，入口会明确拒绝连接。
历史同步失败时，设备会暂缓接管，并逐步延长重试间隔，最长 30 秒。Bot 的错误日志会附上失败原因。
先确认各 Core 和入口使用相同代码，再查看对应 Core 的日志；处理失败原因后，设备会自动恢复同步。

使用 SSH 隧道时，检查隧道终端是否仍在运行。使用 HTTPS 时，检查证书、WebSocket 转发和附件上传限制。
只升级一台设备前，先停止相关 Core；建议所有 Core 与入口使用同一份代码，Bot 保持原有 IPC 消息格式。
