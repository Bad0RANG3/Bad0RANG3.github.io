---
title: 'SDGB 发包协议：从二维码到登出，一次完整通信里发生了什么'
description: '把 SDGB 1.55 的登录、会话、存档回写与登出串成一条完整链路：Aime 签名、端点哈希、AES+zlib 信封、两个 token 的分工，以及每一步为什么这样设计。'
date: 2026-09-23
updatedDate: 2026-09-25
tags:
  - maimai
  - maimai DX
  - SDGB
  - 网络协议
  - 逆向
  - Aime
category: 游戏
featured: false
draft: false
verifiedDate: 2026-09-23
difficulty: 进阶
audience: 想按字段自己实现一个 SDGB 客户端的人
hasCode: true
hasDownload: false
polished: true
---

这篇文章不只列字段，而是把一次完整的 SDGB 通信从头到尾串起来：二维码怎么变成账号、端点为什么是一串哈希、请求体为什么要压缩再加密、两个 token 各管什么、为什么回写存档最容易整包被丢、以及每一步背后大致是出于什么考虑。

先说清楚边界。本文描述的是协议结构和通信流程，**不提供** AES 密钥、盐、IV、可运行的收发脚本，也不涉及绕授权、伪造身份或把非授权成绩推给线上服务。下面这些字段名大小写敏感，且内容基于对 SDGB 1.55 的静态逆向，**没有在真实服务器上做联机实测**；真正联调时请以实际响应为准，并只操作你有权限的账号和环境。

---

## 0. 一句话看懂整条链路

SDGB 的登录不是“发一个请求就完事”，而是一条有状态的会话：

```text
二维码
  │
  ▼
Aime Server ──► userId + token
  │
  ▼
GetUserPreviewApi        （预检：能不能登、有没有被封）
  │
  ▼
UserLoginApi             （建立会话，拿到 loginId + JSESSIONID）
  │
  ▼
GetData × 7              （并发拉取各类存档）
  │
  ▼
UpsertUserAllApi         （整包回写存档）
UpsertUserChargelogApi   （回写票券与流水）
  │
  ▼
UserLogoutApi            （结束会话）
```

理解这条链路以后，很多“看起来莫名其妙”的设计就顺了：

- 二维码先给 **Aime 服务器**，换到的不是会话，而是一张“账号凭证”（`userId` + `token`）。
- 真正的业务全在 **Title 服务器**，它用一套加密信封和 HTTP 会话。
- 登录成功后的 `JSESSIONID` 才是后续请求的主凭证，Aime 的 `token` 只在预检和登录时出现。
- “GetData”不是一个接口，是 7 个接口的并发集合。
- 存档回写是**整包快照**，不是增量更新，所以少一份数据、混入一个服务器不认识的字段，都可能被静默丢弃。

---

## 1. 为什么必须经过两个服务器

很多人第一次看会问：为什么不能直接拿二维码去 Title 服务器？

因为这两件事的职责、生命周期和安全模型本来就不同：

| | Aime 服务器 | Title 服务器 |
| --- | --- | --- |
| 职责 | 二维码 / 卡 → 账号凭据 | 全部游戏业务 |
| 状态 | 无状态，一次请求换一次凭证 | 有状态，登录后维持会话 |
| 报文 | 明文 JSON | 加密信封 |
| 认证 | `SHA256(chipID + timestamp + salt)` 签名 | `token` → `JSESSIONID` 会话 |
| 地址 | `http://ai.sys-all.cn/wc_aime/api/get_data` | `https://maimai-gm.wahlap.com:42081/Maimai2Servlet/` |

Aime 逻辑是所有 SEGA 系街机共用的“读卡/换号”服务，所以它只做一件事：确认这次刷卡是合法的，然后把账号 ID 交给调用方。Title 服务器才是“这个游戏、这个区服”的业务后端，它关心的是你这局打了什么、存档怎么变。

因此链路天然分成两段：**先用 Aime 证明“你是这个账号”，再用 Title 服务器“按这个账号开始游戏”**。两段之间靠 `userId` 和 Aime 下发的 `token` 衔接。

---

## 2. Aime 服务器：二维码是怎么变成账号的

### 2.1 请求长什么样

`get_data` 是明文 JSON，不走加密信封：

```http
POST http://ai.sys-all.cn/wc_aime/api/get_data
User-Agent: WC_AIME_LIB
Content-Type: application/json
```

```json
{
  "chipID": "...",
  "openGameID": "MAID",
  "key": "SHA256_RESULT",
  "qrCode": "最后 64 位二维码内容",
  "timestamp": "250101123456"
}
```

字段含义：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `chipID` | string | 读卡器 / 机台芯片 ID |
| `openGameID` | string | 国服固定为 `"MAID"` |
| `key` | string | 请求签名，见下 |
| `qrCode` | string | 二维码内容，截断规则见下 |
| `timestamp` | string | 东京时区的 `yyMMddHHmmss`，12 位 |

### 2.2 为什么二维码要截断

二维码里带的原始串往往比服务器真正需要的长。客户端只把**最后 64 个字符**发出去：

```text
qrCode = qrCodeToken.length > 64
    ? qrCodeToken.substring(qrCodeToken.length - 64)
    : qrCodeToken
```

这通常是因为二维码串的前半段是固定前缀 / 环境信息，真正区分每次请求的有效载荷在后半段。对客户端来说，照做即可；对服务器来说，它只校验这 64 个字符，前面的东西丢了也不影响。

### 2.3 为什么要有签名和 timestamp

```text
key = SHA256(chipID + timestamp + aimeSalt).toUpperCase()
```

- 用 `SHA256` 而不是直接明文，是为了让“这次请求确实来自知道 salt 的客户端”，并防止中间人随手改字段。
- 用 `timestamp` 而不是固定 nonce，是为了让签名**只在一小段时间内有效**：同样的 `chipID + salt` 过一个时间窗就签不出同样的值。
- 时间是**东京时区**、格式 `yyMMddHHmmss`，不是 Unix 时间戳——这是 SEGA 系统里很常见的一种时间编码。
- 注意 `salt` 不在本文范围内。所有涉及秘钥材料的内容都以你合法持有的版本为准。

### 2.4 响应与成功判定

```json
{
  "errorID": 0,
  "userID": 123456,
  "token": "..."
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `errorID` | int | `0` 才算成功，其它值一律先当失败处理 |
| `userID` | int / long | 账号 ID，后续所有 Title API 都用它 |
| `token` | string | 登录凭证，放进 `GetUserPreviewApi` / `UserLoginApi` 的 JSON body |

`userID` 和 `token` 是这一段的产物，也是下一段的输入。

### 2.5 二维码的有效期与刷新

- 二维码在有效期内**可以重复使用**，但前提是期间没有刷新出新的二维码。
- 一旦刷新了新二维码，旧的通常就作废了。
- 登录还需要在约 **30 分钟**内存在一个“可用的二维码被刷新出来”——这是会话时效的一部分，不是随便什么时候都能补登。

---

## 3. Title 服务器：端点为什么是一串哈希

Title 服务器不把接口名直接写进路径，而是对接口名加后缀做一次 MD5：

```text
api  = 接口名 + "MaimaiChn"              // 例："UserLoginApiMaimaiChn"
hash = MD5(api + obfuscateParam)         // 32 位小写十六进制
url  = titleServerUrl + "/" + hash
```

### 3.1 为什么要这样设计

- **隐藏 API 面**：路径里看不出 `UserLoginApi` 这种名字，随手抓包或扫路径的人无法一眼看懂服务端接口。
- **按区服/版本区分实现**：`MaimaiChn` 这样的后缀可以区分地区实现（对应 SDEZ / SDGB 等）。
- **版本级混淆**：`obfuscateParam` 随版本变化，等于同一接口名在不同版本下会得到不同的路径。这让“拿旧版本的抓包直接重放”变得更难。

“Title 服务器端点是哈希”这件事本身不是安全边界，是**混淆**。MD5 在这类系统里常见于这种“看起来不像接口名”的用途；服务端会校验路径末段是 32 位小写十六进制，正好对应 MD5 输出。

### 3.2 实现时要注意

- 计算时用**接口名 + `MaimaiChn` + `obfuscateParam`**，顺序不能换。
- `obfuscateParam` 是每个版本各自的常量，必须和你实际使用的游戏版本匹配；否则路径对不上，服务端只会回一个“找不到”。
- 大小写：hash 是**小写**十六进制。

---

## 4. 信封：为什么是 AES(zlib(json))

Title 服务器的 body 不是明文 JSON，而是先压缩、再加密。理解这个顺序，能解释很多奇怪现象。

### 4.1 发送方向

```text
JSON ─► UTF-8 ─► zlib（deflate） ─► AES-CBC + PKCS7 ─► POST
```

### 4.2 接收方向

```text
AES 解密 ─► zlib 解压 ─► UTF-8 JSON
```

也就是线上实际传的是 `AES(zlib(json))`。

### 4.3 为什么要“先压缩再加密”

顺序不能反过来，原因很实际：

- **先压缩再加密是常规做法**。JSON 里有大量重复的字段名，压缩率很高；先用 zlib 把体积压下来，再做 AES，能显著减少每个请求的字节数。街机网络对带宽和时延都敏感，这一步很划算。
- **反过来（先加密再压缩）基本压不动**：加密后的数据接近随机，压缩算法几乎找不到重复模式。
- **明文压缩再加密也降低了一点被直接肉眼观察的可能**：即使不解密，看到的也只是一堆密文。

### 4.4 为什么用 AES-CBC + 每版本一套密钥

- AES-CBC 是确定性对称加密，服务端只要知道密钥就能解。PKCS7 负责把明文补齐到块大小的整数倍。
- 密钥模型在 maimai DX 里统一为：`key` 32 字节、`iv` 16 字节、`salt` 8 字节，**不使用迭代次数**（不是 PBKDF2 那种密码派生）。
- **每个游戏版本各自一套密钥**，服务端根据请求头 `Mai-Encoding` 选择密钥。所以对某个版本发包，必须同时匹配该版本的 `Mai-Encoding`、密钥材料和报文体，缺一不可。

本文不提供任何具体密钥、盐或 IV；这些属于游戏资产，且逐版本变化。

### 4.5 一个容易误判的点

请求头里写的是 `Content-Encoding: deflate`，但 body 实际是 `AES(zlib(json))`。看起来“对不上”，但抓包的实现就是这么发的。

**不要自作聪明把它改成 `gzip`**，也不要因为字段名里有 `deflate` 就以为 body 是裸 zlib。服务端认的是它自己那套解密流程，改了大概率直接失败。

### 4.6 自己实现时的建议

- 解包对“先 AES 后解压”和“先解压后 AES”两种顺序都做容错，以实际响应为准。
- 压缩层不要过度“优化”，先保证和服务端一致。
- 出现解密失败时，优先检查 `Mai-Encoding` 对应的密钥是否匹配，而不是盲目改代码。

---

## 5. 请求头：每个字段在服务端眼里是什么

| Header | 值 | 作用 |
| --- | --- | --- |
| `User-Agent` | `{端点hash}#{userId}`；`userId == 0` 时用 keychip / clientId | 服务端据此知道是哪个端点、哪个账号 |
| `Content-Type` | `application/json` | 声明内层语义 |
| `Mai-Encoding` | 版本号，如 `1.33` / `1.40` / `1.55` | **选择该版本密钥** |
| `Accept-Encoding` | 压缩协商 | 一般保持默认 |
| `Charset` | `UTF-8` | 字符编码 |
| `Content-Encoding` | `deflate` | 见 4.5，和隐藏的 AES 层并存 |
| `Expect` | `100-continue` | 大 body 先探路 |
| `number` | `0` | 固定值 |
| `Cookie` | `JSESSIONID=...`（登录后） | 会话凭证 |

两个细节值得单独记住：

- `User-Agent` 里的 **hash 就是上面算出来的端点 hash**，`#` 后面是 `userId`。当 `userId` 为 0（例如还没登录的某些调用）时，改用 keychip / clientId 标识身份。
- `Mai-Encoding` 不是“随便填个版本号就行”，它直接决定服务端用哪把密钥解密。填错 = 解不开。

---

## 6. 两个 token 不是一回事

这是最常见、也最致命的混淆点：

| 来源 | 名字 | 放在哪里 | 管什么 |
| --- | --- | --- | --- |
| Aime 服务器 | `token` | `GetUserPreviewApi` / `UserLoginApi` 的 **JSON body** | 证明“这次换号是合法的” |
| Title 服务器 | `JSESSIONID` | **HTTP `Cookie` 头** | 登录后的 HTTP 会话 |

- Aime 的 `token` 是业务层的“入场券”，只在预检和登录时出现。
- `JSESSIONID` 是 Title 服务器登录成功后由 `Set-Cookie` 下发的会话 ID，后续大部分请求（GetData、Upsert 等）主要靠它。
- 实际实现里，登录之后的 `GetData` **不会**再把 Aime 的 `token` 到处塞，而是依赖 `JSESSIONID`。

放错位置，服务端通常不会给你明确错误，只会静默失败——这也是很多人卡在“明明发了请求却没反应”的原因之一。

还有一个历史变化：**1.53 之后，`GetUserPreviewApi` 和 `UserLoginApi` 都开始强制要求 `token`**。这也是为什么旧脚本会突然失效，详见第 13 节。

---

## 7. 登录：先预检，再建会话

### 7.1 GetUserPreviewApi —— 为什么不是直接登录

登录前机器会先调用 `GetUserPreviewApi`：

```json
{
  "userId": 123456,
  "segaIdAuthKey": "",
  "token": "AIME_LOGIN_TOKEN",
  "clientId": "..."
}
```

（旧版本 1.33 / 1.40 只发 `{"userId": ..., "segaIdAuthKey": ""}`，没有 `token`。）

这个接口返回的，正是上机前那个确认界面需要的信息：昵称、rating、头像、称号、最后登录时间之类。重点看三个字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `isLogin` | bool | 为 `true` 说明账号已在别处登录，通常进入约 15 分钟“小黑屋”，此时**不要继续登录** |
| `banState` | int | 封禁状态 |
| `errorId` | int | 错误码 |

判断顺序很重要：**先看 `isLogin`，再看 `banState`**。Preview 成功不等于可以无条件 Login。

为什么要多这一步？因为街机场景下“同一个账号被两台机器同时登录”会破坏存档一致性。先 Preview 相当于问服务器一句“现在能登吗”，把冲突提前拦掉，而不是等 Login 才报错。

### 7.2 UserLoginApi —— 真正建立会话

```json
{
  "userId": 123456,
  "accessCode": "",
  "regionId": 0,
  "placeId": 0,
  "clientId": "...",
  "dateTime": 1700000000,
  "loginDateTime": 1700000600,
  "isContinue": false,
  "genericFlag": 0,
  "token": "AIME_LOGIN_TOKEN"
}
```

几个关键点：

- `dateTime` 是 `now - 600`（当前时间往前推 10 分钟），`loginDateTime` 是当前 Unix 秒。这个 10 分钟窗口通常用于容忍客户端与服务端的时间偏差 / 建立会话的可接受区间。
- `returnCode == 1` 才算登录成功。
- 成功后返回 `loginId`、`lastLoginDate`、`token` 等。
- 同时，Response Header 里会下发 `Set-Cookie`，其中只截取 `JSESSIONID` 作为后续会话凭证。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `returnCode` | int | `1` 为成功 |
| `loginId` | int / long | 本次会话 ID |
| `Set-Cookie` | header | `JSESSIONID=...` |

### 7.3 会话与并发

- 一次登录对应一个 `loginId`；存档回写里的 `playlogId` 常用 `loginId` 派生。
- 会话不是无限的，配合二维码有效期和 Preview 的 `isLogin` 一起构成并发保护。
- 这也是为什么“一个号在两台机器同时玩”会很难受：第二台通常在 Preview 就被拦下。

---

## 8. GetData：被拆成七个接口的“一个接口”

`GetData` 不是单个 API，而是一次**并发调用 7 个 `GetUser*Api`**。名字容易误导，实际实现里它是 `fetchUserAllData` 这类封装。

登录后，这 7 个请求都只带一个字段：

```json
{ "userId": 123456 }
```

| API | 响应根字段 | 说明 |
| --- | --- | --- |
| `GetUserDataApi` | `userData`（+ `banState`） | 主存档 |
| `GetUserExtendApi` | `userExtend` | 扩展数据 |
| `GetUserOptionApi` | `userOption` | 设置项 |
| `GetUserRatingApi` | `userRating` | Rating / 段位 |
| `GetUserChargeApi` | `userChargeList` | 票券列表 |
| `GetUserActivityApi` | `userActivity` | 活动进度 |
| `GetUserMissionDataApi` | `userMissionDataList` + `userWeeklyData` | 任务 + 周常 |

为什么要拆？因为这些数据在服务端属于不同的模块，按需加载更灵活：首页只需要 `GetUserDataApi` 就能显示基本信息；只有准备回写存档时，才需要把 7 份全部拉齐。

另外还有一个**单独**的 `GetUserCharacterApi`，返回 `userCharacterList`，不在这 7 个里，需要时单独调用。

最关键的一点：**要发 `UpsertUserAllApi` 之前，这 7 份基本都得拉到。** 少一份不是“补个 `{}` 就能过”，很多时候服务器会直接静默丢掉整包。

---

## 9. 回写：为什么 UpsertUserAll 最容易整包消失

`UpsertUserAllApi` 是整条链路里最容易失败的一步。理解它，关键是要知道：**它回写的是“一份完整、内部一致的存档快照”，不是“一个字段的增量”。**

### 9.1 外层结构

```json
{
  "userId": 123456,
  "playlogId": 987654,
  "isEventMode": false,
  "isFreePlay": false,
  "loginDateTime": 1700000600,
  "userPlaylogList": [ "一条 userPlaylog" ],
  "upsertUserAll": {
    "...": "见下"
  }
}
```

### 9.2 为什么服务器会“静默丢包”

在没有官方文档的情况下，只能从行为反推。常见的失败模式有：

- **字段不合法 / 不认识**：混入了客户端本地才有、服务端不接受的字段。
- **快照不完整**：该出现的列表缺项，或字段结构对不上。
- **值的语义非法**：例如某些 ID 落在服务端的合法表之外。
- **版本不匹配**：报文体结构与目标版本不一致。

服务器遇到这些情况时，往往**不返回明确的 error**，而是直接把整包丢掉。所以“发了请求、也没报错、但数据没变”是非常典型的表现。

### 9.3 `userData` 不能原样塞回去

从 `GetUserDataApi` 拿到的 `userData` 要先 copy 一份，删掉一批字段再发，例如 `friendCode`、`nameplateId`、`trophyId`、`cmLastEmoneyBrand`、`cmLastEmoneyCredit` 等。放进 `UpsertUserAllApi.userData` 时，这些字段可能让服务器直接丢整包。

然后按本轮情况覆盖 / 更新一批字段，例如：

```text
accessCode = ""
isNetMember = 1
playCount = 原值 + 1
currentPlayCount = 原值 + 1
lastGameId = "SDGB"
lastLoginDate = loginDateTime 格式化
lastPlayDate = 当前上海时间
lastPlayCredit = 1
lastPlayMode = 0
lastPlaceId / lastPlaceName = 当前机台
lastRegionId / lastRegionName / lastClientId = 当前环境
lastCountryCode = "CHN"
banState = GetUserDataApi 的 banState
dateTime = loginDateTime
```

时间格式是 `yyyy-MM-dd HH:mm:ss.0`（注意末尾的 `.0`）。

### 9.4 其他数据也要清洗

不是只有 `userData` 有坑：

- `userOption`：删掉 `tempoVolume`。
- `userRating.udemae`：删掉一批大写重复字段，例如 `MaxLoseNum`、`NpcLoseNum`、`NpcMaxLoseNum`、`NpcMaxWinNum`、`NpcTotalLoseNum`、`NpcTotalWinNum`、`NpcWinNum`。
- `userChargeList`：不要原样带回去，只保留 `chargeId` / `stock` / `purchaseDate` / `validDate`。
- `userMissionDataList`：只取前 6 条，每条只保留 `type` / `difficulty` / `targetGenreId` / `targetGenreTableId` / `conditionGenreId` / `conditionGenreTableId` / `clearFlag`。
- `userWeeklyData`：只保留 `lastLoginWeek` / `beforeLoginWeek` / `friendBonusFlag`。

这些“清洗”本质上是在告诉服务端：**只回写服务端预期的那部分字段**。多发的、过期的、语义不一致的，都可能触发校验失败。

### 9.5 `upsertUserAll` 的主体

拼好的主体大致包含这些列表：

```text
userData, userExtend, userOption, userCharacterList, userGhost,
userMapList, userLoginBonusList, userRatingList, userItemList,
userMusicDetailList, userCourseList, userFriendSeasonRankingList,
userChargeList, userFavoriteList, userActivityList, userMissionDataList,
userWeeklyData, userGamePlaylogList, user2pPlaylog, userIntimateList,
userShopItemStockList, userGetPointList, userTradeItemList,
userFavoritemusicList, userKaleidxScopeList
```

后面还有一批 `isNew*List` 标志：普通情况下大多为空字符串，`isNewMusicDetailList` 默认是 `"0"`，有歌曲数据更新时改成 `"1"`。

### 9.6 playlog：本轮结果是怎么上报的

每次 `UserAll` 会附带一条 playlog，用来告诉服务器“这一局打了什么”。它不是只发一个 `musicId`，字段很多，重点包括：

```text
userId = 0
orderId = 0
playlogId = loginId
version = convertVersionNumber(lastRomVersion)
placeId / placeName
loginDate = loginDateTime
playDate = yyyy-MM-dd
userPlayDate = yyyy-MM-dd HH:mm:ss.0
type = 0
musicId / level
trackNo = 1
playerNum = 1
achievement / deluxscore / scoreRank
```

其中 `version` 的换算规则是：

```text
versionCode = major * 1000000 + minor * 1000 + patch
```

例如 `1.56.00 -> 1056000`。解析失败时通常回退到 `1053000`。

判定相关字段还会有默认值，例如 `tapMiss = 1`、`totalCombo = 1`、`maxCombo = 0`、`maxSync = 1`，以及一组 `isTap/isHold/isSlide/isTouch/isBreak/isClear` 标志；`beforeRating` / `afterRating` 直接用当前 `playerRating`，也就是说这条 playlog 本身没有做 rating 计算。

另外还有一条 **session 级别**的记录，字段包括 `playlogId = loginId`、`playMode`、`useTicketId = -1`、`playCredit`、`playTrack`、`playCount`、`playSpecial` 等。其中 `playSpecial` 不是随便写 0——实现里通常是“生成一个随机数，再做 32 位 bit reverse”。如果服务器突然报奇怪的错，可以先看这个字段。

> 边界：伪造 playlog / 解锁内容 / 推高成绩，属于作弊行为，可能违反服务器规则并破坏账号数据。本文只解释协议结构，**不推荐、也不提供**这类操作。

### 9.7 角色槽位与道具列表

- 角色槽位通常会补到 5 个，没有的填 0，`level = 1`、`awakening = 0`。
- `userItemList` 里放解锁 / 道具条目，字段形如 `itemKind` / `itemId` / `stock` / `isValid`。`itemKind` 会区分歌曲、Master、Re:Master，以及收藏品等类别；`isNewItemList` 则按条目数量生成一批标志。

这些列表的存在，说明服务端把“解锁状态”也当作存档的一部分存储，而不是每次单独调用“解锁接口”。这也是为什么存档回写必须是完整快照。

---

## 10. 票券：UpsertUserChargelogApi

票券与购买流水走单独的接口：

```json
{
  "userId": 123456,
  "userChargelog": {
    "chargeId": 12345,
    "price": 0,
    "purchaseDate": "2025-01-01 12:34:56.0",
    "playCount": 0,
    "playerRating": 12345,
    "placeId": 0,
    "regionId": 0,
    "clientId": "..."
  },
  "userCharge": {
    "chargeId": 12345,
    "stock": 1,
    "purchaseDate": "2025-01-01 12:34:56.0",
    "validDate": "2025-04-01 04:00:00"
  },
  "loginDateTime": 1700000600
}
```

细节：

- 字段名是 `userChargelog`，中间那个 `l` 是**小写**。
- `purchaseDate` 用 `yyyy-MM-dd HH:mm:ss.0`。
- `validDate` 是“当天凌晨 4 点 + 90 天”，格式末尾**没有** `.0`。
- 实际实现里会先检查这张票的 `stock`，已有库存就不重复发，避免写入重复数据。

---

## 11. 登出：UserLogoutApi

```json
{
  "userId": 123456,
  "accessCode": "",
  "regionId": 0,
  "placeId": 0,
  "clientId": "...",
  "loginDateTime": 1700000600,
  "type": 1
}
```

`type = 1` 就是普通登出。请求体随版本变化：

| 版本 / 实现 | 字段 |
| --- | --- |
| 1.55 报文 | `{userId, accessCode:"", regionId, placeId, clientId, loginDateTime, type:1}` |
| 另一种实现 | `{userId, dateTime, type:5}`，用 `dateTime` 而非 `loginDateTime` |
| 更早实现 | `{userId}` |
| 1.53 起 | `UserLogoutRequestVO` 增加了 `dateTime` |

也就是说，`type` 的取值和时间字段名都取决于目标版本，不能一概而论。

另外，实际客户端在登录后会**冷却约 60 秒**才允许使用功能票、解锁或发收藏品；上传完成后如果勾了自动退出，还会**等约 5 秒**再发 Logout。这些是应用层行为，不是协议硬要求，但不等待在某些环境下确实容易出问题。

---

## 12. 版本与密钥：为什么一套密钥只对一个版本

再强调一次密钥模型：

- `key` 32 字节、`iv` 16 字节、`salt` 8 字节；
- maimai DX **不使用迭代次数**；
- **每个游戏版本各自一套密钥**，服务端根据 `Mai-Encoding` 选择；
- 因此对某个版本发包，必须同时匹配该版本的 `Mai-Encoding`、密钥材料和报文体。

版本号换算：

```text
versionCode = major * 1000000 + minor * 1000 + patch
```

例如 `1.56.00 -> 1056000`，解析失败时回退 `1053000`。

`Mai-Encoding`、端点哈希里的 `obfuscateParam`、以及 AES 密钥三者通常都需要跟着版本走。只改其中一个，就会出现“路径 404”或“解不开”这类问题。

---

## 13. 历史：1.53 之前和之后，协议是怎么变严的

这一段能解释为什么很多老脚本、老文章都失效了。

**1.53 之前：**

- `GetUserPreviewApi` 可以直接调用，**不需要携带任何 token**，唯一必需的参数就是 `userId`。
- `UserLoginApi` 也只需要一个 `userId`。
- 这意味着只要有 `userId`，就可以批量调用 Preview —— 也就是俗称的“扫号”。
- 登录需要一个 30 分钟内刷新出来的可用二维码。

**1.53 之后：**

- `GetUserPreviewApi` 增加了 **token 校验**，必须同时传 `token + userId`。
- `UserLoginApi` 也变成需要 `token + userId`。
- `UserLoginApi` 的 Response Header 会回传 `JSESSIONID`，后续 GetData / Upsert 主要靠这个 Cookie。
- 再拿旧脚本直接扫号，基本就是“寄”。

这次变化的实质是：把“只凭 userId 就能查询账号”改为“必须先在 Aime 侧完成一次合法换号，拿到一次性 token 才能继续”。Aime 的签名 + 时间窗 + 一次性 token，共同构成了“这次刷卡是真的”的证明。

---

## 14. 如果你想自己实现一个客户端

把上面串起来，逻辑大概是：

```text
1. 读取本地配置：aimeUrl、titleServerUrl、obfuscateParam、per-version key/iv/salt、clientId、regionId、placeId
2. Aime：截断 qrCode 到 64，生成东京时间 timestamp，算 SHA256 签名，POST get_data
3. 校验 errorID == 0，取出 userId + token
4. Title：对每个 API 算 MD5(接口名 + "MaimaiChn" + obfuscateParam) 得到路径
5. Title：把 JSON 按 UTF-8 → zlib → AES-CBC/PKCS7 封装，按规范填 header
6. Preview：检查 isLogin / banState，必要时停止
7. Login：returnCode == 1 后取出 loginId，并保存 Set-Cookie 里的 JSESSIONID
8. GetData：并发拉 7 个 GetUser*Api，缺一不可
9. 需要回写时，基于拉到的数据拼完整 snapshot，做字段清洗后再 Upsert
10. 结束：发送 UserLogoutApi(type=1)
```

实现上的几个建议：

- **以实际响应为准**：不同版本、不同 fork 的字段会有差异，写死假设很容易翻车。
- **错误处理要区分**：`errorID`、`returnCode` 是显式错误；而 Upsert 可能是**静默失败**，需要自己核对数据是否真的写进去了。
- **不要高频轮询**：签到、Preview、GetData 都有会话与时间窗约束，频率过高容易触发风控或 15 分钟锁。
- **日志要脱敏**：`userId`、`token`、`JSESSIONID`、`AccessCode` 都是敏感信息，别直接贴到群里或 Issue 里。
- **只操作你有权限的账号和服务**。

---

## 15. 服务端这一侧大概校验了什么

综合能观察到的行为，服务端在通信过程中至少会检查这些：

| 检查点 | 依据 |
| --- | --- |
| 端点 hash 是 32 位小写十六进制 | 路径末段格式 |
| `Mai-Encoding` 对应密钥能解开 body | 解密失败即请求无效 |
| Aime 签名 = `SHA256(chipID + timestamp + salt)` | 换号接口 |
| Aime timestamp 在可接受时间窗内 | 时间编码 + 签名 |
| Preview / Login 带合法 `token`（1.53+） | 版本变化 |
| `JSESSIONID` 有效 | 登录后接口依赖 Cookie |
| 存档快照完整、字段合法、版本匹配 | Upsert 静默丢包行为 |
| 账号未被占用（`isLogin`） | 预检返回 15 分钟锁 |
| 客户端完整性 / 版本相关校验 | 同类研究的 `CheckAuth`、Cake hash 等现象 |

这些结论大多是从**客户端行为**反推出来的，不是官方文档；真正联调时仍以实际服务器为准。

---

## 16. 版本差异速查

| 变更点 | 时间点 |
| --- | --- |
| `GetUserPreviewApi` / `UserLoginApi` 开始要求 `token` | 1.53 之后 |
| `UserLogoutRequestVO` 增加 `dateTime` | 1.53 |
| `Mai-Encoding` 支持到 `1.55` | 1.55 |
| AES key / IV / 盐随版本更换 | 每版本 |

---

## 17. 来源与证据边界

本文主要基于 [naominet.dev 的 SDGB 逆向笔记](https://naominet.dev/blog/sdgb/)（SDGB 1.55，2026-09-14），并结合本站此前整理的字段表补充了通信流程与设计动因。

需要明确的是：

- 这些内容来自**静态逆向与抓包观察**，不是 SEGA / Wahlap 的官方协议文档。
- 文中没有进行真实服务器联机验证，字段名、流程细节在不同版本和不同实现下可能不同。
- 没有、也不会在本文中提供 AES 密钥、盐、IV 或可直接运行的收发脚本。
- 请只在你合法拥有并有权操作的环境中使用这些知识，并遵守服务器规则与当地法律。
