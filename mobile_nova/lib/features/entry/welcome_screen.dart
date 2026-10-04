import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../settings/language_picker.dart';

import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import 'nfc_card_3d.dart';

/// ILOVANI BIRINCHI OCHGANDAGI EKRAN.
///
/// ## TUZILISH: TEPADA VIZUAL, PASTDA MATN
///
/// Ilgari surat butun ekranni `BoxFit.cover` bilan qoplardi va
/// matn uning USTIGA tushardi. Bunda ikki muammo bor edi: surat
/// yon tomonlaridan kesilardi (nisbati telefonnikidan keng), va
/// matn o'qilishi uchun butun ekranga parda tortishga to'g'ri
/// kelardi — ya'ni surat o'zi xiralashardi.
///
/// Endi ekran ikkiga bo'lingan:
///
///   * TEPA — vizual (aylanadigan NFCSTORE kartasi). Karta
///     `BoxFit.contain` bilan to'liq ko'rinadi — hech narsa kesilmaydi.
///   * PAST — sarlavha, tavsif va ikkita tugma. Ular suratning
///     ostida, o'z fonida turadi — parda kerak emas, matn har
///     qanday mavzuda toza o'qiladi.
///
/// Tugmalar suratning ostida, ya'ni vizual ularga HECH QACHON
/// xalaqit bermaydi. `welcome_screen_test.dart` buni har bir
/// ekran o'lchamida o'lchab tekshiradi.
///
/// ## VIZUAL: AYLANADIGAN NFCSTORE KARTASI (2026-09-28)
///
/// Ilgari bu yerda statik surat (`nfc_hero.webp`, 310 KB) turardi.
/// Egasi: "GIF'ga o'xshagan bo'lsin — NFC karta NFCSTORE aylanib
/// tursin, 3D". Endi [NfcCard3D]: metall kartaning haqiqiy old va
/// orqa dizayni perspektiva bilan aylanadi, orqada NFC to'lqinlari,
/// ostida soya. Rasmlar FONSIZ (alfa) — har qanday mavzuda turadi.
///
/// ## RANG: MATN DOIM MAVZUDAN
///
/// Hech bir rang qat'iy yozilmagan — hammasi `context.tokens`
/// dan. "midnight" da oq yozuv qora fonda, "pearl" da to'q yozuv
/// och fonda o'qiladi. Buni test o'lchaydi (yorqinliklar
/// solishtiriladi).
///
/// ## ANIMATSIYA
///
/// Bitta 10 soniyalik kontroller: karta old → orqa → old aylanadi,
/// oltin nur nafas oladi, to'lqinlar tarqaladi. Keskin zoom yoki
/// silkinish yo'q. Tizimda "animatsiyani kamaytirish" yoqilgan
/// bo'lsa harakat UMUMAN bo'lmaydi — karta qiya holda turadi.
class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(seconds: 10))
      ..repeat();
    // BIRINCHI OCHILISH: til hali tanlanmagan bo'lsa — avval til
    // (telefon tiliga mos variant belgilangan). Boshqa ekran yo'q.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!ref.read(localeProvider.notifier).chosen) {
        showLanguageSheet(context, ref, firstLaunch: true);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Orqa tomon birinchi burilishda "miltillamasin" — oldindan.
    precacheImage(const AssetImage(NfcCard3D.back), context);
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
      backgroundColor: t.bg1,
      body: DecoratedBox(
        // Mavzuning o'z foni — surat aynan shu ustida turadi.
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [t.bg2, t.bg1],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // ── BREND YOZUVI ──────────────────────────────────
              //
              // PREMIUM (egasi, 2026-09-24: "ilovaga kirishni ham
              // chiroyli qil"). Asosiy sahifa sarlavhasidagi kabi
              // siyrak NFCSTORE yozuvi, ikki yonida champagne chiziq.
              // Rasm EMAS — `welcome_screen_test` birinchi `Image` ni
              // qahramon surat deb o'lchaydi.
              // Brend yozuvi markazda, o'ng tepada ixcham til (UZ/RU/EN).
              const Stack(
                alignment: Alignment.center,
                children: [
                  Padding(
                    padding: EdgeInsets.only(top: Gap.lg, bottom: Gap.xs),
                    child: _Wordmark(),
                  ),
                  Positioned(
                    right: Gap.md,
                    top: 0,
                    bottom: 0,
                    child: LanguagePill(),
                  ),
                ],
              ),
              // ── TEPA: VIZUAL ──────────────────────────────────
              //
              // `Expanded` — qolgan bo'sh joyning hammasini oladi,
              // ya'ni matn bloki o'z balandligini olgandan keyin
              // nima qolsa, o'sha suratniki. Past ekranda surat
              // kichrayadi, tugmalar esa HAR DOIM joyida qoladi.
              Expanded(
                child: AnimatedBuilder(
                  animation: _c,
                  builder: (context, _) {
                    final p = still ? 0.0 : _c.value;
                    // Sinus — halqa ulanganda sakrash bo'lmaydi.
                    final breathe = math.sin(p * 2 * math.pi);

                    return Stack(
                      fit: StackFit.expand,
                      children: [
                        // Suratning orqasidagi oltin nur.
                        IgnorePointer(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: RadialGradient(
                                center: const Alignment(0, -0.05),
                                radius: 0.78,
                                colors: [
                                  t.glow.withValues(
                                      alpha: .14 + .07 * (breathe + 1) / 2),
                                  t.glow.withValues(alpha: 0),
                                ],
                              ),
                            ),
                          ),
                        ),

                        // Aylanadigan karta — hech narsa kesilmaydi.
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: Gap.lg, vertical: Gap.sm),
                          child: RepaintBoundary(
                            child: NfcCard3D(
                              progress: p,
                              glow: t.glow,
                              still: still,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),

              // ── PAST: MATN VA TUGMALAR ────────────────────────
              _Foreground(
                headline: l.welcomeHeadline,
                subtitle: l.welcomeSubtitle,
                start: l.welcomeStart,
                login: l.welcomeLogin,
                tokens: t,
                headlineSize: (w * .062).clamp(19.0, 25.0),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pastki blok: sarlavha, ajratgich, tavsif va ikkita tugma.
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.xxl, 0, Gap.xxl, Gap.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            headline,
            style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  color: t.text1,
                  height: 1.18,
                  fontSize: headlineSize,
                ),
          ),
          const SizedBox(height: Gap.md),
          _Rule(tone: t.brand),
          const SizedBox(height: Gap.md),
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

/// Siyrak NFCSTORE yozuvi — ikki yonida champagne chiziq.
class _Wordmark extends StatelessWidget {
  const _Wordmark();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    Widget line() => Container(
          width: 28,
          height: 1,
          color: t.brand.withValues(alpha: .7),
        );
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        line(),
        const SizedBox(width: Gap.md),
        Text(
          'NFCSTORE',
          style: TextStyle(
            fontFamily: 'Manrope',
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 4.2,
            color: t.text1,
          ),
        ),
        const SizedBox(width: Gap.md - 4.2),
        line(),
      ],
    );
  }
}
