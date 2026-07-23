---
title: 'VirtualWait：给机台场地做了一套可自托管的虚拟排队系统'
description: '从公开排队看板、单双人排队到队首确认、QQ 群提醒和管理员运营台：一个面向机台场地的完整虚拟排队模板。'
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
---

> 想让顾客知道哪台机空着、什么时候轮到自己，又不想靠纸条和喊人维持队伍？VirtualWait 就是为这个场景做的。

[VirtualWait-Template](https://github.com/Bad0RANG3/VirtualWait-Template) 是一套面向游戏机台、街机厅等场地的虚拟排队系统。它不只是一个展示队列的网页，而是把排队规则、身份确认、管理员运营和群通知串成了一条可自托管的链路。

## 它能解决什么

- 用城市、区县、场地、机台四级目录展示公开队列；
- 玩家可单人或双人入队，到队首后确认上机；
- 游玩超时自动回到队尾；两次到队首超时则自动卸卡；
- 管理员能处理场地、机台和队列运营；
- 机台空闲时，AstrBot 插件会在 QQ 群里 `@` 队首玩家。

这样，现场不用反复喊人，玩家也不用一直守在机台旁边等。

## 架构不是只做了一个前端

```text
浏览器 ── HTTPS ──> Web（Next.js + SQLite）
                         │ HMAC
                         ▼
                  身份 Gateway（Python）

AstrBot 插件 ── Bearer ──> Bot API ──> QQ 群提醒队首
```

仓库包含 Web、签名身份 Gateway、共享 JSON Schema、自托管部署样例，以及 AstrBot 通知插件。几个角色使用彼此独立的会话或密钥，Gateway 默认只监听本机回环地址，避免被直接暴露到公网。

## 本地体验

开发环境可完全离线运行：启动 Python Gateway 和 Web 后，使用下面的虚构二维码即可体验身份流程：

```text
mock:demo-user:示例玩家:12000:示例称号
```

生产上线时则必须接入**已获授权**的真实身份服务，并完成密钥、个人信息、反向代理和备份策略的审计。模板提供 `mock`、自有 HTTP provider 和无登录预览模式，但 mock 只适合开发与测试。

## QQ 提醒怎么接入

玩家先在个人页绑定 QQ；管理员为场地配置群 UMO；再把仓库附带的 AstrBot 插件装进 Bot 环境即可。插件会按“目录摘要 → 热机详情 → 通知”的节奏轮询，并带有启动预热、同一队首冷却、429/网络退避等保护，避免重复轰炸群聊。

## 适合谁

适合希望快速做一套排队系统的机台场地运营者，也适合作为 Next.js、Python Gateway、Bot 联动与单机自托管的项目模板。

当前 SQLite 持久层适合单城市、少量场地和单实例部署；如果要做多实例、高可用或跨机房，需要先迁移到服务型数据库，并重新验证并发与故障转移。

## 项目地址

- GitHub：[Bad0RANG3/VirtualWait-Template](https://github.com/Bad0RANG3/VirtualWait-Template)
- License：MIT

