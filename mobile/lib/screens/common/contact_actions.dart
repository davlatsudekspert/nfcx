import 'package:flutter/widgets.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';

/// TASHQI KONTAKT AMALLARI.
///
/// NFCSTORE da ICHKI MESSENJER YO'Q va bu ataylab: handoff aniq aytadi
/// — "Messages" tabi ham, suhbat ekrani ham, profildagi "Xabar"
/// tugmasi ham bo'lmaydi. Odamga bog'lanish tashqi ilovalar orqali
/// bo'ladi. Shuning uchun bu yerda faqat mavjud kontaktlar
/// ko'rsatiladi: bo'sh maydon tugma ham chiqarmaydi.
class ContactRow extends StatelessWidget {
  const ContactRow({
    super.key,
    this.phone = '',
    this.telegram = '',
    this.instagram = '',
    this.whatsapp = '',
  });

  final String phone;
  final String telegram;
  final String instagram;
  final String whatsapp;

  @override
  Widget build(BuildContext context) {
    final items = <({Ico icon, String label, Color color, Uri uri})>[];

    if (phone.trim().isNotEmpty) {
      items.add((
        icon: Ico.phone,
        label: 'Qo‘ng‘iroq',
        color: C.offWhite,
        uri: Uri.parse('tel:${phone.replaceAll(RegExp(r'[^0-9+]'), '')}'),
      ));
    }
    if (telegram.trim().isNotEmpty) {
      items.add((
        icon: Ico.telegram,
        label: 'Telegram',
        color: C.telegram,
        uri: Uri.parse('https://t.me/${telegram.replaceAll('@', '').trim()}'),
      ));
    }
    if (whatsapp.trim().isNotEmpty) {
      items.add((
        icon: Ico.phone,
        label: 'WhatsApp',
        color: C.whatsapp,
        uri: Uri.parse('https://wa.me/${whatsapp.replaceAll(RegExp(r'[^0-9]'), '')}'),
      ));
    }
    if (instagram.trim().isNotEmpty) {
      items.add((
        icon: Ico.globe,
        label: 'Instagram',
        color: C.offWhite,
        uri: Uri.parse('https://instagram.com/${instagram.replaceAll('@', '').trim()}'),
      ));
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: S.x8),
          Expanded(
            child: Press(
              onTap: () => openExternal(items[i].uri),
              child: Container(
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(R.button),
                  border: Border.all(color: C.hairline),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    NIcon(items[i].icon, size: 17, color: items[i].color),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(items[i].label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.caption.copyWith(fontSize: 11.5, color: C.offWhite)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Tashqi havolani ochish. Xatosi jimgina yutiladi: telefonda mos
/// ilova bo'lmasa, ekranga tushunarsiz xato chiqargandan ko'ra
/// hech narsa qilmagan ma'qul.
Future<void> openExternal(Uri uri) async {
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {}
}
