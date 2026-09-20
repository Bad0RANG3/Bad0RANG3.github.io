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
verifiedDate: 2026-09-21
difficulty: 进阶
audience: 任何一个有IQ的人
hasCode: true
hasDownload: false
---

这篇文章只处理一件事，把 HDD 里的游戏配置调到你能实际使用。我重新核对了 MaiChartManager `v26.5.1`、AquaMai `v1.7.5` 和 Sinmai-Assist 当前源码。结论很直接，SDEZ 可以走 MaiChartManager 这条省事路线，AquaMai 和 `AquaMai.toml` 都能在图形界面里管理。SDEZ 如果还要用 Sinmai-Assist，就得自己改源码适配。国服 SDGB 则需要自己构建 AquaMai `v1.7.5`，再配上 Sinmai-Assist。

AquaMai 和 Sinmai-Assist 把原本散落在 DLL、TOML、YML 和日志里的开关集中起来。调节判定、画面、输入、自动化测试和故障排查时，配置和回滚都集中在少数文件里，排查范围比逐个修改游戏程序集小得多。

本文不提供游戏安装包、ICF、keychip、PCB 文件、服务端凭据，也不涉及绕过授权、篡改 protected runtime 或破坏完整性校验。下面默认你已经合法拿到当前这台机器需要使用的系统盘和配套硬件。

## 先选路线

先看手里的盘属于哪一端，再决定装什么。

| 场景 | 推荐路线 | 是否需要改源码 | 本文的验证程度 |
| --- | --- | --- | --- |
| SDEZ，只装 AquaMai | MaiChartManager 在线安装或手动安装 | 不需要 | 已核对 MCM 源码行为 |
| SDEZ，还要 Sinmai-Assist | 手动构建并适配 SDEZ | 需要 | 静态工程方案 |
| SDGB，构建 AquaMai 1.7.5 | 克隆标签后本地构建 | 通常不需要 | 静态构建方案 |
| SDGB，还要 Sinmai-Assist | 基于当前 master 构建 | 基本沿用 SDGB 分支 | 静态工程方案 |

不要在同一台机器上同时追求“最新 MelonLoader、最新 AquaMai、最新配置、最新 Sinmai-Assist”。这套东西的兼容性靠版本组合，不靠每个文件单独最新。

本文写作时也没有目标 HDD、SDEZ 或 SDGB 的 `Managed` DLL，因此没有进行真实编译和游戏运行测试。涉及源码修改的部分都当作工程方案看，不能当成已经跑通的成品说明。

## 文件到底在干什么

先把常见目录和文件按职责分开。不同原盘的打包方式不完全一样，目录名可能变化，但这些角色的划分基本不变。

### `.app`、`.opt` 和 `Package`

`.app` 和 `.opt` 是 SEGA 使用的 fscrypt 容器，普通解压软件不能直接打开。

基础 `.app` 的外层是 NTFS，里面放着 `internal_0.vhd`。增量 `.app` 继续使用 `internal_1.vhd`、`internal_2.vhd` 这一串差分盘，后一层要和前一层连起来才是完整版本。`.opt` 通常装载 Option 数据，当前 `fsdecrypt` 会按 exFAT 直接解出内容。

游戏本体在内层 VHD 的 `Package` 目录。你会在这里看到 `Sinmai.exe`、`Sinmai_Data`、配置文件和启动脚本。

先看 `Sinmai_Data\Managed`。AquaMai 和 Sinmai-Assist 都要针对目标游戏的程序集编译，不能拿 SDEZ 的 DLL 去给 SDGB 构建，也不能把方向反过来。

### `amfs\ICF1`

这个目录属于游戏数据层。它和 Mod 的配置层职责不同。

本文只解释它在启动链里的位置，不教怎么制作、替换或绕过 ICF 校验。ICF 不匹配时，先检查游戏版本和整盘来源，不要把问题推给 MelonLoader。

### `AppData` 和 `Option`

`AppData` 更接近用户存档、账号状态和本机记录。`Option` 更接近机器设置和游戏选项。

调试 Mod 以前先备份这两块。Sinmai-Assist 的部分功能会读取或写出用户数据，误操作后很难只靠回滚 DLL 恢复。

### 四个 `config_*.json`

Maimai DX 常见的 segatools 配置会拆成几份 JSON。

- `config_common.json` 管通用网络和运行参数。
- `config_server.json` 管服务端地址和连接目标。
- `config_client.json` 管客户端身份、机台信息和启动参数。
- `config_hook.json` 管加载时的 hook 行为。

不同 fork 的字段名可能不同，所以不要只按文件名替换。打开文件看字段，确认它和当前启动器版本属于同一套。

这些文件经常包含敏感值。截图提问前先把凭据、地址、序列号和本地绝对路径处理掉。

### `mai2.ini` 和 `segatools.ini`

`mai2.ini` 更接近游戏侧参数，常见内容包括窗口、渲染、音频和路径。

`segatools.ini` 更接近启动器和注入层参数，常见内容包括组件路径、窗口行为、输入设备和 hook 选项。

两个 INI 名字相似，职责不要混在一起。某次改动无效，先确认自己改的文件真的被当前 `launch.bat` 调用。

### `launch.bat`

这个脚本就是启动链的目录。它会决定先启动什么、从哪个目录启动、传入哪些参数，以及最后拉起 `Sinmai.exe`。

排查启动问题时，先读 `launch.bat`，再读两个 INI。很多“配置没生效”只是脚本根本没指向你正在编辑的文件。

### `MelonLoader`

MelonLoader 是 Mod 加载器。AquaMai 和 Sinmai-Assist 都作为 MelonLoader Mod 工作。

MaiChartManager `v26.5.1` 打包的是 MelonLoader `0.6.4.0`。Sinmai-Assist README 也明确建议使用 `0.6.4` 或更低版本，并提醒更高版本可能崩溃。

AquaMai `v1.7.5` 的 README 则指向 MelonLoader `0.7.0`。这三条版本线索并不指向同一个加载器，目前也没有证据证明 AquaMai 和 Sinmai-Assist 能在同一个 Loader 上稳定共存。

可行的测试顺序是先以 MCM 自带的 `0.6.4.0` 作为受控起点，先分别验证 AquaMai 和 Sinmai-Assist。如果 AquaMai 在这个 Loader 下失败，再改用 `0.7.0` 测试，同时重新验证 Sinmai-Assist。不要把“两个 DLL 都被扫描到”当成共存成功。

版本问题不能只看“能不能注入”。注入成功以后，Harmony patch、游戏程序集版本和 IL2CPP 或 Mono 运行差异仍然可能让游戏崩溃。

### `Mods`、`AquaMai.dll` 和 `Sinmai-Assist.dll`

`Mods` 是 MelonLoader 扫描 Mod 的目录。`AquaMai.dll` 负责大多数配置项、补丁和游戏侧行为管理，`Sinmai-Assist.dll` 负责另一组运行时辅助、输入和结果处理能力。二者有功能重叠，后文会单独列出冲突边界，尤其不要同时让两套代码接管同一个 patch 点。

### `AquaMai.toml`

这是 AquaMai 的主配置。

AquaMai `v1.7.5` 使用配置版本 `2.4` 和配置 API `1.1`。运行时固定读取 `AquaMai.toml`，也可以用环境变量 `AQUAMAI_CONFIG` 覆盖路径。配置版本与 DLL 不匹配时，运行时会备份旧配置并尝试迁移。逐项猜字段容易浪费时间。

主配置缺失时，AquaMai 不会自动创建 `AquaMai.toml`。它会生成 `AquaMai.en.toml` 和 `AquaMai.zh.toml` 两个示例，记录错误，然后停止加载配置。选择其中一份，确认 `Version = "2.4"` 后整理成 `AquaMai.toml`，再重新启动游戏。

### `Sinmai-Assist\Config.yml`

这是 Sinmai-Assist 的配置。第一次运行应该让 DLL 自己生成新文件，不要直接复制仓库里的示例或别人的旧配置。

`safeMode: true` 会读取配置并记录游戏信息，然后在加载全部 patch 之前返回。它适合第一次确认注入是否正常。

`safeMode: false` 后会启用常规 patch，包括 `PrintUserData`、`InputManager` 和 `GameMessageManager`。第一次关闭安全模式时，不要同时把全部功能打开。

### `KeyBindConfig.yml`、`Unity.log` 和 `NetworkLogs`

`KeyBindConfig.yml` 管按键绑定。

`Sinmai-Assist\Unity.log` 每次启动都会删除并重建，适合看本次加载和报错。`NetworkLogs` 也可能包含请求内容。

`PrintUserData` 会把账号数据和访问码等内容写到 `Sinmai-Assist\UserData`。这些日志和目录都属于敏感数据，不要直接发到群里。

### 源码和构建文件

这张表对应本文实际会改到的文件。目录名可能因提交和原盘布局变化，文件名通常不变。

| 文件或目录 | 负责什么 | 操作时要注意什么 |
| --- | --- | --- |
| `build.ps1` | 在仓库根目录执行 `dotnet restore`、生成 `AquaMai\BuildInfo.g.cs`、调用 Release 构建 | 输出为 `Output\AquaMai.dll` 和示例配置，脚本本身不安装 Mod |
| `Libs` | 保存 `AquaMai.csproj` 要解析的游戏程序集 | 只能放目标区域的 DLL，SDEZ 和 SDGB 不能混用 |
| `Sinmai-Assist.csproj` | 旧式 `net472` MSBuild 工程，列出引用和待编译源码 | 当前无条件编译 `DummyChimeLogin.cs` 并引用 `ChimeLib.NET.dll`，SDEZ 必须改这里 |
| `Main.cs` | MelonLoader 入口，读取 `GameID`、配置并决定加载哪些 patch | `safeMode: true` 会在这里提前返回，登录分支也在这里选择 |
| `DummyChimeLogin.cs` | SDGB 使用的国服登录实现 | SDEZ 构建必须排除，否则会带着 SDGB 依赖一起编译 |
| `DummyAimeLogin.cs` | 通用 Aime 登录实现 | SDEZ 保留这一条，并在 `Main.cs` 中直接调用 |
| `CustomCameraId.cs` | 覆盖摄像头编号和分辨率，写入 `CameraManager` | 当前 SDEZ 分支会读取未初始化的 `_qrCameraParam`，必须修复或先关闭功能 |
| `ConfigManager.cs` | 读取 YAML 配置，文件不存在时生成模板 | 配置损坏会记录日志并抛异常，没有旧版本迁移逻辑 |
| `BeforeBuild.bat` | 构建前写入版本字段 | 脚本写的是 `..\BuildInfo.cs`，项目编译的却是仓库根 `BuildInfo.cs`，路径没有对上 |
| `PostBuild.bat` | 构建后打印提交哈希和时间 | 只打印信息，不复制 DLL 到游戏目录 |

Sinmai-Assist 仓库当前没有顶层 `build.ps1`。用 Visual Studio 或 MSBuild 构建，别把 AquaMai 的构建步骤套过来。

### 启动链

把启动链记成下面这条线就够用了。

1. 你运行 `launch.bat`。
2. 启动器读取 `segatools.ini` 和 `config_*.json`。
3. 游戏看到 `Package` 里的数据和 `amfs\ICF1`。
4. MelonLoader 先进入进程。
5. MelonLoader 扫描 `Mods`。
6. AquaMai 读取 `AquaMai.toml`。
7. Sinmai-Assist 读取 `Sinmai-Assist\Config.yml`。
8. 游戏开始初始化 AM Daemon、网络、输入和画面。

任何一步用错了版本，后面的日志都可能看起来很吓人。排查顺序应从最前面的启动器开始，不要先从最上面的 Mod 配置乱改。

## 先把 `.app` 和 `.opt` 解出来

本文以 `fsdecrypt v0.1.9` 为准。它不需要管理员权限，也不需要 Hyper-V。`v0.1.8` 开始支持直接读取 APP 外层的 NTFS、提取 `internal_N.vhd`，还会按 VHD 的父盘 GUID 自动接续增量包。`v0.1.9` 修了 OPTION 内部存在零字节文件时 exFAT 解包失败的问题。旧教程里的 `Set-VHD` 属于手工挂载 VHD 的流程，使用 `v0.1.8` 或更高版本时不需要，也不应该把它当成当前主步骤。

### 准备一组同源文件

在一个容量足够的独立工作目录里放齐下面的文件。

- 基础包，通常以 `_0.app` 结尾。
- 基础包到目标版本之间的全部增量包。缺一层，后面就接不上。
- 与目标版本配套的 `.opt`。

不要只拿最后一个增量包。`fsdecrypt` 会按 bootid 的序列号排序，再靠 VHD GUID 找父盘；链条中间缺文件时，它会把接不上的增量报告为 orphan，而不是替你猜出缺失内容。

下面把基础包、增量包和 Option 一次交给同一个进程。路径按你的实际文件名替换。

```powershell
Set-Location D:\dump

.\fsdecrypt.exe `
  ".\SDGB_1.55.00_xxx_0.app" `
  ".\SDGB_1.55.01_xxx_1_1.55.00.app" `
  ".\SDGB_A000_xxx.opt"
```

也可以只传增量包，前提是基础 `.app` 或已有的 base VHD 就在同一目录。手工按版本逐个运行时，先解基础包，再递增处理增量包，不要把顺序倒过来。

### 看懂解包结果

`fsdecrypt` 默认在输入文件旁边建立同名目录，目录名不带 `.app` 或 `.opt` 后缀。APP 输出里最关键的是内层 VHD 的 `Package`，它才是完整游戏本体。增量链处理完成以后，最终版本目录应当包含基础包加全部增量包合并后的文件，中间 `.vhd` 会被工具清掉。

OPTION 输出常见 `option` 目录和 `DataConfig.xml` 一类清单文件。把 `option` 的内容并入最终盘上的 `Option`，不要把 `.opt` 的解包根目录直接覆盖到 `Package`。

一个可用的 SDGB 目录可以整理成下面的结构。`ICF1` 来自与这版游戏配套的机器数据，不由 `.app` 解包产生。

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
```

`Package` 输出可以放到 `App\package` 下，Windows 不区分这里的目录名大小写。`launch.bat` 和 `segatools.ini` 最终要从 `package` 这一层工作，不要拿 APP 解包输出的最上层当游戏根目录。

### 安装 Mod 前先验收

先确认下面这些东西来自同一地区和同一版游戏，再装 MelonLoader、AquaMai 或 Sinmai-Assist。

- `Sinmai.exe` 与 `Sinmai_Data\Managed` 是同一份 APP 合并结果。
- `amfs\ICF1`、`Option` 和当前游戏版本属于同一套数据。
- 四个 `config_*.json`、两个 INI 与 `launch.bat` 来自同一份启动器配置。
- 没有把 SDEZ 和 SDGB 的文件混在同一目录，也没有用独立 DLL 覆盖包替换 `Sinmai.exe`、`amdaemon.exe` 或 `Assembly-CSharp.dll`。

这一步没通过时，Mod 日志里的报错没有参考价值。先恢复成一组完整的原始文件，再继续后面的安装。

## SDEZ 用 MaiChartManager 装 AquaMai

这是四条路线里最省事的一条。

MaiChartManager 已经把 MelonLoader、AquaMai、Mod 列表和配置编辑器放在一个界面里。对于只改 SDEZ 游戏设置的场景，没有必要自己搭 C# 工程。

本节结论基于 MaiChartManager `v26.5.1`。后续版本可能更换 MelonLoader，也可能改变签名策略，所以版本升级后要重新看界面提示。

### 安装前准备

先复制整个游戏目录，至少备份下面的内容。

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

如果 HDD 上已经有 `Mods\AquaMai.dll`、旧版 `AquaMai.toml` 或其他加载器，先记版本，不要直接覆盖。

MaiChartManager `v26.5.1` 使用的 MelonLoader 归档摘要如下。

```text
ABF9FBF5F89AC89AE59D45E69CBDD32BB45E0B28BC6876392640409292FC9416
```

这个摘要在当时对应 MCM 打包的 MelonLoader `0.6.4.0`。它只能帮助你确认文件是否一致，不能用来证明任意第三方文件安全。

### 在线安装

打开 MaiChartManager，指向 `Package` 目录。

先安装 MelonLoader。MCM 会检查目标目录和加载器状态，再安装桌面版或游戏版运行库。

再安装 AquaMai。在线安装和 MuMod 缓存安装都会校验 AquaMai 的 ECDSA 签名。签名不通过时，不要绕过界面提示，先确认下载源和版本。

安装完成后，`Mods\AquaMai.dll` 应该出现。回到 MCM 的 Mod 管理页，用配置编辑器修改并保存。MCM `v26.5.1` 会直接写入游戏根目录的 `AquaMai.toml`，这条路线不需要靠启动游戏生成主配置。

MCM `v26.5.1` 支持 AquaMai 配置 API `1.1`。AquaMai `v1.7.5` 也使用 API `1.1`，所以两者在配置模型上能对上。

配置 API 匹配不等于所有选项都能在任意游戏版本工作。配置项是否能生效，仍取决于目标游戏的程序集和 AquaMai 对该版本的适配。

### 手动安装自建 AquaMai

MCM `v26.5.1` 的手动安装逻辑会检查 PE 文件、.NET 目标和程序集里的 `ProductName`。它不会因为 DLL 没有有效签名就直接拒绝安装。

安装入口会把文件复制到下面的位置。

```text
Mods\AquaMai.dll
```

界面对未签名文件会显示红色证书警告，但仍然允许你确认。这个设计适合测试自己构建的 DLL。

配置读取是另一套逻辑。MCM 默认会拒绝签名无效的配置。界面里有跳过签名检查的选项，对应 `skipSignatureCheck`。你确实要管理自建 AquaMai 的配置时，才需要用到它。

手动安装和在线安装的能力边界要分清楚。

| 能力 | 在线安装 | 手动安装自建 DLL |
| --- | --- | --- |
| 安装 DLL | 需要有效签名 | 可以安装未签名 DLL |
| 安装时证书提示 | 正常校验 | 显示红色警告 |
| 编辑 AquaMai 配置 | 支持 | 默认拒绝无效签名，可选跳过检查 |
| MuMod 自动更新 | 支持有效签名包 | 不适合未签名自建包 |

自建 DLL 能手动放进 MCM，不代表它能进入在线更新链。后续版本如果改成更严格的策略，以当时的源码和界面为准。

### 推荐的 SDEZ 配置顺序

第一次配置时按下面顺序来。

1. 只安装 MelonLoader。
2. 确认游戏能启动到正常界面。
3. 安装 AquaMai，但先不要导入旧配置。
4. 在 MCM 中打开配置编辑器并保存一次，确认主配置写入成功。
5. 再修改少量设置。
6. 每轮只改一到三类参数。
7. 每次记录 DLL 版本、配置版本和改动内容。

最容易忽略的一点是配置版本。把 AquaMai `v1.7.5` 的配置版本 `2.4` 拿去配旧 DLL，或者把旧配置直接塞给新 DLL，都会让编辑器或游戏在解析阶段出错。

### SDEZ 的停止条件

只要出现下面情况，就停止继续加功能。

- 游戏无法进入主界面。
- MelonLoader 日志没有列出 AquaMai。
- AquaMai 日志提示配置版本错误。
- MCM 可以编辑配置，但游戏一启动就崩溃。
- 输入配置修改后出现持续按键。

这些情况先回到“只有 MelonLoader 和 AquaMai 的最小组合”，不要立刻加入 Sinmai-Assist。

## SDEZ 自建 Sinmai-Assist

Sinmai-Assist 当前源码以 SDGB 为主要目标。它没有正式 tag，也没有顶层许可证，README 建议 MelonLoader `0.6.4` 或更低。使用前要自己审源码，确认部署场景和许可边界。

本节基于提交 `ad5cdbe7365f79e2b21991f38e007682162a1787`。这是静态工程方案，当前没有完成 SDEZ 运行验证。

### 为什么原项目不能直接给 SDEZ 用

问题在编译期。`Sinmai-Assist.csproj` 会无条件编译 `Common\DummyChimeLogin.cs`，也会无条件引用 `Libs\ChimeLib.NET.dll`。`Main.cs` 只在 `GameID == "SDGB"` 时走 `DummyChimeLogin`，其他 ID 才走 `DummyAimeLogin`。运行时分支无法阻止编译器解析两个类型，SDEZ 仍会因为 ChimeLib 缺失或类型不匹配而失败。

`Common\CustomCameraId.cs` 还有一个独立问题。`SetCameraResolution` 只在 `GameID != "SDEZ"` 时初始化 `_qrCameraParam`，后面的 `SDEZ` 分支却读取 `_qrCameraParam.Width`、`.Height` 和 `.Fps`。开启 `CustomCameraId` 后这里会空引用。原项目已有 SDEZ 分支，但这条分支还没有完成。

### SDEZ 适配步骤

先固定源码版本。

```powershell
git clone https://github.com/WYH2004-MC/Sinmai-Assist.git
Set-Location .\Sinmai-Assist
git checkout ad5cdbe7365f79e2b21991f38e007682162a1787
```

从 SDEZ 游戏目录复制完整的 `Sinmai_Data\Managed` 到项目 `Libs`。不要只放 `Assembly-CSharp.dll`，`Sinmai-Assist.csproj` 还引用了输入、消息、网络、Unity 和 MelonLoader 相关程序集。构建报缺文件时，回到同一个 `Managed` 目录补齐，不要拿 SDGB 的同名 DLL 顶上。

接着处理 SDGB 专用编译链。

1. 从 `Sinmai-Assist.csproj` 删除或条件排除 `Common\DummyChimeLogin.cs`。
2. 从项目引用中删除或条件排除 `Libs\ChimeLib.NET.dll`。
3. 保留 `Common\DummyAimeLogin.cs` 和 `Common\CustomCameraId.cs`。
4. 修改 `Main.cs`，让 SDEZ 直接使用 `DummyAimeLogin`，并确保代码里不再出现 `DummyChimeLogin`。

SDEZ 专用分支可以把这个登录判断替换成下面的写法。

```csharp
if (File.Exists("DEVICE/aime.txt"))
{
    DummyLoginPanel.DummyLoginCode =
        File.ReadAllText("DEVICE/aime.txt").Trim();
}

Patch(typeof(DummyAimeLogin));
```

摄像头也有一个明确修复。把 `SetCameraResolution` 里原来的 `if (SinmaiAssist.GameID != "SDEZ")` 整块替换为下面的逻辑。

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

第一轮如果不想处理摄像头，可以在生成的配置里关闭 `CustomCameraId.Enable`，先完成登录和构建验证。这个选择不改变空引用缺陷，只是不让对应 patch 执行。

构建使用 Visual Studio，或者在 Developer Command Prompt、Developer PowerShell 中运行 MSBuild。

```powershell
msbuild .\Sinmai-Assist.sln /restore /p:Configuration=Release
```

`BeforeBuild.bat` 会把版本字段写到 `..\BuildInfo.cs`，但项目实际编译仓库根目录的 `BuildInfo.cs`。构建前要修正这个路径，或者手动更新项目根目录的文件，否则 DLL 里的版本信息可能不更新。`PostBuild.bat` 只打印提交哈希和时间，不会把 DLL 自动复制到游戏目录。Release 输出应出现在下面这个位置。

```text
Output\Sinmai-Assist.dll
```

把 DLL 放进 SDEZ 的 `Mods` 目录。第一次启动让程序生成 `Sinmai-Assist\Config.yml`，并把安全模式保持开启。

```yaml
safeMode: true
```

安全模式下确认 DLL 能被 MelonLoader 加载，并检查 `Sinmai-Assist\Unity.log`。日志里出现 `GameID`、配置读取记录，并且没有继续加载 patch，就说明 Mod 主入口已经到达，安全模式也按预期返回。

确认安全模式正常后，一次只打开一个 patch。先处理输入或消息这类影响面较小的项，再碰用户数据、结果保存、自动打歌和摄像头。

### SDEZ 侧的最低验收

不要只看“游戏能进”。至少记录下面四项。

- MelonLoader 是否列出 Sinmai-Assist。
- 安全模式是否在 patch 前返回。
- 日志里是否出现 SDEZ 的 `GameID`。
- 关闭安全模式后，哪些 patch 被加载，哪些 patch 被跳过。

如果编译成功但运行时缺少类型，通常是引用来自另一版本的游戏。如果编译失败但错误集中在 `ChimeLib.NET` 或 `DummyChimeLogin`，说明 SDGB 隔离还没做干净。

## SDGB 自建 AquaMai 1.7.5

国服 SDGB 的路线需要固定 AquaMai 版本。这里选 `v1.7.5`，对应标签提交 `4919d4f060d6bae6e5e29792dd3c4da713a2db9d`。

这个版本早于 MuMod 自动更新机制。你从源码构建的 DLL 不会自动进入官方更新链，后续也不会替你自动升级。固定版本能避免后台自动替换。

### 准备源码

先在合适的工作目录克隆标签。

```powershell
git clone --branch v1.7.5 --depth 1 https://github.com/MuNET-OSS/AquaMai.git
Set-Location .\AquaMai
```

确认 HEAD 指向标签提交。

```powershell
git rev-parse HEAD
```

目标提交应为下面这个值。

```text
4919d4f060d6bae6e5e29792dd3c4da713a2db9d
```

### 准备游戏引用

AquaMai `v1.7.5` 是 `net472` 项目，Windows 侧需要先安装 .NET Framework 4.7.2 Developer Pack。`build.ps1` 会执行 `dotnet restore`、生成 `AquaMai\BuildInfo.g.cs`，再调用 Release 构建。`AquaMai.csproj` 会从相对的 `Libs` 目录查找游戏引用。

根据仓库 README，至少要放入目标游戏的下面两个程序集。

```text
Assembly-CSharp.dll
AMDaemon.NET.dll
```

完整命令可以写成这样。路径按你本机的 SDGB 目录替换。

```powershell
New-Item -ItemType Directory -Force .\Libs

Copy-Item `
  "D:\maimai\SDGB\App\package\Sinmai_Data\Managed\Assembly-CSharp.dll" `
  .\Libs\

Copy-Item `
  "D:\maimai\SDGB\App\package\Sinmai_Data\Managed\AMDaemon.NET.dll" `
  .\Libs\
```

如果构建过程提示缺少其他程序集，回到同一个 `Managed` 目录补齐，并记录缺失类型。不要把 SDEZ 的同名 DLL 混进来。

### 构建 AquaMai

运行仓库自带脚本。

```powershell
.\build.ps1
```

成功后会得到下面这个文件。

```text
Output\AquaMai.dll
```

构建脚本能通过只说明引用解析和 C# 编译通过。SDGB 补丁是否在每个游戏版本稳定工作，还要靠目标盘运行验证。

AquaMai 的 PR #99 曾展示 SDGB151 和 EZ156、EZ160 相关模块测试证据。那些证据可以作为某次适配的线索，不能写成对所有 SDGB 版本的兼容承诺。

### 安装到 SDGB

先停止游戏和相关启动器，备份旧的 `Mods\AquaMai.dll` 和 `AquaMai.toml`。

把新构建的 `Output\AquaMai.dll` 复制到 `Mods\AquaMai.dll`。

如果 `AquaMai.toml` 来自旧版 AquaMai，先把它改名备份，或者移到配置目录之外。不要直接把旧配置留给新 DLL 解析。

启动一次游戏。缺少主配置时，AquaMai 只会生成 `AquaMai.zh.toml` 和 `AquaMai.en.toml` 示例，不会自动创建 `AquaMai.toml`。

打开模板确认配置版本。

```toml
Version = "2.4"
```

确认版本正确后，选择一份示例整理成游戏根目录的 `AquaMai.toml`，再重新启动游戏。不要把配置版本 `2.3` 和 AquaMai `v1.7.5` 配在一起。

### 是否能用 MaiChartManager 管理

可以手动安装，也可以让 MCM 管理配置，但要接受未签名警告。

AquaMai `v1.7.5` 本地构建得到的是未签名 DLL。MCM `v26.5.1` 的在线安装和 MuMod 缓存安装会要求有效 ECDSA 签名，本地包不符合这个条件。

手动安装路径会直接把文件复制到 `Mods\AquaMai.dll`，所以可以用。界面会提示证书无效，确认时要明确知道自己在安装本地构建。

如果还要打开配置编辑器，需要在 MCM 中允许跳过签名检查。配置 API 匹配以后，编辑器才能按 `1.1` 的模型读取这个自建 DLL。

这条路线只适合固定版本。等 SDGB 游戏本体升级后，应该重新拉取对应 AquaMai 源码、补引用、构建，再重新生成配置，不能指望 MuMod 自动把冻结版本替换掉。

### SDGB AquaMai 的最低验收

先只保留 AquaMai，不装 Sinmai-Assist。

- 确认 MelonLoader 能加载 `Mods\AquaMai.dll`。
- 确认游戏生成了配置模板。
- 确认配置版本是 `2.4`。
- 确认修改一个低风险选项后能生效。
- 确认关闭游戏后日志没有重复 patch 或加载两个 AquaMai。

这一轮通过以后，再处理 Sinmai-Assist。

## SDGB 自建 Sinmai-Assist

SDGB 这条路比 SDEZ 直接。项目原本就保留了 `ChimeLib.NET`、`DummyChimeLogin.cs` 和 SDGB 分支，不需要把国服登录逻辑拆掉。

但这条路线仍然没有正式 release，也没有顶层许可证。构建者需要自己审查代码、输入数据和运行权限。

### 准备引用与源码

先克隆当前提交。

```powershell
git clone https://github.com/WYH2004-MC/Sinmai-Assist.git
Set-Location .\Sinmai-Assist
git checkout ad5cdbe7365f79e2b21991f38e007682162a1787
```

项目目标同样是 `net472`，使用的 MelonLoader 包为 `0.6.4`，Harmony 为 `2.10.1`。

把 SDGB 的 `Sinmai_Data\Managed` 相关引用放入项目 `Libs`，再补上 SDGB 需要的插件引用。第一轮不要删除 `ChimeLib.NET.dll`。

这个仓库当前没有顶层 `build.ps1`。使用 Visual Studio 打开 `Sinmai-Assist.sln`，或者在 Developer Command Prompt、Developer PowerShell 中运行下面的命令。

```powershell
msbuild .\Sinmai-Assist.sln /restore /p:Configuration=Release
```

`BeforeBuild.bat` 当前写入的路径和项目编译的 `BuildInfo.cs` 不一致，构建前要修正路径或手动更新文件。`PostBuild.bat` 只打印提交哈希和构建时间，不会复制 DLL。如果 MSBuild 还原依赖失败，优先检查 Visual Studio 的 .NET Framework 4.7.2 开发组件，再检查 `Libs` 是否完整。

成功输出在下面这个位置。

```text
Output\Sinmai-Assist.dll
```

### 安装和第一次启动

先备份 SDGB 原有的下面几个位置。

```text
Mods\Sinmai-Assist.dll
Sinmai-Assist\Config.yml
Sinmai-Assist\KeyBindConfig.yml
Sinmai-Assist\UserData
Sinmai-Assist\NetworkLogs
```

把新 DLL 放到下面这个位置。

```text
Mods\Sinmai-Assist.dll
```

第一次启动时让程序生成新的 `Config.yml` 和 `KeyBindConfig.yml`。不要复制仓库示例，也不要直接套用别人机器上的配置。

生成配置后先打开安全模式。

```yaml
safeMode: true
```

启动游戏并检查 `Sinmai-Assist\Unity.log`。

日志能确认加载，配置也能读到时，再关闭安全模式。关闭以后一次只打开一个功能，尤其不要同时启用自动打歌、Cake hash 处理、特殊数字处理、证书处理和结果保存。

### SDGB Sinmai-Assist 的最低验收

- 安全模式下能加载。
- 关闭安全模式后仍能进入游戏。
- 输入相关 patch 不产生持续按键。
- 消息相关 patch 不导致黑屏或断线。
- `UserData` 和 `NetworkLogs` 的生成位置符合预期。
- 出现异常时能通过恢复备份迅速回到原始 DLL 和配置。

达到这些条件以前，不要开始和 AquaMai 做联合调试。

## 两个 Mod 不能抢同一个补丁位

AquaMai 和 Sinmai-Assist 的功能范围有重叠。重叠区域包括加密、认证、Cake hash、SpecialNum、证书、摄像头、AutoPlay 和结果保存。

两个 Mod 都能加载，不代表两个 patch 都应该打开。每块行为只能有一个负责人。

| 功能区域 | 推荐做法 |
| --- | --- |
| 登录与认证 | 只保留一套实现，另一套关闭 |
| 加密与 Cake hash | 不叠加，先确认哪一套适应当前游戏版本 |
| 摄像头 | 不要在 AquaMai 和 Sinmai-Assist 中同时开 |
| AutoPlay | 只保留一套核心控制 |
| 结果保存 | 验证稳定前关闭自动写入 |
| 输入 patch | 先只开一套，确认无重复按键再加下一套 |

AquaMai 的 `FixSlideAutoPlay` 与 Sinmai-Assist AutoPlay 会有直接冲突。这个组合应该避免。

自定义摄像头 ID 也一样。两套实现都启用时，后加载的 patch 可能覆盖前面的行为，日志里还不一定报错。

最稳的顺序是先只验证 AquaMai。AquaMai 正常加载、配置可改、游戏可启动以后，再把 Sinmai-Assist 放到安全模式。确认安全模式正常，再逐项打开所需功能。

如果必须同时使用两套，给每个功能写清负责人。比如输入归 AquaMai，结果处理归 Sinmai-Assist，就不要让另一边也打开同名或同语义的补丁。

## 运行验证表

下面这张表适合每次换 DLL 或配置时填一遍。

| 检查项 | 记录内容 |
| --- | --- |
| 游戏区域 | SDEZ 或 SDGB |
| 游戏版本 | Package 中记录的版本 |
| 启动器 | segatools 或当前启动包版本 |
| MelonLoader | 实际版本 |
| AquaMai | DLL 版本或提交 |
| AquaMai 配置 | 配置版本与 API |
| Sinmai-Assist | DLL 提交或构建时间 |
| Sinmai-Assist 配置 | `safeMode` 和启用的 patch |
| 启动结果 | 到主界面、黑屏、闪退或报错 |
| 日志位置 | 本次启动对应的日志文件 |

先备份，再改一项，再记录结果。一次修改很多东西，失败以后只能全部回滚。

## 常见故障怎么切

排障先判断故障停在哪一层。下面这些日志路径都以 `launch.bat` 当前工作目录为基准，不要在反编译输出目录或旧备份里找。

| 停在哪一层 | 这次启动应该留下什么 | 第一处检查 | 还不能继续的信号 |
| --- | --- | --- | --- |
| 解包 | 最终目录里有 `Package`，OPTION 有对应清单 | `fsdecrypt` 控制台输出 | 报 orphan、没有 base、内部 VHD 提取失败 |
| 认证和启动 | `amdaemon` 稳定运行，随后拉起 `Sinmai.exe` | `launch.bat`、两个 INI、四个 JSON | `amdaemon` 刚出现就退出，或没有拉起 Sinmai |
| MelonLoader | `MelonLoader\Latest.log` 在本次启动时更新 | 日志修改时间和启动段 | 没有日志，或日志还是上一次启动的内容 |
| AquaMai | 日志进入配置加载和 patch 阶段，游戏还能到界面 | `Latest.log`、`Errorlog` | 找不到主配置、配置解析失败、重复 patch |
| Sinmai-Assist | `Latest.log` 出现 `GameInfo` 和 `Config Load Complete`，`Sinmai-Assist\Unity.log` 在本次启动时新建 | `Latest.log`、`Unity.log`、`Config.yml` | 初始化失败、安全模式前就崩溃、patch 失败 |
| 两个 Mod 共存 | 每类行为只有一个负责人 | 两边的配置和 `Latest.log` | 两边同时开启登录、AutoPlay、摄像头或结果处理 |

### 解包阶段报错

`WARNING: No base (seq=0) found` 表示当前目录里没有基础 `.app`，也没有已经解出的 base VHD。把基础包和从它到目标版本的全部增量包放进同一个工作目录，再重新运行。只拿最后一个增量包接不上。

输出里出现 `orphan`，表示某些增量没有被接进 VHD 链，后面的报错写着缺少父 VHD。此时不完整的结果不要拿去覆盖可运行的 `Package`。按文件名里的版本顺序补齐所有中间增量包，确认没有漏掉某一层，再重新执行。

`Failed to extract internal VHD` 需要继续看它后面的底层错误。`No NTFS partition found in VHD` 说明拿到的东西不是当前工具能够识别的游戏 VHD，常见来源是链条接错、文件损坏或把别的容器改成了 `.vhd`。`Unsupported VHD type` 和 `Invalid dynamic VHD header` 更像文件本身不受支持或已经损坏。换回同一版本的原始文件，不要用人工改名或拼文件继续。

`Failed to extract exfat contents` 常见于旧版 `fsdecrypt` 处理含零字节文件的 OPTION。本文使用 `v0.1.9`，它专门修过这一类问题。换成 `v0.1.9`，重新解原始 `.opt`，然后检查输出里有没有 `option` 目录和 `DataConfig.xml` 一类清单文件。

解包完成的通过条件很简单。APP 的最终目录里应有完整 `Package`，中间 `.vhd` 已经被合并处理掉。OPTION 的内容应归入最终盘的 `Option`，不要把 `.opt` 的输出根目录直接盖到 `Package`。

### `amdaemon` 一闪就没了

先让启动窗口不要自动关闭。在游戏根目录打开命令提示符，然后运行下面这条命令。

```powershell
cmd.exe /k .\launch.bat
```

保留窗口以后，先看它是主动退出，还是根本没找到要启动的程序。接着检查 `segatools.ini`、`config_*.json` 和 `launch.bat` 是否属于同一套启动器，再检查 `Package` 与 `amfs\ICF1` 是否来自同一份游戏数据。路径里只改一个目录名，也可能让 VFS 指向空位置。

如果换成纯原始启动器和原始游戏目录仍然失败，把 Mod 全部放到一边。本文不提供 keychip 或授权绕过方案，这一层需要先确认手里的硬件和数据完整。

### MelonLoader 阶段没有日志

先看 `MelonLoader\Latest.log` 的修改时间。旧日志存在不代表这次加载成功。把 `Mods` 整体移走，只保留 MelonLoader，再启动一次。如果游戏能到界面，而 `Latest.log` 更新并记录了本次进程，说明 Loader 和游戏本体至少能一起工作。

如果移除全部 Mod 后依然黑屏，而且没有新的 `Latest.log`，问题已经落在 Loader 之前的启动层或运行环境。回调原始程序和 `launch.bat`，不要继续修改 DLL 和 TOML。确认 VC++ 运行库、.NET Framework、显卡驱动和杀毒软件隔离记录，再重新安装与当前包配套的 MelonLoader。不要拿它和别的 MelonLoader 版本覆盖混装。

### AquaMai 报配置错误

AquaMai 找不到主配置时，`MelonLoader\Latest.log` 会出现 `AquaMai.toml not found! Please create it.`，同时在工作目录生成 `AquaMai.en.toml` 和 `AquaMai.zh.toml`。选一份复制或改名为 `AquaMai.toml`，确认 `Version = "2.4"`，再启动。

旧配置版本会留下 `AquaMai.toml.old-v{版本}.` 备份，程序随后尝试迁移。迁移失败时，不要继续手改一只半旧的配置。保留备份，从当前 DLL 生成的新示例重新整理主配置，再把确实需要的选项搬过去。

日志里出现 `Patch: {type} failed.`，后面还跟着 `Failed to patch some methods.`，说明 DLL 已经加载，但目标方法没按预期打上补丁。先把 AquaMai 以外的 Mod 全部移走，确认 `Assembly-CSharp.dll` 是目标区服和目标版本的原文件，再检查当前配置有没有开启超出该游戏版本支持范围的项目。构建成功不代表运行时 patch 一定成功。

### Sinmai-Assist 报配置错误

YAML 损坏时，日志会记录 `Load Config ... Failed`，并提示删除配置后重启，随后初始化提前返回。关掉游戏，把 `Sinmai-Assist\Config.yml` 改名备份，让 DLL 重新生成默认配置。不要一边保留坏 YAML，一边反复开安全模式。

初始化异常时还会出现 `Error initializing mod config`。这一类错误应看 `Sinmai-Assist\Unity.log` 中同一时间段的完整异常，确认是配置文件损坏、权限问题，还是程序集不匹配。SDEZ 自建版本如果打开了 `CustomCameraId`，先关掉它，避开当前源码里 `_qrCameraParam` 未初始化的问题，再做登录和 patch 验证。

确认 DLL 能加载以后，先把 `safeMode: true` 跑通。日志里应出现 `Safe mode is enabled, Disable all patch`，游戏也应正常进入界面。关闭安全模式后一次只开一项，出现 `Patch: ... failed.` 就立即退回上一份配置。

### Sinmai 停在黑屏

黑屏按启动链逐层恢复，每层只增加一个变量。

1. 把整个 `Mods` 目录改名为 `Mods.off`，重新启动。能进主界面就继续，仍然黑屏就回到认证和启动层。
2. 恢复一个空的 `Mods` 目录，只保留 MelonLoader。`Latest.log` 更新并记录本次启动，才继续安装 Mod。再把原来的 `Mods.off` 留作回退点。
3. 只放 `AquaMai.dll`。缺少 `AquaMai.toml` 时先按日志生成的主配置整理好，再启动。能进界面说明 AquaMai 的加载和基础 patch 至少没有让游戏立即崩溃。
4. AquaMai 稳定后，只加 `Sinmai-Assist.dll`，配置保持 `safeMode: true`。确认 `Latest.log` 出现 `GameInfo`、`Config Load Complete` 和安全模式提示，`Unity.log` 也在本次启动时新建，再结束这一轮。
5. 最后才关闭 Sinmai-Assist 安全模式并逐项启用功能。登录与认证、Cake hash、SpecialNum、证书、摄像头、AutoPlay 和结果保存不要两套同时开。出现黑屏时，回到上一个能进界面的配置。

如果原始游戏在黑屏前完全没有窗口，重点看 `amdaemon`、VFS、ICF 和启动脚本。如果已经出现游戏窗口或厂商标志后才黑屏，重点看 `Latest.log`、`Errorlog` 和 `Unity.log`。如果安全模式能进、关闭后不能进，问题就在 Sinmai-Assist patch。如果 AquaMai 自己进不去，不要继续加入第二个 Mod。

### MaiChartManager 提示证书无效

- 如果你在手动安装自己构建的 AquaMai，这个提示是预期行为。
- 确认 DLL 来源，确认目标路径，再决定是否继续。
- 如果要编辑配置，再决定是否打开忽略签名检查。

在线安装和 MuMod 自动更新仍会要求有效签名，不要期待未签名自建 DLL 获得同样待遇。

### 构建时报缺少程序集

回到目标游戏自己的 `Managed` 目录补齐引用。

记录缺失的程序集名称和提出要求的源文件。

不要从另一个区域拿同名 DLL 填空。SDEZ 和 SDGB 的程序集版本可能同名但内容不同。

### 构建成功，游戏启动即崩

- 先把 Mod 移出 `Mods`，确认原始游戏正常。
- 再把 MelonLoader 和单个 DLL 放回，检查加载日志。
- 检查 AquaMai 和 Sinmai-Assist 是否同时 patch 了同一区域。
- 检查配置是否来自另一个版本。
- 检查 MelonLoader 是否高于项目要求。

### 日志里有账号数据

立即停止分享日志。

`Sinmai-Assist\UserData`、`Unity.log` 和 `NetworkLogs` 都可能包含敏感内容。

需要发日志时只截取加载版本、错误类型和调用栈，不要带账号、访问码、地址和本地用户名。

## 四条路线的最终做法

1. **SDEZ + MCM + AquaMai**。用 MCM 安装 MelonLoader 和签名有效的 AquaMai，在配置编辑器里保存并调整 `AquaMai.toml`。先把单 Mod 跑到主界面，再考虑第二个 Mod。
2. **SDEZ + 自建 Sinmai-Assist**。固定提交，移除 SDGB 专用文件和 `ChimeLib.NET.dll` 引用，改用 SDEZ 的 `Managed` 程序集构建。先跑 `safeMode: true`，确认加载和日志，再逐项打开功能。
3. **SDGB + 自建 AquaMai 1.7.5**。从标签提交构建，把 SDGB 的 `Assembly-CSharp.dll` 和 `AMDaemon.NET.dll` 放进 `Libs`，运行根目录的 `build.ps1`，再把 `Output\AquaMai.dll` 放进 `Mods`，整理好主配置后启动。
4. **SDGB + 自建 Sinmai-Assist**。保留 ChimeLib 和 SDGB 登录分支，使用 SDGB 引用构建，生成全新配置，先开安全模式，再逐项验证。

长期可用的做法是把每台机器的游戏版本、Loader、DLL、配置版本和已启用 patch 记在同一份清单里。

## 来源与核验边界

- [fsdecrypt `v0.1.9`](https://gitea.tendokyu.moe/beerpsi/fsdecrypt/releases/tag/v0.1.9)。`v0.1.8` 加入 NTFS/APP 直接提取、增量自动合并和 VHD GUID 链解析，`v0.1.9` 修复 exFAT OPTION 的零字节文件提取。
- [MaiChartManager `v26.5.1`](https://github.com/MuNET-OSS/MaiChartManager/tree/v26.5.1)。重点核对 `Controllers\Mod` 下的安装和配置逻辑，以及前端 `AquaMaiManualInstaller.tsx` 和 `ConfigEditor.tsx`。
- [AquaMai `v1.7.5`](https://github.com/MuNET-OSS/AquaMai/tree/v1.7.5)。标签提交为 `4919d4f060d6bae6e5e29792dd3c4da713a2db9d`。
- [Sinmai-Assist 当前提交](https://github.com/WYH2004-MC/Sinmai-Assist/commit/ad5cdbe7365f79e2b21991f38e007682162a1787)。重点核对 `Main.cs`、`Sinmai-Assist.csproj`、`DummyChimeLogin.cs`、`DummyAimeLogin.cs`、`CustomCameraId.cs`、`ConfigManager.cs` 和两个构建脚本。

本文完成于 2026-09-21。fsdecrypt、AquaMai、Sinmai-Assist 和 MaiChartManager 都在持续变化，文中涉及版本、签名、配置 API 和构建入口的内容，以你实际使用的提交为准。
