/*
 * Baholovchi Test — server qismi (Netlify Functions + Netlify Blobs).
 *
 * Foydalanuvchi:  POST /api/login, GET /api/me, POST /api/logout,
 *                 GET /api/questions, GET /api/demo, POST /api/progress
 * Admin:          POST /api/admin/login, POST /api/admin/logout, GET /api/admin/status,
 *                 GET|POST /api/admin/users, PATCH|DELETE /api/admin/users/<login>,
 *                 GET|PUT /api/admin/bank, POST /api/admin/self
 *
 * Admin paroli Netlify'dagi ADMIN_PASSWORD muhit o'zgaruvchisidan olinadi.
 */
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const DAY = 86400000;
const LOGIN_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const DEVICE_RE = /^[A-Za-z0-9-]{8,64}$/;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const OPT_KEYS = ['а', 'б', 'в', 'г', 'д'];
const ADMIN_LOGIN = 'admin';
const ADMIN_TTL = 12 * 3600000;
const ADMIN_TTL_LONG = 30 * DAY;

const store = (name) => getStore({ name, consistency: 'strong' });

/* ───────── yordamchilar ───────── */
const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const fail = (status, error, code) => json(status, code ? { error, code } : { error });

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('base64url');
const token = () => crypto.randomBytes(32).toString('base64url');
const normLogin = (s) => String(s || '').trim().toLowerCase();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const fmtDate = (ms) => new Date(ms).toISOString().slice(0, 10).split('-').reverse().join('.');

function genPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  while (s.length < 8) {
    const b = crypto.randomBytes(1)[0];
    if (b < 248) s += abc[b % abc.length];
  }
  return s;
}

async function hashPass(pw) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(pw, salt, 32, SCRYPT);
  return 's1$' + salt.toString('base64url') + '$' + h.toString('base64url');
}

async function checkPass(pw, stored) {
  if (!stored) {
    await scrypt(pw, 'timing-equaliser', 32, SCRYPT); // mavjud bo'lmagan loginni vaqt bo'yicha farqlab bo'lmasin
    return false;
  }
  const [, salt, hash] = stored.split('$');
  const calc = await scrypt(pw, Buffer.from(salt, 'base64url'), 32, SCRYPT);
  const want = Buffer.from(hash, 'base64url');
  return want.length === calc.length && crypto.timingSafeEqual(calc, want);
}

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

async function readJson(req, max = 64 * 1024) {
  const text = await req.text();
  if (text.length > max) throw Object.assign(new Error('Soʼrov hajmi juda katta'), { status: 413 });
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error('Notoʼgʼri soʼrov'), { status: 400 });
  }
}

function bearer(req) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/);
  return m ? m[1] : '';
}

/* IP bo'yicha xato urinishlar cheklovi */
async function ipLimited(ip, kind, limit) {
  const r = await store('system').get('rl-' + kind + '-' + sha(ip), { type: 'json' });
  return !!(r && Date.now() - r.t < 15 * 60000 && r.n >= limit);
}
async function ipFail(ip, kind) {
  const s = store('system'), k = 'rl-' + kind + '-' + sha(ip);
  const r = (await s.get(k, { type: 'json' })) || { n: 0, t: 0 };
  const now = Date.now();
  await s.setJSON(k, now - r.t > 15 * 60000 ? { n: 1, t: now } : { n: r.n + 1, t: r.t });
}

/* ───────── foydalanuvchi ───────── */
function statusOf(u) {
  if (u.disabled) return { code: 'disabled', msg: 'Login admin tomonidan bloklangan. Admin bilan bogʼlaning.' };
  if (u.exp && Date.now() > u.exp) return { code: 'expired', msg: 'Login muddati tugagan (' + fmtDate(u.exp) + '). Admin bilan bogʼlaning.' };
  return null;
}
const pubUser = (u) => ({ login: u.login, name: u.name || '', role: u.role, exp: u.exp || 0 });

function statSummary(st) {
  if (!st) return null;
  const secs = Object.values(st.secs || {});
  const exams = st.exams || [];
  return {
    done: secs.length,
    passed: secs.filter((s) => s.pct >= 70).length,
    avg: secs.length ? Math.round(secs.reduce((a, s) => a + s.pct, 0) / secs.length) : null,
    exams: exams.length,
    lastExam: exams.length ? exams[exams.length - 1].pct : null,
    tests: st.tests || 0,
    last: st.last || 0,
  };
}

function adminView(u, st) {
  return {
    login: u.login, name: u.name || '', phone: u.phone || '', note: u.note || '',
    role: u.role, exp: u.exp || 0, maxDevices: u.maxDevices || 0, disabled: !!u.disabled,
    created: u.created, lastLogin: u.lastLogin || 0, loginCount: u.loginCount || 0,
    devices: (u.devices || []).map((d) => ({ id: d.id, label: d.label || '', first: d.first, last: d.last })),
    sessions: (u.sessions || []).length,
    locked: !!(u.fails && u.fails.until > Date.now()),
    hasPassword: !!u.pass,
    stats: statSummary(st),
  };
}

async function userAuth(req) {
  const m = bearer(req).match(/^([a-z0-9._-]+):([A-Za-z0-9_-]{20,})$/);
  if (!m) return { res: fail(401, 'Tizimga kiring.', 'session') };
  const users = store('users');
  const u = await users.get(m[1], { type: 'json' });
  if (!u) return { res: fail(401, 'Login oʼchirilgan. Admin bilan bogʼlaning.', 'gone') };
  const h = sha(m[2]);
  const s = (u.sessions || []).find((x) => x.h === h);
  if (!s) return { res: fail(401, 'Sessiya tugagan. Qaytadan kiring.', 'session') };
  const st = statusOf(u);
  if (st) return { res: fail(401, st.msg, st.code) };
  return { u, s, users };
}

async function bankMeta() {
  return (await store('content').get('meta', { type: 'json' })) || { version: 0, count: 0 };
}

async function startSession(users, u, dev, label) {
  const now = Date.now();
  u.devices = u.devices || [];
  let d = u.devices.find((x) => x.id === dev);
  if (!d) {
    if (u.maxDevices > 0 && u.devices.length >= u.maxDevices) return null;
    d = { id: dev, label, first: now, last: now };
    u.devices.push(d);
  } else {
    d.last = now;
    if (label) d.label = label;
  }
  const t = token();
  u.sessions = (u.sessions || []).filter((s) => s.dev !== dev);
  u.sessions.push({ h: sha(t), dev, created: now, last: now });
  if (u.sessions.length > 10) u.sessions = u.sessions.slice(-10);
  u.fails = { n: 0, until: 0 };
  u.lastLogin = now;
  u.loginCount = (u.loginCount || 0) + 1;
  await users.setJSON(u.login, u);
  return u.login + ':' + t;
}

async function login(req, ctx) {
  const b = await readJson(req);
  const lg = normLogin(b.login), pw = String(b.password || ''), dev = str(b.device, 64), label = str(b.label, 60);
  if (!LOGIN_RE.test(lg) || !pw) return fail(400, 'Login va parolni kiriting.');
  if (!DEVICE_RE.test(dev)) return fail(400, 'Qurilma aniqlanmadi. Sahifani yangilab, qayta urining.');
  const ip = ctx.ip || 'unknown';
  if (await ipLimited(ip, 'login', 30)) return fail(429, 'Juda koʼp xato urinish. 15 daqiqadan soʼng qayta urining.');
  const users = store('users');
  const u = await users.get(lg, { type: 'json' });
  const now = Date.now();
  if (u && u.fails && u.fails.until > now)
    return fail(429, 'Koʼp marta xato parol kiritildi. ' + Math.ceil((u.fails.until - now) / 60000) + ' daqiqadan soʼng qayta urining.');
  if (!(await checkPass(pw, u && u.pass))) {
    await ipFail(ip, 'login');
    if (u) {
      const n = ((u.fails && u.fails.n) || 0) + 1;
      u.fails = n >= 8 ? { n: 0, until: now + 15 * 60000 } : { n, until: 0 };
      await users.setJSON(lg, u);
    }
    return fail(401, 'Login yoki parol notoʼgʼri.');
  }
  const st = statusOf(u);
  if (st) return fail(401, st.msg, st.code);
  const tok = await startSession(users, u, dev, label);
  if (!tok)
    return fail(401, 'Bu login ' + u.maxDevices + ' ta qurilmaga bogʼlangan. Yangi qurilmada ishlatish uchun admin bilan bogʼlaning.', 'devices');
  return json(200, { token: tok, user: pubUser(u), bank: await bankMeta() });
}

async function me(req) {
  const a = await userAuth(req);
  if (a.res) return a.res;
  const now = Date.now();
  if (now - (a.s.last || 0) > 3600000) {
    a.s.last = now;
    const d = (a.u.devices || []).find((x) => x.id === a.s.dev);
    if (d) d.last = now;
    await a.users.setJSON(a.u.login, a.u);
  }
  return json(200, { user: pubUser(a.u), bank: await bankMeta() });
}

async function logout(req) {
  const a = await userAuth(req);
  if (a.res) return json(200, { ok: true });
  a.u.sessions = (a.u.sessions || []).filter((x) => x !== a.s);
  await a.users.setJSON(a.u.login, a.u);
  return json(200, { ok: true });
}

async function questions(req) {
  const a = await userAuth(req);
  if (a.res) return a.res;
  const b = await store('content').get('bank', { type: 'json' });
  if (!b) return fail(409, 'Savollar bazasi hali yuklanmagan. Admin bilan bogʼlaning.', 'nobank');
  return json(200, b);
}

async function demo() {
  const d = await store('content').get('demo', { type: 'json' });
  if (!d || !d.demo || !d.demo.length) return fail(409, 'Demo savollar hali yuklanmagan.', 'nobank');
  return json(200, d);
}

async function progress(req) {
  const a = await userAuth(req);
  if (a.res) return a.res;
  const b = await readJson(req);
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!int(b.score, 0, 5000) || !int(b.total, 1, 5000) || b.score > b.total || !int(b.sec, -3, 1000))
    return fail(400, 'Notoʼgʼri natija');
  const pct = Math.round((b.score / b.total) * 100), now = Date.now();
  const s = store('stats');
  const st = (await s.get(a.u.login, { type: 'json' })) || { secs: {}, exams: [], tests: 0 };
  if (b.sec >= 0) {
    const prev = st.secs[b.sec] || { tries: 0 };
    st.secs[b.sec] = { score: b.score, total: b.total, pct, t: now, tries: prev.tries + 1 };
  } else if (b.sec === -3) {
    st.exams.push({ score: b.score, total: b.total, pct, t: now });
    if (st.exams.length > 30) st.exams = st.exams.slice(-30);
  }
  st.tests = (st.tests || 0) + 1;
  st.last = now;
  await s.setJSON(a.u.login, st);
  return json(200, { ok: true });
}

/* ───────── admin ───────── */
function adminPassword() {
  return String(process.env.ADMIN_PASSWORD || '');
}

async function adminLogin(req, ctx) {
  const pass = adminPassword();
  if (pass.length < 8)
    return fail(503, 'Admin paroli oʼrnatilmagan: Netlify → Site configuration → Environment variables boʼlimida ADMIN_PASSWORD (kamida 8 belgi) qoʼshing va saytni qayta deploy qiling.', 'noadmin');
  const ip = ctx.ip || 'unknown';
  if (await ipLimited(ip, 'admin', 10)) return fail(429, 'Juda koʼp xato urinish. 15 daqiqadan soʼng qayta urining.');
  const b = await readJson(req);
  if (!safeEqual(String(b.password || ''), pass)) {
    await ipFail(ip, 'admin');
    return fail(401, 'Admin paroli notoʼgʼri.');
  }
  const s = store('system');
  const now = Date.now();
  const list = ((await s.get('admin-sessions', { type: 'json' })) || []).filter((x) => x.exp > now);
  const t = token();
  list.push({ h: sha(t), created: now, exp: now + (b.remember ? ADMIN_TTL_LONG : ADMIN_TTL) });
  await s.setJSON('admin-sessions', list.slice(-20));
  return json(200, { token: t });
}

async function adminAuth(req) {
  const t = bearer(req);
  if (t.length < 20) return false;
  const h = sha(t), now = Date.now();
  const list = (await store('system').get('admin-sessions', { type: 'json' })) || [];
  return list.some((x) => x.h === h && x.exp > now);
}

async function adminLogout(req) {
  const h = sha(bearer(req)), s = store('system');
  const list = (await s.get('admin-sessions', { type: 'json' })) || [];
  await s.setJSON('admin-sessions', list.filter((x) => x.h !== h && x.exp > Date.now()));
  return json(200, { ok: true });
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

async function listUsers() {
  const users = store('users'), stats = store('stats');
  const { blobs } = await users.list();
  const rows = await mapLimit(blobs, 25, async (b) => {
    const [u, st] = await Promise.all([users.get(b.key, { type: 'json' }), stats.get(b.key, { type: 'json' })]);
    return u ? adminView(u, st) : null;
  });
  return json(200, { users: rows.filter(Boolean).sort((a, b) => (b.created || 0) - (a.created || 0)), bank: await bankMeta() });
}

function readUserFields(b, u) {
  if ('name' in b) u.name = str(b.name, 80);
  if ('phone' in b) u.phone = str(b.phone, 60);
  if ('note' in b) u.note = str(b.note, 300);
  if ('role' in b) {
    if (!['user', 'admin'].includes(b.role)) return 'Rol notoʼgʼri';
    u.role = b.role;
  }
  if ('exp' in b) {
    if (!(b.exp === 0 || (Number.isFinite(b.exp) && b.exp > 0))) return 'Muddat notoʼgʼri';
    u.exp = b.exp;
  }
  if ('maxDevices' in b) {
    if (!Number.isInteger(b.maxDevices) || b.maxDevices < 0 || b.maxDevices > 20) return 'Qurilmalar soni notoʼgʼri';
    u.maxDevices = b.maxDevices;
  }
  if ('disabled' in b) u.disabled = !!b.disabled;
  return null;
}

async function createUser(req) {
  const b = await readJson(req);
  const lg = normLogin(b.login);
  if (!LOGIN_RE.test(lg)) return fail(400, 'Login 3–32 belgi: lotin harflari, raqam, nuqta, chiziqcha. Masalan: sardor.aliyev');
  let pw = String(b.password || '').trim();
  if (!pw) pw = genPassword();
  if (pw.length < 6 || pw.length > 64) return fail(400, 'Parol kamida 6 belgidan iborat boʼlsin.');
  const users = store('users');
  if (await users.get(lg, { type: 'json' })) return fail(409, 'Bu login band. Boshqa login tanlang.');
  const now = Date.now();
  const u = { login: lg, role: 'user', exp: 0, maxDevices: 1, disabled: false, created: now, updated: now, devices: [], sessions: [] };
  const e = readUserFields(b, u);
  if (e) return fail(400, e);
  u.pass = await hashPass(pw);
  await users.setJSON(lg, u);
  return json(200, { user: adminView(u, null), password: pw });
}

async function updateUser(req, lg) {
  const b = await readJson(req);
  const users = store('users');
  const u = await users.get(lg, { type: 'json' });
  if (!u) return fail(400, 'Login topilmadi');
  const e = readUserFields(b, u);
  if (e) return fail(400, e);
  let pw;
  if (b.resetPassword) {
    pw = String(b.password || '').trim() || genPassword();
    if (pw.length < 6 || pw.length > 64) return fail(400, 'Parol kamida 6 belgidan iborat boʼlsin.');
    u.pass = await hashPass(pw);
    u.sessions = [];
  }
  if (b.resetDevices) { u.devices = []; u.sessions = []; }
  if (b.removeDevice) {
    u.devices = (u.devices || []).filter((d) => d.id !== b.removeDevice);
    u.sessions = (u.sessions || []).filter((s) => s.dev !== b.removeDevice);
  }
  if (b.logoutAll) u.sessions = [];
  if (b.unlock || b.resetPassword) u.fails = { n: 0, until: 0 };
  u.updated = Date.now();
  await users.setJSON(lg, u);
  const st = await store('stats').get(lg, { type: 'json' });
  return json(200, pw ? { user: adminView(u, st), password: pw } : { user: adminView(u, st) });
}

async function deleteUser(lg) {
  await store('users').delete(lg);
  await store('stats').delete(lg);
  return json(200, { ok: true });
}

function validateBank(bank, demoIds) {
  if (!Array.isArray(bank) || !bank.length || bank.length > 5000) return 'Savollar roʼyxati boʼsh yoki juda katta';
  const seen = new Set();
  for (const q of bank) {
    if (!Array.isArray(q) || q.length < 4) return 'Savol tuzilmasi notoʼgʼri';
    const [n, text, opts, cor] = q;
    if (!Number.isInteger(n) || n < 1 || seen.has(n)) return 'Savol raqami notoʼgʼri yoki takrorlangan: ' + n;
    seen.add(n);
    if (typeof text !== 'string' || !text.trim() || text.length > 5000) return 'Savol ' + n + ': matn notoʼgʼri';
    if (!opts || typeof opts !== 'object') return 'Savol ' + n + ': variantlar yoʼq';
    const keys = Object.keys(opts);
    if (keys.length < 2 || keys.some((k) => !OPT_KEYS.includes(k) || typeof opts[k] !== 'string' || opts[k].length > 3000))
      return 'Savol ' + n + ': variantlar notoʼgʼri';
    if (!keys.includes(cor)) return 'Savol ' + n + ': toʼgʼri javob variantlar ichida yoʼq';
  }
  if (!Array.isArray(demoIds) || demoIds.length > 100 || demoIds.some((d) => !seen.has(d))) return 'Demo savollar roʼyxati notoʼgʼri';
  return null;
}

async function putBank(req) {
  const b = await readJson(req, 12 * 1024 * 1024);
  const bank = (b.bank || []).map((q) => [q[0], q[1], q[2], q[3]]);
  const demoIds = Array.isArray(b.demo) ? b.demo : [];
  const e = validateBank(bank, demoIds);
  if (e) return fail(400, e);
  bank.sort((x, y) => x[0] - y[0]);
  const version = Date.now();
  const byId = new Map(bank.map((q) => [q[0], q]));
  const c = store('content');
  await c.setJSON('bank', { version, bank, demo: demoIds });
  await c.setJSON('demo', { version, demo: demoIds.map((id) => byId.get(id)) });
  const meta = { version, count: bank.length, demoCount: demoIds.length, updated: version };
  await c.setJSON('meta', meta);
  return json(200, meta);
}

async function getBank() {
  const b = await store('content').get('bank', { type: 'json' });
  return json(200, b || { version: 0, bank: [], demo: [] });
}

/* Admin o'z qurilmasida testni admin rolida ochishi uchun */
async function adminSelf(req) {
  const b = await readJson(req);
  const dev = str(b.device, 64), label = str(b.label, 60);
  if (!DEVICE_RE.test(dev)) return fail(400, 'Qurilma aniqlanmadi');
  const users = store('users');
  const now = Date.now();
  let u = await users.get(ADMIN_LOGIN, { type: 'json' });
  if (!u) u = { login: ADMIN_LOGIN, name: 'Admin', created: now, devices: [], sessions: [] };
  Object.assign(u, { role: 'admin', exp: 0, maxDevices: 0, disabled: false, updated: now });
  const tok = await startSession(users, u, dev, label);
  return json(200, { token: tok, user: pubUser(u), bank: await bankMeta() });
}

/* ───────── marshrutlash ───────── */
export default async (req, ctx) => {
  const path = new URL(req.url).pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const M = req.method;
  try {
    if (path === '/login' && M === 'POST') return await login(req, ctx);
    if (path === '/me' && M === 'GET') return await me(req);
    if (path === '/logout' && M === 'POST') return await logout(req);
    if (path === '/questions' && M === 'GET') return await questions(req);
    if (path === '/demo' && M === 'GET') return await demo();
    if (path === '/progress' && M === 'POST') return await progress(req);

    if (path === '/admin/status' && M === 'GET') return json(200, { configured: adminPassword().length >= 8 });
    if (path === '/admin/login' && M === 'POST') return await adminLogin(req, ctx);
    if (path.startsWith('/admin/')) {
      if (!(await adminAuth(req))) return fail(401, 'Admin sessiyasi tugagan. Qaytadan kiring.', 'admin');
      if (path === '/admin/logout' && M === 'POST') return await adminLogout(req);
      if (path === '/admin/users' && M === 'GET') return await listUsers();
      if (path === '/admin/users' && M === 'POST') return await createUser(req);
      const m = path.match(/^\/admin\/users\/([a-z0-9._-]+)$/);
      if (m && M === 'PATCH') return await updateUser(req, m[1]);
      if (m && M === 'DELETE') return await deleteUser(m[1]);
      if (path === '/admin/bank' && M === 'GET') return await getBank();
      if (path === '/admin/bank' && M === 'PUT') return await putBank(req);
      if (path === '/admin/self' && M === 'POST') return await adminSelf(req);
    }
    return fail(404, 'Topilmadi');
  } catch (e) {
    if (e && e.status) return fail(e.status, e.message);
    console.error(e);
    return fail(500, 'Server xatosi. Birozdan soʼng qayta urining.');
  }
};

export const config = { path: '/api/*' };
