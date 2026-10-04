#!/usr/bin/env node
// AdVanish filtr generatori.
//
// EasyList, RuAdList va AdGuard (kirill + xorijiy) ro'yxatlarini quyidagilarga aylantiradi:
//   extension/rules/*.json        — Manifest V3 declarativeNetRequest statik qoidalari
//   extension/data/generic.css    — barcha saytlar uchun umumiy yashirish selektorlari
//   extension/data/cosmetic.json  — saytga xos selektorlar, CSS va istisnolar
//   extension/data/popup.json     — popup/reklama domenlari (yorliqlarni yopish uchun)
//
// Ishlatish:  node build-filters.mjs <ro'yxatlar-papkasi> [extension-papkasi]
// Ro'yxatlarni yuklab olish uchun: ./update-filters.sh

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const LISTS = path.resolve(process.argv[2] || path.join(HERE, 'lists'));
const OUT = path.resolve(process.argv[3] || path.join(HERE, '..', 'extension'));

// Har bir DNR qoidalar to'plami (ruleset) va unga kiruvchi fayllar.
const RULESETS = [
  {
    id: 'easylist',
    files: [
      'easylist/easylist/easylist_adservers.txt',
      'easylist/easylist/easylist_adservers_popup.txt',
      'easylist/easylist/easylist_allowlist.txt',
      'easylist/easylist/easylist_allowlist_general_hide.txt',
      'easylist/easylist/easylist_allowlist_popup.txt',
      'easylist/easylist/easylist_general_block.txt',
      'easylist/easylist/easylist_general_block_popup.txt',
      'easylist/easylist/easylist_general_hide.txt',
      'easylist/easylist/easylist_specific_block.txt',
      'easylist/easylist/easylist_specific_block_popup.txt',
      'easylist/easylist/easylist_specific_hide.txt',
      'easylist/easylist/easylist_thirdparty.txt',
      'easylist/easylist/easylist_thirdparty_popup.txt',
    ],
  },
  {
    id: 'cyrillic',
    files: [
      'ruadlist/advblock/adservers.txt',
      'ruadlist/advblock/first_level.txt',
      'ruadlist/advblock/general_block.txt',
      'ruadlist/advblock/general_hide.txt',
      'ruadlist/advblock/inline_css.txt',
      'ruadlist/advblock/popup.txt',
      'ruadlist/advblock/specific_block.txt',
      'ruadlist/advblock/specific_hide.txt',
      'ruadlist/advblock/specific_special.txt',
      'ruadlist/advblock/thirdparty.txt',
      'ruadlist/advblock/whitelist.txt',
      'AdguardFilters/CyrillicFilters/common-sections/adservers.txt',
      'AdguardFilters/CyrillicFilters/common-sections/allowlist.txt',
      'AdguardFilters/CyrillicFilters/common-sections/general_elemhide.txt',
      'AdguardFilters/CyrillicFilters/common-sections/general_url.txt',
      'AdguardFilters/CyrillicFilters/common-sections/specific.txt',
      'AdguardFilters/CyrillicFilters/RussianFilter/sections/allowlist.txt',
      'AdguardFilters/CyrillicFilters/RussianFilter/sections/specific.txt',
      'AdguardFilters/BaseFilter/sections/foreign.txt',
    ],
  },
  {
    id: 'advanish',
    files: [path.join(HERE, 'extra-filters.txt')],
  },
];

const ALL_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'media', 'websocket', 'other',
];
const TYPE_MAP = {
  script: ['script'], image: ['image'], stylesheet: ['stylesheet'], css: ['stylesheet'],
  object: ['object'], 'object-subrequest': ['object'], xmlhttprequest: ['xmlhttprequest'],
  xhr: ['xmlhttprequest'], subdocument: ['sub_frame'], frame: ['sub_frame'], ping: ['ping'],
  beacon: ['ping'], media: ['media'], mp4: ['media'], font: ['font'], websocket: ['websocket'],
  other: ['other'], document: ['main_frame'], doc: ['main_frame'],
};
// Bu parametrli qoidalarni MV3 da to'g'ri ifodalab bo'lmaydi — tashlab ketamiz.
const UNSUPPORTED_OPTS = new Set([
  'csp', 'removeparam', 'queryprune', 'rewrite', 'replace', 'header', 'permissions', 'cookie',
  'hls', 'jsonprune', 'xmlprune', 'urltransform', 'method', 'to', 'strict1p', 'strict3p',
  'app', 'network', 'redirect-rule', 'inline-script', 'inline-font', 'webrtc', 'sitekey',
  'genericblock', 'stealth', 'content', 'jsinject', 'urlblock', 'extension', 'specifichide',
  'removeheader', 'referrerpolicy', 'ipaddress',
]);
const COSMETIC_OPTS = new Set(['generichide', 'elemhide', 'ghide', 'ehide', 'shide']);

const stats = { lines: 0, network: 0, cosmetic: 0, skipped: 0 };

// ---------------------------------------------------------------- yordamchilar

function toAsciiDomain(d) {
  d = d.trim().toLowerCase();
  if (!d) return '';
  if (/[^\x00-\x7f]/.test(d)) d = url.domainToASCII(d);
  return d;
}
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}$|^\d{1,3}(?:\.\d{1,3}){3}$/;
const isDomain = (d) => DOMAIN_RE.test(d);

// "a.com|~b.com" yoki "a.com,~b.com" → { pos: [...], neg: [...], wildcard: bool }
function parseDomainList(str, sep) {
  const pos = [], neg = [];
  let unsupported = false;
  for (let raw of str.split(sep)) {
    raw = raw.trim();
    if (!raw) continue;
    const negated = raw.startsWith('~');
    if (negated) raw = raw.slice(1);
    if (raw.startsWith('/')) { unsupported = true; continue; } // regex domen
    const d = toAsciiDomain(raw);
    if (!d) continue;
    (negated ? neg : pos).push(d);
  }
  return { pos, neg, unsupported };
}

const uniq = (a) => [...new Set(a)];

// ------------------------------------------------------------- tarmoq qoidalari

// Tab yopuvchi (background) uchun ma'lumot
const popupDomains = new Set();     // ||domen^$popup
const popupAllow = new Set();       // @@||domen^$popup
const strictSites = new Set();      // $popup,domain=sayt  → saytdan barcha begona popuplar yopiladi
const adHosts = new Set();          // ||domen^ (reklama serverlari) — popup sifatida ochilsa yopiladi
const genericHideSites = new Set(); // @@...$generichide
const elemHideSites = new Set();    // @@...$elemhide

function parseNetwork(line) {
  let allow = false;
  if (line.startsWith('@@')) { allow = true; line = line.slice(2); }

  // Pattern va parametrlarni ajratish
  let pattern = line, optStr = '';
  if (line.startsWith('/') && line.includes('/$') && !line.endsWith('/')) {
    const i = line.lastIndexOf('/$');
    pattern = line.slice(0, i + 1);
    optStr = line.slice(i + 2);
  } else if (!(line.startsWith('/') && line.endsWith('/'))) {
    const i = line.lastIndexOf('$');
    if (i !== -1 && !/[\/^|*]/.test(line.slice(i + 1).split(',')[0].replace(/=.*/, ''))) {
      pattern = line.slice(0, i);
      optStr = line.slice(i + 1);
    }
  }

  const opts = optStr ? optStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const types = new Set(), notTypes = new Set();
  let domainType, initiators, notInitiators, excludedRequestDomains;
  let important = false, popup = false, caseSensitive = false, all = false;
  const cosmeticExc = [];

  for (const o of opts) {
    const [nameRaw, ...rest] = o.split('=');
    const value = rest.join('=');
    const neg = nameRaw.startsWith('~');
    const name = (neg ? nameRaw.slice(1) : nameRaw).toLowerCase();
    if (UNSUPPORTED_OPTS.has(name)) return null;
    if (COSMETIC_OPTS.has(name)) { cosmeticExc.push(name); continue; }
    if (name === 'badfilter') return null; // alohida qayta ishlanadi
    if (name === 'third-party' || name === '3p') { domainType = neg ? 'firstParty' : 'thirdParty'; continue; }
    if (name === 'first-party' || name === '1p') { domainType = neg ? 'thirdParty' : 'firstParty'; continue; }
    if (name === 'domain' || name === 'from') {
      const dl = parseDomainList(value, '|');
      const pos = dl.pos.filter((d) => !d.includes('*'));
      const negs = dl.neg.filter((d) => !d.includes('*'));
      if ((dl.pos.length && !pos.length) || (dl.unsupported && !pos.length && !negs.length)) return null;
      if (pos.length) initiators = pos;
      if (negs.length) notInitiators = negs;
      continue;
    }
    if (name === 'denyallow') {
      excludedRequestDomains = parseDomainList(value, '|').pos.filter((d) => !d.includes('*'));
      continue;
    }
    if (name === 'important') { important = true; continue; }
    if (name === 'match-case') { caseSensitive = true; continue; }
    if (name === 'popup') { popup = true; continue; }
    if (name === 'all') { all = true; continue; }
    if (name === 'redirect' || name === 'empty') continue; // shunchaki bloklaymiz
    if (TYPE_MAP[name]) {
      for (const t of TYPE_MAP[name]) (neg ? notTypes : types).add(t);
      continue;
    }
    return null; // noma'lum parametr
  }

  // Kosmetik istisnolar ($generichide / $elemhide)
  if (cosmeticExc.length) {
    if (!allow) return null;
    const m = pattern.match(/^\|\|([^\/^*|]+)/);
    const sites = initiators || (m ? [toAsciiDomain(m[1])] : []);
    for (const s of sites) {
      if (!isDomain(s)) continue;
      if (cosmeticExc.some((n) => n === 'elemhide' || n === 'ehide')) elemHideSites.add(s);
      else genericHideSites.add(s);
    }
    if (!types.size && !popup && !all) return null;
  }

  const domainOnly = pattern.match(/^\|\|([a-z0-9.-]+)\^?\|?$/i);
  const onlyDomain = domainOnly && isDomain(domainOnly[1].toLowerCase()) ? domainOnly[1].toLowerCase() : null;

  // Popup qoidalari — background'dagi yorliq yopuvchi uchun
  if (popup && !types.size && !all) {
    if (allow) { if (onlyDomain) popupAllow.add(onlyDomain); return null; }
    if ((pattern === '' || pattern === '*') && initiators) {
      for (const s of initiators) strictSites.add(s);
      return null;
    }
    if (onlyDomain && !initiators) popupDomains.add(onlyDomain);
    return null;
  }
  if ((popup || all) && onlyDomain && !allow && !initiators) popupDomains.add(onlyDomain);

  // Shartni qurish
  const condition = {};
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
    const re = pattern.slice(1, -1);
    // RE2 qo'llab-quvvatlamaydigan konstruksiyalar
    if (/\(\?[=!<]|\\[1-9]|\(\?>|[*+?}]\+/.test(re) || re.length > 250) return null;
    if (/[^\x00-\x7f]/.test(re)) return null;
    condition.regexFilter = re;
  } else if (onlyDomain) {
    condition.requestDomains = [onlyDomain];
  } else {
    let p = pattern;
    if (p === '*' || p === '') p = '';
    if (/[^\x00-\x7f]/.test(p)) return null;
    if (p.startsWith('||*')) p = p.slice(2);
    if (p && /^\*+$/.test(p)) p = '';
    if (p) condition.urlFilter = p;
    if (!p && !initiators && !excludedRequestDomains) return null; // hamma narsani bloklovchi qoida — xavfli
  }
  if (condition.urlFilter || condition.regexFilter) condition.isUrlFilterCaseSensitive = caseSensitive;
  if (domainType) condition.domainType = domainType;
  if (initiators) condition.initiatorDomains = uniq(initiators);
  if (notInitiators) condition.excludedInitiatorDomains = uniq(notInitiators);
  if (excludedRequestDomains?.length) condition.excludedRequestDomains = uniq(excludedRequestDomains);

  let action = { type: allow ? 'allow' : 'block' };
  let priority = important ? 3 : 1;

  if (allow && types.has('main_frame')) {
    // @@...$document → sahifadagi hamma narsaga ruxsat
    action = { type: 'allowAllRequests' };
    condition.resourceTypes = ['main_frame', 'sub_frame'];
    priority = important ? 4 : 2;
  } else if (all) {
    condition.resourceTypes = [...ALL_TYPES];
  } else if (types.size) {
    condition.resourceTypes = [...types].sort();
  } else if (notTypes.size) {
    if (!allow) notTypes.add('main_frame');
    condition.excludedResourceTypes = [...notTypes].sort();
  }

  if (!allow && !initiators && onlyDomain && !domainType && !types.size && !notTypes.size) {
    adHosts.add(onlyDomain);
  }
  if (!allow && types.has('main_frame') && onlyDomain) popupDomains.add(onlyDomain);

  return { priority, action, condition };
}

// ----------------------------------------------------------- kosmetik qoidalar

const genericHide = new Set();            // umumiy selektorlar
const genericNeg = new Map();             // selektor → istisno domenlar (~domen##sel)
const genericExcepted = new Map();        // selektor → domenlar, #@# bilan o'chirilgan
const globalExcepted = new Set();         // #@#sel (domensiz) — umuman o'chirilgan
const spec = new Map();                   // domen → { h:Set, c:Set, p:Set, x:Set }

function specFor(d) {
  let e = spec.get(d);
  if (!e) { e = { h: new Set(), c: new Set(), p: new Set(), x: new Set() }; spec.set(d, e); }
  return e;
}

const PROCEDURAL_SKIP = /:(?:matches-css(?:-before|-after)?|xpath|min-text-length|watch-attr|matches-path|others|if|if-not|matches-attr|matches-prop|-abp-properties|matches-media|remove-attr|remove-class|nth-ancestor|upward|shadow|spath|not\(.*:(?:has-text|contains))\(/;
const PROCEDURAL_TEXT = /:(?:has-text|-abp-contains|contains)\(/;

// "selektor" → { kind: 'hide'|'css'|'proc', value } yoki null
function convertSelector(body, allowCss) {
  body = body.trim();
  if (!body || body.startsWith('+js') || body.startsWith('^') || body.startsWith('%')) return null;
  body = body.replace(/:-abp-has\(/g, ':has(');

  // uBO :style(...) va :remove()
  let m = body.match(/^(.*?):style\((.+)\)$/);
  if (m) return allowCss ? { kind: 'css', value: `${m[1]} { ${m[2]} }` } : null;
  m = body.match(/^(.*?):remove\(\)$/);
  if (m) body = m[1];
  // AdGuard/RuAdList "selektor { css }" ko'rinishi
  m = body.match(/^([^{}]+?)\s*\{([^{}]+)\}\s*$/);
  if (m) return allowCss ? { kind: 'css', value: `${m[1].trim()} { ${m[2].trim()} }` } : null;

  if (PROCEDURAL_SKIP.test(body)) return null;
  if (PROCEDURAL_TEXT.test(body)) {
    // Faqat "BASE:has-text(matn)" ko'rinishini qo'llab-quvvatlaymiz (oxirida turgan bo'lsa)
    const pm = body.match(/^(.+?):(?:has-text|-abp-contains|contains)\((.+)\)$/);
    if (!pm || PROCEDURAL_TEXT.test(pm[1]) || PROCEDURAL_TEXT.test(pm[2]) || /^\s*[>+~]/.test(pm[1])) return null;
    return { kind: 'proc', value: JSON.stringify([pm[1].trim(), pm[2]]) };
  }
  return { kind: 'hide', value: body };
}

function parseCosmetic(domainsStr, sep, body) {
  const exception = sep.includes('@');
  const isCssInject = sep.includes('$');
  if (sep.includes('%')) return false; // skriptletlar/JS
  const dl = parseDomainList(domainsStr, ',');
  if (dl.unsupported) return false;
  const pos = dl.pos, neg = dl.neg;

  let conv;
  if (isCssInject) {
    let b = body.trim().replace(/:-abp-has\(/g, ':has(');
    if (/\{[^}]*remove\s*:\s*true/.test(b)) b = b.replace(/\{[^}]*\}/, '{ display: none !important; }');
    if (!/^[^{}]+\{[^{}]+\}$/.test(b) || PROCEDURAL_TEXT.test(b) || PROCEDURAL_SKIP.test(b)) return false;
    conv = { kind: 'css', value: b };
  } else {
    conv = convertSelector(body, !exception);
  }
  if (!conv) return false;

  if (exception) {
    if (conv.kind !== 'hide') return false;
    if (!pos.length) { globalExcepted.add(conv.value); return true; }
    for (const d of pos) {
      specFor(d).x.add(conv.value);
      if (!genericExcepted.has(conv.value)) genericExcepted.set(conv.value, new Set());
      genericExcepted.get(conv.value).add(d);
    }
    return true;
  }

  if (!pos.length) {
    if (conv.kind !== 'hide') {
      // Umumiy CSS / protsedural qoidalar juda kam — ularni "*" kalitiga yozamiz
      const e = specFor('*');
      (conv.kind === 'css' ? e.c : e.p).add(conv.value);
      return true;
    }
    if (neg.length) {
      if (!genericNeg.has(conv.value)) genericNeg.set(conv.value, new Set());
      for (const d of neg) genericNeg.get(conv.value).add(d);
    } else {
      genericHide.add(conv.value);
    }
    return true;
  }
  for (const d of pos) {
    const e = specFor(d);
    if (conv.kind === 'hide') e.h.add(conv.value);
    else if (conv.kind === 'css') e.c.add(conv.value);
    else e.p.add(conv.value);
  }
  if (conv.kind === 'hide') for (const d of neg) specFor(d).x.add(conv.value);
  return true;
}

// --------------------------------------------------------------- asosiy oqim

const COSMETIC_RE = /^([^#\/|^$@]*?)(#@?[$?%]{0,2}#)(.*)$/;

function processFile(file, rulesOut, badfilters) {
  const text = fs.readFileSync(file, 'utf8');
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    stats.lines++;
    if (!line || line.startsWith('!') || line.startsWith('[') || line.startsWith('#') && !line.startsWith('##') && !line.startsWith('#@#') && !line.startsWith('#$#') && !line.startsWith('#?#')) continue;
    if (line.includes('$$') || line.includes('$@$')) { stats.skipped++; continue; } // HTML filtrlash
    const cm = line.match(COSMETIC_RE);
    if (cm && /^[a-z0-9.*~,\-_\u0080-￿]*$/i.test(cm[1])) {
      if (parseCosmetic(cm[1], cm[2], cm[3])) stats.cosmetic++; else stats.skipped++;
      continue;
    }
    if (/\$(?:.*,)?badfilter(?:,|$)/.test(line)) {
      badfilters.add(line.replace(/\$badfilter$/, '').replace(/,badfilter(?=,|$)/, '').replace(/\$badfilter,/, '$'));
      continue;
    }
    rulesOut.push(line);
  }
}

function buildRuleset(lines, badfilters) {
  const rules = [];
  const groups = new Map(); // faqat-domen qoidalarini guruhlash
  for (const line of lines) {
    if (badfilters.has(line)) { stats.skipped++; continue; }
    const r = parseNetwork(line);
    if (!r) { stats.skipped++; continue; }
    stats.network++;
    const c = r.condition;
    if (c.requestDomains && c.requestDomains.length === 1) {
      const { requestDomains, ...rest } = c;
      const key = JSON.stringify([r.priority, r.action, rest]);
      if (!groups.has(key)) groups.set(key, { priority: r.priority, action: r.action, condition: { ...rest, requestDomains: [] } });
      groups.get(key).condition.requestDomains.push(requestDomains[0]);
      continue;
    }
    rules.push(r);
  }
  // Takroriy qoidalarni olib tashlash
  const seen = new Set();
  const out = [];
  for (const g of groups.values()) {
    g.condition.requestDomains = uniq(g.condition.requestDomains).sort();
    // Juda katta ro'yxatlarni bo'lib chiqamiz
    for (let i = 0; i < g.condition.requestDomains.length; i += 5000) {
      out.push({ priority: g.priority, action: g.action, condition: { ...g.condition, requestDomains: g.condition.requestDomains.slice(i, i + 5000) } });
    }
  }
  for (const r of rules) {
    const k = JSON.stringify(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

const regexKey = (c) => `${c.isUrlFilterCaseSensitive ? 1 : 0}|${c.regexFilter}`;

// Chrome regexFilter'ni RE2 bilan kompilyatsiya qiladi va 2 KB xotira limitidan oshganlarini
// o'tkazib yuborib, kengaytmalar sahifasida ogohlantirish ko'rsatadi. Shuning uchun har bir
// regex'ni oldindan brauzerning o'zida (isRegexSupported) tekshiramiz.
async function validateRegexes(conds) {
  const keys = [...new Set(conds.map(regexKey))];
  const chromium = await loadChromium();
  if (!chromium) {
    console.warn('! Playwright topilmadi — regex qoidalari taxminiy tekshirildi');
    // Taxminiy tekshiruv: katta takrorlash chegaralari xotira limitidan oshishiga olib keladi
    return new Set(keys.filter((k) => {
      const re = k.slice(2);
      return re.length <= 120 && ![...re.matchAll(/\{(\d+)(?:,(\d*))?\}/g)].some((m) => +m[1] > 8 || m[2] === '' || +m[2] > 8);
    }));
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advanish-rx-'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'rx', version: '1',
    background: { service_worker: 'sw.js' }, permissions: ['declarativeNetRequest'],
  }));
  fs.writeFileSync(path.join(dir, 'sw.js'), '');
  const ctx = await chromium.launchPersistentContext(path.join(dir, 'profile'), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
  });
  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const ok = await sw.evaluate(async (list) => {
      const res = [];
      for (const k of list) {
        const r = await chrome.declarativeNetRequest.isRegexSupported({ regex: k.slice(2), isCaseSensitive: k[0] === '1' });
        res.push(r.isSupported);
      }
      return res;
    }, keys);
    return new Set(keys.filter((_, i) => ok[i]));
  } finally {
    await ctx.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

let chromiumCache;
async function loadChromium() {
  if (chromiumCache !== undefined) return chromiumCache;
  chromiumCache = null;
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright/index.js', 'playwright-core']) {
    try {
      const pw = await import(p);
      chromiumCache = pw.chromium || pw.default?.chromium || null;
      if (chromiumCache) break;
    } catch { /* keyingisini sinab ko'ramiz */ }
  }
  return chromiumCache;
}

// Selektorlarni haqiqiy Chromium'da tekshirish (Playwright mavjud bo'lsa)
async function validateInBrowser(selectors, cssRules) {
  const chromium = await loadChromium();
  if (!chromium) {
    console.warn('! Playwright topilmadi — selektorlar brauzerda tekshirilmadi');
    return { selOk: new Set(selectors), cssOk: new Set(cssRules) };
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  const [selRes, cssRes] = await page.evaluate(([sels, css]) => {
    const frag = document.createDocumentFragment();
    const okSel = sels.map((s) => {
      try { frag.querySelector(s); return !/[{}]/.test(s); } catch { return false; }
    });
    const okCss = css.map((c) => {
      try {
        const sh = new CSSStyleSheet();
        sh.replaceSync(c);
        return sh.cssRules.length === 1 && sh.cssRules[0].style && sh.cssRules[0].style.length > 0;
      } catch { return false; }
    });
    return [okSel, okCss];
  }, [selectors, cssRules]);
  await browser.close();
  return {
    selOk: new Set(selectors.filter((_, i) => selRes[i])),
    cssOk: new Set(cssRules.filter((_, i) => cssRes[i])),
  };
}

async function main() {
  const badfilters = new Set();
  const perRuleset = [];
  for (const rs of RULESETS) {
    const lines = [];
    for (const f of rs.files) {
      const p = path.isAbsolute(f) ? f : path.join(LISTS, f);
      if (!fs.existsSync(p)) { console.warn(`! fayl topilmadi: ${p}`); continue; }
      processFile(p, lines, badfilters);
    }
    perRuleset.push({ id: rs.id, lines });
  }

  fs.mkdirSync(path.join(OUT, 'rules'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  const built = perRuleset.map(({ id, lines }) => ({ id, rules: buildRuleset(lines, badfilters) }));
  const regexConds = built.flatMap((b) => b.rules.map((r) => r.condition).filter((c) => c.regexFilter));
  const regexOk = await validateRegexes(regexConds);
  console.log('Regex qoidalari:', regexConds.length, '| brauzer qabul qilmagani:', regexConds.filter((c) => !regexOk.has(regexKey(c))).length);

  const rulesetMeta = [];
  const allowIds = {};
  for (const { id, rules: raw } of built) {
    let regexCount = 0;
    const rules = [];
    for (const r of raw) {
      if (r.condition.regexFilter && (!regexOk.has(regexKey(r.condition)) || ++regexCount > 300)) continue;
      rules.push({ id: rules.length + 1, ...r });
    }
    fs.writeFileSync(path.join(OUT, 'rules', `${id}.json`), JSON.stringify(rules));
    rulesetMeta.push({ id, count: rules.length });
    allowIds[id] = rules.filter((r) => r.action.type !== 'block').map((r) => r.id);
  }
  // Statistikada ruxsat beruvchi qoidalarni hisobga olmaslik uchun
  fs.writeFileSync(path.join(OUT, 'data', 'allow-ids.json'), JSON.stringify(allowIds));

  // --- Kosmetik ma'lumotlarni tekshirish
  for (const s of globalExcepted) { genericHide.delete(s); genericNeg.delete(s); }
  const allSel = new Set([...genericHide, ...genericNeg.keys()]);
  const allCss = new Set();
  for (const e of spec.values()) {
    for (const s of e.h) allSel.add(s);
    for (const s of e.x) allSel.add(s);
    for (const c of e.c) allCss.add(c);
    for (const p of e.p) allSel.add(JSON.parse(p)[0]);
  }
  const { selOk, cssOk } = await validateInBrowser([...allSel], [...allCss]);

  // Umumiy CSS: istisnosi yo'q selektorlar statik faylga, istisnolilari cosmetic.json ga
  const genericStatic = [];
  const genericExceptOut = [];
  for (const s of genericHide) {
    if (!selOk.has(s)) continue;
    if (genericExcepted.has(s)) genericExceptOut.push([s, [...genericExcepted.get(s)].sort()]);
    else genericStatic.push(s);
  }
  for (const [s, doms] of genericNeg) {
    if (!selOk.has(s)) continue;
    const all = new Set([...doms, ...(genericExcepted.get(s) || [])]);
    genericExceptOut.push([s, [...all].sort()]);
  }
  genericStatic.sort();
  let css = '/* AdVanish — umumiy yashirish qoidalari (avtomatik yaratilgan) */\n';
  for (let i = 0; i < genericStatic.length; i += 40) {
    css += genericStatic.slice(i, i + 40).join(',\n') + '\n{ display: none !important; }\n';
  }
  fs.writeFileSync(path.join(OUT, 'data', 'generic.css'), css);

  const specOut = {};
  for (const [d, e] of [...spec.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const o = {};
    const h = [...e.h].filter((s) => selOk.has(s) && !e.x.has(s));
    const c = [...e.c].filter((s) => cssOk.has(s));
    const p = [...e.p].filter((s) => selOk.has(JSON.parse(s)[0])).map((s) => JSON.parse(s));
    const x = [...e.x].filter((s) => selOk.has(s));
    if (h.length) o.h = h;
    if (c.length) o.c = c;
    if (p.length) o.p = p;
    if (x.length) o.x = x;
    if (Object.keys(o).length) specOut[d] = o;
  }
  const cosmetic = {
    genericExcept: genericExceptOut,
    genericHide: [...genericHideSites].sort(),
    elemHide: [...elemHideSites].sort(),
    spec: specOut,
  };
  fs.writeFileSync(path.join(OUT, 'data', 'cosmetic.json'), JSON.stringify(cosmetic));

  for (const d of popupAllow) { popupDomains.delete(d); adHosts.delete(d); }
  fs.writeFileSync(path.join(OUT, 'data', 'popup.json'), JSON.stringify({
    popup: [...popupDomains].sort(),
    ads: [...adHosts].filter((d) => !popupDomains.has(d)).sort(),
    strict: [...strictSites].sort(),
  }));

  fs.writeFileSync(path.join(OUT, 'data', 'build-info.json'), JSON.stringify({
    built: new Date().toISOString(),
    rulesets: rulesetMeta,
    genericSelectors: genericStatic.length,
    genericExcept: genericExceptOut.length,
    specificDomains: Object.keys(specOut).length,
    popupDomains: popupDomains.size,
    adHosts: adHosts.size,
    strictSites: strictSites.size,
  }, null, 2));

  console.log('Qatorlar:', stats.lines, '| tarmoq:', stats.network, '| kosmetik:', stats.cosmetic, '| tashlab ketildi:', stats.skipped);
  console.log('Qoidalar to\'plamlari:', rulesetMeta.map((r) => `${r.id}=${r.count}`).join(', '));
  console.log('Umumiy selektorlar:', genericStatic.length, '| istisnoli:', genericExceptOut.length,
    '| saytga xos domenlar:', Object.keys(specOut).length,
    '| noto\'g\'ri selektorlar:', allSel.size - selOk.size, '| noto\'g\'ri CSS:', allCss.size - cssOk.size);
  console.log('Popup domenlari:', popupDomains.size, '| reklama hostlari:', adHosts.size, '| qattiq rejim saytlari:', strictSites.size);
}

main().catch((e) => { console.error(e); process.exit(1); });
