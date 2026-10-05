# Baholovchi Test — Netlify sayti

Bu papkadagi `build.mjs` skripti «Baholovchi Test» dasturini va OVG parol generatorini
Netlify Drop (https://app.netlify.com/drop) ga tashlashga tayyor saytga aylantiradi.

| Manzil | Nima |
|---|---|
| `https://<sayt>.netlify.app/` | Test: foydalanuvchilar uchun. Telefonga ilova sifatida o'rnatiladi va internetsiz ham ochiladi |
| `https://<sayt>.netlify.app/admin/` | Admin panel: parol yasash, foydalanuvchilar daftari, testga admin bo'lib kirish, admin parolini almashtirish |

Admin panel AES-256-GCM bilan shifrlangan. Kalit admin parolidan PBKDF2-SHA256 (600 000 marta) orqali olinadi.
Saytda maxfiy kalit faqat shifrlangan holda turadi, admin parolisiz uni ochib bo'lmaydi.

## 1. Saytni birinchi marta joylash

1. https://app.netlify.com ga kiring yoki bepul ro'yxatdan o'ting. Akkauntsiz tashlangan sayt 1 soatdan keyin o'chib ketadi.
2. `Baholovchi_Netlify.zip` ni oching (Extract). Ichida `index.html`, `admin/`, `icons/` va boshqa fayllar bor.
3. Ochilgan papkani https://app.netlify.com/drop sahifasiga sudrab tashlang.
4. Darhol **Site configuration → Change site name** bo'limida nomni o'zgartiring (masalan `baholovchi-test`).
   Buni foydalanuvchilarga havola berishdan **oldin** qiling.

> Muhim: sayt manzili (domen) o'zgarsa, barcha foydalanuvchilarning Qurilma ID si ham o'zgaradi
> va berilgan parollar ishlamay qoladi. Nomni bir marta, boshida qo'ying.

## 2. Yangi foydalanuvchiga parol berish

1. `…/admin/` ni oching va admin parolini kiriting.
2. «Taklif matnini nusxalash» tugmasini bosib, matnni foydalanuvchiga Telegram orqali yuboring.
3. Foydalanuvchi saytda «Kalit bilan kirish» ni bosadi va Qurilma ID sini sizga yuboradi.
4. «Yangi parol yasash» bo'limida ID, ism va muddatni kiriting. Keyin «Xabar matni bilan nusxalash» ni bosib, matnni yuboring.

Parol faqat ID olingan qurilma va brauzerda ishlaydi. Berilgan parollarning hammasi daftarda saqlanadi:
qidirish mumkin, CSV (Excel) yoki JSON ko'rinishida yuklab olish mumkin.

## 3. Testni boshqarish

Admin panelda «Testni admin sifatida ochish» tugmasini bosing. Shu qurilma uchun cheksiz Admin parol yasaladi
va test admin rejimida ochiladi: statistika, kalitni tekshirish va natijalarni tozalash ishlaydi.

## 4. Saytni yangilash

Yangi sayt yaratmang. Netlify'da o'z saytingizni oching, **Deploys** bo'limiga kiring va yangilangan papkani
pastdagi «Drag and drop» maydoniga tashlang. Manzil o'zgarmaydi, foydalanuvchilarning parollari ishlashda davom etadi.

## 5. Admin parolini almashtirish

1. Admin panelning eng pastidagi bo'limda joriy parolni va yangi parolni (2 marta) kiriting.
2. Yuklab olingan `index.html` ni papkadagi `admin/index.html` o'rniga qo'ying.
3. Papkani 4-banddagidek **Deploys** bo'limiga qayta tashlang.

## Bilish kerak bo'lgan cheklovlar

- Sayt statik, server yo'q. Parol tekshiruvi brauzerda bajariladi. Savollar bazasi sahifa ichida turadi
  (avval fayl ko'rinishida tarqatilgandagidek). Brauzerda «Sahifa kodini ko'rish» ni bosgan odam uni ko'ra oladi.
- Oddiy «login + qisqa parol» (istalgan qurilmadan kirish) uchun server va ma'lumotlar bazasi kerak.
  Netlify Drop buni qo'llamaydi.
- iPhone'da Safari va bosh ekrandagi ilovaning xotirasi alohida. Shu sababli foydalanuvchi Qurilma ID ni
  qayerda ishlatmoqchi bo'lsa, o'sha yerdan olishi kerak (dastur buni iPhone'da o'zi eslatadi).
- Fayl ko'rinishidagi eski versiyada berilgan parollar saytda ishlamaydi, chunki Qurilma ID boshqacha bo'ladi.
  Bu foydalanuvchilarga saytda yangi parol yasab berish kerak. Eski fayllar esa avvalgidek ishlayveradi.
- Daftar admin brauzerida saqlanadi. Boshqa qurilmaga «Zaxira (JSON)» → «Zaxiradan tiklash» orqali o'tkaziladi.

## Qayta yig'ish (dasturchi uchun)

```bash
# input/ papkasiga asl fayllarni qo'ying (ular git'ga tushmaydi):
#   input/Baholovchi_Test.html, input/OVG_Parol_generatori_ADMIN.html
ADMIN_PASSWORD='kuchli-parol' node build.mjs
# yoki parolsiz: tasodifiy kuchli parol yaratiladi va konsolga chiqariladi
node build.mjs --test yo'l/test.html --keys yo'l/generator.html
```

Natija: `dist/site/` (Netlify'ga tashlanadigan papka) va `dist/Baholovchi_Netlify.zip`.
Skript maxfiy kalit test faylidagi ochiq kalitga mosligini tekshiradi. Kalit ochiq holda qolsa, skript to'xtaydi.

Repoga faqat skript va shablonlar kiradi. Maxfiy kalit, savollar bazasi va tayyor sayt (`input/`, `dist/`)
`.gitignore` orqali chiqarib tashlangan.
