# agenthub (CLI: `ahub`)

<p align="center">
  <b>English</b> | <a href="#-简体中文">简体中文</a>
</p>

A lightweight, zero-bloat CLI dashboard designed for concurrently running and comparing multiple AI Agent CLIs (such as Claude Code, Aider, OpenCode, Agy, Python Agents, etc.) side by side.

---

## ✨ Features

- **Three Parallel Independent Windows**: Equal-width 3-column layout with high-contrast theme. Each window embeds a full pseudo-terminal (PTY + xterm.js) supporting ANSI true-color, progress bars, and interactive prompts (e.g. `[y/N]` selections, arrow-key navigation). Default presets include **codex**, **claude**, and **opencode**.
- **One-Click & Selection Copy**: Each window header includes a `📋 Copy` button to copy selected text or the entire terminal output directly to the system clipboard (ANSI color escape codes automatically stripped); also supports selecting text and pressing `⌘ + C` without triggering terminal interrupt signals.
- **Dedicated Slot Input**: Each window has its own bottom input box and send button. Press `Enter` to send and automatically execute in the target agent (optimized for terminal TUIs like Codex, Claude, etc.).
- **Shared Broadcast Input**: A bottom broadcast input bar allows selecting target agents (with select all / deselect all). Press **`Enter`** to send directly (`Shift + Enter` for newline) or **`⌘ + Enter`** to broadcast and auto-execute across all selected running agents simultaneously.
- **Rich Presets & Custom Commands**: Built-in presets for common AI tools (**codex**, **claude**, **opencode**, **agy**, **gemini**, **aider**, **zsh**, **python**, etc.) with support for any custom CLI command.
- **Quick History**: The broadcast input automatically remembers recent prompts—click any history pill to quickly reload it.
- **100% Local & Offline**: Terminal assets are completely bundled locally without external network or npm build dependencies.

---

## 📦 Installation

### Method 1: Install directly via pip from GitHub

```bash
pip install git+https://github.com/Goiachor/agenthub.git
```

### Method 2: Clone and editable install

```bash
git clone https://github.com/Goiachor/agenthub.git
cd agenthub
pip install -e .
```

---

## 🚀 Usage

Once installed, simply run the **`ahub`** command in your terminal:

```bash
# Start in current working directory (opens browser automatically)
ahub

# Custom port
ahub --port 9000

# Specify working directory for the agents
ahub --dir /path/to/your/project

# Headless / remote server mode (do not open browser)
ahub --no-browser

# View all options
ahub --help
```

### Alternative: Run without installation

```bash
./run.sh
# or
python3 server.py
```

---

## 🖥 User Guide

### 1. Window Controls (Agent 1 / Agent 2 / Agent 3)
- **Select or Enter Command**: Enter any command in the input box (e.g. `codex`, `claude`, `opencode`), or pick from the preset dropdown.
- **Start / Stop**: Click `▶ Start` to launch the process; when active, the button becomes a red `⏹ Stop`.
- **Copy**: Click `📋 Copy` to copy the selected text, or copy all clean terminal text if nothing is selected.
- **Interrupt Response**: Click `🛑 Interrupt` (or press `Esc` / `Ctrl+C`) at any time to interrupt lengthy model outputs and return to prompt state.
- **Clear**: Click `⌫` to clear the terminal display for that window.
- **Dedicated Input**: Type in the window's bottom input bar and press `Enter` to send to that agent.

### 2. Broadcast Input Bar (Bottom)
- **Consecutive Prompting**: Uses text injection + asynchronous return events to ensure 100% reliable execution across consecutive questions.
- **Target Selection**: Check or uncheck target agents (Agent 1, Agent 2, Agent 3); running status tags update in real-time.
- **Shared Prompt**: Enter multi-line prompts easily.
- **One-Key Send**: Press **`Enter`** to send (`Shift + Enter` for newline), or press **`⌘ + Enter`** (Mac) / **`Ctrl + Enter`** (Windows/Linux), or click `🚀 Broadcast to Selected Agents`.
- **Interrupt All**: Top bar provides `🛑 Interrupt All` to stop outputs across all running agents at once.
- **History**: Sent prompts appear in the "History" bar below the textarea; click to reload.

### 3. Top Global Controls
- **▶ Start All**: Concurrently launches all configured agents.
- **⏹ Stop All**: Stops all running agents at once.
- **⌫ Clear All**: Clears the terminal screens across all 3 windows.

---

## 📁 Directory Structure

```text
agenthub/
├── pyproject.toml         # Packaging configuration and 'ahub' CLI entrypoint
├── MANIFEST.in            # Package manifest for static asset inclusion
├── LICENSE                # MIT License
├── README.md              # Project documentation
├── requirements.txt       # Python dependencies (tornado)
├── run.sh                 # Quick launch script
├── server.py              # Backward-compatible launcher
└── ahub/                  # Python package
    ├── __init__.py        # Package init & version
    ├── server.py          # Backend server (PTY process manager, WebSocket)
    └── static/            # Frontend assets bundled with package
        ├── index.html     # Main dashboard UI
        ├── style.css      # Terminal styles
        ├── app.js         # Multi-terminal coordination logic
        ├── xterm.js       # Offline terminal engine
        ├── xterm.css      # Terminal styles
        └── xterm-addon-fit.js
```

---
---

# 🇨🇳 简体中文

<p align="center">
  <a href="#agenthub-cli-ahub">English</a> | <b>简体中文</b>
</p>

专为同时运行与对比多个 AI Agent CLI（如 Claude Code, Aider, OpenCode, Agy, Python Agent 等）设计的轻量级、无冗余并列控制台。

---

## ✨ 核心功能

- **三个并列独立窗口**：三栏等宽布局，纯白高对比主题，每个窗口内嵌完整的伪终端（PTY + xterm.js），支持 ANSI 真彩色、进度条、交互式问答（如 `[y/N]` 选择、方向键选择等）。默认预置 **codex**、**claude**、**opencode**。
- **一键复制与划选复制**：每个窗口顶部配备 `📋 Copy` 按钮，点击一键提取终端文本/选中内容到系统剪贴板（自动清洗 ANSI 颜色转义代码）；支持终端内划选按 `⌘ + C` 复制，不再受终端中断信号干扰。
- **独立专属输入框**：每个窗口底部配备单体输入框与发送按钮，输入指令按 `Enter` 发送并自动回车执行（针对 Codex、Claude 等终端 TUI 优化）。
- **共用广播输入框**：底部提供全局共用提示词输入框，可自由勾选目标 Agent（支持全选/反选）。支持按 **`Enter` 直接发送**（`Shift + Enter` 换行）或 **`⌘ + Enter`** 一键同时分发并自动回车执行至所有勾选且运行中的 Agent。
- **丰富的预设与自定义命令**：提供常用智能体预设（**codex**、**claude**、**opencode**、**agy**、**gemini**、**aider**、**zsh**、**python** 等），并支持任意自定义命令。
- **快捷历史记忆**：共用输入框自动记录近期分发的 Prompt，点击历史标签即可快速回填。
- **纯本地运行，离线可用**：前端终端资源完全本地内置，无需依赖外部网络或 npm 构建流程。

---

## 📦 安装说明

### 方式 1：直接通过 GitHub 使用 pip 安装（推荐）

```bash
pip install git+https://github.com/Goiachor/agenthub.git
```

### 方式 2：克隆源码后本地可编辑安装

```bash
git clone https://github.com/Goiachor/agenthub.git
cd agenthub
pip install -e .
```

---

## 🚀 启动与使用

安装完成后，在终端任意目录下直接运行 **`ahub`** 命令即可：

```bash
# 在当前工作目录启动（会自动打开浏览器）
ahub

# 指定自定义端口
ahub --port 9000

# 指定 Agent 的初始工作目录
ahub --dir /path/to/your/project

# 无头/远程服务器模式（不自动打开浏览器）
ahub --no-browser

# 查看全部支持参数
ahub --help
```

### 免安装直接运行方式

```bash
./run.sh
# 或
python3 server.py
```

---

## 🖥 界面操作指南

### 1. 窗口操作 (Agent 1 / Agent 2 / Agent 3)
- **选择或输入命令**：可在输入框直接键入命令（如 `codex`、`claude`、`opencode`），或使用下拉框快速填充预设。
- **启动 / 停止**：点击 `▶ Start` 运行进程；运行时按钮自动变为红色的 `⏹ Stop`。
- **一键复制**：点击 `📋 Copy`，优先复制当前鼠标划选的高亮内容；若未划选则一键复制该窗口当前的全部文本（已自动清洗掉 ANSI 颜色代码），并提示复制成功。
- **中断当前回答**：点击 `🛑 Interrupt`（或按下 `Esc` / `Ctrl+C`），可随时中断智能体长时间的生成状态，立即回到提示符准备提问下一个问题。
- **清屏**：点击 `⌫` 可清除当前窗口的终端显示。
- **单体输入**：在窗口底部的输入框中键入内容，按 `Enter` 发送给该 Agent 并自动回车执行。

### 2. 共用广播输入框 (底栏)
- **连续提问优化**：采用文本注入 + 异步回车事件机制，无论第 1 个问题还是后续第 2、第 3 个连续问题，均能 100% 稳定触发智能体执行。
- **目标勾选**：勾选要发送的目标（Agent 1、Agent 2、Agent 3），系统会实时显示各个 Agent 是否处于运行中状态。
- **输入共用 Prompt**：支持多行提示词输入。
- **一键发送**：支持直接敲 **`Enter`** 发送（`Shift + Enter` 换行），也可按 **`⌘ + Enter`**（Mac）/ **`Ctrl + Enter`**（Windows/Linux）或点击右侧 `🚀 Broadcast to Selected Agents`。
- **全部中断**：顶栏和底栏均配有 `🛑 Interrupt All`，可一键中断所有智能体正在进行的生成。
- **历史记录**：发送过的提示词会出现在底部的“快捷历史”栏，点击即可重新载入。

### 3. 顶部全局控制
- **▶ Start All**：一键并行启动所有配置好的 Agent。
- **⏹ Stop All**：一键停止所有运行中的 Agent。
- **⌫ Clear All**：一键清空三个窗口的终端屏幕。

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
