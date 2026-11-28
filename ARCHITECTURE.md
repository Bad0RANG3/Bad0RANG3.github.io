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
│   ├── remark-figure-images.mjs  独立成段的图片 → 带固有尺寸的 <figure>（尺寸解析复用 src/lib/images.ts）
│   ├── remark-with-base.mjs    在 Markdown 渲染前改写原始 HTML 里的根相对 URL
│   ├── rehype-code-tabs.mjs    把相邻且同 group 的代码块合成可切换的 tab 组
│   ├── rehype-wrap-tables.mjs  给正文表格套一层可横向滚动的容器
│   └── shiki-code-tab-meta.mjs Shiki transformer：把 ```lang tab=… group=… 元数据写到 <pre> 上
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
│   ├── perf/bga-frames.mjs     pnpm perf:frames（无头 Chrome 实测粒子层帧率）
│   └── dist-fingerprint.mjs    pnpm dist:fingerprint
└── src/
    ├── components/            全部按域分目录，不往 components/ 根目录放文件
    │   ├── blog/                PostCard、PostMeta、TagList、ArticleTools、ArticleEnhancements、Comments
    │   ├── icons/               Icon.astro（图标入口）
    │   ├── layout/              SiteHeader、SiteFooter、MobileDrawer
    │   ├── profile/             ProjectCard
    │   ├── search/              SearchModal（只含对话框标记，逻辑在 scripts/search.ts）
    │   └── ui/                  ContentCard、EmptyState、PageHeader
    ├── config/                 站点静态数据，一个模块一个关注点
    │   ├── routes.ts             ROUTES —— 全部内部 URL 的唯一来源
    │   ├── site.ts               siteConfig / SITE / SOCIAL_ICONS
    │   ├── ui.ts                 LAYOUT / STAGGER
    │   ├── projects.ts           projects
    │   ├── tools.ts              tools（工具箱条目 + 搜索元数据）
    │   └── sushiro.ts            寿司郎计算器的五个地区价目（每条都带来源与核对日期）
    ├── content/                Astro 内容集合（路径由框架约定，不要移动）
    │   ├── config.ts             posts / thoughts 的 frontmatter schema
    │   ├── posts/*.md
    │   └── thoughts/*.md
    ├── data/                   构建期数据（被 import，不是页面）
    │   └── atmosphere-keyframes.json  粒子背景的 87 条 SVG 关键帧
    ├── layouts/BaseLayout.astro
    ├── scripts/                浏览器端入口，由 Astro 打包为可缓存模块
    │   ├── bootstrap.ts          按需加载其余模块的唯一入口
    │   ├── theme.ts              主题控制器（首屏由 BaseLayout 内联小脚本兜底）
    │   ├── atmosphere.ts         粒子背景（原站 SVG 关键帧 + Canvas；不设 FPS 上限，
    │   │                         每个原生动画帧画一次，弱设备只画静帧。见 §6「粒子背景」）
    │   ├── player.ts             动态岛音乐播放器
    │   ├── home-hero-motion.ts   首页主视觉的指针视差（跟随可见性 / 动效偏好）
    │   ├── search.ts             站内搜索（首次打开时才由 bootstrap.ts 按需加载）
    │   ├── site.ts               表格包裹 / 回到顶部 / 导航抽屉
    │   ├── article.ts            文章页入口
    │   ├── article-tools.ts      文章工具条（收藏、分享）
    │   ├── article-enhancements.ts  阅读进度 / 续读 / 目录高亮与文章生命周期
    │   ├── article-code.ts      代码块工具条 / 复制 / 键盘切换代码标签
    │   ├── article-lightbox.ts  图片灯箱 / 缩放 / 相册导航
    │   ├── comments.ts           评论区（IntersectionObserver 懒加载）
    │   ├── ncm.ts                /tools/ncm 的页面控制器
    │   ├── sushi.ts              /tools/sushi 的页面控制器（寿司郎计算器）
    │   └── service-worker.ts     注册 Service Worker
    ├── lib/                    运行时工具，只放这一层
    │   ├── content.ts            集合读取（posts / thoughts）+ 单篇统计
    │   ├── taxonomy.ts           tag / category / series / archive 分组视图
    │   ├── search.ts             搜索文档构建
    │   ├── date.ts               日期格式化
    │   ├── urls.ts               withBase / siteUrl
    │   ├── images.ts             图片元信息（尺寸、占位）；plugins/remark-figure-images.mjs 也用它
    │   ├── og.ts                 OG 图生成（satori + resvg；字体子集缓存在 node_modules/.cache/og-font）
    │   ├── text.ts               标签是否纯拉丁（决定要不要上宽字距）+ JSON-LD 安全序列化
    │   ├── storage.ts            localStorage JSON 读取的唯一实现
    │   ├── clipboard.ts          剪贴板写入的唯一实现（navigator.clipboard + execCommand 回退）
    │   └── scroll.ts             全站共用的滚动帧调度器（见 §6「滚动路径」）
    ├── pages/                  路由（目录结构即 URL 结构）
    └── styles/
        ├── theme.css              设计 token（亮/暗两套）——颜色的唯一来源
        ├── global.css             Tailwind v4 入口（@import / @plugin / @theme / @source）+ 全局组件类
        ├── prose.css              正文排版；仅文章、碎碎念和隐私页引入
        ├── article.css            文章布局 / 目录 / 代码工具条 / 灯箱；仅文章页引入
        ├── island.css             动态岛（头部胶囊 + 展开面板）的全部样式，唯一归属
        └── tools/*.css           各工具页私有样式
```

字体有三种角色，全部自托管在 `public/fonts/`，不依赖任何外部 CDN：`--font-display`（Playfair Display，拉丁展示字：站名、分区标签、各级标题里的拉丁部分）、`--font-sans`（Roboto + 系统中文字体，界面与正文）、`--font-mono`（JetBrains Mono，代码 / 按键 / 数字 / 小型大写英文标签）。三者都在 `global.css` 的 `@theme` 里定义一次，`@font-face` 由 `BaseLayout` 统一声明；Roboto 与 Playfair 都是可变字体，一个文件覆盖各自用到的字重区间。

### 放置规则

| 你手上的东西 | 放哪里 |
|---|---|
| 内部 URL 字面量 | `src/config/routes.ts`，渲染时套 `withBase()` |
| 站点元信息 / 作者 / 社交链接 / 关于页数据 | `src/config/site.ts` |
| 布局阈值、级联延迟 | `src/config/ui.ts` |
| 读取 content collection | `src/lib/content.ts` |
| 由 frontmatter 派生的分组视图 | `src/lib/taxonomy.ts` |
| 写剪贴板（复制代码块 / 分享链接 / 复制账单） | `src/lib/clipboard.ts` 的 `copyText()`，返回 `Promise<boolean>`，不抛错 |
| 塞进 `<script type="application/ld+json">` 的对象 | `src/lib/text.ts` 的 `serializeJsonLd()`（会把 `<`、`>`、`&` 转成 `\uXXXX`） |
| 图片的固有宽高 | `src/lib/images.ts` 的 `getPublicImageSize()`，构建期插件也调它，不要另写解析器 |
| 只在构建期跑、不被页面 import 的代码 | `plugins/` |
| 可被多个脚本或构建期插件复用的逻辑 | `scripts/lib/` |
| 某个页面自己的浏览器端逻辑 | `src/scripts/<页面名>.ts`，页面里只留 `<script>import …</script>` |

`src/lib/` **不放**构建期插件；`src/` **不放**脚本；组件**不裸放**在 `components/` 根目录。工具页过去把几百行逻辑内联在 `.astro` 的 `<script>` 里（`ncm` 224 行），现已移入 `src/scripts/ncm.ts`；这次搬迁用 `dist:fingerprint` 证明过产物逐字节一致。

### 页面控制器的重入契约

**ClientRouter 每次导航都会换掉整页标记，但每个模块在一次会话里只求值一次。** 所以任何"绑定到本页标记"的控制器——`src/scripts/` 里那些按 id/class 找元素并挂监听的文件——都必须遵守下面三条，否则页面会在第一次客户端导航之后变成"看起来正常、点什么都不响应"：

1. 绑定动作写在 `init()` 函数里，**不要写在模块顶层**。
2. 注册 `document.addEventListener('astro:page-load', init)`，**同时**保留一次即时调用（`DOMContentLoaded` 之前模块就求值完了，只靠 `page-load` 会晚一拍）。
3. `init()` 开头用标记元素做重入判断（`el.dataset.bound === '1'`）。`astro:page-load` 首屏也会触发一次，没有这个守卫每个监听都会挂两遍。

反过来的坑同样真实：**清理必须发生在守卫之后**。`article-enhancements.ts` 曾经先无条件 `cleanup()`、再判断 `dataset.enhanced`，于是首屏第二次进入时先把刚装好的监听全拆了、然后直接 return——阅读进度条整次访问都不动，阅读历史也一条都没写。`pnpm smoke` 现在会静态断言这两件事（见第 5 节）。


### 主题与颜色

- **`src/styles/theme.css` 是颜色的唯一来源**：`paper`（亮色，SSR 默认）与 `paper-dark`（暗色）两套 token 都在这里定义，`BaseLayout.astro` 在 `global.css` 之前引入。整套配色是「白底 + 单一蓝紫强调色」：`--fx-accent` 是粒子背景与悬停色用的那支蓝紫，`--accent-primary-soft` 是它的深色版本（专供白底上的链接文字，4.5:1）；旧配色里的 `--fx-pink` / `--accent-pink` / `--accent-violet` 已按语义改名为 `--fx-accent` / `--accent-primary` / `--accent-secondary`，暗色主题是同一色系入夜后的版本，不是另一套设计。
  语义色（`--color-success` / `--color-warning` / `--color-error` / `--color-info`）、NCM 资料卡图标色（`--ncm-icon-provider` / `--ncm-icon-meta`）和文本选区色（`--selection-bg` / `--selection-text`）也在这里按主题各声明一次。**这些过去靠 daisyUI 内置 `light` 主题注入**，导致工具页样式里的 `var()` 在两种主题下取到同一个值，而亮色主题上实测只有 1.7–2.8:1。现在每套主题各有自己的值，改动时请按主题成对声明，不要只改一边。
- 组件**不允许**写死与主题相关的颜色（如 `#fff`、`text-white`）。文字用 `--fx-text` / `--color-base-content`，次要文字用 `--text-dim` / `--text-faint`，面板用 `--surface*` / `--fx-surface*`，边框用 `--line*` / `--fx-line`。**唯一允许的例外是「强调色上的前景」**：这类地方用 `--color-primary-content`（`paper` 近白、`paper-dark` 深蓝），不要写 `#fff`——亮色强调色配白字在暗色主题上只有 2.4:1。代码块在两种主题下都是深底浅字，统一用 `--code-block-bg` / `--code-block-text`（Shiki 会把底色内联写在 `<pre>` 上，所以 `global.css` 用 `!important` 拉回主题色；Shiki 主题固定为 `github-dark-default`，因为 `github-dark` 的注释色在本站代码底板上只有 3.84:1）。
- **不用半透明文字代替次级色**。`text-base-content/35`～`/50` 这类写法在两种主题下都过不了 4.5:1（亮色下实测 2.16–3.78:1）。全站的透明度取值已经收敛到 `/70`（次要）与 `/80`（更接近正文）两档，新增文案请沿用这两档或直接用 `--fx-muted` / `--fx-faint`。`.verify/synthion/contrast.mjs` 会在 14 条路由 × 2 套主题上逐元素复核（用 canvas 归一化 `oklch()` / `color(srgb …)` 再比较，直接解析这些新语法会把 0–1 分量当成 0–255，得出满屏假阳性）。
- **字体：三种角色 + 一套刻度**（`theme.css` 的 `:root` 段）。
  - 角色：`--font-display` 用于拉丁展示字，`--font-sans` 用于界面与正文，`--font-mono` 只留给代码、按键、数字与小型大写英文标签。
  - **三条栈都必须显式列出中文字体**（`PingFang SC` / `Hiragino Sans GB` / `Noto Sans SC` / `Microsoft YaHei` …）。Roboto、Playfair Display、JetBrains Mono 都没有汉字，栈尾若直接落到 `sans-serif`，中文就交给操作系统决定——Windows 上是 NSimSun（宋体）。这正是过去文章 `h2` 变宋体、正文却还是黑体的原因。`--font-display` 因此**落到无衬线中文字体**而不是衬线：Playfair 只负责标题里的拉丁字母，汉字继续走黑体，和参考站把日文正文交给无衬线是同一个处理。
  - 刻度：字号 8 档（`--type-label` 11px … `--type-display` clamp）、字重 3 档（400 / 600 / 700，另有 `--weight-serif` 供 Playfair 用 400）、字距 4 档（`--tracking-display` / `body` / `label` / `wide`）、行高 4 档（`--leading-display` / `heading` / `ui` / `prose`）。
  - **`--tracking-wide`（0.3em）只给纯拉丁大写标签用**。汉字字身已占满 em 框，这么大字距会把中文标签拆散。`.eyebrow` 是中性小标签（两种文字都安全），`.eyebrow-latin` 才是宽字距版本，由 `lib/text.ts` 的 `isLatinOnly()` 自动选择——`PageHeader` / `ContentCard` 都走这个判断，所以调用方传中文标签也不会出问题。
  - **负字距只用于拉丁展示字**。含中文的标题一律用 `--tracking-body`（0）。
  - 11px 的 `--type-label` 只给英文大写标签用。中文最小用 `--type-meta`（12px）——页脚 / 抽屉的分组标题是中文，所以它们用 `--type-meta` 且不加字距；正文行高 `--leading-prose` 1.8。
  - **工具页（`styles/tools/*.css`）也用同一套刻度**，不要再写裸 `rem` 字号。
  - 只有一处允许脱离刻度，改动前请先想清楚是不是又在给自己开例外：
    - `island.css`：按 iPhone 灵动岛规格复刻的独立组件，字号用 `cqw`，字重 560–760 都是规格的一部分。
  - 另外三类**不参与刻度**，别把它们当成漏网之鱼：`.prose` 里的 `em` 相对字号（跟随正文等比缩放）、装饰性图符字号（♪、emoji 等），以及 `BaseLayout` 中 `@font-face` 的 `font-weight: 100 800`（可变字体轴范围）。
  - 首页保持单组插画与简介、邮箱和社交链接；主内容在导航与页脚之间自适应居中。全站共享导航宽度和位置，内页使用 `page-shell` 统一纵向留白，页脚只保留必要文字入口。
- 主题切换由两段代码负责：`BaseLayout.astro` `<head>` 里的内联小脚本（首屏前解析 `localStorage` / `prefers-color-scheme` 并上色，避免闪烁），以及打包在 `src/scripts/theme.ts` 的控制器（切换、监听 `astro:before-swap` / `astro:after-swap`、`MutationObserver` 兜底）。改动后请用两种主题分别过一遍所有页面（`pnpm smoke` 不覆盖对比度）。

---

## 3. 模块边界

- **`lib/content.ts`** 是访问 collection 的唯一入口（`getPublishedPosts` / `getAllPosts` / `getFeaturedPosts` / `getThoughts`），同时导出 `Post` 类型与 `byDateDesc` 比较器。
- **`lib/taxonomy.ts`** 只在上面的基础上做派生分组，不直接 `getCollection`，排序一律复用 `byDateDesc`，不重复实现。
- **`lib/search.ts`** 把文章、碎碎念、项目与工具统一成 `SearchDocument`，供 `/search-index.json` 与 `SearchModal` 使用。
- **`config/site.ts`** 的 `SOCIAL_ICONS` 键名必须与 `siteConfig.socials` 的 `name` 一一对应。
- 页面只做「取数 → 组装 → 渲染」；可复用的呈现逻辑下沉到 `components/`。
- 页面拥有的浏览器端逻辑放 `src/scripts/<页面名>.ts`。这类**页面控制器**（`ncm.ts` / `sushi.ts`）必须遵守上面的重入契约；`bootstrap.ts` 那种文档级、事件委托式的模块不受影响。

---

## 4. 内容管线

1. `pnpm new:post` / `new:thought` / `new:project` 生成符合 schema 的骨架（三个脚本共享 `scripts/lib/`）。
2. `src/content/config.ts` 定义 frontmatter schema，字段不合规会在 `astro check` / 构建期报错。
3. `pnpm validate:content` 在构建前做更深一层校验：日期真实性、标签重复、`seriesOrder` 冲突、封面文件是否存在、正文里的本地图片/链接是否可达、公开 slug 是否重复。
4. remark 链按顺序跑：先是 `plugins/remark-figure-images.mjs`，把独立成段的图片升级成带 `width`/`height` 的 `<figure>`（尺寸走 `src/lib/images.ts` 的同一套解析；没有尺寸时手机上的长教程会一路抖），然后是 `plugins/remark-with-base.mjs`，改写内嵌原始 HTML 与链接的根相对 URL。**顺序不能反**：figure 里写出的是未加 base 的 `src`，交给后一步去加前缀。
5. rehype 链：`plugins/shiki-code-tab-meta.mjs`（Shiki transformer，把 ` ```lang tab="…" group="…" ` 读成 `<pre>` 的属性）→ `plugins/rehype-code-tabs.mjs`（把相邻且同 group 的块合成 `role="tablist"` 的 tab 组，单块 group 自动降级为普通代码块）→ `plugins/rehype-wrap-tables.mjs`。插件只产标记与 ARIA，切换与复制在 `src/scripts/article-enhancements.ts`。
6. `pnpm smoke` 检查产物本身：必需路由、JSON-LD、feed、manifest、sitemap、图片 `alt`、体积预算、base 前缀是否完整等。
7. `pnpm smoke` 还做两条**源码级**断言，因为下面这类回归在产物里完全看不出来，`astro check` 也管不到：
   - `src/scripts/ncm.ts` / `sushi.ts` 必须同时具备 `astro:page-load` 重绑定与 `dataset.bound` 重入守卫；
   - `src/scripts/article-enhancements.ts` 必须**先**读 `dataset.enhanced` 守卫、**再**调用清理。

   两者都对应真实发生过的 bug（工具页返回后失效、首访文章进度条与阅读历史全失效）。加断言前请先做反向验证：手动把源码改坏一次，确认 `pnpm smoke` 真的报错——一条从不失败的断言等于没有断言。
8. **正文里不要写 `user@主机.域名` 这种字面量**，哪怕是在代码块里。站点前面挂着 Cloudflare，它的 Scrape Shield → Email Address Obfuscation 会把整页 HTML 里长得像邮箱的字符串（`dev@192.168.80.128` 也算）换成 `__cf_email__` 链接，可见文字变成 `[email protected]`——教程里让人照抄的 `ssh` 命令会当场作废，而 `pnpm build` / `smoke` 在本地完全看不出来。写占位符即可绕过（`ssh dev@<虚拟机IP>`、`ssh -p 2222 dev@localhost`），需要给出具体地址时把地址写进注释或正文，不要紧跟在 `@` 后面。发现线上命令"变样"时，先 `curl` 线上页面搜 `email-protection` 再怀疑别的。

### 订阅源、搜索索引与分享卡

- `rss.xml` 是**全文 feed**（`content:encoded`），`atom.xml` / `feed.json` 只有摘要。这个不对称是有意的：只肯读全文的阅读器只认 RSS，另外两个格式的存在意义就是"轻"。
- 全文 feed 里**不带高亮标记**。Shiki 把每颗 token 都写成一段 `<span style="color:#…">`，XML 转义之后光标签就占了 1,524,208 字节里的 1,273,452 字节。`src/pages/rss.xml.ts` 现在做两件事：`<pre>` 内部整体剥成 `<pre><code>文本</code></pre>`（代码文本本身已经是转义过的，一个字符都不动），以及整篇按 `FEED_ATTRIBUTES` 白名单丢掉 `class` / `style` / `data-*`。实测 1,524,208 → 920,925 字节（gzip 314,813 → 276,818），`class=` / `style=` 归零，484 个 `<pre>` 与代码正文一个不少。
- 这条约束由 `pnpm smoke` 守：`rss.xml` 必须含 `<content:encoded>`，且一旦出现 `&lt;pre …class=`/`style=`、或正文标签带 `class`/`style` 就失败。**不要以"高亮更好看"为由把内联样式放回来**——阅读器不加载本站 CSS，那些标签在那边只是死重。改这个文件时注意正则：第一版用了惰性量词，在 1.3 MB 的正文上回溯爆炸，`pnpm build` 从 4.6 s 涨到 32 s。
- 搜索索引 `search-index.json`（26 篇、raw 455 KB / gzip 191 KB）**不在首屏加载**：`bootstrap.ts` 只在第一次打开搜索（按钮或 Ctrl/⌘+K）时才 import `search.ts`，后者再 fetch 它。正文全量保留是为了命中长教程里的任意一句——截断正文换来的 150 KB，比"搜不到"更贵。
- OG 卡片（`dist/og/*.png`，12 张 1200×630，共 2.3 MB）只为**没有封面**的文章生成。Satori 用的 Noto Sans SC 子集来自 Google Fonts，现在**按字符集哈希缓存在 `node_modules/.cache/og-font/`**：缓存命中则构建完全离线、可重复；改标题/分类/摘要会换 key 并重新拉一次。加缓存之前每次构建都要联网，一次失败就静默少 12 张卡、`dist` 平白少 2.3 MB——同一份源码两次构建因此给出过不同的指纹。

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
pnpm validate:content && pnpm check && pnpm build && pnpm smoke && pnpm perf:audit && pnpm compat:audit
# 然后用 BASE_PATH=/project-pages/ 再跑一次 build + smoke + perf:audit
```

> `perf:audit` 以前只在本地手跑，所以文章体积预算实际上没有守门人（当前数值与标定理由写在 `scripts/perf-audit.mjs` 的常量旁边）；它同时在任何非根 base 下直接 ENOENT（把 `/project-pages/_astro/x.css` 当成 `dist/project-pages/_astro/x.css` 去读）。现在它按 `_astro/` 剥掉 base 前缀、解析不到就直接抛错而不是少算，并且已经进了 CI 的两条路径。
>
> 指纹覆盖的是 `dist/`，**不覆盖 `scripts/`**。改动脚本时请另行对比 stdout、错误消息与生成文件内容。
>
> **触发分工**：`ci.yml` 只在 `pull_request` 和手动 `workflow_dispatch` 上跑，并带 `concurrency`（同一 ref 的旧跑会被取消）；`push: main` 归 `deploy.yml` 独家负责，它跑完同一串检查再上传 Pages。两条工作流都监听 `push: main` 时，每次合并都会把整站完整构建两遍。

指纹只能告诉你「哪个文件变了」，不能告诉你「像素有没有变」。做大范围 CSS 重构时另有一层保护：`.verify/lead-style-diff.mjs` 用 CDP 抓取 19 条代表路由 × 2 个视口 × 2 套主题（76 个用例、约 5.4 万个元素的 130 个计算样式属性），对基线做逐属性比对：

```bash
# 基线从 pnpm preview 的产物抓（源码改动不会影响它）
node .verify/lead-style-diff.mjs --base=http://127.0.0.1:4399 --capture=.verify/style-baseline-dist.json
# 改完再抓一次并比对；有差异以 1 退出
node .verify/lead-style-diff.mjs --base=http://127.0.0.1:4321 --compare=.verify/style-baseline-dist.json
```

它内部对同一状态采样两次，把两次之间会自己动的元素（粒子背景、浮动吉祥物、歌词呼吸点）标记为 `@UNSTABLE@` 并从比对中排除——**空跑两次的差异必须是 0**，否则这次的差异不能作为证据。

### 运行时性能的取证工具（都在 `.verify/perf/`，已被 gitignore）

体积和计算样式都看不见「低端机上卡不卡」，那一层只能实测。这套工具把 `dist/` 用本地 HTTP 起起来，再用 CDP 驱动无头 Chrome，在 **CPU 节流**下按窗口分别采集，并按 trace 事件名归因（`RunTask` / `Commit` / `Layerize` / `UpdateLayoutTree` / `RasterTask` …）——只看 `Performance.getMetrics` 会把「合成器在忙什么」整个漏掉：

| 脚本 | 回答的问题 |
|---|---|
| `measure.mjs` | 多条路由的对照表：空转 / 滚动 / 加载三个窗口的主线程耗时、长任务、体积、DOM 节点数 |
| `idle-probe.mjs` | 空转到底是谁在烧 CPU：把粒子画布、吉祥物、灵动岛逐个摘掉再测一遍 |
| `instrument.mjs` | 打了桩的 rAF 与 Canvas：真实绘制次数、每帧回调耗时、画布后备分辨率 |
| `layers.mjs` | 合成层普查（本机无头模式下 LayerTree 域不上报，暂不可用，保留作记录） |
| `dead-css.mjs` | 产物里永远匹配不到的选择器，以及**反向**的「用到了但没有样式」 |
| `verify-keyframes.mjs` | 关键帧压缩是否逐点等价 |
| `shots.mjs` + `diff-shots.py` | 冻结动画后的整页截图逐像素比对（本次重构：32 张里 24 张完全一致，其余 8 张的差异全部落在两类刻意改动的表面上） |
| `bench.html` + `run-bench.mjs` | 同一帧内几种画法的耗时对比 |

**先量再改**：这套工具第一次跑出来的结论（粒子画布吃掉了空转期间几乎全部主线程，而每帧的绘制本身几乎不花时间）和「把绘制写快一点」的直觉正好相反。

其中「真实绘制次数」这一项已经固化成仓库内的脚本 `scripts/perf/bga-frames.mjs`，因为它守的不是一次性的数字，而是一条长期契约——**粒子层不设帧数上限**：

```bash
pnpm preview            # 另开一个终端
pnpm perf:frames        # 默认量 http://127.0.0.1:4321/
pnpm perf:frames --url http://127.0.0.1:4321/posts/<slug>/ --ms 3000
```

它用 CDP 驱动无头 Chrome，在 `clearRect` 上打桩、只统计 `#atmosphere-canvas` 的清屏次数，再除以墙钟时间：帧率低于 50 fps、画布后备分辨率为 0、页面有 console 报错或异常，任一出现就以 1 退出。无头 Chrome 不做垂直同步，量出来通常远高于 60 fps（本机 1440×900 下约 165 fps），这正好证明没有任何内部限帧——**如果哪天它掉回 60 附近，说明有人又把配速加回来了**。其余脚本是一次性取证工具，留在 `.verify/perf/`。

---

## 6. 样式编译：Tailwind v4 + daisyUI 5

样式入口是 `src/styles/global.css`：`@import 'tailwindcss' source(none)`、`@plugin 'daisyui' { include: ... }`、`@theme`（原 `tailwind.config.mjs` 的扩展）与 `@source`。正文由 `prose.css` 完整定义，不再叠加 typography 插件生成的默认排版。几个必须记住的点：

- **daisyUI 5 不会自动 tree-shake。** 它的 `addComponents` 默认输出全部组件，所以 `global.css` 用**白名单** `include` 只放行本站真正用到的 `modal` / `button` / `badge` 三个组件，外加 `rootcolor`、`svg`、`scrollbar`、`properties`、`rootscrollgutter`、`rootscrolllock` 六个 base 项。**新增组件类前，先把名字加进 `include`**，否则会静默丢失样式（这是白名单相对 `exclude` 黑名单的代价，换来的是「漏加会立刻表现为没样式」而不是「多打了 58 个组件没人发现」）。
  - **实测：改成白名单并没有缩小产物。** 量过 `@layer daisyui*` 的五个子层，改前改后逐字节一致（合计约 13 KiB 裸文本）。原因是 daisyUI 的组件 CSS 被 Tailwind/Lightning 内联进 `@layer utilities` 那个三十多 KiB 的大块里，和自家工具类交织在同一层（块内还嵌着 `@media(width>=80rem)` 的响应式工具类），无法按 daisyUI 边界整段切除。共享包 gzip 前后是 15612 → 15628 B，属于噪声。**所以这个改动是为了语义清晰，不要期待体积收益**；想真正瘦 CSS 只能减少自己写的工具类用法。
- **`source(none)` 关掉 Tailwind 的自动内容探测**，只认 `@source` 明确列出的文件。默认探测会扫整个项目（遵守 `.gitignore`），`pnpm-lock.yaml`、`ARCHITECTURE.md` 里任何一个像工具类的普通词都会被编译成一条没人匹配的规则——实测它负责了产物里 35 条「永不匹配」选择器中的 7 条：`.absolute`、`.backdrop-filter`、`.contents`、`.table`、`.text-white`、`.text-wrap`、`.text-base-content/35`。**剩下那些（`.static`、`.container`、`.blur`、`.filter`、`.transform`、`.italic`、`.resize`）扫不掉**，因为它们出在我们自己 `<style>` 块里的 `position: static`、`filter:`、`transform:` 这些声明文本上——不要为了消掉它们去改扫描配置，那是白费劲。`@source not '../content/**'` 继续把文章正文排除，避免散文里的 `card`、`step`、`stack` 命中 daisyUI 组件名把整套组件拉进产物。
  - 剩下的死选择器（`.verify/perf/dead-css.mjs` 会列出）只有 daisyUI 那几个无法单独排除的（`.modal-*`、`.btn-active`、`.btn-disabled`、`.theme-controller`）和少数确实写在源码 `<style>` 里的词（`blur`、`italic`、`relative`…）。**这个脚本同时会报「用到了但没有样式」**，那是比多几条规则更危险的回归方向；改动样式后跑一次。
- **不要写死 daisyUI 旧版本的变量名。** v5 使用 `--color-primary` / `--color-base-content`（完整 oklch 颜色），不再有 `--p` / `--bc` / `--b1`。工具页里的半透明色统一写成 `color-mix(in srgb, var(--color-primary) 20%, transparent)`。
- **不要用 `oklch(from … l c h / a)` 这种相对颜色写法。** 它和 `color-mix()` 表达同一件事（同一个颜色、指定 alpha），但相对颜色要 Chrome/Edge 122、Safari 18；`color-mix()` 从 Chrome/Edge 111、Safari 16.2、Firefox 113 就有，正好落在基线内。两者等价性已逐像素验证：冻结动画后在 12 个页面上比对 67,622 个颜色值，零差异（主题切换带过渡，采样前若不禁用过渡会采到中间色，产生 1–2/255 的假差异）。
- **`backdrop-filter` 只允许出现在「打开时才存在」的浮层上**：对话框 `::backdrop`、抽屉面板、跳过链接。它曾经也用在三个**滚动期间一直在场**的元素上——返回顶部按钮、代码块复制按钮、粘性文章目录——那意味着每滚一帧，合成器都要把这几块后面的内容重新取景 + 模糊一次。三处现在都是不透明表面（`--fx-surface-strong` / `--fx-surface`），实测差异分别是 15/255 与 3/255。新增滚动期常驻的浮层请用不透明背景。
- 全站共享包仍可能命名为 `dist/_astro/about.*.css`，它由 `BaseLayout` 引入，文件名不代表只服务关于页。`prose.css` 只在文章、碎碎念和隐私页加载，`article.css` 只在文章页加载；工具页继续各自加载私有样式。不要把这些页面专属样式重新放回共享入口。

### 响应式图片（`src/lib/images.ts` + `plugins/remark-responsive-images.mjs`）

图片全部放在 `public/`，没有 `astro:assets` 管线，因此变体是自己用 `sharp` 预生成的静态文件，命名固定为 `<stem>-<width>.<ext>`（例：`public/HP-480.webp`）。三条规则：

- **`imageSrcSet(sitePath, widths)` 只产出站内相对路径**，调用方必须再过 `withBaseSrcSet()`。因为 Markdown 插件看不到 `BASE_PATH`（`/project-pages/` 构建），把 base 转换放在插件里会让同一份逻辑分裂两处。存在性用 `statSync` 逐个探测并缓存——变体不存在就跳过该档，一档都没有就返回 `undefined`，`<img>` 退化成单 `src`，不会产出坏 URL。
- **原图永远作为最大档追加**（用 `getPublicImageSize()` 读头部得到的真实宽度）。这样 `srcset` 的最小档由现有文件决定，最大档永远是原图，不会因为漏生成某个尺寸而降低上限。
- **`remark-responsive-images` 只管正文里的 `<img>`**（含 `node.type === 'html'` 的裸标签），模板里的 `<img>` 由各页面自己传 `srcset`。它必须排在 `remarkWithBase` **之前**，且遇到已带 `srcset` 的标签直接跳过。**这条是为同一个文件既当封面又当正文插图的情况准备的**：两处 `src` 若经过不同处理得到不同 URL，浏览器会下载两份；实测 `synthion-cyanotype` 的封面与正文插图现在都解析到 `cyanotype-736.webp`，只下载一次。
- `sizes` 是估算值，改版式后要重新量。实测结果：首页 hero 在 1440×900 / DPR1 下选中 `HP-480.webp`（CSS 宽 304）；文章封面在 46rem 容器里选中 `736w`；mascot 桌面 1400px 以上选 `176w`（CSS 宽 74）。
- **mascot 是 `loading="lazy"`**：它在首页和 ≤1399px 下都是 `display:none`，此前仍会以 `fetchpriority="low"` 下载 30 KiB。`fetchpriority` 只降优先级，不阻止请求，`<img>` 的请求在解析到标签时就发出——只有 `lazy` 或「用 JS 事后插入」能避免。

**验收这类改动的方法是截图对比，不是看数字。** 用同一台静态服务器分别服务改动前后两份 `dist` 快照（不要用 `astro preview`，它自带压缩会污染体积读数），CDP 在固定视口 + `deviceScaleFactor` 下截图，然后逐像素差分。判据要设噪声地板：同一版本连拍两次，`home-1440` 因为 atmosphere canvas 在动会有 ~3% 的像素差，其余页面 <0.02%。实际结果（首页 483.1 → 323.2 KiB，-33%）里，`home-390` 的差异 18.8% 全部集中在 hero 圆形人像内部，热力图其余区域为纯 0；人像区域的 SSIM 是 0.981、平均绝对误差 1.94/255。

**弱网加载策略**：首屏只预加载正文 Roboto，展示字体 Playfair 交给 CSS 按需发现，保持 `font-display: swap`。`src/lib/network.ts` 统一识别省流、2G/3G 或低于 1.5 Mbps 的连接；这些连接不自动导入粒子背景和播放器，播放器在首次交互时加载，首次点击会在模块就绪后继续打开。正常连接的装饰模块在 `load` 后空闲时加载。链接预取改为实际按下时触发，避免经过链接就与正文抢带宽。

### 文章增强与离线缓存

`article-enhancements.ts` 负责文章级的初始化和清理，并把同一个 `AbortSignal` 交给代码块和灯箱模块。阅读进度只按 `[data-article-body]` 正文范围计算，不包含相关文章和评论；目录使用缓存的标题位置与共享滚动帧更新，滚动时不读取布局。图片加载、字体就绪、折叠内容和 `ResizeObserver` 负责重新测量；切页、隐藏页面或关闭页面时保存待写入的阅读进度。

评论区在正常网络下接近视口时自动加载；省流、2G/3G 或低带宽连接只显示「加载评论」按钮，点击后才请求 Giscus。脚本下载失败时恢复按钮，允许重试。

`public/sw.js` 按 Service Worker 的作用域划分缓存，只清理本站拥有的旧版本。页面请求使用网络优先，静态资源使用缓存优先并后台更新，所有缓存写入均由 `event.waitUntil()` 保活。音视频、Range 请求、非 GET 请求及作用域外的资源不进入缓存；运行时缓存保持 120 项上限。

弱网缓存采用分层策略：带 hash 的 `_astro/` 资源和自托管字体命中后直接返回，避免每次重访都重新联网；字体内容变化时同步升级 Service Worker 缓存版本。普通图片继续后台校验。页面仍优先联网更新，但已缓存页面最多等待 2.5 秒即可打开，网络请求通过 `waitUntil` 继续刷新；未缓存页面不受此超时限制。缓存策略用 `pnpm test:cache` 覆盖根路径、项目子路径、慢连接、离线和媒体绕过。

### 粒子背景（`src/scripts/atmosphere.ts`）

这一层是**全站唯一在加载后还一直跑的东西**。按站主要求它**不设 FPS 上限**：每个原生动画帧画一次，144 Hz / 240 Hz 面板按面板自己的节奏播放，不再被压到 60 Hz 的台阶上。`elapsed` 累加的是真实 delta，所以 5 秒周期是墙钟时间——24 Hz 与 240 Hz 上粒子移动的每秒距离一致，无上限只改变平滑度，不改变速度。

「无上限」不等于「无预算」，现在守住的是**不为同一帧请求两次**：

1. **只走 rAF**：没有定时器配速、没有 `TARGET_FPS`、没有自适应降帧。一次绘制只对应一个动画帧；面板自己跳过的帧不会由脚本补回来，所以高刷屏上的代价随刷新率线性增长，这是无上限的必然结果，不是回归。旧的 60fps + 定时器方案（含 `frameInterval` 与 24fps 退让）已整体删除，`perf:audit` 会拦住它们被重新引入。
2. **弱设备只画静帧**：`deviceMemory ≤ 2` 或 `hardwareConcurrency ≤ 2` 时停在 `STILL_PROGRESS`（0.34，循环里圆最密的一刻），不启动循环；`prefers-reduced-motion: reduce` 同样只画静帧。两者都是「不跑循环」，不是「跑慢一点的循环」。
3. **后备缓冲最多 1 个设备像素 / CSS 像素**：这层是 11% alpha 的淡淡一片，砍掉的高分辨率填充与每帧纹理上传在视网膜屏上是白赚的。
4. 关键帧数据是**列式存储 + 按 track 切 `Float32Array` 视图**。`src/data/atmosphere-keyframes.json` 只存每个属性到「最后一个还在变的帧」（`k[track][property]`），加载时补回 21 帧——**补回去是必须的**：采样器把给它的关键帧摊在整个 5 秒上，只截断不补齐会让本该停下的粒子继续漂。等价性由 `.verify/perf/verify-keyframes.mjs` 逐点比对（87 track × 4 属性 × 2001 个采样点）。

每帧绘制本身仍然几乎不花钱（87 个椭圆的主线程耗时 < 0.1 ms，见 `.verify/perf/bench.html`）；钱花在「帧」的流水线上，而无上限模式就是明确选择按面板刷新率付这笔钱。旧版的对照数据（`/posts/maimai-dx-hdd-setup/`，4× CPU 节流，3 秒空转：主线程 `TaskDuration` 0.446 s → 0.084 s）属于已删除的限帧实现，不再代表当前行为。

**改这个文件后请复核两层**：`pnpm perf:frames`（`scripts/perf/bga-frames.mjs`，真实绘制次数与帧率——掉到 60 fps 附近就说明配速回来了）和 `.verify/perf/` 里的工具（`idle-probe.mjs` 空转开销与事件归因、`instrument.mjs` 每帧回调耗时、`measure.mjs` 多条路由的对照表）。`pnpm perf:audit` 只守住几条文本身就能表达的约束（必须每帧走 rAF、不许定时器配速或 FPS 上限、不许 `pauseForScroll`），它守不住「帧是不是太多了」——在当前设计里，帧多不多由面板决定。

### 滚动路径

- **滚动回调统一走 `src/lib/scroll.ts` 的 `onScrollFrame`**，不要再各自 `addEventListener('scroll', …)`。一次手势只排一个动画帧，订阅者按注册顺序跑；没有订阅者的页面（归档页、工具页）一个监听都不装。返回顶部按钮、文章阅读进度都挂在它上面。
- **滚动帧里不许读布局。** `document.documentElement.scrollHeight`、`getBoundingClientRect()` 这类读取会强制解析布局，每个滚动帧都读一次就是每帧一次 reflow。文章进度条的高度改在首屏、`resize` 和 `load` 时各测一次（`measure()`）；`perf:audit` 会切开 `updateProgress` 的函数体，里面出现 `scrollHeight` / `getBoundingClientRect` / `offsetHeight` / `clientHeight` / `offsetTop` 就直接失败。
- **只在状态真的变了才写 DOM。** 返回顶部按钮原来是每个滚动事件都 `classList.toggle` 一次，答案一样也照样让整个文档的样式失效；实测滚动期间的 `EventDispatch` 因此是 46.5 ms，加上「变了才写」之后降到 13.9 ms。
- **页面级监听一律委托。** 文章页的 41 个代码块曾经各带一个复制监听（每个一个闭包），现在整个 `<article>` 一个委托监听 + 一个 `AbortController` 管全部拆卸。
- **`Layerize` 是滚动 trace 里最贵的一项（约 285 ms / 2.6 s 滚动窗口，4× 节流），但它是「每帧提交」本身的代价，不是可以调掉的。** 试过给 `.reading-progress` 加 `will-change: transform`（理由是它的 transform 每帧都改，可能引起层树重建）：`Layerize` 287.5 → 282.0 ms，事件次数一模一样（417），滚动总耗时 0.772 → 0.770 s，全在噪声里。**结论是不要加**——那会常驻提升一个合成层，换不到任何东西。真要降这部分只能降帧数，也就是只用 `lib/scroll.ts` 做节流、不要在滚动回调里堆积工作。

### 动态岛（头部音乐胶囊）

- 结构与交互在 `src/components/layout/SiteHeader.astro` + `src/scripts/player.ts`；**样式全部归 `src/styles/island.css`**，`global.css` 里不应再出现任何 `.music-island` / `.dynamic-island` / `.header-action` 规则。同一个选择器在两个文件里各写一遍，就得靠 `!important` 打架——这正是重构前的问题。
- 同一个组件里还渲染主站导航行 `.site-nav`：它是**文档流里的一行**（左侧站名 + 右侧文字链接），不是钉在视口上的图标栏，样式属于站点版式所以写在 `global.css`。这一行用 `padding-top` 为灵动岛预留出顶部那条带，`#main-content` 因此不再自带顶部内边距；改动顶部间距时先看这里，否则灵动岛会压住标题。
- 形态切换只改 `data-open`、`data-player-state`、`data-visualizer`、`data-volume-open`、`data-loading` 这几个属性，动画交给 CSS 过渡；JS 不写内联几何。展开/收起必须**可中断**：中途反向点击要从当前几何继续，而不是先塌成空壳。
  - `data-loading` 只表示 `idle` / `indeterminate`，由真实媒体播放与缓冲事件驱动。`data-playback-active` 同步播放/暂停按钮的图标与无障碍名称，缓冲时也可暂停；JS 不写动画几何。
  - 曾经还有第五个属性 `data-cue-active`（滚动到新章节时胶囊变成「小节提示」）。那套东西的触发条件是标记里的 `[data-island-cue]`，而**全站没有任何一个页面写过这个属性**，所以 `bindSectionCues()` 永远在第一行返回：对应的 JS、CSS 和标记都是死的，已一并删除（标记里也没有 `data-live-progress`，播放器里查它的那段同样是死的）。新增这类「滚动提示」请用 `lib/scroll.ts`，并给它一个真实存在的触发源。
- **视觉规格对齐 iPhone 的灵动岛**，这不是随意调的，改之前先理解这几点：
  - 背景是**不透明纯黑**（`--island-bg: #000`），没有边框、没有 `backdrop-filter`。真机上它本来就是屏幕挖孔，不是一块玻璃面板。所以它和 `paper` / `paper-dark` 两套主题都无关。
  - 比例：紧凑态约 **4.9:1**（196×40，完全胶囊，圆角 = 高度一半）；展开态约 **2.1–2.3:1**（372×176，圆角很大）。这两个数字定了，里面所有尺寸都靠 `cqw` 跟着缩放——面板内的一切用 `cqw` 而不是 `px`，改宽度就是整体缩放。
  - 紧凑态是**两端分置**：左边专辑封面（26px、圆角 6px），右边一小排白色胶囊波形，中间留空（真机那里是摄像头）。不要把两者居中凑在一起。
  - 展开态的信息层级是**歌名（白色粗体）→ 歌手（次级灰）→ 歌词（最弱）**，而不是反过来。
  - 波形是 **canvas 上的 `apple-like-waves` 胶囊频谱**（`src/scripts/alwave.ts`，MIT，源自 `kmgcc/apple-like-waves`；两个包都没发到 npm，所以算法是 vendor 进仓库的，不是依赖）。紧凑态和展开态各一块 canvas、**共用同一个 `SpectrumAnalyzer`**：同一个六带切分、同一套弹簧，所以展开只放大几何，节奏一模一样。管线是「AnalyserNode 取 2048 点**时域** PCM → Hann 实数 FFT → 对数八度分带 → 三拍参考包络的起音加成 + 慢跟随门控 → 二阶阻尼弹簧（ζ=0.83、ω≈27.5 rad/s，过冲约 0.9%）」，不是浏览器的 `getFloatFrequencyData`：`minDecibels`/`maxDecibels` 那套已经无意义，`smoothingTimeConstant` 保持 0，平滑只由引擎的 release 曲线负责。
    - **静止态是「圆点」而不是零高**：胶囊的最矮高度等于自身宽度，所以暂停时这一排会平滑塌缩成六个点（用更慢的临界阻尼求解器，`pauseDuration` 0.6），塌完之后 `data-visualizer` 才转 `idle` —— 冻结在最后一帧能量上是假信息，会声称有音频。因此**没有 idle 剪影**：canvas 没被点亮之前就是透明的，胶囊回落到封面。`data-visualizer` 仍只有 `live`/`idle`/`off`，仍然是「只有 live 会发光」。
    - CSS 只拥有**盒子**（紧凑 22×18，展开 6.4cqw×7cqw，`display:block`），胶囊宽度、间距、dpr、maxHeightRatio 全部由 `player.ts` 按盒子的 `clientWidth/clientHeight` 现算并写进 renderer 字段（`ResizeObserver` 跟展开动画）。这是「JS 不写内联几何」的延伸：canvas 的内部坐标不是样式，CSS 里没有 `--visualizer-level` 这种标量了。
    - 颜色仍取 `--island-wave`（`applyCoverAccent()` 从封面算出），但 canvas 是位图，token 变了必须显式 `setColor` 重推一次——`syncVisualizerColor()` 在 canvas 初始化与 accent 落定时各读一次，不每帧 `getComputedStyle`。
    - 渲染循环跟着播放状态自己收尾：playing 时排帧并 `setVisualizerMode('live')`；暂停/缓冲/结束只把目标换成全 0 交给弹簧，等 `renderer.settled` 为真就停止排帧并转 `idle`。没有「空转的 rAF」。
- **默认音源改为 MP3（约 5.9 MiB），由原生媒体元素流式播放**：点击播放才设置 `audio.src`，浏览器用 HTTP Range 与自身媒体缓存边收边播。不再先 `fetch` 完整约 69 MiB FLAC、拼 Blob、写一份全曲缓存后才开始。无损原文件保留，只允许确认解码失败时尝试一次；网络错误不会触发更大的音源下载。
  - 悬停、打开面板不下载音频；歌词在打开时首次加载并复用 Promise。播放元素仍通过 `transition:persist` 跨页保留。
  - `playing` 清除加载层，`waiting` 显示加载状态，`pause` / `ended` / `error` 退出加载。加载层只显示 `Now loading...`，字体与首页 ID 标题一致（`--font-display` / Playfair Display，`--weight-serif`）；详细播放状态保留在播放器的无障碍状态提示里。
  - 加载视觉延后 180ms 出现以避免快速播放时闪烁，但不延迟播放。展开时仅覆盖标题区域，保留进度条、时间和暂停控件。
  - `public/sw.js` 不拦截音视频及 Range 请求，避免二次全量下载。
- **加载光环是固定胶囊上的流光**：2px 光带与内孔都从 `--island-radius` 派生，封面强调色由 `--island-wave` 提供。用注册的角度属性 `--island-ring-angle` 改变渐变方向，不能旋转整个矩形元素，否则圆角会脱离壳体。文字居中，不搭配额外波形或第二行文案；流光由 CSS 完成，没有 JS 动画循环。
- **减少动态效果**：`prefers-reduced-motion: reduce` 完全停止加载流光，保留 120ms 淡入淡出以及已有的短形态过渡。
- 播放器模块不能进入文档首屏的脚本链：正常网络在页面空闲后导入，弱网在用户首次交互时导入；`pnpm perf:audit` 会断言播放器没有直接挂在文档里。
  - 频谱算法单独成块，仅在真实 `playing` 事件后导入。打开面板只需要播放器控制器；音频不等待 FFT 或画布渲染器下载。频谱模块到达前不启动空转动画帧，加载失败也不打断音频。
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
