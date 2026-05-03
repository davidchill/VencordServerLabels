# ServerLabels Changelog

## [0.2.5] — 2026-05-03

### Performance — font lazy-loading, reduced store calls, cheaper CSS selectors

**Font loading**
- **Google Fonts now lazy-load when the settings panel opens** — `start()` previously called `loadAllFonts()`, injecting a `<link>` for all 15 Google Fonts on every Discord launch regardless of whether settings were ever opened; replaced with `loadSelectedFont()` at startup (one request, ensures the active label renders in the right typeface); `FontFamilyPicker` now calls `loadAllFonts()` in a `React.useEffect` on mount so font previews in the dropdown are still fully functional; on unmount, `unloadNonSelectedFonts()` strips the 14 unused links, leaving only the selected font loaded
- **Granular font link tracking** — `fontLinkEls` changed from `HTMLLinkElement[]` to `Map<string, HTMLLinkElement>` to support per-font load/unload; added `loadFont(name)` (idempotent, skips if already loaded), `unloadFont(name)`, `loadSelectedFont()`, and `unloadNonSelectedFonts()` helpers

**Store call reduction**
- **`injectLabel` and `injectFolderLabel` now accept a pre-fetched `folders` array** — previously each function called `SortedGuildStore.getGuildFolders()` independently; with 100 servers `applyAllLabels()` was making ~200 redundant calls; both functions now take `folders: any[]` as a parameter
- **`applyAllLabels()` fetches folders once** — single `getGuildFolders()` call at the top, passed to both inject functions
- **MutationObserver lazy-fetches folders once per batch** — a `getFolders()` initializer inside the callback uses `??=` so folders are only fetched if the batch actually contains treeitem nodes, and at most once per callback regardless of how many nodes were added
- **`getFolderColor()` deleted** — `refreshLabelColors()` already fetched the `folders` array at the top of the function; the guild-label branch was delegating to `getFolderColor()` which called `getGuildFolders()` again internally; inlined the `.find()` lookup using the already-fetched array and removed the helper

**CSS selector performance**
- **Replaced nested `:has()` chains with a JS-applied class** — two rules (`:has(> *:has(> .vc-serverlabels-name))` and `:has(> *:has(> *:has(> .vc-serverlabels-name)))`) were the most expensive selectors in the stylesheet; replaced with `.vc-serverlabels-active .vc-serverlabels-anc { overflow: visible }`; `injectFolderLabel()` now adds `vc-serverlabels-anc` to the 1st and 2nd ancestor elements of each folder label at inject time; `removeAllLabels()` strips the class from all marked elements on plugin stop

## [0.2.4] — 2026-04-24

### Settings UI — 2-column layout and native Discord controls throughout

**Layout**
- **2-column grid layout** — settings panel now arranges controls side-by-side in pairs: Font Family | Font Color, Font Size | Font Weight, Label Radius | Max Width; Behavior toggles remain full-width; implemented via new `SettingsRow2Col` and `SettingsCell` React components using a CSS grid (`1fr 1fr`, `gap: 16px`)
- **Individual settings replaced with row COMPONENT pairs** — `fontFamily`, `fontSize`, `fontWeight`, `fontColor`, `maxWidth`, and `labelRadius` are no longer declared as individual setting entries; their values still persist via `settings.store`; `updateCSSVars()` updated with `?? default` fallbacks to handle first-run initialisation without declared defaults

**Native Discord controls**
- **Font Family** — custom `FontFamilyPicker` replaced with `SearchableSelect` (imported from `@webpack/common`); per-option font preview retained via `renderOptionLabel` (each option name renders in its own typeface); selected font preview in the trigger button retained via `renderOptionValue`; search/filter field included by default
- **Font Weight, Label Radius** — plain HTML `<select>` replaced with Discord's native `Select` component (`select`, `isSelected`, `serialize`, `closeOnSelect`)
- **Font Size, Max Width** — plain HTML `<input type="range">` replaced with Discord's native `Slider` component (`markers`, `minValue`, `maxValue`, `initialValue`, `stickToMarkers`, `onValueChange`, `onValueRender`); Font Size uses markers `[10, 12, 14, 16, 18, 20]` with `stickToMarkers: true`; Max Width uses markers `[80, 120, 160, 200]` with `stickToMarkers: false` for continuous drag
- **Font Color** — plain HTML `<input type="text">` replaced with Discord's native `TextInput` component
- **Section headers** — custom inline-styled `<span>` replaced with `Forms.FormTitle` (tag `h5`), which uses Discord's native `--header-secondary` variable and adapts correctly to both dark and light themes; resolves the dark/washed-out appearance of section headers in prior versions

**Imports added:** `Forms`, `SearchableSelect`, `Select`, `Slider`, `TextInput` from `@webpack/common`

**CSS cleanup**
- Removed: `.vc-serverlabels-font-trigger`, `.vc-serverlabels-font-caret`, `.vc-serverlabels-font-dropdown`, `.vc-serverlabels-font-option` — no longer needed with `SearchableSelect`
- Removed: `.vc-serverlabels-select`, `.vc-serverlabels-text-input`, `.vc-serverlabels-slider-cell`, `.vc-serverlabels-slider-value` — no longer needed with native Discord controls
- Retained: `.vc-serverlabels-settings-row`, `.vc-serverlabels-settings-cell`, `.vc-serverlabels-settings-cell-label` — used for the 2-column grid layout and cell labels

## [0.2.3] — 2026-04-24

### Settings shortcut button in the sidebar

**New feature**
- **Settings shortcut button** — a circular gear button is now injected at the right edge of the guild sidebar, vertically aligned with the home/DM row at the top; clicking it opens the ServerLabels plugin settings modal directly, bypassing the Discord Settings → Vencord → Plugins navigation flow

**Implementation**
- Added `injectSettingsButton()` — finds `[data-list-item-id="guildsnav___home"]`, uses `.closest('nav[class*="guilds"]')` to locate the guild nav, calculates the button's vertical offset from the home row's bounding rect (`homeRect.top - navRect.top + (homeRect.height - 32) / 2`), and appends a `<button>` as a direct child of `guildsNav` with `position: absolute; right: 8px; top: {computed}px`; bails early if the nav has zero height (not yet laid out) so the MutationObserver can retry
- Added `removeSettingsButton()` — removes the button on plugin `stop()` and clears the `settingsBtn` module reference
- `openPluginModal` imported from `@components/settings/tabs/plugins/PluginModal`; plugin instance retrieved at click time via `window.Vencord.Plugins.plugins["ServerLabels"]`
- Button click calls `stopPropagation()` and `preventDefault()` to prevent the home treeitem from receiving the click
- Re-injection guard added to the MutationObserver `childList` branch so the button survives Discord nav re-renders
- `settingsBtn` module-level variable added alongside `guildsNav`
- `position: relative` added to `.vc-serverlabels-active nav:has(.vc-serverlabels-name)` so the button is positioned within the nav rather than a more distant ancestor
- CSS: `.vc-serverlabels-settings-btn` — 32×32px circle, `position: absolute; right: 8px`, `pointer-events: auto` (unlike labels), `opacity: 0.7` base with `1.0` on hover; hover also brightens the background; light theme variant with dark icon color

## [0.2.2] — 2026-04-24

### Settings page restructuring, font picker restyling, and docs/path cleanup

**Settings page**
- **Three labelled sections** — settings panel now groups controls under `Typography`, `Label Style`, and `Behavior` section headers; headers are rendered via `OptionType.COMPONENT` entries using a `SettingsSection` React component (bold uppercase label + horizontal rule)
- **Section header color fixed** — header text uses `var(--text-normal)` instead of `var(--header-secondary)`, which was resolving too dark in dark mode and too light in light mode inside the settings panel context
- **Setting descriptions shortened** — labels trimmed for compactness (e.g. "Font size of server name labels (px)" → "Font size (px)", "Corner radius style for labels" → "Corner radius")

**Font family picker**
- **Trigger restyled to match native controls** — height raised to 36px, border-radius tightened to 3px, background changed to `var(--input-background, #1e1f22)` to align with Discord's SELECT appearance; hover now changes border-color rather than background; caret extracted into `.vc-serverlabels-font-caret` class (9px, 0.6 opacity); dropdown gap reduced from 4px to 2px; max-height reduced from 320px to 280px
- **Per-font previews retained** — `loadAllFonts()` / `FontFamilyPicker` remain intact; all 17 fonts preloaded at plugin start so each option renders in its own typeface immediately

**File structure**
- **Duplicate plugin folder removed** — `src/plugins/serverLabels/` (created during earlier load debugging) has been deleted; `src/userplugins/serverLabels/` is now the sole working copy

**Documentation**
- **README** — `pnpm build` corrected to `pnpm buildStandalone` in installation steps and note; settings table reorganized into three grouped sections matching the actual settings page layout; changelog link corrected to relative `CHANGELOG.md`
- **CLAUDE.md** — plugin path updated from `src/plugins/` to `src/userplugins/`; Files section updated (`index.ts` → `index.tsx`)
- **style.css** — two inline comments updated from `index.ts` to `index.tsx`

## [0.2.1] — 2026-04-23

### Settings & QoL — corner radius, connector toggle, auto-collapse, font family picker, font color, sidebar auto-scaling

**New settings**
- **Corner radius** (`labelRadius`) — SELECT: Pill (16px), Rounded (8px), Sharp (4px); defaults to Pill; applies uniformly to all label types via `--serverlabels-radius` CSS variable; removed the three separate hardcoded `border-radius` overrides from `style.css` that previously set each label type independently
- **Show tree connector** (`showTreeConnector`) — BOOLEAN (default on); toggles the L-shaped branch connector drawn before in-folder server labels; implemented via `vc-serverlabels-no-connector` body class toggled on `onChange` and applied in `start()`; cleaned up in `stop()`
- **Auto-collapse folder** (`autoCollapseFolder`) — BOOLEAN (default off); when a server label inside a folder is clicked, programmatically clicks the parent folder treeitem to collapse it if currently expanded; logic added inside `onDocumentClick` after `NavigationRouter.transitionToGuild()`
- **Font family** (`fontFamily`) — `OptionType.COMPONENT` backed by a custom `FontFamilyPicker` React component; 17 options across four categories — Discord Default (no load), Clean & Modern (Inter, Roboto, Poppins, Nunito, DM Sans, Lato), Bold & Dramatic (Oswald, Bebas Neue), Stylish (Playfair Display), Fun & Expressive (Pacifico, Lobster, Dancing Script, Righteous, Bangers), Techy (Space Mono, Press Start 2P); all Google Fonts are pre-loaded via `loadAllFonts()` at plugin start so every option renders in its own font immediately; the picker dropdown shows each font name styled in that font; selection writes directly to `settings.store.fontFamily` and calls `updateCSSVars()`; `unloadAllFonts()` removes all `<link>` tags on `stop()`
- **Font color** (`fontColor`) — STRING (default empty); accepts any CSS color value; when non-empty, writes `--serverlabels-color` to the CSS vars tag and adds `vc-serverlabels-custom-color` body class, which overrides the theme-adaptive defaults (dark: white, light: `#060607`) via a cascade-ordered rule in `style.css`; empty value preserves existing theme-adaptive behavior with no regression

**QoL improvements**
- **Sidebar width auto-scales with Max Width setting** — replaced hardcoded `min-width: 260px; max-width: 300px` on the guild nav with `calc(var(--serverlabels-max-width, 160px) + 100px)` / `+ 140px`; at the default 160px max-width the values are identical to the previous hardcoded values; dragging the slider now also widens or narrows the sidebar proportionally
- **Font picker dropdown visibility fix** — initial inline-style approach (`var(--input-background)`, `var(--background-floating)`) produced transparent backgrounds in Vencord's settings panel context; moved trigger, dropdown, and option styles into `style.css` as CSS classes (`.vc-serverlabels-font-trigger`, `.vc-serverlabels-font-dropdown`, `.vc-serverlabels-font-option`) with hardcoded hex fallbacks (`#1e1f22`, `#3f4248`); `fontFamily` remains the only inline style since it must be dynamic per-option; `onMouseEnter`/`onMouseLeave` JS handlers removed in favour of CSS `:hover`

**File changes**
- **`index.ts` renamed to `index.tsx`** — required for JSX; `FontFamilyPicker` is a `function` declaration (hoisted) so `settings` can safely reference it in the `component` lambda above its source position; `React` added to `@webpack/common` imports
- **`FONT_CATALOG`** — typed `Record<string, FontEntry>` (`{ url: string | null; css: string }`) replacing the old four-option SELECT values; adding or removing a font is one line

## [0.2.0] — 2026-04-23

### In-folder height reduction and code cleanup

**Visual**
- **In-folder server label height reduced to 34px** — changed from 36px to 34px, increasing the size differential between folder labels (38px) and nested server labels; the smaller pill reduces visual weight inside open folders

**Code cleanup**
- **Consolidated triple `getGuildFolders()` passes in `injectLabel`** — `injectLabel` previously called `getGuildFolders()` three times per guild: once via `getFolderColor()`, once via `isInFolder()`, and once directly to retrieve the parent folder ID; all three are now collapsed into a single `folders.find()` pass that derives `folderColor` and `parentFolderId` together
- **Removed `isInFolder()` helper** — had a single call site inside `injectLabel`; after the consolidation above it had no remaining callers and was deleted
- **Removed `patches: []` from `definePlugin`** — passing an empty array is identical to omitting the property; removed to reduce noise

**Documentation**
- **Stale CSS comment corrected** — comment above the height rules still referenced `39px` for in-folder servers (changed in v0.1.15); updated to reflect the current `34px` value and revised rationale

## [0.1.16] — 2026-04-23

### Code review nitpick fixes

- **`index.tsx` renamed to `index.ts`** — the file contained zero JSX across 463 lines; the `.tsx` extension was misleading; renamed via `git mv` with no functional change
- **`pruneLabel()` now cleans up empty Map entries** — when the last label for a folder was removed from `labelsByFolder`, the Map entry remained with an empty `Set`; after `s.delete(el)`, a size check now removes the Map entry entirely if the Set is empty; functionally harmless previously but a minor memory leak in long sessions
- **Light theme folder color opacity bumped** — dark folder colors (dark blue, purple) at 40% opacity on Discord's white background had insufficient contrast; closed-state opacity raised from 40% to 60%, open-state from 20% to 40%; dark theme values unchanged
- **README changelog path corrected** — link pointed to `Vencord/src/plugins/serverLabels/CHANGELOG.md`; corrected to `Vencord/src/userplugins/serverLabels/CHANGELOG.md` to match the actual installation path
- **README updated** — `index.tsx` → `index.ts` in installation instructions; "How It Works" updated to reflect new light-theme opacity values; current version bumped; bundle checklist added to `CLAUDE.md`
- **CSS comments updated** — two comments in `style.css` still referenced `index.tsx`; corrected to `index.ts`

## [0.1.15] — 2026-04-23

### Height adjustment and README refresh

- **In-folder server label height reduced to 36px** — changed from 39px to 36px, making nested server labels exactly 2px shorter than their parent folder labels (38px); creates a subtle visual hierarchy between folder and server rows
- **README updated** — corrected max width default (150px → 160px); added missing features (marquee scroll, light theme support, folder color open/closed opacity); expanded "How It Works" with `aria-expanded` observation, `labelsByFolder` O(1) index, marquee measurement detail, and light theme CSS approach; bumped version to v0.1.14 (was showing v0.1.13)

## [0.1.14] — 2026-04-23

### Code review fixes — accessibility, correctness, and performance

**Accessibility**
- **`aria-label` added to folder labels** — `injectFolderLabel()` now calls `label.setAttribute("aria-label", folder.folderName)`; guild labels already had this attribute; folder labels were the only remaining gap

**Bug fixes**
- **`navBootstrapObserver` now uses `subtree: true`** — the bootstrap observer (used when the guild nav isn't in the DOM at plugin start) was watching `document.body` with `{ childList: true }` only; without `subtree: true` it would miss the nav if it mounted anywhere below the direct children of body, which is the common case in Discord's Electron shell; one-character fix but a real reliability gap
- **`measureMarquee` padding derived from computed style** — the magic constant `24` (representing `12px padding × 2`) has been replaced with `getComputedStyle(label).paddingLeft + paddingRight`; the padding value changed once already (v0.1.10 → v0.1.11); deriving it at runtime ensures marquee offsets stay correct if CSS ever changes again

**Performance**
- **`remeasureAllMarquees` splits reads and writes** — previously the function called `measureMarquee` per label, interleaving DOM reads (`scrollWidth`, `clientWidth`) with DOM writes (`style.setProperty`, `classList`); this causes layout thrashing (each read forces the browser to flush pending style changes before returning a value); the function now does a read pass to collect all measurements, then a write pass to apply them; low practical impact since settings changes are infrequent, but the correct pattern
- **`syncFolderOpenState` is now O(1) via `labelsByFolder` index** — previously iterated all of `activeLabels` on every folder expand/collapse to find labels belonging to that folder; a new `Map<string, Set<HTMLElement>>` keyed by `parentFolderId` is maintained alongside `activeLabels`; `syncFolderOpenState` now does a single map lookup and iterates only that folder's children; a shared `pruneLabel()` helper keeps both structures in sync on removal

**Documentation**
- **README version updated** — was still showing `v0.1.6`; now reads `v0.1.13`

**Not pursued — CSS variable base colors (Batch C)**
- The external code review recommended swapping `color: #ffffff` and `background-color: rgba(255, 255, 255, 0.1)` for Discord's `var(--text-normal)` and `var(--background-modifier-hover)` so custom themes adapt automatically; this was attempted in an earlier session and confirmed non-viable: both variables resolve as grey/muted inside Discord's guild sidebar Electron context rather than the expected theme colors; the `.theme-light` override approach introduced in v0.1.10 remains the confirmed workaround

## [0.1.13] — 2026-04-23

### Label detachment, dynamic width, and height reductions

- **Labels detached from icons** — `margin-left` changed from `0` to `8px`, creating a visual gap between the icon and label; the flat left edge (`border-radius: 0 4px 4px 0`) was replaced with fully rounded corners (`border-radius: 4px`) since flush attachment is no longer needed
- **Dynamic label width** — removed `min-width: 120px`; labels now size to their text content and only reach `max-width` before the marquee kicks in; short server names produce compact labels, long names expand naturally up to the cap
- **Standalone server label height reduced** — base `height` changed from `42px` to `32px`; reduces empty vertical space in the label background
- **Folder label height reduced** — `height` changed from `48px` to `38px`; brings folder labels closer in proportion to the new standalone server label height
- **In-folder server label height set explicitly** — `height: 39px` added to the `[data-in-folder="true"]` rule; was previously inheriting the base height, now explicitly set to remain slightly taller than standalone labels
- **Stale CSS comments updated** — inline comments referencing the old `48px`/`42px` heights updated to reflect current values

## [0.1.12] — 2026-04-22

### Marquee scroll on hover, rounded standalone server labels, Max Width default bump

- **Max Width default raised to 160px** — slider default changed from 150px to 160px; 160px added as an explicit marker on the slider
- **Marquee scroll on hover for truncated labels** — labels that overflow their max-width now scroll horizontally to reveal the full name when hovered; JS measures actual overflow after each label is inserted and stores it as a `--marquee-offset` CSS custom property; the CSS `@keyframes vc-serverlabels-marquee` animation translates the inner text span by that amount using `ease-in-out infinite alternate` (bounces back and forth while hovered); labels where text fits within the max-width get `--marquee-offset: 0px` and no class, so no animation fires
- **Right-edge fade signals truncation** — labels with actual overflow receive the `vc-serverlabels-overflow` class, which applies a `mask-image` gradient fade on the right edge when not hovered; the fade is removed on hover so the scrolling text is fully visible as it passes through; labels without overflow never receive the class, so short labels keep a clean right edge
- **Label text wrapped in inner `<span>`** — required for marquee: the outer label pill has `overflow: hidden` to clip text, and the inner span translates independently; `aria-label` remains on the outer element for accessibility
- **Marquee re-measures on Max Width setting change** — `updateCSSVars()` triggers `requestAnimationFrame(remeasureAllMarquees)` after updating the CSS variable so overflow amounts stay accurate as the slider is adjusted
- **Marquee start delay halved** — initial pause before scrolling begins reduced from 15% to 8% of the 3s animation duration (~0.45s → ~0.24s); end pause adjusted symmetrically (85% → 92%)
- **Folder labels now scroll on hover** — `onDocumentMouseMove` was guarding hover-class toggling behind `el.dataset.guildId`, excluding folder labels; guard removed so both server and folder labels receive `vc-serverlabels-name--hover` and trigger the marquee animation
- **Standalone server labels adopt rounded corners** — `.vc-serverlabels-name[data-guild-id]:not([data-in-folder])` now has `border-radius: 16px` to match the rounder folder label style; height remains 42px (not bumped to 48px like folder labels) since standalone server icons are smaller and 48px caused overlap

## [0.1.11] — 2026-04-22

### Visual overhaul — label backgrounds, folder transparency, and gap equalization

- **Label backgrounds match icon height** — changed from `padding: 5px 12px` with `top: 50%; transform: translateY(-50%)` to `display: inline-flex; align-items: center; height: 42px; top: 50%; transform: translateY(-50%)` so label backgrounds span the full 42px server icon height with text vertically centered
- **Labels flush against icons** — removed `margin-left: 8px` gap; set `border-radius: 0 4px 4px 0` (flat left edge, rounded right) so labels appear attached to their icon
- **Folder color transparency** — replaced solid `background-color: var(--serverlabels-folder-color)` with `color-mix(in srgb, var(--serverlabels-folder-color) 40%, transparent)` on colored labels to match Discord's semi-transparent folder icon appearance
- **Open-folder transparency shift** — folder labels dim further to 20% opacity when expanded via `[aria-expanded="true"] > .vc-serverlabels-name[data-has-color="true"]`, matching Discord's folder icon open-state appearance
- **In-folder server label transparency sync** — JS-driven: `MutationObserver` now also watches `aria-expanded` attribute changes (`attributeFilter: ["aria-expanded"]`); `syncFolderOpenState()` toggles `vc-serverlabels-folder-open` class on all server labels whose `data-parent-folder-id` matches the toggled folder; CSS targets that class for the 20% opacity shift; each server label stores its parent folder ID at injection time and initializes its open/closed state immediately from the current DOM
- **In-folder server labels get full border-radius** — added `border-radius: 4px` to `.vc-serverlabels-name[data-in-folder="true"]`; these labels have a `23px` left margin (for the connector), so their left side is not flush with the icon and benefits from rounded corners on all sides
- **Light mode text contrast fix** — removed `color: #ffffff` from `.theme-light .vc-serverlabels-name[data-has-color="true"]`; at 20–40% background opacity, white text on Discord's light background has near-zero contrast; the base light theme `color: #060607` now applies to colored labels in light mode
- **Folder labels match icon dimensions exactly** — added `.vc-serverlabels-name[data-folder-id]` rule with `height: 48px` (matching the 48×48px `folderPreviewWrapper` confirmed via DevTools) and `border-radius: 16px` (matching the icon's border-radius on all four corners), making folder label backgrounds appear as a seamless continuation of the folder icon shape
- **Gap equalization between folder and first server** — added `margin-top: 4px` to `ul[id^="folder-items-"] > :first-child`; the folder label's extra height (48px vs 42px) caused the folder→first-server visual gap to be ~3px narrower than the server→server gap; this margin restores parity

## [0.1.10] — 2026-04-22

### Light theme support, observer stability, and nested server indentation

- **Light theme support** — added `.theme-light .vc-serverlabels-name` override in `style.css` that sets `color: #060607` and `background-color: rgba(0, 0, 0, 0.12)`; the dark-mode base rule (`color: #ffffff`, `background-color: rgba(255, 255, 255, 0.1)`) is unchanged; a companion `.theme-light .vc-serverlabels-name[data-has-color="true"]` rule explicitly restores the folder color and white text for colored labels, which was required to beat the base light-theme rule on specificity; Discord's `.theme-light` class on the `<html>` element is used as the theme signal rather than CSS variables, which were found to not resolve reliably in this context
- **Explicit `color: #ffffff` on colored labels** — added to the `.vc-serverlabels-name[data-has-color="true"]` rule to guarantee pure white text on vivid folder-color backgrounds in both themes; previously the base `color: #ffffff` applied by inheritance but was fragile once per-theme overrides were introduced
- **Observer reconnects when Discord replaces the nav element** — `refreshLabelColors()` now detects when `document.querySelector('nav[class*="guilds"]')` returns a different element than the stored `guildsNav` reference, disconnects the old `MutationObserver`, reattaches it to the new nav, and calls `applyAllLabels()` to re-inject labels into the fresh DOM; previously the observer silently stopped receiving mutations after a nav replacement (e.g. after a theme switch), breaking label injection until the plugin was restarted
- **Disconnected label pruning in `refreshLabelColors()`** — `activeLabels.delete(el)` is now called when a disconnected entry is found during the color refresh loop, matching the pruning behaviour already present in the `MutationObserver` callback and `labelAtPoint()`; previously the loop only skipped stale entries with `continue`, leaving them in the set indefinitely
- **Increased nested server indentation** — `margin-left` on `.vc-serverlabels-name[data-in-folder="true"]` increased from `18px` to `23px` to make the visual hierarchy between folder labels and their member servers more distinct

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
