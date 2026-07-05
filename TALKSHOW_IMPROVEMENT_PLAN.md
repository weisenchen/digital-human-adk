# Talk Show 改善计划

## 当前问题分析

通过对 `TalkShowMode.component.tsx`、`TalkShowSetup.component.tsx`、`server.py (/api/talk-show/ask)` 和 `adk-assistant.service.ts` 的完整审查，现有关键问题如下：

---

## Phase 1: Prompt 工程优化（最高优先级，直接影响效果）

### 1.1 主持人不认识"Show Structure" — 改结构化 Prompt

**问题：** 当前 prompt 只定义了"你是谁+风格+规则"，没有告诉主持人一个 Talk Show 应该有什么**段落结构**。

**现状：**
```
You are a talk show host named "{host_name}". ...
- Ask questions, follow up, and keep the conversation flowing.
```

**改进：** 增加 **Show Script 框架**，让主持人按照真实脱口秀的结构走：

**Show Segment**
1. 🎬 **Opening Monologue** — Host greets audience, sets up topic
2. 👋 **Guest Introduction** — Introduce guest (title, background), warm welcome
3. ☕ **Warm-up Chat** — 2-3 easy questions to relax the guest
4. 🎯 **Main Discussion** — Deep dive into background materials, key questions
5. 🔥 **Hot Takes** — Host shares perspective, challenges guest
6. 🎬 **Closing / Takeaways** — Thank guest, summarize key insights, sign-off

### 1.2 主持人缺乏"背景材料运用策略"

**问题：** 背景材料只是扔进 prompt，没说怎么用。主持人经常忽略或照读。

**改进：** 在 prompt 中增加使用规则：
```
HOW TO USE BACKGROUND MATERIALS:
- Extract 2-3 KEY POINTS from the materials to discuss
- Ask questions that challenge or explore these points
- Reference specific facts from materials ("As mentioned in the article...")
- When guest says something new, connect it back to the materials
```

### 1.3 主持人缺乏"情绪动态"和"秀场感"

**问题：** 所有回复语气一致，像平淡访谈。没有真实 Talk Show 的情绪起伏。

**改进：** 在 prompt 中增加情绪标注：
```
EMOTIONAL DYNAMICS (vary throughout the show):
- Opening: Energetic, welcoming, excited about the topic
- During discussion: Curious, thoughtful, occasionally surprised
- When guest shares insight: Show genuine interest ("That's fascinating!")
- When disagreeing: Respectful but probing
- Closing: Warm, grateful, looking back at highlights

SHOWMANSHIP:
- Use occasional audience-focused remarks ("Isn't that interesting, folks?")
- Build anticipation ("Now this is where it gets really interesting...")
- Use natural talk show phrases ("I want to pick up on something you said...")
```

### 1.4 缺乏"后续问题"生成能力

**问题：** 主持人对 guest 的回答经常只是"谢谢，下一个问题"，而不做深层追问。

**改进：** prompt 增加：
```
FOLLOW-UP STRATEGY:
- After guest answers, ask ONE follow-up before moving on
- A good follow-up: digs deeper into something the guest JUST said
- Use phrases like: "You mentioned [X], can you elaborate on that?"
- Only move to next question when you've explored the current thread
```

### 1.5 缺少开场白（Opening Monologue）的独立设计

**问题：** 开场只是"在topic下欢迎guest"，没有 show-branded 开场。

**改进：** 修改 opening prompt 为：
```
OPENING SCRIPT:
1. Greet the audience ("Welcome to the show!")
2. Introduce yourself and today's topic with energy
3. Tease what's coming ("We have a fantastic conversation ahead")
4. Introduce the guest with their background/achievements
5. Welcome the guest on stage
6. Start with a warm, easy ice-breaker question
```

---

## Phase 2: 前端交互优化

### 2.1 自动播放主持人 TTS

**问题：** 主持人消息出现后不会自动播放语音。

**修复：** 在收到 host 回复后自动调用 `speakHostResponse()`：
```typescript
// TalkShowMode.component.tsx - after setMessages with new host msg
useEffect(() => {
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role === 'host' && !isSpeaking && !isWaiting && voice) {
    speakHostResponse(lastMsg.content, voice);
  }
}, [messages]);
```

### 2.2 增加 guest 输入建议（Suggested Responses）

**问题：** 用户作为 guest 不知道说什么好，对话容易断。

**改进：** 在输入框上方显示 2-3 个建议回复让用户选择：
- "Could you tell us more about your background?"
- "What's your take on the future of [topic]?"
- "How did you first get interested in [topic]?"

### 2.3 改进暂停体验

**问题：** 暂停时只是禁用输入，没有什么可看的。

**改进：** 暂停页面显示当前话题摘要、已讨论的亮点、可以加"Continue where we left off" 的 summary prompt 在 resume 时提供给主持人。

### 2.4 添加节目时长/进度指示器

**问题：** 用户不知道节目进行了多久、到什么阶段。

**改进：** 在顶栏加一个简单的进度指示：
```
[Opening ⏤⏤⏤⏤⏤⏤⏤⏤ Warm-up ⏤⏤⏤⏤⏤ Main ⏤⏤⏤⏤⏤ Closing]
                                     ● You are here
```

---

## Phase 3: 后端架构优化

### 3.1 主持人回复后自动生成 Guest Suggested Responses

新增 endpoint `POST /api/talk-show/suggest`，在主持人回复后自动生成 3 条 guest 可能的回复建议。

### 3.2 Talk Show Session 持久化

当前 session 用 `"talk_show_session"` 硬编码，多轮对话会互相覆盖。改成基于 uuid 的 session ID。

### 3.3 增加 Show Summary / Transcript 导出

在结束节目时，自动生成整场对话的摘要和 transcript。

---

## 实施路线图

| 优先级 | 模块 | 改动位置 | 工作量 |
|---|---|---|---|
| 🔴 P0 | 结构化 Prompt | `server.py` | 1天 |
| 🔴 P0 | 情绪动态+Showmanship | `server.py` | 半天 |
| 🔴 P0 | 背景材料策略 | `server.py` | 半天 |
| 🟡 P1 | 自动播放 TTS | `TalkShowMode.component.tsx` | 半天 |
| 🟡 P1 | Guest 建议回复 | `TalkShowMode.component.tsx` + server | 1天 |
| 🟢 P2 | 进度指示器 | `TalkShowMode.component.tsx` | 半天 |
| 🟢 P2 | 暂停优化 | `TalkShowMode.component.tsx` | 半天 |
| 🔵 P3 | Session 持久化 | `server.py` | 半天 |
| 🔵 P3 | Transcript 导出 | `server.py` + frontend | 1天 |

---

## 核心技术要点

### 结构化 Prompt 示例（Phase 1 核心）

```
You are {host_name}, hosting a talk show about {topic}.
Your guest today is {guest_name}.

## SHOW STRUCTURE
[Opening Monologue] → [Guest Intro] → [Warm-up] → [Main Discussion] → [Closing]

## CURRENT SEGMENT
{segment_name}

## HOST STYLE
{personality_description}

## BACKGROUND MATERIALS
{background}

## RULES
- Follow the CURRENT SEGMENT above. Don't skip ahead.
- After guest answers, ask ONE follow-up question before the next topic.
- Vary your tone: excited opening, curious during discussion, warm at closing.
- Use showmanship: audience remarks, building anticipation, natural transitions.
- Reference background materials as conversation anchors.
```

### 后续问题生成

```
FOLLOW-UP PATTERNS:
1. Dig deeper: "You mentioned [X], what led you to that conclusion?"
2. Challenge: "That's interesting, but some would argue [opposing view]..."
3. Connect: "How does [X] relate to what you said earlier about [Y]?"
4. Personal: "What was your personal experience with [X]?"
```

---

## 预期效果

改善后，Talk Show 将：
1. ✅ 有真实的 Show Structure（开场→暖场→深度讨论→收尾）
2. ✅ 主持人有情绪起伏和 Showmanship
3. ✅ 背景材料被自然引用到对话中
4. ✅ 主持人会追问、连接话题
5. ✅ 语音自动播放
6. ✅ 用户有建议回复可选，对话更顺畅
7. ✅ 节目进度可见
