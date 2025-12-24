import { Notice, Plugin } from "obsidian";
import {
	ClaudeCodeSettings,
	ClaudeCodeSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";
import { openExternalTerminal } from "./external-terminal";
import { TerminalView, TERMINAL_VIEW_TYPE } from "./terminal-view";

export default class ClaudeCodePlugin extends Plugin {
	settings: ClaudeCodeSettings;

	async onload() {
		await this.loadSettings();

		// Register terminal view
		this.registerView(
			TERMINAL_VIEW_TYPE,
			(leaf) => new TerminalView(leaf, this)
		);

		// Add ribbon icons for quick access
		this.addRibbonIcon("terminal", "Open embedded terminal", () => {
			void this.openEmbeddedTerminal();
		});

		this.addRibbonIcon("external-link", "Open external terminal", () => {
			void this.openExternalTerminal();
		});

		// Add commands
		this.addCommand({
			id: "open-embedded-terminal",
			name: "Open embedded terminal",
			callback: () => {
				void this.openEmbeddedTerminal();
			},
		});

		this.addCommand({
			id: "open-external-terminal",
			name: "Open external terminal",
			callback: () => {
				void this.openExternalTerminal();
			},
		});

		// Add settings tab
		this.addSettingTab(new ClaudeCodeSettingTab(this.app, this));
	}

	onunload() {
		// Terminal views will clean up themselves in their onClose method
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ClaudeCodeSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async openEmbeddedTerminal() {
		const leaves = this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);

		// If terminal view already exists, focus it
		if (leaves.length > 0 && leaves[0]) {
			await this.app.workspace.revealLeaf(leaves[0]);
			return;
		}

		// Create new terminal view in a split
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) {
			new Notice("Failed to create terminal view");
			return;
		}

		await leaf.setViewState({
			type: TERMINAL_VIEW_TYPE,
			active: true,
		});
		await this.app.workspace.revealLeaf(leaf);
	}

	async openExternalTerminal() {
		const adapter = this.app.vault.adapter;
		if (!("getBasePath" in adapter)) {
			new Notice("Vault path not available");
			return;
		}
		const vaultPath = (adapter as { getBasePath: () => string }).getBasePath();
		await openExternalTerminal(this.settings, vaultPath);
	}
}
