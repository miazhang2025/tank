# CRÈCHE · v2 「做减法」改版计划

> Living checklist. 与 [DEV_PLAN.md](DEV_PLAN.md) 并行：DEV_PLAN 是 v1 建站记录，这份是 v2 结构重构。
> 状态：**结构已确认**（剩社交链接清单待补）· 起草 2026-08-16

---

## 0. 目标

6 个 section → **4 个**。三个独立项目 section 合并成一个 `work` section，用 cassette-jury 的排布语言（两只动物挤在左下、内容在右侧），右侧原本单个的掉落模型换成**一组代表全部项目的 3D 小球**（先用不同颜色的球体占位，之后可逐个换成真模型），配一条能控制进度 / 选项目 / 选分类的 side rail。最后一个 section 把人物和对话整体移到画面左侧，右侧放一组可点击的社交链接小球。

参考：threejs.paris/lineup 的中偏右小球阵列 —— 但**不做那么多 hover 交互，只保留一个轻微的磁吸（magnetic）吸附**。

### 新的 section 顺序

| # | id | 变化 |
|---|---|---|
| 1 | `main` | 不变 |
| 2 | `about` | 不变（TL;DR） |
| 3 | `work` | **新**：合并 cassette-jury / santa-beer / flaneur；保留下潜 + 影棚灯光；右侧小球阵列 + side rail |
| 4 | `more` | 人物 + 对话移到**左侧**；右侧社交链接小球 |

---

## 1. 数据

- **唯一数据源**：`public/creche-projects.json`（6 个项目：flaneur / cassette-jury / santa-beer / eureka / understory / dummie-ai）。运行时 `fetch` 一次，App 层往下传；你以后只改这一个文件就能加/删项目。
- `src/content/sections.js` 瘦身成只剩 `main / about / more` 的对白 + 文案；`MENU` 改成 About / Work / More；`STAGE_ORDER` 改成 4 项。
- 每个项目新增一个**可选**的展示字段（不写就用代码里的默认调色板）：
  ```jsonc
  "orb": { "color": "#F186AF", "model": "/models/flaneur.glb", "preview": "/preview/flaneur.gif" }
  ```
  这样"球体 → 真模型"是逐个替换、不用改代码。
- 分类来自 `tagVocabulary.type`（Video / Interactive / 3D）+ 一个 All。`dummie-ai` 原本 `tags.type` 为空 → **直接在 JSON 里补上 `Interactive`**（已确认），分类逻辑不开特例。
- `santa-beer` 和 `understory` 是**两个独立项目**（已确认）；旧 `sections.js` 里把 santa-beer 显示成 "Understory" 的错位随之消失。

## 2. 场景 / 运镜（`choreography.js`）

- 页面高度 4×100vh。`about → work` 和 `work → more` **都**是电影感下潜（camY 一路向下：0 → −3.5 → −9），下沉的动势从头贯到尾，不再有上浮回水面那一段。
- `work` 的两只动物沿用 cassette-jury 的左下锚点；`more` 两只都推到左侧（sx ≈ 0.18 / 0.32），对话气泡栈也全在左边。
- 现在绑在旧 section id 上的两个彩蛋改成跟**当前选中的项目**走：章鱼揍蝾螈（原 cassette-jury）在选中 cassette-jury 时触发，蝾螈跳舞（原 flaneur）在选中 flaneur 时触发。

### 2b. `more`：继续下沉，但回到明亮

**约束**：现有那套"亮"（暖色窗光 shafts + 水面 y=6.2 + 地板 y=−5.2）是绑在浅水高度上的。深潜 section 之所以 `floor.visible=false` / `surface.visible=false`，正是因为相机沉到地板以下再往上仰，这两块不透明平面会甩进画面中央。所以**不能靠把 `stageLight` 归零来变亮** —— 那等于在错误的深度重新打开浅水布景，必穿帮。

**做法：不是回到原来的亮，是沉进另一层亮。**

| 手段 | 具体 |
|---|---|
| 雾色 | `envColor` 从 stage 深青 lerp 到浅色（品牌浅蓝 `#A7D8E5` 一侧）。`FogExp2` 会把远景整片洗亮 —— 这是"变亮"读感的主力 |
| 灯光 | `stageLight` → 0，`envDim` 回到 1，四盏灯恢复满强度；stage spotlight 淡出 |
| 亮源 | **新增**：`more` 深度下方一块发光的浅色光池（大平面，复用 `causticMat` 换浅色 + 一层柔光晕），由新 control `deepGlow` 0..1 驱动。相机下沉时它从画面下方升进来 → "越沉越亮，下面有东西在发光" |
| 布景 | 水面 / 地板保持隐藏；显隐规则从写死的 `STAGE_LIGHT_SECTIONS` 白名单改成**按 camY 深度自动判断**，以后加 section 不用维护那个 Set |
| 窗光 | 原来的多道窗光 shafts 保持关闭（它们在浅水高度），亮由光池给 |

备选（未采用）：只改雾色不加光源 —— 更省事，但深处没有具体亮源，容易读成"起雾"而不是"变亮"。

## 3. 小球阵列（新模块 `src/scene/projectOrbs.js`）

**排布：竖向弧线 lineup（已确认）**

- 每个项目一个球（`SphereGeometry` + 现有 creature candy 材质的着色语言，按 `orb.color` 上色），沿一条竖向弧线排在画面右侧（sx ≈ 0.62–0.80）。
- **当前项目**的球落在焦平面上 → 永远清晰、体积最大；前后邻居沿 z 后退 → 现有 DOF 自然把它们虚化。滚轮/选择时整条弧线沿曲线平移，读起来像一个 lineup。
- **滚轮在 work 内翻项目，到头才离开（已确认）**：进入 work 后每次 flick 前进/后退一个项目；到最后一项再 flick 才进 more，回到第一项再往回 flick 才回 about。复用现有 Observer + navLock，多加一层"section 内游标"。
- 球旁常驻一小块信息（DOM，跟随球的屏幕锚点）：**项目名 + tags + oneLiner**。只有当前项显示完整，邻居只留一个淡的名字。
- 磁吸：射线只打 6 个球（很便宜），hover 时球朝光标世界坐标缓动一小段 + 轻微放大，离开用 elastic 弹回。**不做**标签、拖影、粒子那些。
- 点击球 → 打开右 2/3 的 case study 面板（见 §5）。
- 分类筛选时，被过滤掉的球淡出，弧线重新排布。
- 旧的 `updateProps` 掉落系统整体删掉（`/models/*.glb` 文件保留，之后作为 `orb.model` 复用）。

## 4. Side rail（新组件 `src/components/ProjectRail.jsx`）

- 位置：`work` section 右侧、垂直居中，沿用现有 sidebar 的毛玻璃材质。
- 内容：分类 chips（All / Video / Interactive / 3D）→ 项目标题列表（当前项高亮）→ 一条细进度轨，显示在筛选后列表里的位置，可点可拖。
- 与小球阵列共享同一个 state（`activeProject` / `filter`），三种输入（滚轮、点球、点 rail）都写同一个 state。

## 5. 项目详情面板（新组件 `src/components/ProjectPanel.jsx`）

两层信息，已确认：

**第一层（常驻，跟着小球）** —— 项目名 + tags + oneLiner，只有当前选中项显示全，见 §3。

**第二层（点击小球后打开）** —— 一个占**画面右侧 2/3** 的完整 case study 面板：

```
┌ 左 1/3 ──────┬ 右 2/3 ────────────────────┐
│              │  Flâneur              ✕   │
│   🦎  💬     │  iOS · Sound · Location   │
│   🐙  💬     │  ── Concept               │
│              │  ── Design                │
│  人物+对话   │  ── Technical             │
│   保持可见   │  ── Why it matters        │
│              │        ( Take a walk )    │
└──────────────┴───────────────────────────┘
```

- 内容全部来自 JSON：`title` / `tags` / `sections.{concept,design,technical,whyItMatters}` / CTA = `cta` + `links` 第一条；有 `brief`、`stack`、`credits`、`awards` 的项目在末尾追加一小块 meta。
- 材质沿用现有毛玻璃语言（不是那朵云的形状，是一块贴右边的竖版玻璃面板），内部可滚动。
- 打开时：小球阵列 + side rail 淡出让位；人物和对话留在左 1/3 不动。关闭：右上 ✕ / Esc / 点左 1/3 空白处。
- 打开期间锁住 section 翻页和项目切换 —— 滚轮归面板内部滚动。
- 3D section 标题（Quedami 那个被模型遮挡的立体标题）改成显示**当前项目名**，随选择切换；面板打开时淡出。
- hover GIF 预览（`/preview/*.gif`）保留：挂到小球 hover 上，只有配了 `orb.preview` 的项目才有。
- 移动端：面板全屏。

## 6. `more` section

- 对话 + 两只动物整体左移；右侧一组 3–5 个可点击社交小球，每个 hover 时磁吸 + 弹出一个小标签（Instagram / Email / …），点击开对应链接。
- **需要你给链接清单**（平台 + URL + 想要的颜色）。在你给之前我先用 Email / Instagram 两个占位。

## 7. 移动端

- 小球阵列缩到屏幕中下部的一条竖列，rail 变成底部一条横向 chips + 左右箭头；详情云沿用现有的全宽竖版云。

---

## 8. 分步执行（每步做完给你看截图再往下走）

- [x] **S1 数据层**：`src/content/projects.js`（fetch + normalise + 分类）；`sections.js` / `MENU` / `STAGE_ORDER` 改 4 段；旧三个 section 的内容、CSS、以及整套掉落 prop 系统（含 3D 标题）删除；两个彩蛋改由 `controls.activeProject` 触发。
- [x] **S2 运镜 + 光**：`about→work→more` 两段连续下潜（camY 0 → −3.5 → −9）；新增 `deepGlow` + 浅色海床（y −13.4）+ 雾密度随之变薄；新增每段可调的 `camFollow`（`more` 用 0.96 压平俯仰角，否则海床只在画面四角露出）；水面/地板的显隐改成按 camY 深度判断；新增 `body.bright-stage` 让固定 UI 文字在浅色段翻成深色。
- [x] **S3 小球阵列**：6 个彩球 + 竖向弧线 + 焦平面/DOF 分层 + 选中用 GSAP 补间 `controls.projectP`（一个数驱动整条弧线）。球用的是**去掉贴图的 creature 材质**（`makeCreatureMat(null, tint)`）—— 同一套糖果质感、同一套雾/舞台光 uniform，白捡。
- [x] **S4 交互**：磁吸 hover（**屏幕空间**，不是射线：吸附必须在光标压上去之前就开始，射线只能回答"在/不在球上"）、滚轮在 section 内翻项目到头才离开、球旁的名字/tags/oneLiner（当前项展开，其余只留名字）。
- [x] **S5 Side rail**：分类 chips + 项目列表 + 可点可拖的进度轨 + `01 / 06` 计数。
- [x] **S6 详情面板**：右 2/3 case study（含 `brief` 的对象/字符串两种写法归一）、滚轮锁、✕/Esc/点左三分之一关闭。
- [x] **S7 社交小球**：小球系统重构成**两个 group 共用一套 rig**（材质/淡入淡出/磁吸/命中/屏幕锚点全共享，只有布局各写各的），`more` 的社交球即第二个 group。链接清单在 `src/content/social.js`。
- [x] **S8 收尾**：移动端三段布局重排、死代码清理、桌面 + 402×874 全流程 Playwright 走查（含反向滚回顶部），无 console 报错。

---

## 9. 已确认的决定（2026-08-16）

1. **滚轮**：在 work 内翻项目，到头才离开 section。
2. **详情**：两层 —— 小球旁常驻项目名/tags/oneLiner；点击打开右 2/3 完整 case study 面板（带 CTA），左 1/3 保留人物对话。
3. **排布**：竖向弧线 lineup。
4. **彩蛋**：跟随选中的项目（选中 cassette-jury → 章鱼动手；选中 flaneur → 蝾螈跳舞）。

## 10. 建成后的偏离与待补

**与原计划的两处偏离（都是做减法）**

1. **3D section 标题去掉了**。原计划让被小球遮挡的立体标题显示当前项目名 —— 但球旁的 DOM 标签已经在报名字了，再来一个立体的就是同一句话说两遍。旧那套标题的 canvas-texture + 手写深度遮挡 shader 一并删除（约 100 行）。
2. **小球 rig 写在 `createAquarium.js` 里，不是独立的 `projectOrbs.js`**。它要用 `screenToWorld` / `controls` / `camera` / `pointer` / DOF 焦距等十几个内部量，拆成模块只是把这些改成参数传一遍，得不偿失。文件内已按 group 分好。

**修订轮（2026-08-16，第二次）**

- Rail 分类去掉胶囊，改成一排纯文字，选中项用品牌蓝区分；项目列表去掉彩色小圆点。
- 详情面板**大幅缩短**：只留一段（`summary`）+ 一个出口。非视频项目 = CTA 按钮；视频项目 = 16:9 影片位（`links.video` 填了就是 iframe，没填是 "FILM COMING" 占位）。JSON 里的 concept / design / technical / whyItMatters / brief / stack / credits 都**不再显示**（数据仍在，随时可以接回来）。
  - 注意：按"视频项目就 one paragraph + 视频"的字面意思，视频项目的 CTA 按钮**去掉了** —— Santa Beer 的 case-study 外链目前不出现在页面上。想同时保留就说一声。
- WIP 项目（`status: "wip"`，目前是 dummie AI）点击只选中、**不开面板**。
- 面板改成**实心奶油底 + ink 文字**（`--c-cream` / `--c-ink`，标题 `--c-red`，元信息 `--c-teal`）—— 全站唯一一块不是毛玻璃的面：要读的东西给一页纸，漂在水里的才给玻璃。

**修订轮（2026-08-16，第三次）**

- **详情面板改半透明 + 光标涟漪**。面板降到 82%→72% 的奶油底 + 3px 轻磨砂，后面的水缸一直在动；光标扫过时后面的水被推起涟漪。
  - 涟漪做在**场景最后的 composite pass 里**，不是 CSS：本项目之前试过 `backdrop-filter: url(#svg位移)`，在真机 Chrome 上渲染成一块不透明灰（DEV_PLAN Phase 7 有记录）。而且这一 pass 本来就在重采样整帧，弯一下采样坐标几乎零成本 —— 扭的是真的场景，不是快照。
  - 实现：保留最近 10 个光标采样点（每移动约 1.2% 视口就落一个），每点按 `exp(-距离/brush) × 寿命²` 衰减，方向按 swirl 旋转。用 `uRipRect` 把整个效果**限制在面板矩形内**（边缘 smoothstep 羽化，不切边）。
  - 关键一点：只做位移是**看不见**的 —— 面板后面的水缸大部分是平滑渐变，扭一块平滑渐变等于没扭。所以另加了一项"波峰打光"，让涟漪在没有细节的区域也读得出来，这也是它能穿透 72% 奶油被看见的原因。
  - 手机上整个效果关掉（`LOW_POWER`）：没有光标可驱动，还要在最弱的硬件上跑满屏逐像素循环。
- CTA 按钮加上磁吸（复用内容云按钮那套 `gsap.quickTo` 光标跟随 + elastic 弹回）。
- 右上角菜单按钮去掉三根横条，只剩一个玻璃圆圈。
- 社交链接接上：Instagram / LinkedIn / Email(knockonglass@crechetank.com)。

**修订轮（2026-08-16，第四次：home / about 版式）**

- **`main` 加了一个巨幅红色 "Creche Tank"**，居中偏下，人物在字的**前面**游。它必须画在 3D 场景里（DOM 永远盖在 WebGL 之上，做不到被人物遮挡）。
  - 第一版放进主场景 + `depthWrite:false`，结果**整个消失**了：不写深度的半透明面片，会让景深 pass 在那些像素上读到它**背后**（远处后墙）的深度，于是把字模糊没了。改成放进 `fxScene`（在景深之后合成，和鼠标气泡一样），遮挡靠手写深度比较：采样场景 pass 的深度图，谁在前面就 discard。这正是 v1 那套被删掉的立体标题当初这么写的原因。
  - 颜色是预压暗的（`#8c1103`）：全局关掉了颜色管理、合成阶段自己做 gamma，直接给 sRGB 值会被冲淡。
- **`about` 改成左右分栏**：左半屏是标题 + 无气泡背景的正文（内容左对齐、整块在左半屏居中），人物和对话推到右半屏。竖屏没有分栏空间，改成正文在上、人物对话在下。
- 左上角 wordmark 改成 `--c-cream`；右上角圆圈的投影改成白色光晕。
- 标题按你说的从 "TL;DR" 改成 "About"。

**仍待补**

- **RED（小红书）和 Are.na 的 URL**：`src/content/social.js`。空 href 的球照常显示但点不动、标签半透明，填上就生效。
- **Ep0ch.art 的预览 GIF**：丢一个 `public/preview/ep0ch-art.gif` 就会自动出现（现在显示 "PREVIEW COMING" 占位）。
- **`public/preview/santa-beer.gif` 是 82 MB 且已经用不到了** —— santa-beer 现在是视频项目，走 YouTube 嵌入，这个 GIF 不会再被渲染，但 `public/` 是整个复制进构建产物的。建议删掉。

**面板媒体位（第五轮）**

- 一个媒体位两种填法：视频项目放影片本身，其余项目放 `/public/preview/<id>.gif` 的循环预览，都是 16:9 同一个框。
- 视频地址在 JSON 里**存分享链接原样即可**（`https://youtu.be/xxx`）—— 数据层的 `toEmbed()` 会转成 `youtube.com/embed/xxx`。直接把 youtu.be 链接塞进 iframe 是加载不出来的（X-Frame-Options 拒绝内嵌），也支持 `watch?v=` 和 Vimeo。
- 左下角那行 footer 还写着 `miazhang2025@gmail.com`，和新的品牌邮箱不一致 —— 那句是你自己写的文案（提到 Mia 本人），没动。
- 各项目的 `orb.color`：现在用品牌调色板按顺序自动分配（浅的那两个色被调深了 —— 球体材质会提亮加清漆，`#A7D8E5` 和 `#FDF5E7` 直接用会双双变成同一个白球）。要单独指定就在 `creche-projects.json` 里加 `"orb": { "color": "#..." }`。
- GIF 预览（`/preview/*.gif`）还没挂到小球 hover 上 —— `projects.js` 已经把 `preview` 字段带出来了，接一下就行。
