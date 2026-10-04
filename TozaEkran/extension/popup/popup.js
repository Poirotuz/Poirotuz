// TozaEkran — popup oynasi
const $ = (id) => document.getElementById(id);
const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('uz-UZ'));

let tab = null;
let state = null;

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r); }));
}

function render() {
  const s = state;
  document.body.classList.toggle('off', !s.enabled);
  document.body.classList.toggle('nonweb', !s.web);
  $('globalToggle').checked = s.enabled;
  $('globalLabel').textContent = s.enabled ? 'Himoya yoqilgan' : 'Himoya o\'chirilgan';

  $('siteHost').textContent = s.web ? s.site : 'Bu sahifada ishlamaydi';
  $('siteToggle').checked = s.siteEnabled;
  $('siteCard').classList.toggle('disabled', s.web && !s.siteEnabled);
  $('siteTitle').textContent = s.siteEnabled ? 'Bu saytda himoya yoqilgan' : 'Bu saytda himoya o\'chirilgan';
  document.body.classList.toggle('site-off', s.web && !s.siteEnabled);
  $('siteSub').textContent = !s.web
    ? 'Brauzerning ichki sahifalari'
    : !s.siteEnabled
      ? 'Reklama bloklanmaydi — yoqish uchun tugmani bosing'
      : s.customCount
        ? `Qo'lda yashirilgan: ${s.customCount} ta qoida`
        : 'Reklama va popup oynalar bloklanadi';

  $('statRequests').textContent = fmt(s.requests);
  $('statPopups').textContent = fmt(s.tabStats.popups);
  $('statElements').textContent = fmt(s.tabStats.elements);

  $('strictToggle').checked = s.strict || s.builtinStrict;
  $('strictToggle').disabled = s.builtinStrict;
  $('strictSub').textContent = s.builtinStrict
    ? 'Bu sayt uchun doim yoqilgan (o\'rnatilgan ro\'yxat)'
    : 'Saytdan ochiladigan barcha begona oynalarni yopish';

  const t = s.totals || {};
  $('totals').textContent = `Jami: ${fmt(t.popups || 0)} popup · ${fmt(t.elements || 0)} element · v${s.version}`;
}

function needReload(text) {
  const n = $('notice');
  n.hidden = false;
  n.textContent = text + ' ';
  const b = document.createElement('button');
  b.textContent = 'Yangilash';
  b.addEventListener('click', () => { chrome.tabs.reload(tab.id); window.close(); });
  n.appendChild(b);
}

async function refresh() {
  state = await send({ type: 'getState', tabId: tab.id });
  if (state) render();
}

async function init() {
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  tab = forced ? await chrome.tabs.get(forced) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab) return;
  await refresh();

  $('globalToggle').addEventListener('change', async (e) => {
    await send({ type: 'toggleGlobal', enabled: e.target.checked });
    await refresh();
    needReload('O\'zgarish to\'liq kuchga kirishi uchun sahifani yangilang.');
  });

  $('siteToggle').addEventListener('change', async (e) => {
    await send({ type: 'toggleSite', site: state.site, enabled: e.target.checked });
    await refresh();
    chrome.tabs.reload(tab.id);
  });

  $('strictToggle').addEventListener('change', async (e) => {
    await send({ type: 'toggleStrict', site: state.site, enabled: e.target.checked });
    await refresh();
  });

  $('pickBtn').addEventListener('click', async () => {
    const ok = await send({ type: 'startPicker', tabId: tab.id });
    if (ok) window.close();
    else needReload('Bu sahifada tanlash vositasini ishga tushirib bo\'lmadi. Sahifani yangilab ko\'ring.');
  });

  $('optionsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // Statistikani jonli yangilab turamiz
  setInterval(refresh, 2000);
}

init();
