const state = { mode: "domain", matches: [], selected: new Set() };

const inputs = {
  domain: document.getElementById("domain-input"),
  domainRegex: document.getElementById("domain-regex"),
  title: document.getElementById("title-input"),
  titleRegex: document.getElementById("title-regex"),
  age: document.getElementById("age-input"),
  ageUnit: document.getElementById("age-unit"),
  dupMode: document.getElementById("dup-mode"),
};

function setMode(mode) {
  state.mode = mode;
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  }
  for (const panel of document.querySelectorAll(".panel")) {
    panel.hidden = panel.dataset.mode !== mode;
  }
  if (mode === "domain") renderTopDomains();
  refresh();
}

async function renderTopDomains() {
  const list = document.getElementById("top-domains-list");
  if (!list) return;
  const tabs = await browser.tabs.query({ pinned: false });
  const counts = new Map();
  for (const t of tabs) {
    const h = hostnameOf(t.url);
    if (!h) continue;
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  const top = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  list.innerHTML = "";
  if (top.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "no domain has more than one tab";
    list.appendChild(empty);
    return;
  }
  for (const [host, n] of top) {
    const li = document.createElement("li");
    li.title = `${n} tabs on ${host}`;
    const name = document.createElement("span");
    name.textContent = host;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = n;
    li.append(name, count);
    li.addEventListener("click", () => {
      inputs.domain.value = host;
      inputs.domainRegex.checked = false;
      refresh();
    });
    list.appendChild(li);
  }
}

function hostnameOf(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function urlNoQuery(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch { return url; }
}

function compileMatcher(value, useRegex, inputEl) {
  inputEl.classList.remove("invalid");
  if (!value) return null;
  if (useRegex) {
    try {
      const re = new RegExp(value, "i");
      return s => re.test(s);
    } catch {
      inputEl.classList.add("invalid");
      return null;
    }
  }
  const needle = value.toLowerCase();
  return s => s.toLowerCase().includes(needle);
}

function findDuplicates(tabs, mode) {
  const keyOf = t => {
    if (mode === "url") return t.url;
    if (mode === "url-noquery") return urlNoQuery(t.url);
    if (mode === "title") return (t.title || "").trim();
    return t.url;
  };
  const groups = new Map();
  for (const t of tabs) {
    const k = keyOf(t);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const dupes = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    dupes.push(...group.slice(1));
  }
  return dupes;
}

async function findMatches() {
  const tabs = await browser.tabs.query({ pinned: false });
  const now = Date.now();

  if (state.mode === "domain") {
    const m = compileMatcher(inputs.domain.value.trim(), inputs.domainRegex.checked, inputs.domain);
    if (!m) return [];
    return tabs.filter(t => m(hostnameOf(t.url)));
  }
  if (state.mode === "title") {
    const m = compileMatcher(inputs.title.value.trim(), inputs.titleRegex.checked, inputs.title);
    if (!m) return [];
    return tabs.filter(t => m(t.title || ""));
  }
  if (state.mode === "age") {
    const n = parseInt(inputs.age.value, 10);
    if (!n || n < 1) return [];
    const ms = n * (inputs.ageUnit.value === "hours" ? 3600e3 : 86400e3);
    return tabs.filter(t => t.lastAccessed && (now - t.lastAccessed) > ms);
  }
  if (state.mode === "duplicates") {
    return findDuplicates(tabs, inputs.dupMode.value);
  }
  return [];
}

async function refresh() {
  state.matches = await findMatches();
  state.selected = new Set(state.matches.map(t => t.id));
  render();
}

function render() {
  const list = document.getElementById("preview-list");
  const count = document.getElementById("match-count");
  list.innerHTML = "";
  count.textContent = `${state.matches.length} tab${state.matches.length === 1 ? "" : "s"} match`;

  for (const tab of state.matches) {
    const li = document.createElement("li");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.selected.has(tab.id);
    cb.addEventListener("change", () => {
      if (cb.checked) state.selected.add(tab.id);
      else state.selected.delete(tab.id);
      updateCloseButton();
    });

    const icon = document.createElement("img");
    icon.src = tab.favIconUrl || "";
    icon.onerror = () => { icon.style.visibility = "hidden"; };

    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = tab.title || "(untitled)";
    title.title = tab.title || "";
    const url = document.createElement("div");
    url.className = "url";
    url.textContent = tab.url;
    meta.append(title, url);

    li.append(cb, icon, meta);
    list.appendChild(li);
  }

  document.getElementById("select-all").checked =
    state.matches.length > 0 && state.selected.size === state.matches.length;
  updateCloseButton();
}

function updateCloseButton() {
  const btn = document.getElementById("close-btn");
  btn.disabled = state.selected.size === 0;
  btn.textContent = state.selected.size === 0
    ? "Close selected"
    : `Close ${state.selected.size} tab${state.selected.size === 1 ? "" : "s"}`;
}

function currentFilter() {
  const f = { mode: state.mode };
  if (state.mode === "domain") {
    f.value = inputs.domain.value;
    f.regex = inputs.domainRegex.checked;
  } else if (state.mode === "title") {
    f.value = inputs.title.value;
    f.regex = inputs.titleRegex.checked;
  } else if (state.mode === "age") {
    f.value = inputs.age.value;
    f.unit = inputs.ageUnit.value;
  } else if (state.mode === "duplicates") {
    f.dupMode = inputs.dupMode.value;
  }
  return f;
}

function applyFilter(f) {
  setMode(f.mode);
  if (f.mode === "domain") {
    inputs.domain.value = f.value || "";
    inputs.domainRegex.checked = !!f.regex;
  } else if (f.mode === "title") {
    inputs.title.value = f.value || "";
    inputs.titleRegex.checked = !!f.regex;
  } else if (f.mode === "age") {
    if (f.value) inputs.age.value = f.value;
    if (f.unit) inputs.ageUnit.value = f.unit;
  } else if (f.mode === "duplicates") {
    if (f.dupMode) inputs.dupMode.value = f.dupMode;
  }
  refresh();
}

async function loadPresets() {
  const { presets = [] } = await browser.storage.local.get("presets");
  const sel = document.getElementById("preset-select");
  sel.innerHTML = '<option value="">Load preset…</option>';
  for (const p of presets) {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
  return presets;
}

async function savePreset() {
  const name = prompt("Preset name:");
  if (!name) return;
  const { presets = [] } = await browser.storage.local.get("presets");
  const filter = currentFilter();
  const idx = presets.findIndex(p => p.name === name);
  const entry = { name, filter };
  if (idx >= 0) presets[idx] = entry;
  else presets.push(entry);
  await browser.storage.local.set({ presets });
  await loadPresets();
  document.getElementById("preset-select").value = name;
  document.getElementById("preset-delete").disabled = false;
}

async function deletePreset() {
  const sel = document.getElementById("preset-select");
  const name = sel.value;
  if (!name) return;
  const { presets = [] } = await browser.storage.local.get("presets");
  const next = presets.filter(p => p.name !== name);
  await browser.storage.local.set({ presets: next });
  await loadPresets();
  document.getElementById("preset-delete").disabled = true;
}

document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => setMode(t.dataset.mode));
});

for (const el of Object.values(inputs)) {
  el.addEventListener("input", refresh);
  el.addEventListener("change", refresh);
}

document.getElementById("select-all").addEventListener("change", e => {
  if (e.target.checked) state.selected = new Set(state.matches.map(t => t.id));
  else state.selected.clear();
  render();
});

document.getElementById("close-btn").addEventListener("click", async () => {
  await browser.tabs.remove([...state.selected]);
  if (state.mode === "domain") renderTopDomains();
  refresh();
});

document.getElementById("preset-save").addEventListener("click", savePreset);
document.getElementById("preset-delete").addEventListener("click", deletePreset);
document.getElementById("preset-select").addEventListener("change", async e => {
  const name = e.target.value;
  document.getElementById("preset-delete").disabled = !name;
  if (!name) return;
  const presets = await loadPresets();
  document.getElementById("preset-select").value = name;
  const p = presets.find(x => x.name === name);
  if (p) applyFilter(p.filter);
});

(async () => {
  await loadPresets();
  const { pendingFilter } = await browser.storage.local.get("pendingFilter");
  if (pendingFilter) {
    await browser.storage.local.remove("pendingFilter");
    applyFilter(pendingFilter);
  } else {
    const params = new URLSearchParams(location.search);
    setMode(params.get("mode") || "domain");
  }
})();
