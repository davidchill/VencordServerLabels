/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy } from "@webpack";
import { GuildStore, NavigationRouter } from "@webpack/common";

const SortedGuildStore = findStoreLazy("SortedGuildStore");

const settings = definePluginSettings({
    fontSize: {
        type: OptionType.SLIDER,
        description: "Font size of server name labels (px)",
        default: 14,
        markers: [10, 12, 14, 16, 18, 20],
        onChange: () => updateCSSVars(),
    },
    fontWeight: {
        type: OptionType.SELECT,
        description: "Font weight of server name labels",
        options: [
            { label: "Normal", value: "400", default: true },
            { label: "Medium", value: "500" },
            { label: "Bold", value: "700" },
        ],
        onChange: () => updateCSSVars(),
    },
    maxWidth: {
        type: OptionType.SLIDER,
        description: "Max width of server name labels (px)",
        default: 150,
        markers: [80, 100, 120, 150, 180, 200],
        onChange: () => updateCSSVars(),
    },
});

const LABEL_CLASS = "vc-serverlabels-name";
const LABEL_HOVER_CLASS = "vc-serverlabels-name--hover";
const TREEITEM_SELECTOR = '[data-list-item-id^="guildsnav___"]';

let observer: MutationObserver | null = null;
let navBootstrapObserver: MutationObserver | null = null;
let styleEl: HTMLStyleElement | null = null;
let rafId: number | null = null;
let applyRafId: number | null = null;

const activeLabels = new Set<HTMLElement>();

/** Reads settings and writes them into an injected <style> tag so Discord can't wipe them. */
function updateCSSVars() {
    if (!styleEl) return;
    styleEl.textContent = `:root {
        --serverlabels-font-size: ${settings.store.fontSize}px;
        --serverlabels-font-weight: ${settings.store.fontWeight};
        --serverlabels-max-width: ${settings.store.maxWidth}px;
    }`;
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

function isInFolder(guildId: string): boolean {
    try {
        const folders: any[] = SortedGuildStore.getGuildFolders?.() ?? [];
        return folders.some(f => f.folderId != null && f.guildIds?.includes(guildId));
    } catch {
        return false;
    }
}

/**
 * Returns the label element (if any) whose bounding rect contains the given point.
 * Used by the document-level click and mousemove handlers, since the labels have
 * pointer-events: none and cannot receive events directly.
 */
function labelAtPoint(x: number, y: number): HTMLElement | null {
    for (const el of activeLabels) {
        if (!el.isConnected) { activeLabels.delete(el); continue; }
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
            if (el.dataset.guildId) el.classList.toggle(LABEL_HOVER_CLASS, el === hovered);
        }
        document.body.style.cursor = hovered ? "pointer" : "";
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
    // Folder IDs are plain integers (~10 digits); guild snowflakes are 18-19 digits.
    // Reject anything that's not a finite positive integer, or looks like a guild snowflake.
    if (!Number.isFinite(idNum) || idNum <= 0 || idStr.length > 15) return;

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
        label.textContent = folder.folderName;
        label.dataset.folderId = idStr;

        if (folder.folderColor) {
            label.style.setProperty("--serverlabels-folder-color", `#${folder.folderColor.toString(16).padStart(6, "0")}`);
            label.dataset.hasColor = "true";
        }

        treeitem.appendChild(label);
        activeLabels.add(label);
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

    const folderColor = getFolderColor(guildId);

    const label = document.createElement("span");
    label.className = LABEL_CLASS;
    label.textContent = guild.name;
    label.setAttribute("aria-label", guild.name);
    // Store the guild ID so the document-level click handler can navigate.
    label.dataset.guildId = guildId;

    if (folderColor) {
        label.style.setProperty("--serverlabels-folder-color", folderColor);
        label.dataset.hasColor = "true";
    }

    if (isInFolder(guildId)) {
        label.dataset.inFolder = "true";
    }

    // Append the label inside the icon span so it becomes the absolute positioning
    // anchor — avoids shrinking the listItem (which breaks Discord's icon centering).
    // The label has pointer-events: none (see style.css), so it is invisible to
    // Discord's event system. Clicks and hover effects are handled by document-level
    // listeners registered in start() to avoid triggering Discord's tooltip.
    iconSpan.appendChild(label);
    activeLabels.add(label);
}

function applyAllLabels() {
    document.querySelectorAll(TREEITEM_SELECTOR).forEach(injectLabel);
    document.querySelectorAll(TREEITEM_SELECTOR).forEach(injectFolderLabel);
}

function removeAllLabels() {
    activeLabels.forEach(el => el.remove());
    activeLabels.clear();
}

export default definePlugin({
    name: "ServerLabels",
    description: "Displays server names next to their icons in the server list.",
    authors: [{ name: ".dave64", id: 140194457222905856n }],
    settings,
    patches: [],

    start() {
        styleEl = document.createElement("style");
        styleEl.id = "vc-serverlabels-vars";
        document.head.appendChild(styleEl);

        document.body.classList.add("vc-serverlabels-active");
        updateCSSVars();
        applyAllLabels();

        // Labels have pointer-events: none, so all interaction is handled here.
        document.addEventListener("click", onDocumentClick, true);
        document.addEventListener("mousemove", onDocumentMouseMove);

        // Watch for Discord re-rendering the guild list (e.g. new notifications,
        // server reorder, folder expand/collapse) and re-inject labels as needed.
        observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type !== "childList") continue;
                const hasNewGuildNodes = [...mutation.addedNodes].some(n =>
                    n instanceof Element && (
                        n.matches(TREEITEM_SELECTOR) ||
                        n.querySelector?.(TREEITEM_SELECTOR) != null
                    )
                );
                if (hasNewGuildNodes) {
                    if (applyRafId === null) {
                        applyRafId = requestAnimationFrame(() => {
                            applyRafId = null;
                            applyAllLabels();
                        });
                    }
                    break;
                }
            }
        });

        const nav = document.querySelector('nav[class*="guilds"]');
        if (nav) {
            observer.observe(nav, { childList: true, subtree: true });
        } else {
            // Guild sidebar not ready yet — watch body briefly, then switch to nav.
            observer.observe(document.body, { childList: true, subtree: true });
            navBootstrapObserver = new MutationObserver(() => {
                const n = document.querySelector('nav[class*="guilds"]');
                if (!n) return;
                navBootstrapObserver!.disconnect();
                navBootstrapObserver = null;
                observer?.disconnect();
                observer?.observe(n, { childList: true, subtree: true });
            });
            navBootstrapObserver.observe(document.body, { childList: true });
        }
    },

    stop() {
        document.body.classList.remove("vc-serverlabels-active");
        document.body.style.cursor = "";
        document.removeEventListener("click", onDocumentClick, true);
        document.removeEventListener("mousemove", onDocumentMouseMove);
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        if (applyRafId !== null) { cancelAnimationFrame(applyRafId); applyRafId = null; }
        navBootstrapObserver?.disconnect();
        navBootstrapObserver = null;
        observer?.disconnect();
        observer = null;
        removeAllLabels();
        styleEl?.remove();
        styleEl = null;
    },
});
