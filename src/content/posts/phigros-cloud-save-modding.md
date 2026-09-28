---
title: 'Phigros 云存档改档实录：从抓 Token 到逆向新版存档格式'
description: '一次完整的 Phigros 云存档修改记录：MuMu(Android 15) 装系统证书抓包、Windows 下用 SNI 中继绕开 mitmproxy 透明模式限制、逆向 gameKey v3 / gameProgress v5 / summary v7 的增量字段，并用无损往返验证批量改档；还逆向出 gameKey 的槽位语义（歌曲/曲绘/头像/收集品）实现全解锁（含第九章）。含可复用代码。'
date: 2026-09-28
verifiedDate: 2026-09-28
tags:
  - Phigros
  - 逆向
  - 存档
  - 抓包
  - mitmproxy
  - Android
  - TypeScript
category: 游戏
featured: false
draft: false
difficulty: 进阶
audience: 想自己解析或修改 Phigros 云存档、或对 Android 抓包与二进制存档格式感兴趣的人
hasCode: true
hasDownload: false
polished: false
lang: zh-CN
---

> ⚠️ **免责声明**：修改云存档违反游戏用户协议，存在封号风险。本文只记录技术过程，请在**自己有权限的账号**上操作，并务必先备份。文中所有 API Key / CA 证书都来自客户端本身或本机生成，不包含任何可用于绕过授权的密钥。
>
> 🧰 本文用到的全部工具已整理成仓库：**[Phigrsaves](https://github.com/Bad0RANG3/Phigrsaves)**（抓包 + 改档 + 无损校验）。

## 0. 结论先行（TL;DR）

- **Token 能抓**：Phigros 用的是 LeanCloud 会话令牌，放在请求头 `X-LC-Session`。它**不在请求里，而在登录响应里**，所以要在 `POST /1.1/users` 的**响应**中拿 `sessionToken`。
- **Android 15 装系统证书**：`/system` 只读，`adb remount` 不可用，必须把“原始证书 + 自签 CA”的副本 **bind mount 到每个进程的 mount namespace**（否则只有 shell 能看到，App 看不到）。
- **Unity 不走系统代理**：游戏自己的网络栈忽略 `http_proxy`，必须用 `iptables DNAT` 把直连流量导入代理；而 **Windows 上 mitmproxy 的 transparent 模式不可用**，所以额外写了一个 **SNI 中继**，把裸 TLS 连接用 `CONNECT` 转给 mitmproxy。
- **存档格式又升级了**：当前线上是 `gameKey v3`、`gameProgress v5`、`summary v7`，旧库直接报错。增量其实很小（尾部多几个字节 / 一个字符串），全部按原样保留即可。
- **改档安全底线**：解析 → 重新序列化必须**逐字节与原文件一致**（round-trip）。先跑通这个，再谈改值。
- **解锁单曲靠 `gameKey`**：对照实验证明，用 data 解锁一首单曲后，`gameKey` 会**新增一个该曲名的条目**。往 `gameKey` 里补条目，就能解锁。
- **`gameKey` 的槽位语义**：`slot1`=歌曲、`slot3`=曲绘、`slot4`=头像、`slot0/slot2`=收集品（阅读给 data 的小故事）。**哪一项没解锁，就补哪个槽位**。
- **货币是 base-1024 分段的**：`[KB, MB, GB, TB, PB]`，不是随便填的大整数。

---

## 1. 背景

`phigros-save-manager` 是一个解析和修改 Phigros 云存档的 TypeScript 库。它的 `apiv2` 分支（PR #6）做了架构重构：把「云存档管理」和「存档编辑」拆开。

我做的事大致分五段：

1. 审 PR #6，修掉几个真实 bug（summary 被错误加密、CLI 判断反了、测试过期等），合并进 `main`。
2. 在自己的 MuMu 模拟器上抓包拿到 session token。
3. 逆向当前版本的存档格式（旧库已不兼容），并保证无损往返。
4. 批量改档：货币、全曲全难度 AP、用 data 购买的单曲解锁。
5. 逆向 `gameKey` 的槽位语义，实现**曲绘 / 头像 / 收集品（小故事）全解锁**，包括完全不在存档里的第九章曲目。

---

## 2. 环境

| 组件 | 版本 / 说明 |
|------|------|
| 模拟器 | MuMu Player 15（**Android 15**，自带 root） |
| 游戏 | Phigros 4.0.0 |
| Node.js | v26 |
| Python | 3.12 |
| mitmproxy | 12.2.3（装在独立 venv，避免污染全局 pydantic） |
| 抓包主机 | Windows，Clash TUN 在跑（有影响，见后文） |

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

## 3. 抓 Session Token

### 3.1 为什么需要 Token

库不提供登录，它只拿 token 去读写云端。Token 是 LeanCloud 的会话令牌，游戏每个请求都带：

```
X-LC-Session: <sessionToken>
```

抓包链路：**Android 装 mitmproxy 的 CA → 把 App 流量导入 mitmproxy → 抓登录响应里的 `sessionToken`**。

### 3.2 Android 15 装系统 CA

Android 14+ 把 CA 库搬到了 Conscrypt APEX，而且 **app 进程 fork 自 zygote，zygote 有独立的 mount namespace**。所以要让 App 信任自签 CA，得对**每个进程**的 namespace 都 bind mount 一份“原始证书 + 我们的证书”。

关键脚本（`tools/android_install_cert.sh`）：

```sh
#!/system/bin/sh
# 用法: sh android_install_cert.sh <cert_hash>
# 前置: adb root && adb push mitmproxy-ca-cert.pem /data/local/tmp/<hash>.0

HASH="${1:?need hash}"
SRC="/data/local/tmp/$HASH.0"
CA_DIR="/data/local/tmp/mitm_ca"
APEX_DIR="/apex/com.android.conscrypt/cacerts"
SYS_DIR="/system/etc/security/cacerts"

# 只构建一次；源码取自只读 rootfs，避免取到自己
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
    [ -e "/proc/$pid/ns/mnt" ] || continue
    # 注意 tocbox nsenter 必须用 `--` 结束自身选项
    if nsenter -t "$pid" -m -- mount -o bind "$CA_DIR" "$APEX_DIR" 2>/dev/null; then
        count=$((count+1))
    fi
    nsenter -t "$pid" -m -- mount -o bind "$CA_DIR" "$SYS_DIR" 2>/dev/null
done
echo "patched namespaces: $count"
```

证书文件名要用 **Android 的旧式 subject hash**：

```bash
HASH=$(openssl x509 -inform PEM -subject_hash_old \
       -in "$HOME/.mitmproxy/mitmproxy-ca-cert.pem" | head -1)
```

踩过的坑：

- `[ -d /proc/<pid>/ns/mnt ]` **永远为 false**（它是指向 `mnt:[...]` 的魔术符号链接），要用 `-e`。
- toybox 的 `nsenter` 不支持 `--mount=`，要用 `-t <pid> -m -- <cmd>`，否则它会把 `mount -o` 里的 `-o` 当成自己的参数。
- 模拟器**重启后 bind mount 全部丢失**（`is_android_started` 之类），要重跑脚本；这也是我第一次抓包失败的原因。

验证游戏进程能看到证书（数量应比原始多 1）：

```bash
PID=$(MSYS_NO_PATHCONV=1 "$ADB" -s 127.0.0.1:16384 shell pidof com.PigeonGames.Phigros)
MSYS_NO_PATHCONV=1 "$ADB" -s 127.0.0.1:16384 shell \
  "nsenter -t $PID -m -- ls /apex/com.android.conscrypt/cacerts/$HASH.0"
```

### 3.3 Windows 上 mitmproxy 透明模式不可用 → SNI 中继

**Unity 的 UnityWebRequest 不走系统 HTTP 代理**（实测：TapSDK 这类原生 Java 请求会走代理，游戏自己的 LeanCloud 请求直连绕过）。

常规做法是 `iptables + mitmproxy --mode transparent`，但：

```
Transparent mode on Windows is unsupported, flaky, and deprecated.
```

所以我在 host 上写了个小中继：**从裸 TLS 的 ClientHello 里解析出 SNI，用 HTTP `CONNECT` 把它转给普通模式的 mitmproxy**。

```python
# tools/sni_relay.py（节选）
import select, socket, struct

def parse_sni(payload: bytes):
    """从 ClientHello 的 handshake 负载里解析 SNI。"""
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

def handle(client, proxy_host, proxy_port):
    hdr = recv_exact(client, 5)
    body = recv_exact(client, struct.unpack(">H", hdr[3:5])[0])
    sni = parse_sni(body)
    up = socket.create_connection((proxy_host, proxy_port), timeout=10)
    up.sendall(f"CONNECT {sni}:443 HTTP/1.1\r\nHost: {sni}:443\r\n\r\n".encode())
    resp = b""
    while b"\r\n\r\n" not in resp:
        resp += up.recv(1)
    up.sendall(hdr + body)         # 转发已消费的 ClientHello
    pipe(client, up)               # 双向管道
```

### 3.4 iptables DNAT：把游戏直连导进中继

模拟器是 QEMU 用户态网络，host 就是 `10.0.2.2`。把**游戏 UID** 的出站 443/80 转到中继的 8081：

```bash
APPUID=10054   # stat -c %u /data/data/com.PigeonGames.Phigros

MSYS_NO_PATHCONV=1 "$ADB" -s 127.0.0.1:16384 shell "
  iptables -t nat -A OUTPUT -m owner --uid-owner $APPUID -p tcp --dport 443 \
    -j DNAT --to-destination 10.0.2.2:8081
  iptables -t nat -A OUTPUT -m owner --uid-owner $APPUID -p tcp --dport 80 \
    -j DNAT --to-destination 10.0.2.2:8081
"
```

链路：`游戏 → (DNAT 10.0.2.2:8081) → SNI 中继 → (CONNECT) → mitmproxy 8080 → LeanCloud`。

> 收尾时记得 `-D` 删除规则、`settings put global http_proxy :0`、停掉进程，否则游戏会“连不上网”。

### 3.5 从登录响应里提取 Token

关键点：**`X-LC-Session` 不在登录请求里，而在响应里**。所以 mitmproxy 插件要同时看请求和响应：

```python
# tools/capture_token.py（节选）
import re
from pathlib import Path
from mitmproxy import http

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

def _store(token: str) -> None:
    text = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    if re.search(r"^PHIGROS_TOKEN=.*$", text, re.M):
        text = re.sub(r"^PHIGROS_TOKEN=.*$", f"PHIGROS_TOKEN={token}", text, flags=re.M)
    else:
        text = text.rstrip() + f"\nPHIGROS_TOKEN={token}\n"
    ENV_FILE.write_text(text, encoding="utf-8")
    print("[+] captured X-LC-Session")

def request(flow: http.HTTPFlow) -> None:
    if "tapapis.cn" not in flow.request.pretty_host: return
    tok = flow.request.headers.get("X-LC-Session")
    if tok: _store(tok)

def response(flow: http.HTTPFlow) -> None:
    if "tapapis.cn" not in flow.request.pretty_host: return
    try: text = flow.response.get_text(strict=False) or ""
    except Exception: text = ""
    m = re.search(r'"sessionToken"\s*:\s*"([^"]+)"', text)
    if m: _store(m.group(1))
```

抓到的 token 写进 `.env` 后，库就能用了。实测 token 形如 `0ggmkxar6vq69m4u1hcn9fz0z`。

---

## 4. 逆向新版存档格式

存档是一个 zip，里面 5 个文件，每个都是 **`[1 字节版本号] + AES-256-CBC(明文)`**：

```
gameKey v3 | gameProgress v5 | gameRecord v1 | settings v1 | user v1
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

### 4.2 各文件增量

#### gameKey v3

结构是「名字 → 值数组」的 map，但**每个条目的“值”不是简单数组**，真实布局是：

```
[string 名字] [长度A] [5位存在掩码 exist] [popcount(exist) 个字节的值]
```

而旧库把它当成 `[valueFlags 计数] + valueFlags 个字节`，恰好能解析（因为 `A = 1 + popcount(exist)`），但语义是错的。

v3 相比 v2 只在**尾部多了 2 个字节**，按原样保留即可：

```ts
const version = buff.at(0)!
if (version !== 2 && version !== 3) throw new Error(`unsupported gameKey v${version}`)
const definition: PhigrosBinaryStructure[] = [/* keys 数组 */, lanotaReadKeys, camelliaReadKey]
if (version >= 3) {
  definition.push(
    { type: 'byte', field: 'unknownV3A' },
    { type: 'byte', field: 'unknownV3B' },
  )
}
```

#### gameProgress v5

- v4：`chapter8SongUnlocked` 后多 **1 字节**。
- v5：再多 **3 字节 + 1 个字符串**（长度用 varshort）。

```ts
if (version >= 4) definition.push({ type: 'byte', field: 'unknownV4' })
if (version >= 5) {
  definition.push(
    { type: 'byte', field: 'unknownV5A' },
    { type: 'byte', field: 'unknownV5B' },
    { type: 'byte', field: 'unknownV5C' },
    { type: 'string', field: 'unknownV5String' },
  )
}
```

> ❓ **不清楚**：这 3 个字节和那段字符串（内容是一句类似提示语的文本）到底代表什么，官方和参考库都没有文档。只知道按原样保留能无损往返。

#### summary v7

summary 是**明文**（base64 后存在云端档案里），**不要加密**。v7 在 `gameVersion` 后多 1 字节：

```ts
if ((buff.at(0) ?? 0) >= 7) definition.push({ type: 'byte', field: 'unknownV7' })
```

顺带修了一个真·严重 bug：旧代码把 `summary.save()` 走了加密路径，**每次上传都会把明文 summary 写坏**。

### 4.3 无损往返：改档前必须过的关

原则：`原始 → 解析 → 重新序列化` 必须**逐字节一致**，否则不要上传。把校验做成工具（`tools/roundtrip.ts`）：

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

### 4.4 这一轮修掉的库 bug

| 文件 | 问题 |
|------|------|
| `phi-binary.ts` | 写数组时用 `if (!value[i])` 跳过元素，把合法的 **数值 0** 也丢了（货币后两位直接消失）。应只跳过 `null/undefined`。 |
| `record.ts` | 难度槽位只做了 4 个，而实际存在 **bit4 的第 5 个槽位**，会导致部分歌曲漏读 1 条记录。改为 5。 |
| `difficulties.ts` | 谱面表没收录的新曲会让 RKS 计算**直接抛异常**，改为返回 0。 |
| `cloud/api.ts` | 云端有**多个账号的存档**，`selectFirstProfile` 会选到别人的；要按「当前登录用户 + 最近更新时间」选。 |
| `cloud/summary.ts` | `save()` 错误加密 summary（见上）。 |

---

## 5. 改档

核心流程（`tools/edit.ts`）：

```ts
const service = await new PhigrosCloudServiceAPI(token)
  .selectProfile(p => p.objectId === targetProfileId)   // 选当前用户最新的档
const save = await service.getPlayerSave()

await applyEdits(save)                    // 改内存里的对象
await service.uploadSave(save.createSave())  // 重新打包 + 上传
```

`apply` 会**先自动备份**原始云存档到 `backups/`。

### 5.1 货币：base-1024 的分段数字

`money` 是 5 个 `varshort`，但**不是随便填的大整数**，而是 **base-1024 的分段数字**，从低到高：

```
[KB, MB, GB, TB, PB]
```

例如 `[795, 427, 954, 0, 0]` = `954 GB + 427 MB + 795 KB ≈ 954.42 GB`，和游戏内显示完全对得上。

这也解释了之前的坑：把每项都设成 `varshort` 上限 `32767` 时，游戏**拉档失败**（报“请检查网络连接”）。因为 1024 才是进位基数，单段塞进一个超大的“非法数字”，解析/校验就挂了。正确做法是让每段保持在 `0..1023`，需要更大就往上进位。

```ts
// 954.42 GB
save.gameProgress.money = [795, 427, 954, 0, 0]

// 把 GB 段设到 1024（理论上应进位成一个更大的单位）
save.gameProgress.money = [0, 0, 1024, 0, 0]
```

> ✅ **已确认**：游戏加载 `[0,0,1024,0,0]` 正常，能拉档。这条也反过来印证了「每段必须在合法范围内」——之前 `32767` 之所以拉档失败，就是单段塞了非法大数。

### 5.2 全曲全难度 AP

要点：

- 已有记录：`score = 1000000`、`accuracy = 100`。
- 缺失难度：补记录，并打开 `levelExsistanceFlag` 对应位。
- `gameRecord` 的记录数组槽位已扩到 5。

```ts
const makeRecord = () => ({
  score: 1000000,
  accuracy: 100,
  rks(diff: number) {
    return this.accuracy < 70 ? 0 : diff * (((this.accuracy - 55) / 45) ** 2)
  },
})

for (const song of save.gameRecord.records) {
  const flag = song.records.levelExsistanceFlag
  const maxDiff = (flag & (1 << 4)) ? 3 : 4      // 用了第 5 槽就不补 AT
  for (let i = 0; i < maxDiff; i++) {
    if (!song.records.levelRecords[i]) {
      song.records.levelRecords[i] = makeRecord()
      song.records.levelExsistanceFlag |= (1 << i)
    }
  }
  for (const lv of song.records.levelRecords) {
    if (!lv) continue
    lv.score = 1000000
    lv.accuracy = 100
  }
}
```

> ❓ **不清楚**：`levelExsistanceFlag` 里 `bit4` 到底是什么（少数歌用 bit4 而非 bit3 表示第 4 个难度）。本文的做法是：见到 bit4 就不补 AT，避免冲突。

### 5.3 解锁单曲（重点）

「单曲精选集」里有些歌要用 **data（货币）购买解锁**。做法是**对照实验**：

1. 先存一份完整云存档作为基准。
2. 在游戏里用 data 解锁一首歌，然后**上传**。
3. 逐文件、逐条目对比基准与新版。

结论（实测解锁「下一秒」后）：

- `gameProgress`：**只有货币少了 12**（解锁花费），没有新增标志位。
- `gameKey`：**新增了「下一秒」条目**，形态为 `exist=0b00010`（只有一个 slot1=1）。
- `gameRecord`：解锁的歌本身能保留记录，但**记录的有无并不决定是否锁定**（实测锁定歌也能有记录，且被游戏保留）。

也就是说：**歌曲解锁状态存在 `gameKey`：有该曲名的条目 = 已解锁。**

于是批量解锁就是把缺条目的曲名补进去：

```ts
const lockedSingles = JSON.parse(fs.readFileSync('locked_singles.json', 'utf8'))
const gkNames = new Set(save.gameKey.keys.map(k => k.songName))
for (const s of lockedSingles) {
  if (!gkNames.has(s.name)) {
    // exist=0b00010，values 结构为 [exist, slot1]
    save.gameKey.keys.push({ songName: s.name, valueFlags: 2, values: [2, 1] })
  }
}
```

实测这招**有效**：Cleyera、星拂云锦、After ZABANIYA 等一批锁定单曲全部解锁。

> ⚠️ 注意：`gameKey` 条目的属性名在解析结果里其实是 `songName`，而库的类型定义写的是 `name`——是个类型标注错误，用的时候别被坑。

### 5.4 云端多账号存档

LeanCloud 的 `_GameSave` 表里**混着很多账号的存档**。直接“取第一条”很可能拿到别人的档（读得到、写会被 ACL 拒绝，报 `Forbidden to write object by ACL`）。正确姿势：

```ts
const api = new PhigrosCloudServiceAPI(token)
const me = await api.getCurrentUser()              // GET /users/me
const saves = await api.readRemoteSaves()
const mine = saves.results
  .filter(p => p.user.objectId === me.objectId)
  .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
const service = await api.selectProfile(p => p.objectId === mine[0].objectId)
```

---

## 6. gameKey 的槽位语义与「全解锁」

`gameKey` 是「名字 → 最多 5 个值」的 map。经过多轮对照实验与批量尝试，5 个槽位的含义基本可以确定了（**没有官方文档，全部是从数据反推的**）：

| 槽位 | 含义 |
|------|------|
| `slot0` | 收集品 / 小故事「已解锁」 |
| `slot1` | 歌曲「已解锁」（需 data 购买的单曲） |
| `slot2` | 收集品 / 小故事「获得数量」 |
| `slot3` | 曲绘「已解锁」 |
| `slot4` | 头像「已解锁」 |

每个条目用 `exist` 掩码声明自己有哪些槽位。例如一首普通歌是 `slot1`（有曲绘时再加 `slot3`）即 `exist=0b01010`；一个头像至少 `slot4`；一个收集品是 `slot0+slot2`（两值通常相同）。

> 这里的「收集品」就是**阅读一下就能获得 data 的小故事**，游戏内叫「收藏品」。

取 / 写这 5 个槽位的辅助函数：

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

### 6.1 曲绘

给「**有 `slot1` 但无 `slot3`**」的歌曲补上 `slot3`。实测补了 **16 条**，游戏里缺的曲绘随即出现。

### 6.2 收集品 / 小故事

给所有「用 `slot0/slot2`」的条目补齐 `slot0`，并令 `slot0 = slot2 = max(两者)`。实测补了 **6 条**（其中 5 条原本只有 `slot2`、没解锁）。

### 6.3 第九章「穹顶孤舟」是特例

有 5 首歌在 `gameKey` 里**彻底没有条目**（所以既没解锁状态、也没曲绘），必须整条补：

```ts
const ch9 = [
  { id: 'AboutTheUniverse.SOTUIMIssionary', name: 'About The Universe', diffs: 3 },
  { id: 'EntrancetotheChaos.打打だいずvssiromaru', name: 'Entrance to the Chaos', diffs: 4 },
  { id: 'Evanescent.LeaF', name: 'Evanescent', diffs: 3 },
  { id: 'ExoplanetaryMirage.かめりあ', name: 'Exoplanetary Mirage', diffs: 4 },
  { id: 'Implexrough.Silentroommommy', name: 'Implexrough', diffs: 3 },
]
for (const s of ch9) {
  // slot1(歌曲) + slot3(曲绘) = exist 0b01010
  save.gameKey.keys.push({ songName: s.name, valueFlags: 3, values: [0b01010, 1, 1] })
  // gameRecord 里再补上全 AP 记录（略）
}
```

补完后，之前一直缺的 **4 张曲绘**全部出现。

### 6.4 反直觉的坑：难度数不能乱塞

「贝多芬祝福 (Beethoven Blessing)」的谱面**只有 EZ/HD/IN 三个难度（没有 AT）**，但批量补 AT 时被塞了第 4 条记录，结果**游戏不认这首歌、不显示 AP**。把它改回 3 个难度（清掉 AT、`levelExsistanceFlag = 7`）后恢复正常。

**教训**：补难度位要按谱面**真实难度数**来，不能无脑补满。新曲的难度数可以从社区曲库（如 [phi-plugin](https://github.com/Catrong/phi-plugin) 的 `info.csv`）查到。

### 6.5 头像

参考库（2025-10）只有 104 个头像，phi-plugin 已更新到 **108 个**（多了 `鸠-一周年相聚`、`水青-一周年相聚`、`鸠-AprilFool`、`Gino-AprilFool`、`Oblivion:PHIN` 等）。gameKey 里 106 条带 `slot4`，即**绝大多数头像本就已解锁**。

---

## 7. 不确定 / 未完成的清单

- `gameProgress` v5 新增的 3 字节 + 字符串，**语义仍不明**（只知道按原样保留能无损往返）。
- `levelExsistanceFlag` 的 `bit4` 是「第 5 个难度槽位」，但具体对应略（本文做法：见到 bit4 就不补 AT）。
- `gameKey` 槽位语义是从数据**反推**的，不排除个别条目归类有偏差（有备份可还原）。
- 谱面定数表是旧的，新曲 RKS 会偏低（不影响存档本身）。
- 参考库（`PhigrosLibrary` / 定数表）更新滞后于游戏，遇到新内容要以游戏本体或社区曲库（phi-plugin）为准。

---

## 8. 复用到的工具文件

完整可运行的工具已整理成仓库：**<https://github.com/Bad0RANG3/Phigrsaves>**

| 文件 | 作用 |
|------|------|
| `tools/android_install_cert.sh` | Android 14/15 把 CA 装进所有 mount namespace |
| `tools/sni_relay.py` | 裸 TLS → `CONNECT` → mitmproxy 的 SNI 中继 |
| `tools/capture_token.py` | mitmproxy 插件，从登录响应抓 `sessionToken` |
| `tools/edit.ts` | 读取 / 备份 / 改档 / 上传 |
| `tools/roundtrip.ts` | 上传前的无损往返校验 |
| `tools/locked_singles.json` | 需解锁的单曲名单 |

---

## 9. 一句话总结

**难点从来不是“改哪几个字节”，而是：让 App 信任你的证书、让不走代理的流量绕进代理、以及在动任何值之前先证明“解析-重建”是字节无损的。** 剩下的，都是对照实验。
