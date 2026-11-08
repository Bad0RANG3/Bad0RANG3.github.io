---
title: 'CS2 HLAE Preset，一套现成的高画质 Demo POV 录制配置'
description: 'HLAE 加 FFmpeg 的 CS2 Demo POV 录制配置：按键、通道、多编码器预设和音视频合并脚本都配好了。'
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

录一条干净的 CS2 Demo 第一人称镜头，要装 HLAE、配 FFmpeg、挑编码器，录完还得把画面和声音合起来。这些参数调一次就够了，但下次想再录，往往要从头翻一遍。[CS2_HLAE_Preset](https://github.com/Bad0RANG3/CS2_HLAE_Preset) 把这一串收成了一份能直接用的配置。

它基于 [HLAE](https://www.advancedfx.org/) 和 FFmpeg：运镜与通道设置、按硬件分好的编码预设、录完合并音视频的脚本，都在里面。参数不用全懂，也能先录出第一条能看的素材。

## 文件说明

```text
pov.vpk       POV 视角模型与材质包
hlae.cfg      HLAE 录制、通道和按键绑定
ffmpeg.cfg    CPU / NVIDIA / AMD / Intel 编码预设
merge.bat     合并 raw.mp4 与 audio.wav
```

`hlae.cfg` 只绑上下方向键，不碰你自己设的快捷键。`↑` 开始录制并恢复 Demo 播放，`↓` 暂停 Demo 并结束录制。整套流程就这两个键。

## 安装

先装 HLAE，再用它的安装工具把 FFmpeg 装进 HLAE 目录。然后把 `hlae.cfg` 和 `ffmpeg.cfg` 放进：

```text
<CS2安装目录>\game\csgo\cfg\
```

`pov.vpk` 放到 `cfg` 的上一级 `game\csgo`。打开 `gameinfo.gi`，在 `SearchPaths` 里加一行：

```text
Game    csgo/pov.vpk
```

只加这一行，其他搜索路径别动。HLAE 启动时会按这行加载 POV 模型和材质。

## 录制

1. 控制台执行 `playdemo <demo名称>`。
2. 依次输入 `exec hlae` 和 `exec ffmpeg`。
3. 选编码预设，比如 `c1` 或 `n1`。
4. 按 `↑` 开始，按 `↓` 结束。
5. 把 `raw.mp4`、`audio.wav` 和 `merge.bat` 放到同一个目录，双击脚本，得到 `output.mp4`。

顺序不能反：先加载 HLAE 配置，再加载 FFmpeg 配置，否则编码预设不生效。

## 选编码器

`c1` 是 x264 CPU 高画质预设，多数情况直接用它，兼容性最好。有 NVIDIA 显卡可以先试 `n1`（HEVC NVENC 高画质），RTX 40 系还能用 `nav1` 走 AV1 NVENC。AMD 和 Intel 对应 `a1`、`i1`。

需要更大后期空间，用 `p0` 录 ProRes 4444，或者 `c0`、`n0` 录无损。仓库里还有 4:4:4 色度和 16:9 拉伸的变体，具体指令看 README。

预设默认按 240 FPS 录制，同时输出 raw 和 depth 通道，并且关掉了后台失焦降帧，切出去看教程不会把帧率拖下来。雷达固定成圆形，录第一人称镜头时少一层干扰。

## 项目地址

- GitHub：[Bad0RANG3/CS2_HLAE_Preset](https://github.com/Bad0RANG3/CS2_HLAE_Preset)
- FFmpeg 录制预设 v2.6e 来源：[Purp1e 紫](https://space.bilibili.com/73115492)
