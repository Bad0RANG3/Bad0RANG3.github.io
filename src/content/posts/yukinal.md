---
title: 'Yukinal：让 AI Agent 在你的批准下操作服务器'
description: '一个把远程开发、服务器运维与可审批的 AI Agent 放进同一扇桌面窗口的工作区：模型只能提出工具调用，执行由 Rust 宿主在已解析的目标上完成，每一步都留下可回放的审计。'
date: 2026-09-13
tags:
  - AI Agent
  - Tauri
  - Rust
  - TypeScript
  - SSH
  - 远程开发
  - 运维
category: 项目
featured: true
draft: false
verifiedDate: 2026-09-13
difficulty: 进阶
audience: 想让模型帮忙处理服务器事务，但不想直接把 shell 交出去的开发者
hasCode: true
---

> 把 shell 交给模型很容易，难的是在它越界之前拦住它。

[Yukinal](https://github.com/Bad0RANG3/Yukinal) 是一个把「远程开发与基础设施运维」和「AI Agent」放进同一个桌面窗口的工作区：SSH 连接、服务器健康快照、终端、远程文件、服务与日志、活动审计，以及一个可审批的 Agent 面板。它现在发布到 `1.0.0`，MIT 许可。

## 问题不在模型会不会用 shell

让模型操作自己的服务器，最常见的做法是直接把 shell 交给它。方便，但代价是权限不可解释、越权无法追溯、误操作无法预防——模型看到什么、能碰什么，全凭提示词和运气。

Yukinal 的答案是把模型放在**提议者**的位置上。模型只能提出工具调用请求，是否执行由 Permission Engine 决策，实际操作由 Rust 宿主在已经解析过的目标上完成，整个过程落成可回放的活动记录与执行审计。模型不会绕开既有的运维流程，它是在既有的目标、风险规则和用户授权边界内工作。

这条边界不是文案，而是仓库里能被检查的结构：`ToolRegistry` 是唯一的执行入口，Permission Engine 是唯一的授权决策入口，sidecar 自己不连 SSH、不读 SQLite、不碰凭据库。

## 权限不是弹窗，是三层事实合成的一个决策

Agent 面板里能切换两个正交的轴：

| 轴 | 取值 | 决定什么 |
| --- | --- | --- |
| 运行模式 | `goal` / `plan` / `readonly` | 这次运行**能改到什么程度** |
| 批准方式 | `ask` / `auto` | **允许的部分由谁点头** |

在此之上，每次调用会合成三层风险事实，产出一张可执行的 ticket。等待批准的调用 2 分钟没有响应会按「已过期」直接拒绝，不会永久挂起运行；停止一次运行会中止在途的 HTTP 流、工具执行和等待中的审批，并把取消状态如实上报。

MCP 是这套规则的一个好例子：宿主把外部 MCP 服务器起起来、问出工具目录，再以 `mcp.<服务器>.<工具>` 的名字进入同一个 registry。服务器自我声明的风险等级一律不被采信，全部按 `critical` 处理，所以每个 MCP 调用都要用户逐项批准——而且它走的是和 `docker.*`、`filesystem.*` 完全相同的一条执行路径和同一套取消令牌。

## 今天真正能用的东西

README 里列出的每条能力都对应仓库里的实现，括号里是主要位置：

**桌面工作区（Tauri 窗口）**

- 服务器条目的增删改查落本地 SQLite；SSH 密码与私钥只进操作系统凭据库（`commands/server/`）。
- 概览页拉真实健康快照：7 个采集器（OS、CPU、内存、运行时长、磁盘、网络、Docker）各带 5 秒命令超时，采集结果入库可回看（`crates/collector`）。
- 终端是基于 russh 的 PTY（`xterm-256color`），支持多会话、写入、改尺寸与关闭，数据通过事件流回界面（`crates/terminal`）。
- 远程文件：SFTP 目录列表与有上限的文本读取（上限 1 MiB，超出标记为已截断），内容带 SHA-256 摘要。界面**没有**写文件的入口，写入只作为 Agent 工具存在（`commands/files.rs`）。
- 服务与日志是固定的只读探测：服务先试 `systemctl` 再退到 `docker ps`；日志先试 `journalctl`，再退到 `/var/log/syslog`、`/var/log/messages`，最多 120 行并做级别分类。探测不到就明确返回 `unavailable`，不会编造内容（`commands/services.rs`、`commands/logs.rs`）。
- 活动记录：连接、配置变更、Agent 工具执行都会写入 `activities` 表并推送事件（`commands/activity.rs`）。
- Agent 对话记录持久化到 `chat_sessions` / `chat_messages`，按今天 / 昨天 / 最近 7 天 / 更早分组，可搜标题与正文、按状态筛选、分页、重命名、归档与删除。

**Agent 运行时（Node.js sidecar）**

- 一次完整的 agent loop：组装上下文 → 调用模型 → 解析工具调用 → 请求授权 → 执行 → 回灌结果进入下一轮。单次运行受 `maxSteps`（默认 25）与墙钟上限（默认 15 分钟）约束。
- 9 个内置工具：`system.echo` 无宿主也能用；`server.info`、`docker.ps`、`docker.logs`、`docker.inspect`、`docker.restart`、`filesystem.read`、`filesystem.write`、`filesystem.edit` 都由宿主侧真正执行。
- 每次运行有一个 `TraceRecorder` 账本，工具事件携带的 `traceId` / `stepId` 都由它发出；被策略拒绝或被驳回的调用也会把步骤收尾，不会留下永远 `running` 的步骤。
- Agent 回复用自己的 Markdown 解析器渲染（标题、列表、代码块、表格、行内代码），不注入 HTML；链接与图片因此不可点也不下载，这是有意为之的边界。

## 架构：一层持有资源，一层负责推理

```text
React 19 + Vite（apps/desktop/src）
  服务器 · 概览 · 终端 · 文件 · 日志 · 服务 · 活动 · Agent 面板
        │ 白名单 Tauri IPC：命令 + 事件
        ▼
Rust 宿主（apps/desktop/src-tauri + crates/*）
  SSH · PTY · 采集 · SQLite · OS 凭据库 · sidecar 启动与监督 · MCP 子进程
        │ SSH / SFTP / PTY              │ stdio 上的 NDJSON JSON-RPC
        ▼                                ▼
  远程服务器                      Node.js Agent sidecar
  systemd / Docker                agent loop · tools · 权限引擎 · providers
                                          │ HTTPS + SSE
                                          ▼
                                  OpenAI-compatible / Anthropic / Gemini
```

几条约束值得单独说：

- **Rust 拥有原生资源，且只做参数编组。** SSH 会话、PTY、SQLite、凭据库、sidecar 与 MCP 子进程句柄都由 Rust 持有，逻辑落在 `crates/*`，因此不打开窗口也能测试——`yukinal-core` 里没有 Tauri 类型。
- **`packages/shared` 是跨语言契约的唯一来源。** 类型、Zod schema、IPC 映射、事件名与 JSON-RPC 协议都在这里；`packages/shared/fixtures/ipc/` 下的 JSON 被 Rust 和 TypeScript 同时解析——类型只保证编译期一致，fixture 保证运行时一致。
- **sidecar 的 stdout 只承载协议帧。** 双方用 NDJSON 编码的 JSON-RPC 2.0 通信，`initialize` 必须是第一条请求，握手后宿主还会调用 `system.describe`；协议版本不匹配或工具名冲突时直接拒绝发布这个 sidecar。日志一律写 stderr，一条走错位置的 `console.log` 就会破坏协议。
- **有界性是设计约束，不是实现细节。** 帧大小、命令输出、文件读取、日志行数、审批等待时长、单次运行的步数与墙钟时间都有明确上限，并且写在文档里。

## 三种 Provider，一条凭据链路

`apps/agent/src/providers/` 里三种协议各有一个适配器：**OpenAI-compatible**（Chat Completions 与 Responses 两种请求方言）、**Anthropic Messages**、**Gemini `generateContent`**。三者都支持 SSE 文本增量、工具调用增量、取消、超时和安全的错误摘要。

协议是配置里的一列（`provider_configs.kind`），`buildProvider()` 是唯一按 Provider 身份分支的地方；agent loop 只依赖统一的 `StreamEvent`，不关心外面接的是哪家。凭据方面，SQLite 只保存 `credentialRef`，密钥存操作系统凭据库，Rust 在每次运行开始时解析并以一次性参数交给 sidecar，不写配置、不写日志。

## 跑起来

前置条件：Node.js `>= 24`、pnpm `11.8.0`、Rust `1.85` 以上（含 `rustfmt` 与 `clippy`），以及 Tauri 2 在当前平台的系统依赖。

```bash
pnpm install
pnpm check                                  # 完整门禁：文档卫生、凭据扫描、跨层契约、类型检查、单元测试、冒烟与 Rust 侧检查
pnpm --filter @yukinal/desktop tauri dev    # 完整桌面应用（需要 Rust）
pnpm desktop:dev                            # 浏览器预览：只能调界面，原生能力不可用
pnpm package                                # 打安装包（目前只有 Windows 路径被跑通过）
```

首次使用按顺序做三件事：在「设置 ▸ Provider」里填一个协议与密钥，在「服务器」里添加一台服务器并连接，之后概览、终端、文件、服务与日志才可用。

浏览器预览模式值得单独提一句：它不提供 SQLite、SSH、Tauri IPC 或 sidecar，调用原生命令会直接抛出「请在 Yukinal 桌面应用中执行此操作」，界面会显示「预览模式」标记。它不会用假数据伪装这些能力——这和我对日志探测「探测不到就返回 `unavailable`」的要求是同一个态度。

## 现状与限制

`1.0.0` 是首个稳定接口基线：Tauri IPC 命令、sidecar JSON-RPC 方法和跨层类型从这一版起按语义化版本维护，破坏性变更只留给下一个主版本。版本号的唯一来源是 `packages/shared/src/version.ts` 里的 `APP_VERSION`，其余各处由测试钉在同一个值上，改一处漏改其余会让 `pnpm check` 变红。

但发布状态要说清楚：

- **安装包已经在本机构建出来了，但没有签名。** Windows 上产出了 NSIS 安装程序与 WiX `.msi`，首次启动会被 SmartScreen 警告；没有公证，也没有自动更新。**macOS 与 Linux 的安装包从未构建过**，各自只能在各自平台上打。
- **仍然有明确的能力空缺。** 多模态输入没有实现；SSH 证书认证在后端可用但界面不能配置；两套原生 Provider 适配器写它们的环境没有网络，从未对真实 API 调用过。
- **有些边界是故意的，不会被补完。** 比如 Agent 回复里的链接永远不可点、远程文件界面永远没有写入入口。

仓库把「已知缺口」和「有意为之的边界」分开写进了 [docs/limitations.md](https://github.com/Bad0RANG3/Yukinal/blob/main/docs/limitations.md)，设计取舍则记在 15 条 ADR（`docs/adr.md`）里，代码注释中的 `ADR NNNN` 直接指向它们。

## 项目地址

- GitHub：[Bad0RANG3/Yukinal](https://github.com/Bad0RANG3/Yukinal)
- 主要栈：React 19 + Vite + Tauri 2 / Rust / Node.js sidecar
- License：MIT
