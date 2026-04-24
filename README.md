# ServerLabels — Vencord Plugin

A custom [Vencord](https://github.com/Vendicated/Vencord) plugin that displays server and folder names directly next to their icons in Discord's guild sidebar.

<!-- Screenshot placeholder — add a before/after image here -->

## Features

- Server names shown inline next to server icons in the sidebar
- Folder names shown next to folder icons
- Servers inside colored folders inherit the folder's color on their label
- Folder color opacity shifts when a folder is open vs. closed, matching Discord's native folder icon behavior
- Tree branch connector lines for servers nested inside open folders (optional)
- Fully clickable labels — clicking navigates to the server or toggles the folder
- Optional auto-collapse: folders close automatically when you navigate to a server inside them
- Hover effect and pointer cursor, despite labels being invisible to Discord's event system
- Long names scroll (marquee) on hover rather than staying truncated
- Light theme support — labels automatically switch to dark text on a subtle background
- Adjustable font size, font weight, max label width, and corner radius style via plugin settings
- Custom font family — 17 options including Google Fonts, each shown in its own font in the picker
- Custom font color with theme-adaptive fallback when left blank
- Sidebar width auto-scales with the Max Width setting
- Tooltip suppression — Discord's native server-name tooltip is blocked while labels are visible
- Settings shortcut button — a gear icon at the right edge of the sidebar opens the plugin settings modal in one click
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
   pnpm buildStandalone
   ```
4. Fully quit and relaunch Discord.
5. Open **Settings → Vencord → Plugins**, find **ServerLabels**, and enable it.

> **Note:** You only need to run `pnpm inject` once during initial Vencord setup. Subsequent code changes only require `pnpm buildStandalone` + Discord relaunch.

## Settings

Settings are grouped into three sections and all take effect immediately without toggling the plugin.

**Typography**

| Setting | Default | Description |
|---|---|---|
| Font family | Discord Default | 17 options including Google Fonts; each shown in its own font in the picker |
| Font size | 14px | Label font size (10–20px slider) |
| Font weight | Normal | Normal, Medium, or Bold |
| Text color | (blank) | Any CSS color value (e.g. `#ff0000`); leave blank for theme-adaptive defaults |

**Label Style**

| Setting | Default | Description |
|---|---|---|
| Max width | 160px | Maximum label width before marquee activates (80–200px slider); also scales sidebar width |
| Corner radius | Pill | Label corner shape: Pill (16px), Rounded (8px), or Sharp (4px) |

**Behavior**

| Setting | Default | Description |
|---|---|---|
| Show tree connector | On | Show/hide the L-shaped branch connector for servers inside folders |
| Auto-collapse folder | Off | Collapse a folder automatically when navigating to a server inside it |

## How It Works

ServerLabels uses a `MutationObserver` to inject label `<span>` elements into Discord's guild nav DOM whenever the server list renders or re-renders. It avoids webpack patches entirely — early attempts to patch Discord's React components broke server icon clicking.

Key implementation details:

- **DOM injection** — Labels are appended inside the icon `<span>` (not after it), making the icon span the absolute positioning anchor. This preserves Discord's native icon centering without any layout hacks.
- **pointer-events: none** — Labels are invisible to Discord's event system. Clicks and hover effects are handled by document-level listeners that check bounding rects manually (`labelAtPoint()`). This is the only reliable way to suppress Discord's React-delegated tooltips.
- **CSS variable injection** — Settings are written into a `<style>` tag in `<head>` rather than inline on `document.documentElement`. Discord periodically rewrites the root element's `style` attribute for its own theming, which would silently wipe inline custom properties.
- **Folder color** — `SortedGuildStore` is used to look up each guild's parent folder and extract `folderColor` (a raw integer), which is converted to a hex CSS string and applied as an inline `--serverlabels-folder-color` variable. In dark theme, opacity is 40% closed / 20% open; in light theme it's bumped to 60% / 40% so dark folder colors remain legible on Discord's white background. State is driven by `aria-expanded` observation rather than CSS structural selectors (which can't reach sibling subtrees).
- **Folder open state sync** — The observer watches `aria-expanded` attribute changes on folder treeitems. A `Map<folderId, Set<label>>` index makes each sync an O(1) lookup rather than a full scan of all active labels.
- **Marquee scroll** — After each label is injected, `measureMarquee()` runs in a `requestAnimationFrame` to check whether the text overflows the pill width. If it does, `--marquee-offset` is set and a CSS animation scrolls the inner text span left-to-right on hover. Re-measurement is batched into a read pass then a write pass to avoid layout thrashing.
- **Light theme** — Discord adds `.theme-light` to `<html>` when the light theme is active. The CSS uses this class to switch labels to dark text on a subtle dark-tinted background.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

**Current version: v0.2.3**

## License

GPL-3.0-or-later — same license as Vencord itself.
