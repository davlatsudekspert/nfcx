import 'package:flutter/material.dart';

import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';

/// TAHRIRLASH EKRANLARINING BO'LIMI — sarlavha, qisqa izoh va bitta
/// yuza ichida maydonlar.
///
/// Egasi (2026-09): "Edit Profile va Edit Business'ni mantiqiy
/// sectionlarga ajrat, hierarchy va spacing yaxshi bo'lsin". Ilgari
/// o'nlab maydon bitta uzun ustunda turardi va qaysi biri nimaga
/// tegishli ekani ko'rinmasdi. Endi har guruh o'z kartasida, hamma
/// tahrir ekranida BIR XIL ko'rinishda.
class EditSection extends StatelessWidget {
  const EditSection({
    super.key,
    required this.title,
    required this.children,
    this.icon,
    this.hint,
    this.trailing,
    this.gap = Gap.lg,
  });

  final String title;
  final IconData? icon;
  final String? hint;
  final Widget? trailing;
  final List<Widget> children;

  /// Karta ichidagi elementlar orasidagi bo'shliq.
  final double gap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 17, color: t.text2),
                const SizedBox(width: Gap.sm),
              ],
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: t.text1,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
        if (hint != null) ...[
          const SizedBox(height: 3),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              hint!,
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 12.5,
                height: 1.35,
                fontWeight: FontWeight.w500,
                color: t.text2,
              ),
            ),
          ),
        ],
        const SizedBox(height: Gap.md),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(Gap.lg),
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: t.border2),
            boxShadow: t.shadowTiny,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) SizedBox(height: gap),
                children[i],
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// PASTGA YOPISHGAN "SAQLASH" PANELI — uzun tahrir formalarida tugma
/// doim ko'rinib tursin (pastga tushib qidirish shart emas).
class EditSaveBar extends StatelessWidget {
  const EditSaveBar({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.fromLTRB(Gap.screenX, Gap.md, Gap.screenX, Gap.md),
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        border: Border(top: BorderSide(color: t.border2)),
      ),
      child: child,
    );
  }
}
