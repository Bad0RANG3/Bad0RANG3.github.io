---
title: 'SOCD Cleaner：把普通键盘变成 Hitbox 级输入设备'
description: '一款 Windows 系统级 SOCD 裁决工具，拦截 W/A/S/D 冲突方向键，按回中、后发优先、先发优先三种模式清洗输入，让普通键盘获得专业格斗控制器的方向冲突处理能力。'
date: 2026-06-24
tags:
  - 工具
  - 键盘
  - 格斗游戏
  - FPS
  - C++
category: 项目
featured: false
draft: false
verifiedDate: 2026-06-24
difficulty: 中等
audience: Windows 下玩格斗游戏或 FPS 的键盘用户
hasCode: true
---

> 格斗选手用 Hitbox，是因为它内置了 SOCD 芯片。普通键盘也可以有。

## 什么是 SOCD

格斗游戏里有一个基础概念叫 **SOCD**（Simultaneous Opposing Cardinal Directions）—— 轴对向指令同时输入。

说白了就是同时按下相反方向键。比如 `A + D`（同时按左和右）、`W + S`（同时按上和下）。

普通键盘会很老实地把两个键都发给游戏，结果呢？角色卡在原地抽搐，方向来回抖动。

专业格斗控制器（Hitbox / Mixbox）的做法是内置 SOCD 芯片，在硬件层面裁决这种冲突：

- **回中（Neutral）**：相反键相互抵消，两个都不输出。这是 CPT 等格斗赛事的标准规则。
- **后发优先（Last Win）**：谁先按不重要，后按的那个说了算。FPS 游戏里急停就靠这个。
- **先发优先（First Win）**：先按的键锁定，后按的直接忽略。横版动作游戏里很常见。

但普通键盘没有这个芯片。

## 于是有了 SOCD Cleaner

SOCD Cleaner 是一个 Windows 系统级工具，在驱动层面前拦截 W/A/S/D 物理按键，用 SOCD 裁决引擎处理冲突，再把干净的按键注入给游戏。

它对游戏的呈现效果就是：**一个拥有了 SOCD 能力的键盘**。

打开记事本跑一段测试就能直观感受：

<div class="lyric-block">
<p><i class="lyric-en">模式：后发优先，按住 A → 输出 aaaa，再按住 D → A 自动释放，只有 D 生效</i></p>
<p><span class="lyric-cn">松开 D → A 自动恢复输出（不需要重新按 A）</span></p>
</div>

这就是**持续优先**——按住 A 向左走，点一下 D 又松开，自动回到 A 继续向左。不用重新按。

## 三种模式

| 模式 | 规则 | A + D 同时按时 | 典型场景 |
|------|------|:---:|---------|
| **回中** | 相反键相互抵消 | 两键均无效 | 格斗游戏赛事标准 |
| **后发优先** | 后按的键覆盖先按的 | 后按的生效 | FPS 急停、CS2 |
| **先发优先** | 先按的键锁定 | 先按的生效 | 横版动作游戏 |

同一个工具，打格斗切回中，打 CS2 切后发优先——右键托盘图标搞定。

## 技术实现

核心思路不复杂：

```
物理键盘
   │
   ▼
低级键盘钩子 (WH_KEYBOARD_LL)  ← 拦截 W/A/S/D
   │
   ├─ 非 WASD 键 → 透传给系统
   │
   └─ W/A/S/D → SOCD 裁决引擎
                  │
                  ├─ 四键状态追踪（held + 时间戳）
                  ├─ 纵轴裁决：W ↔ S
                  ├─ 横轴裁决：A ↔ D
                  ├─ 按模式输出
                  │
                  ▼
              SendInput 注入清洗后的按键
                  │
                  ▼
              目标游戏
```

整个引擎不到 200 行 C++，使用 Windows 低级键盘钩子（`WH_KEYBOARD_LL`）在系统层面拦截输入，通过 `SendInput` API 注入裁决后的虚拟按键。注入事件有独立标记，不会被自己再次拦截。

程序静默运行在系统托盘，无窗口、零感知。右键切换模式，切完继续打游戏。

## 快速开始

需要 Visual Studio 2022+ 或 MSVC 构建工具：

```cmd
git clone https://github.com/Bad0RANG3/SOCD_Cleaner.git
cd SOCD_Cleaner
build.bat
socd.exe
```

也可以 CMake 方式构建：

```cmd
mkdir build && cd build
cmake ..
cmake --build .
```

编译出来不到 100KB，干净轻量。

## 项目地址

👤 **作者**: Bad0RANG3

🔗 **GitHub**: https://github.com/Bad0RANG3/SOCD_Cleaner

📜 **许可**: GPL-3.0

> 工具就是这样，不刷存在感，把活干完就行。
