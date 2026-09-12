# 架构说明

> 本站（Bad0RANG3.github.io）的代码组织与验证方式速查：目录该放什么、模块边界在哪、改完怎么验证。

---

## 1. 概览

Astro 5 静态站点（`output: 'static'`），Tailwind 3 + daisyUI 5，部署到 GitHub Pages。

两条贯穿全局的设计约束：

1. **base 感知**。站点既要跑在用户主页根路径 `/`，也要能跑在项目页 `/repository/`。所有页面与组件里的内部路径都保持**站点相对**（如 `/posts/`），只在渲染/输出的边界上通过 `withBase()`（`src/lib/urls.ts`）转换。CI 会用 `BASE_PATH=/project-pages/` 再构建一次来验证这一点。
2. **构建产物必须可复现**。同一份源码构建出的 `dist/` 逐字节一致，因此 `pnpm dist:fingerprint` 可以作为重构的精确判据（见第 5 节）。

---

## 2. 目录结构

```
├── astro.config.mjs          站点与构建配置
├── tailwind.config.mjs       Tailwind/daisyUI 配置（见第 6 节的坑）
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
    │   ├── ui.ts                 ANIMATION / LAYOUT / STAGGER
    │   └── projects.ts           projects
    ├── content/                Astro 内容集合（路径由框架约定，不要移动）
    │   ├── config.ts             posts / thoughts 的 frontmatter schema
    │   ├── posts/*.md
    │   └── thoughts/*.md
    ├── data/                   运行时数据载荷，按所属功能分目录
    │   └── tools/pjsk-stamp.json
    ├── layouts/BaseLayout.astro
    ├── lib/                    运行时工具，只放这一层
    │   ├── content.ts            集合读取（posts / thoughts）+ 单篇统计
    │   ├── taxonomy.ts           tag / category / series / archive 分组视图
    │   ├── search.ts             搜索文档构建
    │   ├── date.ts               日期格式化
    │   └── urls.ts               withBase / siteUrl
    ├── pages/                  路由（目录结构即 URL 结构）
    └── styles/
        ├── global.css            设计 token + 全局组件类（视觉系统的唯一来源）
        └── tools/*.css           各工具页私有样式
```

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

## 6. 已知构建陷阱：Tailwind 会扫描 `.ts` 与注释

`tailwind.config.mjs` 的 content glob 是 `./src/**/*.{astro,ts}`。Tailwind 按**原始文本**提取 class 候选，规则很宽松，于是：

- `.ts` 文件里的**标识符、字符串、属性名，甚至注释里的普通英文单词**都会成为候选；
- daisyUI 5 会为命中的候选生成整套组件样式。

实测过的两个例子：

| 来源 | 后果 |
|---|---|
| 某个死文件里的 `timeline:` 属性名 | 凭空生成 10 条 daisyUI `.timeline` 规则（约 3 KB），无任何元素使用 |
| `SOCIAL_ICONS` 文档注释里的单词 `list` | 凭空生成 10 条 daisyUI `.list` 规则（约 2.5 KB） |

**实践建议**：新增/改写 `.ts` 或注释后，若指纹出现只增不减的 CSS 差异，先检查是否引入了 `list`、`timeline`、`filter`、`table`、`card`、`btn`、`badge`、`modal`、`drawer`、`menu`、`tab` 这类与组件同名的裸词。需要保留的字面量可以写进 `tailwind.config.mjs` 的 `safelist`（现有 `lyric-block` 等即为此用途）。

更彻底的解法是收窄 content glob，但会一次性改动大量既有样式，属于独立议题。

---

## 7. 脚本约定

- **参数解析必须放在 `try` 内**（配合模块作用域的 `let options;`）。放在 `try` 之外抛出时会打印 Node 栈追踪，而不是统一的 `<script> failed: <message>`。
- 共享逻辑放 `scripts/lib/`：`paths.mjs`（rootDir / fromRoot）、`fs.mjs`（walk / isFile）、`args.mjs`（parseFlags / parseOptions）、`content.mjs`（日期与 slug 校验）。不要在各脚本里重复实现。
- 路径一律用 `fromRoot(...)` 拼接，不要用 `process.cwd()`——脚本要能在任意工作目录下运行。
- `parseFlags` 与 `parseOptions` 会把 `--max-image-size` 这类键转成 camelCase（`options.maxImageSize`）；未知参数会直接报错，避免 CI 里的拼写错误被静默放过。
- **两个解析器都必须跳过裸 `--`。** pnpm 只在 Windows 上吞掉这个分隔符；在 Linux（也就是 CI）上它会原样传给脚本。所有用法提示里印的都是 `pnpm <script> -- <flag>` 这种形式，少了这个跳过逻辑，该形式在 CI 上会以 `Unknown argument: --` 失败。这正是 `ci.yml` 里 "Validate project Pages base path` 这一步失败的原因——而它在项目建立起的前 20 次运行中从未真正执行过任何断言，因为解析阶段就先挂了。**断言全在解析之后，所以参数解析的健壮性直接决定这些检查是否真的生效。**
- 改动脚本后**指纹比对帮不上忙**（它只覆盖 `dist/`），请另行对比 stdout、错误消息与生成的文件内容。
