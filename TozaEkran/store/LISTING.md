# Do'konga joylash uchun materiallar

Bu papkada Chrome Web Store / Opera Add-ons uchun kerakli hamma narsa bor:

| Fayl | Nima uchun |
|---|---|
| `screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png` | Do'kon skrinshotlari (1280×800) |
| `promo-440x280.png` | Kichik promo-rasm (Chrome Web Store) |
| `../extension/icons/icon128.png` | Do'kon ikonkasi (128×128) |
| `../PRIVACY.md` | Maxfiylik siyosati (havolasini do'konga qo'ying) |

**Yuklanadigan arxiv:** `extension` papkasining **ichidagi** fayllar zip qilinadi — `manifest.json` arxivning
ildizida bo'lishi shart (papkaning o'zini emas, ichidagilarni tanlab "Сжать в ZIP" qiling).

---

## Nomi

```
TozaEkran — reklama bloklovchi
```

## Qisqa tavsif (132 belgigacha)

O'zbekcha:
```
Bannerlar, popup oynalar va video-reklamalarni bloklaydi. Kino saytlari (asilmedia.org) uchun maxsus himoya.
```

Ruscha:
```
Блокирует баннеры, всплывающие окна и видеорекламу. Особая защита для сайтов с фильмами.
```

## To'liq tavsif

O'zbekcha:
```
TozaEkran — saytlardagi reklamani bloklaydigan yengil va tez kengaytma.

• Reklama so'rovlarini bloklaydi — 14 000 dan ortiq qoida (EasyList, RuAdList, AdGuard asosida)
• Bannerlarni yashiradi va bo'sh qolgan joylarni yig'ib oladi
• Sahifani bosganda ochiladigan popup va popunder oynalarni to'xtatadi
• Sahifani reklama saytiga yo'naltirishni qaytaradi
• Video-reklamalarni bloklaydi va "O'tkazib yuborish" tugmasini o'zi bosadi
• Bukmeker va kazino bannerlarini olib tashlaydi
• Ko'rinmas "klik o'g'irlovchi" qatlamlarni o'chiradi
• Qolgan reklamani sichqoncha bilan tanlab, doimiy yashirish mumkin
• Har bir sayt uchun himoyani yoqish/o'chirish
• asilmedia.org va boshqa kino saytlari uchun maxsus qoidalar

Hech qanday ma'lumot yig'ilmaydi va hech qayerga yuborilmaydi.
```

Ruscha:
```
TozaEkran — лёгкий и быстрый блокировщик рекламы.

• Блокирует рекламные запросы — более 14 000 правил (на основе EasyList, RuAdList, AdGuard)
• Скрывает баннеры и убирает пустые места после них
• Останавливает всплывающие окна и pop-under при клике по странице
• Возвращает страницу, если сайт перенаправляет её на рекламу
• Блокирует видеорекламу и сам нажимает «Пропустить»
• Убирает баннеры букмекеров и казино
• Удаляет невидимые «перехватчики кликов»
• Оставшуюся рекламу можно скрыть вручную — просто выберите её мышкой
• Защиту можно отключить для отдельного сайта
• Специальные правила для asilmedia.org и других сайтов с фильмами

Расширение не собирает и никуда не передаёт данные.
```

## Toifa / Категория

`Productivity` (Chrome Web Store'da "Работа" / "Workflow & Planning" yoki "Privacy & Security")

---

## Chrome Web Store — "Privacy practices" (Конфиденциальность) bo'limi

**Single purpose / Единственное назначение:**
```
Blocking advertisements, pop-up windows and video ads on websites.
```

**Ruxsatlar izohi (Permission justification):**

| Ruxsat | Izoh (inglizcha yozing) |
|---|---|
| `declarativeNetRequest` | `Blocks requests to advertising servers using bundled filter rules.` |
| `declarativeNetRequestFeedback` | `Shows the number of blocked requests on the current tab in the popup.` |
| `storage` | `Saves user settings (disabled sites, custom hidden elements) locally.` |
| `scripting` | `Injects cosmetic CSS that hides ad elements and the element picker tool.` |
| `tabs` | `Reads the active tab address to show per-site settings and close ad pop-up tabs.` |
| `webNavigation` | `Detects pop-up/pop-under tabs opened by pages and closes those that lead to ad domains.` |
| `contextMenus` | `Adds a right-click menu item to hide an ad element manually.` |
| Host permission `<all_urls>` | `An ad blocker must work on every website the user visits to hide ads and stop pop-ups.` |

**Remote code / Удалённый код:** `No, I am not using remote code.`

**Data usage / Использование данных:** hech bir bandni belgilamang (ma'lumot yig'ilmaydi) va quyidagi uchta
tasdiqni belgilang ("I do not sell or transfer user data…").

**Privacy policy URL:** `PRIVACY.md` faylining GitHub havolasi, masalan:
`https://github.com/Poirotuz/Poirotuz/blob/main/TozaEkran/PRIVACY.md`
(branch `main` ga birlashtirilgandan keyin).
