import 'package:flutter/material.dart';

import 'package:nfcstore_nova/design/theme/typography.dart';
import 'package:nfcstore_nova/design/tokens/shapes.dart';

/// PROFIL RANG TIZIMI — MAKET, FAQAT KO'RISH UCHUN.
///
/// Bu fayl `test/` ichida va ilovaga KIRMAYDI.
///
/// MUAMMO: hozir hamma profil bir xil bej/oltin fonda, shuning
/// uchun ular bir-biridan farq qilmaydi.
///
/// QOIDA: har profilning O'Z aksenti bo'ladi, lekin ekran qattiq
/// rangga BO'YALMAYDI. Fon — juda yengil tint; rang esa faqat
/// kartochka, NFC nishoni, ikonka va faol boshqaruvlarda.
class ProfileTheme {
  const ProfileTheme({
    required this.name,
    required this.accent1,
    required this.accent2,
    required this.deep,
    this.dark = false,
  });

  final String name;
  final Color accent1, accent2;

  /// To'q variant — mono kod uchun, yorug' fonda kontrast yetsin.
  final Color deep;

  /// Ekskluziv kabi qorong'i profil.
  final bool dark;

  /// FON — JUDA YENGIL TINT.
  ///
  /// Aksent to'g'ridan-to'g'ri fonga qo'yilsa ekran bo'yalib
  /// ketadi va matn o'qilmay qoladi. Shuning uchun aksent oq
  /// (yoki qorong'i profil uchun siyoh) bilan kuchli suyultiriladi.
  Color get bg => dark
      ? Color.alphaBlend(
          accent2.withValues(alpha: .10), const Color(0xFF131217))
      : Color.alphaBlend(
          accent2.withValues(alpha: .07), const Color(0xFFFCFAF6));

  Color get surface => dark
      ? Color.alphaBlend(
          accent2.withValues(alpha: .07), const Color(0xFF1C1A22))
      : Colors.white;

  Color get surface2 => dark
      ? Color.alphaBlend(
          accent2.withValues(alpha: .12), const Color(0xFF232029))
      : Color.alphaBlend(
          accent2.withValues(alpha: .13), const Color(0xFFF6F2EA));

  Color get border => accent2.withValues(alpha: dark ? .32 : .30);

  Color get text1 => dark ? const Color(0xFFF3EFE7) : const Color(0xFF1A1A1F);
  Color get text2 => dark ? const Color(0xFFBAB3A7) : const Color(0xFF5C5750);
  Color get text3 => dark ? const Color(0xFF857E74) : const Color(0xFF8E877D);

  LinearGradient get gradient => LinearGradient(
        begin: const Alignment(-0.7, -1),
        end: const Alignment(0.7, 1),
        colors: [accent1, accent2],
      );

  /// AKSENT USTIDAGI MATN — AVTOMATIK.
  ///
  /// Aksent yorug' bo'lsa ustiga qora, to'q bo'lsa oq tushadi.
  /// Qo'lda tanlansa, yangi rang qo'shilganda matn jimgina
  /// o'qilmay qolardi.
  Color get onAccent {
    final l = (accent1.computeLuminance() + accent2.computeLuminance()) / 2;
    return l > 0.45 ? const Color(0xFF17161B) : Colors.white;
  }

  /// Mono kod rangi — fonga qarab yetarli kontrast.
  Color get codeInk => dark ? accent1 : deep;
}

const goldTheme = ProfileTheme(
  name: 'Gold — shaxsiy',
  accent1: Color(0xFFF2DFA8),
  accent2: Color(0xFFD9B662),
  deep: Color(0xFF7A5E1E),
);

const silverTheme = ProfileTheme(
  name: 'Silver — shaxsiy',
  accent1: Color(0xFFEDEFF2),
  accent2: Color(0xFFB9C0C9),
  deep: Color(0xFF4A525C),
);

const exclusiveTheme = ProfileTheme(
  name: 'Exclusive — qora/oltin',
  accent1: Color(0xFFE8C87A),
  accent2: Color(0xFFBE9540),
  deep: Color(0xFF6E5219),
  dark: true,
);

const businessTheme = ProfileTheme(
  name: 'Biznes — brend rangi',
  accent1: Color(0xFF7FD4C1),
  accent2: Color(0xFF1F9B84),
  deep: Color(0xFF106354),
);

/// NFC NISHONI — hamma ekranda bir xil shakl, rang profildan.
class ThemedBadge extends StatelessWidget {
  const ThemedBadge({
    super.key,
    required this.theme,
    required this.code,
    this.big = false,
    this.onDark = false,
  });

  final ProfileTheme theme;
  final String code;
  final bool big;

  /// Video ustida — fon qorong'i, shuning uchun nishon ham.
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final fill = onDark
        ? Colors.black.withValues(alpha: .42)
        : theme.accent2.withValues(alpha: theme.dark ? .18 : .12);
    final ink = onDark ? theme.accent1 : theme.codeInk;
    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: big ? Gap.md : Gap.sm, vertical: big ? 5 : 3),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: R.pill,
        border: Border.all(color: theme.accent2.withValues(alpha: .55)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.nfc_rounded, size: big ? 14 : 11, color: ink),
          SizedBox(width: big ? 6 : 4),
          Text(code,
              style: AppType.monoStyle(color: ink, size: big ? 13 : 11)),
        ],
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text, this.theme);
  final String text;
  final ProfileTheme theme;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: Gap.sm, top: Gap.lg),
        child: Text(text.toUpperCase(),
            style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 10.5,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w700,
                color: theme.text3)),
      );
}

/// BITTA PROFILNING BUTUN RANG TIZIMI — bir rasmda.
class ThemeShowcase extends StatelessWidget {
  const ThemeShowcase(this.theme, {super.key});

  final ProfileTheme theme;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: theme.bg,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(theme.name,
                style: TextStyle(
                    fontFamily: AppType.display,
                    fontSize: 21,
                    color: theme.text1)),
            _Label('NFC nishoni', theme),
            Row(children: [
              ThemedBadge(theme: theme, code: 'VIP001', big: true),
              const SizedBox(width: Gap.sm),
              ThemedBadge(theme: theme, code: 'TTS075'),
            ]),
            _Label('Profil boshi', theme),
            _ProfileHead(theme),
            _Label('Yozuvlar — karta ko’rinishida', theme),
            _CardTile(theme, 'Salom NFC', video: false),
            const SizedBox(height: Gap.sm),
            _CardTile(theme, 'Yangi loyiha ustida ishlayapmiz', video: true),
            _Label('Lenta kartasi', theme),
            _FeedCard(theme),
            _Label('Lavha — fon doim qora', theme),
            _Lavha(theme),
          ],
        ),
      ),
    );
  }
}

class _ProfileHead extends StatelessWidget {
  const _ProfileHead(this.theme);
  final ProfileTheme theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: theme.surface,
        borderRadius: R.gentle,
        border: Border.all(color: theme.border),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
                gradient: theme.gradient, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text('MU',
                style: TextStyle(
                    fontFamily: AppType.display,
                    fontSize: 19,
                    color: theme.onAccent)),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ThemedBadge(theme: theme, code: 'VIP001', big: true),
                const SizedBox(height: 4),
                Text('Muhammad',
                    style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: theme.text1)),
                Text('188 ko‘rish · 12 skanerlash',
                    style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 11.5,
                        color: theme.text3)),
              ],
            ),
          ),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: Gap.md, vertical: 7),
            decoration:
                BoxDecoration(gradient: theme.gradient, borderRadius: R.pill),
            child: Text('Tahrirlash',
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: theme.onAccent)),
          ),
        ],
      ),
    );
  }
}

/// Yozuv katakchasi — jismoniy karta nisbatida.
///
/// MUHIM: haqiqiy media O'Z rangida turadi. Aksent faqat ramka,
/// NFC nishoni va ijro belgisida — aks holda hamma yozuv bir xil
/// sariq kvadratga aylanardi.
class _CardTile extends StatelessWidget {
  const _CardTile(this.theme, this.caption, {required this.video});
  final ProfileTheme theme;
  final String caption;
  final bool video;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 1.9,
      child: Container(
        decoration: BoxDecoration(
          color: theme.surface,
          borderRadius: R.tile,
          border: Border.all(color: theme.border),
        ),
        padding: const EdgeInsets.all(6),
        child: Row(
          children: [
            // Media o'rni — haqiqiy rasm/video shu yerda, o'z rangida.
            Expanded(
              flex: 3,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(11),
                child: ColoredBox(
                  color: const Color(0xFF8D8478),
                  child: Center(
                    child: video
                        ? const Icon(Icons.play_circle_fill_rounded,
                            size: 26, color: Colors.white)
                        : const Icon(Icons.image_rounded,
                            size: 22, color: Color(0xFFD9D4CC)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: Gap.md),
            Expanded(
              flex: 4,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ThemedBadge(theme: theme, code: 'VIP001'),
                  const SizedBox(height: 6),
                  Text(caption,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: theme.text1)),
                ],
              ),
            ),
            const SizedBox(width: Gap.sm),
          ],
        ),
      ),
    );
  }
}

class _FeedCard extends StatelessWidget {
  const _FeedCard(this.theme);
  final ProfileTheme theme;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: theme.surface,
        borderRadius: R.gentle,
        border: Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                  gradient: theme.gradient, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: Text('TO',
                  style: TextStyle(
                      fontFamily: AppType.display,
                      fontSize: 14,
                      color: theme.onAccent)),
            ),
            const SizedBox(width: Gap.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ThemedBadge(theme: theme, code: 'TTS075', big: true),
                  const SizedBox(height: 3),
                  Text('Tohir',
                      style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 12,
                          color: theme.text2)),
                ],
              ),
            ),
            Icon(Icons.verified_rounded,
                size: 20, color: theme.accent2),
          ]),
          const SizedBox(height: Gap.md),
          ClipRRect(
            borderRadius: R.tile,
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: ColoredBox(color: const Color(0xFF8D8478)),
            ),
          ),
          const SizedBox(height: Gap.sm),
          Row(children: [
            Icon(Icons.nfc_rounded, size: 13, color: theme.accent2),
            const SizedBox(width: 5),
            Text('Karta tegizib tanishgansiz',
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 11.5,
                    color: theme.accent2)),
          ]),
          const SizedBox(height: Gap.sm),
          Divider(height: 1, color: theme.border),
          const SizedBox(height: Gap.sm),
          Row(children: [
            _act(Icons.favorite_rounded, '24', theme.accent2),
            const SizedBox(width: Gap.lg),
            _act(Icons.mode_comment_outlined, '5', theme.text2),
            const Spacer(),
            _act(Icons.nfc_rounded, 'Tegizish', theme.text2),
          ]),
        ],
      ),
    );
  }

  Widget _act(IconData i, String s, Color c) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(i, size: 17, color: c),
          const SizedBox(width: 5),
          Text(s,
              style: TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: c)),
        ],
      );
}

/// LAVHA — fon DOIM qora.
///
/// Video to'liq ekran bo'lgani uchun asosiy fon qorong'i qoladi va
/// har videoning rangiga qarab UI o'zgarmaydi — aks holda ekran
/// sakrab, rang-barang bo'lib ketardi. Profil aksenti faqat NFC
/// nishoni, faol ikonka va progress chizig'ida ko'rinadi.
class _Lavha extends StatelessWidget {
  const _Lavha(this.theme);
  final ProfileTheme theme;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: R.gentle,
      child: AspectRatio(
        aspectRatio: 10 / 9,
        child: ColoredBox(
          color: const Color(0xFF0C0B0E),
          child: Stack(
            children: [
              Positioned(
                left: 12,
                right: 12,
                top: 10,
                child: Row(children: [
                  Expanded(
                    child: Container(
                        height: 3,
                        decoration: BoxDecoration(
                            gradient: theme.gradient,
                            borderRadius: R.pill)),
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Container(
                        height: 3,
                        color: Colors.white.withValues(alpha: .22)),
                  ),
                ]),
              ),
              Positioned(
                left: 14,
                top: 30,
                child: Text('Lavha',
                    style: TextStyle(
                        fontFamily: AppType.display,
                        fontSize: 18,
                        color: Colors.white.withValues(alpha: .92))),
              ),
              Positioned(
                right: 12,
                bottom: 16,
                child: Column(children: [
                  Icon(Icons.favorite_rounded, size: 22, color: theme.accent1),
                  const SizedBox(height: 12),
                  const Icon(Icons.mode_comment_outlined,
                      size: 21, color: Colors.white),
                  const SizedBox(height: 12),
                  const Icon(Icons.volume_up_rounded,
                      size: 21, color: Colors.white),
                ]),
              ),
              Positioned(
                left: 14,
                bottom: 16,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Muhammad',
                        style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white)),
                    const SizedBox(height: 5),
                    ThemedBadge(
                        theme: theme, code: 'VIP001', onDark: true),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
