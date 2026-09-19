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
class SessionRestoring extends SessionState {
  const SessionRestoring();
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

  Future<void> restore() async {
    final res = await _repo.restore();
    if (!mounted) return;
    state = res.when(
      ok: (v) => SessionActive(v.user, v.ids),
      err: (_) => const SessionAnonymous(),
    );
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

/// Qulaylik: joriy foydalanuvchi yoki `null`.
final currentUserProvider = Provider<User?>((ref) {
  final s = ref.watch(sessionProvider);
  return s is SessionActive ? s.user : null;
});

final myIdsProvider = Provider<List<NfcId>>((ref) {
  final s = ref.watch(sessionProvider);
  return s is SessionActive ? s.ids : const [];
});
