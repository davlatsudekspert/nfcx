import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../common/share.dart';
import '../payment/payment_screen.dart';

/// ID TAFSILOTI — sotib olishdan oldingi oxirgi ekran.
///
/// KARTA QAHRAMON: u ekranning eng tepasida, katta va bosilganda
/// orqa tomoniga o'giriladi. Odam mahsulotni ko'radi, keyin
/// tafsilotni o'qiydi.
///
/// "SOTIB OLISH" HECH QANDAY TASDIQ BERMAYDI — u faqat to'lov
/// usulini tanlash ekranini ochadi. Dizayn buni alohida
/// ta'kidlaydi, chunki bu yerda pul haqida gap ketyapti.
class IdDetailScreen extends StatelessWidget {
  const IdDetailScreen({super.key, required this.record});

  final Record record;

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(record.tier);
    final handle = profileHandle(context, record.code);

    return ScreenBackdrop(
      aura: Aura.spotlight,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(
              center: Text(
                '${style.label.toUpperCase()} · ${record.code}',
                style: T.meta.copyWith(letterSpacing: 1.4),
              ),
            ),
            Expanded(
              child: ListView(
                // Yopishgan panel kontentni kesib qo'ymasligi uchun
                // ro'yxat oxiriga shuncha bo'sh joy qo'shiladi.
                padding: EdgeInsets.only(bottom: StickyBar.inset(context)),
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: IdentityCard(
                      code: record.code,
                      tier: record.tier,
                      url: handle,
                    ),
                  ),
                  const SizedBox(height: S.x12),
                  Center(
                    child: Text(
                      tr('Kartani bosing — orqa tomoni ochiladi'),
                      style: T.meta,
                    ),
                  ),
                  const SizedBox(height: S.x24),

                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${style.label} · ${_pattern(record.code)}',
                          style: T.titleSm,
                        ),
                        const SizedBox(height: S.x12),
                        Text(_explain(record.code, style.label), style: T.body),
                        const SizedBox(height: S.x20),

                        RowGroup(
                          children: [
                            _MetaRow(
                              label: tr('Tarif'),
                              value: style.label.toUpperCase(),
                              accent: true,
                            ),
                            _MetaRow(
                              label: tr('Material'),
                              value: _hex(style.base),
                              swatch: record.tier,
                            ),
                            _MetaRow(
                              label: tr('Profil manzili'),
                              value: '/${record.code.toLowerCase()}',
                            ),
                          ],
                        ),

                        const SizedBox(height: S.x16),
                        Surface(
                          padding: const EdgeInsets.all(S.x12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              NIcon(Ico.info, size: 16, color: C.ink3),
                              const SizedBox(width: S.x12),
                              Expanded(
                                child: Text(
                                  tr('Material profilda va jismoniy kartada '
                                      'bir xil ko‘rinadi.'),
                                  style: T.caption.copyWith(fontSize: 12.5),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // YOPISHGAN NARX VA HARAKAT.
            StickyBar(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Eyebrow(tr('Narx')),
                          const SizedBox(height: 4),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(som(record.price), style: T.price),
                              const SizedBox(width: 6),
                              Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: Text(tr('so‘m'), style: T.meta),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const Spacer(),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(tr('Bir marta to‘lov'), style: T.meta),
                      ),
                    ],
                  ),
                  const SizedBox(height: S.x16),
                  PrimaryButton(
                    tr('Sotib olish'),
                    onTap: () => push<void>(
                      context,
                      (_) => PaymentScreen(record: record),
                    ),
                  ),
                  const SizedBox(height: S.x8),
                  Center(
                    child: Text(
                      tr('“Sotib olish” → to‘lov usulini tanlash ekrani '
                          'ochiladi'),
                      textAlign: TextAlign.center,
                      style: T.meta.copyWith(fontSize: 10.5),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Kod naqshi — "AAA000" yoki "faqat harflar".
  String _pattern(String code) {
    final c = code.toUpperCase();
    if (RegExp(r'^[A-Z]+$').hasMatch(c)) return tr('faqat harflar');
    if (RegExp(r'^[0-9]+$').hasMatch(c)) return tr('faqat raqamlar');
    return 'AAA000 ${tr('naqsh')}';
  }

  String _explain(String code, String tier) {
    final c = code.toUpperCase();
    if (RegExp(r'^[A-Z]+$').hasMatch(c)) {
      return trf(
        'Kod faqat harflardan iborat. Bunday kodlar eng kam uchraydi va '
        '{tier} darajasiga kiradi.',
        {'tier': tier},
      );
    }
    return trf(
      'Kod uch harf va uch raqamdan iborat. Naqsh {tier} tarifiga mos.',
      {'tier': tier},
    );
  }

  /// Rangni `#RRGGBB` ko'rinishida yozadi.
  ///
  /// Bu NARX emas, dizayn tokeni: material qaysi rang ekanini
  /// ko'rsatadi va dizayn jadvalidagi qiymat bilan bir xil bo'ladi.
  String _hex(Color color) {
    final v = color.toARGB32() & 0xFFFFFF;
    return '#${v.toRadixString(16).toUpperCase().padLeft(6, '0')}';
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.label,
    required this.value,
    this.accent = false,
    this.swatch,
  });

  final String label;
  final String value;
  final bool accent;
  final Tier? swatch;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: S.x16,
          vertical: S.x16,
        ),
        child: Row(
          children: [
            Expanded(child: Text(label, style: T.bodyStrong.copyWith(
              fontSize: 14,
              color: C.ink2,
            ))),
            if (swatch != null) ...[
              TierDot(swatch!, size: 14),
              const SizedBox(width: S.x8),
            ],
            Text(
              value,
              style: T.amount.copyWith(
                fontSize: 13.5,
                color: accent ? C.accent : C.ink,
              ),
            ),
          ],
        ),
      );
}
