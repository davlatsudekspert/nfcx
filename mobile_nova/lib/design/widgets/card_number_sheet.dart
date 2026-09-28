import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/utils/external_link.dart' show copyToClipboard;
import '../../l10n/gen/app_localizations.dart';
import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'buttons.dart';

/// KARTA RAQAMI OYNASI (egasi, 2026-09-28: "karta yozsa, o'sha belgini
/// bossa QR kod va ostida karta nomeri ko'rinishi kerak").
///
/// Saytdagi `CardNumberModal` bilan bir xil: QR kod, ostida raqamning
/// o'zi (4 xonadan ajratilgan) va nusxalash tugmasi.
///
/// Raqam aloqa qatorida OCHIQ turmaydi — faqat "Karta" belgisi. Bosish
/// ataylab qilingan harakat: raqam tasodifan skrinshot yoki videoga
/// tushmaydi.
///
/// QR ichida FAQAT raqamning o'zi. Bank ilovalarining to'lov QR
/// formati har xil va standart emas — noto'g'ri format yozsak, odam
/// skanerlab pulni boshqa joyga yuborib yuborishi mumkin edi.
Future<void> showCardNumberSheet(
  BuildContext context, {
  required String number,
  String label = '',
}) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: context.tokens.surfaceSolid,
    builder: (_) => CardNumberSheet(number: number, label: label),
  );
}

/// `8600 1234 5678 9012` — faqat raqamlar, 4 tadan guruh.
String prettyCardNumber(String raw) {
  final digits = raw.replaceAll(RegExp(r'\s+'), '');
  final b = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && i % 4 == 0) b.write(' ');
    b.write(digits[i]);
  }
  return b.toString();
}

class CardNumberSheet extends StatelessWidget {
  const CardNumberSheet({super.key, required this.number, this.label = ''});
  final String number;
  final String label;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final plain = number.replaceAll(RegExp(r'\s+'), '');
    final pretty = prettyCardNumber(number);
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Gap.screenX, 0, Gap.screenX, Gap.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label.isNotEmpty ? label : l.cardSheetTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: Gap.lg),
            // QR har mavzuda OQ fonda — skaner qora-oq kontrastni kutadi.
            Container(
              key: const ValueKey('card-number-qr'),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: t.border1),
              ),
              child: QrImageView(
                data: plain,
                size: 200,
                padding: EdgeInsets.zero,
                backgroundColor: Colors.white,
                errorCorrectionLevel: QrErrorCorrectLevel.M,
              ),
            ),
            const SizedBox(height: Gap.lg),
            // Raqamning o'zi — nusxalash ishlamasa ham bosib belgilanadi.
            SelectableText(
              pretty,
              key: const ValueKey('card-number-text'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: AppType.mono,
                fontSize: 22,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.2,
                color: t.text1,
              ),
            ),
            const SizedBox(height: Gap.lg),
            NovaButton(
              key: const ValueKey('card-number-copy'),
              label: l.cardCopy,
              onPressed: () async {
                // `copyToClipboard` — kanal javob bermasa ham qotmaydi.
                await copyToClipboard(plain);
                if (!context.mounted) return;
                ScaffoldMessenger.maybeOf(context)
                  ?..hideCurrentSnackBar()
                  ..showSnackBar(SnackBar(content: Text(l.cardCopied)));
              },
            ),
            const SizedBox(height: Gap.md),
            Text(
              l.cardQrNote,
              textAlign: TextAlign.center,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: t.text2),
            ),
          ],
        ),
      ),
    );
  }
}
