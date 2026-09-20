import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/profile_context.dart';
import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../business/business_providers.dart';
import '../profile/profile_repository.dart';

/// LAYK VA OBUNA HOLATI — EKRANLAR ORASIDA BITTA.
///
/// Ilgari har bir ekran o'z holatini saqlardi: `PostScreen` da
/// `_likedOverride` va `_likeDelta` degan MAHALLIY maydonlar bor
/// edi. Natijada lentada bosilgan layk post ochilganda
/// ko'rinmasdi va aksincha — ikki ekran bir xil postni boshqa-
/// boshqacha ko'rsatardi.
///
/// Bu yerda holat bitta joyda turadi, shuning uchun lenta, post
/// tafsiloti va profil avtomatik mos bo'ladi.

/// Bitta postning layk holati.
typedef LikeState = ({bool liked, int count});

class PostLikes extends StateNotifier<Map<int, LikeState>> {
  PostLikes(this._ref) : super(const {});
  final Ref _ref;

  /// Postning HOZIRGI holati: mahalliy o'zgarish bo'lsa o'sha,
  /// aks holda serverdan kelgani.
  LikeState of(Post p) => state[p.id] ?? (liked: p.liked, count: p.likes);

  /// Bosilganda holat DARHOL o'zgaradi, so'ng server javobi
  /// o'rnatiladi. Xato bo'lsa eski holatga qaytadi.
  Future<void> toggle(Post p) async {
    final before = state[p.id];
    final now = of(p);
    state = {
      ...state,
      p.id: (liked: !now.liked, count: now.count + (now.liked ? -1 : 1)),
    };

    final res = await _ref.read(socialRepositoryProvider).like(p.id);
    res.when(
      // Server SANOQNI ham qaytaradi — mahalliy taxmin emas, o'sha
      // o'rnatiladi: boshqa qurilmadan bosilgan layklar ham
      // hisobga olinadi.
      ok: (v) => state = {...state, p.id: (liked: v.liked, count: v.count)},
      err: (_) {
        final m = {...state};
        if (before == null) {
          m.remove(p.id);
        } else {
          m[p.id] = before;
        }
        state = m;
      },
    );
  }
}

final postLikesProvider = StateNotifierProvider<PostLikes, Map<int, LikeState>>(
  PostLikes.new,
);

/// O'ZIM OBUNA BO'LGANLAR — serverdan bir marta o'qiladi.
///
/// Busiz har bir begona post ostida "Obuna bo'lish" turardi, hatto
/// allaqachon obuna bo'lgan odamda ham. Ya'ni tugma holatni emas,
/// TAXMINNI ko'rsatardi.
final myFollowingProvider = FutureProvider<Set<String>>((ref) async {
  final me = ref.watch(activePersonalProvider);
  if (me == null) return const <String>{};
  final res = await ref
      .read(profileRepositoryProvider)
      .followList(me.code, type: 'following');
  return res.when(
    ok: (list) => list.map((e) => e.code).toSet(),
    // Xato yutiladi: obuna ro'yxati kelmasa ham lenta ishlashi
    // kerak, shunchaki tugma "obuna bo'lish" holatida qoladi.
    err: (_) => const <String>{},
  );
});

/// Mahalliy o'zgarishlar — `code -> obunamanmi`.
///
/// Serverdan kelgan ro'yxat USTIDAN yoziladi, shuning uchun
/// bosilgan tugma darhol o'zgaradi.
class FollowOverrides extends StateNotifier<Map<String, bool>> {
  FollowOverrides(this._ref) : super(const {});
  final Ref _ref;

  Future<void> toggle(String code, {required bool following}) async {
    final before = state[code];
    state = {...state, code: !following};

    final repo = _ref.read(profileRepositoryProvider);
    final res = following ? await repo.unfollow(code) : await repo.follow(code);
    res.when(
      ok: (_) {},
      err: (_) {
        final m = {...state};
        if (before == null) {
          m.remove(code);
        } else {
          m[code] = before;
        }
        state = m;
      },
    );
  }
}

final followOverridesProvider =
    StateNotifierProvider<FollowOverrides, Map<String, bool>>(
      FollowOverrides.new,
    );

/// Shu kodga obunamanmi — serverdagi ro'yxat + mahalliy o'zgarish.
final followingOfProvider = Provider.family<bool, String>((ref, code) {
  final override = ref.watch(followOverridesProvider)[code];
  if (override != null) return override;
  final seed = ref.watch(myFollowingProvider).valueOrNull;
  return seed?.contains(code) ?? false;
});

/// Bu yozuv MENIKIMI — o'z postimda obuna tugmasi chizilmaydi.
final isMineProvider = Provider.family<bool, String>((ref, code) {
  if (code.isEmpty) return true;
  final personal = ref.watch(personalIdsProvider).any((e) => e.code == code);
  if (personal) return true;
  final companies = ref.watch(myBusinessesProvider).valueOrNull;
  return companies?.any((c) => c.companyId == code) ?? false;
});
