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

> 本文篇幅过长经由Deepseek V4.1 flash润色，抱歉我的文笔并不好。

## 几乎每个神秘群聊都会出现的场面

有人发来四张截图：`amdaemon` 一闪而过，`Sinmai` 黑屏，`segatools` 目录看起来没问题，最后补一句：

> “真的按教程做了，为什么还是不能开？”

然后一问版本，事情就变了：

```text
游戏数据：不知道，反正是“最新”
ICF：群里拿的
Assembly-CSharp.dll：覆盖包里的
AquaMai：最新版
MelonLoader：最新版
服务端：朋友说能用
```

这时最错误的建议，是让人继续换启动器、换 `amdaemon`、继续找“更彻底的脱壳版”。

因为大多数时候，坏掉的不是某一个文件，而是五个东西在说五种不同的版本语言。

这不是具体某一个人的故事，而是一个合成排障案例，但每个字段都能对上真实源码、配置模板和日志中的问题。写这份资料时，我最想删掉的一句话也是“用最新版就行”。它听着友好，实际一点信息量都没有。

## 反常识结论：HDD 启动最难的不是脱壳

把整件事压缩成一句话：

**HDD 启动不是在比谁的包更“完整”，而是在让游戏数据、ICF、AM Daemon、segatools、loader 和 Mod 对同一个版本负责。**

如果只记一张表，就记这张：

| 你以为的问题 | 更常见的真实问题 |
| --- | --- |
| 游戏没脱壳 | ICF、DLL、Option 版本不匹配 |
| segatools 版本太旧 | `Package` 工作目录或 VFS 路径错了 |
| SDGB 改 DNS 就能用 | `gameId`、`region`、keychip、WAHLAP 域名没对齐 |
| AquaMai 越新越好 | 新版 CI 面向 SDEZ，旧 SDGB 需要旧构建 |
| 两个 Mod 功能更多 | 两套 patch 重叠，行为顺序不再可控 |
| 黑屏是显卡问题 | 认证、DLL 或 keychip 在启动阶段已经失败 |
| 日志没用 | 日志说得很清楚，只是我们之前没看 |

排序也很反直觉：

```text
最麻烦：版本和区服对齐
第二：网络、认证和 keychip
第三：loader / Mod 冲突
第四：外设和 IO
最后：解包与目录复制
```

解包只是入场券，不是通关证。

## 一、先把黑话翻译成人话

不把这些边界分清，后面一定会把不同层面的错误混在一起修。

| 名字 | 它干什么 | 最常见的误解 |
| --- | --- | --- |
| `.app` | SEGA 游戏基础包或增量包 | 当成普通压缩包直接解压 |
| `.opt` | Option / DLC 容器 | 解出来只留文件，不保留目录结构 |
| `Package` | 游戏可执行文件与 Unity 资源主体 | 把整个 APP 根目录直接拿去启动 |
| `amfs` | 提供 ICF 等文件 | ICF 用了别的区服或版本 |
| `Option` | 曲目和追加数据 | SDEZ 与 SDGB 混放 |
| `AppData` | SEGA 的游戏数据语义目录 | 当成 Windows `%APPDATA%` |
| `amdaemon` | 负责启动、认证、网络、板卡和 IO | 以为它能靠“换壳”解决全部错误 |
| `Sinmai.exe` | Unity 主程序 | 绕过 `launch.bat` 单独双击 |
| segatools | 注入 hook、VFS、DNS、keychip 和 IO | 把 `Mercury` 当成 maimai 启动器 |
| MelonLoader | 加载 Harmony Mod | 0.6.4 和 0.7.x 环境随意互换 |
| AquaMai | 面向 Sinmai 的现代 Mod 套件 | 最新 SDEZ CI 默认兼容旧 SDGB |
| Sinmai-Assist | 独立的旧版 MelonLoader cheat/debug Mod | 以为它能和现代 AquaMai 无脑共存 |

真正的启动链其实很朴素：

```text
合法 HDD 数据
  -> Package
  -> segatools + amdaemon
  -> Sinmai.exe
  -> MelonLoader
  -> AquaMai 或 Sinmai-Assist
```

Mod 是最后一层。前面没对齐时，装更多 Mod 只会增加变量。

## 二、开工前别急着复制，先抄版本号

这是整篇最重要的动作。

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

常见数值换算：

```text
25100 = 1.51
25500 = 1.55
26000 = 1.60
26500 = 1.65
```

用 ILSpy 或 dnSpy 读 `MAI2System.ConstParameter`。别只听社区简称，`SDGB151` 只能表示大致版本，不能代替实际字段。

### 一个非常典型的“版本套娃”

下面这套组合看似都写着“最新”，实际每一步都在给对方拆台：

```text
SDGB 1.51 数据
1.60 的 Assembly-CSharp.dll
新 SDEZ 的 ICF
AquaMai 1.9.x
MelonLoader 0.7.0
```

它失败不神秘。旧数据不认新版程序集，新 Mod 又面向新 SDEZ。最后表现出来的只是黑屏或闪退。

检查顺序固定为：

1. `GameIDStr`
2. `NowGameVersion`
3. ICF
4. `Assembly-CSharp.dll`
5. Option
6. loader
7. Mod

不要倒着查。

## 三、解包只是入场券

`fragrance.moe/intro` 的总体流程仍然有效。它解决了 `.app` 到可运行目录的问题，但没有替你做版本兼容判断。

当前更推荐 `fsdecrypt v0.1.9`：

- `v0.1.8` 起可直接提取 NTFS/APP，不必使用管理员权限、Hyper-V 或手动挂载。
- 可自动识别并合并同目录 delta `.app`。
- `v0.1.9` 修复了 exFAT OPTION 中零字节文件导致提取失败的问题。

基础包：

```powershell
.\fsdecrypt.exe "D:\dump\SDGB_1.55.00_xxx.app"
```

增量包：

```powershell
.\fsdecrypt.exe "D:\dump\SDGB_1.55.01_xxx.app"
```

Option：

```powershell
.\fsdecrypt.exe "D:\dump\SDGB_A000_xxx.opt"
```

旧 VHD 路线也能用：

```powershell
Set-VHD -Path ".\internal_1.vhd" -ParentPath ".\internal_0.vhd"
```

之后只复制 `Package`。

### 推荐目录

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

没有 Option 数据也保留空目录。VFS 指向不存在目录时，segatools 会直接报错。

### 不要迷信“覆盖包”

来源不明的整合包经常替换：

```text
Sinmai.exe
amdaemon.exe
Sinmai_Data\Managed\Assembly-CSharp.dll
Sinmai_Data\Managed\AMDaemon.NET.dll
Sinmai_Data\Plugins\amdaemon_api.dll
Sinmai_Data\Plugins\Cake.dll
```

这不是更新，是把多个版本变量揉成一团。除非能核对来源和哈希，否则以后永远无法判断到底哪一步坏了。

## 四、先让启动层工作，别急着装 Mod

### 4.1 mai2.ini

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

连接真实触摸屏、LED、相机或读卡器后，再关闭对应 Dummy 项。

### 4.2 ICF1

```text
amfs\ICF1
```

文件名不能带扩展名。SDEZ、SDGB 和不同版本的 ICF 不能互换。很多黑屏最后不是“壳没脱”，而是这一个小文件根本不对。

### 4.3 amdaemon：我不能教你脱壳，但可以教你别乱修

这里先把最可能挨骂的话放前面：

**我不会提供 `amdaemon.exe` 的脱壳步骤，因为我也不会嘻嘻**

内存 dump、反调试绕过、导入表修复、完整性校验绕过和重建受保护可执行文件，都属于解除或绕过技术保护措施。随机找一个“脱壳版”也不是工程方案。

它至少有三个问题：

1. 你无法只凭能启动确认其中没有额外代码。
2. 它可能和你的 ICF、游戏 DLL、配置 JSON 不是同一版本。
3. 不同区服和补丁可能依赖不同的 AM Daemon 行为。

正确处理方式是使用合法取得、且你有权修改和运行的运行时文件。服务端如果提供已授权版本，就以那一份为准。

先说清楚：**运行时 Mod 不等于脱壳。**

AquaMai 和 Sinmai-Assist 的认证、加密和 hash patch 都发生在游戏已经加载之后。它们不会把受保护 `amdaemon.exe` 变成未保护文件，也不能修复错区服、错版本。

### 4.4 amdaemon 失败先查什么

| 现象 | 更常见的原因 |
| --- | --- |
| 立即退出 | 不在 `Package`、配置 JSON 缺失、VFS 不存在 |
| `amSysFileInitEx ErrCode -5` | 旧 segatools 或错误 VFS |
| VC runtime 错误 | 缺 VC++ 2012 x64 或最新 VC++ x64 |
| 找不到文件 | AM Daemon、游戏数据、区服版本不匹配 |
| DNS / 认证失败 | 服务端、keychip、DNS |
| 进游戏后出错 | `Assembly-CSharp.dll`、ICF、Option |

临时日志脚本：

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

这是日志工具，不是脱壳工具。

### 4.5 segatools

当前正式 release 是 `2026-04-06`。教程常见的 `2025-11-04` 仍可作为旧环境基线。

| 场景 | 版本 |
| --- | --- |
| 新装 SDEZ | `2026-04-06` |
| 新装 SDGB | 优先 `2026-04-06`，已有验证环境可暂不升级 |
| 复刻旧教程 | `2025-11-04` |

把 `dist\mai2` 或 `mai2.zip` 复制到 `App\package`：

```text
DEVICE\
inject.exe
mai2hook.dll
segatools.ini
launch.bat
config_hook.json
```

不要混用不同 release 的 `inject.exe` 和 `mai2hook.dll`。

### 4.6 通用 segatools.ini

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

注意：

- `default` 不能填 `127.0.0.1` 或 `localhost`。
- `replaceHost=0` 是默认值，服务端明确要求才改 `1`。
- `[netenv]` 可能影响 cab-to-cab。
- 多机时 PCB ID 必须唯一，且只能一台 Server。

### 4.7 config_hook.json

```json
{
  "allnet_auth": {
    "type": "1.0"
  }
}
```

### 4.8 launch.bat

```bat
@echo off

pushd %~dp0

start "AM Daemon" /min inject -d -k mai2hook.dll amdaemon.exe -f -c config_common.json config_server.json config_client.json config_hook.json
inject -d -k mai2hook.dll sinmai -screen-fullscreen 0 -popupwindow -screen-width 2160 -screen-height 1920 -silent-crashes

taskkill /f /im amdaemon.exe > nul 2>&1
pause
```

分辨率只是示例。排查崩溃时去掉 `-silent-crashes`。

## 五、Mod 路线一：AquaMai

### 5.1 安装

1. 下载 MelonLoader x64，当前 README 固定 `v0.7.0`。
2. 解压到 `Sinmai.exe` 所在目录。
3. 建 `Mods`。
4. 放入 `AquaMai.dll`。
5. 启动游戏。

保持：

```ini
[unity]
enable=1
targetAssembly=
```

不要把 `targetAssembly` 指向 `AquaMai.dll`。MelonLoader 负责加载它。

### 5.2 AquaMai.toml

第一次启动会生成：

```text
AquaMai.zh.toml
AquaMai.en.toml
```

把需要的文件改名为：

```text
App\package\AquaMai.toml
```

版本：

| AquaMai | 配置版本 |
| --- | --- |
| `v1.5.4` | `2.3` |
| `v1.7.5` | `2.4` |

不要只换 TOML，不换 DLL。

### 5.3 最小配置

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

`v1.7.5` 改成 `2.4`。`SkipUserVersionCheck` 不是通用修复。

### 5.4 AquaMai 的反常识版本观

2026-09-16 的公开 feed 同时列出了：

```text
v1.5.4 release
1.9.4-gb68f85f slow
1.9.5-g381a498 ci
```

这不代表 SDGB 有三种官方版本。

`v1.6.0` 引入 `FestaControl` 和 `FestaManager` 依赖。1.55/1.56 的参考程序集可能没有这个类型。`v1.7.5` 加入了 legacy gate，PR #99 的新模块正文写过 `SDGB151+EZ156+160`，但那只是该模块的测试，不是全功能兼容承诺。

所以 SDGB 的选择是：

```text
最保守：v1.5.4
要新功能：用目标 SDGB DLL 自建 v1.7.5
最新 SDEZ：当前 tag/CI
旧 SDGB：不要默认 1.9.x
```

## 六、Mod 路线二：Sinmai-Assist 怎么用好

如果说 AquaMai 是“现代套件”，Sinmai-Assist 更像一把老式瑞士军刀：能解决旧环境问题，也很容易在你不注意时割到手。

### 6.1 它到底是什么

它是面向 `Sinmai.exe` 的独立 MelonLoader/Harmony Mod。README 直接定义它是 cheat mod，不是 segatools 替代品，也不是 AquaMai 插件。

它和 SDGB 有关系，因为当前源码里确实有：

```text
GameID == SDGB
  -> DummyChimeLogin
  -> ChimeCameraId
```

README 也建议编译时使用 SDGB 版本参考库。

但仓库历史上明确提交过“移除对国服的支持”，后来又重新加入专用文件，却没有新的正式支持声明。所以它不是“官方 SDGB 解决方案”，而是遗留、区域性和用户实测路线。

### 6.2 最适合用它做什么

| 用途 | 原因 |
| --- | --- |
| 旧 MelonLoader 环境诊断 | 它要求 0.6.4 或更低 |
| SDGB Chime 登录实验 | SDGB 分支替换登录流程 |
| 相机 ID 排查 | 会输出 WebCameraList.txt |
| 网络、认证兼容实验 | 有多组 Fix patch |
| 单人模式测试 | 可在测试副本单独开启 |
| 用户数据备份实验 | 提供 JSON 导出 |

不适合：

- 当作正式长期 SDGB Mod 基座。
- 在真实账号上测试 AutoPlay、FastSkip、Unlock 或成绩修改。
- 和 AquaMai 两边同时打开同类 patch。

### 6.3 它最坑的地方：默认会很热情

关闭 `safeMode` 后，Main.cs 会无条件加载：

```csharp
Patch(typeof(PrintUserData));
Patch(typeof(InputManager));
Patch(typeof(GameMessageManager));
```

`PrintUserData` 会在进入选曲时写：

```text
Sinmai-Assist\UserData\User<ID>.txt
```

里面有：

```text
AccessCode
UserID
AuthKey
Rating
登录和游玩信息
```

同时 `networkLogger` 的源码默认值可能为 `true`，网络请求可能落到：

```text
Sinmai-Assist\NetworkLogs\YYYY-MM-DD.log
```

我核对这段代码时，第一反应不是“功能真多”，而是“这东西绝对不能整包上传到群里”。

所以使用规则是：

- 第一次只开 `safeMode: true`。
- 关闭安全模式后，`UserData` 和 `NetworkLogs` 都当成敏感目录。
- 不要上传到 Issue、网盘、群聊或 Git。
- 如果无法接受明文凭证落盘，不要用当前构建。

### 6.4 安装和构建前提

截至 2026-04-09，默认分支 commit 是：

```text
ad5cdbe7365f79e2b21991f38e007682162a1787
```

要求：

```text
MelonLoader: 0.6.4 或更低
.NET Framework: 4.7.2
参考程序集: 与目标 SDGB 版本匹配
DLL 路径: App\package\Mods\Sinmai-Assist.dll
```

构建示例：

```powershell
git clone https://github.com/WYH2004-MC/Sinmai-Assist.git
Set-Location .\Sinmai-Assist
git checkout ad5cdbe7365f79e2b21991f38e007682162a1787

New-Item -ItemType Directory -Force .\Libs
# 从目标 SDGB 的 Sinmai_Data\Managed 和所需插件目录复制参考 DLL。

nuget restore .\Sinmai-Assist.sln
MSBuild.exe .\Sinmai-Assist.sln /p:Configuration=Release /p:TargetFramework=net472 /p:OutDir=Output
```

CI 使用私有 `LIBRARY_URL`，所以外部不能只靠公开仓库复现作者原始构建环境。

### 6.5 第一次只验证加载

第一次生成的配置：

```text
App\package\Sinmai-Assist\Config.yml
App\package\Sinmai-Assist\KeyBindConfig.yml
```

推荐：

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

日志应出现：

```text
Config Load Complete.
GameInfo: SDGB <version>
Safe mode is enabled, Disable all patch
```

如果不是 SDGB，直接停。

### 6.6 第二次只开启动层

把：

```yaml
modSetting:
  safeMode: false
```

然后只打开：

```yaml
fix:
  disableEnvironmentCheck: true
  disableIniClear: true
  disableReboot: true
  fixDebugInput: true
  skipSpecialNumCheck: true
```

服务端明确要求时，再逐项考虑：

```yaml
fix:
  disableEncryption: true
  fixCheckAuth: true
  skipCakeHashCheck: true
  restoreCertificateValidation: true
  forceAsServer: true
```

`disableEncryption: true` 的意思是启用“移除加密” patch。

### 6.7 不建议打开的项

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

原因很直白：

- ForceCurrentIsBest 会改 Best50 状态。
- Unlock 的 `saveToUserData` 会写用户数据。
- Login Bonus 相关项会改登录奖励。
- DummyLogin 会改登录和读卡流程。

### 6.8 和 AquaMai 为什么容易打架

先看 loader：

```text
Sinmai-Assist：0.6.4 或更低
现代 AquaMai：0.7.0
```

再看 patch：

| 功能 | Sinmai-Assist | AquaMai |
| --- | --- | --- |
| 移除加密 | `DisableEncryption` | `RemoveEncryption` |
| CheckAuth | `FixCheckAuth` | `FixCheckAuth` |
| Cake hash | `SkipCakeHashCheck` | `Fix.Common` |
| SpecialNum | `SkipSpecialNumCheck` | `Fix.Common` |
| Certificate | `RestoreCertificateValidation` | `Fix.Common` |
| Ini clear | `DisableIniClear` | `Fix.Common` |
| SinglePlayer | `Common.SinglePlayer` | `GameSystem.SinglePlayer` |
| Camera | `Common.CustomCameraId` | `GameSystem.CustomCameraId` |
| ForceAsServer | `Fix.ForceAsServer` | `ForceAsServer` |

已知冲突包括：

- AquaMai `FixSlideAutoPlay` 与 Sinmai-Assist AutoPlay 冲突。
- 两边同时开 `CustomCameraId` 会出现相机异常或帧率问题。
- Add Miss 和 Slide 相关 patch 同开时行为可能不稳定。

共存原则只有一句：**同类功能只留一边。**

### 6.9 卸载和回滚

```text
删除 Mods\Sinmai-Assist.dll
备份或删除 Sinmai-Assist\Config.yml
备份或删除 Sinmai-Assist\KeyBindConfig.yml
备份或删除 Sinmai-Assist\UserBackup\
清理 Sinmai-Assist\UserData\
清理 Sinmai-Assist\NetworkLogs\
```

每个可用版本单独保存：

```text
backup\sinmai-assist\<commit>\
  Sinmai-Assist.dll
  Config.yml
  KeyBindConfig.yml
  metadata.txt
```

## 七、日服 SDEZ：反而没那么魔法

SDEZ 的核心值：

```ini
[keychip]
gameId=SDEZ
platformId=ACA1
region=1
```

顺序：

1. 数据、ICF、`Assembly-CSharp.dll` 同版本。
2. Option 使用当前版本字母。
3. DNS 填服务端地址。
4. keychip 使用服务端授权值。
5. 单机 `dipsw1=1`。
6. 先 AM Daemon，后 Sinmai。

常见域名：

```text
naominet.jp
*.sys-all.net
op.auth.sys-all.net
at.sys-all.net
```

AquaMai 只用与当前 SDEZ DLL 匹配的构建。只看版本号不够。

## 八、中国服 SDGB 专项配置

终于到了最难的一部分。

SDGB 难，不是因为它比 SDEZ 多十个神秘 DLL。它难在下面这些东西必须同时正确：

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

任何一项错，都可能表现成同一个症状：黑屏。

### 8.1 先识别 SDGB 版本

读取：

```text
GameIDStr
NowGameVersion
ICF version
Assembly-CSharp.dll SHA-256
AMDaemon.NET.dll SHA-256
Option 目录
ChimeLib.NET 是否存在
```

常见 SDGB 版本有 1.51、1.53、1.55 等，但不能只看目录名。以 `ConstParameter` 为准。

### 8.2 Mod 路线矩阵

| 目标 | 推荐 |
| --- | --- |
| 只启动 | 不装 Mod |
| 稳定旧 Mod | AquaMai `v1.5.4` |
| v1.7.5 功能 | 用目标 SDGB DLL 自建 |
| 旧 loader 调试 | 自建 Sinmai-Assist |
| 默认方案 | 不选 1.9.x |

### 8.3 SDGB 必改四项

#### gameId

```ini
[keychip]
gameId=SDGB
```

#### region

```ini
[keychip]
region=8
```

定义：

```text
1 = Japan
4 = Export
8 = China
```

最终以服务端要求为准。

#### WAHLAP DNS

segatools 已注册：

```text
at.sys-all.cn
at.sys-allnet.cn
ai.sys-all.cn
ai.sys-allnet.cn
bl.sys-all.cn
bl.sys-allnet.cn
```

只改 `[dns] default` 不等于完成配置。

#### Option 和 ICF

SDGB 常见 Option 是：

```text
Option\Axxx
```

ICF 必须来自目标 SDGB。

### 8.4 完整 SDGB segatools.ini

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

### 8.5 服务端凭证

只接收服务端明确提供或允许的：

```text
keychip.id
pcbid.serialNo
host
证书
区服参数
```

远程：

```text
[dns]
default=<server>
keychip 使用服务端分配值
```

本地：

```text
[dns]
default=<服务器 LAN IP>
```

不要混用。

### 8.6 SDGB + AquaMai 稳定路线

关键事实：

1. AquaMai 使用 `NowGameVersion` 和 `GameIDStr`。
2. `v1.6.0` 引入 `FestaManager` 依赖。
3. 1.55/1.56 参考程序集可能没有该类型。
4. `v1.7.5` 有 legacy version support。
5. PR #99 写了 `SDGB151+EZ156+160`。
6. PR #99 只测新增模块，不是全套声明。
7. AquaMai CI 使用 SDEZ 参考程序集。
8. `v1.8.0` 引入 MuMod 自动更新。
9. 当前 slow/CI 是 1.9.4/1.9.5。
10. 当前源码面向 1.65/1.70。

稳定路线：

1. 先用 `v1.5.4`。
2. 需要新功能时自建 `v1.7.5`。
3. `v1.5.4` 配 2.3，`v1.7.5` 配 2.4。
4. 首次只开 RemoveEncryption 和 OptionLoadFix。
5. 关闭 MuMod 自动更新。

`v1.5.4` 官方 DLL SHA-256：

```text
E738D327BD28F9445D2DA27DC751DA941B7D6C141DF82C3604858D9B6CB155C2
```

### 8.7 SDGB + v1.7.5 自建

```powershell
git clone --branch v1.7.5 --depth 1 https://github.com/MuNET-OSS/AquaMai.git
Set-Location .\AquaMai

New-Item -ItemType Directory -Force .\Libs
Copy-Item "D:\maimai\SDGB\App\package\Sinmai_Data\Managed\Assembly-CSharp.dll" .\Libs\
Copy-Item "D:\maimai\SDGB\App\package\Sinmai_Data\Managed\AMDaemon.NET.dll" .\Libs\

.\build.ps1
```

报 `TypeLoadException`、`FileNotFoundException` 或 `MissingMethodException`，就说明参考 DLL 不匹配。

### 8.8 SDGB + Sinmai-Assist 实验路线

适用：

```text
旧 Mono
旧 MelonLoader
AquaMai 无法作为主方案
需要 Chime 登录或相机实验
```

步骤：

1. 测试副本。
2. MelonLoader 0.6.4 或更低。
3. 固定 commit。
4. 用 SDGB DLL 构建。
5. `safeMode: true`。
6. 只开启动层 Fix。
7. 需要时再开 DummyLogin 或 CustomCameraId。
8. 最后清理 UserData 和 NetworkLogs。

### 8.9 SDGB 第一次启动

1. 清理残留进程。
2. 运行 `launch.bat`。
3. 看 AM Daemon。
4. 看 Sinmai。
5. `F1` Test，`F2` Service。
6. 关闭 `IN-STORE MATCHING`。

验证：

```text
GameIDStr = SDGB
NowGameVersion 与 ICF 匹配
DNS 指向目标服务器
region = 8
Axxx Option 已加载
读卡器、触摸、按键、VFD、LED 正常
登录、游玩、保存、退出正常
```

### 8.10 SDGB 故障表

| 现象 | 优先检查 |
| --- | --- |
| 黑屏 | `Assembly-CSharp.dll`、ICF、keychip |
| 卡联网 | WAHLAP DNS、SDGB ID、region |
| AM Daemon 退出 | VFS、config JSON、VC++ |
| Option 不显示 | `Axxx`、OptionLoadFix、ICF |
| AquaMai 崩溃 | 构建版本，回退 v1.5.4 或自建 v1.7.5 |
| Sinmai-Assist 崩溃 | MelonLoader 0.7.x |
| Sinmai-Assist 无 patch | `safeMode: true` |
| 多机失败 | PCB ID、Server 数量、netenv |

## 九、最后给一份最小排障顺序

遇到黑屏、闪退或卡联网，不要同时改五个地方。

```text
1. 关掉所有 Mod
2. 只保留 segatools
3. 检查 AM Daemon
4. 检查 VFS
5. 检查 DNS / keychip
6. 检查 ICF / Assembly-CSharp
7. 启动 Sinmai
8. 装 MelonLoader
9. 只放一个 Mod
10. 一次只开一个功能
```

每次只改一个变量。听起来慢，实际上比在五个版本之间来回换快得多。

## 十、不要做的组合

```text
最新 SDEZ AquaMai + 旧 SDGB
MelonLoader 0.7.x + Sinmai-Assist
现代 AquaMai + Sinmai-Assist 所有 patch
MuMod 自动更新 + 冻结旧版 SDGB
日服覆盖包 + 国服数据
只换 AquaMai.dll，不换 TOML
只换 Sinmai-Assist.dll，不换 Config.yml
把 Mercury 当 maimai 启动器
来源不明 keychip / PCB ID / 服务端凭证
在真实账号上测试 AutoPlay、FastSkip、Unlock 或成绩修改
```

## 参考来源

- [Fragrance：app -> game general intro](https://fragrance.moe/intro)
- [Evilleaker Manual：maimai DX](https://manual.evilleaker.com/games/maimai_dx/setup/)
- [Two-Torial：maimai DX Setup](https://re-two-torial.xyz/games/sega/maimaidx/common/setup/)
- [Two-Torial：Unity modding](https://re-two-torial.xyz/extras/unity/)
- [segatools](https://gitea.tendokyu.moe/TeamTofuShop/segatools)
- [segatools 2026-04-06](https://gitea.tendokyu.moe/TeamTofuShop/segatools/releases/tag/2026-04-06)
- [segatools 2025-11-04](https://gitea.tendokyu.moe/TeamTofuShop/segatools/releases/tag/2025-11-04)
- [segatools maimai segatools.ini](https://gitea.tendokyu.moe/TeamTofuShop/segatools/src/tag/2026-04-06/dist/mai2/segatools.ini)
- [segatools DNS 域名表](https://gitea.tendokyu.moe/TeamTofuShop/segatools/src/tag/2026-04-06/common/platform/dns.c)
- [segatools keychip region](https://gitea.tendokyu.moe/TeamTofuShop/segatools/src/tag/2026-04-06/common/platform/config.c)
- [fsdecrypt v0.1.9](https://gitea.tendokyu.moe/beerpsi/fsdecrypt/releases/tag/v0.1.9)
- [AquaMai](https://github.com/MuNET-OSS/AquaMai)
- [AquaMai v1.5.4](https://github.com/MuNET-OSS/AquaMai/tree/v1.5.4)
- [AquaMai v1.5.4 官方分发文件](https://munet-resources-1251600285.cos.ap-nanjing.myqcloud.com/AquaMai/1.5.4)
- [AquaMai v1.7.5](https://github.com/MuNET-OSS/AquaMai/tree/v1.7.5)
- [AquaMai legacy version support](https://github.com/MuNET-OSS/AquaMai/commit/3cfcab097bdb93d78e67f0f96d693e2e09e0c038)
- [AquaMai PR #99](https://github.com/MuNET-OSS/AquaMai/pull/99)
- [AquaMai Issue #88](https://github.com/MuNET-OSS/AquaMai/issues/88)
- [AquaMai 公开版本配置](https://munet-version-config-1251600285.cos.ap-shanghai.myqcloud.com/aquamai.json)
- [MelonLoader v0.7.0](https://github.com/LavaGang/MelonLoader/releases/tag/v0.7.0)
- [MelonLoader v0.6.4](https://github.com/LavaGang/MelonLoader/releases/tag/v0.6.4)
- [Sinmai-Assist](https://github.com/WYH2004-MC/Sinmai-Assist)
- [Sinmai-Assist README](https://github.com/WYH2004-MC/Sinmai-Assist/blob/master/README.md)
- [Sinmai-Assist Main.cs](https://github.com/WYH2004-MC/Sinmai-Assist/blob/master/Main.cs)
- [Sinmai-Assist MainConfig.cs](https://github.com/WYH2004-MC/Sinmai-Assist/blob/master/Config/MainConfig.cs)
- [Sinmai-Assist PrintUserData.cs](https://github.com/WYH2004-MC/Sinmai-Assist/blob/master/Common/PrintUserData.cs)
- [Sinmai-Assist build workflow](https://github.com/WYH2004-MC/Sinmai-Assist/blob/master/.github/workflows/main.yml)
- [Sinmai-Assist SDGB 登录分支](https://github.com/WYH2004-MC/Sinmai-Assist/blob/master/Common/DummyChimeLogin.cs)
- [Sinmai-Assist Issue #9：AutoPlay 与 AquaMai Slide 冲突](https://github.com/WYH2004-MC/Sinmai-Assist/issues/9)
- [Sinmai-Assist Issue #13：两边 CustomCameraId 冲突](https://github.com/WYH2004-MC/Sinmai-Assist/issues/13)
- [Sinmai-Assist Issue #18：旧配置导致 SDGB 1.51 启动失败](https://github.com/WYH2004-MC/Sinmai-Assist/issues/18)
- [Sinmai-Assist Issue #26：SDGB 1.55 共存测试](https://github.com/WYH2004-MC/Sinmai-Assist/issues/26)
