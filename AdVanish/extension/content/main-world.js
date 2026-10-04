// AdVanish — sahifaning o'z (MAIN) muhitida ishlaydigan himoya.
// Popup / popunder oynalarni ochishga urinishlarni to'xtatadi.
(() => {
  'use strict';
  if (window.__adVanishMain) return;
  Object.defineProperty(window, '__adVanishMain', { value: true });

  // Bu hostlarga popup ochishga ruxsat (kirish/OAuth, ulashish, to'lov tizimlari)
  const ALLOW_HOSTS = [
    'accounts.google.com', 'google.com', 'youtube.com', 'appleid.apple.com', 'login.microsoftonline.com',
    'login.live.com', 'facebook.com', 'twitter.com', 'x.com', 't.me', 'telegram.me', 'telegram.org',
    'oauth.telegram.org', 'vk.com', 'vk.ru', 'id.vk.com', 'oauth.vk.com', 'ok.ru', 'connect.ok.ru',
    'mail.ru', 'oauth.mail.ru', 'yandex.ru', 'yandex.uz', 'yandex.com', 'passport.yandex.ru', 'oauth.yandex.ru',
    'id.yandex.ru', 'whatsapp.com', 'wa.me', 'linkedin.com', 'pinterest.com', 'reddit.com', 'github.com',
    'paypal.com', 'payme.uz', 'click.uz', 'paycom.uz', 'uzum.uz', 'oneid.uz', 'id.egov.uz', 'my.gov.uz',
    'instagram.com', 'tiktok.com', 'discord.com', 'steamcommunity.com', 'apple.com', 'microsoft.com',
  ];
  // Har doim reklama hisoblanadigan manzillar
  const AD_RE = /1x(?:bet|slot)|1win|mostbet|melbet|pin-?up\.|betwinner|22bet|linebet|megapari|vavada|joycasino|888starz|parimatch|betandyou|olimpbet|leonbets|fonbet|yourbonus|casino|kazino|yangi-kinolar/i;
  const BUILTIN_STRICT = ['asilmedia.org'];

  const SLD = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'or', 'ne', 'go', 'mil', 'info', 'biz']);
  const baseDomain = (host) => {
    if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
    const p = host.split('.');
    if (p.length <= 2) return host;
    const n = p[p.length - 1].length === 2 && SLD.has(p[p.length - 2]) ? 3 : 2;
    return p.slice(-n).join('.');
  };
  const matchesHost = (host, list) => list.some((h) => host === h || host.endsWith('.' + h));

  // Eng yuqori (top) sahifaning hosti — reklama iframe'lari ham shu bilan solishtiriladi
  let topHost = location.hostname;
  try {
    const ao = location.ancestorOrigins;
    if (ao && ao.length) topHost = new URL(ao[ao.length - 1]).hostname;
    else if (window.top !== window) topHost = window.top.location.hostname;
  } catch { /* boshqa domendagi top */ }
  const topSite = baseDomain(topHost);
  const isTop = window === window.top;

  const isStrict = () => matchesHost(topHost, BUILTIN_STRICT) ||
    document.documentElement?.getAttribute('data-advanish-strict') === '1';

  // Oxirgi haqiqiy (foydalanuvchi) bosish
  let lastClick = { t: 0, href: '', interactive: false };
  const INTERACTIVE = 'a[href],button,input,select,textarea,label,summary,[role="button"],[role="link"],[role="menuitem"],[onclick]';
  window.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const el = e.target instanceof Element ? e.target : null;
    const a = el?.closest('a[href]');
    let href = a ? a.href : '';
    // href="#" yoki "javascript:" — bu havola emas, tugma vazifasini bajaradi
    if (/^javascript:/i.test(href) || (a && a.getAttribute('href').trim().startsWith('#'))) href = '';
    lastClick = { t: Date.now(), href, interactive: !!el?.closest(INTERACTIVE) };
  }, true);

  const report = (kind, url) => {
    try {
      document.dispatchEvent(new CustomEvent('advanish:blocked', { detail: JSON.stringify({ kind, url: String(url || '') }) }));
    } catch { /* e'tiborsiz */ }
  };

  function resolve(u) {
    try { return new URL(String(u), location.href); } catch { return null; }
  }

  // Popupni bloklash kerakmi?
  function shouldBlock(rawUrl) {
    const u = resolve(rawUrl ?? '');
    if (!u) return false;
    if (u.protocol === 'about:' || u.protocol === 'blob:' || u.protocol === 'data:' || u.protocol === 'javascript:') {
      // Bo'sh oyna: faqat reklama iframe'idan yoki bosishsiz ochilsa bloklaymiz
      return !isTop && baseDomain(location.hostname) !== topSite;
    }
    const host = u.hostname.toLowerCase();
    if (AD_RE.test(host)) return true;
    if (baseDomain(host) === topSite) return false;
    if (matchesHost(host, ALLOW_HOSTS)) return false;

    const recent = Date.now() - lastClick.t < 1500;
    // Foydalanuvchi aynan shu manzildagi havolani bosgan
    if (recent && lastClick.href) {
      const lh = resolve(lastClick.href);
      if (lh && baseDomain(lh.hostname) === baseDomain(host)) return false;
    }
    if (isStrict()) return true;
    // Begona domendagi reklama iframe'i ochmoqchi
    if (baseDomain(location.hostname) !== topSite) return true;
    // Bosishsiz yoki "hamma joyni bosish" (popunder) usuli
    if (!recent) return true;
    if (!lastClick.interactive) return true;
    // Oddiy havola bosilganda boshqa manzil ochilmoqda — havola o'g'irlangan
    if (lastClick.href) return true;
    return false;
  }

  // Bloklangan oyna o'rniga qaytariladigan "soxta" oyna — skriptlar xato bermasligi uchun
  function fakeWindow() {
    const noop = () => {};
    const loc = { href: 'about:blank', assign: noop, replace: noop, reload: noop, toString: () => 'about:blank' };
    const doc = { write: noop, writeln: noop, open: noop, close: noop, body: null, location: loc };
    const w = {
      closed: false, opener: null, name: '', location: loc, document: doc,
      focus: noop, blur: noop, postMessage: noop, addEventListener: noop, removeEventListener: noop,
      close() { this.closed = true; }, moveTo: noop, resizeTo: noop, scrollTo: noop, print: noop,
    };
    w.window = w; w.self = w; w.top = w; w.parent = w;
    return new Proxy(w, { get: (t, k) => t[k], set: () => true });
  }

  // O'ralgan funksiyalar — oyna yangi hujjatga o'tsa ham qayta tekshirish uchun
  const wrappers = new WeakSet();
  function guardWindow(win) {
    try {
      if (!win) return;
      const nativeOpen = win.open;
      if (typeof nativeOpen !== 'function' || wrappers.has(nativeOpen)) return;
      const open = function (url, target, features) {
        if (shouldBlock(url)) {
          report('popup', url);
          return fakeWindow();
        }
        return nativeOpen.apply(this === undefined || this === open ? win : this, arguments);
      };
      Object.defineProperty(open, 'toString', { value: () => 'function open() { [native code] }' });
      win.open = open;
      wrappers.add(open);
    } catch { /* boshqa domendagi oyna */ }
  }
  guardWindow(window);

  // Skriptlar bo'sh iframe orqali "toza" window.open olishga urinadi — uni ham himoyalaymiz
  try {
    const proto = HTMLIFrameElement.prototype;
    const cw = Object.getOwnPropertyDescriptor(proto, 'contentWindow');
    const cd = Object.getOwnPropertyDescriptor(proto, 'contentDocument');
    if (cw?.get) {
      Object.defineProperty(proto, 'contentWindow', {
        configurable: true, enumerable: cw.enumerable,
        get() { const w = cw.get.call(this); guardWindow(w); return w; },
      });
    }
    if (cd?.get) {
      Object.defineProperty(proto, 'contentDocument', {
        configurable: true, enumerable: cd.enumerable,
        get() { const d = cd.get.call(this); if (d) guardWindow(d.defaultView); return d; },
      });
    }
  } catch { /* e'tiborsiz */ }

  // Skript orqali yaratilgan <a target=_blank> ni "bosish" (popunder usuli)
  function badAnchor(a) {
    try {
      if (!(a instanceof HTMLAnchorElement) || !a.href) return false;
      const target = (a.target || '').toLowerCase();
      if (target !== '_blank' && a.isConnected) return false;
      return shouldBlock(a.href) && !(Date.now() - lastClick.t < 1500 && lastClick.href === a.href);
    } catch { return false; }
  }
  try {
    const nativeClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (badAnchor(this)) { report('popup', this.href); return; }
      return nativeClick.call(this);
    };
    const nativeDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (ev) {
      if (ev && (ev.type === 'click' || ev.type === 'mouseup') && this instanceof HTMLAnchorElement && badAnchor(this)) {
        report('popup', this.href);
        return false;
      }
      return nativeDispatch.call(this, ev);
    };
  } catch { /* e'tiborsiz */ }

  // Sun'iy (isTrusted=false) bosish orqali havolaga o'tish
  window.addEventListener('click', (e) => {
    if (e.isTrusted) return;
    const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (a && badAnchor(a)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      report('popup', a.href);
    }
  }, true);

  // Formani yangi oynaga yuborish orqali popup
  try {
    const nativeSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      const target = (this.target || '').toLowerCase();
      if (target === '_blank' && shouldBlock(this.action)) { report('popup', this.action); return; }
      return nativeSubmit.call(this);
    };
  } catch { /* e'tiborsiz */ }
})();
