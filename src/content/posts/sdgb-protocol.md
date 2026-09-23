---
title: 'SDGB 发包协议研究：二维码、AES 信封，和一群互相打架的实现'
description: '从 Aime 登录到 Title Server 业务 API，拆解舞萌 DX 国服一次完整会话里数据包是怎么构造、加密和发送的，以及公开实现之间对不上的地方。'
date: 2026-09-23
tags:
  - maimai
  - maimai DX
  - SDGB
  - 网络协议
  - 逆向
  - Aime
  - AquaDX
category: 游戏
featured: false
draft: false
verifiedDate: 2026-09-23
difficulty: 进阶
audience: 想搞清楚 maimai 国服客户端和服务器之间到底发了什么的人
hasCode: true
hasDownload: false
---

起因是[一篇关于 SDGB 1.55 的逆向笔记](https://naominet.dev/blog/sdgb/)。它把登录流程讲得很细，但我想知道“如果自己从零写一个客户端，数据包到底怎么构造”。于是我把能公开找到的实现翻了一遍，结论比预想的乱：流程是清楚的，可压缩和加密的先后顺序，几份实现是互相打架的。

本文只做协议结构分析。**不提供可运行脚本，不复制可用的 AES key、IV 和盐。** 这条通道能直接改写线上账号数据，属于违反用户协议、可能构成对运营方欺诈的行为，实操请用自建服务器和自己合法取得的游戏包。

> 未做联机实测。本机没有匹配版本的合法游戏包、密钥材料，也没有可登录的二维码，所以下面所有“能接通官方服务器”的判断都来自源码和文档，不是实际抓包。

## 一句话结论

向 SDGB 发包是两段式，不是一个 HTTP 请求搞定的：

```
二维码 ──POST──► Aime 服务器 ──► userId + token
                                   │
                                   ▼
                        GetUserPreviewApi        （看 isLogin / banState）
                                   │
                                   ▼
                        UserLoginApi  ──► loginId + Set-Cookie: JSESSIONID
                                   │
                                   ▼
                       并发 GetUser*Api ×7（所谓 GetData 就是这一批）
                                   │
                                   ▼
                 UpsertUserAllApi / UpsertUserChargelogApi
                                   │
                                   ▼
                             UserLogoutApi
```

两个服务器的分工：

| 名称 | 作用 | 地址 |
| --- | --- | --- |
| Aime 服务器 | 二维码换账号，返回 `userID` + `token` | `http://ai.sys-all.cn/wc_aime/api/get_data` |
| Title 服务器 | 业务 API | `https://maimai-gm.wahlap.com:42081/Maimai2Servlet/` |

## 第一段：二维码换 userId

Aime 这一段反而是最简单的，请求体就是明文 JSON。

时间戳不是 Unix 秒，而是**东京时区的 `yyMMddHHmmss`**，12 位。签名：

```text
key = SHA256(chipID + timestamp + aimeSalt).toUpperCase()
```

二维码超过 64 个字符时只取最后 64 个，前面的可以直接丢：

```text
qrCode = qrCodeToken.length > 64
    ? qrCodeToken.substring(qrCodeToken.length - 64)
    : qrCodeToken
```

请求体字段：`chipID`、`openGameID`（国服为 `"MAID"`）、`key`、`qrCode`、`timestamp`；请求头带 `User-Agent: WC_AIME_LIB`、`Content-Type: application/json`。响应里看 `errorID`，`0` 才算成功，同时拿到 `userID` 和 `token`。

顺带一提，GitHub 上有个叫 `sbga-fake/SDGBtech` 的仓库自称是“源码”，但它的 `sdgb.py` 只是占位代码，README 的“获取源码”链接实际指向 Rickroll 视频，真正的上传工具是闭源 exe。**它不是可信来源**，里面写的 `WG_AIME_LIB`、`alive_cheek` 之类字段不要采用。

## 第二段：Title 服务器的加密信封

这一段是重点，也最容易看错。

### URL 是把 API 名做 MD5 得到的

端点不能直接写 `/UserLoginApi`，要先拼后缀再哈希：

```text
api  = 接口名 + "MaimaiChn"              // 例如 "UserLoginApiMaimaiChn"
hash = MD5(api + obfuscateParam)         // 32 位小写十六进制，左侧补 0
url  = titleServerUrl + "/" + hash
```

`obfuscateParam` 是随版本变化的常量。AquaDX 的服务端过滤器要求路径末段必须是 **32 位小写十六进制**，正好对上 MD5 的输出。

### body 不是明文 JSON

按那篇 1.55 笔记的说法，请求和响应的处理顺序是：

```text
请求： JSON ─► UTF-8 ─► zlib(deflate) ─► AES-CBC/PKCS7 ─► POST
响应： AES 解密 ─► zlib 解压 ─► UTF-8 JSON
```

也就是 **AES 在最外层，zlib 在里面**，线上是 `AES(zlib(json))`。

我原本以为这是唯一的版本，直到去看了真实客户端的行为。AquaDX 的服务端实现顺序完全一致：先 `AES 解密`，再按 `content-encoding: deflate` 做 `ZLib.decompress`；响应则先 `ZLib.compress` 再 `AES 加密`。AquaMai 在 Hook 真实客户端时，调用的是游戏自带的 `Net.CipherAES.Decrypt(整个响应体)`，解密后**直接**就是 UTF-8 JSON——也就是说，真实 `Sinmai` 客户端的 `CipherAES` 内部同时管压缩和 AES。这三处旁证都指向 `AES(zlib(json))`。

然后我去看了第三方工具，就翻车了。`NickJi2019/SDGBApp` 的顺序是反的：

```kotlin
// 发送：先 AES，后 deflate
body = data.getRequest<T0>().encodeToByteArray().encrypt().deflate()
// 接收：先 inflate，后 AES 解密
res.inflate().decrypt()
```

`NaTsuTool` 又是第三种：发送时只做 AES、根本不压缩，接收时先 `inflate`，失败就原样返回再做 AES 解密。

三种写法我都保留在下面这张表里，因为这就是现状——**没有抓包没法定论官方到底接受哪些**。唯一能确定的是：如果自己实现，最好让解包对两种顺序都容错，以真实响应为准。

| 实现 | 发送顺序 | 接收顺序 |
| --- | --- | --- |
| 1.55 笔记 + AquaDX + 真实客户端 | `AES(zlib(json))` | `zlib⁻¹ ∘ AES⁻¹` |
| `NickJi2019/SDGBApp` | `zlib(AES(json))` | `AES⁻¹ ∘ zlib⁻¹` |
| `HoshinoStarry/NaTsuTool` | `AES(json)`（不压缩） | `zlib⁻¹`（容错）后 `AES⁻¹` |

### 请求头

| Header | 值 |
| --- | --- |
| `User-Agent` | `{端点hash}#{userId}`；`userId == 0` 时用 keychip/clientId |
| `Content-Type` | `application/json` |
| `Mai-Encoding` | 版本号，如 `1.33` / `1.40` / `1.55` |
| `Content-Encoding` | `deflate` |
| `charset` | `UTF-8` |
| `Expect` | `100-continue` |
| `number` | `0` |
| `Cookie` | `JSESSIONID=...`（登录后） |

### 两个 token 不要搞混

- Aime 返回的 `token`：放进 `GetUserPreviewApi` / `UserLoginApi` 的 **JSON 里**。
- Title 服务器登录后 `Set-Cookie` 下发的 `JSESSIONID`：放进 **HTTP Cookie 头**，后续请求主要靠它。

### 密钥材料随版本变化

AquaDX 的加密文档给了统一模型：`key` 32 字节、`iv` 16 字节、`salt` 8 字节；maimai DX 不使用迭代次数；每个游戏版本各自一套，服务端根据 `Mai-Encoding` 选密钥。

公开工具里硬编码的国服密钥正好印证了“按版本换”：

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| `NickJi2019/SDGBApp` | `1.33` | 一套 8 字符盐 + 32/16 字节 key/IV |
| `HoshinoStarry/NaTsuTool` | `1.40` | 另一套 |

两者完全不同，所以“1.55 的包”必须用 1.55 的密钥。这些字节本文不复现，要实操得自己从对应版本的合法客户端取得。

## 登录流程里都发了什么

字段以 1.55 笔记为主，我用 AquaDX 的集成测试 JSON（只作 schema 参考）和两个工具的 VO 交叉核对过。**字段名大小写敏感。**

### GetUserPreviewApi

1.55 需要 token：

```json
{ "userId": 123456, "segaIdAuthKey": "", "token": "AIME_LOGIN_TOKEN", "clientId": "..." }
```

但旧工具（1.33 / 1.40）只发 `{"userId":..., "segaIdAuthKey":""}`，没有 token。这说明“Preview 必须带 token”是 **1.53 之后**才出现的。

响应里重点看 `isLogin` 和 `banState`。笔记特别强调：**先看 `isLogin`**，如果为 `true` 说明号已被人登录，通常就是 15 分钟黑屋，不要“Preview 成功就无条件 Login”。

### UserLoginApi

```json
{
  "userId": 123456, "accessCode": "", "regionId": 0, "placeId": 0,
  "clientId": "...", "dateTime": 1700000000, "loginDateTime": 1700000600,
  "isContinue": false, "genericFlag": 0, "token": "AIME_LOGIN_TOKEN"
}
```

`dateTime` 是 `now - 600`，`loginDateTime` 是当前 Unix 秒。`returnCode == 1` 为成功，同时拿到 `loginId` 和 `JSESSIONID`。

### 所谓的 GetData

`GetData` 不是单个接口，而是并发调用 7 个 `GetUser*Api`，请求体都只有 `{"userId": ...}`：

| API | 返回 |
| --- | --- |
| `GetUserDataApi` | `userData` + `banState` |
| `GetUserExtendApi` | `userExtend` |
| `GetUserOptionApi` | `userOption` |
| `GetUserRatingApi` | `userRating` |
| `GetUserChargeApi` | `userChargeList` |
| `GetUserActivityApi` | `userActivity` |
| `GetUserMissionDataApi` | `userMissionDataList` + `userWeeklyData` |

另有 `GetUserCharacterApi` → `userCharacterList`。笔记提到它当时没被并进这 7 个里。

如果后面要发 `UpsertUserAllApi`，这 7 份基本都要先拉到，少一个不是简单补 `{}` 就行——很多时候服务器会直接**静默丢掉整包**。

### UpsertUserAllApi

最麻烦的一步。外层是 `userId`、`playlogId`、`isEventMode`、`isFreePlay`、`upsertUserAll`。

`upsertUserAll` 里塞了一大串列表，笔记列出的清洗点很关键，否则同样会被静默丢包：

- `userData` 先 copy，删掉 `friendCode`、`nameplateId`、`trophyId`、`cmLastEmoneyBrand`、`cmLastEmoneyCredit`，再覆盖一批 `last*` / 计数 / 时间字段（`lastGameId = "SDGB"`、`lastCountryCode = "CHN"` 等）。
- `userOption` 删 `tempoVolume`。
- `userRating.udemae` 删一批大写重复字段（`MaxLoseNum`、`NpcLoseNum` 等）。
- `userChargeList` 只留 `chargeId / stock / purchaseDate / validDate`。
- `userMissionDataList` 只取前 6 条并裁剪字段；`userWeeklyData` 只留 4 个字段。

AquaMai 的 `SanitizeUserData.cs` 从客户端侧做同类过滤（按歌曲/图标表检查 `iconId`、`plateId`、`titleId`、`charaSlot` 等是否合法），可以当作“哪些字段容易被判非法”的旁证。

版本号转换也有个坑：`major * 1000000 + minor * 1000 + patch`，比如 `1.56.00 -> 1056000`，解析失败回退到 `1053000`。

### UpsertUserChargelogApi

字段名注意 `userChargelog` 中间那个 `l` 是小写：

```json
{
  "userId": 123456,
  "userChargelog": { "chargeId": 12345, "price": 0, "purchaseDate": "2025-01-01 12:34:56.0",
                     "playCount": 0, "playerRating": 12345, "placeId": 0, "regionId": 0, "clientId": "..." },
  "userCharge":   { "chargeId": 12345, "stock": 1, "purchaseDate": "2025-01-01 12:34:56.0",
                    "validDate": "2025-04-01 04:00:00" },
  "loginDateTime": 1700000600
}
```

`purchaseDate` 用 `yyyy-MM-dd HH:mm:ss.0`；`validDate` 是当天凌晨 4 点 + 90 天，**末尾没有 `.0`**。

### UserLogoutApi

这个报文体也在随版本变：

- 1.55 笔记：`{userId, accessCode:"", regionId, placeId, clientId, loginDateTime, type:1}`
- `NaTsuTool`：`type:5`，字段名是 `dateTime` 而非 `loginDateTime`
- `SDGBApp` 的 `UserLogoutRequestVO` 只有 `userId`
- Sinmai-Assist 的 Issue #19 明确记录：**SDGB 1.53 起 `UserLogoutRequestVO` 增加了 `dateTime`**，导致旧登出代码编译失败

所以登出的 `type` 和时间字段名都要按目标版本核对。

## 密钥只在对应版本有效

把版本差异集中列一下：

| 变更点 | 时间点 |
| --- | --- |
| Preview / Login 开始要求 `token` | 1.53 之后 |
| `UserLogoutRequestVO` 增加 `dateTime` | 1.53 |
| `Mai-Encoding` 支持到 `1.55` | 1.55 |
| AES key / IV / 盐随版本更换 | 每版本 |

结论就是：对 1.55 发包，得同时用 1.55 的 `Mai-Encoding`、1.55 的 key/IV/盐，以及 1.55 的报文体。

## 风险

这整条链路能直接写线上账号数据。原文明确涉及解锁歌曲、发收藏品、以及用 `price: 0` 的券给自己生成游玩次数——最后一项是给运营方造成实际损失，可能构成欺诈。1.53 之前 `GetUserPreviewApi` 还能只凭 `userId` 批量调用，也就是扫号，之后才加了 token 校验。这些我都不展开，也不提供。

想研究协议本身，用自建服务器（比如 AquaDX）和自己合法取得的游戏包就够了。所有的 key、账号、二维码、token、`JSESSIONID` 都是敏感信息，别提交到公开仓库。

## 资料来源

- 起点笔记：<https://naominet.dev/blog/sdgb/>
- `HoshinoStarry/NaTsuTool`：`Config/Setting.java`（端点名、盐、key/IV、版本），`Connect/Dispose.java`（哈希与收发顺序），`RequestHeadersBuilder.java`，`RequestBodyBuilder.java`
- `NickJi2019/SDGBApp`：`ConfigManager.kt`（服务器地址与密钥），`Net/Packet/NetIO.kt`（头与加解密顺序），`Net/VO/NetQuery.kt`（`MaimaiChn` 后缀），`Aime/WechatAime.kt`（Aime 签名），`Utility/DateTime.kt`（东京时间戳）
- `MewoLab/AquaDX`：`docs/encryption.md`（key/iv/salt 规格），`CompressionFilter.kt`（端点校验与加解密顺序），`Mai2Test.kt`（各 API 的完整 JSON schema）
- `MuNET-OSS/AquaMai`：`AquaMai.Core/Helpers/Shim.cs`、`NetPacketHook.cs`（Hook 真实客户端的 `Net.CipherAES`）
- `tatanakots/SDGB_usefultool_back`：README 描述了底层 `sdgb_api(data, useApi, userId)` 契约，`function.py`、`main.py` 印证发票与登出字段
- `TrueRou/maimai.py`：更新日志中“支持 机台数据源 1.55 Mai-Encoding”
