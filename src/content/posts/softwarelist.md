---
title: "电脑软件实用清单"
description: "覆盖浏览器、办公、开发、设计、创作、娱乐、AI 与系统维护的 30+ 类场景，一份更全的电脑软件推荐清单。"
date: 2025-03-28
updatedDate: 2026-08-05
tags:
  - 软件
  - 工具
  - Windows
  - 装机
  - 效率
category: 资源清单
featured: false
draft: false
verifiedDate: 2026-08-05
difficulty: 入门
audience: 正在整理 Windows 工作环境的用户
---

# 🧰 电脑软件实用清单

> 一份面向普通用户的电脑软件清单，按场景分类，装完就能用。

> **推荐原则**
> - **优先推荐开箱即用的软件**，避免需要命令行、脚本配置或复杂折腾的工具。
> - 当某软件存在明显会员墙、广告或体验限制时，会补上更好的免费平替。
> - 每个分类里第一个推荐通常最稳；拿不准时选它基本不会错。
> - 所有软件优先从官网或官方商店下载，别碰第三方捆绑打包站。

## 🚀 快速入口

- **新电脑先装**：浏览器、压缩、搜索、卸载、截图、下载器、播放器、输入法、剪贴板
- **学生 / 轻办公**：Office、PDF、笔记、思维导图、云同步、邮件、在线协作
- **日常沟通**：微信、QQ、Telegram、Discord、钉钉、飞书、腾讯会议
- **开发者**：VS Code、Cursor、Git、WSL、Docker、DBeaver、Postman、Apifox、Wireshark
- **设计师**：Figma、Pixso、即时设计、Affinity、Blender、Krita、Inkscape
- **视频创作者**：剪映、DaVinci Resolve、OBS Studio、HandBrake、必剪
- **游戏玩家**：Steam、Epic、WeGame、GOG、哔哩哔哩、PotPlayer
- **系统维护**：Rufus、Ventoy、CrystalDiskInfo、DiskGenius、VirtualBox、Hasleo
- **远程协作**：ToDesk、向日葵、UU远程、RustDesk、坚果云、LocalSend
- **AI 尝鲜**：Claude、ChatGPT、DeepSeek、Gemini、Kimi

---

## 🌐 浏览器 / 上网

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Microsoft Edge** | 默认浏览、装机即用 | Chromium 内核，兼容性强，Windows 下续航和内存控制都不错 | 免费，预装 | Firefox / Brave | [官网](https://www.microsoft.com/edge) |
| **Google Chrome** | 主力浏览器 / 生态 | 网页兼容性和扩展生态最稳，账号同步成熟 | 内存占用偏高 | Edge / Firefox | [官网](https://www.google.com/chrome/) |
| **Firefox** | 主力浏览器 / 隐私优先 | 开源、扩展生态成熟、隐私策略更激进 | 免费开源 | Brave / Edge | [官网](https://www.mozilla.org/firefox) |
| **Brave** | 浏览器 / 去广告 | 自带广告拦截和隐私保护，开箱即用 | 免费 | Firefox + uBlock Origin | [官网](https://brave.com) |
| **Arc** | 浏览器 / 整理癖 | 标签页、空间、侧边栏设计感强，适合多任务浏览 | 免费，部分平台迭代快 | Edge / Chrome | [官网](https://arc.net) |
| **uBlock Origin** | 浏览器扩展 / 广告拦截 | 开源、轻量、拦截效果极佳，浏览器必备扩展 | 免费开源 | AdGuard / 浏览器自带 | [官网](https://github.com/gorhill/uBlock) |

---

## 🗜️ 压缩 / 文件管理 / 搜索

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **7-Zip** | 解压缩 | 开源、轻、稳定，几乎够用一切压缩需求 | 免费开源 | NanaZip / Bandizip | [官网](https://www.7-zip.org) |
| **NanaZip** | Windows 11 风格解压 | 7-Zip 的现代化前端，界面更贴近 Win11 | 免费开源 | 7-Zip | [官网](https://github.com/M2Team/NanaZip) |
| **Bandizip** | 解压缩 / 预览 | 解压速度快、支持预览和智能解压，免费版够用 | 免费版有广告 | 7-Zip / NanaZip | [官网](https://www.bandisoft.com/bandizip/) |
| **Everything** | 文件搜索 | 搜索速度极快，装完基本离不开 | 免费 | Listary / uTools | [官网](https://www.voidtools.com) |
| **Listary** | 快速启动 / 搜索 | 双击 Ctrl 呼出搜索框，打开文件、启动软件都很快 | 免费 | uTools / Everything | [官网](https://www.listary.com) |
| **uTools** | 效率工具箱 | 插件化启动器，翻译、取色、剪贴板、速记一框搞定 | 免费够用 | Listary / PowerToys | [官网](https://www.u.tools) |
| **Files** | 文件管理器 | 现代化多标签文件管理器，界面清爽 | 免费开源 | Q-Dir / 系统资源管理器 | [官网](https://files.community) |
| **Q-Dir** | 多窗口文件管理 | 四格分屏浏览目录，整理文件效率极高 | 免费 | Files / Total Commander | [官网](https://www.softwareok.com/?seite=Freeware/Q-Dir) |

---

## 🖥️ 系统增强 / 效率工具

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **PowerToys** | Windows 效率增强 | 微软官方工具集：窗口布局、批量重命名、取色器、键盘映射、文本提取 | 免费开源 | — | [官网](https://github.com/microsoft/PowerToys) |
| **Geek Uninstaller** | 卸载残留清理 | 小而快，删软件时比系统卸载更干净 | 免费个人版 | Revo Uninstaller / HiBit Uninstaller | [官网](https://geekuninstaller.com) |
| **HiBit Uninstaller** | 卸载 + 系统清理 | 比较全能，适合想顺手做清理的人 | 免费 | Geek Uninstaller | [官网](https://hibitsoft.ir/Uninstaller.html) |
| **Revo Uninstaller** | 深度卸载 | 卸载后扫描注册表和残留文件，清理最彻底 | 免费版够用 | Geek Uninstaller / HiBit | [官网](https://www.revouninstaller.com) |
| **Ditto** | 剪贴板历史 | 复制过的内容都能找回来，纯效率提升 | 免费开源 | CopyQ | [官网](https://ditto-cp.sourceforge.io) |
| **CopyQ** | 剪贴板历史 | 开源跨平台，支持脚本和搜索历史 | 免费开源 | Ditto | [官网](https://hluk.github.io/CopyQ/) |
| **AutoHotkey** | 自动化 / 快捷键 | 写脚本做热键、宏、窗口操作，折腾党必备 | 免费开源，需学一点语法 | PowerToys / 键盘厂商驱动 | [官网](https://www.autohotkey.com) |
| **QuickLook** | 空格预览 | 选中文件按空格直接预览，类似 macOS 的快速查看 | 免费开源 | Seer | [官网](https://github.com/QL-Win/QuickLook) |

---

## ⌨️ 输入法 / 快捷操作

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **搜狗输入法** | 中文输入 | 国内普及度最高的输入法，词库和云联想强 | 免费，有广告可关 | 微信输入法 / 微软拼音 | [官网](https://shurufa.sogou.com) |
| **微信输入法** | 轻量中文输入 | 简洁干净、跨设备剪贴板同步 | 功能不如搜狗丰富 | 搜狗输入法 / 微软拼音 | [官网](https://z.weixin.qq.com) |
| **微软拼音** | 系统自带中文输入 | Windows 自带，稳定无广告，够用党首选 | 免费 | 搜狗 / 微信输入法 | [官网](https://support.microsoft.com/windows) |
| **百度输入法** | 中文输入 | 词库、皮肤丰富，和百度生态联动 | 免费，有广告可关 | 搜狗 / 微信输入法 | [官网](https://shurufa.baidu.com) |
| **小狼毫（Rime）** | 输入法 / 折腾党 | 高度可定制的开源输入法引擎，隐私好、无广告 | 免费开源，配置有门槛 | 搜狗 / 微软拼音 | [官网](https://rime.im) |

---

## 📸 截图 / 录屏 / 贴图

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Snipaste** | 截图 / 贴图 | 截图、标注、贴图一气呵成，效率非常高 | 免费，部分高级功能需付费 | ShareX / PixPin | [官网](https://www.snipaste.com) |
| **PixPin** | 截图 / 贴图 / 标注 | 体验很顺手，很多人会把它当 Snipaste 平替 | 免费可用 | Snipaste / ShareX | [官网](https://pixpinapp.com) |
| **ShareX** | 截图 / 录制 / 分享 | 开源且极度全能，适合爱折腾截图流程的人 | 免费开源，学习成本稍高 | Snipaste / PixPin | [官网](https://getsharex.com) |
| **FastStone Capture** | 截图 / 长截图 / 录屏 | 老牌截图工具，滚动截图和屏幕录像很稳 | 商业软件，免费试用 | Snipaste / ShareX | [官网](https://www.faststone.org/FSCaptureDetail.htm) |
| **ScreenToGif** | GIF / 演示录制 | 录教程、录界面反馈特别方便 | 免费 | — | [官网](https://www.screentogif.com) |
| **OBS Studio** | 录屏 / 直播 | 免费开源，直播和录屏首选 | 免费开源，初次配置需花点时间 | Bandicam / 系统录屏 | [官网](https://obsproject.com) |
| **系统截图** | 快速截图 | Win + Shift + S 区域截图，Win + G 录屏，零安装 | 免费 | Snipaste / ShareX | [官网](https://support.microsoft.com/windows) |

---

## 📄 办公套件 / 文档处理

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Microsoft 365** | Word / Excel / PowerPoint 主力办公 | 兼容性和行业普及度几乎仍是第一梯队 | 订阅制 | LibreOffice / OnlyOffice / WPS | [官网](https://www.microsoft.com/microsoft-365) |
| **WPS Office** | 中文办公 / 模板丰富 | 国内生态、模板和兼容性友好 | 免费可用，会员功能和广告较多 | LibreOffice / OnlyOffice | [官网](https://www.wps.cn) |
| **LibreOffice** | 免费办公套件 | 开源免费，文字表格演示都能覆盖大多数基础需求 | 界面和细节不如商业套件顺手 | OnlyOffice | [官网](https://www.libreoffice.org) |
| **OnlyOffice** | 文档协作 / Office 兼容 | 开源、界面更现代，对 Office 格式兼容较好 | 重度本地用户未必最顺手 | LibreOffice | [官网](https://www.onlyoffice.com) |
| **腾讯文档** | 在线文档 / 表格 | 与微信、QQ 生态结合深，分享方便 | 更适合国内协作场景 | 石墨文档 / 飞书文档 | [官网](https://docs.qq.com) |
| **石墨文档** | 在线协作 | 中文团队协作体验不错，适合轻协作 | 进阶功能商业化 | 腾讯文档 / 飞书文档 | [官网](https://shimo.im) |

---

## 📑 PDF / 电子书 / 阅读

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Adobe Acrobat Reader** | PDF 阅读 | 老牌 PDF 阅读器，兼容性稳 | 免费阅读，编辑能力要订阅 | SumatraPDF / PDFgear | [官网](https://get.adobe.com/reader) |
| **PDFgear** | PDF 阅读 / 编辑 / OCR | 免费功能很多，适合普通用户日常 PDF 处理 | 部分复杂场景不如专业商业软件 | PDF-XChange Editor / SumatraPDF | [官网](https://www.pdfgear.com) |
| **PDF-XChange Editor** | PDF 标注 / 编辑 | 功能很全，本地 PDF 处理很强 | 部分高级功能付费 | PDFgear / Foxit | [官网](https://www.pdf-xchange.com/product/pdf-xchange-editor) |
| **SumatraPDF** | PDF / 电子书阅读 | 极轻量、启动快，阅读 PDF、EPUB、漫画都行 | 免费开源 | PDFgear / Foxit | [官网](https://www.sumatrapdfreader.org) |
| **Foxit PDF Reader** | PDF 阅读 / 协作批注 | 老牌轻量阅读器，批注和协作功能全 | 免费版够用 | Adobe Reader / PDFgear | [官网](https://www.foxit.com) |
| **Calibre** | 电子书管理 | 本地电子书库管理、格式转换最强 | 免费开源 | — | [官网](https://calibre-ebook.com) |
| **微信读书** | 读书 / 笔记 | 书库大、笔记划线方便，多端同步 | 部分书籍需会员 | 得到 / Kindle | [官网](https://weread.qq.com) |

---

## 📝 笔记 / 知识库

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Obsidian** | 本地笔记 / 知识库 | Markdown 本地优先，插件多，适合长期积累 | 同步和协作需自己搭或付费 | Logseq / Joplin / Notion | [官网](https://obsidian.md) |
| **Notion** | 协作知识库 / 项目记录 | 数据库和页面一体化，协作方便 | 免费版够用 | Obsidian / 飞书文档 | [官网](https://www.notion.so) |
| **Joplin** | 笔记 / 同步 | 开源、跨平台，支持自同步 | 免费 | Obsidian / Notion | [官网](https://joplinapp.org) |
| **Logseq** | 大纲式笔记 / 双向链接 | 开源本地优先，双链和块引用体验独特 | 免费开源 | Obsidian | [官网](https://logseq.com) |
| **语雀** | 知识库 / 文档 | 阿里出品，结构化文档和小队知识库体验好 | 免费版够用 | Notion / 飞书文档 | [官网](https://www.yuque.com) |
| **思源笔记** | 本地笔记 / 数据私有 | 开源、块级引用，数据完全在本地 | 免费开源 | Obsidian / Logseq | [官网](https://b3log.org/siyuan/) |

---

## 🧠 思维导图 / 流程图 / 白板

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **XMind** | 思维导图 | 做梳理、复盘、提纲特别顺手 | 免费版够用 | 幕布 / ProcessOn | [官网](https://xmind.app) |
| **ProcessOn** | 流程图 / 思维导图 | 国内在线画图，模板多、协作方便 | 免费版有数量限制 | draw.io / XMind | [官网](https://www.processon.com) |
| **draw.io** | 流程图 / 架构图 | 免费开源，本地离线也能画，导出格式多 | 免费开源，界面朴素 | ProcessOn / Figma | [官网](https://www.diagrams.net) |
| **幕布** | 大纲 / 导图 | 大纲转思维导图非常顺滑，适合快速梳理 | 免费版够用 | XMind / Workflowy | [官网](https://mubu.com) |

---

## 🗣️ 即时通讯 / 社交

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **微信** | 日常沟通 / 文件传输 | 国内人人必备，PC 端聊天和文件传输都很方便 | 免费 | QQ / 企业微信 | [官网](https://weixin.qq.com) |
| **QQ** | 即时通讯 / 文件传输 | 传大文件、远程协助、群功能仍然很实用 | 免费 | 微信 / Tim | [官网](https://im.qq.com) |
| **Telegram** | 跨平台通讯 / 频道 | 速度快、多端同步、频道和机器人生态强 | 免费，国内访问不稳定 | Discord / WhatsApp | [官网](https://telegram.org) |
| **Discord** | 游戏 / 社群语音 | 语音质量好，服务器和机器人生态活跃 | 免费 | Telegram / QQ频道 | [官网](https://discord.com) |
| **Slack** | 团队沟通 | 频道化工作沟通，和开发工具集成深 | 免费版有消息限制 | 飞书 / 钉钉 / Teams | [官网](https://slack.com) |
| **飞书** | 文档 + IM + 会议 | 协作一体化做得比较完整 | 企业使用场景更舒服 | 钉钉 / 企业微信 | [官网](https://www.feishu.cn) |
| **钉钉** | 企业沟通 / 打卡 / 会议 | 企业功能很全，组织管理能力强 | 个人用户未必喜欢它的味道 | 飞书 / 企业微信 | [官网](https://www.dingtalk.com) |
| **企业微信** | 企业沟通 | 微信生态互通能力是明显优势 | 更偏企业流程 | 飞书 / 钉钉 | [官网](https://work.weixin.qq.com) |

---

## 📧 邮箱 / 邮件管理

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Outlook** | 邮箱客户端 | Exchange / Outlook 体系兼容好，日历邮件一体 | 桌面体验和界面风格见仁见智 | Thunderbird / 网易邮箱大师 | [官网](https://outlook.live.com) |
| **Thunderbird** | 邮箱客户端 / 隐私 | 开源跨平台，账户管理和过滤规则成熟 | 免费开源 | Outlook / 网易邮箱大师 | [官网](https://www.thunderbird.net) |
| **网易邮箱大师** | 多邮箱统一管理 | 中文环境友好，国内收发邮件首选 | 免费 | QQ邮箱 | [官网](https://mail.163.com/dashi) |
| **QQ邮箱** | 国内邮箱服务 | 和 QQ 生态绑定，国内使用面广 | 免费 | 网易邮箱大师 | [官网](https://mail.qq.com) |
| **Gmail** | 国际邮箱服务 | 国际场景通用，和 Google 生态整合强 | 免费 | Outlook.com | [官网](https://mail.google.com) |

---

## 👥 视频会议 / 远程办公

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **腾讯会议** | 视频会议 | 国内会议体验流畅，免费版够日常使用 | 免费版有时长限制 | 飞书会议 / 钉钉会议 / Zoom | [官网](https://meeting.tencent.com) |
| **飞书会议** | 视频会议 / 协作 | 和飞书文档深度整合，参会体验干净 | 企业场景更合适 | 腾讯会议 / Zoom | [官网](https://www.feishu.cn) |
| **钉钉会议** | 视频会议 | 和钉钉组织架构打通，适合企业 | 更适合企业流程 | 腾讯会议 / 飞书会议 | [官网](https://www.dingtalk.com) |
| **Zoom** | 国际视频会议 | 海外使用最广，稳定性口碑好 | 免费版 40 分钟限制 | Google Meet / 腾讯会议 | [官网](https://zoom.us) |
| **Google Meet** | 视频会议 | 浏览器即开即用，和 Google 日历联动 | 免费 | Zoom / 腾讯会议 | [官网](https://meet.google.com) |

---

## 💻 编辑器 / IDE / 编程

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Visual Studio Code** | 通用开发 | 扩展生态最强，前后端和脚本都能打 | 越装越重是常态 | Zed / Sublime Text / JetBrains | [官网](https://code.visualstudio.com) |
| **Cursor** | AI 编程编辑器 | VS Code 系 + AI 补全与对话，写代码效率明显提升 | 免费版够用，Pro 订阅 | VS Code + Copilot | [官网](https://www.cursor.com) |
| **JetBrains 全家桶** | 专业 IDE | IntelliJ / PyCharm / WebStorm 等，对应语言体验最完整 | 订阅制，学生免费 | VS Code / Eclipse | [官网](https://www.jetbrains.com) |
| **Sublime Text** | 轻量编辑器 | 启动快、流畅，适合快速改文件 | 免费试用，需付费许可 | VS Code / Notepad++ | [官网](https://www.sublimetext.com) |
| **Zed** | 现代编辑器 | 高性能、内置 AI，多人协作编辑是亮点 | 免费开源，生态较新 | VS Code / Cursor | [官网](https://zed.dev) |
| **Neovim** | 终端编辑器 | 可定制性极强的开源编辑器，终端党最爱 | 免费开源，学习曲线陡 | Vim / VS Code | [官网](https://neovim.io) |
| **Notepad++** | 轻量文本编辑 | 开源、轻快，看日志改配置很顺手 | 免费开源 | Sublime Text / VS Code | [官网](https://notepad-plus-plus.org) |

---

## 🧰 开发工具 / 终端 / 数据库 / API / 网络

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Git** | 版本控制 | 开发基础设施 | 免费开源 | — | [官网](https://git-scm.com) |
| **GitHub Desktop** | Git 图形客户端 | 不想用命令行的话，这个最友好 | 免费 | — | [官网](https://desktop.github.com) |
| **Windows Terminal** | 终端 | 微软官方终端，标签页和主题都不错 | 免费开源 | — | [官网](https://github.com/microsoft/terminal) |
| **WSL** | Linux 子系统 | Windows 里跑 Linux 环境，开发最省心的入口之一 | 免费 | 虚拟机 / Docker | [官网](https://learn.microsoft.com/windows/wsl/) |
| **Docker Desktop** | 容器开发 | 开发者最省心的 Docker 入口 | 个人免费 | Podman / OrbStack | [官网](https://www.docker.com/products/docker-desktop) |
| **Postman** | API 调试 | 功能全、上手快 | 免费版够用 | Apifox | [官网](https://www.postman.com) |
| **Apifox** | API 文档 / 调试 / Mock | 国内团队协作和接口一体化做得很好 | 免费版够用 | Postman | [官网](https://www.apifox.cn) |
| **DBeaver** | 数据库管理 | 开源通用数据库客户端，够全够稳 | 免费开源 | Navicat / TablePlus | [官网](https://dbeaver.io) |
| **Navicat** | 数据库管理 | 功能全、可视化强，商业工具里的标杆 | 商业软件 | DBeaver / TablePlus | [官网](https://www.navicat.com) |
| **TablePlus** | 数据库管理 | 界面精致、轻快，支持主流数据库 | 部分功能付费 | DBeaver / Navicat | [官网](https://tableplus.com) |
| **WinSCP** | SFTP / 文件传输 | Windows 下老牌稳健工具 | 免费 | FileZilla | [官网](https://winscp.net) |
| **FileZilla** | FTP / SFTP | 跨平台文件传输 | 免费 | WinSCP | [官网](https://filezilla-project.org) |
| **Termius** | SSH 客户端 | 跨平台 SSH，支持同步主机列表和端口转发 | 免费版够用 | Windows Terminal / PuTTY | [官网](https://termius.com) |

---

## 🌐 网络抓包 / 调试 / 逆向

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Wireshark** | 抓包分析 | 开源抓包王者，协议分析能力极强 | 免费开源，上手有门槛 | tcpdump / Fiddler | [官网](https://www.wireshark.org) |
| **Fiddler Classic** | HTTP 抓包调试 | 调试 Web 请求、看接口响应很方便 | 免费 | Charles / 浏览器 DevTools | [官网](https://www.telerik.com/fiddler) |
| **Charles Proxy** | HTTP 调试代理 | 抓包、断点、重写请求，移动端调试利器 | 商业软件 | Fiddler / mitmproxy | [官网](https://www.charlesproxy.com) |
| **IDA Pro** | 逆向分析 | 行业标准反汇编器，二进制分析天花板 | 商业软件，价格高 | Ghidra / x64dbg | [官网](https://hex-rays.com/ida-pro) |
| **x64dbg** | 动态调试 | 开源 Windows 调试器，逆向调试常用 | 免费开源 | OllyDbg / WinDbg | [官网](https://x64dbg.com) |

---

## 🎨 平面设计 / UI 设计

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Adobe Creative Cloud** | 设计行业全家桶 | 行业标准，生态和兼容性仍然强 | 订阅成本高 | Affinity / GIMP / Inkscape | [官网](https://www.adobe.com/creativecloud.html) |
| **Affinity Suite** | 平面设计 / 排版 / 修图 | 一次性买断思路，对很多个人创作者更友好 | 商业软件，不开源 | Adobe CC / GIMP | [官网](https://affinity.serif.com) |
| **Figma** | UI / UX 设计 | 协作体验极强，设计稿分享方便 | 进阶功能收费 | Pixso / 即时设计 | [官网](https://www.figma.com) |
| **Pixso** | 中文 UI 设计 | 国内协作和中文环境更友好 | 深度生态不如 Figma | 即时设计 | [官网](https://pixso.cn) |
| **即时设计** | 在线设计协作 | 本土协作体验好，适合国内团队 | 重度生态仍看偏好 | Pixso / Figma | [官网](https://js.design) |
| **Canva** | 海报 / 社交媒体图 | 模板海量、上手极快，非设计师救星 | 免费版够用 | 稿定设计 / 稿定 | [官网](https://www.canva.com) |
| **稿定设计** | 中文模板设计 | 国内模板接地气，电商图、公众号图很快 | 免费版有水印 | Canva / 创客贴 | [官网](https://www.gaoding.com) |

---

## 🎬 视频剪辑 / 特效 / 转码

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **剪映专业版** | 短视频剪辑 | 上手快、模板多、字幕和包装友好 | 深度专业能力有限 | DaVinci Resolve | [官网](https://www.capcut.cn) |
| **DaVinci Resolve** | 视频剪辑 / 调色 | 免费版已经非常强，专业度高 | 学习曲线比剪映高 | 剪映专业版 | [官网](https://www.blackmagicdesign.com/products/davinciresolve) |
| **Adobe Premiere Pro** | 专业剪辑 | 行业主流，生态和插件成熟 | 订阅制 | DaVinci Resolve / 剪映 | [官网](https://www.adobe.com/products/premiere.html) |
| **Shotcut** | 免费剪辑 | 开源跨平台，免费剪辑里功能较全 | 免费开源，界面一般 | DaVinci Resolve | [官网](https://shotcut.org) |
| **必剪** | 哔哩哔哩向剪辑 | B 站创作者友好，素材和投稿流程顺 | 免费 | 剪映专业版 | [官网](https://bcut.bilibili.cn) |
| **HandBrake** | 视频转码 | 开源压片/转码老工具，稳 | 免费开源 | — | [官网](https://handbrake.fr) |

---

## 🖌️ 图像处理 / 数字绘画 / 3D

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Adobe Photoshop** | 专业修图 | 图像处理行业标准，功能天花板 | 订阅制 | GIMP / Affinity Photo | [官网](https://www.adobe.com/products/photoshop.html) |
| **GIMP** | 图像编辑 | 免费开源，适合基础修图与合成 | 某些高端工作流不如 PS | Affinity Photo / Krita | [官网](https://www.gimp.org) |
| **Krita** | 数字绘画 | 开源、笔刷系统强、板绘体验好 | 不主打照片处理 | GIMP / Photoshop | [官网](https://krita.org) |
| **Inkscape** | 矢量绘图 | 开源矢量工具代表，够做很多 SVG / Logo / 排版图形 | 复杂商业工作流仍有差距 | Illustrator / Affinity Designer | [官网](https://inkscape.org) |
| **Blender** | 3D 建模 / 渲染 / 动画 | 开源 3D 工具王者级存在 | 学习成本高 | Cinema 4D / Maya（商业） | [官网](https://www.blender.org) |
| **Aseprite** | 像素画 / 像素动画 | 像素画和像素动画最顺手的工具 | 商业软件（可自行编译） | 系统画图 / GraphicsGale | [官网](https://www.aseprite.org) |

---

## 🎵 音乐播放 / 音频

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **AIMP** | 本地音乐播放 | 轻快稳定，本地音乐党首选 | 免费 | — | [官网](https://www.aimp.ru) |
| **MusicBee** | 本地音乐管理 | 本地音乐库管理强，标签编辑和播放体验都好 | 免费 | AIMP / foobar2000 | [官网](https://getmusicbee.com) |
| **foobar2000** | 本地音乐 / 折腾党 | 高度可定制，插件丰富 | 免费 | MusicBee / AIMP | [官网](https://www.foobar2000.org) |
| **Audacity** | 音频编辑 | 开源音频编辑，录音、剪辑、降噪都行 | 免费开源 | Adobe Audition | [官网](https://www.audacityteam.org) |
| **QQ音乐** | 在线音乐 | 曲库和版权较强，国内常用 | 会员墙明显 | 网易云音乐 / 本地播放器 | [官网](https://y.qq.com) |
| **网易云音乐** | 在线音乐 | 推荐算法和社区氛围强 | 会员内容和版权限制也不少 | QQ音乐 | [官网](https://music.163.com) |
| **Spotify** | 在线音乐 | 国际曲库全，播客和推荐体验好 | 国内访问不稳定 | Apple Music / QQ音乐 | [官网](https://www.spotify.com) |

---

## 📺 视频播放

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **VLC media player** | 本地音视频播放 | 开源万能播放器，几乎什么都能播 | 界面比较朴素 | MPC-HC / PotPlayer | [官网](https://www.videolan.org/vlc) |
| **PotPlayer** | 本地视频播放 | 解码强、格式全，开箱即用 | 免费 | VLC | [官网](https://potplayer.daum.net) |
| **MPC-HC** | 本地视频播放 | 经典轻量播放器，配合解码包很能打 | 免费开源 | VLC / PotPlayer | [官网](https://github.com/clsid2/mpc-hc) |
| **mpv** | 本地视频播放 / 折腾党 | 极简、可脚本化，画质和性能都很出色 | 免费开源，默认界面朴素 | VLC / PotPlayer | [官网](https://mpv.io) |

---

## ⬇️ 下载工具 / 资源获取

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Motrix** | HTTP / BT / 磁力下载 | 开源、界面清爽，多协议一把梭 | 某些特殊站点兼容看资源 | qBittorrent / FDM | [官网](https://motrix.app) |
| **Internet Download Manager** | 多线程下载 | 老牌下载工具，资源嗅探能力强 | 商业软件 | Motrix / FDM | [官网](https://www.internetdownloadmanager.com) |
| **迅雷** | 国内下载 | 某些国内资源环境确实方便 | 会员和体验限制明显 | Motrix / qBittorrent / FDM | [官网](https://www.xunlei.com) |
| **qBittorrent** | BT / PT 下载 | 开源无广告，BT 和 PT 党首选 | 免费开源 | Motrix / Transmission | [官网](https://www.qbittorrent.org) |
| **Free Download Manager** | 多线程下载 | 开源、支持 HTTP / BT，替代 IDM 的免费选择 | 免费 | Motrix / IDM | [官网](https://www.freedownloadmanager.org) |
| **yt-dlp** | 视频网站下载 | 命令行下载 YouTube 等视频，灵活可脚本化 | 免费开源，需命令行 | 浏览器扩展 / IDM | [官网](https://github.com/yt-dlp/yt-dlp) |

---

## 🎮 游戏 / 娱乐 / 直播

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Steam** | PC 游戏平台 | 生态完整、社区和创意工坊都强 | 主要是买游戏的平台 | Epic Games / GOG | [官网](https://store.steampowered.com) |
| **Epic Games** | 游戏平台 | 常送游戏，虚幻相关生态也在这里 | 平台体验不是人人都爱 | Steam | [官网](https://store.epicgames.com) |
| **WeGame** | 国内游戏平台 | 国内联机和社区更接地气 | 免费 | Steam | [官网](https://www.wegame.com.cn) |
| **GOG Galaxy** | 游戏平台 / 无 DRM | 老游戏多、无 DRM 是亮点 | 游戏库不如 Steam 大 | Steam / Epic | [官网](https://www.gog.com/galaxy) |
| **Xbox** | 游戏 / 订阅制 | PC Game Pass 订阅很划算，和 Windows 整合好 | 订阅制 | Steam / Epic | [官网](https://www.xbox.com/apps) |
| **哔哩哔哩** | 视频 / 学习 / 娱乐 | 国内视频社区一哥，教程和知识区也很能打 | 免费 | YouTube / AcFun | [官网](https://www.bilibili.com) |

---

## ☁️ 云盘 / 同步 / 局域网传输

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **坚果云** | 文件同步 | 历史版本和同步体验都很成熟，轻办公很好用 | 免费空间有限 | Syncthing / OneDrive / Dropbox | [官网](https://www.jianguoyun.com) |
| **OneDrive** | 微软生态云盘 | Office 和 Windows 生态整合强 | 免费空间偏少，体验依赖账户体系 | 坚果云 / Dropbox | [官网](https://www.microsoft.com/microsoft-365/onedrive/online-cloud-storage) |
| **Dropbox** | 多端同步 | 老牌同步工具，分享和历史版本成熟 | 免费空间偏小 | 坚果云 / OneDrive | [官网](https://www.dropbox.com) |
| **百度网盘** | 大文件分享 | 国内覆盖最广，很多资源离不开它 | 会员和限速口碑问题明显 | 阿里云盘 / 坚果云 | [官网](https://pan.baidu.com) |
| **阿里云盘** | 国内网盘 | 上传下载体验相对好，分享方便 | 生态上仍属于网盘逻辑 | 百度网盘 / 天翼云盘 | [官网](https://www.aliyundrive.com) |
| **腾讯微云** | 国内网盘 | 和 QQ / 微信生态联动方便 | 免费空间一般 | 百度网盘 / 阿里云盘 | [官网](https://www.weiyun.com) |
| **Syncthing** | 私有同步 | 开源去中心化同步，数据完全自己掌控 | 免费开源，需自己维护 | 坚果云 / Resilio Sync | [官网](https://syncthing.net) |
| **LocalSend** | 局域网传文件 | 跨平台局域网快传，体验干净，无需账号 | 免费开源 | 微信文件传输 / Nearby Share | [官网](https://localsend.org) |

---

## 📡 远程控制 / 远程协助

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **ToDesk** | 远程协助 | 国内连接体验好，个人免费 | 免费版够用 | 向日葵 | [官网](https://www.todesk.com) |
| **向日葵** | 远程控制 | 国内远程老牌工具，简单易用 | 免费版够用 | ToDesk | [官网](https://sunlogin.oray.com) |
| **UU远程（网易）** | 远程游戏 / 远程办公 / 远程协助 | 网易出品，低延迟、免费，手机远程电脑玩 3A 有按键映射，还有 WOL 远程开机 | 免费 | ToDesk / 向日葵 | [官网](https://uuyc.163.com) |
| **RustDesk** | 远程控制 / 自托管 | 开源，可以自己搭中继服务器，隐私好 | 免费开源 | ToDesk / AnyDesk | [官网](https://rustdesk.com) |
| **AnyDesk** | 远程控制 | 轻量、连接快，跨平台表现稳定 | 个人免费 | TeamViewer / RustDesk | [官网](https://anydesk.com) |
| **TeamViewer** | 远程控制 | 老牌工具，跨平台和功能全面 | 商用判定严格 | AnyDesk / ToDesk | [官网](https://www.teamviewer.com) |
| **微软远程桌面** | Windows 远程桌面 | Windows 系统自带，局域网和 RDP 场景最稳 | 免费 | 第三方远程工具 | [官网](https://learn.microsoft.com/windows-server/remote/remote-desktop-services/clients/remote-desktop-clients) |

---

## 🔐 安全防护 / 隐私

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **火绒安全** | Windows 安全防护 | 轻、安静、日常防护体验好 | 主要针对 Windows | Microsoft Defender | [官网](https://www.huorong.cn) |
| **Microsoft Defender** | 系统自带防护 | 对普通用户而言已经足够强，系统整合最好 | 对进阶用户可见度略弱 | 火绒安全 | [官网](https://support.microsoft.com/windows) |
| **Malwarebytes** | 恶意软件查杀 | 专攻恶意软件和广告软件，杀毒兜底很好 | 免费版手动扫描 | Defender / Bitdefender | [官网](https://www.malwarebytes.com) |
| **Bitdefender** | 全面防护 | 国际杀软里口碑和查杀率都在第一梯队 | 商业软件 | Kaspersky / Defender | [官网](https://www.bitdefender.com) |

---

## 🔑 密码管理 / 账号

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Bitwarden** | 密码管理 | 开源、跨平台、免费够用，也可自托管 | 界面不是最花哨 | KeePassXC / 1Password | [官网](https://bitwarden.com) |
| **1Password** | 密码管理 | 商业产品里体验非常强 | 订阅制 | Bitwarden | [官网](https://1password.com) |
| **KeePassXC** | 密码管理 / 本地 | 开源本地数据库，不依赖云服务 | 免费开源，同步需自己搭 | Bitwarden / 1Password | [官网](https://keepassxc.org) |

---

## 🧹 系统清理 / 维护 / 硬件检测

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Dism++** | 系统清理 / 优化 | 开源神器，清理、备份、系统瘦身都能干 | 免费开源 | CCleaner / 系统自带 | [官网](https://github.com/Chuyu-Team/Dism-plus-plus) |
| **CrystalDiskInfo** | 硬盘健康检测 | 直观看硬盘寿命、温度、SMART 信息 | 免费 | Hard Disk Sentinel | [官网](https://crystalmark.info/en/software/crystaldiskinfo) |
| **CrystalDiskMark** | 硬盘测速 | 简单直观的磁盘读写测速工具 | 免费 | AS SSD Benchmark | [官网](https://crystalmark.info/en/software/crystaldiskmark) |
| **HWMonitor** | 温度电压监控 | 看 CPU / GPU / 主板状态很直接 | 免费 | HWiNFO / AIDA64 | [官网](https://www.cpuid.com/softwares/hwmonitor.html) |
| **HWiNFO** | 硬件信息 / 传感器 | 信息最全的硬件检测工具，传感器数据丰富 | 免费 | AIDA64 / HWMonitor | [官网](https://www.hwinfo.com) |
| **AIDA64** | 硬件检测 / 压力测试 | 专业级硬件信息与稳定性测试 | 商业软件 | HWiNFO / CPU-Z | [官网](https://www.aida64.com) |

---

## 💾 装机 / 启动盘 / 备份 / 恢复 / 虚拟化

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Rufus** | 启动盘制作 | 小巧稳健，做系统盘非常常用 | 功能聚焦在写盘 | Ventoy | [官网](https://rufus.ie) |
| **Ventoy** | 多系统启动盘 | 一个 U 盘放多个 ISO，非常适合折腾党 | 某些特殊镜像兼容要自己试 | Rufus | [官网](https://www.ventoy.net) |
| **WinToUSB** | Windows 安装盘 / 移动系统 | 制作 Windows 安装盘和 Windows To Go 很方便 | 免费版够用 | Rufus | [官网](https://www.easyuefi.com/wintousb/) |
| **DiskGenius** | 分区 / 克隆 / 数据恢复 | 磁盘分区、数据恢复、迁移系统都很实用 | 免费版够用 | — | [官网](https://www.diskgenius.cn) |
| **Hasleo Backup Suite** | 备份恢复 | 备份 / 克隆 / 系统恢复一体，好上手 | 免费个人版 | — | [官网](https://www.easyuefi.com/backup-software/backup-suite-free.html) |
| **Macrium Reflect** | 系统备份 / 克隆 | 老牌镜像备份，系统整盘克隆很稳 | 免费版够用 | Hasleo / 傲梅轻松备份 | [官网](https://www.macrium.com/reflectfree) |
| **VirtualBox** | 虚拟机 | 免费开源，日常测试够用 | 免费 | VMware / Hyper-V | [官网](https://www.virtualbox.org) |
| **VMware Workstation Player** | 虚拟机 | 性能和兼容性好，免费个人版 | 免费个人使用 | VirtualBox / Hyper-V | [官网](https://www.vmware.com/products/workstation-player.html) |

---

## 🤖 AI 助手 / 大模型

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Claude** | 写作 / 编程 / 分析 | 长文本、代码理解和结构化输出都很强 | 高级配额与模型能力分层 | ChatGPT / Gemini / DeepSeek | [官网](https://claude.ai) |
| **ChatGPT** | 通用 AI 助手 | 通用能力强，插件与生态知名度高 | 高级模型更多依赖订阅 | Claude / Gemini | [官网](https://chat.openai.com) |
| **DeepSeek** | 中文 AI / 编程辅助 | 中文表现和性价比都不错 | 服务能力依赖平台版本 | Claude / ChatGPT | [官网](https://www.deepseek.com) |
| **Google Gemini** | 搜索结合型 AI | 与 Google 生态结合更自然 | 中文体验和场景依版本而异 | Claude / ChatGPT | [官网](https://gemini.google.com) |
| **Kimi** | 长文阅读 / 中文写作 | 很多人会拿它做长文总结与中文问答 | 服务体验看时段 | Claude / DeepSeek | [官网](https://kimi.moonshot.cn) |
| **通义千问** | 中文 AI 助手 | 阿里生态，文档和会议场景整合多 | 服务能力依版本而异 | Kimi / DeepSeek | [官网](https://tongyi.aliyun.com) |
| **文心一言** | 中文 AI 助手 | 百度生态，搜索与中文场景联动 | 体验依版本而异 | 通义 / Kimi | [官网](https://yiyan.baidu.com) |
| **Grok** | 通用 AI 助手 | X 生态整合，风格直接、更新快 | 部分能力需订阅 | ChatGPT / Claude | [官网](https://grok.com) |

---

## 🔤 翻译 / 词典 / 学习

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **网易有道词典** | 翻译 / 查词 | 国内查词翻译最成熟，截图翻译方便 | 免费可用 | 欧路词典 / DeepL | [官网](https://cidian.youdao.com) |
| **欧路词典** | 词典 / 本地词库 | 支持导入词库，本地查词体验好 | 免费版够用 | 有道词典 / MDict | [官网](https://www.eudic.net) |
| **DeepL** | 翻译 | 整句翻译自然度很高，写外文材料常用 | 免费版有长度限制 | Google 翻译 / 有道 | [官网](https://www.deepl.com) |
| **沉浸式翻译** | 网页 / 文档翻译 | 浏览器双语对照翻译，看外文网页和论文很爽 | 免费版够用 | 浏览器自带翻译 | [官网](https://immersivetranslate.com) |

---

## 📝 选择建议

- **只想省心装机**：Edge / 7-Zip / Everything / Snipaste / 微信输入法 / Ditto / VLC / PowerToys 基本闭眼装。
- **学生 / 轻办公**：WPS Office / PDFgear / 腾讯文档 / 石墨文档 / 坚果云 / 网易邮箱大师 / XMind。
- **开发者常用**：VS Code（或 Cursor）+ Git + Windows Terminal + WSL + Docker + DBeaver + Postman / Apifox。
- **设计师常用**：Figma / Pixso + Affinity（或 Adobe CC）+ Krita + Inkscape + Blender。
- **视频创作者**：剪映专业版（入门）/ DaVinci Resolve（进阶）+ OBS Studio + HandBrake + 必剪。
- **游戏玩家**：Steam / Epic / WeGame + PotPlayer + 哔哩哔哩 + Discord / QQ。
- **系统维护**：Rufus / Ventoy + CrystalDiskInfo + CrystalDiskMark + DiskGenius + Hasleo / Macrium Reflect + VirtualBox。
- **AI 尝鲜**：DeepSeek / Kimi（免费中文首选），Claude / ChatGPT / Gemini 按需订阅。

## ⚠️ 最后提醒

- 从官网或官方商店下载，别碰"XX软件园"之类的第三方打包站。
- 装软件不是越多越好，够用就行。电脑不是软件博物馆。
- 如果你不确定装哪个，看每张表里**第一个推荐**通常最稳。
- 系统自带的 Defender、截图、远程桌面、微软拼音其实已经很好，先别急着换。
