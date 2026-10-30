# 架构说明

> 本站（Bad0RANG3.github.io）的代码组织与验证方式速查：目录该放什么、模块边界在哪、改完怎么验证。

---

## 1. 概览

Astro 5 静态站点（`output: 'static'`），Tailwind CSS 4（通过 `@tailwindcss/vite` 接入）+ daisyUI 5，部署到 GitHub Pages。

两条贯穿全局的设计约束：

1. **base 感知**。站点既要跑在用户主页根路径 `/`，也要能跑在项目页 `/repository/`。所有页面与组件里的内部路径都保持**站点相对**（如 `/posts/`），只在渲染/输出的边界上通过 `withBase()`（`src/lib/urls.ts`）转换。CI 会用 `BASE_PATH=/project-pages/` 再构建一次来验证这一点。
2. **构建产物必须可复现**。同一份源码构建出的 `dist/` 逐字节一致，因此 `pnpm dist:fingerprint` 可以作为重构的精确判据（见第 5 节）。

---

## 2. 目录结构

```
├── astro.config.mjs          站点与构建配置（Tailwind v4 走 Vite 插件）
├── plugins/                  构建期插件，只被 astro.config.mjs 消费
│   ├── remark-with-base.mjs    在 Markdown 渲染前改写原始 HTML 里的根相对 URL
│   └── rehype-wrap-tables.mjs  给正文表格套一层可横向滚动的容器
├── scripts/                  开发与 CI 脚本
│   ├── lib/                    脚本共享助手（不要在各脚本里重复实现）
│   │   ├── paths.mjs             rootDir / fromRoot / normalizeBase
│   │   ├── fs.mjs                walk / isFile / isDirectory
│   │   ├── args.mjs              parseFlags / parseOptions
│   │   └── content.mjs           localDate / isValidDate / normalizeSlug
│   ├── new-post.mjs            pnpm new:post
│   ├── new-thought.mjs         pnpm new:thought
│   ├── new-project.mjs         pnpm new:project
│   ├── validate-content.mjs    pnpm validate:content
│   ├── smoke.mjs               pnpm smoke
│   ├── perf-audit.mjs          pnpm perf:audit（关键路径体积与运行时不变式）
│   └── dist-fingerprint.mjs    pnpm dist:fingerprint
└── src/
    ├── components/            全部按域分目录，不往 components/ 根目录放文件
    │   ├── blog/                PostCard、PostMeta、TagList、ArticleTools、ArticleEnhancements、Comments
    │   ├── icons/               Icon.astro / RailIcon.astro（图标入口）
    │   ├── layout/              SiteHeader、SiteFooter、MobileDrawer
    │   ├── profile/             ProfileOverviewCard、ProjectCard
    │   ├── search/              SearchModal（只含对话框标记，逻辑在 scripts/search.ts）
    │   └── ui/                  ContentCard、EmptyState、PageHeader、SectionHeader
    ├── config/                 站点静态数据，一个模块一个关注点
    │   ├── routes.ts             ROUTES —— 全部内部 URL 的唯一来源
    │   ├── site.ts               siteConfig / SITE / SOCIAL_ICONS
    │   ├── ui.ts                 LAYOUT / STAGGER
    │   └── projects.ts           projects
    ├── content/                Astro 内容集合（路径由框架约定，不要移动）
    │   ├── config.ts             posts / thoughts 的 frontmatter schema
    │   ├── posts/*.md
    │   └── thoughts/*.md
    ├── layouts/BaseLayout.astro
    ├── scripts/                浏览器端入口，由 Astro 打包为可缓存模块
    │   ├── bootstrap.ts          按需加载其余模块的唯一入口
    │   ├── theme.ts              主题控制器（首屏由 BaseLayout 内联小脚本兜底）
    │   ├── atmosphere.ts         樱花背景（精灵缓存 + 约 30fps，滚动时持续播放）
    │   ├── player.ts             动态岛音乐播放器
    │   ├── home.ts               首页资料卡（网易云快照刷新，未配置 API 时只显示构建期快照）
    │   ├── home-motion.ts        首页播放器镜像（读岛状态、转发播放/暂停）
    │   ├── search.ts             站内搜索（首次打开时才由 bootstrap.ts 按需加载）
    │   ├── site.ts               表格包裹 / 回到顶部 / 导航抽屉
    │   ├── article.ts            文章页入口
    │   ├── article-tools.ts      文章工具条（阅读进度、目录）
    │   ├── article-enhancements.ts  代码块复制 / 图片灯箱 / 续读按钮
    │   ├── comments.ts           评论区（IntersectionObserver 懒加载）
    │   └── service-worker.ts     注册 Service Worker
    ├── lib/                    运行时工具，只放这一层
    │   ├── content.ts            集合读取（posts / thoughts）+ 单篇统计
    │   ├── taxonomy.ts           tag / category / series / archive 分组视图
    │   ├── search.ts             搜索文档构建
    │   ├── date.ts               日期格式化
    │   ├── urls.ts               withBase / siteUrl
    │   ├── images.ts             图片元信息（尺寸、占位）
    │   ├── og.ts                 OG 图生成（satori + resvg）
    │   └── storage.ts            localStorage JSON 读取的唯一实现
    ├── pages/                  路由（目录结构即 URL 结构）
    └── styles/
        ├── theme.css              设计 token（亮/暗两套）——颜色的唯一来源
        ├── global.css             Tailwind v4 入口（@import / @plugin / @theme / @source）+ 全局组件类
        ├── island.css             动态岛（头部胶囊 + 展开面板）的全部样式，唯一归属
        └── tools/*.css           各工具页私有样式
```

字体只有两种角色：`--font-mono`（`public/fonts/jetbrains-mono-*`，自托管，由 `BaseLayout` 全局声明）与 `--font-sans`（系统无衬线）。两者都在 `global.css` 的 `@theme` 里定义一次，不依赖任何外部 CDN。

### 放置规则

| 你手上的东西 | 放哪里 |
|---|---|
| 内部 URL 字面量 | `src/config/routes.ts`，渲染时套 `withBase()` |
| 站点元信息 / 作者 / 社交链接 / 关于页数据 | `src/config/site.ts` |
| 布局阈值、级联延迟 | `src/config/ui.ts` |
| 读取 content collection | `src/lib/content.ts` |
| 由 frontmatter 派生的分组视图 | `src/lib/taxonomy.ts` |
| 只在构建期跑、不被页面 import 的代码 | `plugins/` |
| 可被多个脚本或构建期插件复用的逻辑 | `scripts/lib/` |

`src/lib/` **不放**构建期插件；`src/` **不放**脚本；组件**不裸放**在 `components/` 根目录。

### 主题与颜色

- **`src/styles/theme.css` 是颜色的唯一来源**：`paper`（亮色，SSR 默认）与 `paper-dark`（暗色）两套 token 都在这里定义，`BaseLayout.astro` 在 `global.css` 之前引入。
  语义色（`--color-success` / `--color-warning` / `--color-error` / `--color-info`）、NCM 资料卡图标色（`--ncm-icon-provider` / `--ncm-icon-meta`）和文本选区色（`--selection-bg` / `--selection-text`）也在这里按主题各声明一次。**这些过去靠 daisyUI 内置 `light` 主题注入**，导致 `ncm.css` / `switch-your-cfg.css` 的 35 处 `var()` 在两种主题下取到同一个值，而亮色主题上实测只有 1.7–2.8:1。现在每套主题各有自己的值，改动时请按主题成对声明，不要只改一边。
- 组件**不允许**写死与主题相关的颜色（如 `#fff`、`text-white`）。文字用 `--fx-text` / `--color-base-content`，次要文字用 `--text-dim` / `--text-faint`，面板用 `--surface*` / `--fx-surface*`，边框用 `--line*` / `--fx-line`。代码块在两种主题下都是深底浅字，统一用 `--code-block-bg` / `--code-block-text`（Shiki 会把底色内联写在 `<pre>` 上，所以 `global.css` 用 `!important` 拉回主题色）。
- **字体：两种角色 + 一套刻度**（`theme.css` 的 `:root` 段）。
  - 角色：`--font-sans` 用于界面与正文，`--font-mono` 只留给代码、按键、数字与小型大写英文标签。原来的第三个别名 `--font-display` 与另外两个取值完全相同，已删除。
  - **两条栈都必须显式列出中文字体**（`PingFang SC` / `Hiragino Sans GB` / `Noto Sans SC` / `Microsoft YaHei` …）。JetBrains Mono 没有汉字，栈尾若直接落到 `monospace`，中文就交给操作系统决定——Windows 上是 NSimSun（宋体）。这正是过去文章 `h2` 变宋体、正文却还是黑体的原因。
  - 刻度：字号 8 档（`--type-label` 11px … `--type-display` clamp）、字重 3 档（400 / 600 / 800）、字距 3 档（`--tracking-display` / `body` / `label`）、行高 4 档（`--leading-display` / `heading` / `ui` / `prose`）。改动前全站散落 51 个字号、16 个字重、21 个字距。
  - **负字距只用于拉丁展示字**。汉字字身已占满 em 框，`-0.055em` 会让标题里的汉字互相挤压；含中文的标题一律用 `--tracking-body`（0）。
  - 11px 的 `--type-label` 只给英文大写标签用。中文最小用 `--type-meta`（12px），正文 `--type-prose` 行高 1.8。
  - **工具页（`styles/tools/*.css`）也用同一套刻度**，不要再写裸 `rem` 字号。
  - 只有两处允许脱离刻度，改动前请先想清楚是不是又在给自己开例外：
    - `island.css`：按 iPhone 灵动岛规格复刻的独立组件，字号用 `cqw`，字重 560–760 都是规格的一部分。
    - 键盘 / 鼠标示意图的 `scfg-kbd-key`：键帽图例字号受物理键位尺寸约束，缩放会溢出键帽（其 `font-weight` / `letter-spacing` 同样跟着键帽走）。
  - 另外三类**不参与刻度**，别把它们当成漏网之鱼：`.prose` 里的 `em` 相对字号（跟随正文等比缩放）、装饰性图符字号（♪、emoji 等），以及 `BaseLayout` 中 `@font-face` 的 `font-weight: 100 800`（可变字体轴范围）。
  - 首页刻意保持精简：只有文章、项目、播放器和一张账号卡。计数、标签快捷区、联系区都曾存在并被删除——它们的入口在导航与页脚里已经各有一份，重复展示只会稀释首页。新增首页区块前请先确认它不是别处已有入口的第二份拷贝。
- 主题切换由两段代码负责：`BaseLayout.astro` `<head>` 里的内联小脚本（首屏前解析 `localStorage` / `prefers-color-scheme` 并上色，避免闪烁），以及打包在 `src/scripts/theme.ts` 的控制器（切换、监听 `astro:before-swap` / `astro:after-swap`、`MutationObserver` 兜底）。改动后请用两种主题分别过一遍所有页面（`pnpm smoke` 不覆盖对比度）。

---

## 3. 模块边界

- **`lib/content.ts`** 是访问 collection 的唯一入口（`getPublishedPosts` / `getAllPosts` / `getFeaturedPosts` / `getThoughts`），同时导出 `Post` 类型与 `byDateDesc` 比较器。
- **`lib/taxonomy.ts`** 只在上面的基础上做派生分组，不直接 `getCollection`，排序一律复用 `byDateDesc`，不重复实现。
- **`lib/search.ts`** 把文章、碎碎念、项目与工具统一成 `SearchDocument`，供 `/search-index.json` 与 `SearchModal` 使用。
- **`config/site.ts`** 的 `SOCIAL_ICONS` 键名必须与 `siteConfig.socials` 的 `name` 一一对应。
- 页面只做「取数 → 组装 → 渲染」；可复用的呈现逻辑下沉到 `components/`。

---

## 4. 内容管线

1. `pnpm new:post` / `new:thought` / `new:project` 生成符合 schema 的骨架（三个脚本共享 `scripts/lib/`）。
2. `src/content/config.ts` 定义 frontmatter schema，字段不合规会在 `astro check` / 构建期报错。
3. `pnpm validate:content` 在构建前做更深一层校验：日期真实性、标签重复、`seriesOrder` 冲突、封面文件是否存在、正文里的本地图片/链接是否可达、公开 slug 是否重复。
4. 构建期 `plugins/remark-with-base.mjs` 改写 Markdown 内嵌原始 HTML 的根相对 URL。
5. `pnpm smoke` 检查产物本身：必需路由、JSON-LD、feed、manifest、sitemap、图片 `alt`、体积预算、base 前缀是否完整等。

---

## 5. 验证流程

`pnpm build` 的产物是**逐字节确定性**的，所以重构时可以这样验证「行为未变」：

```bash
# 改动前，记录基线
pnpm build
pnpm dist:fingerprint -- --write=.verify/base-root.json

# 改动后再比一次；有任何新增/删除/修改的文件都会列出并以 1 退出
pnpm build
pnpm dist:fingerprint -- --compare=.verify/base-root.json
```

基线放在 `.verify/`（已 gitignore）。**项目页 base 必须单独验一次**，因为大量逻辑只在非根 base 下才真正生效：

```bash
BASE_PATH=/project-pages/ pnpm build
pnpm dist:fingerprint -- --compare=.verify/base-project-pages.json
pnpm smoke -- --base=/project-pages/
```

与 CI 对齐的完整检查（`.github/workflows/ci.yml` 跑的就是这些）：

```bash
pnpm validate:content && pnpm check && pnpm build && pnpm smoke
```

> 指纹覆盖的是 `dist/`，**不覆盖 `scripts/`**。改动脚本时请另行对比 stdout、错误消息与生成文件内容。

指纹只能告诉你「哪个文件变了」，不能告诉你「像素有没有变」。做大范围 CSS 重构时另有一层保护：`.verify/lead-style-diff.mjs` 用 CDP 抓取 19 条代表路由 × 2 个视口 × 2 套主题（76 个用例、约 5.4 万个元素的 130 个计算样式属性），对基线做逐属性比对：

```bash
# 基线从 pnpm preview 的产物抓（源码改动不会影响它）
node .verify/lead-style-diff.mjs --base=http://127.0.0.1:4399 --capture=.verify/style-baseline-dist.json
# 改完再抓一次并比对；有差异以 1 退出
node .verify/lead-style-diff.mjs --base=http://127.0.0.1:4321 --compare=.verify/style-baseline-dist.json
```

它内部对同一状态采样两次，把两次之间会自己动的元素（樱花背景、浮动吉祥物、歌词呼吸点）标记为 `@UNSTABLE@` 并从比对中排除——**空跑两次的差异必须是 0**，否则这次的差异不能作为证据。

---

## 6. 样式编译：Tailwind v4 + daisyUI 5

样式入口是 `src/styles/global.css`：`@import 'tailwindcss'`、`@plugin '@tailwindcss/typography'`、`@plugin 'daisyui' { exclude: ... }`、`@theme`（原 `tailwind.config.mjs` 的扩展）与 `@source`。几个必须记住的点：

- **daisyUI 5 不会自动 tree-shake。** 它的 `addComponents` 默认输出全部组件，所以 `global.css` 用 `exclude` 明确排掉了本站未使用的约 58 个组件。**新增组件类前，先用渲染后的 HTML 确认组件名已在 `exclude` 里移除**，否则会静默丢失样式。当前实际用到的是 `button` / `badge` / `modal`。
- **Tailwind v4 默认扫描整个项目**（遵守 `.gitignore`）。`@source not '../content/**'` 把文章正文排除，避免散文里的普通词（`card`、`step`、`stack`…）命中 daisyUI 组件名、把整套组件样式拉进产物。
- **不要写死 daisyUI 旧版本的变量名。** v5 使用 `--color-primary` / `--color-base-content`（完整 oklch 颜色），不再有 `--p` / `--bc` / `--b1`。工具页里的半透明色统一写成 `color-mix(in srgb, var(--color-primary) 20%, transparent)`。
- **不要用 `oklch(from … l c h / a)` 这种相对颜色写法。** 它和 `color-mix()` 表达同一件事（同一个颜色、指定 alpha），但相对颜色要 Chrome/Edge 122、Safari 18；`color-mix()` 从 Chrome/Edge 111、Safari 16.2、Firefox 113 就有，正好落在基线内。两者等价性已逐像素验证：冻结动画后在 12 个页面上比对 67,622 个颜色值，零差异（主题切换带过渡，采样前若不禁用过渡会采到中间色，产生 1–2/255 的假差异）。
- 产物仍集中在单个 `dist/_astro/about.*.css`（约 160 KB / gzip 约 34 KiB，109 个页面全都链接它），工具页样式单独成文件。文件名带内容哈希、且不叫 `global`，容易误认成「只有 about 页用」——它是全站共享包，改任何全局样式都会改名。

### 动态岛（头部音乐胶囊）

- 结构与交互在 `src/components/layout/SiteHeader.astro` + `src/scripts/player.ts`；**样式全部归 `src/styles/island.css`**，`global.css` 里不应再出现任何 `.music-island` / `.dynamic-island` / `.header-action` 规则。同一个选择器在两个文件里各写一遍，就得靠 `!important` 打架——这正是重构前的问题。
- 形态切换只改 `data-open`、`data-player-state`、`data-visualizer`、`data-cue-active` 这几个属性，动画交给 CSS 过渡；JS 不写内联几何。展开/收起必须**可中断**：中途反向点击要从当前几何继续，而不是先塌成空壳。
- **视觉规格对齐 iPhone 的灵动岛**，这不是随意调的，改之前先理解这几点：
  - 背景是**不透明纯黑**（`--island-bg: #000`），没有边框、没有 `backdrop-filter`。真机上它本来就是屏幕挖孔，不是一块玻璃面板。所以它和 `paper` / `paper-dark` 两套主题都无关。
  - 比例：紧凑态约 **4.9:1**（196×40，完全胶囊，圆角 = 高度一半）；展开态约 **2.1–2.3:1**（372×176，圆角很大）。这两个数字定了，里面所有尺寸都靠 `cqw` 跟着缩放——面板内的一切用 `cqw` 而不是 `px`，改宽度就是整体缩放。
  - 紧凑态是**两端分置**：左边专辑封面（26px、圆角 6px），右边 5 根白色细条波形，中间留空（真机那里是摄像头）。不要把两者居中凑在一起。
  - 展开态的信息层级是**歌名（白色粗体）→ 歌手（次级灰）→ 歌词（最弱）**，而不是反过来。
  - 波形**只有 `live` 会动**，且高度由 JS 从真实 AnalyserNode 频谱帧算出。`idle` / `off` 一律静止；`idle` 用一组不等高的静态剪影（像暂停的波形），不要用等高的横线——那看起来像加载指示器。
- 播放器模块只能按需加载（用户首次交互时才 import），不能进入文档首屏的脚本链——`pnpm perf:audit` 会断言这一点。
- `prefers-reduced-motion: reduce` 下保留一次短过渡（约 0.2s），不要用全局 reset 的 `0.01ms` 直接跳变。

修改样式后如果只想确认体积变化，直接看 `dist/_astro/about.*.css` 的原始/ gzip 大小即可；`pnpm dist:fingerprint` 会如实列出差异。

---

## 7. 脚本约定

- **参数解析必须放在 `try` 内**（配合模块作用域的 `let options;`）。放在 `try` 之外抛出时会打印 Node 栈追踪，而不是统一的 `<script> failed: <message>`。
- 共享逻辑放 `scripts/lib/`：`paths.mjs`（rootDir / fromRoot）、`fs.mjs`（walk / isFile）、`args.mjs`（parseFlags / parseOptions）、`content.mjs`（日期与 slug 校验）。不要在各脚本里重复实现。
- 路径一律用 `fromRoot(...)` 拼接，不要用 `process.cwd()`——脚本要能在任意工作目录下运行。
- `parseFlags` 与 `parseOptions` 会把 `--max-image-size` 这类键转成 camelCase（`options.maxImageSize`）；未知参数会直接报错，避免 CI 里的拼写错误被静默放过。
- **两个解析器都必须跳过裸 `--`。** pnpm 只在 Windows 上吞掉这个分隔符；在 Linux（也就是 CI）上它会原样传给脚本。所有用法提示里印的都是 `pnpm <script> -- <flag>` 这种形式，少了这个跳过逻辑，该形式在 CI 上会以 `Unknown argument: --` 失败。这正是 `ci.yml` 里 "Validate project Pages base path` 这一步失败的原因——而它在项目建立起的前 20 次运行中从未真正执行过任何断言，因为解析阶段就先挂了。**断言全在解析之后，所以参数解析的健壮性直接决定这些检查是否真的生效。**
- 改动脚本后**指纹比对帮不上忙**（它只覆盖 `dist/`），请另行对比 stdout、错误消息与生成的文件内容。
