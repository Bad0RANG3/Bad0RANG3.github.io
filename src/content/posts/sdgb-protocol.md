---
title: 'SDGB 发包协议 API 参考：Aime 登录与 Title Server 接口'
description: 'SDGB 国服从二维码换账号到登出，逐个 API 说明作用、请求参数、响应字段与呼出方式。'
date: 2026-09-23
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

本文只描述协议结构：每个接口做什么、请求体里有哪些字段、响应里拿什么。密钥、盐、IV 以及可运行的收发脚本不在本文范围内。以下内容未做联机实测，字段名大小写敏感。

## 通用约定

### 两个服务器

| 名称 | 作用 | 地址 |
| --- | --- | --- |
| Aime 服务器 | 二维码换账号，返回 `userID` + `token` | `http://ai.sys-all.cn/wc_aime/api/get_data` |
| Title 服务器 | 全部业务 API | `https://maimai-gm.wahlap.com:42081/Maimai2Servlet/` |

### Title 服务器的端点是哈希值

Title 服务器不把接口名直接写进路径，而是对接口名加后缀后做 MD5：

```text
api  = 接口名 + "MaimaiChn"              // 如 "UserLoginApiMaimaiChn"
hash = MD5(api + obfuscateParam)         // 32 位小写十六进制
url  = titleServerUrl + "/" + hash
```

`obfuscateParam` 是随版本变化的常量。服务端校验路径末段必须是 32 位小写十六进制，正好对应 MD5 输出。

### 请求与响应信封

请求体和响应体都不是明文 JSON，处理顺序为：

```text
请求： JSON ─► UTF-8 ─► zlib(deflate) ─► AES-CBC/PKCS7 ─► POST
响应： AES 解密 ─► zlib 解压 ─► UTF-8 JSON
```

也就是线上是 `AES(zlib(json))`。少数实现会把压缩和 AES 的顺序颠倒，或发送时不压缩；自己实现时，解包对两种顺序都容错、以实际响应为准比较稳妥。

### 请求头

| Header | 值 |
| --- | --- |
| `User-Agent` | `{端点hash}#{userId}`；`userId == 0` 时用 keychip / clientId |
| `Content-Type` | `application/json` |
| `Mai-Encoding` | 版本号，如 `1.33` / `1.40` / `1.55` |
| `Content-Encoding` | `deflate` |
| `charset` | `UTF-8` |
| `Expect` | `100-continue` |
| `number` | `0` |
| `Cookie` | `JSESSIONID=...`（登录后） |

### 两个 token 不要混用

- Aime 返回的 `token`：放进 `GetUserPreviewApi` / `UserLoginApi` 的 **JSON body** 里。
- Title 服务器登录后由 `Set-Cookie` 下发的 `JSESSIONID`：放进 **HTTP Cookie 头**，后续请求主要靠它。

### 版本与密钥

密钥模型统一为：`key` 32 字节、`iv` 16 字节、`salt` 8 字节；maimai DX 不使用迭代次数。每个游戏版本各自一套，服务端根据 `Mai-Encoding` 选密钥。所以对某个版本发包，必须同时对该版本的 `Mai-Encoding`、密钥材料和报文体。

### 版本号转换

客户端上报的版本是整数，换算公式：

```text
versionCode = major * 1000000 + minor * 1000 + patch
```

例如 `1.56.00 -> 1056000`。解析失败时回退为 `1053000`。

## API 一览

| API | 作用 | 请求体根字段 |
| --- | --- | --- |
| `GetUserPreviewApi` | 登录前预检账号状态 | `userId`, `segaIdAuthKey`, `token`, `clientId` |
| `UserLoginApi` | 建立会话，下发 `loginId` + `JSESSIONID` | `userId`, `accessCode`, `regionId`, `placeId`, `clientId`, `dateTime`, `loginDateTime`, `isContinue`, `genericFlag`, `token` |
| `GetUserDataApi` | 取主存档 | `userId` |
| `GetUserExtendApi` | 取扩展数据 | `userId` |
| `GetUserOptionApi` | 取设置项 | `userId` |
| `GetUserRatingApi` | 取 Rating / 段位 | `userId` |
| `GetUserChargeApi` | 取票券持有量 | `userId` |
| `GetUserActivityApi` | 取活动进度 | `userId` |
| `GetUserMissionDataApi` | 取任务与周常 | `userId` |
| `GetUserCharacterApi` | 取角色养成数据 | `userId` |
| `UpsertUserAllApi` | 整包回写存档 | `userId`, `playlogId`, `isEventMode`, `isFreePlay`, `upsertUserAll` |
| `UpsertUserChargelogApi` | 回写票券与购买流水 | `userId`, `userChargelog`, `userCharge`, `loginDateTime` |
| `UserLogoutApi` | 结束会话 | `userId` 等，随版本变化 |

其中 `GetUserDataApi` / `GetUserExtendApi` / `GetUserOptionApi` / `GetUserRatingApi` / `GetUserChargeApi` / `GetUserActivityApi` / `GetUserMissionDataApi` 这 7 个合称 `GetData`，需要并发调用。

## Aime 服务器

### get_data

**作用**：二维码换取账号。请求体是明文 JSON。

**地址**：`POST http://ai.sys-all.cn/wc_aime/api/get_data`

**请求头**：

| Header | 值 |
| --- | --- |
| `User-Agent` | `WC_AIME_LIB` |
| `Content-Type` | `application/json` |

**请求体**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `chipID` | string | 读卡器 / 机台芯片 ID |
| `openGameID` | string | 国服固定为 `"MAID"` |
| `key` | string | 签名，见下 |
| `qrCode` | string | 二维码内容，截断规则见下 |
| `timestamp` | string | 东京时区的 `yyMMddHHmmss`，12 位 |

**签名**：

```text
key = SHA256(chipID + timestamp + aimeSalt).toUpperCase()
```

**二维码截断**：超过 64 个字符时只保留最后 64 个，前面的丢弃。

```text
qrCode = qrCodeToken.length > 64
    ? qrCodeToken.substring(qrCodeToken.length - 64)
    : qrCodeToken
```

**响应**：`errorID` 为 `0` 才算成功，同时返回 `userID` 和 `token`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `errorID` | int | `0` 成功 |
| `userID` | int / long | 账号 ID，后续所有 Title API 都用它 |
| `token` | string | 登录凭据，放进 `GetUserPreviewApi` / `UserLoginApi` 的 body |

## Title 服务器

以下所有接口的 URL 都由「接口名 + `MaimaiChn`」做 MD5 得到，请求体为 `AES(zlib(json))`，请求头按「通用约定」填写。

### GetUserPreviewApi

**作用**：登录前预检。拿 `isLogin` / `banState` 判断账号能不能登。

**请求体**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | int / long | Aime 返回的账号 ID |
| `segaIdAuthKey` | string | 固定空串 |
| `token` | string | Aime 返回的 token；1.53 起必填 |
| `clientId` | string | 客户端标识 |

例：

```json
{ "userId": 123456, "segaIdAuthKey": "", "token": "AIME_LOGIN_TOKEN", "clientId": "..." }
```

旧版本（1.33 / 1.40）只发 `{"userId": ..., "segaIdAuthKey": ""}`，没有 `token`。

**响应**：重点看两个字段。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `isLogin` | bool | 为 `true` 说明账号已在别处登录，通常是 15 分钟黑屋，此时不要继续 `UserLoginApi` |
| `banState` | int | 封禁状态 |

**判断顺序**：先看 `isLogin`，再看 `banState`。Preview 成功不等于可以无条件 Login。

### UserLoginApi

**作用**：建立会话。成功后拿到 `loginId` 和 `JSESSIONID`。

**请求体**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | int / long | 账号 ID |
| `accessCode` | string | 固定空串 |
| `regionId` | int | 区域 ID |
| `placeId` | int | 店铺 / 机台位置 ID |
| `clientId` | string | 客户端标识 |
| `dateTime` | long | `now - 600`，Unix 秒 |
| `loginDateTime` | long | 当前 Unix 秒 |
| `isContinue` | bool | 是否续接 |
| `genericFlag` | int | 通用标志位 |
| `token` | string | Aime 返回的 token |

例：

```json
{
  "userId": 123456, "accessCode": "", "regionId": 0, "placeId": 0,
  "clientId": "...", "dateTime": 1700000000, "loginDateTime": 1700000600,
  "isContinue": false, "genericFlag": 0, "token": "AIME_LOGIN_TOKEN"
}
```

**响应**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `returnCode` | int | `1` 为成功 |
| `loginId` | int / long | 本次会话 ID |
| `Set-Cookie` | header | `JSESSIONID=...`，后续请求放进 Cookie 头 |

### GetData：7 个 GetUser*Api

`GetData` 不是单个接口，而是并发调用下面 7 个接口。登录后请求体都只有 `{"userId": ...}`；登录前调用则还要带 `segaIdAuthKey` / `token` / `clientId`。

| API | 响应根字段 | 说明 |
| --- | --- | --- |
| `GetUserDataApi` | `userData` | 主存档 |
| `GetUserExtendApi` | `userExtend` | 扩展数据 |
| `GetUserOptionApi` | `userOption` | 设置项 |
| `GetUserRatingApi` | `userRating` | Rating / 段位 |
| `GetUserChargeApi` | `userChargeList` | 票券列表 |
| `GetUserActivityApi` | `userActivity` | 活动进度 |
| `GetUserMissionDataApi` | `userMissionDataList` + `userWeeklyData` | 任务 + 周常 |

`GetUserDataApi` 的响应里额外带 `banState`。

### GetUserCharacterApi

**作用**：取角色养成数据。

**请求体**：`{"userId": ...}`

**响应**：`userCharacterList`。

这个接口不在这 7 个里，需要单独调用。

### UpsertUserAllApi

**作用**：整包回写存档。最容易失败的一步。

**外层请求体**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | int / long | 账号 ID |
| `playlogId` | int / long | 游玩记录 ID |
| `isEventMode` | bool | 是否活动模式 |
| `isFreePlay` | bool | 是否自由游玩 |
| `upsertUserAll` | object | 下面这一大串列表 |

**`upsertUserAll` 的清洗规则**（不清洗经常被服务器静默丢包）：

- `userData`：先 copy，删除 `friendCode`、`nameplateId`、`trophyId`、`cmLastEmoneyBrand`、`cmLastEmoneyCredit`；再覆盖一批 `last*`、计数、时间字段，例如 `lastGameId = "SDGB"`、`lastCountryCode = "CHN"`。
- `userOption`：删除 `tempoVolume`。
- `userRating.udemae`：删除一批大写重复字段，如 `MaxLoseNum`、`NpcLoseNum` 等。
- `userChargeList`：只保留 `chargeId` / `stock` / `purchaseDate` / `validDate`。
- `userMissionDataList`：只取前 6 条并裁剪字段。
- `userWeeklyData`：只保留 4 个字段。

**前置条件**：回写前应先把 7 个 `GetUser*Api` 都拉到（必要时加上 `GetUserCharacterApi`）。缺一份不是补 `{}` 就能过，很多时候服务器会直接丢掉整包。

**非法值提示**：`iconId`、`plateId`、`titleId`、`charaSlot` 等值落在歌曲 / 图标表之外时，同样容易被判非法而丢包。

### UpsertUserChargelogApi

**作用**：回写票券与购买流水。

**请求体**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | int / long | 账号 ID |
| `userChargelog` | object | 购买流水 |
| `userCharge` | object | 票券状态 |
| `loginDateTime` | long | 当前 Unix 秒 |

注意 `userChargelog` 中间的 `l` 是小写。

`userChargelog`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `chargeId` | int | 票券 / 商品 ID |
| `price` | int | 价格 |
| `purchaseDate` | string | `yyyy-MM-dd HH:mm:ss.0` |
| `playCount` | int | 游玩次数 |
| `playerRating` | int | 玩家 Rating |
| `placeId` | int | 位置 ID |
| `regionId` | int | 区域 ID |
| `clientId` | string | 客户端标识 |

`userCharge`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `chargeId` | int | 票券 / 商品 ID |
| `stock` | int | 持有数量 |
| `purchaseDate` | string | `yyyy-MM-dd HH:mm:ss.0` |
| `validDate` | string | 当天凌晨 4 点 + 90 天，末尾没有 `.0` |

例：

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

### UserLogoutApi

**作用**：结束会话。

**请求体**随版本变化，字段名和时间字段要对目标版本核对：

| 版本 / 实现 | 字段 |
| --- | --- |
| 1.55 报文 | `{userId, accessCode:"", regionId, placeId, clientId, loginDateTime, type:1}` |
| 另一种实现 | `{userId, dateTime, type:5}`，用 `dateTime` 而非 `loginDateTime` |
| 更早实现 | `{userId}` |
| 1.53 起 | `UserLogoutRequestVO` 增加了 `dateTime` |

也就是说：`type` 的取值和时间字段名（`dateTime` / `loginDateTime`）都取决于目标版本。

## 版本差异

| 变更点 | 时间点 |
| --- | --- |
| `GetUserPreviewApi` / `UserLoginApi` 开始要求 `token` | 1.53 之后 |
| `UserLogoutRequestVO` 增加 `dateTime` | 1.53 |
| `Mai-Encoding` 支持到 `1.55` | 1.55 |
| AES key / IV / 盐随版本更换 | 每版本 |

## 来源

本文转载自 [naominet.dev 的 SDGB 逆向笔记](https://naominet.dev/blog/sdgb/)。
