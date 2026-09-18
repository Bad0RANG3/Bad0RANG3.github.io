---
title: 'Yukinal，让 AI Agent 在你的批准下操作服务器'
description: '一个把远程开发、服务器运维与可审批 AI Agent 放进同一扇桌面窗口的工作区，覆盖 SSH、MCP、附件输入、审计和 21 条架构决策。'
date: 2026-09-13
updatedDate: 2026-09-18
verifiedDate: 2026-09-18
tags:
  - AI Agent
  - Tauri
  - Rust
  - TypeScript
  - SSH
  - MCP
  - 远程开发
  - 运维
category: 项目
featured: true
draft: false
cover: '/yukinal/yukinal-workspace.png'
coverAlt: 'Yukinal 首次使用工作区与 Agent 面板'
difficulty: 进阶
audience: 想让模型帮忙处理服务器事务，但不想直接把 shell 交出去的开发者
hasCode: true
---

> 文章经由Deepseek V4.1 flash润色，很抱歉我的文笔并不好。

把服务器 shell 交给模型很容易，麻烦集中在限制它能碰什么，以及出错后怎样追溯。Yukinal 把远程开发、SSH 运维和 AI Agent 放进同一个桌面工作区，模型只能提出操作，授权和执行仍然走现有流程。

项目地址在 [Bad0RANG3/Yukinal](https://github.com/Bad0RANG3/Yukinal)。当前以 `1.0.0` 作为首个稳定接口基线，使用 MIT 许可。

截至 2026-09-18，主分支在 `v1.0.0` 之后加入了 MCP Streamable HTTP、OAuth、权限守卫、附件输入，以及一批安全和恢复路径修复。下面的内容按当前仓库状态说明，并区分已经落地和尚未在真实环境验证的部分。

![Yukinal 首次使用工作区与 Agent 面板](/yukinal/yukinal-workspace.png)

## 模型只负责提出操作

直接让模型拥有 shell，会导致权限边界很难解释。它看到什么、能修改什么、执行记录在哪里，往往都依赖提示词。Yukinal 把模型放到提议者的位置，模型提出工具调用，Permission Engine 决定能不能执行，Rust 宿主在已经解析过的目标上完成操作，整个过程再写入可回放的活动记录。

这条边界落在代码结构里。`ToolRegistry` 是唯一执行入口，Permission Engine 是唯一授权入口，Node.js sidecar 本身不能直接连接 SSH、读取 SQLite 或访问凭据。

## 权限由两层选择合成

Agent 面板提供两个独立方向。

| 方向 | 取值 | 决定什么 |
| --- | --- | --- |
| 运行模式 | `goal`、`plan`、`readonly` | 这次运行最多能改到什么程度 |
| 批准方式 | `ask`、`auto` | 允许的部分由谁确认 |

每次工具调用还会带上风险事实，最后生成一张可执行的 ticket。等待批准超过 2 分钟会自动拒绝，不会一直挂起。停止运行会取消正在进行的 HTTP 流、工具执行和审批，并把取消状态写回。

高风险操作始终需要逐项批准，也不能记成“以后都允许”。`docker.restart` 标记为 `high`，即使运行在 `auto` 模式，也会回落为单独审批。外部 MCP 工具全部按 `critical` 处理，服务器自己声明的风险等级不会直接采信。

MCP 工具和内置工具共用同一套 registry、执行路径与取消令牌。宿主负责启动或连接 MCP server、读取工具目录并校验名称，sidecar 只能看到被放行的工具。

## 桌面工作区

服务器条目存在本地 SQLite 里，SSH 密码、私钥和口令进入操作系统凭据库。概览页会采集 OS、CPU、内存、运行时长、磁盘、网络和 Docker 信息，每个命令有 5 秒超时，采集结果可以回看。

终端基于 russh，支持多会话、输入、改尺寸和关闭，使用 `xterm-256color`。远程文件提供 SFTP 目录列表和最多 1 MiB 的文本读取，内容附带 SHA-256 摘要。界面没有直接写文件的入口，写入只作为 Agent 工具存在。

服务和日志都是只读探测。服务会先试 `systemctl`，再退到 `docker ps`。日志会先试 `journalctl`，再退到 `/var/log/syslog` 和 `/var/log/messages`，最多读取 120 行并做级别分类。读不到时返回 `unavailable`。

连接、配置变更和 Agent 工具执行都会写入活动表。Agent 对话记录也保存在 SQLite 中，可以按时间分组、搜索标题与正文、筛选状态、分页、重命名、归档和删除。

## Agent 运行时

Node.js sidecar 负责一轮完整 agent loop，包含组装上下文、调用模型、解析工具、请求授权、执行和回填结果。单次运行默认最多 25 步，墙钟上限为 15 分钟。

内置工具包括 `system.echo`、`server.info`、`docker.ps`、`docker.logs`、`docker.inspect`、`docker.restart`、`filesystem.read`、`filesystem.write` 和 `filesystem.edit`。除了 `system.echo`，其余工具都通过宿主侧执行。

附件输入已经接通。图片支持 PNG、JPEG、WebP 和 GIF，文档支持 PDF 与 UTF-8 文本，音频支持 WAV、MP3、OGG 和 FLAC。格式按魔数校验，文件数量和总大小都有上限。

每次运行都会记录 trace。被策略拒绝或被驳回的调用也会正常收尾，不会留下永久处于 `running` 的步骤。Agent 回复使用独立 Markdown 解析器渲染，HTML 只按文本显示，远程图片默认不加载。

![Yukinal 终端工作区](/yukinal/yukinal-terminal.png)

## MCP 同时支持 stdio 和 HTTP

主分支已经支持 stdio 与 Streamable HTTP 两种传输。HTTP 会处理 `Mcp-Session-Id`、协议版本、JSON 与 SSE 回包、可选 GET 事件流、取消通知和会话删除。

每个 endpoint 最多可以配置 16 条有序静态认证头。secret 只进入系统凭据库，配置文件里保留引用。OAuth 支持 authorization code 与 PKCE S256，也支持 RFC 8628 设备码流程，以及 `client_secret_post` 和 `client_secret_basic`。

DPoP 可以按需开启。开启后每台服务器使用一把 Ed25519 密钥，请求 proof 绑定方法、URL 和 access token，密钥仍然只进入系统凭据库。

MCP server 崩溃后会进行有界退避重建。工具需要先在设置页审核，之后每次调用仍然要经过审批。

2026-09-15 的互操作测试覆盖了官方 `@modelcontextprotocol/server-everything` 的 Streamable HTTP、官方 TypeScript SDK 的 JSON 回包，以及两个独立 stdio server。这些结果说明主路径可用，不能代表所有第三方实现都兼容。

## 架构

```text
React 19 + Vite
  服务器 · 概览 · 终端 · 文件 · 日志 · 服务 · 活动 · Agent
        | Tauri IPC
        v
Rust 宿主
  SSH · PTY · 采集 · SQLite · 凭据库 · sidecar · MCP
        |                           |
        v                           v
  远程服务器                  Node.js Agent sidecar
  systemd / Docker            agent loop · tools · providers · MCP
                                      |
                                      v
                              OpenAI-compatible / Anthropic / Gemini
```

Rust 持有 SSH、PTY、SQLite、凭据库、sidecar 和 MCP 生命周期，逻辑主要放在 `crates/*`，不打开窗口也能测试。`packages/shared` 保存类型、Zod schema、IPC 映射、事件名和 JSON-RPC 契约，Rust 与 TypeScript 会同时解析同一份 fixture。

sidecar 的 stdout 只承载协议帧，双方使用 NDJSON 编码的 JSON-RPC 2.0。`initialize` 必须是第一条请求，握手后宿主会调用 `system.describe`。协议版本不一致或者工具名冲突时，sidecar 不会被发布。

帧大小、命令输出、文件读取、日志行数、审批等待、单次运行步数和墙钟时间都有明确上限。MCP HTTP、OAuth discovery、token 刷新和远端 KRL 共用应用级出站设置，默认直连，也可以使用系统静态代理。远程 MCP 必须使用 HTTPS，明文 HTTP 只允许回环地址。

## 凭据与主机身份

SSH 认证覆盖密码、私钥、带口令私钥、OpenSSH 用户证书、ssh-agent 和 keyboard-interactive 多因素认证。第二因素提示只存在于当前认证轮次，不写 SQLite、keychain、活动审计或日志。

首次连接会记录主机与端口指纹。后续指纹不一致时连接会被拒绝，界面同时显示已保存和服务器出示的两个指纹。服务器还可以配置受信 host CA、principal 模式和 OpenSSH KRL，KRL 支持本地文件或 HTTPS，并有独立的 signer 轮换和 16 MiB 下载上限。

SQLite 只保存凭据引用，密钥进入操作系统凭据库。Provider key 在每次运行开始时由 Rust 解析，通过一次性参数交给 sidecar，不写配置和日志。审计输入会按键名脱敏，`filesystem.read` 的正文不会进入审计，sidecar 日志离开进程前也会清理凭据。

## Provider

`apps/agent/src/providers/` 分别提供 OpenAI-compatible、Anthropic Messages 和 Gemini `generateContent` 适配器。OpenAI-compatible 支持 Chat Completions 与 Responses 两种请求方言。

三种适配器都支持 SSE 文本增量、工具调用增量、取消、超时和安全错误摘要。协议类型由 `provider_configs.kind` 选择，`buildProvider()` 是唯一按 Provider 身份分支的位置，agent loop 只处理统一的 `StreamEvent`。

仓库提供显式 opt-in 的真实 Provider 验证脚本，覆盖文本流、工具结果回填、取消、图片和 PDF。默认门禁不访问网络，也不会为了测试错误路径制造付费请求。目前两套原生 Provider 适配器还没有对真实 API 调用过，主要依赖离线假响应和契约测试。

## 本地运行

前置条件包括 Node.js `>= 24`、pnpm `11.8.0`、Rust `1.85` 以上，以及 Tauri 2 在当前平台的系统依赖。

```bash
pnpm install
pnpm check
pnpm --filter @yukinal/desktop tauri dev
pnpm desktop:dev
pnpm package
```

`pnpm check` 会运行文档、凭据扫描、跨层契约、类型检查、测试、冒烟检查和 Rust 检查。完整桌面应用需要 Rust，`pnpm desktop:dev` 只提供浏览器预览。预览环境没有 SQLite、SSH、PTY、Tauri IPC、系统凭据库、MCP 或 sidecar，相关调用会明确失败，也不会用假数据伪装。

首次使用需要在设置里保存并测试模型连接，添加服务器并核验主机身份，再让 Agent 生成一次只读健康巡检草稿。

## 当前限制

`1.0.0` 是 Tauri IPC、sidecar JSON-RPC 和跨层类型的稳定接口基线。破坏性变更留给下一个主版本，版本号唯一来源是 `packages/shared/src/version.ts` 里的 `APP_VERSION`。

Windows 的 NSIS 安装包和 WiX `.msi` 已经在本机构建成功，但没有完成安装后的启动验收，也没有代码签名。第一次运行会出现 SmartScreen 警告，升级仍然依靠重新下载安装包。macOS 与 Linux 产物还没有在对应平台构建。

安装包不包含 Node.js。启动前会执行最长 5 秒的 `node --version` 预检，版本低于 24 或输出无法解析时会直接报错。

真实 Provider API、图片、PDF 和音频映射还没有经过真实端点确认。Anthropic Messages 不支持音频块，带音频时会明确失败。多模态预算也有上限，图片单张最多 4 MiB、最多 4 张，PDF 单文件最多 3 MiB、最多 2 个，音频单段最多 4 MiB、最多 2 段，三者共用 5 MiB 原始字节预算。

MCP 互操作只完成了抽样验证，不构成兼容保证。取消是标准通知，不是回滚，server 可以忽略通知。`filesystem.edit` 有并发守卫，但不能做到完整的 compare-and-swap，同秒同大小的远端改写仍可能无法区分。

仓库的剩余缺口写在 [limitations](https://github.com/Bad0RANG3/Yukinal/blob/main/docs/limitations.md)，设计取舍记在 [ADR](https://github.com/Bad0RANG3/Yukinal/blob/main/docs/adr.md)。

## 项目地址

- GitHub，[Bad0RANG3/Yukinal](https://github.com/Bad0RANG3/Yukinal)
- 技术栈，React 19、Vite、Tauri 2、Rust、Node.js sidecar
- License，MIT
