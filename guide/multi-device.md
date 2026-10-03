# 多设备部署

让 Muika 在电脑和服务器之间延续同一段对话。电脑关闭后，服务器上的 Muika 会继续陪你聊天。
电脑重新连接时，她保留已有记忆、任务和提醒。电脑无需公网 IP。

如果只在一台电脑上使用 MAS，可以继续使用[单机部署](/guide/getting-started)，无需启用此功能。

## 准备什么

推荐使用一台 Linux 服务器和一台日常使用的电脑：

| 位置 | 运行内容 | 用途 |
| --- | --- | --- |
| 服务器 | MAS 服务、聊天机器人 | 保存记忆，在电脑关闭后继续聊天 |
| 电脑 | MAS 设备程序 | 让 Muika 使用电脑上的文件和程序，也可以承担对话工作 |

两台机器均需安装 Python 3.10～3.13。本指南使用 Python 3.12 和虚拟环境。
服务器需要可连接的地址，以及该地址对应的 TLS 证书和私钥。
下面用 `mas.example.com` 作为示例，请替换成你的域名。

聊天机器人负责把聊天平台上的消息交给 Muika。
**要在电脑关机后继续聊天，机器人及其连接聊天平台所需的程序也必须运行在服务器上。**
已有 QQ、Telegram 等接入方式可以继续使用；每个机器人单独配对。

::: warning 服务器仍需保持在线
本方案使用一台服务器保存数据。服务器停机或无法连接时，Muika 暂时不能回复。
仍在运行的机器人会保存收到的消息，恢复连接后再送达。
聊天平台本身的故障、账号下线，以及机器人也已关闭的情况，不在此保证内。
:::

## 1. 安装服务器程序

在服务器上执行：

```bash
git clone https://github.com/Moemu/Muika-After-Story.git
cd Muika-After-Story
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e '.[standard]'
```

后续服务器命令都在这个项目目录和虚拟环境中执行。
按[模型配置](/guide/model)创建 `configs/models.yml`，填入模型名称和 API Key。
如需使用自定义人格，在启动前准备好 `.env` 和 `templates`，参见[人设定制](/guide/persona)。

创建服务器配置。以下证书路径同样需要替换：

```bash
python -m muika.node init-server ./data/node-server \
  --host 0.0.0.0 \
  --address wss://mas.example.com:8766/node/ws \
  --certificate /path/to/fullchain.pem \
  --private-key /path/to/private-key.pem
```

允许电脑访问服务器的 TCP 8766 端口。运行 MAS 的用户需要能够读取证书和私钥。
如果已有 HTTPS 反向代理，可以省略 `--host` 和证书参数。
此时将 `/node/` 转发到 `127.0.0.1:8766`，并启用 WebSocket 转发；连接地址改为代理提供的地址。

**已有单机记忆需要保留时，先完成下方的[导入旧数据](#导入旧数据)，再启动服务。**
全新部署可以直接启动：

```bash
python -m muika.node serve ./data/node-server/server.json
```

看到 `State service ready` 表示服务器已开始监听。请保持程序运行，另开终端执行配对命令。
服务器也会启动一个负责对话的 Muika 程序。

需要开机自动启动时，可以使用仓库中的
[systemd 示例](https://github.com/Moemu/Muika-After-Story/blob/main/deploy/mas-node.service)。
请把用户、项目目录、Python 路径和数据目录改成实际值。
证书更新后需要重启服务。

## 2. 连接你的电脑

先在服务器上生成配对码：

```bash
python -m muika.node pair ./data/node-server/server.json pc --role core --priority 10
```

`pc` 是电脑的名称，可以自行修改。配对码在 10 分钟内有效，只能使用一次。
请通过你信任的方式把配对码发送到电脑。

在 Windows 电脑上安装并连接：

```powershell
git clone https://github.com/Moemu/Muika-After-Story.git
cd Muika-After-Story
py -3.12 -m venv .venv
.venv/Scripts/Activate.ps1
pip install -e '.[standard]'
python -m muika.node join wss://mas.example.com:8766/node/ws 配对码 ./data/node-pc
python -m muika.node run ./data/node-pc/node.json
```

将命令中的 `配对码` 替换为服务器输出的代码。Linux 电脑也使用 `join` 和 `run`，安装方式与服务器相同。
以后启动电脑程序时，只需在该目录执行最后一条命令。

首次连接服务器时无需复制模型 API Key。模型配置和人格模板会从服务器提供给电脑。
电脑上的文件、程序和工具权限仍需在电脑本地配置。

电脑上线不会立即打断服务器正在进行的对话。要让她转到电脑工作，在聊天中发送：

```text
.nodes handoff pc
```

配对完成后，电脑和服务器都能承担对话工作。
活动中的电脑退出或关机后，服务器会自动恢复对话，期间可能需要短暂等待。
恢复需要重新读取记忆和任务，不保证立即回复。

## 3. 连接聊天机器人

以仓库自带的 NoneBot 机器人为例。
先按[QQ 部署说明](https://github.com/Moemu/Muika-After-Story/blob/main/deploy/README.md)准备 QQ 接入，
或保留已有聊天平台配置。机器人可以和 MAS 服务运行在同一台服务器上。

在 MAS 服务器上生成独立的机器人配对码：

```bash
python -m muika.node pair ./data/node-server/server.json qq --role bot
```

在机器人的项目目录中执行：

```bash
pip install -e '.[nonebot]'
python -m muika.node join wss://mas.example.com:8766/node/ws 配对码 ./data/node-qq
```

在机器人使用的 `.env` 中加入下面的配置，路径请替换成配对结果中的绝对路径：

```ini
NODE_PROFILE=/path/to/Muika-After-Story/data/node-qq/node.json
```

保留你的用户 ID、聊天平台地址和适配器配置，然后启动原有机器人：

```bash
python bot.py
```

设置 `NODE_PROFILE` 后，机器人从配对文件读取 MAS 地址和凭据。
原来的 `CORE_WS_URL` 和 `IPC_SECRET` 不再用于这条连接。
机器人运行在容器中时，请在容器内配对，并把配对目录挂载为持久目录。
目录内既有连接凭据，也有尚未送达的消息；请保留它。

其他机器人需要支持 MAS 的多设备连接协议。旧版适配插件只支持单机连接时，需要先更新插件。
添加第二个机器人时，请使用不同名称重新执行配对，例如 `telegram`。

## 4. 验证电脑关机后仍可聊天

1. 从聊天平台发送一条消息，确认 Muika 能回复。
2. 发送 `.nodes`，确认列表中能看到服务器和电脑。
3. 发送 `.nodes handoff pc`，等待电脑成为活动设备，再确认一次回复。
4. 关闭电脑上的 MAS 程序，等待服务器接管，再发送一条消息。
5. 重新启动电脑程序，确认你们之前的对话仍然延续。

服务器和聊天机器人需要全程保持运行。
如果她能在第 4 步回复，电脑关闭后的聊天路径就已打通。

## 选择工作设备

| 聊天命令 | 作用 |
| --- | --- |
| `.nodes` | 查看已连接的设备和 Muika 当前所在位置 |
| `.nodes handoff pc` | 请求把对话工作交给电脑 |
| `.nodes handoff server` | 请求把对话工作交给服务器 |
| `.nodes select pc` | 让后续新行动任务使用电脑上的工具 |

交接会等待当前回复或动作保存完成。请求交接不代表已经完成，请通过 `.nodes` 确认结果。
你也可以自然地向 Muika 提出请求；她可以选择设备，并感知设备上线或离线。

已有任务保留原工作设备。电脑离线后，需要电脑上文件或程序的任务可能等待它恢复。
服务器可以继续聊天，但不会因此获得电脑桌面、目录或 GPU 的访问能力。
只需执行工具的额外设备，可以使用 `--role executor` 配对，再用 `join` 和 `run` 启动。

## 导入旧数据

先停止原单机 MAS，在原项目目录执行：

```bash
python -m muika.node export ./data/muika.db ./mas-snapshot.zip
```

把 `mas-snapshot.zip` 复制到服务器。在服务器配置创建后、第一次启动服务前导入：

```bash
python -m muika.node import ./mas-snapshot.zip ./data/node-server/server.json --accept-rollback-window
```

命令会核对记忆和文件，并保存 `import-report.json`。导入完成后，再启动服务器。
如果提示缺少附件，请找回原文件后重新导出。目标已有数据库时，导入会拒绝覆盖。

::: warning 先保留原数据
原单机实例应保持停用，原数据库和附件应保留为备份。
归档包含私密记忆和模型配置，请妥善保存。
如果以后回到原版本，原备份无法包含迁移后产生的新对话。
命令中的 `--accept-rollback-window` 表示你已理解这一回退限制。
:::

导入后沿用原部署的日历时区。Windows 服务器的系统时区需要与导入数据一致；Linux 服务器会自动应用保存的时区。
直接升级单机 MAS 无需导入，也无需另外安装数据库服务。

## 日常维护和排查

**无法连接服务器：** 确认服务在运行、域名与证书相符、端口允许访问。
连接地址应以 `wss://` 开头。自签名证书需要在初始化和配对时通过 `--ca-file` 指定信任文件。

**查看连接状态：** 在已配对设备的目录执行：

```bash
python -m muika.node status ./data/node-pc/node.json
```

**服务器离线：** 先恢复原服务和数据目录。机器人保留的消息会在连接恢复后继续发送。
不要用一个空数据库替代原记忆。定期备份整个服务器数据目录，备份前停止服务。

**修改模型或人格配置：** 首次启动后，服务使用已保存的配置。
编辑服务器项目中的 `.env`、`configs/models.yml` 或模板后，先停止服务，再发布并重启：

```bash
python -m muika.node publish-config ./data/node-server/server.json
python -m muika.node serve ./data/node-server/server.json
```

其他电脑上的 MAS 程序也需要重启才能使用新配置。
需要在多台设备上使用的项目技能，放在服务器的 `configs/skills` 中。
本地安装的第三方插件不会自动复制；插件作者需要支持多设备模式后，才能在设备配置中启用。

**升级：** 更新服务器、对话设备和工具设备上的 MAS，然后重启。
版本不兼容的设备会被禁止接管或执行。机器人是否需要更新，取决于连接协议是否变化。

**移除设备：** 在服务器上执行，设备名请替换成实际名称：

```bash
python -m muika.node revoke ./data/node-server/server.json pc
```

**消息投递结果不明：** 发送过程中连接断开时，Muika 可能无法确定平台是否已经收到消息。
系统会暂停这条消息的重发。先停止对应机器人，核对聊天记录，再使用日志中的消息 ID：

```bash
python -m muika.node resolve-delivery ./data/node-qq/node.json 消息ID --outcome delivered
```

确认没有发出时，把 `delivered` 改为 `not-delivered`。核对后重新启动机器人。
行动任务也会在动作结果不明时暂停，以免重复发送或重复修改文件。

## 使用 Docker 运行服务器

仓库提供[服务器镜像](https://github.com/Moemu/Muika-After-Story/blob/main/deploy/node.Dockerfile)
和 [Compose 配置](https://github.com/Moemu/Muika-After-Story/blob/main/deploy/node-compose.yml)。
此预设用于 Linux 服务器，并使用服务器已有的 HTTPS 反向代理。
准备好项目 `.env`、`configs` 和 `templates` 目录后，在项目根目录执行：

```bash
docker compose -f deploy/node-compose.yml build
docker compose -f deploy/node-compose.yml run --rm mas init-server /data --address wss://mas.example.com/node/ws
docker compose -f deploy/node-compose.yml up -d
docker compose -f deploy/node-compose.yml exec mas python -m muika.node pair /data/server.json pc --role core --priority 10
```

代理需将 `/node/` 转发到服务器的 `127.0.0.1:8766`，并支持 WebSocket。
数据保存在项目的 `data/node-server` 中。容器中的 Muika 只能使用容器内实际可用的文件和工具。
