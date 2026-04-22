# ServerLabels Changelog

## [0.1.9] — 2026-04-22

### Medium-priority review fixes + live folder color refresh

- **Live folder color updates** — added `refreshLabelColors()` which subscribes to `SortedGuildStore` via `addChangeListener`; folder and server label colors now update immediately when a folder color is changed in Discord settings, without requiring a restart; also re-queries `guildsNav` on each fire to handle Discord replacing the nav element after a settings change (which was causing a stale reference and breaking cursor updates)
- **Cursor scoped to guild nav** — `document.body.style.cursor` replaced with `guildsNav.style.cursor`; cursor change is now limited to the guild nav element rather than the entire document body, preventing potential conflicts with other plugins or Discord features; `guildsNav` is set when the nav is first found (or bootstrapped) and cleared to `""` in `stop()`
- **Stale `activeLabels` pruning in observer** — `MutationObserver` callback now iterates `activeLabels` and removes any disconnected entries at the start of each mutation batch; previously, detached labels (e.g. from folder collapse) were only pruned lazily inside `labelAtPoint()` on the next mousemove or click
- **Dropped folder ID length heuristic** — removed `|| idStr.length > 15` guard from `injectFolderLabel()`; the `SortedGuildStore` lookup (`folderId === idNum`) is the authoritative discriminator between folder and guild IDs; guild snowflake IDs (~18 digits) exceed JS's safe integer range and cannot match any ~10-digit folder ID even after numeric conversion
- **Connector border colors use Discord CSS variable** — `rgba(255, 255, 255, 0.35)` on the L-shaped tree branch connector (`border-left`, `border-bottom`) replaced with `var(--text-muted)` for better theme compatibility

## [0.1.8] — 2026-04-21

### Observer and label injection optimizations

- **`applyAllLabels()` now queries the DOM once** — previously called `document.querySelectorAll(TREEITEM_SELECTOR)` twice (once for `injectLabel`, once for `injectFolderLabel`), building and iterating the full NodeList twice per call; merged into a single query with both inject functions called per element
- **MutationObserver now processes only newly added nodes** — previously the observer detected whether any added node was a guild treeitem and then called `applyAllLabels()`, re-scanning the entire guild list on every mutation; the callback now iterates `mutation.addedNodes` directly, calling `injectLabel` and `injectFolderLabel` only on each new treeitem (or treeitems found within it); both functions already guard against double-injection so processing the same element twice is harmless
- **Removed `applyRafId` RAF debounce** — was introduced in v0.1.7 to coalesce rapid `applyAllLabels()` calls; no longer needed because the observer no longer calls `applyAllLabels()` at all; `applyAllLabels()` is retained for the synchronous initial call in `start()`

## [0.1.7] — 2026-04-21

### Performance fixes (MutationObserver, label cache, RAF debounce)

- **Scoped MutationObserver to guild sidebar nav** — previously observed `document.body` with `{ childList: true, subtree: true }`, which fired on every DOM change in the entire Discord app (chat messages, modals, animations, etc.); now observes only `nav[class*="guilds"]`, limiting callbacks to the guild sidebar subtree; a short-lived bootstrap observer on `document.body` handles the rare case where the nav isn't in the DOM yet when the plugin starts
- **Cached active labels in a `Set<HTMLElement>`** — `labelAtPoint()` and the `mousemove` handler previously called `document.querySelectorAll` on every RAF frame; replaced with a module-level `activeLabels` Set that is updated by `injectLabel()` / `injectFolderLabel()` on injection and cleared by `removeAllLabels()` on stop, turning O(n) DOM queries into O(1) Set iterations per frame
- **Added `isConnected` pruning in `labelAtPoint()`** — when Discord removes guild treeitems from the DOM (e.g. folder collapse), their labels become detached but remained in `activeLabels`; detached elements return `{top:0,left:0,right:0,bottom:0}` from `getBoundingClientRect()`, which matched the `clientX:0,clientY:0` coordinates of any programmatic `.click()` call, causing the folder expand/collapse handler to be intercepted and swallowed; stale entries are now pruned from the Set on first encounter in `labelAtPoint()`
- **RAF debounce on `applyAllLabels()` in the MutationObserver** — rapid DOM mutations (e.g. opening a folder with many servers) previously triggered `applyAllLabels()` — which queries the full guild list — on every individual mutation; added an `applyRafId` guard so at most one `applyAllLabels()` runs per animation frame regardless of burst size
- Added `applyRafId` and `navBootstrapObserver` module variables; both are cancelled/disconnected in `stop()` to prevent leaks across plugin stop/start cycles

## [0.1.6] — 2026-04-20

### Tooltip suppression via pointer-events

- Eliminated Discord's server-name tooltip appearing when hovering over labels
- Root cause: Discord's tooltip system uses React event delegation at the root container level, which fires before any native event listener — making `stopPropagation()` and CSS `:has()` suppression both ineffective against it
- Fix: all labels (guild and folder) now carry `pointer-events: none`, making them invisible to Discord's event system; when the cursor is over a label it is treated as hovering the sidebar background (outside the treeitem), so Discord never fires the tooltip
- Guild label clicks replaced with a document-level capture-phase click listener that checks bounding rects via `labelAtPoint()` and calls `NavigationRouter.transitionToGuild()` for whichever label contains the click coordinates
- Folder label clicks replaced with a document-level handler that reads `data-folder-id` from the label, locates the folder's treeitem via `querySelector`, and programmatically calls `.click()` on it to preserve Discord's native expand/collapse behavior
- Hover opacity effect and `cursor: pointer` replaced with a document-level `mousemove` listener (RAF-throttled) that manually toggles a `vc-serverlabels-name--hover` CSS class and sets `document.body.style.cursor`
- Removed all previous CSS-based tooltip suppression rules (`[role="tooltip"]`, `[style*="--reference-position-layer-max-height"]`, `div[id^="uid_"]`, body class toggling) — no longer needed
- Added `data-folder-id` attribute to folder labels in `injectFolderLabel()` to support the document-level click handler
- Added `rafId` module variable for cancelling the pending animation frame on plugin stop

## [0.1.5] — 2026-04-20

### Label polish and folder tree lines

- Changed label shape from pill (`border-radius: 100px`) to rectangular button (`border-radius: 4px`)
- Increased label padding to `5px 12px` (from `3px 10px`) for more breathing room around the text
- Added `min-width: 120px` so short server names get the same baseline pill size instead of a tiny sliver — improves size consistency across all labels
- Added tree branch connector lines for servers inside folders: an L-shaped `::before` element (vertical + horizontal border) is drawn on the icon span to the left of each folder-server label, visually indicating nesting
- Added `isInFolder()` helper in `index.tsx` that checks `SortedGuildStore` for folder membership; sets `data-in-folder="true"` on the label so the connector CSS can target it without touching folder-color logic
- Connector is drawn via `:has(> [data-in-folder="true"])::before` on the iconSpan rather than `::before` on the label itself — the label has `overflow: hidden` for text ellipsis which would clip a pseudo-element placed on it directly
- Added CSS rule to suppress Discord's portal-rendered hover tooltips (`div[id^="uid_"]`, direct children of `<body>`) while the cursor is anywhere inside the guild nav sidebar, using a `:has(nav:hover)` body-level selector scoped to `vc-serverlabels-active`
- Added `suppressNativeTooltip()` helper in `index.tsx` that strips `title` HTML attributes and SVG `<title>` child elements from each guild nav treeitem on label injection, eliminating native browser tooltips that appeared over small portions of server/folder icons

## [0.1.4] — 2026-04-20

### Settings persistence fix

- Fixed settings (font size, font weight, max width) visually resetting to defaults shortly after being changed, even though the saved values were correct
- Root cause: CSS variables were written to `document.documentElement` via inline `style.setProperty()` — Discord periodically rewrites the inline `style` attribute on the root element for its own theming, wiping out any custom properties we had set there
- Fix: CSS variables are now written into an injected `<style>` element in `<head>` (id: `vc-serverlabels-vars`) rather than inline on `document.documentElement`; Discord has no reason to touch a `<style>` tag, so the variables persist reliably
- The `<style>` element is created on plugin start and removed on plugin stop
- Also added `onChange` callbacks to all three settings so the style tag updates immediately when a setting is changed, without needing to toggle the plugin

## [0.1.3] — 2026-04-20

### Folder name labels

- Folder names now appear next to folder icons in the guild sidebar, matching the same pill style as server labels
- Fixed folder data field names: `SortedGuildStore` returns `folderId`, `folderName`, and `folderColor` — not `id`, `name`, and `color`; this also corrected folder color tinting on server labels inside colored folders (was broken since v0.1.1)
- Fixed folder ID format: Discord's `data-list-item-id` for folders is `guildsnav___NUMERICID` (no `folder-` prefix), not `guildsnav___folder-NUMERICID` as previously assumed
- Changed DOM strategy for folder label injection: folder items have no `<span>` ancestor, so the label is now appended directly into the `folderButton` element (the treeitem itself) rather than via an upward SPAN walk
- Added two nested CSS `:has()` rules to propagate `overflow: visible` from `folderButton` up through `folderHeader` and `listItem`, preventing those ancestor divs from clipping the absolutely-positioned label

## [0.1.2] — 2026-04-20

### Icon vertical alignment fix

- Fixed server icons being pushed to the left of the sidebar instead of sitting at their natural centered position
- Root cause: the label was appended after the icon `<span>` (as a sibling inside `listItem`), requiring `width: fit-content` on `listItem` to make `left: 100%` land after the icon — but shrinking `listItem` broke Discord's horizontal centering of the icon row
- Fix: label is now appended **inside** the icon `<span>` via `iconSpan.appendChild(label)` instead of `iconSpan.after(label)`, making the iconSpan the absolute positioning anchor — it is already icon-sized so `left: 100%` works correctly with no width manipulation
- Removed `width: fit-content !important` and `align-self: flex-start !important` from the `:has(> .vc-serverlabels-name)` CSS rule; Discord's default icon layout is now fully preserved
- Fix applies to both standalone servers and servers inside open folders

## [0.1.1] — 2026-04-19

### Clickable labels with folder color matching

- Labels are now interactive — clicking one navigates to that server via `NavigationRouter.transitionToGuild(guildId)`
- Labels use `role="button"`, `tabindex="0"`, and `aria-label` for accessibility
- `SortedGuildStore` (via `findStoreLazy`) is used to look up which folder each guild belongs to; the folder's color integer is converted to a CSS hex string and applied as `--serverlabels-folder-color` inline on each label
- Labels inside a colored folder display that folder's color as their background; labels with no folder color fall back to `rgba(255,255,255,0.1)`
- Pill-shaped styling added: `border-radius: 100px`, `padding: 3px 10px`, hover/active opacity transitions
- Fixed layout regression caused by the new padding: changed `flex-shrink` from `1` to `0` so flex cannot compress the label's content area to near zero, and added a `:has(> .vc-serverlabels-name)` rule to let the direct parent row grow to fit the label
- `cursor: pointer` added; `pointer-events: none` and `user-select: none` removed

## [0.1.0] — 2026-04-19

### Initial release

- Plugin scaffold created with `definePlugin`, author info, and GPL-3.0-or-later license header
- Added `README.md` per Vencord plugin documentation requirements
- Implemented `MutationObserver`-based label injection — walks up from each guild's `role="treeitem"` DOM node to find the icon `<span>`, then inserts the server name as a sibling inside Discord's existing `listItem` flex row without wrapping or disturbing any of Discord's original elements
- Guild names sourced from `GuildStore.getGuild(guildId)` using the guild ID extracted from each item's `data-list-item-id="guildsnav___..."` attribute
- Labels are automatically re-injected when the guild list re-renders (new notifications, folder expand/collapse, server reorder)
- CSS variables (`--serverlabels-font-size`, `--serverlabels-font-weight`, `--serverlabels-max-width`) written on plugin start so settings apply without a rebuild
- Plugin settings panel: font size (slider, 10–20px), font weight (normal/medium/bold), max label width (slider, 80–200px)
- Top-level guild sidebar widened via `nav:has(.vc-serverlabels-name)` CSS selector
- Expanded folder containers widened via `div:has(> ul[id^="folder-items-"])` and `ul[id^="folder-items-"]` selectors
- `body.vc-serverlabels-active` class added on start and removed on stop to scope all CSS without relying on Discord's hashed class names
- Labels removed cleanly on plugin stop; CSS variables cleaned up from document root
