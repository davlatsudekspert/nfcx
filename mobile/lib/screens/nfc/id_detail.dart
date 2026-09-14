import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../common/top_bar.dart';
import '../payment/payment_screen.dart';
import '../../l10n/strings.dart';

/// NFC ID tafsiloti — ID katta, tarif, narx, nimalar kiradi, olish.
class IdDetailScreen extends StatelessWidget {
  const IdDetailScreen({super.key, required this.record});
  final Record record;

  /// Tarifga qarab imkoniyatlar. Ro'yxat saytdagi tarif tizimini
  /// takrorlaydi: quyi tarif yuqorisining hammasini oladi.
  List<({String label, bool on})> _features() {
    final rank = Tier.values.indexOf(record.tier);
    bool at(Tier t) => rank >= Tier.values.indexOf(t);
    return [
      (label: tr('Katalog va mahsulotlar'), on: at(Tier.bronze)),
      (label: tr('Story va postlar'), on: at(Tier.silver)),
      (label: tr('Statistika va tahlil'), on: at(Tier.gold)),
      (label: tr('Tasdiqlangan nishon'), on: at(Tier.gold)),
      (label: tr('Jamoa ID‘lari'), on: at(Tier.premium)),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final t = TierStyle.of(record.tier);
    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(title: record.code),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x24),
                children: [
                  Container(
                    padding: const EdgeInsets.all(S.x24),
                    decoration: BoxDecoration(
                      gradient: C.metalSurface,
                      borderRadius: BorderRadius.circular(R.hero),
                      border: Border.all(color: C.metalBorder),
                      boxShadow: E.e3,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Eyebrow('NFCSTORE.UZ'),
                        const SizedBox(height: S.x20),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(record.code, style: T.nfcId(44)),
                        ),
                        const SizedBox(height: 6),
                        Text('nfcstore.uz/${record.code.toLowerCase()}', style: T.meta),
                      ],
                    ),
                  ),
                  const SizedBox(height: S.x20),
                  Surface(
                    child: Row(
                      children: [
                        Container(
                          width: 34, height: 34,
                          decoration: BoxDecoration(shape: BoxShape.circle, gradient: t.gradient),
                        ),
                        const SizedBox(width: S.x12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(t.label, style: T.cardTitle.copyWith(fontSize: 16.5)),
                              const SizedBox(height: 2),
                              Text('${som(record.price)} so‘m', style: T.price),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: S.x24),
                  Eyebrow(tr('Nimalar kiradi')),
                  const SizedBox(height: S.x12),
                  for (final f in _features()) ...[
                    Row(
                      children: [
                        NIcon(Ico.check, size: 17, color: f.on ? C.verdant : C.muted),
                        const SizedBox(width: S.x12),
                        Expanded(
                          child: Text(
                            f.label,
                            style: T.body.copyWith(
                              color: f.on ? C.offWhite : C.muted,
                              fontSize: 14.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: S.x12),
                  ],
                ],
              ),
            ),
            Container(
              padding: EdgeInsets.fromLTRB(
                S.gutter, S.x12, S.gutter,
                MediaQuery.paddingOf(context).bottom + S.x12,
              ),
              decoration: BoxDecoration(
                color: C.obsidian,
                border: Border(top: BorderSide(color: C.hairline)),
              ),
              child: Column(
                children: [
                  PrimaryButton(
                    '${record.code} ni olish',
                    onTap: () => push(context, (_) => PaymentScreen(record: record)),
                  ),
                  const SizedBox(height: 7),
                  Text(tr('Payme yoki Click orqali to‘lov'),
                      style: T.caption.copyWith(fontSize: 12.5, color: C.muted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
