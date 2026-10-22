// Multi-Agent Parallel CLI Hub - Frontend Logic

(function () {
  const NUM_SLOTS = 3;
  let ws = null;
  let isWsConnected = false;

  // Slot States
  const slots = Array.from({ length: NUM_SLOTS }, (_, i) => ({
    id: i,
    term: null,
    fitAddon: null,
    running: false,
    pid: null,
    command: "",
    history: [],
    historyIndex: -1,
  }));

  // Broadcast prompt history (stored in localStorage)
  let broadcastHistory = [];
  try {
    const saved = localStorage.getItem("multi_agent_broadcast_history");
    if (saved) broadcastHistory = JSON.parse(saved);
  } catch (e) {
    broadcastHistory = [];
  }

  // Toast helper
  function showToast(message, isError = false) {
    const toast = document.getElementById("toast");
    const icon = document.getElementById("toast-icon");
    const msg = document.getElementById("toast-msg");
    icon.textContent = isError ? "✕" : "✓";
    icon.style.color = isError ? "#ef4444" : "#10b981";
    msg.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // ================= Clipboard & Text Extraction =================
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (success) resolve();
        else reject(new Error("execCommand failed"));
      } catch (err) {
        document.body.removeChild(textarea);
        reject(err);
      }
    });
  }

  function getTerminalPlainText(term) {
    if (!term || !term.buffer || !term.buffer.active) return "";
    const buffer = term.buffer.active;
    const lines = [];
    for (let r = 0; r < buffer.length; r++) {
      const line = buffer.getLine(r);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }
    while (lines.length > 0 && !lines[0].trim()) {
      lines.shift();
    }
    while (lines.length > 0 && !lines[lines.length - 1].trim()) {
      lines.pop();
    }
    return lines.join("\n");
  }

  function copySlotContent(slotId) {
    const slot = slots[slotId];
    if (!slot || !slot.term) return;

    let text = "";
    let isSelection = false;

    if (slot.term.hasSelection()) {
      text = slot.term.getSelection();
      isSelection = true;
    } else {
      text = getTerminalPlainText(slot.term);
    }

    if (!text || !text.trim()) {
      showToast(`Agent ${slotId + 1} has no content to copy`, true);
      return;
    }

    copyToClipboard(text)
      .then(() => {
        showToast(`✓ Copied Agent ${slotId + 1} ${isSelection ? "selected text" : "entire terminal content"} to clipboard`);
      })
      .catch((err) => {
        showToast("Copy failed, please select manually and press ⌘ + C", true);
        console.error("Clipboard copy failed:", err);
      });
  }

  // ================= Terminal Initialization =================
  function initTerminals() {
    for (let i = 0; i < NUM_SLOTS; i++) {
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        lineHeight: 1.2,
        fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, Consolas, monospace",
        theme: {
          background: "#ffffff",
          foreground: "#0f172a",
          cursor: "#2563eb",
          cursorAccent: "#ffffff",
          selectionBackground: "#bfdbfe",
          selectionForeground: "#0f172a",
          black: "#0f172a",
          red: "#dc2626",
          green: "#16a34a",
          yellow: "#ca8a04",
          blue: "#2563eb",
          magenta: "#9333ea",
          cyan: "#0891b2",
          white: "#94a3b8",
          brightBlack: "#475569",
          brightRed: "#ef4444",
          brightGreen: "#15803d",
          brightYellow: "#a16207",
          brightBlue: "#1d4ed8",
          brightMagenta: "#7e22ce",
          brightCyan: "#0e7490",
          brightWhite: "#020617"
        },
        convertEol: false,
        scrollback: 10000,
      });

      const fitAddon = new FitAddon.FitAddon();
      term.loadAddon(fitAddon);

      const container = document.getElementById(`terminal-${i}`);
      term.open(container);
      fitAddon.fit();

      // Keyboard input directly on terminal -> send to backend PTY
      term.onData((data) => {
        if (ws && isWsConnected && slots[i].running) {
          ws.send(JSON.stringify({
            action: "input",
            slot: i,
            data: data
          }));
        }
      });

      slots[i].term = term;
      slots[i].fitAddon = fitAddon;

      // Copy on Cmd+C / Ctrl+C when text is selected in terminal
      term.attachCustomKeyEventHandler((e) => {
        if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
          if (term.hasSelection()) {
            copyToClipboard(term.getSelection());
            showToast("✓ Copied selection to clipboard");
            return false;
          }
        }
        return true;
      });
    }

    // Auto resize on window change
    window.addEventListener("resize", handleWindowResize);
  }

  function handleWindowResize() {
    for (let i = 0; i < NUM_SLOTS; i++) {
      if (slots[i].fitAddon && slots[i].term) {
        slots[i].fitAddon.fit();
        if (ws && isWsConnected && slots[i].running) {
          ws.send(JSON.stringify({
            action: "resize",
            slot: i,
            rows: slots[i].term.rows,
            cols: slots[i].term.cols
          }));
        }
      }
    }
  }

  // ================= WebSocket Management =================
  function initWebSocket() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isWsConnected = true;
      console.log("WebSocket connected.");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      isWsConnected = false;
      console.warn("WebSocket disconnected. Retrying in 2 seconds...");
      setTimeout(initWebSocket, 2000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  function handleServerMessage(msg) {
    if (msg.type === "init") {
      if (msg.cwd) {
        document.getElementById("top-cwd").textContent = msg.cwd;
      }
      if (Array.isArray(msg.slots)) {
        msg.slots.forEach((s) => {
          updateSlotStatus(s.slot, s.status, s.pid, s.command);
          if (s.buffer && slots[s.slot].term) {
            slots[s.slot].term.clear();
            slots[s.slot].term.write(s.buffer);
          }
        });
      }
      updateRunningBadge();
      setTimeout(handleWindowResize, 100);
    } else if (msg.type === "output") {
      const slot = slots[msg.slot];
      if (slot && slot.term) {
        slot.term.write(msg.data);
      }
    } else if (msg.type === "status") {
      updateSlotStatus(msg.slot, msg.status, msg.pid, msg.command);
      updateRunningBadge();
      if (msg.message) {
        showToast(`Agent ${msg.slot + 1}: ${msg.message}`);
      }
    } else if (msg.type === "broadcast_ack") {
      const results = msg.results || {};
      const successCount = Object.values(results).filter(Boolean).length;
      showToast(`Successfully broadcasted to ${successCount} running agent(s)`);
    } else if (msg.type === "error") {
      showToast(msg.message, true);
    }
  }

  function updateSlotStatus(slotId, status, pid, command) {
    if (slotId < 0 || slotId >= NUM_SLOTS) return;
    const slot = slots[slotId];
    const isRunning = status === "running";
    slot.running = isRunning;
    slot.pid = pid || null;
    if (command) slot.command = command;

    const card = document.getElementById(`card-${slotId}`);
    const pill = document.getElementById(`status-pill-${slotId}`);
    const toggleBtn = document.getElementById(`btn-toggle-${slotId}`);
    const targetTag = document.getElementById(`target-tag-${slotId}`);

    if (isRunning) {
      card.classList.add("running");
      pill.classList.add("running");
      pill.querySelector(".status-text").textContent = `Running (PID: ${pid || "?"})`;

      toggleBtn.className = "btn btn-danger btn-start-slot";
      toggleBtn.textContent = "⏹ Stop";

      targetTag.className = "target-status-tag active";
      targetTag.textContent = "Running";
    } else {
      card.classList.remove("running");
      pill.classList.remove("running");
      pill.querySelector(".status-text").textContent = "Stopped";

      toggleBtn.className = "btn btn-success btn-start-slot";
      toggleBtn.textContent = "▶ Start";

      targetTag.className = "target-status-tag";
      targetTag.textContent = "Stopped";
    }
  }

  function updateRunningBadge() {
    const runningCount = slots.filter((s) => s.running).length;
    const badge = document.getElementById("running-count-badge");
    badge.textContent = `${runningCount} / ${NUM_SLOTS} Running`;
    if (runningCount > 0) {
      badge.style.color = "#16a34a";
      badge.style.borderColor = "rgba(22, 163, 74, 0.4)";
      badge.style.background = "rgba(22, 163, 74, 0.1)";
    } else {
      badge.style.color = "#2563eb";
      badge.style.borderColor = "rgba(37, 99, 235, 0.3)";
      badge.style.background = "rgba(37, 99, 235, 0.08)";
    }
  }

  // ================= Slot Controls =================
  function startSlot(slotId) {
    const cmdInput = document.getElementById(`cmd-input-${slotId}`);
    const command = cmdInput.value.trim();
    if (!command) {
      showToast(`Please enter start command for Agent ${slotId + 1}`, true);
      cmdInput.focus();
      return;
    }

    if (!ws || !isWsConnected) {
      showToast("Not connected to local backend server", true);
      return;
    }

    const slot = slots[slotId];
    slot.term.clear();

    ws.send(JSON.stringify({
      action: "start",
      slot: slotId,
      command: command,
      rows: slot.term.rows,
      cols: slot.term.cols
    }));
  }

  function stopSlot(slotId) {
    if (!ws || !isWsConnected) return;
    ws.send(JSON.stringify({
      action: "stop",
      slot: slotId
    }));
  }

  function toggleSlot(slotId) {
    if (slots[slotId].running) {
      stopSlot(slotId);
    } else {
      startSlot(slotId);
    }
  }

  function clearSlot(slotId) {
    const slot = slots[slotId];
    if (slot.term) {
      slot.term.clear();
    }
    if (ws && isWsConnected) {
      ws.send(JSON.stringify({
        action: "clear_buffer",
        slot: slotId
      }));
    }
  }

  function interruptSlot(slotId) {
    if (ws && isWsConnected) {
      ws.send(JSON.stringify({
        action: "interrupt",
        slot: slotId !== undefined ? slotId : null
      }));
      showToast(slotId !== undefined ? `Sent interrupt signal (Esc) to Agent ${slotId + 1}` : "Sent interrupt signal (Esc) to all agents");
    }
  }

  function sendDedicatedInput(slotId) {
    const inputEl = document.getElementById(`input-${slotId}`);
    const text = inputEl.value.trim();
    if (!text) return;

    if (!slots[slotId].running) {
      showToast(`Agent ${slotId + 1} is not running. Please start it first!`, true);
      return;
    }

    if (ws && isWsConnected) {
      // Send \r to trigger execution in terminal TUIs (Codex, Claude, etc.)
      ws.send(JSON.stringify({
        action: "input",
        slot: slotId,
        data: text + "\r"
      }));

      // History
      const slot = slots[slotId];
      slot.history.push(text);
      slot.historyIndex = slot.history.length;
      inputEl.value = "";
    }
  }

  // ================= Broadcast Shared Input =================
  let isBroadcasting = false;

  function sendBroadcastPrompt() {
    if (isBroadcasting) return;

    const textarea = document.getElementById("broadcast-textarea");
    const prompt = textarea.value.trim();
    if (!prompt) {
      showToast("Please enter a shared prompt", true);
      textarea.focus();
      return;
    }

    // Determine target slots
    const targetSlots = [];
    for (let i = 0; i < NUM_SLOTS; i++) {
      const cb = document.getElementById(`target-${i}`);
      if (cb && cb.checked) {
        targetSlots.push(i);
      }
    }

    if (targetSlots.length === 0) {
      showToast("Please select at least one target agent", true);
      return;
    }

    const runningTargets = targetSlots.filter((i) => slots[i].running);
    if (runningTargets.length === 0) {
      showToast("Selected target agents are not running. Please start them first!", true);
      return;
    }

    const autoEnter = document.getElementById("broadcast-auto-enter").checked;

    if (ws && isWsConnected) {
      isBroadcasting = true;
      const sendBtn = document.getElementById("btn-broadcast-send");
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = "0.7";
      }

      ws.send(JSON.stringify({
        action: "broadcast",
        slots: targetSlots,
        prompt: prompt,
        append_newline: autoEnter
      }));

      // Save to broadcast history (clean prompt without suffix)
      addBroadcastHistory(prompt);
      textarea.value = "";

      // Unlock after 400ms debounce
      setTimeout(() => {
        isBroadcasting = false;
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.style.opacity = "";
        }
      }, 400);
    }
  }

  function addBroadcastHistory(text) {
    if (!text) return;
    broadcastHistory = broadcastHistory.filter((item) => item !== text);
    broadcastHistory.unshift(text);
    if (broadcastHistory.length > 8) broadcastHistory.pop();

    try {
      localStorage.setItem("multi_agent_broadcast_history", JSON.stringify(broadcastHistory));
    } catch (e) {}

    renderBroadcastHistory();
  }

  function renderBroadcastHistory() {
    const container = document.getElementById("prompt-history-list");
    // Clear dynamic pills
    container.querySelectorAll(".history-pill").forEach((el) => el.remove());

    broadcastHistory.forEach((text) => {
      const pill = document.createElement("span");
      pill.className = "history-pill";
      pill.textContent = text;
      pill.title = text;
      pill.addEventListener("click", () => {
        const textarea = document.getElementById("broadcast-textarea");
        textarea.value = text;
        textarea.focus();
      });
      container.appendChild(pill);
    });
  }

  // ================= Event Listeners =================
  function setupEventListeners() {
    // Slot action buttons
    for (let i = 0; i < NUM_SLOTS; i++) {
      const slotId = i;

      // Toggle Start/Stop
      document.getElementById(`btn-toggle-${slotId}`).addEventListener("click", () => {
        toggleSlot(slotId);
      });

      // Clear button
      document.querySelector(`.btn-clear-slot[data-slot="${slotId}"]`).addEventListener("click", () => {
        clearSlot(slotId);
      });

      // Interrupt button
      const interruptBtn = document.querySelector(`.btn-interrupt-slot[data-slot="${slotId}"]`);
      if (interruptBtn) {
        interruptBtn.addEventListener("click", () => {
          interruptSlot(slotId);
        });
      }

      // Copy button
      const copyBtn = document.querySelector(`.btn-copy-slot[data-slot="${slotId}"]`);
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          copySlotContent(slotId);
        });
      }

      // Preset selector
      const presetSelect = document.querySelector(`.preset-selector[data-slot="${slotId}"]`);
      presetSelect.addEventListener("change", (e) => {
        if (e.target.value) {
          document.getElementById(`cmd-input-${slotId}`).value = e.target.value;
          e.target.value = "";
        }
      });

      // Dedicated Input box
      const inputEl = document.getElementById(`input-${slotId}`);
      inputEl.addEventListener("keydown", (e) => {
        if (e.isComposing || e.keyCode === 229 || e.repeat) {
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          sendDedicatedInput(slotId);
        } else if (e.key === "ArrowUp") {
          const slot = slots[slotId];
          if (slot.history.length > 0 && slot.historyIndex > 0) {
            slot.historyIndex--;
            inputEl.value = slot.history[slot.historyIndex];
          }
        } else if (e.key === "ArrowDown") {
          const slot = slots[slotId];
          if (slot.historyIndex < slot.history.length - 1) {
            slot.historyIndex++;
            inputEl.value = slot.history[slot.historyIndex];
          } else {
            slot.historyIndex = slot.history.length;
            inputEl.value = "";
          }
        }
      });

      document.querySelector(`.btn-send-slot[data-slot="${slotId}"]`).addEventListener("click", () => {
        sendDedicatedInput(slotId);
      });
    }

    // Top Bar Global Actions
    document.getElementById("btn-start-all").addEventListener("click", () => {
      let startedAny = false;
      for (let i = 0; i < NUM_SLOTS; i++) {
        if (!slots[i].running) {
          startSlot(i);
          startedAny = true;
        }
      }
      if (!startedAny) {
        showToast("All agents are already running");
      }
    });

    document.getElementById("btn-stop-all").addEventListener("click", () => {
      for (let i = 0; i < NUM_SLOTS; i++) {
        if (slots[i].running) {
          stopSlot(i);
        }
      }
    });

    document.getElementById("btn-interrupt-all").addEventListener("click", () => {
      interruptSlot();
    });

    document.getElementById("btn-clear-all").addEventListener("click", () => {
      for (let i = 0; i < NUM_SLOTS; i++) {
        clearSlot(i);
      }
    });

    // Broadcast actions
    const broadcastBtn = document.getElementById("btn-broadcast-send");
    broadcastBtn.addEventListener("click", sendBroadcastPrompt);

    const broadcastTextarea = document.getElementById("broadcast-textarea");
    broadcastTextarea.addEventListener("keydown", (e) => {
      // Ignore during IME composition or key repeat to prevent multiple duplicate sends
      if (e.isComposing || e.keyCode === 229 || e.repeat) {
        return;
      }

      // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to send
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        sendBroadcastPrompt();
        return;
      }

      // Enter alone sends when enabled (Shift+Enter for newline)
      const enterToSendCb = document.getElementById("broadcast-enter-to-send");
      if (enterToSendCb && enterToSendCb.checked && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBroadcastPrompt();
        return;
      }
    });

    // Toggle All Targets
    document.getElementById("btn-toggle-all-targets").addEventListener("click", () => {
      const cbs = [0, 1, 2].map((i) => document.getElementById(`target-${i}`));
      const anyChecked = cbs.some((cb) => cb.checked);
      cbs.forEach((cb) => (cb.checked = !anyChecked));
    });

    // Clear broadcast input
    document.getElementById("btn-clear-broadcast-input").addEventListener("click", () => {
      broadcastTextarea.value = "";
      broadcastTextarea.focus();
    });

    renderBroadcastHistory();
  }

  // ================= Initialize App =================
  window.addEventListener("DOMContentLoaded", () => {
    initTerminals();
    setupEventListeners();
    initWebSocket();
  });
})();
