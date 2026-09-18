---
title: 'Yukinal：让 AI Agent 在你的批准下操作服务器'
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

> 把 shell 交给模型很容易，难的是在它越界之前拦住它。

[Yukinal](https://github.com/Bad0RANG3/Yukinal) 是一个把「远程开发与基础设施运维」和「AI Agent」放进同一个桌面窗口的工作区：SSH 连接、服务器健康快照、终端、远程文件、服务与日志、活动审计，以及一个可审批的 Agent 面板。它现在以 `1.0.0` 作为首个稳定接口基线，MIT 许可。

截至 2026-09-18，主分支在 `v1.0.0` 之后又加入了 MCP Streamable HTTP、OAuth、权限守卫、附件输入和一批安全与恢复路径修复。本文按最新仓库状态更新，并区分“已经落地”与“还没有对真实环境验证”。

![Yukinal 首次使用工作区与 Agent 面板](/yukinal/yukinal-workspace.png)

## 问题不在模型会不会用 shell

让模型操作自己的服务器，最常见的做法是直接把 shell 交给它。方便，但代价是权限不可解释、越权无法追溯、误操作无法预防。模型看到什么、能碰什么，全凭提示词和运气。

Yukinal 的答案是把模型放在**提议者**的位置上。模型只能提出工具调用请求，是否执行由 Permission Engine 决策，实际操作由 Rust 宿主在已经解析过的目标上完成，整个过程落成可回放的活动记录与执行审计。模型不会绕开既有的运维流程，它是在既有的目标、风险规则和用户授权边界内工作。

这条边界不是文案，而是仓库里能被检查的结构：`ToolRegistry` 是唯一的执行入口，Permission Engine 是唯一的授权决策入口，sidecar 自己不连 SSH、不读 SQLite、不碰凭据库。

## 权限不是弹窗，是三层事实合成的一个决策

Agent 面板里能切换两个正交的轴：

| 轴 | 取值 | 决定什么 |
| --- | --- | --- |
| 运行模式 | `goal` / `plan` / `readonly` | 这次运行**能改到什么程度** |
| 批准方式 | `ask` / `auto` | **允许的部分由谁点头** |

在此之上，每次调用会合成三层风险事实，产出一张可执行的 ticket。等待批准的调用 2 分钟没有响应会按「已过期」直接拒绝，不会永久挂起运行；停止一次运行会中止在途的 HTTP 流、工具执行和等待中的审批，并把取消状态如实上报。

危险动作必须逐项批准，而且不能被「以后都允许」记住。`docker.restart` 声明为 `high` 风险，因此即使在 `auto` 模式下也会回落为逐项审批；会话授权只覆盖非危险操作。外部 MCP 工具同样一律按 `critical` 处理，服务器自我声明的风险等级不会被采信。

MCP 工具进入和内置工具相同的 registry、执行路径和取消令牌。宿主负责启动或连接 MCP server、获取工具目录并校验名称；sidecar 只能看到被放行的工具，并把每个调用重新交给宿主执行。

## 今天真正能用的东西

README 里列出的每条能力都对应仓库里的实现，括号里是主要位置：

**桌面工作区（Tauri 窗口）**

- 服务器条目的增删改查落本地 SQLite；SSH 密码、私钥与口令只进操作系统凭据库（`apps/desktop/src-tauri/src/commands/server/`）。
- 概览页拉真实健康快照：7 个采集器（OS、CPU、内存、运行时长、磁盘、网络、Docker）各带 5 秒命令超时，采集结果入库可回看（`crates/collector`）。
- 终端是基于 russh 的 PTY（`xterm-256color`），支持多会话、写入、改尺寸与关闭，数据通过事件流回界面（`crates/terminal`）。
- 远程文件：SFTP 目录列表与有上限的文本读取（上限 1 MiB，超出标记为已截断），内容带 SHA-256 摘要。界面**没有**写文件的入口，写入只作为 Agent 工具存在（`commands/files.rs`）。
- 服务与日志是固定的只读探测：服务先试 `systemctl` 再退到 `docker ps`；日志先试 `journalctl`，再退到 `/var/log/syslog`、`/var/log/messages`，最多 120 行并做级别分类。探测不到就明确返回 `unavailable`，不会编造内容（`commands/services.rs`、`commands/logs.rs`）。
- 活动记录：连接、配置变更、Agent 工具执行都会写入 `activities` 表并推送事件（`commands/activity.rs`）。
- Agent 对话记录持久化到 `chat_sessions` / `chat_messages`，按今天、昨天、最近 7 天、更早分组，可搜标题与正文、按状态筛选、分页、重命名、归档与删除。

**Agent 运行时（Node.js sidecar）**

- 一次完整的 agent loop：组装上下文、调用模型、解析工具调用、请求授权、执行、回灌结果进入下一轮。单次运行受 `maxSteps`（默认 25）与墙钟上限（默认 15 分钟）约束。
- 9 个内置工具：`system.echo` 无宿主也能用；`server.info`、`docker.ps`、`docker.logs`、`docker.inspect`、`docker.restart`、`filesystem.read`、`filesystem.write`、`filesystem.edit` 都由宿主侧真正执行。
- 附件输入已接通：图片支持 PNG、JPEG、WebP、GIF；文档支持 PDF 与 UTF-8 文本；音频支持 WAV、MP3、OGG、FLAC。格式按魔数校验，文件数量、大小和总预算都有硬上限。
- 每次运行有一个 `TraceRecorder` 账本，工具事件携带的 `traceId` / `stepId` 都由它发出；被策略拒绝或被驳回的调用也会把步骤收尾，不会留下永远 `running` 的步骤。
- Agent 回复用自己的 Markdown 解析器渲染。HTML 只按文本显示，`http(s)`、`mailto` 与页内锚点通过受限 opener 打开；远程图片默认不加载，只有用户点击后才按 `no-referrer` 读取。

![Yukinal 终端工作区](/yukinal/yukinal-terminal.png)

## MCP 不再只有 stdio

最新主分支已经支持 stdio 与 Streamable HTTP 两种 MCP 传输：

- HTTP 会处理 `Mcp-Session-Id`、协议版本、JSON/SSE 回包、可选 GET 事件流、取消通知与 DELETE 会话终止。
- 每个 endpoint 可以配置最多 16 条有序静态认证头，secret 只存系统凭据库，配置里只保留引用。
- OAuth 支持 authorization code + PKCE S256 和 RFC 8628 设备码流程，也支持 `client_secret_post` / `client_secret_basic` 客户端认证。
- DPoP（RFC 9449）可选开启。开启后每台服务器一把 Ed25519 密钥，请求 proof 绑定方法、URL 与 access token，密钥仍然只进系统凭据库。
- MCP server 崩溃后按有界退避重建，工具需要先经过设置页审核才会进入 Agent 目录，启动后的工具调用仍然逐项审批。

真实 MCP 互操作目前是一组有边界的抽样记录。仓库在 2026-09-15 跑过官方 `@modelcontextprotocol/server-everything` 的 Streamable HTTP、官方 TypeScript SDK 的 JSON 回包，以及两个独立 stdio server。它证明主路径能工作，不代表所有第三方实现都兼容。

## 架构：一层持有资源，一层负责推理

```text
React 19 + Vite（apps/desktop/src）
  服务器 · 概览 · 终端 · 文件 · 日志 · 服务 · 活动 · Agent 面板
        │ 白名单 Tauri IPC：命令 + 事件
        ▼
Rust 宿主（apps/desktop/src-tauri + crates/*）
  SSH · PTY · 采集 · SQLite · 凭据库 · sidecar 监督 · MCP stdio / HTTP
        │ SSH / SFTP / PTY              │ stdio 上的 NDJSON JSON-RPC
        ▼                                ▼
  远程服务器                      Node.js Agent sidecar
  systemd / Docker                agent loop · tools · 权限引擎 · providers · MCP
                                          │ HTTPS + SSE
                                          ▼
                                  OpenAI-compatible / Anthropic / Gemini
```

几条约束值得单独说：

- **Rust 拥有原生资源，且只做参数编组。** SSH 会话、PTY、SQLite、凭据库、sidecar 与 MCP 生命周期都由 Rust 持有。逻辑落在 `crates/*`，因此不打开窗口也能测试。
- **`packages/shared` 是跨语言契约的唯一来源。** 类型、Zod schema、IPC 映射、事件名与 JSON-RPC 协议都在这里；fixture 被 Rust 和 TypeScript 同时解析，保证运行时一致，而不只是编译期一致。
- **sidecar 的 stdout 只承载协议帧。** 双方用 NDJSON 编码的 JSON-RPC 2.0 通信，`initialize` 必须是第一条请求，握手后宿主还会调用 `system.describe`；协议版本不匹配或工具名冲突时直接拒绝发布这个 sidecar。
- **有界性是设计约束，不是实现细节。** 帧大小、命令输出、文件读取、日志行数、审批等待时长、单次运行的步数与墙钟时间都有明确上限。
- **网络也有显式边界。** MCP HTTP、OAuth discovery、token 刷新和远端 KRL 共用应用级出站设置；默认直连，也可选择系统静态代理，不执行 PAC。远程 MCP 必须使用 HTTPS，明文 HTTP 只允许回环地址。

## 认证、凭据与审计

SSH 认证现在覆盖密码、私钥、带口令私钥、OpenSSH 用户证书、ssh-agent，以及 keyboard-interactive 多因素认证。第二因素提示只停留在当前认证轮次，不写 SQLite、keychain、活动审计或日志。

主机身份也有一整条可核验链路：首次认证记录 `host:port` 指纹；后续不一致即拒绝连接，并同时显示已钉住和服务器出示的两个指纹。服务器还可以配置受信 host CA、principal 模式和 OpenSSH KRL，支持本地文件或 HTTPS URL、独立 signer 轮换和 16 MiB 下载上限。

凭据方面，SQLite 只保存引用，密钥进入操作系统凭据库。Provider key 在每次运行开始时由 Rust 解析，以一次性参数交给 sidecar，不写配置、不写日志。审计输入会按键名脱敏，`filesystem.read` 的正文不进入审计，sidecar 诊断日志也会在离开进程边界前清理凭据。

最新一轮修复还收紧了主机指纹探针票据、`known_hosts` 原子替换、MCP 退出并行回收，以及凭据引用的失败清理与重试。这些不是界面上的新按钮，但决定出错时会不会留下一个不一致的安全状态。

## 三种 Provider，一条凭据链路

`apps/agent/src/providers/` 里三种协议各有一个适配器：**OpenAI-compatible**（Chat Completions 与 Responses 两种请求方言）、**Anthropic Messages**、**Gemini `generateContent`**。三者都支持 SSE 文本增量、工具调用增量、取消、超时和安全的错误摘要。

协议是配置里的一列（`provider_configs.kind`），`buildProvider()` 是唯一按 Provider 身份分支的地方；agent loop 只依赖统一的 `StreamEvent`，不关心外面接的是哪家。Anthropic 的 API version 和受控的非敏感自定义请求头已能从设置页配置，自定义头在 UI、Zod 与 Rust 三层共用同一套边界。

仓库也提供了显式 opt-in 的真实 Provider 验证脚本，会覆盖文本流、工具结果回填、取消、图片与 PDF。默认门禁不访问网络，也不会为了测错误路径而制造付费请求。需要说清楚的是，两套原生 Provider 适配器目前仍然没有对真实 API 调用过，协议翻译主要靠离线假响应和契约测试验证。

## 跑起来

前置条件：Node.js `>= 24`、pnpm `11.8.0`、Rust `1.85` 以上（含 `rustfmt` 与 `clippy`），以及 Tauri 2 在当前平台的系统依赖。

```bash
pnpm install
pnpm check                                  # 完整门禁：文档、凭据扫描、跨层契约、类型检查、测试、冒烟与 Rust 检查
pnpm --filter @yukinal/desktop tauri dev    # 完整桌面应用（需要 Rust）
pnpm desktop:dev                            # 浏览器预览：只能调界面，原生能力不可用
pnpm package                                # 打安装包（目前只有 Windows 路径被完整跑通过）
```

首次使用按引导做三件事：在「设置 ▸ Provider」里保存并测试模型连接，添加服务器并核验主机身份，然后让 Agent 生成一次只读健康巡检草稿，确认内容后再发送。

浏览器预览模式不提供 SQLite、SSH、PTY、Tauri IPC、系统凭据库、MCP 或 sidecar。调用原生能力会明确失败，界面显示预览标记，不会用假数据伪装这些能力。

## 现状与限制

`1.0.0` 是首个稳定接口基线：Tauri IPC 命令、sidecar JSON-RPC 方法和跨层类型从这一版起按语义化版本维护，破坏性变更只留给下一个主版本。版本号的唯一来源是 `packages/shared/src/version.ts` 里的 `APP_VERSION`，其余各处由测试钉在同一个值上。

但发布状态要说清楚：

- **Windows 安装包已经产出，但没有完成安装后启动验收。** NSIS 安装程序和 WiX `.msi` 已在本机构建成功，但还没有真的安装并拉起 sidecar；安装包没有签名，首次启动会被 SmartScreen 警告。macOS 与 Linux 产物尚未在对应平台构建。
- **没有代码签名、公证与自动更新。** 升级目前依靠重新下载安装包。
- **Node.js 必须由用户准备。** 安装包不包含或下载运行时；正常启动前会执行有 5 秒上限的 `node --version` 预检，低于 24 或输出不可解析时直接给出可操作错误。
- **两套原生 Provider 适配器从未对真实 API 调用过。** 图片、PDF 与音频映射也没有真实端点确认，当前模型目录不声明这些输入能力。Anthropic Messages 不支持音频块，带音频会明确失败而不是静默丢弃。
- **多模态仍有明确边界。** 图片单张最多 4 MiB、最多 4 张；PDF 单文件最多 3 MiB、最多 2 个；音频单段最多 4 MiB、最多 2 段；图片、PDF 和音频共用 5 MiB 原始字节预算。任意二进制文件不会内联发送。
- **MCP 互操作仍是抽样验证，不是兼容保证。** 取消是标准通知，不是回滚；服务器可以忽略通知，已经发生的副作用无法撤回。Host KRL 的信任分发也仍留在本地静态配置。
- **`filesystem.edit` 有守卫，但仍不是 compare-and-swap。** 同秒、同大小的远端改写仍可能无法区分，并发修改错误是保护，不是完全隔离。

有意保留的边界同样重要：

- Agent 回复里的危险操作永远不能靠一句“以后都允许”绕过逐项审批。
- MCP 工具无论自我声明什么风险，一律按 `critical` 处理。
- 浏览器预览永远不持有 SSH、PTY、SQLite 或凭据能力。

仓库把当前缺口写在 [docs/limitations.md](https://github.com/Bad0RANG3/Yukinal/blob/main/docs/limitations.md)，设计取舍记在 21 条 ADR（[docs/adr.md](https://github.com/Bad0RANG3/Yukinal/blob/main/docs/adr.md)）里。代码注释中的 `ADR NNNN` 会直接指回对应决策。

## 项目地址

- GitHub：[Bad0RANG3/Yukinal](https://github.com/Bad0RANG3/Yukinal)
- 主要栈：React 19 + Vite + Tauri 2 / Rust / Node.js sidecar
- License：MIT
