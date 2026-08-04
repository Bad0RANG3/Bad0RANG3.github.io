# PAPER PUNCH · 视觉设计风格

> 本站（Bad0RANG3.github.io）的视觉设计系统速查。
> 一句话概括：**奶油纸张底 + 珊瑚橙 + 柚子黄 + 电光青，编辑部风的粗野主义（Brutalist）** —— 像一张有印刷质感、被手工盖章过的海报/杂志页面。

---

## 1. 设计定位

- **风格关键词**：editorial（编辑部风）、brutalist（粗野主义）、paper craft（纸质手工感）、sticker / chip（贴纸与标签）、marquee（跑马灯）、硬阴影。
- **气质**：不追求“精致圆润”，而是 **明确的边框、硬投影、轻微旋转、大写标题、电报式小标签**，像一台老式印刷机 + 手工剪贴本。
- **情绪色**：Coral vermillion（珊瑚朱红）· Yuzu citrus（柚子黄）· Electric teal（电光青）。
- **主视觉隐喻**：纸质颗粒（grain）、网点纸、纸胶带、印章、折角卡片。

---

## 2. 色彩系统（daisyUI 5 自定义主题，CSS 变量注入）

主题名：`paper`（亮色）/ `paper-dark`（暗色，暖炭色而非冷黑）。

### 亮色 `paper`
| Token | 值 (oklch) | 说明 |
|---|---|---|
| `--color-base-100` | `oklch(96.5% 0.018 90)` | 奶油纸底 |
| `--color-base-200` | `oklch(93% 0.022 88)` | 稍深纸色 |
| `--color-base-content` | `oklch(22% 0.03 50)` | 暖墨色正文 |
| `--color-primary` | `oklch(64% 0.22 28)` | 珊瑚朱红（主色） |
| `--color-secondary` | `oklch(90% 0.18 98)` | 柚子黄（次色） |
| `--color-accent` | `oklch(72% 0.13 195)` | 电光青（强调色） |
| `--color-ink` | `oklch(22% 0.03 50)` | 硬投影/描边用墨色 |
| 圆角 | selector `1rem` / field `0.75rem` / box `1.25rem` | |

### 暗色 `paper-dark`（暖炭，不偏冷不偏紫）
| Token | 值 (oklch) | 说明 |
|---|---|---|
| `--color-base-100` | `oklch(18% 0.02 60)` | 暖炭纸底 |
| `--color-base-content` | `oklch(94% 0.018 85)` | 暖白正文 |
| `--color-primary` | `oklch(72% 0.19 35)` | 提亮的珊瑚 |
| `--color-secondary` | `oklch(88% 0.16 98)` | 提亮的柚子黄 |
| `--color-accent` | `oklch(78% 0.12 195)` | 提亮的电光青 |

> 大量颜色使用 `color-mix(in oklab, ...)` 做透明/混合，保证暗色模式下自动适配。

---

## 3. 字体

| 用途 | 字体 | 来源 |
|---|---|---|
| 正文/标题 | **MiSans**（思源系中文无衬线） | CDN：`cdn.jsdelivr.net/npm/misans@3.1.0/index.css` |
| 等宽/代码/编号 | **JetBrains Mono** | Google Fonts |
| 兜底 | `system-ui, ui-monospace, monospace` | |

- 大标题 `display-title` / `mega-title`：`font-weight: 900`，负字距，`line-height: 1.02~1.05`。
- **中文标题负字距收窄**：`:lang(zh)` 时 letter-spacing 降到 `-0.02em`，避免中文挤成一团。
- 小标签统一 **大写 + 大间距**（`uppercase tracking-[0.16em~0.24em]`）。
- `eyebrow`：小节眉题，0.7rem 大写 + 前导 3px 渐变短横线（primary → secondary）。

---

## 4. 布局系统

| Class | 说明 |
|---|---|
| `site-frame` | 标准内容框：`width: min(100% - 2rem, 72rem)` 居中 |
| `site-frame-wide` | 宽版：`min(100% - 1.5rem, 80rem)` |
| `hero-grid` | 首页 Hero：移动端单列，`lg` 为 `1.35fr / 0.95fr` |
| `bento-editorial` | Bento 网格：`md` 起 12 列，第 1 块 `span 7 / row 2`，第 2、3 块 `span 5`，其余 `span 4` |
| `project-rail` | 项目展示：`≥900px` 时 3 列 |
| 页头渐变条 | 标题下的 `h-1.5 bg-gradient-to-r from-primary via-secondary to-accent` |

---

## 5. 表面与质感

- **纸张颗粒（paper grain）**：`body::before` 固定覆盖一层 SVG feTurbulence 噪点，opacity 约 `0.035`（暗色 `0.05`），`mix-blend-mode: multiply / soft-light`。这是“纸质印刷感”的核心。
- **底纹**：`body` 上叠加 3 团径向渐变色晕（8%/92%/78% 位置）+ 56px 网格线（5% 墨色），`background-attachment: fixed`。
- **`hard-card`**：`border: 2px` + **硬投影** `box-shadow: 10px 10px 0 0`，hover 时 `-translate-y`、投影变 `14px 14px`。变体：`hard-card-citrus`（黄影）、`hard-card-teal`（青影）。
- **`panel-slice`**：带斜切渐变背景 + 右下角青色光晕圆。
- **`paper-sticker`**：纸胶带式胶囊标签，`rotate(-1.5deg)` + 4px 墨色硬投影。
- **chips**：`chip-signal`（珊瑚描边）、`chip-lime`（黄）、`chip-teal`（青）——胶囊小标签，1.5px 描边 + 浅色填充。
- **`slash-divider`**：斜线分隔线（repeating-linear-gradient 135°）。

---

## 6. 组件样式

### 按钮
- `btn-brutal`：胶囊形，2px 墨色描边，珊瑚底，`box-shadow: 6px 6px 0 0 ink`；hover 上移 `-2px` 且投影变 9px，active 下压（投影变 3px）。
- `btn-brutal-outline`：纸底 + 青色硬投影，hover 变黄底。

### 走马灯 marquee
- `.marquee-track`：`display:flex; width:max-content`，`animation: marquee 26s linear infinite`，**内容必须复制两份**才能用 `translateX(-50%)` 无缝循环（首页/页脚均如此实现）。
- 移动端动画时长延长到 36s；hover 暂停。

### 数字块 `stat-block`
- 左侧 4px 主色竖线，数字用 `clamp(2.2rem, 5vw, 3.4rem)` 900 字重 + 主色→青色渐变文字。

### 正文排版 `.prose`
- 链接 2px 下划线；引用块左侧主色竖线 + 黄底右圆角；行内代码 0.45rem 圆角描边；`pre` 带青色硬投影。
- **移动端表格**：`.table-wrapper` 横向滚动，首列 sticky，底部提示「← 滑动查看 →」。

### 歌词块 `.lyric-block`（站点特色）
- 左侧 4px 青色竖线 + 右圆角；hover 时渐变叠层淡入、竖线变珊瑚。英文行用等宽斜体，中文行缩小字号置灰。

---

## 7. 动效

| 动画 | 用途 | 参数 |
|---|---|---|
| `marquee` | 跑马灯 | `translateX 0 → -50%`，26s/36s linear |
| `blob` | 背景色块漂浮 | 8s，位移 + 缩放 |
| `drift` | 贴纸/装饰漂移 | 10s ease-in-out，`translate3d + rotate` |
| `float` | 悬浮元素 | 5s，上下 8px |
| `pulse-glow` | 呼吸光晕 | 主色 10px 扩散 |
| `page-enter-up` | 页面进入 | 420ms，上移淡入；离开 160ms 下移淡出（SPA 平滑跳转） |
| `reveal-up` | 滚动显现 | 520ms，`translateY(10px) + scale(0.995)`，支持 `--reveal-delay` 级联 |

- 交互曲线：进入 `cubic-bezier(0.22, 0.61, 0.36, 1)`；离开 `cubic-bezier(0.55, 0.06, 0.68, 0.19)`。
- `link-underline`：下划线从左向右渐变滑出。
- 尊重 `prefers-reduced-motion`：全部动画收敛为瞬时。

---

## 8. 深色模式

- `data-theme="paper-dark"`，**暖炭色**基调（不是冷黑、不是紫色）。
- 切换按钮只显示当前主题对应的图标（sun / moon 二选一）。
- `theme-color` meta 跟随主题：亮 `#f4efe4`、暗 `#1a1612`。
- 选择文本颜色、marquee、代码块、歌词块均有暗色变体。

---

## 9. 移动端处理

- `overflow-x: clip` 防横向滚动；表格横向滑动、首列 sticky。
- 按钮在移动端全宽；`hard-card` 阴影缩小为 6px。
- `#back-to-top` 使用 `env(safe-area-inset-*)` 避开刘海/手势条。
- 页脚/首页 marquee 均需复制内容避免布局撑爆（grid 列用 `minmax(0,1fr)` 约束）。

---

## 10. 关键 Class 速查

```
site-frame / site-frame-wide      布局容器
display-title / mega-title        大标题（中文自动收窄字距）
eyebrow / type-label              眉题 / 小标签
ink-stroke                        描边空心字
hard-card / -citrus / -teal       硬投影卡片（黄/青变体）
panel-slice                       斜切渐变面板
paper-sticker                     纸胶带标签
chip-signal / chip-lime / chip-teal   三色胶囊标签
btn-brutal / btn-brutal-outline   粗野按钮（实心/描边）
marquee-band / marquee-track      跑马灯（内容复制两份）
stat-block                        大数字统计块
slash-divider                     斜线分隔
lyric-block / lyric-en / lyric-cn 歌词块
reveal / page-enter               显现 / 页面过渡
link-underline                    渐变下划线
hover-lift                        悬浮上浮
```

---

## 11. 维护要点

1. 颜色全部走 CSS 变量（oklch + color-mix），**不要写死 hex**。
2. 需要新“纸张感”组件时：`2px 边框 + 硬投影 + 轻微旋转 + uppercase 小字标签` 就是这套风格的最小配方。
3. marquee 内容永远复制两份，否则循环会跳。
4. 新增页面标题时遵循：`eyebrow（小眉题）→ display-title（大标题）→ 渐变条`，标题下的描述行已全部移除。
5. 暗色模式不是简单的“反色”，而是换一套暖炭变量。
