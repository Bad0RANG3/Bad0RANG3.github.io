---
title: 'SOCD Cleaner，把普通键盘变成 Hitbox 级输入设备'
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

> 文章经由Deepseek V4.1 flash润色，很抱歉我的文笔并不好。

Hitbox 和 Mixbox 会内置 SOCD 芯片，键盘通常不会。方向键一旦撞在一起，游戏收到什么全看键盘和引擎怎么处理。SOCD Cleaner 想解决的就是这一段。

## SOCD 是什么

SOCD 指相反方向被同时按下，常见组合是 `A + D` 和 `W + S`。普通键盘会把两个方向都发出去，角色就可能原地抖动。格斗控制器一般在硬件层先裁决，再只输出一个有效方向。

常见的裁决方式有三种。

- 回中，左右或上下互相抵消，两个都不输出。
- 后发优先，后按下的方向生效，FPS 里的急停会用到。
- 先发优先，先按下的方向保持，后按的方向被忽略。

## SOCD Cleaner 怎么处理

SOCD Cleaner 是一个 Windows 系统级工具。它用低级键盘钩子拦截 `W/A/S/D`，把冲突交给裁决引擎处理，再用 `SendInput` 注入清洗后的按键。游戏看到的结果接近一把带 SOCD 芯片的键盘。

后发优先还有一个实用的持续行为。按住 `A` 时再按 `D`，输出会切到右方向。松开 `D` 后，已经按住的 `A` 会恢复输出，不需要重新按一次。

| 模式 | 冲突规则 | 同时按 A 和 D | 常见用途 |
| --- | --- | --- | --- |
| 回中 | 两个方向互相抵消 | 两边都不生效 | 格斗游戏赛事规则 |
| 后发优先 | 后按的方向覆盖先按的 | D 生效 | FPS 急停、CS2 |
| 先发优先 | 先按的方向保持 | A 生效 | 横版动作游戏 |

## 实现

程序运行在系统托盘里，没有主窗口。右键托盘图标可以切换模式，切完直接回游戏。

```text
物理键盘
   |
   v
低级键盘钩子 WH_KEYBOARD_LL
   |
   +-- 非 WASD 键，直接透传
   |
   +-- W/A/S/D，进入 SOCD 裁决
          |
          +-- 记录按下状态和时间
          +-- 分别处理 W/S 与 A/D
          +-- 按当前模式输出
          |
          v
     SendInput 注入
```

核心引擎不到 200 行 C++，使用 `WH_KEYBOARD_LL` 拦截输入，再通过 `SendInput` 注入虚拟按键。注入事件带独立标记，不会被自己重复拦截。

## 构建和运行

需要 Visual Studio 2022 或更新的 MSVC 构建工具。

```cmd
git clone https://github.com/Bad0RANG3/SOCD_Cleaner.git
cd SOCD_Cleaner
build.bat
socd.exe
```

也可以使用 CMake。

```cmd
mkdir build && cd build
cmake ..
cmake --build .
```

## 项目地址

- 作者，Bad0RANG3
- GitHub，[Bad0RANG3/SOCD_Cleaner](https://github.com/Bad0RANG3/SOCD_Cleaner)
- 许可，GPL-3.0
