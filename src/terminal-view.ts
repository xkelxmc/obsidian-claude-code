import { ItemView, WorkspaceLeaf } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type ClaudeCodePlugin from "./main";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Python script imported as string via custom loader
import ptyWrapperPy from "./pty-wrapper.py";

export const TERMINAL_VIEW_TYPE = "claude-code-terminal";

export class TerminalView extends ItemView {
	plugin: ClaudeCodePlugin;
	terminal: Terminal | null = null;
	fitAddon: FitAddon | null = null;
	ptyProcess: ChildProcessWithoutNullStreams | null = null;
	private disposables: Array<{ dispose: () => void }> = [];
	private resizeHandler: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ClaudeCodePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return TERMINAL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Claude Terminal";
	}

	getIcon(): string {
		return "terminal";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!container) return;

		container.empty();
		container.addClass("claude-terminal-view");

		// Create toolbar with title and buttons
		const toolbar = container.createDiv({ cls: "claude-terminal-toolbar" });

		// Title on the left
		const title = toolbar.createDiv({ cls: "claude-terminal-title" });
		title.createSpan({ text: "⚡️ ", cls: "claude-terminal-icon" });
		title.createSpan({ text: "Claude Code Terminal" });

		// Buttons container on the right
		const buttonsContainer = toolbar.createDiv({ cls: "claude-terminal-buttons" });

		const relaunchBtn = buttonsContainer.createEl("button", {
			text: "Relaunch",
			cls: "claude-terminal-btn",
		});
		relaunchBtn.addEventListener("click", () => this.relaunch());

		const closeBtn = buttonsContainer.createEl("button", {
			text: "Close",
			cls: "claude-terminal-btn",
		});
		closeBtn.addEventListener("click", () => this.leaf.detach());

		// Create terminal container
		const terminalContainer = container.createDiv({
			cls: "claude-terminal-container",
		});

		// Get Obsidian's monospace font from CSS variable
		const monoFont = getComputedStyle(document.body).getPropertyValue('--font-monospace').trim()
			|| 'Menlo, Monaco, "Courier New", monospace';

		// Initialize xterm.js
		this.terminal = new Terminal({
			cursorBlink: true,
			fontSize: 14,
			fontFamily: monoFont,
			theme: {
				background: "#1e1e1e",
				foreground: "#d4d4d4",
			},
		});

		// Add fit addon
		this.fitAddon = new FitAddon();
		this.terminal.loadAddon(this.fitAddon);

		// Open terminal in container
		this.terminal.open(terminalContainer);

		// Resize handler using proposeDimensions like obsidian-terminal
		this.resizeHandler = () => {
			if (!this.fitAddon || !this.terminal) return;

			// Get proposed dimensions without actually resizing yet
			const dimensions = this.fitAddon.proposeDimensions();
			if (!dimensions) return;

			const { cols, rows } = dimensions;
			if (!isFinite(cols) || !isFinite(rows)) return;

			try {
				// Resize terminal
				this.terminal.resize(cols, rows);

				// Update PTY size - reduce cols by 4 to leave space for scrollbar
				if (this.ptyProcess && this.ptyProcess.stdio[3]) {
					const cmdio = this.ptyProcess.stdio[3] as any;
					if (cmdio && typeof cmdio.write === 'function') {
						const ptyCols = Math.max(1, cols - 4); // -4 for scrollbar space
						cmdio.write(`${ptyCols}x${rows}\n`);
					}
				}
			} catch (error) {
				console.error("Resize failed:", error);
			}
		};

		// Initial resize
		setTimeout(this.resizeHandler, 100);

		// Handle resize - use ResizeObserver
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				// Skip if container has zero size
				if (entry.contentBoxSize) {
					const size = Array.isArray(entry.contentBoxSize)
						? entry.contentBoxSize[0]
						: entry.contentBoxSize;
					if (size.blockSize <= 0 || size.inlineSize <= 0) {
						continue;
					}
				}
				this.resizeHandler?.();
			}
		});
		resizeObserver.observe(terminalContainer);

		// Also handle workspace layout changes
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				setTimeout(() => this.resizeHandler?.(), 50);
			})
		);

		// Clean up observer on close
		this.register(() => resizeObserver.disconnect());

		// Start PTY process
		await this.startPty();
	}

	async relaunch(): Promise<void> {
		// Kill existing process
		if (this.ptyProcess) {
			this.ptyProcess.kill();
			this.ptyProcess = null;
		}

		// Clear terminal
		if (this.terminal) {
			this.terminal.clear();
		}

		// Restart PTY
		await this.startPty();
	}

	async startPty(): Promise<void> {
		if (!this.terminal) return;

		try {
			const adapter = this.app.vault.adapter;
			if (!("getBasePath" in adapter)) {
				this.terminal.writeln("Error: Vault path not available");
				return;
			}
			const vaultPath = (adapter as { getBasePath: () => string }).getBasePath();

			// Python PTY wrapper code is bundled as a string in the JS bundle
			// We spawn python with -c to execute it directly
			// This properly loads ~/.zprofile, ~/.zshrc, and all environment variables
			this.ptyProcess = spawn(
				"python3",
				[
					"-c",
					ptyWrapperPy,
					this.plugin.settings.defaultShell,
					"-l"  // Login shell - loads all environment properly!
				],
				{
					cwd: vaultPath,
					env: {
						...process.env,
						TERM: "xterm-256color",
					},
					stdio: ["pipe", "pipe", "pipe", "pipe"], // stdin, stdout, stderr, cmdio (for resize)
				}
			);

			// Handle PTY stdout -> terminal
			this.ptyProcess.stdout.on("data", (data: Buffer) => {
				if (this.terminal) {
					this.terminal.write(data.toString());
				}
			});

			// Handle PTY stderr -> terminal
			this.ptyProcess.stderr.on("data", (data: Buffer) => {
				if (this.terminal) {
					this.terminal.write(data.toString());
				}
			});

			// Handle terminal input -> PTY stdin
			const onData = this.terminal.onData((data: string) => {
				if (this.ptyProcess && this.ptyProcess.stdin) {
					this.ptyProcess.stdin.write(data);
				}
			});
			this.disposables.push(onData);

			// Handle process exit
			this.ptyProcess.on("exit", (code, signal) => {
				console.log(`PTY process exited with code ${code}, signal ${signal}`);
			});

			// Trigger initial resize after PTY is ready
			setTimeout(() => {
				this.resizeHandler?.();
			}, 200);

			// Auto-start Claude if enabled
			if (this.plugin.settings.autoStartClaude) {
				// Wait for shell to fully initialize (login shells need more time)
				setTimeout(() => {
					if (this.ptyProcess && this.ptyProcess.stdin && this.terminal) {
						const cmd = this.plugin.settings.claudeCommand;

						// Send command
						this.ptyProcess.stdin.write(`${cmd}\n`);

						// Wait a tiny bit for echo, then clear the line
						setTimeout(() => {
							if (this.terminal) {
								// Move cursor up one line and clear it
								this.terminal.write('\x1b[1A\x1b[2K');
							}
						}, 50);
					}
				}, 1000);
			}
		} catch (error) {
			console.error("Failed to start PTY:", error);
			if (this.terminal) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				this.terminal.writeln(`\r\nError: Failed to start terminal: ${errorMessage}`);
			}
		}
	}

	async onClose(): Promise<void> {
		// Clean up event listeners
		for (const disposable of this.disposables) {
			try {
				disposable.dispose();
			} catch (error) {
				console.error("Error disposing event listener:", error);
			}
		}
		this.disposables = [];

		// Clean up PTY process
		if (this.ptyProcess) {
			try {
				this.ptyProcess.kill();
			} catch (error) {
				console.error("Error killing PTY process:", error);
			}
			this.ptyProcess = null;
		}

		// Clean up terminal
		if (this.terminal) {
			this.terminal.dispose();
			this.terminal = null;
		}

		this.fitAddon = null;
	}
}
