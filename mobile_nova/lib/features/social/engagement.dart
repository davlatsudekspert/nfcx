import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/profile_context.dart';
import '../../core/errors/app_error.dart';
import '../../core/utils/result.dart';
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

/// Layk holati kaliti: tur + id.
///
/// Kompaniya va shaxsiy postlarning `id` lari ALOHIDA sanaladi —
/// faqat `id` bo'yicha saqlansa, kompaniyaning 7-posti bosilganda
/// shaxsiy 7-postning yuragi ham qizarardi.
String likeKey(Post p) => '${p.isCompany ? 'c' : 'p'}:${p.id}';

class PostLikes extends StateNotifier<Map<String, LikeState>> {
  PostLikes(this._ref) : super(const {});
  final Ref _ref;

  /// Hozir serverga ketayotgan postlar.
  ///
  /// IKKI MARTA BOSISH HIMOYASI. Busiz tez ikki marta bosilganda
  /// serverga IKKI so'rov ketardi va layk ikki marta o'girilib,
  /// natijada odam bosgani YO'QOLARDI. Ustiga ikkinchi so'rovning
  /// "eski holati" birinchisining OPTIMISTIK qiymati bo'lardi —
  /// ya'ni xato bo'lganda hech qachon serverda turmagan holatga
  /// "qaytarilardi".
  final _busy = <String>{};

  bool isBusy(Post p) => _busy.contains(likeKey(p));

  /// Postning HOZIRGI holati: mahalliy o'zgarish bo'lsa o'sha,
  /// aks holda serverdan kelgani.
  LikeState of(Post p) =>
      state[likeKey(p)] ?? (liked: p.liked, count: p.likes);

  /// Bosilganda holat DARHOL o'zgaradi, so'ng server javobi
  /// o'rnatiladi.
  ///
  /// `null` qaytsa — o'tdi. Xato qaytsa holat ESKISIGA qaytgan
  /// bo'ladi va chaqiruvchi buni foydalanuvchiga ko'rsatishi
  /// kerak: jimgina orqaga qaytgan yurak odamni chalg'itadi.
  Future<AppError?> toggle(Post p) async {
    final k = likeKey(p);
    if (_busy.contains(k)) return null;
    _busy.add(k);

    final before = state[k];
    final now = of(p);
    state = {
      ...state,
      k: (liked: !now.liked, count: now.count + (now.liked ? -1 : 1)),
    };

    final res = await _ref
        .read(socialRepositoryProvider)
        .like(p.id, company: p.isCompany);
    _busy.remove(k);
    // Ekran yopilgan bo'lsa holatga tegmaymiz — `StateNotifier`
    // o'chirilgandan keyin yozish istisno beradi.
    if (!mounted) return null;

    return res.when(
      // Server SANOQNI ham qaytaradi — mahalliy taxmin emas, o'sha
      // o'rnatiladi: boshqa qurilmadan bosilgan layklar ham
      // hisobga olinadi.
      ok: (v) {
        state = {...state, k: (liked: v.liked, count: v.count)};
        return null;
      },
      err: (e) {
        final m = {...state};
        if (before == null) {
          m.remove(k);
        } else {
          m[k] = before;
        }
        state = m;
        return e;
      },
    );
  }
}

final postLikesProvider =
    StateNotifierProvider<PostLikes, Map<String, LikeState>>(
  PostLikes.new,
);

/// O'ZIM OBUNA BO'LGANLAR — serverdan bir marta o'qiladi.
///
/// Busiz har bir begona post ostida "Obuna bo'lish" turardi, hatto
/// allaqachon obuna bo'lgan odamda ham. Ya'ni tugma holatni emas,
/// TAXMINNI ko'rsatardi.
///
/// `dependencies` SHART: busiz bu provayder demo `ProviderScope`
/// ichida ham ILDIZ doirasidan o'qilardi, ya'ni demo profil
/// ochilganda HAQIQIY hisob uchun tarmoq so'rovi ketardi va obuna
/// tugmasining holati haqiqiy hisobdan hisoblanardi. Demo hech
/// qachon haqiqiy ma'lumotga tegmasligi kerak.
final myFollowingProvider = FutureProvider<Set<String>>(
    dependencies: [profileRepositoryProvider, activePersonalProvider],
    (ref) async {
  final me = ref.watch(activePersonalProvider);
  if (me == null) return const <String>{};
  final res = await ref
      .read(profileRepositoryProvider)
      .followList(me.code, dir: 'following');
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

  /// Hozir serverga ketayotgan kodlar — layk bilan bir xil sabab:
  /// ikki marta bosilganda obuna qo'yilib, darhol yechilardi.
  final _busy = <String>{};

  bool isBusy(String code) => _busy.contains(code);

  /// `null` qaytsa — o'tdi, aks holda holat eskisiga qaytgan.
  ///
  /// [company] — kod kompaniya identifikatori (Business ID).
  Future<AppError?> toggle(String code,
      {required bool following, bool company = false}) async {
    if (_busy.contains(code)) return null;
    _busy.add(code);

    final before = state[code];
    state = {...state, code: !following};

    final repo = _ref.read(profileRepositoryProvider);
    final Result<void> res;
    if (company) {
      final r = await repo.toggleCompanyFollow(code);
      // Toggle: server holatni o'zi aytadi — kutilgani bilan mos
      // kelmasa (boshqa qurilmadan o'zgargan), server haqiqati olinadi.
      if (r case Ok(:final value)) state = {...state, code: value};
      res = r.map((_) {});
    } else {
      res = following ? await repo.unfollow(code) : await repo.follow(code);
    }
    _busy.remove(code);
    if (!mounted) return null;

    return res.when(
      ok: (_) {
        // SON SERVER TASDIQLAGANDAN KEYIN YANGILANADI.
        //
        // Mahalliy sanoqni oshirib qo'yish yolg'on bo'lardi:
        // boshqa qurilmadan qilingan o'zgarish hisobga olinmasdi.
        // Shuning uchun raqam manbasi qayta o'qiladi.
        _ref.invalidate(followStatsProvider(code));
        final me = _ref.read(activePersonalProvider);
        if (me != null) _ref.invalidate(followStatsProvider(me.code));
        _ref.invalidate(myFollowingProvider);
        return null;
      },
      err: (e) {
        final m = {...state};
        if (before == null) {
          m.remove(code);
        } else {
          m[code] = before;
        }
        state = m;
        return e;
      },
    );
  }
}

final followOverridesProvider =
    StateNotifierProvider<FollowOverrides, Map<String, bool>>(
      FollowOverrides.new,
    );

/// Shu kodga obunamanmi — serverdagi ro'yxat + mahalliy o'zgarish.
/// `myFollowingProvider` doiralangani uchun buni ham doiralash
/// SHART: aks holda Riverpod "dependencies were overridden" deb
/// istisno tashlaydi va ekran bo'sh chiqadi.
/// Bitta profilning ko'rsatkichlari — SERVERDAN.
///
/// `/api/follow-stats/:code` uchta narsani birga beradi:
/// obunachilar, obunalar va TASHRIFCHI OBUNAMI (`isFollowing`).
/// Oxirgisini server o'z sessiyasi bo'yicha hisoblaydi, ya'ni
/// tugmaning holati uchun eng ishonchli manba shu.
///
/// Ro'yxatga (`myFollowingProvider`) tayanib bo'lmaydi: u 200 ta
/// yozuv bilan cheklangan va faqat lentadagi ko'p kartani bir
/// so'rovda urug'lantirish uchun. Profil ochilganda esa ANIQ
/// javob kerak.
/// XATODA `null` — NOL EMAS.
///
/// Bu farq muhim. Agar xato holatida `(0, 0, false)` qaytarilsa,
/// "javob yo'q" bilan "obuna emas" bir xil ma'noga ega bo'lib
/// qoladi: tarmoq uzilganda tugma ishonch bilan "Kuzatish" deb
/// ko'rsatardi va lentadagi ro'yxat urug'ini ham bosib ketardi.
/// `null` esa "bilmayman" degani — quyidagi provayder urug'ga
/// qaytadi, sonlar esa chizilmaydi.
final followStatsProvider =
    FutureProvider.family<FollowStats?, String>(
        dependencies: [profileRepositoryProvider], (ref, code) async {
  if (code.isEmpty) return null;
  final res = await ref.read(profileRepositoryProvider).followStats(code);
  return res.when(ok: (v) => v, err: (_) => null);
});

/// Shu kodga obunamanmi.
///
/// Tartib MUHIM:
///   1. mahalliy o'zgarish (endigina bosilgan tugma);
///   2. `follow-stats` dan kelgan ANIQ javob;
///   3. lentadagi ro'yxat urug'i.
///
/// Ilgari faqat 3-manba bor edi va u kontrakt xatosi tufayli DOIM
/// bo'sh edi — shuning uchun tugma har doim "Kuzatish" ko'rsatardi
/// va bosilganda server 409 qaytarardi.
final followingOfProvider = Provider.family<bool, String>(
    dependencies: [
      myFollowingProvider,
      followOverridesProvider,
      followStatsProvider,
    ],
    (ref, code) {
  final override = ref.watch(followOverridesProvider)[code];
  if (override != null) return override;
  final stats = ref.watch(followStatsProvider(code)).valueOrNull;
  if (stats != null) return stats.isFollowing;
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
