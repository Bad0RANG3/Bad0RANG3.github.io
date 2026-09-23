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
│   └── remark-with-base.mjs    在 Markdown 渲染前改写原始 HTML 里的根相对 URL
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
│   └── dist-fingerprint.mjs    pnpm dist:fingerprint
└── src/
    ├── components/            全部按域分目录，不往 components/ 根目录放文件
    │   ├── blog/                PostCard、PostMeta、TagList、ArticleTools、ArticleEnhancements、Comments
    │   ├── icons/               Icon.astro（唯一图标入口）
    │   ├── layout/              SiteHeader、SiteFooter、MobileDrawer
    │   ├── profile/             ProfileOverviewCard、ProjectCard、ResourceGrid
    │   ├── search/              SearchModal（自带索引加载与筛选逻辑）
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
    ├── data/                   运行时数据载荷，按所属功能分目录
    │   └── tools/pjsk-stamp.json
    ├── layouts/BaseLayout.astro
    ├── scripts/                浏览器端入口，由 Astro 打包为可缓存模块
    │   ├── theme.ts              主题控制器（首屏由 BaseLayout 内联小脚本兜底）
    │   ├── atmosphere.ts         樱花背景（精灵缓存 + 约 30fps）
    │   ├── player.ts             动态岛音乐播放器
    │   ├── site.ts               页面进入动画 / 表格包裹 / 回到顶部
    │   └── service-worker.ts     注册 Service Worker
    ├── lib/                    运行时工具，只放这一层
    │   ├── content.ts            集合读取（posts / thoughts）+ 单篇统计
    │   ├── taxonomy.ts           tag / category / series / archive 分组视图
    │   ├── search.ts             搜索文档构建
    │   ├── date.ts               日期格式化
    │   └── urls.ts               withBase / siteUrl
    ├── pages/                  路由（目录结构即 URL 结构）
    └── styles/
        ├── theme.css              设计 token（亮/暗两套）——颜色的唯一来源
        ├── global.css             Tailwind v4 入口（@import / @plugin / @theme / @source）+ 全局组件类
        └── tools/*.css           各工具页私有样式
```

字体自托管在 `public/fonts/`：`jetbrains-mono-*`（拉丁，UI/等宽，由 `BaseLayout` 全局声明）与 `yuruka-*`（仅由 `tools/pjsk-stamp` 以 `YurukaStd` 家族声明），不依赖任何外部 CDN。

### 放置规则

| 你手上的东西 | 放哪里 |
|---|---|
| 内部 URL 字面量 | `src/config/routes.ts`，渲染时套 `withBase()` |
| 站点元信息 / 作者 / 社交链接 / 关于页数据 | `src/config/site.ts` |
| 动效时长、布局阈值、级联延迟 | `src/config/ui.ts` |
| 读取 content collection | `src/lib/content.ts` |
| 由 frontmatter 派生的分组视图 | `src/lib/taxonomy.ts` |
| 只在构建期跑、不被页面 import 的代码 | `plugins/` |
| 只被某个工具页使用的大块数据 | `src/data/tools/<tool>.json` |
| 可被多个脚本复用的逻辑 | `scripts/lib/` |

`src/lib/` **不放**构建期插件；`src/` **不放**脚本；组件**不裸放**在 `components/` 根目录。

### 主题与颜色

- **`src/styles/theme.css` 是颜色的唯一来源**：`paper`（亮色，SSR 默认）与 `paper-dark`（暗色）两套 token 都在这里定义，`BaseLayout.astro` 在 `global.css` 之前引入。
- 组件**不允许**写死与主题相关的颜色（如 `#fff`、`text-white`）。文字用 `--fx-text` / `--color-base-content`，次要文字用 `--text-dim` / `--text-faint`，面板用 `--surface*` / `--fx-surface*`，边框用 `--line*` / `--fx-line`。代码块在两种主题下都是深底浅字，统一用 `--code-block-bg` / `--code-block-text`。
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

---

## 6. 样式编译：Tailwind v4 + daisyUI 5

样式入口是 `src/styles/global.css`：`@import 'tailwindcss'`、`@plugin '@tailwindcss/typography'`、`@plugin 'daisyui' { exclude: ... }`、`@theme`（原 `tailwind.config.mjs` 的扩展）与 `@source`。几个必须记住的点：

- **daisyUI 5 不会自动 tree-shake。** 它的 `addComponents` 默认输出全部组件，所以 `global.css` 用 `exclude` 明确排掉了本站未使用的约 58 个组件。**新增组件类前，先用渲染后的 HTML 确认组件名已在 `exclude` 里移除**，否则会静默丢失样式。当前实际用到的是 `button` / `badge` / `modal`。
- **Tailwind v4 默认扫描整个项目**（遵守 `.gitignore`）。`@source not '../content/**'` 把文章正文排除，避免散文里的普通词（`card`、`step`、`stack`…）命中 daisyUI 组件名、把整套组件样式拉进产物。
- **不要写死 daisyUI 旧版本的变量名。** v5 使用 `--color-primary` / `--color-base-content`（完整 oklch 颜色），不再有 `--p` / `--bc` / `--b1`。工具页里的半透明色统一写成 `oklch(from var(--color-primary) l c h / .2)`，或 `color-mix()`。
- 产物仍集中在单个 `dist/_astro/about.*.css`（约 155 KB，gzip 约 26 KB），工具页样式单独成文件。

修改样式后如果只想确认体积变化，直接看 `dist/_astro/about.*.css` 的原始/ gzip 大小即可；`pnpm dist:fingerprint` 会如实列出差异。

---

## 7. 脚本约定

- **参数解析必须放在 `try` 内**（配合模块作用域的 `let options;`）。放在 `try` 之外抛出时会打印 Node 栈追踪，而不是统一的 `<script> failed: <message>`。
- 共享逻辑放 `scripts/lib/`：`paths.mjs`（rootDir / fromRoot）、`fs.mjs`（walk / isFile）、`args.mjs`（parseFlags / parseOptions）、`content.mjs`（日期与 slug 校验）。不要在各脚本里重复实现。
- 路径一律用 `fromRoot(...)` 拼接，不要用 `process.cwd()`——脚本要能在任意工作目录下运行。
- `parseFlags` 与 `parseOptions` 会把 `--max-image-size` 这类键转成 camelCase（`options.maxImageSize`）；未知参数会直接报错，避免 CI 里的拼写错误被静默放过。
- **两个解析器都必须跳过裸 `--`。** pnpm 只在 Windows 上吞掉这个分隔符；在 Linux（也就是 CI）上它会原样传给脚本。所有用法提示里印的都是 `pnpm <script> -- <flag>` 这种形式，少了这个跳过逻辑，该形式在 CI 上会以 `Unknown argument: --` 失败。这正是 `ci.yml` 里 "Validate project Pages base path` 这一步失败的原因——而它在项目建立起的前 20 次运行中从未真正执行过任何断言，因为解析阶段就先挂了。**断言全在解析之后，所以参数解析的健壮性直接决定这些检查是否真的生效。**
- 改动脚本后**指纹比对帮不上忙**（它只覆盖 `dist/`），请另行对比 stdout、错误消息与生成的文件内容。
