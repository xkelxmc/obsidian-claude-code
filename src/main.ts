import { Notice, Plugin } from "obsidian";
import {
	ClaudeCodeSettings,
	ClaudeCodeSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";

export default class ClaudeCodePlugin extends Plugin {
	settings: ClaudeCodeSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icons for quick access
		this.addRibbonIcon("terminal", "Open embedded terminal", () => {
			this.openEmbeddedTerminal();
		});

		this.addRibbonIcon("external-link", "Open external terminal", () => {
			this.openExternalTerminal();
		});

		// Add commands
		this.addCommand({
			id: "open-embedded-terminal",
			name: "Open embedded terminal",
			callback: () => {
				this.openEmbeddedTerminal();
			},
		});

		this.addCommand({
			id: "open-external-terminal",
			name: "Open external terminal",
			callback: () => {
				this.openExternalTerminal();
			},
		});

		// Add settings tab
		this.addSettingTab(new ClaudeCodeSettingTab(this.app, this));
	}

	onunload() {
		// Cleanup will be added later
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ClaudeCodeSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	openEmbeddedTerminal() {
		new Notice("Embedded terminal - coming soon!");
		// TODO: Implement embedded terminal with xterm.js + bun-pty
	}

	openExternalTerminal() {
		new Notice("External terminal - coming soon!");
		// TODO: Implement external terminal launcher
	}
}
