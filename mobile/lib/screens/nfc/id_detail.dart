import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
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
                  const SizedBox(height: S.x20),

                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // TARIF VA NAQSH — mayda, katta harfda
                        // (prototip: `.eyebrow`), yonida holat
                        // belgisi.
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${style.label} · ${_pattern(record.code)}'.toUpperCase(),
                                style: T.eyebrow,
                              ),
                            ),
                            StatusChip(tr('Bo‘sh'), tone: StatusTone.ok),
                          ],
                        ),
                        const SizedBox(height: S.x8),

                        // NARX — EKRANNING ENG KATTA RAQAMI
                        // (prototip: `.price-big`, Playfair 44).
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(som(record.price), style: T.price.copyWith(fontSize: 44)),
                            const SizedBox(width: 6),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text(tr('so‘m'), style: T.caption.copyWith(fontSize: 14)),
                            ),
                          ],
                        ),

                        // NIMA BERADI — yashil belgili ro'yxat
                        // (prototip: `.perks`).
                        const SizedBox(height: S.x16),
                        for (final perk in _perks(record.tier))
                          Padding(
                            padding: const EdgeInsets.only(bottom: S.x8),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                NIcon(Ico.check, size: 18, color: C.ok),
                                const SizedBox(width: S.x12),
                                Expanded(
                                  child: Text(perk, style: T.body.copyWith(fontSize: 13.5)),
                                ),
                              ],
                            ),
                          ),

                        const SizedBox(height: S.x12),
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

            // YOPISHGAN TO'LOV USULI (prototip: `.paybtns`).
            //
            // Prototipda to'lov usuli AYNAN SHU EKRANDA tanlanadi:
            // odam narxni ko'rib turib, bir bosishda to'lovga
            // o'tadi. Oraliq "to'lov usulini tanlash" ekrani
            // qadamni ikkiga bo'lardi.
            StickyBar(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr('To‘lov usuli'), style: T.cardTitle),
                  const SizedBox(height: S.x12),
                  Row(
                    children: [
                      Expanded(
                        child: _PayBrandButton(
                          label: 'Payme',
                          color: C.payme,
                          onTap: () => push<void>(
                            context,
                            (_) => PaymentScreen(record: record, provider: 'payme'),
                          ),
                        ),
                      ),
                      const SizedBox(width: S.x12),
                      Expanded(
                        child: _PayBrandButton(
                          label: 'Click',
                          color: C.click,
                          onTap: () => push<void>(
                            context,
                            (_) => PaymentScreen(record: record, provider: 'click'),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: S.x8),
                  Text(
                    tr('To‘lov Payme yoki Click sahifasida o‘tadi. '
                        'Muvaffaqiyatni faqat server tasdiqlaydi.'),
                    style: T.meta.copyWith(fontSize: 10.5),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// TARIF NIMA BERADI — prototipdagi ro'yxat.
  ///
  /// Har tarif o'zidan pastdagilarning hammasini o'z ichiga oladi,
  /// shuning uchun ro'yxat yuqoriga qarab o'sib boradi.
  List<String> _perks(Tier tier) => switch (tier) {
        Tier.exclusive => [
            tr('Titanium Gold material, ikki qavatli qirra'),
            tr('Story, post, Reels, video vizitka'),
            tr('Reytingda alohida belgi'),
            // PROTOTIPDA "va auksion huquqi" ham yozilgan, lekin
            // AUKSION ILOVADA YO'Q (saytdan olib tashlangan va
            // `rules_test` uni qaytarishni taqiqlaydi). Bo'lmagan
            // imkoniyatni va'da qilgandan ko'ra, bori aytiladi.
            tr('Sovg‘a qilish huquqi'),
          ],
        Tier.premium => [
            tr('Premium Gold material'),
            tr('Story, post, Reels, video vizitka'),
            tr('Reytingda alohida belgi'),
          ],
        Tier.gold => [
            tr('Pure Gold material'),
            tr('Story, post va Reels'),
            tr('Kengaytirilgan statistika'),
          ],
        Tier.silver => [
            tr('Chrome Silver material'),
            tr('Story ochiladi'),
          ],
        Tier.bronze => [
            tr('Bronza material'),
            tr('Shaxsiy profil va aloqa tugmalari'),
          ],
        Tier.free => [tr('Shaxsiy profil va aloqa tugmalari')],
      };

  /// Kod naqshi — "AAA000" yoki "faqat harflar".
  String _pattern(String code) {
    final c = code.toUpperCase();
    if (RegExp(r'^[A-Z]+$').hasMatch(c)) return tr('faqat harflar');
    if (RegExp(r'^[0-9]+$').hasMatch(c)) return tr('faqat raqamlar');
    return 'AAA000 ${tr('naqsh')}';
  }
}

/// TO'LOV TIZIMI TUGMASI (prototip: `.paybtn.payme` / `.click`).
///
/// BRENDGA MOS RANG — dizayndagi "bitta urg'u" qoidasidan ATAYLAB
/// chiqarilgan yagona joy: odam pul to'layotganda qaysi tizimga
/// o'tayotganini bir qarashda tanishi kerak, aks holda ishonch
/// yo'qoladi.
class _PayBrandButton extends StatelessWidget {
  const _PayBrandButton({
    required this.label,
    required this.color,
    required this.onTap,
  });

  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .97,
        child: Container(
          height: 60,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.button),
            gradient: LinearGradient(
              begin: const Alignment(-.7, -1),
              end: const Alignment(.7, 1),
              colors: [color, Color.lerp(color, const Color(0xFF000000), .32)!],
            ),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: .34),
                blurRadius: 20,
                spreadRadius: -8,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: const Color(0x38FFFFFF),
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Text(
                  label[0],
                  style: T.code(12, color: const Color(0xFFFFFFFF), weight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: S.x8),
              Text(
                label,
                style: T.button.copyWith(color: const Color(0xFFFFFFFF), fontSize: 16),
              ),
            ],
          ),
        ),
      );
}
