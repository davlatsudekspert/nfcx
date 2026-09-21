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
          // GRAFIT KARTA, OLTIN TAFSILOT — TO'LA OLTIN PLITA EMAS.
          //
          // Ilgari butun karta aksent gradient bilan bo'yalardi va
          // bosh sahifadagi eng katta dog' edi: qora fonda u
          // "sariq plita" bo'lib ko'rinardi. Egasining talabi —
          // oltin 10-15% aksent bo'lsin, fon emas.
          //
          // Endi karta yuzasi grafit, chetida ingichka oltin
          // chiziq, ichida esa NFC kodi oltin rangda. Ierarxiya
          // saqlandi: karta hali ham ekrandagi eng muhim blok.
          // YUZA NAVY BO'LIB QOLSIN.
          //
          // Ilgari bu yerda `surfaceSolid` USTIGA oltin tus
          // qo'yilardi. O'lchandi: natija `#1E1F1E` — ya'ni
          // R=30, G=31, B=30, navy butunlay yo'qolgan va karta
          // kulrang-jigarrang bo'lib chiqqan. Aynan shu "brown"
          // deb shikoyat qilingan.
          //
          // Endi gradient ham NAVY: `surface` dan `surfaceSolid`
          // ga. Oltin faqat chegarada va NFC raqamida qoladi.
          gradient: LinearGradient(
            begin: const Alignment(-.8, -1),
            end: const Alignment(.9, 1),
            colors: t.isDark
                ? [t.surface, t.surfaceSolid]
                : [
                    tone.withValues(alpha: .18),
                    toneDark.withValues(alpha: .10),
                  ],
          ),
          // Nosimmetrik radius — bir burchak boshqacha, shakl "yasalgan"
          // emas, o'sgandek ko'rinadi.
          borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
          border: Border.all(color: toneDark.withValues(alpha: .34)),
          boxShadow: t.shadowSoft,
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
                color: t.text3,
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
                      color: t.accent1,
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
              // UCHALASI KENGLIKNI BO'LIB OLADI.
              //
              // Ilgari bu uchta qat'iy kenglikdagi ustun va ular
              // orasida qat'iy `Gap.xl` edi. 320dp li telefonda
              // ("Skanerlashlar", "Ko'rishlar", "Obunachilar"
              // yonma-yon) qator 125 piksel toshib ketardi va
              // ekranda sariq-qora chiziq chiqardi. Ruschada ham
              // (96 piksel) xuddi shunday edi.
              Row(
                children: [
                  Expanded(child: _Stat(value: id!.taps, label: l.nfcScans)),
                  const SizedBox(width: Gap.md),
                  Expanded(child: _Stat(value: id!.views, label: l.nfcViews)),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: _Stat(
                        value: id!.followers, label: l.profileFollowers),
                  ),
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
  Widget build(BuildContext context) {
    final t = context.tokens;
    return PressableScale(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          // Karta endi grafit — doira ham oq parda emas, aksent
          // tusi bilan ishlaydi.
          color: t.accent2.withValues(alpha: .12),
          shape: BoxShape.circle,
          border: Border.all(color: t.accent2.withValues(alpha: .38)),
        ),
        child: Icon(icon, size: 18, color: t.accent2),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            formatCount(value),
            style: AppType.monoStyle(
              color: t.text1,
              size: 15,
              weight: FontWeight.w600,
            ),
          ),
          Text(
            label,
            // Ustun endi `Expanded` ichida — ya'ni kengligi
            // cheklangan. Bitta qatorga sig'masa uchta nuqta bilan
            // qisqaradi, toshib ketmaydi.
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 9.5,
              fontWeight: FontWeight.w600,
              color: t.text3,
            ),
          ),
        ],
    );
  }
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
