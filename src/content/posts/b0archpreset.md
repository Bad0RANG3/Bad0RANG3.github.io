---
title: 'B0ArchPreset：一条命令部署 Shorin DMS + niri 桌面'
description: '为刚安装好的 Arch 系统准备的一键部署脚本：自动安装 niri、Shorin DMS、输入法、主题、驱动与常用开发环境。'
date: 2026-07-10
tags:
  - Arch Linux
  - Niri
  - Wayland
  - Shell
  - 自动化
category: 项目
featured: false
draft: false
---

> 不想在一台刚装好的 Arch 上逐项找桌面、配输入法、改主题？把重复劳动交给脚本就好。

[B0ArchPreset](https://github.com/Bad0RANG3/B0ArchPreset) 是一个给 Arch Linux 及其衍生发行版使用的一键部署脚本。它会把 [Shorin DMS](https://github.com/SHORiN-KiWATA/shorin-dms-niri-git) 与 niri 桌面环境按一套可直接使用的预设装好，完成后重启并在 SDDM 中选择 niri 会话即可进入桌面。

## 适用范围

- Arch Linux 与 Arch 系发行版，例如 CachyOS、EndeavourOS、Garuda、Manjaro；
- systemd、x86_64、pacman 环境；
- 已经联网的全新或较干净的系统。

不支持非 systemd、非 x86_64 或非 pacman 的发行版。

## 最短使用路径

在 root 用户下，或通过 `sudo` 执行：

```bash
pacman -Sy --noconfirm git
git clone https://github.com/Bad0RANG3/B0ArchPreset.git
cd B0ArchPreset
sudo bash install.sh
```

脚本结束后执行 `reboot`，在 SDDM 登录界面选 niri 会话即可。

如果想预先指定用户名、主机名或时区，也可以在启动脚本时传入环境变量：

```bash
sudo TARGET_USER=yourname TARGET_HOSTNAME=myhost TARGET_TIMEZONE=Europe/London bash install.sh
```

## 它会装什么

桌面核心是 **niri**、**Shorin DMS** 和带 sugar-candy 主题的 SDDM；终端与日用工具包括 Kitty、Fish、Starship、fuzzel、fastfetch、btop、yazi 与 zoxide。

输入法使用带补丁的 fcitx5 与 Rime-ice，默认 `Super + Space` 切换；主题由 matugen 从壁纸取色，并同步到 GTK、Kitty、fcitx5、btop、Starship、fuzzel 和 fastfetch。

脚本还会检测 CPU/GPU 来安装相应微码和显卡驱动；常用软件如 QQ、微信、VS Code、Edge、OBS、虚拟机、Wine 及 Python/Node.js 开发套件是可选项，失败不会阻断桌面环境部署。

## 翻车后不用从头来

每个安装阶段都会记录状态。中途网络波动或某一步失败后，重新运行：

```bash
sudo bash install.sh
```

脚本会从中断点继续；若需要强制全部重跑，再加上 `--force`。排查问题时，可以把失败阶段、`/var/log/bad0rang3-shorin-niri-install.log` 最后的日志和 `/etc/os-release` 交给 AI 助手定位。

## 项目地址

- GitHub：[Bad0RANG3/B0ArchPreset](https://github.com/Bad0RANG3/B0ArchPreset)
- License：MIT

