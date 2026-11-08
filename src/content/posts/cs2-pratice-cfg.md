---
title: 'CS2 跑图配置文件使用指南'
description: '把跑图要用的作弊开关、道具、机器人清理写进配置，进图一条 exec 就能开始练。'
date: 2026-03-27
updatedDate: 2026-07-23
tags:
  - CS2
  - 游戏
  - 配置
category: 游戏
featured: false
draft: false
verifiedDate: 2026-07-23
difficulty: 入门
audience: 需要快速开始 CS2 跑图练习的玩家
hasDownload: true
series: CS2 工具与工作流
seriesOrder: 1
---

跑图最烦的从来不是练枪，是每次进图都得重来一遍：开作弊、发道具、清机器人、关回合计时。一套动作做完，手还没热，注意力先散了。这份配置把这些动作提前写好，进图只要 `exec PT.cfg`。

仓库在 [CS2PraticeCFG](https://github.com/Bad0RANG3/CS2PraticeCFG)，2026-07-23 同步过最新缓存。

## 它关掉了什么

默认的 CS2 对练习不友好。经济限制、购买时间、回合计时、机器人、天气和时间、闪光和烟雾残留，都会在跑图时跳出来打断。这套配置先把这些处理掉，再把移动速度、投掷物轨迹、准星这些常用参数调到适合练习的值。

道具指南也打包在里面，竞技模式里能直接用。点位和教学是 Tatukunn 的，我做的是把它们和练习环境装到一起。

## 安装

下载 [CS2PraticeCFG.7z，V5.1.1](https://github.com/Bad0RANG3/CS2PraticeCFG/releases/download/V5.1.1/CS2PraticeCFG.7z)。

Steam 里右键 CS2 →「管理」→「浏览本地文件」，把压缩包里的东西拖进 `Counter-Strike Global Offensive` 目录。

启动游戏，控制台输入：

```text
exec PT.cfg
```

报 `PT.cfg` 找不到，基本是层级放错了。`cfg` 文件要落在 `Counter-Strike Global Offensive/game/csgo/cfg/` 下面，不是游戏根目录。路径改对再执行一次。

## 练习顺序

没有硬性顺序，按这个来不容易漏：先确认作弊和练习开关生效，再从投掷物开始，把常用的烟、火、闪过一遍；想检查正常速度下的手感，就切回普通参数。

## 项目地址

- 作者：Bad0RANG3
- GitHub：[Bad0RANG3/CS2PraticeCFG](https://github.com/Bad0RANG3/CS2PraticeCFG)

> “质疑屎山，理解屎山，制造屎山。”
