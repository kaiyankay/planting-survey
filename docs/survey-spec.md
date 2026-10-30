# Planting Survey — 最终题目与研究逻辑

Oct 29, 2026 · @kay

## 背景与目标

这份问卷要同时服务两件事：为 Planting Intelligence 的本地种植知识库收集可直接使用的数据，以及画出受访者现在选植物的 as-is 工作流。每一道题都必须能指向其中一个具体决定，否则删除。

**项目背景**：ARCH 540 Assignment 2，项目名 Planting Intelligence。目标是一个可扩展的 Metro Vancouver 本地种植知识库（JSON/Excel 一类结构），AI 负责收集、组织、结构化和检索种植知识；教授建议先做约 10 种植物的概念验证，证明知识组织、AI 抽取、语义检索和扩展机制可行。预期受访者少于 20 人，以 MLA 学生为主，另有少量其他专业学生、执业者和教师。

**原草稿的主要问题**：

- 选项太多（约 95 个），多数题是“勾选 3 个”的态度题，n<20 时频数没有统计意义，又没有留下受访者的原话
- Q3/Q4/Q7 三题都在问“哪些属性重要”，互相重叠；Q7 的 “Depends on the project” 是诱答项，会吞掉数据
- Q2 单选但选项不互斥（学术 / 职业 / 个人经验可以同时为真），且分支逻辑只认 none
- 几乎没有开放题，而知识库最需要的恰恰是人们描述植物和种植的原话、真人写的植物笔记
- 没有任何一题能画出工作流（在哪一步选植物、怎么判断、知识最后去了哪）
- 完全没问“信任”：什么样的来源或展示方式让人敢用 AI 给的植物信息

**新版的设计原则**：问卷尚未发出，没有历史数据需要兼容，题目、id 和存储结构都从零设计。减少选项，增加带示例的短开放题；每题后面能写出“这题决定数据库的 \_\_\_ / 工作流图的 \_\_\_ 节点”；把问卷当定性访谈的替代品，而不是统计工具。

## 最终题目全文

问卷标题保持 *How you work with plants*。全卷统一用词：project（含 studio 和自家花园）、note（个人经验笔记）、plant list。

**Intro**

> We’re building a plant knowledge database for Metro Vancouver and want to understand how people actually choose plants today. About 7 minutes, anonymous. Studio projects and your own garden both count as experience.

### A. About you

**A1.** Which describe you? *(choose all that apply)*

- MLA student
- Student in a related field (architecture, planning, horticulture, forestry…)
- Landscape designer or landscape architect
- Instructor or researcher
- Other \_\_\_ *(fixed at end)*

**A2.** Your planting experience *(choose all that apply)*

- Studio or academic projects
- Professional projects
- Personal gardening
- None yet *(exclusive; selecting it skips B1, C, F)*

### B. What you need to know

**B1.** When you shortlist a plant, how does each attribute enter your decision?

Columns: **Must pass** (I exclude plants that fail) · **Compared later** (matters when choosing between candidates) · **Rarely look at it**

Rows: Hardiness · Light · Water and drainage · Mature height · Mature spread · Time to reach the intended size · Seasonal appearance · Maintenance needs · Native or ecological value · Invasive or problematic status

**B2.** Which have you tried to find and couldn’t, or didn’t trust? *(choose all that apply, shuffle)*

- Real mature size under local conditions
- Long-term performance and maintenance
- How it looks at different ages and seasons
- How it behaves alongside other plants
- Local availability and cost
- Conflicting information between sources
- I haven’t looked for plant information yet *(exclusive, fixed)*

**B3.** *(optional, short text)* Briefly, one specific thing about a plant you wanted to know and couldn’t find.

### C. How you work now *(skipped when A2 = None)*

**C1.** In a typical project, when do you actually settle on plant species? *(single)*

- During concept design
- During design development
- When preparing the planting plan
- It keeps changing, no clear moment

**C2.** Where do you look when choosing plants? *(choose up to 3, shuffle)*

- Online plant databases
- Books and manuals
- Municipal or regional plant lists
- Software plant libraries (Landmark, Land F/X…)
- Colleagues or instructors
- My own past projects
- General web search
- AI chat tools

**C3.** *(free text, required)* Think of the last time you chose plants for a design or your own garden. Tell us how it went, in a few sentences. Mention where you started, what you checked, anything you dropped and why, and where the final list ended up.

Example shown in grey above the box, collapsible, labelled *Example (yours can be very different)*:

> I started from a planting plan the studio gave us as precedent, then checked each plant on Missouri Botanical Garden for size and hardiness. I dropped two because they’d get too tall for the overhead wires. The final list went into a Rhino layer and an Excel schedule, which I still have but haven’t opened since.

### D. How you’d ask

**D1.** *(optional)* Before you know which plants you’ll use, write 3–5 words or phrases you’d use to describe the planting you want.

**D2.** *(required)* If a plant database understood plain language, write one search you would actually type.

### E. Trusting knowledge from others

**E1.** When reading someone else’s note about a plant, which details do you need before trusting it for your own project? *(choose all that apply, shuffle)*

- Location
- Site conditions
- Plant age or years since planting
- Season observed
- Maintenance it received
- Who wrote it and their experience

**E2.** If an AI tool suggested a plant, what would make you take it seriously? *(choose 2, shuffle)*

- It shows its sources
- It shows a local project using the plant
- It shows someone’s first-hand experience
- It explains its reasoning
- Nothing, I’d verify it myself anyway *(exclusive, fixed)*

### F. Your plants *(skipped when A2 = None)*

**F1.** Name 3–5 plants you’d consider for Metro Vancouver. Common or scientific names are fine.

Each row: *Plant name* (text) · *Role* (dropdown: Tree / Shrub / Perennial or grass / Groundcover / Not sure) · *Why, in one line* (optional text)

Escape: *I haven’t selected plants for a design in this region yet* (exclusive; F2 then shows only its not-applicable choice)

**F2.** *(required, 300 chars)* Pick one plant from your list and write the note you’d leave for a colleague: where you used or saw it, how it performed, and anything you’d warn them about.

**Closing**: Thank you. Your answers have been saved.

### 必填与跳转规则

- 必填：A1、A2、B1、B2、C1、C2、C3、D2、E1、E2、F1（至少 3 个不同植物名 + 角色）、F2
- 可选：B3、D1、F1 的理由栏
- A2 只选 None → 跳过 B1、C 节、F 节；其余题照答，B2 可选 exclusive 出口
- A2 含 Personal gardening 但不含 studio / professional → 全部照答，C3 和 F1 的措辞已覆盖自家花园

## 研究逻辑：每题的去向

每一题都对应数据库的一个设计决定，或 as-is 工作流图的一个节点。两边都不占的题已经删掉。

| 题 | 建库决定 | 工作流节点 | 数据形态 |
| --- | --- | --- | --- |
| A1, A2 | 分组变量，用于比较学生 / 执业者 / 无经验者的差异 | — | 分类 |
| B1 | 每个属性字段是 hard filter（must pass）还是 ranking 因子（compared later）；决定检索逻辑和 schema 中字段的优先级 | 判断节点（自述版） | 10 行 × 3 列频数 |
| B2 | 现有资料的缺口，即数据库最该填的字段；conflicting information 一项直接支撑 AI 抽取环节的必要性 | — | 多选频数 |
| B3 | 缺口的真实案例，写进 proposal 作论据 | — | 短文本 |
| C1 | 工具该插入流程的哪一步（概念 / 深化 / 施工图） | 触发点 | 单选 |
| C2 | 现有信息入口；数据库要与哪些来源互补或替代 | 查找节点 | 多选频数 |
| C3 | 第三要素“dropped and why”验证 B1 的 must pass 是否真实；第四要素“ended up in”揭示知识循环的断点，支撑个人知识层 | 四个节点的真实版本：起点、查找、判断、沉淀 | 叙述文本，手动按四节点编码 |
| D1 | 氛围词汇表，语义层要把这些词映射到属性 | — | 词汇列表 |
| D2 | 语义检索的测试 query 集；也看公众用户（A2 = None）和设计者的提问方式差异 | — | 查询句 |
| E1 | 个人笔记的 metadata schema（location、site、age、season、maintenance、author） | — | 多选频数 |
| E2 | provenance 字段和 AI 输出的展示方式（来源、本地案例、第一手经验、推理） | — | 多选频数 |
| F1 | 10 种原型植物的候选池；角色下拉保证乔 / 灌 / 草 / 地被都有覆盖；理由栏是半结构化的偏好数据 | — | 植物名 + 角色 + 短句 |
| F2 | AI 知识抽取的测试样本（从自然语言笔记抽出 site、performance、warning 三类字段）；同时是原型库的种子内容 | — | 2–4 句文本 |

**几组题之间的对照关系**

- B1（自述怎么判断）对照 C3 第三要素（实际怎么排除）：两者不一致的地方是 proposal 里最有价值的发现，说明判断环节是隐性的，正是 AI 可以显式化的地方
- B2（查不到什么）对照 C2（去哪查）：哪些来源覆盖不到哪些缺口
- D2 对照 A2：无经验者和设计者写的查询句差异，决定自然语言接口要兼容的两种语气
- E1 对照 F2：人们要求别人的笔记带哪些上下文，自己写的笔记是否真的带了这些上下文

**为什么用开放题而不是更多选择题**：n<20 时任何“勾选 3 个”的频数差异都在噪声范围内。这个阶段需要的是词汇、查询句、植物笔记这些原始材料，它们既是 proposal 的论据，又是 12 月原型要处理的输入。十几份开放回答的手动编码工作量可控。

## 实现说明（给 agent）

仓库 `kaiyankay/planting-survey`，Vite + React + TypeScript。问卷尚未发出，仓库里没有任何真实回答，所以**不需要兼容旧版本**：把 `src/questions.ts` 里的题目整个替换，旧的 id、kind、版本注释和开发者模式里读旧版本的逻辑全部删掉，从零写。

**版本与 id**

- `QUESTIONS_VERSION = 1`，`KNOWN_VERSIONS = [1]`；文件顶部注释只保留“id 是存储键，页面题号按位置生成”这一段，删除所有 Version 2–5 的历史说明
- 存储用的 question id 直接用本文档的编号：`a1 a2 b1 b2 b3 c1 c2 c3 d1 d2 e1 e2 f1 f2`，option key 用本文档每个选项的小写下划线形式（如 `must_pass`、`software_libraries`、`none`）
- 删除 `NO_EXPERIENCE`、`noExperienceOnly`、`textlist`、原三列以上的 `grid` 等 v5 遗留结构；只保留下面列出的 kind

**需要的 kind**

| kind | 用在 | 结构 |
| --- | --- | --- |
| checkbox | a1 a2 b2 c2 e1 e2 | 现有实现；保留 exclusive / other / fixed / shuffle / max |
| single | c1 | 现有实现 |
| grid3 | b1 | 固定三列 key：`must_pass` `compared` `rarely`；10 行，每行必答；无 N/A |
| shorttext | b3 d1 d2 | `{ kind, id, text, help?, required, maxLength }`，单行或两行输入 |
| longtext | c3 | 同 shorttext，多行；多一个 `example` 字段，以灰字渲染在输入框上方，默认收起，标题 “Example (yours can be very different)”，点击展开 |
| plantlist | f1 | `{ kind, id, text, help?, count: 5, min: 3, roles: string[], notApplicable }`；每行 name（text）+ role（dropdown）+ why（可选 text）；存储 `{ not_applicable?: true, entries: { name, role, why? }[] }`；至少 3 个不同植物名，比较时忽略大小写和多余空格 |
| plantnote | f2 | 现有实现，`sourceQuestion: "f1"`，maxLength 300；f1 为 not\_applicable 时只显示其 notApplicable 选项 |

**跳转逻辑**

- `hasExperience = a2 的答案不是仅 [none]`
- `hasExperience === false` 时隐藏 b1、整个 C 节、整个 F 节；b2 的 exclusive 出口照常显示
- 隐藏的题不参与必填校验，也不出现在导出数据里（导出时写 `null` 或省略键，二选一并保持一致）

**题号显示**

- 页面题号是连续数字（1、2、3…），按当前可见题目的顺序在 `App.tsx` 中动态生成；被跳过的题不占号
- a1 / b1 这类字母 id 只用于存储、代码和本文档，页面上不显示
- 节标题（About you、What you need to know、How you work now、How you’d ask、Trusting knowledge from others、Your plants）显示在每节第一题上方

**Section 顺序与 id**

`about`（a1 a2）→ `needs`（b1 b2 b3）→ `workflow`（c1 c2 c3）→ `asking`（d1 d2）→ `trust`（e1 e2）→ `plants`（f1 f2）

**文案**

- `INTRO` 与 `CLOSING` 使用本文档“最终题目全文”里的文字；时长写 About 7 minutes
- `index.html` 的 `<title>` 保持 *How you work with plants*，meta description 改为 “A seven-minute anonymous survey on how people choose plants for Metro Vancouver.”

**开发者模式**

- 只需读取 version 1 的数据；删除对旧版本的分支
- 导出保留现有格式（JSON/CSV 皆可），每条回答带 `version: 1` 和时间戳

**不要动的部分**

- 回答的保存与导出通道本身（存到哪里、怎么取回）
- 整体样式与布局，除非新 kind 需要新组件

## 收到数据后的整理方式

预期 15–20 份回答，整理以手动编码为主，目标是产出三样东西：schema 决定、as-is 流程图、原型种子数据。

**选择题**：按 A1 / A2 分组看频数即可，不做统计检验。B1 直接转成一张“属性 × must pass 比例”表，作为 schema 中 filter 字段的依据。

**C3 叙述**：每份按四个节点拆成四列（起点 / 查找 / 排除理由 / 去向），填一张表；空着的格子也记录，缺失本身说明该环节在受访者流程里不显眼。排除理由那一列与 B1 的 must pass 行逐人对照，标出不一致的案例。

**D1、D2 原话**：原样保留一份，不要先归类。D2 的查询句直接做成原型的测试集，12 月演示时用真实的受访者提问。

**F1、F2**：F1 汇总成候选植物表（名称、角色、提及次数、理由），从中选 10 种覆盖所有角色作为原型；F2 的笔记原样保留，作为 AI 抽取 site / performance / warning 三类字段的输入，抽取结果与原文并排展示。

**写进 proposal 的三个对照**：B1 对 C3（自述判断 vs 实际排除）、B2 对 C2（缺口 vs 来源）、E1 对 F2（要求别人带的上下文 vs 自己笔记里实际带的）。
