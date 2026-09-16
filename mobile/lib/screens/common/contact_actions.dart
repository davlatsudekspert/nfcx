import 'package:flutter/widgets.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';

/// TASHQI KONTAKT AMALLARI.
///
/// NFCSTORE da ICHKI MESSENJER YO'Q va bu ataylab: handoff aniq aytadi
/// — "Messages" tabi ham, suhbat ekrani ham, profildagi "Xabar"
/// tugmasi ham bo'lmaydi. Odamga bog'lanish tashqi ilovalar orqali
/// bo'ladi. Shuning uchun bu yerda faqat MAVJUD kontaktlar
/// ko'rsatiladi: bo'sh maydon tugma ham chiqarmaydi.
///
/// KO'RINISH — DUMALOQ 56 dp YUZA + OSTIDA YOZUV.
///
/// Har amal `Surface` ustida turadi (ko'tarilgan yuza, nozik qirra,
/// soya), glif esa O'Z BREND RANGIDA qoladi: ko'z Telegramni
/// qidirmaydi, darrov topadi. Brend ranglari `tokens.dart` dagi
/// `C.telegram` va `C.whatsapp` — ular mavzu almashganda ham
/// o'zgarmaydi.
///
/// BOSISH MAYDONI: ko'rinadigan doira 56 dp, `Press(minSize: S.tap)`
/// esa uni 48 dp minimumidan pastga tushirmaydi.
class ContactRow extends StatelessWidget {
  const ContactRow({
    super.key,
    this.phone = '',
    this.telegram = '',
    this.instagram = '',
    this.whatsapp = '',
    this.website = '',
    this.address = '',
    this.onShare,
    this.compactRail = false,
  });

  final String phone;
  final String telegram;
  final String instagram;
  final String whatsapp;

  /// Sayt — `https://` qo'yilmagan bo'lsa o'zi qo'shiladi.
  final String website;

  /// Manzil — xaritada ochiladi.
  final String address;

  /// Ulashish — MAVJUD amal, shunchaki shu qatorda turadi. Yangi
  /// funksiya EMAS: bir xil `onShare` chaqiriladi.
  final VoidCallback? onShare;

  /// Profilning premium hero ostida kontaktlar dumaloq ikonkalarga
  /// bo'linmaydi: bir yuzali, gorizontal action rail bo'lib chiqadi.
  final bool compactRail;

  /// Saytga sxema qo'shish. `sayt.uz` → `https://sayt.uz`.
  static Uri? _siteUri(String raw) {
    final v = raw.trim();
    if (v.isEmpty) return null;
    final full = v.startsWith('http://') || v.startsWith('https://')
        ? v
        : 'https://$v';
    return Uri.tryParse(full);
  }

  @override
  Widget build(BuildContext context) {
    // TARJIMA QILINGAN RO'YXAT `static final` BO'LMAYDI — til
    // almashganda muzlab qolardi. Shuning uchun u har chaqiruvda
    // shu yerda quriladi.
    final items = <({Ico icon, String label, Color color, VoidCallback? onTap})>[];

    void add(Ico icon, String label, Color color, Uri? uri) {
      if (uri == null) return;
      items.add((
        icon: icon,
        label: label,
        color: color,
        onTap: () => openExternal(uri),
      ));
    }

    if (phone.trim().isNotEmpty) {
      add(
        Ico.phone,
        tr('Telefon'),
        C.ink,
        Uri.parse('tel:${phone.replaceAll(RegExp(r'[^0-9+]'), '')}'),
      );
    }
    if (telegram.trim().isNotEmpty) {
      add(
        Ico.telegram,
        'Telegram',
        // BRAND RANGI BU YERDA ISHLATILMAYDI.
        //
        // Dizayn qoidasi: ekranda BITTA asosiy urg'u rangi. Uchta
        // aloqa tugmasi uch xil brend rangida bo'lsa, ochiq profil
        // rangli tugmalar yig'indisiga aylanadi va oltin urg'u
        // yo'qoladi. Brend ranglari faqat TO'LOVDA saqlanadi
        // (Payme/Click) — u yerda provayderni aniq tanish shart.
        C.ink,
        Uri.parse('https://t.me/${telegram.replaceAll('@', '').trim()}'),
      );
    }
    if (whatsapp.trim().isNotEmpty) {
      add(
        Ico.whatsapp,
        'WhatsApp',
        C.ink,
        Uri.parse('https://wa.me/${whatsapp.replaceAll(RegExp(r'[^0-9]'), '')}'),
      );
    }
    if (instagram.trim().isNotEmpty) {
      // Instagram gradienti dizayn tizimida YO'Q — o'ylab topilmaydi.
      // Glif asosiy matn rangida qoladi, uni ikonka shakli va ostidagi
      // yozuv tanitadi.
      add(
        Ico.instagram,
        'Instagram',
        C.ink,
        Uri.parse('https://instagram.com/${instagram.replaceAll('@', '').trim()}'),
      );
    }
    if (website.trim().isNotEmpty) {
      add(Ico.globe, tr('Sayt'), C.ink, _siteUri(website));
    }
    if (address.trim().isNotEmpty) {
      add(
        Ico.pin,
        tr('Manzil'),
        C.ink,
        Uri.parse(
          'https://maps.google.com/?q=${Uri.encodeComponent(address.trim())}',
        ),
      );
    }
    if (onShare != null) {
      items.add((
        icon: Ico.share,
        label: tr('Ulashish'),
        color: C.ink,
        onTap: onShare,
      ));
    }

    if (items.isEmpty) return const SizedBox.shrink();

    if (compactRail) return _ContactRail(items: items);

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
                if (i > 0) const SizedBox(width: S.x16),
                _ContactAction(
                  icon: items[i].icon,
                  label: items[i].label,
                  color: items[i].color,
                  onTap: items[i].onTap,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ContactRail extends StatelessWidget {
  const _ContactRail({required this.items});

  final List<({Ico icon, String label, Color color, VoidCallback? onTap})> items;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const ClampingScrollPhysics(),
        child: Row(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) const SizedBox(width: S.x8),
              Press(
                onTap: items[i].onTap,
                minSize: S.tap,
                scale: .97,
                child: Container(
                  height: 48,
                  padding: const EdgeInsets.symmetric(horizontal: S.x16),
                  decoration: BoxDecoration(
                    color: C.glassHigh,
                    borderRadius: BorderRadius.circular(R.status),
                    border: Border.all(color: C.line),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      NIcon(items[i].icon, size: 17, color: C.accent),
                      const SizedBox(width: 8),
                      Text(items[i].label, style: T.buttonSm.copyWith(color: C.ink)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      );
}

/// Bitta dumaloq yuza + ostidagi yozuv.
class _ContactAction extends StatelessWidget {
  const _ContactAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final Ico icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  /// Doira diametri — dizayn spetsifikatsiyasi.
  static const double _size = 56;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: S.tap,
        scale: .94,
        child: SizedBox(
          width: 72,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Surface(
                radius: _size / 2,
                padding: EdgeInsets.zero,
                shadow: C.e1,
                child: SizedBox(
                  width: _size,
                  height: _size,
                  child: Center(child: NIcon(icon, size: 23, color: color)),
                ),
              ),
              const SizedBox(height: S.x8),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: T.caption.copyWith(fontSize: 12.5, color: C.ink2),
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
