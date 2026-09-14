import 'package:flutter/widgets.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';

/// TASHQI KONTAKT AMALLARI.
///
/// NFCSTORE da ICHKI MESSENJER YO'Q va bu ataylab: handoff aniq aytadi
/// — "Messages" tabi ham, suhbat ekrani ham, profildagi "Xabar"
/// tugmasi ham bo'lmaydi. Odamga bog'lanish tashqi ilovalar orqali
/// bo'ladi. Shuning uchun bu yerda faqat mavjud kontaktlar
/// ko'rsatiladi: bo'sh maydon tugma ham chiqarmaydi.
///
/// KO'RINISH — METALL TANGA (2026-09).
///
/// Ilgari bu yerda hoshiyali yassi to'rtburchak tugmalar edi. Sayt
/// bilan yonma-yon qo'yilganda farq aniq ko'rinardi: saytda ular
/// gradient bilan to'lgan, tepasida yorug'lik aksi va pastida soya
/// bo'lgan DUMALOQ tangalar. Endi ilovada ham shunday.
///
/// Glif esa o'z brend rangida qoladi — ko'z Telegramni qidirmaydi,
/// darrov topadi. Ranglar `C.onGold*` dan olinadi: haqiqiy brend
/// ranglari oltin ustida yo'qolib ketardi (izohi tokens.dart da).
class ContactRow extends StatelessWidget {
  const ContactRow({
    super.key,
    this.phone = '',
    this.telegram = '',
    this.instagram = '',
    this.whatsapp = '',
    this.onShare,
  });

  final String phone;
  final String telegram;
  final String instagram;
  final String whatsapp;

  /// Ulashish — MAVJUD amal, shunchaki shu qatorga ko'chirildi.
  /// Ilgari u yonidagi alohida kvadrat tugmada edi va qatordan
  /// ajralib turardi; saytda esa u boshqa aloqa tugmalari bilan bir
  /// qatorda. Yangi funksiya EMAS: bir xil `onShare` chaqiriladi.
  final VoidCallback? onShare;

  @override
  Widget build(BuildContext context) {
    final items = <({Ico icon, String label, Color color, Uri? uri, VoidCallback? onTap})>[];

    if (phone.trim().isNotEmpty) {
      items.add((
        icon: Ico.phone,
        label: tr('Qo‘ng‘iroq'),
        color: C.onGoldPhone,
        uri: Uri.parse('tel:${phone.replaceAll(RegExp(r'[^0-9+]'), '')}'),
        onTap: null,
      ));
    }
    if (telegram.trim().isNotEmpty) {
      items.add((
        icon: Ico.telegram,
        label: 'Telegram',
        color: C.onGoldTelegram,
        uri: Uri.parse('https://t.me/${telegram.replaceAll('@', '').trim()}'),
        onTap: null,
      ));
    }
    if (whatsapp.trim().isNotEmpty) {
      items.add((
        icon: Ico.phone,
        label: 'WhatsApp',
        color: C.onGoldWhatsapp,
        uri: Uri.parse('https://wa.me/${whatsapp.replaceAll(RegExp(r'[^0-9]'), '')}'),
        onTap: null,
      ));
    }
    if (instagram.trim().isNotEmpty) {
      items.add((
        icon: Ico.globe,
        label: 'Instagram',
        color: C.onGoldInstagram,
        uri: Uri.parse('https://instagram.com/${instagram.replaceAll('@', '').trim()}'),
        onTap: null,
      ));
    }
    if (onShare != null) {
      items.add((
        icon: Ico.share,
        label: tr('Ulashish'),
        color: C.onGoldNeutral,
        uri: null,
        onTap: onShare,
      ));
    }

    if (items.isEmpty) return const SizedBox.shrink();

    // SIG'SA MARKAZDA, SIG'MASA SURILADI.
    //
    // `Row(mainAxisAlignment: center)` ni to'g'ridan-to'g'ri
    // suriladigan qatorga qo'yib bo'lmaydi: u yerda kenglik cheksiz
    // va markazlash ma'nosini yo'qotadi. `minWidth` esa aynan shuni
    // beradi — qator kamida ekran kengligida bo'ladi (demak
    // markazlanadi), kontent kattaroq bo'lsa o'sib ketadi.
    return LayoutBuilder(
      builder: (context, box) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const ClampingScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minWidth: box.maxWidth),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const SizedBox(width: S.x20),
                _CoinAction(
                  icon: items[i].icon,
                  label: items[i].label,
                  color: items[i].color,
                  onTap: items[i].onTap ??
                      (items[i].uri == null ? null : () => openExternal(items[i].uri!)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Bitta metall tanga + ostidagi yozuv.
class _CoinAction extends StatelessWidget {
  const _CoinAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final Ico icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  /// Tanga diametri. 58 — barmoq uchun qulay (44 dan katta) va
  /// yozuvi bilan birga ekranga beshtasi sig'adi.
  static const _size = 58.0;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        child: SizedBox(
          width: 68,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: _size,
                height: _size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: C.metalCoin,
                  // Chekkadagi quyuq chiziq — metall qirrasi. Usiz
                  // tanga fonga "erib" ketadi.
                  border: Border.all(color: C.accentShade, width: 1),
                  boxShadow: C.metalShadow,
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // YUQORIDAGI YORUG'LIK AKSI.
                    //
                    // Flutter'da ichki soya (`inset`) yo'q, shuning
                    // uchun u alohida qatlam bilan chiziladi: tepadan
                    // pastga so'nadigan oq nur. Aynan shu qatlam
                    // dumaloqni "yassi doira" dan "tanga" ga
                    // aylantiradi.
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            center: Alignment(-0.25, -0.85),
                            radius: .85,
                            colors: [Color(0x8CFFFFFF), Color(0x00FFFFFF)],
                            stops: [0, .75],
                          ),
                        ),
                      ),
                    ),
                    NIcon(icon, size: 25, color: color),
                  ],
                ),
              ),
              const SizedBox(height: S.x8),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: T.caption.copyWith(fontSize: 11.5, color: C.offWhite),
              ),
            ],
          ),
        ),
      );
}

/// Tashqi havolani ochish. Xatosi jimgina yutiladi: telefonda mos
/// ilova bo'lmasa, ekranga tushunarsiz xato chiqargandan ko'ra
/// hech narsa qilmagan ma'qul.
Future<void> openExternal(Uri uri) async {
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {}
}
