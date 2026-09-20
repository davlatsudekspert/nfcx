import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';

/// Suratning o'z fon rangi.
///
/// Surat bir kadr kechikib yuklansa, orqada QORA emas, aynan
/// o'sha krem turadi — ya'ni ochilishda qora miltillash bo'lmaydi.
const kHeroCream = Color(0xFFF3EADC);

/// ILOVANI BIRINCHI OCHGANDAGI EKRAN.
///
/// ## MATN NIMA UCHUN RASMDA EMAS
///
/// Berilgan surat 941x1672, ya'ni nisbati 0.563. Telefon ekrani
/// esa ancha tor: 390x844 → 0.462, 360x800 → 0.450. `BoxFit.cover`
/// balandlik bo'yicha o'lchaydi va YON TOMONLARNI kesadi.
///
/// O'lchandi: 390x844 da har yondan 84px, 360x800 da 94px
/// kesiladi. Suratdagi yozuv esa x=103 dan x=849 gacha turardi —
/// ya'ni 360x800 da u ALLAQACHON kesilardi, 390x844 da esa atigi
/// 19px zaxira qolardi. Biroz boshqacha nisbatdagi telefonda
/// (masalan 360x880) u ham yetmaydi.
///
/// Shuning uchun yozuv suratdan olib tashlandi (uning o'rni toza
/// qatorlardan qayta qurildi) va bu yerda FLUTTER chizadi. Yutuq
/// uchta: hech qachon kesilmaydi, har qanday ekran zichligida
/// tiniq chiqadi va tarjima qilinadi.
///
/// ## RANG: SURAT QAT'IY, MATN ESA MAVZUDAN
///
/// Bu ikkisi zid ko'rinadi: surat doim krem va oltin, mavzu esa
/// qora bo'lishi mumkin. Matn to'g'ridan-to'g'ri mavzudan olinsa,
/// "midnight" tanlangan telefonda oq yozuv krem fon ustiga
/// tushib, umuman o'qilmasdi.
///
/// Yechim — MAVZU RANGIDAGI PARDA. Matn va tugmalar
/// `context.tokens` dan keladi, ularning ORQASIGA esa o'sha
/// mavzuning fon rangi yumshoq gradient bo'lib qo'yiladi:
///
///   * ochiq mavzuda parda krem — surat bilan qo'shilib ketadi;
///   * qorong'i mavzuda parda to'q — matn oq rangda o'qiladi va
///     suratning O'RTASI (karta va qo'l) ochiq qoladi.
///
/// Ya'ni surat hech qachon bo'yalmaydi; faqat matn turadigan
/// tepa va past qismi mavzuga moslanadi.
///
/// ## ANIMATSIYA
///
/// Bitta 5 soniyalik kontroller, hamma qatlam o'shanga ulangan:
/// NFC belgisining yorug'ligi nafas oladi, ekran bo'ylab juda
/// mayin nur o'tadi, surat 1.5px suziydi. Keskin zoom, silkinish
/// yoki tez o'tish yo'q.
///
/// Tizimda "animatsiyani kamaytirish" yoqilgan bo'lsa harakat
/// UMUMAN bo'lmaydi — ekran tinch suratga aylanadi.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  static const _asset = 'assets/welcome/nfc_hero.jpg';

  /// NFC belgisining suratdagi o'rni — yorug'lik aynan shu yerda
  /// nafas oladi.
  static const _nfcSpot = Alignment(0.10, 0.08);

  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(seconds: 5))
      ..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final still = MediaQuery.disableAnimationsOf(context);
    final w = MediaQuery.sizeOf(context).width;

    return Scaffold(
      backgroundColor: kHeroCream,
      body: AnimatedBuilder(
        animation: _c,
        // MATN VA TUGMALAR HAR KADRDA QAYTA QURILMAYDI.
        //
        // `AnimatedBuilder` o'z `builder` ini soniyasiga 60 marta
        // chaqiradi. Matn, tugmalar va `SafeArea` shu ichida
        // qolsa, ular ham 60 marta qaytadan quriladi — harakat
        // "plaviy" bo'lmay, sekin telefonlarda kadr tushirardi.
        //
        // `child` esa BIR MARTA quriladi va har kadrda o'zgarmay
        // uzatiladi. Harakat qiladigan qatlamlargina qayta
        // chiziladi.
        child: _Foreground(
          headline: l.welcomeHeadline,
          subtitle: l.welcomeSubtitle,
          start: l.welcomeStart,
          login: l.welcomeLogin,
          tokens: t,
          headlineSize: (w * .062).clamp(19.0, 25.0),
        ),
        builder: (context, child) {
          final p = still ? 0.0 : _c.value;
          // Sinus — boshi va oxiri bir xil, ya'ni halqa ulanganda
          // sakrash bo'lmaydi.
          final breathe = math.sin(p * 2 * math.pi);

          return Stack(
            fit: StackFit.expand,
            children: [
              // 1. SURAT — BUTUN EKRAN.
              //
              // `BoxFit.cover` qaysi nisbatdagi ekranda ham to'liq
              // qoplaydi: pastda ham, tepada ham bo'sh joy
              // qolmaydi. Suzish uchun quti har tomondan 2px
              // kattaroq — aks holda siljiganda chetda ingichka
              // bo'shliq ochilardi.
              Positioned(
                left: -2,
                right: -2,
                top: -2 + breathe * 1.5,
                bottom: -2 - breathe * 1.5,
                child: Image.asset(
                  _asset,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      const ColoredBox(color: kHeroCream),
                ),
              ),

              // 2. NFC BELGISI NAFAS OLADI.
              if (!still)
                Positioned.fill(
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          center: _nfcSpot,
                          radius: 0.34,
                          colors: [
                            const Color(0xFFFFF3D6).withValues(
                                alpha: .10 + .13 * (breathe + 1) / 2),
                            const Color(0x00FFF3D6),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

              // 3. EKRAN BO'YLAB MAYIN NUR.
              if (!still)
                Positioned.fill(child: IgnorePointer(child: _Sweep(p))),

              // 4. MAVZU RANGIDAGI PARDA — matn o'qilishi uchun.
              //
              // Surat O'RTADA tegilmaydi: parda faqat tepa va
              // pastdan, yumshoq gradient bilan keladi.
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          t.bg1.withValues(alpha: t.isDark ? .88 : .72),
                          t.bg1.withValues(alpha: t.isDark ? .34 : .12),
                          const Color(0x00000000),
                          const Color(0x00000000),
                          t.bg1.withValues(alpha: t.isDark ? .52 : .30),
                          t.bg1.withValues(alpha: t.isDark ? .94 : .86),
                        ],
                        stops: const [0.0, 0.20, 0.36, 0.56, 0.78, 1.0],
                      ),
                    ),
                  ),
                ),
              ),

              // 5. MATN VA TUGMALAR — yuqoridagi `child`.
              child!,
            ],
          );
        },
      ),
    );
  }
}

/// Harakatsiz oldingi qatlam: sarlavha, ajratgich va tugmalar.
///
/// `AnimatedBuilder` ning `child` i sifatida BIR MARTA quriladi.
class _Foreground extends StatelessWidget {
  const _Foreground({
    required this.headline,
    required this.subtitle,
    required this.start,
    required this.login,
    required this.tokens,
    required this.headlineSize,
  });

  final String headline;
  final String subtitle;
  final String start;
  final String login;
  final NfcTokens tokens;
  final double headlineSize;

  @override
  Widget build(BuildContext context) {
    final t = tokens;
    return SafeArea(
      child: Padding(
        padding:
            const EdgeInsets.fromLTRB(Gap.xxl, Gap.lg, Gap.xxl, Gap.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: Gap.sm),
            Text(
              headline,
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    color: t.text1,
                    height: 1.18,
                    // Kichikroq: sarlavha suratni bosib qo'ymasligi
                    // kerak — asosiy obyekt karta.
                    fontSize: headlineSize,
                  ),
            ),
            const SizedBox(height: Gap.md),
            _Rule(tone: t.accent2),
            const Spacer(),
            Text(
              subtitle,
              style:
                  Theme.of(context).textTheme.bodySmall?.copyWith(color: t.text2),
            ),
            const SizedBox(height: Gap.lg),
            NovaButton(
              label: start,
              onPressed: () => context.push(Routes.register),
            ),
            const SizedBox(height: Gap.sm),
            NovaButton(
              label: login,
              tone: ButtonTone.quiet,
              onPressed: () => context.push(Routes.login),
            ),
          ],
        ),
      ),
    );
  }
}

/// Nozik ajratgich — suratdagi oltin chiziq bilan bir tilda,
/// lekin rangi MAVZUDAN.
class _Rule extends StatelessWidget {
  const _Rule({required this.tone});

  final Color tone;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 104,
      child: Row(
        children: [
          Expanded(
            child: Container(height: 1, color: tone.withValues(alpha: .55)),
          ),
          const SizedBox(width: 6),
          Container(
            width: 4,
            height: 4,
            decoration: BoxDecoration(shape: BoxShape.circle, color: tone),
          ),
        ],
      ),
    );
  }
}

/// Ekran bo'ylab o'tadigan juda mayin nur.
///
/// Halqaning FAQAT bir qismida ko'rinadi: nur o'tib bo'lgach uzoq
/// tinchlik bo'ladi, aks holda u bezovta qilardi.
class _Sweep extends StatelessWidget {
  const _Sweep(this.progress);

  final double progress;

  @override
  Widget build(BuildContext context) {
    const start = 0.10, end = 0.62;
    if (progress < start || progress > end) return const SizedBox.shrink();
    final k = (progress - start) / (end - start);

    // Chetlarda so'nadi: paydo bo'lishi ham, yo'qolishi ham
    // sezilmasin.
    final fade = math.sin(k * math.pi);

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment(-1.8 + k * 3.6, -1),
          end: Alignment(-1.0 + k * 3.6, 1),
          colors: [
            const Color(0x00FFFFFF),
            Colors.white.withValues(alpha: .16 * fade),
            const Color(0x00FFFFFF),
          ],
          stops: const [0.0, 0.5, 1.0],
        ),
      ),
    );
  }
}
