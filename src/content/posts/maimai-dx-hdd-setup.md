---
title: '如何把玩你拿到的APP原盘🤭'
description: '从 .app/.opt 解包、segatools 逐项配置、SDEZ/SDGB 区服差异，到 AquaMai 与 Sinmai-Assist 的版本边界和排障，一份尽量讲透细节的 maimai DX HDD 配置笔记。'
date: 2026-09-18
updatedDate: 2026-09-25
verifiedDate: 2026-09-21
tags:
  - maimai
  - maimai DX
  - SDEZ
  - SDGB
  - segatools
  - AquaMai
  - Sinmai-Assist
  - 街机
  - HDD
category: 教程
featured: false
draft: false
difficulty: 进阶
audience: 任何一个有IQ的人
hasCode: true
hasDownload: false
polished: true
---

这篇文章只处理一件事：把 HDD 里的游戏配置，调到你能实际使用。为了让每一步都经得起核对，我把散落在 segatools、fsdecrypt、AquaMai 和 Sinmai-Assist 源码、tag、release、issue/PR 里的信息重新梳理了一遍，尽量把“哪个盘走哪条路、每一步为什么这样做、卡住时先看哪里”讲清楚，而不是只给一串能抄的命令。

先说结论，方便你判断要不要继续读：

- **SDEZ** 有最省事的路线：MaiChartManager 把 MelonLoader、AquaMai 和配置编辑器放在一个界面里，装完就能改设置。
- **SDEZ 如果还想用 Sinmai-Assist**，必须自己改源码适配，原项目并不能直接编译到 SDEZ。
- **SDGB** 目前最稳妥的路线是固定一个经过 SDGB 数据版本验证的 AquaMai 构建，再单独处理 Sinmai-Assist，不能直接套最新的 SDEZ 构建。
- **不要在同一台机器上同时追求“最新 MelonLoader + 最新 AquaMai + 最新配置 + 最新 Sinmai-Assist”**。这套东西的兼容性靠版本组合，不靠每个文件单独最新。

边界也必须放在最前面。本文不提供游戏安装包、`.app`/`.opt`、ICF、keychip、PCB 文件、服务器凭据，也不涉及绕过授权、篡改 protected runtime 或破坏完整性校验。下面默认你已经合法拿到当前这台机器需要使用的系统盘和配套硬件。凡是涉及账号、成绩和服务端行为的操作，请自己承担风险。

---

## 0. 开工前，先写一份版本清单

这套链路里，绝大多数“配置没生效”和“一启动就崩”，根源都是版本没对齐。所以在动手之前，先把下面这份清单填出来，之后每换一次文件就更新一次。

```text
game_id:                 SDEZ 或 SDGB
game_data_version:       从 ConstParameter.NowGameVersion 读取，例如 25100
game_id_string:          从 ConstParameter.GameIDStr 读取
Sinmai.exe SHA-256:
amdaemon.exe SHA-256:
Assembly-CSharp.dll SHA-256:
AMDaemon.NET.dll SHA-256:
.app / .opt 原始文件名:
.app / .opt SHA-256:
segatools tag:
AquaMai tag:
MelonLoader version:
server host:
```

读取游戏版本最直接的办法，是用 dnSpy 或 ILSpy 打开目标版本的 `Assembly-CSharp.dll`，查找 `MAI2System.ConstParameter.NowGameVersion` 和 `GameIDStr`。如果目标 AquaMai 构建已经能启动，也可以从它的日志里看 `GameInfo.GameVersion` / `GameInfo.GameId` 的间接输出。

这里有一个很容易踩的坑：社区口头简称和真实版本号不是一回事。`NowGameVersion` 的数值格式大致是 `25500` 对应 1.55、`26500` 对应 1.65；大家说的“SDGB151”未必精确等于某个补丁位。**必须用你手里的 `ConstParameter` 实测，而不是照抄别人的简称。**

---

## 1. 术语与组件边界

先把手里的东西按职责分清楚。下面这些名字会在后文反复出现，弄混一个，排查方向就会跑偏。

| 名称 | 作用 |
| --- | --- |
| `SDEZ` | maimai DX 日服 / SEGA 国际体系的 title / game ID |
| `SDGB` | 中国服「舞萌 DX」使用的 title / game ID |
| `.app` | SEGA 的 fscrypt/APP 容器，通常是完整游戏版或增量版 |
| `.opt` | Option / 追加数据容器，通常包含 `Axxx` 一类数据目录 |
| `amdaemon.exe` | AM Daemon：启动、网络、板卡、认证、I/O 的守护进程 |
| `Sinmai.exe` | Unity 游戏主程序 |
| `mai2hook.dll` | segatools 的 maimai DX hook，负责注入与重定向 |
| `mai2io.dll` | 自定义 maimai DX 按钮、触摸、LED 的 IO 接口 |
| `aimeio.dll` | 自定义读卡器接口 |
| `segatools.ini` | 加载路径、DNS、网络虚拟化、keychip、PCID、I/O、触摸、VFD、LED 的配置 |
| `config_*.json` | AM Daemon 的通用 / 服务端 / 客户端 / hook 配置 |
| `MelonLoader` | 运行 Harmony 与 Mod 的 Unity mod loader |
| `AquaMai` | Sinmai 的 Harmony mod 套件，偏系统兼容、输入、资源和 UX |
| `Sinmai-Assist` | 另一套 Sinmai mod，偏 cheat、解锁、FastSkip 与调试 |
| `Mercury` | segatools 里对应 **WACCA** 的 hook/IO，和 maimai 没有关系 |

最后一条值得单独强调：`dist/mercury/` 里的配置注释写得很清楚，`mercuryio` 是 “custom WACCA IO DLL”，启动目标也是 WACCA 的可执行文件。**不要把 `mercuryhook.dll` 配到 `sinmai.exe`，也不要把 `dist/mercury` 的配置当成 maimai 示例。** 如果某篇教程把 Mercury 写成 maimai 必需组件，先怀疑它把两个游戏混淆了。

---

## 2. VFS 与目录语义：最容易搞错的一层

segatools 的 `[vfs]` 把 Linux/街机侧的虚拟盘映射到 Windows 目录。它有三个关键路径，各自对应不同的盘符语义：

| 配置项 | 对应语义 | 里面应该有什么 |
| --- | --- | --- |
| `amfs` | `E:` 盘语义 | `ICF1`、`ICF2` 等 machine data |
| `option` | Option 数据 | `Axxx` 子目录（必须是目录，不是文件） |
| `appdata` | `Y:` 盘语义 | 游戏运行数据，**不是 Windows 的 `%APPDATA%`** |

几个必须记住的点：

- segatools 的示例注释明确写着 `amfs` 里应包含 `ICF1` 和 `ICF2`；缺文件或路径写错，启动阶段就会报 fatal。
- `option` 如果配置了但路径不存在，segatools 会直接 fatal；即使某个版本不需要 Option 数据，也建议建一个空目录并把路径指过去，避免路径漂移。
- `appdata` 可以在多台 SEGA 游戏之间共用，它和 Windows 用户目录没有半点关系。
- 路径尽量短、可写、避免空格和中文；`appdata` 需要持续可写。

一个整理好的 SDGB 目录可以长这样。`ICF1` 来自与这版游戏配套的机器数据，不由 `.app` 解包产生：

```text
D:\maimai\SDGB\
  Package\
    Sinmai.exe
    amdaemon.exe
    Sinmai_Data\
      Managed\
        Assembly-CSharp.dll
        AMDaemon.NET.dll
    config_common.json
    config_server.json
    config_client.json
    config_hook.json
    mai2.ini
    segatools.ini
    launch.bat
    amfs\
      ICF1
    option\
      A000\
      A005\
    appdata\
    Mods\
      AquaMai.dll
    MelonLoader\
    UserData\
  AppData\
  Option\
```

这里也有一个反直觉的点：`mai2hook` 内部某些 VFS 路径仍然使用 `SDEZ` 字符串作为内部目录名。**不要因为日志里看到 `SDEZ` 就立刻把它改成 `SDGB` 或重命名目录**，先对照原始 `Package` 和实际日志。

---

## 3. 解包：从 `.app` / `.opt` 到 `Package`

`.app` 和 `.opt` 是 SEGA 使用的 fscrypt 容器，普通解压软件打不开。目标是取出里面的 `Package` 目录，它才是完整游戏本体的来源。

### 3.1 fsdecrypt 的版本和能力

当前推荐 [beerpsi/fsdecrypt](https://gitea.tendokyu.moe/beerpsi/fsdecrypt)。它的两个版本值得记住：

- **`v0.1.8`**：开始支持在纯 Rust 里直接提取 NTFS（OS/APP）内容，不再需要管理员权限、Hyper-V 或 PowerShell；会自动检测并合并 delta `.app`；提取时会跳过 NTFS 的 8.3 短名别名，避免出现重复的 `NAME~1` 条目。
- **`v0.1.9`**：修复了处理含零字节文件的 exFAT OPTION 容器时会整体中断的问题。旧版本会报 `InvalidFileEntry(InvalidStreamExtension)`，原因是空文件本来就不占用 cluster，工具却把它当成异常。

Windows 发行包还附带 `install-context-menu.bat` / `uninstall-context-menu.bat`，可以给 `.app` / `.opt` 加一个右键“Unpack with fsdecrypt”，按用户安装、不需要管理员，在 Windows 11 上位于“显示更多选项”里。这个纯属方便，和流程正确性无关。

### 3.2 命令与增量链

基础包单独解：

```powershell
.\fsdecrypt.exe ".\SDGB_1.55.00_xxx_0.app"
```

基础包 + 增量包一起交给同一个进程：

```powershell
.\fsdecrypt.exe `
  ".\SDGB_1.55.00_xxx_0.app" `
  ".\SDGB_1.55.01_xxx_1_1.55.00.app"
```

Option：

```powershell
.\fsdecrypt.exe ".\SDGB_A000_xxx.opt"
```

增量链的关键在于：`.app` 的外层是 NTFS，里面放着 `internal_0.vhd`；增量包继续使用 `internal_1.vhd`、`internal_2.vhd` 这一串差分盘，后一层要和前一层连起来才是完整版本。fsdecrypt 会按 bootid 的序列号排序，再靠 VHD GUID 找父盘。

因此：

- **不要只拿最后一个增量包。** 缺一层就接不上。
- 链条中间缺文件时，工具会把接不上的增量报告为 orphan，而不是替你猜出缺失内容。
- 手工逐个运行时，先解基础包，再按版本递增处理增量包，不要把顺序倒过来。
- 手工 `Set-VHD -ParentPath` 建立 differencing VHD 属于旧流程；使用 `v0.1.8` 或更高版本时通常不需要，也不应把它当成主步骤。

### 3.3 解包结果验收

fsdecrypt 默认在输入文件旁边建立同名目录。验收标准很简单：

- APP 最终目录里应有完整的 `Package`；
- 中间 `.vhd` 会被工具合并处理掉；
- OPTION 输出常见 `option` 目录和 `DataConfig.xml` 一类清单文件；
- 把 `option` 的内容并入最终盘上的 `Option`，**不要把 `.opt` 的解包根目录直接覆盖到 `Package`**。

### 3.4 备选与旧流程

`unsegaREBORN` 也支持 APP/PACK、OPT、VHD 和 delta，`2026022400`（2026-02-24）修过 exFAT cluster 相关问题。用它的时候，同样以项目当前 README 和 release 为准，不要照抄几年前的旧结论。

旧流程里常见的 `ImDisk` 挂载 + `Set-VHD` 手工父子盘，现在更多是历史知识。工具已经能直接提取和合并时，继续手工挂载只会多一层出错机会。

---

## 4. segatools：版本策略与 `segatools.ini` 逐项

segatools 负责把游戏和虚拟硬件、网络、I/O 接起来。它的版本和配置字段是后面所有 Mod 的地基。

### 4.1 版本策略

| 目标 | 建议 |
| --- | --- |
| 追求当前稳定、匹配较新 SDEZ | 上游 release `2026-04-06` |
| 完全复刻旧教程 | `2025-11-04`，但要知道它不是最新 |
| 需要 maimai LED / 触摸 / VFD 新特性 | 至少 `2025-07-27`，优先 `2026-04-06` |
| SDGB 旧版 | 使用已验证的旧配置和 hook，不要因为“版本号更大”就盲目替换 |
| 需要 develop 分支新项 | 必须自行从源码构建并回归测试 |

几个 release 的差异值得单独记住：

- **`2025-07-27`**：加入实验性的 maimai DX LED 和触摸模拟；同时把 `start.bat` 改名为 `launch.bat`（所以很多老教程里还写 `start.bat`）。
- **`2026-04-06`**：补齐 maimai DX 的 LED 控制 API 和 PWN/fade 处理、相机 LED 控制；VFD 增加文本转发和状态回调；修了 maimai DX 的内存泄漏与高 CPU 占用。这些特性直接影响灯板、触摸和 VFD 能否正常工作。

### 4.2 `[vfs]`

```ini
[vfs]
amfs=D:\maimai\SDGB\Package\amfs
option=D:\maimai\SDGB\Package\option
appdata=D:\maimai\SDGB\Package\appdata
```

语义见第 2 节。路径写错是启动失败最常见的来源之一。

### 4.3 `[aime]` 读卡器

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enable` | `1` | 启用内置读卡器模拟；用真机读卡器时关掉 |
| `portNo` | 随游戏 | 真实读卡器使用的 COM 口 |
| `highBaud` | `1` | 波特率用 115200（而非 38400），部分游戏需要 |
| `gen` | `1` | 读卡器代际：`1` = TN32MSEC003S H/W Ver3.0、`2` = 837-15286/94、`3` = 837-15396/94 |
| `aimePath` | `DEVICE\aime.txt` | 经典 Aime 卡 ID 文本 |
| `aimeGen` | `1` | 文件不存在时是否生成随机 Aime ID |
| `felicaPath` | `DEVICE\felica.txt` | FeliCa e-cash 卡 IDm |
| `felicaGen` | `0` | FeliCa 文件缺失时是否随机生成 |
| `scan` | `0x0D` | 按住这个键就等同于刷卡靠近，默认回车 |
| `proxyFlag` | `2` | Thinca 认证卡代理标志，`2` 为无代理、`3` 为有代理 |
| `authdataPath` | `DEVICE\authdata.bin` | Thinca 认证卡数据 |

注意读卡器代际会影响 LED 信息：某些 e-money / Thinca 功能要求代际达到 `3`，不是所有模拟读卡器都支持。

### 4.4 `[aimeio]`

```ini
[aimeio]
; 自定义读卡器 DLL，留空则使用内置键盘模拟
path=
```

旧版本通过替换 `AIMEIO.DLL` 实现，现在功能已经集成进各 hook DLL，`path` 指向第三方驱动即可。

### 4.5 `[vfd]`

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enable` | `1` | 启用 VFD（GP1232A02A FUTABA）模拟 |
| `portNo` | 随游戏 | 真实 VFD 的 COM 口，maimai hook 常用 `2` |
| `utfConversion` | `0` | 把 VFD 文本转成 UTF，仅影响终端显示，不改游戏逻辑 |

### 4.6 `[dns]`

```ini
[dns]
default=<server-host-or-ip>
; replaceHost=0
```

`default` 只能填服务器域名或 IP。segatools 明确拒绝 `127.0.0.1`、`localhost` 这类本地地址。只有在明确需要时再考虑 `replaceHost`，它不是万能网络修复。

### 4.7 `[netenv]`

```ini
[netenv]
enable=1
addrSuffix=11
```

它会模拟一个理想 LAN 环境：本机在虚拟子网里的 IP 由 `keychip.subnet` 和 `addrSuffix` 推导，不需要把真实网卡 IP 填进游戏配置。文档也提醒它可能干扰 head-to-head 对战，所以 LAN 多机场景要单独验证。

### 4.8 `[keychip]`

```ini
[keychip]
id=<authorized-keychip-id>
gameId=SDEZ
platformId=ACA1
region=1
subnet=192.168.172.0
```

- `id` 只能填合法授权给该机台或测试实例的值。野外观察到的格式大致是 `A\d{2}(E|X)-(01|20)[ABCDU]\d{8}`，但**不要使用公网泄露的 keychip**。
- `gameId`：SDEZ 写 `SDEZ`，SDGB 的目标配置写 `SDGB`，最终以目标服务器要求为准。
- `platformId`：`ACA1` 是 ALLS 平台默认形式，不要随意改平台类型。
- `region`：文档明确 `1` = 日本、`4` = Export、`8` = 中国。
- `subnet`：如果关掉 `netenv`，必须设成你实际 LAN 的网段，且该网段必须以 `192.168.` 开头。

### 4.9 `[pcbid]`

```ini
[pcbid]
serialNo=<authorized-ALLS-MAIN-ID-without-hyphen>
```

这里填 ALLS MAIN ID，**去掉连字符**（连字符不是合法的 Windows 主机名字符）。同一 LAN 内必须唯一。

### 4.10 `[system]`

```ini
[system]
enable=1
freeplay=0
dipsw1=1
```

- `dipsw1`：同一 LAN 多机时，只有一台设为 `1`（Server），其余设 `0`。单机通常就是 `1`。
- `freeplay`：会关掉投币口；注意部分模式（如 Freedom/Time）不允许 freeplay 开局。

### 4.11 `[led15070]`

```ini
[led15070]
enable=1
; portNo1=
; portNo2=
; boardNumber=
; fwVer=
; fwSum=
```

`837-15070-04` 是控制机台和按键灯板的固件。旧 `837-15070-02` 灯板行为不同，需要额外的兼容选项或 AquaMai 模块，不能冒充新板。

### 4.12 `[unity]`

```ini
[unity]
enable=1
targetAssembly=
```

`targetAssembly` 可以指定一个在游戏前运行的 .NET DLL，常用于加载 Mod 框架。**这里和 MelonLoader 的注入路径可能冲突**：如果同时让 segatools 的 `targetAssembly` 和 MelonLoader 的 `version.dll` 注入，可能造成重复加载。一次只保留一种注入路径，先看日志再叠加。

### 4.13 输入：`[io4]`、`[button]`、`[touch]`

`[io4]` 是操作按钮：

```ini
[io4]
test=0x70      ; F1
service=0x71   ; F2
coin=0x72      ; F3
```

`[button]` 映射 8 个环形按钮和 Select。默认键位（顺时针）是：

- 1P：`WEDCXZAQ`，Select `3`
- 2P：小键盘 `89632147`，Select `*`

Select 被视为第 9 个按钮。键值可以写十进制，也可以写 `0x` 十六进制。

`[touch]` 同时承载两套概念：

- maimai 触摸串口模拟：`p1Enable` / `p2Enable`，以及 `p1DebugInput` / `p2DebugInput` 是否把键盘映射成触摸点；
- 触摸键名从 `p1TouchA1` 到 `p1TouchE8`，2P 对应 `p2TouchA1` 到 `p2TouchE8`；
- WinTouch 鼠标模拟是同 section 里的 `enable` / `remap` / `cursor`，和上面的串口触摸不是同一层。

使用真实触摸屏时，关掉 WinTouch 或调试键盘输入，避免双重输入。

### 4.14 `[mai2io]`

```ini
[mai2io]
path=
```

自定义 IO DLL 的路径。其 API 版本由 `mai2_io_get_api_version` 返回，当前最新为 `0x0102`（高字节主版本、低字节次版本）。`mai2io` 覆盖按钮、触摸和 LED，包括 billboard / camera light。触摸数据是 7 个字节，每字节低 5 位表示 A1 到 E8 的按压状态。自定义 DLL 要声明自己的 API 版本，并在初始化时返回正确值。

---

## 5. 启动链：`launch.bat` 与 `config_*.json`

上游 maimai 的 `launch.bat` 形式大致如下：

```bat
@echo off
pushd %~dp0

start "AM Daemon" /min inject -d -k mai2hook.dll amdaemon.exe -f -c config_common.json config_server.json config_client.json config_hook.json
inject -d -k mai2hook.dll sinmai -screen-fullscreen 0 -popupwindow -screen-width 2160 -screen-height 1920 -silent-crashes

taskkill /f /im amdaemon.exe > nul 2>&1
```

从这条命令能读出几件事：

- 先启动 `amdaemon.exe`，并把 `config_common.json`、`config_server.json`、`config_client.json`、`config_hook.json` 四个文件一起传给它。
- 再启动 `sinmai.exe`。`-popupwindow`、`-screen-width`、`-screen-height` 是示例值，不是兼容性要求，按实际显示布局改。
- 退出时杀掉 AM Daemon，避免残留进程。
- 调试时建议保留 `-f`（前台可见）并去掉 `-silent-crashes`，方便看错误。

四个 JSON 的职责：

| 文件 | 作用 |
| --- | --- |
| `config_common.json` | AM Daemon 通用配置，通常由匹配版本的合法游戏包提供 |
| `config_server.json` | 服务端角色配置 |
| `config_client.json` | 客户端角色配置 |
| `config_hook.json` | segatools 注入 hook 配置；官方 maimai 示例极小 |

上游 `config_hook.json` 的示例只有 allnet auth 类型：

```json
{
  "allnet_auth": {
    "type": "1.0"
  }
}
```

**不要往这个文件里放账号密码、keychip ID 或来源不明的证书。** 需要更改认证或网络行为时，先看目标服务器的配置规范。也不要从网络上抓一段来路不明的 `config_common.json` 覆盖合法包里的文件——优先使用与游戏版本一致的原始文件。

注意 `config_server.json` / `config_client.json` **不是 segatools 配置**，它们描述的是游戏/服务端角色。`[system] dipsw1` 要和角色一致：LAN 多机时只能有一台 Server，单机不要同时模拟多台 Server。

---

## 6. SDEZ / SDGB 差异总表

| 项目 | SDEZ | SDGB |
| --- | --- | --- |
| title ID | `SDEZ` | `SDGB` |
| `region` | `1`（Japan） | `8`（China） |
| `keychip.gameId` | `SDEZ` | `SDGB` |
| 默认平台 | `ACA1` | 通常同为 ALLS `ACA1` |
| DNS 域名 | `naominet.jp`、`*.sys-all.net` 等 | `*.sys-all.cn`、`*.sys-allnet.cn` 等 |
| 数据版本 | 更新较快 | 通常停留在旧数据线 |
| AquaMai | 当前 tag / CI 主要面向最新 SDEZ | 需要经 SDGB 版本验证的旧构建 |
| MelonLoader | 以 AquaMai README / 构建 tag 为准 | 可能需要更旧的 MelonLoader / Mono |
| Mercury | 无关 | 无关 |

DNS 部分值得说得更细。segatools 的 `dns.c` 里同时注册了日本和中国的域名族：

- SEGA / 日本：`naominet.jp`（startup）、`op.auth.sys-all.net`、`at.auth.sys-all.net`、`at.sys-all.net`、`ib.naominet.jp`（billing）、`aime.naominet.jp`（aimedb）。
- WAHLAP / 中国：`at.sys-all.cn`、`at.sys-allnet.cn`（startup）、`ai.sys-all.cn`、`ai.sys-allnet.cn`（aimedb）、`bl.sys-all.cn`、`bl.sys-allnet.cn`（billing）。

也就是说，当前 segatools 二进制本身包含通往中国服域名族的重定向入口。但这**不等于**只改 `[dns] default` 就完成了 SDGB 配置——还要一并检查 `gameId`、`region`、游戏数据版本、服务器期待值和 config 文件。

---

## 7. AquaMai：版本、构建与 SDGB 兼容边界

AquaMai 是目前最主流的 Sinmai mod 套件。它的安装方式在 `v1.7.5` README 里写得很短：

1. 构建项目，或找到一份现成构建；
2. 下载 `MelonLoader.x64.zip`（README 链接的是 `v0.7.0`）；
3. 解压到 `Sinmai.exe` 所在目录；
4. 建立 `Mods` 文件夹，把 `AquaMai.dll` 放进去；
5. 启动游戏。

构建时需要把目标游戏的 `Assembly-CSharp.dll` 和 `AMDaemon.NET.dll` 放进 `Libs`，装好 `.NET Framework 4.7.2 Developer Pack`，然后运行 `build.ps1`，产物在 `Output/AquaMai.dll`。

### 7.1 版本时间线

| 版本 | 日期 | 可核验事实 | 对 SDGB 的意义 |
| --- | --- | --- | --- |
| `v1.5.4` | tag 2025-08-19 | 公开 release 项；配置说明提到旧版 MelonLoader 与 0.6.4 兼容历史 | 最保守的旧稳定线 |
| `v1.6.0` | 2025-10-10 | 加入 1.60 支持与相关功能 | 面向更新 SDEZ |
| `v1.7.0` | 2025-11-13 | legacy version support commit `3cfcab0` 已在此前 | 旧版本支持被系统化门槛保护 |
| `v1.7.5` | 2025-12-26 | 包含 PR #99，PR 正文写明“测试于 SDGB151+EZ156+160” | 目前证据最强的 legacy 测试起点 |
| `v1.8.0` | 2026-03-19 | 引入 Evergreen / MuMod 自动更新 | 冻结旧版时必须防止被覆盖 |
| `v1.9.0` | 2026-08-28 | 最新正式 tag | 面向当前 SDEZ 线 |

### 7.2 `EnableGameVersion` 门槛

AquaMai 用 `ConstParameter.NowGameVersion` 和 `GameIDStr` 判断运行环境，`EnableGameVersionAttribute` 会在运行时按 min/max 门槛跳过整个类或方法。常见门槛和 SDGB 1.51（约 `25100`）的关系大致如下：

| 最低版本 | 代表模块 | SDGB 1.51 |
| --- | --- | --- |
| `23000` | 大多数新版补丁、部分 Unlock/UX | 可通过门槛，仍需实测 |
| `23500` | SelectionDetail 等 | 可通过门槛 |
| `24000` | 若干 Unlock 子功能 | 可通过门槛 |
| `25000` | FixLevelDisplay、部分 KALEIDX 逻辑 | 可通过门槛，语义需核对 |
| `25500` | DontRuinMyAccount、FixTrackNumDisplay、Hide1879、GrantFinalGateKey 等 | 会被跳过 |
| `26000` | FestaControl、部分 fade/Festa 逻辑 | 会被跳过 |
| `26500` | 新 packet 兼容、部分选曲排序字段 | 会被跳过 |
| `27000` | 面向 1.70 的设置项 | 会被跳过 |

**“被跳过”只表示模块不会加载，不代表剩下的代码就没有二进制兼容问题。** 这是很多人误判的地方。

### 7.3 为什么 SDGB 通常停在旧 AquaMai

把事实和推断分开说。

**已确认的事实：**

- AquaMai 的 CI 长期以 SDEZ 参考程序集构建，`v1.7.5` 的 workflow 直接复制 `build-assets/SDEZ/*` 到 `Libs`，没有看到 SDGB 构建矩阵。
- PR #114 记录 1.55 以上 `MovieController._moviePlayers` 类型发生变化；PR #126 提到 1.65；当前源码还有 1.70 阈值。新功能依赖不同的程序集结构，不是简单 UI 开关。
- Issue #88 用 SDEZ 1.56 DLL 构建时缺少 `FestaManager`，说明程序集不是向后兼容的构建参考。
- 公开的版本配置里只有通用 release / slow / ci，没有 SDGB 专属通道。

**合理推断：**

- 对 SDGB 最稳妥的历史线是 `v1.5.4` 的官方稳定构建，或 `v1.7.5` 这条包含 SDGB151 实测的 legacy 线。
- `1.8.x` / `1.9.x` 的新功能、协议和 MuMod 更新逻辑并不天然适配 SDGB 1.51。
- 更准确的说法不是“SDGB 只能用老版本”，而是：**SDGB 需要一个经过 SDGB 数据版本验证的构建，而不是版本号最高的 SDEZ 构建。**

**尚不确定：**

- PR #99 的 SDGB151 测试是否覆盖全部模块，还是只覆盖该 PR 新增部分，公开 PR 没有完整回归矩阵。
- 2026 年 9 月的实际 SDGB 数据版本是否仍为 1.51.x，必须用目标游戏实测。
- 某个 `1.9.x` 构建在关闭所有不兼容模块后能否稳定启动，缺少上游 SDGB CI 证据。

### 7.4 SDGB 自建 AquaMai 的流程

固定版本、固定提交，是这条路线的核心。

```powershell
git clone --branch v1.7.5 --depth 1 https://github.com/MuNET-OSS/AquaMai.git
Set-Location .\AquaMai
git rev-parse HEAD
```

`v1.7.5` 对应标签提交 `4919d4f060d6bae6e5e29792dd3c4da713a2db9d`。确认无误后，把目标 SDGB 的 `Assembly-CSharp.dll` 和 `AMDaemon.NET.dll` 放进 `Libs`：

```powershell
New-Item -ItemType Directory -Force .\Libs

Copy-Item `
  "D:\maimai\SDGB\Package\Sinmai_Data\Managed\Assembly-CSharp.dll" `
  .\Libs\

Copy-Item `
  "D:\maimai\SDGB\Package\Sinmai_Data\Managed\AMDaemon.NET.dll" `
  .\Libs\
```

如果构建提示缺其他程序集，回到同一个 `Managed` 目录补齐，并记录缺失类型。**不要把 SDEZ 的同名 DLL 混进来。**

```powershell
.\build.ps1
```

产物在 `Output\AquaMai.dll`。把它复制到 `Mods\AquaMai.dll`。

配置方面，AquaMai `v1.7.5` 使用配置版本 `2.4`。主配置缺失时，它**不会自动创建 `AquaMai.toml`**，只会在工作目录生成 `AquaMai.zh.toml` 和 `AquaMai.en.toml` 两个示例并停止加载配置。选一份复制或改名为 `AquaMai.toml`，确认 `Version = "2.4"` 后再启动。旧配置版本会留下 `AquaMai.toml.old-v{版本}` 备份并尝试迁移，迁移失败时不要继续手改半旧配置。

### 7.5 MuMod：冻结旧版时必须注意

`v1.8.0` 引入的 Evergreen / MuMod 会在启动早期从网络读取版本配置，下载并加载签名后的 AquaMai。对 SDGB 冻结旧版来说，这是直接的威胁：自动更新器可能把你已验证的 `v1.5.4` 或 `v1.7.5` 覆盖成最新 CI 构建。冻结旧 DLL 时，应同时记录哈希，并在每次启动前校验，不要让自动更新器接管这个目录。

---

## 8. SDEZ 路线一：MaiChartManager

这是四条路线里最省事的一条。MaiChartManager（MCM）把 MelonLoader、AquaMai、Mod 列表和配置编辑器放在一个界面里。对于只改 SDEZ 游戏设置的场景，没有必要自己搭 C# 工程。

本节基于 MCM `v26.5.1`。后续版本可能更换 MelonLoader 或改变签名策略，升级后要重新看界面提示。

### 8.1 安装前备份

复制整个游戏目录，至少备份：

```text
Package\Sinmai_Data\Managed
Package\Sinmai_Data\StreamingAssets
Package\Mods
Package\UserData
Package\AppData
Package\Option
Package\AquaMai.toml
Package\Sinmai-Assist
Package\launch.bat
Package\*.ini
Package\config_*.json
```

如果 HDD 上已经有 `Mods\AquaMai.dll`、旧版 `AquaMai.toml` 或其他加载器，先记录版本，不要直接覆盖。

MCM `v26.5.1` 打包的 MelonLoader 归档摘要为：

```text
ABF9FBF5F89AC89AE59D45E69CBDD32BB45E0B28BC6876392640409292FC9416
```

这个摘要在当时对应 `0.6.4.0`，只能用来确认文件是否一致，不能证明任意第三方文件安全。

### 8.2 在线安装与手动安装的边界

- **在线安装 / MuMod 缓存安装**：会校验 AquaMai 的 ECDSA 签名。签名不通过时不要绕过界面提示。
- **手动安装自建 DLL**：MCM 会检查 PE 文件、.NET 目标和程序集里的 `ProductName`，不会因为 DLL 没有有效签名就直接拒绝。界面会显示红色证书警告，但仍然允许确认。
- **配置读取是另一套逻辑**：MCM 默认拒绝签名无效的配置；要管理自建 AquaMai 的配置，需要在界面里打开跳过签名检查（对应 `skipSignatureCheck`）。

能力边界整理成表：

| 能力 | 在线安装 | 手动安装自建 DLL |
| --- | --- | --- |
| 安装 DLL | 需要有效签名 | 可以安装未签名 DLL |
| 安装时证书提示 | 正常校验 | 显示红色警告 |
| 编辑 AquaMai 配置 | 支持 | 默认拒绝无效签名，可选跳过检查 |
| MuMod 自动更新 | 支持有效签名包 | 不适合未签名自建包 |

MCM `v26.5.1` 的配置编辑器支持 AquaMai 配置 API `1.1`，而 AquaMai `v1.7.5` 也使用 API `1.1`，所以两者在配置模型上能对上。但配置 API 匹配不等于所有选项都能在任意游戏版本工作。

### 8.3 推荐的 SDEZ 配置顺序

1. 只安装 MelonLoader。
2. 确认游戏能启动到正常界面。
3. 安装 AquaMai，但先不要导入旧配置。
4. 在 MCM 中打开配置编辑器并保存一次，确认主配置写入成功。
5. 再修改少量设置，每轮只改一到三类参数。
6. 每次记录 DLL 版本、配置版本和改动内容。

只要出现下面情况，就停止继续加功能：游戏无法进入主界面、MelonLoader 日志没有列出 AquaMai、AquaMai 日志提示配置版本错误、MCM 能编辑但游戏一启动就崩、输入配置修改后出现持续按键。这时先回到“只有 MelonLoader 和 AquaMai 的最小组合”。

---

## 9. Sinmai-Assist：源码现实、风险与适配

Sinmai-Assist 是另一套面向 `Sinmai.exe` 的 MelonLoader mod。它的 README 自己写着 `This is a cheat Mod, using by your own risk.`，功能里包含大量解锁、AutoPlay、FastSkip 和 ChartController。它**不是**启动器，也不负责 HDD 解密、密钥注入或联机服务器，只在游戏被正确启动后修改运行中的托管方法。

### 9.1 许可证与发布状态

- 仓库完整 tree 中没有 `LICENSE`、`COPYING` 或 `NOTICE`。公开仓库不等于已获得明确的复制、修改、再发布授权，默认按“保留所有权利、未额外授权”处理更稳妥。
- 没有 tag，也没有 Release。没有“下载最新 Release 即可”的官方路径。
- 没有发现自动更新器或自动下载后续 DLL 的逻辑。

### 9.2 依赖与加载器

| 依赖 | 版本 / 用途 |
| --- | --- |
| MelonLoader | README 要求 `0.6.4` 或更低，更高版本会崩溃；csproj 也引用 0.6.4 |
| Harmony | `0Harmony 2.10.1.0`，所有 patch 的核心 |
| .NET Framework | 目标 `v4.7.2` |
| YamlDotNet | `16.1.0`，读取 `Config.yml` / `KeyBindConfig.yml` |
| EmbedIO / Swan.Lite | `3.5.2` / `3.1.0` |
| ChimeLib.NET | 可选依赖；SDGB 的 `DummyChimeLogin` 会直接使用它 |

这里有一个和 AquaMai 直接冲突的点：AquaMai 当前 README 指向 MelonLoader `0.7.0`，而 Sinmai-Assist 明确警告高于 `0.6.4` 会崩溃。两者都要用时，只能选一个两边都声明兼容的加载器版本，不能凭“都是 MelonLoader 插件”就认定能共存。

### 9.3 目录结构与配置文件

Mod 初始化时会创建并维护：

```text
<游戏根目录>/
├─ Sinmai.exe
├─ Mods/
│  └─ Sinmai-Assist.dll
└─ Sinmai-Assist/
   ├─ Config.yml              # 首次运行自动生成
   ├─ KeyBindConfig.yml       # 首次运行自动生成
   ├─ Unity.log               # 每次启动清空/重建
   ├─ WebCameraList.txt       # 每次启动重建
   ├─ NetworkLogs/
   │  └─ YYYY-MM-DD.log
   ├─ UserData/
   │  └─ User<ID>.txt
   └─ UserBackup/
      └─ User<ID>-<timestamp>.json
```

`Config.yml` 使用 YAML，命名约定是 camelCase。加载逻辑：

- 文件不存在：用 `MainConfig` 默认值生成配置。
- YAML 无效：记录错误、提示删除配置后重启，并停止后续初始化。
- 字段不属于目标类：可能报 `Property '...' not found`。
- 保存时会重新序列化，原 YAML 注释通常不会可靠保留。

仓库里的 `Config.yml` 是易过期示例，CI 打包也只复制 DLL 和 README，不复制它。**第一次运行应让 DLL 自己生成默认配置，不要直接复制仓库示例或别人的旧配置。**

### 9.4 默认值、无条件加载与隐私风险

当前源码里几个非 false 的主要默认值：

| 配置 | 默认值 | 影响 |
| --- | --- | --- |
| `common.showFPS` | `true` | 默认显示 FPS |
| `common.unityLogger.enable` | `true` | 写 `Sinmai-Assist/Unity.log` |
| `common.unityLogger.printToConsole` | `true` | Unity 日志也输出到控制台 |
| `common.networkLogger.enable` | `true` | 默认把网络请求/响应写到 `NetworkLogs` |
| `fix.disableEnvironmentCheck` | `true` | 1.50 以上的环境检查处理 |
| `fix.disableReboot` | `true` | 避免自动重启流程 |
| `fix.disableIniClear` | `true` | 避免清空 INI |
| `fix.fixDebugInput` | `true` | 修复调试输入 |
| `fix.skipSpecialNumCheck` | `true` | `CalcSpecialNum` 固定为 1024 |
| `modSetting.showInfo` / `showPanel` | `true` | 默认显示版本信息和 Mod 面板 |
| `modSetting.maskTitleServerUrl` | `true` | GUI 中遮蔽标题服务器 URL |

**更需要注意的，是三个在 `Main.cs` 末尾无条件加载、配置里关不掉的 patch：**

```csharp
Patch(typeof(PrintUserData));
Patch(typeof(InputManager));
Patch(typeof(GameMessageManager));
```

其中 `PrintUserData` 会在进入选曲流程时，把用户信息写到：

```text
Sinmai-Assist/UserData/User<ID>.txt
```

它包含 `AccessCode`、`AuthKey` 等可识别信息。`NetworkLogger` 虽然能关，但源码默认开启并落盘，启用时也可能记录账号和网络数据。**不要把整个 `Sinmai-Assist` 目录、`NetworkLogs` 或用户数据上传到公开 Issue。** 如果不能接受明文凭据落盘，最稳妥的做法是不要在这台机器上加载它，或自行审查并重建一个移除了该无条件 patch 的版本。

### 9.5 快捷键默认值

`KeyBindConfig.yml` 首次运行自动生成，默认值：

| 模块 | 键 | 默认值 |
| --- | --- | --- |
| AutoPlay | None | `N` |
| AutoPlay | Critical | `F` |
| AutoPlay | Perfect | `None` |
| AutoPlay | Great | `O` |
| AutoPlay | Good | `P` |
| AutoPlay | Random | `K` |
| AutoPlay | RandomAllPerfect | `G` |
| AutoPlay | RandomFullComboPlus | `H` |
| AutoPlay | RandomFullCombo | `J` |
| ChartController | Pause | `Enter` |
| ChartController | Forward | `RightArrow` |
| ChartController | Backward | `LeftArrow` |
| ChartController | SetRecord | `DownArrow` |
| ChartController | ReturnRecord | `UpArrow` |
| SinmaiAssist | ShowUserPanel | `Backspace` |

### 9.6 与 AquaMai 的 patch 重叠

两套 Mod 都是 MelonLoader + Harmony，作用于同一个 `Sinmai.exe`，因此大量 patch 目标重叠。**两边都能加载不代表两边都应该打开。**

| 目标方法 / 类型 | Sinmai-Assist | AquaMai | 判断 |
| --- | --- | --- | --- |
| `Packet.Obfuscator(string)` | `DisableEncryption` | `RemoveEncryption` | 直接重复，只保留一边 |
| `Net.CipherAES.Encrypt/Decrypt` | 动态 patch | 动态 patch | 直接重复 |
| `OperationManager.CheckAuth_Proc` | `FixCheckAuth` | `FixCheckAuth`（功能更全） | 直接重复 |
| `NetHttpClient` 构造函数 | `SkipCakeHashCheck` | Cake 检查 | 两边都设 `isTrueDll=true` |
| `NetHttpClient.Create` | `RestoreCertificateValidation` | 同类处理 | 直接重复 |
| `GameManager.CalcSpecialNum` | postfix 设 1024 | prefix 设 1024 | 结果相同，不应同时开 |
| `Network.IsLanAvailable` | `ForceAsServer` | `ForceAsServer` | 直接重复 |
| `CameraManager.CameraInitialize` | `CustomCameraId` | `CustomCameraId` | 高风险重复 |
| `Packet.ProcImpl` | NetworkLogger / 认证 | NetPacketHook / FixCheckAuth | 网络请求被两套 hook 处理，顺序不保证 |
| `ResultProcess.OnStart` | `ForceCurrentIsBest` | 立即保存、防毁账号等 | 可能同时改写结算状态 |
| Slide / AutoPlay 修复 | AutoPlay | `FixSlideAutoPlay` | Issue #9 实测冲突 |

推荐共存策略：

1. 先固定加载器版本和一个明确匹配的 AquaMai 构建。
2. 先只放 AquaMai，确认游戏能启动。
3. 再放 Sinmai-Assist，`safeMode: true` 只验证注入。
4. 关闭 Sinmai-Assist 的重复网络 patch：`disableEncryption`、`fixCheckAuth`、`skipCakeHashCheck`、`restoreCertificateValidation`、`forceAsServer`。
5. 只在一侧启用 `CustomCameraId`。
6. 只在一侧启用 AutoPlay / Slide 修复；先关掉 AquaMai `FixSlideAutoPlay`，再测 Sinmai-Assist AutoPlay。
7. 每加一组功能就重启并检查两边的日志。

### 9.7 SDEZ 适配：为什么原项目不能直接用

问题在编译期，而不是运行期。

- `Sinmai-Assist.csproj` 会**无条件**编译 `Common\DummyChimeLogin.cs`，也会无条件引用 `Libs\ChimeLib.NET.dll`。即使 `Main.cs` 只在 `GameID == "SDGB"` 时走 `DummyChimeLogin`，编译器仍然会解析这个类型，SDEZ 会因 ChimeLib 缺失或类型不匹配而失败。
- `Common\CustomCameraId.cs` 里，`SetCameraResolution` 只在 `GameID != "SDEZ"` 时初始化 `_qrCameraParam`，后面的 SDEZ 分支却读取 `_qrCameraParam.Width`、`.Height` 和 `.Fps`，开启 `CustomCameraId` 后会空引用。

SDEZ 适配步骤：

1. 从 `Sinmai-Assist.csproj` 删除或条件排除 `Common\DummyChimeLogin.cs`。
2. 从项目引用中删除或条件排除 `Libs\ChimeLib.NET.dll`。
3. 保留 `Common\DummyAimeLogin.cs` 和 `Common\CustomCameraId.cs`。
4. 修改 `Main.cs`，让 SDEZ 直接使用 `DummyAimeLogin`，并确保代码里不再出现 `DummyChimeLogin`。
5. 从 SDEZ 游戏目录复制完整的 `Sinmai_Data\Managed` 到项目 `Libs`，不要只放 `Assembly-CSharp.dll`。

SDEZ 的登录分支可以写成：

```csharp
if (File.Exists("DEVICE/aime.txt"))
{
    DummyLoginPanel.DummyLoginCode =
        File.ReadAllText("DEVICE/aime.txt").Trim();
}

Patch(typeof(DummyAimeLogin));
```

摄像头空引用的修复，是把 `SetCameraResolution` 里原来的 `if (SinmaiAssist.GameID != "SDEZ")` 整块替换为同时覆盖 SDGB 和 SDEZ 的逻辑：

```csharp
if (SinmaiAssist.GameID is "SDGB" or "SDEZ")
{
    int qrId = SinmaiAssist.GameID == "SDGB"
        ? SinmaiAssist.MainConfig.Common.CustomCameraId.ChimeCameraId
        : SinmaiAssist.MainConfig.Common.CustomCameraId.LeftQrCameraId;

    WebCamDevice qrDevice = WebCamTexture.devices[qrId];
    WebCamTexture qrTexture = new WebCamTexture(qrDevice.name);
    qrTexture.Play();
    _qrCameraParam = new CameraParameter(
        qrTexture.width,
        qrTexture.height,
        (int)qrTexture.requestedFPS
    );
    AccessTools.Field(typeof(CameraManager), "QrCameraParam")
        .SetValue(__instance, _qrCameraParam);
    qrTexture.Stop();
}
```

第一轮如果不想处理摄像头，可以在生成的配置里关闭 `CustomCameraId.Enable`，先完成登录和构建验证；这不会修掉空引用缺陷，只是不让对应 patch 执行。

构建用 Visual Studio，或在 Developer Command Prompt / PowerShell 中运行：

```powershell
msbuild .\Sinmai-Assist.sln /restore /p:Configuration=Release
```

`BeforeBuild.bat` 会把版本字段写到 `..\BuildInfo.cs`，但项目实际编译仓库根目录的 `BuildInfo.cs`，路径没有对上；构建前要修正，或手动更新根目录文件。`PostBuild.bat` 只打印提交哈希和时间，不会把 DLL 复制到游戏目录。Release 输出在 `Output\Sinmai-Assist.dll`。

### 9.8 SDGB 路线

SDGB 比 SDEZ 直接：项目原本就保留了 `ChimeLib.NET`、`DummyChimeLogin.cs` 和 SDGB 分支，不需要把国服登录逻辑拆掉。

- 目标同样是 `net472`，MelonLoader 包 `0.6.4`，Harmony `2.10.1`。
- 把 SDGB 的 `Sinmai_Data\Managed` 相关引用放入 `Libs`，第一轮不要删除 `ChimeLib.NET.dll`。
- 仓库没有顶层 `build.ps1`，用 Visual Studio 或 MSBuild 构建。
- 同样存在 `BeforeBuild.bat` 路径不一致、`PostBuild.bat` 不复制 DLL 的问题。

安装前先备份 `Mods\Sinmai-Assist.dll`、`Sinmai-Assist\Config.yml`、`KeyBindConfig.yml`、`UserData` 和 `NetworkLogs`。第一次启动让程序生成新配置，先开安全模式：

```yaml
safeMode: true
```

日志能确认加载、配置能读到时，再关闭安全模式，一次只打开一个功能。尤其不要同时启用自动打歌、Cake hash 处理、特殊数字处理、证书处理和结果保存。

### 9.9 版本相关 issue / PR

Sinmai-Assist 没有正式版本矩阵，很多兼容性是靠 issue 报告拼出来的：

| 来源 | 内容 | 结论 |
| --- | --- | --- |
| Issue #18 | SDGB 1.51，旧 `logUnity` 配置导致 Sinmai-Assist 与 AquaMai 一起崩溃 | 应删除旧配置让 Mod 重新生成 |
| Issue #19 | SDGB 1.53 编译缺 `UserLogoutRequestVO.dateTime` | 1.53 API 改动导致旧登出功能不可用 |
| PR #21 | 移除失效的 SDGB 虚拟用户登出界面 | 主分支已移除登出功能 |
| PR #22 / `cc23478` | 修复 1.60+ note 类型获取，恢复 FastSkip-Custom | 已合并 |
| Issue #23 | SDEZ 1.66 FastSkip Custom 101% 时 Miss 数量异常 | master 上仍是风险 |
| PR #25 / `60f54b5` | 修复 FastSkip 101% 的 Miss 数量，2026-06-13 | **未合并到 master** |
| Issue #26 | SDGB 1.55 + ML 0.6.4 + AquaMai + Sinmai-Assist 共存 | 共存案例存在，非正式兼容声明 |
| Issue #9 | AquaMai `FixSlideAutoPlay` 与 Sinmai-Assist AutoPlay 冲突 | 已实测 |
| Issue #13 | 两边同时开 `CustomCameraId` 出现异常 | 不建议同时启用 |

另外，CI 依赖 GitHub Secret 里的私有 `LIBRARY_URL` 来下载游戏库，**外部贡献者没有匹配库就无法独立复现构建**。私有库到底对应哪个区域和版本，无法从公开信息确认；Action artifact 也不是永久 Release。

### 9.10 卸载与回滚

卸载：关闭 `Sinmai.exe` → 删除 `Mods/Sinmai-Assist.dll` → 需要时备份后删除 `Sinmai-Assist/` 文件夹 → 检查 `MelonLoader/Latest.log` 有无残留错误。

回滚必须依赖自己保存的二进制和 commit，建议按提交存档：

```text
backup/
└─ Sinmai-Assist/
   ├─ ad5cdbe/
   │  ├─ Sinmai-Assist.dll
   │  ├─ Config.yml
   │  └─ metadata.txt
   └─ known-good/
```

`metadata.txt` 至少记录：DLL SHA-256、Git commit、游戏版本、GameID、MelonLoader 版本、库来源、已验证功能。

---

## 10. 启动与验证清单

标准启动顺序：

1. 确认没有旧的 `amdaemon.exe` / `Sinmai.exe` 残留。
2. 先启动 AM Daemon，确认窗口出现并打印 VFS / DNS / keychip 信息。
3. 再启动 `Sinmai.exe`。
4. 退出后确认 `amdaemon.exe` 被结束。

每次换 DLL 或配置时，至少验证：

- AM Daemon 控制台没有 `Vfs: FATAL`。
- VFS 日志中的 `amfs`、`option`、`appdata` 指向预期目录。
- DNS 日志中的服务域名被重写到目标服务器。
- keychip 的 game ID、region、platform ID 与本机 / 服务器一致。
- 读卡器能读卡，键盘 scan 键按住时有响应。
- 按键、触摸、VFD、LED 都通过 Test Mode 或游戏内自检。
- `MelonLoader/Latest.log` 中有加载 AquaMai 的记录。
- 若启用 Sinmai-Assist，`Latest.log` 出现 `GameInfo`、`Config Load Complete`，`Unity.log` 在本次启动时新建。
- 首局登录、游玩、保存、退出、再次登录均成功。
- 退出后没有残留进程。

排障时可以先判断故障停在哪一层：

| 停在哪一层 | 本次启动应该留下什么 | 第一处检查 | 不能继续的信号 |
| --- | --- | --- | --- |
| 解包 | 最终目录有 `Package`，OPTION 有清单 | fsdecrypt 控制台输出 | 报 orphan、没有 base、内部 VHD 提取失败 |
| 认证和启动 | `amdaemon` 稳定运行并拉起 Sinmai | `launch.bat`、两个 INI、四个 JSON | `amdaemon` 刚出现就退出 |
| MelonLoader | `MelonLoader/Latest.log` 本次更新 | 日志修改时间和启动段 | 没有日志，或日志是上次的 |
| AquaMai | 日志进入配置加载和 patch 阶段 | `Latest.log`、错误报告 | 找不到主配置、配置解析失败、重复 patch |
| Sinmai-Assist | `Latest.log` 出现 `GameInfo`、`Config Load Complete` | `Latest.log`、`Unity.log`、`Config.yml` | 初始化失败、安全模式前崩溃 |
| 两 Mod 共存 | 每类行为只有一个负责人 | 两边配置和日志 | 两边同时开登录、AutoPlay、摄像头或结算 |

---

## 11. 常见故障排查

### 11.1 解包阶段

| 报错 / 现象 | 原因与处理 |
| --- | --- |
| `WARNING: No base (seq=0) found` | 目录里没有基础 `.app`，也没有已解出的 base VHD。把基础包和从它到目标版本的全部增量包放进同一目录 |
| 输出里出现 `orphan` / 缺少父 VHD | 增量链没接上。按文件名版本顺序补齐所有中间增量包，不要只拿最后一个 |
| `Failed to extract internal VHD` | 看后面的底层错误。常见是链条接错、文件损坏或把别的容器改成了 `.vhd` |
| `No NTFS partition found in VHD` | 拿到的不是工具能识别的游戏 VHD |
| `Unsupported VHD type` / `Invalid dynamic VHD header` | 文件本身不受支持或已损坏，换回同一版本的原始文件 |
| `Failed to extract exfat contents` | 常见于旧版 fsdecrypt 处理含零字节文件的 OPTION。换 `v0.1.9`，重新解原始 `.opt` |

### 11.2 `amdaemon` 一闪就没了

先在游戏根目录用 `cmd.exe /k .\launch.bat` 保留窗口，看它是主动退出还是根本没找到要启动的程序。然后依次检查：工作目录是否是 `Package` 根目录、四个 `config_*.json` 是否都在、`[vfs]` 三个路径是否存在、VC++ 运行库是否完整、是否错误地把 `mercuryhook.dll` 或 WACCA 配置用于 maimai。

如果换成纯原始启动器和原始游戏目录仍然失败，把 Mod 全部放到一边。本文不提供 keychip 或授权绕过方案，这一层需要先确认手里的硬件和数据完整。

历史上有过一个 `amSysFileInitEx(). ErrCode -5` 的已知问题，来源于早期 segatools 在没有真实 `E:` 盘时的行为，`2024-02-27` release 已专门修复。如果仍出现，说明 hook 过旧或 VFS 没正确初始化。

### 11.3 MelonLoader 阶段没有日志

先看 `MelonLoader\Latest.log` 的修改时间——旧日志存在不代表这次加载成功。把 `Mods` 整体移走，只保留 MelonLoader，再启动一次。如果游戏能到界面且日志更新，说明 Loader 和游戏本体至少能一起工作。

如果移除全部 Mod 后依然黑屏且没有新日志，问题在 Loader 之前的启动层或运行环境。回调原始程序和 `launch.bat`，确认 VC++ 运行库、.NET Framework、显卡驱动和杀毒隔离记录，再重装与当前包配套的 MelonLoader，不要覆盖混装。

### 11.4 AquaMai

- `AquaMai.toml not found! Please create it.`：主配置缺失。选一份生成的 `AquaMai.en.toml` / `AquaMai.zh.toml` 整理成 `AquaMai.toml`，确认 `Version = "2.4"` 再启动。
- 旧配置版本：会留下 `AquaMai.toml.old-v{版本}` 备份并尝试迁移；迁移失败时，从新示例重新整理，再把真正需要的选项搬过去。
- `Patch: {type} failed.` + `Failed to patch some methods.`：DLL 已加载但目标方法没打上补丁。移走其他 Mod，确认 `Assembly-CSharp.dll` 是目标区服和目标版本的原文件，再检查是否有超出该版本支持范围的选项。
- 模块被 `EnableGameVersion` 跳过：这不是加载失败，而是预期剔除。

### 11.5 Sinmai-Assist

- `Load Config ... Failed`：YAML 损坏。关掉游戏，把 `Sinmai-Assist\Config.yml` 改名备份，让 DLL 重新生成。不要一边保留坏 YAML，一边反复开安全模式。
- `Error initializing mod config`：看 `Unity.log` 同一时间段的完整异常，确认是配置损坏、权限问题还是程序集不匹配。
- `Safe mode is enabled, Disable all patch`：正常，说明安全模式按预期返回。
- `Property 'logUnity' not found`：用了旧配置字段，删除配置重新生成。
- `Failed to patch some methods`：游戏 DLL 不匹配、已修改、版本过低或功能冲突。

### 11.6 黑屏，但 AM Daemon 存在

按启动链逐层恢复，每层只增加一个变量：

1. 把整个 `Mods` 目录改名为 `Mods.off` 重启。能进界面就继续；仍然黑屏，回到认证和启动层。
2. 恢复空 `Mods`，只保留 MelonLoader，确认日志本次更新。
3. 只放 `AquaMai.dll`，按日志整理主配置，确认能进界面。
4. 再加 `Sinmai-Assist.dll`，保持 `safeMode: true`，确认 `GameInfo`、`Config Load Complete` 和 `Unity.log`。
5. 最后关闭安全模式并逐项启用功能，登录、Cake hash、SpecialNum、证书、摄像头、AutoPlay、结果保存不要两套同时开。

如果原始游戏在黑屏前完全没有窗口，重点看 `amdaemon`、VFS、ICF 和启动脚本；如果出现窗口或厂商标志后才黑屏，重点看 `Latest.log`、错误报告和 `Unity.log`。

### 11.7 网络 / 登录失败

1. 确认 `[dns] default` 不是 `127.0.0.1` 或 `localhost`。
2. 确认服务器域名 / IP 可被主机解析和访问。
3. SDEZ 检查 `*.sys-all.net`、`naominet.jp`；SDGB 检查 WAHLAP `*.sys-all.cn`、`*.sys-allnet.cn` 是否被 hook 到同一目标。
4. 只有明确需要时才设 `replaceHost=1`。
5. 检查 keychip game ID、region、PCID 是否与服务器一致。

### 11.8 多机 LAN / 对战失败

确认所有机台 `pcbid.serialNo` 唯一；确认 `dipsw1` 只有一台是 Server；注意 `[netenv]` 会虚拟化 LAN、可能干扰 head-to-head；必要时按 segatools 文档使用 `redirectBroadcast` / `broadcast`，先记录实际网段。

### 11.9 读卡器 / 触摸 / 按键 / VFD / LED

- 读卡器：确认 `[aime] enable` 对应“模拟 / 真实”选择，`aimePath` 可写，`scan` 键按住，自定义 `aimeio.dll` 位数和 API 匹配；e-money 功能需要代际和额外数据。
- 触摸：先分清是 WinTouch 鼠标模拟还是 maimai 串口触摸，检查 `p1Enable` / `p2Enable`、`p1DebugInput` / `p2DebugInput`、`p1TouchA1..E8`；真实触摸屏要关掉重复输入。
- 按键：检查 `[io4] test/service/coin` 与 `[button] p1Btn1..9` / `p2Btn1..9`，键值十进制或 `0x` 十六进制，自定义 IO 与内置 IO 不要同时启用。
- VFD：确认 `[vfd] enable=1` 和 `portNo`，终端乱码先试 `utfConversion=1`；自定义 aimeio 要提供状态 / 文本回调。
- LED：确认 `[led15070] enable=1` 和端口 / 板号 / 固件版本；旧 `837-15070-02` 灯板不要冒充新板；确认 `mai2io` API 版本至少支持所需 LED 功能。

### 11.10 构建成功但游戏启动即崩

先把 Mod 移出 `Mods` 确认原始游戏正常，再放回单个 DLL 看日志；检查两个 Mod 是否 patch 了同一区域；检查配置是否来自另一个版本；检查 MelonLoader 是否高于项目要求。编译成功只说明引用解析和 C# 编译通过，不说明运行时 patch 一定成功。

---

## 12. 许可证、游戏数据与凭据边界

### 12.1 开源工具

| 项目 | 许可证 / 状态 |
| --- | --- |
| segatools | Unlicense（只覆盖该仓库代码 / 发行物） |
| fsdecrypt | 0BSD（只覆盖解密 / 提取工具） |
| unsegaREBORN | Unlicense |
| AquaMai | Apache-2.0 |
| MelonLoader | Apache-2.0 |
| Sinmai-Assist | 未找到明确许可证，默认按“保留所有权利”处理 |

开源工具不会因为你成功解密或本地运行，就授予你复制、公开分发、出售或在线上运营游戏内容的权利。

### 12.2 游戏内容与凭据

`.app`、`.opt`、VHD、ICF、`Sinmai.exe`、`amdaemon.exe`、Unity 资源、乐谱、曲绘、音频、视频、加密 key、校验数据和服务器证书，通常属于 SEGA / Wahlap 的程序或数据资产。

`keychip.id`、`pcbid.serialNo`、服务器证书、token、账号密码不是教程应公开传播的“示例配置”。不要使用泄露的 keychip、PCB ID 或生产服务器凭据；本地测试也要用测试服务器明确允许的值。本文只说明字段含义，不提供绕过授权、伪造身份或接入非授权服务的方法。

### 12.3 成绩注入 / 作弊

社区存在包含“把自定义成绩附加到上传队列”功能的 SDGB fork。这既不属于 HDD 启动配置，也会伪造成绩、破坏排行榜和账号数据，可能违反服务器规则，不应作为 AquaMai 兼容性结论的依据。

---

## 13. 来源与核验边界

本文完成于 2026-09-21。下列工具和项目都在持续变化，版本、签名、配置 API 和构建入口以你实际使用的提交为准。

### 13.1 解包

- [fsdecrypt](https://gitea.tendokyu.moe/beerpsi/fsdecrypt)：`v0.1.8` 加入纯 Rust NTFS 提取与 delta 自动合并，`v0.1.9` 修复 exFAT OPTION 零字节文件。
- [unsegaREBORN](https://github.com/proeren2002/unsegaREBORN)：APP/PACK、OPT、VHD、delta；`2026022400` 修 exFAT cluster。

### 13.2 segatools

- [segatools](https://gitea.tendokyu.moe/TeamTofuShop/segatools)：`2025-07-27` 加入实验性 maimai LED / 触摸并改名 `launch.bat`；`2026-04-06` 补齐 LED API、PWN/fade、相机 LED、VFD 转发和内存泄漏修复。
- 示例配置：`dist/mai2/segatools.ini`、`dist/mai2/launch.bat`、`dist/mai2/config_hook.json`；通用配置文档 `doc/config/common.md`；DNS 域名见 `common/platform/dns.c`。

本次核对过的官方工具哈希（仅用于识别文件，不代表来源可信）：

```text
segatools-2026-04-06.zip
SHA-256 fdb325e927c29bcfea5aa7b604cc073acd266a24cd92581064f2b4eda7348589

fsdecrypt-0.1.9-x86_64-pc-windows-msvc.zip
SHA-256 d9857bc09b497f4f491cf838b6ab70a5d6bf830b09dcc243643fbec4faffa2eb

AquaMai 1.5.4 DLL
SHA-256 e738d327bd28f9445d2da27dc751da941b7d6c141df82c3604858d9b6cb155c2
```

### 13.3 AquaMai

- [仓库](https://github.com/MuNET-OSS/AquaMai) / [v1.7.5](https://github.com/MuNET-OSS/AquaMai/tree/v1.7.5) / [v1.5.4](https://github.com/MuNET-OSS/AquaMai/tree/v1.5.4)
- PR #99（SDGB151+EZ156+160 实测）、PR #114（1.55 `MovieController._moviePlayers`）、PR #126（1.65 fade/Festa）、Issue #88（SDEZ 1.56 缺 `FestaManager`）
- legacy support commit `3cfcab0`；MuMod 说明与公开版本配置

### 13.4 Sinmai-Assist

- [仓库](https://github.com/WYH2004-MC/Sinmai-Assist)，快照提交 `ad5cdbe7365f79e2b21991f38e007682162a1787`
- 关键文件：`Main.cs`、`Sinmai-Assist.csproj`、`DummyChimeLogin.cs`、`DummyAimeLogin.cs`、`CustomCameraId.cs`、`ConfigManager.cs`、CI `main.yml`
- Issue：`#9`（Slide 冲突）、`#13`（Camera 冲突）、`#18`（SDGB 1.51 配置）、`#19`（SDGB 1.53 logout）、`#23`（FastSkip 101%）、`#26`（SDGB 1.55 共存）
- PR：`#21`（移除登出）、`#22`/`cc23478`（1.60+ FastSkip）、`#25`（FastSkip 修复，未合并）

### 13.5 待现场确认的开放问题

1. 目标 SDGB 的 `ConstParameter.NowGameVersion` 精确值。
2. `GameIDStr` 是否严格为 `SDGB`。
3. 目标服务器是否要求 `gameId=SDGB`、`region=8`，以及是否接受其他 platform ID。
4. 目标包是完整 `.app` 还是 base+delta，`.opt` 是否必须。
5. 目标 SDGB 实际能加载的是 `v1.5.4` 还是 `v1.7.5`。
6. SDGB 1.51 是否支持目标服务器要求的全部登录、卡片、保存和网络协议。
7. 目标网络能否访问服务器，是否需要 `replaceHost`。
8. 旧灯板 / 触摸 / 读卡器是否需要自定义 `mai2io.dll` 或 `aimeio.dll`。
9. 当前服务端版本是否已经超出 `SDGB151`，对应数据是否变化。

只要这些问题没有现场验证，就不应把“能用”写成全功能兼容。

## 最后

四条路线的最终做法，可以压缩成一句话：**先固定一组版本，再逐层验证，最后才加功能。**

1. **SDEZ + MCM + AquaMai**：用 MCM 装 MelonLoader 和签名有效的 AquaMai，在编辑器里保存并调整 `AquaMai.toml`，先把单 Mod 跑到主界面。
2. **SDEZ + 自建 Sinmai-Assist**：固定提交，移除 SDGB 专用文件和 `ChimeLib.NET.dll` 引用，用 SDEZ 的 `Managed` 构建，先跑 `safeMode: true`。
3. **SDGB + 自建 AquaMai**：从标签提交构建，把 SDGB 的 `Assembly-CSharp.dll` 和 `AMDaemon.NET.dll` 放进 `Libs`，整理好主配置再启动，并防住 MuMod 自动覆盖。
4. **SDGB + 自建 Sinmai-Assist**：保留 ChimeLib 和 SDGB 登录分支，用 SDGB 引用构建，生成全新配置，先安全模式再逐项验证。

长期可用的做法，是把每台机器的游戏版本、Loader、DLL、配置版本和已启用 patch 记在同一份清单里。**能启动不等于全功能可用，能编译不等于运行时兼容。**
