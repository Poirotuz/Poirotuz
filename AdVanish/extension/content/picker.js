// AdVanish — "reklamani tanlab o'chirish" vositasi.
// Sichqoncha bilan elementni tanlang → u shu saytda doimiy yashiriladi.
(() => {
  'use strict';
  if (window.__adVanishPickerActive) return;
  window.__adVanishPickerActive = true;

  const BAD_TOKEN = /\d{3,}|[a-f0-9]{10,}|^(?:active|hover|focus|open|opened|show|shown|visible|selected|current|is-|has-|js-)/i;
  const esc = (s) => CSS.escape(s);

  const host = document.createElement('div');
  host.setAttribute('data-advanish-picker', '');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      .box { position: fixed; pointer-events: none; border: 2px solid #12b886; background: rgba(18,184,134,.18);
             border-radius: 3px; transition: all .06s ease-out; display: none; }
      .box.extra { border-style: dashed; background: rgba(18,184,134,.08); }
      .panel { position: fixed; right: 16px; bottom: 16px; width: min(380px, calc(100vw - 32px)); pointer-events: auto;
               background: #ffffff; color: #1d2b28; border-radius: 14px; padding: 14px;
               box-shadow: 0 12px 40px rgba(0,0,0,.28); font-size: 13px; line-height: 1.4; }
      @media (prefers-color-scheme: dark) {
        .panel { background: #17211f; color: #e6f2ef; }
        input { background: #0f1715 !important; color: #e6f2ef !important; border-color: #2f4440 !important; }
        .btn.ghost { color: #e6f2ef !important; border-color: #2f4440 !important; }
      }
      .title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
      .dot { width: 10px; height: 10px; border-radius: 50%; background: #12b886; }
      .hint { opacity: .75; margin-bottom: 10px; }
      input { width: 100%; padding: 8px 10px; border: 1px solid #cfdcd8; border-radius: 8px; font: 12px ui-monospace, Menlo, Consolas, monospace;
              background: #f6faf9; color: #1d2b28; }
      .count { margin: 6px 0 10px; font-size: 12px; opacity: .8; }
      .row { display: flex; gap: 6px; flex-wrap: wrap; }
      .btn { flex: 1 1 auto; border: 0; border-radius: 8px; padding: 8px 10px; font-size: 13px; font-weight: 600; cursor: pointer;
             background: #12b886; color: #fff; }
      .btn:hover { filter: brightness(1.08); }
      .btn.ghost { background: transparent; color: #1d2b28; border: 1px solid #cfdcd8; }
      .btn:disabled { opacity: .45; cursor: default; }
      .sel { display: none; }
      .picked .sel { display: block; }
      .picked .idle { display: none; }
    </style>
    <div class="box main"></div>
    <div class="extras"></div>
    <div class="panel">
      <div class="title"><span class="dot"></span>AdVanish — reklamani tanlash</div>
      <div class="idle hint">Yashirmoqchi bo'lgan reklama ustiga sichqonchani olib boring va bosing.<br>Chiqish: <b>Esc</b></div>
      <div class="sel">
        <div class="hint">Tanlangan element shu saytda doimiy yashiriladi. Kerak bo'lsa kattaroq/kichikroq qiling.</div>
        <input class="selector" spellcheck="false">
        <div class="count"></div>
        <div class="row" style="margin-bottom:6px">
          <button class="btn ghost up" title="Ota-elementni tanlash">▲ Kattaroq</button>
          <button class="btn ghost down" title="Ichki elementni tanlash">▼ Kichikroq</button>
          <button class="btn ghost again">↺ Qayta</button>
        </div>
        <div class="row">
          <button class="btn hide">✓ Yashirish</button>
          <button class="btn ghost cancel">Bekor qilish</button>
        </div>
      </div>
      <div class="idle row"><button class="btn ghost cancel">Bekor qilish</button></div>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const box = $('.box.main');
  const extras = $('.extras');
  const panel = $('.panel');
  const input = $('.selector');
  const countEl = $('.count');

  let hovered = null;
  let chain = [];
  let idx = 0;
  let picked = false;

  function place(el, b) {
    const r = el.getBoundingClientRect();
    b.style.display = r.width && r.height ? 'block' : 'none';
    b.style.left = r.left + 'px';
    b.style.top = r.top + 'px';
    b.style.width = r.width + 'px';
    b.style.height = r.height + 'px';
  }

  function classesOf(el) {
    return [...el.classList].filter((c) => !BAD_TOKEN.test(c) && c.length < 40).slice(0, 3).map((c) => '.' + esc(c)).join('');
  }

  function simple(el) {
    if (el.id && !BAD_TOKEN.test(el.id) && document.querySelectorAll('#' + esc(el.id)).length === 1) return '#' + esc(el.id);
    return el.tagName.toLowerCase() + classesOf(el);
  }

  function selectorFor(el) {
    const tag = el.tagName.toLowerCase();
    try {
      if ((tag === 'iframe' || tag === 'img') && el.src && !el.src.startsWith('data:')) {
        const u = new URL(el.src, location.href);
        if (u.hostname && u.hostname !== location.hostname) return `${tag}[src*="${u.hostname}"]`;
      }
      if (tag === 'a' && el.href) {
        const u = new URL(el.href, location.href);
        if (u.hostname && u.hostname !== location.hostname) return `a[href*="${u.hostname}"]`;
      }
    } catch { /* e'tiborsiz */ }
    let path = simple(el);
    if (path.startsWith('#')) return path;
    let node = el;
    for (let i = 0; i < 5 && document.querySelectorAll(path).length > 1; i++) {
      node = node.parentElement;
      if (!node || node === document.body || node === document.documentElement) break;
      const part = simple(node);
      path = `${part} > ${path}`;
      if (part.startsWith('#')) break;
    }
    if (document.querySelectorAll(path).length > 1 && el.parentElement) {
      const same = [...el.parentElement.children].filter((c) => c.tagName === el.tagName);
      if (same.length > 1) path += `:nth-of-type(${same.indexOf(el) + 1})`;
    }
    return path;
  }

  function matches(sel) {
    try { return [...document.querySelectorAll(sel)].filter((n) => n !== host); } catch { return null; }
  }

  function showMatches() {
    const list = matches(input.value.trim());
    extras.textContent = '';
    if (!list) {
      countEl.textContent = '⚠ Selektor noto\'g\'ri';
      $('.hide').disabled = true;
      return;
    }
    $('.hide').disabled = list.length === 0;
    countEl.textContent = list.length === 1 ? '1 ta element topildi' : `${list.length} ta element topildi`;
    for (const n of list.slice(0, 30)) {
      const b = document.createElement('div');
      b.className = 'box extra';
      extras.appendChild(b);
      place(n, b);
    }
  }

  function select(i) {
    idx = Math.max(0, Math.min(chain.length - 1, i));
    const el = chain[idx];
    place(el, box);
    input.value = selectorFor(el);
    $('.up').disabled = idx >= chain.length - 1;
    $('.down').disabled = idx <= 0;
    showMatches();
  }

  function ours(e) {
    return e.composedPath().includes(host);
  }

  function onMove(e) {
    if (picked || ours(e)) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === hovered || el === document.documentElement) return;
    hovered = el;
    place(el, box);
  }

  function onClick(e) {
    if (ours(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type !== 'click' || picked) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    chain = [];
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) chain.push(n);
    if (!chain.length) return;
    picked = true;
    panel.classList.add('picked');
    select(0);
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); quit(); }
  }

  const BLOCK = ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick', 'dblclick', 'contextmenu'];
  window.addEventListener('mousemove', onMove, true);
  for (const t of BLOCK) window.addEventListener(t, onClick, true);
  window.addEventListener('keydown', onKey, true);

  function quit() {
    window.removeEventListener('mousemove', onMove, true);
    for (const t of BLOCK) window.removeEventListener(t, onClick, true);
    window.removeEventListener('keydown', onKey, true);
    host.remove();
    window.__adVanishPickerActive = false;
  }

  input.addEventListener('input', showMatches);
  $('.up').addEventListener('click', () => select(idx + 1));
  $('.down').addEventListener('click', () => select(idx - 1));
  $('.again').addEventListener('click', () => {
    picked = false;
    panel.classList.remove('picked');
    extras.textContent = '';
  });
  for (const b of root.querySelectorAll('.cancel')) b.addEventListener('click', quit);
  $('.hide').addEventListener('click', () => {
    const sel = input.value.trim();
    const list = matches(sel);
    if (!list || !list.length) return;
    for (const n of list) n.style.setProperty('display', 'none', 'important');
    try {
      chrome.runtime.sendMessage({ type: 'addRule', site: location.hostname, selector: sel }, () => void chrome.runtime.lastError);
    } catch { /* kengaytma qayta yuklangan */ }
    quit();
  });
})();
