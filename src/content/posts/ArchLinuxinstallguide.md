---
title: '如何借巨人的肩膀装好一个漂亮的 Arch Linux'
description: '用 CachyOS Live 环境、OpenCode、DMS 和 Niri，从 Windows 11 开始装一套可以随时回滚的 Linux 双系统。'
date: 2026-07-02
tags:
  - Arch
category: 教程
featured: false
draft: false
verifiedDate: 2026-07-02
difficulty: 中等
audience: 想从 Windows 开始尝试 Linux 的用户
polished: true
---

这套流程的目标很直接：保留原来的 Windows 11，给 Linux 分出一块空间，安装 CachyOS，最后装上 DMS 和 Niri。安装阶段可以在 Live 环境里用 OpenCode 协助处理分区、引导和驱动；出问题时，也能从 TTY 或 Live USB 回去修，而不是推倒重来。

下面按实际执行顺序来写：先备份，再改固件设置，然后做启动盘、腾空间、进 Live 环境；装完系统以后，再处理桌面环境。

## 开始前准备

需要一台 UEFI 模式的 Windows 11 电脑、一个至少 8 GB 的 U 盘，以及 100 GB 以上可用空间。磁盘最好提前清理，给 Linux 留出足够余量。

先备份重要文件。系统和分区操作通常不会碰个人文件，但备份仍然应该放在动手之前——这是唯一一个“做了以后不会后悔”的步骤。

如果 Windows 开了 BitLocker 或设备加密，先进入系统把它关掉。磁盘分区发生变化后，BitLocker 可能要求恢复密钥，这个问题在安装完成后很难绕开，提前关闭最省事。

需要下载两个文件。

| 文件 | 地址 | 用途 |
| --- | --- | --- |
| CachyOS ISO | [cachyos.org/download](https://cachyos.org/download/) | 安装系统 |
| Rufus | [rufus.ie](https://rufus.ie/) | 写入 U 盘 |

## 调整固件设置

重启电脑，在看到品牌 Logo 时反复按对应按键进入 BIOS 或 UEFI 设置。常见按键如下。

| 品牌 | 按键 |
| --- | --- |
| 华硕 | `F2` 或 `Del` |
| 微星、技嘉 | `Del` |
| 联想 | `F2`，部分机型使用 `F1` 或 Novo 键 |
| 惠普 | `F10` 或 `Esc` |
| 戴尔 | `F2` |
| 华为、荣耀、小米、神舟、机械革命 | 多数为 `F2` |
| Surface | 关机后长按音量加，再按一次电源 |
| Mac | 开机时按住 `Option` |

进入设置以后，检查下面三项。

| 项目 | 设置 |
| --- | --- |
| Secure Boot | Disabled |
| Fast Boot | Disabled |
| CSM 或 Legacy Boot | Disabled |

Secure Boot 会拦截没有进入固件签名数据库的引导程序，关闭以后 CachyOS 的 GRUB 才能正常启动。Fast Boot 会跳过部分硬件初始化和启动项检测，关闭它可以减少 U 盘不识别和 GRUB 加载失败。CSM 则会把启动方式拉回传统 BIOS，和 UEFI 双系统的思路冲突。

部分联想和惠普机器会把 Secure Boot 选项锁住：可以先设置 Supervisor Password，保存后重新进入 BIOS，选项就会开放。改完再决定是否删除这个密码。

按 `F10` 保存并退出。此时先不要插 U 盘。

## 制作启动盘

1. 插入 U 盘，确认里面没有需要保留的数据。
2. 打开 Rufus。
3. 在设备列表里选择 U 盘，注意不要选成移动硬盘。
4. 点击选择，载入下载好的 CachyOS ISO。
5. 分区方案选择 GPT，目标系统选择 UEFI，不要使用 CSM。
6. 其他选项保持默认，点击开始。
7. 如果 Rufus 询问是否下载额外的 GRUB 文件，选择否。CachyOS 镜像已经包含需要的引导文件。

进度结束后，启动盘就制作完成了。

## 从 Windows 腾出空间

再次确认 BitLocker 已经关闭。然后在任务栏搜索“磁盘管理”，打开以后找到 Windows 所在的磁盘。

右键 C 盘，选择“压缩卷”。等待系统查询可以压缩的空间，再输入要给 Linux 的大小：试装可以分配 `51200` MB，日常使用建议 `102400` MB，准备长期作为主力系统时可以给 `204800` MB 或更多。

压缩完成后，磁盘管理里会出现一块标记为“未分配”的空间。**不要格式化，也不要新建卷**，安装程序会在这块空间里创建 Linux 分区。

## 进入 Live 环境

插入启动盘并重启，在品牌 Logo 出现时按启动菜单键。常见快捷键是 `F12`，具体按键和进入 BIOS 相近。在启动设备列表里选择 `UEFI` 开头的 U 盘。

进入 CachyOS 启动菜单后，选择桌面 Live 环境。等待一两分钟进入桌面。此时系统仍然运行在 U 盘上，硬盘里的 Windows 没有被修改。

第一次联网需要手动完成。没有网络，OpenCode 无法连接模型。有线网络插上网线后通常会自动获取地址；Wi-Fi 可以点击桌面右下角的网络图标，也可以打开终端执行下面的命令。

```bash
nmcli device wifi list
nmcli device wifi connect "你的WiFi名" password "你的WiFi密码"
```

如果使用原版 Arch ISO，可以把 `nmcli` 换成 `iwctl`。

```bash
iwctl
device list
station wlan0 scan
station wlan0 get-networks
station wlan0 connect "你的WiFi名"
exit
```

无线网卡名不一定是 `wlan0`，先看 `device list` 的输出。驱动没有加载时，可以使用网线或者手机 USB 网络共享。

## 安装 OpenCode

打开终端，执行下面的命令。

```bash
sudo pacman -S opencode
```

安装完成后运行 OpenCode。

```bash
opencode
```

先让它读取磁盘布局。

```text
show me disk partition layout
```

如果它能够调用 `lsblk -f` 并显示分区，就可以继续安装。OpenCode 在 Live 环境里联网即用，不需要额外配置 API Key。

## 让 OpenCode 协助安装 CachyOS

现在的目标，是在未分配空间里安装 CachyOS，并保留 Windows 的 EFI 分区。把下面这段提示词交给 OpenCode，尖括号内容换成自己的信息。

```text
I want to install CachyOS alongside Windows 11 (dual boot). Do it step by step:

1. First run lsblk -f and show me the partition layout
2. Find the unallocated free space, then:
   - Create a 64GB btrfs partition, mount to /
   - Use the rest of free space as btrfs, mount to /home
3. Find the Windows EFI partition (FAT32), mount it to /boot or /efi
   IMPORTANT: do NOT format it
4. Install base system with pacstrap, then arch-chroot
5. Set timezone to Asia/Shanghai
6. Set locale: en_US.UTF-8 and zh_CN.UTF-8
7. Set hostname to <your-hostname>
8. Create user <your-username> with password <your-password>
9. Add user to wheel group, enable sudo
10. Install and enable NetworkManager
11. Generate fstab
12. Install GRUB with grub-install and grub-mkconfig
13. Enable os-prober to detect Windows
14. Tell me when it is done and I can reboot

Always confirm with me before making important decisions.
```

重要分区会被再次确认。格式化错误分区会直接破坏 Windows，因此不要在 OpenCode 要求确认时随手回答“yes”——先看设备名和分区大小，再决定是否继续。

如果一次提示太长，可以拆成几步，每一步只处理一个目标，检查结果后再继续。

```text
show me disk layout with lsblk -f
```

```text
find the free space, create 64GB btrfs for / and use the rest for /home
```

```text
mount the Windows EFI partition to /boot, do not format it
```

```text
install the base system with pacstrap, then arch-chroot
```

```text
set timezone, locale, hostname, create a user, enable sudo and NetworkManager
```

```text
generate fstab, install GRUB, enable os-prober for Windows dual boot
```

安装结束后重新启动。

```bash
sudo reboot
```

GRUB 菜单里应该能看到 CachyOS 和 Windows Boot Manager。看不到 Windows 时先不要重装，下一节处理引导问题。

## 第一次重启失败时

最常见的原因是 Secure Boot 还开着。回到 BIOS，把 Secure Boot 设为 Disabled，再保存退出。

| 现象 | 常见原因 |
| --- | --- |
| 直接进入 Windows | GRUB 的 EFI 条目没有注册，或者启动顺序仍然指向 Windows |
| 显示 Invalid signature | Secure Boot 拦截了未签名的 GRUB |
| 黑屏 | 显卡驱动或内核参数有问题 |
| CachyOS 启动后卡在服务 | fstab、initramfs 或某个系统服务配置错误 |

如果 GRUB 菜单没有出现，可以使用 Live USB 重新启动，联网并运行 OpenCode。下面这段提示词用于修复已有安装。

```text
My CachyOS won't boot. I booted from the Live USB. Help me fix GRUB:
1. Run lsblk -f to find my partitions
2. Mount the btrfs root partition to /mnt
3. Mount the EFI partition to /mnt/boot
4. arch-chroot into /mnt
5. Reinstall GRUB with grub-install and regenerate grub.cfg
6. Enable os-prober for Windows dual boot
7. Tell me when done
```

如果系统能进入登录界面，但桌面没有启动，可以按 `Ctrl + Alt + F2` 切换到 TTY。输入用户名和密码以后，运行 `opencode`，再把错误现象描述给它。

```text
I installed CachyOS but after reboot it goes to the command line and no desktop appears. Help me fix it.
```

TTY 不依赖图形会话。Wayland 或 Xorg 崩溃时，它仍然可以用来修复系统。修复完成后，用 `Ctrl + Alt + F1` 或发行版对应的功能键回到图形界面。

## 安装 DMS 和 Niri

进入 CachyOS 后先连接网络，可以继续使用 `nmcli`。确认网络可用后再安装桌面环境，否则脚本下载软件时会中断。

下面是一键安装脚本。

```bash
curl -L shorin.xyz/archsetup | bash
```

脚本会先询问软件源，国内网络可以优先选择 Gitee。随后用方向键选择 `Shorin_DMS_Niri`，等待安装完成。

安装过程通常需要二十到四十分钟。脚本会处理下面这些事情。

- 配置国内镜像源。
- 启用 Btrfs 和 Snapper 快照。
- 安装并配置 fcitx5 与 Rime。
- 安装 PipeWire 和 WirePlumber。
- 启用 Bluetooth 服务。
- 识别显卡并安装对应驱动。
- 部署 DMS 和 Niri 桌面配置。
- 检测 Windows EFI 启动项。
- 安装 Firefox、VS Code、Steam、QQ、微信等常用软件。
- 应用 GRUB 主题。

安装完成后重启，进入 SDDM 登录管理器。第一次进入桌面时，可以先处理下面几项。

- 按 `Super + Z` 打开启动器，进入设置更换壁纸。
- 在主题设置里选择 `auto`，让系统根据壁纸生成配色。
- 打开 Firefox 的 pywalfox 扩展，拉取当前主题色。
- 按 `Super + Shift + /` 查看完整快捷键表。

不想使用脚本时，可以让 OpenCode 安装 `shorin-dms-niri-git`，再执行 `shorindms init`。

## 常用操作

| 按键 | 功能 |
| --- | --- |
| `Win + T` | 打开终端 |
| `Win + E` | 打开文件管理器 |
| `Win + Z` | 打开启动器 |
| `Win + Q` | 关闭当前窗口 |
| `Win + Shift + /` | 查看快捷键 |
| `Win + G` 或 `Win + O` | 打开窗口概览 |
| `Win + Alt + O` | 打开 OpenCode |
| `Win + 空格` | 切换输入法 |
| `Win + Alt + A` | 区域截图 |

Niri 的 `Mod` 一般就是键盘上的 Windows 键。

OpenCode 可以继续用来安装软件和排查问题。

```text
install Google Chrome for me
no sound on my computer, help me fix it
update the system
```

也可以使用中文。

```text
帮我安装 Chrome
电脑没有声音，帮我检查一下
```

DMS 还带有聊天助手 Miyu。

```bash
miyu
miyu "where is my niri config file"
```

系统更新推荐先使用带快照的脚本。

```bash
sysup
```

也可以直接调用 pacman。

```bash
sudo pacman -Syu
```

安装和卸载软件可以使用 Shorin 提供的封装命令。

```bash
pac firefox
pacr firefox
```

Btrfs 快照是这套方案里很实用的保险。进行高风险操作前创建快照，出问题时回滚。

```bash
quicksave
quickload
```

## 常见问题

### 开机没有 GRUB 菜单

先确认 Secure Boot 已经关闭。仍然没有菜单时，从 Live USB 启动并让 OpenCode 重建 GRUB 和 NVRAM 条目。

### Secure Boot 能不能不关

可以不关。需要使用 `sbctl` 或者 shim 和 MOK 给 GRUB 与内核签名，流程比关闭 Secure Boot 麻烦很多。普通桌面用户直接关闭更省事。

### 进了 GRUB，选择 CachyOS 后黑屏

常见原因是显卡驱动没有正确初始化，NVIDIA 设备更容易遇到。按 `Ctrl + Alt + F2` 进入 TTY，再交给 OpenCode 检查内核参数和驱动。

```text
CachyOS boots to a black screen after GRUB, probably due to an NVIDIA driver issue. Help me fix it.
```

### 输入法失灵

先重启 fcitx5。

```bash
fcitx5 -rd
```

仍然异常时，让 OpenCode 检查桌面会话和输入法环境变量。

### Wi-Fi 没有连接

先使用 `nmcli`、网线或手机 USB 共享恢复网络。确认能联网后，再让 OpenCode 检查 `rfkill`、NetworkManager 和驱动日志。

### Windows 和 Linux 时间不一致

Windows 通常把硬件时钟当作本地时间，Linux 默认当作 UTC。可以让 Linux 也使用本地时间。

```bash
timedatectl set-local-rtc 1
```

### 想把 Windows 设为默认启动项

让 OpenCode 修改 `/etc/default/grub` 里的 `GRUB_DEFAULT`，然后重新生成 `grub.cfg`。

### 想回到安装前的状态

如果使用 Shorin 脚本，可以执行下面的命令。

```bash
shorin-undochange
shorin-de-undochange
```

有 Btrfs 快照时，也可以在 GRUB 里选择 `Boot from snapshot`，进入系统后执行 `quickload`。

## 感谢

这套流程能跑起来，靠的是 CachyOS、Arch Linux、Niri、DMS、OpenCode 和大量开源项目的维护者。Shorin 把很多零散配置收进了一套可复用的安装流程，也让 Niri 更容易被普通用户接手。

## 参考链接

- [CachyOS](https://cachyos.org/)
- [ArchWiki](https://wiki.archlinux.org/)
- [Niri](https://github.com/YaLTeR/niri)
- [DMS](https://danklinux.com/)
- [Shorin 安装脚本](https://shorin.xyz/wiki/archsetup)
- [OpenCode](https://opencode.ai)
