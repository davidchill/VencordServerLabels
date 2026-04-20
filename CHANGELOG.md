# ServerLabels Changelog

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
