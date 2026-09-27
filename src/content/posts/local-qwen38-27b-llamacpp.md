---
title: '在本机跑 Qwen3.8-27B 无审查模型：llama.cpp 逐参数拆解，以及一个模型到底是怎么被造出来的'
description: '以 HauhauCS 的 Aggressive 量化版为标本，从显存预算、编译打补丁、下载签名校验，到 llama-server 每一条参数的取值理由；最后把 LLM 从预训练、后训练、对齐、量化到"去审查"的完整链路拆开讲一遍。'
date: 2026-09-27
tags:
  - llama.cpp
  - 本地部署
  - GGUF
  - 量化
  - Qwen
  - MTP
  - 投机解码
  - 无审查
  - LLM
category: 教程
featured: false
draft: false
verifiedDate: 2026-09-27
difficulty: 进阶
audience: 有独显或 Apple Silicon、想在自己机器上跑 27B 级模型，并且不想继续当"参数复制机"的人
hasCode: true
hasDownload: false
polished: true
---

这篇文章解决一个很具体的问题：把 [HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF](https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF) 在自己机器上跑起来，并且**知道自己敲下去的每一条参数在干什么**。参数表我会逐条拆，但我不想只停在"能跑"——第 8 节开始会往上游走，讲清楚这样一个权重文件是怎么从数据、架构、预训练、后训练一路被造出来，以及"无审查"这个属性在技术上究竟意味着什么。

先把边界说在前面。

- 本文只讨论**技术**：加载、显存、量化、推理加速、模型构造流程。不提供任何用于伤害他人、绕过授权或规避法律的用法，也不为你的使用后果背书。
- "无审查"指的是模型在训练/权重层面被削弱了拒答倾向，**不等于它更正确**，也不等于它的输出适合直接采用。去审查与去幻觉是两件完全不相干的事，后者甚至可能更糟。
- 下面所有版本号、体积、哈希、基准数字都来自 2026-09-27 抓取的仓库与上游源码。这类仓库更新很快，**以你实际下载到的文件为准**；任何"参考速度"都只是同一台机器上的相对值，不是承诺。
- 我没有在真实生产负载上长期跑过这套组合，下面的调参建议里有明确标注哪些是"按机制推断"的。

---

## 0. 先认识你要跑的东西

### 0.1 这个仓库里到底有什么

第一次点进这种仓库很容易懵：十几个文件，名字长得像随机字符串。其实只有三类。

| 文件 | 是什么 | 你要不要下 |
| --- | --- | --- |
| `Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf` 等 10 个 | **目标模型（target）**，各种量化档位。这是真正产出答案的模型 | 选一个 |
| `mmproj-...-BF16.gguf` | **视觉投影器**。让语言模型能"看"图片和视频 | 只有要图片/视频输入才下 |
| `Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-FastMTP-32K.gguf` | **HauhauCS FastMTP 加速旁路**，903 MB 的小草稿模型 | 想要加速才下 |
| `HauhauCS-FastMTP-llama.cpp.patch` | 让 llama.cpp 认识上面那个旁路的源码补丁 | 用 FastMTP 就必下 |
| `HauhauCS-RELEASE-MANIFEST.json` + `.sig` | 发布清单和 Ed25519 签名 | 想校验就下 |
| `FastMTP-PROVENANCE.json` + `.sig` | FastMTP 旁路的出处证明 | 同上 |
| `HauhauCS-FastMTP-Ed25519-PUBLIC.pem` | 验签公钥 | 同上 |
| `SHA256SUMS` | 所有文件的 SHA-256 | 建议下 |

一句话：**target 负责正确，mmproj 负责看，FastMTP 负责快，patch 负责让快得起来。** 这四件事互相独立，缺哪个都不会导致另一个失效。

### 0.2 模型规格

这是 Qwen3.8-27B 的二次量化版，底座是 [Qwen/Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B)，Apache 2.0。原始规格值得单独看一眼，因为后面所有性能判断都建立在这上面：

- 27B 稠密（dense）因果语言模型 + 视觉编码器，**不是 MoE**
- 64 层，隐藏维度 5120，FFN 中间维度 17408
- 词表 248320（padding 过的）
- 层布局：`16 × (3 × (Gated DeltaNet → FFN) → 1 × (Gated Attention → FFN))`
  - 也就是 **48 层 Gated DeltaNet（线性注意力）+ 16 层 Gated Attention（全注意力）**
  - Gated Attention：24 个 Q 头、**4 个 KV 头**，head dim 256，RoPE 维度 64
- 原生上下文 262,144 token，可扩展到 1,000,000
- 训练时带**多步 MTP（Multi-Token Prediction）**，GGUF 里保留了原生的 NextN 头

"稠密 + 混合注意力"这个组合是理解后面显存账本的关键。它没有 MoE 那种"激活参数远小于总参数"的红利，27B 就是老老实实 27B 都要过一遍；但它把大部分层换成了线性注意力，长上下文时的 KV 开销比同规模的传统 Transformer 小一个数量级。

### 0.3 Aggressive 是什么，以及它放弃了什么

作者自己写得很直白：**Aggressive 变体 = 直接给答案、不做拒答、少铺垫**，并且声明"没有改动数据集或意图中的能力"。同时他们补了一句我认为比宣传语更值得记住的话：

> 对可靠性敏感、特别是长上下文 agentic 任务，Balanced 版本通常是更稳妥的默认选择（如果有的话）。

翻译一下：**把拒答层削掉会顺带动到模型的"犹豫"能力**，而犹豫在很多场景里不是缺点——它让模型在信息不足时选择追问、选择保守、选择不做不可逆的操作。Aggressive 把这类行为一起压低了，换来的是干脆。你在做一个会自己改文件、跑命令的 agent 时，应该认真考虑这一点，而不是只看它回答得爽不爽。

至于宣传里的 **"0/465 Refusals"**：那是发布方在自己构建的 465 条提示上做的自评。它衡量的是"这套特定提示下没有触发拒答"，不是"模型没有价值观"，更不是独立第三方审计。看这类数字的方式应该是：知道它想表达什么、知道它没表达什么。

---

## 1. 先算显存，再下载

27B 的量化文件动辄十几二十 GB，下错了要重来。所以顺序应该是：**先算，再下**。

### 1.1 显存花在哪

```
总显存 ≈ 权重体积
        + KV cache
        + 计算缓冲区（batch/ubatch、FA 临时张量）
        + （可选）mmproj 约 0.87 GiB
        + （可选）FastMTP 旁路约 0.84 GiB + 它自己的 KV
```

权重是常量，KV cache 是变量，而 KV cache 恰恰是这篇文章里最值得动手算一次的东西。

### 1.2 KV cache 手动算一遍

回到架构：这个模型只有 **16 层是全注意力**，另外 48 层是 Gated DeltaNet。线性注意力层保留的是一个**与上下文长度无关的固定尺寸状态**（卷积状态 + 递归状态），它不随 token 数增长。所以长上下文下真正线性增长的部分，只由那 16 层决定。

单层、单 token 的 KV：

```
4 个 KV 头 × 256 维 × 2（K 和 V）× 2 字节（f16）
= 4096 字节 = 4 KiB
```

16 层：

```
4 KiB × 16 = 64 KiB / token
```

于是（按 f16 估算，不含对齐和线性层状态）：

| 上下文 | KV cache |
| --- | ---: |
| 32K | ≈ 2 GiB |
| 64K | ≈ 4 GiB |
| 128K | ≈ 8 GiB |
| 256K（原生满配） | ≈ 16 GiB |

这就是 16 层全注意力 + 4 个 KV 头的威力：一个 27B 模型跑到 256K 上下文，KV 只要 16 GiB。换成传统的全注意力 27B，这个数字要再乘 4 左右。**如果你只记住这篇文章里的一个数字，记这个。**

### 1.3 量化档位与推荐显存

体积取自仓库 manifest 的字节数（GiB 列是我按 1024³ 换算的，和页面上的十进制 GB 略有出入）。

| 文件 | 量化 | BPW | 文件体积 | 权重 (GiB) | 128K 上下文总计（含 KV + 缓冲） |
| --- | --- | ---: | ---: | ---: | ---: |
| Q8_K_P | Q8 | 9.21 | 31.46 GB | 29.30 | ≈ 39 GiB |
| Q6_K_P | Q6 | 7.59 | 25.92 GB | 24.14 | ≈ 34 GiB |
| Q5_K_P | Q5 | 5.92 | 20.22 GB | 18.83 | ≈ 28 GiB |
| Q4_K_P | Q4 | 5.25 | 17.92 GB | 16.69 | ≈ 26 GiB |
| IQ4_XS | IQ4 | 4.60 | 15.71 GB | 14.63 | ≈ 24 GiB |
| Q3_K_P | Q3 | 3.93 | 13.44 GB | 12.52 | ≈ 22 GiB |
| IQ3_M | IQ3 | 3.74 | 12.79 GB | 11.91 | ≈ 21 GiB |
| IQ3_XS | IQ3 | 3.56 | 12.18 GB | 11.34 | ≈ 21 GiB |
| Q2_K_P | Q2 | 3.12 | 10.68 GB | 9.94 | ≈ 19 GiB |
| IQ2_M | IQ2 | 3.02 | 10.32 GB | 9.61 | ≈ 19 GiB |

"总计"一列是 权重 + 8 GiB KV + 约 1.5 GiB 计算缓冲，**不含** mmproj 和 FastMTP。要视觉输入就再加约 0.9 GiB，要 FastMTP 再加约 0.9 GiB。

### 1.4 按硬件选档

| 你的卡 | 建议 | 说明 |
| --- | --- | --- |
| 96 GB（PRO 6000 / 多卡） | Q8_K_P + FastMTP + 满 256K | 这才是仓库基准数据的测量环境，别拿这个当自己的预期 |
| 48 GB（A6000 / 双 24G） | Q8_K_P 或 Q6_K_P，128K | Q8 想跑满 256K 需要额外 8 GiB KV，会比较紧 |
| 32 GB（RTX 5090 / V100 32G） | **Q4_K_P 或 Q5_K_P**，128K | 甜点位。Q4_K_P 大约占了 26 GiB，留得下缓冲 |
| 24 GB（4090 / 3090 / 5080） | IQ4_XS 或 Q3_K_P，64–128K | 想跑 128K 就得把 KV 量化到 q8_0，或者接受换页 |
| 16 GB（4080 / Apple M 系统一内存） | IQ3_XS / Q2_K_P，32K | 体积能塞下，但上下文一长就换页，体验下降明显 |
| 纯 CPU + 大内存 | IQ2_M / Q2_K_P | 能跑，但 27B 稠密的 decode 速度会很诚实 |

**选档原则**：上下文长度和 KV 精度对体验的影响，通常比权重从 Q4 提到 Q5 更大。如果你的场景是长文档、长 agent 链，优先保上下文；如果场景是短问答、要质量，优先保量化位宽。作者在 README 里也给了同样的建议：**缺显存时先降上下文，再降模型质量。**

---

## 2. 编译 llama.cpp，并打上 FastMTP 补丁

### 2.1 为什么必须锁 commit

FastMTP 不是标准 llama.cpp 里就有的东西，它需要仓库提供的那份补丁改 `src/models/qwen35.cpp`。补丁能否干净地 apply，取决于上游源码的行号和结构，所以发布方把它钉死在：

```
ggerganov/llama.cpp@4df29be4f4c3673f428170fda944a5b19f743bb8
```

`git apply --check` 就是用来在真正改动之前确认这件事的。如果你 checkout 了更新的主干、结果 `--check` 报错，**不要去手改补丁**——这说明上游已经改了 MTP 的加载逻辑，手改的补丁很容易在语义上错，而不是在文本上错。

### 2.2 构建

Linux / macOS（CUDA）：

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
git checkout 4df29be4f4c3673f428170fda944a5b19f743bb8

curl -L -o HauhauCS-FastMTP-llama.cpp.patch \
  https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF/resolve/main/HauhauCS-FastMTP-llama.cpp.patch

git apply --check HauhauCS-FastMTP-llama.cpp.patch   # 先确认能干净应用
git apply HauhauCS-FastMTP-llama.cpp.patch

cmake -S . -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j"$(nproc)"
```

换后端只改一个 `-D`：

| 平台 | 参数 |
| --- | --- |
| NVIDIA | `-DGGML_CUDA=ON` |
| AMD ROCm / HIP | `-DGGML_HIP=ON -DAMDGPU_TARGETS=gfx1100`（gfx 换成你的卡） |
| Vulkan（跨厂） | `-DGGML_VULKAN=ON` |
| Apple Silicon | 默认走 Metal，无需额外参数（想显式就 `-DGGML_METAL=ON`） |
| 纯 CPU | 不加后端参数 |

几个值得知道的构建开关：

- `-DCMAKE_BUILD_TYPE=Release`：别省。Debug 构建的推理速度会难看到你以为模型坏了。
- `-DGGML_NATIVE=ON`（默认开）：针对本机 CPU 指令集编译。**跨机器分发二进制时要关掉**，否则可能生成非法指令。
- `-DGGML_CUDA_FA_ALL_QUANTS=ON`：想用非 f16 的 KV cache 配合 Flash Attention 时可能需要，编译更久、二进制更大。
- Windows + MSVC：`cmake --build build --config Release`，产物在 `build\bin\Release\`。

### 2.3 这份补丁到底改了什么

补丁只有两处，但两处都挺有意思，值得读懂再打。

第一处，在加载 MTP 张量时：

```cpp
const ggml_tensor * d2t_meta = ml.get_tensor_meta("d2t");
if (mtp_only && d2t_meta) {
    n_vocab_out = d2t_meta->ne[0];   // 输出词表从 248320 缩到 32768
    d2t = create_tensor(tn(LLM_TENSOR_D2T), { n_vocab_out }, 0);
    ...
}
output = create_tensor(tn(LLM_TENSOR_OUTPUT, "weight"), { n_embd, n_vocab_out }, TENSOR_NOT_REQUIRED);
```

第二处，在构造 MTP 计算图、产出 logits 时，用 `ggml_set_rows` 把 32768 维的草稿 logits 散射回 248320 维的完整词表，其余位置填 `-INFINITY`：

```cpp
ggml_tensor * logits = ggml_fill(ctx0, ggml_new_tensor_3d(..., n_vocab_full, n_outputs), -INFINITY);
cur = ggml_set_rows(ctx0, logits,
        ggml_reshape_3d(ctx0, cur, 1, n_draft_vocab, n_outputs),
        ggml_reshape_3d(ctx0, model.d2t, n_draft_vocab, 1, 1));
cur = ggml_reshape_2d(ctx0, cur, n_vocab_full, n_outputs);
cb(cur, "result_output_d2t", -1);
```

这就是整个加速旁路的核心思路：**草稿模型不需要认识全部 248320 个 token，只需要认识 32768 个高频 token**，输出头因此可以小一个数量级；`d2t`（draft-to-target）映射表负责把草稿词表的位置翻回目标词表。草稿猜中的 token 落在 32768 之外时，那一项本来就是 `-INF`，不会污染验证。

也正因为如此，README 里那句报错才有明确含义：

```
expected 5120, 248320, got 5120, 32768
```

这不是模型文件坏了，而是**你在用没打补丁的 `llama-server` 去加载打了补丁才有意义的旁路**。换回你自己编译的那份就行。

### 2.4 顺带说清楚 MTP 的两条路

- **内嵌 MTP（embedded MTP）**：直接用任何一个目标量化文件 + `--spec-type draft-mtp`，不需要旁路，也不需要补丁。用的是目标 GGUF 自带的 NextN 头做自投机。
- **HauhauCS FastMTP**：目标文件 + 那个 32K 旁路 + 补丁。按作者的数据，比内嵌 MTP 再多 11%–35% 的生成速度。

先跑内嵌，跑通了再去折腾 FastMTP。这是最省时间的一条路。

---

## 3. 下载与校验

```bash
pip install -U "huggingface_hub[cli]"

hf download HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF \
  Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf \
  Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-FastMTP-32K.gguf \
  mmproj-Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-BF16.gguf \
  SHA256SUMS HauhauCS-RELEASE-MANIFEST.json HauhauCS-RELEASE-MANIFEST.json.sig \
  FastMTP-PROVENANCE.json FastMTP-PROVENANCE.json.sig HauhauCS-FastMTP-Ed25519-PUBLIC.pem \
  --local-dir models/qwen38-27b
```

（老的 `huggingface-cli download` 已经改名成 `hf download`，参数不变。国内环境可以设 `HF_ENDPOINT=https://hf-mirror.com`。）

然后校验，别跳：

```bash
cd models/qwen38-27b
sha256sum -c SHA256SUMS                     # 逐字节校验
```

再验签名，确认这份清单和 provenance 确实出自那把公钥对应的私钥：

```bash
openssl pkeyutl -verify -rawin -pubin \
  -inkey HauhauCS-FastMTP-Ed25519-PUBLIC.pem \
  -in FastMTP-PROVENANCE.json \
  -sigfile FastMTP-PROVENANCE.json.sig

openssl pkeyutl -verify -rawin -pubin \
  -inkey HauhauCS-FastMTP-Ed25519-PUBLIC.pem \
  -in HauhauCS-RELEASE-MANIFEST.json \
  -sigfile HauhauCS-RELEASE-MANIFEST.json.sig
```

看到 `Signature Verified Successfully` 才算过。

这里有个诚实的提醒：**验签只能证明"这份文件来自持有该私钥的人"，不能证明"这个人没有做坏事"。** 公钥本身是从仓库里下载的，如果仓库被接管，公钥和签名会一起被换掉。签名解决的是传输篡改和镜像不一致，不解决信任根的问题。真正想进一步确认，得靠 manifest 里的 `canonical_tensor_sha256`（张量指纹）——即使有人只改了元数据重新打包，这个指纹也应该保持一致。

顺带一提：**HF 页面的 Hardware Compatibility 组件不认识 `K_P` 后缀**，可能显示成 `?` 或者干脆"没有可用文件"。这时点 **View variants** 或直接进 **Files and versions**，文件都在。LM Studio 里也一样，量化列显示 `?` 只是显示问题。

---

## 4. 启动 llama-server：逐条参数

下面这条是 README 给的参考命令，我先完整贴出来，再分组拆。它是 96 GB 卡上的满配写法，**不要照抄**。

```bash
CUDA_VISIBLE_DEVICES=0 ./build/bin/llama-server \
  --model "$MODEL" \
  --spec-draft-model "$DRAFT" \
  --spec-draft-ngl all \
  --spec-type draft-mtp \
  --spec-draft-n-max 3 \
  --spec-draft-p-min 0 \
  --ctx-size 204800 \
  --parallel 1 \
  --batch-size 2048 \
  --ubatch-size 512 \
  --n-gpu-layers all \
  --split-mode none \
  --flash-attn on \
  --no-mmap \
  --temp 1.0 --top-k 20 --top-p 0.95 --min-p 0 \
  --presence-penalty 0 --repeat-penalty 1.0 \
  --jinja --reasoning on --reasoning-effort xhigh \
  --reasoning-preserve --reasoning-format deepseek \
  --host 127.0.0.1 --port 8080
```

### 4.1 模型与后端

| 参数 | 作用 | 怎么取 |
| --- | --- | --- |
| `-m, --model` | 目标模型路径。可以给单个文件，也可以给分片文件的第一片 | 指向你下的那个量化 GGUF |
| `-mm, --mmproj` | 视觉投影器。**不加载它，图片输入会报错或直接被忽略** | 要视觉就指 `mmproj-...-BF16.gguf` |
| `-ngl, --n-gpu-layers` | 放到显存里的层数。现在支持 `all` / `auto` / 具体数字 | 显存够就 `all`；不够就填数，`auto` 让它自己试 |
| `-sm, --split-mode` | 多卡怎么分：`none` 单卡；`layer` 按层切（流水线，默认）；`row` 按行切；`tensor` 张量并行（实验性） | 单卡 `none`。多卡一般 `layer`，带宽好再考虑 `row` |
| `-ts, --tensor-split` | 各卡分到的比例，例如 `3,1` | 只在多卡且显存不均时需要 |
| `-mg, --main-gpu` | `split-mode=none` 时用哪张卡；`row` 时中间结果和 KV 放哪张 | 单卡忽略 |
| `-fa, --flash-attn` | `on` / `off` / `auto`。显著降低注意力显存并提速 | 长上下文基本必开。**注意：它和 KV cache 的量化精度是绑定的**，某些组合需要重编译 |
| `-ctk, --cache-type-k` / `-ctv, --cache-type-v` | KV cache 的数据类型，默认 `f16` | 显存紧就 `q8_0`，能省一半 KV 且质量损失小；再往下降到 `q4_0` 就要留意长上下文退化 |
| `-lm, --load-mode` | 模型加载模式：`auto` / `none` / `mmap` / `mlock` / `mmap+mlock` / `dio` | 见下 |
| `-kvo, --kv-offload` | 是否把 KV cache 也放进显存，默认开 | 显存极度紧张时可以关掉，靠 PCIe 换性能 |
| `--no-op-offload` | 不让 host 侧张量操作下沉到设备 | 遇到诡异的数值/崩溃时可以用来排除 |
| `-t, --threads` / `-tb, --threads-batch` | 生成用线程数 / 预处理用线程数 | 纯 CPU 或部分 offload 时才关键 |

关于 `--no-mmap`：**在你可能拿到的这份新代码里它已经废弃了**，等价的新写法是 `--load-mode none`。逻辑是：

- `auto`（默认）：能用 mmap 就用。加载快、内存占用看着小。
- `mmap`：显式要求 mmap。
- `none`（旧 `--no-mmap`）：完全读进内存。加载慢、内存占用真实，但在显存/内存边界附近更可预测，不会被 pageout 拖慢。
- `mlock`（旧 `--mlock`）：锁在物理内存里，禁止换出。内存够又想避免抖动用这个。
- `dio`：DirectIO。

基准测试用 `--no-mmap` 是为了可复现——避免第一次访问权重时从磁盘换页干扰计时。**日常使用不一定需要**，但如果你的内存刚好卡在模型体积附近，`--load-mode none` 或 `mlock` 往往比默认更稳。

### 4.2 上下文与批处理

| 参数 | 作用 | 怎么取 |
| --- | --- | --- |
| `-c, --ctx-size` | 上下文长度。`0` 表示从模型元数据读（这里就是 262144） | 先按第 1 节算显存，再定这个数 |
| `-np, --parallel` | 并行 slot 数，即能同时处理几个会话 | 单人用 `1` |
| `-b, --batch-size` | **逻辑**批大小，prompt 预处理一次最多算多少 token | 2048 是常用值。直接影响 Prefill 速度 |
| `-ub, --ubatch-size` | **物理**批大小，真正送进计算图的一块有多大 | 通常 `b` 的 1/2 到 1/4。**这个值直接决定计算缓冲区的显存峰值**，OOM 时首先调它 |
| `--keep` | 上下文满了做 shift 时，保留开头多少个 token | 想固定 system prompt 就设成它的长度；`-1` 全保留 |
| `--context-shift` / `--no-context-shift` | 无限生成时是否自动滚动丢弃旧 token | 长会话建议关掉，让客户端自己管上下文，避免静默丢信息 |

**`-c` 和 `-np` 的关系是这一节最容易踩的坑**：在 `llama-server` 里，`--ctx-size` 是**所有 slot 加起来的总预算**，单会话实际可用约为 `ctx-size ÷ parallel`。

```text
想要单会话 128K：        -c 131072 -np 1
想要 4 个会话各 32K：    -c 131072 -np 4
```

`-b` 和 `-ub` 也不是越大越好。`-ub` 越大，计算时一次性驻留的中间张量越多，显存峰值越高；`-b` 大只是让调度更顺。所以调优顺序是：**先把 `-ub` 调到不 OOM，再把 `-b` 往上提。**

### 4.3 采样参数

这组参数决定了"从概率分布里怎么选下一个 token"，Qwen 官方给了成套推荐值，**不要凭感觉乱改**。

| 参数 | 作用 | 思考模式推荐 | 非思考模式推荐 |
| --- | --- | ---: | ---: |
| `--temp` | 温度。趋近 0 变贪心，越大越发散 | 1.0 | 0.7 |
| `--top-k` | 只在概率最高的 K 个里采样 | 20 | 20 |
| `--top-p` | 累积概率到 p 就截断，动态候选集 | 0.95 | 0.80 |
| `--min-p` | 相对阈值：低于 `min_p × 最高概率` 的候选直接砍掉 | 0.0 | 0.0 |
| `--presence-penalty` | 已经出现过的 token 一律扣分，鼓励聊新内容 | 0.0 | 1.5 |
| `--repeat-penalty` | 按出现次数惩罚重复 | 1.0（关闭） | 1.0（关闭） |
| `--repeat-last-n` | 惩罚只看最近 N 个 token | 默认 | 默认 |
| `-s, --seed` | 随机种子。固定它才能复现 | 需要复现时固定 | 同 |

解释几条最容易误用的：

- **`temp` 和 `top-k/top-p` 是一起工作的。** `temp=0` 时后两者基本无意义；`temp` 拉高时，`top-p` 才是真正限制发散的东西。
- **`presence-penalty` 调到 1.5 是个不小的力度。** 官方也提醒了：这个值偏高时，可能偶尔出现语言混用和性能轻微下降。它的正面作用是抑制"复读机"，负面作用是让模型不敢重复必要的术语。非思考模式下官方默认 1.5，思考模式下默认 0——**别把两套配置搞混**。
- **`repeat-penalty` 在这里是关的（1.0）。** 现代后训练模型对重复控制已经比较到位，硬开重复惩罚反而容易破坏代码、公式和专有名词。真遇到复读，先怀疑上下文/模板问题，再考虑 `presence-penalty`。
- **`--min-p` 建议保持 0.0。** 它和 `top-p` 功能有重叠，同时开两个动态截断会让行为难以解释。

### 4.4 思考模式与对话模板

| 参数 | 作用 |
| --- | --- |
| `--jinja` | 用模型自带的 Jinja 聊天模板。**这条必须开**，否则模板里的 tool call、思考标记都不会生效 |
| `-rea, --reasoning [on\|off\|auto]` | 是否启用思考。`auto` 从模板推断 |
| `--reasoning-effort LEVEL` | 思考深度，给模板的 `reasoning_effort`。Qwen3.8 支持 `xhigh` / `medium` / `low` |
| `--reasoning-preserve` | 多轮时保留历史消息里的思考内容 |
| `--reasoning-format FORMAT` | 思考内容怎么返回。`deepseek`：放进 `message.reasoning_content`；`none`：留在 `content` 里 |
| `--reasoning-budget N` | 思考 token 预算。`-1` 不限，`0` 立即结束，`N` 为上限 |
| `--chat-template-kwargs '{"..."}'` | 直接往模板塞参数，比如关思考 |

**Qwen3.8 默认就是思考模式**，而思考模式会先输出一大段推理再给答案。这在 agent 场景下是好事，在日常问答里就是纯粹的等待。想关掉：

```bash
--chat-template-kwargs '{"enable_thinking":false}'
```

或者按请求关（走 OpenAI 兼容接口）：

```json
{
  "model": "qwen38-27b-uncensored",
  "messages": [{"role": "user", "content": "..."}],
  "chat_template_kwargs": {"enable_thinking": false}
}
```

多轮 agent 想保留之前的推理上下文：

```json
{
  "chat_template_kwargs": {"preserve_thinking": true}
}
```

这里有个容易被忽略的取舍：**保留历史思考会显著吃上下文**。一个 agent 跑十几轮之后，光是历史思考就能把 128K 撑满。你需要在"模型记得自己之前怎么想的"和"上下文够不够"之间选一个。

### 4.5 投机解码：MTP 与 FastMTP

| 参数 | 作用 | 建议 |
| --- | --- | --- |
| `--spec-type draft-mtp` | 指定用 MTP 类型的草稿 | 内嵌 MTP 和 FastMTP 都用这个值 |
| `-md, --spec-draft-model` | 草稿模型路径 | 用 FastMTP 时指那个 32K 旁路 |
| `--spec-draft-ngl` | 草稿模型放几张卡 | `all` |
| `--spec-draft-n-max` | **最多一次草拟多少 token（深度）** | 3。README 的对比就是 depth 3 vs depth 2 |
| `--spec-draft-n-min` | 最少草拟多少 | 一般不用动 |
| `--spec-draft-p-min` | 草稿概率低于此值就停止 | `0`，表示不提前停 |
| `--spec-draft-p-split` | 分裂概率 | 默认 |
| `--spec-draft-type-k/-v` | 草稿自己的 KV 精度 | 默认 f16 就行，旁路很小 |

**投机解码为什么是无损的？** 因为它不是"用草稿模型的输出"，而是"用草稿模型生成**候选**，再让完整的目标模型一次性并行验证这些候选"。

```text
草稿：the quick brown fox jumps
目标：验证 the quick brown [fox] [jumps] ...
      ↑ 全部接受           ↑ 这里不一致，从该位置重新采
```

每个被接受的 token 都是目标模型自己认可的分布下的采样结果，被拒绝的位置由目标模型重新采一个。所以**输出分布不变，答案质量不变**，变的只是"一次前向能确认几个 token"。这也是为什么仓库敢说"FastMTP accelerates TG without changing its answers"。

代价是什么？草稿本身要算，验证要算，而且一旦接受率低就白算。所以：

- **接受率高（长文档续写、代码、格式化输出）→ 收益最大。** 仓库给的满窗数据是 92% 接受率。
- **接受率低（高度发散、创意写作、随机性大）→ 收益可能接近零甚至为负。**
- **深度不是越大越好。** depth 3 比 depth 2 好，但继续往上加，被拒绝的概率累积，边际收益会掉。

顺着 README 的数字看一眼就明白：Q8_K_P 上 FastMTP 相比内嵌 MTP，文档任务 +35.2%、推理任务 +21.1%；相比完全关闭 MTP 则是 3.02x / 1.93x。**推理任务受益明显小于文档任务**，因为推理是发散文本，草稿更难猜中。这非常符合机制，而不是玄学。

### 4.6 服务相关

| 参数 | 作用 |
| --- | --- |
| `--host` / `--port` | 监听地址与端口。默认 `127.0.0.1` |
| `-a, --alias` | 模型别名，客户端里 `model` 字段填这个名字 |
| `--api-key` | 访问密钥，支持逗号分隔多个 |
| `-to, --timeout` | 读写超时（秒）。长思考模型建议调大 |
| `-cb, --cont-batching` | 连续批处理，默认开。多用户场景很重要 |
| `--metrics` | 暴露 Prometheus 指标 |
| `--slots` | 暴露 slot 监控端点 |
| `--no-webui` | 关掉内置 Web UI |
| `--embedding` / `--rerank` | 切到 embedding / rerank 模式，**只给专用模型用** |
| `-v, --verbose` / `-lv, --log-verbosity N` | 排障用。`-lv 4` 看 trace |

### 4.7 三份可直接抄的配置

**A. 32 GB 单卡，日常使用（推荐起点）**

```bash
./build/bin/llama-server \
  --model  models/qwen38-27b/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf \
  --mmproj models/qwen38-27b/mmproj-Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-BF16.gguf \
  --spec-type draft-mtp \
  --spec-draft-n-max 3 \
  --spec-draft-p-min 0 \
  --ctx-size 131072 --parallel 1 \
  --batch-size 2048 --ubatch-size 512 \
  --n-gpu-layers all --split-mode none \
  --flash-attn on --load-mode none \
  --temp 1.0 --top-k 20 --top-p 0.95 --min-p 0 \
  --presence-penalty 0 --repeat-penalty 1.0 \
  --jinja --reasoning on --reasoning-effort xhigh \
  --reasoning-preserve --reasoning-format deepseek \
  --alias qwen38-27b-uncensored \
  --host 127.0.0.1 --port 8080
```

这一份用的是**内嵌 MTP**，不需要旁路也不需要补丁，先跑通它。

**B. 加上 HauhauCS FastMTP**

在 A 的基础上加两行（并且必须用打过补丁的 `llama-server`）：

```bash
  --spec-draft-model models/qwen38-27b/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-FastMTP-32K.gguf \
  --spec-draft-ngl all \
```

**C. 24 GB 卡的省显存版**

```bash
  --model ...-IQ4_XS.gguf \
  --ctx-size 65536 --parallel 1 \
  --ubatch-size 256 \
  --cache-type-k q8_0 --cache-type-v q8_0 \
  --no-mmproj
```

`--no-mmproj` 是显式放弃视觉，省掉那 0.9 GiB。`-ctk/-ctv q8_0` 把 KV 从 f16 砍到一半，128K 上下文只要约 4 GiB。代价是极长上下文下会有可测量的质量损失——**如果你的场景是长文档问答，宁可选更小的权重也别砍 KV；如果只是普通聊天，砍 KV 更划算。**

---

## 5. 接客户端

启动之后，`llama-server` 提供三套接口：OpenAI 兼容（`/v1/chat/completions`）、原生补全（`/completion`）、以及内置 Web UI（`http://127.0.0.1:8080`）。

先确认它活着：

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen38-27b-uncensored",
    "messages": [{"role":"user","content":"用三句话解释 Gated DeltaNet。"}],
    "chat_template_kwargs": {"enable_thinking": false}
  }'
```

视觉输入（需要 `--mmproj`）：

```json
{
  "model": "qwen38-27b-uncensored",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "这张图里的公式在说什么？"},
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
    ]
  }]
}
```

对接常见前端：

| 前端 | 接法 |
| --- | --- |
| Open WebUI | 连接设置里加 OpenAI 兼容端点，Base URL 填 `http://127.0.0.1:8080/v1` |
| SillyTavern | Chat Completion 源选 OpenAI 兼容，手动填 URL |
| Continue / Cline / Roo | 同样走 OpenAI 兼容，适合当本地编码助手 |
| LM Studio / Jan / KoboldCpp | 它们自带 llama.cpp，直接加载 GGUF；但 **FastMTP 旁路需要你自己那份打过补丁的构建**，前端里的版本不一定支持 |

一个实践建议：**把服务跑成 systemd 用户服务或者一个启动脚本**，不要让它在某个终端窗口里挂着。`llama-server` 的模型加载时间不是零，重启一次要等几十秒到几分钟。

---

## 6. 排障清单

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `expected 5120, 248320, got 5120, 32768` | 用未打补丁的 `llama-server` 加载 FastMTP 旁路 | 换回按第 2 节编译的产物 |
| 不认识 `--reasoning*` / `--spec-type` 等参数 | llama.cpp 版本太旧 | 更新构建。旧版本可能还能加载 GGUF，但没有完整的 Qwen3.8 服务路径 |
| LM Studio 里量化显示 `?` | `K_P` 后缀不被识别 | 显示问题，直接加载 |
| HF 页面说没有可用文件 | Hardware Compatibility 组件不认识 `K_P` | 点 View variants 或进 Files and versions |
| OOM，但权重明明装得下 | 计算缓冲或 KV 超了 | 先降 `-ub`，再降 `-c`，最后才砍量化位宽 |
| 长上下文下变慢/疯狂换页 | 内存不够 + mmap | `--load-mode none` 或 `mlock`，并把 `-c` 降到真实需要 |
| 加载很慢 | 权重在机械盘上且没 mmap | 放 SSD；或用默认 mmap |
| 输出复读 | 采样配置不对，或上下文快满触发 shift | 确认 `presence-penalty` 用的是对的那套；考虑 `--no-context-shift` |
| 思考模式回复太长 | 默认 `xhigh` | 降到 `medium` / `low`，或直接关思考 |
| 图片输入没反应 | 没加 `--mmproj` | 补上投影器 |
| 多用户时单人上下文很短 | `-c` 被 `-np` 平分 | 按第 4.2 节的公式重新分配 |

**想上 1M 上下文**：模型卡给的是 YaRN 路线，`factor=4.0`、`original_max_position_embeddings=262144`。在 llama.cpp 里大致对应：

```bash
  --ctx-size 1048576 \
  --rope-scaling yarn \
  --yarn-orig-ctx 262144 \
  --rope-freq-scale 0.25
```

三个提醒：一是 `factor=4.0` 是官方按"你真的需要超长"给的，Qwen 自己也在模型卡里说**只在需要处理长上下文时才改**，因为静态 YaRN 会伤短文本表现；二是 1M 上下文的 KV 是 64 GiB，先回去看第 1 节；三是这条命令我**没有在你这种消费级卡上实测过**，别把它当成"抄了就能用"。

---

## 7. 量化到底做了什么

到这里你已经在用 GGUF 了，但可能还只是把它当黑盒。花一节把它拆开，因为**理解量化能让你在"质量 vs 体积"的选择上有判断力**，而不是看别人推荐哪个就下哪个。

**第一步：格式转换。** 原始权重通常是 bf16/fp16。转成 GGUF 是把张量按类型重新编码，并写入元数据（架构、超参、tokenizer、聊天模板）。

**第二步：分组量化。** 不是把每个权重独立取整，而是把一维的行切成固定大小的 block（常见 32 或 256 个元素），每个 block 存一个（或两个）缩放因子。block 内共享尺度，误差因此被限制在局部。

**第三步：选择量化方案。** 大致三条线：

- **传统 `Q4_0` / `Q8_0`**：最简单的 block 量化，均匀分布假设。快，但对异常值不友好。
- **k-quant（`Q4_K_M`、`Q6_K` 等）**：block 内再分子块，用更多位表达缩放因子，对不同张量用不同策略。这是社区最常用的那条线。
- **i-quant（`IQ2_M`、`IQ3_XS`、`IQ4_XS` 等）**：用码本/格点量化，在极低比特率下明显优于 k-quant，但**更慢**，因为需要查表和更复杂的反量化。

**第四步：imatrix（重要性矩阵）校准。** 这是低比特量化的关键一步：拿一批校准文本跑一遍，统计每个权重通道对输出的影响，然后**把比特分配给重要的通道**。没有校准的低比特量化通常会明显崩坏。

**第五步：这就是 `K_P` 的位置。** README 说 K_P 是"Perfection"——用模型专属的分析，把质量保留在最关键的位置，代价是比基础量化大 5%–15%，效果约等于"往上提一到两档"。也就是说：

```text
Q4_K_P 的质量 ≈ 在 Q4_K_M 基础上往上提一到两档
体积      ≈ 比基础量化大 5%–15%
```

值得注意的是，**K_P 文件仍然是标准 GGUF**，llama.cpp / LM Studio 都能直接加载，不需要插件。它的"特殊"只在量化时的分析过程，而不在运行时。

所以现在你手上那张档位表就有了另一种读法：**IQ4_XS 是"码本省比特"，Q4_K_P 是"校准保质量"**。同样 15–18 GB，它们针对的其实是不同的失败模式。IQ 系列在低比特下更强，但要接受更慢的解码；K_P 系列在相近体积下质量更稳，代价是文件更大。

---

## 8. 一个模型是怎么被造出来的

前面都是"怎么用"。这一节我们往上游走：**`Qwen3.8-27B-...-Q4_K_P.gguf` 这个文件，在你下载它之前，经历了什么。**

### 8.1 第一步不是模型，是词表

在做任何训练之前，得先决定"语言的最小单位"。现代 LLM 几乎都用 BPE 或其变体：从字节出发，反复合并出现频率最高的相邻对，直到词表达到目标大小。

Qwen3.8-27B 的词表是 **248,320，而且是 padding 过的**。这个数字本身就透露了信息：

- 它比常见的 128K / 152K 大不少，说明**多语言覆盖被认真对待了**，尤其是中文和多语种场景下，大的词表能让一个 token 承载更多信息，降低长文本的 token 成本。
- "padding 到 248320"是为了让词表大小对齐到硬件友好的倍数（通常是 128 的倍数），让 GPU 上的矩阵乘法不用处理奇怪的维度。**代价是 embedding 和 output 层白白多出一部分参数**——这就是为什么有些模型宁可 padding 也不取整数值。

词表是模型对世界的"分辨率"。分辨率太高，序列变长、计算变贵；太低，一个 token 混进太多语义，模型难以精细区分。这个取舍在做模型的第一天就要定下来，之后基本不能改。

### 8.2 架构：为什么是"混合注意力"

如果你只看一个数字，那就是 **16 层全注意力 + 48 层线性注意力**。

标准 Transformer 的注意力在长上下文下是 O(n²)，KV cache 是 O(n)。要让模型跑到 262K，全部用全注意力的话，KV 会大到没有消费级硬件能承受（回到第 1.2 节，那会是 256 GiB 而不是 16 GiB）。所以这一代模型普遍在做同一件事：**把大部分层换成状态空间/线性注意力，只保留少量全注意力层负责精确的远距离检索。**

Gated DeltaNet 就属于这一类：它维护一个固定大小的递归状态，用"门控"决定什么时候写入、什么时候遗忘。**上下文增长时它的开销是常数**。而全注意力层则负责那些线性注意力搞不定的、需要精确回看的任务。

这种"线性层保效率、注意力层保精度"的混合结构，是**长上下文能真正落地**的关键工程决策，重要性甚至超过参数量的增长。

至于 MTP（Multi-Token Prediction）：训练时让模型同时预测未来 1、2、3 个 token，而不是只预测下一个。原始动机是"让模型在表示层学到更长程的结构"，但**对普通用户真正有用的副作用是：训练出来的那个额外预测头，可以直接当推理时的投机解码草稿。** 一个训练期的辅助目标，在两年后变成了推理期的加速器——这类"训练设计在下游产生意外收益"的事情在大模型里反复发生。

### 8.3 预训练：一次慢得离谱的压缩

预训练的目标函数简单到近乎简陋：

```text
给定前面的 token，预测下一个 token 的概率
loss = 交叉熵
```

把这句话乘以几万亿 token，就是预训练。但真正难的不是目标函数，是数据和工程。

**数据侧：** 从 Common Crawl、代码仓库、书籍、论文、多语种语料里收集，然后做一长串处理：去重（精确去重 + 近似去重）、质量过滤（困惑度过滤、分类器打分）、有害/垃圾内容清洗、以及**配比**。配比是各家最不公开、也最影响最终能力的东西之一——代码占多少、数学占多少、中文占多少，直接决定模型的"性格"。

**工程侧：** 27B 参数不可能放进一张卡。得同时用：

- 数据并行：不同卡吃不同 batch，梯度同步
- 张量并行：一层内的矩阵切到多张卡
- 流水线并行：不同层放在不同卡，像流水线一样传递
- ZeRO / FSDP：把优化器状态、梯度、参数分片存储

训练用混合精度（bf16 为主的混合），配合梯度检查点换显存，学习率先 warmup 再余弦衰减。整个训练通常要跑几周到几个月，中途炸一次可能损失几天——**所以预训练里真正稀缺的资源不是 GPU，是"一次也不出错"的稳定性。**

**通信量。** 反过来算一下就很直观：每个 token 都要过全部 27B 权重（前向 1 次、反向 2 次），所以训练一个 token 的计算量约 6 × 27e9 = 1.6e11 FLOPs。训 10 万亿 token 就是 1.6e24 FLOPs 量级。这才是"训练成本"的真实样子，也是为什么大多数组织只能做微调。

### 8.4 退火与长上下文扩展

预训练主体结束后，还有一个被严重低估的阶段：**退火（annealing）**。

做法是用一个小得多的学习率，在**经过精心挑选的高质量数据**上再训一小段。用户的高质量问答、代码、数学推导、教科书式文本会在这个阶段被放大比例。你感觉到的"这个模型答得挺有条理"，很大一部分功劳在这里。

长上下文能力也是在这一阶段和之后扩展出来的。原生训练窗口没有 262K，得先用短上下文把模型训好，再通过位置插值/YaRN 之类的方法把窗口扩出去。**这就是为什么 Qwen 在模型卡里强调"静态 YaRN 会伤短文本"**：它是把位置编码的频率强行拉伸来换取长距离外推能力，短文本上等于一直在用一种"过度拉伸的坐标系"。

### 8.5 后训练：从"会接话"到"会办事"

预训练出来的是一个极其擅长续写的模型，但它不听话。你说"帮我写一个冒泡排序"，它可能续写出一篇关于排序算法的博客。把它变成"助手"，靠的是后训练，大致三个阶段：

**1. SFT（监督微调）。** 用人写的"问题 → 理想回答"对做监督学习。这一步教会模型对话格式、指令遵循、以及"回答应该长什么样"。数据质量在这里远重要于数量——几万条精心写的样本，通常胜过几百万条爬来的。

**2. 偏好对齐。** SFT 只能模仿，不能表达"哪个回答更好"。所以引入偏好数据（同一个问题的 A/B 两个回答，人标注哪个更好），然后：

- **RLHF**：训一个奖励模型，再用 PPO 优化策略
- **DPO / 变体**：跳过奖励模型，直接在偏好对上优化
- **GRPO / RLVR**：对**可验证**的任务（数学有唯一答案、代码能过测试）直接用验证器当奖励

**3. 推理能力训练。** 这是"思考模式"的来源。模型不是天生会先打草稿再回答的，这是被训练出来的行为：给模型足够长的 token 预算去推理，用结果正确性作为奖励，它就会自己学会"先算清楚再输出"。`reasoning_effort` 这个旋钮，本质是在告诉模型"这次给你多大的草稿纸"。

理解这一点很重要：**"思考"是一种学到的策略，不是内部独白。** 模型不是在"真的想"，它是在生成一段能提高最终答案正确率的文本。这既解释了它为什么管用，也解释了它为什么会在长链推理里跑偏——一段越长越长的文本，本身也会累积错误。

**顺便说清楚"对齐"是什么。** RLHF 做的不是给模型装一个道德模块，而是**塑造它的输出分布**：让某些回答概率上升、某些下降。所谓"拒绝"，是这个分布形状里的一种可观察行为，而不是一段可以简单删除的代码。这一点是理解第 8.6 节的前提。

### 8.6 "无审查"在技术上是怎么做到的

这是这篇文章里最需要精确的一节，也是最容易传谣的一节。

社区里所谓"uncensored / abliterated"模型，主流做法有两条路线：

**路线一：数据侧的去审查微调。** 直接拿一批"本该被拒答、但给出了有用回答"的样本来做 SFT/DPO。优点是简单、可控；缺点是**会碰到能力**——你必须重训，而重训数据的覆盖范围决定了模型哪些能力被顺带打偏了。

**路线二：权重侧的方向消融（abliteration 及其变体）。** 这是更"外科手术"的一类做法，步骤大致是：

1. 构造两组提示：一组通常会触发拒答，一组不会。
2. 把两组提示喂进模型，**在每一层的隐藏状态上取平均激活**。
3. 两者相减，得到一个"拒答方向"向量。
4. 把这个方向从模型的权重矩阵里**正交化消掉**（对写权重做投影，去掉该方向的分量）。

直觉是这样的：如果"我该不该拒绝"这件事在表示空间里表现为一个相对固定的方向，那么把这个方向上的分量抹掉，模型就"想不起来要拒绝"。它不需要重新训练，不动数据集，因此原始能力大概率被保留得比较完整——**这也正是 HauhauCS 在 README 里强调"No changes to datasets or intended capabilities"时想表达的意思**：从措辞看，这是权重层面的介入，而不是重训。具体他们用的是哪一种变体，仓库没有公开细节，我不打算替他们补全。

两条路线都有共同代价，值得你心里有数：

- **消融是全局的，不是选择性的。** "该不该拒绝"和"该不该谨慎"在表示空间里未必分得开。把前者抹掉，很可能同时削弱后者——这正好解释了为什么作者自己建议长上下文 agentic 任务用 Balanced：**在高风险链路上，模型少一点犹豫是缺点，不是优点。**
- **能力评测覆盖不到行为变化。** 一个 abliterated 模型在 GPQA、SWE-bench 上可能几乎不掉分，但在"面对含混需求时应该反问"这类没有标准答案的场景里，表现可能完全不同。这类退化不会出现在任何 benchmark 表格里。
- **`0/465 Refusals` 的解读边界**，前面说过了：自评、自建提示集、单一维度。

所以我的结论是：**"无审查"是一个关于行为分布的描述，不是一个质量等级。** 它把模型在某些输入下的输出从"拒绝"改成了"回答"，至于改成"回答"之后是对是错、该不该信，模型本身没有给你任何额外保证。

### 8.7 评测：数字是怎么来的

顺带拆一下前面那些基准数字的可信边界，因为这是最容易被误读的部分。

- **同一行数字必须同 harness 才可比。** 官方在脚注里写得很清楚：SWE-bench Pro 用 Claude Code harness、temp=1.0、top_p=0.95、256K 上下文；而 Opus4.6 Max 用的是官方公布值。**不同 harness、不同采样参数下横向比，基本等于没比。**
- **`empty cells (--)` 是"没有"而不是"差"。** 表格里的空缺只表示该模型没在这个基准上公布结果，不表示垫底。
- **这些是产品方的自评口径。** 基准通常由模型出品方自己跑，即使方法透明，选择哪些基准、怎么报告本身就是一种表达。

对你实际有用的做法是：**只看相对差异，不看绝对值。** "Qwen3.8-27B 在 LiveCodeBench v6 上 90.3，Qwen3.6-27B 是 83.9" 这句话有意义；"90.3 分"单独拿出来没有意义。

### 8.8 从权重到 GGUF：最后一段路

模型训练完，产出的是 bf16 权重。到你手里之前还要过：

1. **合并与导出**：把分片并行训练的检查点合并成可发布的权重。
2. **能力评估与红队**：跑基准、跑安全评估。**注意：这一步的结果决定了发布什么，也决定了"无审查版"在多大程度上是一次真正的能力削减。**
3. **格式转换**：转 GGUF，写入元数据（架构、超参、chat template、tokenizer）。
4. **校准与量化**：用 imatrix 校准，产出各档位。
5. **验证与签名**：算 SHA-256、算张量指纹、签 manifest。

而 HauhauCS 这类二次发布方，在第 4、5 步之间插入的是**自己的量化分析（K_P）和自己的加速旁路（FastMTP）+ 补丁 + 签名**。这就是为什么这个仓库里有 `.pem` 和 `.sig`——**在权重世界里，可验证性只能靠哈希和签名来做，没有别的手段。** 这也回答了第 3 节那个问题：为什么验签值得做，以及为什么验签不够。

---

## 9. 我的一些看法

**1. "本地部署"的真正成本不是下载，是维护。**
下载 18 GB 是一小时的事。真正的成本是你得持续处理：上游 llama.cpp 每次改动可能让补丁失效、量化档位要跟着显存重新选、上下文长度和 KV 精度要按场景反复权衡。把本地模型当"一次配置、长期不动"的项目，通常会失望；把它当一个需要偶尔维护的自托管服务，预期就对了。

**2. 这个时代最实用的工程红利是 MTP 和投机解码，而不是参数量。**
3.02x / 1.93x 这种数字，换算成体感就是"能用了"和"太慢了"。而且它无损——输出分布不变。**凡是能无损加速的手段，优先级都应该拍在"换个更大的模型"前面。**

**3. 混合线性注意力是长上下文普及的真正原因。**
16 层全注意力、64 KiB/token，这个设计让 27B 模型跑 256K 上下文从"机房专属"变成"一张消费卡可以想一想"。以后看到某个模型宣称支持超长上下文，第一个该问的问题不是"多少 token"，而是"KV 多大"。

**4. 无审查模型最危险的地方不是它说了什么，而是它不说"我不知道"。**
拒答行为里混着一部分**校准能力**。把拒答削掉的时候，你分不清削掉的是"过度保守"，还是"意识到自己信息不足"。前者是好事，后者是灾难。而这两者在 benchmark 上没有区分度，只能靠你自己在真实任务里观察。

**5. 量化是二次创作，不是简单压缩。**
`Q4_K_P` 和 `IQ4_XS` 体积差不多、目标不同：一个靠校准保质量，一个靠码本省比特。选量化档位时，应该问的是"我的失败模式是什么"，而不是"哪个 BPW 更高"。而且请注意：**任何量化都是发布方的一次判断，不是中立的数学操作。** K_P 的"提一到两档"是发布方的说法，值得参考，也值得你自己验证。

**6. 学会读签名和哈希，是本地部署的基本素养。**
你不是从官方渠道下载权重，而是从无数个二次发布者手里下载。`SHA256SUMS` 加 Ed25519 签名是唯一能区分"这个文件确实来自声称的人、且没有被中途改过"的手段。同时也要清楚它的上限——**信任根仍然是那个仓库本身。**

**7. 把本地模型当私有算力，别当免费 Claude。**
它最大的价值在于三件事：数据不出本机、行为可复现（固定 seed 和量化）、以及不受 API 政策和价格变动影响。**它不该被当成"同等能力的平替"。** 27B 在这个时间点是很强的水平，但它和前沿闭源模型的差距是真实存在的，把它放在它擅长的位置——批量处理、隐私敏感任务、离线环境、可编程的 pipeline ——比拿它去硬碰硬更划算。

**8. 最后一点，关于"看完这篇文章你应该获得什么"。**
我不希望你记住"哪里要填 Q4_K_P"，而希望你记住第 1.2 节那个 `64 KiB/token` 是怎么算出来的、`-c` 为什么要除以 `-np`、以及 `--spec-draft-n-max` 为什么不是越大越好。**模型会换，架构会换，仓库会换，但推导方式不会。** 会推导的人永远能在新版本出来时自己找到那组参数，而只会抄命令的人每一代都得重新等一篇教程。

---

## 10. 一页速查

```text
选档：   24G→IQ4_XS/Q3_K_P  32G→Q4_K_P/Q5_K_P  48G+→Q6_K_P/Q8_K_P
上下文： 262144 是原生上限；16 层全注意力 ⇒ KV ≈ 64 KiB/token（f16）
         32K≈2G  64K≈4G  128K≈8G  256K≈16G
服务：   llama-server + --jinja 必开
思考：   默认开。日常用 --chat-template-kwargs '{"enable_thinking":false}'
采样：   思考 1.0/0.95/20/0/0/1.0   非思考 0.7/0.80/20/0/1.5/1.0
             temp/top_p/top_k/min_p/presence/repeat
加速：   先内嵌 MTP（--spec-type draft-mtp，无需补丁）
         再 FastMTP（+旁路 +--spec-draft-ngl all，需补丁构建）
OOM：    先降 -ub → 再降 -c → 再 -ctk/-ctv q8_0 → 最后才降量化位宽
校验：   sha256sum -c SHA256SUMS + openssl pkeyutl -verify
```

## 参考

- [HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF](https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF)（模型、manifest、补丁、基准数字的来源）
- [Qwen/Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B)（架构规格、采样推荐、YaRN 配置）
- [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)（本文所有参数名称与默认值以 `common/arg.cpp` 为准）
- [llama.cpp `docs/build.md`](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)（各后端构建参数）
- [llama.cpp `tools/mtmd/README.md`](https://github.com/ggml-org/llama.cpp/blob/master/tools/mtmd/README.md)（多模态 / mmproj）
- [ggml-org/llama.cpp PR #15293](https://github.com/ggml-org/llama.cpp/pull/15293)（context checkpoints，长上下文相关）
