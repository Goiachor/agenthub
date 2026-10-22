# Multi-Agent Parallel CLI Hub

A lightweight, zero-bloat dashboard designed for concurrently running and comparing multiple AI Agent CLIs (such as Claude Code, Aider, OpenCode, Agy, Python Agents, etc.).

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

## 🚀 Quick Start

From the project root directory, run either:

```bash
# Option 1: Use launch script
./run.sh

# Option 2: Run directly with Python
python3 server.py
```

Upon launch, your default browser will automatically open `http://127.0.0.1:8848`.

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
MultiWindows/
├── server.py              # Tornado backend service (PTY process management, WebSocket communication)
├── static/
│   ├── index.html         # Main dashboard UI
│   ├── style.css          # Modern terminal theme styles
│   ├── app.js             # Multi-terminal coordination and broadcast dispatch logic
│   ├── xterm.js           # Offline terminal engine
│   ├── xterm.css          # Terminal styling
│   └── xterm-addon-fit.js # Terminal viewport fit addon
├── run.sh                 # Quick launch script
├── requirements.txt       # Python dependencies (tornado)
└── README.md              # Documentation
```
