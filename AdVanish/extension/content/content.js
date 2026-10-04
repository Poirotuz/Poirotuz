// AdVanish — kontent-skript (izolyatsiyalangan muhit)
//
//  * saytga xos CSS'ni so'raydi (fon xizmati uni USER darajasida kiritadi);
//  * matn bo'yicha (protsedural) filtrlarni qo'llaydi;
//  * shaffof "klik o'g'irlovchi" qatlamlarni, bukmeker bannerlarini va bloklangan iframe'larni olib tashlaydi;
//  * video-reklamalarni o'tkazib yuboradi (jumladan YouTube);
//  * foydalanuvchi bosgan havolalar haqida fon xizmatiga xabar beradi (popup yopuvchi uchun).
(() => {
  'use strict';
  if (window.__adVanishContent) return;
  window.__adVanishContent = true;

  const isTop = window === window.top;
  const BET_RE = /1x(?:bet|slot)|1win|mostbet|melbet|pin-?up\.|betwinner|22bet|linebet|megapari|vavada|joycasino|888starz|parimatch|betandyou|olimpbet|leonbets|fonbet|yourbonus|casino|kazino|yangi-kinolar/i;
  const AD_VIDEO_RE = /asilmediauzbek|videoreklama|yangi-kinolar|\/vast\/|[/_-]pre-?roll|\/ads?\/|reklama/i;
  const SKIP_RE = /^(?:skip(?: ads?)?|пропустить(?: рекламу)?|закрыть рекламу|reklamani (?:o['‘’ʻ`]?tkazib yuborish|o['‘’ʻ`]?tkazish|yopish)|o['‘’ʻ`]?tkazib yuborish|o['‘’ʻ`]?tkazish)\s*[›»>▶→⏭]*$/i;
  const SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne', 'go', 'mil', 'info', 'biz']);

  let cfg = null;
  let active = true;
  let pending = { elements: 0, popups: 0 };
  let flushTimer = 0;
  let removedBlocking = false;

  const baseDomain = (host) => {
    if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
    const p = host.split('.');
    if (p.length <= 2) return host;
    const n = p[p.length - 1].length === 2 && SLD.has(p[p.length - 2]) ? 3 : 2;
    return p.slice(-n).join('.');
  };
  const mySite = baseDomain(location.hostname);
  const crossSite = (href) => {
    try {
      const u = new URL(href, location.href);
      return /^https?:$/.test(u.protocol) && baseDomain(u.hostname) !== mySite;
    } catch { return false; }
  };

  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r); });
      } catch { resolve(null); }
    });
  }

  function count(kind, n = 1) {
    pending[kind] += n;
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = 0;
      if (pending.elements) send({ type: 'stat', kind: 'element', n: pending.elements });
      if (pending.popups) send({ type: 'stat', kind: 'popup', n: pending.popups });
      pending = { elements: 0, popups: 0 };
    }, 1000);
  }

  function hide(el) {
    if (!el || el.hasAttribute('data-advanish-hidden')) return false;
    el.setAttribute('data-advanish-hidden', '');
    el.style.setProperty('display', 'none', 'important');
    count('elements');
    return true;
  }

  // ---------------------------------------------------------- MAIN muhitdan xabarlar

  document.addEventListener('advanish:blocked', () => count('popups'), true);

  // ---------------------------------------------------- foydalanuvchi bosgan havolalar

  function reportIntent(e) {
    if (!e.isTrusted || !active) return;
    const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!a || !/^https?:/i.test(a.href)) return;
    if (overlayRoot(a)) return; // shaffof qatlam — bu foydalanuvchi niyati emas
    send({ type: 'intent', href: a.href });
  }
  window.addEventListener('mousedown', reportIntent, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Enter') reportIntent(e); }, true);

  // ------------------------------------------------------ "klik o'g'irlovchi" qatlamlar

  function isTransparent(el, cs) {
    if (parseFloat(cs.opacity) < 0.1 || cs.visibility === 'hidden') return true;
    const bg = cs.backgroundColor;
    const clearBg = bg === 'transparent' || /rgba\(.*,\s*0(?:\.0+)?\)$/.test(bg);
    if (!clearBg || cs.backgroundImage !== 'none') return false;
    if ((el.innerText || '').trim().length > 15) return false;
    for (const m of el.querySelectorAll('img,video,canvas,svg,picture')) {
      const r = m.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) return false;
    }
    return true;
  }

  // Elementni o'z ichiga olgan katta, joylashtirilgan va boshqa saytga olib boruvchi qatlam
  function overlayRoot(start) {
    const vw = innerWidth, vh = innerHeight;
    const area = vw * vh;
    if (area < 2500) return null;
    let node = start, best = null;
    while (node && node !== document.body && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      if (cs.position === 'fixed' || cs.position === 'absolute') {
        const r = node.getBoundingClientRect();
        if (r.width * r.height >= 0.25 * area) best = { node, cs };
      }
      node = node.parentElement;
    }
    if (!best) return null;
    const el = best.node;
    if (el.closest('[data-advanish-picker]')) return null;
    const a = el.matches('a[href]') ? el : (start.closest('a[href]') || el.querySelector('a[href]'));
    if (!a || !crossSite(a.href)) return null;
    if (BET_RE.test(a.hostname)) return el;
    return isTransparent(el, best.cs) ? el : null;
  }

  function removeOverlay(el) {
    if (!el || !el.isConnected) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') removedBlocking = true;
    el.remove();
    count('elements');
    unlockScroll();
  }

  function unlockScroll() {
    if (!removedBlocking || !document.body) return;
    for (const n of [document.documentElement, document.body]) {
      if (getComputedStyle(n).overflowY === 'hidden') n.style.setProperty('overflow', 'auto', 'important');
    }
  }

  // Haqiqiy bosish shaffof qatlamga tushsa — uni bekor qilib, qatlamni olib tashlaymiz
  window.addEventListener('click', (e) => {
    if (!e.isTrusted || !active || !cfg?.enabled) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const root = overlayRoot(t);
    if (root) {
      e.preventDefault();
      e.stopImmediatePropagation();
      removeOverlay(root);
      count('popups');
    }
  }, true);

  function scanOverlays() {
    const vw = innerWidth, vh = innerHeight;
    if (vw < 50 || vh < 50) return;
    const seen = new Set();
    for (const [px, py] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75], [0.5, 0.92]]) {
      const el = document.elementFromPoint(vw * px, vh * py);
      if (!el || seen.has(el) || el === document.body || el === document.documentElement) continue;
      seen.add(el);
      const root = overlayRoot(el);
      if (root) removeOverlay(root);
    }
  }

  // ------------------------------------------------------------ bukmeker bannerlari

  const checkedAnchors = new WeakSet();
  function scanBetLinks() {
    for (const a of document.querySelectorAll('a[href]')) {
      if (checkedAnchors.has(a)) continue;
      checkedAnchors.add(a);
      if (!BET_RE.test(a.hostname) || !crossSite(a.href)) continue;
      // Banner konteynerini topamiz: faqat shu havoladan iborat ota-elementlar
      let box = a;
      for (let i = 0; i < 4; i++) {
        const p = box.parentElement;
        if (!p || p === document.body || p === document.documentElement) break;
        const cs = getComputedStyle(p);
        const floating = cs.position === 'fixed' || cs.position === 'sticky';
        const onlyChild = p.children.length <= 2 && (p.innerText || '').trim().length <= (a.innerText || '').trim().length + 20;
        if (!floating && !onlyChild) break;
        box = p;
        if (floating) break;
      }
      hide(box);
    }
  }

  // ------------------------------------------------- bloklangan iframe / rasmlarni yig'ish

  const checkedFrames = new WeakSet();
  function collapse(el) {
    if (!hide(el)) return;
    const p = el.parentElement;
    if (p && p !== document.body && p !== document.documentElement && p.children.length === 1 &&
        !(p.innerText || '').trim()) {
      hide(p);
    }
  }

  function checkElements(els) {
    const byHost = new Map();
    for (const el of els) {
      const src = el.src || el.getAttribute('src');
      if (!src) continue;
      let h;
      try { h = new URL(src, location.href).hostname.toLowerCase(); } catch { continue; }
      if (!h || baseDomain(h) === mySite) continue;
      if (!byHost.has(h)) byHost.set(h, []);
      byHost.get(h).push(el);
    }
    if (!byHost.size) return;
    send({ type: 'checkHosts', hosts: [...byHost.keys()] }).then((ads) => {
      for (const h of ads || []) for (const el of byHost.get(h) || []) collapse(el);
    });
  }

  function scanFrames() {
    const list = [];
    for (const f of document.querySelectorAll('iframe[src],frame[src]')) {
      if (checkedFrames.has(f)) continue;
      checkedFrames.add(f);
      list.push(f);
    }
    if (list.length) checkElements(list);
  }

  // Yuklanmagan (bloklangan) rasmlar va iframe'lar
  window.addEventListener('error', (e) => {
    const t = e.target;
    if (active && cfg?.enabled && (t instanceof HTMLImageElement || t instanceof HTMLIFrameElement)) checkElements([t]);
  }, true);

  // ------------------------------------------------------------- protsedural filtrlar

  let procCompiled = null;
  function compileProc(list) {
    const out = [];
    for (const [base, rawArg] of list || []) {
      let arg = String(rawArg).trim();
      if (/^(['"]).*\1$/.test(arg)) arg = arg.slice(1, -1);
      let test;
      const m = arg.match(/^\/(.+)\/([imsu]*)$/);
      if (m) {
        try { const re = new RegExp(m[1], m[2]); test = (s) => re.test(s); } catch { continue; }
      } else {
        test = (s) => s.includes(arg);
      }
      out.push({ base, test });
    }
    return out;
  }

  function scanProcedural() {
    if (!procCompiled?.length) return;
    for (const { base, test } of procCompiled) {
      let nodes;
      try { nodes = document.querySelectorAll(base); } catch { continue; }
      for (const n of nodes) {
        if (!n.hasAttribute('data-advanish-hidden') && test(n.textContent || '')) hide(n);
      }
    }
  }

  // ----------------------------------------------------------------- video-reklama

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };

  const skipClicks = new WeakMap();
  function scanVideoAds() {
    const videos = document.querySelectorAll('video');
    if (!videos.length) return;
    for (const v of videos) {
      const src = v.currentSrc || v.src || '';
      if (src && AD_VIDEO_RE.test(src) && !/^blob:/.test(src)) {
        v.muted = true;
        try { v.playbackRate = 16; } catch { /* e'tiborsiz */ }
        if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.2) v.currentTime = v.duration - 0.1;
      }
      // "O'tkazib yuborish" tugmasi — pleyer konteyneri ichida qidiramiz
      let root = v;
      for (let i = 0; i < 4 && root.parentElement && root.parentElement !== document.body; i++) root = root.parentElement;
      for (const el of root.querySelectorAll('button,a,div,span,[role="button"]')) {
        // Faqat tugmaning o'zini bosamiz (pleyer konteynerini emas)
        if (el.childElementCount > 0 && !el.matches('button,a,[role="button"]')) continue;
        const text = (el.textContent || '').trim();
        if (!text || text.length > 40 || !SKIP_RE.test(text) || !visible(el)) continue;
        const last = skipClicks.get(el) || { t: 0, n: 0 };
        if (last.n >= 3 || Date.now() - last.t < 3000) break;
        skipClicks.set(el, { t: Date.now(), n: last.n + 1 });
        el.click();
        break;
      }
    }
  }

  // YouTube: reklama vaqtida videoni oxiriga o'tkazamiz va "Skip" tugmasini bosamiz
  const ytState = new WeakMap();
  function scanYouTube() {
    const player = document.querySelector('.html5-video-player');
    if (!player) return;
    const v = player.querySelector('video');
    const ad = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
    if (ad && v) {
      if (!ytState.has(v)) ytState.set(v, { rate: v.playbackRate === 16 ? 1 : v.playbackRate });
      try { v.playbackRate = 16; } catch { /* e'tiborsiz */ }
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.2) v.currentTime = v.duration - 0.1;
      const btn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button[id^="skip-button"]');
      if (btn) btn.click();
    } else if (v && ytState.has(v)) {
      if (v.playbackRate === 16) v.playbackRate = ytState.get(v).rate || 1;
      ytState.delete(v);
    }
    for (const b of document.querySelectorAll('.ytp-ad-overlay-close-button')) b.click();
  }

  // ------------------------------------------------------------------- skanerlash

  let scanTimer = 0, lastScan = 0;
  function scan() {
    scanTimer = 0;
    lastScan = Date.now();
    if (!active || !document.documentElement) return;
    try {
      scanProcedural();
      scanBetLinks();
      scanFrames();
      if (document.body) scanOverlays();
      scanVideoAds();
    } catch (e) {
      console.debug('AdVanish:', e);
    }
  }
  function scheduleScan() {
    if (scanTimer || !active) return;
    const wait = Math.max(0, 400 - (Date.now() - lastScan));
    scanTimer = setTimeout(() => {
      if (window.requestIdleCallback) requestIdleCallback(scan, { timeout: 500 });
      else scan();
    }, wait);
  }

  let observer = null;
  function start() {
    procCompiled = compileProc(cfg.proc);
    observer = new MutationObserver(scheduleScan);
    observer.observe(document, { childList: true, subtree: true });
    scheduleScan();
    document.addEventListener('DOMContentLoaded', scheduleScan, { once: true });
    window.addEventListener('load', scheduleScan, { once: true });
    // Reklamalar ko'pincha kechikib paydo bo'ladi — birinchi daqiqada tez-tez tekshiramiz
    let ticks = 0;
    const iv = setInterval(() => {
      if (!active || ++ticks > 40) { clearInterval(iv); return; }
      scheduleScan();
    }, 1500);
    if (/(^|\.)youtube\.com$/.test(location.hostname)) setInterval(() => active && scanYouTube(), 250);
    // Video bor sahifalarda "o'tkazib yuborish" tugmasini muntazam tekshiramiz
    setInterval(() => { if (active && document.querySelector('video')) scanVideoAds(); }, 1000);
  }

  function stop() {
    active = false;
    observer?.disconnect();
  }

  send({ type: 'init', host: location.hostname, top: isTop }).then((r) => {
    cfg = r;
    if (!r || !r.enabled) { stop(); return; }
    if (r.strict) document.documentElement?.setAttribute('data-advanish-strict', '1');
    start();
  });
})();
