import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';

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
///   * TEPA — vizual. Surat `BoxFit.contain` bilan to'liq
///     ko'rinadi: hech narsa kesilmaydi, telefon ham, NFC kartasi
///     ham, profil/reels/izoh kartochkalari ham joyida turadi.
///   * PAST — sarlavha, tavsif va ikkita tugma. Ular suratning
///     ostida, o'z fonida turadi — parda kerak emas, matn har
///     qanday mavzuda toza o'qiladi.
///
/// Tugmalar suratning ostida, ya'ni vizual ularga HECH QACHON
/// xalaqit bermaydi. `welcome_screen_test.dart` buni har bir
/// ekran o'lchamida o'lchab tekshiradi.
///
/// ## SURAT FONSIZ — MAVZU BILAN QO'SHILADI
///
/// `assets/welcome/nfc_hero.webp` da FON YO'Q (alfa kanali).
/// Shuning uchun u qora–champagne mavzuda qora ustida, ochiq
/// mavzuda esa och fon ustida turadi — qirqilgan to'rtburchak
/// ko'rinmaydi.
///
/// Suratning pastki cheti `ShaderMask` bilan asta so'nadi va
/// matnga yumshoq o'tadi; orqasida esa mavzuning oltin nuri
/// (`t.glow`) nafas oladi.
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
/// Bitta 5 soniyalik kontroller: oltin nur nafas oladi va surat
/// 3px suziydi. Keskin zoom, silkinish yoki tez o'tish yo'q.
/// Tizimda "animatsiyani kamaytirish" yoqilgan bo'lsa harakat
/// UMUMAN bo'lmaydi.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  static const _asset = 'assets/welcome/nfc_hero.webp';

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

                        // Suratning o'zi — hech narsa kesilmasin.
                        Padding(
                          padding: EdgeInsets.only(
                            left: Gap.lg,
                            right: Gap.lg,
                            top: Gap.sm + breathe * 3,
                          ),
                          child: _FadingHero(asset: _asset),
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

/// Surat, pastki cheti asta so'nadi.
///
/// So'nish `ShaderMask` + `BlendMode.dstIn` bilan: gradientning
/// SHAFFOFLIGI suratga ko'chiriladi, rangi emas. Shuning uchun u
/// qora mavzuda ham, och mavzuda ham bir xil ishlaydi — fon
/// rangini bilishi shart emas.
class _FadingHero extends StatelessWidget {
  const _FadingHero({required this.asset});

  final String asset;

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      shaderCallback: (rect) => const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Colors.white, Colors.white, Color(0x00FFFFFF)],
        stops: [0.0, 0.86, 1.0],
      ).createShader(rect),
      blendMode: BlendMode.dstIn,
      child: Image.asset(
        asset,
        fit: BoxFit.contain,
        alignment: Alignment.bottomCenter,
        // Surat yuklanmasa EKRAN BUZILMASIN: bo'sh joy qoladi,
        // matn va tugmalar joyida turaveradi.
        errorBuilder: (_, __, ___) => const SizedBox.shrink(),
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
          _Rule(tone: t.accent2),
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
