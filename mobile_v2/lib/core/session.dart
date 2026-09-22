import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';
import 'models.dart';
import 'repository.dart';

enum SessionPhase { loading, signedOut, signedIn }

class AppSession extends ChangeNotifier {
  AppSession({ApiClient? api, FlutterSecureStorage? storage})
      : api = api ?? ApiClient(),
        _storage = storage ?? const FlutterSecureStorage() {
    repo = Repository(this.api);
  }

  final ApiClient api;
  final FlutterSecureStorage _storage;
  late final Repository repo;

  static const _tokenKey = 'nfcstore_v2_session';

  SessionPhase phase = SessionPhase.loading;
  AppUser? user;
  List<IdentityProfile> profiles = const [];
  List<Company> companies = const [];
  IdentityProfile? activeProfile;
  Company? activeCompany;
  bool businessMode = false;

  Future<void> boot() async {
    String? token;
    try {
      token = await _storage.read(key: _tokenKey);
    } catch (_) {}

    if ((token ?? '').isEmpty) {
      phase = SessionPhase.signedOut;
      notifyListeners();
      return;
    }

    api.token = token;
    try {
      await refresh();
      phase = user == null ? SessionPhase.signedOut : SessionPhase.signedIn;
    } on ApiException catch (e) {
      if (e.unauthorized) await _clearToken();
      phase = SessionPhase.signedOut;
    } catch (_) {
      phase = SessionPhase.signedOut;
    }
    notifyListeners();
  }

  Future<void> signIn(String login, String password) async {
    final token = await repo.login(login, password);
    try {
      await _storage.write(key: _tokenKey, value: token);
    } catch (_) {}
    await refresh();
    phase = SessionPhase.signedIn;
    notifyListeners();
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String code,
  }) async {
    final token = await repo.register(
      email: email,
      password: password,
      emailCode: code,
    );
    if (token.isEmpty) {
      await signIn(email, password);
      return;
    }
    try {
      await _storage.write(key: _tokenKey, value: token);
    } catch (_) {}
    await refresh();
    phase = SessionPhase.signedIn;
    notifyListeners();
  }


  Future<void> refresh() async {
    final account = await repo.me();
    user = account.user;
    profiles = account.profiles;

    try {
      companies = await repo.myCompanies();
    } catch (_) {
      companies = const [];
    }

    if (activeProfile == null || !profiles.any((p) => p.code == activeProfile!.code)) {
      if (profiles.isEmpty) {
        activeProfile = null;
      } else {
        activeProfile = profiles.firstWhere(
          (p) => p.isPrimary,
          orElse: () => profiles.first,
        );
      }
    }

    if (activeCompany != null && !companies.any((c) => c.id == activeCompany!.id)) {
      activeCompany = null;
    }

    notifyListeners();
  }

  void usePersonal(IdentityProfile profile) {
    activeProfile = profile;
    activeCompany = null;
    businessMode = false;
    notifyListeners();
  }

  void setBusinessMode(bool value) {
    if (value && companies.isEmpty) return;
    businessMode = value;
    if (value) activeCompany ??= companies.first;
    notifyListeners();
  }

  Future<void> signOut() async {
    try {
      await repo.logout();
    } catch (_) {}
    await _clearToken();
    user = null;
    profiles = const [];
    companies = const [];
    activeProfile = null;
    activeCompany = null;
    businessMode = false;
    phase = SessionPhase.signedOut;
    notifyListeners();
  }

  Future<void> _clearToken() async {
    api.token = null;
    try {
      await _storage.delete(key: _tokenKey);
    } catch (_) {}
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }
}

class SessionScope extends InheritedNotifier<AppSession> {
  const SessionScope({
    super.key,
    required AppSession session,
    required super.child,
  }) : super(notifier: session);

  static AppSession of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<SessionScope>();
    assert(scope?.notifier != null);
    return scope!.notifier!;
  }

  static AppSession read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<SessionScope>();
    assert(scope?.notifier != null);
    return scope!.notifier!;
  }
}