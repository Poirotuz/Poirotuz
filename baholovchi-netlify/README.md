# Baholovchi Test — login/parol tizimi (Netlify)

| Manzil | Nima |
|---|---|
| `https://<sayt>.netlify.app/` | Test: foydalanuvchi **login va parol** bilan kiradi. Telefonga ilova sifatida o'rnatiladi va internetsiz ham ochiladi |
| `https://<sayt>.netlify.app/admin/` | Admin panel: loginlar yaratish, muddat, bloklash, qurilmalar, natijalar va savollar bazasi |

Server qismi Netlify Functions'da (`netlify/functions/api.mjs`) ishlaydi.
Ma'lumotlar Netlify Blobs xotirasida saqlanadi: foydalanuvchilar, natijalar va savollar.
Savollar bazasi sahifa kodida turmaydi. Uni server faqat tizimga kirgan foydalanuvchiga beradi.

## 1. Saytni ishga tushirish (bir marta)

Netlify Drop (sudrab tashlash) bilan server qismi ishlamaydi, shuning uchun sayt GitHub orqali ulanadi:

1. https://app.netlify.com → **Add new project → Import an existing project → GitHub**.
2. GitHub'ga ruxsat bering va **Poirotuz/Poirotuz** repozitoriysini tanlang.
3. Sozlamalar:
   - **Branch to deploy:** `claude/charming-shannon-gthq6j`
   - **Base directory:** `baholovchi-netlify`
   - Build command va Publish directory'ni bo'sh qoldiring (ular `netlify.toml` dan olinadi).
4. **Add environment variables → Add a single variable:**
   - Key: `ADMIN_PASSWORD`
   - Value: o'zingiz o'ylab topgan kuchli parol (kamida 8, yaxshisi 12+ belgi)
5. **Deploy** tugmasini bosing va 1–2 daqiqa kuting.
6. **Site configuration → Change site name** orqali nom bering (masalan `baholovchi-test`).
7. `https://<nom>.netlify.app/admin/` ni oching va admin paroli bilan kiring.
8. **Savollar** bo'limida `Baholovchi_Test_v4.1_1145savol.html` faylini tanlang.
   Savollar va 20 ta demo savol fayldan avtomatik olinadi. Bu bir martalik ish.

> Agar oldin Netlify Drop bilan sayt yaratgan bo'lsangiz, manzilni saqlab qolish uchun yangi sayt ochmasdan
> **Site configuration → Build & deploy → Link repository** orqali o'sha saytni GitHub'ga ulashingiz mumkin.

## 2. Yangi foydalanuvchi

Admin panel → **Foydalanuvchilar → Yangi foydalanuvchi**:

1. Ismni yozing. Login ismdan avtomatik yasaladi, parol ham tayyor turadi (ikkalasini o'zgartirish mumkin).
2. Muddatni (30 kun … cheksiz yoki aniq sana) va qurilmalar sonini tanlang (odatda 1).
3. **Login yaratish** → **Xabar matnini nusxalash** ni bosib, matnni Telegram'da yuboring.
   Xabarda sayt manzili, login, parol va muddat bor.

## 3. Boshqarish

Har bir foydalanuvchi kartasida quyidagilar ko'rinadi: muddat, qurilmalar, oxirgi kirish va natijalar
(o'tilgan bo'limlar, o'rtacha %, imtihonlar). Kartadan bajariladigan amallar:

- **Tahrirlash:** ism, telefon, izoh, muddat (+30/+90/+180/+365 kun tugmalari), qurilmalar soni, rol.
- **Yangi parol:** eski parol darhol ishlamay qoladi.
- **Bloklash / Faollashtirish:** bloklangan foydalanuvchi testdan darhol chiqariladi (15 daqiqa ichida).
- **Qurilmalarni tozalash:** foydalanuvchi telefonini almashtirganda kerak bo'ladi.
- **O'chirish.**
- **Excel (CSV):** butun ro'yxatni yuklab olish.

Bitta login bir vaqtda ko'rsatilgan sondagi qurilmada ishlaydi (standart: 1 ta).
Login boshqa qurilmada ochilsa, "limit to'lgan" degan xabar chiqadi.
Shu tufayli loginni boshqalarga berib bo'lmaydi.

**Savollar** bo'limida savolni raqami yoki matni bo'yicha topib tahrirlash, yangisini qo'shish,
o'chirish va demo ro'yxatini o'zgartirish mumkin. **Serverga saqlash** dan keyin foydalanuvchilar
yangi bazani avtomatik oladi.

**Sozlamalar → Testni admin sifatida ochish:** shu qurilmada testga admin bo'lib kirish (login/parolsiz).

## 4. Admin parolini o'zgartirish

1. Netlify → saytingiz → **Site configuration → Environment variables → ADMIN_PASSWORD → Edit**.
2. **Deploys → Trigger deploy → Deploy site**.

## Xarajat (Netlify bepul tarifi)

Bepul tarifda oyiga 300 kredit beriladi. Har bir deploy 15 kredit turadi.
Foydalanuvchi qo'shish, savollarni tahrirlash va boshqa admin amallari deploy talab qilmaydi.
Deploy faqat sayt kodi o'zgarganda kerak bo'ladi. Odatiy foydalanishda kredit yetadi.
Netlify → **Usage** bo'limida sarfni kuzatish mumkin.

## Texnik ma'lumot

- `public/`: test (`index.html`), admin panel (`admin/index.html`), PWA fayllari, `_headers` (CSP va boshqa xavfsizlik sarlavhalari).
- `netlify/functions/api.mjs`: barcha `/api/*` so'rovlar.
- Parollar scrypt bilan xeshlanadi. Sessiya tokenlari xeshlangan holda saqlanadi.
- Kirish urinishlari cheklangan: bitta login uchun 8 marta xato bo'lsa, 15 daqiqaga qulflanadi.
  IP bo'yicha ham cheklov bor (admin uchun 10, foydalanuvchilar uchun 30 xato / 15 daqiqa).
- Natijalar qurilmada saqlanadi va serverga ham yuboriladi (adminga ko'rinadi).
  Test internetsiz ham ishlaydi. Login holati internet bo'lganda tekshiriladi.
- Lokal sinov: `npm install`, keyin `ADMIN_PASSWORD=... npx netlify dev`.
- `input/` (asl fayllar) va `dist/` repoga kirmaydi.
