#!/usr/bin/env node
/*
 * Baholovchi Test → Netlify Drop uchun tayyor sayt papkasi va zip.
 *
 *   node build.mjs --test input/Baholovchi_Test.html --keys input/OVG_Parol_generatori_ADMIN.html
 *
 * ADMIN_PASSWORD muhit o'zgaruvchisi berilmasa, kuchli tasodifiy admin paroli yaratiladi
 * va konsolga chiqariladi. Natija: dist/site/ va dist/Baholovchi_Netlify.zip
 *
 * Maxfiy kalit (PRV) faqat --keys faylidan o'qiladi va saytga faqat shifrlangan holda tushadi.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import nodeCrypto from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const TPL = join(HERE, 'template');
const PBKDF2_ITERATIONS = 600000;

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const TEST_FILE = resolve(arg('test', join(HERE, 'input/Baholovchi_Test.html')));
const KEYS_FILE = resolve(arg('keys', join(HERE, 'input/OVG_Parol_generatori_ADMIN.html')));
const OUT = resolve(arg('out', join(HERE, 'dist')));
const SITE = join(OUT, 'site');
const ZIP = join(OUT, 'Baholovchi_Netlify.zip');

function fail(msg) { console.error('XATO: ' + msg); process.exit(1); }
function jsonVar(src, name) {
  const m = src.match(new RegExp('var\\s+' + name + '\\s*=\\s*(\\{[^;]*?\\})\\s*;'));
  return m ? JSON.parse(m[1]) : null;
}
function patch(html, find, repl, label) {
  if (!html.includes(find)) fail('test faylida kutilgan joy topilmadi: ' + label);
  return html.replace(find, () => repl);
}
function genPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  while (s.length < 16) {
    const b = nodeCrypto.randomBytes(1)[0];
    if (b < 256 - (256 % abc.length)) s += abc[b % abc.length];
  }
  return s.match(/.{4}/g).join('-');
}

if (!existsSync(TEST_FILE)) fail('test fayli topilmadi: ' + TEST_FILE);
if (!existsSync(KEYS_FILE)) fail('kalit fayli topilmadi: ' + KEYS_FILE);

/* ---- kalitlar ---- */
const testSrc = readFileSync(TEST_FILE, 'utf8');
const keySrc = readFileSync(KEYS_FILE, 'utf8');
let PRV, PUB;
try { const j = JSON.parse(keySrc); PRV = j.PRV; PUB = j.PUB; } catch { PRV = jsonVar(keySrc, 'PRV'); PUB = jsonVar(keySrc, 'PUB'); }
if (!PRV || !PRV.d) fail('kalit faylida maxfiy kalit (PRV) topilmadi');
PUB = PUB || { kty: 'EC', crv: 'P-256', x: PRV.x, y: PRV.y };
const PUB2 = jsonVar(testSrc, 'PUB2');
if (!PUB2) fail('test faylida PUB2 ochiq kaliti topilmadi');
if (PUB2.x !== PRV.x || PUB2.y !== PRV.y) fail('maxfiy kalit test faylidagi PUB2 ga mos emas');
{
  const priv = nodeCrypto.createPrivateKey({ key: PRV, format: 'jwk' });
  const pub = nodeCrypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: PUB2.x, y: PUB2.y }, format: 'jwk' });
  const msg = Buffer.from('OVG-build-selftest');
  const sig = nodeCrypto.sign('sha256', msg, { key: priv, dsaEncoding: 'ieee-p1363' });
  if (!nodeCrypto.verify('sha256', msg, { key: pub, dsaEncoding: 'ieee-p1363' }, sig)) fail('kalit juftligi imzo tekshiruvidan o\'tmadi');
}

/* ---- test sahifasi (index.html) ---- */
let index = testSrc;
index = patch(index, '<meta name="theme-color" content="#0a0a0f">',
  '<meta name="theme-color" content="#0a0a0f">\n' +
  '<meta name="description" content="Baholovchilar uchun malaka testi: 1145 savol, bo‘limlar va imtihon rejimi.">\n' +
  '<meta name="apple-mobile-web-app-title" content="Baholovchi">\n' +
  '<link rel="manifest" href="manifest.webmanifest">\n' +
  '<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">\n' +
  '<link rel="icon" type="image/svg+xml" href="icons/icon.svg">\n' +
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">', 'theme-color meta');
// Test faylidagi matnlar \uXXXX ko'rinishida yozilgan — ularni aynan shunday qidiramiz
const U = (hex) => '\\' + 'u' + hex;
index = patch(index, "'Faylni <b>Chrome</b>da oching (maxfiy rejimsiz).'",
  "'Saytni oddiy (maxfiy bo" + U('02bc') + "lmagan) oynada oching.'", 'storewarn matni');
index = patch(index,
  "'<div class=\"sec-warn\">Yangi kalitlar faqat <b>Admin Kalit Generatori</b> faylida yaratiladi. Bu faylda maxfiy kalit yo" +
    U('02bc') + 'q ' + U('2014') + " shuning uchun uni tarqatish xavfsiz.</div>'",
  "'<div class=\"sec-warn\">Yangi parollar <a href=\"admin/\" style=\"color:var(--yl);font-weight:700\">" + U('2699') +
    " Admin panel</a>da yaratiladi (alohida admin paroli bilan himoyalangan).</div>'",
  'admin panel havolasi');
const lastBody = index.lastIndexOf('</body>');
if (lastBody < 0) fail('</body> topilmadi');
index = index.slice(0, lastBody) + readFileSync(join(TPL, 'pwa-inject.html'), 'utf8') + index.slice(lastBody);

/* ---- admin panel (shifrlangan) ---- */
let admin = readFileSync(join(TPL, 'admin.html'), 'utf8');
if (!admin.includes('/*__OVG_KEYS__*/')) fail('admin shablonida kalit joyi yo\'q');
admin = admin.replace('/*__OVG_KEYS__*/', () =>
  'var PRV=' + JSON.stringify({ kty: 'EC', crv: 'P-256', x: PRV.x, y: PRV.y, d: PRV.d }) + ';\n' +
  'var PUB=' + JSON.stringify({ kty: 'EC', crv: 'P-256', x: PUB2.x, y: PUB2.y }) + ';');

const generated = !process.env.ADMIN_PASSWORD;
const password = (process.env.ADMIN_PASSWORD || genPassword()).trim().normalize('NFC');
if (password.length < 10) fail('ADMIN_PASSWORD kamida 10 belgi bo\'lsin');

const { subtle } = globalThis.crypto;
const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const raw = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, base, 256);
const aes = await subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(admin)));
const b64 = (u) => Buffer.from(u).toString('base64');
const payload = JSON.stringify({ v: 1, it: PBKDF2_ITERATIONS, s: b64(salt), iv: b64(iv), ct: b64(ct) });
const lock = readFileSync(join(TPL, 'lock.html'), 'utf8').replace('__OVG_PAYLOAD__', () => payload);
if (lock.includes(PRV.d)) fail('maxfiy kalit shifrlanmagan holda qoldi');

/* ---- yozish ---- */
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(SITE, 'admin'), { recursive: true });
cpSync(join(TPL, 'static'), SITE, { recursive: true });
writeFileSync(join(SITE, 'index.html'), index);
writeFileSync(join(SITE, 'admin', 'index.html'), lock);
execFileSync('zip', ['-r', '-X', '-q', ZIP, '.'], { cwd: SITE });

console.log('Tayyor:');
console.log('  papka: ' + SITE);
console.log('  zip:   ' + ZIP);
console.log(generated ? '  ADMIN PAROLI (yangi yaratildi): ' + password : '  Admin paroli: ADMIN_PASSWORD dan olindi');
