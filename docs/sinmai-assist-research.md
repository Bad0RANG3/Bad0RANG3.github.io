# Sinmai-Assist 项目研究与配置指南

> 研究快照：2026-09-18
>
> 主仓库：<https://github.com/WYH2004-MC/Sinmai-Assist>
>
> 默认分支：`master`
>
> 最新提交：`ad5cdbe7365f79e2b21991f38e007682162a1787`，2026-04-09
>
> 未合并修复分支：`origin/23-使用fastskip的custom模式miss数量异常`，HEAD `60f54b5`，2026-06-13
>
> 运行时结论未实测：本机没有对应的游戏 HDD、匹配的 `Assembly-CSharp.dll`、`AMDaemon.NET.dll` 和 MelonLoader 运行环境，因此本文的“能加载”“能否运行”均以源码、README、Release/tag、Issue/PR、CI 文件为依据；没有实际启动游戏验证。

## 结论摘要

| 问题 | 结论 | 证据等级 |
| --- | --- | --- |
| 它是什么 | MelonLoader 的 maimai DX `Sinmai.exe` 修改 Mod，README 自己定义为 cheat Mod | 已证实 |
| 是否 BepInEx 插件 | 不是。源码使用 MelonLoader 和 Harmony | 已证实 |
| MelonLoader 版本 | README 明确要求 `0.6.4` 或更低，更高版本会崩溃；工程引用也是 0.6.4 | 已证实 |
| 是否有正式 Release/tag | 当前仓库没有 tag，也没有 Release | 已证实 |
| 是否有公开自动更新 | 没有。仓库内没有 updater 或自动下载后续 DLL 的逻辑 | 已证实 |
| 是否有顶层 LICENSE | 没有找到 `LICENSE`、`COPYING` 或 `NOTICE` | 已证实 |
| 是否仍写有 SDGB 代码路径 | 有。`Main.cs` 对 `GameID == "SDGB"` 使用 `DummyChimeLogin`，`CustomCameraId` 也有 SDGB 分支 | 已证实 |
| 是否等于正式支持 SDGB | 不等于。2024-11-22 有提交“移除对国服的支持”，移除了 `ForceIsChinaBuild` 和 SDGB 专用 `DummyChimeLogin` 加载框架；后续文件被重新加入，但没有新的正式支持声明 | 源码事实加合理推断 |
| 能否与 AquaMai 同时安装 | 文件层面可以同时放在 `Mods`，Issue 中也有 `Sinmai-Assist + AquaMai` 同时使用的记录；但大量 patch 重叠，不建议默认同时启用两边的同类功能 | 已证实有共存案例，完整兼容性未证实 |
| 与 AquaMai 的主要冲突 | `RemoveEncryption`、`FixCheckAuth`、Cake 检查、SpecialNum、证书验证、ForceAsServer、CustomCameraId、网络日志和结算 patch 等存在重叠 | 已证实 |
| SDGB 1.51/1.53/旧 DLL 是否获正式支持 | 没有正式的版本支持矩阵。Issue 中有 SDGB 1.51、1.53、1.55 的使用或编译报告，但这不等于当前 master 支持 | 用户报告，非官方支持承诺 |
| 当前源码最适合什么策略 | 固定 commit 或固定已验证二进制；先用最小配置；不要直接使用仓库里可能过期的 `Config.yml` | 合理推断 |

## 1. 项目定位、许可证、依赖与目标环境

### 1.1 项目定位

`Sinmai-Assist` 是面向 maimai DX `Sinmai.exe` 的 MelonLoader Mod。README 的原文是：

> `This is a cheat Mod, using by your own risk.`

来源：

- README: <https://github.com/WYH2004-MC/Sinmai-Assist/blob/ad5cdbe7365f79e2b21991f38e007682162a1787/README.md>
- 程序集入口: <https://github.com/WYH2004-MC/Sinmai-Assist/blob/ad5cdbe7365f79e2b21991f38e007682162a1787/Main.cs>
- 配置模型: <https://github.com/WYH2004-MC/Sinmai-Assist/blob/ad5cdbe7365f79e2b21991f38e007682162a1787/Config/MainConfig.cs>

它不是启动器，也不是 HDD 解密、密钥注入或联机服务器本身。它只负责在游戏已经被正确启动后，通过 MelonLoader/Harmony 修改运行中的托管方法。

### 1.2 许可证

在 `ad5cdbe` 的完整 Git tree 中没有以下文件：

- `LICENSE`
- `COPYING`
- `NOTICE`

因此不能把“公开仓库”直接理解为已获得明确的复制、修改、再发布授权。程序运行时横幅写了 “free and open-source mod”，但这不是仓库中的许可证文本，也不等于授予再分发权利。

结论：**没有找到明确许可证。默认按“保留所有权利、未额外授权”处理更稳妥。**

这不是法律意见；如果准备分发、打包进镜像或在商用环境部署，应先向作者确认授权。

### 1.3 依赖

| 依赖 | 版本/用途 | 来源 |
| --- | --- | --- |
| MelonLoader | README 要求 `0.6.4` 或更低；csproj 引用 `LavaGang.MelonLoader 0.6.4` | README、`Sinmai-Assist.csproj` |
| Harmony | `0Harmony 2.10.1.0`，所有 patch 的核心 | `Sinmai-Assist.csproj` |
| .NET Framework | 目标为 `v4.7.2` | `Sinmai-Assist.csproj` |
| YamlDotNet | `16.1.0`，读取 `Config.yml` 和 `KeyBindConfig.yml` | csproj、Fody 配置 |
| EmbedIO / Swan.Lite | `EmbedIO 3.5.2`、`Swan.Lite 3.1.0`；Fody 配置只明确合入 `YamlDotNet` 和 `EmbedIO` | csproj、`FodyWeavers.xml` |
| ILMerge.Fody / Fody | 合并依赖 | csproj、`FodyWeavers.xml` |
| ChimeLib.NET | 可选依赖；SDGB 的 `DummyChimeLogin` 会直接使用它 | `AssemblyInfo.cs`、`DummyChimeLogin.cs` |
| 游戏依赖 | `AMDaemon.NET`、`Assembly-CSharp`、`Assembly-CSharp-firstpass`、Unity 模块 | csproj |

没有发现 BepInEx 依赖或 BepInEx 插件入口。

### 1.4 目标游戏和区域

程序通过 `ConstParameter.GameIDStr` 获取 `GameID`：

```csharp
GameID = (string)typeof(ConstParameter).GetField("GameIDStr", ...).GetValue(null);
GameVersion = (uint)typeof(ConstParameter).GetField("NowGameVersion", ...).GetValue(null);
```

当前 `Main.cs` 的实际分支：

```csharp
if (GameID.Equals("SDGB"))
{
    Patch(typeof(DummyChimeLogin));
}
else
{
    ...
    Patch(typeof(DummyAimeLogin));
}
```

`CustomCameraId` 也区分：

- `SDGB`：使用 Chime/二维码摄像头配置。
- `SDEZ`：分别处理左右 QR 摄像头。
- 其他 GameID：退化为单个 Photo 摄像头。

但仓库历史又存在相反方向的证据：

- `5d87f769`，2024-11-22，提交标题为“移除对国服的支持”。
- 该提交删除了国服专用 `DummyChimeLogin.cs`、`ForceIsChinaBuild` 配置和 SDGB 判别框架。
- 后来 `DummyChimeLogin.cs` 又被加回，2025-04-14 的 README 还增加了 “Please use SDGB version library” 的构建提示。

因此应这样表述：

- **已证实**：当前源码有 SDGB 专用分支。
- **已证实**：仓库曾明确移除国服支持。
- **已证实**：README 建议开发时使用 SDGB 版本的库。
- **未证实**：当前 master 对某个具体 SDGB 版本获得了作者官方支持。
- **合理推断**：SDGB 应被视为“有遗留分支和用户实测，但无正式支持矩阵”的实验性目标。

### 1.5 版本边界

当前源码只有少量版本门控：

- `DisableEnvironmentCheck` 仅对 `GameVersion >= 25000` 加载。
- `UnlockMaster` 的一个实现范围是 `00000..25000`。
- `UnlockMaster` 的另一个实现要求 `>= 26000`。
- 启动时如果 `GameVersion < 24000`，只打印“未经测试”的警告，不会阻止 patch。

这意味着：

- 不能把“低于 24000 仍会加载”理解为支持旧游戏。
- 也不能把 1.51、1.53、1.55 的用户报告写成完整兼容性承诺。
- 不同区域、不同游戏数据版本、不同 `Assembly-CSharp.dll` 可能直接导致 Harmony 找不到目标方法。

## 2. 安装、目录结构、配置和加载确认

### 2.1 前置条件

只使用自己合法取得的游戏 HDD 和匹配版本的官方运行文件。本文不提供游戏数据、密钥、账号伪造、成绩注入或授权绕过步骤。

### 2.2 推荐安装流程

1. 关闭 `Sinmai.exe` 和残留的 MelonLoader 进程。
2. 备份整个游戏目录，至少备份 `Assembly-CSharp.dll`、`AMDaemon.NET.dll`、`Mods` 和已有配置。
3. 确认游戏目录中的 `Sinmai.exe` 与 `Assembly-CSharp.dll` 属于同一区域、同一版本。
4. 安装 **MelonLoader 0.6.4 或更低**。不要按当前 AquaMai README 的 MelonLoader 0.7.0 直接替换，除非已单独验证两个 Mod 和该 AquaMai 构建能一起工作。
5. 创建 `Mods` 目录，把二进制 `Sinmai-Assist.dll` 放入其中。
6. 如果使用 SDGB 的 `DummyLogin` 路径，准备匹配版本的 `ChimeLib.NET`；否则不要启用需要它的功能。
7. 第一次启动时不要手工复制仓库里的旧 `Config.yml`。让 Mod 生成默认配置，然后关闭游戏再编辑。
8. 先只启用最小的启动/网络 patch，确认能进游戏，再逐项启用功能。

README 当前把 DLL 目标直接写成：

```text
Mods/Sinmai-Assist.dll
```

### 2.3 目录结构

Mod 初始化时会创建并维护以下内容：

```text
<游戏根目录>/
├─ Sinmai.exe
├─ Mods/
│  └─ Sinmai-Assist.dll
└─ Sinmai-Assist/
   ├─ Config.yml              # 首次运行自动生成
   ├─ KeyBindConfig.yml       # 首次运行自动生成
   ├─ Unity.log               # 每次启动会清空/重建
   ├─ WebCameraList.txt       # 每次启动会重建
   ├─ NetworkLogs/
   │  └─ YYYY-MM-DD.log       # 仅 NetworkLogger 启用时写入
   ├─ UserData/
   │  └─ User<ID>.txt         # 由默认加载的 PrintUserData 写入
   └─ UserBackup/
      └─ User<ID>-<timestamp>.json
```

`WebCameraList.txt` 和 `Unity.log` 在 `OnInitializeMelon` 中总是会被删除并重建；`Unity.log` 是否持续记录取决于 `common.unityLogger.enable`。

### 2.4 配置文件格式

`Config.yml` 使用 YAML，命名约定是 camelCase：

```yaml
common:
  unityLogger:
    enable: true
    printToConsole: true
  showFPS: true
  networkLogger:
    enable: true
    printToConsole: false
fix:
  disableEnvironmentCheck: true
  disableReboot: true
  disableIniClear: true
  fixDebugInput: true
  skipSpecialNumCheck: true
modSetting:
  showInfo: true
  showPanel: true
  maskTitleServerUrl: true
```

加载逻辑：

- 文件不存在：用 `MainConfig` 的构造函数默认值生成配置文件。
- YAML 无效：记录错误，提示删除配置后重启，并停止后续 Mod 初始化。
- 配置项不属于目标类：可能报 `Property '...' not found`。Issue #18 就是旧 `logUnity` 字段造成的。
- 保存时会重新序列化，原 YAML 注释通常不会可靠保留。

### 2.5 仓库示例配置和实际默认值的差异

仓库中的 `Config.yml` 是易过期示例，且当前 CI 打包步骤只复制 DLL 和 README，不复制仓库里的 `Config.yml`。第一次运行实际生成的默认值来自 `Config/MainConfig.cs`。

当前源码中非 false 的主要默认值：

| 配置 | 实际默认值 | 影响 |
| --- | --- | --- |
| `common.showFPS` | `true` | 默认显示 FPS |
| `common.unityLogger.enable` | `true` | 写 `Sinmai-Assist/Unity.log` |
| `common.unityLogger.printToConsole` | `true` | Unity 日志也输出到 MelonLoader 控制台 |
| `common.networkLogger.enable` | `true` | 默认把网络请求/响应写到 `NetworkLogs` |
| `common.networkLogger.printToConsole` | `false` | 网络日志默认不打印到控制台，但仍可能落盘 |
| `fix.disableEnvironmentCheck` | `true` | 1.50 以上的环境检查处理 |
| `fix.disableReboot` | `true` | 避免自动重启流程 |
| `fix.disableIniClear` | `true` | 避免清空 INI |
| `fix.fixDebugInput` | `true` | 修复调试输入 |
| `fix.skipSpecialNumCheck` | `true` | `CalcSpecialNum` 固定为 1024 |
| `modSetting.showInfo` | `true` | 默认显示版本信息 GUI |
| `modSetting.showPanel` | `true` | 默认显示 Mod 面板 |
| `modSetting.maskTitleServerUrl` | `true` | GUI 中遮蔽标题服务器 URL |

其余未列出的布尔项默认为 `false`，数值项默认为 `0`，字符串默认是空字符串，`customVersionText.versionText` 默认为 `Sinmai-Assist`。

### 2.6 默认加载且无法在配置里关闭的项

以下三个 patch 在 `Main.cs` 末尾无条件加载：

```csharp
Patch(typeof(PrintUserData));
Patch(typeof(InputManager));
Patch(typeof(GameMessageManager));
```

其中 `PrintUserData` 会在进入选曲流程时把用户信息写到：

```text
Sinmai-Assist/UserData/User<ID>.txt
```

它包含 `AccessCode` 和 `AuthKey` 等可识别信息。**这是敏感信息安全风险。**

`NetworkLogger` 虽然可以关，但源码默认是开启并落盘。启用时也可能记录账号、登录和网络数据。不要把整个 `Sinmai-Assist` 目录、`NetworkLogs` 或用户数据上传到公开 Issue。

### 2.7 快捷键默认值

`KeyBindConfig.yml` 首次运行自动生成。当前默认值：

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

### 2.8 如何确认它实际加载

检查 `MelonLoader/Latest.log`，应能看到：

```text
Version: 1.0.0 (<commit>) Build Date: ...
Config Load Complete.
GameInfo: <GameID> <GameVersion>
> Patch: SinmaiAssist...
Loading completed
```

如果启用 `SafeMode`：

```text
Safe mode is enabled, Disable all patch
```

同时检查：

- `Sinmai-Assist/Config.yml`
- `Sinmai-Assist/KeyBindConfig.yml`
- `Sinmai-Assist/WebCameraList.txt`
- 进入选曲后是否生成 `UserData/User<ID>.txt`

如果能看到 `Create Default Config 'Sinmai-Assist/Config.yml'`，说明配置确实是首次生成，而不是加载了旧示例。

### 2.9 配置最小化建议

第一次验证启动时建议：

| 配置 | 建议 |
| --- | --- |
| `modSetting.safeMode` | 先 `true` 验证注入；之后设回 `false` |
| `common.networkLogger.enable` | `false` |
| `common.networkLogger.printToConsole` | `false` |
| `common.unityLogger.enable` | 除排障外设 `false` |
| `common.unityLogger.printToConsole` | `false` |
| `common.showFPS` | `false`，除非明确需要 |
| 所有 `cheat.*` | 全部 `false` |
| 所有会改变用户数据的 `saveToUserData` | `false` |
| `common.customCameraId.enable` | 先 `false` |
| `common.dummyLogin.enable` | 先 `false`，这属于登录流程改写，存在账号/服务端风险 |

默认 `PrintUserData` 没有开关。如果不能接受明文 `AccessCode/AuthKey` 落盘，应直接不要在该机器上加载此 Mod，或自行审查并重建一个移除该无条件 patch 的版本。

## 3. 功能分类和风险

### 3.1 适合正常 HDD 启动的基础项

这里的“适合”只表示不改变成绩、账号和联机状态，不表示与其他 Mod 一定兼容。

| 功能 | 作用 | 备注 |
| --- | --- | --- |
| `DisableIniClear` | 阻止 `IniFile.clear` | 与 AquaMai 同类 patch 重复 |
| `DisableReboot` | 阻止维护/重启计时相关行为 | 适合单机维护，但需注意服务端时间逻辑 |
| `SkipWarningScreen` | 跳过警告画面 | 纯 UX |
| `SkipFade` | 跳过过场 | 纯 UX |
| `DisableBackground` | 关闭背景 | 性能/UX |
| `DisableMask` | 关闭遮罩 | 纯 UX |
| `ShowFPS` | 显示 FPS | 纯显示 |
| `FixDebugInput` | 修复键盘/鼠标 DebugInput | 与 AquaMai 重复 |
| `SinglePlayer` | 单屏/单人模式 | 会替换显示器与输入流程 |
| `ChangeGameSettings` | 覆盖部分游戏内开关 | 可能改变拍照、QR、角色选择流程 |
| `AutoBackupData` | 导出用户备份 JSON | 包含用户 ID、成绩、收藏等信息 |
| `PrintUserData` | 写用户详情文本 | 默认无开关，包含 `AccessCode/AuthKey` |
| `NetworkLogger` | 记录网络请求/响应 | 默认开启，隐私风险高 |
| `CustomCameraId` | 指定摄像头 ID | 与 AquaMai 同名功能强冲突 |

### 3.2 启动和网络修复类

| 功能 | 实际 patch | 风险/备注 |
| --- | --- | --- |
| `DisableEnvironmentCheck` | `WarningProcess.OnStart` transpiler | 只对 `>=25000` 加载 |
| `DisableEncryption` | `Packet.Obfuscator`、动态 `Net.CipherAES` | 与 AquaMai `RemoveEncryption` 基本重复 |
| `FixCheckAuth` | `OperationManager.CheckAuth_Proc` | 与 AquaMai 重复；AquaMai 现版还有 HTTPS 回退逻辑 |
| `SkipCakeHashCheck` | `NetHttpClient` 构造函数 | 与 AquaMai 重复 |
| `SkipSpecialNumCheck` | `GameManager.CalcSpecialNum` | 两边都固定为 1024 |
| `RestoreCertificateValidation` | `NetHttpClient.Create` | 与 AquaMai 重复 |
| `ForceAsServer` | `Network.IsLanAvailable`、`LanInstall.IsServer` | 与 AquaMai 重复 |
| `SkipVersionCheck` | `ConfirmPlay.IsValidVersion` | 影响登录/版本判断 |

### 3.3 UX、性能和自动化

| 功能 | 类别 | 风险 |
| --- | --- | --- |
| `ForceQuickRetry` | UX | 可能改变游玩次数和结算流程 |
| `InfinityTimer` / `InfinityTimerLegacy` | UX | 改计时，源码注明部分来自 AquaMai |
| `BlockCoin` | 自动化/信用 | 修改投币、点数或支付判断 |
| `ChangeDefaultOption` | UX | 改游客默认设置 |
| `ChangeFadeStyle` | UX | 改过场资源选择 |
| `QuickBoot` | UX | 配置存在，但当前 `Main.cs` 已把加载调用注释掉，实际不生效 |
| `AutoPlay` | 自动化/cheat | 会直接改写判定和谱面完成流程 |
| `FastSkip` | 自动化/cheat | 可强制成绩、Miss、DX 分数，可能影响上传数据 |
| `ChartController` | 调试 | 暂停、跳时间、记录点，可能破坏成绩合法性 |

### 3.4 会改动账号、用户数据或服务端行为的项

这些项应明确标为高风险，不建议在真实账号或线上服务上使用：

| 功能 | 影响 |
| --- | --- |
| `DummyLogin` | 改写登录/读卡流程；SDGB 使用 `DummyChimeLogin`，其他路径使用 `DummyAimeLogin` |
| `UnlockMusic` | 解锁歌曲；`saveToUserData: true` 会写入用户数据 |
| `UnlockMaster` | 解锁 Master/ReMaster；`saveToUserData: true` 会写入用户数据 |
| `UnlockEvent` | 替换 `PacketGetGameEvent` 返回的事件列表 |
| `UnlockUtage` | 强制宴会场解锁，可改双人游玩路径 |
| `AllCollection` | 伪造或扩充收藏品列表 |
| `ForceCurrentIsBest` | 强制当前成绩成为最佳成绩，源码和 README 都提示会影响 Best50 |
| `ResetLoginBonusRecord` | 改写登录奖励日期 |
| `RewriteLoginBonusStamp` | 改写登录奖励点数和返回数据 |
| `SetAllCharacterAsSameAndLock` | 改写角色槽位和锁定数据 |

使用这些功能可能造成：

- 服务端保存异常数据。
- 成绩无法正常上传。
- Best50/rating/登录奖励与本地显示不一致。
- 账号被封禁、数据被回滚或服务端拒绝连接。
- 与 AquaMai 的保存、结算、反作弊或网络 hook 发生冲突。

## 4. 与 AquaMai 的差异、重叠和共存

对比对象：

- Sinmai-Assist：<https://github.com/WYH2004-MC/Sinmai-Assist>
- AquaMai：<https://github.com/MewoLab/AquaMai>
- AquaMai 研究快照 HEAD：`381a498d72e90bd82f51b9ddb3cd665cecd2e5df`，2026-09-16

### 4.1 基本差异

| 维度 | Sinmai-Assist | AquaMai |
| --- | --- | --- |
| 加载器 | MelonLoader | MelonLoader |
| Patch 框架 | Harmony | Harmony |
| 目标 | `Sinmai.exe` | `Sinmai.exe` |
| BepInEx | 不使用 | 不使用 |
| README 加载器要求 | `0.6.4` 或更低 | 当前 README 示例为 MelonLoader 0.7.0 |
| 配置 | `Sinmai-Assist/Config.yml`、`KeyBindConfig.yml` | `AquaMai.toml`，另有配置迁移和 GUI |
| 配置格式 | YAML | TOML |
| 版本机制 | 只有少量 `EnableGameVersion` 门控 | 更广泛的条件加载、版本门控和 error report |
| 功能重点 | 大量 cheat、解锁、FastSkip、ChartController | 系统兼容、输入、资源、UX、修复、部分 F8 调试 |
| 自动更新 | 未发现 | 上游仓库含 MuMod 相关组件；是否启用以具体发布包为准 |
| 公开 Release | 没有 | 有大量 tag，发布策略需另看 AquaMai 文档 |

重要限制：

- 当前 AquaMai README 指向 MelonLoader 0.7.0，而 Sinmai-Assist README 明确警告高于 0.6.4 会崩溃。
- AquaMai `v1.4.0` 的 README 曾明确要求 MelonLoader 0.6.1 或更低。
- Issue #26 记录过 `MelonLoader 0.6.4 + Sinmai-Assist + AquaMai + SDGB 1.55`。
- 因此只能在两个 Mod 的具体构建都声明兼容的加载器版本下测试；不能仅凭“都是 MelonLoader 插件”判断当前版本能共存。

### 4.2 Harmony patch 重叠

| 目标方法/类型 | Sinmai-Assist | AquaMai | 冲突判断 |
| --- | --- | --- | --- |
| `Packet.Obfuscator(string)` | `DisableEncryption` | `RemoveEncryption` | 直接重复，只保留一边 |
| `Net.CipherAES.Encrypt/Decrypt` | 动态 patch | 动态 patch | 直接重复，只保留一边 |
| `OperationManager.CheckAuth_Proc` | `FixCheckAuth` | `FixCheckAuth` | 直接重复；AquaMai 当前实现是功能超集 |
| `NetHttpClient` 构造函数 | `SkipCakeHashCheck` | `Common` 的 Cake 检查 | 两边都设 `isTrueDll=true`，重复 |
| `NetHttpClient.Create` | `RestoreCertificateValidation` | `Common` | 两边都清空证书回调，重复 |
| `GameManager.CalcSpecialNum` | postfix 设 1024 | prefix 设 1024 并跳过原方法 | 结果相同，但 patch 类型不同，不应同时开 |
| `Network.IsLanAvailable` | `ForceAsServer` | `ForceAsServer` | 直接重复 |
| `LanInstall.IsServer` | `ForceAsServer` | `ForceAsServer` | 直接重复 |
| `CameraManager.CameraInitialize` | `CustomCameraId` prefix 替换协程 | `CustomCameraId` prefix 替换协程 | 高风险重复；Issue #13 明确质疑两边同时启用 |
| `CameraManager.Initialize` | 设置分辨率参数 | 设置分辨率参数 | 高风险重复 |
| `Packet.ProcImpl` | `NetworkLogger`/认证相关路径 | `NetPacketHook`、`FixCheckAuth` | 网络请求会被两套 hook 分别处理，顺序不保证 |
| `ResultProcess.OnStart` | `ForceCurrentIsBest` | `ImmediateSave`、`DontRuinMyAccount`、`JudgeAccuracyInfo` 等 | 取决于启用项，可能同时改写结算/保存状态 |
| `GameManager.AutoJudge` | `AutoPlay` postfix | `RealisticRandomJudge` 等调试功能 | 只有两边都开相关功能时才冲突，但会改变随机判定结果 |
| Slide/AutoPlay 修复 | `AutoPlay` 对 SlideRoot 等做 prefix | `FixSlideAutoPlay` 等 | Issue #9 实测：关闭 AquaMai `FixSlideAutoPlay` 后，Sinmai-Assist AutoPlay 才正常完成 Wi-Fi 滑星 |

### 4.3 RemoveEncryption 是否重叠

是，基本重复。

Sinmai-Assist 的 `DisableEncryption` 注释直接写了想法来自 AquaMai。两边都 patch：

```csharp
[HarmonyPatch(typeof(Packet), "Obfuscator", typeof(string))]
```

并通过反射寻找 `Net.CipherAES.Encrypt/Decrypt`。

推荐：

- 只启用一边的 RemoveEncryption/DisableEncryption。
- 如果使用当前 AquaMai，优先让 AquaMai 处理，关闭 Sinmai-Assist `fix.disableEncryption`。
- 如果使用单独 Sinmai-Assist，再打开它的 `fix.disableEncryption`。
- 不要因为界面没有报错就默认两边同时启用是安全的。

### 4.4 auth、packet、save 是否重叠

会重叠：

- `FixCheckAuth`：两边都改 `OperationManager.CheckAuth_Proc`。
- `Packet.ProcImpl`：AquaMai 有网络 hook、认证回退和资源 hook；Sinmai-Assist 有 NetworkLogger 和认证处理。
- `ResultProcess.OnStart`：AquaMai 的立即保存、防毁账号、判分统计等可能和 Sinmai-Assist 的 `ForceCurrentIsBest` 同时修改结算状态。
- 用户数据：Sinmai-Assist 的解锁保存、打印、备份与 AquaMai 的用户数据修复、保存功能可能同时作用。

风险判断：

- 纯日志重复通常是噪音或隐私风险。
- 多个 prefix 中有一个返回 `false` 时，patch 执行顺序会影响后续 prefix/postfix；相同优先级的顺序不应被当作稳定契约。
- 多个功能同时改 `ResultProcess`、用户数据或网络请求时，最容易出现“功能看似生效但保存结果异常”的问题。

### 4.5 能否同时安装

结论：

- **可以同时把两个 DLL 放进 `Mods`，但这不是自动获得支持的组合。**
- Issue #26 有 SDGB 1.55、MelonLoader 0.6.4、Sinmai-Assist、AquaMai 的共存报告。
- Issue #16 有 SDEZ 1.60、MelonLoader 0.6.4、两个 Mod 下 FastSkip Custom 崩溃的日志。
- Issue #9 有 AquaMai `FixSlideAutoPlay` 与 Sinmai-Assist AutoPlay 冲突的实测。
- Issue #13 有同时启用两边 CustomCameraId 导致异常表现的报告。

推荐共存策略：

1. 先固定加载器版本和一个明确匹配的 AquaMai 构建。
2. 先只放 AquaMai，确认游戏能启动。
3. 再放 Sinmai-Assist，把 `modSetting.safeMode` 设成 `true` 只验证注入。
4. 关闭 Sinmai-Assist 的重复网络 patch：`disableEncryption`、`fixCheckAuth`、`skipCakeHashCheck`、`restoreCertificateValidation`、`forceAsServer`。
5. 只在一侧启用 CustomCameraId。
6. 只在一侧启用 AutoPlay/Slide 修复相关功能。
7. 不要同时开着 Sinmai-Assist 和 AquaMai 的所有日志与网络 hook。
8. 每加一组功能就重启并检查两边的日志。

### 4.6 如何确认冲突

检查顺序：

1. `MelonLoader/Latest.log`：查找 `Patch: ... failed`、`HarmonyException`、`MissingMethodException`、`TypeLoadException`。
2. `Sinmai-Assist/Unity.log`：查看 Unity 侧异常和 patch 后行为。
3. AquaMai 所在版本的日志/error report：当前 AquaMai 有独立错误报告组件；旧版本路径可能不同。
4. `Sinmai-Assist/Config.yml`：确认不是仓库旧示例，而是实际生成的配置。
5. 二分法测试：先禁用所有 Sinmai-Assist 功能，只保留注入；再逐组开启。
6. 同类功能只保留一边：RemoveEncryption、CheckAuth、Camera、AutoPlay/Slide、结算保存优先逐项验证。

## 5. CI、发布、版本命名和更新风险

### 5.1 Release/tag

当前仓库：

- `git tag` 为空。
- Release Atom feed 没有条目。
- 没有稳定版、beta 版或版本号 release。

因此没有“下载最新 Release 即可”的官方路径。

### 5.2 CI

当前 `.github/workflows/main.yml`：

- 触发条件：向 `master` push 或对 `master` 开 PR。
- 环境：`windows-latest`。
- 下载 MelonLoader 0.6.4 到缓存。
- 从 GitHub Secret 读取 `LIBRARY_URL`，下载 `Output.7z`，解压到 `Libs`。
- 调用 `MSBuild.exe /p:Configuration=Release /p:TargetFramework=net472`。
- 包装 `Output/Sinmai-Assist.dll` 和 `README.md` 为 `Out.zip`。
- 用 `actions/upload-artifact@v4` 上传 `artifact`。

关键点：

**CI 不能独立复现，因为游戏库来自私有 `LIBRARY_URL` secret。**

这意味着：

- 外部贡献者没有匹配库，不能保证能从源码直接构建。
- 私有库到底对应 SDEZ、SDGB 或某个具体版本，无法从仓库公开信息确认。
- Action artifact 有保留期限，不是永久 Release。
- Issue #15 中出现过“actions 没了”的回复，回复内容是 Actions 已关闭，可以自行编译。
- 当前主分支没有 `workflow_dispatch`；PR #20 曾在自己的输出中增加手动触发，但主分支当前 workflow 不含该项。

### 5.3 版本命名

- `BuildInfo.Version` 固定为 `"1.0.0"`。
- `BuildInfo.CommitHash` 和 `BuildInfo.BuildDate` 由构建脚本或 CI 生成。
- 仓库提交中的 `BuildInfo.cs` 可能显示旧的 `8372204` 和 `2026-03-09`，不能把它当成当前 HEAD 的可靠版本。
- 仓库没有语义化 release 版本可以作为兼容性边界。

### 5.4 自动更新

仓库内没有发现 Sinmai-Assist 自动更新器、下载新 DLL 或替换配置的实现。

这与 AquaMai 8.x 之后的 MuMod 更新机制不是一回事。若同时安装 AquaMai/MuMod：

- 要确认它不会替换或清理 `Mods/Sinmai-Assist.dll`。
- 要确认不会把 Sinmai-Assist 的配置文件当成 AquaMai 配置迁移。
- 旧 AquaMai/SDGB 组合若被 MuMod 拉到新构建，可能重新引入 loader 或方法签名不兼容。

### 5.5 更新风险

| 更新场景 | 风险 |
| --- | --- |
| 游戏版本更新 | Harmony 目标方法可能改名、改签名或消失 |
| 游戏区域切换 | SDGB/SDEZ 的 GameID、程序集和 API 后缀可能不同 |
| 加载器更新 | 高于 0.6.4 的 MelonLoader 可能导致崩溃 |
| 配置跨版本复制 | 旧字段可能触发 YAML 解析错误 |
| 同时更新 AquaMai | 两边重复 patch 的先后顺序和行为可能改变 |
| 使用旧二进制 | 1.60+ 的 `FastSkip-Custom` 需要当前 master 的相关修复；更早构建可能直接报 `MissingMethodException` |

## 6. SDEZ 与 SDGB 的支持边界

### 6.1 已证实事实

| 项目 | SDEZ | SDGB |
| --- | --- | --- |
| README 有无正式版本矩阵 | 没有 | 没有 |
| 运行时代码有没有区域分支 | 有 `SDEZ` 摄像头分支 | 有 `SDGB` 分支；DummyLogin 使用 Chime |
| 是否有专门 Release | 没有 | 没有 |
| CI 是否按区域构建 | 没有可见矩阵 | 没有可见矩阵 |
| README 构建提示 | 无特殊提示 | “Please use SDGB version library” |
| 历史支持声明 | 无明确版本声明 | 曾“移除对国服的支持” |

### 6.2 版本相关 issue/PR

| 来源 | 内容 | 结论 |
| --- | --- | --- |
| Issue #18 | SDGB 1.51，旧 `logUnity` 配置导致 Sinmai-Assist 和 AquaMai 一起崩溃；维护者说仓库 config 未更新，应删除旧配置让 Mod 生成 | 有 SDGB 1.51 使用案例；配置兼容风险已证实 |
| Issue #19 | 使用 SDGB 1.53 编译，`UserLogoutRequestVO` 缺 `dateTime`；维护者承认 1.53 API 改动导致登出功能不可用 | SDGB 1.53 API 与旧代码不兼容 |
| PR #21 | 移除失效的 SDGB 虚拟用户登出界面，处理 1.53 问题 | 主分支已移除登出功能 |
| PR #22 / commit `cc23478` | 修复 1.60 及以上 note 类型获取，恢复 FastSkip-Custom | 1.60+ 修复已合并到 master |
| Issue #23 | SDEZ 1.66，FastSkip Custom 设置 101% 时 Miss 数量异常，可能导致上传无效数据 | master 上仍是风险 |
| PR #25 / branch `60f54b5` | 修复 FastSkip Custom 101% 的 Miss 数量问题，2026-06-13 | 修复分支未合并到 master |
| Issue #26 | SDGB 1.55、ML 0.6.4、同时安装 Sinmai-Assist + AquaMai；Force Add 1 Miss 部分歌曲不生效，SDEZ 1.65 无法复现，报告者后来自行解决并关闭 | 共存案例存在，但不是正式兼容声明 |
| Issue #9 | SDGA/SDEZ AutoPlay 无法完成 Wi-Fi 滑星；关闭 AquaMai `FixSlideAutoPlay` 后恢复 | 与 AquaMai Slide 修复的冲突已实测 |
| Issue #13 | 同时开两边 CustomCameraId，或单开 Sinmai-Assist 单摄像头时出现性能和崩溃争议；维护者明确质疑同时启用两边 CustomCameraId | 不建议两边同时启用 Camera patch |

### 6.3 SDGB 最终结论

**可以说的：**

- 当前源码有 SDGB 专用代码路径。
- 2025-04-14 起 README 建议编译时使用 SDGB 版本库。
- Issue 中有 SDGB 1.51、1.53、1.55 的使用、编译或排障记录。
- 有 `Sinmai-Assist + AquaMai + SDGB 1.55` 的共存报告。

**不能说的：**

- 不能说当前 master 官方支持 SDGB 1.51、1.53 或 1.55。
- 不能说“使用 SDGB 版本的游戏 DLL 编译后所有功能都能用”。
- 不能说 AquaMai 和 Sinmai-Assist 同时安装时 SDGB 功能都经过验证。
- 不能把 `DummyChimeLogin` 的存在当成账号登录兼容性保证。

**未证实：**

- 旧版本 SDGB 1.51、1.40 或更早版本的完整运行兼容性。
- 当前 CI 的私有 `LIBRARY_URL` 究竟对应哪个区域和版本。
- 所有功能在 SDGB 1.55 下的服务端行为。

## 7. 最小配置与安装步骤

### 7.1 独立使用 Sinmai-Assist

推荐流程：

1. 备份游戏和 `Mods`。
2. 安装 MelonLoader 0.6.4 或更低。
3. 放入 `Sinmai-Assist.dll`。
4. 删除旧的 `Sinmai-Assist/Config.yml` 和 `KeyBindConfig.yml`。
5. 启动一次，确认生成新配置，然后立即关闭。
6. 编辑 `Sinmai-Assist/Config.yml`。
7. 第一次只打开启动所需的兼容项，关闭所有 cheat 和保存到用户数据的选项。
8. 再次启动，检查 `MelonLoader/Latest.log`。

建议保留：

```yaml
fix:
  disableEnvironmentCheck: true
  disableReboot: true
  disableIniClear: true
  fixDebugInput: true
  skipSpecialNumCheck: true
```

如果游戏或服务器仍需要网络兼容，再按具体游戏版本决定是否打开：

```yaml
fix:
  disableEncryption: true
  fixCheckAuth: true
  skipCakeHashCheck: true
  restoreCertificateValidation: true
  forceAsServer: true
```

但所有这些项在 AquaMai 中都有重叠实现。如果 AquaMai 已经接管该职责，不要两边同时开。

### 7.2 与 AquaMai 共存

建议：

- 先确认使用一个同时声明支持 Sinmai-Assist 所需 MelonLoader 的 AquaMai 构建。
- 不要盲目使用当前 AquaMai README 的 0.7.0 替换已知能工作的 0.6.4。
- 只在一侧启用 RemoveEncryption/DisableEncryption。
- 只在一侧启用 FixCheckAuth。
- 只在一侧启用 Cake、SpecialNum、Certificate、ForceAsServer。
- 只在一侧启用 CustomCameraId。
- 只在一侧启用 AutoPlay/Slide 修复。
- 先关闭 AquaMai `FixSlideAutoPlay`，再测试 Sinmai-Assist AutoPlay。
- 不要把两边所有结果保存功能同时打开。

### 7.3 SDGB 额外注意事项

1. 固定区域为 `SDGB` 的匹配游戏库，不要混用 `SDEZ` 或其他版本的 `Assembly-CSharp.dll`。
2. 不要根据“能编译”直接推断“能运行所有功能”。
3. 先验证登录、扫码、读卡、摄像头、结算和上传。
4. 使用 `DummyLogin` 时，必须准备匹配的 `ChimeLib.NET`，并且明确认识到它会改写登录流程。
5. FastSkip Custom、Force Add 1 Miss 等在 SDGB 1.55 有 issue 报告；在未确认修复 commit 和游戏版本的对应关系前不要用于真实账号。
6. 使用旧 AquaMai 时，关闭 MuMod 自动更新，避免它覆盖已经验证的旧 DLL。

## 8. 卸载、回滚和备份

### 8.1 卸载

1. 关闭 `Sinmai.exe`。
2. 删除 `Mods/Sinmai-Assist.dll`。
3. 如需彻底清除运行痕迹，备份后删除 `Sinmai-Assist/` 文件夹。
4. 如果不再使用任何 MelonLoader Mod，再单独决定是否移除 MelonLoader；不要直接删除游戏依赖。
5. 检查 `MelonLoader/Latest.log`，确认没有残留加载错误。

### 8.2 回滚

仓库没有 release，因此回滚必须依赖已经保存的二进制和 commit：

```text
Mods/Sinmai-Assist.dll
Sinmai-Assist/Config.yml
Sinmai-Assist/KeyBindConfig.yml
```

建议按以下格式保存：

```text
backup/
└─ Sinmai-Assist/
   ├─ ad5cdbe/
   │  ├─ Sinmai-Assist.dll
   │  ├─ Config.yml
   │  └─ metadata.txt
   └─ known-good/
```

`metadata.txt` 至少记录：

- DLL SHA-256
- Git commit
- 游戏版本
- GameID
- MelonLoader 版本
- 使用的库来源
- 已验证功能

### 8.3 必须备份的数据

- `Sinmai-Assist/Config.yml`
- `Sinmai-Assist/KeyBindConfig.yml`
- `Sinmai-Assist/UserBackup/`
- 你自己的游戏原始文件
- 可工作的 `Mods` 目录快照

`UserData/*.txt` 和 `NetworkLogs/*.log` 可能包含敏感信息。若不需要排障，应删除而不是长期保留。

## 9. 常见故障排查

| 现象 | 优先检查 | 处理 |
| --- | --- | --- |
| MelonLoader 日志里没有 Sinmai-Assist | DLL 是否在 `Mods`、加载器版本、DLL 位数 | 只使用 0.6.4 或更低；确认 `Sinmai-Assist.dll` 没有改名 |
| 游戏启动崩溃 | MelonLoader 高于 0.6.4 | 按 README 降级 |
| `Load Config ... Failed: Property 'logUnity' not found` | 使用了旧 `Config.yml` | 删除配置，让 Mod 重新生成 |
| `Failed to patch some methods` | 游戏 DLL 不匹配、已修改、版本过低或功能冲突 | 用未修改的匹配 DLL；关闭冲突 Mod/功能 |
| GUI 不显示 | 配置解析失败、`showPanel=false`、SafeMode | 检查 Latest.log，删除坏配置后重建 |
| 功能没生效 | 改了仓库旧示例而不是实际生成配置 | 查看首次生成日志和 `Sinmai-Assist/Config.yml` |
| SDGB 编译错误，如缺 `ScoreDic`、`Point`、`AddPresentMile` | 混用 SDGB/SDEZ 或多个版本的库 | 使用同一区域同一版本的库；Issue #17 是混用案例 |
| SDGB 1.53 编译缺 `UserLogoutRequestVO.dateTime` | 旧登出代码 | 使用包含 PR #21 移除登出后的版本 |
| SDEZ 1.60 FastSkip Custom 崩溃 | 旧版 note type 获取逻辑 | 使用含 `cc23478` 及后续修复的版本 |
| FastSkip Custom 101% 出现异常 Miss | master 尚未包含 PR #25 | 不要用 master 做合法成绩；等修复合并或使用经过验证的固定构建 |
| AutoPlay 不完成 Wi-Fi 滑星 | AquaMai `FixSlideAutoPlay` | 关闭 AquaMai 该功能 |
| 摄像头崩溃或帧率掉到相机的 30 FPS | 两边同时启用 CustomCameraId、单摄像头分辨率 | 只保留一个 Camera patch；检查相机帧率 |
| 网络加密/认证异常 | 两边同时补 `Obfuscator`、`CipherAES`、`CheckAuth` | 每类只留一边 |
| 成绩显示和保存不一致 | Sinmai-Assist `ForceCurrentIsBest` + AquaMai 保存/结算功能 | 关闭所有成绩改写，删除或回滚异常测试数据 |
| Activity artifact 找不到或 Actions 页面不可用 | 仓库没有 Release，CI 依赖 secret | 不要假设存在永久下载；自行编译需准备匹配且合法的库，当前不可完全公开复现 |

## 10. 源码/Issue/PR 关键证据清单

### 10.1 Sinmai-Assist

| 来源 | 日期 | 关键结论 |
| --- | --- | --- |
| [README @ `ad5cdbe`](https://github.com/WYH2004-MC/Sinmai-Assist/blob/ad5cdbe7365f79e2b21991f38e007682162a1787/README.md) | 2026-04-09 snapshot | cheat Mod；MelonLoader `0.6.4` 或更低；构建提示使用 SDGB 库 |
| [Main.cs @ `ad5cdbe`](https://github.com/WYH2004-MC/Sinmai-Assist/blob/ad5cdbe7365f79e2b21991f38e007682162a1787/Main.cs) | 2026-04-09 snapshot | 有 `SDGB` 分支；`PrintUserData/InputManager/GameMessageManager` 无条件加载 |
| [MainConfig.cs @ `ad5cdbe`](https://github.com/WYH2004-MC/Sinmai-Assist/blob/ad5cdbe7365f79e2b21991f38e007682162a1787/Config/MainConfig.cs) | 2026-04-09 snapshot | 实际默认值；ShowFPS、NetworkLogger、多数 Fix 默认开启 |
| [DisableEncryption.cs @ `ad5cdbe`](https://github.com/WYH2004-MC/Sinmai-Assist/blob/ad5cdbe7365f79e2b21991f38e007682162a1787/Fix/DisableEncryption.cs) | 2026-04-09 snapshot | 与 AquaMai RemoveEncryption 使用同类目标 |
| [workflow main.yml @ `ad5cdbe`](https://github.com/WYH2004-MC/Sinmai-Assist/blob/ad5cdbe7365f79e2b21991f38e007682162a1787/.github/workflows/main.yml) | 2026-04-09 snapshot | 私有 `LIBRARY_URL`；MelonLoader 0.6.4；Actions artifact；无 release |
| commit `5d87f76` | 2024-11-22 | “移除对国服的支持”；删除 SDGB 专用登录文件和 `ForceIsChinaBuild` |
| commit `92a92f4` | 2024-10-18 | 修复 `CustomCameraId` 对 SDGA 的兼容 |
| commit `225842f` | 2025-01-22 | 添加 1.50+ 环境检查处理 |
| commit `bfb2fa8` | 2025-02-12 | 修复 1.50 下禁用网络加密 |
| commit `41f22df` | 2025-04-14 | README 加“使用 SDGB version library”提示 |
| commit `cc23478` | 2026-04-09 | 修复 1.60+ note 类型获取，恢复 FastSkip-Custom |
| branch `origin/23-使用fastskip的custom模式miss数量异常` | 2026-06-13 | HEAD `60f54b5`，修复 FastSkip Miss 数量，但未合并 master |
| Issue #9 | 未标日期，仓库 issue | AquaMai `FixSlideAutoPlay` 与 Sinmai-Assist AutoPlay 冲突 |
| Issue #13 | 未标日期，仓库 issue | 不建议两边同时启用 CustomCameraId |
| Issue #15 | 未标日期，仓库 issue | “actions 关了，可以自行编译” |
| Issue #16 | 未标日期，仓库 issue | SDEZ 1.60 + AquaMai，FastSkip Custom 崩溃日志 |
| Issue #17 | 未标日期，仓库 issue | SDGB 1.40 + SDEZ 1.56 混库导致编译错误 |
| Issue #18 | 未标日期，仓库 issue | SDGB 1.51 + 旧 `logUnity` 配置导致崩溃；应重新生成配置 |
| Issue #19 | 2026-01-08 | SDGB 1.53 编译因 logout API 变更失败 |
| Issue #23 | 未标日期，仓库 issue | SDEZ 1.66 FastSkip Custom 101% 的 Miss 异常 |
| Issue #26 | 2026-08-02 | SDGB 1.55 + AquaMai + Sinmai-Assist，Force Add 1 Miss 问题 |
| PR #21 | 2026-03-09 前后 | 移除 SDGB 虚拟用户登出功能 |
| PR #22 | 2026-04-09 | 修复 1.60+ FastSkip-Custom |
| PR #25 | 2026-06-13 | FastSkip 101/Miss 修复，未合并 |

### 10.2 AquaMai 对照

| 来源 | 日期 | 关键结论 |
| --- | --- | --- |
| [AquaMai README @ `381a498`](https://github.com/MewoLab/AquaMai/blob/381a498d72e90bd82f51b9ddb3cd665cecd2e5df/README.md) | 2026-09-16 snapshot | MelonLoader 0.7.0；`AquaMai.toml`；MelonLoader + Harmony |
| [RemoveEncryption @ `381a498`](https://github.com/MewoLab/AquaMai/blob/381a498d72e90bd82f51b9ddb3cd665cecd2e5df/AquaMai.Mods/GameSystem/RemoveEncryption.cs) | 2026-09-16 snapshot | 与 Sinmai-Assist `DisableEncryption` 直接重复目标 |
| [Common.cs @ `381a498`](https://github.com/MewoLab/AquaMai/blob/381a498d72e90bd82f51b9ddb3cd665cecd2e5df/AquaMai.Mods/Fix/Common.cs) | 2026-09-16 snapshot | Cake、证书、SpecialNum、环境检查 |
| [FixCheckAuth.cs @ `381a498`](https://github.com/MewoLab/AquaMai/blob/381a498d72e90bd82f51b9ddb3cd665cecd2e5df/AquaMai.Mods/Fix/FixCheckAuth.cs) | 2026-09-16 snapshot | 比旧 Sinmai-Assist 实现更复杂的 auth/HTTPS 回退 |
| [CustomCameraId.cs @ `381a498`](https://github.com/MewoLab/AquaMai/blob/381a498d72e90bd82f51b9ddb3cd665cecd2e5df/AquaMai.Mods/GameSystem/CustomCameraId.cs) | 2026-09-16 snapshot | 与 Sinmai-Assist Camera patch 直接重复 |
| AquaMai tag `v1.4.0` | 历史 tag | README 要求 MelonLoader 0.6.1 或更低 |
| AquaMai tag `v1.5.4`、`v1.7.5`、`v1.9.0` | 历史 tag | README 指向 MelonLoader 0.7.0；版本行为需按 tag 核实 |

## 11. 事实、推断和未证实项

### 已证实

- README 要求 MelonLoader 0.6.4 或更低。
- 当前源码有 SDGB 专用分支。
- 仓库曾提交“移除对国服的支持”。
- 当前仓库没有 tag 和 Release。
- CI 使用私有 `LIBRARY_URL`。
- 仓库没有顶层 LICENSE。
- Sinmai-Assist 与 AquaMai 都使用 MelonLoader 和 Harmony。
- 两边多组 patch 目标重叠，尤其是 RemoveEncryption、CheckAuth、Camera、网络和结算相关逻辑。
- 有 issue 记录两边共存、冲突和版本问题。

### 合理推断

- 当前 SDGB 功能属于“残留、区域性代码路径和用户实测”，不是稳定官方支持。
- 单独使用 Sinmai-Assist 时，应优先关闭敏感日志，避免明文用户数据落盘。
- 与 AquaMai 共存时，唯一相对可控的方法是同类功能只保留一边。
- 当前 master 不是 FastSkip Custom 101/Miss 修复后的最终状态，因为修复仍在未合并分支。

### 未证实

- 当前 master 对所有 SDGB 版本的完整兼容性。
- 当前 master 对所有 SDEZ 版本的完整兼容性。
- 私有 `LIBRARY_URL` 对应的具体区域、版本和构建来源。
- 所有功能和 AquaMai 的任意版本组合都无冲突。
- `DummyLogin` 在真实联机服务上的任何账号兼容承诺。
- 现有未发布二进制是否与当前源码一致。
