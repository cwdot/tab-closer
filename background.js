const browserActionMenus = [
  { id: "ba-domain", title: "Filter by domain", mode: "domain" },
  { id: "ba-title", title: "Filter by title", mode: "title" },
  { id: "ba-age", title: "Filter by age", mode: "age" },
  { id: "ba-duplicates", title: "Find duplicates", mode: "duplicates" },
];

for (const m of browserActionMenus) {
  browser.menus.create({
    id: m.id,
    title: m.title,
    contexts: ["browser_action"],
  });
}

const tabMenus = [
  { id: "tab-domain", title: "Tab Manager: close other tabs from this domain", mode: "domain" },
  { id: "tab-title", title: "Tab Manager: close tabs with this title", mode: "title" },
  { id: "tab-age", title: "Tab Manager: close tabs older than this one", mode: "age" },
  { id: "tab-duplicates", title: "Tab Manager: close duplicates of this tab", mode: "duplicates" },
];

for (const m of tabMenus) {
  browser.menus.create({
    id: m.id,
    title: m.title,
    contexts: ["tab"],
  });
}

function hostnameOf(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function buildFilterFromTab(mode, tab) {
  if (mode === "domain") {
    return { mode: "domain", value: hostnameOf(tab.url), regex: false };
  }
  if (mode === "title") {
    return { mode: "title", value: tab.title || "", regex: false };
  }
  if (mode === "age") {
    const ms = Date.now() - (tab.lastAccessed || Date.now());
    const days = Math.max(1, Math.floor(ms / 86400e3));
    return { mode: "age", value: String(days), unit: "days" };
  }
  if (mode === "duplicates") {
    return { mode: "duplicates", dupMode: "url" };
  }
  return { mode };
}

async function openWithFilter(filter) {
  await browser.storage.local.set({ pendingFilter: filter });
  try {
    await browser.browserAction.openPopup();
  } catch {
    await browser.tabs.create({ url: browser.runtime.getURL("popup.html") });
  }
}

browser.menus.onClicked.addListener(async (info, tab) => {
  const baEntry = browserActionMenus.find(m => m.id === info.menuItemId);
  if (baEntry) {
    await openWithFilter({ mode: baEntry.mode });
    return;
  }
  const tabEntry = tabMenus.find(m => m.id === info.menuItemId);
  if (tabEntry && tab) {
    await openWithFilter(buildFilterFromTab(tabEntry.mode, tab));
  }
});
