# Obsidian Claude Code Plugin

Launch Claude Code terminal directly from Obsidian - embedded or external.

## Features

- **Embedded Terminal**: Full-featured terminal inside Obsidian (powered by xterm.js)
- **External Terminal**: Launch your favorite terminal app (Warp, iTerm, Terminal.app)
- **Auto Claude Start**: Automatically start Claude Code in your vault directory
- **Simple & Fast**: Minimal configuration, maximum productivity

## Development

This plugin is built with [Bun](https://bun.sh) - a fast JavaScript runtime.

### Prerequisites

- [Bun](https://bun.sh) installed
- Obsidian installed

### Setup

```bash
# Clone the repo
git clone https://github.com/ilyazhidkov/obsidian-claude-code-plugin.git

# Install dependencies
bun install

# Build the plugin
bun run build

# Or run in development mode (watch mode)
bun run dev
```

### Development Workflow

1. Clone this repo into your vault's `.obsidian/plugins/` folder
2. Run `bun install` to install dependencies
3. Run `bun run dev` for hot reload during development
4. Reload Obsidian to see changes

### Manual Installation

Copy `main.js`, `manifest.json`, and `styles.css` to your vault:
```
VaultFolder/.obsidian/plugins/claude-code/
```

## Building

```bash
# Production build
bun run build

# Development build with watch mode
bun run dev

# Lint
bun run lint
```

## Releasing

1. Update version in `manifest.json`
2. Run `bun run build`
3. Create GitHub release with tag matching the version
4. Upload `manifest.json`, `main.js`, `styles.css` as release assets

## Tech Stack

- **Runtime**: Bun
- **Terminal**: xterm.js + bun-pty
- **External Launcher**: open (cross-platform)
- **Language**: TypeScript

## License

0-BSD
