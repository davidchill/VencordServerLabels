/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { GuildStore } from "@webpack/common";

const settings = definePluginSettings({
    fontSize: {
        type: OptionType.SLIDER,
        description: "Font size of server name labels (px)",
        default: 14,
        markers: [10, 12, 14, 16, 18, 20],
    },
    fontWeight: {
        type: OptionType.SELECT,
        description: "Font weight of server name labels",
        options: [
            { label: "Normal", value: "400", default: true },
            { label: "Medium", value: "500" },
            { label: "Bold", value: "700" },
        ],
    },
    maxWidth: {
        type: OptionType.SLIDER,
        description: "Max width of server name labels (px)",
        default: 150,
        markers: [80, 100, 120, 150, 180, 200],
    },
});

const LABEL_CLASS = "vc-serverlabels-name";
const TREEITEM_SELECTOR = '[data-list-item-id^="guildsnav___"]';

let observer: MutationObserver | null = null;

/** Reads settings and writes them as CSS variables so styles update without a rebuild. */
function updateCSSVars() {
    const root = document.documentElement;
    root.style.setProperty("--serverlabels-font-size", `${settings.store.fontSize}px`);
    root.style.setProperty("--serverlabels-font-weight", settings.store.fontWeight);
    root.style.setProperty("--serverlabels-max-width", `${settings.store.maxWidth}px`);
}

/**
 * Injects a label into a single guild treeitem's listItem container.
 * Walks up from the treeitem to find the icon <span>, then appends
 * the label as a sibling inside the existing listItem flex row —
 * without wrapping or moving any of Discord's original elements.
 */
function injectLabel(treeitem: Element) {
    const rawId = treeitem.getAttribute("data-list-item-id") ?? "";
    const guildId = rawId.startsWith("guildsnav___") ? rawId.slice("guildsnav___".length) : null;
    if (!guildId) return;

    const guild = GuildStore.getGuild(guildId);
    if (!guild) return;

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

    const label = document.createElement("span");
    label.className = LABEL_CLASS;
    label.textContent = guild.name;
    label.setAttribute("aria-hidden", "true");

    // Insert the label after the icon span, inside the existing listItem flex row.
    // This means we never wrap or disturb Discord's original elements.
    iconSpan.after(label);
}

function applyAllLabels() {
    document.querySelectorAll(TREEITEM_SELECTOR).forEach(injectLabel);
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

        const root = document.documentElement;
        root.style.removeProperty("--serverlabels-font-size");
        root.style.removeProperty("--serverlabels-font-weight");
        root.style.removeProperty("--serverlabels-max-width");
    },
});
