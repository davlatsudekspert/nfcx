# NFCSTORE dizayn tizimi — V1 "Black & Gold Prestige"

Manba: `design-proposals/v1-black-gold/` (tanlangan variant). Tokenlar va klasslar: `src/theme.css` (oxirgi bo'lim). daisyUI temasi `nfcstore` allaqachon oltin/qora — `btn-primary`, `btn-accent`, `badge` ishlayveradi; quyidagilar ustiga qo'shildi.

## Tokenlar
| Nomi | Qiymat | Qayerda |
|---|---|---|
| Fon | `--vz-bg #0a0805`, `--vz-bg-2 #14100a` | sahifa |
| Karta | `--vz-card #141009` (gradient `.vz-card`), `--vz-card-2 #1e1810` | panellar |
| Chiziq | `--vz-line #2d2518` | border |
| Matn | `--vz-ink #f6efe0`, `--vz-ink-2 #b5a78b`, `--vz-ink-3 #8a7f68` | asosiy / ikkilamchi / xira |
| Oltin | `--vz-gold #d4af5a`, `--vz-gold-2 #f0cf7a`, `--vz-gold-3 #b3860f`, matn `--vz-gold-ink #1a1206` | CTA, urg'u |
| Radius | karta 14px, maydon 10px, tugma 999px (pill) | |
| Shrift | sarlavha **Playfair Display** (`.font-display`, `.vz-h1`, `.vz-h2`), matn **Manrope**, ID/kod **Space Mono** | |

## Klasslar
- Sarlavha: `.vz-kicker` (— NFC KARTA), `.vz-h1`, `.vz-h2` (ostida 56px oltin chiziq; `.vz-h2--center`), `.vz-lead`
- Tugma: `.btn .btn-gold` (asosiy CTA), `.btn .btn-outline-gold` (ikkilamchi), `.btn .btn-ghost-vz` (oddiy), `.btn .btn-error` (xavfli). Hammasi ≥44px.
- Karta: `.vz-card` (gradient+soya), `.vz-card--flat`, `.vz-panel` (ichki blok), `.vz-divider`
- Holat: `.vz-badge .vz-badge--gold|ok|warn|info|muted`
- Forma: `.vz-label`, `.vz-input`, `.vz-input--err`, `.vz-err`
- Skeleton/bo'sh: `.vz-skel`, `.vz-empty`
- Ommaviy profil havolasi: `.vz-linkbtn`

## Qoidalar
1. Sahifa tuzilmasi: `kicker → h2 → matn → kartalar` (prototipdagi kabi). Bo'limlar orasida 48–72px.
2. Bitta sahifada bitta asosiy CTA (`btn-gold`); qolganlari outline/ghost.
3. Emoji ikon o'rniga `src/components/Icons.jsx` SVG'lari (mavjud emoji'larni ko'paytirma).
4. Har bosiladigan element ≥44×44px, `:focus-visible` ko'rinadi (theme.css).
5. Har ro'yxat/so'rovda 4 holat: loading (`.vz-skel`), empty (`.vz-empty`), error (matn + "Qayta urinish"), success.
6. Matnlar faqat `t('...')` orqali; yangi kalitlar `translations.site|account|admin.js` ga.
7. Gorizontal scroll yo'q: grid bolalarida `min-w-0`, jadval `overflow-x-auto` o'ramda, uzun matn `break-words`.
8. Kontrast: oltin matn faqat qora fonda; oq fonda oltin matn ishlatilmaydi.
9. Neon, tasodifiy gradient, ortiqcha glassmorphism, ko'p emoji — yo'q.
