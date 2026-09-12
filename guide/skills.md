# 技能系统

技能（Skill）是 Muika 的"能力包"——一份包含完整指令的 Markdown 文件，告诉 Agent **如何完成某项特定任务**。技能让 Muika-After-Story 的能力可以无代码扩展。

## 快速理解

- **技能 ≠ 工具**：工具（`@on_function_call`）提供原子操作（读文件、发通知）；技能提供完整的任务执行流程指引
- **技能 = 知识注入**：技能内容被注入到 Agent 的 System Prompt 中，教会它"如何做"
- **懒加载**：技能不会全部预载。先注入摘要列表，当任务涉及某技能时，通过 `load_skill` 工具按需加载完整内容

## 技能目录

| 目录 | 是否扫描 | 说明 |
|------|---------|------|
| `configs/skills/` | **始终扫描** | 内置技能目录（随项目分发） |
| `~/.agents/skills/` | 可选（需 `LOAD_USER_SKILLS=true`） | 用户级技能目录 |
| `~/.claude/skills/` | 可选（需 `LOAD_USER_SKILLS=true`） | Claude Code 技能兼容目录 |

## SKILL.md 格式

每个技能是一个目录，目录中必须包含 `SKILL.md` 文件：

```markdown
---
name: my-skill
description: 一句话描述这个技能做什么
---

# 技能标题

## 触发条件
何时应该使用这个技能...

## 执行步骤
1. 第一步...
2. 第二步...

## 注意事项
- 需要什么权限
- 有什么限制
```

### 元数据字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 技能唯一标识（kebab-case） |
| `description` | 是 | 一句话描述，用于技能列表摘要 |

## 工作原理

### 1. 启动扫描

`SkillManager` 在 Core 启动时扫描所有技能目录，解析每个 `SKILL.md` 的 YAML 前置元数据：

- 验证 `name` 和 `description` 字段
- 使用 `watchdog` 监听文件变化，支持热更新
- 构建技能摘要列表

### 2. 注入 Agent Prompt

技能摘要通过 `render_prompt_section()` 注入到 Agent 的 System Prompt 中：

```
## Available Skills
- my-skill: 一句话描述这个技能做什么
- another-skill: ...
```

### 3. 按需加载

当 Agent 判断某个任务需要某技能时，它会调用 `load_skill` 工具读取完整的 `SKILL.md` 内容，获得详细的执行指引。
