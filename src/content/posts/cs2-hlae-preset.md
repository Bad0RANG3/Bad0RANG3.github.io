---
title: 'CS2 HLAE Preset：高画质录制 Demo POV 的一套现成预设'
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
---

> 想从 CS2 Demo 里导出干净的第一人称镜头，又不想每次都手配 HLAE 和 FFmpeg？这套预设可以直接拿来录。

[CS2_HLAE_Preset](https://github.com/Bad0RANG3/CS2_HLAE_Preset) 是一套用于录制 CS2 Demo POV 视频的配置集合。它基于 [HLAE](https://www.advancedfx.org/) 和 FFmpeg，准备好了 HLAE 运镜/通道设置、多种硬件编码预设，以及录制完成后合并音视频的脚本。

## 包含哪些文件

```text
pov.vpk       POV 视角模型与材质包
hlae.cfg      HLAE 录制、通道和按键绑定
ffmpeg.cfg    CPU / NVIDIA / AMD / Intel 编码预设
merge.bat     合并 raw.mp4 与 audio.wav
```

其中 `hlae.cfg` 只绑定上下方向键，不会覆盖你原有的个人快捷键：`↑` 开始录制并恢复 Demo 播放，`↓` 暂停 Demo 并结束录制。

## 安装要点

先安装 HLAE，并通过它的安装工具把 FFmpeg 装进 HLAE 目录。接着将 `hlae.cfg` 与 `ffmpeg.cfg` 放到：

```text
<CS2安装目录>\game\csgo\cfg\
```

将 `pov.vpk` 放到 `cfg` 的上一级 `game\csgo`，然后在 `gameinfo.gi` 的 `SearchPaths` 中加入一行：

```text
Game    csgo/pov.vpk
```

只添加这一行即可，其他搜索路径不要改动。

## 录制流程

1. 在 CS2 控制台执行 `playdemo <demo名称>`；
2. 依次输入 `exec hlae` 和 `exec ffmpeg`；
3. 输入编码预设指令，例如 `c1` 或 `n1`；
4. 按 `↑` 开始录制，按 `↓` 结束录制；
5. 将生成的 `raw.mp4` 和 `audio.wav` 与 `merge.bat` 放在一起，双击脚本合成 `output.mp4`。

## 编码器怎么选

默认的 `c1` 是 x264 CPU 高画质预设，适合绝大多数情况。NVIDIA 显卡可优先试 `n1`（HEVC NVENC 高画质），RTX 40 系还可以使用 `nav1` 的 AV1 NVENC；AMD、Intel 分别有 `a1` 与 `i1` 的高画质硬件预设。

如果需要后期空间，可用 `p0` 录 ProRes 4444，或者用 `c0` / `n0` 录无损。所有预设也提供 4:4:4 或 16:9 拉伸的变体，具体指令可在仓库 README 查询。

预设默认以 240 FPS 录制，并同时输出 raw 与 depth 通道；同时关闭后台失焦降帧，并固定雷达为圆形，方便录第一人称镜头。

## 项目地址与致谢

- GitHub：[Bad0RANG3/CS2_HLAE_Preset](https://github.com/Bad0RANG3/CS2_HLAE_Preset)
- FFmpeg 录制预设（v2.6e）：[Purp1e 紫](https://space.bilibili.com/73115492)

