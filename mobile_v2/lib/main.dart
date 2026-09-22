import 'package:flutter/widgets.dart';

import 'app.dart';
import 'core/session.dart';
import 'core/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = AppSession();
  final theme = BrandThemeController();
  await Future.wait([session.boot(), theme.load()]);
  runApp(NfcstoreV2App(session: session, theme: theme));
}
