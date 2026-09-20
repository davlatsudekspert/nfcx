import 'package:flutter/material.dart';

import 'package:nfcstore_nova/design/theme/typography.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/tokens/shapes.dart';
import 'package:nfcstore_nova/design/widgets/nova_scaffold.dart';
import 'package:nfcstore_nova/design/widgets/surfaces.dart';
import 'package:nfcstore_nova/features/home/widgets/avatar.dart';

/// NFC O'ZIGA XOSLIGI — TAKLIF, FAQAT KO'RISH UCHUN.
///
/// Bu fayl `test/` ichida va ilovaga KIRMAYDI.
///
/// Maqsad: ilovani Instagram naqshidan uzoqlashtirish. Asosiy
/// fikr — Instagramda ulanish "kuzatish" orqali, bizda esa
/// KARTANI TEGIZISH orqali. Shu farqni ko'rinishga chiqaramiz.
///
/// Hamma narsa ilovaning O'Z komponentlari va tokenlaridan
/// yig'ilgan: `FloatingSurface`, `Avatar`, `Gap`, `R`,
/// `context.tokens`, `AppType`.

/// NFC kodi uchun kapsula — kartadagi o'yilgan yozuvga o'xshash.
class CodeChip extends StatelessWidget {
  const CodeChip({super.key, required this.code, this.big = false});

  final String code;
  final bool big;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: big ? Gap.md : Gap.sm, vertical: big ? 5 : 3),
      decoration: BoxDecoration(
        color: t.accent2.withValues(alpha: .10),
        borderRadius: R.pill,
        border: Border.all(color: t.accent2.withValues(alpha: .45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.nfc_rounded, size: big ? 14 : 11, color: t.accent2),
          SizedBox(width: big ? 6 : 4),
          Text(code,
              style: AppType.monoStyle(
                  color: t.goldDeep, size: big ? 13 : 11)),
        ],
      ),
    );
  }
}

/// TAKLIF 4 — LENTA KARTASIDA NFC KODI BOSH ROLDA.
///
/// Hozir kod avatar ostida kichkina kulrang matn. Taklifda u
/// kapsulada, NFC belgisi bilan — ya'ni birinchi ko'zga
/// tashlanadigan narsa odamning HAQIQIY manzili bo'ladi.
///
/// Pastda "tegizib tanishgansiz" qatori: Instagramda bunday
/// tushuncha umuman yo'q.
class IdentityFeedCard extends StatelessWidget {
  const IdentityFeedCard({
    super.key,
    required this.author,
    required this.code,
    required this.text,
    this.tapped = false,
    this.likes = '0',
    this.comments = '0',
  });

  final String author;
  final String code;
  final String text;

  /// Bu odam bilan karta tegizib tanishganmiz.
  final bool tapped;
  final String likes;
  final String comments;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Avatar(initials: author.substring(0, 2).toUpperCase(), size: 40),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // KOD BIRINCHI, ism ikkinchi — ataylab.
                    CodeChip(code: code, big: true),
                    const SizedBox(height: 3),
                    Text(author,
                        style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 12.5,
                            color: t.text2)),
                  ],
                ),
              ),
              if (tapped)
                Icon(Icons.verified_rounded, size: 20, color: t.success)
              else
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: Gap.md, vertical: 6),
                  decoration: BoxDecoration(
                      color: t.accent2, borderRadius: R.pill),
                  child: Text('Obuna',
                      style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: t.onAccent)),
                ),
            ],
          ),
          const SizedBox(height: Gap.md),
          ClipRRect(
            borderRadius: R.gentle,
            child: AspectRatio(
              aspectRatio: 4 / 3,
              child: DecoratedBox(
                decoration: BoxDecoration(gradient: t.accentGradient),
              ),
            ),
          ),
          const SizedBox(height: Gap.md),
          Text(text, style: Theme.of(context).textTheme.bodySmall),
          if (tapped) ...[
            const SizedBox(height: Gap.sm),
            Row(
              children: [
                Icon(Icons.nfc_rounded, size: 13, color: t.success),
                const SizedBox(width: 5),
                Text('Karta tegizib tanishgansiz',
                    style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 11.5,
                        color: t.success)),
              ],
            ),
          ],
          const SizedBox(height: Gap.sm),
          Divider(height: 1, color: t.border2),
          const SizedBox(height: 2),
          Row(
            children: [
              _Act(Icons.favorite_border_rounded, likes),
              const SizedBox(width: Gap.lg),
              _Act(Icons.mode_comment_outlined, comments),
              const Spacer(),
              _Act(Icons.nfc_rounded, 'Tegizish'),
            ],
          ),
        ],
      ),
    );
  }
}

class _Act extends StatelessWidget {
  const _Act(this.icon, this.label);
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 18, color: t.text2),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: t.text2)),
      ]),
    );
  }
}

/// TAKLIF 5 — PROFIL PANJARASI KARTA KO'RINISHIDA.
///
/// Hozir 3 ustunli kvadrat panjara — Instagram naqshi. Taklifda
/// yozuvlar jismoniy NFC kartaga o'xshash nisbatda (85.6 × 54 mm,
/// ya'ni ~1.586) va har birida kod muhri turadi.
class CardPostTile extends StatelessWidget {
  const CardPostTile({
    super.key,
    required this.code,
    required this.caption,
    this.video = false,
  });

  final String code;
  final String caption;
  final bool video;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return AspectRatio(
      // Bank kartasi nisbati — jismoniy NFC kartaning o'zi.
      aspectRatio: 1.586,
      child: Container(
        decoration: BoxDecoration(
          gradient: t.accentGradient,
          borderRadius: R.tile,
          border: Border.all(color: t.border1),
        ),
        padding: const EdgeInsets.all(Gap.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CodeChip(code: code),
                const Spacer(),
                if (video)
                  Icon(Icons.play_circle_fill_rounded,
                      size: 22, color: t.onAccent),
              ],
            ),
            const Spacer(),
            Text(
              caption,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: t.onAccent),
            ),
          ],
        ),
      ),
    );
  }
}

class IdentityProfilePosts extends StatelessWidget {
  const IdentityProfilePosts({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NovaScaffold(
      title: 'Profil',
      body: NovaScroll(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: Row(
              children: [
                const Avatar(initials: 'MU', size: 56),
                const SizedBox(width: Gap.md),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const CodeChip(code: 'VIP001', big: true),
                    const SizedBox(height: 4),
                    Text('Muhammad',
                        style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: t.text1)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: Gap.xl),
          const SectionHeader(title: 'Yozuvlar'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: Column(
              children: const [
                CardPostTile(code: 'VIP001', caption: 'Salom NFC'),
                SizedBox(height: Gap.sm),
                CardPostTile(
                    code: 'VIP001',
                    caption: 'Yangi loyiha ustida ishlayapmiz',
                    video: true),
                SizedBox(height: Gap.sm),
                CardPostTile(
                    code: 'VIP001', caption: 'Biznes uchun yangi imkoniyat'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// TAKLIF 6 — "REELS" NOMI ALMASHADI.
///
/// "Reels" — Instagram/Meta atamasi. Taklif: "Lavha". Ekranning
/// o'zi o'zgarmaydi, faqat nom va bo'sh holat matni.
class LavhaEmpty extends StatelessWidget {
  const LavhaEmpty({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NovaScaffold(
      title: 'Lavha',
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: t.surface2,
                shape: BoxShape.circle,
                border: Border.all(color: t.accent2.withValues(alpha: .4)),
              ),
              child: Icon(Icons.nfc_rounded, size: 34, color: t.accent2),
            ),
            const SizedBox(height: Gap.lg),
            Text('Hozircha lavha yo‘q',
                style: TextStyle(
                    fontFamily: AppType.display,
                    fontSize: 19,
                    color: t.text1)),
            const SizedBox(height: Gap.xs),
            Text('Birinchi bo‘lib qo‘shing',
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 13,
                    color: t.text3)),
          ],
        ),
      ),
    );
  }
}
