---
title: '别再抱着 Dev-C++ 了：用 VS Code + MinGW-w64 从零配一套能调试的 C 语言环境'
description: '从编译器、编辑器、调试器的分工讲起，用 WinLibs 或 MSYS2 装好 MinGW-w64，再在 VS Code 里配出 tasks.json、launch.json、c_cpp_properties.json，最后处理中文编码、多文件编译和一堆新手常踩的坑。'
date: 2026-09-29
tags:
  - C
  - VS Code
  - MinGW
  - GCC
  - 环境配置
  - Windows
  - 教程
category: 教程
featured: false
draft: false
verifiedDate: 2026-09-29
difficulty: 入门
audience: 刚学 C 语言、还在用 Dev-C++ 的同学
hasCode: true
polished: true
---

先把话说明白：这篇文章不是要证明 Dev-C++ 十恶不赦。它体积小、双击就能写、第一节课能让人立刻看到 `Hello, World!`，这些都是真的。问题是它把**编辑器、编译器、调试器、构建系统**四件事捆成一个大黑盒，你在里面待四年，出来后依然不知道 `gcc` 在哪、编译参数是什么、程序崩了该怎么看栈。到了要装别的语言、要写多文件工程、要上 Linux 的那天，这些债会一起还。

所以这篇文章的目标不是"换一个更好用的 IDE"，而是**把 C 语言开发环境拆开让你看清楚，再重新组装一遍**。

内容和边界先说清楚：

- 默认环境是 **Windows 10 / 11，64 位**。macOS 和 Linux 的路线不同，本文不覆盖。
- 下面所有命令都在 **PowerShell** 或 VS Code 集成终端里执行，路径、目录名、软件版本以你实际下载到的为准。
- 不涉及竞赛用的在线评测、也不涉及 Visual Studio 那套 MSVC 工程，本文只走 **MinGW-w64 (GCC)** 路线，因为它和 Linux、和大多数教材、和 OJ 后台最接近。

---

## 0. 先给结论

如果你只想照着做、不想听原理，这一节就是完整清单。

| 步骤 | 做什么 | 关键点 |
| --- | --- | --- |
| 1 | 装 **MinGW-w64** | 推荐 WinLibs 免安装包，解压到 `C:\mingw64` |
| 2 | 把 `C:\mingw64\bin` 加进 **PATH** | 用图形界面改，别用 `setx` |
| 3 | 新开终端验证 | `gcc --version`、`gdb --version` 能出版本号 |
| 4 | 装 **VS Code** | 官网下载，安装时勾选"添加到 PATH" |
| 5 | 装扩展 **C/C++** | 扩展 ID：`ms-vscode.cpptools` |
| 6 | 建项目文件夹并写 `hello.c` | 路径**不要**有中文和空格 |
| 7 | 配 `.vscode/tasks.json` | 让 VS Code 调 `gcc` 编译 |
| 8 | 配 `.vscode/launch.json` | 让 `gdb` 能下断点调试 |
| 9 | 配 `.vscode/c_cpp_properties.json` | 消掉编辑器的红波浪线 |
| 10 | 处理中文编码 | 见第 7 节，别跳过 |

如果你现在打开的就是 Dev-C++，请先把它关掉——不是仪式感，是它可能占用着某个 `.exe`，导致你后面链接时报 `Permission denied`。

---

## 1. 先想清楚：你平时到底在跟几个程序打交道

这是整篇文章最重要的一节。Dev-C++ 之所以把人教糊涂，就是因为它把下面这些藏起来了。

| 角色 | 在本方案里是谁 | 它负责什么 | 你不装会怎样 |
| --- | --- | --- | --- |
| 编辑器 | VS Code | 打字、高亮、跳转、补全 | 没地方写代码 |
| 编译器 | `gcc`（MinGW-w64） | 把 `.c` 翻译成 `.exe` | VS Code 点了编译没反应 |
| 调试器 | `gdb` | 下断点、单步、看变量和调用栈 | 只能靠 `printf` 找 bug |
| 构建系统 | `mingw32-make` / VS Code tasks | 决定先编谁、后编谁、传什么参数 | 多个 `.c` 文件不知道怎么一起编 |

关键点在于：**VS Code 自己不会编译 C 语言**。它只是一个高级记事本，真正把代码变成程序的永远是 `gcc`。你在 VS Code 里按下的"运行"，本质上是它帮你敲了一行命令：

```text
gcc -g -Wall -std=c17 -o hello.exe hello.c
```

理解这一行，比记住任何快捷键都值钱。后面配 `tasks.json`，配的其实就是这一行的可视化版本。

顺带说一句，`gcc` 和 `g++` 的关系也值得知道：`gcc` 是 C 编译器，`g++` 是 C++ 编译器；在 Windows 上它们由同一套 MinGW-w64 提供。你用 `gcc` 编译 `.c` 文件时，它按 C 规则处理；链接 C++ 程序时要用 `g++`，否则可能缺标准库符号。

---

## 2. 为什么是 MinGW-w64，而不是别的

Windows 上装 C 编译器，绕不开三个选择。

| 方案 | 是什么 | 优点 | 为什么本文不选它 |
| --- | --- | --- | --- |
| **MSVC**（`cl.exe`） | Visual Studio 自带编译器 | 和 Windows 贴合最好，性能优化强 | 装 Visual Studio 动辄十几 GB，参数风格和教材、OJ 完全不同 |
| **Clang / LLVM** | 苹果主推的 LLVM 前端 | 报错信息友好，工具链现代 | Windows 上原生配置略麻烦，对新手性价比不高 |
| **MinGW-w64**（GCC） | 把 GCC 移植到 Windows 上 | 命令行和 Linux 一模一样，轻量、免费、和教材一致 | 就是本文的选择 |

还有一个特别容易踩的历史坑：**MinGW-w64 不是老的 MinGW**。

- 老的那个叫 **MinGW**（mingw.org），停在很老的 GCC 版本，只支持 32 位，已基本不再更新。
- 现在活跃的是 **MinGW-w64**，支持 64 位、更新频繁，两个发行版名字差一点点，搜索引擎经常把你带到前一个。

所以无论从哪下载，认准名字里带 **`mingw-w64`**、架构是 **`x86_64`** 的包。另外，装完之后你在 `bin` 目录里看到的编译器名字可能是 `x86_64-w64-mingw32-gcc.exe`，`gcc` 只是它的一个快捷副本，不用担心。

---

## 3. 装 MinGW-w64

### 3.1 方案 A：WinLibs 免安装包（最推荐）

这是本文的主路线，因为它**不用安装、不写注册表、卸载就是删文件夹**，最适合学生。

1. 打开 [winlibs.com](https://winlibs.com/)。
2. 找到 "Download" 里最新的一行，下载 64 位、带 `UCRT` 的那个 zip 或 7z 包。

WinLibs 的文件名信息量很大，看懂它你就不会下错：

```text
winlibs-x86_64-posix-seh-gcc-15.2.0-mingw-w64ucrt-13.0.0-r1.zip
        └────┬────┘└─┬──┘└┬─┘└────┬─────┘└────────┬────────┘
           CPU 架构  线程  异常   GCC 版本     运行时/发行版
```

| 字段 | 取值 | 怎么选 |
| --- | --- | --- |
| CPU 架构 | `x86_64` | 现在都选 64 位 |
| 线程模型 | `posix` / `win32` | 选 `posix`，对 C++ 标准库和线程更友好 |
| 异常处理 | `seh` | 64 位选 `seh`；`dwarf` / `sjlj` 是 32 位的老方案 |
| 运行时 | `ucrt` / `msvcrt` | 选 `ucrt`，是 Windows 10 之后的现代 C 运行库 |
| 版本号 | `gcc-15.x` | 越新越好，但不必追最新，能用就行 |

3. 解压。你会得到一个叫 `mingw64` 的文件夹，里面有 `bin`、`lib`、`include` 等子目录。
4. 把它整个移动到一个**没有中文、没有空格**的位置，固定下来：

```text
C:\mingw64\
├── bin\        ← gcc.exe / g++.exe / gdb.exe / mingw32-make.exe 都在这里
├── include\
├── lib\
└── ...
```

路径别放在桌面或下载文件夹里。桌面路径通常长这样：`C:\Users\你的名字\Desktop\...`。如果你的 Windows 用户名是中文，那整条路径里就带了中文，这会给某些工具链带来莫名其妙的错误。**直接放 `C:\mingw64` 最省事。**

### 3.2 方案 B：MSYS2（想要包管理器就选它）

如果你更喜欢 Linux 那种"一条命令装好、一条命令升级"的体验，用 MSYS2。它自带 `pacman` 包管理器，GCC 更新得也勤。

1. 从 [msys2.org](https://www.msys2.org/) 下载安装包并安装，默认路径是 `C:\msys64`。
2. 打开开始菜单里的 **MSYS2 UCRT64** 终端（注意不是那个普通的 "MSYS2 MSYS"）。
3. 执行：

```bash
pacman -Syu
# 如果提示要关掉终端重新打开，就关掉重开，再执行一次
pacman -S mingw-w64-ucrt-x86_64-toolchain
```

一路回车确认，它会把 `gcc`、`g++`、`gdb`、`make` 全套装上。
4. 你要加进 PATH 的目录是 **`C:\msys64\ucrt64\bin`**，而不是 `C:\msys64\mingw64\bin`，也不是 `C:\msys64\usr\bin`。

这里有个 MSYS2 的经典误区：`C:\msys64\usr\bin` 里的程序跑在 MSYS2 自己模拟的类 Unix 环境里，编译出来的 exe 可能依赖 `msys-2.0.dll`，拿到别的电脑上就跑不了。`ucrt64\bin` 里的是原生 Windows 程序，才是我们要的。

### 3.3 方案 C：winget / scoop（可选）

如果你已经在用包管理器，可以图个省事。VS Code 和 MSYS2 的包名比较稳定：

```powershell
winget install Microsoft.VisualStudioCode
winget install MSYS2.MSYS2
```

WinLibs 的 winget 包名各版本可能不同，先搜再装，别照抄：

```powershell
winget search winlibs
```

scoop 用户可以考虑 `scoop install mingw`。不过说实话，对新手我更建议**第一次手动走一遍方案 A**，你会亲身知道 `gcc.exe` 住在哪里，这对后面排查问题帮助极大。

---

## 4. 把 bin 目录加进 PATH

PATH 是 Windows 找程序时的一份"地址簿"：你在终端敲 `gcc`，系统就去 PATH 里列的每个目录挨个找 `gcc.exe`。没加 PATH，你只能傻乎乎地敲全路径 `C:\mingw64\bin\gcc.exe`。

**用图形界面改，别用命令行。** 这不是保守，是因为 `setx PATH "%PATH%;C:\mingw64\bin"` 这种写法有两个致命问题：一是 `setx` 会把结果截断在 1024 个字符，长 PATH 直接损坏；二是它把系统 PATH 和用户 PATH 混在一起，容易出乱子。网上很多教程至今还在教这行命令，请无视。

正确做法：

1. 按 `Win` 键，搜索 **"编辑系统环境变量"** 并打开。
2. 点 **"环境变量"** 按钮。
3. 在**上半部分**的"用户变量"里找到 `Path`，选中，点 **"编辑"**。
4. 点 **"新建"**，粘贴：

```text
C:\mingw64\bin
```

5. 一路"确定"关掉所有对话框。

> 小提示：填进"用户变量"就够了，不需要管理员权限，也不需要动"系统变量"。

**加完 PATH 必须新开终端。** 已经开着的终端和 VS Code 读的是旧 PATH，不重启看不到新程序。这一步不照做，你会得到全网最常见的那个报错：

```text
gcc : 无法将“gcc”项识别为 cmdlet、函数、脚本文件或可运行程序的名称。
```

---

## 5. 验证编译器装好了没有

**新开**一个 PowerShell 窗口，逐条执行：

```powershell
gcc --version
g++ --version
gdb --version
where.exe gcc
```

前三条应该各自打印出版本信息，`where.exe gcc` 应该指向你刚加的目录：

```text
C:\mingw64\bin\gcc.exe
```

如果 `where.exe gcc` 指向了别的地方（比如某个你没听说过的目录），说明系统里还有另一套 GCC，PATH 里它的优先级更高，后面会用到错的那个。把它的目录从 PATH 里删掉，或者把你的目录往上挪。

到这里，**编译器和调试器已经就位了**。请先别急着装 VS Code——先在纯命令行里编一个程序，确认环境本身没问题，这一步能帮你在出问题时快速定位是"环境坏了"还是"VS Code 配错了"。

建一个测试目录，写一个文件：

```powershell
mkdir C:\code\hello
cd C:\code\hello
notepad hello.c
```

内容：

```c
#include <stdio.h>

int main(void) {
    printf("Hello, C!\n");
    return 0;
}
```

编译并运行：

```powershell
gcc -std=c17 -Wall -Wextra -g -o hello.exe hello.c
.\hello.exe
```

看到 `Hello, C!` 就说明你的工具链完全正常。记住这行编译命令，它就是后面 `tasks.json` 的真身。

---

## 6. 装 VS Code 和 C/C++ 扩展

从 [code.visualstudio.com](https://code.visualstudio.com/) 下载安装。安装向导里有两个勾建议打上：

- **"添加到 PATH"**：这样你才能在终端里敲 `code .` 打开当前目录。
- **"将'通过 Code 打开'操作添加到 Windows 资源管理器目录上下文菜单"**：右键文件夹直接开，很顺手。

装完后打开扩展面板（`Ctrl+Shift+X`），搜索并安装：

| 扩展 | ID | 作用 |
| --- | --- | --- |
| **C/C++** | `ms-vscode.cpptools` | IntelliSense、错误检查、调试集成 |
| **Chinese (Simplified)** | `ms-ceintl.vscode-language-pack-zh-hans` | 可选，界面中文化 |
| **Code Runner** | `formulahendry.code-runner` | 可选，一键运行，但**别依赖它** |

用命令行装 C/C++ 扩展也可以：

```powershell
code --install-extension ms-vscode.cpptools
```

关于 Code Runner 多说一句：它确实能让你一键运行，但它把编译命令藏得更深，报错信息也难看。对新手来说，**先把 `tasks.json` 配好、理解 `Ctrl+Shift+B` 和 `F5`，比装十个一键运行插件都值**。等你完全懂原理了，再装它图省事不迟。

---

## 7. 第一个真正的工程

### 7.1 建目录、打开、写代码

```powershell
mkdir C:\code\c-course
cd C:\code\c-course
code .
```

`code .` 会用 VS Code 打开这个文件夹。**注意：是"打开文件夹"，不是"打开单个文件"。** 只有打开文件夹，VS Code 才会在 `.vscode` 子目录里读取你的配置；如果你只是双击一个 `.c` 文件，配置不会生效，这是新手最常犯的错之一。

在文件面板里新建 `hello.c`：

```c
#include <stdio.h>

int main(void) {
    printf("Hello, C!\n");
    return 0;
}
```

然后点击菜单 **终端 → 配置默认生成任务**，在弹出的列表里选 **"C/C++: gcc.exe 生成活动文件"**。VS Code 会自动生成一个 `.vscode/tasks.json`。它会问你"找不到预定义任务"吗？不用管，下面我们直接把它改成更好用的版本。

### 7.2 `tasks.json`：让 VS Code 调用 gcc

把 `.vscode/tasks.json` 的内容换成下面这样：

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "type": "shell",
      "command": "gcc",
      "args": [
        "-fdiagnostics-color=always",
        "-std=c17",
        "-Wall",
        "-Wextra",
        "-g",
        "-o",
        "${fileDirname}\\${fileBasenameNoExtension}.exe",
        "${file}"
      ],
      "options": {
        "cwd": "${fileDirname}"
      },
      "problemMatcher": ["$gcc"],
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "detail": "编译当前打开的这个 .c 文件"
    },
    {
      "label": "run",
      "type": "shell",
      "command": "\"${fileDirname}\\${fileBasenameNoExtension}.exe\"",
      "options": {
        "cwd": "${fileDirname}"
      },
      "dependsOn": "build",
      "problemMatcher": []
    }
  ]
}
```

这里出现的 `${...}` 是 VS Code 的变量，理解它们很重要：

| 变量 | 含义 | 在 `C:\code\c-course\hello.c` 上 |
| --- | --- | --- |
| `${file}` | 当前文件的完整路径 | `C:\code\c-course\hello.c` |
| `${fileDirname}` | 文件所在目录 | `C:\code\c-course` |
| `${fileBasename}` | 带扩展名的文件名 | `hello.c` |
| `${fileBasenameNoExtension}` | 不带扩展名的文件名 | `hello` |
| `${workspaceFolder}` | 打开的文件夹根目录 | `C:\code\c-course` |

所以 `${fileDirname}\\${fileBasenameNoExtension}.exe` 拼出来的就是 `C:\code\c-course\hello.exe`。

现在按 `Ctrl+Shift+B` 执行默认生成任务。底部终端里会出现完整的编译命令和结果，成功后目录里会多出 `hello.exe`。

要运行它，按 `Ctrl+Shift+P` 打开命令面板，输入 `Tasks: Run Task`，选 `run`。或者干脆继续往下配调试，`F5` 一步到位。

如果编译报错，`problemMatcher: ["$gcc"]` 会把 gcc 的错误解析出来，显示在"问题"面板里，点一下就能跳到出错的行。这就是现代编辑器比 Dev-C++ 强的地方之一。

### 7.3 `launch.json`：把 gdb 接进来

按 `F5` 或者点左侧的"运行和调试"图标，选择 **"C++ (GDB/LLDB)"**，VS Code 会生成 `launch.json`。改成这样：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "调试当前文件 (gdb)",
      "type": "cppdbg",
      "request": "launch",
      "program": "${fileDirname}\\${fileBasenameNoExtension}.exe",
      "args": [],
      "stopAtEntry": false,
      "cwd": "${fileDirname}",
      "environment": [],
      "console": "integratedTerminal",
      "MIMode": "gdb",
      "miDebuggerPath": "C:/mingw64/bin/gdb.exe",
      "setupCommands": [
        {
          "description": "为 gdb 启用整齐打印",
          "text": "-enable-pretty-printing",
          "ignoreFailures": true
        }
      ],
      "preLaunchTask": "build"
    }
  ]
}
```

几个必须解释的字段：

- `"preLaunchTask": "build"`：按 `F5` 时，**先执行 `tasks.json` 里 label 为 `build` 的任务**再启动调试。所以每改一次代码按 `F5`，都会自动重新编译，不会运行旧程序。这个字段是新手配置里最容易漏的，漏了就会"我明明改了代码，怎么还在跑旧结果"。
- `"miDebuggerPath": "C:/mingw64/bin/gdb.exe"`：告诉 VS Code 用哪个 gdb。**路径要写成正斜杠 `/`，或者写成双反斜杠 `\\`**。如果你的 MinGW 装在别的位置，这里要跟着改。写成这样而不是只写 `gdb.exe`，是为了避免 PATH 没生效时找不到。
- `"console": "integratedTerminal"`：让程序的输入输出走 VS Code 的集成终端，这样 `scanf` 才能真正读到你的键盘输入。如果你用的是旧版 cpptools 且这个字段不生效，就改成 `"externalConsole": true`，程序会单独弹一个控制台窗口。
- `"stopAtEntry": false`：不在 `main` 第一行自动停下。想一进来就停，改成 `true`。

### 7.4 `c_cpp_properties.json`：消掉红波浪线

如果代码能编译，但 `#include <stdio.h>` 下面有条红波浪线，或者 `printf` 显示"未定义标识符"，那是 **IntelliSense** 的问题，不是编译器的问题。按 `Ctrl+Shift+P`，执行 `C/C++: Edit Configurations (JSON)`，把内容改成：

```json
{
  "configurations": [
    {
      "name": "Win32",
      "includePath": ["${workspaceFolder}/**"],
      "defines": [],
      "compilerPath": "C:/mingw64/bin/gcc.exe",
      "cStandard": "c17",
      "cppStandard": "c++17",
      "intelliSenseMode": "windows-gcc-x64"
    }
  ],
  "version": 4
}
```

关键就两行：`compilerPath` 指向你的 `gcc.exe`，`intelliSenseMode` 设成 `windows-gcc-x64`。设好之后，VS Code 会直接问 gcc"你的头文件都在哪"，自动推导出所有 include 路径，比手动一条条列 `includePath` 靠谱得多。

### 7.5 配完之后目录长这样

```text
C:\code\c-course\
├── .vscode\
│   ├── tasks.json              ← 怎么编译
│   ├── launch.json             ← 怎么调试
│   └── c_cpp_properties.json   ← 怎么补全
├── hello.c
└── hello.exe                   ← 编译产物，一般加进 .gitignore
```

如果这个工程要提交到 git，`.vscode/` **建议提交**，这样别人拉下来就有同样的配置；`*.exe` 和 `*.o` 则应该写进 `.gitignore`，它们是编译产物，不该进版本库。

---

## 8. 中文乱码：原因和解法

这是新手问得最多的问题，值得单独一节。

**原因一句话：你保存的源文件是 UTF-8 编码，但 Windows 传统控制台默认按 GBK 解码，两边对不上，于是"你好"变成"浣犲ソ"。**

正确做法是让**输出的字节**和**控制台的期待**一致。有三种解法，从推荐到不推荐：

**方案一：编译时指定执行字符集（最稳，推荐）**

在 `tasks.json` 的 `args` 里，把 `-g` 那一行附近改成：

```json
"args": [
  "-fdiagnostics-color=always",
  "-std=c17",
  "-Wall",
  "-Wextra",
  "-g",
  "-finput-charset=UTF-8",
  "-fexec-charset=GBK",
  "-o",
  "${fileDirname}\\${fileBasenameNoExtension}.exe",
  "${file}"
]
```

含义：源代码按 UTF-8 读入（`-finput-charset`），字符串常量按 GBK 输出（`-fexec-charset`）。这样 gcc 吐出的字节正好是 GBK 控制台期望的格式，中文就正常了。

**方案二：把控制台切到 UTF-8**

在程序开头加一行：

```c
#include <stdlib.h>

int main(void) {
    system("chcp 65001 > nul");
    printf("你好，世界！\n");
    return 0;
}
```

或者只在你自己的终端里手动执行一次 `chcp 65001`。缺点是这个设置只对当前终端会话有效，而且某些老编译器/字体在 65001 下反而会出别的怪问题。

**方案三：让 VS Code 用 UTF-8 保存（必须做）**

无论选上面哪个方案，源文件都应该是 UTF-8。看一眼 VS Code 右下角状态栏，如果显示 `GBK` 或 `Windows-1252`，点它 → **"通过编码保存"** → 选 `UTF-8`。

> 从 Dev-C++ 迁移过来的老文件要特别注意：Dev-C++ 默认存 GBK，直接拖进 VS Code 中文注释可能全是乱码。正确流程是点右下角编码 → **"通过编码重新打开"** → 选 `GBK`，确认注释正常显示后，再 **"通过编码保存"** 成 `UTF-8`。直接改编码再保存会把原本正确的内容也毁掉。

---

## 9. 那些编译参数到底在干什么

搞懂这一节，你就不再是"参数复制机"了。

| 参数 | 作用 | 为什么用它 |
| --- | --- | --- |
| `-std=c17` | 指定 C 标准 | 明确用哪个标准。Dev-C++ 默认标准经常老得离谱，很多新语法直接不认 |
| `-Wall` | 打开常见警告 | 它能提前揪出未初始化变量、函数没返回值、`=` 和 `==` 写反等问题 |
| `-Wextra` | 打开更多警告 | 在 `-Wall` 基础上补一些边角警告，写作业够用了 |
| `-Werror` | 把警告当错误 | 严苛模式，逼自己写出干净代码；初学阶段可以先不开 |
| `-g` | 生成调试信息 | **调试必须有它**，否则 gdb 看不到行号、变量名 |
| `-O0` / `-O2` | 优化等级 | 调试用 `-O0`（默认），发布用 `-O2`；**别用 `-O2` 调试**，变量可能被优化没 |
| `-o 名字` | 指定输出文件名 | 不写的话默认生成 `a.exe`，你会在目录里看到一堆同名文件 |
| `-fexec-charset=GBK` | 执行字符集 | 见上一节，解决中文乱码 |

一个很实在的建议：**把 `-Wall -Wextra` 常开。** 学校里很多 bug（数组越界、忘记 `return`、`scanf` 传错指针）gcc 早就替你指出来了，只是 Dev-C++ 默认没把警告当回事，你从来没看见。

C 标准的选择上，日常写作业用 `-std=c17`（也叫 `-std=c18`）就够了。如果你在学 C++，把 `gcc` 换成 `g++`、`-std=c17` 换成 `-std=c++17` 或更新，其余参数含义完全一样。

---

## 10. 调试：这才是换环境的真正理由

新建 `debug.c`，写一段"故意有 bug"的代码练手：

```c
#include <stdio.h>

int main(void) {
    int sum = 0;
    for (int i = 1; i <= 5; i++) {
        sum += i;
    }
    printf("sum = %d\n", sum);
    return 0;
}
```

打开这个文件，在 `sum += i;` 那一行左侧的行号**左边**点一下，会出现一个红点，这就是**断点**。然后按 `F5` 启动调试。

VS Code 会在断点处停下，并在左侧打开一个面板，上面是变量值、下面是调用栈。常用快捷键：

| 操作 | 快捷键 | 含义 |
| --- | --- | --- |
| 开始 / 继续调试 | `F5` | 启动，或从断点继续跑到下一个断点 |
| 切换断点 | `F9` | 在当前行加/去断点 |
| 单步跳过 | `F10` | 执行这一行，遇到函数调用不进去 |
| 单步进入 | `F11` | 执行这一行，遇到函数调用就进去 |
| 单步跳出 | `Shift+F11` | 从当前函数返回上一层 |
| 停止调试 | `Shift+F5` | 结束 |

在"监视"面板里输入 `i`、`sum`，每按一次 `F10`，你就能看到 `i` 从 1 变到 5、`sum` 怎么一格格累加。**这就是断点调试：让程序在指定位置暂停，把那一刻的内部状态摊开给你看。** Dev-C++ 也有调试器，但它的 gdb 版本老、界面经常卡死，很多人最后干脆放弃，只靠满屏 `printf` 猜。学会这套之后，你排查段错误、数组越界、循环少跑一圈这类问题的速度会完全不一样。

两个实用技巧：

- **调试前不要用 `-O2`。** 优化会重排代码、删掉"没用到"的变量，你会看到值跳动甚至"变量不存在"。调试就用 `-g -O0`。
- **程序崩溃时看调用栈。** 段错误（Segmentation fault）发生时，左侧调用栈会告诉你是在哪个函数、哪一行炸的，从最上面那一层往里看，通常就是问题所在。

---

## 11. 多个 `.c` 文件怎么编译

上面的 `tasks.json` 只编译**当前打开的一个文件**。一旦你写了 `main.c`、`list.c`、`stack.c` 三个文件，就会遇到 `undefined reference to 'push'` 之类的链接错误——因为 gcc 根本不知道另外两个文件的存在。

有两种解决方式。

**方式一：临时在 tasks 里用通配符**

把 `"${file}"` 换成：

```json
"${fileDirname}\\*.c"
```

MinGW 的运行时支持通配符展开，能把目录下所有 `.c` 一起编译。缺点是每次全量重编、顺序不受控，文件一多就慢，而且会连带把练习用的其他 `main` 也编进去，导致 `multiple definition of 'main'`。**只适合临时验证，不建议长期用。**

**方式二：写 Makefile（推荐）**

在项目根目录建一个名为 `Makefile` 的文件（**注意文件名前面没有 `.c`，也没有扩展名**）：

```make
CC      = gcc
CFLAGS  = -std=c17 -Wall -Wextra -g
TARGET  = app.exe
SRCS    = $(wildcard *.c)
OBJS    = $(SRCS:.c=.o)

$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) -o $@ $(OBJS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	del /Q *.o $(TARGET) 2>nul
```

两个坑先提醒：`$(CC)` 那两行**必须以 Tab 开头，不能是空格**，这是 Makefile 的硬性要求；`clean` 里用的是 Windows 的 `del` 命令。

然后执行：

```powershell
mingw32-make
```

它会先编译各文件为 `.o`，再链接成 `app.exe`。改了一个 `.c`，下次只重编那一个，其余复用，这就是构建系统存在的意义。在 VS Code 里把 `tasks.json` 的 `command` 从 `gcc` 改成 `mingw32-make`、`args` 改成 `[]`，就能一键构建整个工程。

> 如果你在 MSYS2 环境里，make 的名字是 `make` 而不是 `mingw32-make`，两者是同一个东西。

最后强调一个坏习惯：**不要为了省事在 `main.c` 里 `#include "list.c"`。** 那样确实"能跑"，但它绕过了链接器，会导致重复定义、编译单元混乱，工程一大必然翻车。正确做法是头文件声明、源文件实现，交给链接器去拼。

---

## 12. 常见问题排查

按"你怎么描述这个错"来找。

| 现象 | 大概原因 | 怎么修 |
| --- | --- | --- |
| `gcc : 无法将"gcc"项识别为...` | PATH 没加，或终端没重开 | 确认 `C:\mingw64\bin` 在 PATH 里，**关掉并重开**终端和 VS Code |
| `where.exe gcc` 指到别的目录 | 系统里有第二套 GCC，优先级更高 | 从 PATH 删掉旧目录，或把你的目录上移 |
| 编译通过，但运行窗口一闪而过 | 直接双击了 exe | 用集成终端运行，或按 `F5` |
| 中文输出是 `ä½ å¥½` 这类乱码 | 源文件 UTF-8，控制台 GBK | 见第 8 节，加 `-fexec-charset=GBK` 或 `chcp 65001` |
| 中文注释也乱码 | 文件本身是 GBK，被按 UTF-8 解码 | 右下角"通过编码重新打开"→ GBK，再另存为 UTF-8 |
| 红波浪线，但明明能编译 | IntelliSense 找不到头文件 | 检查 `c_cpp_properties.json` 的 `compilerPath` 和 `intelliSenseMode` |
| `undefined reference to 'xxx'` | 链接阶段：函数声明了但没实现，或对应 `.c` 没参与编译 | 把实现所在的 `.c` 加进构建，或检查拼写和 `static` |
| `multiple definition of 'main'` | 目录里多个 `.c` 都有 `main`，被一起编了 | 单独编译目标文件，或用 Makefile 明确源文件列表 |
| `ld.exe: cannot open output file ...: Permission denied` | 上一次的 exe 还在运行，被杀软/系统锁住 | 关掉运行中的窗口和调试会话，再重编 |
| `preLaunchTask "build" terminated with exit code 1` | 编译失败，`F5` 前先修编译错误 | 看"问题"面板里 gcc 的具体报错 |
| `Unable to start debugging... miDebuggerPath is invalid` | gdb 路径写错 | 改成正确的 `C:/mingw64/bin/gdb.exe` |
| 调试时变量显示"已优化掉" | 用了 `-O2` | 调试配置里改成 `-O0` |
| `scanf` 运行后卡住 / 读不到输入 | 调试控制台不接 stdin | `launch.json` 里设 `"console": "integratedTerminal"` 或 `"externalConsole": true` |
| 杀毒软件报毒 / 编译被拦 | MinGW 的 gdb、gcc 被误报 | 把 `C:\mingw64` 加进杀软白名单 |
| 换行符在 git 里满屏红 | Windows 是 CRLF，仓库是 LF | 配 `.gitattributes` 或 `git config core.autocrlf` |

一个通用心法：**先命令行、后 VS Code。** 出问题时，先直接在终端里手敲那行 `gcc` 命令。如果命令行也失败，那就是环境问题；如果命令行成功而 VS Code 失败，那一定是你 `.vscode` 里的配置有问题。这一招能省掉大量猜测。

---

## 13. 如果学校就是强制你用 Dev-C++

先把事实摆清楚：**C 语言没有"Dev-C++ 版本"和"VS Code 版本"之分，编译器只认 C 标准，不认编辑器。** 你交的是 `.c` 源文件，老师拿任何编译器都能评。所谓"必须用 Dev-C++"，绝大多数时候只是老师图省事、或者他默认你不会配环境。

所以务实的做法是：

- **交作业、上机考试**：按学校要求来，该用 Dev-C++ 就用，别跟分数过不去。
- **自己写代码、做项目、准备以后接 Linux**：用本文这套。它和课程内容完全不冲突，只会让你学得更顺。
- 如果你被要求交可执行文件，注意 Dev-C++ 默认生成的是 32 位程序，而本方案默认 64 位；一般都能跑，但拿去某些老机器上要注意。
- 实在想推荐给老师：可以告诉他 Dev-C++ 自带 GCC 版本过老、默认 C 标准陈旧、调试器经常崩，学生用现代环境对教学只有好处。

工具是为学习服务的，不是反过来。你花一个下午配好这套环境，换来的是往后几年写任何语言都受用的**编译器 + 编辑器 + 调试器**通用认知，这笔账怎么算都划算。

---

## 14. 最后对照一遍

装完请逐条打勾：

- [ ] 新终端里 `gcc --version`、`g++ --version`、`gdb --version` 都能出版本号
- [ ] `where.exe gcc` 指向你安装的目录
- [ ] 命令行里能手动编译并运行 `hello.exe`
- [ ] VS Code 能通过 `Ctrl+Shift+B` 编译当前文件
- [ ] `F5` 能启动调试，断点能停下，变量面板能看到值
- [ ] `printf` 的中文不乱码
- [ ] `scanf` 能从集成终端读到输入
- [ ] 知道 `.vscode` 三个文件各自负责什么

全打上勾，你就正式离开那个黑盒了。

以后你会碰到 `clang`、`cmake`、`ninja`、`WSL`、`Docker`，但底层那件事永远不变：**有人写代码，有人把代码翻译成机器指令，有人让程序在出错时停下来给你看。** 今天你只是第一次亲手把这三个人请到同一张桌子上而已。
