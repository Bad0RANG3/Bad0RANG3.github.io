# Debian 13 + opencode 事实清单（核实于 2026-10-24）

## A. Debian 13 身份与发布

| 项 | 事实 |
|---|---|
| 代号 | trixie |
| 首发 | 2025-08-09 |
| 当前点版本 | **13.7**（`Release` 文件：`Version: 13.7`，2026-09-12） |
| 支持期 | 5 年（Security + LTS） |
| 架构 | amd64、arm64、armel、armhf、ppc64el、riscv64（新增）、s390x |

**桌面用户相关变化（vs Debian 12）**
- 内核 6.1→**6.12**；GCC 14.2；glibc 2.41；Python 3.13。
- **GNOME 48**、**KDE Plasma 6.3**、Xfce 4.20、LXQt 2.1.0；LibreOffice 25。
- **usr-merge 完成**：升级时报 `dpkg: warning: unable to delete old directory '/lib/firmware/...'`，可安全忽略。
- **i386 降级**：不再是常规架构，无官方内核与安装器，仅用于 amd64 上的 multiarch/chroot，要求 SSE2。
- **apt 3.0.3**：`/etc/apt/trusted.gpg` 不再被信任；无 `Signed-By` 的旧条目弃用；**deb822 `.sources` 为官方推荐**；`apt-key` 已移除。
- **non-free-firmware**：安装器按内核日志/alias 自动装所需固件并自动启用该组件（镜像步骤里 "Use non-free firmware?" 模板默认 `false`，需要时被预置开启）。

## B. 安装器（netinst + 图形安装器）

```bash
# 官方 amd64 iso-cd 目录现有（2026-10 实测）
debian-13.7.0-amd64-netinst.iso      # 756M
debian-edu-13.7.0-amd64-netinst.iso
debian-mac-13.7.0-amd64-netinst.iso
```
```bash
curl -LO https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-13.7.0-amd64-netinst.iso
curl -LO https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/SHA256SUMS
# 13.7.0 该 ISO 的 SHA256：
# a7ef94ac2fb9a7fec454552abd629b7cc9d5155c886165a45649f5ce6167e355
sha256sum debian-13.7.0-amd64-netinst.iso
grep debian-13.7.0-amd64-netinst.iso SHA256SUMS
```
点版本更新后校验值会变，永远以同目录 `SHA256SUMS` 为准。

```bash
# Linux 写盘：写整盘设备，不是分区
lsblk
sudo dd if=debian-13.7.0-amd64-netinst.iso of=/dev/sdX bs=16M status=progress oflag=sync
```
Windows：Debian CD FAQ 官方推荐 **balenaEtcher**（有 `balenaEtcher-portable.exe`）或 **USBImager**；不得用会改写镜像的工具（unetbootin）。⚠️ Rufus 常见但非 Debian 官方推荐（须用 DD 模式），未逐字核实。

**UEFI / Secure Boot**：Debian 自带微软签名 `shim`，安装指南原文 "should work correctly on systems with secure boot enabled" → **13 可开箱在 Secure Boot 下启动**；trixie 另新增 systemd-boot 的 Secure Boot 支持。装机前关闭 Windows 快速启动。

**分区**：引导式三选一 —— 普通分区 / LVM / 加密 LVM（后者整盘写随机数据，较慢）。方案：全部一个分区 8GB、单独 `/home` 9GB、`/home`+`/var`+`/tmp` 12GB、服务器型 `/srv`+`/var`、小盘 3GB。默认 `ext4`；支持 ext2/3/4、jfs、xfs、reiserfs（默认关）。**btrfs 不在引导式选项里**，只能用「手动」+`partman-btrfs`；trixie 新增对 btrfs 子卷系统的救援支持。**swap 只会创建分区（加密 LVM 时在卷内），没有 swapfile 选项**。

**root 密码 / 用户（已核对 `user-setup` 源码）**
- **root 密码留空** → root 账号禁用；安装器自动 `apt-install sudo` 并把首个用户 `adduser $USER sudo`（失败才回退写 `$USER ALL=(ALL) ALL`）。即**自动配置好 sudo**。
- **设置了 root 密码** → **不装 sudo、不加 sudo 组**，须手工做 D 节。
- 默认附加组：`audio cdrom dip floppy video plugdev netdev scanner bluetooth debian-tor lpadmin`。

**tasksel**：`Debian desktop environment`（默认 GNOME，可改 KDE/Xfce/LXQt）+ `Standard system utilities`（保持选中）+ Web/SSH server；新增 Debian Blends 入口。**GRUB** 默认装到主盘 UEFI 分区，装前用 `os-prober` 探测其他系统。⚠️ 若 Windows 未进菜单：`sudo os-prober && sudo update-grub`（`GRUB_DISABLE_OS_PROBER` 相关）。

## C. 首次启动配置

```bash
# 桌面任务装的是 NetworkManager（gnome-core 推荐 network-manager；Plasma 用 plasma-nm）
systemctl status NetworkManager
nmcli device status
nmcli device wifi list
nmcli device wifi connect "SSID" password "密码"
nmcli connection up "SSID"
```
`ifupdown` 仍为 `Priority: important`，但桌面安装由 NetworkManager 实际接管，别让两者抢同一网卡。

```bash
grep -r non-free-firmware /etc/apt/sources.list /etc/apt/sources.list.d/
lspci -nnk | grep -A3 -i network
dmesg | grep -i firmware
sudo apt install firmware-iwlwifi   # 按实际网卡
```

**APT 源**：13 安装器写的是传统 `sources.list`（`deb ... trixie main`，apt-setup 0.198 行为），但官方推荐 `/etc/apt/sources.list.d/debian.sources`；`apt` 包自带示例 `usr/share/doc/apt/examples/debian.sources`。
```bash
cat /etc/apt/sources.list; ls /etc/apt/sources.list.d/
```
```ini
# /etc/apt/sources.list.d/debian.sources —— 清华 TUNA
Types: deb
URIs: https://mirrors.tuna.tsinghua.edu.cn/debian
Suites: trixie trixie-updates trixie-backports
Components: main contrib non-free non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg

Types: deb
URIs: https://security.debian.org/debian-security
Suites: trixie-security
Components: main contrib non-free non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
```
USTC 同构（`URIs: http://mirrors.ustc.edu.cn/debian`，security：`http://mirrors.ustc.edu.cn/debian-security`）。安全更新建议走官方源（镜像有同步延迟）。阿里云语法未逐字核实 ⚠️。
```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y sudo curl wget git vim build-essential htop fastfetch fonts-noto-cjk
sudo timedatectl set-timezone Asia/Shanghai
sudo dpkg-reconfigure locales          # 或 localectl set-locale LANG=zh_CN.UTF-8
sudo localectl set-keymap us
sudo hostnamectl set-hostname debian-trixie
```

```bash
# 中文输入法
sudo apt install -y fcitx5 fcitx5-rime fcitx5-chinese-addons fcitx5-config-qt \
  fcitx5-frontend-gtk3 fcitx5-frontend-gtk4 fcitx5-frontend-qt5 fcitx5-frontend-qt6
export GTK_IM_MODULE=fcitx QT_IM_MODULE=fcitx XMODIFIERS=@im=fcitx   # 供 X11/Xwayland
```
- **GNOME Wayland**：不支持 `input-method` 协议，fcitx5 弹窗异常，需 Kimpanel 类扩展或改用 IBus。
- **KDE Wayland**：须 KWin 拉起 —— 系统设置→键盘→虚拟键盘→选 Fcitx 5，并停用 `/etc/xdg/autostart/org.fcitx.Fcitx5.desktop`。

```bash
# Flatpak
sudo apt install -y flatpak
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
sudo apt install -y gnome-software-plugin-flatpak   # 可选
```

## D. 给用户 sudo（Debian 官方做法）

Debian 用 **`sudo` 组**（GID 27）；**没有 `wheel` 组**；`adm` 只读日志，**不给 root 权限**。
```bash
id; groups; sudo -l
```
```bash
# 已装 sudo 的情形
su -
usermod -aG sudo 你的用户名
exit
newgrp sudo            # 或直接注销再登录（更彻底）
id                     # 确认出现 sudo
sudo -l                # 期望 (ALL : ALL) ALL
```
```bash
# 安装时设了 root 密码 → sudo 未安装
su -
apt update && apt install -y sudo
usermod -aG sudo 你的用户名
exit
```
```bash
sudo grep -nE '^%sudo|^@includedir' /etc/sudoers
# 默认即含：%sudo	ALL=(ALL:ALL) ALL
#           @includedir /etc/sudoers.d
```
```bash
# drop-in（推荐），文件名不得含 "." 或以 "~" 结尾，否则被忽略
sudo visudo -f /etc/sudoers.d/90-myname
# 内容：你的用户名 ALL=(ALL:ALL) ALL
sudo chmod 0440 /etc/sudoers.d/90-myname
sudo visudo -c          # 必须 parsed OK
```
`NOPASSWD: ALL` 能不用就别用：任何拿到你 shell 的进程立刻等于 root。

## E. opencode 安装与配置

**版本现状**：现有 V1/V2 两条线，同一 `opencode` 命令、**不能并存**。V2 为主线，npm 包 `@opencode/cli`（实测 2.1.4）；V1 为 `opencode-ai`（实测 1.19.4）。**无 Debian/apt 仓库，CLI 没有 .deb**（只有桌面版提供 .deb/.rpm/AppImage）。
```bash
curl -fsSL https://opencode.ai/v2/install | bash   # V2 官方脚本
curl -fsSL https://opencode.ai/install | bash      # V1（会拒绝装 2.x）
export PATH="$HOME/.opencode/bin:$PATH"            # 装到 ~/.opencode/bin，脚本会写 ~/.bashrc
opencode --version
npm install -g @opencode/cli                       # npm 方式（V2）
```
**Node**：Debian 13 自带 `nodejs` **20.19.2**，够用；`@opencode/cli` 的 npm 元数据**未声明 engines**，官方也没写最低版本 ⚠️。需要更新版：
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -   # 写入 deb822 源，Suites: nodistro
sudo apt install -y nodejs
```

```bash
opencode auth login              # 或 opencode auth login anthropic
opencode auth list
opencode models
```
凭据在 `~/.local/share/opencode/auth.json`。配置：全局 `~/.config/opencode/opencode.json(c)`、项目 `./opencode.json` 或 `./.opencode/opencode.json`、系统 `/etc/opencode/opencode.json`；schema `https://opencode.ai/config.json`。⚠️ V1 文档写「项目 > 全局 > 系统」，V2 文档写系统配置优先级最高，两者表述冲突，以实机为准。

```json
// ~/.config/opencode/opencode.json —— OpenAI 兼容端点（V1 写法，V2 仍兼容）
{
  "$schema": "https://opencode.ai/config.json",
  "model": "myprovider/qwen3-coder",
  "provider": {
    "myprovider": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My Provider",
      "options": { "baseURL": "https://api.example.com/v1", "apiKey": "{env:MY_API_KEY}" },
      "models": { "qwen3-coder": { "name": "Qwen3 Coder" } }
    }
  }
}
```
V2 原生写法：`providers` / `package` / `settings.baseURL` / `env`。也支持 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等环境变量。

```bash
opencode                       # TUI
opencode ~/code/project
opencode run "解释这个仓库"
opencode run --model anthropic/claude-sonnet-5-5 "重构 parseToken"
opencode run --format json "列出所有 TODO"
opencode run --auto "修掉失败的测试"
opencode serve --port 4096     # headless HTTP API
opencode pair                  # 一次性网页登录链接，5 分钟过期
```
- **AGENTS.md**：项目根或 `~/.config/opencode/AGENTS.md`，TUI 内 `/init` 生成/改进；兼容 `CLAUDE.md`。
- **权限**：V1 用 `permission` 键（`allow`/`ask`/`deny`，多数默认 `allow`，`external_directory`、`doom_loop` 与读 `.env` 默认 `ask`）；V2 改为有序 `permissions` 数组（`action`/`resource`/`effect`，**最后匹配者生效**）。写文章务必标注版本。
- **内置工具**：`bash`、`edit`、`write`、`read`、`grep`、`glob`、`webfetch`、`task`、`todowrite`、`lsp`（实验）。
- **会话分享**：V2 为 `opencode pair`；V1 的 `share` 在本次抓取的 V2 文档中未出现 ⚠️。

## F. 装完可以让 opencode 干的活

1. 显卡驱动：`检查这台 Debian 13 的显卡型号，判断用 nouveau 还是 nvidia 闭源驱动，给出带 non-free 源和 Secure Boot 签名的完整步骤。`
2. 打印机：`用 lpstat/cups 配置局域网 HP 打印机，并排查 avahi 发现失败。`
3. 中文输入：`GNOME Wayland 下 fcitx5-rime 候选框不显示，按 Wayland 限制逐项排查并给配置。`
4. Docker：`按 Docker 官方 deb822 源换成国内镜像，说明为什么不用 Debian 自带 docker.io。`
5. Flatpak：`列出适合中文用户的常用 Flathub 软件，写好安装与中文字体权限覆盖命令。`
6. dotfiles：`把 ~/.bashrc、~/.config/opencode、fcitx5 配置整理成一个 git 仓库并给 stow 用法。`
7. 体检：`读 dmesg 和 systemctl --failed，列出这台新装系统的硬件与启动问题。`

## Sources（实际抓取）

- debian.org：`/releases/trixie/release-notes/whats-new.en.html`、`issues.en.html`、`upgrading.en.html`
- debian.org 安装指南：`/releases/trixie/amd64/ch06s03.en.html`、`ch03s06.en.html`、`ch02s02.en.html`、`ch04s03.en.html`、`ch04s07.en.html`
- debian.org：`/News/2025/20250809`、`/News/2026/`、`/CD/faq/`
- `cdimage.debian.org/debian-cd/current/amd64/iso-cd/`（含 SHA256SUMS）
- `deb.debian.org/debian/dists/trixie/Release`
- `mirrors.tuna.tsinghua.edu.cn/help/debian/`、`mirrors.ustc.edu.cn/help/debian.html`
- `flatpak.org/setup/Debian`、`flathub.org/setup/Debian`
- `wiki.archlinux.org/title/Fcitx5`
- `packages.debian.org/trixie/task-desktop`、`task-gnome-desktop`、`gnome-core`、`plasma-desktop`
- `tracker.debian.org/pkg/nodejs`
- opencode.ai：`/docs/`、`/docs/cli`、`/docs/config`、`/docs/providers`、`/docs/rules`、`/docs/permissions`、`/docs/tools`、`/v2/docs/`、`/v2/docs/cli/commands`、`/v2/docs/config`、`/v2/docs/providers`、`/v2/docs/permissions`、`/v2/docs/migrate-v1/`
- `opencode.ai/install`、`opencode.ai/v2/install`（脚本源码）
- `registry.npmjs.org/opencode-ai/latest`、`registry.npmjs.org/@opencode/cli/latest`
- `deb.nodesource.com/setup_22.x`（脚本源码）
- 逐字核对的 Debian 源码包：`user-setup` 的 `user-setup-apply`、`apt-setup` 0.198/0.201、`sudo` 1.9.16p2 的 `/etc/sudoers`、`base-passwd` 的 `group.master`
