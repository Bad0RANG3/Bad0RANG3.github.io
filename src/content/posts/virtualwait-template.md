---
title: 'VirtualWait，给机台场地做一套可自托管的虚拟排队系统'
description: '从公开排队看板、单双人排队到队首确认、QQ 群提醒和管理员运营台，一个面向机台场地的完整虚拟排队模板。'
date: 2026-07-16
tags:
  - TypeScript
  - Next.js
  - Python
  - SQLite
  - AstrBot
  - 自托管
category: 项目
featured: true
draft: false
verifiedDate: 2026-07-16
difficulty: 进阶
audience: 想搭建自托管排队系统的开发者或场馆运营者
hasCode: true
---

> 文章经由Deepseek V4.1 flash润色，很抱歉我的文笔并不好。

机台场地的排队靠纸条和喊人也能维持，但人一多，问题就出现了。有人不知道前面还有几位，有人离开以后没人通知，机台空着却迟迟没人上。VirtualWait 想把这条队伍从口头约定变成一套能查、能提醒、能自己托管的系统。

项目地址在 [VirtualWait-Template](https://github.com/Bad0RANG3/VirtualWait-Template)。它把排队规则、身份确认、管理员操作和 QQ 群通知接在同一条流程里。

## 能做什么

- 按城市、区县、场地和机台四级目录展示公开队列。
- 玩家可以单人或者双人入队。
- 到达队首后需要本人确认，再到场地上机。
- 游玩超时会回到队尾，连续两次没确认则自动卸卡。
- 管理员可以管理场地、机台和队列。
- 机台空闲时，AstrBot 插件会在 QQ 群里提醒队首玩家。

现场不用反复喊人，玩家也不用一直站在机台边盯着。

## 设计取向

VirtualWait 把每个机台和玩家都当作状态机的一部分。空闲、排队中、队首待确认、上机中、超时回队尾、自动卸卡，这些状态和转换规则写在系统里。使用者只需要处理需要判断的例外。

自动化处理的是最耗人的部分。队首没人应、上机超时、机台空出来，这些事不复杂，却要一直有人盯着。VirtualWait 让超时自动回队尾，让连续两次未确认自动卸卡，再把空闲通知交给 AstrBot。人负责运营规则，系统负责重复检查。

身份信息单独放在 Gateway 里。Gateway 默认只监听本机回环地址，Web 与 Gateway 之间用 HMAC 签名，AstrBot 插件使用独立的 Bearer 密钥。开发环境可以用 `mock` 身份，生产环境必须换成已经授权的真实身份服务。

第一版不需要微服务。Next.js 加 SQLite 就能跑通整条链路，部署简单，也能离线开发。多实例、高可用或者跨机房成为实际需求以后，再从 SQLite 迁到服务型数据库。

```text
浏览器 -- HTTPS --> Web（Next.js + SQLite）
                         | HMAC
                         v
                  身份 Gateway（Python）

AstrBot 插件 -- Bearer --> Bot API --> QQ 群提醒
```

Web、身份 Gateway 和 Bot 插件彼此独立，共享 JSON Schema 作为接口契约。以后要换前端、机器人平台或身份服务，可以只改对应模块。

## 本地体验

先启动 Python Gateway，再启动 Web。开发环境可以完全离线运行，下面这条虚构身份可以直接用来走通流程。

```text
mock:demo-user:示例玩家:12000:示例称号
```

模板支持 `mock`、自定义 HTTP provider 和无登录预览。`mock` 只适合开发与测试，上线前要接入已授权的真实身份服务，并检查密钥、个人信息、反向代理和备份策略。

## QQ 群提醒

玩家先在个人页绑定 QQ，管理员为场地配置群 UMO，再把仓库里的 AstrBot 插件装入机器人环境。插件会轮询目录摘要和热机详情，然后提醒队首。启动预热、同一队首冷却和网络退避都在插件里处理，避免重复轰炸群聊。

## 适合谁

它适合希望快速搭起排队系统的机台场地，也可以作为 Next.js、Python Gateway、Bot 联动与单机自托管的项目模板。

当前 SQLite 方案面向单城市、少量场地和单实例部署。要做多实例、高可用或跨机房，需要先迁移数据库，并重新测试并发与故障转移。

## 项目地址

- GitHub，[Bad0RANG3/VirtualWait-Template](https://github.com/Bad0RANG3/VirtualWait-Template)
- License，MIT
