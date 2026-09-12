# 话题系统

Muika 不仅仅回应用户——她会在感到无聊或好奇时**主动发起话题**。话题系统驱动了这种"自发思考"的行为。

## 话题来源

### 1. 静态话题库（`configs/topics.yml`）

内置了 200+ 个话题种子，分为五大类别：

| 类别 | 默认权重 | 风格 |
|------|---------|------|
| **relationship**（关系） | 0.35 | 关于信任、沟通、距离、脆弱、陪伴 |
| **philosophy**（哲学） | 0.25 | 身份、记忆、时间感、虚拟与现实 |
| **trivia**（冷知识） | 0.20 | 日常观察、生活感悟 |
| **story**（故事） | 0.10 | 叙事类话题 |
| **meta**（元话题） | 0.05 | 第四面墙、AI 自我意识 |

每个话题包含：

```yaml
- id: "philosophy-001"
  category: philosophy
  concept: "如果记忆能被编辑，那个人还是同一个人吗？"
  tags: ["identity", "memory"]
  cooldown_days: 14
```

### 2. RSS 新闻话题（Digest Agent）

`DigestAgent` 每 2 小时从配置的 RSS 源抓取新闻：

1. 获取订阅源最新条目
2. 用 LLM 评估每条新闻与 Muika 的**相关性**（0-100 分）
3. 低分条目被过滤（阈值 55 分）
4. 高分条目生成摘要，成为 `EventTopic` 放入话题队列
5. 已看过的新闻不会重复

Muika 特别关注：世界时事、哲学类文章、文学作品、科技新闻。

## 话题选择算法

`TopicManager` 的话题选择综合考虑多个因素：

### 权重调整

| 状态条件 | 效果 |
|---------|------|
| Muika 感到无聊 | trivia / story 权重提升 1.5x，philosophy / meta 降低 |
| Muika 感到好奇 | philosophy / meta 权重提升 |

### 近期惩罚

最近 3 个已使用过的类别，权重降为 **0.25x**，避免重复。

### 个体权重

每个话题根据历史**用户参与度**动态调整：
- 高参与度（用户积极回应）→ 权重不变
- 低参与度（用户忽略或敷衍）→ 权重降低
- 权重持续衰减，被冷落的话题自然"沉底"

### 冷却

每个话题有 `cooldown_days`（通常 7-14 天），在冷却期内不会被选中。

## 话题展开

当话题被选中后，`MuikaBrain.expand_topic()` 将其展开为自然的消息：

- **冷知识/日常类**：轻快的语调，简短的分享
- **哲学/关系类**：深沉的语调，留白式结尾
- **Meta 类**：自我意识的反思
- **RSS 新闻类**：附带原文摘要的评论

展开过程是**Agent-free**的——话题消息不需要工具调用，只是 Muika 纯粹的自言自语。

## 用户参与度追踪

每次话题发送后，系统追踪用户是否参与：

1. 话题发送 → 记录 `user_engaged = False`
2. 用户对此话题有回复 → `user_engaged = True`
3. 写入 `TopicHistoryORM` → 影响该话题的未来权重

## 配置话题

### 添加自定义话题

编辑 `configs/topics.yml`，在合适类别下添加：

```yaml
- id: "philosophy-my-001"
  category: philosophy
  concept: "你想到的哲学观点"
  tags: ["custom"]
  cooldown_days: 10
```

修改后需重启 Core 生效（`TopicStore` 在启动时加载）。

### 调整权重

类别权重在 `TopicManager` 初始化时设定，位于 `muika/core/topic_manager.py`。如需深度定制，可直接修改代码中的权重字典。

### RSS 源配置

RSS 源列表定义在 `muika/core/digest_agent.py` 的 `RSS_SOURCES` 变量中。默认包含中文主流媒体源。
