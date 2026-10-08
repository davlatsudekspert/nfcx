import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../design/theme.dart';
import '../features/settings/settings_controller.dart';
import '../l10n/gen/app_localizations.dart';
import 'app_scope.dart';
import 'router.dart';

class LabGuideApp extends StatefulWidget {
  const LabGuideApp({super.key, required this.services});

  final AppServices services;

  @override
  State<LabGuideApp> createState() => _LabGuideAppState();
}

class _LabGuideAppState extends State<LabGuideApp> {
  late GoRouter _router;
  late bool _wasOnboarded;
  late final OnboardingChanges _routerRefresh = OnboardingChanges(_settings);

  SettingsController get _settings => widget.services.settings;

  @override
  void initState() {
    super.initState();
    _router = buildRouter(_settings, refresh: _routerRefresh);
    _wasOnboarded = _settings.onboarded;
    _settings.addListener(_onSettings);
  }

  /// Chiqish yoki lokal ma'lumotlar o'chirilganda tab stacklari ham
  /// tozalanadi: router qaytadan quriladi.
  void _onSettings() {
    final onboarded = _settings.onboarded;
    if (_wasOnboarded && !onboarded) {
      final old = _router;
      setState(() => _router = buildRouter(_settings, refresh: _routerRefresh));
      WidgetsBinding.instance.addPostFrameCallback((_) => old.dispose());
    }
    _wasOnboarded = onboarded;
  }

  @override
  void dispose() {
    _settings.removeListener(_onSettings);
    _router.dispose();
    _routerRefresh.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      services: widget.services,
      child: ListenableBuilder(
        listenable: _settings,
        builder: (context, _) => MaterialApp.router(
          onGenerateTitle: (_) => 'LabGuide',
          debugShowCheckedModeBanner: false,
          routerConfig: _router,
          theme: buildLgTheme(Brightness.light),
          darkTheme: buildLgTheme(Brightness.dark),
          themeMode: _settings.themeMode,
          locale: _settings.language.locale,
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            ...GlobalMaterialLocalizations.delegates,
          ],
        ),
      ),
    );
  }
}
