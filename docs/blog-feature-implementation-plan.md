# Bad0RANG3's Studio 博客功能扩展实施文档

> **文档状态：已实施，发布前验收记录已更新（2026-08-12）**
>
> “都弄上”已确定为本项目的功能方向：在不引入数据库和登录系统的前提下，覆盖主流静态博客能力，并把个人主页展示放在第一优先级。本文同时记录当前代码完成度、剩余风险和验收顺序；不要把“规划中”误读为“已经上线”。
>
> **目标**：在继续部署到 GitHub Pages 的前提下，把博客升级为以个人主页展示为核心、兼顾长期写作与内容发现的静态个人站。核心功能不依赖数据库、服务器或登录系统；优先使用 Astro 构建时生成、原生浏览器 JavaScript、`localStorage`、GitHub Actions 和仓库内静态资源。
>
> **适用仓库**：`Bad0RANG3/Bad0RANG3.github.io`
>
> **关联调研**：[GitHub Pages 静态博客功能调研](./github-pages-blog-feature-research.md)

---

## 1. 产品定位与成功标准

### 1.1 产品定位

本站不是“功能越多越好”的后台型博客，而是：

> **先让访问者快速认识我，再让访问者方便地阅读、探索和记住我的内容。**

首页承担个人主页职责；文章、项目、碎碎念和工具页共同构成个人作品集与知识档案。

### 1.2 优先级

| 优先级 | 目标 | 判断标准 |
|---|---|---|
| P0 | 个人主页展示 | 首屏能回答“你是谁、在做什么、做过什么、如何联系你” |
| P0 | 静态可用 | 关闭 JavaScript 后仍能浏览首页、文章、项目、标签和归档 |
| P0 | 内容可发现 | 搜索、标签、系列、归档和探索页能把读者带到相关内容 |
| P1 | 阅读体验 | 目录、进度、代码复制、图片放大、相关文章和本地书架可用 |
| P1 | SEO 与分享 | canonical、robots、sitemap、RSS、JSON-LD、社交卡片完整 |
| P1 | 可维护性 | 新建文章、校验内容、构建和部署有明确命令与 CI 门禁 |
| P2 | 社区互动 | Giscus 延迟加载；无评论服务时正文不受影响 |
| P2 | 离线与个性化 | PWA、离线降级、本地反应、字体和主题偏好 |
| P3 | 外部数据 | GitHub 动态数据、统计、邮件订阅等仅作为可选增强 |

### 1.3 不做虚假功能

在只有 GitHub Pages 的约束下，不实现或不伪装以下能力：

- 跨访问者累计浏览量、点赞数或排行榜；
- 用户注册、登录、个人资料和后台管理；
- 需要私密 API Key 的浏览器端请求；
- 没有真实数据来源的“实时状态”；
- 把 `localStorage` 本地收藏误称为全站收藏。

所有本地状态必须标注：**“仅保存在当前浏览器/本设备”**。

---

## 2. 当前工程基线

### 2.1 技术栈与部署方式

- Astro 5 + TypeScript；
- Tailwind CSS + daisyUI；
- `output: 'static'`，页面通过 `getStaticPaths()` 在构建时生成；
- Markdown 内容集合：`posts`、`thoughts`；
- GitHub Actions 构建、上传 Pages artifact 并部署；
- 站点地址：`https://bad0rang3.github.io`；
- 包管理器固定为 `pnpm@9.15.4`，CI 使用 Node 22。

### 2.2 当前已完成

#### 工程与部署

- `output: 'static'`，GitHub Actions 已构建并部署 Pages artifact；
- `pnpm@9.15.4`、Node 22、`pnpm install --frozen-lockfile` 已固定；
- CI 已执行 `validate:content`、`check`、`build`、`smoke`，并额外模拟项目 Pages 的 `BASE_PATH=/project-pages/` 构建；部署工作流也在上传 artifact 前执行内容校验与 smoke；
- 当前站点为用户主页仓库，地址为 `https://bad0rang3.github.io`；
- `src/lib/urls.ts` 通过 `withBase()` 和 `siteUrl()` 统一输出站内路径；`src/lib/remark-with-base.mjs` 还会在构建时改写 Markdown 原始 HTML 内的根路径资源，兼容用户主页根路径和项目 Pages 子路径；
- 最近一次根路径本地验证生成 59 个静态页面；项目 Pages 子路径 `BASE_PATH=/project-pages/` 也纳入 CI 构建与 smoke 覆盖。

#### 个人主页与作品展示

- `src/config/profile.ts`：身份、状态、简介、Now、时间线、技术栈和社交信息；
- `src/config/projects.ts`：项目名称、类型、状态、技术标签、亮点、案例 slug 和主入口链接；
- `src/components/profile/ProjectCard.astro`、`src/pages/projects.astro`：项目卡片、无 JS 时完整可读的项目总览，以及按类型、状态、标签进行的浏览器端渐进筛选；
- `src/pages/projects/[slug].astro`：每个配置项目均构建为站内案例页，展示定位、亮点、关联项目和真实的工具/文章入口；
- 首页已包含 Hero、身份介绍、状态、统计、精选项目、最近文章、Now、技术栈、时间线、碎碎念和联系 CTA；
- 主导航已有文章、项目、碎碎念、工具、归档、关于等入口。

#### 文章、发现与本地状态

- Frontmatter 已支持 `coverAlt`、`series`、`seriesOrder`、`canonical`、`noindex`、`lang`；
- 文章页已有阅读时间、字数、TOC、阅读进度、收藏、分享、代码复制、图片 lightbox、上下篇和相关文章；
- TOC 当前章节高亮和阅读历史百分比已通过 `localStorage` 实现；
- 构建时搜索索引已覆盖文章、碎碎念、项目和工具，支持多关键词、评分和高亮；
- `/tags/`、`/series/`、`/explore/`、`/library/`、`/privacy/` 已存在；
- RSS、Atom、JSON Feed、sitemap、manifest、service worker 和离线页已有基础版本。

#### 工程化与隐私边界

- `new:post`、`new:thought`、`new:project` 脚手架已完成；
- `validate:content` 检查 frontmatter、slug、系列和资源；
- `smoke` 检查核心页面、项目案例页、搜索索引、JSON Feed、manifest、JSON-LD、Giscus 惰性加载、Service Worker、图片 alt、字体/CDN 禁用项、无障碍 CSS、UTF-8 替换字符和静态资源体积预算；
- Giscus 已改为用户点击后加载，失败时显示降级提示；
- Google Fonts、jsDelivr 字体和评论预连接已移除；
- 隐私页明确说明 GitHub Pages、localStorage、PWA、Giscus、外部资源和“不做统计/广告”。

### 2.3 当前收尾项与已知风险

本轮已完成的收尾：

1. `.astro-stale/` 和根目录 `.tmp-post.txt` 已删除；此前 duplicate content id 是陈旧 Astro 缓存导致，清理后 `pnpm check` 为 0 errors / 0 warnings / 0 hints；
2. 受影响的源码已检查为 UTF-8，`SearchModal.astro`、`constants/index.ts`、`lib/content.ts` 和 `search-index.json.ts` 的 BOM 已移除；终端显示异常不能作为编码判断依据；
3. BaseLayout 已补齐 Person、WebSite、WebPage、BlogPosting、BreadcrumbList JSON-LD 以及 `inLanguage`、`articleSection`、`keywords`、Open Graph/Twitter 图片 alt；
4. `withBase()` 已应用于站内导航、卡片、文章、搜索、Feed、manifest、Service Worker 和离线回退，项目 Pages 模拟构建与 smoke 已通过；
5. 已用 Edge Headless 对项目页完成基础 DOM 验收：主题初始化成功，项目筛选标记存在。Giscus 仍仅由点击事件动态插入；构建产物门禁已确认首页和文章页不会以外链 `<script src>` 形式预加载 Giscus，并禁止 Google Fonts 与 jsDelivr。仍需在真实交互浏览器中验收 PWA 安装/缓存升级/离线回退、Giscus 点击加载、localStorage 恢复、移动端、键盘操作、无 JS、暗色模式和 reduced-motion；
6. `docs/blog-feature-implementation-plan.md` 之外的研究文档可能保留历史性建议，后续以本文“当前实现”和代码为准。

---

## 3. 静态部署约束与架构原则

### 3.1 GitHub Pages 能做什么

GitHub Pages 可以托管构建后的 HTML、CSS、JavaScript、图片、字体、RSS、sitemap、manifest 和 service worker。构建阶段可以在 GitHub Actions 中运行 Node/Astro，但生产访问阶段不能依赖 Node 服务器。

因此所有核心能力必须满足：

1. 构建后可以独立存在于 `dist/`；
2. 直接访问深层 URL 不依赖服务端路由回退；
3. 资源路径经过 `site`/`base` 配置处理；
4. JavaScript 失败时仍保留正文和主要导航；
5. 第三方脚本失败时不影响页面主要内容。

### 3.2 方案边界

| 需求 | 本项目默认方案 | 依赖 |
|---|---|---|
| 文章与项目内容 | Astro Content Collections + TypeScript 配置 | 无运行时服务 |
| 动态文章页 | 构建时静态生成 | Astro |
| 全文搜索 | 构建时 JSON 索引 + 原生 JS | 无第三方 |
| 标签/系列/归档 | 构建时生成静态页面 | 无第三方 |
| 收藏/阅读历史/反应 | `localStorage` | 当前浏览器 |
| 评论 | Giscus 按钮触发后加载 | 可选 GitHub Discussions |
| 订阅 | RSS，后续可加 Atom/JSON Feed | 无第三方 |
| SEO | Meta、canonical、sitemap、robots、JSON-LD | 无第三方 |
| 分享图 | 仓库内 SVG/构建时模板 | 无图片 API |
| 统计 | 默认关闭 | 不接入 |
| 离线 | manifest + service worker + 离线页 | 浏览器能力 |
| GitHub 数据 | 手写快照优先，API 仅可选 | GitHub API（可失败降级） |

### 3.3 第三方服务最小化原则

- GitHub Pages 和 GitHub Actions 是部署基础设施，不计入额外业务服务；
- Giscus 保留为可选评论增强，不阻塞首屏；
- 默认移除或避免外部字体 CDN，优先系统字体或仓库内字体；
- 不引入 Google Analytics、在线 CMS、云数据库、邮件营销平台和外部搜索服务；
- 每个可选外部服务都必须有：用途、数据流、关闭方法、失败降级和隐私说明。

---

## 4. 目标信息架构

### 4.1 顶层导航

推荐导航：

- `/`：个人主页；
- `/posts/`：文章列表；
- `/projects/`：项目与作品；
- `/thoughts/`：碎碎念/短内容；
- `/explore/`：内容地图与随机探索；
- `/tags/`：标签总览；
- `/series/`：系列总览；
- `/archive/`：按年份归档；
- `/library/`：本地收藏与继续阅读；
- `/tools/`：工具集合；
- `/about/`：更完整的关于页；
- `/privacy/`：隐私与数据说明。

桌面端不必把所有入口都放进主导航：主导航保留首页、文章、项目、探索、关于；标签、系列、归档、书架和隐私放在搜索弹窗、页脚或探索页中。

### 4.2 首页模块顺序（个人主页优先）

1. **Hero / 身份首屏**：名字、头像/视觉、身份标签、一句话定位、当前状态、主要 CTA；
2. **数据概览**：文章数、项目数、技术主题数、持续写作时间等可由内容构建时计算；
3. **精选项目**：3–6 个最重要项目，包含问题、成果、技术、链接和状态；
4. **最近文章**：最近 3–6 篇，可区分精选与普通；
5. **Now**：当前在做什么、正在学习什么、最近关注什么；
6. **能力与技术栈**：按“熟悉/正在使用/想探索”分组，不制造夸大等级；
7. **时间线**：学习、工作、项目和重要转折；
8. **碎碎念预览**：展示近期短内容，链接到完整列表；
9. **联系 CTA**：GitHub、邮箱及其他主动维护的社交入口；
10. **页脚**：RSS、探索、隐私、源码仓库和站点构建时间。

首页的每个模块都要回答一个问题，避免纯装饰：

- 我是谁？
- 我在做什么？
- 我做过什么？
- 我写了什么？
- 如何联系我？

### 4.3 项目展示规则

项目卡片至少支持：

- 名称、短描述、项目类型；
- 状态：进行中/已完成/维护中/归档；
- 技术标签；
- 角色和贡献；
- GitHub/演示/文章链接；
- 代表图片或颜色；
- 最后更新时间；
- 可选的“为什么做”和结果数据。

项目页要提供筛选或分组，但第一版使用构建时静态筛选，不做客户端远程查询。

---

## 5. 功能实施清单

### 5.1 P0：个人主页与个人品牌

**目标**：让新访客在 10–20 秒内认识站长并找到代表作品。

**实施项**：

- 统一 `src/config/site.ts`、`profile.ts` 和 `projects.ts` 的中文/英文文案；
- 修复编码，补齐头像 alt、社交链接 label 和外链安全属性；
- 首页支持精选项目、最近内容、Now、技术栈、时间线、联系卡片；
- 项目页支持状态、标签、筛选、项目详情入口；
- 增加“正在进行”与“最近更新”视觉标记；
- 将个人介绍、项目亮点和联系方式放在静态配置中，避免首页依赖外部 API；
- 为项目预留可选 Markdown 详情集合，但第一版不强制拆分。

**验收**：

- 移动端首屏不溢出，头像和 CTA 可用；
- 精选项目、文章、碎碎念和社交链接均能到达正确页面；
- 无 JavaScript 时首页仍可阅读；
- 项目状态和链接只从一个配置源读取。

### 5.2 P0：文章阅读体验

**实施项**：

- 修复 `post.render()` 重复调用；
- TOC 使用 Astro headings 构建，原生锚点可用；
- 用 `IntersectionObserver` 增加当前章节高亮，观察失败时不影响 TOC；
- 阅读进度使用 `data-article` 计算并写入 `b0-reading-history`；
- 文章工具支持本地收藏、复制链接和 Web Share API（不可用时回退复制）；
- 代码块复制按钮兼容键盘操作和复制失败提示；
- 图片 lightbox 使用原生 `<dialog>`；
- 相关文章按系列、标签、分类和发布日期计算，避免当前文章重复；
- 提供上一篇/下一篇；
- 文章页输出 `Article`/`BlogPosting` 结构化数据、canonical、更新时间和封面 alt。

**验收**：

- 关闭 JS 后文章正文、TOC 锚点、上下篇仍能工作；
- 刷新文章后本地阅读进度不报错；
- `prefers-reduced-motion` 下不强制动画；
- 复制失败时不会阻塞阅读。

### 5.3 P0：内容发现、搜索和组织

#### A. 构建时全文搜索

新增：

- `src/pages/search-index.json.ts`；
- `src/lib/search.ts`；
- 搜索索引包含：`slug`、`title`、`description`、`body`、`tags`、`category`、`series`、`date`、`featured`、`type`；
- `SearchModal.astro` 改为加载/使用索引，搜索正文、标题、摘要、标签、分类和系列；
- 对用户输入做 token 化、大小写不敏感匹配；
- 结果按标题命中、标签命中、正文命中、精选和日期加权；
- 关键词在标题/摘要/命中片段中高亮，并使用转义后的 HTML；
- 索引加载失败提供文章列表降级；
- 保留 Ctrl/Cmd + K、Escape、焦点管理和键盘导航；
- 默认不把全文索引塞入首页首屏 bundle，按打开搜索时加载 JSON。

**建议数据结构**：

```ts
interface SearchDocument {
  slug: string;
  title: string;
  description: string;
  body: string;
  tags: string[];
  category?: string;
  series?: string;
  date: string;
  featured: boolean;
  type: 'post' | 'thought';
  url: string;
}
```

#### B. 标签与系列

新增：

- `/tags/` 标签总览：标签名、文章数、最近更新时间；
- 保留 `/tags/[tag]/`，补充文章数量、相关系列和返回入口；
- `/series/` 系列总览；
- `/series/[series]/` 系列详情与按 `seriesOrder` 排序的文章列表；
- 文章页展示当前系列上下文和“第 N 篇/共 M 篇”；
- 没有系列的文章不显示空状态标签。

#### C. 内容地图

新增 `/explore/`：

- 精选文章；
- 最新文章；
- 分类入口；
- 标签入口；
- 系列入口；
- 按年份归档入口；
- 项目、工具、碎碎念入口；
- “随机打开一篇”按钮，随机选择静态文章 URL；
- 清晰标注“随机”不代表推荐算法。

**验收**：所有公开内容至少能通过导航、搜索、标签、系列、归档或探索页中的一种方式到达。

### 5.4 P1：本地书架与浏览器状态

新增 `/library/`，分成三个区块：

1. **收藏**：来自 `b0-bookmarks`；
2. **继续阅读**：来自 `b0-reading-history`，显示最近阅读和百分比；
3. **本地反应**：可选的“喜欢/稍后再看/已读”状态，仅当前浏览器有效。

实现规则：

- 页面初始 HTML 提供解释和空状态；
- JavaScript 加载后读取 `localStorage` 并渲染；
- JSON 损坏、隐私模式或存储额度不足时静默降级；
- 提供“清除本地数据”按钮，并二次确认；
- 不保存文章正文、账号信息或敏感数据；
- 所有文案明确“数据仅保存在当前浏览器”。

建议存储：

```ts
type BookmarkState = Record<string, { savedAt: number }>;
type ReadingState = Record<string, { openedAt: number; progress: number; completed?: boolean }>;
type ReactionState = Record<string, 'like' | 'later' | 'read'>;
```

### 5.5 P1：SEO、分享与可访问性

**全站**：

- 动态 `<title>`、description、canonical、robots；
- sitemap、robots.txt、RSS 自动发现；
- 首页输出 `Person` 与 `WebSite` JSON-LD；
- 面包屑输出 `BreadcrumbList`；
- 文章输出完整 `BlogPosting`：标题、摘要、作者、日期、更新日期、封面、主 URL；
- `og:title`、`og:description`、`og:image`、`og:type` 和 Twitter card；
- 文章封面和头像有准确 alt；
- 所有页面提供合适的 heading 层级、跳过导航链接、焦点样式和 aria label；
- 链接和按钮不只依赖颜色或图标表达含义。

**分享图**：

- 第一版使用仓库内 `/public/og/` SVG 或构建时生成的静态图片；
- 不调用第三方截图/图片 API；
- 标题过长时截断并保留可读性；
- 没有封面的页面使用统一默认图。

### 5.6 P1：评论、隐私与第三方边界

Giscus 只作为增强，不是页面核心：

- 评论区域默认显示说明和“加载评论”按钮；
- 用户点击后再插入 Giscus iframe/script；
- 主题切换时同步 Giscus 主题；
- 加载失败时显示 GitHub Discussions 入口或静态说明；
- 不在首页加载 Giscus；
- 在 `/privacy/` 说明 Giscus 会连接 GitHub/Giscus 相关资源，以及本地状态的存储范围；
- 检查并尽量移除外部字体 CDN，改用系统字体或仓库内字体；
- 不添加分析脚本、广告、追踪 Cookie 或第三方分享 SDK。

### 5.7 P1：写作自动化与内容质量

新增命令：

```text
pnpm new:post       # 创建文章模板
pnpm new:thought    # 创建碎碎念模板
pnpm new:project    # 创建项目配置模板或提示
pnpm validate:content
pnpm smoke
```

新增脚本建议：

- `scripts/new-post.mjs`：询问 slug、标题、分类、标签和摘要，生成 UTF-8 Markdown；
- `scripts/new-thought.mjs`：生成短内容模板；
- `scripts/new-project.mjs`：生成项目数据片段；
- `scripts/validate-content.mjs`：校验日期、slug、必填字段、重复 id、系列顺序、封面路径；
- `scripts/check-links.mjs`：检查站内 Markdown 链接和图片是否存在；
- `scripts/smoke.mjs`：构建后检查首页、文章、项目、标签、系列、RSS、sitemap、robots 和 404 产物。

校验规则：

- `title`、`description`、`date`、`tags` 必填；
- 公开文章不能使用重复 slug；
- `cover` 存在时文件必须存在且有 `coverAlt`；
- `updatedDate` 不早于 `date`；
- `seriesOrder` 只有设置 `series` 时才允许出现；
- 草稿不进入搜索、RSS、sitemap 和公开列表；
- 本地图片限制尺寸与单文件大小，避免仓库无限膨胀。

### 5.8 P2：PWA、离线与主题个性化

在核心内容稳定后实现：

- `/manifest.webmanifest`：站点名称、图标、主题色、启动页；
- service worker：缓存 CSS、JS、字体、关键页面和离线 fallback；
- `/offline/`：说明当前离线并提供已缓存内容入口；
- 缓存策略以“网络优先、失败回退”为主，不缓存评论 iframe 和不可控第三方内容；
- 更新 service worker 时有版本号和旧缓存清理；
- 不因 PWA 失败阻断正常静态页面加载。

### 5.9 P2：双语与内容扩展

- Frontmatter `lang` 已预留；
- 第一版只支持页面级语言标记和导航文案，不自动翻译文章；
- 后续可为文章增加 `translationOf` / `translations` 关系；
- 语言切换必须跳转到真实存在的静态页面，不能生成空链接；
- 未提供翻译时明确显示“暂无翻译”。

### 5.10 P3：可选外部数据

默认不实现动态 GitHub API。若未来需要：

- 优先在仓库内维护 GitHub 项目快照；
- 或通过 GitHub Actions 定时构建时抓取公开数据并提交/生成静态 JSON；
- API 失败时使用最近一次快照；
- 不在浏览器端暴露 Token；
- 页面显示数据更新时间，避免把旧快照误认为实时数据。

统计、邮件订阅和跨访客互动也只能作为单独决策，不进入静态核心路线。

---

## 6. 推荐目录结构

```text
src/
  components/
    blog/
    layout/
    profile/
    ui/
  config/
    site.ts
    profile.ts
    projects.ts
  content/
    posts/
    thoughts/
    config.ts
  lib/
    content.ts
    search.ts
    seo.ts
    storage.ts
  pages/
    index.astro
    posts/
    projects.astro
    thoughts.astro
    explore.astro
    tags/index.astro
    tags/[tag].astro
    series/index.astro
    series/[series].astro
    library.astro
    privacy.astro
    search-index.json.ts
    rss.xml.ts
  styles/
public/
  fonts/
  icons/
  og/
  manifest.webmanifest
  offline.html
scripts/
  new-post.mjs
  new-thought.mjs
  new-project.mjs
  validate-content.mjs
  check-links.mjs
  smoke.mjs
docs/
  blog-feature-implementation-plan.md
  github-pages-blog-feature-research.md
```

原则：

- 内容、个人资料、项目资料分离；
- 页面负责组装，计算逻辑放 `src/lib/`；
- 浏览器状态集中于 `storage.ts`；
- 第三方集成集中于单一组件，不散落到页面；
- 所有静态资源优先放仓库内。

---

## 7. 内容模型与数据规范

### 7.1 文章 Frontmatter

当前 schema 已支持以下方向，最终以 `src/content/config.ts` 为唯一校验源：

```yaml
---
title: "文章标题"
description: "用于列表、搜索和 SEO 的摘要"
date: 2026-08-12
updatedDate: 2026-08-12
category: "分类"
tags: ["标签一", "标签二"]
featured: false
cover: "/images/example.webp"
coverAlt: "封面图说明"
series: "系列名"
seriesOrder: 1
canonical: "https://example.com/real-source"
noindex: false
lang: "zh-CN"
---
```

规则：

- `description` 不是正文第一句的机械复制；
- 标签使用稳定、可复用的命名；
- 系列文章必须填写 `seriesOrder`；
- 外部转载必须填写 `canonical`，并按需要设置 `noindex`；
- 图片必须有可理解的替代文本；
- 内容中不要放密钥、Cookie、个人敏感信息或未经授权的第三方素材。

### 7.2 项目数据

项目配置建议包含：

```ts
interface Project {
  slug: string;
  name: string;
  summary: string;
  description?: string;
  status: 'active' | 'maintained' | 'completed' | 'archived';
  role?: string;
  technologies: string[];
  links: { label: string; href: string }[];
  featured?: boolean;
  updatedAt?: string;
  image?: string;
  imageAlt?: string;
}
```

### 7.3 Schema 统一原则

- 不在页面中重复定义文章字段；
- 不把项目状态写死在多个组件；
- 构建时发现错误就失败，不让坏内容进入部署；
- 提交前自动执行格式、类型、schema 和链接检查。

---

## 8. 分阶段实施顺序与交付物

### Phase 0：基线修复与发布门禁（基本完成，待清理）

- [x] pnpm/Node/Actions 版本固定；
- [x] Pages artifact 部署；
- [x] `pnpm check`、`pnpm build` 门禁；
- [x] `validate:content`；
- [x] `smoke`；
- [x] 检查 `site.ts` 与源码编码，并统一受影响文件为 UTF-8 无 BOM；
- [x] 清理陈旧 Astro 缓存后确认 duplicate content id 警告消失；
- [x] 删除 `.tmp-post.txt` 与 `.astro-stale/`。

### Phase 1：个人主页展示（第一版已完成，重点继续打磨）

- [x] 个人资料、状态、Now、时间线、技术栈和社交配置；
- [x] 首页 Hero、统计、精选项目、最近文章、碎碎念和联系 CTA；
- [x] `/projects/` 项目总览；
- [x] 工具集合与独立工具入口；
- [ ] 移动端、键盘导航和无 JS 逐页验收；
- [ ] 统一中文文案、图片 alt、外链 `rel` 与链接有效性；
- [ ] 为代表项目增加可选站内案例详情页。

### Phase 2：文章阅读增强（已完成主体，待浏览器验收）

- [x] 字数、阅读时间、TOC 静态结构；
- [x] 阅读进度、收藏、分享、代码复制、图片放大；
- [x] 上一篇/下一篇、相关文章；
- [x] TOC 当前章节高亮；
- [x] 阅读历史和阅读百分比持久化；
- [x] 单次 `post.render()`；
- [ ] 真实浏览器检查图片 lightbox、复制失败、恢复进度和 reduced-motion。

### Phase 3：内容发现与本地状态（已完成主体）

- [x] 构建时全文搜索索引；
- [x] 搜索正文、分类、系列、项目、工具和碎碎念；
- [x] 多关键词评分与关键词高亮；
- [x] `/tags/` 总览与标签详情；
- [x] `/series/` 与 `/series/[series]/`；
- [x] `/explore/` 内容地图和随机文章；
- [x] `/library/` 本地收藏、阅读历史和阅读百分比；
- [ ] 内容规模明显增长后再评估 Pagefind，当前不提前引入依赖。

### Phase 4：SEO、评论与隐私（主体已完成，待真实浏览器验收）

- [x] BreadcrumbList、Person、WebSite、BlogPosting JSON-LD 完整化；
- [x] 补齐 `inLanguage`、`articleSection`、`keywords` 和文章图片元数据；
- [x] Giscus 点击后加载、主题同步和失败降级；
- [x] `/privacy/`；
- [x] 移除外部字体 CDN，优先系统字体和仓库内资源；
- [ ] 浏览器验证评论默认不阻塞首屏，且关闭/失败时正文可用。

### Phase 5：写作自动化与 CI（主体已完成）

- [x] `new:post`、`new:thought`、`new:project`；
- [x] Frontmatter、slug、系列、封面、链接校验；
- [x] `pnpm smoke`；
- [x] CI 检查工作流与 main 部署工作流；
- [ ] 增加构建产物大小、图片体积和外链质量门禁；
- [ ] 在 CI 日志中输出页面数量和产物大小。

### Phase 6：静态增强（基础版本已完成，待真实验收）

- [x] manifest、service worker、离线 fallback；
- [x] Atom/JSON Feed；
- [ ] 验证安装、缓存升级、离线文章和 offline fallback；
- [x] 完成非根 `base` 路径兼容，并用 `BASE_PATH=/project-pages/` 构建和 smoke 验证；
- [ ] 双语页面级支持（中文优先，按内容需要增量加入）；
- [ ] GitHub 项目公开数据的构建时快照（默认不做客户端实时请求）；
- [ ] 可选隐私统计（默认关闭，不进入当前核心）。

每个阶段的完成条件：代码实现、移动端/桌面端验证、`pnpm check`、`pnpm build`、文档状态同步。

---

## 9. CI/CD 目标

### Pull Request

1. checkout；
2. 安装固定版本 pnpm；
3. `pnpm install --frozen-lockfile`；
4. `pnpm check`；
5. `pnpm validate:content`；
6. `pnpm build`；
7. `pnpm smoke`；
8. `BASE_PATH=/project-pages/ pnpm build`；
9. `pnpm smoke -- --base=/project-pages/`；
10. 可选：上传 `dist/` 作为预览 artifact。

### main 部署

1. 完成同样的检查和构建；
2. 上传 `dist/`；
3. 使用 `actions/deploy-pages` 部署；
4. 失败时不发布半成品；
5. 在日志中输出站点 URL、页面数量和产物大小。

### 内容更新策略

- 文章、项目和头像等静态资源进入仓库并随提交发布；
- 若加入定时 GitHub 数据快照，必须记录抓取时间和来源；
- 不使用客户端定时请求维持“实时”假象。

---

## 10. 验收清单

### 功能

- [x] 首页已按“我是谁、在做什么、做过什么、如何联系我”组织；
- [x] 项目、文章、碎碎念、探索、标签、系列、归档、书架和隐私页已生成静态页面；
- [x] 搜索索引已覆盖标题、摘要、正文、标签、分类、系列、项目、工具和碎碎念；
- [x] 搜索索引失败时回退到文章列表；
- [x] TOC 锚点和当前章节高亮已实现，并已在长文页面的本地浏览器验收中确认可定位章节；
- [x] 阅读进度、收藏和阅读历史已实现；长文页面已验证进度与阅读记录写入本机浏览器，本地收藏可在刷新后恢复；
- [x] 本地收藏、历史和书架数据可以清除；
- [x] Giscus 已改为点击加载、主题同步和失败降级；加载前不会插入 Giscus iframe 或请求其脚本，正文不依赖评论服务；
- [x] RSS、Atom、JSON Feed、sitemap、robots 和基础 JSON-LD 已生成；
- [x] PWA 失败不会阻塞普通页面；已在 `localhost` 安全上下文验证 manifest 与 Service Worker 注册，生产离线 fallback 仍保留为首次上线后的手工检查。

### 静态部署

- [x] `pnpm check` 通过：0 errors / 0 warnings / 0 hints；
- [x] `pnpm build` 通过，最近生成 59 个页面；
- [x] `pnpm validate:content` 通过：8 篇文章、0 errors / 0 warnings；
- [x] `pnpm smoke` 通过；
- [x] `dist/` 不依赖服务端运行时；
- [x] 当前 GitHub Pages 用户主页根域名资源路径可用；
- [x] 非根项目 Pages 专项验收：`BASE_PATH=/project-pages/ pnpm build` 和 `pnpm smoke -- --base=/project-pages/` 通过；
- [x] `base` 发生变化时的站内链接、Feed、manifest、Service Worker 和离线页由统一工具输出；
- [ ] 直接访问深层路径、刷新、返回和 404 仍需要真实浏览器实测。

### 性能与可访问性

- [x] 首页首屏不加载评论 iframe、搜索全文索引或非必要第三方资源；静态 smoke 会检查 Giscus 不被预加载、搜索索引不被 preload，并禁止 Google Fonts 与 jsDelivr。
- [ ] 图片有 alt、尺寸/占位和合理的 lazy loading；
- [ ] 键盘可操作导航、搜索、目录、主题、收藏、评论加载和 lightbox；
- [x] 焦点状态可见；构建后的 CSS 已由 smoke 检查包含 `:focus-visible` 规则。
- [x] 支持 `prefers-reduced-motion`；构建后的 CSS 已由 smoke 检查包含对应媒体查询。
- [ ] 暗色模式、高对比度和无 JS 阅读不破坏主要内容；
- [ ] 本地状态只保存必要数据。

### 内容质量

- [x] UTF-8 无乱码；内容校验与 smoke 均扫描源文件，smoke 还会扫描生成文本产物中的 Unicode replacement character。
- [x] 文章摘要、日期、标签和封面 alt 已通过 `pnpm validate:content` 校验（8 篇文章、0 errors / 0 warnings）。
- [ ] 草稿不进入公开列表、搜索、RSS 和 sitemap；
- [x] slug、系列顺序和内部链接已通过 `pnpm validate:content` 校验。
- [ ] 项目链接、状态和社交链接定期复核；
- [x] 图片和字体体积在可接受范围内；smoke 施加单资源 1 MiB、站点总量 10 MiB 的预算，本次根路径构建约 5.90 MiB，最大资源为 640 KiB。

---

## 11. 暂缓项目与决策门

以下内容不进入当前静态核心，除非后续明确接受外部服务或额外维护成本：

1. 跨访客浏览量、点赞、排行榜；
2. 用户账户和登录；
3. 邮件订阅后台；
4. 在线 CMS；
5. 实时聊天；
6. 需要私钥的 GitHub API；
7. 大规模服务器端搜索；
8. 自动翻译全部文章；
9. 复杂的多作者权限系统。

如果未来要加入外部服务，先单独写 ADR，说明成本、数据流、隐私、降级和退出方案。

---

## 12. 开发约定

- 每完成一个阶段，都更新本文的勾选状态；
- 每阶段至少运行：

```powershell
pnpm check
pnpm build
```

- 能用构建时生成，就不在浏览器端请求远程 API；
- 能用原生 HTML/JS，就不额外引入交互库；
- 组件只负责展示与交互，内容计算放 `src/lib/`；
- 第三方集成集中在独立组件，并提供禁用/失败降级；
- 不以终端乱码作为编码判断依据，使用 UTF-8 文件读取和构建产物验证；
- 不能用 Git 状态判断变更，因为当前工作区可能没有 `.git` 目录。

---

## 13. 当前状态与后续运营

本轮范围内的核心实施已完成：个人主页、项目案例页、文章阅读增强、内容组织与按需搜索、本地书架、SEO/feed、PWA 渐进增强、内容校验、根路径与项目 Pages 子路径构建、CI 与部署门禁均已落地并完成本地静态验收。

仍应在**首次真实部署完成后**手动做一次生产环境检查：

1. 直接打开并刷新一篇深层文章、访问一个不存在的路径，确认 GitHub Pages 的 404 行为符合预期；
2. 断网后确认已访问页面的缓存回退与 `/offline/` 提示；
3. 若启用 Giscus，点击“加载评论”并确认对应 GitHub Discussions 配置有效；
4. 定期复核外链、项目状态与社交资料，避免展示过期信息。

这些是静态托管环境的上线后验证和内容运营事项，并不阻塞当前构建产物。后续只有在内容规模或明确需求证明有必要时，才考虑 Pagefind、GitHub 数据快照、双语页面或隐私统计。

当前版本的“核心完整”定义为：个人主页、文章阅读、项目/工具展示、搜索与内容组织、本地书架、SEO/feed、写作自动化和 CI 均可稳定使用；评论和 PWA 属于可关闭的渐进增强，不能影响普通页面。

---

## 14. 参考资料

- [GitHub Pages 概览](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages 自定义 Actions 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Pages 发布源配置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Astro 内容集合](https://docs.astro.build/zh-cn/guides/content-collections/)
- [Astro RSS](https://docs.astro.build/zh-cn/recipes/rss/)
- [Astro Sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
- [Giscus](https://giscus.app/zh-CN)
- [Web App Manifest（MDN）](https://developer.mozilla.org/zh-CN/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)

---

## 15. 已确认的产品决策

用户已确认：**“都弄上，更注重个人主页展示，尽量不使用第三方服务，现在先写实施文档。”** 因此本文按以下默认决策执行，不再把它们列为阻塞问题：

1. **视觉方向**：保留当前偏粗体、卡片化、撞色风格，但首页信息层级优先于装饰；
2. **个人定位**：采用多面展示，兼容开发、游戏/配置研究、工具制作、音乐与视觉创作；
3. **作品展示**：项目总览先使用静态配置，代表项目可增加站内案例详情页；
4. **本地书架**：收藏、继续阅读、阅读历史和阅读百分比全部开启，并明确仅保存在当前浏览器；
5. **评论**：保留 Giscus 作为唯一可选外部互动，默认不加载，点击后加载，失败时降级；
6. **PWA**：保留 manifest、service worker 和离线 fallback，但必须可关闭且不影响普通页面；
7. **语言**：中文优先，双语作为后续按内容增量加入的能力，不为所有文章强制翻译；
8. **字体与资源**：不使用 Google Fonts、jsDelivr 等字体 CDN，优先系统字体或仓库内资源；
9. **统计与动态数据**：默认不做统计、不做客户端 GitHub API 请求；如果未来需要，只允许构建时公开数据快照，并单独记录隐私和失败降级方案。

仍需在实现收尾时确认的只有两项：

- 是否为哪些代表项目增加站内案例详情页；
- 是否在内容规模明显增长后引入 Pagefind 替换当前轻量构建时搜索索引。

---

## 16. 本轮实施记录（2026-08-12）

- 已新增 `src/lib/urls.ts`，以 `withBase()` / `siteUrl()` 统一生成 `base` 感知的站内 URL；
- 首页剩余的项目、文章、关于和碎碎念链接已迁移，避免项目 Pages 部署时跳转到域名根路径；
- `scripts/smoke.mjs` 已验证搜索索引、JSON Feed、manifest、JSON-LD、Giscus 惰性加载、Service Worker 与项目路径构建产物；
- `.github/workflows/ci.yml` 已增加 `BASE_PATH=/project-pages/` 的构建与 smoke 门禁；
- 已完成命令行验证：`pnpm check`（0/0/0）、项目路径 `pnpm build` + `pnpm smoke -- --base=/project-pages/`；最终发布前应重新执行根路径的 `pnpm build`、`pnpm validate:content` 与 `pnpm smoke`，以保证 `dist/` 保持根路径版本；
- 本轮移除了残留的 Google Fonts `@import`，确保核心页面不依赖字体 CDN；
- PWA 的离线切换、Service Worker 生命周期和浏览器交互仍须通过本地浏览器预览完成最终验收，不能仅凭构建产物视为已验证。
- 项目页现已提供类型、状态和标签的原生 `<select>` 渐进筛选：未启用 JavaScript 时仍完整显示全部项目；
- 所有已配置项目均生成 `/projects/[slug]/` 案例页，卡片同时提供“查看案例”和真实的文章/工具入口；
- `smoke` 新增案例路由、图片 `alt`、禁用字体/CDN、`:focus-visible`、reduced-motion、UTF-8 替换字符与产物体积预算检查；根路径静态产物当前为 5.90 MiB，最大单文件为 `HP.png`（640 KiB）。

---

## 17. 实施收尾与验收记录（2026-08-12）

### 17.1 本轮补齐

- `scripts/new-project.mjs` 已同步 `Project` 配置模型：新项目片段现在会要求并生成 `slug`、`primaryActionLabel` 与 `highlights`，避免未来新增项目时漏掉案例页所需字段；`slug` 只接受小写字母、数字和单连字符。
- `src/components/blog/ArticleEnhancements.astro` 已调整为在 DOM 解析完成后再初始化。这样文章的阅读进度、本地阅读历史、代码复制、图片放大和目录高亮不会因为脚本早于文章正文解析而遗漏页面元素。

### 17.2 已通过的真实浏览器验收

以下项目使用本地 `astro preview` 与 Chromium DevTools Protocol 验证；移动尺寸为 390 × 844 CSS 像素：

- **移动项目页**：`documentElement.scrollWidth`、`body.scrollWidth` 与视口宽度均为 390；页面没有实际横向滚动。之前截图中被误判为裁切的内容来自 headless 截图方式，而非布局溢出。
- **项目筛选**：初始显示 5 个项目；“在线工具”筛选后只显示 `SwitchYourCFG`；与“已发布”组合后正确显示零结果提示；点击“清除筛选”后恢复全部项目。
- **搜索**：首次打开前没有 `search-index.json` 请求；点击搜索后弹窗打开、才请求该索引，并显示 5 条默认结果。
- **文章阅读增强**：长文页面会生成 45 个代码复制按钮；滚动后阅读进度更新为非零值并把完成状态写入 `localStorage` 的 `b0-reading-history`；收藏按钮写入本地书签状态；目录存在且可用于定位章节。
- **评论惰性加载**：加载评论前没有 Giscus iframe，也没有 `giscus.app` 脚本请求；正文阅读不依赖评论服务。
- **PWA**：在 `http://localhost` 的安全上下文中确认 manifest 存在、Service Worker 注册成功，scope 为站点根路径。
- **无 JavaScript 降级**：项目页仍渲染 5 张卡片和 10 个项目链接；筛选器保留为原生表单控件，所有项目默认可读可导航。

### 17.3 发布前命令

发布前或 CI 中应执行：

```powershell
pnpm check
pnpm build
pnpm validate:content
pnpm smoke
```

如部署到项目仓库 Pages（例如 `https://<owner>.github.io/<repo>/`），还应执行：

```powershell
$env:BASE_PATH='/<repo>/'
pnpm build
pnpm smoke -- --base=/<repo>/
```

完成后重新以未设置 `BASE_PATH` 的环境执行一次 `pnpm build`，确保最终 `dist/` 是根路径版本。

### 17.4 本次发布前补充修复与复核（2026-08-12）

- **项目 Pages 路径兼容**：新增 `src/lib/remark-with-base.mjs`。构建时会改写 Markdown 原始 HTML 中的根路径 `href`、`src` 与 `poster` 属性；因此旧文章的 `<img src="/GIF/...">`、`<img src="/cyanotype.jpg">` 等资源，在 `BASE_PATH=/project-pages/` 构建后会输出为 `/project-pages/...`，不会回退到域名根目录。
- **回归门禁**：`scripts/smoke.mjs` 现在会扫描所有生成的 HTML；项目 Pages 构建中出现任何未带 base 前缀的根路径 `href`、`src` 或 `poster` 都会失败。该规则覆盖正文 Markdown 中的原始 HTML，而非只检查首页。
- **部署门禁**：`.github/workflows/deploy.yml` 在 `pnpm build` 前运行 `pnpm validate:content`，在上传 Pages artifact 前运行 `pnpm smoke`，避免将未通过静态质量检查的产物部署到 `main`。
- **本地复核结果**：`pnpm check` 为 0 errors / 0 warnings / 0 hints；`pnpm validate:content` 校验 8 篇文章且为 0 errors / 0 warnings；根路径 `pnpm build && pnpm smoke` 通过；`BASE_PATH=/project-pages/ pnpm build && pnpm smoke -- --base=/project-pages/` 也通过。根路径构建已在最后重新执行，当前 `dist/` 是用户主页根路径版本。

### 17.5 运行边界与上线后一次性检查

- GitHub Pages 只能托管静态产物：收藏、阅读历史、主题选择等仅保存在访问者自己的浏览器；站点不会把这些数据上传到服务端。
- Giscus 仍是唯一可选外部服务，且必须由访问者点击后才连接 GitHub Discussions。
- 本地 `localhost` Service Worker 验收不等同于生产离线压力测试；首次发布后应手动确认一次深层文章直接访问/刷新、404 页面、离线 fallback 和缓存升级行为。
