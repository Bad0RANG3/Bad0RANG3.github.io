---
title: '如何借巨人肩膀安装好一个美丽的Arch Linux'
description: '你说得对我挺懒的，所有我还是用AI吧'
date: 2026-7-2
tags:
  - 教程
category: 教程
featured: true
draft: false
---

# CachyOS + Windows 11 双系统 + DMS + Niri 桌面环境 完全指南

> **写给没时间折腾的人**：你只需要会打字，剩下的交给 AI。
>
> 本文是一份**实操记录**——我全程在 Live 环境里装上 OpenCode，然后用 AI 帮我装好了整个系统。如果你也想像我一样懒，照着做就行。

---

## 这个指南是写给谁的？

- 你有 **Windows 11**，但想试试 Linux 又不想删 Windows
- 你听说过 **Arch Linux** 但被传说中的"劝退"吓到了
- 你**不想记命令**，**不想看那些长长的手动教程**
- 你想让 **AI 帮你干所有的活**

那这篇指南就是为你写的。

### 我们的方法是啥？

```
用 CachyOS（Arch 的优化版）的 Live 环境启动
          ↓
在 Live 环境里装上 OpenCode（AI 助手）
          ↓
让 AI 帮我们安装系统、装驱动、配桌面
          ↓
装好后万一出问题 → 按 Ctrl+Alt+F2 进 TTY → 运行 opencode → 让 AI 修
```

全程只需要 **联网** 和 **会复制粘贴**。

### OpenCode 是什么？

简单说：**你打字下命令，它帮你执行命令。**

- 你说 "connect Wi-Fi"，它就连
- 你说 "partition the disk and install the system"，它就给你装好
- 你说 "GRUB is broken, fix it"，它就帮你修
- **不需要配置什么 API Key**，装好就能用，自带的 deepseek 模型就够用了

### ⚠️ 关于语言

**Live 环境没有中文输入法**，所以和 AI 对话要用英文。

别担心，每个步骤下面都有**现成的英文话术**，直接复制粘贴给 AI 就行。

等进了系统装好 DMS 桌面后，就有中文输入法了，之后就可以用中文和 AI 聊了。

---

## 目录

1. [准备工作](#1-准备工作)
2. [BIOS / UEFI 设置（最关键的一步）](#2-bios--uefi-设置最关键的一步)
3. [制作 CachyOS 安装盘](#3-制作-cachyos-安装盘)
4. [在 Windows 里腾出空间](#4-在-windows-里腾出空间)
5. [进入 Live 环境，装上 AI 助手](#5-进入-live-环境装上-ai-助手)
6. [让 AI 帮你安装 CachyOS](#6-让-ai-帮你安装-cachyos)
7. [重启后万一进不去系统怎么办](#7-重启后万一进不去系统怎么办)
8. [进系统后 —— 装桌面环境（DMS + Niri）](#8-进系统后--装桌面环境dms--niri)
9. [日常使用](#9-日常使用)
10. [常见问题 FAQ](#10-常见问题-faq)
11. [鸣谢](#11-鸣谢)

---

## 1. 准备工作

### 需要什么？

| 需要的东西 | 说明 |
|----------|------|
| 一台装了 Windows 11 的电脑 | BIOS 必须是 UEFI 模式（2015 年以后的电脑基本都是） |
| **100 GB 以上的空闲硬盘空间** | 如果你硬盘不够了，先删点电影游戏腾出空间 |
| 一个 U 盘 | 8GB 以上就行，里面的东西会被清空 |
| 能上网 | 有线或者 Wi-Fi 都行 |

### ⚠️ 重要提醒（新手必看）

1. **先备份你的重要文件！** 装系统虽然大概率不会丢数据，但万一呢？
2. **如果你电脑开了 BitLocker 或"设备加密"**（这个一般品牌机预装 Windows 11 都默认开了），**先进 Windows 把它关了**。方法：
   - 按 `Win` 键，搜"设备加密"或"BitLocker"
   - 点进去 → **关闭**
   - 如果不关，装完双系统后可能进不去 Windows
3. **下面步骤看不懂也没关系**，你只需要走到第 5 节，后面的全交给 AI

### 需要下载什么？

| 文件 | 去哪下载 | 干啥用 |
|------|---------|--------|
| **CachyOS 镜像**（iso 文件） | https://cachyos.org/download/ | 这是我们要装的系统 |
| **Rufus**（写盘工具） | https://rufus.ie/ | 把上面的 iso 文件写进 U 盘 |

---

## 2. BIOS / UEFI 设置（最关键的一步）

> **这是整个流程里最容易出问题的一步。** 如果你不关掉 Secure Boot（安全启动），装完 CachyOS 后大概率开不了机。

### Secure Boot 是什么？为什么要关？

Secure Boot 像一道锁，它只让"微软认证过"的系统启动。CachyOS 用的 GRUB 引导程序没有被微软签名（或者你的主板不认它的签名），所以会被拦住。

**如果你不关，可能会遇到的情况：**
- 装完了重启 → 直接进了 Windows，好像啥也没发生
- 装完了重启 → 屏幕显示 `Invalid signature detected` 或 `Security violation`
- 装完了重启 → 黑屏，啥也没有

**关机重进就行，不会损坏你的电脑。**

### 怎么进 BIOS

重启电脑，在屏幕刚亮的时候（出现品牌 Logo 时），**疯狂按**下面的键：

| 你的电脑品牌 | 按哪个键 |
|------------|---------|
| 华硕 ASUS | `F2` 或 `Del`（Delete 键） |
| 微星 MSI | `Del` |
| 技嘉 Gigabyte | `Del` |
| 联想 Lenovo | `F2`（部分按 `F1` 或侧面的 Novo 键） |
| 惠普 HP | `F10` 或 `Esc` |
| 戴尔 Dell | `F2` |
| 华为 / 荣耀 | `F2` |
| 小米 | `F2` |
| 神舟 / 机械革命 | `F2` |
| Surface | 先关机，然后长按"音量+"键，同时按一下开机键 |
| 苹果 Mac | 开机时按住 `Option (Alt)` 键 |

> **如果按了没反应**：重启再试一次，按得更快一点。

### 进了 BIOS 之后要改什么

用键盘（方向键）或鼠标找到下面的设置项，改掉：

| 设置项 | 一般在哪 | 改成什么 |
|--------|---------|---------|
| **Secure Boot**（安全启动） | Security（安全）菜单里 | **Disabled（关闭）** |
| **Fast Boot**（快速启动） | Boot（启动）菜单里 | **Disabled（关闭）** |
| **CSM** 或 **Legacy Mode** | Boot 菜单里 | **Disabled**（纯 UEFI 模式） |

> ⚠️ **个别品牌的笔记本**（尤其是联想和惠普某些型号）BIOS 里没有"关闭 Secure Boot"的选项。那是被隐藏了。解决办法：
> 1. 进 BIOS 先设置一个**管理员密码**（Set Supervisor Password）
> 2. 保存退出再进 BIOS，Secure Boot 选项就出来了
> 3. 关掉后，可以把那个密码再删掉

改好后按 `F10` 保存退出，电脑会重启。**这时先不要插 U 盘**。

---

## 3. 制作 CachyOS 安装盘

在 **Windows 11 里**操作：

1. 插上 U 盘（⚠️ **U 盘里的东西会被清空**）
2. 打开刚下载的 **Rufus**
3. "设备"选你的 U 盘
4. "引导类型"点 **"选择"** → 找到你下载的 CachyOS iso 文件
5. "分区类型"选 **GPT**，"目标系统"选 **UEFI（非 CSM）**
6. 其他不用改，点 **"开始"**
7. 如果弹出"需要下载额外文件"，点**"否"**
8. 等进度条走完，U 盘就做好了

---

## 4. 在 Windows 里腾出空间

> ⚠️ 重要！如果你开了 BitLocker 或设备加密，**先去关了再操作**（见第 1 节）

1. 在任务栏搜索框搜 **"磁盘管理"** 并打开
2. 找到你的 C 盘（一般是最大的那个），右键点它 → **"压缩卷"**
3. 在"输入压缩空间量"里输入你想给 Linux 的大小（单位是 MB）：
   - **只是试试**：`51200`（50GB）
   - **日常用**：`102400`（100GB）
   - **重度使用**：`204800`（200GB）以上
4. 点"压缩"
5. 你会看到出现一块**黑色**的"未分配"区域
6. **不要对它做任何操作**，就放那

---

## 5. 进入 Live 环境，装上 AI 助手

### 5.1 用 U 盘启动

1. 把做好的 U 盘插到电脑上
2. 重启电脑
3. 在屏幕亮起时按 `F12`（或别的启动菜单键，跟进 BIOS 类似）
4. 选择你的 U 盘（名字一般是 U 盘品牌名或 "UEFI: USB..."）
5. 看到 CachyOS 启动菜单，选 **CachyOS Desktop Live**
6. 等一两分钟，进入 Live 桌面（这时的系统还在 U 盘里运行，还没装到硬盘）

### 5.2 连上网络

进 Live 桌面后，**第一件事是联网**：

- **有线网络**：插上网线一般自动就好了
- **Wi-Fi**：在桌面右下角找网络图标，选你的 Wi-Fi，输密码

或者你也可以叫 AI 来连：

```bash
# 打开终端（在桌面找个黑色的图标或者按 Ctrl+Alt+T）
# 然后运行：
opencode
```

> 等等——这时还没装 opencode。先手动连一下吧，就这一次。

### 5.3 在 Live 环境里安装 OpenCode

```bash
# 打开终端，输入：
sudo pacman -S opencode
```

等几秒钟，装好了，你就可以用 AI 了。

### 5.4 检查一下 AI 能不能用

```bash
# 运行：
opencode
```

它会进入对话模式，先试一句（复制粘贴）：

```
show me disk partition layout
```

如果它回答了，说明 OK，可以进行下一步了。

> 💡 **OpenCode 自带的 deepseek 模型不需要配置 API Key**，装好就能直接用。就是这么省心。

---

## 6. 让 AI 帮你安装 CachyOS

### 6.1 核心思路

你现在在 **Live 环境**（系统在 U 盘里跑），要把它**装到电脑硬盘**上。

接下来的事，**全部交给 AI**：

```bash
# 在终端里运行：
opencode
```

然后**复制粘贴下面这段话**给 AI（先把你自己的信息填进去）：

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

> **⚠️ 注意**：把上面 `[your-username]`、`[your-password]`、`[your-hostname]` 换成你自己的。

AI 会一步一步帮你执行。如果它问你要确认什么，回答 `yes` 或 `default` 就行。

如果你觉得上面这段话太长了，也可以**分步来**——每次只让 AI 做一件事（复制粘贴这些短的）：

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

怎么舒服怎么来。

### 6.2 装完后

等 AI 说"装完了，可以重启了"：

```bash
# 在终端里输入：
sudo reboot
```

拔掉 U 盘（或者进 BIOS 把启动顺序改回硬盘）。

重启后会看到 **GRUB 菜单**（一个选系统的界面），里面应该有两项（或更多）：
- **CachyOS** ← 选这个进你的新系统
- **Windows Boot Manager** ← 选这个进 Windows

> 如果看不到 Windows，或者看不到 GRUB 直接进了 Windows，**不要慌**——看下一节。

---

## 7. 重启后万一进不去系统怎么办

这是新手最怕遇到的情况，但真的**不用怕**。

### 你可能会遇到什么

| 现象 | 最可能的原因 |
|------|------------|
| 直接进了 Windows，没有 GRUB 菜单 | Secure Boot 没关（最常见） |
| 显示 "Invalid signature" 或 "Security violation" | Secure Boot 没关 |
| 黑屏，啥也没有 | 显卡驱动问题 |
| 能看到 GRUB 但选了 CachyOS 后卡住 | 某步配置出了问题 |

### 怎么办？

**第一步：关 Secure Boot**

重启进 BIOS，找到 Secure Boot → **Disabled**，保存退出再试。

> 如果之前没关，现在关掉就好了，**不需要重装系统**。

**第二步：如果还不行，用 Live U 盘修复**

1. 插上你的 CachyOS 安装 U 盘
2. 从 U 盘启动进 Live 桌面
3. 装 OpenCode（如果还没装）：
   ```bash
   sudo pacman -S opencode
   ```
4. 运行 AI：
   ```bash
   opencode
   ```
5. 复制粘贴下面的话：

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

进 Live 环境 → 装 opencode → 运行 opencode → 粘贴：

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

### 如果进系统了，但桌面坏了

如果你进了 CachyOS（能看到终端字符界面），但桌面出问题了：

1. 按 `Ctrl + Alt + F2`（或 F3、F4）**切换到 TTY**（纯字符终端登录界面）
2. 输入你的用户名和密码登录
3. 运行 AI 助手：
   ```bash
   opencode
   ```
4. 告诉它出了什么问题，比如：

   ```
   I installed CachyOS but after reboot it goes to command line, no desktop. Help me fix it.
   ```

> 💡 **TTY 是什么？** 就是你的电脑的"后台模式"——桌面崩了也不影响，按 `Ctrl + Alt + F2` 就能进去用命令修。修好了按 `Ctrl + Alt + F1` 回到桌面。

---

## 8. 进系统后 —— 装桌面环境（DMS + Niri）

现在你已经进 CachyOS 了（不管是桌面还是命令行），但系统还很"素"——没有漂亮的界面。

我们要装的是 **DMS（DankShell Management System）** + **Niri**。这是由 **Shorin** 做的一套 Arch 桌面环境：

- 基于 **Niri**（一种叫"可滚动平铺"的窗口管理器）
- 带**毛玻璃效果**、**动态壁纸**
- 内置**快捷键教程**（按 `Super + Shift + /` 就有）
- 自带 **Miyu AI 助手**（另一个可以和它聊天的 AI）
- 自带 **OpenCode 快捷键**（`Mod + Alt + O`）
- 自动配置好中文输入法、蓝牙、音频、GRUB 主题等

### 8.1 先联网

```bash
# 如果用 Wi-Fi：
sudo nmcli device wifi list
sudo nmcli device wifi connect "你的WiFi名" password "你的WiFi密码"
```

> 你也可以用 opencode 来连：
> ```
> opencode
> connect to Wi-Fi, SSID is [your-wifi-name], password is [your-wifi-password]
> ```

### 8.2 一键安装 DMS + Niri（推荐）

```bash
# 下载 Shorin 的神奇脚本
curl -O https://shorin.xyz/archsetup.sh
chmod +x archsetup.sh

# 运行它
./archsetup.sh
```

你会看到一个菜单，用方向键选 **`Shorin_DMS_Niri (Recommended)`**，回车。

然后就不用管了。这个脚本会自动干完下面所有事（全程大概 20-40 分钟）：

| 它会干嘛 | 说人话就是 |
|---------|-----------|
| 配置国内镜像源 | 下载软件更快 |
| 装 Btrfs 快照 | 给你的系统装"后悔药" |
| 装中文输入法 | 可以打中文了 |
| 装音频驱动 | 有声音了 |
| 装蓝牙 | 可以连蓝牙耳机 |
| **自动检测你的显卡** | NVIDIA / AMD / Intel 都行 |
| 装显卡驱动 | 不用你自己配 |
| 装 DMS + Niri 桌面 | 漂亮的桌面来了 |
| **自动检测 Windows** | 配置双系统引导 |
| 装常用软件 | Firefox、VS Code、Steam、QQ、微信… |
| 装 GRUB 主题 | 开机选系统那个界面变好看了 |

### 8.3 装完之后

1. 脚本跑完重启（`sudo reboot`）
2. 进系统后你就有一个漂亮的桌面了
3. 开机首次设置：
   - **设置壁纸**：按 `Super + Z`（就是 Windows 键 + Z）打开菜单 → 选"设置" → 个性化 → 壁纸
   - **颜色主题**：设置里点"主题与配色" → 点 `auto` 自动匹配
   - **Firefox 和壁纸同色**：打开 Firefox → 扩展（拼图图标）→ pywalfox → 点 `fetch`
   - 按 `Super + Shift + /` 查看所有快捷键

### 如果不想用一键脚本，AI 也能帮你手动装

```
opencode
install DMS + Niri desktop: yay -S shorin-dms-niri-git, then run shorindms init
```

---

## 9. 日常使用

### 9.1 最常用的快捷键

| 按键 | 功能 |
|--------|------|
| `Win + T` | 打开终端（命令行窗口） |
| `Win + E` | 打开文件管理器 |
| `Win + Z` | 开始菜单 |
| `Win + Q` | 关闭当前窗口 |
| `Win + Shift + /` | **打开快捷键教程**（新手必看） |
| `Win + G` 或 `Win + O` | 窗口概览（看所有打开的窗口） |
| `Win + Alt + O` | **启动 OpenCode（AI 助手）** |
| `Win + 空格` | 切换中文/英文输入法 |
| `Win + Alt + A` | 截图 |
| `Win + H / L` | 左右切换窗口 |
| `Win + U / I` | 上下切换工作区 |

> 💡 **Win（Super）键** 就是你键盘上那个 Windows 图标的键。

### 9.2 用 AI 助手

```bash
# 在终端里直接运行：
opencode
```

装好 DMS 后有中文输入法了，所以中英文都可以。告诉它你想干嘛：

```
install Google Chrome for me
```
```
no sound on my computer, help me fix it
```
```
update the system
```

或者中文也行：

```
帮我装一下 Chrome 浏览器
```
```
电脑没声音了，帮我看看
```

### 9.3 DMS 里的另一个 AI：Miyu

DMS 还藏了一个叫 **Miyu** 的 AI 助手（"活在终端里的二次元少女"），更偏向聊天和查信息：

```bash
miyu
# or ask directly:
miyu "where is my config file"
```

### 9.4 系统更新

```bash
# 安全的更新方式（会自动创建快照，出问题了可以回滚）
sysup

# 或者简单粗暴
sudo pacman -Syu
```

### 9.5 安装软件

```bash
pac 软件名        # 装软件，比如 pac firefox
pacr 软件名       # 卸载软件
```

### 9.6 后悔药（Btrfs 快照）

```bash
quicksave          # 存个档（搞事情之前先存一下）
quickload          # 读档（搞砸了回到上一个存档点）
```

---

## 10. 常见问题 FAQ

### Q1: 开机直接进了 Windows，看不到 Linux

**最常见原因**：Secure Boot 没关。

**解决办法**：重启进 BIOS → 关 Secure Boot → 保存退出。

如果已经关了还是不行：
```
Boot Live USB → sudo pacman -S opencode → opencode
→ "My CachyOS won't boot, fix GRUB for me"
```

### Q2: 开机报 "Invalid signature detected"

**同样是 Secure Boot 没关**。重启进 BIOS 关掉就好了，不需要重装。

### Q3: 我能不关 Secure Boot 吗？

可以，但需要额外折腾给 GRUB 签名。**建议直接关掉**，不影响 Windows 使用。

### Q4: 能看到 GRUB 但选了 CachyOS 后黑屏

大概率是显卡驱动问题。按 `Ctrl+Alt+F2` 进 TTY 登录，然后：

```
opencode
CachyOS boots to black screen after GRUB, probably GPU driver issue, help fix it
```

### Q5: 输入法打不出中文

```bash
fcitx5 -rd
```

或者直接问 AI：
```
opencode
fcitx5 input method not working, fix it
```

### Q6: Wi-Fi 连不上

```
opencode
Wi-Fi not working, check and fix it
```

AI 会帮你检查网络状态并修复。

### Q7: 系统被我搞坏了，想重来

```bash
# 如果你装的是 Shorin 的一键脚本：
shorin-undochange    # 回到运行脚本之前
shorin-de-undochange # 回到装桌面之前

# 如果你有 Btrfs 快照：
# 重启 → 在 GRUB 菜单选一个早前的快照 → 进系统后运行：
quickload
```

### Q8: 怎么进 Windows？

开机在 GRUB 菜单里选 **Windows Boot Manager**。如果看不到，见 Q1。

### Q9: 我想把 Windows 设为默认启动

告诉 AI 就行：
```
opencode
set Windows as the default GRUB boot entry
```

### Q10: 蓝牙用不了

```
opencode
enable bluetooth and fix it
```

### Q11: Linux 和 Windows 时间差了 8 小时

```
opencode
fix dual boot time offset (8 hour difference between Linux and Windows)
```

### Q12: 怎么重装 OpenCode？

```
sudo pacman -S opencode
```

### Q13: 什么是 TTY？怎么用？

TTY 就是**纯命令行界面**。当你的桌面崩了、进不去图形界面时：

1. 按 `Ctrl + Alt + F2`（或 F3、F4、F5）
2. 你会看到一个黑底白字的登录界面
3. 输入你的**用户名**和**密码**
4. 你现在就在 TTY 里了，可以运行任何命令
5. 运行 `opencode` 让 AI 帮你修
6. 修好后按 `Ctrl + Alt + F1` 回到桌面

### Q14: 出了上面没写到的问题怎么办？

```
Boot Live USB → sudo pacman -S opencode → opencode
→ Describe your problem in simple English, e.g. "my keyboard doesn't work"
```

---

## 11. 鸣谢

这篇文章能写出来，全因为站在了巨人的肩膀上。**由衷感谢每一位让 Linux 变得更易用的人。**

### 核心项目

| 项目 | 贡献者 | 一句话说明 |
|------|--------|-----------|
| **CachyOS** | CachyOS 团队 | 让 Arch Linux 变得好装好用 |
| **DMS (DankShell Management System)** | **Shorin** | 让 Niri 桌面变得傻瓜式易用的配置系统 |
| **Niri** | **Yukari "Chloek"** 等贡献者 | 长得像 Mac、用起来像平铺、还带滚动的 Wayland 合成器 |
| **Arch Linux** | Arch Linux 团队及全球社区 | 一切的基础 |
| **OpenCode** | **anomalyco** 等贡献者 | 让不会命令的人也能用 AI 来玩转终端 |

### Shorin DMS 全家桶

| 项目 | 作者 |
|------|------|
| Shorin Arch 一键安装脚本 | [Shorin](https://shorin.xyz) |
| shorin-dms-niri AUR 包 | Shorin |
| Rime LLM Translator（AI 输入法联想） | Shorin |
| Proton Wrapper（运行 Windows 软件） | Shorin |
| Miyu AI 助手（终端里的二次元 AI） | Shorin |
| Linux QQ 剪贴板同步 | Shorin |

### CachyOS 团队

CachyOS 核心开发、chwd 硬件检测工具、内核优化、仓库维护——感谢你们让 Arch 变得这么省心。

### 开源世界

- **Linux Torvalds** 和全球数千名内核贡献者
- **systemd**、**GRUB**、**Btrfs**、**Snapper**、**PipeWire**、**WirePlumber** 这些底层项目
- **Fcitx5** 和 **Rime** 输入法——中文输入全靠你们
- **Wayland** 和 **Mesa**——未来的图形栈
- **Wine** 和 **Proton**——感谢 Valve 让 Linux 能玩 Windows 游戏
- 所有 **AUR 维护者**——让 Arch 有最丰富的软件生态
- **ArchWiki 贡献者**——最好的 Linux 文档之一

### 特别感谢

- **Shorin** —— 感谢你做了这么好用的 DMS 桌面和一键脚本，让 Arch 不再劝退
- **anomalyco** —— 感谢你开发了 OpenCode，让 AI 能真正帮人干活而不是只会聊天
- **所有在社区里帮助别人的人** —— 每一个回答问题的人，都是在让这个世界变好

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

> **最后一句**：折腾之前 `quicksave`，搞砸了 `quickload`。有 AI 在，别怕。
