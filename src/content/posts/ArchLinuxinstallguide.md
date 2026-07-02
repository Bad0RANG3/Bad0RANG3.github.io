---
title: '如何借巨人肩膀安装好一个美丽的 Arch Linux'
description: '你说得对人家挺懒的，所以还是用 AI 吧喵~'
date: 2026-07-02
tags:
  - Arch
category: 教程
featured: false
draft: false
---

# CachyOS + Windows 11 双系统 + DMS + Niri 桌面环境 完全指南

> **写给没时间折腾的主人**：你只需要会打字，剩下的交给 AI 喵~
>
> 本文是人家的**实操记录**——全程在 Live 环境里装上 OpenCode，然后用 AI 帮人家装好了整个系统。如果主人也想像人家一样躺平，照着做就行啦！

---

## 这个指南是写给谁的喵？

- 你有一台装了 **Windows 11** 的电脑，但想蹭蹭 Linux 又舍不得删 Windows
- 你听说过 **Arch Linux** 的威名，但被那些"手搓命令行、徒手写分区表"的传说吓得尾巴都炸了
- 你**不想背命令**，**不想啃又臭又长的英文 Wiki**
- 你想让 **AI 帮你干所有脏活累活**，自己喝着奶茶监工就好

那这篇指南就是为你量身定做的喵~

### 我们的战术是啥？

```
用 CachyOS（Arch 的调教版）的 Live 环境启动
          ↓
在 Live 环境里装上 OpenCode（AI 小助手）
          ↓
让 AI 帮你安装系统、装驱动、配桌面
          ↓
装好后万一翻车 → 按 Ctrl+Alt+F2 进 TTY → 运行 opencode → 让 AI 救你
```

全程只需要 **能联网** 和 **会 Ctrl+C Ctrl+V**，门槛比泡面还低喵！

### OpenCode 是什么东东？

简单说：**一个运行在终端里的 AI 助手，你说人话，它帮你敲命令。**

- 你跟它说 "connect to Wi-Fi"，它就帮你连
- 你跟它说 "partition the disk and install the system"，它就帮你把系统装好
- 你跟它说 "GRUB is broken, fix it"，它就帮你修引导
- **不需要折腾什么 API Key**，装好就能用，自带的 deepseek 模型完全够打

它不是那种只会跟你聊天的花瓶 AI——它是真的能 `sudo`、真的能读写文件、真的能帮你把系统装好的实干派！

### ⚠️ 关于语言的问题

**Live 环境里没有中文输入法**，所以和 AI 对话必须用英文喵。

不过别怕，每个步骤下面人家都准备好了**现成的英文话术**，主人直接复制粘贴丢给 AI 就行，不用自己动脑子造句。

等进了系统、装好 DMS 桌面之后，中文输入法就有了，之后想用中文跟 AI 撒娇还是用英文下命令都随你啦~

---

## 目录

1. [准备工作](#1-准备工作)
2. [BIOS / UEFI 设置（最关键的坎）](#2-bios--uefi-设置最关键的坎)
3. [制作 CachyOS 安装盘](#3-制作-cachyos-安装盘)
4. [在 Windows 里腾出空间](#4-在-windows-里腾出空间)
5. [进入 Live 环境，装上 AI 小助手](#5-进入-live-环境装上-ai-小助手)
6. [让 AI 帮你安装 CachyOS](#6-让-ai-帮你安装-cachyos)
7. [重启后万一进不去系统怎么办](#7-重启后万一进不去系统怎么办)
8. [进系统后 —— 装桌面环境（DMS + Niri）](#8-进系统后--装桌面环境dms--niri)
9. [日常使用](#9-日常使用)
10. [常见问题 FAQ](#10-常见问题-faq)
11. [鸣谢](#11-鸣谢)

---

## 1. 准备工作

### 需要准备什么喵？

| 需要的东西 | 说明 |
|----------|------|
| 一台装了 Windows 11 的电脑 | 固件必须是 UEFI 模式（2015 年以后的电脑基本都是，不用慌） |
| **100 GB 以上的未分配磁盘空间** | 如果硬盘塞满了，先清理一下那些"下完就没看过"的电影和"买了就没玩过"的游戏喵 |
| 一个 U 盘 | 8GB 以上即可，做好里面数据被清空的觉悟 |
| 能上网 | 有线（插网线）或者 Wi-Fi 都行 |

### ⚠️ 重要提醒（新手必看喵！）

1. **先备份你的重要文件！** 虽然装系统大概率不会丢数据——但那是"大概率"不是"绝对"，万一你就是那个天选倒霉蛋呢？备份一下又不费事。
2. **如果你电脑开了 BitLocker 或"设备加密"**（品牌机预装的 Windows 11 几乎默认都开了），**进 Windows 把它关掉再继续**。操作路径：
   - 按 `Win` 键，搜索"设备加密"或"BitLocker"
   - 点进去 → **关闭**
   - 如果不关，装完双系统后 BitLocker 发现分区布局变了，会触发恢复密钥验证——到时候进不去 Windows 可别怪人家没提醒你喵！
3. **下面步骤看不懂也没关系**，主人只需要坚持到第 5 节，后面的脏活累活全丢给 AI 就行。

### 需要下载什么喵？

| 文件 | 去哪下载 | 干啥用 |
|------|---------|--------|
| **CachyOS 镜像**（`.iso` 文件） | https://cachyos.org/download/ | 这是我们要装的系统本体 |
| **Rufus**（写盘工具） | https://rufus.ie/ | 把 `.iso` 写进 U 盘，让它变成可启动的安装盘 |

---

## 2. BIOS / UEFI 设置（最关键的坎）

> **这是整个流程里翻车率最高的一步喵。** Secure Boot 不关的话，装完 CachyOS 大概率开机直接跪。

### Secure Boot 是什么？为什么不关不行？

Secure Boot 是 UEFI 固件里的一道安全检查：它只允许启动那些**被微软签名过的 EFI 可执行文件**。CachyOS 使用的 GRUB 引导程序没有经过微软签名（或者说你主板的签名数据库里没收录它的 hash），所以会被固件直接拦截。

**关掉它有什么安全风险吗？** 对普通桌面用户来说——几乎没有。Secure Boot 主要防的是 Bootkit 级别的恶意软件，而这类攻击在你的使用场景里基本不存在。Windows 11 官方要求 Secure Boot 更多是 OEM 厂商的商业合规需求，不是说你关了电脑就会中毒。

**如果不关，你可能会遇到：**
- 装完了重启 → 直接进了 Windows，仿佛刚才的安装是一场梦
- 装完了重启 → 屏幕显示 `Invalid signature detected` 或 `Security violation`（主板在对你说"我不认识这个系统，不给过"）
- 装完了重启 → 黑屏，啥也没有（主板直接把 GRUB 毙了）

**关机重进 BIOS 就行，不会损坏你的电脑硬件喵。**

### 怎么进 BIOS 喵？

重启电脑，在屏幕刚亮的时候（品牌 Logo 出现的那一刻），**疯狂按**下面的键——对，就是那种"键盘快被你按冒烟"的手速：

| 你的电脑品牌 | 按哪个键 |
|------------|---------|
| 华硕 ASUS | `F2` 或 `Del`（Delete 键） |
| 微星 MSI | `Del` |
| 技嘉 Gigabyte | `Del` |
| 联想 Lenovo | `F2`（部分按 `F1` 或侧面的 Novo 小孔） |
| 惠普 HP | `F10` 或 `Esc` |
| 戴尔 Dell | `F2` |
| 华为 / 荣耀 | `F2` |
| 小米 | `F2` |
| 神舟 / 机械革命 | `F2` |
| Surface | 先关机，然后长按"音量+"键，同时按一下开机键 |
| 苹果 Mac | 开机时按住 `Option (⌥)` 键 |

> **如果按了没反应**：重启再来一次，按得更快更早。BIOS 的检测窗口非常短，错过了就直接进系统了喵。

### 进了 BIOS 之后要改什么

用方向键（或鼠标）找到下面这些设置项，逐一改掉：

| 设置项 | 一般藏在哪里 | 改成什么 |
|--------|---------|---------|
| **Secure Boot**（安全启动） | Security（安全）菜单 | **Disabled（关闭）** |
| **Fast Boot**（快速启动） | Boot（启动）菜单 | **Disabled（关闭）** |
| **CSM** 或 **Legacy Boot** | Boot 菜单 | **Disabled**（强制纯 UEFI 模式） |

> 为什么 Fast Boot 也要关？Fast Boot 会跳过部分硬件初始化和启动项检测，可能导致 GRUB 来不及加载或 U 盘不被识别。关了它，开机慢那两三秒换来的是稳定，很划算喵。

> ⚠️ **部分品牌的笔记本**（联想和惠普的某些型号是惯犯）BIOS 里 Secure Boot 选项是灰色的，不让你改。那是被厂商藏起来了。破解方法：
> 1. 进 BIOS 先设置一个**管理员密码**（Set Supervisor Password / Administrator Password）
> 2. 保存退出再进 BIOS，Secure Boot 选项就变亮可以改了
> 3. 关掉后，记得回去把那个密码删掉（除非你想每次进 BIOS 都输密码）

改好后按 `F10` 保存并退出，电脑会重启。**这时候先别插 U 盘喵！**

---

## 3. 制作 CachyOS 安装盘

在 **Windows 11 里**操作就行啦：

1. 插上 U 盘（⚠️ **U 盘里所有数据会被清空**，先确认没有重要文件）
2. 打开刚下载的 **Rufus**（不需要安装，直接双击 `.exe` 就能跑）
3. "设备"下拉框选你的 U 盘（看清楚盘符，别选成移动硬盘了喵）
4. "引导类型选择"处点击 **"选择"** → 找到你下载的 CachyOS `.iso` 文件
5. "分区方案"选 **GPT**，"目标系统"选 **UEFI（非 CSM）**——Rufus 通常会自动检测并选对，主人只需确认一眼
6. 其他选项保持默认即可，点 **"开始"**
7. 如果弹出"需要下载额外文件"的提示（Rufus 想帮你下载新版 Grub），选**"否"**——CachyOS 镜像自带引导文件，不需要它多管闲事
8. 等进度条走完，一个热乎的 CachyOS Live USB 就诞生了喵~

---

## 4. 在 Windows 里腾出空间

> ⚠️ 再提醒一次！开了 BitLocker / 设备加密的话，**先去关掉再操作**（见第 1 节）

1. 在任务栏搜索框搜 **"磁盘管理"**，打开它（或者右键"此电脑" → "管理" → "磁盘管理"）
2. 找到你的 C 盘（通常是最大的那个 NTFS 分区），右键点它 → **"压缩卷"**
3. Windows 会先查询可压缩空间（这个过程叫"查询压缩空间"，可能需要等一会儿，别急喵）
4. 在"输入压缩空间量"里输入你想给 Linux 的大小（单位是 MB）：
   - **只是试水**：`51200`（≈ 50GB）
   - **日常使用**：`102400`（≈ 100GB）
   - **重度使用 / 主力机**：`204800`（≈ 200GB）以上
5. 点"压缩"
6. 压缩完成后，你会看到一块**黑色标签**的"未分配"区域
7. **不要对它做任何操作！不要右键格式化！不要新建卷！** 就放在那里，那是留给 Linux 的地盘喵

---

## 5. 进入 Live 环境，装上 AI 小助手

### 5.1 用 U 盘启动

1. 把做好的 U 盘插到电脑上
2. 重启电脑
3. 在屏幕亮起时狂按 `F12`（或你品牌的启动菜单键，参考第 2 节的 BIOS 键位表）
4. 在启动设备列表里选你的 U 盘（名字通常是 U 盘品牌名，或者 "UEFI: USB..." 开头的那个）
5. 看到 CachyOS 启动菜单后，选 **"CachyOS Desktop Live"**（第一个选项通常就是）
6. 等大约 1-2 分钟，进入 Live 桌面——注意此时整个系统还在 U 盘里跑，硬盘上的 Windows 纹丝未动，放一万个心喵~

### 5.2 连上网络

进 Live 桌面后，**第一件事是联网**——没网的话 AI 就是离线废猫一只：

- **有线网络**：插上网线一般 DHCP 自动获取 IP，啥都不用干
- **Wi-Fi**：桌面右下角系统托盘找网络图标 → 选你的 Wi-Fi → 输密码

或者你也可以尝试叫 AI 来帮你连——但等等，AI 还没装呢喵！先手动连一下，就这一次啦。

### 5.3 在 Live 环境里安装 OpenCode

打开终端（桌面找黑色图标，或者按 `Ctrl + Alt + T`），输入：

```bash
sudo pacman -S opencode
```

`pacman` 是 Arch Linux 的包管理器，`-S` 的意思是"同步并安装"（sync）。这条命令的意思就是"以 root 权限从软件仓库同步安装 opencode 这个包"。等几秒钟，叮~ AI 助手到货啦！

### 5.4 检查一下 AI 能不能用

```bash
# 运行：
opencode
```

它会进入交互式对话界面。先试一句，验证它确实在工作（复制粘贴这个）：

```
show me disk partition layout
```

如果它刷拉拉地打印出了你硬盘的分区信息（`lsblk -f` 的输出），说明一切正常，可以进行下一步了喵~

> 💡 **OpenCode 自带的 deepseek 模型不需要配置任何 API Key**，Live 环境下联网即用。就是这么省心喵~

---

## 6. 让 AI 帮你安装 CachyOS

### 6.1 核心思路

你现在在 **Live 环境**（系统在 U 盘里跑），目标是把它**装到电脑硬盘上**，做成和 Windows 共存的**双系统**。

什么叫双系统？简单说就是：在你的硬盘上开两个"房间"——Windows 住一个，CachyOS 住另一个。每次开机时 GRUB（引导程序）会问你"要去哪个房间"，你选一个进就行。它们互不干扰，各过各的小日子。

接下来的所有操作，**全部交给 AI**：

```bash
# 在终端里运行：
opencode
```

然后**复制粘贴下面这段话**给 AI（记得先把方括号里的占位符换成你自己的信息）：

```
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
7. Set hostname to [your-hostname]
8. Create user [your-username] with password [your-password]
9. Add user to wheel group, enable sudo
10. Install and enable NetworkManager
11. Generate fstab
12. Install GRUB (grub-install + grub-mkconfig)
13. Enable os-prober to detect Windows
14. Tell me when it's done and I can reboot

Always confirm with me before making important decisions.
```

> **⚠️ 注意**：`[your-username]`、`[your-password]`、`[your-hostname]` 这三个地方换成你自己的。比如 username 叫 `nyanmaster`，hostname 叫 `catgirl-pc`（开玩笑的，随便起）。

AI 会一步一步帮你执行。如果它中途停下来问你要确认（比如"这个分区要格式化吗？"、"GRUB 装到哪个盘？"），回答 `yes` 或 `default` 就行——它基本不会问蠢问题，问的时候都是在保护你喵。

如果你觉得上面那一大坨英文太长了看着头晕，也可以**拆成分步投喂**——每次只让 AI 做一件事（把下面这些逐步复制粘贴给它）：

```
show me disk layout with lsblk -f
```

```
find the free space, create 64GB btrfs for / and rest btrfs for /home
```

```
mount Windows EFI partition to /boot, DO NOT format it
```

```
install base system with pacstrap and arch-chroot
```

```
set timezone Asia/Shanghai, locale, hostname, create user, sudo, NetworkManager
```

```
generate fstab, install GRUB, enable os-prober for Windows dual boot
```

怎么舒服怎么来，人家两种都用过，效果一样的喵~

### 6.2 装完之后

等 AI 说"装完了，可以重启了"：

```bash
# 在终端里输入：
sudo reboot
```

拔掉 U 盘（或者不拔也行，只要 BIOS 里把硬盘启动优先级调到 U 盘前面即可）。

重启后你会看到一个 **GRUB 引导菜单**——一个黑底白字的选单界面，里面至少有两项：
- **CachyOS** ← 选这个进入你的新系统
- **Windows Boot Manager** ← 选这个回到 Windows

> 如果看不到 Windows 选项，或者直接进了 Windows 没看到 GRUB——**不要慌，不要炸毛**——看下一节喵。

---

## 7. 重启后万一进不去系统怎么办

这是新手最怕遇到的情况，但真的**不用怕**喵。你遇到的问题，99% 都是同一个原因，而且修起来就几分钟的事。

### 你可能会遇到什么

| 现象 | 根本原因 | 心理安慰 |
|------|------------|---------|
| 直接进了 Windows，GRUB 菜单没出现 | UEFI 固件按照 BootOrder 优先启动了 Windows Boot Manager，而 GRUB 的 EFI 条目没有成功注册到 NVRAM | 你的 CachyOS 还在硬盘上，只是没人叫它起床 |
| 屏幕显示 "Invalid signature" 或 "Security violation" | Secure Boot 没关，固件验签不通过，拒绝执行 GRUB 的 `grubx64.efi` | 关掉就好了，不需要重装任何东西 |
| 黑屏，啥也没有 | 可能是显卡驱动在内核启动阶段加载失败了（尤其是 NVIDIA 独显直出的笔记本） | TTY 还活着，能修 |
| 能看到 GRUB 但选了 CachyOS 后卡在某个服务 | 某步系统配置出了问题（比如 fstab 写错了、initramfs 没正确生成） | Live USB 进去修一下就好 |

### 怎么办喵？

**第一步：关 Secure Boot**

重启进 BIOS → 找到 Secure Boot → **Disabled** → F10 保存退出。这条解决 80% 的翻车情况。

> 如果之前忘关了，现在关掉就行，**完全不需要重装系统**——GRUB 和 CachyOS 的二进制文件都已经安安静静躺在你的硬盘上了，跟 Secure Boot 半点关系都没有。

**第二步：如果还不行，用 Live U 盘修复 GRUB**

1. 插上你的 CachyOS Live USB
2. 从 U 盘启动进 Live 桌面
3. 联网，装 OpenCode（如果之前没装）：
   ```bash
   sudo pacman -S opencode
   ```
4. 运行 AI：
   ```bash
   opencode
   ```
5. 把下面这段话丢给它：

   ```
   My CachyOS won't boot. I booted from Live USB. Help me fix GRUB:
   1. Run lsblk -f to find my partitions
   2. Mount root partition (btrfs) to /mnt
   3. Mount EFI partition to /mnt/boot
   4. arch-chroot into /mnt
   5. Reinstall GRUB: grub-install and grub-mkconfig
   6. Enable os-prober for Windows dual boot
   7. Tell me when done
   ```

### 更通用的修复模板

进 Live 环境 → 联网 → `sudo pacman -S opencode` → `opencode` → 粘贴：

```
My installed CachyOS can't boot. I'm in Live environment.
1. Check my disks with lsblk -f
2. Find the btrfs root partition, mount it to /mnt
3. Mount EFI partition to /mnt/boot
4. arch-chroot to /mnt
5. Regenerate GRUB: grub-mkconfig -o /boot/grub/grub.cfg
6. Check if Windows is detected
Tell me what you find first.
```

### 如果进系统了，但桌面崩了

如果你进了 CachyOS（能看到字符终端的 login 界面），但桌面出不来了：

1. 按 `Ctrl + Alt + F2`（或 F3、F4）**切换到 TTY**——Linux 提供 6 个独立的虚拟终端（tty1 到 tty6），图形桌面通常跑在 tty1，剩下的是纯文本终端，互不干扰
2. 你会看到 `login:` 提示，输入用户名和密码（输密码时屏幕上不会显示任何字符，正常现象，继续打完回车就好）
3. 运行 AI：
   ```bash
   opencode
   ```
4. 告诉它出了什么问题，比如：

   ```
   I installed CachyOS but after reboot it goes to command line, no desktop. Help me fix it.
   ```

> 💡 **TTY 是 Linux 最硬核的安全网**——Xorg/Wayland 崩成什么样都不影响它。`Ctrl + Alt + F2~F6` 是六条救命通道，F1 通常绑定图形会话。修好了按 `Ctrl + Alt + F1`（或 F7，看发行版）跳回去喵。

---

## 8. 进系统后 —— 装桌面环境（DMS + Niri）

恭喜喵！现在你已经有了一台跑着 CachyOS 的电脑。但它还很"素"——没有漂亮的桌面，没有毛玻璃，没有丝滑动画，什么都没有。就像一个刚买了还没装修的毛坯房。

我们要装修的是 **DMS（DankShell Management System）** + **Niri**。这是由 **Shorin** 精心打造的一整套 Arch 桌面环境：

- **窗口管理器**：**Niri**——一种叫"可滚动平铺"（scrollable tiling）的 Wayland 合成器。不像传统的"窗口要么叠要么左右分"的平铺模式，Niri 让你在一个无限延伸的纸带（strip）上上下滚动看所有窗口，左右无限宽。刚上手可能觉得新奇，但习惯之后效率极高
- **视觉效果**：自带**毛玻璃模糊**（wayland blur）、**动态壁纸**（mpvpaper 驱动的视频壁纸）
- **新手友好**：内置**快捷键教程**（按 `Super + Shift + /` 弹出一张完整的快捷键地图）
- **AI 集成**：自带 **Miyu AI 助手**（聊天向的终端 AI）和 **OpenCode 一键呼出**（`Mod + Alt + O`）
- **开箱即用**：自动配置好中文输入法（fcitx5 + rime）、蓝牙（bluetoothd）、音频（pipewire + wireplumber）、GRUB 主题等

### 8.1 先联网

```bash
# 如果用 Wi-Fi（NetworkManager 的命令行工具 nmcli）：
sudo nmcli device wifi list                        # 扫描附近 Wi-Fi
sudo nmcli device wifi connect "你的WiFi名" password "你的WiFi密码"  # 连接
```

> 也可以丢给 opencode 来连：
> ```
> opencode
> connect to Wi-Fi, SSID is [your-wifi-name], password is [your-wifi-password]
> ```

### 8.2 一键安装 DMS + Niri（推荐喵）

```bash
# 下载 Shorin 的神奇安装脚本
curl -O https://shorin.xyz/archsetup.sh
chmod +x archsetup.sh

# 运行它
./archsetup.sh
```

你会看到一个终端菜单，用方向键选 **`Shorin_DMS_Niri (Recommended)`**，回车。

然后你就可以去泡杯奶茶了。这个脚本会自动完成下面所有事情（全程大约 20-40 分钟，取决于你的网速）：

| 它具体在干嘛 | 翻译成人话 |
|---------|-----------|
| 配置 pacman 国内镜像源（清华/tuna） | 下载软件快 10 倍 |
| 启用 Btrfs + Snapper 快照 | 给你的系统装上"后悔药" |
| 安装并配置 fcitx5 + rime 中文输入法 | 终于可以打中文了喵 |
| 安装 pipewire + wireplumber 音频栈 | 有声音了 |
| 安装并启用 bluetoothd 蓝牙服务 | 可以连 AirPods 了 |
| **自动检测显卡型号**（lspci + nvidia-detect） | NVIDIA / AMD / Intel 都能识别 |
| 安装对应显卡驱动（nvidia-dkms / mesa / vulkan-intel） | 不用自己纠结装哪个包 |
| 部署 DMS + Niri 桌面配置 | 毛玻璃、动态壁纸、全套快捷键 |
| **自动检测 Windows EFI 启动项** | 配置双系统引导 |
| 安装日常软件 | Firefox、VS Code、Steam、QQ、微信… |
| 安装 Grub 主题 | 开机选系统的那个丑界面变好看了 |

### 8.3 装完之后

1. 脚本跑完会提示你重启 → `sudo reboot`
2. 重启后进入登录管理器（SDDM），输密码，迎接你的新桌面喵~
3. 首次进桌面的推荐设置顺序：
   - **换壁纸**：按 `Super + Z`（即 Win 键 + Z）打开启动器 → 搜索"设置" → 个性化 → 壁纸 → 挑一张顺眼的
   - **自动配色**：设置 → 主题与配色 → 点 `auto` → 系统会根据壁纸主色调自动生成一套协调的配色方案（基于 pywal）
   - **Firefox 同步配色**：打开 Firefox → 地址栏左边点扩展（拼图图标）→ pywalfox → 点 `fetch` 拉取主题色
   - **看快捷键**：按 `Super + Shift + /` → 一张完整的快捷键速查表会弹出来，建议截图保存

### 如果不想用一键脚本，手动装也行

```
opencode
install DMS + Niri desktop on CachyOS: yay -S shorin-dms-niri-git, then run shorindms init
```

> `yay` 是 AUR helper，能同时装官方仓库和 AUR（用户维护的社区仓库）里的包。`shorin-dms-niri-git` 就是 Shorin 维护在 AUR 上的 DMS 配置包，`-git` 后缀说明它是从 Git 仓库直接拉最新版构建的喵。

---

## 9. 日常使用

### 9.1 最常用的快捷键（肌肉记忆起来）

| 按键 | 功能 | 记忆小窍门 |
|--------|------|------|
| `Win + T` | 打开终端（Terminal） | T for Terminal |
| `Win + E` | 打开文件管理器（thunar） | E for Explorer |
| `Win + Z` | 启动器/开始菜单 | Z 在键盘角落，好按 |
| `Win + Q` | 关闭当前窗口 | Q for Quit |
| `Win + Shift + /` | **快捷键速查表** | 新手最重要的按键！ |
| `Win + G` 或 `Win + O` | 窗口概览（类似 macOS Mission Control） | G for Grid, O for Overview |
| `Win + Alt + O` | **启动 OpenCode（AI 助手）** | Alt+O for OpenCode |
| `Win + 空格` | 切换中/英文输入法 | 和 macOS 一样的习惯 |
| `Win + Alt + A` | 区域截图 | A for Area screenshot |
| `Win + H / L` | 左右切换窗口焦点 | Vim 的 hjkl 方向键习惯 |
| `Win + U / I` | 上下滚动工作区 | Niri 的纸带滚动，很上瘾 |

> 💡 **Win（Super）键** = 键盘上那个 Windows 图标键。在 Niri 配置里统一叫 `Mod`。

### 9.2 用 AI 助手

```bash
# 在终端里直接运行：
opencode
```

装好 DMS 后有中文输入法了，所以中英文都行。告诉它你想干嘛：

```
install Google Chrome for me
```
```
no sound on my computer, help me fix it
```
```
update the system
```

中文也完全 OK：

```
帮我装一下 Chrome 浏览器
```
```
电脑没声音了，帮我修修
```

### 9.3 DMS 里的聊天 AI：Miyu

DMS 还藏了一只叫 **Miyu** 的 AI（官方人设："活在终端里的二次元少女"），更偏向聊天和问答，风格软软的萌萌的：

```bash
miyu
# 或者直接提问：
miyu "where is my niri config file"
```

OpenCode 负责干活，Miyu 负责陪聊——分工明确喵~

### 9.4 系统更新

```bash
# 推荐方式：用 Shorin 封装的安全更新脚本（更新前自动创建 Btrfs 快照）
sysup

# 或者直接用 pacman（简单直接，但没有自动快照）
sudo pacman -Syu
```

`syu` = `-S`（同步） + `-y`（刷新数据库） + `-u`（升级所有过期包）。建议定期跑一跑，保持系统新鲜喵。

### 9.5 安装软件

```bash
pac 软件名        # 装软件，比如 pac firefox。pac 是 Shorin 写的 pacman wrapper，简化了语法
pacr 软件名       # 卸载软件
```

### 9.6 后悔药（Btrfs 快照 + Snapper）

Btrfs 的 Copy-on-Write 快照机制让你可以随时给整个系统做瞬时快照，不占多少空间：

```bash
quicksave          # 创建快照（搞事情之前先存个档）
quickload          # 回滚到上一个快照（搞砸了退回存档点）
```

> 这两个是 Shorin 封装好的 snapper 快捷命令。底层其实是 `snapper create -d "..."` 和 `snapper undochange`。Linux 上没有"完了回不去了"这回事喵~

---

## 10. 常见问题 FAQ

### Q1: 开机直接进了 Windows，看不到 Linux 的 GRUB 菜单

**概率最高原因**：Secure Boot 没关，UEFI 固件跳过 GRUB 直接找到了 Windows Boot Manager。

**解决办法**：重启进 BIOS → Secure Boot → Disabled → F10 保存退出。然后 GRUB 就应该出现了。如果已经关了还是不行，用 Live USB → `opencode` → 粘贴第 7 节的修复模板让 AI 重建 GRUB 的 NVRAM 条目。

### Q2: 开机报 "Invalid signature detected"

**同样是 Secure Boot 没关**。固件在对 `grubx64.efi` 做签名校验时发现签名的 certificate hash 不在白名单里，直接拒了。重启进 BIOS 关掉就好了，**不需要重装任何东西**喵。

### Q3: 我能不关 Secure Boot 吗？

可以，但需要用 `sbctl`（Secure Boot Manager）或 `shim` + `MOK Manager` 自己给 GRUB 和内核签名。这套流程相当繁琐，还需要主板支持 enrolling custom keys。**建议直接关掉**——不影响 Windows 11 正常使用和更新（Windows 在 Secure Boot Off 的状态下照跑不误，只是会在系统信息里说"安全启动已关闭"而已）。

### Q4: 能看到 GRUB 但选了 CachyOS 后黑屏

大概率是内核显卡驱动初始化失败了。尤其是搭载 NVIDIA 独显但没有集成显卡的笔记本（muxless 设计），KMS（Kernel Mode Setting）可能拿不到正确的 framebuffer。

按 `Ctrl + Alt + F2` 进 TTY 登录，然后：

```
opencode
CachyOS boots to black screen after GRUB, probably GPU driver issue (nvidia), help fix it
```

AI 通常会帮你加内核参数 `nomodeset` 或 `nvidia_drm.modeset=1` 来绕过，或者帮你装正确的 nvidia-dkms 驱动喵。

### Q5: 输入法打不出中文

```bash
fcitx5 -rd    # 重启 fcitx5 守护进程
```

如果还不行就交给 AI：
```
opencode
fcitx5 input method not working on CachyOS, check and fix it
```

### Q6: Wi-Fi 连不上

```
opencode
Wi-Fi not working, check rfkill status and NetworkManager, fix it
```

AI 会帮你查 `rfkill list`（看是不是硬件/软件开关关了）、`nmcli radio`（看 NetworkManager 的无线状态）、`dmesg | grep -i iwlwifi`（看 Intel Wi-Fi 模块有没有 firmware 报错）等等喵。

### Q7: 系统被我搞坏了，想重来

```bash
# 如果你用的是 Shorin 的一键脚本：
shorin-undochange     # 回滚到运行脚本之前（撤销所有脚本做的改动）
shorin-de-undochange  # 进一步回滚到装桌面之前

# 如果你有 Btrfs 快照：
# 重启 → 在 GRUB 菜单选 "Boot from snapshot" → 挑一个早前的快照 → 进系统后运行：
quickload
```

### Q8: 怎么进 Windows？

开机在 GRUB 菜单里用方向键选 **Windows Boot Manager**，回车。如果菜单里没有，见 Q1 喵。

### Q9: 我想把 Windows 设为默认启动

```
opencode
set Windows Boot Manager as the default GRUB boot entry, edit /etc/default/grub GRUB_DEFAULT
```

### Q10: 蓝牙用不了

```
opencode
bluetooth not working, check bluetoothd service and rfkill, fix it
```

### Q11: Linux 和 Windows 时间差了 8 小时

这是因为 Windows 默认把硬件时钟（RTC）当作本地时间（localtime），而 Linux 默认当作 UTC。两个系统读写同一个硬件时钟但理解不同，就产生了偏移。

```
opencode
fix dual boot time offset: Windows uses localtime for RTC, Linux uses UTC, sync them by setting Linux to use localtime via timedatectl
```

AI 会帮你跑 `timedatectl set-local-rtc 1` 让 Linux 也按 localtime 解读硬件时钟喵。

### Q12: 怎么重装/更新 OpenCode？

```
sudo pacman -S opencode    # 重装或更新，pacman 会自动处理依赖
```

### Q13: 什么是 TTY？怎么用？

TTY（TeleTYpewriter）是 Linux 内核提供的虚拟控制台，你可以把它理解为"底层命令行界面"。当你的图形会话（Xorg / Wayland）挂了，TTY 就是你的紧急救援通道：

1. 按 `Ctrl + Alt + F2`（或 F3 ~ F6）
2. 你会看到一个黑底白字的 `login:` 提示
3. 输入你的**用户名**和**密码**（密码不会回显，正常喵）
4. 登录成功后你就进入了一个完整的 shell 环境，可以运行任何命令
5. 运行 `opencode` 让 AI 帮你诊断和修复
6. 修好后按 `Ctrl + Alt + F1`（或 F7）切回图形会话

Linux 默认分配 tty1~tty6 共六个虚拟终端，图形桌面通常跑在 tty1 或 tty7（取决于发行版配置）喵。

### Q14: 出了上面没写到的诡异问题怎么办？

```
插 Live USB → 联网 → sudo pacman -S opencode → opencode
→ Describe your problem in simple English, e.g. "my keyboard types wrong characters"
```

只要你能准确描述问题，AI 大概率能帮你找到原因。OpenCode 不是聊天玩具，它是真的能 grep 日志、改配置文件、重装问题包的实干派喵！

---

## 11. 鸣谢

这篇文章能写出来，全因为人家站在了巨人的肩膀上。**由衷感谢每一位让 Linux 变得更温柔的人。**

### 核心项目

| 项目 | 贡献者 | 一句话说清楚 |
|------|--------|-----------|
| **CachyOS** | CachyOS 团队 | 基于 Arch 的优化发行版，x86-64-v3/v4 指令集优化让系统跑得更快，Live 环境开箱即用 |
| **DMS (DankShell Management System)** | **Shorin** | 把 Niri 桌面从"只有大佬能调"变成"复制粘贴就能用"的全套配置与脚本集合 |
| **Niri** | **Yukari "Chloek"** 及贡献者 | 可滚动平铺的 Wayland 合成器——漂亮的动画、无限延伸的纸带式工作区 |
| **Arch Linux** | Arch 团队及全球社区 | 滚动更新、AUR 软件仓库、ArchWiki——三大立身之本 |
| **OpenCode** | **anomalyco** 及贡献者 | 运行在终端里的 AI 编程助手，让不会命令行的人也能用自然语言操作系统 |

### Shorin DMS 全家桶

| 项目 | 作者 |
|------|------|
| Shorin Arch 一键安装脚本 | [Shorin](https://shorin.xyz) |
| shorin-dms-niri AUR 包 | Shorin |
| Rime LLM Translator（AI 输入法联想） | Shorin |
| Proton Wrapper（运行 Windows 软件的辅助脚本） | Shorin |
| Miyu AI 助手（终端里的聊天 AI） | Shorin |
| Linux QQ 剪贴板同步工具 | Shorin |

### CachyOS 团队

CachyOS 核心系统开发、chwd 硬件自动检测工具、BORE/EEVDF 等调度器优化的内核编译、镜像仓库维护——感谢你们让 Arch 从"劝退"变成"好香"。

### 开源世界

- **Linus Torvalds** 和全球数千名内核贡献者——你们写的 C 代码支撑着这个星球上几乎所有的服务器和越来越多的桌面
- **systemd**、**GRUB**、**Btrfs**、**Snapper**、**PipeWire**、**WirePlumber**——每个子系统都值得一本书，却都免费
- **Fcitx5** 和 **Rime** 输入法——没有你们，中文用户根本没法在 Linux 上打字
- **Wayland** 协议和 **Mesa** 驱动——用了几十年的 X11 终于有了接班人
- **Wine** 和 **Proton**——感谢 Valve 的钱和人，让 Linux 能玩 Windows 游戏不再是梦
- 所有 **AUR 维护者**——AUR 是 Arch 生态最迷人的地方，每一个 PKGBUILD 背后都有一个人
- **ArchWiki 贡献者**——互联网上最好的 Linux 文档站之一，没有"之一"也可以喵

### 特别感谢

- **Shorin** —— 谢谢你做了这么暖的 DMS 桌面和一键脚本。没有你，Niri 对普通人来说就是一座爬不上去的墙
- **anomalyco** —— 谢谢你开发了 OpenCode。你让 AI 从"聊天工具"变成了真正的"生产力工具"，让完全不会命令行的用户也能拥有整台 Linux
- **所有在社区里无偿帮助别人的人** —— 每一个回答过"这怎么装"的人，都在让这个世界变得更好一点点

---

## 参考链接

- [CachyOS 官网](https://cachyos.org/)
- [CachyOS 下载](https://cachyos.org/download/)
- [ArchWiki（中文）](https://wiki.archlinux.org/title/Main_page_(%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87))
- [DMS Wiki](https://danklinux.com/)
- [Niri Wiki](https://github.com/niri-wm/niri/wiki)
- [Shorin Arch 指南](https://shorin.xyz/wiki)
- [Shorin 一键安装脚本](https://shorin.xyz/wiki/archsetup)
- [OpenCode 官网](https://opencode.ai)
- [OpenCode GitHub](https://github.com/anomalyco/opencode)

---

> **最后一句话喵**：折腾之前 `quicksave`，搞砸了 `quickload`。有 AI 在，天塌下来也不怕。主人大胆往前走就是啦~
