---
title: 'Debian 13 从裸机到顺手：装系统、把自己加进 sudo，然后让 opencode 接管整机配置'
description: 'Debian 13 安装器里"设置 root 密码"那一屏，决定了装完有没有 sudo。从做启动盘、分区、换源写到没有 sudo 时怎么救，最后把 opencode 装进来，让它按 AGENTS.md 一件件配系统。'
date: 2026-10-24
tags:
  - Debian
  - Linux
  - 装机
  - sudo
  - opencode
  - AI Agent
  - 环境配置
category: 教程
featured: false
draft: false
verifiedDate: 2026-10-24
difficulty: 入门
audience: 第一次装 Debian、或者装完发现 sudo 不好使的人
hasCode: true
---

Debian 的安装器问得不多，但每一屏都在给后面埋前提。最典型的是"设置 root 密码"：留空，装完你的用户就有 `sudo`；认真填一个，安装器就认为你会自己管 root，`sudo` 包根本不装。等终端里蹦出 `sudo: command not found`，再回头找原因就晚了。

这篇从做启动盘写到把 opencode 装进来。只管 x86_64、UEFI、官方 netinst 安装器这一条路；BIOS 老机器、ARM 板子、无头服务器只在个别地方提一句。命令都用普通用户执行，需要 root 的地方加 `sudo`；装 opencode 之前还没有 `sudo` 的，第 5.1 节给了 `su -` 的走法。

版本号会过期。写这篇时 trixie 的最新点版本是 13.7，你下到的可能是 13.8 或更新，以 debian.org 下载页和 `cat /etc/debian_version` 的输出为准。opencode 现在有 V1、V2 两条线，命令都叫 `opencode`，装了一条就不能装另一条，配置 schema 也不一样，第 6.3 节讲怎么分。

---

## 1. 装之前

Debian 13 代号 trixie，2025 年 8 月 9 日发布，内核 6.12 LTS，桌面是 GNOME 48 / KDE Plasma 6.3 / Xfce 4.20 这一代。它的脾气和 Arch、Fedora 相反：包旧，但很少坏。你拿不到最新内核，换来的是两年多基本不用管它。

从 bookworm 过来，桌面用户会碰到这几处变化：

| 变化 | 对你的影响 |
| --- | --- |
| `/usr` 合并成为强制要求 | 从老系统跨版本升级时才有感觉；全新安装无感，但升级会看到 `/lib/firmware` 相关的 dpkg 告警，可以忽略 |
| i386 降级为 amd64 的附属架构 | 不再有 32 位安装器和官方内核；需要 32 位库（Steam、Wine）时仍可 `dpkg --add-architecture i386` |
| `apt-key` 被移除、`/etc/apt/trusted.gpg` 不再受信 | 老教程里的 `apt-key add` 必然失败，改用 `Signed-By` 指向 `/usr/share/keyrings/` |
| Secure Boot 开箱可用（Debian 有签名 shim） | 不用为了装 Linux 专门关掉安全启动，但装 NVIDIA 闭源驱动时要注册 MOK |
| `non-free-firmware` 组件默认启用 | 安装器会按检测到的硬件自动装网卡、显卡固件 |

有个说法流传很广：trixie 默认用 deb822 源格式。不对。`apt` 包确实自带示例（`usr/share/doc/apt/examples/debian.sources`），但 netinst 安装器写出来的仍然是传统单行的 `/etc/apt/sources.list`。装完自己 `cat` 一眼，第 4.2 节按实际格式处理。

镜像有三种，别下错：

| 镜像 | 大小 | 什么时候用 |
| --- | --- | --- |
| `debian-13.x.y-amd64-netinst.iso` | 几百 MB | **默认选这个**。只带最基础的包，其余联网下载 |
| `debian-13.x.y-amd64-DVD-1.iso` | 几 GB | 目标机器没有网络，或者你要装一堆桌面软件 |
| `debian-live-13.x.y-amd64-gnome.iso` | 两 GB 上下 | 想先试用再装，或者需要个救援环境 |

这里只走 netinst。它的安装器是 Debian 自己那套，和 live 镜像里的图形安装器不是一个流程。

想要滚动更新、永远最新内核的，Debian 不适合你，去看同站的 [Arch Linux 安装实录](/posts/archlinuxinstallguide/)，那篇走的是 CachyOS + OpenCode 的路线。

---

## 2. 下载、校验、做启动盘

### 2.1 下载

到 [debian.org 下载页](https://www.debian.org/download) 或任意镜像站取 ISO。只从 debian.org 官方镜像列表里的站点下，国内用 [TUNA](https://mirrors.tuna.tsinghua.edu.cn/debian-cd/current/amd64/iso-cd/) 或 [USTC](https://mirrors.ustc.edu.cn/debian-cd/current/amd64/iso-cd/)。

同一个目录里还有一个 `SHA256SUMS`，把它一起下下来。

### 2.2 校验

校验花不了半分钟，但能挡掉"装到一半报 `There was a problem reading data from the CD-ROM`"这种查不出原因的故障。

Windows PowerShell：

```powershell
Get-FileHash .\debian-13.7.0-amd64-netinst.iso -Algorithm SHA256
```

把输出的哈希和 `SHA256SUMS` 里对应那一行逐字符对比。Linux 上更省事：

```bash
sha256sum -c --ignore-missing SHA256SUMS
```

输出 `OK` 才算通过。不通过就是下载坏了，重下，不要抱有侥幸。

作为参考，13.7.0 那张 amd64 netinst 的哈希是 `a7ef94ac2fb9a7fec454552abd629b7cc9d5155c886165a45649f5ce6167e355`。点版本一更新这个值就会变，它只能用来对照"我下的是不是大家都在下的那个文件"，实际校验永远以同目录的 `SHA256SUMS` 为准。

### 2.3 写入 U 盘

Windows 上，Debian 官方 CD FAQ 推荐的是 [balenaEtcher](https://etcher.balena.io/)（有免安装的 `balenaEtcher-portable.exe`）或 USBImager。这两个都是把镜像原样写进 U 盘，不做任何"改造"。

[Rufus](https://rufus.ie/) 更常见，也能用，但有两点：分区方案选 GPT、目标系统选 UEFI（非 CSM）；新版 Rufus 会弹窗问你用哪种模式写入，必须选 DD 模式，选"ISO 镜像模式"会改写引导结构，Debian 的 U 盘可能起不来。Rufus 不在 Debian 官方推荐列表里，这是它偶尔出问题的原因。

UNetbootin 和任何会"重新打包"镜像的工具都别用。

Linux 上直接写裸设备，`bs` 用大一点会快很多：

```bash
lsblk                      # 先确认 U 盘是 /dev/sdX，不是 /dev/sdX1
sudo dd if=debian-13.7.0-amd64-netinst.iso of=/dev/sdX bs=16M status=progress oflag=sync
sync
```

`of=` 后面是整块磁盘，写成 `/dev/sdX1` 就只覆盖了第一个分区，U 盘起不来。写之前多看一眼 `lsblk` 的输出，这条命令没有回收站。

### 2.4 BIOS 里改什么

| 项目 | 设置 | 原因 |
| --- | --- | --- |
| Secure Boot | **可以保持 Enabled** | Debian 有微软签名的 shim，不关也能启动 |
| Fast Boot | Disabled | 跳过硬件初始化，容易导致 U 盘不被识别 |
| CSM / Legacy | Disabled | 和 UEFI 引导冲突 |
| SATA 模式 | AHCI | 双系统时两边必须一致，否则一方进不去 |

Secure Boot 唯一的麻烦在后面：你如果装 NVIDIA 闭源驱动这类未签名的内核模块，需要走一次 MOK 注册流程，第 7 节会讲。

双系统用户先在 Windows 里**关掉 BitLocker**（或至少挂起保护），再到"磁盘管理"里压缩 C 盘腾出空间。分区表一动，BitLocker 就可能要恢复密钥，而那时候你手里只有一台进不去系统的机器。

---

## 3. 走完安装器

插上 U 盘重启，按启动菜单键（常见 `F12` / `F11` / `F8`），选 `UEFI:` 开头的 U 盘项。

### 3.1 语言和区域

选中文，键盘选"汉语"。安装器会自己切到中文界面。

有一个例外：如果你的键盘不是标准 104 键，或者你是从 SSH 里操作，先选 English，装完再用 `localectl` 改。安装器里的键盘布局改动可能会在你输入加密密码时咬你一口。

### 3.2 网络

有线网插上就会自动走 DHCP。

Wi-Fi 在这一步比较麻烦：笔记本的无线网卡固件通常在 `non-free-firmware` 里，而你现在还没装系统。安装器如果检测到缺少固件，会弹出"是否从可移动介质加载固件"，可以插一个存了固件包的 U 盘，或者先用网线、手机 USB 网络共享过这一关，装完系统再补。

没有网络就别继续，Debian 的安装器会在后面联网下载软件包，断网装出来的系统是残的。

### 3.3 主机名

用短的、全小写、不带下划线的名字，比如 `debian`、`studio`、`bad0rang3-pc`。下划线在 DNS 里是非法的，某些服务会因为这个名字起不来。域名那栏留空。

### 3.4 root 密码

这一屏叫"设置 root 密码"，看着只是个密码框，实际上它是整台机器的权限开关。

留空并继续，安装器会明确提示 root 账号将被禁用，同时装上 `sudo` 包，把你接下来创建的第一个普通用户加进 `sudo` 组。装完你就有一个能 `sudo` 的账号，root 本身不能直接登录。

规规矩矩填一个 root 密码，安装器就默认"这位用户自己会管 root"：它不装 `sudo`，也不把你加进 `sudo` 组。于是你敲 `sudo ls`，得到的可能是：

```text
bash: sudo: command not found
```

或者更气人的：

```text
xxx is not in the sudoers file. This incident will be reported.
```

这两条都不是"系统坏了"，只是安装器按你的选择走完了另一条分支。网上"Debian 装完没有 sudo"的帖子，根子经常就在这一屏。两种选择都合理，关键是自己知道在选什么：

| 你填了什么 | 装完之后 |
| --- | --- |
| 留空 | root 被锁，第一个用户自动获得 sudo，最省事 |
| 设了 root 密码 | root 可 `su -` 登录，但普通用户默认没有 sudo，需要手动加（第 5 节） |

我的建议是留空，用 sudo 管理日常权限，需要 root shell 时 `sudo -i`。日常不登录 root，误操作能砸到的范围小得多。

已经填了 root 密码也不要紧，第 5 节就是为这种情况写的。

### 3.5 用户账号

输入全名（可以中文，只影响显示）、用户名（小写字母，别用中文和空格）、密码。

用户名定下来之后再改，要动 `/etc/passwd`、`/home` 目录名和一堆配置文件。别在这时候偷懒用 `user`、`admin`、`test`。

### 3.6 分区

选"向导 - 使用整个磁盘"之后，会再问你分几个分区：

| 方案 | 适合 |
| --- | --- |
| 所有文件放在一个分区 | 单系统、懒得管，重装时全部丢 |
| 分离 `/home` | **推荐**。重装系统时个人文件能保住 |
| 分离 `/home`、`/var`、`/tmp` | 服务器思路，桌面机没必要 |

文件系统默认是 ext4，手动分区时也能选 ext2/ext3/xfs/jfs。btrfs 不在引导式分区的选项里，想要 btrfs 必须选"手动"再加载 `partman-btrfs`，这点和 Fedora、openSUSE 把 btrfs 当默认完全不同。trixie 新增了对 btrfs 子卷系统的救援支持，装是能装的，只是没有向导。

几个实际建议：

- swap：引导式分区只会建 swap 分区，没有 swapfile 选项（加密 LVM 时装在卷内）。内存 16 GB 以上又不用休眠的话，选"手动"自己控制；装完想改大小，用 swapfile 比改分区灵活得多。
- 加密：笔记本建议选"加密 LVM"。代价是每次开机输一次密码、首次安装慢（要往整盘写随机数据），好处是机器丢了数据还在。
- 双系统：选"手动"，只在那块未分配空间里建分区，**别动 Windows 的 EFI 分区**，装 GRUB 时认得它就行。

分区这一步没有撤销。屏幕上每一个 `/dev/nvme0n1pX` 都对应一块真实数据，删之前确认大小和文件系统类型。

### 3.7 软件源

安装器会让你选镜像。国内选 `mirrors.tuna.tsinghua.edu.cn` 或 `mirrors.ustc.edu.cn`，别用 `deb.debian.org`，跨境下载会把"正在安装系统"这一步拖得很长。

### 3.8 软件选择（tasksel）

这一步决定装完是什么样子。

| 选项 | 要不要勾 |
| --- | --- |
| Debian 桌面环境 | 要（默认勾了） |
| GNOME / KDE Plasma / Xfce … | 选一个，**只选一个**。多选会把几套桌面塞进同一个系统 |
| 标准系统工具 | 要。少了它连 `ssh`、`less` 这类基础命令都没有 |
| SSH 服务器 | 需要远程登录才勾。桌面机不勾，少一个攻击面 |
| Web 服务器 / 打印服务 | 一般不用勾 |

桌面环境的实际差别：

- GNOME：Debian 的默认脸面，Wayland，最省心，输入法走 ibus。
- KDE Plasma：可定制性最强，fcitx5 支持更好，适合从 Windows 过来的人。
- Xfce：轻，老机器首选，但默认观感停留在 2010 年。

### 3.9 GRUB 和重启

GRUB 装到整块磁盘（`/dev/nvme0n1` 或 `/dev/sda`），不要指定到分区。

装完拔 U 盘重启。如果重启后直接进了 Windows，或者干脆黑屏，先回 BIOS 检查启动顺序，再确认 Secure Boot 的状态。

双系统补充：Debian 12 之后，`os-prober` 在已安装的系统里默认是关闭的，所以 GRUB 菜单里可能只有 Debian，看不到 Windows。修法在 4.6 节。

---

## 4. 第一次进系统

登录之后先开终端。下面这些按顺序做，做完才算能用。

### 4.1 先确认自己装了个什么

```bash
cat /etc/os-release
uname -r
```

应该看到 `Debian GNU/Linux 13 (trixie)` 和 `6.12.x-amd64`。

### 4.2 换源

Debian 13 的安装器实际写的还是传统单行的 `/etc/apt/sources.list`（`deb http://.../debian trixie main`），deb822 的 `/etc/apt/sources.list.d/debian.sources` 是官方推荐格式，`apt` 包自带示例。两种都可能是你的实际状态，先看一眼：

```bash
cat /etc/apt/sources.list
ls -l /etc/apt/sources.list.d/
```

如果你只有 `sources.list`（单行格式），最省事的做法是把它换成 deb822，以后加 `non-free-firmware` 之类的组件只需改一行结构清晰的段落。新建：

```bash
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak
sudo tee /etc/apt/sources.list.d/debian.sources > /dev/null <<'EOF'
Types: deb
URIs: https://mirrors.tuna.tsinghua.edu.cn/debian
Suites: trixie trixie-updates
Components: main contrib non-free non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg

Types: deb
URIs: https://security.debian.org/debian-security
Suites: trixie-security
Components: main contrib non-free non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
EOF
sudo mv /etc/apt/sources.list /etc/apt/sources.list.disabled
```

两个细节：

- 安全更新那段我故意留了官方 `security.debian.org`。镜像站的安全仓库有同步延迟，装完系统立刻打补丁时，官方源最稳。
- 别把两段写进同一个段落里，`Suites` 和 `URIs` 是多对多的笛卡尔积，混着写会让 apt 去请求不存在的路径。

如果已经有 `debian.sources`，只需要把域名换掉，比手写整个文件安全，组件列表原样保留，不会漏掉 `non-free-firmware`。这里只换主仓库的域名，安全更新仍留在 `security.debian.org`：

```bash
sudo cp /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list.d/debian.sources.bak
sudo sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources
grep -A2 '^URIs:' /etc/apt/sources.list.d/debian.sources
```

`sed` 只替换 `deb.debian.org` 这个主机名，不动后面的路径和 `Suites` / `Components`。最后那条 `grep` 是给你核对用的：主仓库应该是 TUNA，安全仓库应该还是 `security.debian.org`。如果你确实想连安全仓库也走镜像，把 `security.debian.org` 也加进 `sed` 的表达式即可，但记住镜像有同步延迟。

然后更新：

```bash
sudo apt update
sudo apt full-upgrade -y
```

`full-upgrade` 和 `upgrade` 的区别在于它允许为了满足依赖而安装或删除软件包。装完系统第一次更新用 `full-upgrade` 更省心。

顺便记两个 trixie 的 APT 变化：`apt-key` 已经移除（要用 `Signed-By` 指向 `/usr/share/keyrings/` 下的文件），`/etc/apt/trusted.gpg` 也不再被信任。老教程里那套 `apt-key add` 在你这里必然失败，原因就是这个。

### 4.3 主机名、时区、键盘

```bash
sudo hostnamectl set-hostname bad0rang3-debian
sudo timedatectl set-timezone Asia/Shanghai
timedatectl
```

输出里 `System clock synchronized: yes` 说明时间同步正常。Debian 默认用 systemd-timesyncd，不用另外装 NTP 客户端。

键盘布局：

```bash
localectl status
sudo localectl set-keymap us
sudo localectl set-x11-keymap us
```

### 4.4 中文字体

Debian 默认不装中文字体，装完中文全是方框和豆腐块。

```bash
sudo apt install -y fonts-noto-cjk fonts-noto-cjk-extra fonts-noto-color-emoji
```

`fonts-noto-cjk` 是思源黑体/宋体的 Debian 打包，`extra` 里是更全的字重和罕用字，`color-emoji` 是彩色 emoji 字体。三件套装完，浏览器和终端里的中文就正常了。

### 4.5 中文输入法

按桌面环境选方案，选错了要在 Wayland 下折腾半天。

GNOME（默认 Wayland）走 ibus 最省心。GNOME 自己就是围绕 ibus 做的，输入源直接进系统设置：

```bash
sudo apt install -y ibus-libpinyin
```

装完注销重新登录，然后进"设置 → 键盘 → 输入源 → 添加 → 汉语（智能拼音）"，用 `Super + Space` 切换。

fcitx5 在 GNOME Wayland 下也能跑，但要额外处理环境变量和 GTK 的输入法模块，出问题时排查面比 ibus 大。除非你有明确理由（比如需要 fcitx5 的某个引擎），GNOME 上别折腾这个。

KDE Plasma 和 Xfce 用 fcitx5，生态成熟一些：

```bash
sudo apt install -y fcitx5 fcitx5-chinese-addons fcitx5-frontend-gtk3 fcitx5-frontend-gtk4 fcitx5-frontend-qt5
im-config -n fcitx5
```

用 Qt6 应用（比如某些 KDE 程序）多的话，再补一个 `fcitx5-frontend-qt6`。

KDE Wayland 要多做一步：Wayland 下输入法由合成器拉起，KWin 不会自动去找 fcitx5。到"系统设置 → 键盘 → 虚拟键盘"里选中 Fcitx 5，同时停用 `/etc/xdg/autostart/org.fcitx.Fcitx5.desktop` 这个自启项——两者同时存在会互相打架，表现为候选框闪烁或者干脆不出。

GNOME 的 Wayland 会话不实现 `input-method` 协议，fcitx5 的候选框会弹在错误的位置，或者干脆不显示。绕过它需要装 Kimpanel 之类的扩展，成本明显高于直接用 ibus。上面说 GNOME 上别折腾 fcitx5，不是偏好问题，是协议层不支持。

注销重登，托盘里会出现 fcitx5 图标，右键 → 配置 → 添加"拼音"。

两种方案都要注销重登才生效，别指望在同一个会话里看到变化。

### 4.6 双系统：让 GRUB 看见 Windows

如果 GRUB 菜单里没有 Windows：

```bash
sudo nano /etc/default/grub
```

加上一行：

```text
GRUB_DISABLE_OS_PROBER=false
```

保存后：

```bash
sudo apt install -y os-prober
sudo update-grub
```

Windows 的启动项就会出现在菜单里。这一步只影响菜单显示，不碰 Windows 本身。

### 4.7 补齐常用工具

```bash
sudo apt install -y curl wget git vim htop btop fastfetch unzip zip \
  build-essential ca-certificates gnupg lsb-release man-db tree
```

`fastfetch` 在 trixie 的仓库里有（2.40.x 那一代），输出比已经停止维护的 `neofetch` 更全。装不上的话说明你的软件源组件没配全，回 4.2 检查。

### 4.8 Flatpak

Debian 的桌面上装软件，apt 是首选，但有些东西只在 Flathub 上有。

```bash
sudo apt install -y flatpak
sudo flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

GNOME 用户再装个 `gnome-software-plugin-flatpak`，这样"软件"里就能直接搜到 Flathub 的应用。装完重启才生效。

国内网络下 Flathub 下载慢是常态，真要经常用，考虑给 flatpak 配代理，或者用镜像站。

---

## 5. 把自己加进 sudo

先看你的症状属于哪一种。

| 症状 | 说明 | 去哪一节 |
| --- | --- | --- |
| `sudo: command not found` | `sudo` 包根本没装 | 5.2 |
| `xxx is not in the sudoers file` | 装了 sudo，但你不在组里 | 5.3 |
| 提示符要你输 **root 的密码** | sudoers 里开了 `rootpw` / `targetpw` 标记 | 5.6 |
| `sudo` 隔一段时间又要输密码 | 时间戳过期，正常行为 | 5.4 |

先用三条命令确认现状（在普通用户下跑）：

```bash
id
id -nG
which sudo
```

`id -nG` 的输出里如果有 `sudo`，你其实已经在组里了，问题在别处。如果只有 `bad0rang3 users` 这种，那就是没加进去。

### 5.1 先搞到一个 root shell

所有修法都需要 root 权限，所以第一步是拿到 root shell。两种方式，取决于你装系统时怎么选的：

装系统时设了 root 密码：

```bash
su -
```

输入 root 密码，提示符变成 `#`，说明进来了。

装系统时留空了 root 密码：

root 是被锁的，`su -` 会失败。这种情况下你本来就应该已经有 sudo 了，如果 `sudo` 也坏了，进第 5.5 节的救援模式。

拿到 root shell 之后，下面的命令不用再加 `sudo` 前缀，你现在就是 root。

### 5.2 情况 A：sudo 没装

```bash
apt update
apt install sudo
```

只有一行输出，装完就继续 5.3。同理，`visudo` 也在 `sudo` 包里。

### 5.3 情况 B：sudo 装了，但用户不在组里

Debian 用 `sudo` 组（GID 27），没有 `wheel` 组。这是很多人从 CentOS、Arch、Fedora 过来会踩的坑：`usermod -aG wheel` 在 Debian 上是白忙一场，因为默认的 `/etc/sudoers` 里只有 `%sudo ALL=(ALL:ALL) ALL` 这一条授权规则，没有 `%wheel`。

顺带说一句：`adm` 组不是管理员组，它只是能读 `/var/log` 里的日志，拿不到 root 权限。有授权规则的只有 `sudo` 组。

```bash
usermod -aG sudo bad0rang3
```

把 `bad0rang3` 换成你自己的用户名。这里**必须用 `-aG`，不能用 `-G`**，`-G` 会把你原来所有的附加组全部覆盖掉。Debian 默认给你加的组是 `audio cdrom dip floppy video plugdev netdev scanner bluetooth lpadmin` 这一串，覆盖掉之后声音、光驱、U 盘、摄像头会一起出问题。症状看起来还和权限毫无关系，很难查。

如果你还在普通用户会话里，也能用 `sudo`（假设 sudo 已经能用）做同样的事：

```bash
sudo usermod -aG sudo "$USER"
```

注意在 root shell 里 `$USER` 是 `root`，别写错。

### 5.4 验证和重新登录

加组的改动写进了 `/etc/group`，但已经在跑的会话里，进程的组权限是登录那一刻定下的。所以你当场敲 `sudo ls`，大概率还是报错。

三个办法，任选：

1. 注销再登录，最干净。
2. 关掉所有终端重开一个。不一定够，图形会话的 systemd user manager 还带着旧的组。
3. 当前终端临时生效：

```bash
newgrp sudo
```

`newgrp` 会新起一个 shell 并把附加组换成 sudo，这个 shell 里 sudo 立刻可用。但它也是临时的，退出就没了。

验证：

```bash
id -nG          # 输出里应该有 sudo
sudo -l         # 应该列出 (ALL : ALL) ALL
sudo -v         # 刷新时间戳，验证密码能通过
```

`sudo -l` 输出 `(ALL : ALL) ALL` 就成了。如果报 `not in the sudoers file`，回 5.3 检查命令有没有打错、用户名有没有写错、有没有重新登录。

### 5.5 情况 C：把自己锁在外面了

典型场景：装系统时留空了 root 密码（root 被锁），又因为某种原因把 sudo 组改坏了。这时 `su -` 和 `sudo` 都用不了，看起来只能重装。

其实不用，走 GRUB 单用户模式。

1. 开机在 GRUB 菜单上按 `e` 编辑当前启动项。
2. 找到以 `linux` 开头的那一行，在行末追加：

```text
init=/bin/bash
```

3. 按 `Ctrl + X` 启动。
4. 进到一个没有密码的 root shell，但根文件系统是只读的：

```bash
mount -o remount,rw /
```

5. 修你想修的东西，比如给 root 设个密码：

```bash
passwd root
```

或者直接把用户加回 sudo 组：

```bash
usermod -aG sudo bad0rang3
```

6. 正常重启：

```bash
sync
exec /sbin/init
```

这个方法的本质是绕过 systemd 直接拿到 root shell，物理接触机器的人都能做到，所以笔记本该开全盘加密。

### 5.6 `/etc/sudoers` 和 drop-in

`sudo` 的授权规则在 `/etc/sudoers`，别用 `nano` 直接编辑它。写错一个字符，**`sudo` 就彻底不能用**，它也没有语法检查。

正确工具是 `visudo`：

```bash
sudo visudo
```

它在保存时会做语法校验，写坏了会提示并让你重来。

默认的 `/etc/sudoers` 里关键就是这两行：

```text
%sudo	ALL=(ALL:ALL) ALL
@includedir /etc/sudoers.d
```

第一行的含义是：`sudo` 组的所有成员，在任何主机上，可以以任何用户和任何组的身份执行任何命令。第二行让 `/etc/sudoers.d/` 里的文件被自动加载。可以自己确认一遍：

```bash
sudo grep -nE '^%sudo|^@includedir' /etc/sudoers
```

需要更细的授权时，别改主文件，用 drop-in 目录：

```bash
sudo visudo -f /etc/sudoers.d/90-bad0rang3
```

内容很简单：

```text
bad0rang3 ALL=(ALL) ALL
```

几条规矩：

- 文件名不能带 `.`，否则会被忽略，这是"我明明写了却没生效"的常见原因。
- 文件权限必须是 `0440`，属主 root。
- 以 `~` 结尾的备份文件会被忽略。
- 改完用 `sudo visudo -c` 做一次全局语法检查。

几种常见但危险的做法：

| 做法 | 为什么不行 |
| --- | --- |
| `chmod 777 /etc/sudoers` | sudo 会拒绝加载权限过宽的文件，等于自己把 sudo 弄坏 |
| 给所有人 `NOPASSWD: ALL` | 任何拿到你 shell 的人（包括跑在你账号下的脚本）都直接是 root |
| 把用户加进 `wheel` | Debian 默认不认 wheel，等于没做 |
| 用 `echo xxx >> /etc/sudoers` 追加 | 拼错就永久失去 sudo，而且没有语法检查 |

关于 `NOPASSWD`：它在自动化脚本、CI 容器里是合理的，在个人桌面机上通常只是图省事。真要加，限定到具体命令：

```text
bad0rang3 ALL=(ALL) NOPASSWD: /usr/bin/apt update, /usr/bin/apt upgrade
```

反过来，如果你遇到"sudo 要的是 root 密码"，说明 sudoers 里被加了 `Defaults rootpw` 或 `Defaults targetpw`。这通常是老教程为了让 root 密码统一而写的，副作用是普通用户没法用 sudo。把这两行删掉就恢复正常。

### 5.7 图形界面的弹窗不是 sudo

装软件、改系统设置时，GNOME 或 KDE 会弹一个"需要认证"的对话框。那是 polkit，和 `sudo` 是两套机制。用户能不能在图形界面里授权，取决于 polkit 的规则，不完全取决于你在不在 `sudo` 组。

实际影响：某个操作在图形界面里一直提示没权限，先用命令行 `sudo` 做一遍，能成就是 polkit 的问题，不是你的 sudo 没配好。

到这里权限就算理清了。往下走之前，先确认 `sudo -l` 和 `sudo apt update` 都能跑通，后面每一步都依赖它。

---

## 6. 装 opencode

### 6.1 它是什么

opencode 是一个跑在终端里的编码 agent：能读你的文件、搜代码、执行 shell 命令、改配置，动手之前把要做的事列出来等你批准。它不是一个聊天窗口，更像一个会自己去看现场、每做一步都要你点头的助手。

装完系统之后有一大堆零碎配置（显卡驱动、输入法、字体、备份），每一件单独查都不难，难在几十件叠在一起。交给它做，你负责批准和验证。

它不是 GUI 应用，也不是包管理器或系统服务。它需要网络、模型 API 和一个像样的终端。

### 6.2 先确认前提

```bash
command -v curl git
echo $SHELL
```

`curl` 前面装过了。终端推荐用 GNOME Terminal / Konsole 自带的那套就够；要跑长任务可以套一层 `tmux`。

网络是硬要求。国内访问模型 API 通常需要代理，先确认你终端里的代理环境变量是通的：

```bash
curl -I https://api.deepseek.com
```

### 6.3 先搞清楚你装的是哪一代

这一步踩坑最多，得放在命令前面。

opencode 现在有 V1 和 V2 两条线，共用 `opencode` 这个命令名，装了一个就不能再装另一个。区别在安装入口和 npm 包名上：

| | V1（旧线） | V2（新线，官方主推） |
| --- | --- | --- |
| 安装脚本 | `https://opencode.ai/install` | `https://opencode.ai/v2/install` |
| npm 包 | `opencode-ai` | `@opencode/cli` |
| 配置权限字段 | `permission`（对象） | `permissions`（有序数组） |

老博客、老视频里的命令基本都是 V1。跟着装也能用，但拿到的是和官方文档对不上的配置 schema。先决定跟哪一条线，之后从头到尾只用那一套命令和文档，别混着抄。

后面的配置示例按 V1 的字段写（V2 仍兼容），涉及权限的地方会单独标出 V2 的差异。

### 6.4 安装：两条路

路线一：官方安装脚本，我推荐这条。

先下下来看一眼再执行。以后你会让 agent 自动跑各种命令，这个习惯值得养成：

```bash
# V2
curl -fsSL https://opencode.ai/v2/install -o /tmp/opencode-install.sh
less /tmp/opencode-install.sh
bash /tmp/opencode-install.sh
```

想装 V1 的话，把两处 URL 换成 `https://opencode.ai/install`。注意 V1 的脚本检测到 2.x 会拒绝安装，所以装错了不会静默串线，这是好事。

安装脚本会把可执行文件放到 `~/.opencode/bin/opencode`（npm 路线的位置不同，见下）。

路线二：npm

```bash
sudo apt install -y nodejs npm
node -v          # trixie 自带 20.19.2，够用
sudo npm install -g @opencode/cli     # V2；V1 是 npm install -g opencode-ai
```

npm 全局装到 `/usr/local`，所以要 sudo。不想动系统目录可以用用户级 prefix：

```bash
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
npm install -g @opencode/cli
```

`@opencode/cli` 的 npm 元数据里没有声明 `engines`，官方也没写死最低 Node 版本。Debian 13 自带的 20.19.2 实测够用；真遇到需要更新的版本，再用 NodeSource 或 fnm，别提前折腾。

Debian 官方仓库里没有 opencode 包，CLI 也没有 `.deb`（只有桌面版提供 `.deb` / `.rpm` / AppImage）。`apt search opencode` 翻不出东西是正常的，别在那儿浪费时间。

### 6.5 PATH

先确认文件到底装到哪了：

```bash
ls -l ~/.opencode/bin/opencode
```

官方脚本一般会顺手往你的 shell 配置里加一行 PATH，但它加哪个文件、有没有加成功，不同版本不一样。别猜，直接检查：

```bash
grep -n "opencode" ~/.bashrc ~/.profile ~/.zshrc 2>/dev/null
```

如果没有任何输出，手动加：

```bash
echo 'export PATH="$HOME/.opencode/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
opencode --version
```

GNOME Terminal 有些发行版默认起的是登录 shell，那样它读的是 `~/.profile` 而不是 `~/.bashrc`。改完不生效，就把同样一行也写进 `~/.profile`，然后注销重登。

能出版本号就可以了。

### 6.6 接模型

```bash
opencode auth login
```

它会列出可选的提供商（Anthropic、OpenAI、Google，以及一堆 OpenAI 兼容的第三方），选一个，粘 API key，回车。凭据存在 `~/.local/share/opencode/auth.json`，之后用 `opencode auth list` 复查，用 `opencode models` 看你实际能选哪些模型。

也可以把 key 放在环境变量里，让它自动读：

```bash
echo 'export DEEPSEEK_API_KEY="sk-..."' >> ~/.bashrc
```

配置文件有四个位置，优先级从高到低大致是项目内的 `./opencode.json`（或 `./.opencode/opencode.json`）、全局 `~/.config/opencode/opencode.json`、系统级 `/etc/opencode/opencode.json`。V1 和 V2 的文档对这一条的表述互相矛盾，以你实机上 `opencode` 的行为为准。接国内厂商或自建网关，就是在这几个位置之一里加一个 OpenAI 兼容的 provider：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "my-gateway": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "baseURL": "https://your-endpoint/v1",
        "apiKey": "{env:DEEPSEEK_API_KEY}"
      },
      "models": {
        "your-model-name": { "name": "Your Model" }
      }
    }
  },
  "model": "my-gateway/your-model-name"
}
```

上面这份是 V1 结构（`provider` / `npm` / `options`），V2 改成了 `providers` / `package` / `settings.baseURL` / `env`，并且仍然读得懂 V1 写法。所以：

- 你装的是 V1 → 照上面写。
- 你装的是 V2 → 要么照上面写（兼容），要么按官方 V2 文档改成新结构。
- 无论哪种，都保留第一行 `$schema`，让编辑器（VS Code 配 JSON 语言服务）按官方 schema 给你补全和报错。schema 比任何一篇博客新，也比我的描述准。

`opencode auth login` 这条路对主流提供商是稳的，能用它就别折腾 JSON。

### 6.7 第一次进入

直接 `cd` 到任意目录跑：

```bash
cd ~
opencode
```

TUI 里有三件事值得先记住：

- 输入 `@` 可以引用文件或目录，让它去看具体内容。
- 输入 `/` 打开命令列表（切模型、新建会话、压缩上下文都在这儿）。
- `Esc` 中断它当前的动作。

不同版本的快捷键改过，`/help` 里的才是你这一版的答案，别记网上的。

非交互地用一次：

```bash
opencode run "看一下 /etc/apt/sources.list.d/debian.sources，告诉我现在用的是哪个镜像"
```

它会读文件、给你结论，不改任何东西。想省掉逐条确认，可以加 `--auto`（让它自己判断）；想接脚本处理，用 `--format json`；想固定这次用哪个模型，用 `--model provider/model`。这些参数在不同版本间改过名字，跑 `opencode run --help` 看你这一版的实际选项，别照抄。

在 TUI 里输入 `/init`，它还能读你的项目结构，帮你写出或改进一份 `AGENTS.md`，下一节正好用得上。

### 6.8 给它一份 `AGENTS.md`

opencode 每次会话开始会读工作目录下的 `AGENTS.md`，把它当项目说明书（全局的那份可以放在 `~/.config/opencode/AGENTS.md`，它同时也兼容 `CLAUDE.md`）。在一台 Linux 机器上，这意味着你可以一次性告诉它这台机器的全部背景，省掉每次重复解释。

先建个专用目录：

```bash
mkdir -p ~/system-setup && cd ~/system-setup
```

写一份 `AGENTS.md`：

```markdown
# 这台机器

- 发行版：Debian 13 (trixie)，x86_64，UEFI 启动
- 内核：6.12 系列，未自行编译过内核
- 桌面：GNOME 48 / Wayland（或 KDE Plasma 6.3）
- 语言：zh_CN.UTF-8，输入法 ibus-libpinyin（GNOME）/ fcitx5（KDE）
- 软件源：TUNA 镜像，组件 main contrib non-free non-free-firmware
- 包管理顺序：apt > flatpak > 源码编译
- 显卡：NVIDIA 独显，闭源驱动 nvidia-driver + DKMS，Secure Boot 已开并注册过 MOK
- 网络：需要代理时用 http://127.0.0.1:7890

# 做事规矩

- 安装软件优先用 apt，只有在 apt 里找不到时才考虑 flatpak，最后才是源码
- 不要添加任何第三方 apt 源、PPA、或者 curl | bash 的安装方式，除非我明确同意
- 中文注释和中文回复，命令、路径、配置项保持英文原文
- 执行的每条命令都要先解释它在干什么、可能改什么文件

# 禁止

- 不要执行 rm -rf、dd、mkfs、chmod -R 777、shred 这类命令
- 不要改 /etc/fstab、/etc/shadow、/etc/sudoers、/etc/passwd，除非我当次明确要求
- 不要在没问我之前重启、关机、切换内核、升级发行版
- 不要用 root 身份运行你自己
```

这份文件把"每个 Debian 教程里都要重复一遍的背景知识"固化下来了。之后你问"为什么我的屏幕亮度快捷键不管用"，它不用再猜你是什么桌面、什么显卡。

### 6.9 权限模型：为什么不要把 sudo 交给它

opencode 默认会在写文件和执行命令前问你。这个"问"是唯一的安全阀，别关掉。

三件事得守住：

1. **不要用 root 跑 opencode**。`sudo opencode` 意味着它每一条命令都不需要额外授权，你的批准流程等于失效。需要 root 的时候，让它把命令给你，你自己敲 `sudo`，或者让它跑 `sudo ...` 时你逐条确认。
2. 不要在 `opencode.json` 里把 bash 权限全局放开。真嫌烦，也只放行只读命令。V1 和 V2 的写法不一样，先确认你装的是哪一代：

V1 用 `permission` 对象：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": {
      "*": "ask",
      "git status": "allow",
      "ls *": "allow",
      "rm -rf *": "deny"
    },
    "edit": "ask"
  }
}
```

V2 改成了有序的 `permissions` 数组，规则按顺序求值，最后命中的那条生效。所以顺序本身就是语义的一部分，把 `deny` 写宽泛了会覆盖掉前面的精细放行：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permissions": [
    { "action": "bash", "resource": "*", "effect": "ask" },
    { "action": "bash", "resource": "git status", "effect": "allow" },
    { "action": "bash", "resource": "rm -rf *", "effect": "deny" }
  ]
}
```

两种结构字段名完全不同，抄错了不会报错，只会静默不生效。这是这类配置最坑的地方。改完用 `$schema` 校验一遍，或者让编辑器标红。

3. 看不懂的命令不要点同意。它会解释，你不懂就让它继续解释，或者让它换个更保守的做法。这类工具最危险的不是它主动做坏事，而是它在一个你没注意的路径上执行了一条你以为很安全的命令。

---

## 7. 让它把剩下的配置干完

下面按"体检 → 基础体验 → 硬件 → 开发环境 → 日常软件 → 备份"的顺序来。每一块都有可以直接粘进去的中文提示词，以及做完该核对什么。

在让它碰任何有风险的东西之前，先确认能回滚。

### 7.1 系统体检

```text
帮我做一次 Debian 13 系统体检，只读不改：
1. 发行版、内核、桌面环境、会话类型（Wayland 还是 X11）
2. 磁盘布局和剩余空间（df -h、lsblk -f）
3. 内存和 swap 使用情况
4. 本次启动的错误级别日志（journalctl -b -p err）
5. 有没有失败的系统服务（systemctl --failed）
6. 显卡型号和正在使用的驱动（lspci -k | grep -A3 VGA）
7. 有没有缺固件的硬件（dmesg 里搜 firmware）
8. 是否开了 Secure Boot
最后给我一份问题清单，按严重程度排序，先别动手。
```

核对时注意：`systemctl --failed` 通常有几条无伤大雅的项（比如某个虚拟机工具的服务），别看到红字就慌。真正值得处理的是 `dmesg` 里的 firmware 缺失和显卡驱动没加载。

### 7.2 中文和输入法收尾

```text
帮我把中文环境补完整：
1. 检查现在装了哪些中文字体，缺不缺 Noto CJK
2. 检查输入法框架是 ibus 还是 fcitx5，和当前桌面环境是否匹配
3. 如果是 GNOME + Wayland，确保用 ibus-libpinyin 并已设为默认输入法
4. 检查 locale 是不是 zh_CN.UTF-8，如果不是告诉我该改哪个文件
5. 检查终端和浏览器里的中文显示是否正常
每一步先说明要装什么、改什么文件，等我确认再执行。
```

怎么算生效：输入法能在任意 GTK 应用里打中文，不是"托盘里有图标"。`Super + Space` 切不过去，通常是输入源没加到 GNOME 设置里，而不是包没装。

### 7.3 显卡驱动

这是 Debian 桌面上最容易出问题的一块，尤其是 NVIDIA。

```text
我的显卡是 <NVIDIA RTX 4060 / AMD RX 7800 XT>。帮我确认现在用的是开源驱动还是专有驱动：
1. 看 lspci -k 里当前绑定的内核模块
2. 如果是 NVIDIA 且用的是 nouveau，告诉我装 nvidia-driver 的完整步骤
3. 明确告诉我：Secure Boot 开着的情况下装 NVIDIA 闭源驱动，需要 MOK 注册，具体流程是什么
4. 装完怎么验证（nvidia-smi、glxinfo）
5. 如果装完进不了图形界面，怎么从 TTY 回滚
先别执行，把步骤列出来给我看。
```

核对清单：

- Debian 装 NVIDIA 闭源驱动就是 `sudo apt install nvidia-driver firmware-misc-nonfree`（从 `non-free` / `non-free-firmware` 组件），版本号随仓库更新，不要背数字。
- Secure Boot 开着时，DKMS 编译出来的模块没有签名，安装最后会弹出一个蓝底白字的 MOK 注册界面：设一个一次性密码 → 重启 → 在 MOK 管理界面选 Enroll MOK → 输入刚才的密码 → 继续启动。跳过这一步，结果是驱动装了但不加载，屏幕分辨率卡在 1024×768。
- 装坏了进不去图形界面时，`Ctrl + Alt + F3` 切 TTY，`sudo apt purge nvidia-driver`，或者直接回滚到开源驱动。

### 7.4 开发环境

```text
帮我在这台 Debian 13 上配一套通用开发环境，逐项来，每项先问我：
1. git：配置用户名和邮箱，生成 ed25519 SSH key，告诉我该把公钥加到哪
2. Node.js：确认系统版本；如果需要更新的版本，用 fnm 用户级安装，不要用 NodeSource 的 root 脚本
3. Python：python3、venv、pipx，明确说明 Debian 的 PEP 668 限制（不能直接 pip install 到系统环境）
4. Docker：从 Debian 仓库装 docker.io 和 docker-compose（trixie 里的 docker-compose 已经是 v2 版本），装完确认 `docker compose version` 能用；解释把用户加进 docker 组等于给 root 权限这件事，问我是否接受
5. 常用 CLI：ripgrep、fd-find、jq、bat（注意 Debian 里名字可能不一样）
每装一个包说明它是什么、大概多大。
```

几处容易踩的：

- Debian 13 的 `python3` 受 PEP 668 保护，`pip install requests` 会报 `externally-managed-environment`。正确做法是 venv 或 pipx，别用 `--break-system-packages` 糊过去。
- `docker` 组等价于 root：组里的任何用户都能起一个挂载 `/` 的容器。个人机器上可以接受，但要知道代价。
- `fd` 在 Debian 里叫 `fd-find`，命令是 `fdfind`；`bat` 叫 `batcat`。这类命名差异让 agent 查一下 `apt-file` 就能解决，不用自己记。

### 7.5 日常软件

```text
帮我把日常软件配起来，全部走 apt 或 flatpak：
1. 截图和录屏工具
2. 压缩解压：7z、rar、zstd
3. 浏览器：Firefox 用系统的，Chrome 用 flatpak（不要加 Google 的 apt 源）
4. 影音：mpv、ffmpeg
5. 字体：除了 Noto CJK，再补一套等宽编程字体
每项告诉我包名、来源（apt 还是 flatpak）、大概体积。
```

Chrome、VS Code、Discord 这些厂商都有自己的 apt 源。加源意味着系统里多一个信任根，多一个定时升级的东西。个人机器上无可厚非，但这是"要不要"的问题，让 agent 替你做决定不合适。

### 7.6 备份和快照

```text
我的根分区文件系统是 <ext4 / btrfs>，帮我设计一套备份方案：
1. 如果是 btrfs，用 snapper 做自动快照，怎么配置保留策略
2. 如果是 ext4，用 timeshift 的 rsync 模式，还是直接用 restic 加密备份到外置硬盘
3. 我个人文件在 /home，需要能恢复到某个时间点
4. 给我一个"每周自动跑一次"的方案，用 systemd timer 还是 cron
5. 最后给我一条命令，用来验证备份能真的恢复出来
先讲方案对比，别直接装。
```

恢复没跑通过，备份就等于没有。让 agent 给你一条从备份里恢复单个文件的命令，亲自跑一次。

### 7.7 把做过的事记下来

```text
把这次我们做的所有系统改动整理成一份 CHANGELOG.md：
按时间顺序，每条写清楚改了什么文件、装了什么包、为什么
以后重装系统时我要照这个清单快速恢复
```

这份文件记的是你这台机器的实际状态，换个教程抄不到。

---

## 8. 出问题时先看哪里

| 现象 | 先查 |
| --- | --- |
| 装完进不了图形界面 | `Ctrl + Alt + F3` 进 TTY，`journalctl -b -p err`，多半是显卡驱动 |
| 开机不进 GRUB，直接进 Windows | BIOS 启动顺序 / `efibootmgr -v` 看 EFI 条目 |
| GRUB 里有 Windows 但选了黑屏 | Windows 的快速启动没关，或者 BitLocker 在要求恢复 |
| `sudo` 报 not in sudoers | 5.3，加组后重新登录 |
| apt 报 `Release file expired` | 系统时间不对，`timedatectl` 看同步状态 |
| apt 报 GPG 错误 | 换源时 keyring 路径写错，确认 `Signed-By` 指向 `/usr/share/keyrings/debian-archive-keyring.gpg` |
| 中文全是方块 | `fc-list :lang=zh` 看有没有字体；有字体就是 locale 问题 |
| 输入法打不出中文 | 桌面环境和输入法框架不匹配（GNOME Wayland 用 ibus） |
| NVIDIA 驱动装了不加载 | Secure Boot 下 MOK 没注册，`mokutil --sb-state` 和 `nvidia-smi` 一起看 |
| `opencode: command not found` | PATH 没加，见 6.5 |
| opencode 连不上模型 | 代理没传到终端，`curl -I` 目标 API 试一下 |
| opencode 的权限配置不生效 | 大概率 V1/V2 字段写混了，见 6.3 和 6.9 |
| 把系统改坏了想回滚 | 有快照走快照，没有就 GRUB 单用户模式（5.5） |

排障顺序基本是固定的：先确认能上网，再看 `apt` 报不报错，最后才怀疑应用层。网络和 apt 这一层坏了，应用层怎么修都没用。

## 参考链接

- [Debian 官网](https://www.debian.org/)
- [Debian 安装手册（amd64）](https://www.debian.org/releases/stable/amd64/)
- [Debian 13 发行说明](https://www.debian.org/releases/trixie/release-notes/)
- [Debian 官方镜像列表](https://www.debian.org/mirror/list)
- [TUNA Debian 镜像帮助](https://mirrors.tuna.tsinghua.edu.cn/help/debian/)
- [Debian Wiki](https://wiki.debian.org/)
- [OpenCode 官网](https://opencode.ai/)
- [OpenCode 文档](https://opencode.ai/docs/)
- [ArchWiki：sudo（通用原理）](https://wiki.archlinux.org/title/Sudo)
