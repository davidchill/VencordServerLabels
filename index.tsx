/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { openPluginModal } from "@components/settings/tabs/plugins/PluginModal";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy } from "@webpack";
import { GuildStore, NavigationRouter, React } from "@webpack/common";

const SortedGuildStore = findStoreLazy("SortedGuildStore");

interface FontEntry { url: string | null; css: string; }
const FONT_CATALOG: Record<string, FontEntry> = {
    // Special
    "Discord Default":  { url: null,                                                                                               css: "var(--font-primary)" },
    // Clean & modern
    "Inter":            { url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap",                    css: '"Inter", sans-serif' },
    "Roboto":           { url: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",                   css: '"Roboto", sans-serif' },
    "Poppins":          { url: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap",                  css: '"Poppins", sans-serif' },
    "Nunito":           { url: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;700&display=swap",                   css: '"Nunito", sans-serif' },
    "DM Sans":          { url: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap",                  css: '"DM Sans", sans-serif' },
    "Lato":             { url: "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",                         css: '"Lato", sans-serif' },
    // Bold & dramatic
    "Oswald":           { url: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;700&display=swap",                   css: '"Oswald", sans-serif' },
    "Bebas Neue":       { url: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",                                css: '"Bebas Neue", sans-serif' },
    // Stylish
    "Playfair Display": { url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap",             css: '"Playfair Display", serif' },
    // Fun & expressive
    "Pacifico":         { url: "https://fonts.googleapis.com/css2?family=Pacifico&display=swap",                                  css: '"Pacifico", cursive' },
    "Lobster":          { url: "https://fonts.googleapis.com/css2?family=Lobster&display=swap",                                   css: '"Lobster", cursive' },
    "Dancing Script":   { url: "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap",               css: '"Dancing Script", cursive' },
    "Righteous":        { url: "https://fonts.googleapis.com/css2?family=Righteous&display=swap",                                 css: '"Righteous", cursive' },
    "Bangers":          { url: "https://fonts.googleapis.com/css2?family=Bangers&display=swap",                                   css: '"Bangers", cursive' },
    // Techy
    "Space Mono":       { url: "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap",                   css: '"Space Mono", monospace' },
    "Press Start 2P":   { url: "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap",                            css: '"Press Start 2P", monospace' },
};

const settings = definePluginSettings({
    // ── Typography ──────────────────────────────────────────────────────────
    typographyHeader: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => <SettingsSection title="Typography" />,
    },
    fontFamily: {
        type: OptionType.COMPONENT,
        description: "Font family",
        default: "Discord Default",
        component: () => <FontFamilyPicker />,
    },
    fontSize: {
        type: OptionType.SLIDER,
        description: "Font size (px)",
        default: 14,
        markers: [10, 12, 14, 16, 18, 20],
        onChange: () => updateCSSVars(),
    },
    fontWeight: {
        type: OptionType.SELECT,
        description: "Font weight",
        options: [
            { label: "Normal", value: "400", default: true },
            { label: "Medium", value: "500" },
            { label: "Bold", value: "700" },
        ],
        onChange: () => updateCSSVars(),
    },
    fontColor: {
        type: OptionType.STRING,
        description: "Text color — any CSS color (e.g. #ff0000). Leave blank for theme-adaptive defaults.",
        default: "",
        onChange: () => updateCSSVars(),
    },
    // ── Label Style ─────────────────────────────────────────────────────────
    labelStyleHeader: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => <SettingsSection title="Label Style" />,
    },
    maxWidth: {
        type: OptionType.SLIDER,
        description: "Max width (px)",
        default: 160,
        markers: [80, 100, 120, 150, 160, 180, 200],
        onChange: () => updateCSSVars(),
    },
    labelRadius: {
        type: OptionType.SELECT,
        description: "Corner radius",
        options: [
            { label: "Pill", value: "16px", default: true },
            { label: "Rounded", value: "8px" },
            { label: "Sharp", value: "4px" },
        ],
        onChange: () => updateCSSVars(),
    },
    // ── Behavior ─────────────────────────────────────────────────────────────
    behaviorHeader: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => <SettingsSection title="Behavior" />,
    },
    showTreeConnector: {
        type: OptionType.BOOLEAN,
        description: "Show the L-shaped branch connector for servers inside folders",
        default: true,
        onChange: (val: boolean) => document.body.classList.toggle("vc-serverlabels-no-connector", !val),
    },
    autoCollapseFolder: {
        type: OptionType.BOOLEAN,
        description: "Auto-collapse a folder when you navigate to a server inside it",
        default: false,
    },
});

const LABEL_CLASS = "vc-serverlabels-name";
const LABEL_HOVER_CLASS = "vc-serverlabels-name--hover";
const TREEITEM_SELECTOR = '[data-list-item-id^="guildsnav___"]';

let observer: MutationObserver | null = null;
let navBootstrapObserver: MutationObserver | null = null;
let styleEl: HTMLStyleElement | null = null;
const fontLinkEls: HTMLLinkElement[] = [];
let rafId: number | null = null;
let guildsNav: HTMLElement | null = null;
let settingsBtn: HTMLElement | null = null;

const activeLabels = new Set<HTMLElement>();
// Secondary index: parentFolderId → labels, so syncFolderOpenState is an O(1) lookup
// instead of a full scan of activeLabels on every folder expand/collapse.
const labelsByFolder = new Map<string, Set<HTMLElement>>();

function loadAllFonts() {
    for (const entry of Object.values(FONT_CATALOG)) {
        if (!entry.url) continue;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = entry.url;
        document.head.appendChild(link);
        fontLinkEls.push(link);
    }
}

function unloadAllFonts() {
    fontLinkEls.forEach(el => el.remove());
    fontLinkEls.length = 0;
}

function SettingsSection({ title }: { title: string; }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", marginTop: "4px" }}>
            <span style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-normal)",
                whiteSpace: "nowrap",
            }}>{title}</span>
            <div style={{ flex: 1, height: "1px", background: "var(--background-modifier-accent)" }} />
        </div>
    );
}

function FontFamilyPicker() {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selected, setSelected] = React.useState<string>(settings.store.fontFamily ?? "Discord Default");
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!isOpen) return;
        function onMouseDown(e: MouseEvent) {
            if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", onMouseDown);
        return () => document.removeEventListener("mousedown", onMouseDown);
    }, [isOpen]);

    function selectFont(name: string) {
        settings.store.fontFamily = name;
        setSelected(name);
        updateCSSVars();
        setIsOpen(false);
    }

    const currentCss = FONT_CATALOG[selected]?.css ?? "var(--font-primary)";

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
            <div className="vc-serverlabels-font-trigger" onClick={() => setIsOpen(o => !o)} style={{ fontFamily: currentCss }}>
                <span>{selected}</span>
                <span className="vc-serverlabels-font-caret">{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
                <div className="vc-serverlabels-font-dropdown">
                    {Object.keys(FONT_CATALOG).map(name => (
                        <div
                            key={name}
                            className={"vc-serverlabels-font-option" + (name === selected ? " vc-serverlabels-font-option--selected" : "")}
                            onClick={() => selectFont(name)}
                            style={{ fontFamily: FONT_CATALOG[name].css }}
                        >
                            {name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function pruneLabel(el: HTMLElement) {
    activeLabels.delete(el);
    const fid = el.dataset.parentFolderId;
    if (fid) {
        const s = labelsByFolder.get(fid);
        if (s) { s.delete(el); if (s.size === 0) labelsByFolder.delete(fid); }
    }
}

/** Reads settings and writes them into an injected <style> tag so Discord can't wipe them. */
function updateCSSVars() {
    if (!styleEl) return;
    const color = settings.store.fontColor?.trim();
    styleEl.textContent = `:root {
        --serverlabels-font-size: ${settings.store.fontSize}px;
        --serverlabels-font-weight: ${settings.store.fontWeight};
        --serverlabels-max-width: ${settings.store.maxWidth}px;
        --serverlabels-radius: ${settings.store.labelRadius};
        --serverlabels-font-family: ${FONT_CATALOG[settings.store.fontFamily]?.css ?? "var(--font-primary)"};
        ${color ? `--serverlabels-color: ${color};` : ""}
    }`;
    document.body.classList.toggle("vc-serverlabels-custom-color", !!color);
    // Re-measure after layout settles — max-width changes affect overflow amounts.
    requestAnimationFrame(remeasureAllMarquees);
}

/**
 * Measures how far the inner text span overflows its pill container and stores
 * the result as --marquee-offset. Adds vc-serverlabels-overflow when text is
 * actually clipped so the fade mask and animation only apply when needed.
 */
function measureMarquee(label: HTMLElement) {
    if (!label.isConnected) return;
    const inner = label.querySelector("span") as HTMLElement | null;
    if (!inner) return;
    const style = getComputedStyle(label);
    const hPad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const overflow = inner.scrollWidth - (label.clientWidth - hPad);
    if (overflow > 2) {
        label.style.setProperty("--marquee-offset", `-${overflow}px`);
        label.classList.add("vc-serverlabels-overflow");
    } else {
        label.style.removeProperty("--marquee-offset");
        label.classList.remove("vc-serverlabels-overflow");
    }
}

function remeasureAllMarquees() {
    // Read pass — collect all measurements before touching the DOM
    const measurements: Array<[HTMLElement, number]> = [];
    for (const el of activeLabels) {
        if (!el.isConnected) continue;
        const inner = el.querySelector("span") as HTMLElement | null;
        if (!inner) continue;
        const style = getComputedStyle(el);
        const hPad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        measurements.push([el, inner.scrollWidth - (el.clientWidth - hPad)]);
    }
    // Write pass — apply results without interleaving reads
    for (const [el, overflow] of measurements) {
        if (overflow > 2) {
            el.style.setProperty("--marquee-offset", `-${overflow}px`);
            el.classList.add("vc-serverlabels-overflow");
        } else {
            el.style.removeProperty("--marquee-offset");
            el.classList.remove("vc-serverlabels-overflow");
        }
    }
}

function getFolderColor(guildId: string): string | null {
    try {
        const folders: any[] = SortedGuildStore.getGuildFolders?.() ?? [];
        const folder = folders.find(f => f.guildIds?.includes(guildId));
        const color: number | null | undefined = folder?.folderColor;
        if (!color) return null;
        return `#${color.toString(16).padStart(6, "0")}`;
    } catch {
        return null;
    }
}

/**
 * Returns the label element (if any) whose bounding rect contains the given point.
 * Used by the document-level click and mousemove handlers, since the labels have
 * pointer-events: none and cannot receive events directly.
 */
function labelAtPoint(x: number, y: number): HTMLElement | null {
    for (const el of activeLabels) {
        if (!el.isConnected) { pruneLabel(el); continue; }
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            return el;
        }
    }
    return null;
}

/**
 * Document-level click handler (capture phase).
 * Labels have pointer-events: none, so we check coordinates manually and navigate
 * to whichever guild label was clicked.
 */
function onDocumentClick(e: MouseEvent) {
    const label = labelAtPoint(e.clientX, e.clientY);
    if (!label) return;
    e.stopPropagation();
    e.preventDefault();
    if (label.dataset.guildId) {
        NavigationRouter.transitionToGuild(label.dataset.guildId);
        if (settings.store.autoCollapseFolder && label.dataset.parentFolderId) {
            const folderTreeitem = document.querySelector(`[data-list-item-id="guildsnav___${label.dataset.parentFolderId}"]`);
            if (folderTreeitem?.getAttribute("aria-expanded") === "true")
                (folderTreeitem as HTMLElement).click();
        }
    } else if (label.dataset.folderId) {
        // Simulate a click on the folder treeitem to expand/collapse it.
        const treeitem = document.querySelector(`[data-list-item-id="guildsnav___${label.dataset.folderId}"]`);
        (treeitem as HTMLElement)?.click();
    }
}

/**
 * Document-level mousemove handler.
 * Since labels have pointer-events: none, we manually apply the hover class and
 * set the cursor so the user can see the labels are interactive.
 * Throttled to one update per animation frame.
 */
function onDocumentMouseMove(e: MouseEvent) {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
        rafId = null;
        const hovered = labelAtPoint(e.clientX, e.clientY);
        for (const el of activeLabels) {
            el.classList.toggle(LABEL_HOVER_CLASS, el === hovered);
        }
        if (guildsNav) guildsNav.style.cursor = hovered ? "pointer" : "";
    });
}

/**
 * Injects a label into a single guild treeitem's listItem container.
 * Walks up from the treeitem to find the icon <span>, then appends
 * the label as a sibling inside the existing listItem flex row —
 * without wrapping or moving any of Discord's original elements.
 */
function injectFolderLabel(treeitem: Element) {
    const rawId = treeitem.getAttribute("data-list-item-id") ?? "";
    if (!rawId.startsWith("guildsnav___")) return;

    const idStr = rawId.slice("guildsnav___".length);
    const idNum = Number(idStr);
    if (!Number.isFinite(idNum) || idNum <= 0) return;

    try {
        const folders: any[] = SortedGuildStore.getGuildFolders?.() ?? [];
        const folder = folders.find(f => f.folderId === idNum);
        if (!folder?.folderName) return;

        // Folder DOM has no <span> ancestor. The treeitem itself is the folderButton,
        // which is the icon area — append label directly inside it.
        if (treeitem.querySelector(`.${LABEL_CLASS}`)) return;

        suppressNativeTooltip(treeitem);

        const label = document.createElement("span");
        label.className = LABEL_CLASS;
        label.setAttribute("aria-label", folder.folderName);
        label.dataset.folderId = idStr;
        const folderInner = document.createElement("span");
        folderInner.textContent = folder.folderName;
        label.appendChild(folderInner);

        if (folder.folderColor) {
            label.style.setProperty("--serverlabels-folder-color", `#${folder.folderColor.toString(16).padStart(6, "0")}`);
            label.dataset.hasColor = "true";
        }

        treeitem.appendChild(label);
        activeLabels.add(label);
        requestAnimationFrame(() => measureMarquee(label));
    } catch {
        return;
    }
}

/** Removes native browser tooltips (title attributes and SVG <title> elements) from a treeitem. */
function suppressNativeTooltip(treeitem: Element) {
    treeitem.querySelectorAll("[title]").forEach(el => el.removeAttribute("title"));
    treeitem.querySelectorAll("svg title").forEach(el => el.remove());
}

function injectLabel(treeitem: Element) {
    const rawId = treeitem.getAttribute("data-list-item-id") ?? "";
    const guildId = rawId.startsWith("guildsnav___") ? rawId.slice("guildsnav___".length) : null;
    if (!guildId) return;

    const guild = GuildStore.getGuild(guildId);
    if (!guild) return;

    suppressNativeTooltip(treeitem);

    // Walk up from the treeitem to find the <span> that wraps the icon blob.
    // DOM path: treeitem ← div[data-dnd-name] ← foreignObject ← svg ← div.wrapper ← div.blobContainer ← span ← listItem
    let current: Element | null = treeitem;
    while (current && current.tagName !== "SPAN") {
        current = current.parentElement;
    }
    if (!current) return;

    const iconSpan = current;
    const listItem = iconSpan.parentElement;
    if (!listItem) return;

    // Don't double-inject
    if (listItem.querySelector(`.${LABEL_CLASS}`)) return;

    let folderColor: string | null = null;
    let parentFolderId: string | null = null;
    try {
        const folders: any[] = SortedGuildStore.getGuildFolders?.() ?? [];
        const parentFolder = folders.find(f => f.guildIds?.includes(guildId));
        if (parentFolder?.folderColor) folderColor = `#${parentFolder.folderColor.toString(16).padStart(6, "0")}`;
        if (parentFolder?.folderId != null) parentFolderId = String(parentFolder.folderId);
    } catch {}

    const label = document.createElement("span");
    label.className = LABEL_CLASS;
    label.setAttribute("aria-label", guild.name);
    // Store the guild ID so the document-level click handler can navigate.
    label.dataset.guildId = guildId;
    const inner = document.createElement("span");
    inner.textContent = guild.name;
    label.appendChild(inner);

    if (folderColor) {
        label.style.setProperty("--serverlabels-folder-color", folderColor);
        label.dataset.hasColor = "true";
    }

    if (parentFolderId) {
        label.dataset.inFolder = "true";
        label.dataset.parentFolderId = parentFolderId;
        if (!labelsByFolder.has(parentFolderId)) labelsByFolder.set(parentFolderId, new Set());
        labelsByFolder.get(parentFolderId)!.add(label);
        // Initialize open state immediately based on current DOM
        const folderTreeitem = document.querySelector(`[data-list-item-id="guildsnav___${parentFolderId}"]`);
        if (folderTreeitem?.getAttribute("aria-expanded") === "true") {
            label.classList.add("vc-serverlabels-folder-open");
        }
    }

    // Append the label inside the icon span so it becomes the absolute positioning
    // anchor — avoids shrinking the listItem (which breaks Discord's icon centering).
    // The label has pointer-events: none (see style.css), so it is invisible to
    // Discord's event system. Clicks and hover effects are handled by document-level
    // listeners registered in start() to avoid triggering Discord's tooltip.
    iconSpan.appendChild(label);
    activeLabels.add(label);
    requestAnimationFrame(() => measureMarquee(label));
}

function injectSettingsButton() {
    if (document.getElementById("vc-serverlabels-settings-btn")) return;

    const homeItem = document.querySelector('[data-list-item-id="guildsnav___home"]');
    if (!homeItem) return;

    const nav = homeItem.closest('nav[class*="guilds"]') as HTMLElement | null;
    if (!nav) return;

    // Bail if the nav isn't laid out yet — MutationObserver will retry.
    const navRect = nav.getBoundingClientRect();
    if (navRect.height === 0) return;

    const homeRect = homeItem.getBoundingClientRect();
    const topOffset = homeRect.top - navRect.top + (homeRect.height - 32) / 2;

    const btn = document.createElement("button");
    btn.id = "vc-serverlabels-settings-btn";
    btn.className = "vc-serverlabels-settings-btn";
    btn.setAttribute("aria-label", "Open ServerLabels Settings");
    btn.style.top = `${topOffset}px`;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41L9.25 5.35c-.59.24-1.13.56-1.62.94L5.24 5.33c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.22-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94L2.84 14.52c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58ZM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6Z"/></svg>`;
    btn.addEventListener("click", e => {
        e.stopPropagation();
        e.preventDefault();
        const plugin = (window as any).Vencord?.Plugins?.plugins?.["ServerLabels"];
        if (plugin) openPluginModal(plugin);
    });

    nav.appendChild(btn);
    settingsBtn = btn;
}

function removeSettingsButton() {
    settingsBtn?.remove();
    settingsBtn = null;
}

function applyAllLabels() {
    document.querySelectorAll(TREEITEM_SELECTOR).forEach(el => {
        injectLabel(el);
        injectFolderLabel(el);
    });
}

function removeAllLabels() {
    activeLabels.forEach(el => el.remove());
    activeLabels.clear();
    labelsByFolder.clear();
}

function refreshLabelColors() {
    // Discord may replace the nav element on theme/settings changes — reconnect the observer if so.
    const nav = document.querySelector('nav[class*="guilds"]');
    if (nav && nav !== guildsNav) {
        guildsNav = nav as HTMLElement;
        observer?.disconnect();
        observer?.observe(guildsNav, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
        applyAllLabels();
    } else if (nav) {
        guildsNav = nav as HTMLElement;
    }
    try {
        const folders: any[] = SortedGuildStore.getGuildFolders?.() ?? [];
        for (const el of activeLabels) {
            if (!el.isConnected) { pruneLabel(el); continue; }
            let colorHex: string | null = null;
            if (el.dataset.folderId) {
                const idNum = Number(el.dataset.folderId);
                const folder = folders.find(f => f.folderId === idNum);
                const c = folder?.folderColor;
                if (c) colorHex = `#${c.toString(16).padStart(6, "0")}`;
            } else if (el.dataset.guildId) {
                colorHex = getFolderColor(el.dataset.guildId);
            }
            if (colorHex) {
                el.style.setProperty("--serverlabels-folder-color", colorHex);
                el.dataset.hasColor = "true";
            } else {
                el.style.removeProperty("--serverlabels-folder-color");
                delete el.dataset.hasColor;
            }
        }
    } catch {}
}

/**
 * Syncs the vc-serverlabels-folder-open class on all server labels belonging to
 * the given folder treeitem, based on its current aria-expanded state.
 */
function syncFolderOpenState(treeitem: Element) {
    const rawId = treeitem.getAttribute("data-list-item-id") ?? "";
    if (!rawId.startsWith("guildsnav___")) return;
    const folderId = rawId.slice("guildsnav___".length);
    const isOpen = treeitem.getAttribute("aria-expanded") === "true";
    const children = labelsByFolder.get(folderId);
    if (!children) return;
    for (const el of children) {
        el.classList.toggle("vc-serverlabels-folder-open", isOpen);
    }
}

export default definePlugin({
    name: "ServerLabels",
    description: "Displays server names next to their icons in the server list.",
    authors: [{ name: ".dave64", id: 140194457222905856n }],
    settings,

    start() {
        styleEl = document.createElement("style");
        styleEl.id = "vc-serverlabels-vars";
        document.head.appendChild(styleEl);

        document.body.classList.add("vc-serverlabels-active");
        if (!settings.store.showTreeConnector) document.body.classList.add("vc-serverlabels-no-connector");
        loadAllFonts();
        updateCSSVars();
        applyAllLabels();
        injectSettingsButton();

        // Labels have pointer-events: none, so all interaction is handled here.
        document.addEventListener("click", onDocumentClick, true);
        document.addEventListener("mousemove", onDocumentMouseMove);
        SortedGuildStore.addChangeListener(refreshLabelColors);

        // Watch for Discord re-rendering the guild list (e.g. new notifications,
        // server reorder, folder expand/collapse) and re-inject labels as needed.
        observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "attributes" && mutation.attributeName === "aria-expanded") {
                    syncFolderOpenState(mutation.target as Element);
                    continue;
                }
                if (mutation.type !== "childList") continue;
                for (const el of activeLabels) {
                    if (!el.isConnected) pruneLabel(el);
                }
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof Element)) continue;
                    if (node.matches(TREEITEM_SELECTOR)) {
                        injectLabel(node);
                        injectFolderLabel(node);
                    }
                    node.querySelectorAll(TREEITEM_SELECTOR).forEach(el => {
                        injectLabel(el);
                        injectFolderLabel(el);
                    });
                }
                injectSettingsButton();
            }
        });

        const nav = document.querySelector('nav[class*="guilds"]');
        if (nav) {
            guildsNav = nav as HTMLElement;
            observer.observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
        } else {
            // Guild sidebar not ready yet — watch body briefly, then switch to nav.
            observer.observe(document.body, { childList: true, subtree: true });
            navBootstrapObserver = new MutationObserver(() => {
                const n = document.querySelector('nav[class*="guilds"]');
                if (!n) return;
                guildsNav = n as HTMLElement;
                navBootstrapObserver!.disconnect();
                navBootstrapObserver = null;
                observer?.disconnect();
                observer?.observe(n, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-expanded"] });
            });
            navBootstrapObserver.observe(document.body, { childList: true, subtree: true });
        }
    },

    stop() {
        document.body.classList.remove("vc-serverlabels-active");
        document.body.classList.remove("vc-serverlabels-no-connector");
        document.body.classList.remove("vc-serverlabels-custom-color");
        if (guildsNav) { guildsNav.style.cursor = ""; guildsNav = null; }
        removeSettingsButton();
        document.removeEventListener("click", onDocumentClick, true);
        document.removeEventListener("mousemove", onDocumentMouseMove);
        SortedGuildStore.removeChangeListener(refreshLabelColors);
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        navBootstrapObserver?.disconnect();
        navBootstrapObserver = null;
        observer?.disconnect();
        observer = null;
        removeAllLabels();
        styleEl?.remove();
        styleEl = null;
        unloadAllFonts();
    },
});
