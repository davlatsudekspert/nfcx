# NFCSTORE Nova — Concept B Final reference

`concept_b_final.html` (jami **2477 qator**) dan **faqat audit uchun
kerak bo'lgan qismlar** ajratildi. To'liq nusxa emas.

Har bo'limda **original qator raqami** ko'rsatilgan, shuning uchun
HTML ichida darhol topish mumkin.

Solishtiriladigan Flutter kodi: `DEEPSEEK_UI_AUDIT_SOURCE.md`.

## Eng muhim tarkibiy farq

HTML **media query ISHLATMAYDI**. Barcha o'lcham bitta
`--phone-w` o'zgaruvchisidan kelib chiqadi:

```css
width: calc(var(--phone-w) * 42 / 390 * 1px);
```

Ya'ni 390px — **referens kenglik**, qolgan hamma narsa unga
proporsional. 360 va 430 shunchaki `--phone-w` ni almashtiradi
(qator **2422**).

Flutter'da bu boshqacha hal qilingan: real `MediaQuery` va moslashuvchan
maket (`Expanded`, `Wrap`, `clamp`). Ya'ni **piksel-ba-piksel bir xillik
kutilmaydi** — kutiladigani: kompozitsiya, ierarxiya va nisbatlar.


---

## 1. Ildiz tokenlari — radius, motion, referens kenglik

**Qator 11–21** (`:root`)

```css
:root{
  --r-pill:100px;
  --r-blob:44px;
  --r-soft:28px;
  --r-gentle:22px;
  --phone-w:390;
  --ease-spring:cubic-bezier(.34,1.4,.5,1);
  --ease-smooth:cubic-bezier(.4,0,.2,1);
  --dur-fast:.25s;
  --dur-med:.45s;
  --dur-slow:.7s;
```

**Flutter'dagi mosligi**

| HTML | Flutter |
|---|---|
| `--r-pill: 100px` | `R.pill` — `shapes.dart` |
| `--r-blob: 44px` | `R.blob` |
| `--r-soft: 28px` | `R.soft` |
| `--r-gentle: 22px` | `R.gentle` |
| `--ease-spring` | `Motion.spring` — `motion.dart` |
| `--ease-smooth` | `Motion.smooth` |
| `--dur-fast/med/slow` | `Motion.fast/med/slow` |


---

## 2. Beshta mavzu — CSS tokenlari

**Qator 24–118** — har mavzu `html[data-theme="..."]` bloki.


### 1 · PEARL / CHAMPAGNE — qator 24–42

```css
/* ============ 1 · PEARL / CHAMPAGNE ============ */
html[data-theme="pearl"]{
  --bg-1:#FAF7F2; --bg-2:#EFE7DA; --bg-vignette:rgba(196,164,124,.14);
  --surface:rgba(253,251,247,.82); --surface-2:rgba(253,251,247,.55); --surface-solid:#FDFBF7;
  --text-1:#2A2A2E; --text-2:#5A5A62; --text-3:#9A9AA2;
  --accent-1:#E0CDA9; --accent-2:#C4A47C; --accent-3:#8E7550;
  --accent-b:#C5D8CB; --accent-b-dark:#6E8A7A;
  --accent-c:#D5CFE4; --accent-c-dark:#8E7FB8;
  --accent-d:#CBDCE8; --accent-d-dark:#6B8FA8;
  --glow:rgba(196,164,124,.35); --glow-b:rgba(159,184,168,.35);
  --shadow-float:0 22px 50px rgba(160,140,110,.16), 0 8px 20px rgba(160,140,110,.08);
  --shadow-soft:0 12px 32px rgba(160,140,110,.10), 0 4px 12px rgba(160,140,110,.06);
  --shadow-tiny:0 4px 12px rgba(160,140,110,.08);
  --border-1:rgba(255,255,255,.95); --border-2:rgba(196,164,124,.22);
  --phone-frame:linear-gradient(150deg,#D9CFBE,#B8A88E);
  --error:#D88A8A; --success:#8FB89A; --warn:#DDB878;
  --ambient-1:rgba(224,205,169,.45); --ambient-2:rgba(197,216,203,.4);
}
```

### 2 · GRAPHITE / PLATINUM — qator 43–61

```css
/* ============ 2 · GRAPHITE / PLATINUM ============ */
html[data-theme="graphite"]{
  --bg-1:#1A1B1F; --bg-2:#0A0B0E; --bg-vignette:rgba(200,200,210,.08);
  --surface:rgba(38,40,46,.72); --surface-2:rgba(38,40,46,.45); --surface-solid:#22232A;
  --text-1:#F0EFEB; --text-2:#B8B8BE; --text-3:#7A7A82;
  --accent-1:#DDDDDE; --accent-2:#BEBEC0; --accent-3:#8E8E92;
  --accent-b:#8FA0B0; --accent-b-dark:#A8BDD0;
  --accent-c:#A8B0C4; --accent-c-dark:#8A94B0;
  --accent-d:#8898A8; --accent-d-dark:#A0B4C4;
  --glow:rgba(220,220,224,.22); --glow-b:rgba(143,160,176,.22);
  --shadow-float:0 22px 50px rgba(0,0,0,.55), 0 8px 20px rgba(0,0,0,.35);
  --shadow-soft:0 12px 32px rgba(0,0,0,.4), 0 4px 12px rgba(0,0,0,.2);
  --shadow-tiny:0 4px 12px rgba(0,0,0,.3);
  --border-1:rgba(255,255,255,.14); --border-2:rgba(200,200,210,.14);
  --phone-frame:linear-gradient(150deg,#2E3038,#14151A);
  --error:#E09494; --success:#94C4A0; --warn:#E0C088;
  --ambient-1:rgba(180,180,190,.14); --ambient-2:rgba(143,160,176,.14);
}
```

### 3 · OCEAN / ICE — qator 62–80

```css
/* ============ 3 · OCEAN / ICE ============ */
html[data-theme="ocean"]{
  --bg-1:#0F1E30; --bg-2:#04101C; --bg-vignette:rgba(111,199,224,.14);
  --surface:rgba(30,54,82,.7); --surface-2:rgba(30,54,82,.45); --surface-solid:#152B44;
  --text-1:#E8F0F8; --text-2:#A8C0D8; --text-3:#6A88A8;
  --accent-1:#A8D8E8; --accent-2:#6FC7E0; --accent-3:#4A8FB0;
  --accent-b:#A8D4C4; --accent-b-dark:#88C0B0;
  --accent-c:#B8C8E8; --accent-c-dark:#8AA4CC;
  --accent-d:#D0E8F4; --accent-d-dark:#A8C8E0;
  --glow:rgba(111,199,224,.3); --glow-b:rgba(168,212,196,.3);
  --shadow-float:0 22px 50px rgba(0,10,25,.6), 0 8px 20px rgba(0,10,25,.4);
  --shadow-soft:0 12px 32px rgba(0,10,25,.45), 0 4px 12px rgba(0,10,25,.25);
  --shadow-tiny:0 4px 12px rgba(0,10,25,.35);
  --border-1:rgba(200,230,255,.15); --border-2:rgba(111,199,224,.2);
  --phone-frame:linear-gradient(150deg,#1E3A5A,#0A1A2E);
  --error:#E09494; --success:#94C4A0; --warn:#E0C088;
  --ambient-1:rgba(111,199,224,.28); --ambient-2:rgba(168,212,196,.22);
}
```

### 4 · AURORA / VIOLET — qator 81–99

```css
/* ============ 4 · AURORA / VIOLET ============ */
html[data-theme="aurora"]{
  --bg-1:#1E1832; --bg-2:#0A0716; --bg-vignette:rgba(184,160,224,.16);
  --surface:rgba(50,38,78,.72); --surface-2:rgba(50,38,78,.45); --surface-solid:#2A2040;
  --text-1:#F4EDF8; --text-2:#C8B8E0; --text-3:#8A7AA8;
  --accent-1:#D5C4EC; --accent-2:#B8A0E0; --accent-3:#8A6FB0;
  --accent-b:#9ED8E0; --accent-b-dark:#7EC0CC;
  --accent-c:#E0B8D8; --accent-c-dark:#C090B8;
  --accent-d:#B8C4E8; --accent-d-dark:#8A9AC8;
  --glow:rgba(184,160,224,.35); --glow-b:rgba(158,216,224,.3);
  --shadow-float:0 22px 50px rgba(10,5,25,.6), 0 8px 20px rgba(10,5,25,.4);
  --shadow-soft:0 12px 32px rgba(10,5,25,.45), 0 4px 12px rgba(10,5,25,.25);
  --shadow-tiny:0 4px 12px rgba(10,5,25,.35);
  --border-1:rgba(220,200,240,.15); --border-2:rgba(184,160,224,.22);
  --phone-frame:linear-gradient(150deg,#3A2E58,#1A1028);
  --error:#E09494; --success:#94C4A0; --warn:#E0C088;
  --ambient-1:rgba(184,160,224,.32); --ambient-2:rgba(158,216,224,.24);
}
```

### 5 · MIDNIGHT NAVY / SOFT GOLD — qator 100–118

```css
/* ============ 5 · MIDNIGHT NAVY / SOFT GOLD ============ */
html[data-theme="midnight"]{
  --bg-1:#0A1428; --bg-2:#050A18; --bg-vignette:rgba(212,179,106,.10);
  --surface:rgba(18,32,54,.72); --surface-2:rgba(18,32,54,.45); --surface-solid:#0F1E38;
  --text-1:#F5EFE2; --text-2:#B8B4A6; --text-3:#6E6A60;
  --accent-1:#E8D4A0; --accent-2:#C9A96A; --accent-3:#8E7340;
  --accent-b:#A8B8C4; --accent-b-dark:#C4D0D8;
  --accent-c:#B8B0C8; --accent-c-dark:#8E88A0;
  --accent-d:#C4C8D0; --accent-d-dark:#9AA0A8;
  --glow:rgba(201,169,106,.32); --glow-b:rgba(168,184,196,.22);
  --shadow-float:0 22px 50px rgba(0,5,15,.7), 0 8px 20px rgba(0,5,15,.5), 0 0 60px rgba(201,169,106,.10);
  --shadow-soft:0 12px 32px rgba(0,5,15,.55), 0 4px 12px rgba(0,5,15,.35);
  --shadow-tiny:0 4px 12px rgba(0,5,15,.4);
  --border-1:rgba(212,179,106,.14); --border-2:rgba(201,169,106,.24);
  --phone-frame:linear-gradient(150deg,#12213A,#050A18);
  --error:#E0A0A0; --success:#A8C4A8; --warn:#E0C088;
  --ambient-1:rgba(201,169,106,.22); --ambient-2:rgba(50,90,140,.24);
}
```

**Flutter'dagi mosligi:** `nfc_tokens.dart` — har bir qiymat shu
bloklardan bir-bir ko'chirilgan. `NfcTokens.pearl`, `.graphite`,
`.ocean`, `.aurora`, `.midnight`.

Tekshirish uchun: `nfc_tokens.dart` dagi `bg1`, `accent2`, `glow`,
`shadowFloat` qiymatlarini shu CSS bilan solishtiring.


---

## 3. Tipografiya

**Qator 119–131** (`BASE`) va alohida `font-family` e'lonlari.

```css
/* ============================================================
   BASE
   ============================================================ */
*{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;}
html,body{
  background:linear-gradient(180deg,#16161a 0%,#08080c 100%);
  color:var(--text-1);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,Inter,Arial,sans-serif;
  min-height:100vh;overflow-x:hidden;
  transition:color var(--dur-slow) var(--ease-smooth);
}
body{display:flex;}
```

### Barcha `font-family` e'lonlari

```
  126    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,Inter,Arial,sans-serif;
  152  .review .switcher button{flex:1;padding:8px 4px;border-radius:9px;border:none;background:transparent;color:#8A8A92;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:.2s;letter-spacing:.2px;}
  155  .review .theme-sw button{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);color:#B8B8BE;font-size:10.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:.2s;text-align:left;}
  237  .bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--text-3);cursor:pointer;padding:8px 0;border:none;background:none;font-family:inherit;transition:color .3s;position:relative;}
  267    cursor:pointer;font-family:inherit;width:100%;
  280    cursor:pointer;font-family:inherit;width:100%;box-shadow:var(--shadow-soft);
  291    color:var(--text-1);font-size:15px;font-family:inherit;
  301  .t-title{font-size:32px;font-weight:500;letter-spacing:-1.2px;color:var(--text-1);line-height:1.08;font-family:Georgia,"Times New Roman",serif;}
  305  .sec-link{font-size:12px;color:var(--accent-3);font-weight:600;letter-spacing:.3px;cursor:pointer;background:none;border:none;font-family:inherit;}
  478    width:100%;text-align:left;font-family:inherit;color:inherit;
  503  .otp-pill{width:48px;height:60px;border-radius:22px;background:var(--surface);backdrop-filter:blur(14px);border:1px solid var(--border-1);box-shadow:inset 0 2px 6px rgba(0,0,0,.06), var(--shadow-tiny);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600;color:var(--text-1);font-family:Georgia,serif;transition:.3s;cursor:text;}
  513  .empty-soft h3{font-size:19px;font-weight:600;color:var(--text-1);font-family:Georgia,serif;letter-spacing:-.3px;}
 1005      <div style="font-size:32px;font-weight:500;letter-spacing:-1px;color:var(--text-1);margin-top:26px;font-family:Georgia,serif;">NFCSTORE</div>
 1018          <div style="font-size:46px;font-weight:500;letter-spacing:-2px;line-height:1.05;color:var(--text-1);font-family:Georgia,serif;">Sizning<br>raqamli<br>identifikatsiyangiz</div>
 1142      <div style="font-size:28px;font-weight:500;letter-spacing:-.8px;color:var(--text-1);font-family:Georgia,serif;">Email tasdiqlandi</div>
 1158    <div style="text-align:center;margin-top:18px;"><button style="background:none;border:none;color:var(--text-2);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;" onclick="nav('${mode==='reg'?'regEmailChange':'loginEmailChange'}')">Emailni o‘zgartirish</button></div>
 1218    <div class="field"><label class="lbl-soft">Bio</label><textarea class="inp-soft" style="height:100px;padding:18px;resize:none;font-family:inherit;"></textarea></div>
 1239          <div style="font-size:22px;font-weight:500;letter-spacing:-.5px;color:var(--text-1);margin-top:4px;font-family:Georgia,serif;">Aziz Karimov</div>
 1258        <div style="font-size:24px;font-weight:500;letter-spacing:-.6px;color:var(--text-1);font-family:Georgia,serif;">Aziz Karimov</div>
 1289      <div style="font-size:22px;font-weight:500;color:var(--text-1);font-family:Georgia,serif;">Aziz Karimov</div>
```

**MUHIM FARQ.** HTML sarlavhalar uchun `Georgia, "Times New Roman",
serif` ishlatadi — bu tizim shrifti va Android'da **yo'q**.

Flutter'da o'rniga paket ichiga qo'shilgan shriftlar:

| Vazifa | Flutter |
|---|---|
| Sarlavha (serif) | **Instrument Serif** |
| Sarlavha, kirill | **Playfair Display** (zaxira) |
| Matn (sans) | **Manrope** |
| NFC ID, narx | **IBM Plex Mono** |

Instrument Serif'da kirill alifbosi yo'q, shuning uchun rus tilidagi
sarlavhalar Playfair'ga tushadi — `typography.dart`,
`AppType.displayFallback`.


---

## 4. Bo'shliq (spacing)

HTML'da alohida spacing shkalasi **yo'q** — qiymatlar joyida
yoziladi (`padding:10px 18px`, `gap:8px`, `margin:8px auto 26px`).

Ekranning yon hoshiyasi **20px** (qator 212):

```css
.screen{
  position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;
  padding:0 calc(var(--phone-w) * 20 / 390 * 1px) calc(var(--phone-w) * 130 / 390 * 1px);
  opacity:0;pointer-events:none;transform:translateY(14px) scale(.985);
  transition:opacity var(--dur-med) var(--ease-smooth), transform .55s var(--ease-spring);
```

**Flutter'da** bu `shapes.dart` dagi `Gap` shkalasiga
normallashtirilgan: `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 26 ·
section 34`, `Gap.screenX = 20`.


---

## 5. Motion va keyframes

**Qator 331–364** (`ANIMATIONS`)

```css
/* ============================================================
   ANIMATIONS
   ============================================================ */
@keyframes floatSoft{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes pulseOrb{0%{transform:scale(.6);opacity:.8}100%{transform:scale(1.6);opacity:0}}
@keyframes waveRipple{0%{transform:scale(.7);opacity:.55}100%{transform:scale(1.9);opacity:0}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes orbit{from{transform:rotate(0) translateX(115px) rotate(0)}to{transform:rotate(360deg) translateX(115px) rotate(-360deg)}}
@keyframes morphBlob{
  0%,100%{border-radius:60% 40% 55% 45% / 50% 60% 40% 50%;}
  25%{border-radius:45% 55% 40% 60% / 60% 45% 55% 40%;}
  50%{border-radius:55% 45% 60% 40% / 45% 55% 45% 55%;}
  75%{border-radius:40% 60% 45% 55% / 55% 40% 60% 45%;}
}
@keyframes ambientDrift{
  0%{transform:translate(-30px,20px) scale(1);}
  33%{transform:translate(20px,-20px) scale(1.06);}
  66%{transform:translate(-10px,30px) scale(.98);}
  100%{transform:translate(-30px,20px) scale(1);}
}
@keyframes confirmationPop{
  0%{transform:scale(.6);opacity:0;}
  60%{transform:scale(1.06);}
  100%{transform:scale(1);opacity:1;}
}
.screen.active > *{animation:fadeInUp .55s var(--ease-spring) both;}

.aurora{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;}
.aurora .blob-a,.aurora .blob-b{position:absolute;filter:blur(40px);}
.aurora .blob-a{width:70%;height:50%;top:-10%;right:-15%;background:radial-gradient(circle,var(--ambient-1),transparent 70%);animation:ambientDrift 14s ease-in-out infinite;}
.aurora .blob-b{width:60%;height:40%;bottom:-10%;left:-15%;background:radial-gradient(circle,var(--ambient-2),transparent 70%);animation:ambientDrift 18s ease-in-out infinite reverse;}
```

**Flutter'dagi mosligi**

| Keyframe | Flutter |
|---|---|
| `breathe` | `NfcOrb` — `_breath` kontrolleri, `Motion.breathe` (5s) |
| `pulseOrb` | `_OrbPainter` — 3 ta halqa, 1/3 siklga surilgan |
| `waveRipple` | shu yerda, skanerlashda 1.5s ga tezlashadi |
| `morphBlob` | `_OrbPainter` — radius burchak bo'ylab ikkita sinus bilan o'zgaradi |
| `ambientDrift` | `backdrop.dart` — `_AmbientPainter`, 22s sikl |
| `fadeInUp` | sahifa o'tishi — `app_theme.dart`, `_FadeScaleTransitions` |
| `shimmer` | `states.dart` — `Skeleton` |
| `confirmationPop` | tasdiq animatsiyasi |
| `floatSoft` | suzuvchi sirtlar |


---

## 6. Kapsula, blob va suzuvchi sirt

**Qator 248–330** (`PRIMITIVES`)

```css
/* ============================================================
   PRIMITIVES
   ============================================================ */
.capsule{
  display:inline-flex;align-items:center;gap:8px;
  padding:10px 18px;border-radius:var(--r-pill);
  background:var(--surface);backdrop-filter:blur(20px);
  border:1px solid var(--border-1);box-shadow:var(--shadow-tiny);
  font-size:12.5px;font-weight:600;color:var(--text-1);
  cursor:pointer;transition:all .3s var(--ease-spring), background var(--dur-slow);
}
.capsule:active{transform:scale(.94);}
.capsule.active{background:linear-gradient(150deg,var(--accent-1),var(--accent-2));color:var(--bg-1);border-color:transparent;box-shadow:0 12px 28px var(--glow);}

.btn-soft{
  height:56px;border-radius:var(--r-pill);border:none;
  background:linear-gradient(150deg,var(--accent-1) 0%, var(--accent-2) 100%);
  color:var(--bg-1);font-size:15px;font-weight:700;letter-spacing:.2px;
  display:flex;align-items:center;justify-content:center;gap:10px;
  cursor:pointer;font-family:inherit;width:100%;
  box-shadow:0 16px 32px var(--glow), inset 0 1px 0 rgba(255,255,255,.4);
  transition:transform .3s var(--ease-spring), background var(--dur-slow);
}
.btn-soft:active{transform:scale(.97);}
.btn-soft.mint{background:linear-gradient(150deg,var(--accent-b),var(--accent-b-dark));color:#fff;box-shadow:0 16px 32px var(--glow-b), inset 0 1px 0 rgba(255,255,255,.4);}
.btn-soft.danger{background:linear-gradient(150deg,#E8B8B8,#D88A8A);color:#fff;box-shadow:0 16px 32px rgba(216,138,138,.32);}
.btn-ghost{
  height:56px;border-radius:var(--r-pill);
  background:var(--surface);backdrop-filter:blur(20px);
  border:1px solid var(--border-1);color:var(--text-1);
  font-size:15px;font-weight:600;
  display:flex;align-items:center;justify-content:center;gap:10px;
  cursor:pointer;font-family:inherit;width:100%;box-shadow:var(--shadow-soft);
  transition:transform .3s var(--ease-spring), background var(--dur-slow);
}
.btn-ghost:active{transform:scale(.97);}
.btn-soft:disabled,.btn-ghost:disabled{opacity:.4;cursor:not-allowed;box-shadow:none;}

.inp-soft{
  width:100%;height:56px;border-radius:var(--r-gentle);padding:0 20px;
  background:var(--surface);backdrop-filter:blur(12px);
  border:1px solid var(--border-1);
  box-shadow:inset 0 2px 8px rgba(0,0,0,.06), var(--shadow-tiny);
  color:var(--text-1);font-size:15px;font-family:inherit;
  outline:none;letter-spacing:.1px;transition:.3s var(--ease-smooth);
}
.inp-soft:focus{background:var(--surface-solid);box-shadow:inset 0 2px 8px rgba(0,0,0,.04), 0 0 0 4px var(--glow), var(--shadow-soft);border-color:var(--accent-2);}
.inp-soft::placeholder{color:var(--text-3);}
.inp-soft.err{box-shadow:inset 0 2px 8px rgba(216,138,138,.08), 0 0 0 4px rgba(216,138,138,.18), var(--shadow-soft);}

.lbl-soft{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text-3);margin-bottom:8px;display:block;padding-left:6px;}
.field{margin-bottom:16px;}

.t-title{font-size:32px;font-weight:500;letter-spacing:-1.2px;color:var(--text-1);line-height:1.08;font-family:Georgia,"Times New Roman",serif;}
.t-sub{font-size:14px;color:var(--text-2);letter-spacing:.1px;margin-top:8px;line-height:1.55;}
.t-section{font-size:13px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:var(--text-3);}
.sec-head{display:flex;align-items:center;justify-content:space-between;margin:26px 0 14px;padding:0 4px;}
.sec-link{font-size:12px;color:var(--accent-3);font-weight:600;letter-spacing:.3px;cursor:pointer;background:none;border:none;font-family:inherit;}

.av-orb{
  width:44px;height:44px;border-radius:50%;
  background:linear-gradient(150deg,var(--accent-1),var(--accent-2));
  display:flex;align-items:center;justify-content:center;
  font-size:15px;font-weight:700;color:var(--bg-1);flex-shrink:0;
  box-shadow:0 8px 20px var(--glow), inset 0 1px 0 rgba(255,255,255,.4);
  position:relative;transition:background var(--dur-slow);
}
.av-orb.b{background:linear-gradient(150deg,var(--accent-b),var(--accent-b-dark));color:#fff;}
.av-orb.c{background:linear-gradient(150deg,var(--accent-c),var(--accent-c-dark));color:#fff;}
.av-orb.d{background:linear-gradient(150deg,var(--accent-d),var(--accent-d-dark));color:#fff;}

.row{display:flex;align-items:center;justify-content:space-between;padding:6px 0 16px;gap:12px;}
.icon-soft{
  width:44px;height:44px;border-radius:50%;
  background:var(--surface);backdrop-filter:blur(20px);
  border:1px solid var(--border-1);
  display:flex;align-items:center;justify-content:center;
  color:var(--text-1);cursor:pointer;flex-shrink:0;box-shadow:var(--shadow-tiny);
  transition:transform .3s var(--ease-spring), background var(--dur-slow);
}
.icon-soft:active{transform:scale(.92);}
.icon-soft svg{width:18px;height:18px;}
```

**Flutter'dagi mosligi**

| HTML | Flutter |
|---|---|
| `.capsule`, `.capsule.active` | `Capsule` — `surfaces.dart` |
| `.capsule:active{transform:scale(.94)}` | `PressableScale` (0.965 asosiy, 0.9 nav markazida) |
| `.btn-soft` va boshqa tugmalar | `NovaButton` — `buttons.dart` |
| `backdrop-filter: blur(20px)` | `FloatingSurface` — `BackdropFilter(blur 18)` |
| `.av-orb`, `.av-orb.b/.c/.d` | `Avatar` + aksent gradientlari |

`FloatingSurface` da `solid: true` parametri bor: uzun ro'yxatlarda
`BackdropFilter` qimmatga tushadi, shuning uchun u yerda shaffoflik
o'chiriladi. HTML'da bunday ajratish yo'q.


---

## 7. NFC orb

**Qator 365–383** (`NFC ORB`)

```css
/* ============================================================
   NFC ORB
   ============================================================ */
.orb-hero{position:relative;margin:8px auto 26px;width:270px;height:270px;display:flex;align-items:center;justify-content:center;}
.orb-hero .halo{position:absolute;inset:-14px;border-radius:50%;background:radial-gradient(circle at 30% 30%, var(--glow), transparent 60%);filter:blur(14px);animation:breathe 5s ease-in-out infinite;}
.orb-hero .blob-shape{
  position:absolute;width:200px;height:200px;
  background:radial-gradient(circle at 32% 28%, rgba(255,255,255,.9), transparent 45%), linear-gradient(150deg,var(--accent-1) 0%, var(--accent-2) 55%, var(--accent-3) 100%);
  animation:morphBlob 12s ease-in-out infinite;
  box-shadow:0 30px 60px var(--glow), 0 15px 30px var(--glow), inset -12px -20px 40px rgba(0,0,0,.12), inset 12px 16px 32px rgba(255,255,255,.3);
  display:flex;align-items:center;justify-content:center;z-index:2;
  transition:background var(--dur-slow);
}
.orb-hero .ring{position:absolute;width:200px;height:200px;border-radius:50%;border:1.5px solid var(--accent-2);opacity:.4;animation:pulseOrb 3.6s ease-out infinite;}
.orb-hero .ring:nth-child(2){animation-delay:1.2s;}
.orb-hero .ring:nth-child(3){animation-delay:2.4s;}
.orb-hero .nfc-mark{position:relative;z-index:3;width:64px;height:64px;display:flex;align-items:center;justify-content:center;color:var(--bg-1);}
.orb-hero .nfc-mark svg{width:100%;height:100%;filter:drop-shadow(0 2px 6px rgba(0,0,0,.15));}
```


### Orbit — NFC Center · qator 384–414

```css
/* ============================================================
   ORBIT — NFC Center
   ============================================================ */
.orbit{position:relative;width:320px;height:320px;margin:8px auto 26px;}
.orbit .center-orb{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:130px;height:130px;
  background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.9), transparent 45%), linear-gradient(150deg,var(--accent-1),var(--accent-2));
  animation:morphBlob 10s ease-in-out infinite, breathe 4s ease-in-out infinite;
  box-shadow:0 24px 50px var(--glow), inset -8px -12px 24px rgba(0,0,0,.1), inset 8px 12px 24px rgba(255,255,255,.3);
  display:flex;align-items:center;justify-content:center;z-index:5;color:var(--bg-1);cursor:pointer;
  transition:transform .3s var(--ease-spring), background var(--dur-slow);
}
.orbit .center-orb:active{transform:translate(-50%,-50%) scale(.95);}
.orbit .center-orb svg{width:48px;height:48px;}
.orbit .wave{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:200px;height:200px;border-radius:50%;border:1.5px solid var(--accent-2);opacity:.5;animation:waveRipple 3.2s ease-out infinite;}
.orbit .wave:nth-child(2){animation-delay:1.06s;}
.orbit .wave:nth-child(3){animation-delay:2.13s;}
.orbit .item{
  position:absolute;top:50%;left:50%;width:56px;height:56px;border-radius:50%;
  background:var(--surface);backdrop-filter:blur(14px);border:1px solid var(--border-1);
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text-1);
  box-shadow:var(--shadow-soft);cursor:pointer;
  animation:orbit 22s linear infinite;margin:-28px 0 0 -28px;
  transition:transform .3s var(--ease-spring);
}
.orbit .item:hover{transform:scale(1.12);}
.orbit .item:nth-of-type(1){animation-delay:0s;background:linear-gradient(150deg,var(--accent-1),var(--accent-2));color:var(--bg-1);}
.orbit .item:nth-of-type(2){animation-delay:-7.33s;background:linear-gradient(150deg,var(--accent-b),var(--accent-b-dark));color:#fff;}
.orbit .item:nth-of-type(3){animation-delay:-14.66s;background:linear-gradient(150deg,var(--accent-c),var(--accent-c-dark));color:#fff;}
```

**Flutter'dagi mosligi:** `nfc_orb.dart`.

Diqqat qilinadigan joy: HTML'da halo, uchta halqa, blob va belgi —
**beshta alohida DOM element**, har biri o'z CSS animatsiyasi bilan.

Flutter'da hammasi **bitta `CustomPainter`** ichida chiziladi va
**bitta** `AnimationController` bilan boshqariladi. Sabab izohda
yozilgan: har halqa alohida widget bo'lganda 4 ta kontroller va 4 ta
layout o'tishi kerak bo'lardi.

Vizual natija bir xil bo'lishi kerak: 3 ta halqa siklning 1/3 qismiga
surilgan, halo nafas bilan kengayadi, yadro doira emas — organik.


---

## 8. Bottom navigation

**Qator 221–247** (`BOTTOM NAV`)

```css
/* ============================================================
   BOTTOM NAV
   ============================================================ */
.bnav{
  position:absolute;bottom:calc(var(--phone-w) * 14 / 390 * 1px);
  left:calc(var(--phone-w) * 16 / 390 * 1px);right:calc(var(--phone-w) * 16 / 390 * 1px);
  height:calc(var(--phone-w) * 72 / 390 * 1px);
  background:var(--surface);backdrop-filter:blur(28px) saturate(160%);
  -webkit-backdrop-filter:blur(28px) saturate(160%);
  border-radius:var(--r-pill);border:1px solid var(--border-1);
  box-shadow:var(--shadow-float);
  display:flex;align-items:center;justify-content:space-around;
  padding:0 calc(var(--phone-w) * 8 / 390 * 1px);z-index:100;
  transition:transform var(--dur-med) var(--ease-spring), background var(--dur-slow), box-shadow var(--dur-slow);
}
.bnav.hidden{transform:translateY(140%);}
.bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;color:var(--text-3);cursor:pointer;padding:8px 0;border:none;background:none;font-family:inherit;transition:color .3s;position:relative;}
.bnav-item svg{width:calc(var(--phone-w) * 21 / 390 * 1px);height:calc(var(--phone-w) * 21 / 390 * 1px);transition:transform .3s var(--ease-spring);}
.bnav-item span{font-size:calc(var(--phone-w) * 9.5 / 390 * 1px);font-weight:600;letter-spacing:.3px;}
.bnav-item.active{color:var(--text-1);}
.bnav-item.active svg{transform:translateY(-1px) scale(1.06);}
.bnav-item.active::before{content:"";position:absolute;top:-4px;left:50%;transform:translateX(-50%);width:calc(var(--phone-w) * 34 / 390 * 1px);height:calc(var(--phone-w) * 34 / 390 * 1px);border-radius:50%;background:radial-gradient(circle,var(--glow),transparent 70%);z-index:-1;}
.bnav-item.center .wrap{width:calc(var(--phone-w) * 52 / 390 * 1px);height:calc(var(--phone-w) * 52 / 390 * 1px);border-radius:50%;background:linear-gradient(150deg,var(--accent-1),var(--accent-2));display:flex;align-items:center;justify-content:center;color:var(--bg-1);margin-top:calc(var(--phone-w) * -22 / 390 * 1px);box-shadow:0 calc(var(--phone-w) * 12 / 390 * 1px) calc(var(--phone-w) * 24 / 390 * 1px) var(--glow), inset 0 1px 0 rgba(255,255,255,.4);transition:transform .3s var(--ease-spring), background var(--dur-slow);}
.bnav-item.center.active .wrap{transform:scale(1.08) translateY(-3px);}
.bnav-item.center svg{width:calc(var(--phone-w) * 24 / 390 * 1px);height:calc(var(--phone-w) * 24 / 390 * 1px);color:var(--bg-1);}
.bnav-item.center.active{color:var(--accent-3);}
```


### `renderBottomNav()` — qator 910–930

```js
function renderBottomNav(active){
  const tabs = [
    {id:'home',label:'Home',icon:I.home},
    {id:'discover',label:'Discover',icon:I.search},
    {id:'reels',label:'Reels',icon:I.reels,center:true},
    {id:'nfc',label:'NFC',icon:I.nfc},
    {id:'profile',label:'Profile',icon:I.user}
  ];
  return tabs.map(t=>`
    <button class="bnav-item ${t.center?'center':''} ${active===t.id?'active':''}" onclick="nav('${t.id}')">
      ${t.center ? `<div class="wrap">${t.icon}</div>` : t.icon}
      <span>${t.label}</span>
    </button>`).join('');
}

let toastT;
function toast(msg, kind){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (kind?' '+kind:'');
  t.classList.add('show');
```

**Flutter'dagi mosligi:** `bottom_nav.dart`.

Markazdagi element ko'tarilgan dumaloq tugma
(`margin-top: -22px` → Flutter'da `Matrix4.translationValues(0,-14,0)`),
aksent gradienti va nur bilan.


---

## 9. Home tuzilishi

**`renderHome()` — qator 1225–1301**

```js
function renderHome(){
  const bubbles = DATA.stories.map((s,i)=>`
    <div class="bub" onclick="openStory(${i})">
      <div class="bub-ring ${s.seen?'seen':''} ${s.you?'you':''} ${s.biz?'biz':''}">
        <div class="bub-inner ${s.biz?'biz':''}">${s.you?'<span style="color:var(--accent-3);font-size:24px;font-weight:400;">+</span>':s.initials}</div>
      </div>
      <div class="bub-name">${s.name}</div>
    </div>`).join('');
  const posts = DATA.posts.map(p=>renderPostCard(p)).join('');
  return `<div class="aurora"><div class="blob-a"></div><div class="blob-b"></div></div>
  <div style="position:relative;z-index:2;">
    <div class="row" style="padding:10px 0 8px;">
      <div>
        <div style="font-size:11px;color:var(--text-3);letter-spacing:1.6px;text-transform:uppercase;font-weight:700;">Xush kelibsiz</div>
        <div style="font-size:22px;font-weight:500;letter-spacing:-.5px;color:var(--text-1);margin-top:4px;font-family:Georgia,serif;">Aziz Karimov</div>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="icon-soft" onclick="nav('activity')" style="position:relative;">${I.bell}
          <span style="position:absolute;top:10px;right:10px;width:8px;height:8px;border-radius:50%;background:var(--accent-2);box-shadow:0 0 0 2px var(--bg-1);"></span>
        </button>
        <button class="icon-soft" onclick="nav('profile')">${BRAND_LOGO(26)}</button>
      </div>
    </div>

    <div class="orb-hero" style="cursor:pointer;" onclick="openSheet(identitySheet())">
      <div class="halo"></div>
      <div class="ring"></div>
      <div class="ring"></div>
      <div class="ring"></div>
      <div class="blob-shape"><div class="nfc-mark">${NFC_MARK(64)}</div></div>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:24px;font-weight:500;letter-spacing:-.6px;color:var(--text-1);font-family:Georgia,serif;">Aziz Karimov</div>
      <div style="font-size:12.5px;color:var(--text-3);margin-top:6px;">${DATA.me.role}</div>
      <div style="margin-top:14px;display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:100px;background:var(--surface-2);border:1px solid var(--border-2);backdrop-filter:blur(14px);">
        <span style="width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 10px var(--success);"></span>
        <span style="font-size:11.5px;font-weight:700;color:var(--accent-3);letter-spacing:1.2px;">${DATA.me.nfcId}</span>
      </div>
    </div>

    <div class="chip-scroll" style="margin-bottom:22px;justify-content:center;">
      <div class="capsule" onclick="openSheet(shareSheet())"><div style="width:16px;height:16px;">${I.share}</div>Share</div>
      <div class="capsule" onclick="nav('nfcScan')"><div style="width:16px;height:16px;">${I.scan}</div>Scan</div>
      <div class="capsule" onclick="nav('nfc')"><div style="width:16px;height:16px;">${I.nfc}</div>NFC</div>
      <div class="capsule" onclick="nav('shop')"><div style="width:16px;height:16px;">${I.bag}</div>Shop</div>
    </div>

    <div class="sec-head" style="margin-top:8px;"><div class="t-section">Stories</div><button class="sec-link" onclick="toast('Barcha stories')">Barchasi</button></div>
    <div class="story-bubbles" style="margin-bottom:24px;">${bubbles}</div>

    <div class="sec-head" style="margin-top:8px;"><div class="t-section">Feed</div><button class="sec-link" onclick="nav('postCreate')">Yangi</button></div>
    ${posts}
  </div>`;
}
function identitySheet(){
  return `
  <div style="text-align:center;padding:8px 0 18px;">
    <div class="orb-hero" style="width:180px;height:180px;margin:0 auto 16px;">
      <div class="halo"></div><div class="ring"></div><div class="ring"></div>
      <div class="blob-shape" style="width:140px;height:140px;">
        <div class="nfc-mark" style="width:48px;height:48px;">${NFC_MARK(48)}</div>
      </div>
    </div>
    <div style="font-size:22px;font-weight:500;color:var(--text-1);font-family:Georgia,serif;">Aziz Karimov</div>
    <div style="font-size:12.5px;color:var(--text-3);margin-top:6px;">${DATA.me.role}</div>
    <div style="margin-top:14px;font-family:Georgia,serif;font-size:14px;letter-spacing:4px;color:var(--accent-3);">${DATA.me.nfcId}</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
    ${[['Telegram',I.send],['QR',I.qr],['Havola',I.globe],['NFC',I.nfc]].map(([l,ic])=>`
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 0;border-radius:22px;background:var(--surface-2);cursor:pointer;" onclick="toast('${l}'); closeSheet();">
        <div style="width:22px;height:22px;color:var(--accent-3);">${ic}</div>
        <div style="font-size:11px;color:var(--accent-3);font-weight:600;">${l}</div>
      </div>`).join('')}
  </div>
  <button class="btn-ghost" onclick="closeSheet()">Yopish</button>`;
}
```

**Flutter'dagi mosligi:** `home_screen.dart` + `identity_card.dart`
+ `mode_switch.dart`.

Tartib bir xil bo'lishi kerak: salomlashuv → rejim almashtirgich →
identity obyekti → tezkor amallar → stories → postlar → harakatlar.


---

## 10. NFC Center tuzilishi

**`renderNFCCenter()` — qator 1594–1639**

```js
function renderNFCCenter(){
  return `<div class="aurora"><div class="blob-a"></div><div class="blob-b"></div></div>
  <div style="position:relative;z-index:2;">
    <div style="padding-top:14px;"></div>
    <div class="t-title">NFC<br>Center</div>
    <div class="t-sub">Sizning identifikatsiya markazingiz.</div>
    <div style="height:20px;"></div>
    <div class="orbit">
      <div class="wave"></div><div class="wave"></div><div class="wave"></div>
      <div class="center-orb" onclick="nav('nfcScan')">${NFC_MARK(48)}</div>
      <div class="item" onclick="nav('nfcID')">AK</div>
      <div class="item" onclick="nav('nfcID')">SR</div>
      <div class="item" onclick="nav('nfcGift')">+</div>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:22px;font-weight:500;color:var(--text-1);font-family:Georgia,serif;">NFC faol</div>
      <div style="font-size:12.5px;color:var(--text-3);margin-top:6px;">Oxirgi skan: 2 daqiqa oldin</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px;">
      <button class="btn-ghost" onclick="nav('nfcScan')" style="height:60px;"><div style="width:20px;height:20px;">${I.scan}</div> Skan</button>
      <button class="btn-soft" onclick="nav('nfcIDs')" style="height:60px;"><div style="width:20px;height:20px;">${I.card}</div> ID lar</button>
    </div>
    <div class="sec-head"><div class="t-section">Mening ID larim</div><button class="sec-link" onclick="nav('nfcIDs')">Barchasi</button></div>
    ${DATA.nfcIDs.map(id=>`
      <div style="padding:22px;border-radius:34px;margin-bottom:12px;cursor:pointer;position:relative;overflow:hidden;
        background:${id.type==='business'?'linear-gradient(150deg,var(--accent-b),var(--accent-b-dark))':'linear-gradient(150deg,var(--accent-1),var(--accent-2))'};
        border:1px solid var(--border-1);box-shadow:var(--shadow-soft);color:${id.type==='business'?'#fff':'var(--bg-1)'};"
        onclick="nav('nfcID')">
        <div style="position:absolute;top:-30%;right:-20%;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.3),transparent 65%);filter:blur(10px);"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;position:relative;z-index:2;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;opacity:.9;">${id.label}</div>
          <div class="pill" style="background:rgba(255,255,255,.25);color:inherit;">Faol</div>
        </div>
        <div style="font-family:Georgia,serif;font-size:16px;font-weight:600;letter-spacing:3px;position:relative;z-index:2;">${id.code}</div>
        <div style="font-size:12.5px;margin-top:8px;opacity:.85;position:relative;z-index:2;">${id.sub}</div>
      </div>`).join('')}
    <div class="sec-head" style="margin-top:20px;"><div class="t-section">Boshqaruv</div></div>
    <div class="list-soft">
      <div class="item" onclick="nav('nfcScan')"><div class="lic-soft">${I.scan}</div><div style="flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text-1);">Skan qilish</div><div style="font-size:11.5px;color:var(--text-3);margin-top:3px;">Kartani tekshirish</div></div><div style="width:18px;height:18px;color:var(--text-3);">${I.chev}</div></div>
      <div class="item" onclick="nav('nfcHistory')"><div class="lic-soft b">${I.clock}</div><div style="flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text-1);">NFC tarixi</div><div style="font-size:11.5px;color:var(--text-3);margin-top:3px;">Skanlar, ulashishlar</div></div><div style="width:18px;height:18px;color:var(--text-3);">${I.chev}</div></div>
      <div class="item" onclick="nav('nfcGift')"><div class="lic-soft c">${I.gift}</div><div style="flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text-1);">Sovg‘a qilish</div><div style="font-size:11.5px;color:var(--text-3);margin-top:3px;">NFC ID do‘stga</div></div><div style="width:18px;height:18px;color:var(--text-3);">${I.chev}</div></div>
      <div class="item" onclick="nav('nfcCard')"><div class="lic-soft d">${I.card}</div><div style="flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text-1);">NFC Karta</div><div style="font-size:11.5px;color:var(--text-3);margin-top:3px;">Metal card</div></div><div style="width:18px;height:18px;color:var(--text-3);">${I.chev}</div></div>
      <div class="item" onclick="nav('nfcSecurity')"><div class="lic-soft c">${I.lock}</div><div style="flex:1;"><div style="font-size:14px;font-weight:600;color:var(--text-1);">Xavfsizlik</div><div style="font-size:11.5px;color:var(--text-3);margin-top:3px;">PIN, bloklash</div></div><div style="width:18px;height:18px;color:var(--text-3);">${I.chev}</div></div>
    </div>
  </div>`;
}
```

**Flutter'dagi mosligi:** `nfc_center_screen.dart`.


---

## 11. Profile tuzilishi

**`renderProfile()` — qator 1790–1856**

```js
function renderProfile(){
  const biz = S.mode === 'business';
  return `<div class="aurora"><div class="blob-a"></div></div>
  <div style="position:relative;z-index:2;">
    <div class="row" style="padding:12px 0 4px;">
      <button class="icon-soft" onclick="nav('settings')">${I.settings}</button>
      <div class="mode-switch" style="margin:0;padding:4px;flex:1;max-width:180px;">
        <div class="m ${!biz?'active':''}" onclick="switchMode('personal')" style="padding:9px;font-size:12px;">Personal</div>
        <div class="m ${biz?'active':''}" onclick="switchMode('business')" style="padding:9px;font-size:12px;">Business</div>
      </div>
      <button class="icon-soft" onclick="openSheet(shareSheet())">${I.share}</button>
    </div>

    <div style="text-align:center;padding:22px 0 8px;">
      <div style="position:relative;display:inline-block;margin-bottom:16px;">
        <div style="width:120px;height:120px;background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.5), transparent 50%), ${biz?'linear-gradient(150deg,var(--accent-b),var(--accent-b-dark))':'linear-gradient(150deg,var(--accent-1),var(--accent-2))'};display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:500;color:${biz?'#fff':'var(--bg-1)'};animation:morphBlob 14s ease-in-out infinite, breathe 5s ease-in-out infinite;box-shadow:0 24px 50px ${biz?'var(--glow-b)':'var(--glow)'}, inset -10px -15px 30px rgba(0,0,0,.1), inset 10px 15px 30px rgba(255,255,255,.3);font-family:Georgia,serif;">
          ${biz?'SR':'AK'}
        </div>
        <div style="position:absolute;bottom:4px;right:4px;width:26px;height:26px;border-radius:50%;background:linear-gradient(150deg,var(--accent-b),var(--accent-b-dark));border:4px solid var(--bg-1);box-shadow:0 4px 12px var(--glow-b);"></div>
      </div>
      <div style="font-size:24px;font-weight:500;letter-spacing:-.6px;color:var(--text-1);font-family:Georgia,serif;">${biz?DATA.biz.name:DATA.me.name} ${biz?'<span style="color:var(--accent-3);">✓</span>':''}</div>
      <div style="font-size:13px;color:var(--text-3);margin-top:6px;">${biz?DATA.biz.category:DATA.me.handle}</div>
      <div style="margin-top:12px;display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:100px;background:var(--surface-2);border:1px solid var(--border-2);backdrop-filter:blur(14px);">
        <span style="width:6px;height:6px;border-radius:50%;background:var(--success);box-shadow:0 0 10px var(--success);"></span>
        <span style="font-size:11px;font-weight:700;color:var(--accent-3);letter-spacing:1.2px;">${biz?DATA.biz.nfcId:DATA.me.nfcId}</span>
      </div>
    </div>

    <!-- Stats — compact -->
    <div style="display:flex;justify-content:space-around;padding:18px 0;margin:20px 0 18px;border-top:1px solid var(--border-1);border-bottom:1px solid var(--border-1);">
      ${[biz?['4.8k','Followers']:['12.4k','Followers'],biz?['12','Mahsulot']:['248','Posts'],biz?['340','Skan']:['312','Following']].map(s=>`
        <div style="text-align:center;">
          <div style="font-size:20px;font-weight:500;color:var(--text-1);font-family:Georgia,serif;letter-spacing:-.4px;">${s[0]}</div>
          <div style="font-size:10px;color:var(--text-3);margin-top:3px;letter-spacing:.8px;text-transform:uppercase;font-weight:700;">${s[1]}</div>
        </div>`).join('')}
    </div>

    <!-- Asymmetric action composition -->
    ${biz ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        <div class="capsule" style="justify-content:center;padding:14px;" onclick="nav('biz')"><div style="width:18px;height:18px;">${I.bag}</div> Storefront</div>
        <div class="capsule active" style="justify-content:center;padding:14px;" onclick="nav('bizDash')"><div style="width:18px;height:18px;">${I.chart}</div> Dashboard</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px;">
        <div class="capsule" style="justify-content:center;padding:12px;font-size:11.5px;" onclick="nav('bizEdit')"><div style="width:16px;height:16px;">${I.edit}</div> Edit</div>
        <div class="capsule" style="justify-content:center;padding:12px;font-size:11.5px;" onclick="nav('bizAnalytics')"><div style="width:16px;height:16px;">${I.chart2}</div> Analytics</div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        <div class="capsule" style="justify-content:center;padding:14px;" onclick="nav('editProfile')"><div style="width:18px;height:18px;">${I.edit}</div> Tahrirlash</div>
        <div class="capsule active" style="justify-content:center;padding:14px;" onclick="nav('nfc')"><div style="width:18px;height:18px;">${I.nfc}</div> NFC ID</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px;">
        <div class="capsule" style="justify-content:center;padding:12px;font-size:11.5px;" onclick="openSheet(shareSheet())"><div style="width:16px;height:16px;">${I.share}</div> Share</div>
        <div class="capsule" style="justify-content:center;padding:12px;font-size:11.5px;" onclick="openSheet(qrSheet())"><div style="width:16px;height:16px;">${I.qr}</div> QR</div>
      </div>
    `}

    <div class="tiles">
      ${[0,1,2,3].map(i=>`
        <div class="tile" onclick="nav('post')" style="aspect-ratio:1;padding:0;overflow:hidden;display:flex;align-items:center;justify-content:center;">
          <div style="color:var(--bg-1);opacity:.9;">${NFC_MARK(56)}</div>
        </div>`).join('')}
    </div>
  </div>`;
}
function switchMode(m){ S.mode = m; nav('profile',{replace:true}); }
```

**Flutter'dagi mosligi:** `profile_screen.dart`.

Talab: bir xil katta to'rtburchak kartalar takrorlanmasin — kapsula,
ixcham plitka, organik shakl va nosimmetrik kompozitsiya.


---

## 12. Responsiv — 360 / 390 / 430

**Telefon karkasi — qator 179–220**

```css
/* ============================================================
   PHONE
   ============================================================ */
.phone{
  width:calc(var(--phone-w) * 1px);
  height:calc(var(--phone-w) * 844 / 390 * 1px);
  background:linear-gradient(180deg,var(--bg-1) 0%,var(--bg-2) 100%);
  border-radius:calc(var(--phone-w) * 46 / 390 * 1px);
  position:relative;overflow:hidden;
  box-shadow:
    0 0 0 calc(var(--phone-w) * 8 / 390 * 1px) var(--phone-frame),
    0 0 0 calc(var(--phone-w) * 9 / 390 * 1px) rgba(0,0,0,.3),
    calc(var(--phone-w) * 50 / 390 * 1px) calc(var(--phone-w) * 100 / 390 * 1px) calc(var(--phone-w) * 120 / 390 * 1px) rgba(0,0,0,.55),
    0 0 calc(var(--phone-w) * 180 / 390 * 1px) var(--glow);
  flex-shrink:0;
  transition:width .5s var(--ease-smooth), height .5s var(--ease-smooth), border-radius .5s var(--ease-smooth), background var(--dur-slow), box-shadow var(--dur-slow);
}
.phone::before{
  content:"";position:absolute;inset:0;pointer-events:none;z-index:1;
  background:radial-gradient(120% 80% at 50% 0%, var(--bg-vignette), transparent 60%);
}
.statusbar{
  height:calc(var(--phone-w) * 42 / 390 * 1px);
  display:flex;align-items:flex-end;justify-content:space-between;
  padding:0 calc(var(--phone-w) * 26 / 390 * 1px) calc(var(--phone-w) * 6 / 390 * 1px) calc(var(--phone-w) * 30 / 390 * 1px);
  font-size:calc(var(--phone-w) * 12.5 / 390 * 1px);
  font-weight:600;color:var(--text-1);position:relative;z-index:150;
}
.status-right{display:flex;align-items:center;gap:calc(var(--phone-w) * 5 / 390 * 1px);}
.status-right svg{width:calc(var(--phone-w) * 16 / 390 * 1px);height:auto;}
.viewport{position:absolute;top:calc(var(--phone-w) * 42 / 390 * 1px);left:0;right:0;bottom:0;overflow:hidden;z-index:2;}
.screen{
  position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;
  padding:0 calc(var(--phone-w) * 20 / 390 * 1px) calc(var(--phone-w) * 130 / 390 * 1px);
  opacity:0;pointer-events:none;transform:translateY(14px) scale(.985);
  transition:opacity var(--dur-med) var(--ease-smooth), transform .55s var(--ease-spring);
  scrollbar-width:none;
}
.screen::-webkit-scrollbar{display:none;}
.screen.active{opacity:1;pointer-events:auto;transform:translateY(0) scale(1);}
.screen.fullbleed{padding:0;}
```


### Kenglikni almashtirish — qator 2419–2424

```js
function setDevice(w){
  S.device = w;
  document.documentElement.setAttribute('data-device', String(w));
  document.documentElement.style.setProperty('--phone-w', String(w));
  document.querySelectorAll('.review #deviceSw button').forEach(b=>b.classList.toggle('active', parseInt(b.dataset.dev) === w));
}
```

**Bu audit uchun eng muhim farq.**

HTML har o'lchamni `calc(var(--phone-w) * N / 390 * 1px)` bilan
**chiziqli** kattalashtiradi: 430px da hamma narsa — matn, ikonka,
hoshiya — 10% kattaroq bo'ladi.

Flutter'da bunday qilinmagan va **ataylab**: real telefonda matn
o'lchami tizim sozlamasidan keladi, hoshiya esa barmoq uchun
qulayligicha qoladi. O'rniga:

* hoshiya doimiy (`Gap.screenX = 20`);
* matn o'lchami doimiy, lekin `textScaler` 0.85–1.3 oralig'ida
  cheklangan;
* orb va hero ekran kengligidan hisoblanadi, lekin `clamp` bilan
  (`(width * .92).clamp(300, 400)`);
* kartalar `Expanded` / `Wrap` bilan cho'ziladi.

Ya'ni 430px da **ko'proq kontent ko'rinadi**, hammasi kattayib
ketmaydi. Solishtirishda shuni hisobga oling:
`responsive-*-360/390/430.png`.

