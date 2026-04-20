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
const TREEITEM_SELECTOR = '[data-list-item-id^="guildsnav___"]';

let observer: MutationObserver | null = null;
let styleEl: HTMLStyleElement | null = null;

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

        if (folder.folderColor) {
            label.style.setProperty("--serverlabels-folder-color", `#${folder.folderColor.toString(16).padStart(6, "0")}`);
            label.dataset.hasColor = "true";
        }

        treeitem.appendChild(label);
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
    label.setAttribute("role", "button");
    label.setAttribute("tabindex", "0");
    label.setAttribute("aria-label", guild.name);

    if (folderColor) {
        label.style.setProperty("--serverlabels-folder-color", folderColor);
        label.dataset.hasColor = "true";
    }

    label.addEventListener("click", e => {
        e.stopPropagation();
        NavigationRouter.transitionToGuild(guildId);
    });

    // Append the label inside the icon span so it becomes the absolute positioning
    // anchor — avoids shrinking the listItem (which breaks Discord's icon centering).
    iconSpan.appendChild(label);
}

function applyAllLabels() {
    document.querySelectorAll(TREEITEM_SELECTOR).forEach(injectLabel);
    document.querySelectorAll(TREEITEM_SELECTOR).forEach(injectFolderLabel);
}


function removeAllLabels() {
    document.querySelectorAll(`.${LABEL_CLASS}`).forEach(el => el.remove());
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
                    applyAllLabels();
                    break;
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    },

    stop() {
        document.body.classList.remove("vc-serverlabels-active");
        observer?.disconnect();
        observer = null;
        removeAllLabels();

        styleEl?.remove();
        styleEl = null;
    },
});
