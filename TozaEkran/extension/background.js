// TozaEkran — fon xizmati (service worker)
//
// Vazifalari:
//  * kontent-skriptlarni ro'yxatdan o'tkazish (o'chirilgan saytlar bundan mustasno);
//  * har bir sahifa/freym uchun saytga xos kosmetik CSS'ni kiritish;
//  * reklama popup / popunder yorliqlarini yopish;
//  * sozlamalar, statistika va popup oynasi bilan aloqa.

const RULESETS = ['toza', 'easylist', 'cyrillic'];
const MATCHES = ['http://*/*', 'https://*/*'];
const SITE_RULE_BASE = 1000; // saytni o'chirish uchun dinamik qoidalar ID'si shu sondan boshlanadi

const DEFAULTS = {
  enabled: true,
  disabledSites: [],
  strictSites: [],
  customRules: {},
  totals: { popups: 0, elements: 0 },
};

// Bukmeker / kazino domenlari (popup sifatida ochilsa yopiladi)
const BET_RE = /1x(?:bet|slot)|1win|mostbet|melbet|pin-?up\.|betwinner|22bet|linebet|megapari|vavada|joycasino|888starz|parimatch|betandyou|olimpbet|leonbets|fonbet|yourbonus|casino|kazino/i;

// --------------------------------------------------------------------- sozlamalar

let settingsCache = null;

async function getSettings() {
  if (settingsCache) return settingsCache;
  const st = await chrome.storage.local.get(DEFAULTS);
  settingsCache = { ...DEFAULTS, ...st };
  return settingsCache;
}

async function saveSettings(patch) {
  const st = await getSettings();
  Object.assign(st, patch);
  settingsCache = st;
  await chrome.storage.local.set(patch);
  if (Object.keys(patch).some((k) => k !== 'totals')) cssCache.clear();
  return st;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !settingsCache) return;
  for (const [k, v] of Object.entries(changes)) settingsCache[k] = v.newValue ?? DEFAULTS[k];
  if (Object.keys(changes).some((k) => k !== 'totals')) cssCache.clear();
});

// ------------------------------------------------------------------ yordamchilar

function hostOf(u) {
  try { return new URL(u).hostname.toLowerCase(); } catch { return ''; }
}

function normSite(host) {
  return String(host || '').toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

function siteMatches(host, site) {
  return host === site || host.endsWith('.' + site);
}

const SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne', 'go', 'mil', 'info', 'biz']);
// Ro'yxatga olinadigan domen (eTLD+1) ni taxminiy aniqlash
function baseDomain(host) {
  if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  const p = host.split('.');
  if (p.length <= 2) return host;
  const n = p[p.length - 1].length === 2 && SLD.has(p[p.length - 2]) ? 3 : 2;
  return p.slice(-n).join('.');
}

function isDisabled(host, st) {
  host = normSite(host);
  return st.disabledSites.some((s) => siteMatches(host, s));
}

function matchSet(set, host) {
  for (let h = host; h;) {
    if (set.has(h)) return true;
    const i = h.indexOf('.');
    if (i < 0) break;
    h = h.slice(i + 1);
  }
  return false;
}

function sitePatterns(site) {
  if (!/^[a-z0-9.-]+$/.test(site) || site.includes('*')) return [];
  return [`*://*.${site}/*`];
}

// ------------------------------------------------------------- ma'lumot fayllari

let cosmeticData = null;
async function loadCosmetic() {
  if (cosmeticData) return cosmeticData;
  const j = await (await fetch(chrome.runtime.getURL('data/cosmetic.json'))).json();
  j.genericExcept = j.genericExcept.map(([sel, doms]) => [sel, new Set(doms)]);
  j.genericHideSet = new Set(j.genericHide);
  j.elemHideSet = new Set(j.elemHide);
  cosmeticData = j;
  return j;
}

let popupData = null;
async function loadPopupData() {
  if (popupData) return popupData;
  const j = await (await fetch(chrome.runtime.getURL('data/popup.json'))).json();
  popupData = { popup: new Set(j.popup), ads: new Set(j.ads), strict: new Set(j.strict) };
  return popupData;
}

let allowIds = null;
async function loadAllowIds() {
  if (allowIds) return allowIds;
  const j = await (await fetch(chrome.runtime.getURL('data/allow-ids.json'))).json();
  allowIds = Object.fromEntries(Object.entries(j).map(([k, v]) => [k, new Set(v)]));
  return allowIds;
}

async function isAdHost(host) {
  if (!host) return false;
  if (BET_RE.test(host)) return true;
  const pd = await loadPopupData();
  return matchSet(pd.popup, host) || matchSet(pd.ads, host);
}

async function isStrictSite(host, st) {
  host = normSite(host);
  if (st.strictSites.some((s) => siteMatches(host, s))) return true;
  const pd = await loadPopupData();
  return matchSet(pd.strict, host);
}

// Host uchun kosmetik kalitlar: a.b.c → a.b.c, b.c, c, shuningdek a.*, a.b.*, b.*
function hostKeys(host) {
  const labels = host.split('.');
  const keys = [];
  for (let i = 0; i < labels.length; i++) keys.push(labels.slice(i).join('.'));
  for (let i = 0; i < labels.length - 1; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (labels.length - j <= 2) keys.push(labels.slice(i, j).join('.') + '.*');
    }
  }
  return keys;
}

// --------------------------------------------------------------- kosmetik CSS

const cssCache = new Map();

async function cosmeticFor(host) {
  if (cssCache.has(host)) return cssCache.get(host);
  const st = await getSettings();
  const cos = await loadCosmetic();
  const keys = hostKeys(host);
  const hide = new Set();
  const except = new Set();
  const css = [];
  const proc = [];

  const elemHide = keys.some((k) => cos.elemHideSet.has(k));
  const genericHide = elemHide || keys.some((k) => cos.genericHideSet.has(k));

  for (const k of ['*', ...keys]) {
    const e = cos.spec[k];
    if (!e) continue;
    if (e.x) for (const s of e.x) except.add(s);
    if (elemHide && k !== '*') continue;
    if (e.h) for (const s of e.h) hide.add(s);
    if (e.c) css.push(...e.c);
    if (e.p) proc.push(...e.p);
  }
  if (!genericHide) {
    for (const [sel, doms] of cos.genericExcept) {
      if (!keys.some((k) => doms.has(k))) hide.add(sel);
    }
  }
  for (const s of except) hide.delete(s);

  const list = [...hide];
  let text = '';
  for (let i = 0; i < list.length; i += 50) {
    text += list.slice(i, i + 50).join(',\n') + '\n{ display: none !important; }\n';
  }
  if (css.length) text += css.join('\n') + '\n';
  // Foydalanuvchi qo'lda yashirgan elementlar — har biri alohida qoida
  // (bitta noto'g'ri selektor boshqalarini buzmasligi uchun)
  const site = normSite(host);
  for (const [s, sels] of Object.entries(st.customRules || {})) {
    if (siteMatches(site, s)) for (const sel of sels) text += `${sel} { display: none !important; }\n`;
  }
  const res = { css: text, proc };
  if (cssCache.size > 300) cssCache.delete(cssCache.keys().next().value);
  cssCache.set(host, res);
  return res;
}

async function injectCss(tabId, frameId, documentId, css) {
  if (!css) return;
  const target = documentId ? { tabId, documentIds: [documentId] } : { tabId, frameIds: [frameId] };
  try {
    await chrome.scripting.insertCSS({ target, css, origin: 'USER' });
  } catch {
    // freym yopilgan yoki boshqa sahifaga o'tgan bo'lishi mumkin
  }
}

// ---------------------------------------------------- kontent-skriptlar va DNR

async function syncContentScripts() {
  const st = await getSettings();
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) });
  } catch (e) {
    console.warn('TozaEkran: unregister xatosi', e);
  }
  if (!st.enabled) return;

  const cos = await loadCosmetic();
  const exclude = st.disabledSites.flatMap(sitePatterns);
  const genericExclude = exclude.concat([...cos.genericHide, ...cos.elemHide].flatMap(sitePatterns));
  const common = { matches: MATCHES, runAt: 'document_start', allFrames: true, matchOriginAsFallback: true };
  const scripts = [
    { id: 'toza-main', js: ['content/main-world.js'], world: 'MAIN', excludeMatches: exclude, ...common },
    { id: 'toza-content', js: ['content/content.js'], excludeMatches: exclude, ...common },
    { id: 'toza-generic', css: ['data/generic.css'], excludeMatches: genericExclude, ...common },
  ];
  try {
    await chrome.scripting.registerContentScripts(scripts);
  } catch (e) {
    // Eski brauzer versiyalari matchOriginAsFallback'ni bilmasligi mumkin
    console.warn('TozaEkran: qayta urinish (matchOriginAsFallback\'siz)', e);
    for (const s of scripts) delete s.matchOriginAsFallback;
    await chrome.scripting.registerContentScripts(scripts);
  }
}

async function syncDnr() {
  const st = await getSettings();
  const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
  if (st.enabled) {
    const toEnable = RULESETS.filter((r) => !enabled.includes(r));
    if (toEnable.length) await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: toEnable });
  } else if (enabled.length) {
    await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: enabled });
  }
  // O'chirilgan saytlar uchun "hamma narsaga ruxsat" qoidalari
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = st.disabledSites
    .filter((s) => /^[a-z0-9.-]+$/.test(s))
    .map((site, i) => ({
      id: SITE_RULE_BASE + i,
      priority: 100,
      action: { type: 'allowAllRequests' },
      condition: { requestDomains: [site], resourceTypes: ['main_frame', 'sub_frame'] },
    }));
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map((r) => r.id), addRules });
}

async function syncAll() {
  await syncDnr().catch((e) => console.warn('TozaEkran: DNR', e));
  await syncContentScripts().catch((e) => console.warn('TozaEkran: skriptlar', e));
  await updateIcon();
}

async function updateIcon() {
  const st = await getSettings();
  try {
    await chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: st.enabled });
    await chrome.action.setBadgeBackgroundColor({ color: '#0f9d76' });
    if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#ffffff' });
    await chrome.action.setTitle({ title: st.enabled ? 'TozaEkran — himoya yoqilgan' : 'TozaEkran — o\'chirilgan' });
  } catch { /* eski API */ }
}

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'toza-pick',
      title: 'TozaEkran: reklamani tanlab o\'chirish',
      contexts: ['page', 'image', 'link', 'frame', 'video'],
      documentUrlPatterns: MATCHES,
    });
  });
}

chrome.runtime.onInstalled.addListener(() => { createMenus(); syncAll(); });
chrome.runtime.onStartup.addListener(() => { syncAll(); });

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'toza-pick' && tab?.id >= 0) startPicker(tab.id);
});

async function startPicker(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content/picker.js'] });
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ statistika

// Statistik yozuvlar navbat bilan bajariladi (bir vaqtdagi yozuvlar bir-birini o'chirmasligi uchun)
let statQueue = Promise.resolve();
function bumpStat(tabId, kind, n = 1) {
  if (!(n > 0)) return statQueue;
  statQueue = statQueue.then(() => writeStat(tabId, kind, n)).catch(() => {});
  return statQueue;
}

async function writeStat(tabId, kind, n) {
  const key = `tab:${tabId}`;
  const cur = (await chrome.storage.session.get(key))[key] || { popups: 0, elements: 0 };
  cur[kind] = (cur[kind] || 0) + n;
  await chrome.storage.session.set({ [key]: cur });
  const st = await getSettings();
  const totals = { ...DEFAULTS.totals, ...st.totals };
  totals[kind] = (totals[kind] || 0) + n;
  await saveSettings({ totals });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`tab:${tabId}`);
  popupCandidates.delete(tabId);
  intents.delete(tabId);
  lastCommitted.delete(tabId);
  openedRecently.delete(tabId);
  matchedCache.delete(tabId);
});

// ------------------------------------------------------- popup yorliqlarni yopish

const popupCandidates = new Map(); // yangi yorliq → { src, srcHost, t }
const intents = new Map();         // yorliq → [{ site, t }] — foydalanuvchi bosgan havolalar
const lastCommitted = new Map();   // yorliq → { url, host }
const openedRecently = new Map();  // manba yorliq → vaqt (popup ochgan payti)

function hasIntent(srcTabId, host) {
  const list = intents.get(srcTabId);
  if (!list) return false;
  const now = Date.now();
  const site = baseDomain(host);
  return list.some((i) => now - i.t < 5000 && i.site === site);
}

async function closePopup(tabId, cand, reason) {
  popupCandidates.delete(tabId);
  try {
    await chrome.tabs.remove(tabId);
    if (cand?.src >= 0) {
      chrome.tabs.update(cand.src, { active: true }).catch(() => {});
      bumpStat(cand.src, 'popups');
    }
    console.debug('TozaEkran: popup yopildi', reason);
  } catch { /* allaqachon yopilgan */ }
}

async function checkPopup(tabId, url) {
  const cand = popupCandidates.get(tabId);
  if (!cand) return;
  if (Date.now() - cand.t > 20000) { popupCandidates.delete(tabId); return; }
  const host = hostOf(url);
  if (!host) return; // about:blank — keyingi navigatsiyani kutamiz
  if (baseDomain(host) === baseDomain(cand.srcHost)) return;
  if (hasIntent(cand.src, host)) return;
  if (await isAdHost(host)) return closePopup(tabId, cand, 'reklama domeni: ' + host);
  const st = await getSettings();
  if (await isStrictSite(cand.srcHost, st)) {
    // Foydalanuvchi bosgan havola haqidagi xabar biroz kechikishi mumkin
    await new Promise((r) => setTimeout(r, 150));
    if (!hasIntent(cand.src, host) && popupCandidates.has(tabId)) {
      return closePopup(tabId, cand, 'qattiq rejim: ' + host);
    }
  }
}

chrome.webNavigation.onCreatedNavigationTarget.addListener(async (d) => {
  const st = await getSettings();
  if (!st.enabled) return;
  let srcHost = '';
  try { srcHost = hostOf((await chrome.tabs.get(d.sourceTabId)).url); } catch { /* yorliq yo'q */ }
  if (!srcHost && lastCommitted.has(d.sourceTabId)) srcHost = lastCommitted.get(d.sourceTabId).host;
  if (!srcHost || isDisabled(srcHost, st)) return;
  popupCandidates.set(d.tabId, { src: d.sourceTabId, srcHost, t: Date.now() });
  openedRecently.set(d.sourceTabId, Date.now());
  checkPopup(d.tabId, d.url);
});

chrome.webNavigation.onBeforeNavigate.addListener((d) => {
  if (d.frameId === 0 && popupCandidates.has(d.tabId)) checkPopup(d.tabId, d.url);
});

// Reklamaga yo'naltirish xato bilan tugasa (masalan, DNR bloklagan) ham orqaga qaytamiz
chrome.webNavigation.onErrorOccurred.addListener((d) => {
  if (d.frameId !== 0 || /ERR_ABORTED/.test(d.error)) return;
  if (popupCandidates.has(d.tabId)) { checkPopup(d.tabId, d.url); return; }
  handleRedirect(d, []);
});

chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId !== 0) return;
  const prev = lastCommitted.get(d.tabId);
  const host = hostOf(d.url);
  lastCommitted.set(d.tabId, { url: d.url, host });
  matchedCache.delete(d.tabId);
  if (popupCandidates.has(d.tabId)) checkPopup(d.tabId, d.url);

  // Sahifa yangilandi — yorliq statistikasini nolga tushiramiz
  const userNav = ['typed', 'auto_bookmark', 'generated', 'reload', 'keyword', 'start_page'].includes(d.transitionType);
  if (!prev || prev.host !== host || d.transitionType === 'reload') chrome.storage.session.remove(`tab:${d.tabId}`);

  if (userNav || d.transitionQualifiers?.includes('forward_back')) return;
  handleRedirect(d, d.transitionQualifiers || [], prev);
});

// "Tab-under": sahifa o'zini yangi yorliqda ochib, joriy yorliqni reklamaga yo'naltiradi
async function handleRedirect(d, qualifiers, prev = lastCommitted.get(d.tabId)) {
  const host = hostOf(d.url);
  if (!prev || !prev.host || !host || baseDomain(prev.host) === baseDomain(host)) return;
  const st = await getSettings();
  if (!st.enabled || isDisabled(prev.host, st) || hasIntent(d.tabId, host)) return;
  const justOpened = Date.now() - (openedRecently.get(d.tabId) || 0) < 4000;
  if (!justOpened && !qualifiers.includes('client_redirect')) return;
  if (!(await isAdHost(host))) return;
  openedRecently.delete(d.tabId);
  lastCommitted.set(d.tabId, prev);
  chrome.tabs.update(d.tabId, { url: prev.url }).catch(() => {});
  bumpStat(d.tabId, 'popups');
}

// -------------------------------------------------------------------- xabarlar

// Yorliqdagi bloklangan so'rovlar soni. getMatchedRules chaqiruvlari cheklangan
// (10 daqiqada ~20 marta), shuning uchun natijani qisqa muddat saqlab turamiz.
const matchedCache = new Map();
async function blockedCount(tabId) {
  const c = matchedCache.get(tabId);
  if (c && Date.now() - c.t < 30000) return c.n;
  let n = null;
  try {
    const r = await chrome.declarativeNetRequest.getMatchedRules({ tabId });
    const allow = await loadAllowIds();
    n = r.rulesMatchedInfo.filter((m) => m.rule.rulesetId !== '_dynamic' && !allow[m.rule.rulesetId]?.has(m.rule.ruleId)).length;
    matchedCache.set(tabId, { n, t: Date.now() });
  } catch { /* chaqiruvlar limiti */ }
  try {
    const text = await chrome.action.getBadgeText({ tabId });
    const badge = parseInt(text, 10);
    if (Number.isFinite(badge) && (n === null || badge > n)) n = badge;
    else if (n === null && !text) n = 0;
  } catch { /* yo'q */ }
  return n;
}

const handlers = {
  // Kontent-skript sahifa boshida yuboradi
  async init(msg, sender) {
    const st = await getSettings();
    const host = String(msg.host || '').toLowerCase();
    const tabId = sender.tab?.id;
    if (!st.enabled || tabId === undefined) return { enabled: false };
    const topHost = hostOf(sender.tab?.url) || host;
    if (isDisabled(topHost, st) || isDisabled(host, st)) return { enabled: false };
    const cos = await cosmeticFor(host);
    injectCss(tabId, sender.frameId, sender.documentId, cos.css);
    return {
      enabled: true,
      proc: cos.proc,
      strict: await isStrictSite(topHost, st),
      topHost,
    };
  },

  async intent(msg, sender) {
    const tabId = sender.tab?.id;
    const host = hostOf(msg.href);
    if (tabId === undefined || !host) return;
    const list = (intents.get(tabId) || []).filter((i) => Date.now() - i.t < 5000);
    list.push({ site: baseDomain(host), t: Date.now() });
    intents.set(tabId, list);
  },

  async stat(msg, sender) {
    if (sender.tab?.id !== undefined) await bumpStat(sender.tab.id, msg.kind === 'popup' ? 'popups' : 'elements', msg.n || 1);
  },

  async checkHosts(msg) {
    const out = [];
    for (const h of msg.hosts || []) if (await isAdHost(String(h).toLowerCase())) out.push(h);
    return out;
  },

  async getState(msg) {
    const st = await getSettings();
    let tab = null;
    try { tab = await chrome.tabs.get(msg.tabId); } catch { /* yo'q */ }
    const host = hostOf(tab?.url);
    const site = normSite(host);
    const web = /^https?:/.test(tab?.url || '');
    const requests = await blockedCount(msg.tabId);
    const tabStats = (await chrome.storage.session.get(`tab:${msg.tabId}`))[`tab:${msg.tabId}`] || { popups: 0, elements: 0 };
    const pd = await loadPopupData();
    return {
      enabled: st.enabled,
      web,
      host,
      site,
      siteEnabled: web && !isDisabled(host, st),
      strict: st.strictSites.some((s) => siteMatches(site, s)),
      builtinStrict: web && matchSet(pd.strict, site),
      customCount: Object.entries(st.customRules).filter(([s]) => siteMatches(site, s)).reduce((n, [, v]) => n + v.length, 0),
      requests,
      tabStats,
      totals: st.totals,
      version: chrome.runtime.getManifest().version,
    };
  },

  async toggleGlobal(msg) {
    await saveSettings({ enabled: !!msg.enabled });
    await syncAll();
    return true;
  },

  async toggleSite(msg) {
    const st = await getSettings();
    const site = normSite(msg.site);
    if (!site) return false;
    let list = st.disabledSites.filter((s) => s !== site && !siteMatches(site, s));
    if (!msg.enabled) list = [...list, site];
    await saveSettings({ disabledSites: list.sort() });
    await syncAll();
    return true;
  },

  async toggleStrict(msg) {
    const st = await getSettings();
    const site = normSite(msg.site);
    let list = st.strictSites.filter((s) => s !== site);
    if (msg.enabled) list = [...list, site];
    await saveSettings({ strictSites: list.sort() });
    return true;
  },

  async startPicker(msg) {
    return startPicker(msg.tabId);
  },

  async addRule(msg, sender) {
    const site = normSite(msg.site || hostOf(sender.tab?.url));
    const sel = String(msg.selector || '').trim();
    if (!site || !sel) return false;
    const st = await getSettings();
    const rules = { ...st.customRules };
    rules[site] = [...new Set([...(rules[site] || []), sel])];
    await saveSettings({ customRules: rules });
    if (sender.tab?.id !== undefined) {
      // Butun yorliqqa (barcha freymlarga) darhol qo'llaymiz
      chrome.scripting.insertCSS({
        target: { tabId: sender.tab.id, allFrames: true },
        css: `${sel} { display: none !important; }`,
        origin: 'USER',
      }).catch(() => {});
      bumpStat(sender.tab.id, 'elements');
    }
    return true;
  },

  async removeRule(msg) {
    const st = await getSettings();
    const rules = { ...st.customRules };
    if (msg.selector === undefined) delete rules[msg.site];
    else {
      rules[msg.site] = (rules[msg.site] || []).filter((s) => s !== msg.selector);
      if (!rules[msg.site].length) delete rules[msg.site];
    }
    await saveSettings({ customRules: rules });
    return true;
  },

  async getSettings() {
    const st = await getSettings();
    let info = null;
    try { info = await (await fetch(chrome.runtime.getURL('data/build-info.json'))).json(); } catch { /* yo'q */ }
    return { settings: st, info, builtinStrict: [...(await loadPopupData()).strict] };
  },

  async importSettings(msg) {
    const s = msg.settings || {};
    const patch = {};
    if (typeof s.enabled === 'boolean') patch.enabled = s.enabled;
    if (Array.isArray(s.disabledSites)) patch.disabledSites = s.disabledSites.map(normSite).filter(Boolean);
    if (Array.isArray(s.strictSites)) patch.strictSites = s.strictSites.map(normSite).filter(Boolean);
    if (s.customRules && typeof s.customRules === 'object') {
      patch.customRules = {};
      for (const [k, v] of Object.entries(s.customRules)) {
        if (Array.isArray(v)) patch.customRules[normSite(k)] = v.map(String);
      }
    }
    await saveSettings(patch);
    await syncAll();
    return true;
  },

  async resetStats() {
    await saveSettings({ totals: { ...DEFAULTS.totals } });
    return true;
  },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const h = msg && handlers[msg.type];
  if (!h) return false;
  Promise.resolve(h(msg, sender))
    .then((r) => sendResponse(r))
    .catch((e) => { console.warn('TozaEkran:', msg.type, e); sendResponse(null); });
  return true;
});
