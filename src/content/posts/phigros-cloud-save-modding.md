---
title: 'Phigros 云存档改档实录：从拿 Token 到反编译客户端做「全解锁」'
description: '一次完整的 Phigros 改档记录（含续篇）：发现 sessionToken 其实明文躺在设备里、逆向 gameProgress v6、然后用 Il2CppDumper + Capstone + UnityPy 把客户端反编译出收藏品数据库与课题模式编码，实现全曲全难度 AP、曲绘/头像/收藏品全解锁、课题模式「彩色 52」。附无损往返校验与全套可复用工具。'
date: 2026-09-28
verifiedDate: 2026-10-07
tags:
  - Phigros
  - 逆向
  - 存档
  - il2cpp
  - UnityPy
  - 反编译
  - Android
  - TypeScript
category: 游戏
featured: false
draft: false
difficulty: 进阶
audience: 想自己解析或修改 Phigros 云存档、或对 Android 抓包、il2cpp 反编译与二进制存档格式感兴趣的人
hasCode: true
hasDownload: false
polished: false
lang: zh-CN
---

> ⚠️ **免责声明**：修改云存档违反游戏用户协议，存在封号风险。本文只记录技术过程，请在**自己有权限的账号**上操作，并务必先备份。文中所有 API Key / CA 证书都来自客户端本身或本机生成，不包含任何可用于绕过授权的密钥。
>
> 🧰 本文用到的全部工具已整理成仓库：**[Phigrsaves](https://github.com/Bad0RANG3/Phigrsaves)**（拿 Token + 改档 + 无损校验 + 资源提取）。

## 0. 结论先行（TL;DR）

- **Token 根本不用抓包**：登录后 `sessionToken` 是**明文**躺在设备上的 `/sdcard/Android/data/com.PigeonGames.Phigros/files/.userdata` 里，`cat` 出来即可。mitmproxy 那条链（系统证书 / SNI 中继 / DNAT）只在读不到该文件时才需要。
- **存档格式又升级了**：当前线上是 `gameKey v3`、`gameProgress v6`（Phigros 4.0.1）、`summary v7`，旧库直接报错。增量都是**尾部几个字节**，按原样保留即可无损往返。
- **字段名可以反编译拿到**：用 Il2CppDumper + Capstone 读出 `GameProgressSaveModule` / `GameKeySaveModule` 的真实字段，那些「unknown」字节全都有名字了（`sideStory4BeginReadKey`、`chapter9SecretPassword`……）。
- **收藏品不再是「反推」**：收藏品定义在 `CollectionDatabase`（ScriptableObject，在 `assets/bin/Data/data.unity3d`），用 **UnityPy** 挖出来是 **503 项 / 320 个 key**；存档里判定条件是 `save[key] >= subIndex`，所以「满进度」就是该 key 的最大 `subIndex`。
- **课题模式排名有编码**：`challengeModeRank = rankLevel * 100 + rankNum`，`rankLevel` 5 就是「彩色」。反编译依据是 `ChallengeModeOverControl.Back()` 里的一句 `madd w1, w23, #100, w20`。
- **改档安全底线**：解析 → 重新序列化必须**逐字节与原文件一致**（round-trip）。先跑通这个，再谈改值。
- **货币是 base-1024 分段的**：`[KB, MB, GB, TB, PB]`，不是随便填的大整数。

---

## 1. 背景

`phigros-save-manager` 是一个解析和修改 Phigros 云存档的 TypeScript 库。它的 `apiv2` 分支（PR #6）做了架构重构：把「云存档管理」和「存档编辑」拆开。

第一版我做的是：

1. 审 PR #6，修掉几个真实 bug，合并进 `main`。
2. 在 MuMu 模拟器上**抓包**拿到 session token。
3. 逆向当时的存档格式（`gameKey v3` / `gameProgress v5`），并保证无损往返。
4. 批量改档：货币、全曲全难度 AP、单曲解锁。
5. 从数据反推 `gameKey` 的槽位语义，做曲绘 / 头像 / 收集品解锁。

但改完之后发现**收藏品还是没到 100%**——说明「看着像是全解锁了」不够，得知道游戏**到底期望多少个**。于是有了这一轮的续篇：

6. 发现 **Token 压根不用抓包**，设备上就有明文。
7. 游戏升级到 4.0.1，存档格式变成 `gameProgress v6`，旧解析直接崩。
8. 干脆把客户端**反编译**：Il2CppDumper 拿类型布局，Capstone 读方法体，UnityPy 挖 ScriptableObject，从而拿到**完整曲库、真实难度、收藏品清单、课题模式编码**。

于是这篇文章从「改档记录」升级成了「改档 + 反编译记录」。

---

## 2. 环境

| 组件 | 版本 / 说明 |
|------|------|
| 模拟器 | MuMu Player 15（**Android 15**，自带 root） |
| 游戏 | Phigros **4.0.1**（versionCode 157） |
| Node.js | v26 |
| Python | 3.12（UnityPy / Capstone） |
| .NET | 6.0（跑 Il2CppDumper） |
| 抓包主机 | Windows（旧方法用得上 mitmproxy 12） |

MuMu 的 adb 路径（你自己的可能不同）：

```
D:\Program Files\Netease\MuMu\nx_main\adb.exe
```

连上模拟器并拿 root：

```bash
ADB="/d/Program Files/Netease/MuMu/nx_main/adb.exe"
# MuMu 15 默认 adb 端口 16384
"$ADB" connect 127.0.0.1:16384
"$ADB" -s 127.0.0.1:16384 root
"$ADB" -s 127.0.0.1:16384 shell id   # 应为 uid=0(root)
```

> ⚠️ Git Bash 会把 `/data/local/tmp/...` 这种远程路径改写成 Windows 路径。所有 adb 命令前加 `MSYS_NO_PATHCONV=1`。

---

## 3. 拿 Session Token

### 3.1 新方法：直接从设备读（推荐）

库不提供登录，它只拿 token 去读写云端。Token 是 LeanCloud 的会话令牌，游戏每个请求都带：

```
X-LC-Session: <sessionToken>
```

第一版我以为必须抓包才能拿到它。直到有一天顺手 `find` 了一下游戏的数据目录，发现了这个文件：

```bash
cat /sdcard/Android/data/com.PigeonGames.Phigros/files/.userdata
```

内容是一个 LeanCloud `_User` 指针的 JSON，**`sessionToken` 就在里面明文躺着**：

```json
{"__type":"Pointer","className":"_User",
 "objectId":"63135efb3e1e2f2281f6b32a",
 "authData":{"taptap":{...}},
 "nickname":"Bad0RANG3",
 "sessionToken":"0ggmkxar6vq69m4u1hcn9fz0z"}
```

于是一行命令就够了（`tools/get_token.sh`）：

```bash
ADB="/d/Program Files/Netease/MuMu/nx_main/adb.exe"
"$ADB" connect 127.0.0.1:16384
ADB="$ADB" tools/get_token.sh 127.0.0.1:16384
# 脚本解析 sessionToken 并写入仓库根目录 .env
```

> 💡 这个文件是 LeanCloud Unity SDK 持久化「当前用户」用的。只要设备有 root / 能读该文件，就完全不需要装证书、不需要 iptables、不需要代理。

### 3.2 备选：mitmproxy 抓包（Android 15）

如果 `.userdata` 读不到（比如没有 root），就得走抓包。链路是：**装系统 CA → 把 App 流量导进 mitmproxy → 从登录响应里取 `sessionToken`**。有两个 Android 特有的坑。

#### 3.2.1 Android 14/15 装系统 CA

Android 14+ 把 CA 库搬到了 Conscrypt APEX，而且 **app 进程 fork 自 zygote，zygote 有独立的 mount namespace**。所以要让 App 信任自签 CA，得对**每个进程**的 namespace 都 bind mount 一份「原始证书 + 我们的证书」（`tools/android_install_cert.sh`）：

```sh
#!/system/bin/sh
# 用法: sh android_install_cert.sh <cert_hash>
# 前置: adb root && adb push mitmproxy-ca-cert.pem /data/local/tmp/<hash>.0
HASH="${1:?need hash}"
SRC="/data/local/tmp/$HASH.0"
CA_DIR="/data/local/tmp/mitm_ca"
APEX_DIR="/apex/com.android.conscrypt/cacerts"
SYS_DIR="/system/etc/security/cacerts"

if [ ! -f "$CA_DIR/$HASH.0" ]; then
    rm -rf "$CA_DIR"; mkdir -p "$CA_DIR"
    cp "$SYS_DIR"/* "$CA_DIR"/
    cp "$SRC" "$CA_DIR/$HASH.0"
    chmod 644 "$CA_DIR"/*
    chcon u:object_r:system_file:s0 "$CA_DIR" "$CA_DIR"/* 2>/dev/null
fi

mount -o bind "$CA_DIR" "$APEX_DIR"
mount -o bind "$CA_DIR" "$SYS_DIR"

count=0
for pid in $(ls /proc | grep -E '^[0-9]+$'); do
    [ -e "/proc/$pid/ns/mnt" ] || continue       # 注意：-e，不是 -d
    if nsenter -t "$pid" -m -- mount -o bind "$CA_DIR" "$APEX_DIR" 2>/dev/null; then
        count=$((count+1))
    fi
    nsenter -t "$pid" -m -- mount -o bind "$CA_DIR" "$SYS_DIR" 2>/dev/null
done
echo "patched namespaces: $count"
```

踩过的坑：

- `[ -d /proc/<pid>/ns/mnt ]` **永远为 false**（它是指向 `mnt:[...]` 的魔术符号链接），要用 `-e`。
- toybox 的 `nsenter` 不支持 `--mount=`，要用 `-t <pid> -m -- <cmd>`，否则它会把 `mount -o` 里的 `-o` 当成自己的参数。
- 模拟器**重启后 bind mount 全部丢失**，要重跑脚本。

#### 3.2.2 Windows 上 mitmproxy 透明模式不可用 → SNI 中继

**Unity 的 UnityWebRequest 不走系统 HTTP 代理**（TapSDK 这类原生 Java 请求会走，游戏自己的 LeanCloud 请求直连绕过）。常规做法是 `iptables + mitmproxy --mode transparent`，但 Windows 上：

```
Transparent mode on Windows is unsupported, flaky, and deprecated.
```

所以额外写了一个小中继：**从裸 TLS 的 ClientHello 里解析 SNI，用 HTTP `CONNECT` 把它转给普通模式的 mitmproxy**（`tools/sni_relay.py`）：

```python
def parse_sni(payload: bytes):
    p = 4 + 2 + 32                 # handshake type+len, version, random
    sid_len = payload[p]; p += 1 + sid_len
    cs_len = struct.unpack(">H", payload[p:p+2])[0]; p += 2 + cs_len
    comp_len = payload[p]; p += 1 + comp_len
    ext_len = struct.unpack(">H", payload[p:p+2])[0]; p += 2
    end = p + ext_len
    while p + 4 <= end:
        etype = struct.unpack(">H", payload[p:p+2])[0]
        elen = struct.unpack(">H", payload[p+2:p+4])[0]
        p += 4
        if etype == 0:             # server_name
            q = p + 2 + 1
            nlen = struct.unpack(">H", payload[q:q+2])[0]
            return payload[q+2:q+2+nlen].decode("ascii", "ignore")
        p += elen
    return None
```

再把**游戏 UID** 的出站 443/80 DNAT 到中继（模拟器是 QEMU 用户态网络，host 就是 `10.0.2.2`）：

```bash
APPUID=10052   # stat -c %u /data/data/com.PigeonGames.Phigros
MSYS_NO_PATHCONV=1 "$ADB" -s 127.0.0.1:16384 shell "
  iptables -t nat -A OUTPUT -m owner --uid-owner $APPUID -p tcp --dport 443 \
    -j DNAT --to-destination 10.0.2.2:8081
  iptables -t nat -A OUTPUT -m owner --uid-owner $APPUID -p tcp --dport 80 \
    -j DNAT --to-destination 10.0.2.2:8081
"
```

链路：`游戏 →(DNAT 10.0.2.2:8081)→ SNI 中继 →(CONNECT)→ mitmproxy 8080 → LeanCloud`。

#### 3.2.3 从登录响应里取 Token

关键点：**`X-LC-Session` 不在登录请求里，而在响应里**，所以 mitmproxy 插件要同时看请求和响应（`tools/capture_token.py`，节选）：

```python
def request(flow: http.HTTPFlow) -> None:
    if "tapapis.cn" not in flow.request.pretty_host: return
    tok = flow.request.headers.get("X-LC-Session")
    if tok: _store(tok)

def response(flow: http.HTTPFlow) -> None:
    if "tapapis.cn" not in flow.request.pretty_host: return
    text = flow.response.get_text(strict=False) or ""
    m = re.search(r'"sessionToken"\s*:\s*"([^"]+)"', text)
    if m: _store(m.group(1))
```

---

## 4. 逆向存档格式

存档是一个 zip，里面 5 个文件，每个都是 **`[1 字节版本号] + AES-256-CBC(明文)`**：

```
gameKey v3 | gameProgress v6 | gameRecord v1 | settings v1 | user v1
```

AES key/IV 是写死在客户端里的常量（库里有）。**AES 只负责混淆，不是安全边界。**

### 4.1 二进制基本类型

| 类型 | 编码 |
|------|------|
| `byte` / `short` / `int` / `float` | 小端 |
| `varshort` | 首字节 bit7=1 则 `(b0 & 0x7f) + (b1 << 7)`，否则就是 `b0` |
| `string` | `varshort` 长度 + UTF-8 |
| `boolean` | **按位打包**：连续 bool 共用一字节，低位在前；切换到其它类型时刷出 |
| `object` | 可选 `[长度字节]` + 各字段；长度用于跳过预留/填充 |

### 4.2 各文件版本与增量

#### gameKey v3

结构是「名字 → 值数组」的 map。每个条目的真实布局是：

```
[string 名字] [长度A] [5位存在掩码 exist] [popcount(exist) 个字节的值]
```

旧库把它当成 `[valueFlags 计数] + valueFlags 个字节`，恰好能解析（因为 `A = 1 + popcount(exist)`），但语义是错的。

v3 相比 v2 只在**尾部多了 2 个字节**。第一版我只能「按原样保留」，这次反编译后知道它们是什么了：

```ts
if (version >= 3) {
  definition.push(
    { type: 'byte', field: 'sideStory4BeginReadKey' }, // Side Story 4「无相乡」开场
    { type: 'byte', field: 'oldScoreClearedV390' },    // 3.9.0 旧谱成绩清零标记
  )
}
```

#### gameProgress：v4 / v5 / v6

这是这次最大的变化——游戏从 `v5` 升到了 **`v6`**，旧库直接 `throw`。逐个版本看：

```ts
if (version >= 4) {
  // v4: chapter8SongUnlocked 后 +1 字节
  definition.push({ type: 'byte', field: 'flagOfSongRecordKeyTakumi' })
}
if (version >= 5) {
  // v5: 再 +3 字节 +1 字符串，全是第九章「秘密挑战」的
  definition.push(
    { type: 'byte', field: 'chapter9SecretChallengeLifeTier' },         // 生命档位
    { type: 'byte', field: 'chapter9SongUnlocked' },                    // 第九章歌曲解锁位
    { type: 'byte', field: 'chapter9SecretChallengeSelectedLifeTier' }, // 已选生命档位
    { type: 'string', field: 'chapter9SecretPassword' },                // 密码提示文本
  )
}
if (version >= 6) {
  // v6 (4.0.1): 再 +3 字节，第九章 Phase2 状态
  definition.push(
    { type: 'byte', field: 'chapter9Phase2A' },
    { type: 'byte', field: 'chapter9Phase2B' },
    { type: 'byte', field: 'chapter9Phase2C' },
  )
}
```

第一版我只能写「这 3 个字节和那段字符串语义不明」。这次反编译 `GameProgressSaveModule` 后，字段全对上了——那段字符串就是 `chapter9SecretPassword`（内容是一句像提示语的文本，游戏里用来解第九章的谜题）。

> 完整字段表（反编译确认）：
> `isFirstRun / legacyChapterFinished / completed / songsUpdateInfo / challengeModeRank / money[5] / unlockFlagOfSpasmodic / unlockFlagOfIgallta / unlockFlagOfRrharil / flagOfSongRecordKey / flagOfSongRecordKeyTakumi / alreadyShowCollectionTip / alreadyShowAutoUnlockINTip / randomVersionUnlocked / chapter8UnlockBegin / chapter8UnlockSecondPhase / chapter8Passed / chapter8SongUnlocked / chapter9UnlockBegin / chapter9SongUnlocked / chapter9SecretChallengeLifeTier / chapter9SecretChallengeSelectedLifeTier / chapter9SecretChallengePendingLifeUnlock / chapter9SecretPassword / chapter9Phase2SongUnlocked / chapter9Phase2Begin / chapter9Phase2Passed / c9BaselineChallengeReached / chapter9Phase2Step`

#### summary v7

summary 是**明文**（base64 后存在云端档案里），**不要加密**。v7 在 `gameVersion` 后多 1 字节：

```ts
if ((buff.at(0) ?? 0) >= 7) definition.push({ type: 'byte', field: 'unknownV7' })
```

顺带修了一个真·严重 bug：旧代码把 `summary.save()` 走了加密路径，**每次上传都会把明文 summary 写坏**。

### 4.3 无损往返：改档前必须过的关

原则：`原始 → 解析 → 重新序列化` 必须**逐字节一致**，否则不要上传（`tools/roundtrip.ts`）：

```ts
const original = fs.readFileSync(file)
const rebuilt = new PhigrosSave(original).createSave()
const oz = new AdmZip(original), rz = new AdmZip(rebuilt)
let allSame = true
for (const e of oz.getEntries()) {
  const a = PhigrosBinaryFile.decrypt(oz.readFile(e)!)
  const b = PhigrosBinaryFile.decrypt(rz.readFile(e)!)
  if (!a.equals(b)) { allSame = false; /* 打印第一处差异 */ }
}
console.log(allSame ? '✅ 无损往返' : '❌ 有差异，别上传')
```

这次升级到 `gameProgress v6` 后，我先把它加进解析器，跑一遍 `roundtrip` 确认 `✅ 无损往返`，才敢继续改值。

### 4.4 修掉的库 bug

| 文件 | 问题 |
|------|------|
| `phi-binary.ts` | 写数组时用 `if (!value[i])` 跳过元素，把合法的 **数值 0** 也丢了（货币后两位直接消失）。应只跳过 `null/undefined`。 |
| `record.ts` | 难度槽位只做了 4 个，而实际存在 **bit4 的第 5 个槽位**，会导致部分歌曲漏读 1 条记录。改为 5。 |
| `difficulties.ts` | 谱面表没收录的新曲会让 RKS 计算**直接抛异常**，改为返回 0。 |
| `cloud/api.ts` | 云端有**多个账号的存档**，`selectFirstProfile` 会选到别人的；要按「当前登录用户 + 最近更新时间」选。 |
| `cloud/summary.ts` | `save()` 错误加密 summary（见上）。 |

---

## 5. 反编译客户端

### 5.1 为什么非得反编译

改完第一版后，除了「收藏品不是 100%」之外，还有一堆只能靠猜的问题：

- `gameProgress v5/v6` 那几个字节到底啥意思？
- 收藏品到底有多少个？「满进度」的值怎么算？
- 课题模式的「彩色」是什么编码？
- 哪些歌真的有 AT？

「对照实验」能解决一部分，但**游戏自己就带着答案**。Phigros 是 Unity + IL2CPP，反编译路径其实很成熟。

### 5.2 Il2CppDumper：先拿类型布局

需要两个文件：

- `libil2cpp.so`：在 APK 的 `lib/arm64-v8a/`（MuMu 跑的是 arm64）。
- `global-metadata.dat`：在设备上 `/sdcard/Android/data/com.PigeonGames.Phigros/files/il2cpp/Metadata/`。

```bash
# 从 APK 里取出 libil2cpp.so（APK 内是 Stored，直接 unzip -p）
unzip -p base.apk lib/arm64-v8a/libil2cpp.so > libil2cpp.so
adb pull /sdcard/Android/data/com.PigeonGames.Phigros/files/il2cpp/Metadata/global-metadata.dat .

dotnet Il2CppDumper.dll libil2cpp.so global-metadata.dat out/
# -> out/dump.cs（类型 + 字段偏移 + 方法 RVA/文件偏移）
# -> out/DummyDll/（供 UnityPy 还原 type tree）
```

`dump.cs` 是纯类型布局，没有方法体，但**光字段名就够解决一大半问题**。比如 `GameProgressSaveModule` 直接列出了所有版本新增的字段：

```csharp
public class GameProgressSaveModule : ISaveModule {
    private byte flagOfSongRecordKey;          // 0x33
    private byte flagOfSongRecordKeyTakumi;    // 0x34   <- v4 那个未知字节
    ...
    private bool chapter9UnlockBegin;
    private bool[] chapter9SongUnlocked;
    private byte chapter9SecretChallengeLifeTier;          // <- v5 字节 1
    private byte chapter9SecretChallengeSelectedLifeTier;  // <- v5 字节 3
    private bool chapter9SecretChallengePendingLifeUnlock;
    private string chapter9SecretPassword;                 // <- v5 那个字符串
    private bool[] chapter9Phase2SongUnlocked;             // <- v6
    private byte chapter9Phase2Step;
}
```

`GameKeySaveModule` 也一样，顺带把 `gameKey v3` 尾部两个「unknown」正名了：

```csharp
public class GameKeySaveModule : ISaveModule {
    private Dictionary<string, List<byte>> keys;   // 槽位就在这
    private byte lanotaReadKeys;
    private byte camelliaReadKey;
    private byte sideStory4BeginReadKey;           // v3 字节 1
    private byte oldScoreClearedV390;              // v3 字节 2
}
```

### 5.3 读方法体：Capstone / Cpp2IL

有些逻辑必须看方法体。Il2CppDumper 的 `dump.cs` 给了每个方法的**文件偏移**，可以直接用 Capstone 反汇编 ARM64。比如课题模式的 `ChallengeModeOverControl.Back()`：

```asm
0x1d1e050: ldp  w20, w23, [x19, #0x58]   ; w20 = rankNum, w23 = rankLevel
0x1d1e074: mov  w8, #0x64                ; 100
0x1d1e078: madd w1, w23, w8, w20         ; w1 = rankLevel * 100 + rankNum
0x1d1e07c: bl   #0x1cbf1d0               ; 保存
```

一眼就看出课题模式排名的编码是 `rankLevel * 100 + rankNum`。再看 `Start()` 里 `rankLevel` 的阈值：

```asm
; w8 = 三首总分
0x2dc6c0 (3,000,000) -> rankLevel 5   ; 全 Phi
0x2cdc60 (2,940,000) -> rankLevel 4
0x2b7cd0 (2,850,000) -> rankLevel 3
0x2932e0 (2,700,000) -> rankLevel 2
0x258960 (2,500,000) -> rankLevel 1
```

**`rankLevel 5` 就是「彩色」**（三首全 1,000,000）。

> 如果嫌 Capstone 累，也可以用 **Cpp2IL** 直接生成带 IL 的伪 C#;两条路都能走。

### 5.4 UnityPy：挖 ScriptableObject

收藏品定义在一个名为 `CollectionDatabase` 的 `ScriptableObject` 里，打包在 `assets/bin/Data/data.unity3d`。问题是 il2cpp 构建把 MonoBehaviour 的 type tree 去掉了，UnityPy 单独读会报字节数对不上——**拿 Il2CppDumper 生成的 `DummyDll` 还原 type tree** 就行：

```python
import UnityPy
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator

gen = TypeTreeGenerator('2022.3.62f2')       # data.unity3d 头里的 Unity 版本
gen.load_local_dll_folder('il2cppdumper/DummyDll')
env = UnityPy.load('data.unity3d')
env.typetree_generator = gen

for obj in env.objects:
    if obj.type.name in ('MonoBehaviour', 'ScriptableObject'):
        d = obj.read(check_read=False)
        if getattr(d, 'm_Name', None) == 'CollectionDatabase':
            print(len(d.read().items))         # -> 503
```

每个 `CollectionItem` 有 `key`、`subIndex`、`getSong`、`name`、`content` 等字段。配套类（也是反编译看到的）：

```csharp
public class CollectionDatabase : ScriptableObject {
    private List<CollectionItem> items;                       // 503 项
    public static string BuildCollectionId(string key, int subIndex);
}
public class CollectionFolder : ISearchFilterable {
    public float get_Progress()   => files.Count / (float)allNum;   // 已收集 / 总数
}
```

把 503 项按 `key` 聚合，取每个 key 的最大 `subIndex`，就是存档里该 key 的「满进度」。这就是 `tools/phi_collections.json`（320 个 key）。

顺带一提，Addressables 的 `assets/aa/catalog.json` 里 `m_KeyDataString` 是一段 base64 的字符串表，**同时混着 UTF-8 和 UTF-16LE** 的资源地址，能提取出每首歌的 `Assets/Tracks/<id>/Chart_*.json`，从而知道真实难度（`tools/extract_tracks.py`）。

---

## 6. 全解锁

核心流程：`选当前用户最新档 → 备份 → 改内存对象 → 重新打包上传`。下面逐块说。

### 6.1 gameKey 的槽位语义

`gameKey` 是「名字 → 最多 5 个值」的 map。第一版靠对照实验反推，这一轮结合反编译基本定死了：

| 槽位 | 含义 |
|------|------|
| `slot0` | 收藏品「已解锁」 |
| `slot1` | 歌曲「已解锁」（需 data 购买的单曲） |
| `slot2` | 收藏品「已获得进度」 |
| `slot3` | 曲绘「已解锁」 |
| `slot4` | 头像「已解锁」 |

每个条目用 `exist` 掩码声明自己有哪些槽位。例如单曲是 `slot1+slot3` 即 `exist=0b01010`。

取 / 写槽位的辅助函数：

```ts
const getSlots = (k: any) => {
  const e = k.values[0]
  const a = [0, 0, 0, 0, 0]
  let vi = 1
  for (let b = 0; b < 5; b++) if ((e >> b) & 1) a[b] = k.values[vi++]
  return a
}
const setSlots = (k: any, a: number[]) => {
  let e = 0
  for (let b = 0; b < 5; b++) if (a[b]) e |= 1 << b
  const v = [e]
  for (let b = 0; b < 5; b++) if ((e >> b) & 1) v.push(a[b])
  k.valueFlags = v.length
  k.values = v
}
```

### 6.2 曲目与真实难度

第一版有两个坑：

- 「贝多芬祝福」实际只有 EZ/HD/IN，却被无脑补了 AT，结果**游戏不认这首歌**。
- 有些歌的难度数根本不知道。

这次直接用社区曲库 [phi-plugin](https://github.com/Catrong/phi-plugin) 的 `info.csv`（327 首，含每首的 EZ/HD/IN/AT 定数）。按真实难度补记录，不再乱塞：

```ts
type Info = { id: string; name: string; diffs: number[] }   // diffs 是 0..3

for (const r of records) {
  const id = r.songName.replace(/\.0$/, '')
  const meta = infoById.get(id)
  const hasBit4 = (r.records.levelExsistanceFlag & (1 << 4)) !== 0
  // 已有记录全部拉满
  for (const lv of r.records.levelRecords) {
    if (!lv) continue
    lv.score = 1000000
    lv.accuracy = 100
  }
  // 只补「真实存在」的难度
  if (meta) for (const d of meta.diffs) {
    if (d === 3 && hasBit4) continue          // bit4 歌曲的 AT 在 bit4，别塞 bit3
    if (!r.records.levelRecords[d]) {
      r.records.levelRecords[d] = makeRecord()
      r.records.levelExsistanceFlag |= 1 << d
    }
  }
  r.records.fcFlag = r.records.levelExsistanceFlag
}
```

曲名的匹配还有个坑：**`info.csv` 里有些歌名带尾随空格**，而游戏 `gameKey` 里又是另一种写法（`Äventyr` ↔ `Aventyr`、`ENERGY SYNERGY MATRIX` ↔ `Energy Synergy Matrix`、`NYA!!! (Phigros ver.)` ↔ `NYA!!!`）。所以做了个归一化匹配，只有**确实找不到任何变体**时才新建条目，避免造出重复条目。

### 6.3 曲绘 / 头像

- **曲绘**：给有 `slot1` 或属于曲库的歌曲补 `slot3`。
- **头像**：按 phi-plugin 的 `avatar.txt`（109 个）补 `slot4`。这次比参考库（104）多补了 `鸠-AprilFool`、`Gino-AprilFool`、`Oblivion: PHIN`。

### 6.4 收藏品：从「反推」到「查表」

这是这次的重头戏。第一版只把存档里**已有**的收藏品条目解锁，但**存档里根本没有的条目**就漏了。反编译出 `CollectionDatabase` 后直接对表：

```ts
// phi_collections.json: key -> 该 key 的最大 subIndex（满进度）
const collDefs = JSON.parse(fs.readFileSync('tools/phi_collections.json', 'utf8'))
for (const [key, total] of Object.entries(collDefs)) {
  const ks = gkByName.get(key)
  if (!ks?.length) {
    // 存档里彻底没有这个收藏品 -> 新建（slot0+slot2）
    gk.push({ songName: key, valueFlags: 3, values: [0b00101, total, total] })
    continue
  }
  for (const k of ks) {
    const a = getSlots(k)
    const v = Math.max(a[0], a[2], total)     // 只增不减
    if (a[0] !== v || a[2] !== v) { a[0] = a[2] = v; setSlots(k, a) }
  }
}
```

对表后发现了 **17 处问题**：

- **14 个 key 存档里完全没有**：`domeabout2/4/5`、`guguthinking2/3`、`unknownsignal1~8`、`unknownsignal10`；
- **3 个 key 进度不够**：`nizhidaoma` 2→4、`sundemimi` 1→4、`heimu1` 1→2。

补完收藏品才真正 100%。

### 6.5 课题模式

`challengeModeRank` 一个 short 存了名次和颜色：

```
challengeModeRank = rankLevel * 100 + rankNum
```

`rankLevel` 1..5（5 = 彩色），`rankNum` = 三首谱面定数之和。想要「彩色 52」就是 `5*100+52 = 552`。云端的 summary 里也有一份同样的值，要一起改：

```ts
import { encodeChallengeRank } from '../src/types/progress'
save.gameProgress.challengeModeRank = encodeChallengeRank(5, 52)
service.summary.challengeModeRank = encodeChallengeRank(5, 52)
```

### 6.6 货币：base-1024 的分段数字

`money` 是 5 个 `varshort`，但**不是随便填的大整数**，而是 **base-1024 分段的**，从低到高：

```
[KB, MB, GB, TB, PB]
```

例如 `[795, 427, 954, 0, 0]` = `954 GB + 427 MB + 795 KB ≈ 954.42 GB`。把每段设成 `varshort` 上限 `32767` 时游戏**拉档失败**（报「请检查网络连接」）——因为 1024 才是进位基数，单段塞了非法大数。正确做法是每段保持在 `0..1023`：

```ts
save.gameProgress.money = [1023, 1023, 1023, 1023, 0]
```

---

## 7. 改档流程与安全

一次完整上传大概长这样（`tools/apply_all.ts`）：

```ts
const service = await new PhigrosCloudServiceAPI(token)
  .selectProfile(p => p.objectId === targetProfileId)    // 选当前用户最新的档
const save = await service.getPlayerSave()
fs.writeFileSync(backup, await service.getPlayerSaveBytes())  // 先备份原始档

await applyEdits(save)                                   // 改内存对象
await service.uploadSave(save.createSave())              // 重新打包 + 上传

// 再拉一次复核
const fresh = await (await connect()).getPlayerSave()
```

`apply_all.ts` 里还内置了 `plan`（预演，只生成预览文件不上传）和 `verify.ts`（改完后按曲库 / 头像 / 收藏品 / 课题模式逐项校验）。

**多账号坑**：LeanCloud 的 `_GameSave` 表里混着很多账号的存档。「取第一条」很可能拿到别人的档（读得到、写会被 ACL 拒绝，报 `Forbidden to write object by ACL`）。要按「当前登录用户 + 最近更新时间」选：

```ts
const me = await api.getCurrentUser()                    // GET /users/me
const mine = saves.results
  .filter(p => p.user.objectId === me.objectId)
  .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
```

改完**进游戏「云存档 → 下载」**才能看到效果。

---

## 8. 不确定 / 未完成的清单

- `gameProgress v6` 的 3 个字节虽然已知是第九章 Phase2 状态，但**逐位含义还没完全确定**（只知道按原样保留能无损往返）。
- `levelExsistanceFlag` 的 `bit4` 是「第 5 个难度槽位」，少数歌用 bit4 而不是 bit3 存第 4 个难度；本文做法是「见到 bit4 就不补 bit3 的 AT」。
- `gameKey` 槽位语义是「反编译 + 实验」结合得出的，不排除个别条目归类偏差（有备份可还原）。
- 本库内置的定数表偏旧，**库算出来的 RKS 偏低**（不影响存档；游戏会自己重算，云摘要里就是正确的 17.3）。
- 新内容永远滞后于游戏本身，遇到新版本要重新跑一遍反编译 / 资源提取。

---

## 9. 复用到的工具

完整可运行的工具在仓库：**<https://github.com/Bad0RANG3/Phigrsaves>**

| 文件 | 作用 |
|------|------|
| `tools/get_token.sh` | 直接从设备 `.userdata` 读 `sessionToken`（免抓包） |
| `tools/extract_collections.py` | UnityPy 从 `data.unity3d` 提取收藏品清单 |
| `tools/extract_tracks.py` | 从 Addressables catalog 提取曲目与真实难度 |
| `tools/apply_all.ts` | 主力改档：全解锁 + 全 AP + 课题模式 |
| `tools/verify.ts` | 改档后的完整校验 |
| `tools/inspect.ts` | 离线查看存档字段 |
| `tools/roundtrip.ts` | 上传前的无损往返校验 |
| `tools/diffrec.ts` / `summary.ts` | 存档差异 / 云摘要 |
| `tools/android_install_cert.sh` | Android 14/15 把 CA 装进所有 mount namespace（备选） |
| `tools/sni_relay.py` | 裸 TLS → `CONNECT` → mitmproxy 中继（备选） |
| `tools/capture_token.py` | mitmproxy 插件，从登录响应抓 token（备选） |

---

## 10. 一句话总结

**第一版证明了「改哪几个字节」不难，难的是自证无损；这一版证明了更省事的做法——别猜，去反编译。** `sessionToken` 明文就在设备上，收藏品的期望值就在 `CollectionDatabase` 里，课题模式的编码就写在 `madd` 那一条指令里。剩下的，都是对照实验。
