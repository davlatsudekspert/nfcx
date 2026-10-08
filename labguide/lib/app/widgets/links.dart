import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/gen/app_localizations.dart';

/// Havolani tashqi ilovada ochadi; ochilmasa nusxalaydi va xabar beradi
/// (ochilmagan havola uchun “ochildi” deyilmaydi).
Future<void> openExternalLink(BuildContext context, String url) async {
  var opened = false;
  try {
    opened = await launchUrl(
      Uri.parse(url),
      mode: LaunchMode.externalApplication,
    );
  } on Object {
    opened = false;
  }
  if (!opened && context.mounted) await copyLink(context, url);
}

Future<void> copyLink(BuildContext context, String url) async {
  final l = AppLocalizations.of(context);
  final messenger = ScaffoldMessenger.of(context);
  await Clipboard.setData(ClipboardData(text: url));
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(l.linkCopied)));
}
