import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/errors/app_error.dart';
import '../../data/models/models.dart';
import '../../data/repositories/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiProvider)),
);

/// Sessiya holati — router shu qiymatga qarab yo'nalish tanlaydi.
sealed class SessionState {
  const SessionState();
}

/// Saqlangan token tekshirilmoqda. Splash shu holatda ko'rinadi.
///
/// [error] — oxirgi urinish tarmoq sababli o'xshamadi (internet yo'q,
/// timeout, 5xx). Token JOYIDA, sessiya qayta urinilmoqda; Splash
/// sababni va "Qayta urinish" tugmasini ko'rsatadi.
class SessionRestoring extends SessionState {
  const SessionRestoring([this.error]);
  final AppError? error;
}

class SessionAnonymous extends SessionState {
  const SessionAnonymous();
}

class SessionActive extends SessionState {
  const SessionActive(this.user, this.ids);
  final User user;

  /// Foydalanuvchining NFC ID'lari — `/api/auth/me` bilan birga keladi,
  /// shuning uchun Home uchun alohida so'rov kerak emas.
  final List<NfcId> ids;

  NfcId? get primaryId {
    if (ids.isEmpty) return null;
    return ids.firstWhere((e) => e.primary, orElse: () => ids.first);
  }
}

class SessionController extends StateNotifier<SessionState> {
  SessionController(this._repo) : super(const SessionRestoring()) {
    restore();
  }

  final AuthRepository _repo;
  Timer? _retry;
  int _attempt = 0;

  /// SESSIYANI TIKLASH.
  ///
  /// Faqat haqiqiy "sessiya yo'q" (token yo'q yoki server uni rad
  /// etdi — `unauthorized`) odamni chiqaradi. Internet yo'qligi,
  /// timeout yoki server xatosida token saqlanib qoladi — avval bunday
  /// holatda ham ilova "chiqib ketgan" bo'lib Welcome'ni ko'rsatardi,
  /// token esa telefonda qolardi. Endi Splash sababni ko'rsatadi va
  /// o'zi qayta urinadi (2, 4, 8, 16, 30 s ...).
  Future<void> restore() async {
    _retry?.cancel();
    final res = await _repo.restore();
    if (!mounted) return;
    res.when(
      ok: (v) {
        _attempt = 0;
        state = SessionActive(v.user, v.ids);
      },
      err: (e) {
        if (e.kind == AppErrorKind.unauthorized) {
          _attempt = 0;
          state = const SessionAnonymous();
          return;
        }
        state = SessionRestoring(e);
        final wait = Duration(seconds: (2 << _attempt).clamp(2, 30));
        if (_attempt < 4) _attempt++;
        _retry = Timer(wait, () {
          if (mounted && state is SessionRestoring) restore();
        });
      },
    );
  }

  @override
  void dispose() {
    _retry?.cancel();
    super.dispose();
  }

  /// Kirish muvaffaqiyatli bo'lgach chaqiriladi.
  Future<void> adopt(User user) async {
    final res = await _repo.me();
    if (!mounted) return;
    state = res.when(
      ok: (v) => SessionActive(v.user, v.ids),
      err: (_) => SessionActive(user, const []),
    );
  }

  /// Profil yoki NFC ID o'zgarganda ro'yxatni yangilaydi.
  Future<void> refresh() async {
    final res = await _repo.me();
    if (!mounted) return;
    res.when(
      ok: (v) => state = SessionActive(v.user, v.ids),
      err: (e) {
        // 401 — sessiya tugagan. Boshqa xatoda joriy holat saqlanadi:
        // tarmoq uzilgani foydalanuvchini chiqarib yuborish uchun sabab emas.
        if (e.kind == AppErrorKind.unauthorized) state = const SessionAnonymous();
      },
    );
  }

  Future<void> logout() async {
    await _repo.logout();
    if (!mounted) return;
    state = const SessionAnonymous();
  }

  /// Tarmoq qatlami 401 qaytarganda router tomonidan chaqiriladi.
  void expire() {
    if (state is SessionActive) state = const SessionAnonymous();
  }
}

final sessionProvider =
    StateNotifierProvider<SessionController, SessionState>(
  (ref) => SessionController(ref.watch(authRepositoryProvider)),
);

/// 401 SIGNALINI SESSIYAGA ULAYDI.
///
/// ## NIMA UCHUN KERAK BO'LDI
///
/// `ApiClient.sessionExpired` hisoblagichi bor edi va 401 da o'sardi
/// — lekin unga HECH KIM OBUNA BO'LMAGAN. Butun `lib/` da yagona
/// boshqa chaqiruv `dispose()` edi. Ya'ni token eskirsa, ilova o'sha
/// o'lik token bilan ishlayverardi: har so'rov 401 olardi, ekranlar
/// bo'sh qolardi va kirish ekraniga qaytishning yo'li yo'q edi.
///
/// Router allaqachon to'g'ri yozilgan: `SessionAnonymous` bo'lishi
/// bilan u `Routes.welcome` ga ko'chiradi. Yetishmagan bo'lagi
/// shunchaki MANA SHU ULANISH edi.
///
/// `Future.microtask` — signal tarmoq javobidan keladi va o'sha
/// zahoti holatni o'zgartirish qurilish (build) fazasiga to'g'ri
/// kelib qolishi mumkin.
final sessionExpiryWatcherProvider = Provider<void>((ref) {
  final api = ref.watch(apiProvider);
  var alive = true;

  void onExpired() {
    Future.microtask(() {
      if (!alive) return;
      ref.read(sessionProvider.notifier).expire();
    });
  }

  api.sessionExpired.addListener(onExpired);
  ref.onDispose(() {
    alive = false;
    api.sessionExpired.removeListener(onExpired);
  });
});

/// Qulaylik: joriy foydalanuvchi yoki `null`.
final currentUserProvider = Provider<User?>((ref) {
  final s = ref.watch(sessionProvider);
  return s is SessionActive ? s.user : null;
});

final myIdsProvider = Provider<List<NfcId>>((ref) {
  final s = ref.watch(sessionProvider);
  return s is SessionActive ? s.ids : const [];
});
