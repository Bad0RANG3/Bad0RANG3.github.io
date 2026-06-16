---
title: "电脑软件实用清单"
description: "覆盖装机、办公、开发、创作、娱乐与系统维护的一份实用软件清单。"
date: 2025-03-28
updatedDate: 2026-05-03
tags:
  - 软件
  - 工具
  - Windows
category: 资源清单
featured: true
draft: false
---

# 🧰 电脑软件实用清单

> 一份覆盖日常装机、办公协作、开发编程、内容创作、系统维护与娱乐社交的电脑软件推荐清单。

> **推荐原则**
> - 这份清单默认采用 **实用优先** 的推荐口径。
> - 当某个软件存在明显会员墙、强订阅、广告打扰或体验限制时，我会尽量补上更成熟的免费 / 开源 / 一次性买断平替。
> - 所有软件都更建议从官网或官方商店下载，尽量不要碰第三方打包站。

## 🚀 快速入口

- **新电脑先装**：浏览器、压缩、搜索、卸载、截图、下载器、播放器、输入法、终端
- **学生 / 轻办公**：Office、PDF、笔记、思维导图、云同步、邮件、在线协作
- **开发者**：VS Code、Git、Docker、DBeaver、Postman/Apifox、终端、包管理器
- **创作者**：DaVinci Resolve、Blender、Krita、GIMP、OBS Studio、HandBrake
- **系统党 / 折腾党**：Rufus、Ventoy、CrystalDiskInfo、AutoHotkey、PowerToys、VirtualBox、WSL 2
- **远程和多端协作**：RustDesk、Tailscale、Bitwarden、Syncthing、坚果云、LocalSend

---

## 🧱 新电脑必装 / 基础效率

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Microsoft Edge** | 默认浏览、装机即用 | Chromium 内核，兼容性强，Windows 下续航和内存控制都不错 | 免费，预装 | Firefox / Brave | [官网](https://www.microsoft.com/edge) |
| **Firefox** | 主力浏览器 / 隐私优先 | 开源、扩展生态成熟、隐私策略更激进 | 免费开源 | Brave / Edge | [官网](https://www.mozilla.org/firefox) |
| **Brave** | 浏览器 / 去广告 | 自带广告拦截和隐私保护，开箱即用 | 免费 | Firefox + uBlock Origin | [官网](https://brave.com) |
| **7-Zip** | 解压缩 | 开源、轻、稳定，几乎够用一切压缩需求 | 免费开源 | NanaZip / Bandizip | [官网](https://www.7-zip.org) |
| **NanaZip** | Windows 11 风格解压 | 7-Zip 的现代化前端，界面更贴近 Win11 | 免费开源 | 7-Zip | [官网](https://github.com/M2Team/NanaZip) |
| **Everything** | 文件搜索 | 搜索速度极快，装完基本离不开 | 免费 | Listary / uTools | [官网](https://www.voidtools.com) |
| **Geek Uninstaller** | 卸载残留清理 | 小而快，删软件时比系统卸载更干净 | 免费个人版 | Revo Uninstaller Free / HiBit Uninstaller | [官网](https://geekuninstaller.com) |
| **HiBit Uninstaller** | 卸载 + 系统清理 | 比较全能，适合想顺手做清理的人 | 免费 | Geek Uninstaller | [官网](https://hibitsoft.ir/Uninstaller.html) |
| **Snipaste** | 截图 / 贴图 | 截图、标注、贴图一气呵成，效率非常高 | 免费，部分高级功能需付费 | ShareX / PixPin | [官网](https://www.snipaste.com) |
| **ShareX** | 截图 / 录制 / 分享 | 开源且极度全能，适合爱折腾截图流程的人 | 免费开源，学习成本稍高 | Snipaste / PixPin | [官网](https://getsharex.com) |
| **PixPin** | 截图 / 贴图 / 标注 | 体验很顺手，很多人会把它当 Snipaste 平替 | 免费可用 | Snipaste / ShareX | [官网](https://pixpinapp.com) |
| **Ditto** | 剪贴板历史 | 复制过的内容都能找回来，纯效率提升 | 免费开源 | CopyQ | [官网](https://ditto-cp.sourceforge.io) |
| **CopyQ** | 高阶剪贴板管理 | 更强的脚本化和历史管理能力 | 免费开源 | Ditto | [官网](https://hluk.github.io/CopyQ) |
| **PowerToys** | Windows 效率增强 | 微软官方工具集，包含窗口布局、批量重命名、取色器等 | 免费开源 | AutoHotkey（更偏定制） | [官网](https://github.com/microsoft/PowerToys) |
| **AutoHotkey** | 自动化 / 热键脚本 | 定制热键、窗口操作、批处理流程的神器 | 免费开源，需自己写脚本 | PowerToys | [官网](https://www.autohotkey.com) |
| **uTools** | 启动器 / 工具箱 | 适合想“一站式插件工具箱”的用户 | 免费为主，部分功能依赖插件生态 | Listary / Flow Launcher | [官网](https://u.tools) |
| **Flow Launcher** | 启动器 | 开源、轻量、搜索和命令执行都很快 | 免费开源 | uTools / Listary | [官网](https://www.flowlauncher.com) |
| **Listary** | 文件搜索 + 启动器 | 和 Everything 搭配很好，调文件体验顺手 | 免费版够用 | Everything / Flow Launcher | [官网](https://www.listary.com) |
| **LocalSend** | 局域网传文件 | 跨平台局域网快传，体验干净，无需账号 | 免费开源 | KDE Connect / 飞书 / 微信文件传输 | [官网](https://localsend.org) |
| **KDE Connect** | 多端互联 | 手机与电脑之间共享通知、剪贴板和文件 | 免费开源 | LocalSend | [官网](https://kdeconnect.kde.org) |

---

## 💬 办公协作 / 文档处理 / 邮件

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Microsoft 365** | Word / Excel / PowerPoint 主力办公 | 兼容性和行业普及度几乎仍是第一梯队 | 订阅制 | LibreOffice / OnlyOffice / WPS Office | [官网](https://www.microsoft.com/microsoft-365) |
| **WPS Office** | 中文办公 / 模板丰富 | 国内生态、模板和兼容性友好 | 免费可用，但会员功能和广告较多 | LibreOffice / OnlyOffice | [官网](https://www.wps.cn) |
| **LibreOffice** | 免费办公套件 | 开源免费，文字表格演示都能覆盖大多数基础需求 | 界面和细节不如商业套件顺手 | OnlyOffice | [官网](https://www.libreoffice.org) |
| **OnlyOffice** | 文档协作 / Office 兼容 | 开源、界面更现代，对 Office 格式兼容较好 | 重度本地用户未必最顺手 | LibreOffice | [官网](https://www.onlyoffice.com) |
| **Adobe Acrobat Reader** | PDF 阅读 | 老牌 PDF 阅读器，兼容性稳 | 免费阅读，很多编辑能力要订阅 | SumatraPDF / PDFgear / PDF-XChange Editor | [官网](https://get.adobe.com/reader) |
| **PDFgear** | PDF 阅读 / 编辑 / OCR | 免费功能很多，适合普通用户日常 PDF 处理 | 部分复杂场景不如专业商业软件 | PDF-XChange Editor / SumatraPDF | [官网](https://www.pdfgear.com) |
| **PDF-XChange Editor** | PDF 标注 / 编辑 | 功能很全，本地 PDF 处理很强 | 部分高级功能付费 | PDFgear / Foxit PDF Reader | [官网](https://www.pdf-xchange.com/product/pdf-xchange-editor) |
| **SumatraPDF** | 纯阅读器 | 极轻、启动快、看 PDF/epub/mobi 都很舒服 | 基本不负责编辑 | PDFgear / Acrobat Reader | [官网](https://www.sumatrapdfreader.org) |
| **Foxit PDF Reader** | PDF 阅读 | 启动快，国内用户也比较熟悉 | 高级功能多为商业版 | PDFgear / SumatraPDF | [官网](https://www.foxit.com/pdf-reader) |
| **石墨文档** | 在线协作 | 中文团队协作体验不错，适合轻协作 | 进阶功能商业化 | 腾讯文档 / 飞书文档 | [官网](https://shimo.im) |
| **腾讯文档** | 在线文档 / 表格 | 与微信、QQ 生态结合深，分享方便 | 更适合国内协作场景 | 石墨文档 / 飞书文档 | [官网](https://docs.qq.com) |
| **飞书** | 文档 + IM + 会议 | 协作一体化做得比较完整 | 企业使用场景更舒服 | 钉钉 / 企业微信 | [官网](https://www.feishu.cn) |
| **钉钉** | 企业沟通 / 打卡 / 会议 | 企业功能很全，组织管理能力强 | 个人用户未必喜欢它的味道 | 飞书 / 企业微信 | [官网](https://www.dingtalk.com) |
| **企业微信** | 企业沟通 | 微信生态互通能力是明显优势 | 更偏企业流程 | 飞书 / 钉钉 | [官网](https://work.weixin.qq.com) |
| **Outlook** | 邮箱客户端 | Exchange / Outlook 体系兼容好 | 桌面体验和界面风格见仁见智 | Thunderbird / 网易邮箱大师 | [官网](https://outlook.live.com) |
| **Thunderbird** | 邮件客户端 | 开源、跨平台、多账户管理成熟 | 默认体验比较朴素 | Outlook / 网易邮箱大师 | [官网](https://www.thunderbird.net) |
| **网易邮箱大师** | 多邮箱统一管理 | 中文环境友好，收发邮件比较顺手 | 主要是传统邮件客户端定位 | Thunderbird / Outlook | [官网](https://mail.163.com/dashi) |
| **QQ邮箱** | 国内邮箱服务 | 国内使用面广，和 QQ 生态结合强 | 偏服务本身，不是强客户端 | Outlook / 网易邮箱大师 | [官网](https://mail.qq.com) |

---

## 💻 开发编程 / 终端 / 数据库 / 接口调试

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Visual Studio Code** | 通用开发 | 扩展生态最强，前后端和脚本都能打 | 越装越重是常态 | Zed / Sublime Text / JetBrains | [官网](https://code.visualstudio.com) |
| **Zed** | 轻快代码编辑 | 新一代编辑器，速度和现代体验很亮眼 | Windows 生态还在继续完善 | VS Code / Sublime Text | [官网](https://zed.dev) |
| **Sublime Text** | 轻量文本编辑 | 打开和搜索都快，适合轻量编修 | 长线生态不如 VS Code 热闹 | VS Code | [官网](https://www.sublimetext.com) |
| **JetBrains Toolbox** | 专业 IDE 管理 | Java、Python、Web 等重度开发体验依然强 | 商业授权成本较高 | VS Code | [官网](https://www.jetbrains.com/toolbox) |
| **Git** | 版本控制 | 开发基础设施，没它不太行 | 免费开源 | 无 | [官网](https://git-scm.com) |
| **GitHub Desktop** | Git 图形客户端 | 适合不想全靠命令行的人 | 功能深度一般 | Fork / SourceTree | [官网](https://desktop.github.com) |
| **Fork** | Git 图形客户端 | 体验顺滑、冲突处理舒服 | 商业软件，虽不贵但不是开源 | GitHub Desktop / SourceTree | [官网](https://git-fork.com) |
| **Windows Terminal** | 终端 | 微软官方终端，标签页和主题体验都不错 | 免费开源 | Tabby / WezTerm | [官网](https://github.com/microsoft/terminal) |
| **Tabby** | 终端 + SSH | 界面现代，SSH / SFTP 集成顺手 | 功能丰富但资源占用稍高 | Windows Terminal / WezTerm | [官网](https://tabby.sh) |
| **WezTerm** | 高性能终端 | 渲染快、配置强、跨平台一致性好 | 配置偏工程化 | Tabby / Windows Terminal | [官网](https://wezfurlong.org/wezterm) |
| **Docker Desktop** | 容器开发 | 对多数开发者来说是最省心的 Docker 入口 | 商业授权在企业场景有要求 | Rancher Desktop / Podman Desktop | [官网](https://www.docker.com/products/docker-desktop) |
| **Rancher Desktop** | 本地容器环境 | 免费开源，适合作为 Docker Desktop 平替 | 某些细节兼容仍需适应 | Podman Desktop | [官网](https://rancherdesktop.io) |
| **Podman Desktop** | 容器管理 | 更偏开源容器栈，适合想减少 Docker 依赖的人 | 学习成本略高 | Rancher Desktop / Docker Desktop | [官网](https://podman-desktop.io) |
| **Node.js** | 前端 / 工具链 | 前端、脚本和构建链必备 | 免费开源 | Bun（特定场景） | [官网](https://nodejs.org) |
| **Python** | 自动化 / 数据 / 脚本 | 通用度极高，生态无敌 | 免费开源 | Miniconda（偏数据科学） | [官网](https://www.python.org) |
| **Postman** | API 调试 | 功能全，团队协作成熟 | 账号化、云化越来越重 | Bruno / Insomnia / Apifox | [官网](https://www.postman.com) |
| **Bruno** | API 调试 | 本地文件驱动、轻量、适合讨厌云绑定的人 | 团队协作生态不如 Postman | Insomnia / Apifox | [官网](https://www.usebruno.com) |
| **Insomnia** | API 调试 | 界面清爽，REST / GraphQL 都不错 | 新版功能路径变化较多 | Bruno / Postman | [官网](https://insomnia.rest) |
| **Apifox** | API 文档 / 调试 / Mock | 国内团队协作和接口平台一体化做得很好 | 更适合团队平台式使用 | Postman / Bruno | [官网](https://www.apifox.cn) |
| **DBeaver** | 数据库管理 | 开源通用数据库客户端，够全也够稳 | 界面不算最轻快 | Beekeeper Studio / Navicat | [官网](https://dbeaver.io) |
| **Beekeeper Studio** | 轻量数据库客户端 | 界面现代，适合轻量数据库管理 | 复杂场景功能不如 DBeaver 全 | DBeaver | [官网](https://www.beekeeperstudio.io) |
| **Navicat** | 商业数据库工具 | 体验成熟，很多人上手快 | 商业授权价格高 | DBeaver / Beekeeper Studio | [官网](https://www.navicat.com) |
| **WinSCP** | SFTP / SCP 文件传输 | Windows 下老牌稳健工具 | 界面偏传统 | FileZilla | [官网](https://winscp.net) |
| **FileZilla** | FTP / SFTP | 跨平台文件传输工具，够用 | 界面普通 | WinSCP | [官网](https://filezilla-project.org) |
| **Scoop** | Windows 包管理 | 开发者很爱，安装更新方便，无需管理员权限 | 更适合命令行用户 | WinGet / Chocolatey | [官网](https://scoop.sh) |
| **WinGet** | 官方包管理 | 微软官方维护，适合日常安装和更新 | 仓库覆盖度不一定最好 | Scoop / Chocolatey | [文档](https://learn.microsoft.com/zh-cn/windows/package-manager/winget) |
| **Chocolatey** | Windows 包管理 | 老牌包管理器，自动化脚本里很常见 | 某些体验不如 Scoop 干净 | Scoop / WinGet | [官网](https://chocolatey.org) |

---

## 🎨 设计 / 剪辑 / 创作

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Adobe Creative Cloud** | 设计行业全家桶 | 行业标准，生态和兼容性仍然强 | 订阅成本高 | Affinity Suite / GIMP / Krita / Inkscape / DaVinci Resolve / Blender | [官网](https://www.adobe.com/creativecloud.html) |
| **Affinity Suite** | 平面设计 / 排版 / 修图 | 一次性买断思路，对很多个人创作者更友好 | 商业软件，不开源 | Adobe CC / Inkscape / GIMP | [官网](https://affinity.serif.com) |
| **Figma** | UI / UX 设计 | 协作体验极强，设计稿分享方便 | 进阶协作和组织功能收费 | Pixso / 即时设计 / Penpot | [官网](https://www.figma.com) |
| **Penpot** | 开源界面设计 | 开源、团队可自托管，是少有成熟的 Figma 向开源替代 | 中文生态和插件不如 Figma | Pixso / 即时设计 | [官网](https://penpot.app) |
| **Pixso** | 中文 UI 设计 | 国内协作和中文环境更友好 | 深度生态不如 Figma | 即时设计 / Penpot | [官网](https://pixso.cn) |
| **即时设计** | 在线设计协作 | 本土协作体验好，适合国内团队 | 重度生态仍看团队偏好 | Pixso / Figma | [官网](https://js.design) |
| **DaVinci Resolve** | 视频剪辑 / 调色 | 免费版已经非常强，专业度高 | 学习曲线比剪映高 | Kdenlive / Shotcut / Premiere Pro | [官网](https://www.blackmagicdesign.com/products/davinciresolve) |
| **Kdenlive** | 开源视频剪辑 | 免费开源，够用且持续进步 | 稳定性和细节仍看项目版本 | DaVinci Resolve / Shotcut | [官网](https://kdenlive.org) |
| **Shotcut** | 轻量视频剪辑 | 开源，跨平台，适合中轻度剪辑 | 深度调色和协作不如专业工具 | Kdenlive / DaVinci Resolve | [官网](https://shotcut.org) |
| **剪映专业版** | 短视频剪辑 | 上手快、模板多、字幕和包装友好 | 深度专业能力有限 | DaVinci Resolve / Kdenlive | [官网](https://www.capcut.cn) |
| **Blender** | 3D 建模 / 渲染 / 动画 | 开源 3D 工具王者级存在 | 学习成本高 | Cinema 4D / Maya（商业） | [官网](https://www.blender.org) |
| **Krita** | 数字绘画 | 开源、笔刷系统强、板绘体验好 | 不主打照片处理 | GIMP / Photoshop | [官网](https://krita.org) |
| **GIMP** | 图像编辑 | 免费开源，适合基础修图与合成 | 某些高端工作流不如 Photoshop | Affinity Photo / Krita | [官网](https://www.gimp.org) |
| **Inkscape** | 矢量绘图 | 开源矢量工具代表，够做很多 SVG / Logo / 排版图形 | 复杂商业工作流仍有差距 | Adobe Illustrator / Affinity Designer | [官网](https://inkscape.org) |
| **HandBrake** | 视频转码 | 开源压片/转码老工具，稳得像砖头 | 界面不花哨 | Shutter Encoder | [官网](https://handbrake.fr) |
| **Shutter Encoder** | 转码 / 封装 / 媒体处理 | 对创作者特别好用，基于 FFmpeg 做了极强包装 | 功能很多，新手需要适应 | HandBrake | [官网](https://www.shutterencoder.com) |
| **OBS Studio** | 录屏 / 直播 | 免费开源，直播和录屏几乎绕不开 | 初次配置需要时间 | Bandicam | [官网](https://obsproject.com) |
| **Bandicam** | 游戏录制 | 上手简单，录游戏/桌面都很直接 | 商业软件 | OBS Studio | [官网](https://www.bandicam.com) |
| **ScreenToGif** | GIF / 小演示录制 | 录教程、录界面反馈时特别方便 | 更适合轻量录制 | OBS Studio | [官网](https://www.screentogif.com) |

---

## 🌐 网络 / 下载 / 媒体 / 娱乐

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Motrix** | HTTP / BT / 磁力下载 | 开源、界面清爽，多协议一把梭 | 某些特殊站点兼容看资源 | qBittorrent / FDM | [官网](https://motrix.app) |
| **qBittorrent** | BT 下载 | 开源、无广告、规则和 RSS 很强 | 主要偏 BT | Motrix / FDM | [官网](https://www.qbittorrent.org) |
| **Free Download Manager** | 综合下载器 | 免费且功能比较全 | 某些体验不如 IDM 顺滑 | Motrix | [官网](https://www.freedownloadmanager.org) |
| **Internet Download Manager** | 多线程下载 | 老牌下载工具，资源嗅探能力强 | 商业软件 | Motrix / FDM | [官网](https://www.internetdownloadmanager.com) |
| **迅雷** | 国内下载 | 某些国内资源环境确实方便 | 会员和体验限制明显 | Motrix / qBittorrent / FDM | [官网](https://www.xunlei.com) |
| **VLC media player** | 本地音视频播放 | 开源万能播放器，几乎什么都能播 | 界面比较朴素 | MPC-HC / PotPlayer | [官网](https://www.videolan.org/vlc) |
| **MPC-HC** | 轻量本地播放器 | 简洁高效，很多人依旧喜欢 | 相对传统 | VLC / PotPlayer | [官网](https://github.com/clsid2/mpc-hc) |
| **PotPlayer** | 本地视频播放 | 解码强、设置细、适合爱调播放器的人 | 不开源，设置项很多 | VLC / MPC-HC | [官网](https://potplayer.daum.net) |
| **AIMP** | 本地音乐播放 | 对本地音乐党非常友好，轻快稳定 | 主打本地，不是流媒体 | foobar2000 | [官网](https://www.aimp.ru) |
| **foobar2000** | 本地音乐管理 | 可定制度极高，适合本地曲库玩家 | 上手体验偏老派 | AIMP | [官网](https://www.foobar2000.org) |
| **QQ音乐** | 在线音乐 | 曲库和版权较强，国内常用 | 会员墙明显 | 网易云音乐 / 本地播放器 | [官网](https://y.qq.com) |
| **网易云音乐** | 在线音乐 | 推荐算法和社区氛围强 | 会员内容和版权限制也不少 | QQ音乐 | [官网](https://music.163.com) |
| **Steam** | PC 游戏平台 | 生态完整、社区和创意工坊都强 | 主要是买游戏的平台 | Epic Games / GOG Galaxy | [官网](https://store.steampowered.com) |
| **Epic Games** | 游戏平台 | 常送游戏，虚幻相关生态也在这里 | 平台体验不是人人都爱 | Steam | [官网](https://store.epicgames.com) |
| **GOG Galaxy** | 游戏整合管理 | 无 DRM 理念和多平台整合有独特价值 | 国内生态不如 Steam | Playnite | [官网](https://www.gog.com/galaxy) |
| **Playnite** | 游戏库整合 | 开源游戏库管理器，把多个平台聚合在一起 | 配置和插件要自己折腾 | GOG Galaxy | [官网](https://playnite.link) |
| **WeGame** | 国内游戏平台 | 国内联机和社区更接地气 | 平台生态相对封闭 | Steam | [官网](https://www.wegame.com.cn) |

---

## ☁️ 云同步 / 远程控制 / 多设备协作

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **坚果云** | 文件同步 | 历史版本和同步体验都很成熟，轻办公很好用 | 免费空间有限 | Syncthing / OneDrive / Dropbox | [官网](https://www.jianguoyun.com) |
| **OneDrive** | 微软生态云盘 | Office 和 Windows 生态整合强 | 免费空间偏少，体验依赖账户体系 | 坚果云 / Dropbox | [官网](https://www.microsoft.com/microsoft-365/onedrive/online-cloud-storage) |
| **Dropbox** | 多端同步 | 老牌同步工具，分享和历史版本成熟 | 免费空间偏小 | 坚果云 / OneDrive | [官网](https://www.dropbox.com) |
| **百度网盘** | 大文件分享 | 国内覆盖最广，很多资源离不开它 | 会员和限速口碑问题明显 | 阿里云盘 / 坚果云 | [官网](https://pan.baidu.com) |
| **阿里云盘** | 国内网盘 | 上传下载体验相对好，分享方便 | 生态上仍属于网盘逻辑 | 百度网盘 / 天翼云盘 | [官网](https://www.aliyundrive.com) |
| **Syncthing** | 多设备文件同步 | 开源、点对点、无中心化账号依赖，非常适合自用同步 | 配置比网盘复杂 | 坚果云 / Resilio Sync | [官网](https://syncthing.net) |
| **Resilio Sync** | 设备间同步 | P2P 同步速度和思路都不错 | 商业授权 | Syncthing | [官网](https://www.resilio.com/sync/) |
| **RustDesk** | 远程桌面 | 开源、可自建，平替 TeamViewer/AnyDesk 的优先选项 | 某些网络环境需自己调 | ToDesk / AnyDesk | [官网](https://rustdesk.com) |
| **ToDesk** | 远程协助 | 国内连接体验不错，个人用户常见 | 商业化路径越来越明显 | RustDesk / 向日葵 | [官网](https://www.todesk.com) |
| **向日葵** | 远程控制 | 国内远程控制老牌工具 | 部分功能与流量策略偏商业化 | RustDesk / ToDesk | [官网](https://sunlogin.oray.com) |
| **AnyDesk** | 轻量远程控制 | 低延迟体验不错 | 商业软件 | RustDesk | [官网](https://anydesk.com) |
| **TeamViewer** | 远程桌面 | 老牌跨平台工具，企业认知度高 | 商业限制明显 | RustDesk / AnyDesk | [官网](https://www.teamviewer.com) |
| **Tailscale** | 组网 / 内网穿透体验优化 | 基于 WireGuard，几乎是最好上手的异地组网体验 | 免费够个人，团队高级功能收费 | ZeroTier | [官网](https://tailscale.com) |
| **ZeroTier** | 虚拟局域网 | 跨平台组网很成熟 | 配置理解门槛略高 | Tailscale | [官网](https://www.zerotier.com) |

---

## 🔐 安全 / 隐私 / 账号管理

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Bitwarden** | 密码管理 | 开源、跨平台、免费够用，也可自托管 | 界面不是最花哨 | KeePassXC / 1Password | [官网](https://bitwarden.com) |
| **KeePassXC** | 本地密码库 | 开源、离线、纯本地党会很喜欢 | 同步体验需自己管 | Bitwarden | [官网](https://keepassxc.org) |
| **1Password** | 密码管理 | 商业产品里体验仍然非常强 | 订阅制 | Bitwarden | [官网](https://1password.com) |
| **Aegis Authenticator** | 2FA 管理 | 开源、离线、备份导出清晰 | 主要是移动端核心 | Bitwarden Authenticator / Authy | [官网](https://getaegis.app) |
| **Proton Pass** | 密码管理 | 注重隐私的生态方案 | 免费版与生态绑定感更强 | Bitwarden | [官网](https://proton.me/pass) |
| **VeraCrypt** | 文件 / 分区加密 | 开源经典，适合本地敏感数据加密 | 需要自己理解卷与挂载 | 7-Zip AES 压缩（轻量场景） | [官网](https://www.veracrypt.fr) |
| **火绒安全** | Windows 安全防护 | 轻、安静、日常防护体验好 | 主要针对 Windows | Microsoft Defender | [官网](https://www.huorong.cn) |
| **Microsoft Defender** | 系统自带防护 | 对普通用户而言已经足够强，系统整合最好 | 对进阶用户可见度略弱 | 火绒安全 | [官网](https://support.microsoft.com/windows) |
| **Malwarebytes** | 恶意软件补充扫描 | 偶发排障时很有用 | 实时防护高级版收费 | 火绒 / Defender | [官网](https://www.malwarebytes.com) |
| **BleachBit** | 隐私清理 / 垃圾清理 | 开源、直给，不像某些“电脑管家”那么花 | 用前最好看清清理项 | CCleaner | [官网](https://www.bleachbit.org) |

---

## 🧯 系统维护 / 装机 / 恢复 / 虚拟化

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Rufus** | 启动盘制作 | 小巧稳健，做系统盘非常常用 | 功能聚焦在写盘 | Ventoy | [官网](https://rufus.ie) |
| **Ventoy** | 多系统启动盘 | 一个 U 盘放多个 ISO，非常适合折腾党 | 某些特殊镜像兼容要自己试 | Rufus | [官网](https://www.ventoy.net) |
| **CrystalDiskInfo** | 硬盘健康检测 | 直观看硬盘寿命、温度、SMART 信息 | 免费 | Hard Disk Sentinel | [官网](https://crystalmark.info/en/software/crystaldiskinfo) |
| **HWMonitor** | 温度电压监控 | 看 CPU / GPU / 主板状态很直接 | 免费 | HWiNFO | [官网](https://www.cpuid.com/softwares/hwmonitor.html) |
| **HWiNFO** | 硬件监控 | 信息最全的那类硬件传感器工具 | 信息量巨大，新手会晕 | HWMonitor / AIDA64 | [官网](https://www.hwinfo.com) |
| **AIDA64** | 硬件检测 / 压力测试 | 硬件信息和测试能力都很强 | 商业软件 | HWiNFO | [官网](https://www.aida64.com) |
| **Macrium Reflect** | 系统镜像备份 | 做整盘镜像和恢复很稳 | 商业化 | Hasleo Backup Suite / Windows 系统映像 | [官网](https://www.macrium.com/reflectfree) |
| **Hasleo Backup Suite** | 备份恢复 | 备份 / 克隆 / 系统恢复一体，个人用户很好上手 | 知名度不如老牌工具 | Macrium Reflect | [官网](https://www.easyuefi.com/backup-software/backup-suite-free.html) |
| **Clonezilla** | 系统克隆 / 灾备 | 开源强力工具，适合克隆和离线恢复 | 界面和门槛较高 | Macrium Reflect | [官网](https://clonezilla.org) |
| **VirtualBox** | 虚拟机 | 免费开源，适合日常测试环境 | 某些场景性能不如商业方案 | VMware Workstation / QEMU | [官网](https://www.virtualbox.org) |
| **VMware Workstation** | 虚拟机 | 桌面虚拟化体验成熟 | 商业导向 | VirtualBox | [官网](https://www.vmware.com/products/workstation-pro.html) |
| **WSL 2** | Windows 跑 Linux | 对开发者特别友好，不必单独起虚拟机 | 更偏开发，不是完整桌面替代 | VirtualBox / QEMU | [文档](https://learn.microsoft.com/zh-cn/windows/wsl) |
| **QEMU** | 模拟器 / 特殊环境 | 开源底层能力强，架构支持广 | 门槛高 | VirtualBox / VMware | [官网](https://www.qemu.org) |
| **DiskGenius** | 分区 / 克隆 / 数据恢复 | 磁盘分区、数据恢复、迁移系统时都很实用 | 部分高级能力付费 | GParted / Hasleo Backup Suite | [官网](https://www.diskgenius.cn) |

---

## 🤖 AI / 笔记 / 思维整理 / 学习研究

| 软件 | 适用场景 | 推荐理由 | 成本 / 限制 | 可替代方案 | 官网 |
|:-----|:---------|:---------|:------------|:-----------|:-----|
| **Claude** | 写作 / 编程 / 分析 | 长文本、代码理解和结构化输出都很强 | 高级配额与模型能力分层 | ChatGPT / Gemini / DeepSeek | [官网](https://claude.ai) |
| **ChatGPT** | 通用 AI 助手 | 通用能力强，插件与生态知名度高 | 高级模型更多依赖订阅 | Claude / Gemini | [官网](https://chat.openai.com) |
| **DeepSeek** | 中文 AI / 编程辅助 | 中文表现和性价比都不错 | 服务能力依赖平台版本 | Claude / ChatGPT | [官网](https://www.deepseek.com) |
| **Google Gemini** | 搜索结合型 AI | 与 Google 生态结合更自然 | 中文体验和场景依版本而异 | Claude / ChatGPT | [官网](https://gemini.google.com) |
| **Kimi** | 长文阅读 / 中文写作 | 很多人会拿它做长文总结与中文问答 | 服务体验看时段 | Claude / DeepSeek | [官网](https://kimi.moonshot.cn) |
| **Obsidian** | 本地笔记 / 知识库 | Markdown 本地优先，插件多，适合长期积累 | 同步和协作需自己搭或付费 | Logseq / Joplin / Notion | [官网](https://obsidian.md) |
| **Logseq** | 双链笔记 / 大纲知识管理 | 开源、适合知识网络和学习笔记 | 同步和移动端体验仍看个人接受度 | Obsidian | [官网](https://logseq.com) |
| **Joplin** | 笔记 / 同步 | 开源、跨平台、支持自同步 | 界面比较朴素 | Obsidian / Notion | [官网](https://joplinapp.org) |
| **Notion** | 协作知识库 / 项目记录 | 数据库和页面一体化，协作展示很方便 | 重度离线与中文搜索体验未必人人满意 | Obsidian / 飞书文档 | [官网](https://www.notion.so) |
| **XMind** | 思维导图 | 做梳理、复盘、提纲特别顺手 | 高级功能订阅化 | Freeplane / ProcessOn | [官网](https://xmind.app) |
| **Freeplane** | 开源思维导图 | 免费开源，适合内容型思维导图 | 界面不如商业软件现代 | XMind | [官网](https://www.freeplane.org) |
| **Zotero** | 文献管理 | 开源学术文献管理强项，学生和研究用户很需要 | 中文普及度不如普通笔记工具 | Obsidian + 插件（轻量） | [官网](https://www.zotero.org) |
| **Anki** | 记忆卡片 | 开源闪卡工具，背单词、术语、知识点都很有效 | 上手方式和制作成本需要习惯 | RemNote（偏学习生态） | [官网](https://apps.ankiweb.net) |

---

## 📝 选择建议

- **只想省心装机**：Edge / 7-Zip / Everything / Snipaste / Ditto / Motrix / VLC / PowerToys 基本闭眼装。
- **想少花钱又尽量强**：办公先看 LibreOffice / OnlyOffice，设计先看 Krita / GIMP / Inkscape / Blender，远程优先 RustDesk，密码管理优先 Bitwarden。
- **开发者常用组合**：VS Code + Git + Windows Terminal / Tabby + Docker / Rancher Desktop + DBeaver + Bruno / Apifox + WinGet / Scoop。
- **创作者常用组合**：DaVinci Resolve + Blender + Krita + OBS Studio + HandBrake / Shutter Encoder。
- **系统维护组合**：Ventoy / Rufus + CrystalDiskInfo + HWiNFO + Hasleo Backup Suite + VirtualBox / WSL 2。

## ⚠️ 最后提醒

- 优先使用官网、GitHub Releases 或官方商店分发渠道。
- 免费不一定最好，开源也不等于一定更适合你；真正重要的是 **你的场景 + 你的成本接受度 + 你的使用频率**。
- 如果你只是普通用户，不要为了“更全能”把电脑装成软件博物馆，保持少而稳通常更舒服。
