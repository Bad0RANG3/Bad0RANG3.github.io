---
title: 'SDGB 发包协议：从二维码到登出，一次完整通信里发生了什么'
description: 'SDGB 1.55 的一次完整通信：二维码怎么换到账号、端点为什么是哈希、AES+zlib 信封、两个 token 各管什么，以及存档回写为什么会整包被丢。'
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
---

SDGB 的一次通信从扫码开始，到登出结束，中间过两台服务器、一层加密信封和两份凭证。

这里只讲协议结构和通信流程，不给 AES 密钥、盐、IV，也不给能直接跑的收发脚本。字段名大小写敏感。内容基于对 SDGB 1.55 的静态逆向，没有在真实服务器上联机实测，实际响应可能和文中写法有出入；只在自己有权限的账号和环境里试。

---

## 0. 整条链路

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

链路里有几处容易误会：

- 二维码交给 Aime 服务器，换回来的不是会话，是 `userId` 和 `token`，一张账号凭证。
- 游戏业务全在 Title 服务器，报文套加密信封，会话走 HTTP。
- 登录成功后 `JSESSIONID` 才是主凭证。Aime 的 `token` 只在预检和登录时出现。
- GetData 不是接口，是 7 个接口并发。
- 存档回写是整包快照，不是增量。少一份数据、多一个服务器不认识的字段，都可能被静默丢掉。

---

## 1. 为什么必须经过两个服务器

二维码为什么不直接发给 Title 服务器？这两件事的职责、生命周期和安全模型都不一样：

| | Aime 服务器 | Title 服务器 |
| --- | --- | --- |
| 职责 | 二维码 / 卡 → 账号凭据 | 全部游戏业务 |
| 状态 | 无状态，一次请求换一次凭证 | 有状态，登录后维持会话 |
| 报文 | 明文 JSON | 加密信封 |
| 认证 | `SHA256(chipID + timestamp + salt)` 签名 | `token` → `JSESSIONID` 会话 |
| 地址 | `http://ai.sys-all.cn/wc_aime/api/get_data` | `https://maimai-gm.wahlap.com:42081/Maimai2Servlet/` |

Aime 这套逻辑是所有 SEGA 系街机共用的读卡换号服务。它只做一件事：确认这次刷卡合法，然后把账号 ID 交给调用方。Title 服务器才是这个游戏、这个区服的业务后端，关心的是你这局打了什么、存档怎么变。

链路因此分成两段：先用 Aime 证明“你是这个账号”，再由 Title 服务器按这个账号开局。中间靠 `userId` 和 Aime 下发的 `token` 衔接。

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

二维码串往往比服务器需要的长。客户端只发最后 64 个字符：

```text
qrCode = qrCodeToken.length > 64
    ? qrCodeToken.substring(qrCodeToken.length - 64)
    : qrCodeToken
```

前半段多半是固定前缀和环境信息，真正随每次请求变化的载荷在后半段。服务端也只校验这 64 个字符，前面的丢了不影响。

### 2.3 为什么要有签名和 timestamp

```text
key = SHA256(chipID + timestamp + aimeSalt).toUpperCase()
```

- 用 `SHA256` 而不是明文，服务端才能确认“这次请求来自知道 salt 的客户端”，顺手挡一下中间人改字段。
- 用 `timestamp` 而不是固定 nonce，签名就只在一小段时间里有效。同一个 `chipID + salt`，过了时间窗签不出同样的值。
- 时间是东京时区，格式 `yyMMddHHmmss`，不是 Unix 时间戳。SEGA 系统里这种时间编码很常见。
- `salt` 这里不涉及。涉及密钥材料的内容，都以你合法持有的版本为准。

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

- 有效期内二维码可以重复使用，前提是这期间没有刷出新的二维码。
- 刷新之后，旧的通常就作废。
- 登录时，30 分钟内得刷出过一个可用二维码。这是会话时效的一部分，不是随时能补。

---

## 3. Title 服务器：端点为什么是一串哈希

Title 服务器不把接口名直接写进路径，而是对接口名加后缀做一次 MD5：

```text
api  = 接口名 + "MaimaiChn"              // 例："UserLoginApiMaimaiChn"
hash = MD5(api + obfuscateParam)         // 32 位小写十六进制
url  = titleServerUrl + "/" + hash
```

### 3.1 这样设计的目的

- 隐藏 API 面：路径里看不出 `UserLoginApi` 这种名字，抓包或扫路径的人没法一眼看懂有哪些接口。
- 按区服和版本区分实现：`MaimaiChn` 这样的后缀对应地区实现（SDEZ / SDGB 等）。
- 版本级混淆：`obfuscateParam` 随版本变化，同一个接口名在不同版本下得到不同路径，拿旧抓包直接重放就更难。

端点做成哈希不构成安全边界，是混淆。服务端会校验路径末段是 32 位小写十六进制，正好对上 MD5 的输出。

### 3.2 实现时要注意

- 计算时用接口名 + `MaimaiChn` + `obfuscateParam`，顺序不能换。
- `obfuscateParam` 是每个版本各自的常量，得和你实际用的游戏版本对上。对不上，路径就不对，服务端只会回一个“找不到”。
- hash 是小写十六进制。

---

## 4. 信封：为什么是 AES(zlib(json))

Title 服务器的 body 不是明文 JSON，先压缩再加密。这个顺序能解释几处看着别扭的地方。

### 4.1 发送方向

```text
JSON ─► UTF-8 ─► zlib（deflate） ─► AES-CBC + PKCS7 ─► POST
```

### 4.2 接收方向

```text
AES 解密 ─► zlib 解压 ─► UTF-8 JSON
```

线上实际传的就是 `AES(zlib(json))`。

### 4.3 为什么要“先压缩再加密”

顺序反不得：

- JSON 里字段名重复得厉害，zlib 压缩率很高。先把体积压下来再做 AES，每个请求能小一截。街机网络对带宽和时延敏感，这一步划算。
- 反过来先加密再压缩基本没用。密文接近随机，压缩算法找不到重复模式。
- 顺带的好处是抓包看到的是密文，不解密读不出内容。

### 4.4 AES-CBC 与每版本一套密钥

- AES-CBC 是对称加密，服务端知道密钥就能解；PKCS7 把明文补齐到块大小的整数倍。
- 密钥模型在 maimai DX 里统一：`key` 32 字节、`iv` 16 字节、`salt` 8 字节，没有迭代次数，不是 PBKDF2 那种口令派生。
- 每个游戏版本各自一套密钥，服务端按请求头 `Mai-Encoding` 选。对某个版本发包，该版本的 `Mai-Encoding`、密钥材料、报文体得同时对上，缺一样都不行。

密钥、盐、IV 这里一律不给，它们属于游戏资产，逐版本更换。

### 4.5 一个容易误判的点

请求头写 `Content-Encoding: deflate`，body 却是 `AES(zlib(json))`。看着对不上，抓到的实现就是这么发的。

别顺手把它改成 `gzip`，也别因为字段名里有 deflate 就当 body 是裸 zlib。服务端按自己那套流程解密，改了多半直接失败。

### 4.6 自己实现时的建议

- 解包对两种顺序都做容错，先 AES 还是先解压，以实际响应为准。
- 压缩层别急着优化，先和服务端保持一致。
- 解密失败先查 `Mai-Encoding` 对应的密钥对不对，别急着改代码。

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

两处容易搞错：

- `User-Agent` 里的 hash 就是上面算出来的端点 hash，`#` 后面跟 `userId`。`userId` 为 0 的调用（比如还没登录时）改用 keychip / clientId 标识身份。
- `Mai-Encoding` 决定服务端拿哪把密钥解密，填错就解不开，不是随便填个版本号的事。

---

## 6. 两个 token 不是一回事

它们出现在不同地方，管不同的事：

| 来源 | 名字 | 放在哪里 | 管什么 |
| --- | --- | --- | --- |
| Aime 服务器 | `token` | `GetUserPreviewApi` / `UserLoginApi` 的 **JSON body** | 证明“这次换号是合法的” |
| Title 服务器 | `JSESSIONID` | **HTTP `Cookie` 头** | 登录后的 HTTP 会话 |

- Aime 的 `token` 只在预检和登录时出现，是业务层的入场券。
- `JSESSIONID` 是登录成功后由 `Set-Cookie` 下发的会话 ID，后面的 GetData、Upsert 主要靠它。
- 实现里登录之后的 `GetData` 不会再带 Aime 的 `token`。

放错位置，服务端一般不给明确错误，直接静默失败。发了请求没反应，先回来查这一处。

1.53 之后，`GetUserPreviewApi` 和 `UserLoginApi` 都强制要求 `token`，旧脚本就是这样失效的，详见第 13 节。

---

## 7. 登录：先预检，再建会话

### 7.1 GetUserPreviewApi：为什么先预检

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

这个接口返回的正是上机确认界面要显示的东西：昵称、rating、头像、称号、最后登录时间。重点看三个字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `isLogin` | bool | 为 `true` 说明账号已在别处登录，通常进入约 15 分钟“小黑屋”，此时**不要继续登录** |
| `banState` | int | 封禁状态 |
| `errorId` | int | 错误码 |

判断顺序很重要：先看 `isLogin`，再看 `banState`。Preview 成功不等于可以无条件 Login。

多这一步是因为街机场景下同一个账号被两台机器同时登录会破坏存档一致性。先 Preview 等于问一句“现在能登吗”，把冲突拦在登录之前，而不是等 Login 报错。

### 7.2 UserLoginApi：建立会话

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

- `dateTime` 是 `now - 600`，比当前时间早 10 分钟；`loginDateTime` 是当前 Unix 秒。这个窗口通常用来容忍客户端和服务端的时间偏差，也算建立会话的可接受区间。
- `returnCode == 1` 才算登录成功。
- 成功后返回 `loginId`、`lastLoginDate`、`token`。
- 响应头里会下发 `Set-Cookie`，只取其中的 `JSESSIONID` 当后续凭证。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `returnCode` | int | `1` 为成功 |
| `loginId` | int / long | 本次会话 ID |
| `Set-Cookie` | header | `JSESSIONID=...` |

### 7.3 会话与并发

- 一次登录对应一个 `loginId`。存档回写里的 `playlogId` 常由它派生。
- 会话有时效，加上二维码有效期和 Preview 的 `isLogin`，三样合起来做并发保护。
- 同一个号在两台机器上同时玩，第二台基本在 Preview 就被拦下。

---

## 8. GetData：其实是七个接口

`GetData` 不是单个 API，是并发调 7 个 `GetUser*Api`。实现里它叫 `fetchUserAllData` 这类封装，名字容易误导。

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

拆开是因为这些数据在服务端属于不同模块，按需加载：首页只要 `GetUserDataApi` 就能显示基本信息，真要回写存档才需要 7 份全拉。

另外还有一个单独的 `GetUserCharacterApi`，返回 `userCharacterList`，不在这 7 个里，要用时单独调。

发 `UpsertUserAllApi` 之前，这 7 份基本都得拉齐。少一份不是补个 `{}` 就能过，服务器很可能直接把整包丢掉。

---

## 9. 回写：UpsertUserAll 为什么会整包消失

`UpsertUserAllApi` 回写的是一份完整、内部一致的存档快照，不是一个字段的增量。这一点决定了它的失败方式。

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

### 9.2 服务器为什么会静默丢包

没有官方文档，只能从行为反推。几种失败模式：

- 字段不合法或不认识：混进了只有客户端本地才有、服务端不收的字段。
- 快照不完整：该出现的列表缺项，或结构对不上。
- 值语义非法：某些 ID 落在服务端的合法表之外。
- 版本不匹配：报文体结构和目标版本不一致。

这几种情况，服务器往往不返回明确的 error，直接把整包丢掉。发了请求、没报错、数据没变，就是这么来的。

### 9.3 `userData` 不能原样塞回去

从 `GetUserDataApi` 拿到的 `userData` 要先复制一份，删掉一批字段再发：`friendCode`、`nameplateId`、`trophyId`、`cmLastEmoneyBrand`、`cmLastEmoneyCredit` 等。这些字段原样放进 `UpsertUserAllApi.userData`，可能让服务器丢掉整包。

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

这几种清洗其实是在告诉服务端：只回写它预期的那部分字段。多发的、过期的、语义对不上的，都可能过不了校验。

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

每次 `UserAll` 附一条 playlog，说明这局打了什么。字段不止一个 `musicId`，重点有：

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

判定相关字段还会有默认值，例如 `tapMiss = 1`、`totalCombo = 1`、`maxCombo = 0`、`maxSync = 1`，以及一组 `isTap/isHold/isSlide/isTouch/isBreak/isClear` 标志；`beforeRating` / `afterRating` 直接用当前 `playerRating`，这条 playlog 本身不做 rating 计算。

另有一条 session 级的记录，字段包括 `playlogId = loginId`、`playMode`、`useTicketId = -1`、`playCredit`、`playTrack`、`playCount`、`playSpecial` 等。`playSpecial` 不是随便写 0，实现里通常是生成一个随机数再做 32 位 bit reverse。服务器突然报奇怪的错，可以先看这个字段。

> 伪造 playlog、解锁内容、推高成绩，都属于作弊，可能违反服务器规则并破坏账号数据。这里只解释协议结构，不推荐也不提供这类操作。

### 9.7 角色槽位与道具列表

- 角色槽位通常会补到 5 个，没有的填 0，`level = 1`、`awakening = 0`。
- `userItemList` 里放解锁 / 道具条目，字段形如 `itemKind` / `itemId` / `stock` / `isValid`。`itemKind` 会区分歌曲、Master、Re:Master，以及收藏品等类别；`isNewItemList` 则按条目数量生成一批标志。

解锁状态在服务端就是存档的一部分，没有单独的“解锁接口”。所以回写只能整包发。

### 9.8 收藏品：把道具写进 `userItemList`

游戏里没有“领取收藏品”这个接口。拿到一个姓名框、称号、头像、搭档、背景板或功能票，就是往存档快照的 `userItemList` 里多写一行道具，再整包回写。类别由 `itemKind` 区分：

| `itemKind` | 类别 |
| --- | --- |
| 1 | 姓名框 |
| 2 | 称号 |
| 3 | 头像 |
| 10 | 搭档（Partner） |
| 11 | 背景板 |
| 12 | 功能票 |
| 5 / 6 / 7 | 歌曲 / Master / Re:Master（与收藏品共用同一张表） |

每一行的结构固定为：

```json
{
  "itemKind": 3,
  "itemId": 250103,
  "stock": 1,
  "isValid": true
}
```

- `itemKind`：上面的类别编号。
- `itemId`：该类别下的条目 ID（如头像 ID、称号 ID）。
- `stock`：持有数量，领取场景固定 `1`。
- `isValid`：该行是否生效。

和 `userItemList` 配对的是 `isNewItemList`：按行数生成的标志串，一行一个字符。N 行道具就拼 N 个 `"1"`：

```text
userItemList  = [行1, 行2, ..., 行N]
isNewItemList = "111...1"   // 长度 = N
```

这个标志决定游戏里是否把它们当成“新获得”的东西展示。长度和行数对不上时，可能出现“拿到了但没有 NEW 提示”，或直接被服务端判为结构不合法。

放进完整的 `UpsertUserAllApi` 请求体里，关键部分大致是这样：

```json
{
  "userId": 123456,
  "playlogId": 987654,
  "isEventMode": false,
  "isFreePlay": false,
  "loginDateTime": 1700000600,
  "userPlaylogList": [ "一条 userPlaylog" ],
  "upsertUserAll": {
    "userData": [ "清洗后的 userData" ],
    "userExtend": [ "..." ],
    "userOption": [ "..." ],
    "userCharacterList": [],
    "userMapList": [],
    "userRatingList": [ "..." ],
    "userItemList": [
      { "itemKind": 3, "itemId": 250103, "stock": 1, "isValid": true }
    ],
    "userMusicDetailList": [ "占位的一条 musicDetail" ],
    "userChargeList": [ "..." ],
    "userActivityList": [ "..." ],
    "userMissionDataList": [ "..." ],
    "userWeeklyData": { "lastLoginWeek": "..." },
    "userGamePlaylogList": [ "一条 session 记录" ],
    "user2pPlaylog": { "...": "..." },
    "isNewItemList": "1",
    "isNewMusicDetailList": "0",
    "isNewCharacterList": "",
    "isNewMapList": "",
    "isNewLoginBonusList": "",
    "isNewCourseList": "",
    "isNewFavoriteList": ""
  }
}
```

一次发多个收藏品就追加多行，`isNewItemList` 同步拼成等长。同一对 `(itemKind, itemId)` 去重，重复行没有意义。

一次完整的操作顺序是：

```text
1. 确保处于登录会话（有 loginId / loginDateTime / JSESSIONID）
2. GetData × 7，把所有存档拉齐
3. 按 9.3~9.5 节清洗 userData / userOption / userRating / userChargeList / mission 等
4. 组装 UpsertUserAllApi 报文：userPlaylogList + upsertUserAll
5. 把目标收藏品写成 userItemList 行，并按行数生成 isNewItemList
6. POST 到 UpsertUserAllApi
   （路径 = MD5("UpsertUserAllApiMaimaiChn" + obfuscateParam)）
7. 视需要发 UserLogoutApi 结束会话
```

几个坑：

- 必须整包发。`userItemList` 不能单独成一个请求，它只是快照里的一块；缺了其它列表，服务器很可能丢掉整包。
- `userItemList` 里可以混放不同类别。客户端本来就是先把姓名框、称号、头像、搭档、背景板、功能票和歌曲解锁的 5/6/7 拼成一张表再发，收藏品和解锁共用同一段结构，只是 `itemKind` 不同。
- `isNewMusicDetailList` 默认 `"0"`，只有这次真带了新的 `userMusicDetailList` 才置 `"1"`。只发收藏品就保持 `"0"`。
- 静默失败。这类回写通常没有明确错误码，发完重新 `GetData` 核对，别只看 HTTP 200。

> 往线上账号写入自己并未合法获得的收藏品，是作弊，可能违反服务器规则并破坏账号数据。上面只是协议结构说明，请只在你合法拥有、且有权改动的账号与环境里操作。

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

- 字段名是 `userChargelog`，中间那个 `l` 是小写。
- `purchaseDate` 用 `yyyy-MM-dd HH:mm:ss.0`。
- `validDate` 是当天凌晨 4 点加 90 天，格式末尾没有 `.0`。
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

`type` 的取值和时间字段名都随版本变，没有统一写法。

实际客户端登录后会冷却约 60 秒，才允许用功能票、解锁或发收藏品；上传完成后如果勾了自动退出，还会等约 5 秒再发 Logout。这两个是应用层行为，协议没硬要求，但不等的话，有些环境会出问题。

---

## 12. 版本与密钥：为什么一套密钥只对一个版本

密钥模型：

- `key` 32 字节、`iv` 16 字节、`salt` 8 字节。
- maimai DX 不使用迭代次数。
- 每个游戏版本各自一套密钥，服务端按 `Mai-Encoding` 选。
- 所以对某个版本发包，`Mai-Encoding`、密钥材料和报文体得同时对上。

版本号换算：

```text
versionCode = major * 1000000 + minor * 1000 + patch
```

例如 `1.56.00 -> 1056000`，解析失败时回退 `1053000`。

`Mai-Encoding`、端点哈希用的 `obfuscateParam`、AES 密钥，三者通常都得跟着版本走。只改其中一个，就会撞上“路径 404”或“解不开”。

---

## 13. 历史：1.53 之前和之后，协议是怎么变严的

老脚本和老文章失效，原因就在这里。

1.53 之前：

- `GetUserPreviewApi` 可以直接调，不用带 token，唯一必需的参数是 `userId`。
- `UserLoginApi` 也只要一个 `userId`。
- 有 `userId` 就能批量调 Preview，俗称“扫号”。
- 登录需要一个 30 分钟内刷新出来的可用二维码。

1.53 之后：

- `GetUserPreviewApi` 加了 token 校验，必须同时传 `token + userId`。
- `UserLoginApi` 也变成要 `token + userId`。
- `UserLoginApi` 的 Response Header 会回传 `JSESSIONID`，后面的 GetData / Upsert 主要靠这个 Cookie。
- 旧脚本再拿去扫号，基本就是“寄”。

这次改动的实质，是把“有 userId 就能查号”变成“先在 Aime 侧合法换一次号，拿到一次性 token 才能继续”。签名、时间窗、一次性 token 三样合起来，才证明得了这次刷卡是真的。

---

## 14. 如果你想自己实现一个客户端

串起来的执行顺序：

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

实现上几点：

- 以实际响应为准。不同版本、不同 fork 的字段有差异，写死假设容易翻车。
- 错误分两种处理。`errorID`、`returnCode` 是显式错误；Upsert 可能静默失败，得自己核对数据有没有真写进去。
- 别高频轮询。签到、Preview、GetData 都有会话和时间窗约束，频率高了容易触发风控或 15 分钟锁。
- 日志要脱敏。`userId`、`token`、`JSESSIONID`、`AccessCode` 都是敏感信息，别直接贴到群里或 Issue 里。
- 只操作你有权限的账号和服务。

---

## 15. 服务端这一侧大概校验了什么

从观察到的行为看，服务端在通信过程中至少会查这些：

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

这些结论是从客户端行为反推的，不是官方文档。真联调还是以服务器实际反应为准。

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

内容主要来自 [naominet.dev 的 SDGB 逆向笔记](https://naominet.dev/blog/sdgb/)（SDGB 1.55，2026-09-14），通信流程和一部分设计动因结合了本站此前整理的字段表。

几点说明：

- 内容来自静态逆向和抓包观察，不是 SEGA / Wahlap 的官方协议文档。
- 没有做过真实服务器联机验证，字段名和流程细节在不同版本、不同实现下可能不同。
- 这里不会提供 AES 密钥、盐、IV，也不提供可直接运行的收发脚本。
- 请只在你合法拥有并有权操作的环境里使用这些知识，并遵守服务器规则与当地法律。
