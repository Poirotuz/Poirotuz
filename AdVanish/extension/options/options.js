// AdVanish — sozlamalar sahifasi
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('uz-UZ');

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r); }));
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

function cleanSite(v) {
  v = String(v || '').trim().toLowerCase();
  try { if (/^[a-z]+:\/\//.test(v)) v = new URL(v).hostname; } catch { /* oddiy matn */ }
  return v.replace(/^www\./, '').replace(/\/.*$/, '');
}

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const k of kids) e.append(k);
  return e;
}

function renderList(ul, items, onDelete) {
  ul.textContent = '';
  if (!items.length) {
    ul.append(el('li', { className: 'empty', textContent: 'Ro\'yxat bo\'sh' }));
    return;
  }
  for (const it of items) {
    const del = el('button', { className: 'del', textContent: 'O\'chirish' });
    del.addEventListener('click', () => onDelete(it));
    ul.append(el('li', {}, el('span', { textContent: it }), del));
  }
}

async function load() {
  const { settings: st, info, builtinStrict } = await send({ type: 'getSettings' });
  $('globalToggle').checked = st.enabled;
  $('tPopups').textContent = fmt(st.totals?.popups);
  $('tElements').textContent = fmt(st.totals?.elements);

  if (info) {
    const rules = info.rulesets.reduce((n, r) => n + r.count, 0);
    $('tRules').textContent = fmt(rules);
    $('buildInfo').textContent =
      `Yangilangan: ${new Date(info.built).toLocaleDateString('uz-UZ')} · ` +
      `${fmt(rules)} tarmoq qoidasi · ${fmt(info.genericSelectors)} umumiy va ` +
      `${fmt(info.specificDomains)} ta saytga xos kosmetik qoida · ${fmt(info.adHosts + info.popupDomains)} reklama domeni`;
  }

  renderList($('disabledList'), st.disabledSites, async (site) => {
    await send({ type: 'toggleSite', site, enabled: true });
    toast(`${site} — himoya qayta yoqildi`);
    load();
  });

  renderList($('strictList'), st.strictSites, async (site) => {
    await send({ type: 'toggleStrict', site, enabled: false });
    load();
  });
  $('builtinCount').textContent = builtinStrict.length;
  $('builtinList').textContent = builtinStrict.join(', ');

  const box = $('rules');
  box.textContent = '';
  const entries = Object.entries(st.customRules || {}).sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) box.append(el('p', { className: 'muted', textContent: 'Hozircha qo\'lda yashirilgan elementlar yo\'q.' }));
  for (const [site, sels] of entries) {
    const delAll = el('button', { className: 'del', textContent: 'Hammasini o\'chirish' });
    delAll.addEventListener('click', async () => { await send({ type: 'removeRule', site }); load(); });
    const group = el('div', { className: 'site-group' }, el('h3', {}, el('span', { textContent: site }), delAll));
    for (const sel of sels) {
      const del = el('button', { className: 'del', textContent: 'O\'chirish' });
      del.addEventListener('click', async () => { await send({ type: 'removeRule', site, selector: sel }); load(); });
      group.append(el('div', { className: 'rule' }, el('code', { textContent: sel }), del));
    }
    box.append(group);
  }
}

$('globalToggle').addEventListener('change', async (e) => {
  await send({ type: 'toggleGlobal', enabled: e.target.checked });
  toast(e.target.checked ? 'Himoya yoqildi' : 'Himoya o\'chirildi');
});

$('addDisabled').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const site = cleanSite(input.value);
  if (!site) return;
  await send({ type: 'toggleSite', site, enabled: false });
  input.value = '';
  toast(`${site} — himoya o'chirildi`);
  load();
});

$('addStrict').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const site = cleanSite(input.value);
  if (!site) return;
  await send({ type: 'toggleStrict', site, enabled: true });
  input.value = '';
  load();
});

$('addRule').addEventListener('submit', async (e) => {
  e.preventDefault();
  const site = cleanSite($('ruleSite').value);
  const sel = $('ruleSel').value.trim();
  try { document.createDocumentFragment().querySelector(sel); } catch {
    toast('Selektor noto\'g\'ri');
    return;
  }
  await send({ type: 'addRule', site, selector: sel });
  $('ruleSel').value = '';
  toast('Qoida qo\'shildi');
  load();
});

$('resetStats').addEventListener('click', async () => {
  await send({ type: 'resetStats' });
  load();
});

$('exportBtn').addEventListener('click', async () => {
  const { settings } = await send({ type: 'getSettings' });
  const data = {
    app: 'AdVanish',
    exported: new Date().toISOString(),
    settings: {
      enabled: settings.enabled,
      disabledSites: settings.disabledSites,
      strictSites: settings.strictSites,
      customRules: settings.customRules,
    },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = el('a', { href: url, download: `advanish-sozlamalar-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    await send({ type: 'importSettings', settings: data.settings || data });
    toast('Sozlamalar yuklandi');
    load();
  } catch {
    toast('Faylni o\'qib bo\'lmadi');
  }
  e.target.value = '';
});

load();
