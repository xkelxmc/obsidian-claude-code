import { Notice } from "obsidian";
import { exec } from "child_process";
import { promisify } from "util";
import open from "open";
import type { ClaudeCodeSettings } from "./settings";

const execAsync = promisify(exec);

interface TerminalConfig {
	name: string;
	command: (cwd: string, claudeCommand: string) => string;
	check: () => Promise<boolean>;
}

const terminals: Record<string, TerminalConfig> = {
	warp: {
		name: "Warp",
		command: () => "", // Not used - we use 'open' package instead
		check: async () => {
			try {
				await execAsync('mdfind "kMDItemKind == Application && kMDItemFSName == Warp.app"');
				return true;
			} catch {
				return false;
			}
		},
	},
	iterm: {
		name: "iTerm",
		command: (cwd: string, claudeCommand: string) =>
			`osascript -e 'tell application "iTerm"
				create window with default profile
				tell current session of current window
					write text "cd \\"${cwd}\\" && ${claudeCommand}"
				end tell
			end tell'`,
		check: async () => {
			try {
				await execAsync('mdfind "kMDItemKind == Application && kMDItemFSName == iTerm.app"');
				return true;
			} catch {
				return false;
			}
		},
	},
	terminal: {
		name: "Terminal.app",
		command: (cwd: string, claudeCommand: string) =>
			`osascript -e 'tell application "Terminal"
				do script "cd \\"${cwd}\\" && ${claudeCommand}"
				activate
			end tell'`,
		check: async () => true, // Terminal.app always exists on macOS
	},
};

async function detectTerminal(): Promise<string | null> {
	// Check in order: Warp > iTerm > Terminal.app
	for (const [key, config] of Object.entries(terminals)) {
		if (await config.check()) {
			return key;
		}
	}
	return null;
}

export async function openExternalTerminal(
	settings: ClaudeCodeSettings,
	vaultPath: string
): Promise<void> {
	try {
		let terminalKey: string = settings.externalTerminal;

		// Auto-detect terminal if needed
		if (terminalKey === "auto") {
			const detected = await detectTerminal();
			if (!detected) {
				new Notice("No supported terminal found");
				return;
			}
			terminalKey = detected;
		}

		// Handle custom command
		if (terminalKey === "custom") {
			if (!settings.customTerminalCommand) {
				new Notice("Custom terminal command not configured");
				return;
			}
			const command = settings.customTerminalCommand.replace("{cwd}", vaultPath);
			await execAsync(command);
			new Notice("Terminal opened");
			return;
		}

		// Use predefined terminal
		const terminal = terminals[terminalKey];
		if (!terminal) {
			new Notice(`Unknown terminal: ${terminalKey}`);
			return;
		}

		// Special handling for Warp - use Warp URI scheme
		if (terminalKey === "warp") {
			console.debug("Opening Warp in:", vaultPath);
			const action = settings.warpBehavior === "new-window" ? "new_window" : "new_tab";
			const warpUri = `warp://action/${action}?path=${encodeURIComponent(vaultPath)}`;
			console.debug("Warp URI:", warpUri);
			await open(warpUri);
			const location = settings.warpBehavior === "new-window" ? "window" : "tab";
			new Notice(`${terminal.name} opened in new ${location} - run '${settings.claudeCommand}' to start`);
			return;
		}

		// For other terminals, use AppleScript
		const command = terminal.command(vaultPath, settings.claudeCommand);
		console.debug("Executing command:", command);
		const result = await execAsync(command);
		console.debug("Command result:", result);
		new Notice(`${terminal.name} opened with Claude`);
	} catch (error) {
		console.error("Failed to open external terminal:", error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to open terminal: ${errorMessage}`);
	}
}
