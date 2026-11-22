---
title: '手动装一遍 Arch Linux，再把 niri + DMS 桌面搭起来'
description: '在 VMware 里把 Arch 手动装一遍，接上 niri 合成器和 DMS 桌面层。SATA/NVMe、Btrfs/ext4、GRUB/systemd-boot 这几处岔路都留了能切换的对照。'
date: 2026-11-22
tags:
  - Arch
  - Linux
  - niri
  - DMS
  - Wayland
  - VMware
category: 教程
featured: false
draft: false
verifiedDate: 2026-11-22
difficulty: 中等
audience: 想自己把 Arch 从命令行装到日常可用的人
hasCode: true
hasDownload: false
---

所以今天我想重新体验一下手动装 Arch Linux。

AI 和各种 coding agent 把这事的门槛压得很低，一条命令就能让脚本替你装完；但真到了调驱动、翻日志、判断到底是合成器还是桌面层在闹脾气的时候，能自己从命令行把系统装起来的手感还是得练。这篇文章就是完整的记录：从 Live ISO 到一台能日常用的 niri + DMS 桌面。

那第一步，还是判断这东西适不适合你。

- 你不需要太多软件，愿意为自己挑的每一个包负责；
- 你愿意读报错，而不是看到红字就重装；
- 你想让系统长得像自己，而不是像别人的默认皮肤。

前两条满足就够了。第三条是我个人的洁癖：喜欢配置自己的系统让它变好看，并不代表我是个 M。

所以我一直觉得，这个出自吉他手之手的发行版值得自己装一遍——它被各种「一键美化」教程反复折腾，但你真正需要的那部分，只有一行行敲出来才拿得到。

这次我不动真机：学校的环境太杂，装崩了影响上课，干脆在虚拟机里从头复现一遍，你可以跟着我的视角一步步打怪升级。

> 后端老手可以直接跳到[第二十二节](#二十二懒人路线一条命令)，那里有一条命令的懒人路线。不过我还是建议你先跟着走一遍——出了问题，你至少知道是哪一层在响。

## 一、先把预期摆正：这套东西到底给谁用

先说清楚终点在哪，不然装到一半容易怀疑人生：装完系统只是能登录命令行，好戏在后面。整条路线分两段，前半程全是黑底白字，后半程才看得见东西：

| 阶段 | 内容 | 结束状态 |
| --- | --- | --- |
| 前半程（三～十二节） | Live 环境里分区、格式化、`pacstrap`、写引导 | 重启能看到 tty 登录提示 |
| 后半程（十三～二十节） | niri 合成器 + DMS 桌面层 + 输入法 + 登录管理器 | 能日常用、能看、能换壁纸 |

这两层的分工，后面排错全靠它：合成器是 niri，桌面层是 DMS。顶栏、启动器、通知中心、锁屏全是 DMS 的 QML 程序，niri 只负责把窗口、层、模糊画出来，中间靠主配置里的 include 和 spawn-at-startup 缝在一起。出问题就从这三处查，基本不会迷路。

## 二、在 VMware 里把机器配好

虚拟机设置不用太讲究，但有两件事别省：磁盘给够，40 GB 起步，Btrfs 快照会吃空间；内存给到 4 GB，2 GB 也能装完，只是开 niri 再开浏览器会很难受。

受篇幅限制，虚拟机自身怎么调就不多说了，照着下面这张图把硬件对上就行：

![VMware 里的虚拟机硬件配置](/media/arch/vmware-hardware.webp "内存、处理器核心、磁盘和显示器，先在这里把机器配好")

镜像我提前下好了喵，这一步别偷懒。开机之后直接选第一项，也就是 UEFI 引导的那个 Arch ISO：

![启动菜单：选择第一项](/media/arch/boot-menu.webp "BIOS/Legacy 那几项是给老机器准备的，虚拟机用 UEFI 就行")

## 三、进入 Live 环境：UEFI、联网、时间

来到 ~~中心岛，感觉非常好~~ 这个非常美丽的终端。要做的第一件事，是确认系统到底怎么启动的：

```bash
ls /sys/firmware/efi/efivars
```

能看到一串 `efivars` 文件，说明是 UEFI 启动；提示 `No such file or directory`，那就是传统 BIOS/Legacy 模式，后面 `efibootmgr`、`bootctl` 这些工具全都用不了，得先回虚拟机设置里改。

接着看网络通不通：

```bash
ping bilibili.com
```

有回包就跳过下面这段。虚拟机走 NAT 一般是通的，没通先去查虚拟网络编辑器。

无线网卡得走 `iwctl` 这套交互式命令行：

```bash
iwctl                            # 进入交互式命令行
device list                      # 列出无线网卡，比如 wlan0
station wlan0 scan               # 扫描网络
station wlan0 get-networks       # 列出所有 Wi-Fi
station wlan0 connect wifi-name  # 连接，回车后输密码（这里打不了中文）
exit                             # 连上后退出
```

网络通了就同步时间。时间错了，TLS 握手会失败，`pacman` 会给你一堆莫名其妙的签名错误——不是从太平洋上坠机，是证书校验过不去：

```bash
timedatectl set-ntp true   # 与网络时间同步
timedatectl status         # 检查服务状态
```

![timedatectl status 的输出](/media/arch/timedatectl.webp "确认 System clock synchronized 是 yes")

## 四、换镜像源

`/etc/pacman.d/mirrorlist` 里越靠前的源越优先。国内直连官方源会慢到怀疑人生，把这几个加到文件最上面，行首别留 #，被注释掉的条目是无效的：

```ini group="mirror" tab="国内镜像" tabs="镜像源"
Server = https://mirrors.ustc.edu.cn/archlinux/$repo/os/$arch          # 中科大
Server = https://mirrors.tuna.tsinghua.edu.cn/archlinux/$repo/os/$arch # 清华 TUNA
Server = https://repo.huaweicloud.com/archlinux/$repo/os/$arch         # 华为云
Server = http://mirror.lzu.edu.cn/archlinux/$repo/os/$arch             # 兰州大学
```

```ini group="mirror" tab="官方源" tabs="镜像源"
Server = https://geo.mirror.pkgbuild.com/$repo/os/$arch   # 官方 CDN，自动就近
Server = https://mirror.rackspace.com/archlinux/$repo/os/$arch
```

在海外或者有稳定代理的话，官方 CDN 反而更快。国内源偶尔会同步滞后，遇到「找不到某个包的新版本」，先换源，再怀疑人生。

改完 `pacman -Syy` 刷一次索引。

## 五、分区：先认清你的盘

分区之前先把盘看清楚。现在有两种协议：SATA 的盘叫 `sdx`，NVMe 的盘叫 `nvme0n1pX`。虚拟机里模拟哪种都无所谓，它是啥我们就跟着用啥：

```bash group="disk-name" tab="SATA" tabs="盘符对照"
lsblk -dpno NAME,SIZE,MODEL     # 大概率是 /dev/sda
fdisk -l /dev/sda               # 看容量、扇区大小、现有分区

cfdisk /dev/sda                 # 分区：/dev/sda1 → /dev/sda2 → /dev/sda3
```

```bash group="disk-name" tab="NVMe" tabs="盘符对照"
lsblk -dpno NAME,SIZE,MODEL     # 大概率是 /dev/nvme0n1
fdisk -l /dev/nvme0n1           # 注意分区名多一个 p

cfdisk /dev/nvme0n1             # 分区：/dev/nvme0n1p1 → p2 → p3
```

区别就这么一点：NVMe 的分区名多一个 `p`，`sda1` 对应 `nvme0n1p1`，其余命令完全一样。本文后面统一写 SATA 的 `/dev/sda3`，你用 NVMe 就自己换成 `/dev/nvme0n1p3`。

虚拟机里模拟的通常是 SATA，所以 `fdisk -l` 出来是 `sda`。名字不是随便起的，它本身就说明了这块盘挂在哪条总线上：

![fdisk -l 查看硬盘](/media/arch/fdisk-list.webp "40 GiB 的 sda，还没有任何分区")

认完盘就 `cfdisk /dev/sda`，第一件事是选分区表类型：

![cfdisk 选择分区表类型](/media/arch/cfdisk-table.webp "新机器无脑选 GPT")

GPT 和 MBR 都属于分区表，差别在固件认谁。新机器无脑选 GPT 就行：没有 2 TB 的限制、分区表自己带备份、UEFI 固件原生认它；MBR 是留给必须兼容老 BIOS 的场合的。前面在 Live 环境里已经确认过 UEFI，那就 GPT。

选完就看到一块干净的盘，用方向键在下面的菜单里移动：

![cfdisk 空硬盘界面](/media/arch/cfdisk-empty.webp "New / Delete / Resize / Type / Write / Quit")

Linux 至少需要三个分区：

| 分区 | 大小 | 作用 |
| --- | --- | --- |
| root | 剩余空间 | 系统和软件都装在这里 |
| EFI | 2 G | 引导分区，固件从这里找到引导器，再交给内核 |
| Swap | 4 G | 交换分区，内存不够时暂存数据，也是休眠的前提 |

顺序上先建小的，最后把剩下的全给根分区，省得算数字。选「New」：

![cfdisk 选择 New](/media/arch/cfdisk-new.webp)

输入 `4G`，先把 Swap 建出来：

![输入分区大小 4G](/media/arch/cfdisk-size.webp)

再把它标成 Swap 类型（「Type」→「Linux swap」）：

![分区类型选择 Linux swap](/media/arch/cfdisk-swap.webp)

EFI 和根分区也是同样的流程，一个 2 G 的「EFI System」，剩下的全给「Linux filesystem」，弄完应该长这样：

![分区完成后的布局](/media/arch/cfdisk-layout.webp "sda1 EFI、sda2 Swap、sda3 Linux filesystem")

选中「Write」，输入 `yes` 落盘，再「Quit」退出。出来复核一遍：

![fdisk -l 复核分区](/media/arch/fdisk-verify.webp "三个分区的大小和类型都对得上再往下走")

## 六、格式化与子卷

EFI 和 Swap 的格式化跟文件系统选择无关，先做掉：

```bash
mkfs.fat -F32 /dev/sda1   # EFI 分区，必须 FAT32
mkswap /dev/sda2          # Swap 分区
```

根分区才是第二个岔路口。我选 Btrfs，因为它能随手拍快照回滚；如果你只想要一个能用的系统，ext4 更省心：

```bash group="fs-format" tab="Btrfs" tabs="根分区文件系统"
mkfs.btrfs -L myArch /dev/sda3

# 建两个子卷：@ 给 /，@home 给 /home
mount /dev/sda3 /mnt
btrfs subvolume create /mnt/@
btrfs subvolume create /mnt/@home
umount /mnt
```

```bash group="fs-format" tab="ext4" tabs="根分区文件系统"
mkfs.ext4 -L myArch /dev/sda3

# ext4 没有子卷，格式化完直接挂载即可，
# 下一节的挂载命令也不带 subvol= 参数
```

`myArch` 是卷标，相当于给 Windows 的 C 盘改个名，纯粹为了方便认。

格式化完成后应该是这样：

![三个分区格式化完成](/media/arch/mkfs-done.webp "FAT32、Swap、Btrfs 三步的输出")

子卷建好要复查一下，`-p` 会带上父子关系：

![btrfs subvolume list 复查](/media/arch/btrfs-subvol-create.webp "只有 @ 和 @home 两个，路径是 <FS_TREE>/@")

```bash
btrfs subvolume list -p /mnt
```

![btrfs subvolume list -p 的输出](/media/arch/btrfs-subvol-list.webp)

用 ext4 的话这两步跳过，直接进下一节。

## 七、挂载

挂载顺序有讲究：先 `/`，再 `/home`，再 `/boot`，最后 swap。`/mnt` 是临时根，后面的东西都挂在它下面，顺序错了 `mount` 会找不到挂载点。

Btrfs 要额外带 `subvol=` 和压缩参数。`compress=zstd` 开透明压缩，省空间，也顺手提一点读性能：

```bash group="fs-mount" tab="Btrfs" tabs="挂载"
mount -t btrfs -o subvol=/@,compress=zstd /dev/sda3 /mnt
mkdir /mnt/home
mount -t btrfs -o subvol=/@home,compress=zstd /dev/sda3 /mnt/home
mkdir -p /mnt/boot
mount /dev/sda1 /mnt/boot
swapon /dev/sda2
```

```bash group="fs-mount" tab="ext4" tabs="挂载"
mount /dev/sda3 /mnt
mkdir -p /mnt/boot
mount /dev/sda1 /mnt/boot
swapon /dev/sda2
```

挂完用 `findmnt` 或者 `lsblk -f` 对一眼，四个挂载点都在位再继续：

![挂载完成](/media/arch/mount-layout.webp "根、/home、/boot、swap 四个位置全齐")

到这里准备工作就完了，可以开始装系统了喵。

## 八、装基础系统、fstab、chroot

`pacstrap` 直接把包解压到 `/mnt`，比任何图形安装器都直白：

```bash
pacstrap /mnt base base-devel linux linux-firmware btrfs-progs
```

`btrfs-progs` 只在用 Btrfs 时需要，ext4 可以换成 `e2fsprogs`（它已经在 base 里了，不装也行）。`linux` 是内核包，`linux-firmware` 是固件，虚拟机里也建议装。

再补一批日常要用的：

```bash
pacstrap /mnt networkmanager vim sudo zsh zsh-completions
```

### 生成 fstab

fstab 决定开机时谁挂在哪里。别手写，让 `genfstab` 按当前挂载情况生成，`-U` 表示用 UUID 而不是设备名——设备名会变，UUID 不会：

```bash
genfstab -U /mnt > /mnt/etc/fstab
cat /mnt/etc/fstab
```

![cat /mnt/etc/fstab 复查](/media/arch/fstab.webp "四个条目：/、/home、/boot、swap")

有 `subvol=/@` 的话，说明子卷被正确识别了。

然后切进新系统：

```bash
arch-chroot /mnt
```

从这里开始，所有命令都在新系统里执行，提示符会变成 `[root@archiso /]#`。

## 九、主机名、时区、Locale

主机名：

```bash
vim /etc/hostname     # 我写的是 B0Arch
```

`/etc/hosts` 里要有一条对应的记录，否则 `sudo` 和不少服务会卡在解析主机名上：

```text
127.0.0.1   localhost
::1         localhost
127.0.1.1   B0Arch.localdomain B0Arch
```

时区用软链接指过去，再把系统时间写回硬件时钟：

```bash
ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
hwclock --systohc
```

Locale 决定语言、日期格式和字符集。先编辑 `/etc/locale.gen`，把需要的行前面的 `#` 去掉：

```text
en_US.UTF-8 UTF-8
zh_CN.UTF-8 UTF-8
```

然后生成：

```bash
locale-gen
```

![locale-gen 的输出](/media/arch/locale-gen.webp "Done 就算成功")

系统语言二选一。我的建议是界面用英文、输入法用中文：报错信息用英文搜，命中率高一个数量级。

```ini group="locale" tab="界面英文" tabs="系统语言"
# /etc/locale.conf
LANG=en_US.UTF-8
```

```ini group="locale" tab="界面中文" tabs="系统语言"
# /etc/locale.conf
LANG=zh_CN.UTF-8
```

```bash
echo 'LANG=en_US.UTF-8' > /etc/locale.conf
```

## 十、root 密码与微码

先给 root 设个密码。后面第一次重启要拿它登 tty，现在不设，装完就得再进 Live 环境救一次：

```bash
passwd root
```

![设置 root 密码](/media/arch/passwd-root.webp "Live 环境里没有回显，看不到星号是正常的")

微码是 CPU 的固件补丁，开机时由引导器最先加载。装错的那份不会报错，只是不生效：

```bash group="ucode" tab="Intel" tabs="CPU 微码"
pacman -S intel-ucode
```

```bash group="ucode" tab="AMD" tabs="CPU 微码"
pacman -S amd-ucode
```

虚拟机里 `lscpu` 看 `Vendor ID` 就行。后面写引导项时，微码的 `initrd` 必须排在内核 `initramfs` 前面。

## 十一、装引导器

引导器也分路线。GRUB 兼容性最好，配置最啰嗦；systemd-boot 极简，只认 UEFI，但引导项就是一个纯文本文件。

```bash group="boot" tab="GRUB" tabs="引导器"
pacman -S grub efibootmgr os-prober

grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=ARCH
grub-mkconfig -o /boot/grub/grub.cfg
```

```bash group="boot" tab="systemd-boot" tabs="引导器"
# ESP 直接挂在 /boot 上（本文就是这么挂的），直接装即可
bootctl install

cat > /boot/loader/loader.conf <<'EOF'
default arch.conf
timeout 3
console-mode max
EOF

# 根分区 UUID；Btrfs 必须带 rootflags=subvol=@
ROOT_UUID=$(blkid -s UUID -o value /dev/sda3)
cat > /boot/loader/entries/arch.conf <<EOF
title   Arch Linux
linux   /vmlinuz-linux
initrd  /intel-ucode.img
initrd  /initramfs-linux.img
options root=UUID=$ROOT_UUID rw rootflags=subvol=@ quiet
EOF
```

> systemd-boot 那份里，AMD 机器把 `intel-ucode.img` 换成 `amd-ucode.img`；ext4 去掉 `rootflags=subvol=@`。
>
> 用 GRUB + Btrfs 子卷，如果重启后掉进 emergency shell，说明内核没找到根子卷：在 `/etc/default/grub` 的 `GRUB_CMDLINE_LINUX` 里补 `rootflags=subvol=@`，再 `grub-mkconfig -o /boot/grub/grub.cfg`。

## 十二、重启，然后把自己从 root 里解放出来

到这里引导器就写完了。接下来一步步退出去，从 Live 环境重启进新系统：

```bash
exit            # 退回 Live 环境
umount -R /mnt  # 卸载新分区
reboot          # 重启
```

重启会落到一个黑底白字的 tty 登录提示。用 root 登录，第一件事是启用网络——安装阶段我们只装了包，没启用服务，不启用你会发现「装完了但没网」：

```bash
systemctl enable --now NetworkManager
ping -c1 archlinux.org
```

有回包就建日常账号，后面一直用它，别用 root 跑图形桌面：

```bash
useradd -m -G wheel -s /bin/bash yg     # yg 换成你想要的名字
passwd yg
```

给 `wheel` 组开 sudo：

```bash
EDITOR=vim visudo
# 找到这一行，去掉前面的 #
# %wheel ALL=(ALL:ALL) ALL
```

然后 `exit` 退出 root，用 `yg` 重新登录。

> 为什么一定要建普通用户：AUR 助手（paru/yay）明确拒绝以 root 运行；niri 和 DMS 也都该在用户会话里跑。root 直接起图形会话，剪贴板、polkit、portal 全会出权限毛病，而且这种毛病很难从报错里看出来。

## 十三、图形环境的地基

### 虚拟机先开 3D 加速

在 VMware 里跑 Wayland 合成器，第一道坎不在 Arch，在虚拟机设置：虚拟机设置 → 显示器 → 勾选「加速 3D 图形」，显存给到 1 GB 以上。

不勾也能进系统，但 niri 会退到 llvmpipe 软件渲染，动一下窗口就掉帧。你会以为是配置写错了，来回改 `config.kdl` 改一晚上。真机没这个问题。

### 声音、字体、权限代理

声音、字体、提权代理一次装齐，省得后面缺什么再一条条补：

```bash
sudo pacman -S --needed pipewire pipewire-pulse pipewire-alsa wireplumber \\
  polkit-gnome noto-fonts noto-fonts-cjk noto-fonts-emoji \\
  ttf-jetbrains-mono-nerd
```

| 包 | 作用 | 缺了会怎样 |
| --- | --- | --- |
| `pipewire` 三件套 + `wireplumber` | 声音服务 | DMS 的音量滑块是摆设，按音量键没反应 |
| `noto-fonts-cjk` | 中文字体 | 顶栏时间、通知全是豆腐块，新手最常踩的「汉化失败」 |
| `polkit-gnome` | 图形化提权代理 | 挂 U 盘、改网络设置不会弹密码框，直接失败 |
| `ttf-jetbrains-mono-nerd` | 等宽字体 + 图标 | 终端和顶栏的图标变成方框 |

### 装 AUR 助手

官方仓库里没有 paru，得自己编一份，编译工具先装上：

```bash
sudo pacman -S --needed base-devel git
git clone https://aur.archlinux.org/paru.git /tmp/paru
cd /tmp/paru && makepkg -si
```

`paru -V` 有版本号就行。

## 十四、装 niri

本体和它离不开的几个伙伴，一条命令装完：

```bash
sudo pacman -S --needed niri xwayland-satellite \\
  xdg-desktop-portal xdg-desktop-portal-gnome xdg-desktop-portal-gtk
```

这几个包的分工得说清楚，不然出问题你无从下手：

| 包 | 作用 | 缺了会怎样 |
| --- | --- | --- |
| `niri` | Wayland 合成器本体，滚动平铺 | 没有桌面 |
| `xwayland-satellite` | 按需拉起 Xwayland，跑 X11 老程序 | 微信、部分 Electron 应用打不开 |
| `xdg-desktop-portal` | 门户总线，应用请求「截图/选文件」的中间人 | 截图、文件选择器全失效 |
| `xdg-desktop-portal-gnome` | 门户的 GNOME 实现（niri 没有自己的，借它） | 同上，且屏幕共享黑屏 |
| `xdg-desktop-portal-gtk` | 文件选择器的 GTK 后端 | 打开文件对话框卡死 |

## 十五、第一次进桌面

别急着写配置，先确认它能起来。在 tty 用普通用户执行：

```bash
niri-session
```

一块灰底、顶部一条 niri 的提示条——这就对了。此时没有顶栏、没有壁纸、没有启动器，这是正常的，桌面层还没装。

几个必须知道的键：

- `Super+Shift+E`：退出会话，回 tty
- `Super+T`：niri 默认绑的终端（foot，没装，所以按了没反应也正常）
- `Super+Shift+Slash`：内置快捷键说明

起不来看日志：

```bash
journalctl --user -b | grep -i niri
```

## 十六、写第一份 config.kdl

niri 的配置是一份严格的 KDL 文件，位置固定：`~/.config/niri/config.kdl`。

```bash
mkdir -p ~/.config/niri
vim ~/.config/niri/config.kdl
```

把下面这份抄进去。这是能直接用的最小完整版，每段的作用我写在注释里：

```kdl
// ~/.config/niri/config.kdl
// 顺序有意义：先 include 桌面层的片段，再写自己的，后出现的覆盖先出现的。

include optional=true "dms/colors.kdl"
include optional=true "dms/layout.kdl"
include optional=true "dms/alttab.kdl"
include optional=true "dms/binds-next.kdl"   // 每次启动被重写，别手改
include optional=true "dms/binds.kdl"

input {
    keyboard {
        xkb { layout "us,cn" }
    }
    touchpad {
        tap
        natural-scroll
    }
}

layout {
    gaps 8
    background-color "transparent"        // 关键：让壁纸和模糊层透出来
    default-column-width { proportion 0.5; }
    preset-column-widths {
        proportion 0.33333
        proportion 0.5
        proportion 0.66667
    }
    focus-ring {
        width 2
        active-color "#7aa2f7"
        inactive-color "#3b4261"
    }
}

// niri 26.04+ 的原生模糊
blur {
    passes 3
    offset 3
    noise 0.02
    saturation 1.5
}

// 启动桌面层；xhost 那句让 root 的 X11 程序也能在 Xwayland 里显示
spawn-at-startup "dms" "run"
spawn-at-startup "xhost" "+si:localuser:root"

environment {
    XDG_CURRENT_DESKTOP "niri"
    QT_QPA_PLATFORM "wayland"
    QT_QPA_PLATFORMTHEME "gtk3"
    QT_QPA_PLATFORMTHEME_QT6 "gtk3"
    ELECTRON_OZONE_PLATFORM_HINT "auto"
}

// 桌面层的窗口要放在「背景层之上」，overview 和毛玻璃才正常
layer-rule {
    match namespace="^quickshell$"
    place-within-backdrop true
}
// 只有开了桌面层的 Blur Layer 才需要这条
layer-rule {
    match namespace="dms:blurwallpaper"
    place-within-backdrop true
}

// GNOME 系应用去掉自带边框阴影，统一圆角
window-rule {
    match app-id=r#"^org\\.gnome\\."#
    draw-border-with-background false
    geometry-corner-radius 12
    clip-to-geometry true
}
// 非活动窗口稍微透明，层次感来源
window-rule {
    match is-active=false
    opacity 0.9
}

binds {
    // 自己的键位放最后，才能覆盖自动生成的那份
    Mod+Return { spawn "kitty"; }
    Mod+Space  { spawn-sh "dms ipc call spotlight toggle"; }
    Mod+V      { spawn-sh "dms ipc call clipboard toggle"; }
    Mod+Comma  { spawn-sh "dms ipc call settings focusOrToggle"; }
    Mod+Alt+L  { spawn-sh "dms ipc call lock lock"; }
    Mod+Q      { close-window; }
    Mod+O      { toggle-overview; }

    XF86AudioRaiseVolume allow-when-locked=true {
        spawn-sh "dms ipc call audio increment 3 || wpctl set-volume @DEFAULT_AUDIO_SINK@ 0.05+";
    }
    XF86AudioLowerVolume allow-when-locked=true {
        spawn-sh "dms ipc call audio decrement 3 || wpctl set-volume @DEFAULT_AUDIO_SINK@ 0.05-";
    }
    XF86AudioMute allow-when-locked=true {
        spawn-sh "dms ipc call audio mute || wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle";
    }
}
```

改完立刻校验。KDL 严格到分号，错一个括号整份配置都不生效：

```bash
niri validate
```

include 之所以要放最前面，是因为 niri 的 include 是文本级展开，同一个键后出现的赢。把自动生成的 `binds.kdl` 放前面，你写在文件末尾的 `Mod+Space` 才能压过它；`dms/binds-next.kdl` 是每次启动动态重写的「下一版键位」，所以它排在 `binds.kdl` 上面，让后者覆盖它。

至于现在 `dms/` 目录还不存在为什么能过校验——`optional=true` 就是为这个场景准备的，文件缺失时静默跳过。等桌面层装上、`dms setup` 铺完配置，这几行 include 自动生效，你不用回来改。

## 十七、装 DMS 桌面层

DMS（Dux Modular Shell）是一套用 Quickshell 写的 QML 程序：顶栏、启动器、通知中心、设置面板、锁屏、剪贴板 UI 全在里面。

```bash group="dms" tab="稳定版" tabs="DMS 版本"
# 官方仓库稳定版（推荐先跑这个）
sudo pacman -S --needed dux-shell quickshell
```

```bash group="dms" tab="git 开发版" tabs="DMS 版本"
# 想要最新特性再换开发版；和上面二选一，别都装
paru -S --needed quickshell-git dux-shell-git
```

再装它要调用的外围工具：

```bash
sudo pacman -S --needed wl-clipboard cliphist cava \\
  matugen qt5-multimedia qt6-multimedia kimageformats \\
  libnotify power-profiles-daemon cups-pk-helper \\
  kitty nautilus gvfs file-roller \\
  grim slurp satty wf-recorder brightnessctl playerctl

# 这三个只在 AUR：搜索、日历、进程面板
paru -S --needed dsearch dcal dgop
```

`qt5-multimedia`、`kimageformats` 看着不相干，其实是 DMS 的图片和多媒体组件依赖。缺了会表现为「壁纸列表空白」，或者设置面板里预览裂图。

先手动跑一次，确认能起来：

```bash
dms run
```

顶栏、Dock 应该出现了。`Ctrl+C` 结束，然后交给主配置里的 `spawn-at-startup "dms" "run"` 开机自启。

### 让 DMS 铺自己的配置

`dms setup` 负责把配置铺到位，也能只补其中一类：

```bash
dms setup              # 全部部署
dms setup binds        # 只补键位
dms setup layout       # 只补布局（模糊参数就在这）
```

它的规矩很友好：只写不存在或空着的文件，你改过的一律不碰，所以可以放心反复跑。

| 文件 | 管什么 |
| --- | --- |
| `~/.config/niri/dms/binds.kdl` | 默认键位 |
| `~/.config/niri/dms/binds-next.kdl` | 自动重写，别动 |
| `~/.config/niri/dms/layout.kdl` | 布局参数 + 全局 `blur { offset; passes }` |
| `~/.config/niri/dms/colors.kdl` | 取色主题（跟随壁纸） |
| `~/.config/niri/dms/outputs.kdl` | 显示器与缩放 |
| `~/.config/niri/dms/cursor.kdl` | 光标主题与大小 |
| `~/.config/niri/dms/windowrules.kdl` | 代管的浮动/圆角规则 |
| `~/.config/niri/dms/alttab.kdl` | Alt+Tab 切换器 |

调 `layer-rule` 时会用到这些命名空间：`dms:bar`、`dms:dock`、`dms:app-launcher`、`dms:spotlight`、`dms:clipboard`、`dms:settings`、`dms:control-center`、`dms:notification-center-popout`、`dms:notification-center-modal`、`dms:power-menu`、`dms:workspace-overview`、`dms:desktop-widget:<插件id>`、`dms:modal`、`dms:popout`。

### 换个启动方式（可选）

除了 `spawn-at-startup`，也可以用 systemd 用户服务，前提是装好的包确实带了 `dms.service`：

```bash
systemctl --user list-unit-files | grep -i dms   # 确认有这么个 unit
mkdir -p ~/.config/systemd/user/niri.service.wants
ln -sf /usr/lib/systemd/user/dms.service ~/.config/systemd/user/niri.service.wants/dms.service
```

查不到这个 unit 就老实回去用 `spawn-at-startup`。两种方式只能留一个，否则顶栏会出现两条，或者一条半透明叠影。要用 systemd，就把主配置里的 `spawn-at-startup "dms" "run"` 删掉。

## 十八、把它弄好看：壁纸、模糊、字体、输入法

### 壁纸与取色

先建个放壁纸的目录：

```bash
mkdir -p ~/Pictures/Wallpapers
```

丢几张图进去，DMS 设置里选。开了 `matugen` 之后，主题色会跟着壁纸走，`dms/colors.kdl` 自动重写——所以那个文件也不要手改。

### 模糊只改一处

两条路，选一条：

1. DMS 设置 → Interface style → Blur strength，它会改写 `~/.config/niri/dms/layout.kdl` 里的全局 `blur { offset; passes }`。
2. 直接写在主配置的 `blur {}` 块里。

同时写两处会互相覆盖，表现出来的症状是「调了没反应」或者「重启后变回去」。

### GTK / Qt / 光标

主题和光标包先装上：

```bash
sudo pacman -S --needed adw-gtk-theme nwg-look breeze-cursors
```

- GTK 主题用 `nwg-look` 设，别去手写 `~/.config/gtk-3.0/settings.ini`。
- Qt 靠主配置里的 `QT_QPA_PLATFORMTHEME=gtk3` 自动跟随，不要再装 qt6ct 设一遍。
- 光标在 `dms/cursor.kdl` 里指定。Wayland 下 `gsettings set ... cursor-theme` 不生效，这是常见误区。

### 中文输入法

fcitx5 和 ibus 二选一，别都装。装完都要把环境变量加进主配置的 `environment {}` 里：

```bash group="ime" tab="fcitx5" tabs="输入法"
sudo pacman -S --needed fcitx5 fcitx5-configtool fcitx5-gtk fcitx5-qt fcitx5-rime

# config.kdl → environment {}
LANG "zh_CN.UTF-8"
LC_CTYPE "en_US.UTF-8"
XMODIFIERS "@im=fcitx"
QT_IM_MODULE "fcitx"
QT_IM_MODULES "wayland;fcitx"
SDL_IM_MODULE "fcitx"
GLFW_IM_MODULE "ibus"
```

```bash group="ime" tab="ibus" tabs="输入法"
sudo pacman -S --needed ibus ibus-rime

# config.kdl → environment {}
LANG "zh_CN.UTF-8"
XMODIFIERS "@im=ibus"
GTK_IM_MODULE "ibus"
QT_IM_MODULE "ibus"
SDL_IM_MODULE "ibus"
```

然后把输入法注册成 XDG autostart（下面是 fcitx5 的示例，ibus 换成 `ibus-daemon -drx` 的 desktop 文件）：

```bash
mkdir -p ~/.config/autostart
cp /usr/share/applications/org.fcitx.Fcitx5.desktop ~/.config/autostart/
```

这里有个坑几乎人人踩一次：不要在主配置里写 `spawn-at-startup "fcitx5"`，让 XDG autostart 去拉它。两处都拉会起两个实例，结果是输入法抢不到焦点、候选框乱飘。

`fcitx5-diagnose` 可以逐项体检环境变量有没有传进去。

## 十九、登录管理器：三选一

| 方案 | 怎么装 | 适合 |
| --- | --- | --- |
| TTY 直启 | 什么都不装，登录后敲 `niri-session` | 折腾期最省事 |
| ly | 轻量 TUI 登录框 | 想要图形登录又不想重 |
| dux-greeter | 图形化，和 DMS 同一套视觉 | 想要开箱即用的观感 |

```bash group="greeter" tab="TTY 直启" tabs="登录方式"
# 什么都不用装。
# 登录 tty 后手动起会话：
niri-session
```

```bash group="greeter" tab="ly" tabs="登录方式"
sudo pacman -S ly
sudo systemctl enable ly@tty1.service

# 配置文件在 /etc/ly/config.ini，想自动登录就改那里
```

```bash group="greeter" tab="dux-greeter" tabs="登录方式"
paru -S dux-greeter-bin
sudo dms-greeter install --yes
```

tty1 只能有一个东西占着。换之前先关旧的，并确认没残留：

```bash
systemctl list-unit-files | grep -Ei 'gdm|sddm|lightdm|lxdm|ly@|greetd|lemurs|plasmalogin'
```

命中哪个就 `sudo systemctl disable --now` 掉那个。常见冲突名单：`lemurs ly gdm lightdm lxdm plasma-login-manager sddm greetd`。

## 二十、验收清单

别全信自己的眼睛，先跑几条命令把该通的地方对一遍：

```bash
niri validate                          # 配置语法
pgrep -a quickshell                    # 桌面层进程在不在
dms ipc call settings focusOrToggle    # IPC 通不通（能弹面板就是通）
busctl --user list | grep -i portal    # 门户服务
```

命令都通，再逐条上手试：

- [ ] `Super+Space` 弹出启动器
- [ ] `Super+V` 剪贴板有历史（先 `wl-copy` 两次试试）
- [ ] 截图键能出图（门户通了才行）
- [ ] 音量键有 OSD，且音量真的变
- [ ] 中文输入法能切（`fcitx5-diagnose` 全绿）
- [ ] 非活动窗口半透明、圆角正常
- [ ] 锁屏可用（`dms ipc call lock lock`）
- [ ] 壁纸能换，换完主题色跟着变

## 二十一、常见坑

| 现象 | 原因 | 修法 |
| --- | --- | --- |
| `niri validate` 报错 | KDL 语法严，少分号/多括号 | 按行号看报错，别整份重写 |
| 改了键位没生效 | 改的是 `dms/binds-next.kdl` | 它每次启动被重写，改 `dms/binds.kdl` 或主配置 |
| 顶栏出现两条 | systemd 单元和 `spawn-at-startup` 同时开了 | 删一个 |
| 输入法抢不到焦点 | 两处都 spawn 了 fcitx5 | 只留 XDG autostart |
| 截图/选文件没反应 | 门户没拿到 Wayland 环境 | `dbus-update-activation-environment --systemd WAYLAND_DISPLAY XDG_CURRENT_DESKTOP=niri` 后再起门户 |
| root 程序黑屏 | Xwayland 权限 | `xhost +si:localuser:root`（已写进配置） |
| nautilus 花屏/黑块 | 双显卡 NVIDIA | `GSK_RENDERER=gl`，写进 `~/.config/environment.d/gsk.conf` |
| 顶栏中文是方块 | 缺 CJK 字体 | `pacman -S noto-fonts-cjk` |
| 壁纸列表空白 | 缺图片解码插件 | `kimageformats`、`qt6-multimedia` |
| 动画卡成 PPT | 虚拟机没开 3D 加速，退到 llvmpipe | 虚拟机设置里勾「加速 3D 图形」，或上真机 |
| 调模糊没反应 | `layout.kdl` 和 `config.kdl` 各写了一份 | 只留一处 |
| 换光标没变化 | 用了 `gsettings` | Wayland 下改 `dms/cursor.kdl` |
| 开机掉进 emergency shell | Btrfs 子卷没传给内核 | 内核参数补 `rootflags=subvol=@` |

## 二十二、懒人路线：一条命令

上面二十几节，社区里已经有人打包成脚本了。如果你只是想要结果，不想一步步敲：

```bash group="strap" tab="交互式" tabs="一键脚本"
# shorin.xyz/archsetup 会 302 到 repo.shorin.xyz/archlinux/strap.sh
curl -L shorin.xyz/archsetup | bash
```

```bash group="strap" tab="指定镜像" tabs="一键脚本"
# 国内默认走 Gitee；想手动指定，先导出变量再跑
# 注意环境变量要落在 bash 上，MIRROR=x curl … | bash 只作用于 curl
export MIRROR=gitee        # github / gitee / codeberg

curl -L shorin.xyz/archsetup | bash
```

不过跑之前有四件事得知道。

一是它必须在装好的系统里跑，也就是 `arch-chroot` 之后。Live ISO 环境会被检测出来直接拒绝——脚本里就检查 `/run/archiso` 和根文件系统是不是 overlay。

二是它只支持 x86_64，而且假定你用 Btrfs 子卷加快照，会在装桌面之前打一个快照；分区方案跟这篇不一样的话，相关模块要自己跳过。

三是它本身是交互式的，会弹 fzf 菜单让你选桌面环境，然后一路 `pacman -Syyu`。下载走 `tar.gz` 加 `pv` 进度条，大概 80 MB，失败会重试三次。

四是 `curl | bash` 会吃掉 stdin，菜单可能不响应。真遇到就先把脚本存下来再执行：

```bash
curl -L shorin.xyz/archsetup -o /tmp/archsetup.sh
less /tmp/archsetup.sh          # 至少扫一眼
bash /tmp/archsetup.sh < /dev/tty
```

但我还是建议你先跟着前面走一遍。一键脚本不会告诉你哪一层在闹脾气——而你现在已经知道了：合成器是 niri，桌面层是 DMS，中间靠主配置的 include 和 spawn-at-startup 缝在一起。出了问题从这三处查，基本不会迷路。
