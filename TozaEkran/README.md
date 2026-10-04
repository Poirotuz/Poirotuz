# TozaEkran — Yandex Browser uchun reklama bloklovchi

**TozaEkran** — saytlardagi reklamalarni bloklaydigan brauzer kengaytmasi (расширение).
Yandex Browser uchun yozilgan, lekin Chromium asosidagi boshqa brauzerlarda ham ishlaydi
(Google Chrome, Microsoft Edge, Opera, Brave).

Ayniqsa kino saytlari uchun moslangan: **asilmedia.org** dagi bannerlar, video-reklamalar
(22bet, Mostbet pre-roll roliklari) va o'z-o'zidan ochiladigan oynalar bloklanadi.

## Nimalarni bloklaydi

| | |
|---|---|
| 🧱 **Reklama so'rovlari** | ~14 000 tarmoq qoidasi va ~51 000 reklama domeni (EasyList, RuAdList, AdGuard) — reklama umuman yuklanmaydi |
| 🙈 **Bannerlar** | ~14 000 umumiy va ~20 000 saytga xos yashirish qoidasi; bloklangan reklamaning bo'sh joyi ham yig'ib olinadi |
| 🪟 **Popup / popunder oynalar** | Sahifani bosganda ochiladigan reklama oynalari ochilmaydi; ochilib qolganlari darhol yopiladi |
| ↩️ **Reklamaga yo'naltirish** | Sayt joriy yorliqni reklama saytiga yo'naltirsa, avvalgi sahifaga qaytariladi |
| 🎬 **Video-reklama** | Pleyerdagi pre-roll reklamalar (VAST/VPAID) bloklanadi, "O'tkazib yuborish / Пропустить / Skip" tugmasi avtomatik bosiladi. YouTube reklamalari oxiriga o'tkazib yuboriladi |
| 🎰 **Bukmeker / kazino reklamalari** | 1xBet, 1win, Mostbet, Melbet, Pin-Up, 22bet va boshqalar bannerlari |
| 👻 **Shaffof qatlamlar** | Sahifa ustiga yopishtirilgan ko'rinmas "klik o'g'irlovchi" havolalar olib tashlanadi |
| 🎯 **Qo'lda o'chirish** | Qolib ketgan har qanday reklamani sichqoncha bilan tanlab, doimiy yashirish mumkin |

### asilmedia.org uchun maxsus himoya

- `raw.githubusercontent.com/AsilMediaUzbek/videoreklamalar/…` — sayt video-reklamalarni shu yerdan yuklaydi, bloklanadi;
- `yangi-kinolar.ru` — reklama serveri (banner va VAST), bloklanadi;
- uchinchi tomon `.php` skriptlari (popunder yuklovchilar) bloklanadi;
- `.Catfish` (pastki yopishqoq reklama), `#banner`, bukmeker havolalari yashiriladi;
- **qattiq popup rejimi** doim yoqilgan: saytdan ochilgan barcha begona oynalar yopiladi
  (siz o'zingiz bosgan havolalar, masalan Telegram kanali, odatdagidek ochiladi).

## Yandex Browser'ga o'rnatish

1. Shu repozitoriyani yuklab oling: GitHub sahifasida **Code → Download ZIP** ni bosing va arxivni oching.
   (Yoki tayyor `TozaEkran.zip` faylini oching.)
2. Yandex Browser manzil satriga yozing: `browser://extensions` va Enter bosing.
3. O'ng yuqoridagi **«Режим разработчика»** (Developer mode) tugmasini yoqing.
4. **«Загрузить распакованное расширение»** (Load unpacked) tugmasini bosing.
5. Ochilgan oynada **`TozaEkran/extension`** papkasini tanlang (ichida `manifest.json` bo'lgan papka).
6. Tayyor! Kengaytma ikonkasi (yashil qalqon ▶) asboblar panelida paydo bo'ladi.
   Qulaylik uchun uni panelga mahkamlab qo'ying.

> Papkani o'chirib yubormang va joyini o'zgartirmang — brauzer kengaytmani shu papkadan yuklaydi.
> Brauzer ishga tushganda "dasturchi rejimidagi kengaytmalar" haqida ogohlantirsa — bu odatiy hol.

Google Chrome / Edge / Opera'da ham xuddi shunday: `chrome://extensions` (Edge: `edge://extensions`) →
Developer mode → Load unpacked → `TozaEkran/extension`.

## Do'konga joylash (developer rejimisiz o'rnatish uchun)

Yandex Browser kengaytmalarni **Chrome Web Store** va **Opera Add-ons** do'konlaridan o'rnata oladi
(brauzerning «Каталог расширений» bo'limi Opera Add-ons'ga asoslangan). Kengaytmani shu do'konlardan biriga
joylasangiz, uni har kim bir tugma bilan o'rnatadi va yangilanishlar avtomatik keladi.
Kerakli skrinshotlar, tavsif matnlari va ruxsatlar izohi — [`store/LISTING.md`](store/LISTING.md).

## Foydalanish

Ikonkani bosing — kichik oyna ochiladi:

- **Yuqoridagi tugma** — butun kengaytmani yoqish / o'chirish.
- **Bu saytda himoya** — biror sayt reklama bloklovchi bilan noto'g'ri ishlasa, faqat shu saytda o'chirib qo'ying.
- **Statistika** — shu sahifada bloklangan so'rovlar, to'xtatilgan popup oynalar va olib tashlangan elementlar.
- **🎯 Reklamani tanlab o'chirish** — reklama ustiga sichqonchani olib boring va bosing, so'ng **✓ Yashirish**.
  «▲ Kattaroq» tugmasi bilan butun reklama blokini tanlash mumkin. Shuningdek, sahifada sichqonchaning
  o'ng tugmasi → **«TozaEkran: reklamani tanlab o'chirish»**.
- **Qattiq popup rejimi** — saytdan ochiladigan barcha begona oynalarni yopadi (kino saytlari uchun foydali).
- **Sozlamalar ⚙** — o'chirilgan saytlar, qattiq rejim ro'yxati, qo'lda yashirilgan elementlar, zaxira nusxa (eksport/import).

Kengaytma ikonkasidagi raqam — joriy sahifada bloklangan reklama so'rovlari soni.

## Muammo bo'lsa

- **Sayt ishlamay qoldi** → ikonka → «Bu saytda himoya» ni o'chiring (sahifa avtomatik yangilanadi).
- **Biror reklama qolib ketdi** → «🎯 Reklamani tanlab o'chirish» bilan yashiring.
- **Kerakli oyna ochilmadi** (masalan, to'lov yoki kirish oynasi) → shu sayt uchun «Qattiq popup rejimi» ni o'chiring
  yoki saytda himoyani vaqtincha o'chiring.
- Yandex Browser'ning **yangi tab sahifasidagi** lenta va reklamalar brauzerning o'z sahifasi — ularni
  kengaytmalar bloklay olmaydi. Ularni brauzer sozlamalarida (Настройки → Интерфейс) o'chirish mumkin.

## Qanday ishlaydi (dasturchilar uchun)

```
TozaEkran/
├── extension/                ← brauzerga yuklanadigan papka (Manifest V3)
│   ├── manifest.json
│   ├── background.js         ← fon xizmati: kosmetik CSS, popup yopuvchi, sozlamalar, statistika
│   ├── content/
│   │   ├── main-world.js     ← sahifa muhitida: window.open / sun'iy havola bosish orqali popuplarni to'xtatish
│   │   ├── content.js        ← overlay, bukmeker bannerlari, bloklangan iframe'lar, video-reklama
│   │   └── picker.js         ← "reklamani tanlab o'chirish" vositasi
│   ├── rules/*.json          ← declarativeNetRequest qoidalari (avtomatik yaratilgan)
│   ├── data/                 ← generic.css, cosmetic.json, popup.json (avtomatik yaratilgan)
│   ├── popup/  options/  icons/
└── tools/
    ├── build-filters.mjs     ← filtr ro'yxatlarini MV3 qoidalariga aylantiruvchi generator
    ├── extra-filters.txt     ← TozaEkran'ning o'z qoidalari (asilmedia.org, bukmekerlar, video-reklama serverlari)
    └── update-filters.sh     ← ro'yxatlarni yuklab olib, qoidalarni qayta yaratish
```

- Tarmoq darajasida bloklash brauzerning o'zida (`declarativeNetRequest`) bajariladi — tez va xavfsiz.
- Kosmetik qoidalar `USER` darajasidagi CSS sifatida kiritiladi, sayt ularni bekor qila olmaydi.
- Kontent-skriptlar dinamik ro'yxatdan o'tkaziladi, shuning uchun himoya o'chirilgan saytlarga umuman kiritilmaydi.

**Filtrlarni yangilash:** `tools/extra-filters.txt` ga o'z qoidangizni qo'shing (ABP/AdGuard sintaksisi) yoki
ro'yxatlarni yangilang:

```bash
cd TozaEkran/tools
./update-filters.sh     # git va Node.js 18+ kerak
```

So'ng `browser://extensions` sahifasida kengaytmani ⟳ tugmasi bilan qayta yuklang.

## Litsenziyalar va manbalar

Filtr qoidalari quyidagi ochiq ro'yxatlar asosida avtomatik yaratilgan:

- [EasyList](https://github.com/easylist/easylist) — GPLv3 / CC BY-SA 3.0
- [RuAdList (AdBlock Russian)](https://github.com/easylist/ruadlist) — CC BY-SA 3.0
- [AdGuard Filters](https://github.com/AdguardTeam/AdguardFilters) (Russian, Base — xorijiy bo'lim) — GPLv3

`extension/rules/` va `extension/data/` papkalaridagi ma'lumotlar shu ro'yxatlarning hosilasi bo'lib,
ularning litsenziyalari shartlari asosida tarqatiladi.
