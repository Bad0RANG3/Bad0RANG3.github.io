---
title: '如何把玩你拿到的APP原盘🤭'
description: '你们不要再玩舞萌了😭'
date: 2026-09-18
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
verifiedDate: 2026-09-18
difficulty: 进阶
audience: 任何一个有IQ的人
hasCode: true
hasDownload: false
---

> 文章经由Deepseek V4.1 flash润色，很抱歉我的文笔并不好。

## 从一张常见的求助截图说起

群里经常出现这样的画面。`amdaemon` 闪一下就没，`Sinmai` 停在黑屏，`Package` 目录看起来又都对。发图的人补一句，真的按教程做了。

继续问版本，答案开始变得模糊。游戏数据不知道，反正是最新。ICF 从群里拿的。`Assembly-CSharp.dll` 来自覆盖包。AquaMai 和 MelonLoader 也都是最新。服务端是朋友说能用。

每个回答单独看都没什么，放到同一台机器上就不是一套系统了。

HDD 启动需要让游戏数据、ICF、AM Daemon、segatools、MelonLoader 和 Mod 互相认识。包看起来完整，也不能替你做这件事。先把手里的版本写下清楚，再决定换哪个文件。

下面这些现象很容易把人带错方向。

| 看到的现象 | 先查什么 |
| --- | --- |
| 游戏没脱壳 | ICF、DLL、Option 是否来自同一版本 |
| segatools 太旧 | `Package` 工作目录和 VFS 是否写对 |
| SDGB 改了 DNS 还是进不去 | `gameId`、`region`、keychip 和域名是否一致 |
| AquaMai 越新越好 | 当前构建引用了哪个 MelonLoader，面向哪个区服 |
| 两个 Mod 加载成功就没事 | 两边是否重复修改同一批方法 |
| 黑屏像显卡坏了 | 认证、DLL 或 keychip 是否已经在启动阶段失败 |
| 日志看不懂 | 日志里有没有 `MissingMethodException`、`TypeLoadException` 或 patch 失败 |

解包只解决第一步。后面的版本、网络和 Mod 冲突，仍然要一项一项对齐。

## 先把名字分清楚

后面如果把这些东西混在一起，排障会变成同时改五个地方。

| 名字 | 它负责什么 | 容易弄错的地方 |
| --- | --- | --- |
| `.app` | SEGA 游戏基础包或增量包 | 当成普通压缩包直接解压 |
| `.opt` | Option 和追加内容容器 | 解出来只留文件，不保留目录 |
| `Package` | 游戏程序与 Unity 资源主体 | 从 APP 根目录直接启动 |
| `amfs` | 提供 ICF 等文件 | ICF 来自别的区服或版本 |
| `Option` | 曲目和追加数据 | SDEZ 与 SDGB 数据混放 |
| `AppData` | SEGA 的游戏数据目录 | 当成 Windows 的 `%APPDATA%` |
| `amdaemon` | 启动、认证、网络、板卡和 IO | 认为换一个壳就能修完所有问题 |
| `Sinmai.exe` | Unity 主程序 | 绕过 `launch.bat` 单独双击 |
| segatools | 提供 hook、VFS、DNS、keychip 和 IO | 把它和 Mercury 当成同一层面的东西 |
| MelonLoader | 加载 Harmony Mod | 0.6.x 与 0.7.x 环境随意互换 |
| AquaMai | 面向 Sinmai 的现代 Mod 套件 | 最新 CI 默认兼容旧 SDGB |
| Sinmai-Assist | 独立的旧版 MelonLoader Mod | 和 AquaMai 无脑共存 |

启动顺序大致是这样。

```text
合法 HDD 数据
  -> Package
  -> segatools + amdaemon
  -> Sinmai.exe
  -> MelonLoader
  -> AquaMai 或 Sinmai-Assist
```

Mod 在链条最后。前面的版本没有对齐，多个 Mod 只会增加新的变量。

## 开工前先抄一份版本清单

这一步比下载文件重要。把清单存到文本里，改什么都留记录。

```text
game_id:                  SDEZ 或 SDGB
game_data_version:        读取 ConstParameter.NowGameVersion
game_id_string:           读取 ConstParameter.GameIDStr
Sinmai.exe SHA-256:
amdaemon.exe SHA-256:
Assembly-CSharp.dll SHA-256:
AMDaemon.NET.dll SHA-256:
ICF version:
Option prefix:
.app / .opt 文件名:
segatools tag:
MelonLoader version:
AquaMai tag:
Sinmai-Assist commit:
服务端 host:
keychip 来源:
```

常见版本数字可以这样换算。

```text
25100 = 1.51
25500 = 1.55
26000 = 1.60
26500 = 1.65
```

用 ILSpy 或 dnSpy 读 `MAI2System.ConstParameter`。社区简称只能帮你找到大概范围，`GameIDStr` 和 `NowGameVersion` 才决定程序集到底在认哪一版。

### 一套典型的版本套娃

下面这些文件名看上去都写着“新”，彼此却可能不认。

```text
SDGB 1.51 数据
1.60 的 Assembly-CSharp.dll
新 SDEZ 的 ICF
AquaMai 1.9.x
MelonLoader 0.7.0
```

旧数据可能缺少新版代码需要的类型，新 Mod 又按新 SDEZ 的方法签名构建。最后表现出来的还是黑屏或闪退。

检查顺序按依赖走。

1. `GameIDStr`
2. `NowGameVersion`
3. ICF
4. `Assembly-CSharp.dll`
5. Option
6. MelonLoader
7. Mod

从 Mod 往回猜通常更慢。前面有一项错了，最后一层怎么换都救不回来。

## 解包

`fragrance.moe/intro` 讲清了 `.app` 到可运行目录的总体流程。它没有替你做版本兼容判断，后面的步骤仍然要自己核对。

现在可以直接使用 `fsdecrypt`。`v0.1.8` 起支持直接提取 NTFS 和 APP，不必先挂载 VHD。它会自动识别并合并同目录的增量包。`v0.1.9` 另外修了 exFAT OPTION 中零字节文件导致提取失败的问题。

基础包、增量包和 Option 都交给同一个工具处理。

```powershell
# 基础包
.\fsdecrypt.exe "D:\dump\SDGB_1.55.00_xxx.app"

# 增量包，继续指向同一目录
.\fsdecrypt.exe "D:\dump\SDGB_1.55.01_xxx.app"

# Option
.\fsdecrypt.exe "D:\dump\SDGB_A000_xxx.opt"
```

如果继续使用 VHD 流程，先挂载父盘，再挂载增量盘。

```powershell
Set-VHD -Path ".\internal_1.vhd" -ParentPath ".\internal_0.vhd"
```

最后只复制 `Package`。目录可以按下面这样放。

```text
D:\maimai\SDGB\
  amfs\
    ICF1
  App\
    package\
      Sinmai.exe
      amdaemon.exe
      Sinmai_Data\
      config_common.json
      config_server.json
      config_client.json
      config_hook.json
      mai2.ini
      segatools.ini
      launch.bat
  AppData\
  Option\
    A000\
    A005\
    ...
```

没有 Option 数据也把空目录留着。VFS 指向一个不存在的目录，segatools 会直接报错。

来源不明的覆盖包通常会替换 `Sinmai.exe`、`amdaemon.exe`、`Assembly-CSharp.dll`、`AMDaemon.NET.dll` 和几个插件 DLL。换完以后看起来像更新，实际是把多个版本揉在一起。之后出了错，很难再判断是哪一份文件引起的。

## 先让启动层工作

Mod 先不要装。让 AM Daemon 和 Sinmai 在没有 Mod 的环境里启动一次，后面才能知道问题来自哪一层。

### mai2.ini

排障阶段可以先使用一组 Dummy 配置。

```ini
[Debug]
Debug=1

[AM]
Target=0
IgnoreError=1
DummyTouchPanel=1
DummyLED=1
DummyCodeCamera=1
DummyPhotoCamera=1

[Sound]
Sound8Ch=0
```

接上真实触摸屏、LED、相机或读卡器以后，再关闭对应的 Dummy 项。

### ICF1

文件放在 `amfs\ICF1`，不要带扩展名。

SDEZ、SDGB 和不同版本的 ICF 不能互换。很多黑屏最后都停在这个小文件上，和脱壳没有关系。

### amdaemon 能修什么，不能修什么

这里先把边界写清楚。我不会提供 `amdaemon.exe` 的脱壳步骤。

内存 dump、反调试绕过、导入表修复和完整性校验绕过都属于解除或绕过技术保护措施。随机找一个“脱壳版”也不是工程方案。你无法只凭它能启动就判断里面有没有额外代码，它还可能和当前 ICF、游戏 DLL、配置 JSON 不是同一版本。

请使用合法取得、并且你有权修改和运行的运行时文件。服务端如果提供授权版本，就以那一份为基线。

运行时 Mod 也不等于脱壳。AquaMai 和 Sinmai-Assist 的认证、加密与 hash patch 都发生在游戏加载以后，它们改不了受保护的 `amdaemon.exe`，也不能修复错区服和错版本。

### amdaemon 失败时先看哪里

| 现象 | 常见原因 |
| --- | --- |
| 立即退出 | 工作目录不对、配置 JSON 缺失、VFS 不存在 |
| `amSysFileInitEx ErrCode -5` | segatools 过旧或 VFS 错误 |
| VC runtime 错误 | 缺少 VC++ 运行库 |
| 找不到文件 | AM Daemon、游戏数据或区服版本不匹配 |
| DNS 或认证失败 | 服务端、keychip、DNS |
| 进游戏后报错 | `Assembly-CSharp.dll`、ICF、Option |

需要单独看 AM Daemon 日志时，可以临时运行下面这个脚本。它会启动 30 秒再结束进程，方便把错误抓出来。

```bat
@echo off
cls
echo Attempting to run AM Daemon ...
call :sub >amdaemontest.txt
exit /b

:sub
pushd %~dp0
start /b "AM Daemon" /min inject -d -k mai2hook.dll amdaemon.exe -f -c config_common.json config_server.json
ping 127.0.0.1 -n 31 > nul
taskkill /F /im amdaemon.exe > nul 2>&1
```

### segatools

当前正式 release 是 `2026-04-06`。旧教程常用的 `2025-11-04` 仍然可以作为旧环境基线。

| 场景 | 版本 |
| --- | --- |
| 新装 SDEZ | `2026-04-06` |
| 新装 SDGB | 优先 `2026-04-06`，已有稳定环境可以暂不升级 |
| 复刻旧教程 | `2025-11-04` |

把 `dist\mai2` 或 `mai2.zip` 解到 `App\package`，至少会有下面这些文件。

```text
DEVICE\
inject.exe
mai2hook.dll
segatools.ini
launch.bat
config_hook.json
```

不同 release 的 `inject.exe` 和 `mai2hook.dll` 不要混用。它们本来是一套，拆开以后错误会很难看。

### 通用 segatools.ini

路径和 keychip 换成自己的值。

```ini
[vfs]
amfs=../../amfs
option=../../Option
appdata=../../AppData

[aime]
enable=1
aimePath=DEVICE\aime.txt
scan=0x0D

[vfd]
enable=1

[dns]
default=<server-host-or-ip>
replaceHost=0

[netenv]
enable=1
addrSuffix=11

[keychip]
id=<authorized-keychip-id>
gameId=<SDEZ-or-SDGB>
platformId=ACA1
region=<1-or-8>
subnet=192.168.172.0

[pcbid]
serialNo=<authorized-unique-id-without-hyphen>

[system]
enable=1
freeplay=0
dipsw1=1

[led15070]
enable=1

[unity]
enable=1
targetAssembly=

[aimeio]
path=

[mai2io]
path=

[io4]
test=0x70
service=0x71
coin=0x72

[button]
enable=1

[touch]
p1Enable=1
p2Enable=1
```

几个容易忘的地方。

- `default` 不要填 `127.0.0.1` 或 `localhost`。
- `replaceHost=0` 是默认值，服务端明确要求才改。
- `[netenv]` 会影响多机通信。
- 多机时 PCB ID 必须唯一，并且只能有一台 Server。

### config_hook.json

旧配置里常见的最小内容是这样。

```json
{
  "allnet_auth": {
    "type": "1.0"
  }
}
```

### launch.bat

启动脚本要把 `amdaemon` 先拉起来，再进入 `Sinmai`。

```bat
@echo off

pushd %~dp0

start "AM Daemon" /min inject -d -k mai2hook.dll amdaemon.exe -f -c config_common.json config_server.json config_client.json config_hook.json
inject -d -k mai2hook.dll sinmai -screen-fullscreen 0 -popupwindow -screen-width 2160 -screen-height 1920 -silent-crashes

taskkill /f /im amdaemon.exe > nul 2>&1
pause
```

分辨率按显示器改。排查崩溃时去掉 `-silent-crashes`，否则错误窗口可能被直接吞掉。

## AquaMai

启动层稳定以后，再装 MelonLoader 和 AquaMai。

### 安装

1. 下载 x64 版 MelonLoader。当前 AquaMai README 固定 `v0.7.0`。
2. 解压到 `Sinmai.exe` 所在目录。
3. 新建 `Mods`。
4. 放入 `AquaMai.dll`。
5. 启动游戏。

`segatools.ini` 里保持这样。

```ini
[unity]
enable=1
targetAssembly=
```

`targetAssembly` 不要指向 `AquaMai.dll`。MelonLoader 会负责加载它。

### AquaMai.toml

第一次启动会生成两个文件。

```text
AquaMai.zh.toml
AquaMai.en.toml
```

把需要的那个改名成 `App\package\AquaMai.toml`。

配置版本要和 DLL 对上。

| AquaMai | 配置版本 |
| --- | --- |
| `v1.5.4` | `2.3` |
| `v1.7.5` | `2.4` |

不要只换 TOML，不换 DLL。反过来也一样。

### 最小配置

下面这份配置只开几个基础项，适合第一次确认 Mod 是否加载。

```toml
Version = "2.3"

[General]
locale = "zh"

[GameSystem.SinglePlayer]
HideSubMonitor = false
autoSkip = false
fixHanabi = true

[GameSystem.Window]
windowed = true
borderless = false
width = 1920
height = 1080

[Tweaks.SkipUserVersionCheck]
```

如果使用 `v1.7.5`，把 `Version` 改成 `2.4`。`SkipUserVersionCheck` 只在账号版本高于当前游戏版本时有用，不要把它当通用修复。

### AquaMai 的版本问题

2026-09-16 的公开 feed 同时列出了下面几项。

```text
v1.5.4 release
1.9.4-gb68f85f slow
1.9.5-g381a498 ci
```

这些条目不代表 SDGB 有三个官方版本。`v1.6.0` 引入 `FestaControl` 和 `FestaManager` 依赖，1.55 与 1.56 的参考程序集可能没有这些类型。`v1.7.5` 加入了 legacy gate，PR #99 的模块正文提到过 `SDGB151+EZ156+160`，但那只覆盖该模块的测试，不是整套兼容承诺。

SDGB 可以按这个方向选。

```text
最保守：v1.5.4
需要新功能：用目标 SDGB DLL 自建 v1.7.5
最新 SDEZ：使用与当前游戏 DLL 匹配的 tag 或 CI
旧 SDGB：不要默认上 1.9.x
```

## Sinmai-Assist

AquaMai 是套件，Sinmai-Assist 更像一把老式瑞士军刀。它能处理旧环境里的一些问题，也会顺手做很多事情。

### 它是什么

Sinmai-Assist 是面向 `Sinmai.exe` 的独立 MelonLoader 和 Harmony Mod。README 直接称它为 cheat mod。它不是 segatools 的替代品，也不是 AquaMai 插件。

当前源码里确实有 SDGB 分支。

```text
GameID == SDGB
  -> DummyChimeLogin
  -> ChimeCameraId
```

README 也建议编译时使用 SDGB 版本参考库。仓库历史上曾经提交过“移除对国服的支持”，后来又重新加入专用文件，但没有新的正式支持声明。它可以用于实验，不能当成有正式稳定承诺的 SDGB 方案。

### 适合做什么

| 用途 | 原因 |
| --- | --- |
| 旧 MelonLoader 环境诊断 | 它要求 0.6.4 或更低 |
| SDGB Chime 登录实验 | SDGB 分支会改写登录流程 |
| 相机 ID 排查 | 会输出 `WebCameraList.txt` |
| 网络和认证兼容实验 | 有多组 Fix patch |
| 单人模式测试 | 可以在测试副本单独打开 |
| 用户数据备份实验 | 提供 JSON 导出 |

它不适合做长期 SDGB 基座，也不适合在真实账号上测试 AutoPlay、FastSkip、Unlock 或成绩修改。和 AquaMai 同时使用时，两边不要打开同一类 patch。

### 默认配置会写很多文件

关闭 `safeMode` 以后，`Main.cs` 会直接加载下面几组 patch。

```csharp
Patch(typeof(PrintUserData));
Patch(typeof(InputManager));
Patch(typeof(GameMessageManager));
```

`PrintUserData` 会在进入选曲时写入 `Sinmai-Assist\UserData\User<ID>.txt`。里面可能包含访问码、UserID、AuthKey、Rating 和游玩信息。

网络日志默认还可能落到下面这个位置。

```text
Sinmai-Assist\NetworkLogs\YYYY-MM-DD.log
```

这些目录不要上传到 Issue、网盘、群聊或 Git。第一次运行时只开 `safeMode: true`。如果不接受明文凭证落盘，就不要使用当前构建。

### 安装和构建

较早的源码基线 commit 是 `ad5cdbe7365f79e2b21991f38e007682162a1787`，要求如下。

```text
MelonLoader: 0.6.4 或更低
.NET Framework: 4.7.2
参考程序集: 与目标 SDGB 版本匹配
DLL 路径: App\package\Mods\Sinmai-Assist.dll
```

从源码构建可以参考下面这组命令。

```powershell
git clone https://github.com/WYH2004-MC/Sinmai-Assist.git
Set-Location .\Sinmai-Assist
git checkout ad5cdbe7365f79e2b21991f38e007682162a1787

New-Item -ItemType Directory -Force .\Libs
# 从目标 SDGB 的 Sinmai_Data\Managed 和所需插件目录复制参考 DLL。

nuget restore .\Sinmai-Assist.sln
MSBuild.exe .\Sinmai-Assist.sln /p:Configuration=Release /p:TargetFramework=net472 /p:OutDir=Output
```

CI 使用私有 `LIBRARY_URL`，外部无法只靠公开仓库复现作者原来的构建环境。

不同时间的构建可能使用不同的配置版本。实际排障时，以 DLL 哈希和游戏生成的配置版本为准，旧仓库示例不要直接覆盖新配置。

### 第一次只验证加载

第一次生成的文件有两个。

```text
App\package\Sinmai-Assist\Config.yml
App\package\Sinmai-Assist\KeyBindConfig.yml
```

第一轮建议关掉所有会写数据的功能。

```yaml
common:
  autoBackupData: false
  showFPS: false
  singlePlayer:
    enable: false
    hideSubMonitor: false
  unityLogger:
    enable: false
    printToConsole: false
  networkLogger:
    enable: false
    printToConsole: false

cheat:
  autoPlay: false
  fastSkip: false
  chartController: false
  allCollection: false
  unlockEvent: false
  forceCurrentIsBest: false

fix:
  disableEnvironmentCheck: false
  disableEncryption: false
  disableIniClear: false
  disableReboot: false
  fixDebugInput: false
  fixCheckAuth: false
  skipCakeHashCheck: false
  skipSpecialNumCheck: false
  skipVersionCheck: false
  restoreCertificateValidation: false

modSetting:
  safeMode: true
  showInfo: true
  showPanel: false
  maskTitleServerUrl: true
```

日志里应该出现下面这些内容。

```text
Config Load Complete.
GameInfo: SDGB <version>
Safe mode is enabled, Disable all patch
```

如果游戏不是 SDGB，先停在这里。

### 第二次只开启动层

把 `safeMode` 改成 `false`，先只打开下面几项。

```yaml
fix:
  disableEnvironmentCheck: true
  disableIniClear: true
  disableReboot: true
  fixDebugInput: true
  skipSpecialNumCheck: true
```

服务端明确要求时，再考虑下面这些。

```yaml
fix:
  disableEncryption: true
  fixCheckAuth: true
  skipCakeHashCheck: true
  restoreCertificateValidation: true
  forceAsServer: true
```

`disableEncryption: true` 的含义是启用“移除加密” patch。

### 不建议打开的项

```text
DummyLogin
BlockCoin
AutoPlay
FastSkip
ChartController
UnlockMusic / UnlockMaster / UnlockEvent / UnlockUtage
AllCollection
ForceCurrentIsBest
ResetLoginBonusRecord
RewriteLoginBonusStamp
SetAllCharacterAsSameAndLock
所有 saveToUserData
```

`ForceCurrentIsBest` 会修改 Best50 状态。Unlock 的 `saveToUserData` 会写用户数据。登录奖励相关项会改奖励进度。DummyLogin 会改登录和读卡流程。这些功能可以拿来研究，不要拿真实账号试。

## AquaMai 和 Sinmai-Assist 同时使用

两个 DLL 可以一起放进 `Mods`，尤其在旧的 MelonLoader 分支里。加载成功只说明 loader 接受了它们，不能证明两套 patch 应该全部打开。

### 先看 loader 约束

Sinmai-Assist 要求 MelonLoader `0.6.4` 或更低。当前 AquaMai README 面向 `0.7.0`，直接把最新 AquaMai 放进来，通常会先死在加载阶段。

要让两者共存，AquaMai 必须使用一个能在 0.6.4 下加载的旧构建，或者用目标 SDGB 与 MelonLoader 环境自行构建。判断标准是 DLL 实际引用哪个 MelonLoader 和 Harmony 版本，社区标签只能用来缩小范围。

如果使用当前正式发布的 AquaMai，就不适合再装 Sinmai-Assist。想让 Sinmai-Assist 工作，先固定 loader，再从能和它共同加载的 AquaMai 构建里选一个。两个版本都不要自动更新。

### 每类功能只能有一个负责人

| 功能 | 建议负责人 | 约束 |
| --- | --- | --- |
| 移除加密 | 任选一边 | `RemoveEncryption` 与 `disableEncryption` 不要同时打开 |
| CheckAuth | 优先 AquaMai | Sinmai-Assist 的 `fixCheckAuth` 保持关闭 |
| Cake hash、SpecialNum、Certificate、Ini clear | 优先 AquaMai | AquaMai `Fix.Common` 会自动加载，Sinmai-Assist 对应项不要重复打开 |
| ForceAsServer | 任选一边 | 只能有一边接管 Server 行为 |
| 单人模式 | 任选一边 | 两边同时修改界面状态时，行为顺序不稳定 |
| 自定义相机 | 任选一边 | 使用 Sinmai-Assist 的 DummyLogin 时，先关闭 AquaMai 相机 patch |
| AutoPlay | Sinmai-Assist | AquaMai 关闭 `FixSlideAutoPlay`，可以保留 `DontRuinMyAccount` |
| Unlock 与登录奖励 | 任选一边 | 测试环境也只选一边，所有 `saveToUserData` 保持关闭 |
| 用户数据与网络日志 | 仅调试时使用 | 路径会落盘，完成排障后立即清理 |

### 推荐使用方案

第一次安装时把过程拆开，避免一次引入太多变量。

1. 备份 `Mods`、两个 Mod 的配置和当前可工作的 DLL。
2. 固定 MelonLoader 和 DLL 哈希，关闭 MuMod 自动更新。
3. 先只放 AquaMai，确认游戏启动。
4. 再加入 Sinmai-Assist，设置 `safeMode: true`，只确认它被 loader 加载。
5. 改成 `safeMode: false`，关闭所有 cheat、解锁、自动结算和 `saveToUserData`。
6. 每一类重复功能只保留一个实际执行者。
7. 按需求逐项打开功能，每开一项重启一次。

第一轮可以把 Sinmai-Assist 收窄到下面这些值。

```yaml
common:
  autoBackupData: false
  showFPS: false
  unityLogger:
    enable: false
    printToConsole: false
  networkLogger:
    enable: false
    printToConsole: false
  dummyLogin:
    enable: false
  customCameraId:
    enable: false

cheat:
  autoPlay: false
  fastSkip: false
  chartController: false
  allCollection: false
  unlockEvent: false
  unlockMusic:
    enable: false
    saveToUserData: false
  unlockMaster:
    enable: false
    saveToUserData: false
  unlockUtage:
    enable: false
  resetLoginBonusRecord: false
  rewriteLoginBonusStamp:
    enable: false
  forceCurrentIsBest: false

modSetting:
  safeMode: false
```

启动兼容项可以先留这几项。

```yaml
fix:
  disableEnvironmentCheck: true
  disableEncryption: false
  disableReboot: true
  disableIniClear: true
  fixDebugInput: true
  fixCheckAuth: false
  forceAsServer: false
  skipCakeHashCheck: false
  skipSpecialNumCheck: true
  skipVersionCheck: false
  restoreCertificateValidation: false
```

`disableEncryption`、`fixCheckAuth`、`skipCakeHashCheck`、`restoreCertificateValidation` 和 `forceAsServer` 按服务端要求逐项决定。它们和 AquaMai 重叠时，让已经稳定的一边负责，不要两边一起开。

相机、单人模式和 Server 模式先交给 AquaMai，Sinmai-Assist 对应项明确设为 `false`。不要依赖 `DummyLogin` 在运行时帮你关闭。

测试号确实需要 Sinmai-Assist AutoPlay 时，保留 AquaMai `DontRuinMyAccount`，关闭 Sinmai-Assist 的 `NaturalTrackSkip`、Unlock、登录奖励改写和所有 `saveToUserData`，同时关闭 AquaMai `ImmediateSave`。日志和用户数据都按敏感文件处理。

### 卸载和回滚

卸载时先关闭 `Sinmai.exe`，再处理下面这些文件。

```text
删除 Mods\Sinmai-Assist.dll
备份或删除 Sinmai-Assist\Config.yml
备份或删除 Sinmai-Assist\KeyBindConfig.yml
备份或删除 Sinmai-Assist\UserBackup\
清理 Sinmai-Assist\UserData\
清理 Sinmai-Assist\NetworkLogs\
```

可工作的组合单独保存，别只留一个 DLL。

```text
backup\sinmai-assist\<commit>\
  Sinmai-Assist.dll
  Config.yml
  KeyBindConfig.yml
  metadata.txt
```

`metadata.txt` 至少记下 DLL 哈希、Git commit、游戏版本、GameID、MelonLoader 版本和已经验证的功能。

## SDEZ

日服的核心值比较固定。

```ini
[keychip]
gameId=SDEZ
platformId=ACA1
region=1
```

启动顺序按下面走。

1. 数据、ICF 和 `Assembly-CSharp.dll` 使用同一版本。
2. Option 使用当前版本字母。
3. DNS 填服务端地址。
4. keychip 使用服务端授权值。
5. 单机环境设置 `dipsw1=1`。
6. 先启动 AM Daemon，再进入 Sinmai。

常见域名包括下面这些。

```text
naominet.jp
*.sys-all.net
op.auth.sys-all.net
at.sys-all.net
```

AquaMai 只使用与当前 SDEZ DLL 匹配的构建。版本号相同，参考程序集不同，也可能在加载方法时失败。

## SDGB

SDGB 麻烦的地方在于下面这些值必须同时正确。

```text
区服 ID
keychip region
DNS
密钥授权
游戏数据版本
Assembly-CSharp.dll
ICF
Option
MelonLoader
AquaMai 版本
```

任何一项错了，表现出来都可能是黑屏。

### 先识别版本

至少记录下面这些字段。

```text
GameIDStr
NowGameVersion
ICF version
Assembly-CSharp.dll SHA-256
AMDaemon.NET.dll SHA-256
Option 目录
ChimeLib.NET 是否存在
```

常见 SDGB 版本有 1.51、1.53 和 1.55，但目录名不能当证据。以 `ConstParameter` 为准。

### Mod 路线

| 目标 | 选择 |
| --- | --- |
| 只启动 | 不装 Mod |
| 稳定旧环境 | AquaMai `v1.5.4` |
| 需要 v1.7.5 功能 | 用目标 SDGB DLL 自建 |
| 旧 loader 调试 | 自建 Sinmai-Assist |
| AquaMai + Sinmai-Assist | 固定 0.6.4、固定两个 DLL 哈希，只用于测试 |
| 默认选择 | 不选 1.9.x |

### 必改项

`gameId` 使用 SDGB。

```ini
[keychip]
gameId=SDGB
```

中国服常见 `region=8`。

```ini
[keychip]
region=8
```

区服编号的意思是下面这些。

```text
1 = Japan
4 = Export
8 = China
```

最终仍然以服务端要求为准。

segatools 已经注册了 WAHLAP 相关域名。

```text
at.sys-all.cn
at.sys-allnet.cn
ai.sys-all.cn
ai.sys-allnet.cn
bl.sys-all.cn
bl.sys-allnet.cn
```

只改 `[dns] default` 不能完成全部网络配置。SDGB 常见 Option 目录是 `Option\Axxx`，ICF 必须来自目标 SDGB。

### 一份 SDGB segatools.ini

```ini
[vfs]
amfs=../../amfs
option=../../Option
appdata=../../AppData

[aime]
enable=1
aimePath=DEVICE\aime.txt
scan=0x0D

[vfd]
enable=1

[dns]
default=<sdgb-server-host-or-ip>
replaceHost=0

[netenv]
enable=1
addrSuffix=11

[keychip]
id=<authorized-sdgb-keychip>
gameId=SDGB
platformId=ACA1
region=8
subnet=192.168.172.0

[pcbid]
serialNo=<authorized-unique-id-without-hyphen>

[system]
enable=1
freeplay=0
dipsw1=1

[led15070]
enable=1

[unity]
enable=1
targetAssembly=

[aimeio]
path=

[mai2io]
path=

[io4]
test=0x70
service=0x71
coin=0x72

[button]
enable=1

[touch]
p1Enable=1
p2Enable=1
```

keychip、PCB 和主机地址只使用服务端明确提供或允许的值。远程服务和本地服务器不要混用同一套凭证。

### SDGB 与 AquaMai

AquaMai 会读取 `NowGameVersion` 和 `GameIDStr`。`v1.6.0` 引入 `FestaManager` 依赖，1.55 和 1.56 的参考程序集可能没有该类型。`v1.7.5` 有 legacy version support，PR #99 提到过 `SDGB151+EZ156+160`，但只覆盖新增模块。

AquaMai CI 使用 SDEZ 参考程序集。`v1.8.0` 引入 MuMod 自动更新，当前 slow 与 CI 是 1.9.4 和 1.9.5，源码面向较新的 1.65 和 1.70 环境。

SDGB 可以先走这条稳一点的路线。

1. 先用 `v1.5.4`。
2. 需要新功能时，用目标 SDGB DLL 自建 `v1.7.5`。
3. `v1.5.4` 配配置版本 2.3，`v1.7.5` 配 2.4。
4. 第一次只开 RemoveEncryption 和 OptionLoadFix。
5. 关闭 MuMod 自动更新。

`v1.5.4` 官方 DLL 的 SHA-256 是下面这个值。

```text
E738D327BD28F9445D2DA27DC751DA941B7D6C141DF82C3604858D9B6CB155C2
```

### 自建 v1.7.5

```powershell
git clone --branch v1.7.5 --depth 1 https://github.com/MuNET-OSS/AquaMai.git
Set-Location .\AquaMai

New-Item -ItemType Directory -Force .\Libs
Copy-Item "D:\maimai\SDGB\App\package\Sinmai_Data\Managed\Assembly-CSharp.dll" .\Libs\
Copy-Item "D:\maimai\SDGB\App\package\Sinmai_Data\Managed\AMDaemon.NET.dll" .\Libs\

.\build.ps1
```

报 `TypeLoadException`、`FileNotFoundException` 或 `MissingMethodException`，先回去检查参考 DLL 是否来自同一版本。

### 第一次启动

1. 清理残留的 `amdaemon.exe` 和 `Sinmai.exe`。
2. 运行 `launch.bat`。
3. 先看 AM Daemon 是否稳定驻留。
4. 再检查 Sinmai 是否进入画面。
5. 用 `F1` 打开 Test，用 `F2` 打开 Service。
6. 关闭 `IN-STORE MATCHING`。

启动后逐项确认下面这些结果。

```text
GameIDStr = SDGB
NowGameVersion 与 ICF 匹配
DNS 指向目标服务器
region = 8
Axxx Option 已加载
读卡器、触摸、按键、VFD、LED 正常
登录、游玩、保存和退出正常
```

### SDGB 常见故障

| 现象 | 优先检查 |
| --- | --- |
| 黑屏 | `Assembly-CSharp.dll`、ICF、keychip |
| 卡联网 | WAHLAP DNS、SDGB ID、region |
| AM Daemon 退出 | VFS、配置 JSON、VC++ |
| Option 不显示 | `Axxx`、OptionLoadFix、ICF |
| AquaMai 崩溃 | 构建版本，回退 `v1.5.4` 或自建 `v1.7.5` |
| Sinmai-Assist 崩溃 | MelonLoader 0.7.x |
| Sinmai-Assist 没有 patch | `safeMode: true` |
| 多机失败 | PCB ID、Server 数量和 netenv |

## 排障顺序

遇到黑屏、闪退或卡联网，一次只改一个地方。

```text
1. 移除所有 Mod
2. 只保留 segatools
3. 检查 AM Daemon
4. 检查 VFS
5. 检查 DNS 和 keychip
6. 检查 ICF 和 Assembly-CSharp.dll
7. 启动 Sinmai
8. 安装 MelonLoader
9. 只放一个 Mod
10. 一次只开一个功能
```

这样看起来慢，实际上比在五个版本之间来回换快。每换一次文件，都要重新记录版本和哈希。

## 不要做的组合

```text
最新 SDEZ AquaMai + 旧 SDGB
MelonLoader 0.7.x + Sinmai-Assist
现代 AquaMai + Sinmai-Assist 所有 patch
MuMod 自动更新 + 冻结旧版 SDGB
日服覆盖包 + 国服数据
只换 AquaMai.dll，不换 TOML
只换 Sinmai-Assist.dll，不换 Config.yml
把 Mercury 当 maimai 启动器
来源不明的 keychip、PCB ID 和服务端凭证
在真实账号上测试 AutoPlay、FastSkip、Unlock 或成绩修改
```

## 参考来源

- [Fragrance app 到 game 的总流程](https://fragrance.moe/intro)
- [Two-Torial maimai DX 安装教程](https://re-two-torial.xyz/games/sega/maimaidx/common/setup/)
- [segatools](https://gitea.tendokyu.moe/TeamTofuShop/segatools)
- [fsdecrypt v0.1.9](https://gitea.tendokyu.moe/beerpsi/fsdecrypt/releases/tag/v0.1.9)
- [AquaMai](https://github.com/MuNET-OSS/AquaMai)
- [MelonLoader v0.6.4](https://github.com/LavaGang/MelonLoader/releases/tag/v0.6.4)
- [Sinmai-Assist](https://github.com/WYH2004-MC/Sinmai-Assist)
