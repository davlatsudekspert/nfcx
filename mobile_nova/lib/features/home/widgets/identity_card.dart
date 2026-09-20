import 'package:flutter/material.dart';

import '../../../app/providers.dart';
import '../../../data/models/models.dart';
import '../../../design/motion/motion.dart';
import '../../../design/theme/typography.dart';
import '../../../design/tokens/nfc_tokens.dart';
import '../../../design/tokens/shapes.dart';
import '../../../design/widgets/surfaces.dart';
import '../../../l10n/gen/app_localizations.dart';

/// `NfcTokens.onAccent` ga qisqa murojaat — aksent sirti ustidagi siyoh.
const kOnAccent = Color(0xFF1A1A1F);

/// Home'ning markaziy obyekti: foydalanuvchi + faol NFC ID.
///
/// Bu oddiy karta emas — Concept B'dagi "identity object": organik
/// nosimmetrik shakl, ichida brend belgisi va NFC kodi. Shaxsiy va
/// Biznes rejimida uning RANGI ham, TARKIBI ham o'zgaradi.
class IdentityCard extends StatelessWidget {
  const IdentityCard({
    super.key,
    required this.user,
    required this.id,
    required this.mode,
    this.onTap,
    this.onQr,
    this.onShare,
  });

  final User user;
  final NfcId? id;
  final AppMode mode;
  final VoidCallback? onTap;
  final VoidCallback? onQr;
  final VoidCallback? onShare;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final business = mode == AppMode.business;

    // Biznes rejimida sovuqroq ikkilamchi aksent — rejim almashgani
    // faqat yozuvdan emas, RANGDAN ham bilinadi.
    final tone = business ? t.accentB : t.accent1;
    final toneDark = business ? t.accentBDark : t.accent2;

    return PressableScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Motion.med,
        curve: Motion.smooth,
        padding: const EdgeInsets.all(Gap.xl),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: const Alignment(-.8, -1),
            end: const Alignment(.9, 1),
            colors: [tone, toneDark],
          ),
          // Nosimmetrik radius — bir burchak boshqacha, shakl "yasalgan"
          // emas, o'sgandek ko'rinadi.
          borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
          boxShadow: t.shadowFloat,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // IKKINCHI IDENTITY BLOKI YO'Q.
            //
            // Avval bu yerda avatar, ism, rol va logotip qatori turardi.
            // Home'ga markazlashgan NFC orb qo'shilgach, o'sha uchala
            // ma'lumot ORB OSTIDA ko'rsatiladi va bu qator aynan o'sha
            // matnni takrorlab, ekranni ikki barobar cho'zib yuborgan
            // edi — tezkor amallar ekran ostiga tushib ketgandi.
            //
            // Karta endi ierarxiyani DAVOM ETTIRADI: orb -> ism -> rol
            // -> KOD, statistika va amallar.
            const SizedBox(height: Gap.xl),
            Text(
              l.homeActiveId.toUpperCase(),
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.3,
                color: kOnAccent.withValues(alpha: .6),
              ),
            ),
            const SizedBox(height: 5),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    id?.code ?? '—',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppType.monoStyle(
                      color: kOnAccent,
                      size: 23,
                      weight: FontWeight.w600,
                      letterSpacing: 2.2,
                    ),
                  ),
                ),
                _MiniAction(icon: Icons.qr_code_rounded, onTap: onQr),
                const SizedBox(width: Gap.sm),
                _MiniAction(icon: Icons.ios_share_rounded, onTap: onShare),
              ],
            ),
            if (id != null) ...[
              const SizedBox(height: Gap.lg),
              Row(
                children: [
                  _Stat(value: id!.taps, label: l.nfcScans),
                  const SizedBox(width: Gap.xl),
                  _Stat(value: id!.views, label: l.nfcViews),
                  const SizedBox(width: Gap.xl),
                  _Stat(value: id!.followers, label: l.profileFollowers),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _MiniAction extends StatelessWidget {
  const _MiniAction({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => PressableScale(
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .32),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: .4)),
          ),
          child: Icon(icon, size: 18, color: kOnAccent),
        ),
      );
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            formatCount(value),
            style: AppType.monoStyle(
              color: kOnAccent,
              size: 15,
              weight: FontWeight.w600,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              color: kOnAccent.withValues(alpha: .62),
            ),
          ),
        ],
      );
}

/// 1 200 → `1.2K`. Uzun raqamlar kapsulani kengaytirib yubormaydi.
String formatCount(int n) {
  if (n < 1000) return '$n';
  if (n < 1000000) {
    final v = n / 1000;
    return '${v.toStringAsFixed(v < 10 ? 1 : 0)}K';
  }
  final v = n / 1000000;
  return '${v.toStringAsFixed(v < 10 ? 1 : 0)}M';
}
