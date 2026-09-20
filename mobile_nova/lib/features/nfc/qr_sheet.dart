import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../core/utils/sharing.dart';

import '../../core/network/api_client.dart';
import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../l10n/gen/app_localizations.dart';

/// NFC ID ning QR kodi.
///
/// NFC'siz qurilmalar uchun bu ASOSIY ulashish yo'li, shuning uchun u
/// har joydan bitta chaqiruv bilan ochiladi.
/// [urlOverride] — QR va ulashish uchun BOSHQA manzil.
///
/// Demo profil uchun kerak: demo kodi saytda mavjud emas, shuning
/// uchun uning QR kodi 404 sahifaga olib borardi.
Future<void> showQrSheet(BuildContext context, NfcId id,
    {String? urlOverride}) {
  return showModalBottomSheet(
    context: context,
    // ILDIZ NAVIGATORDA OCHILADI.
    //
    // Aks holda varaq TAB navigatorida ochiladi va pastki suzuvchi
    // navigatsiya paneli uning ustiga chiziladi — varaqning eng
    // pastki tugmalari panel ostida qolib ko'rinmay qoladi.
    // Ildiz navigatorda varaq butun ekranni qoplaydi.
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => _QrSheet(id: id, urlOverride: urlOverride),
  );
}

class _QrSheet extends StatelessWidget {
  const _QrSheet({required this.id, this.urlOverride});
  final NfcId id;
  final String? urlOverride;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final url = urlOverride ?? id.publicUrl(kApiBase);

    return Container(
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(34)),
        border: Border.all(color: t.border2),
      ),
      padding: EdgeInsets.fromLTRB(
        Gap.xxl,
        Gap.md,
        Gap.xxl,
        Gap.xxl + MediaQuery.viewPaddingOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: t.border2, borderRadius: R.pill),
          ),
          const SizedBox(height: Gap.xl),
          Text(id.name.isEmpty ? l.nfcShowQr : id.name,
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: Gap.xs),
          Text(l.nfcQrHint,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: Gap.xl),
          // QR har doim OQ fonda chiziladi: qorong'i mavzuda mavzu rangi
          // ishlatilsa skanerlar kodni o'qiy olmasdi.
          Container(
            padding: const EdgeInsets.all(Gap.xl),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: R.soft,
              boxShadow: t.shadowSoft,
            ),
            child: QrImageView(
              data: url,
              size: 216,
              backgroundColor: Colors.white,
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.circle,
                color: Color(0xFF14131A),
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.circle,
                color: Color(0xFF14131A),
              ),
              embeddedImage: const AssetImage(BrandLogo.assetLogo),
              embeddedImageStyle: const QrEmbeddedImageStyle(size: Size(42, 42)),
            ),
          ),
          const SizedBox(height: Gap.xl),
          SelectableText(
            id.code,
            style: AppType.monoStyle(color: t.text1, size: 17, letterSpacing: 2.4),
          ),
          const SizedBox(height: Gap.xl),
          Row(
            children: [
              Expanded(
                child: NovaButton(
                  label: l.actionCopy,
                  tone: ButtonTone.quiet,
                  icon: Icons.copy_rounded,
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: url));
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(l.actionCopied)),
                      );
                    }
                  },
                ),
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: NovaButton(
                  label: l.actionShare,
                  icon: Icons.ios_share_rounded,
                  onPressed: () async {
                    // Tizim oynasi ochilmasa `shareLink` manzilni
                    // buferga ko'chiradi — buni odamga aytamiz,
                    // aks holda tugma "ishlamadi" bo'lib ko'rinadi.
                    final ok = await shareLink(url, title: id.name);
                    if (ok || !context.mounted) return;
                    ScaffoldMessenger.of(context)
                      ..hideCurrentSnackBar()
                      ..showSnackBar(SnackBar(content: Text(l.shareCopied)));
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
