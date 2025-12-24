import { App, PluginSettingTab, Setting } from "obsidian";
import type ClaudeCodePlugin from "./main";

export interface ClaudeCodeSettings {
	// Embedded terminal settings
	defaultShell: string;
	claudeCommand: string;
	autoStartClaude: boolean;

	// External terminal settings
	externalTerminal: "auto" | "warp" | "iterm" | "terminal" | "custom";
	customTerminalCommand: string;
}

export const DEFAULT_SETTINGS: ClaudeCodeSettings = {
	defaultShell: process.env.SHELL || "/bin/zsh",
	claudeCommand: "claude",
	autoStartClaude: true,
	externalTerminal: "auto",
	customTerminalCommand: "",
};

export class ClaudeCodeSettingTab extends PluginSettingTab {
	plugin: ClaudeCodePlugin;

	constructor(app: App, plugin: ClaudeCodePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Embedded Terminal Settings
		new Setting(containerEl).setName("Embedded terminal").setHeading();

		new Setting(containerEl)
			.setName("Default shell")
			.setDesc("Shell to use in embedded terminal (e.g., /bin/zsh, /bin/bash)")
			.addText((text) =>
				text
					.setPlaceholder("/bin/zsh")
					.setValue(this.plugin.settings.defaultShell)
					.onChange(async (value) => {
						this.plugin.settings.defaultShell = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Claude command")
			.setDesc("command to launch Claude code")
			.addText((text) =>
				text
					.setPlaceholder("claude")
					.setValue(this.plugin.settings.claudeCommand)
					.onChange(async (value) => {
						this.plugin.settings.claudeCommand = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("auto-start Claude")
			.setDesc("automatically start Claude when opening embedded terminal")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoStartClaude)
					.onChange(async (value) => {
						this.plugin.settings.autoStartClaude = value;
						await this.plugin.saveSettings();
					})
			);

		// External Terminal Settings
		new Setting(containerEl).setName("External terminal").setHeading();

		new Setting(containerEl)
			.setName("Terminal application")
			.setDesc("Which terminal to open externally")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("auto", "auto-detect")
					.addOption("warp", "Warp")
					.addOption("iterm", "iterm")
					.addOption("terminal", "Terminal.app")
					.addOption("custom", "custom command")
					.setValue(this.plugin.settings.externalTerminal)
					.onChange(async (value) => {
						this.plugin.settings.externalTerminal = value as ClaudeCodeSettings["externalTerminal"];
						await this.plugin.saveSettings();
						this.display(); // Refresh to show/hide custom command field
					})
			);

		if (this.plugin.settings.externalTerminal === "custom") {
			new Setting(containerEl)
				.setName("Custom terminal command")
				.setDesc("Custom command to open terminal (use {cwd} for working directory)")
				.addText((text) =>
					text
						.setPlaceholder('open -a "MyTerminal" {cwd}')
						.setValue(this.plugin.settings.customTerminalCommand)
						.onChange(async (value) => {
							this.plugin.settings.customTerminalCommand = value;
							await this.plugin.saveSettings();
						})
				);
		}
	}
}
