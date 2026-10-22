#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Multi-Agent Parallel CLI Hub
A clean, focused interface to launch and manage 3 parallel CLI agents,
with independent and simultaneous (broadcast) prompt dispatching.
"""

import os
import sys
import pty
import fcntl
import termios
import struct
import signal
import json
import socket
import logging
import webbrowser
import errno
from collections import deque
import tornado.web
import tornado.websocket
import tornado.ioloop

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("MultiAgentHub")

NUM_SLOTS = 3
DEFAULT_PORT = 8848
BUFFER_MAX_BYTES = 200000  # 200KB output buffer per agent for reconnection

class AgentSlot:
    def __init__(self, slot_id):
        self.slot_id = slot_id
        self.name = f"Agent {slot_id + 1}"
        self.pid = None
        self.master_fd = None
        self.command = ""
        self.status = "stopped"  # "stopped" | "running"
        self.buffer = bytearray()
        self.cwd = os.getcwd()

    def is_running(self):
        if self.pid is None:
            return False
        try:
            pid, status = os.waitpid(self.pid, os.WNOHANG)
            if pid != 0:
                self.pid = None
                self.status = "stopped"
                return False
            return True
        except ChildProcessError:
            self.pid = None
            self.status = "stopped"
            return False

    def start(self, command, rows=24, cols=80, cwd=None):
        if self.is_running():
            self.stop()

        self.command = command.strip()
        if not self.command:
            raise ValueError("Command cannot be empty")

        if cwd and os.path.isdir(cwd):
            self.cwd = cwd
        else:
            self.cwd = os.getcwd()

        master, slave = pty.openpty()

        # Set master non-blocking
        flags = fcntl.fcntl(master, fcntl.F_GETFL)
        fcntl.fcntl(master, fcntl.F_SETFL, flags | os.O_NONBLOCK)

        # Set initial terminal size
        try:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(slave, termios.TIOCSWINSZ, winsize)
        except Exception as e:
            logger.warning(f"Failed to set initial terminal size: {e}")

        pid = os.fork()
        if pid == 0:
            # Child process
            try:
                os.close(master)
                os.setsid()
                try:
                    fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
                except Exception:
                    pass

                os.dup2(slave, 0)
                os.dup2(slave, 1)
                os.dup2(slave, 2)
                if slave > 2:
                    os.close(slave)

                if os.path.isdir(self.cwd):
                    os.chdir(self.cwd)

                env = dict(os.environ)
                env["TERM"] = "xterm-256color"
                env["COLORTERM"] = "truecolor"
                env["LANG"] = env.get("LANG", "zh_CN.UTF-8")
                env["LC_ALL"] = env.get("LC_ALL", "en_US.UTF-8")

                shell = os.environ.get("SHELL", "/bin/zsh")
                # Run command in user shell
                os.execvpe(shell, [shell, "-c", self.command], env)
            except Exception as ex:
                sys.stderr.write(f"\n[Launch failed: {ex}]\n")
                os._exit(127)
        else:
            # Parent process
            os.close(slave)
            self.pid = pid
            self.master_fd = master
            self.status = "running"
            self.buffer = bytearray()
            logger.info(f"Started Slot {self.slot_id} ({self.command}) PID={self.pid}")
            return self.pid

    def stop(self):
        if self.master_fd is not None:
            try:
                tornado.ioloop.IOLoop.current().remove_handler(self.master_fd)
            except Exception:
                pass
            try:
                os.close(self.master_fd)
            except Exception:
                pass
            self.master_fd = None

        if self.pid is not None:
            try:
                # Send SIGTERM first
                os.kill(self.pid, signal.SIGTERM)
                # Give process a moment to exit
                for _ in range(5):
                    pid, _ = os.waitpid(self.pid, os.WNOHANG)
                    if pid != 0:
                        break
                    tornado.ioloop.IOLoop.current().add_timeout(
                        tornado.ioloop.IOLoop.current().time() + 0.05, lambda: None
                    )
                else:
                    # Force kill if still running
                    try:
                        os.kill(self.pid, signal.SIGKILL)
                        os.waitpid(self.pid, os.WNOHANG)
                    except Exception:
                        pass
            except ProcessLookupError:
                pass
            except Exception as e:
                logger.warning(f"Error stopping process {self.pid}: {e}")
            self.pid = None

        self.status = "stopped"
        logger.info(f"Slot {self.slot_id} stopped.")

    def write_input(self, text):
        if not self.is_running() or self.master_fd is None:
            return False
        try:
            data = text.encode("utf-8")
            os.write(self.master_fd, data)
            return True
        except Exception as e:
            logger.error(f"Error writing to slot {self.slot_id}: {e}")
            return False

    def write_prompt_with_enter(self, prompt, append_newline=True):
        """
        Sends prompt to the terminal process.
        If append_newline is True:
        First writes the prompt text, then after an 80ms delay sends \\r.
        The brief delay allows TUI event loops (crossterm in Codex, Ink in Claude, etc.)
        to fully ingest the characters into the active input buffer before the Return
        key arrives, guaranteeing that consecutive questions (Q1, Q2, Q3...) execute.
        Also includes a 400ms duplicate prompt guard to prevent multiple accidental sends.
        """
        if not self.is_running() or self.master_fd is None:
            return False

        clean_prompt = prompt.rstrip("\r\n").replace("\r\n", "\n").replace("\r", "\n")
        if not clean_prompt:
            return False

        # Deduplication guard: ignore exact duplicate prompt received within 400ms
        import time as _time
        now = _time.time()
        last_time = getattr(self, "_last_prompt_time", 0)
        last_text = getattr(self, "_last_prompt_text", None)
        if (now - last_time < 0.40) and (last_text == clean_prompt):
            logger.warning(f"Slot {self.slot_id}: Dropped duplicate prompt within 400ms")
            return True

        self._last_prompt_time = now
        self._last_prompt_text = clean_prompt

        if append_newline:
            text_payload = clean_prompt
            self.write_input(text_payload)
            ioloop = tornado.ioloop.IOLoop.current()
            ioloop.add_timeout(
                ioloop.time() + 0.08,
                lambda: self.write_input("\r")
            )
            return True
        else:
            return self.write_input(clean_prompt)

    def resize(self, rows, cols):
        if self.master_fd is None:
            return
        try:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
        except Exception as e:
            logger.debug(f"Resize error for slot {self.slot_id}: {e}")

    def append_buffer(self, chunk):
        self.buffer.extend(chunk)
        if len(self.buffer) > BUFFER_MAX_BYTES:
            self.buffer = self.buffer[-BUFFER_MAX_BYTES:]


class HubManager:
    def __init__(self):
        self.slots = [AgentSlot(i) for i in range(NUM_SLOTS)]
        self.ws_clients = set()

    def register_client(self, client):
        self.ws_clients.add(client)

    def unregister_client(self, client):
        self.ws_clients.discard(client)

    def broadcast_ws(self, msg_dict):
        msg_str = json.dumps(msg_dict)
        dead = []
        for client in self.ws_clients:
            try:
                client.write_message(msg_str)
            except Exception:
                dead.append(client)
        for d in dead:
            self.ws_clients.discard(d)

    def on_pty_data(self, slot_id, fd, events):
        slot = self.slots[slot_id]
        if fd != slot.master_fd:
            return

        ioloop = tornado.ioloop.IOLoop.current()
        try:
            chunk = os.read(fd, 4096)
            if not chunk:
                # EOF reached
                self._handle_slot_exit(slot)
                return

            slot.append_buffer(chunk)
            # Send text to clients
            text = chunk.decode("utf-8", errors="replace")
            self.broadcast_ws({
                "type": "output",
                "slot": slot_id,
                "data": text
            })
        except (OSError, IOError) as e:
            if getattr(e, 'errno', None) in (errno.EAGAIN, errno.EWOULDBLOCK):
                return
            # PTY read error usually means child exited
            self._handle_slot_exit(slot)

    def _handle_slot_exit(self, slot):
        slot_id = slot.slot_id
        logger.info(f"Slot {slot_id} process finished or disconnected.")
        slot.stop()
        self.broadcast_ws({
            "type": "status",
            "slot": slot_id,
            "status": "stopped",
            "message": "Process terminated"
        })

    def start_slot(self, slot_id, command, rows=24, cols=80, cwd=None):
        if not (0 <= slot_id < NUM_SLOTS):
            raise IndexError("Invalid slot id")
        slot = self.slots[slot_id]
        slot.start(command, rows, cols, cwd)

        # Register PTY read handler in IOLoop
        ioloop = tornado.ioloop.IOLoop.current()
        ioloop.add_handler(
            slot.master_fd,
            lambda fd, events, s_id=slot_id: self.on_pty_data(s_id, fd, events),
            tornado.ioloop.IOLoop.READ
        )

        self.broadcast_ws({
            "type": "status",
            "slot": slot_id,
            "status": "running",
            "command": slot.command,
            "pid": slot.pid,
            "cwd": slot.cwd
        })

    def stop_slot(self, slot_id):
        if not (0 <= slot_id < NUM_SLOTS):
            return
        slot = self.slots[slot_id]
        slot.stop()
        self.broadcast_ws({
            "type": "status",
            "slot": slot_id,
            "status": "stopped"
        })

    def send_to_slot(self, slot_id, data):
        if 0 <= slot_id < NUM_SLOTS:
            slot = self.slots[slot_id]
            return slot.write_input(data)
        return False

    def broadcast_prompt(self, target_slots, prompt, append_newline=True):
        """
        Simultaneously send a prompt to all specified active agents.
        """
        results = {}
        unique_slots = list(dict.fromkeys(target_slots))
        for s_id in unique_slots:
            if 0 <= s_id < NUM_SLOTS:
                slot = self.slots[s_id]
                if slot.is_running():
                    success = slot.write_prompt_with_enter(prompt, append_newline)
                    results[s_id] = success
                else:
                    results[s_id] = False
        return results

    def interrupt_slot(self, slot_id=None):
        """
        Sends Esc and Ctrl+C to abort current running generation in agent.
        """
        if slot_id is not None and 0 <= slot_id < NUM_SLOTS:
            slot = self.slots[slot_id]
            if slot.is_running():
                slot.write_input("\x1b\x03")
                return True
        else:
            for s in self.slots:
                if s.is_running():
                    s.write_input("\x1b\x03")
            return True
        return False

    def get_state(self):
        state = []
        for s in self.slots:
            state.append({
                "slot": s.slot_id,
                "name": s.name,
                "command": s.command,
                "status": "running" if s.is_running() else "stopped",
                "pid": s.pid,
                "cwd": s.cwd,
                "buffer": s.buffer.decode("utf-8", errors="replace")
            })
        return state

    def cleanup(self):
        for slot in self.slots:
            slot.stop()


hub = HubManager()


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("index.html")


class WebSocketHandler(tornado.websocket.WebSocketHandler):
    def check_origin(self, origin):
        return True

    def open(self):
        hub.register_client(self)
        logger.info("WebSocket client connected.")
        # Send current state
        self.write_message(json.dumps({
            "type": "init",
            "cwd": os.getcwd(),
            "slots": hub.get_state()
        }))

    def on_message(self, message):
        try:
            req = json.loads(message)
            action = req.get("action")

            if action == "start":
                slot_id = int(req.get("slot", 0))
                cmd = req.get("command", "")
                rows = int(req.get("rows", 24))
                cols = int(req.get("cols", 80))
                cwd = req.get("cwd", os.getcwd())
                hub.start_slot(slot_id, cmd, rows, cols, cwd)

            elif action == "stop":
                slot_id = int(req.get("slot", 0))
                hub.stop_slot(slot_id)

            elif action == "input":
                slot_id = int(req.get("slot", 0))
                data = req.get("data", "")
                if 0 <= slot_id < NUM_SLOTS:
                    slot = hub.slots[slot_id]
                    # If this is text typed with enter from dedicated input box
                    if len(data) > 1 and (data.endswith("\r") or data.endswith("\n")):
                        slot.write_prompt_with_enter(data.rstrip("\r\n"), append_newline=True)
                    else:
                        slot.write_input(data)

            elif action == "interrupt":
                slot_id = req.get("slot", None)
                hub.interrupt_slot(int(slot_id) if slot_id is not None else None)

            elif action == "broadcast":
                target_slots = req.get("slots", [0, 1, 2])
                prompt = req.get("prompt", "")
                append_newline = req.get("append_newline", True)
                results = hub.broadcast_prompt(target_slots, prompt, append_newline)
                self.write_message(json.dumps({
                    "type": "broadcast_ack",
                    "results": results
                }))

            elif action == "resize":
                slot_id = int(req.get("slot", 0))
                rows = int(req.get("rows", 24))
                cols = int(req.get("cols", 80))
                if 0 <= slot_id < NUM_SLOTS:
                    hub.slots[slot_id].resize(rows, cols)

            elif action == "clear_buffer":
                slot_id = int(req.get("slot", 0))
                if 0 <= slot_id < NUM_SLOTS:
                    hub.slots[slot_id].buffer.clear()

        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)
            self.write_message(json.dumps({
                "type": "error",
                "message": str(e)
            }))

    def on_close(self):
        hub.unregister_client(self)
        logger.info("WebSocket client disconnected.")


def find_available_port(start_port=DEFAULT_PORT):
    port = start_port
    while port < start_port + 100:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
        port += 1
    return start_port


def make_app():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(base_dir, "static")
    return tornado.web.Application(
        [
            (r"/", MainHandler),
            (r"/ws", WebSocketHandler),
            (r"/static/(.*)", tornado.web.StaticFileHandler, {"path": static_dir}),
        ],
        template_path=static_dir,
        static_path=static_dir,
        compiled_template_cache=False,
        debug=False,
    )


def shutdown_handler(signum, frame):
    logger.info("Shutting down MultiAgentHub...")
    hub.cleanup()
    tornado.ioloop.IOLoop.current().stop()
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    port = find_available_port(DEFAULT_PORT)
    app = make_app()
    app.listen(port, address="127.0.0.1")

    url = f"http://127.0.0.1:{port}"
    print("\n" + "=" * 60)
    print(" Multi-Agent Parallel CLI Hub started successfully!")
    print(f" Server URL: {url}")
    print(f" Working Directory: {os.getcwd()}")
    print("=" * 60 + "\n")

    # Auto-open browser
    tornado.ioloop.IOLoop.current().add_timeout(
        tornado.ioloop.IOLoop.current().time() + 0.5,
        lambda: webbrowser.open(url)
    )

    try:
        tornado.ioloop.IOLoop.current().start()
    except KeyboardInterrupt:
        shutdown_handler(None, None)


if __name__ == "__main__":
    main()
