# Presentation 改善计划

## 当前问题分析

通过对 `server.py (_build_slide_prompt)` 和 `PresentationMode.component.tsx` 的完整审查，现有 Presentation 的主要问题是：

### 1. 内容形式单一

当前 Prompt 生成的是**千篇一律的 markdown**：
- `## Heading` → 标题
- `- item` → 要点
- 普通段落

**所有 Slide 看起来都一样**，没有视觉变化。

### 2. 缺乏 Slide 类型系统

真实 PPT 有丰富的 Slide 类型：

| 类型 | 作用 | 当前是否支持 |
|---|---|---|
| 🎬 **Title Slide** | 大标题+副标题，居中 | ❌ |
| 📂 **Section Divider** | 章节过渡，大色块背景 | ❌ |
| 📄 **Content Slide** | 标题+要点的标准页 | ⚠️ 唯一支持的 |
| 💬 **Quote Slide** | 大引文+出处，特殊样式 | ❌ |
| 📊 **Data Slide** | 突出数字/统计数据 | ❌ |
| ↔️ **Comparison** | 左右对比两列 | ❌ |
| ⏱ **Timeline** | 时间线流程 | ❌ |
| 👁 **Image/Visual** | 视觉为中心 | ❌ |
| 🎯 **CTA/Closing** | 总结号召行动 | ❌ |

### 3. 前端渲染简陋

当前 `renderSlideContent` 只做了最基本的 markdown→HTML 转换（h1-h3, li, blockquote, p），没有：
- 根据 slide type 有不同的布局
- 没有背景色/渐变
- 没有大数字高亮
- 没有两栏布局
- 没有图标装饰

### 4. 后端 Prompt 没有指导格式多样性

当前 Prompt 只说了"well-structured slides"和"use ## headings, bullet points"，没有说可以生成不同类型的 slide。

---

## 解决方案

### Phase 1: 后端 Prompt 改造 — 指导 Slide 类型多样性

在 `_build_slide_prompt` 中增加：

**Slide Type System** — 告诉 AI 可以生成以下类型：

```
SLIDE TYPES (choose the best type for each slide):

🎬 TITLE  
Format: ##TITLE
## [Main Title]
Subtitle text
Purpose: Opening slide, large centered heading + subtitle

📂 SECTION  
Format: ##SECTION  
## [Section Title]  
Purpose: Chapter divider, bold centered text, used between main sections

📄 CONTENT (default)  
Format: ## [Slide Title]
- Key point one
- Key point two
- Key point three
Purpose: Standard content with title and bullet points

💬 QUOTE  
Format: ##QUOTE  
> "[Inspiring or insightful quote]"
— Attribution
Purpose: Highlight a key quote

📊 DATA  
Format: ##DATA  
## [Metric Title]
**XX%** of [context]
- Supporting detail
- Supporting detail
Purpose: Emphasize a statistic or key number

↔️ COMPARE  
Format: ##COMPARE  
## [Topic]
Left: [Option A]
- Point 1
- Point 2
Right: [Option B]
- Point 1  
- Point 2  
Purpose: Side-by-side comparison

🎯 CLOSE  
Format: ##CLOSE  
## [Closing Title]
Key takeaway message
**Call to action:** [action]
Purpose: Final slide, summary + call to action
```

### Phase 2: 前端 Renderer 改造 — 根据 Slide Type 渲染不同布局

在 `renderSlideContent` 中增加 Slide Type 识别：

```typescript
const SLIDE_TYPES = {
  TITLE:   { bg: 'bg-gradient-to-br from-indigo-900 to-purple-900 text-white text-center' },
  SECTION: { bg: 'bg-gradient-to-r from-blue-600 to-blue-800 text-white text-center' },
  CONTENT: { bg: 'bg-white text-gray-900' },
  QUOTE:   { bg: 'bg-amber-50 border-l-8 border-amber-500 italic' },
  DATA:    { bg: 'bg-gradient-to-br from-emerald-50 to-teal-50' },
  COMPARE: { bg: 'bg-white grid grid-cols-2 gap-8' },
  CLOSE:   { bg: 'bg-gradient-to-br from-gray-900 to-gray-800 text-white text-center' },
};
```

渲染方式根据 type 不同：

- **TITLE** → 居中大标题，渐变背景，副标题
- **SECTION** → 居中大字，深色背景，大字幕感
- **CONTENT** → 标准标题+要点列表
- **QUOTE** → 左侧粗色条，大引号图标，引文+出处
- **DATA** → 大数字突出（用 `text-6xl font-bold text-emerald-600`），小字说明
- **COMPARE** → 两栏布局，左栏 A 右栏 B，中间分割线
- **CLOSE** → 居中总结+粗体号召行动

### Phase 3: 增加视觉增强

1. **Slide 过渡动画** — 左右滑入效果
2. **进度条改进** — 显示 slide type 图标
3. **配色方案** — 支持 Dark/Light/Colorful 三种主题切换
4. **全屏模式** — 隐藏所有控制栏，纯 slide 展示

---

## 实施路线图

| 优先级 | 模块 | 改动位置 | 工作量 |
|---|---|---|---|
| 🔴 P1 | Prompt 增加 Slide Type 系统 | `server.py: _build_slide_prompt` | 半天 |
| 🔴 P1 | 前端 Slide Type 解析 | `PresentationMode.component.tsx` | 半天 |
| 🔴 P1 | Title/Section/Content 渲染 | `PresentationMode.component.tsx` | 半天 |
| 🟡 P2 | Quote/Data/Compare/Close 渲染 | `PresentationMode.component.tsx` | 1天 |
| 🟢 P3 | 过渡动画 + 配色方案 | `PresentationMode.component.tsx` + CSS | 1天 |

---

## 核心技术要点

### Slide Type 解析逻辑

```
Parse each slide's display text:
  Line 1 starts with ##TITLE  → type = TITLE
  Line 1 starts with ##SECTION → type = SECTION
  Line 1 starts with ##QUOTE   → type = QUOTE
  Line 1 starts with ##DATA    → type = DATA
  Line 1 starts with ##COMPARE → type = COMPARE
  Line 1 starts with ##CLOSE   → type = CLOSE
  Otherwise → type = CONTENT
```

### 渲染示例 — TITLE slide

```tsx
case 'TITLE':
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-indigo-900 to-purple-900 text-white p-12">
      <h1 className="text-5xl font-bold text-center mb-4">{title}</h1>
      <p className="text-xl text-indigo-200 text-center">{subtitle}</p>
    </div>
  );
```

### 渲染示例 — DATA slide

```tsx
case 'DATA':
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-emerald-50 to-teal-50 p-12">
      <h2 className="text-2xl font-semibold text-gray-700 mb-6">{title}</h2>
      <span className="text-7xl font-bold text-emerald-600 mb-4">{metric}</span>
      <p className="text-lg text-gray-600 text-center">{context}</p>
      <ul className="mt-6 space-y-2">{bullets}</ul>
    </div>
  );
```

### 后端 Prompt 关键改动

新增指令到 `_build_slide_prompt`：
```
- Choose the BEST SLIDE TYPE for each slide's purpose:
  TITLE, SECTION, CONTENT, QUOTE, DATA, COMPARE, or CLOSE
- Start each slide with ##TYPE to indicate its type
- Vary the types across slides — don't use CONTENT for every slide
```

---

## 预期效果

改善后，Presentation 将：
1. ✅ 不同 Slide 有不同视觉风格（标题页、章节过渡、数据页、引文页等）
2. ✅ 内容不再全是千篇一律的标题+要点
3. ✅ 前端渲染更丰富（渐变背景、大字、两栏、引用样式）
4. ✅ 演示更有节奏感（标题→内容→数据→引文→内容→总结）
