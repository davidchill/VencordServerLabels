# ServerLabels — Vencord Plugin

A custom [Vencord](https://github.com/Vendicated/Vencord) plugin that displays server and folder names directly next to their icons in Discord's guild sidebar.

<!-- Screenshot placeholder — add a before/after image here -->

## Features

- Server names shown inline next to server icons in the sidebar
- Folder names shown next to folder icons
- Servers inside colored folders inherit the folder's color on their label
- Tree branch connector lines for servers nested inside open folders
- Fully clickable labels — clicking navigates to the server or toggles the folder
- Hover effect and pointer cursor, despite labels being invisible to Discord's event system
- Adjustable font size, font weight, and max label width via plugin settings
- Tooltip suppression — Discord's native server-name tooltip is blocked while labels are visible
- Clean enable/disable — all injected elements and listeners removed on plugin stop

## Installation

This plugin is installed as a Vencord [user plugin](https://docs.vencord.dev/plugins/creating-plugins/).

1. Clone or download this repository.
2. Copy the `serverLabels` plugin folder into your Vencord source tree:
   ```
   Vencord/src/userplugins/serverLabels/
   ```
   The folder should contain `index.tsx`, `style.css`, and `README.md`.
3. Rebuild Vencord from the repo root:
   ```
   pnpm build
   ```
4. Fully quit and relaunch Discord.
5. Open **Settings → Vencord → Plugins**, find **ServerLabels**, and enable it.

> **Note:** You only need to run `pnpm inject` once during initial Vencord setup. Subsequent code changes only require `pnpm build` + Discord relaunch.

## Settings

| Setting | Default | Description |
|---|---|---|
| Font size | 14px | Label font size (10–20px slider) |
| Font weight | Normal | Normal, Medium, or Bold |
| Max width | 150px | Maximum label width before text truncates (80–200px slider) |

Settings take effect immediately without toggling the plugin.

## How It Works

ServerLabels uses a `MutationObserver` to inject label `<span>` elements into Discord's guild nav DOM whenever the server list renders or re-renders. It avoids webpack patches entirely — early attempts to patch Discord's React components broke server icon clicking.

Key implementation details:

- **DOM injection** — Labels are appended inside the icon `<span>` (not after it), making the icon span the absolute positioning anchor. This preserves Discord's native icon centering without any layout hacks.
- **pointer-events: none** — Labels are invisible to Discord's event system. Clicks and hover effects are handled by document-level listeners that check bounding rects manually (`labelAtPoint()`). This is the only reliable way to suppress Discord's React-delegated tooltips.
- **CSS variable injection** — Settings are written into a `<style>` tag in `<head>` rather than inline on `document.documentElement`. Discord periodically rewrites the root element's `style` attribute for its own theming, which would silently wipe inline custom properties.
- **Folder color** — `SortedGuildStore` is used to look up each guild's parent folder and extract `folderColor` (a raw integer), which is converted to a hex CSS string.

## Changelog

See [CHANGELOG.md](Vencord/src/plugins/serverLabels/CHANGELOG.md) for the full version history.

**Current version: v0.1.6**

## License

GPL-3.0-or-later — same license as Vencord itself.
