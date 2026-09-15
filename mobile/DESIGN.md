# NFCSTORE — dizayn tizimi (kodga qo'llanma)

Yo'nalish: **"Yorug' metall, jonli chuqurlik"**. Bu hujjat
`lib/design/` dagi tizimning API'si. Ekran yozayotganda shu yerdagi
komponentlardan foydalaning — yangi rang, o'lcham yoki animatsiya
qiymatini ekran ichida yozmang.

---

## 1. Qat'iy qoidalar

1. **`package:flutter/widgets.dart`** import qilinadi. `material.dart`
   faqat `RefreshIndicator`, `showModalBottomSheet`, `TextField` kabi
   aniq bir element uchun `show` bilan olinadi. `Scaffold`
   ISHLATILMAYDI — Material qatlami `app.dart` da bir marta qo'yilgan.
2. **Ekranda bitta `PrimaryButton`.** Qolgan amallar `SecondaryButton`
   yoki `GhostButton`.
3. **Bosish maydoni ≥ 48 dp.** `Press(minSize: S.tap)` buni o'zi
   ta'minlaydi.
4. **Holat faqat rang bilan bildirilmaydi** — belgi va matn ham
   bo'ladi (`StatusChip` shunday qilingan).
5. **Matn `tr('...')` orqali.** Yangi satr qo'shsangiz uni
   `tool/l10n.json` ga ham qo'shing va `python3 tool/l10n_build.py`
   ishga tushiring.
6. **`const` bo'lmasligi mumkin.** `C.accent`, `T.eyebrow`, `tr()`
   o'qigan widget `const` bo'la olmaydi — mavzu va til shu orqali
   almashadi.
7. **Tarjima qilingan ro'yxat `static final` bo'lmaydi** — getter yoki
   funksiya qiling, aks holda til almashganda muzlab qoladi.
8. **Narx jadvali mijozda yozilmaydi.** Narx har doim serverdan
   kelgan obyektdan olinadi (`Record.price`).
9. **To'lov muvaffaqiyatini faqat server tasdiqlaydi.** Provayderdan
   qaytishning o'zi hech narsani bildirmaydi.

---

## 2. Ekran skeleti

```dart
ScreenBackdrop(
  aura: Aura.home,          // har ekranning o'z yorug'ligi
  child: SafeArea(
    bottom: false,
    child: CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: TopBar(title: '...')),
        // ...
        // Tab ekranlarida oxirida:
        SliverToBoxAdapter(child: SizedBox(height: NavBar.inset(context))),
      ],
    ),
  ),
)
```

**Aura presetlari** (`design/components/backdrop.dart`):

| Preset | Qayerda | Yorug'lik |
|---|---|---|
| `Aura.home` | Bosh sahifa | tepadan iliq oltin + o'ngdan amber |
| `Aura.nfc` | NFC markazi, skanerlash, yozish | markazdan + pastdan platina (sovuq) |
| `Aura.search` | Qidiruv, Kashfiyot | tepa-chapdan sovuq |
| `Aura.reels` | Reels | pastdan |
| `Aura.center` | To'lov, muvaffaqiyat | markazdan |
| `Aura.spotlight` | ID katalogi, ID tafsiloti | tepadan to'g'ridan (karta ustiga) |
| `Aura.profile` | Ochiq profil | ism atrofida yumshoq |
| `Aura.none` | Forma, sozlamalar | nur yo'q, sokin |

---

## 3. Tokenlar

`design/tokens.dart`

**Rang** — `C.`
`bg` · `bgTop` · `bgMid` · `bgCool` · `backdrop` · `surface` ·
`surfaceHigh` · `glass` · `ink` (asosiy matn) · `ink2` (tana matni) ·
`ink3` (meta) · `onAccent` (oltin ustidagi matn) · `line` ·
`lineStrong` · `lineCool` · `accent` · `accentHigh` · `accentDeep` ·
`accentSecondary` · `platinum` (neytral metall `#C9CCD2`) ·
`cool` (sovuq ko'k `#9CC1EE`) · `ok` · `fail` · `warn` ·
`payme` · `click` · `telegram` · `whatsapp`

`platinum` va `cool` ALMASHTIRILMAYDI: platina kulrang metall
(NFC tabi, texnik urg'u), `cool` esa aniq ko'k — sovuq ekranlarning
ambient nuri va oltin ustunga TEGISHLI BO'LMAGAN izohlar uchun.
To'q fonda 10% shaffoflikda platina kulrang bo'lib yo'qoladi,
`cool` esa ko'k bo'lib qoladi.

**Gradient** — `C.screenBase` · `screenBaseCool` · `raisedSurface` ·
`glassSurface` · `actionFace` · `accentText` · `medallion` ·
`storyRing` · `reelsRing` · `bottomScrim` · `navBar` · `sweep`

**Soya** — `C.e1` · `e2` · `e3` · `sheetShadow` · `metalShadow` ·
`actionGlow` · `rimGlow`

**Masofa** — `S.x4 x8 x12 x16 x20 x24 x32 x44`, `S.gutter` (22),
`S.tap` (48)

**Radius** — `R.status` 9 · `chip` 11 · `tile` 14 · `input` 16 ·
`button` 16 · `card` 18 · `hero` 22 · `sheet` 30 · `metalCard` 20

**Harakat** — `M.press` 120 · `fade` 200 · `image` 240 · `push` 280 ·
`sheet` 280 · `theme` 420 · `flip` 720 · `like` 220 · `sweep` 4.2 s ·
`ring` 9 s · `wave` 1.6 s · `M.curve` · `M.spring` · `M.shift` (8 dp)

`reduceMotion(context)` — takrorlanuvchi animatsiyalarni o'chirish.

**Tarif** — `Tier.{free,bronze,silver,gold,premium,exclusive}`,
`TierStyle.of(tier)` → `label` · `base` · `surface` (katta metall
yuza) · `swatch` (kichik namuna) · `edge` · `doubleEdge` ·
`hasMaterial`. `TierStyle.parse(serverTier)`.

---

## 4. Tipografika

`design/type.dart` — `T.`

| Uslub | Shrift | Qayerda |
|---|---|---|
| `display` 46 | Serif | onboarding, hero |
| `title` 34 | Serif | ekran sarlavhasi |
| `titleSm` 27 | Serif | forma sarlavhasi |
| `section` 22 | Serif | bo'lim sarlavhasi |
| `profileName` 30 | Serif | profil ismi |
| `price` 42 | Serif | katta narx |
| `h1` 26 / `h2` 21 | Manrope 800 | sheet sarlavhasi |
| `cardTitle` 15.5 | Manrope 700 | karta va qator sarlavhasi |
| `body` 15/1.55 | Manrope 400 | tana matni |
| `bodyStrong` 15 | Manrope 500 | asosiy qiymat |
| `caption` 13 | Manrope 400 | izoh |
| `label` 11 | Manrope 700 | forma yorlig'i (KATTA HARF) |
| `button` 16.5 / `buttonSm` 13.5 | Manrope 700 | tugma |
| `navLabel` 10.5 | Manrope 600 | tab yorlig'i |
| `statValue` 21 | Mono 600 | statistika soni |
| `statLabel` 10.5 | Manrope 600 | statistika yorlig'i |
| `meta` 11.5 | Mono 500 | sana, holat |
| `amount` 15 | Mono 600 | summa |
| `statusLabel` 11 | Mono 600 | "TAYYOR · TEGIZING" |
| `eyebrow` 10.5 | Mono 500, oltin | bo'lim ustidagi yozuv |
| `wordmark` | Mono 600 | NFCSTORE |
| `code(size)` | Mono 600 | ID kodi |
| `link` 12 | Mono 400 | profil havolasi |

Yordamchilar: `som(149000)` → `149 000`, `compact(12400)` → `12.4k`.

Sana: `lib/l10n/dates.dart` — `monthDay`, `shortDate`, `dateTime`,
`clock`, `ago`, `remaining`.

---

## 5. Komponentlar

### Tugmalar — `components/buttons.dart`
```dart
PrimaryButton(label, {onTap, loading, icon, size: BtnSize.l, expand: true, sweep: true})
SecondaryButton(label, {onTap, icon, size, expand, loading})
GhostButton(label, {onTap, icon, size: BtnSize.m, expand: false, color})
DangerButton(label, {onTap, loading, filled: false, size, expand})
RoundButton(Ico, {onTap, size: 44, iconSize: 18, color, glass, accent, badge})
Spinner({size: 18, color, stroke: 2})
```
`BtnSize.l` 54 dp · `m` 46 · `s` 38.

### Yuzalar — `components/surface.dart`
```dart
Surface({child, padding, radius, gradient, color, border, shadow, glow, onTap})
GlassPanel({child, radius, blur, padding, border, borderColor, tint})
Eyebrow(text, {color})
SectionHeader(title, {actionLabel, onAction, trailing})
FilterChip(label, {active, onTap})
StatusChip(label, {tone: StatusTone.{ok,pending,fail,neutral,accent}})
VerifiedBadge({size})
StatTile({value, label, onTap, accent})
StatRow({tiles})
ListRow({title, subtitle, leading, trailing, onTap, chevron, danger})
RowGroup({children})   // ListRow'larni bitta kartaga yig'adi
RowDivider({indent})
AccentRule({width})
```

### Maydonlar — `components/input.dart`
```dart
Field({label, controller, hint, helper, error, obscure, keyboardType,
       textInputAction, inputFormatters, maxLength, maxLines, enabled,
       autofocus, prefix, suffix, onChanged, onSubmitted, counter})
CodeField({controller, length: 6, hasError, autofocus, onCompleted, onChanged})
SearchField({controller, hint, onChanged, onSubmitted, autofocus})
Toggle({value, onChanged, tone})
CheckBox({value, onChanged, label, size})
```
Klaviatura turini HAR DOIM bering: telefon → `TextInputType.phone`,
email → `emailAddress`, kod → `number`.

### Media — `components/media.dart`, `story_ring.dart`, `identity_card.dart`
```dart
NetImage(url, {radius, fit, width, height, cacheWidth, slotIcon})
MediaSlot({radius, icon, label, width, height})
Avatar({url, name, size, square})      // biznes logotipi square: true
StoryRing({avatarUrl, name, size, seen, reels, addButton, showLabel, onTap})
IdentityCard({code, tier, holder, url, onTap, flippable, sweep, aspect})
MiniIdCard({code, tier, onTap, active, width})
TierDot(tier, {size})
BrandMark({size, ring, glow})          // dumaloq logotip medalyoni
Wordmark({size, color})
MetalText(text, {style, gradient, maxLines, overflow, textAlign})
LightSweep({child, radius, enabled, opacity, period})
```

### Tepa va past — `components/top_bar.dart`, `nav_bar.dart`
```dart
TopBar({title, center, trailing, leading, showBack, onBack})
ScreenTitle(title, {subtitle, eyebrow, trailing})   // katta serif sarlavha
StickyBar({child, padding})                         // yopishgan pastki panel
StickyBar.inset(context)                            // ro'yxat oxiriga joy
NavBar.inset(context)                               // tab ekranlarida
```

### Oyna va toast — `components/sheet.dart`, `toast.dart`
```dart
showSheet<T>(context, {title, subtitle, child, dismissible})
showError(context, message)
confirmSheet(context, {title, message, confirmLabel, cancelLabel, danger})
SheetAction({label, icon, onTap, danger, subtitle})
showToast(context, message, {tone, actionLabel, onAction, duration})
showUndoToast(context, message, {onUndo, label})
```

### Holatlar — `components/states.dart`, `skeleton.dart`
```dart
EmptyState(message, {title, icon, actionLabel, onAction, compact})
ErrorState(message, {onRetry, icon})
OfflineBar({text})
AsyncView<T>({loading, error, data, builder, skeleton, emptyMessage,
              emptyTitle, emptyIcon, emptyAction, onEmptyAction,
              onRetry, isEmpty})
humanError(e)   // backend kalitini o'zbekcha jumlaga aylantiradi
Skeleton({width, height, radius, circle})
SkeletonRow({avatar})  SkeletonCard({aspect, radius})
SkeletonGrid({count, columns})  SkeletonStories({count})
```

### Navigatsiya — `design/nav.dart`
```dart
push<T>(context, (_) => Screen())      // 280 ms fade + 8 dp
```
`Navigator.push(MaterialPageRoute(...))` ISHLATILMAYDI.

### Ikonkalar — `components/icons.dart`
`NIcon(Ico.x, {size, color, filled})`. Mavjud glyphlar `Ico` enumida:
navigatsiya, amal, NFC/ID, kontent, aloqa, holat guruhlari.

---

## 6. Ma'lumot qatlami — TEGILMAYDI

`lib/data/` va `lib/state/` o'zgarmaydi. Ekranlar quyidagicha
murojaat qiladi:

```dart
final state = AppScope.of(context);     // obuna bo'ladi
final state = AppScope.read(context);   // obuna bo'lmaydi
state.repo.record(code)                 // Repo — 78 endpoint
state.active                            // Identity? (faol shaxs)
state.ownsRecord(code) / ownsCompany(id)
AppPrefsScope.of(context)               // mavzu va til
AppLockScope.of(context)                // PIN / biometrika
```

Yuklash naqshi:

```dart
bool _loading = true; Object? _error; T? _data;

Future<void> _load() async {
  setState(() { _loading = true; _error = null; });
  try {
    final d = await repo.something();
    if (!mounted) return;
    setState(() { _data = d; _loading = false; });
  } catch (e) {
    if (!mounted) return;
    setState(() { _error = e; _loading = false; });
  }
}
```

Keshdagi ma'lumot bo'lsa u EKRANDA QOLADI — yuklanish uni
almashtirmaydi (`AsyncView` shunday ishlaydi). Bo'sh oq ekran
hech qayerda bo'lmasin.

---

## 7. Serverda yo'q narsalar — chizmang

- **Izoh (comment)** tizimi yo'q. Faqat layk soni ko'rsatiladi.
- **Story ko'ruvchilar ro'yxati** yo'q — faqat `viewCount`.
- **Sovg'a tabrik matni** yo'q — `POST /gift` faqat `toCode` oladi.
- **Bildirishnoma (push)** yo'q.
- **FAQ va reyting** uchun alohida endpoint yo'q.
- **Narx jadvali** endpointi yo'q — narx obyektdan olinadi.
- **Grafik kalit** (pattern lock) yo'q — PIN va biometrika bor.
