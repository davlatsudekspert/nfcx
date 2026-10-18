import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/providers.dart';
import 'core/media/video_diag.dart';
import 'core/storage/secure_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Video diagnostikasi: FAQAT sinov (debug) qurilishida; relizda hech narsa qilmaydi.
  installVideoDiag();

  // Saqlangan mavzu va til BIRINCHI kadrdan oldin o'qiladi: aks holda
  // ilova bir lahza standart mavzuda chaqnab, keyin almashardi.
  final prefs = await Prefs.open();

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
  ));

  runApp(
    ProviderScope(
      overrides: [prefsProvider.overrideWithValue(prefs)],
      child: const NovaApp(),
    ),
  );
}
