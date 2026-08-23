---
title: 'MaidXTool：让 QQ 机器人帮你查舞萌 DX 的 B50'
description: '一个面向 maimai DX（国服）的成绩查询 QQ 机器人：拍下机台上的二维码发到群里，自动换凭证、拉取成绩、渲染带 FC/AP/同步/DX 徽标的完整 B50 图，查完自动登出，不留登录态。'
date: 2026-08-17
tags:
  - Python
  - QQ机器人
  - NoneBot2
  - NapCat
  - maimai
  - 音游
  - B50
category: 项目
featured: false
draft: false
verifiedDate: 2026-08-17
difficulty: 进阶
audience: 玩舞萌 DX 的玩家，以及想了解街机数据接口的开发者
hasCode: true
---

> 在机厅打完一局，想看看自己 B50 涨了没有？不用再开网页扫码、翻成绩单——把机台上的二维码拍下来发到 QQ 群里，一张完整的 B50 成绩图就回来了。

[MaidXTool](https://github.com/Bad0RANG3/MaidXTool) 是一个以 QQ 机器人为交互界面的 maimai DX（国服，VER.CN）成绩查询工具：扫码即可查询完整 B50 成绩图（FC/AP/同步/DX 徽标），查完自动登出；并保留发票（`/fp`）票务命令。

## 什么是 B50

maimai 的成绩体系里，B50 是玩家最看重的指标：**B35 + B15** —— 历史最佳成绩的前 35 首，加上新曲成绩里最好的 15 首。它综合反映了一个玩家的推分水平和曲库广度，也是玩家之间比较实力最常用的标准。

查 B50 的常规路径是登录水鱼（diving-fish）等网站扫码授权。而 MaidXTool 把整条链路搬进了 QQ：私聊或者群里 `@` 机器人，发一张二维码，图片直接回来。

## 它能干什么

| 命令 | 说明 | 登录 |
|------|------|------|
| `/help` | 全部命令说明 | - |
| `/b50 <二维码>` | 完整 B50 图（FC/AP/同步/DX 徽标；查完自动登出） | 登录态（每次新码） |
| `/fp <二维码> [2~5]` | 发票（库存为 0 才下发，免费，固定 1 张） | 写（每次新码） |

- 群里需 `@` 机器人，私聊直接发
- `/b50` 每次查询都要新二维码，查完自动登出；同账号 10 分钟内重复查询走本地缓存
- 写命令（`/fp`）会真实改写账号数据，确认二维码是自己的账号再发

二维码就是机台登录界面屏幕上的那个（`SGWCMAID...` 字符串，10 分钟有效），拍下来用任意扫码工具解析成字符串发给机器人即可。

## 凭证纪律

街机账号数据接口和普通 Web API 不一样：它本质上是"模拟你本人在机台上扫码登录"，所以凭证处理是整件事里最敏感的部分。MaidXTool 的规则很明确：

1. `/b50`、`/fp` 每次都要新二维码换新 token；`/b50` 查询结束**必登出**（UserLogoutApi 回传登录时刻，服务器按此校验会话），不留登录态。
2. 登录返回的 cookie（JSESSIONID）与 token 共同参与会话校验，缺一不可。
3. 写命令（`/fp`）流程为 登录 → 上传 → 登出；中间任何一步出错/中断都会导致账号被强制 `isLogin=1`（15 分钟冷却）。

这套纪律不是保守，而是踩过坑之后的必然：**服务器只认"登录时刻"对齐的会话**，任何一步错位都会让账号进小黑屋。

## 小黑屋（isLogin）防护

`isLogin=1` 是玩家登不上去的返回：服务器判定该账号当前有发票（刷票）嫌疑（或会话校验失败）而拒绝登录，强制 15 分钟冷却，到期自动解除。

MaidXTool 为此做了三层防护：

- `isLogin=1` 期间不反复尝试登录，等 15 分钟——代码和文档都明确提示；
- `/b50` 同账号 10 分钟内重复查询走本地缓存，**命中零登录**，从源头减少写会话次数；
- 登录失败（凭证过期/小黑屋）时提示换新二维码重试。

## 技术实现

整体链路：

```
QQ 私聊/群聊 @机器人
   ⇄ NapCat（QQ 协议端，OneBot v11 WS）
   ⇄ NoneBot2（bot/，加载 nb_b50 插件）
   ⇄ sdgb/（客户端包：加密管道 / 二维码换凭证 / 登录查询登出）
   ⇄ 成绩接口 + 渲染服务生成 B50 图
```

核心是 `sdgb/` 这个自研客户端包，四个模块各司其职：

### 加密管道（encrypt.py）

国服接口的数据是加密的，`encrypt.py` 实现了完整的加解密管道：

- **AES-CBC + PKCS7** 加解密，密钥版本 1.55 → 1.56（舞萌 DX 2026），zlib 压缩传输体；
- **API 路由 hash**：`md5(api + "MaimaiChn" + "8bF76dE9")`，每个请求的接口名都要带盐混淆；
- **CalcRandom**：用 `c_int32` 截断算法复刻客户端 `GameManager.CalcSpecialNum()` 的随机数生成——这类"看起来是随机数、其实是客户端内部状态"的细节，往往是最难对齐的部分。

### 二维码换凭证（chime.py）

二维码字符串 → userID / token。扫码换凭证是整个流程的入口，也是"每次新码"纪律的落点。

### 成绩拉取与 B50 渲染（b50.py + records.py）

```
GetUserRatingApi
   ├─ ratingList     → B35（35 条）
   └─ newRatingList  → B15（15 条）
       每条 {musicId, level(0-4), achievement}
              │
              ▼
   sheetId = "{曲名}__dxrt__{dx|std}__dxrt__{难度}"
              │
              ▼
   POST 渲染服务（oneshot）→ JPEG 图片
```

曲名库 `music_data_cache.json` 本地缓存，缺失时自动从 diving-fish 的 music_data 接口下载——不需要手工维护几百首曲目的映射表。

## 发票（`/fp`）：上传数据的完整流程

`/fp` 是唯一**真实改写账号数据**的操作，所以它的流程比 `/b50` 严谨得多。整个实现集中在 `sdgb/write_ops.py`（`issue_ticket_with_qr` → `_ticket_upsert`），机器人命令与 CLI 共用同一套逻辑。一次完整的发票是这样走的：

```
/fp <二维码> [2~5]
   │
   ▼
① 参数校验：chargeId ∈ 2~5（6 倍已废除）；固定只发 1 张
   │
   ▼
② 新二维码换新 token（qr_api → ai.sys-allnet.cn / wc_aime）
   │   SHA256(keychipID + timestamp + salt) 签名，带 chipID/openGameID/qrCode
   ▼
③ GetUserChargeApi（免登录，仅需 token）查该票库存
   │   库存非 0 → 拒绝下发（安全兜底，force=True 才放行）
   ▼
④ GetUserPreviewApi 小黑屋探测
   │   isLogin=1 → 直接拒绝："15 分钟后再试"
   ▼
⑤ UserLoginApi（capture_cookie 捕获 JSESSIONID）
   │   loginDateTime = 本次登录时刻；returnCode 须为 1/102
   ▼
⑥ 模拟游玩等待 60 秒（服务器时序要求，勿贪快）
   │
   ▼
⑦ 拉 7 个只读接口构建 UpsertUserAllApi 请求体
   │   GetUserData / Extend / Option / Rating / Charge / Activity / MissionData
   │   任一失败 → 显式中止（避免兜底值污染请求体导致服务器 500）
   ▼
⑧ 两步组合上传（关键！）
   │
   ├─ 8a. UpsertUserChargelogApi：购买记录
   │       price = chargeId-1、playCount=1、playerRating、loginDateTime
   │       服务器只认这一步"创建票据"→ 等 30 秒
   │
   ├─ 8b. UploadUserPlaylogListApi：单独上传本局 playlog
   │       playlogId = loginId、useTicketId=-1、isClear = achievement≥800000
   │       → 等 30 秒
   │
   └─ 8c. UpsertUserAllApi：库存镜像 + 内嵌 playlog 一次提交
           userChargeList 里把 chargeId 的 stock 置 1（不存在则追加）
           validDate = 当天 04:00 + 90 天；顶层带 loginDateTime + playlog
   │
   ▼
⑨ 回查验证（verify=True 才做）：GetUserChargeApi 对比前后库存
   │
   ▼
⑩ finally 登出：UserLogoutApi 必须回传本次 loginDateTime
     （服务器按登录时刻校验会话；登出失败会告警但不吞主流程结果）
```

### 为什么是"两步组合"

这是整个项目里最反直觉、也是**实机验证踩出来的结论**：单独调 `UpsertUserAllApi` 携带 `userChargeList` 时，服务器**返回成功但票据不入账**——静默忽略，表面一切正常，票就是不到账。

所以发票必须走两步：

1. **先** `UpsertUserChargelogApi` 写购买记录（`price = chargeId - 1`），服务器只认这一步"创建票据"；
2. 等 30 秒后单独上传本局 playlog（`UploadUserPlaylogListApi`）；
3. 再等 30 秒，最后 `UpsertUserAllApi` 把 `userChargeList` 库存镜像（`stock=1`）和顶层内嵌的 playlog 一次性提交。

三步之间各等 30 秒，是服务器对"真实机台游玩节奏"的时序校验——机器人可以瞬间完成的事，机台做不到，所以代码主动放慢。上传前还有默认 60 秒的"模拟游玩"等待，整套流程下来 `/fp` 提交一次约需 2 分钟，插件提示里也明确写了"期间请勿重复提交或退出"。

### 只查 7 个接口的纪律

`UpsertUserAllApi` 的请求体是个巨大的 JSON：`userData`、`userExtend`、`userOption`、`userRatingList`、`userChargeList`、`userActivityList`、`userMissionDataList`、`userGamePlaylogList`、`userMusicDetailList`……几十个节。其中真实数据只来自 7 个只读接口（`API_ORDER`），其余节用兜底默认值填空。

为什么不全量查询？**全量查询会触发小黑屋**。代码里专门写了这条纪律："只查构建请求体需要的 7 个接口"。而且查询结果必须逐节检查——如果某个接口失败（比如 `GetUserDataApi` 带 `error`），请求体里的 `version` 等字段会变成兜底值，服务器直接回 500，所以查询失败必须显式中止，不能带着脏数据硬传。

### 每一次请求的加密管道

上面所有接口调用，底层都走 `MaimaiClient.call_api` 的同一条管道：

```
JSON 请求体
   │  zlib 压缩
   ▼
AES-CBC 加密（密钥 1.55/1.56，PKCS7 填充）
   │
   ▼
POST /{apiHash}     ← md5(api + "MaimaiChn" + "8bF76dE9")
   │  headers：Mai-Encoding、Cookie: JSESSIONID=...
   ▼
解密 → zlib 解压 → JSON 解析
```

几个细节：

- **cookie 与 token 缺一不可**：`UserLoginApi` 时 `capture_cookie=True` 把响应 `Set-Cookie` 里的 `JSESSIONID` 捕获进客户端实例，之后所有写操作自动携带。缺 cookie 的写请求会被服务器**按无会话处理、静默忽略**——返回成功但没入账。
- **响应校验**：写接口成功后有时返回空响应体，`call_api` 把空响应标记为 `_emptyResponse` 并按成功处理；`_check_write_response` 再兜一层——空响应直接判为"会话无效/仍在小黑屋"，`returnCode` 只有 `0/1/102` 视为成功，其余抛错。
- **登出回传登录时刻**：`UserLogoutApi` 的 `loginDateTime` 字段必须等于登录时的时刻，服务器按它校验会话——这就是 README 里"查完必登出、不留登录态"的底层原因。`issue_ticket_with_qr` 里用 `login_ts` 在 `finally` 中保证登出一定执行，且特意不在 `finally` 里 return（会吞掉 try 的返回值）。

### 失败即小黑屋

写流程任何一步出错（网络中断、超时、异常）都可能导致账号被强制 `isLogin=1`（15 分钟冷却），所以代码在每一步之前都做探测、每一步之后都做校验：库存非 0 拒绝、`isLogin=1` 拒绝、前置查询失败中止、写响应异常抛错。机器人端还加了连续失败计数——同一用户连续失败 3 次会提示"请联系管理员"，而不是无限重试硬闯小黑屋。

## 附带的 CLI

不想起机器人？`b50_cli.py` 提供了纯命令行入口，而且有个很实用的模式：

```bash
python b50_cli.py --uid 1234567          # 免登录：直接按 userId 拉取渲染（推荐）
python b50_cli.py --qr "<二维码字符串>"  # 扫码拉取（--full 加徽标）
```

`--uid` 免登录直查对调试和自用非常方便——不用扫码，不用登录，一条命令出图。

## 快速开始（Windows）

```bat
pip install -r requirements.txt
copy sdgb\.settings.py sdgb\settings.py    :: 填写机厅信息
双击 启动机器人.bat
```

Linux / macOS 用 `start.sh`，NapCat（OneBot v11 WS，监听 127.0.0.1:3001）可 Docker 部署或本机 node 运行；完整部署步骤（NapCat 配置、守护进程、排障）见仓库的 [docs/DEPLOY.md](https://github.com/Bad0RANG3/MaidXTool/blob/main/docs/DEPLOY.md)。

## 注意事项

1. `settings.py` / `token_cache.json` / `records_cache.json` 含密钥与账号数据，勿提交、勿外传
2. 二维码 10 分钟有效；`/b50` 每次查询都要新码
3. 发票（`/fp`）可用 2/3/4/5 号票（默认 3；6 倍已废除），目标 Ticket 库存非 0 时拒绝下发、免费、固定 1 张
4. 写命令会真实改写账号数据，操作前确认账号

## 项目地址

👤 **作者**: Bad0RANG3

🔗 **GitHub**: https://github.com/Bad0RANG3/MaidXTool

📜 **许可**: MIT

> 免责声明：WE ARE NOT RESPONSIBLE FOR YOUR ACCOUNT. 使用本项目产生的任何后果自负。
> 怂别用，用别怂。
