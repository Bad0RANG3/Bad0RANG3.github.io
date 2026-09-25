---
title: 'CS2 HLAE Preset，一套现成的高画质 Demo POV 录制配置'
description: '基于 HLAE 与 FFmpeg 的 CS2 Demo POV 录制工具，内置 CPU、NVIDIA、AMD、Intel 多编码器预设和音视频合并脚本。'
date: 2026-06-24
tags:
  - CS2
  - HLAE
  - FFmpeg
  - 视频录制
  - 配置
category: 项目
series: CS2 工具与工作流
seriesOrder: 2
featured: false
draft: false
verifiedDate: 2026-06-24
difficulty: 中等
audience: 想录制 CS2 Demo POV 的玩家
hasDownload: true
polished: true
---

录一份干净的 CS2 Demo 第一人称镜头，本来是一件很碎的事：先要装 HLAE，再配 FFmpeg，还要处理录制参数、编码器选择和最后的音视频合并。中间能调的地方不少，而且录完一次，下次想再录还得从头来一遍。[CS2_HLAE_Preset](https://github.com/Bad0RANG3/CS2_HLAE_Preset) 就是把这一整套步骤收成了一份可以直接用的配置。

它基于 [HLAE](https://www.advancedfx.org/) 与 FFmpeg，内容包括运镜与通道设置、针对不同硬件的编码预设，以及录制结束后把画面和声音合并起来的脚本。你不需要理解每一个参数，也能先录出第一条可用的素材。

## 文件说明

```text
pov.vpk       POV 视角模型与材质包
hlae.cfg      HLAE 录制、通道和按键绑定
ffmpeg.cfg    CPU / NVIDIA / AMD / Intel 编码预设
merge.bat     合并 raw.mp4 与 audio.wav
```

`hlae.cfg` 只绑定上下方向键，不会覆盖你原来设置的个人快捷键。`↑` 用来开始录制并恢复 Demo 播放，`↓` 用来暂停 Demo 并结束录制。也就是说，整套录制过程基本只需要这两个键。

## 安装

先安装 HLAE，再通过它的安装工具把 FFmpeg 装进 HLAE 目录。之后把 `hlae.cfg` 和 `ffmpeg.cfg` 放进下面这个位置：

```text
<CS2安装目录>\game\csgo\cfg\
```

把 `pov.vpk` 放到 `cfg` 的上一级 `game\csgo`，再打开 `gameinfo.gi`，在 `SearchPaths` 中加入这一行：

```text
Game    csgo/pov.vpk
```

只需要加这一行，其他搜索结果不要动。加完之后，HLAE 启动时就会正确加载 POV 模型与材质。

## 录制

1. 在 CS2 控制台执行 `playdemo <demo名称>`。
2. 依次输入 `exec hlae` 和 `exec ffmpeg`。
3. 选择编码预设，例如 `c1` 或 `n1`。
4. 按 `↑` 开始，按 `↓` 结束。
5. 把生成的 `raw.mp4`、`audio.wav` 和 `merge.bat` 放到同一个目录，双击脚本得到 `output.mp4`。

顺序不要颠倒：先加载 HLAE 配置，再加载 FFmpeg 配置，否则编码预设不会生效。

## 选编码器

默认的 `c1` 是 x264 CPU 高画质预设，多数情况下直接用它就行，兼容性也最好。如果用 NVIDIA 显卡，可以先试 `n1`，也就是 HEVC NVENC 高画质；RTX 40 系还能使用 `nav1` 的 AV1 NVENC。AMD 和 Intel 对应的是 `a1` 和 `i1`。

需要更大的后期空间时，可以用 `p0` 录 ProRes 4444，也可以用 `c0` 或 `n0` 录无损。仓库里还提供了 4:4:4 色度和 16:9 拉伸的变体，具体指令可以查 README。

预设默认以 240 FPS 录制，同时输出 raw 与 depth 通道，并关闭后台失焦降帧，这样切出去看教程也不会把录制帧率拖下来。雷达会被固定成圆形，录第一人称镜头时少一层干扰。

## 项目地址

- GitHub：[Bad0RANG3/CS2_HLAE_Preset](https://github.com/Bad0RANG3/CS2_HLAE_Preset)
- FFmpeg 录制预设 v2.6e 来源：[Purp1e 紫](https://space.bilibili.com/73115492)
