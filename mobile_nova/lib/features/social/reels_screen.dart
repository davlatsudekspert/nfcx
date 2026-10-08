import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../app/profile_context.dart';
import '../../app/providers.dart';
import '../auth/session.dart' show currentUserProvider;
import 'comments.dart';
import 'engagement.dart';
import 'fullscreen_video.dart' show immersiveVideoFit;
import 'moderation.dart';
import 'media_frame.dart' show mediaImage;
import 'media_sound.dart';
import 'music_picker.dart';
import 'post_contact_bar.dart';

import '../../core/utils/result.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../data/repositories/saves_repository.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/widgets/id_plate.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_icon.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../../routing/shell.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import '../profile/music_player.dart';
import '../../design/icons/nova_icons.dart';
import '../premium/boost_controller.dart' show iapBoostEnabledProvider;
import '../premium/boost_sheet.dart' show showBoostSheet;

/// Ovoz o'chirilganmi — BUTUN lenta uchun bitta holat.
///
/// Sahifa bo'yicha saqlansa, har silashda ovoz qaytadan yonib
/// ketardi. Bu yerda `autoDispose` ATAYLAB yo'q: ekrandan chiqib
/// qaytganda ham tanlov saqlanadi.
// Lenta bilan UMUMIY holat (media_sound.dart) — bir joyda o'chirilsa,
// ikkinchisida ham o'chiq.
final reelsMutedProvider = mediaMutedProvider;

/// REELS SAHIFALARI — "Reels" tabining DAVOMI (2026-10-06, `/api/reels`).
///
/// Ro'yxatning o'zi `reelsProvider` da (testlar uni tayyor ro'yxat
/// bilan almashtiradi), bu esa uning davomini so'raydi: ekran
/// ko'rinayotgan reel oxirga 3 tagacha yaqinlashganda [nearEnd] ni
/// chaqiradi, `reelsProvider` keyingi sahifani olib ro'yxat OXIRIGA
/// qo'shadi. Oldingi reel'lar o'rnidan siljimaydi va o'chirilmaydi —
/// o'ynayotgan video sakrab ketmaydi.
///
/// Eski manbada (yoki `reelsProvider` almashtirilgan bo'lsa) ulanmagan
/// turadi: [hasMore] `false`, chaqiruvlar hech narsa qilmaydi.
class ReelsPager {
  Future<void> Function()? _more;
  bool _hasMore = false;
  bool _loading = false;

  /// Serverda davomi bor va u hali olinmagan.
  bool get hasMore => _more != null && _hasMore;

  /// Ko'rinayotgan reel [index] ([length] talik ro'yxatda) oxirga
  /// 3 tagacha yaqin bo'lsa — keyingi sahifa so'raladi.
  void nearEnd(int index, int length) {
    if (index >= length - 3) unawaited(loadMore());
  }

  /// Keyingi sahifa. Bir vaqtda bittadan ortiq so'rov ketmaydi.
  Future<void> loadMore() async {
    final more = _more;
    if (more == null || !_hasMore || _loading) return;
    _loading = true;
    try {
      await more();
    } finally {
      // Ro'yxat shu orada qayta yuklangan bo'lsa — yangisiga tegilmaydi.
      if (identical(_more, more)) _loading = false;
    }
  }

  void _attach(Future<void> Function() more, {required bool hasMore}) {
    _more = more;
    _hasMore = hasMore;
    _loading = false;
  }

  void _detach() {
    _more = null;
    _hasMore = false;
    _loading = false;
  }
}

final reelsPagerProvider =
    Provider.autoDispose<ReelsPager>((ref) => ReelsPager());

/// Reels manbai — SHAXSIY LENTA (`/api/reels`), u bo'lmasa LENTA va
/// O'Z VIDEOLARIM.
///
/// 2026-10-06: server har kimga o'z tartibidagi, sahifalangan Reels
/// beradi (davomi — [ReelsPager]). ESKI SERVERDA bu manzil yo'q
/// (404) yoki birinchi sahifa xato/bo'sh kelsa — quyidagi eski manba
/// ishlatiladi: Reels hech qachon eski server sababli bo'sh qolmaydi.
///
/// Ilgari bu yerda faqat `feed()` turardi. `/api/feed` esa OBUNA
/// bo'linganlarning kontentini beradi, shuning uchun o'z reelingni
/// joylab, Reels bo'limini ochganingda u yerda "Hozircha reels
/// yo'q" chiqardi — o'zingga obuna bo'lolmaysan. Hisobda obuna
/// yo'q bo'lsa bo'lim BUTUNLAY bo'sh turardi.
///
/// Endi faol profilning o'z videolari ham qo'shiladi. O'z
/// videolarini o'qishdagi xato YUTILADI: lenta kelgan bo'lsa
/// bo'lim baribir ishlashi kerak.
final reelsProvider = FutureProvider.autoDispose<List<Post>>((ref) async {
  // KESH (2026-10-05): Reels bo'limidan chiqilganda ro'yxat 10 daqiqa
  // saqlanadi. Ilgari har kirishda lenta qaytadan so'ralar va ~1-3 s
  // bo'sh ekran turardi ("ochilishi sekin"). Asosiy ekran
  // olgan lenta esa qayta so'ralmaydi (`recentFeed`).
  //
  // Taymer YO'Q (testlarda osilib qolardi): bo'limga qaytilganda
  // ro'yxat 10 daqiqadan eski bo'lsa o'zi qayta yuklanadi.
  ref.keepAlive();
  final loadedAt = DateTime.now();
  ref.onResume(() {
    if (DateTime.now().difference(loadedAt) > const Duration(minutes: 10)) {
      ref.invalidateSelf();
    }
  });

  final repo = ref.watch(socialRepositoryProvider);
  // Video YOKI rasmli reel (rasm 10 soniya turadi — egasi, 2026-09-25).
  bool playable(Post p) => p.inReels && p.mediaUrls.isNotEmpty;

  // `likeKey` bo'yicha yig'iladi: bir video ikkala manbada ham
  // bo'lishi mumkin (o'z kompaniyangga obuna bo'lsang). Faqat `id`
  // EMAS: shaxsiy 7-post va kompaniyaning 7-posti — ikki xil reel,
  // ilgari ulardan biri jim yo'qolardi.
  final byId = <String, Post>{};

  // FAQAT KOD KUZATILADI. Profil obyekti har sessiya yangilanishida
  // (`refresh()`) yangi bo'ladi — butun obyekt kuzatilsa, Reels har
  // safar qayta yuklanib, o'ynayotgan video to'xtab boshidan
  // boshlanardi. Kod faqat profil almashganda o'zgaradi.
  final code = ref.watch(activeProfileProvider.select((p) => p?.code));
  var disposed = false;
  ref.onDispose(() => disposed = true);

  // ── SHAXSIY LENTA ─────────────────────────────────────────────
  // Davomi faqat SHU ro'yxatniki: qayta yuklanganda boshidan.
  final pager = ref.watch(reelsPagerProvider).._detach();
  final page = (await repo.reelsPage()).valueOrNull;
  final fresh = <String, Post>{};
  for (final p in page?.items ?? const <Post>[]) {
    if (playable(p)) fresh.putIfAbsent(likeKey(p), () => p);
  }
  if (page != null && fresh.isNotEmpty) {
    var cursor = page.nextCursor;
    Future<void> more() async {
      // Sahifada yangi reel bo'lmasa (hammasi takror yoki rasmli post)
      // ketma-ket 3 tagacha so'raladi, keyin davomi to'xtatiladi.
      for (var tries = 0; tries < 3 && pager._hasMore; tries++) {
        final r = await repo.reelsPage(cursor: cursor);
        if (disposed) return;
        final cur = ref.state.valueOrNull;
        if (cur == null) return;
        final next = r.valueOrNull;
        // Xato — davomi SHU ro'yxat uchun to'xtaydi va oxirida yana
        // boshiga aylanadi (o'lik nuqta yo'q). Tortib yangilash yoki
        // 10 daqiqadan keyingi qayta yuklash davomini qaytaradi.
        pager._hasMore = next?.hasMore ?? false;
        cursor = next?.nextCursor;
        final have = {for (final p in cur) likeKey(p)};
        final add = [
          for (final p in next?.items ?? const <Post>[])
            if (playable(p) && have.add(likeKey(p))) p,
        ];
        // Yangi ro'yxat obyekti HAR DOIM — `hasMore` o'zgargani ham
        // ekranga yetib borsin (cheksiz aylanish shunga qarab yoqiladi).
        ref.state = AsyncData([...cur, ...add]);
        if (add.isNotEmpty) return;
      }
      final cur = ref.state.valueOrNull;
      if (disposed || cur == null || !pager._hasMore) return;
      pager._hasMore = false;
      ref.state = AsyncData([...cur]);
    }

    // Shu orada qayta yuklangan bo'lsa — yangi ro'yxatning davomiga
    // eski sahifa belgisi ulanmasin.
    if (!disposed) pager._attach(more, hasMore: page.hasMore);
    return fresh.values.toList();
  }

  // ── ESKI MANBA: LENTA + O'Z VIDEOLARIM ────────────────────────
  // Ikki so'rov BIR VAQTDA. LENTA O'Z VIDEOLARIMNI KUTMAYDI
  // (2026-10-05, egasi: "Reels ochilishi sekin"): lenta odatda
  // Asosiy ekrandan tayyor turadi (`recentFeed`), o'z postlarim esa
  // tarmoqdan keladi. Ilgari ikkalasi ham kutilardi, ya'ni tayyor
  // lenta ham `/posts` javobigacha bo'sh ekran ortida turardi.
  //
  // O'z videolarim lentadan OLDIN kelsa — avvalgidek boshida turadi.
  // Keyin kelsa — ro'yxat OXIRIGA qo'shiladi: ko'rilayotgan reel
  // o'rnidan siljimaydi.
  Result<List<Post>>? own;
  final ownF = code == null ? null : repo.postsOf(code);
  ownF?.then((r) => own = r);

  void addOwn(Result<List<Post>>? r) {
    r?.when(
      ok: (items) {
        for (final p in items.where(playable)) {
          byId[likeKey(p)] = p;
        }
      },
      err: (_) {},
    );
  }

  // Asosiy ekran olgan lenta qayta ishlatiladi (3 daqiqa).
  final res = await repo.recentFeed();
  // Lenta kelmadi — o'z videolarim bo'lsa ular ko'rsatiladi, shuning
  // uchun bu holatda ular KUTILADI.
  if (ownF != null && own == null && !res.isOk) own = await ownF;
  addOwn(own);
  if (ownF != null && own == null) {
    ownF.then((r) {
      if (disposed) return;
      final cur = ref.state.valueOrNull;
      if (cur == null) return;
      final have = {for (final p in cur) likeKey(p)};
      final add = (r.valueOrNull ?? const <Post>[])
          .where((p) => playable(p) && !have.contains(likeKey(p)))
          .toList();
      if (add.isNotEmpty) ref.state = AsyncData([...cur, ...add]);
    });
  }

  return res.when(
    ok: (items) {
      for (final p in items.where(playable)) {
        byId[likeKey(p)] = p;
      }
      return byId.values.toList();
    },
    // Lenta kelmasa — bu haqiqiy xato va ekran shuni ko'rsatishi
    // kerak. Lekin o'z videolarim kelgan bo'lsa ularni ko'rsatish
    // hech narsadan yaxshiroq.
    err: (e) => byId.isEmpty ? throw e : byId.values.toList(),
  );
});

/// "QIZIQ EMAS" deb yashirilgan reel'lar (`likeKey`) — shu ilova
/// seansida darhol. Serverga ham aytiladi (`hideReel`), u keyingi
/// sahifalarda bu reelni bermaydi; javobi kutilmaydi.
///
/// Ro'yxatning o'zi (`reelsProvider`) o'zgartirilmaydi: u keshlanadi
/// va qayta yuklanganda yashirilgan reel yana chiqib qolardi. Shuning
/// uchun ekran ro'yxatni shu to'plam bilan suzib ko'rsatadi.
final reelsHiddenProvider = StateProvider<Set<String>>((ref) => const {});

/// Reels tepasidagi tab: "Reels" (hamma) yoki "Do'stlar" (obunalar).
///
/// `autoDispose` YO'Q: boshqa bo'limga o'tib qaytganda tanlov saqlanadi.
enum ReelsTab { all, following }

final reelsTabProvider = StateProvider<ReelsTab>((ref) => ReelsTab.all);

/// "DO'STLAR" — faqat obuna bo'lingan odam va kompaniyalarning reels'i
/// (egasi, 2026-10-05: "Reels | Do'stlar" — Instagram kabi).
///
/// Server: `/api/feed?scope=following` (reklamasiz). Kesh qoidasi
/// `reelsProvider` bilan bir xil: 10 daqiqa, keyin qaytganda yangilanadi.
final followingReelsProvider =
    FutureProvider.autoDispose<List<Post>>((ref) async {
  ref.keepAlive();
  final loadedAt = DateTime.now();
  ref.onResume(() {
    if (DateTime.now().difference(loadedAt) > const Duration(minutes: 10)) {
      ref.invalidateSelf();
    }
  });
  // Profil almashsa (boshqa hisob) ro'yxat ham boshqa.
  ref.watch(activeProfileProvider.select((p) => p?.code));
  final res = await ref.watch(socialRepositoryProvider).followingFeed();
  final byKey = <String, Post>{};
  for (final p in res.valueOrNull ?? const <Post>[]) {
    if (p.inReels && p.mediaUrls.isNotEmpty) byKey[likeKey(p)] = p;
  }
  return res.when(ok: (_) => byKey.values.toList(), err: (e) => throw e);
});


/// REELS VIDEOSINI OCHISH CHEGARASI (egasi, 2026-10: "bir video
/// yuklanmasa keyingisiga o'tish va retry ishlasin").
///
/// `initialize()` javob bermay osilib qolsa, reel qora/aylanuvchi holda
/// abadiy turardi va keyingi reelni oldindan yuklash ham kutib qolardi.
/// Muddat o'tsa — "qayta urinish" holati (bosilsa yangi pleyer).
const reelsInitTimeout = Duration(seconds: 20);

/// Reel ekranda shuncha turgandan keyin "ko'rildi" deb yuboriladi —
/// tez aylantirib o'tilgani sanalmaydi.
const kViewAfter = Duration(seconds: 2);

/// KO'RISH SEANSI — Reels va post tafsiloti uchun bitta qoida
/// (egasi, 2026-10-04: "har qanday seansda ham bir marta ko'rib
/// bo'lib qayta kirib 2 sekund ko'rsa prosmotr bo'lishi kerak").
///
/// Seans — kontent UZLUKSIZ ko'rinib turgan vaqt: [update] ga
/// `onScreen: true` berilgan VA ilova oldinda (`resumed` yoki
/// `inactive`). Seansda [kViewAfter] o'tsa [_send] BIR MARTA
/// chaqiriladi; video o'sha joyda aylanib turaversa qayta
/// chaqirilmaydi.
///
/// Seans tugaydi: `onScreen: false` (boshqa reelga o'tildi, boshqa
/// tab, ustiga boshqa ekran ochildi) yoki ilova fonga ketdi
/// (`hidden`/`paused`/`detached`). Shunda taymer bekor qilinadi va
/// "yuborildi" belgisi o'chadi — qaytib yana 2 soniya ko'rsa, yana
/// yuboriladi. Egasining o'z ko'rishini va 2 soniyadan tez qayta
/// yuborishni server o'zi sanamaydi.
class ViewSession with WidgetsBindingObserver {
  ViewSession(this._send) {
    WidgetsBinding.instance.addObserver(this);
  }

  final VoidCallback _send;

  bool _onScreen = false;
  bool _foreground =
      _isForeground(WidgetsBinding.instance.lifecycleState);
  bool _sent = false;
  Timer? _timer;

  // FAQAT `hidden`/`paused`/`detached` — fon.
  //
  // `inactive` — ilova hali ko'rinib turibdi, video o'ynayveradi:
  // bildirishnoma pardasi, reelning o'z "Ulashish" tugmasidan
  // ochilgan Android ulashish oynasi, iOS boshqaruv markazi,
  // biometrika/tizim oynasi. Ilgari u ham seansni uzardi va oyna
  // yopilgach 2 soniyada o'sha ko'rish YANA sanalardi.
  //
  // `null` — holat hali kelmagan (testlar, ilova endi ochilmoqda):
  // oldinda deb hisoblanadi.
  static bool _isForeground(AppLifecycleState? s) => switch (s) {
        AppLifecycleState.hidden ||
        AppLifecycleState.paused ||
        AppLifecycleState.detached =>
          false,
        _ => true,
      };

  bool get _watching => _onScreen && _foreground;

  /// Kontent hozir ekranda ko'rinib turibdimi (ilova holatidan
  /// tashqari — uni [ViewSession] o'zi kuzatadi).
  void update({required bool onScreen}) {
    _onScreen = onScreen;
    _apply();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = _isForeground(state);
    _apply();
  }

  void _apply() {
    if (!_watching) {
      // Seans tugadi — keyingi kirish yangi ko'rish.
      _timer?.cancel();
      _timer = null;
      _sent = false;
      return;
    }
    if (_sent || _timer != null) return;
    _timer = Timer(kViewAfter, () {
      _timer = null;
      if (!_watching || _sent) return;
      _sent = true;
      _send();
    });
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
    WidgetsBinding.instance.removeObserver(this);
  }
}

/// Saqlangan Reels — `toggleReel` qulaylik uchun.
extension SavedReelsX on SyncedSaves {
  /// `true` — endi saqlangan.
  Future<bool> toggleReel(Post p) => toggle(likeKey(p));
}

/// Saqlangan Reels — HISOBGA bog'langan (`/api/saves`), telefon xotirasi
/// faqat kesh (hisob bo'yicha). Hisob almashsa provayder qaytadan
/// quriladi — boshqa odamning ro'yxati ko'rinmaydi. Batafsil:
/// `SyncedSaves`.
final savedReelsProvider =
    StateNotifierProvider<SyncedSaves, Set<String>>((ref) {
  final uid = ref.watch(currentUserProvider.select((u) => u?.id));
  return SyncedSaves.forUser(ref.watch(savesRepositoryProvider),
      SaveKind.reel, ref.watch(prefsProvider), uid);
});

/// Vertikal Reels lentasi.
///
/// XOTIRA VA SILLIQLIK:
///   * bir vaqtda ko'pi bilan IKKI video kontrolleri yashaydi —
///     ko'rinib turgani va KEYINGISI (oldindan yuklangan, pauzada).
///     Silaganda keyingi video darhol boshlanadi, spinner kutilmaydi;
///   * qolganlari yo'q qilinadi — o'nta 1080p video RAM'ni to'ldirib
///     ilovani o'ldirardi;
///   * Reels tabidan chiqilganda (pastki navigatsiya) HAMMASI to'xtaydi
///     va yo'q qilinadi — boshqa bo'limda ovoz eshitilmaydi.
class ReelsScreen extends ConsumerStatefulWidget {
  const ReelsScreen({super.key});

  @override
  ConsumerState<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends ConsumerState<ReelsScreen> {
  var _page = PageController();
  int _index = 0;

  /// Qaysi sahifa O'YNAY BOSHLADI (initialize + play). Keyingi reel
  /// shundan KEYIN yuklanadi.
  ///
  /// O'LCHOV (emulyator, 2026-09): ilgari ko'rinayotgan va keyingi
  /// reel BIR LAHZADA ochilardi va tarmoqni bo'lishardi; pauzadagi
  /// oldindan yuklangan video esa 5 soniyada 35 soniyalik videoning
  /// HAMMASINI yuklab oldi (ExoPlayer pauzada ham buferni to'ldiradi).
  /// Shuning uchun: avval ko'rinayotgani, keyin FAQAT BITTA keyingisi.
  int _started = -1;

  void _markStarted(int i) {
    if (mounted && _started != i) setState(() => _started = i);
  }

  // TIZIM PANELLARI YASHIRILMAYDI (2026-09-24). `immersiveSticky` dan
  // qaytish Android'da oynani boshlang'ich holatiga emas, panel kontent
  // USTIDA turadigan rejimga o'tkazardi (egasining telefonida pastki
  // tizim paneli shaffof bo'lib qoldi). Toza rejim ilova belgilari va
  // pastki panelni yashiradi; soat/batareya qora fonda oq — Instagram
  // Reels ham shunday.

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  /// Tab almashdi — yangi ro'yxat BOSHIDAN ochiladi. Varaq uchun yangi
  /// kontroller: eski `PageView` shu kadrda hali yo'q qilinmagan, bitta
  /// kontroller ikki ro'yxatga ulanib qolmasin. Eskisi kadrdan keyin
  /// yo'q qilinadi.
  void _switchTab(ReelsTab tab) {
    final cur = ref.read(reelsTabProvider);
    if (cur == tab) {
      // Tanlangan tab yana bosildi — tepaga (Instagram kabi).
      if (_page.hasClients && _index != 0) {
        _page.animateToPage(0,
            duration: const Duration(milliseconds: 320),
            curve: Curves.easeOutCubic);
      }
      return;
    }
    final old = _page;
    setState(() {
      _page = PageController();
      _index = 0;
      _started = -1;
    });
    ref.read(reelsTabProvider.notifier).state = tab;
    WidgetsBinding.instance.addPostFrameCallback((_) => old.dispose());
  }

  @override
  Widget build(BuildContext context) {
    // Reels — pastki navigatsiyaning 4-tabi (`HomeShell.tabRoutes`).
    // `select`: faqat Reels'ga kirish/chiqishda qayta quriladi — ilgari
    // HAR tab almashishida (Profil -> Asosiy ham) yashirin Reels va
    // uning 2-3 sahifasi behuda qayta qurilardi.
    final onReelsTab = ref.watch(activeTabProvider.select((i) => i == 3));
    // Tabdan chiqilganda kontrollerlar yo'q qilinadi — qaytganda
    // ko'rinayotgani yana birinchi bo'lib ochiladi.
    if (!onReelsTab) _started = -1;
    final l = L.of(context);
    final tab = ref.watch(reelsTabProvider);
    final following = tab == ReelsTab.following;
    final source = following ? followingReelsProvider : reelsProvider;
    final reels = ref.watch(source);
    // "Reels" tabining davomi (`/api/reels` keyingi sahifalari).
    final pager = ref.watch(reelsPagerProvider);
    // "Do'stlar" yonidagi yuzlar — faqat Reels ochiq bo'lganda so'raladi.
    final friends = onReelsTab
        ? (ref.watch(followingReelsProvider).valueOrNull ?? const <Post>[])
        : const <Post>[];
    final hidden = ref.watch(reelsHiddenProvider);
    // Ko'rinayotgan reel yashirildi — o'rniga keyingisi keladi va u hali
    // O'YNAY BOSHLAMAGAN: undan keyingisi oldindan yuklanib tarmoqni
    // bo'lmasin (`_started` izohiga qarang).
    ref.listen(reelsHiddenProvider, (_, __) => _started = -1);
    final clean = ref.watch(reelsCleanProvider);
    // Boshqa tabga o'tildi — toza rejim o'z-o'zidan tugaydi, aks holda
    // boshqa bo'limda pastki panel yashirin qolardi.
    if (!onReelsTab && clean) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.read(reelsCleanProvider.notifier).state = false;
      });
    }

    // "ORQAGA" AVVAL TOZA REJIMDAN CHIQARADI.
    //
    // `PopScope` bu yerda ishlamaydi: Reels — tab ILDIZI, go_router esa
    // "orqaga" ni pop qila oladigan navigatorga yuboradi (bu — ildiz
    // navigator) va ilova yopilib qolardi. `BackButtonListener` esa
    // Router'ning o'zidan birinchi bo'lib so'raladi.
    return _BackGuard(
      onBack: () {
        final c = ref.read(reelsCleanProvider.notifier);
        if (!onReelsTab || !c.state) return false;
        c.state = false;
        return true;
      },
      child: Scaffold(
      backgroundColor: Colors.black,
      extendBody: true,
      // Qayta yuklashda (profil almashdi) eski lenta turadi — sahifa
      // joyi va `_index` yangi ro'yxat kelguncha mos qoladi.
      body: reels.when(
        skipLoadingOnReload: true,
        loading: () => const Center(
          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
        ),
        error: (e, __) => StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () => ref.invalidate(source),
          onDark: true,
        ),
        data: (all) {
          final items = hidden.isEmpty
              ? all
              : all.where((p) => !hidden.contains(likeKey(p))).toList();
          // Bitta reel qoldi — sahifalar endi cheksiz emas
          // (`itemCount: 1`), varaq esa 0-sahifadan nariroqda turgan
          // bo'lishi mumkin: boshiga qaytariladi.
          if (items.length == 1 && _index != 0) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              if (_page.hasClients) _page.jumpToPage(0);
              setState(() => _index = 0);
            });
          }
          // DAVOMI BOR — ro'yxat hozircha CHEKLI: oxiriga yetganda boshiga
          // aylanib ketib, keyingi sahifa kelganda reel sakramasin
          // (`i % items.length` uzunlik o'zgarsa boshqa reelni beradi).
          // Oxiriga 3 ta qolganda keyingi sahifa so'raladi. Davomi tugasa
          // (yoki xato bo'lsa) yana cheksiz aylanadi — o'lik nuqta yo'q.
          final paging = !following && pager.hasMore && items.length > 1;
          final bounded = paging && _index < items.length;
          if (paging) {
            final at = _index;
            final len = items.length;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              if (at < len) return pager.nearEnd(at, len);
              // Varaq ro'yxatdan nariroqda (qayta yuklandi yoki reel
              // yashirildi) — AYNAN o'sha reel turgan haqiqiy o'ringa
              // o'tkaziladi, aks holda davomi so'ralmasdi.
              final to = at % len;
              if (_page.hasClients) _page.jumpToPage(to);
              setState(() => _index = to);
            });
          }
          if (items.isEmpty) {
            return Stack(
              children: [
                if (following)
                  StatePanel(
                    key: const ValueKey('reels-following-empty'),
                    icon: Icons.people_alt_rounded,
                    title: l.reelsFriendsEmpty,
                    message: l.reelsFriendsEmptyHint,
                    actionLabel: l.reelsTabAll,
                    onAction: () => _switchTab(ReelsTab.all),
                    onDark: true,
                  )
                else
                  StatePanel(
                    icon: Icons.videocam_off_rounded,
                    title: l.reelsEmpty,
                    message: l.stateEmptyHint,
                    actionLabel: l.reelCreate,
                    onAction: () => context.push(Routes.reelCreate),
                    onDark: true,
                  ),
                _TopBar(
                  tab: tab,
                  friends: friends,
                  onTab: _switchTab,
                  onCreate: () => context.push(Routes.reelCreate),
                ),
              ],
            );
          }
          return Stack(
            children: [
              PageView.builder(
                key: ValueKey(following ? 'reels-pager-friends' : 'reels-pager'),
                controller: _page,
                scrollDirection: Axis.vertical,
                // KEYINGI SAHIFA OLDINDAN QURILADI. Usiz `PageView`
                // faqat ko'rinayotgan sahifani quradi va "oldindan
                // yuklash" hech qachon ishga tushmasdi — har silashda
                // spinner kutilardi.
                allowImplicitScrolling: true,
                // CHEKSIZ AYLANISH (egasi, 2026-09): reels kam bo'lsa
                // ham oxiriga yetganda to'xtamaydi — boshidan davom
                // etadi. `itemCount` yo'q = cheksiz; sahifa raqami
                // ro'yxat uzunligiga bo'linib qoldiq olinadi.
                //
                // KALIT VIRTUAL RAQAM BILAN: bitta reel bo'lsa, qo'shni
                // sahifalar AYNAN bir post bo'ladi va faqat post
                // kaliti ikki marta takrorlanib xato berardi.
                itemCount: items.length == 1
                    ? 1
                    : bounded
                        ? items.length
                        : null,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) => _ReelPage(
                  key: ValueKey('$i:${likeKey(items[i % items.length])}'),
                  post: items[i % items.length],
                  // KO'RINISH IKKI SHARTDAN IBORAT: bu sahifa
                  // ochiqmi VA Reels tabining O'ZI ko'rinyaptimi.
                  // Tablar yopilmaydi, faqat berkitiladi — usiz odam
                  // Profilda turib Reels ovozini eshitardi.
                  visible: i == _index && onReelsTab,
                  preload: i == _index + 1 && onReelsTab,
                  preloadNow: _started == _index,
                  onStarted: () => _markStarted(i),
                  // Rasmli reel vaqti tugadi — keyingisiga o'tiladi.
                  // Bitta reel bo'lsa — o'zi boshidan aylanadi.
                  onFinished: items.length < 2
                      ? null
                      : () {
                          if (!_page.hasClients) return;
                          _page.nextPage(
                            duration: const Duration(milliseconds: 380),
                            curve: Curves.easeOutCubic,
                          );
                        },
                ),
              ),
              _Chrome(
                hidden: clean,
                child: _TopBar(
                  tab: tab,
                  friends: friends,
                  onTab: _switchTab,
                  onCreate: () => context.push(Routes.reelCreate),
                ),
              ),
            ],
          );
        },
      ),
      ),
    );
  }
}

/// "Orqaga" tutqichi — Router bo'lsagina (ilovada doim bor; alohida
/// ekran sinovida esa yo'q).
class _BackGuard extends StatelessWidget {
  const _BackGuard({required this.onBack, required this.child});

  final bool Function() onBack;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (Router.maybeOf(context) == null) return child;
    return BackButtonListener(
      onBackButtonPressed: () async => onBack(),
      child: child,
    );
  }
}

/// Reels ustidagi belgilar — toza rejimda yumshoq yo'qoladi va
/// bosishni o'tkazib yuboradi (video bosilganda qaytadi).
class _Chrome extends StatelessWidget {
  const _Chrome({required this.hidden, required this.child});

  final bool hidden;
  final Widget child;

  @override
  Widget build(BuildContext context) => IgnorePointer(
        ignoring: hidden,
        child: AnimatedOpacity(
          opacity: hidden ? 0 : 1,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          child: child,
        ),
      );
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.onCreate,
    required this.tab,
    required this.onTab,
    this.friends = const <Post>[],
  });
  final VoidCallback onCreate;
  final ReelsTab tab;
  final ValueChanged<ReelsTab> onTab;

  /// "Do'stlar" reels'i — yonida ularning 3 tagacha yuzi turadi.
  final List<Post> friends;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    // Bir odamning bir nechta reel'i bo'lsa ham yuzi bir marta.
    final faces = <Post>[];
    final seen = <String>{};
    for (final p in friends) {
      if (seen.add('${p.authorKind}:${p.code}')) faces.add(p);
      if (faces.length == 3) break;
    }
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.sm),
        child: Row(
          children: [
            // "Reels | Do'stlar" (egasi, 2026-10-05) — Instagram kabi:
            // tanlangani oq va qalin, ikkinchisi xira. Ustidagi kichik
            // "NFCSTORE" yozuvi avvalgidek yo'q.
            _TabLabel(
              key: const ValueKey('reels-tab-all'),
              text: l.navReels,
              active: tab == ReelsTab.all,
              onTap: () => onTab(ReelsTab.all),
            ),
            const SizedBox(width: Gap.md),
            Flexible(
              child: _TabLabel(
                key: const ValueKey('reels-tab-friends'),
                text: l.reelsTabFriends,
                active: tab == ReelsTab.following,
                onTap: () => onTab(ReelsTab.following),
                leading: faces.isEmpty
                    ? null
                    : _FaceStack(
                        key: const ValueKey('reels-friends-faces'),
                        posts: faces,
                      ),
              ),
            ),
            const SizedBox(width: Gap.sm),
            NovaIconButton(
              icon: Icons.add_rounded,
              tooltip: l.reelCreate,
              onPressed: onCreate,
              filled: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _TabLabel extends StatelessWidget {
  const _TabLabel({
    super.key,
    required this.text,
    required this.active,
    required this.onTap,
    this.leading,
  });
  final String text;
  final bool active;
  final VoidCallback onTap;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: active,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: ConstrainedBox(
          // Barmoq uchun kamida 44 pt balandlik.
          constraints: const BoxConstraints(minHeight: 44),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: 6)],
              Flexible(
                child: AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 160),
                  style: AppType.displayStyle(
                    color: active ? Colors.white : Colors.white60,
                    size: active ? 24 : 21,
                    shadows: const [
                      Shadow(color: Colors.black54, blurRadius: 12)
                    ],
                  ),
                  child: Text(
                    text,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bir-birining ustiga tushgan kichik yuzlar (3 tagacha).
class _FaceStack extends StatelessWidget {
  const _FaceStack({super.key, required this.posts});
  final List<Post> posts;

  static const double _size = 22;
  static const double _step = 14;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _size + _step * (posts.length - 1),
      height: _size,
      child: Stack(
        children: [
          for (var i = 0; i < posts.length; i++)
            Positioned(
              left: _step * i,
              child: Container(
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.black,
                ),
                padding: const EdgeInsets.all(1.5),
                child: Avatar(
                  url: posts[i].authorAvatar,
                  initials: posts[i].authorName.isEmpty
                      ? 'N'
                      : posts[i].authorName.substring(0, 1).toUpperCase(),
                  size: _size - 3,
                  ring: false,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ReelPage extends ConsumerStatefulWidget {
  const _ReelPage({
    super.key,
    required this.post,
    required this.visible,
    this.preload = false,
    this.preloadNow = true,
    this.onStarted,
    this.onFinished,
  });

  final Post post;

  /// Rasmli reel o'z vaqtini tugatdi (`null` — boshidan aylanadi).
  final VoidCallback? onFinished;

  /// Oldindan yuklash uchun YANGI kontroller qurish mumkinmi —
  /// ko'rinayotgan reel o'ynay boshladimi. Mavjud kontroller (hozirgina
  /// ko'rinib turgan sahifa) bunga qaramay saqlanadi.
  final bool preloadNow;

  /// Ko'rinayotgan sahifa o'ynay boshladi (yoki ochilmadi) — keyingisini
  /// yuklash mumkin.
  final VoidCallback? onStarted;

  /// Ekranda — o'ynaydi.
  final bool visible;

  /// Keyingi sahifa — yuklanadi, lekin O'YNAMAYDI va ovozsiz turadi.
  final bool preload;

  @override
  ConsumerState<_ReelPage> createState() => _ReelPageState();
}

class _ReelPageState extends ConsumerState<_ReelPage>
    with SingleTickerProviderStateMixin {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _failed = false;

  // ── RASMLI REEL VA MUSIQA (2026-09-25) ─────────────────────────────
  //
  // Rasmli reel: video kontroller YO'Q, o'rniga [_clock] — rasm
  // `imageSeconds` (standart 10) soniya turadi, keyin keyingi reel.
  // Musiqa: alohida audio kontroller [_music]. Video postda musiqa bo'lsa
  // videoning o'z ovozi o'chiriladi (musiqa uning o'rnini oladi).
  // Oldindan yuklanayotgan (keyingi) sahifada musiqa YUKLANMAYDI —
  // tarmoq ko'rinayotgan reelniki.
  bool get _photo => !widget.post.isVideo;
  AnimationController? _clock;
  VideoPlayerController? _music;
  bool _musicReady = false;

  /// Uzun izoh ochiqmi ("…ko'proq" bosilgan) — Instagram kabi.
  bool _captionOpen = false;

  /// Progress chizig'i barmoq bilan surilmoqda.
  bool _scrubbing = false;
  bool _wasPlayingBeforeScrub = false;

  AnimationController get _photoClock => _clock ??= AnimationController(
        vsync: this,
        duration: Duration(seconds: widget.post.imageSeconds),
      )..addStatusListener(_onClock);

  void _onClock(AnimationStatus s) {
    if (s != AnimationStatus.completed || !mounted) return;
    if (!widget.visible || !_onStage) return;
    final next = widget.onFinished;
    // USTIDA VARAQ OCHIQ (izohlar, ulashish, menyu) — keyingisiga
    // O'TILMAYDI, shu reel boshidan aylanadi (Instagram kabi). Egasi
    // (2026-09-28, BlueStacks): izoh yozayotganda rasmli reel tugab
    // keyingisiga o'tib ketardi, varaq esa oldingi reelniki bo'lib
    // qolardi — izoh ekrandagiga emas, oldingisiga yozilardi.
    final covered = ModalRoute.of(context)?.isCurrent == false;
    if (next != null && !covered) {
      next();
    } else {
      _clock?.forward(from: 0);
    }
  }

  /// Musiqa kontrolleri (faqat ko'rinayotgan sahifada). Ochilmasa —
  /// reel jim o'ynayveradi, xato ko'rsatilmaydi.
  Future<VideoPlayerController?> _ensureMusic() async {
    final m = widget.post.music;
    if (m == null || m.playUrl.isEmpty) return null;
    final have = _music;
    if (have != null) return _musicReady ? have : null;
    final c = VideoPlayerController.networkUrl(
      Uri.parse(m.playUrl),
      // BOSHQA ILOVA OVOZI TO'XTAYDI (audio fokus): `true` bo'lsa
      // Spotify/YouTube ham davom etib, ikki ovoz ustma-ust chiqardi.
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
    );
    _music = c;
    try {
      await c.initialize();
      if (!mounted || _music != c) return null;
      await c.setLooping(true);
      if (m.playFrom > Duration.zero) await c.seekTo(m.playFrom);
      _musicReady = true;
      return c;
    } catch (_) {
      return null;
    }
  }

  void _disposeMusic() {
    final m = _music;
    _music = null;
    _musicReady = false;
    if (m != null) {
      m.pause().catchError((_) {});
      m.dispose();
    }
  }

  Future<void> _activatePhoto() async {
    // Video yo'lida `initialize()` kutilgani uchun ota ekranga xabar
    // (`onStarted`) va audio egaligi har doim BUILD DAN KEYIN keladi.
    // Rasmda kutadigan narsa yo'q — shuning uchun bir kadr kechiktiramiz:
    // aks holda `initState` ichidan otaning `setState` i chaqirilib,
    // "setState() called during build" bilan yiqilardi.
    final gen = _gen;
    await Future<void>.delayed(Duration.zero);
    if (!mounted || gen != _gen) return;
    _ready = true;
    _failed = false;
    final clock = _photoClock;
    if (widget.visible && _onStage) {
      _owner.take(this, _pauseForOther);
      widget.onStarted?.call();
      if (clock.isCompleted) clock.reset();
      clock.forward();
      final m = await _ensureMusic();
      if (m != null && mounted && widget.visible && _onStage && clock.isAnimating) {
        await m.setVolume(ref.read(reelsMutedProvider) ? 0 : 1);
        await m.play();
      }
    } else if (widget.visible) {
      clock.stop();
      await _music?.pause();
    } else {
      clock.reset();
      _disposeMusic();
    }
    if (mounted) setState(() {});
  }

  /// Izohlar soni — varaqda yangi izoh yozilsa yangilanadi.
  int? _comments;

  // ── KO'RISHLAR (Instagram kabi) ────────────────────────────────────
  //
  // QOIDA (egasi, 2026-10-04): reel ekranda [kViewAfter] (2 soniya)
  // uzluksiz ko'rinsa — bitta ko'rish. Har bir KIRISH alohida sanaladi:
  // ko'rib chiqib ketib, qaytib yana 2 soniya ko'rsa — yana +1 (har
  // qanday seansda). Bir kirish ichida video aylanib turaversa qayta
  // yuborilmaydi. Tez aylantirib o'tilgan reel sanalmaydi.
  //
  // "Chiqib ketish" — sahifa ko'rinmay qolishi: boshqa reelga o'tildi
  // (`visible`), boshqa tab yoki ustiga boshqa ekran ochildi
  // (`_onStage`), ilova fonga ketdi ([ViewSession] o'zi kuzatadi).
  // Holat (`State`) bu paytda tirik qoladi, shuning uchun "yuborildi"
  // belgisi aynan shu yerda o'chiriladi.
  //
  // Javobdagi jami son ko'z belgisi yonida chiqadi. Egasining o'z
  // ko'rishini va 2 soniyadan tez qayta yuborishni server sanamaydi.
  int? _views;
  late final ViewSession _viewSession = ViewSession(_sendView);

  void _armView() {
    final p = widget.post;
    _viewSession.update(
      onScreen: widget.visible && _onStage && !p.isStory && p.id > 0,
    );
  }

  Future<void> _sendView() async {
    final p = widget.post;
    final res = await ref
        .read(socialRepositoryProvider)
        .recordView(p.id, company: p.isCompany);
    if (!mounted) return;
    if (res case Ok(:final value)) setState(() => _views = value);
  }

  /// Yurak "portlashi" — ikki marta bosilganda.
  bool _burst = false;

  /// Barmoq bosib turilibdi — video pauzada, belgilar yashirin
  /// (Instagram). Qo'yib yuborilsa davom etadi.
  bool _holding = false;
  bool _wasPlaying = false;

  /// Har bir ochish urinishining raqami.
  ///
  /// NIMA UCHUN. Video yuklanayotgan paytda odam pastki navigatsiya
  /// bilan boshqa tabga o'tsa, kontroller yo'q qilinadi — lekin
  /// eski `initialize()` davom etib, keyin YO'Q QILINGAN kontrollerga
  /// `play()` chaqirardi va sahifa "video ochilmadi" holatida QOTIB
  /// qolardi (qaytib kelganda ham). Raqam mos kelmasa natija
  /// tashlab yuboriladi.
  int _gen = 0;

  late final AudioOwner _owner;

  /// Sahifa ekranda — ustiga boshqa ekran (Reel yaratish, izohdagi
  /// odam profili, ...) ochilmagan. `TickerMode` — Overlay yopilgan
  /// marshrutni va yashirin tabni shu bilan belgilaydi.
  ///
  /// Ilgari faqat tab raqami qaralardi: `/reel/create` yoki izohdan
  /// `/u/:code` ochilsa, video ORQADA ovoz bilan o'ynayverardi.
  /// Kontroller YO'Q QILINMAYDI — qaytganda o'sha joydan davom etadi.
  bool _onStage = true;

  @override
  void initState() {
    super.initState();
    _owner = ref.read(audioOwnerProvider);
    _sync();
    _armView();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final on = TickerMode.of(context);
    if (on == _onStage) return;
    _onStage = on;
    // Kadrdan keyin: `AudioOwner` boshqa egani to'xtatadi va u build
    // paytida `setState` chaqirishi mumkin.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _onStage != on) return;
      _armView();
      if (!on) {
        _controller?.pause();
        _music?.pause();
        _clock?.stop();
        _owner.release(this);
        setState(() {});
      } else if (widget.visible) {
        _sync();
      }
    });
  }

  @override
  void didUpdateWidget(covariant _ReelPage old) {
    super.didUpdateWidget(old);
    if (old.visible != widget.visible ||
        old.preload != widget.preload ||
        old.preloadNow != widget.preloadNow) {
      _sync();
    }
    if (old.visible != widget.visible) _armView();
  }

  void _sync() {
    if (widget.visible || widget.preload) {
      // Keyingi reel: ko'rinayotgani o'ynay boshlaguncha yangi
      // kontroller QURILMAYDI (tarmoq ko'rinayotganiga to'liq qoladi).
      if (!widget.visible && _controller == null && !widget.preloadNow) {
        return;
      }
      _activate();
    } else {
      _release();
    }
  }

  Future<void> _activate() async {
    if (_photo) return _activatePhoto();
    var c = _controller;
    if (c == null) {
      final gen = ++_gen;
      _failed = false;
      c = VideoPlayerController.networkUrl(
        Uri.parse(widget.post.mediaUrls.first),
        // Audio fokus olinadi — boshqa ilova ovozi bilan aralashmaydi.
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
      );
      _controller = c;
      try {
        // Osilib qolgan ochilish reelni abadiy qora qoldirmasin va
        // keyingisini yuklashni to'smasin: muddat o'tsa — "qayta urinish".
        await c.initialize().timeout(reelsInitTimeout);
        if (gen != _gen || !mounted) return;
        await c.setLooping(true);
        _ready = true;
      } catch (_) {
        if (gen == _gen && mounted) setState(() => _failed = true);
        // Buzuq video keyingisini yuklashni to'sib qo'ymasin.
        if (gen == _gen && widget.visible) widget.onStarted?.call();
        return;
      }
    }
    if (!mounted || _controller != c || !_ready) return;

    if (widget.visible && _onStage) {
      // Video ovoz chiqaradi — u audio EGASI bo'ladi. Profil musiqasi
      // o'ynayotgan bo'lsa to'xtaydi: ikki manba birga ovoz chiqarmaydi.
      _owner.take(this, _pauseForOther);
      final muted = ref.read(reelsMutedProvider);
      final hasMusic = (widget.post.music?.playUrl ?? '').isNotEmpty;
      // VIDEO MUSIQANI KUTMAYDI (egasi, 2026-09-27: "keyingisiga
      // o'tishda qora ekran 1-2 soniya"). Ilgari `play()` musiqa fayli
      // tarmoqdan ochilguncha kutardi. Endi video darhol boshlanadi
      // (musiqali reelda o'z ovozisiz), musiqa tayyor bo'lgach qo'shiladi.
      await c.setVolume(hasMusic || muted ? 0 : 1);
      await c.play();
      // `initialize()` READY holatini kutadi — birinchi kadr ~0.1 s da
      // (o'lchov). Endi keyingi reel yuklansa bo'ladi.
      widget.onStarted?.call();
      if (hasMusic) {
        final m = await _ensureMusic();
        if (!mounted || _controller != c) return;
        if (m == null) {
          // Musiqa ochilmadi — videoning o'z ovozi.
          if (!muted) await c.setVolume(1);
        } else if (widget.visible && _onStage) {
          await m.setVolume(muted ? 0 : 1);
          await m.play();
        }
      }
    } else if (widget.visible) {
      // Ustida boshqa ekran — joyida pauza (boshiga qaytmaydi).
      await c.pause();
      await _music?.pause();
    } else {
      // Oldindan yuklangan: jim va pauzada, boshidan.
      await c.setVolume(0);
      await c.pause();
      await c.seekTo(Duration.zero);
    }
    if (mounted) setState(() {});
  }

  /// Ovozni o'chirish/yoqish — BUTUN lenta uchun.
  Future<void> _toggleMute() async {
    final next = !ref.read(reelsMutedProvider);
    ref.read(reelsMutedProvider.notifier).state = next;
    if (_music != null && _musicReady) {
      await _music?.setVolume(next ? 0 : 1);
    } else {
      await _controller?.setVolume(next ? 0 : 1);
    }
    if (mounted) setState(() {});
  }

  void _pauseForOther() {
    _controller?.pause();
    _music?.pause();
    _clock?.stop();
    if (mounted) setState(() {});
  }

  void _release() {
    // Kontroller YO'Q QILINADI, faqat to'xtatilmaydi: to'xtatilgan
    // video ham dekoder va bufer xotirasini ushlab turadi.
    _gen++;
    final c = _controller;
    _controller = null;
    _ready = false;
    _failed = false;
    if (c != null) {
      c.pause().catchError((_) {});
      c.dispose();
    }
    _disposeMusic();
    _clock?.reset();
    _owner.release(this);
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _gen++;
    _viewSession.dispose();
    _controller?.dispose();
    _music?.dispose();
    _clock?.dispose();
    // `ref.read` EMAS: `dispose()` da u istisno otadi.
    _owner.release(this);
    super.dispose();
  }

  /// MUALLIF PROFILIGA O'TISH — VIDEO TO'XTAYDI (egasi, 2026-09).
  ///
  /// Profil sahifasi Reels ustiga ochiladi, Reels tabi esa "faol"
  /// bo'lib qolaveradi — video orqada ovoz chiqarib o'ynardi.
  /// O'tishdan oldin pauza, qaytganda davom etadi (Instagram kabi).
  Future<void> _openAuthor() async {
    final p = widget.post;
    if (p.code.isEmpty) return;
    await _controller?.pause();
    await _music?.pause();
    _clock?.stop();
    _owner.release(this);
    if (mounted) setState(() {});
    if (!mounted) return;
    await context.push(Routes.author(p.code, company: p.isCompany));
    if (mounted) _sync();
  }

  void _togglePlay() {
    if (_photo) {
      final clock = _photoClock;
      setState(() {
        if (clock.isAnimating) {
          clock.stop();
          _music?.pause();
        } else {
          clock.forward();
          _music?.play();
        }
      });
      return;
    }
    final c = _controller;
    if (c == null || !_ready) {
      // Xato bo'lgan video — bosilsa qayta urinish.
      if (_failed) {
        _release();
        _sync();
      }
      return;
    }
    setState(() {
      if (c.value.isPlaying) {
        c.pause();
        _music?.pause();
      } else {
        c.play();
        if (_musicReady) _music?.play();
      }
    });
  }

  /// BITTA BOSISH — TOZA REJIM (Instagram): belgilar, pastki panel va
  /// tizim panellari yashirinadi, video butun ekranda qoladi. Yana
  /// bosilsa qaytadi. Pauza — bosib turish ([_holdStart]).
  void _toggleClean() {
    if (_failed) {
      _togglePlay(); // xato bo'lgan video — qayta urinish
      return;
    }
    final clean = ref.read(reelsCleanProvider.notifier);
    clean.state = !clean.state;
  }

  void _holdStart(LongPressStartDetails _) {
    if (_photo) {
      if (!_ready) return;
      _wasPlaying = _photoClock.isAnimating;
      _photoClock.stop();
      _music?.pause();
      setState(() => _holding = true);
      return;
    }
    final c = _controller;
    if (c == null || !_ready) return;
    _wasPlaying = c.value.isPlaying;
    c.pause();
    _music?.pause();
    setState(() => _holding = true);
  }

  void _holdEnd(LongPressEndDetails _) {
    if (!_holding) return;
    if (_wasPlaying && widget.visible) {
      if (_photo) {
        _photoClock.forward();
      } else {
        _controller?.play();
      }
      if (_musicReady) _music?.play();
    }
    setState(() => _holding = false);
  }

  /// Musiqa belgisi bosildi — reel to'xtaydi, «Shu musiqani ishlatish».
  Future<void> _openMusic(MusicTrack track) async {
    await _controller?.pause();
    await _music?.pause();
    _clock?.stop();
    if (!mounted) return;
    await showMusicUseSheet(context, track);
    if (mounted) _sync();
  }

  Future<void> _like({bool onlyOn = false}) async {
    final likes = ref.read(postLikesProvider.notifier);
    if (onlyOn && likes.of(widget.post).liked) return;
    final e = await likes.toggle(widget.post);
    if (e != null && mounted) _snack(describeError(L.of(context), e));
  }

  void _doubleTap() {
    setState(() => _burst = true);
    _like(onlyOn: true);
    Future<void>.delayed(const Duration(milliseconds: 650), () {
      if (mounted) setState(() => _burst = false);
    });
  }

  void _snack(String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _openComments() async {
    await showReelComments(
      context,
      widget.post,
      onTotal: (n) {
        if (mounted) setState(() => _comments = n);
      },
    );
  }

  Future<void> _save() async {
    final l = L.of(context);
    final on = await ref.read(savedReelsProvider.notifier).toggleReel(widget.post);
    // Saqlash HISOBGA bog'langan (`SyncedSaves`, `/api/saves`) — matn
    // ham shuni aytadi; ilgari "shu telefonda" deyilardi.
    if (mounted) _snack(on ? l.reelSavedLocal : l.reelUnsaved);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final p = widget.post;
    final muted = ref.watch(reelsMutedProvider);
    final like = ref.watch(postLikesProvider
        .select((m) => m[likeKey(p)] ?? (liked: p.liked, count: p.likes)));
    final saved = ref.watch(savedReelsProvider).contains(likeKey(p));
    final mine = ref.watch(isMineProvider(p.code));
    // O'z reelimda "Kuzatish" yo'q — obuna holati so'ralmaydi.
    final following =
        (mine || p.code.isEmpty) ? false : ref.watch(followingOfProvider(p.code));
    final c = _controller;
    final playing = _photo
        ? (_ready && (_clock?.isAnimating ?? false))
        : c != null && _ready && c.value.isPlaying;
    final clean = ref.watch(reelsCleanProvider);
    final hide = clean || _holding;
    // PASTKI PANELNING HAQIQIY BALANDLIGI.
    //
    // Ilgari `96 + tizim inset'i` deb taxmin qilinardi va ba'zi
    // telefonlarda aylantirish chizig'i va NFC ID pastki panel ostida
    // qolib ketardi (egasi, 2026-09-24 surat). Shell `extendBody`
    // bilan body'ga panelning O'LCHANGAN balandligini (tizim inset'i
    // bilan) `padding.bottom` qilib beradi — endi aynan shundan
    // yuqorida turadi, har qanday telefonda.
    final navH = MediaQuery.paddingOf(context).bottom;

    return GestureDetector(
      onTap: _toggleClean,
      onDoubleTap: _doubleTap,
      onLongPressStart: _holdStart,
      onLongPressEnd: _holdEnd,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const ColoredBox(color: Colors.black),
          if (_photo)
            // RASMLI REEL: orqada xiralashgan nusxa ekranni to'ldiradi,
            // ustida rasmning o'zi BUTUN ko'rinadi (kesilmaydi).
            Stack(
              key: const ValueKey('reel-photo'),
              fit: StackFit.expand,
              children: [
                ImageFiltered(
                  imageFilter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
                  child: Opacity(
                    opacity: .55,
                    // Faqat xira FON — cho'zilishi ko'rinmaydi. Asosiy rasm
                    // pastda `contain`: Reels'da media KESILMAYDI.
                    child: mediaImage(context, p.mediaUrls.first, fit: BoxFit.fill),
                  ),
                ),
                mediaImage(context, p.mediaUrls.first, fit: BoxFit.contain),
              ],
            )
          else if (_ready && c != null)
            // INSTAGRAM KABI (egasi, 2026-09-24): tik video ekranni
            // to'ldiradi — tepa va pastda qora chiziq qolmaydi (chetdan
            // kesilish ≤ 20%). Yotiq/kvadrat video `contain` — butun
            // ko'rinadi, yarmi kesilmaydi (media_fit_test).
            FittedBox(
              fit: immersiveVideoFit(c.value.size, MediaQuery.sizeOf(context)),
              clipBehavior: Clip.hardEdge,
              child: SizedBox(
                width: c.value.size.width,
                height: c.value.size.height,
                child: VideoPlayer(c),
              ),
            )
          else if (_failed)
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.videocam_off_rounded, size: 40, color: t.text3),
                  const SizedBox(height: Gap.sm),
                  Text(l.actionRetry,
                      style: const TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white70)),
                ],
              ),
            )
          else
            const _LateSpinner(),
          // Pastdagi matn o'qilishi uchun gradient.
          Positioned.fill(
            child: _Chrome(
              hidden: hide,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.center,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: .72)
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Pauza belgisi — video to'xtab qolgan bo'lsa (bosib turish
          // paytida emas: u yerda belgilar ataylab yo'q).
          if (_ready && !playing && widget.visible && !_holding)
            const IgnorePointer(
              child: Center(
                child: Icon(Icons.play_arrow_rounded,
                    size: 72, color: Colors.white70),
              ),
            ),
          IgnorePointer(
            child: Center(
              child: AnimatedScale(
                scale: _burst ? 1 : .4,
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutBack,
                child: AnimatedOpacity(
                  opacity: _burst ? 1 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(NovaIcons.liked,
                      size: 96, color: Colors.white),
                ),
              ),
            ),
          ),
          // Tugmalar orasidagi `Gap.lg` bo'shliq endi har tugmaning
          // ICHIDA (`_Action`, tepa va past `Gap.lg / 2`). Ilgari u
          // bosilmas edi va barmoq sal chetga tushsa video pauzaga
          // ketardi. Pastki tugmaning `Gap.lg / 2` hoshiyasi uchun
          // ustun 8 dp pastroqdan boshlanadi — belgilar o'sha joyda.
          Positioned(
            right: 4,
            bottom: navH + 30 - Gap.lg / 2,
            child: _Chrome(
              hidden: hide,
              child: Column(
              children: [
                _Action(
                  key: const ValueKey('reel-like'),
                  icon: like.liked
                      ? NovaIcons.liked
                      : NovaIcons.like,
                  label: formatCount(like.count),
                  tint: like.liked ? t.error : Colors.white,
                  semantic: l.postLike,
                  onTap: _like,
                ),
                _Action(
                  key: const ValueKey('reel-comments'),
                  icon: NovaIcons.comment,
                  label: formatCount(_comments ?? p.comments),
                  semantic: l.postComments,
                  onTap: _openComments,
                ),
                _Action(
                  key: const ValueKey('reel-save'),
                  icon: saved
                      ? NovaIcons.saved
                      : NovaIcons.save,
                  label: l.actionSave,
                  // Saqlangan — nozik oltin (premium aksent).
                  tint: saved
                      ? context.tokens.goldOnDark(IdPlate.goldLight)
                      : Colors.white,
                  semantic: l.actionSave,
                  onTap: _save,
                ),
                _Action(
                  key: const ValueKey('reel-share'),
                  icon: NovaIcons.share,
                  label: l.actionShare,
                  semantic: l.actionShare,
                  onTap: () => shareWithFeedback(
                    context,
                    contentShareText(
                        caption: p.text, code: p.code, company: p.isCompany,
                        postId: p.isStory ? 0 : p.id),
                    subject: p.authorName,
                    copiedMessage: l.shareCopied,
                  ),
                ),
                _Action(
                  icon: muted
                      ? NovaIcons.muted
                      : NovaIcons.sound,
                  // Yozuvsiz: "Ovozni o'chirish" ustunni kengaytirib,
                  // tor ekranda muallif ismini siqib qo'yardi.
                  label: '',
                  semantic: muted ? l.actionUnmute : l.actionMute,
                  onTap: _toggleMute,
                ),
                _Action(
                  key: const ValueKey('reel-more'),
                  icon: NovaIcons.more,
                  label: '',
                  semantic: l.reportTitle,
                  onTap: () => _showMore(context, p),
                ),
              ],
            ),
            ),
          ),
          Positioned(
            left: Gap.lg,
            right: 72,
            bottom: navH + 30,
            child: _Chrome(
              hidden: hide,
              child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: PressableScale(
                        onTap: p.code.isEmpty ? null : _openAuthor,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Avatar(
                              url: p.authorAvatar,
                              initials: p.authorName.isEmpty
                                  ? 'N'
                                  : p.authorName.substring(0, 1).toUpperCase(),
                              size: 40,
                              // Nozik champagne halqa — NFCSTORE imzosi.
                              ringColor: IdPlate.gold.withValues(alpha: .8),
                              ringWidth: 1.4,
                            ),
                            const SizedBox(width: Gap.sm),
                            Flexible(
                              child: Text(
                                p.authorName.isEmpty ? p.code : p.authorName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontFamily: AppType.sans,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Obuna — faqat begona muallifga.
                    if (!mine && p.code.isNotEmpty) ...[
                      const SizedBox(width: Gap.sm),
                      _FollowPill(
                        following: following,
                        onTap: () async {
                          final e = await ref
                              .read(followOverridesProvider.notifier)
                              .toggle(p.code,
                                  following: following,
                                  company: p.isCompany);
                          if (e != null && context.mounted) {
                            _snack(describeError(l, e));
                          }
                        },
                      ),
                    ],
                  ],
                ),
                if (p.code.isNotEmpty) ...[
                  const SizedBox(height: Gap.sm),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                  // NFC ID — REELS'NING NFCSTORE IDENTITETI (egasi, 2026-09:
                  // "Instagram nusxasi bo'lmasin"). Muallif shunchaki ism
                  // emas, NFC ID egasi: qora shisha kapsula, champagne
                  // hoshiya, oltin NFC belgisi va mono kod. Kompaniya
                  // bo'lsa — do'kon belgisi. Bosilsa muallif profili.
                  PressableScale(
                    key: const ValueKey('reel-id-chip'),
                    onTap: _openAuthor,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(9, 5, 11, 5),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: .38),
                        borderRadius: R.pill,
                        border: Border.all(
                            color: IdPlate.gold.withValues(alpha: .55),
                            width: .8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          BrandAwareIcon(
                            p.isCompany
                                ? Icons.storefront_outlined
                                : Icons.nfc_rounded,
                            size: 13,
                            color: IdPlate.goldLight,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            p.code,
                            style: AppType.monoStyle(
                                color: Colors.white,
                                size: 11.5,
                                weight: FontWeight.w600,
                                letterSpacing: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ),
                      const SizedBox(width: Gap.sm),
                      ReelViewsLabel(count: _views ?? p.views),
                    ],
                  ),
                ],
                // BIZNES REELS: "Qo'ng'iroq / Telegram / Xarita" — o'ng
                // ustunda emas (u allaqachon to'la, tor ekranda pastga
                // sig'masdi), muallif ostida, musiqa kapsulasi bilan bir
                // xil qora shisha uslubda.
                if (postContactActions(p).isNotEmpty) ...[
                  const SizedBox(height: Gap.sm),
                  PostContactBar(
                      key: const ValueKey('reel-contact'), post: p, onDark: true),
                ],
                // REKLAMA (egasi, 2026-10-05). Qonun bo'yicha reklama aniq
                // belgilanadi; Instagram'dagi "Sponsored" kabi, lekin
                // pastida bir bosishda profilga olib boruvchi tugma bor.
                if (p.featured) ...[
                  const SizedBox(height: Gap.sm),
                  // Wrap — tor ekranda tugma keyingi qatorga tushadi.
                  Wrap(
                    spacing: Gap.sm,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Container(
                        key: const ValueKey('reel-sponsored'),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: .18),
                          borderRadius: R.pill,
                        ),
                        child: Text(
                          l.feedSponsored,
                          style: const TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      if (p.code.isNotEmpty)
                        PressableScale(
                          key: const ValueKey('reel-ad-cta'),
                          onTap: _openAuthor,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: IdPlate.gold,
                              borderRadius: R.pill,
                            ),
                            child: Text(
                              '${l.reelAdCta} ›',
                              style: const TextStyle(
                                fontFamily: AppType.sans,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: Colors.black,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
                if (p.music != null) ...[
                  const SizedBox(height: Gap.sm),
                  MusicChip(
                    key: const ValueKey('reel-music'),
                    track: p.music!,
                    onDark: true,
                    onTap: () => _openMusic(p.music!),
                  ),
                ],
                if (p.text.isNotEmpty) ...[
                  const SizedBox(height: Gap.sm),
                  _ReelCaption(
                    text: p.text,
                    open: _captionOpen,
                    onToggle: () =>
                        setState(() => _captionOpen = !_captionOpen),
                  ),
                ],
              ],
            ),
            ),
          ),
          // INGICHKA PROGRESS — Instagram kabi: pastki panelning USTIDA,
          // chetlardan ichkarida, yumaloq uchli oq chiziq.
          if (_photo && _ready && widget.visible && _clock != null)
            Positioned(
              key: const ValueKey('reel-photo-progress'),
              left: Gap.lg,
              right: Gap.lg,
              bottom: navH + 12,
              child: _Chrome(
                hidden: hide,
                child: IgnorePointer(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: SizedBox(
                      height: 2.5,
                      child: AnimatedBuilder(
                        animation: _clock!,
                        builder: (_, __) => LinearProgressIndicator(
                          value: _clock!.value,
                          minHeight: 2.5,
                          color: Colors.white,
                          backgroundColor: Colors.white24,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          if (_ready && c != null && widget.visible)
            Positioned(
              key: const ValueKey('reel-progress'),
              left: Gap.lg,
              right: Gap.lg,
              bottom: navH + 12,
              child: _Chrome(
                hidden: hide,
                child: IgnorePointer(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: SizedBox(
                      height: _scrubbing ? 4 : 2.5,
                      child: VideoProgressIndicator(
                        c,
                        allowScrubbing: false,
                        padding: EdgeInsets.zero,
                        colors: const VideoProgressColors(
                          playedColor: Colors.white,
                          bufferedColor: Colors.white30,
                          backgroundColor: Colors.white24,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          // SURISH ZONASI — chiziq ingichka (2.5 px), barmoq uchun esa
          // 16 px balandlikdagi ko'rinmas maydon (Instagram kabi:
          // bosilgan yoki surilgan joyga o'tadi).
          if (_ready && c != null && widget.visible && !_photo && !hide)
            Positioned(
              key: const ValueKey('reel-scrub'),
              left: Gap.lg,
              right: Gap.lg,
              bottom: navH,
              height: 16,
              child: LayoutBuilder(
                builder: (_, box) {
                  void seekTo(double dx) {
                    final d = c.value.duration;
                    if (d <= Duration.zero || box.maxWidth <= 0) return;
                    final f = (dx / box.maxWidth).clamp(0.0, 1.0);
                    c.seekTo(d * f);
                  }

                  return GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTapUp: (d) => seekTo(d.localPosition.dx),
                    onHorizontalDragStart: (d) {
                      _wasPlayingBeforeScrub = c.value.isPlaying;
                      c.pause();
                      setState(() => _scrubbing = true);
                      seekTo(d.localPosition.dx);
                    },
                    onHorizontalDragUpdate: (d) => seekTo(d.localPosition.dx),
                    onHorizontalDragEnd: (_) {
                      setState(() => _scrubbing = false);
                      if (_wasPlayingBeforeScrub && widget.visible) c.play();
                    },
                    onHorizontalDragCancel: () {
                      if (mounted) setState(() => _scrubbing = false);
                      if (_wasPlayingBeforeScrub && widget.visible) c.play();
                    },
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  void _showMore(BuildContext context, Post p) {
    final l = L.of(context);
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      showDragHandle: true,
      backgroundColor: context.tokens.surfaceSolid,
      builder: (sheet) => SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              key: const ValueKey('reel-report'),
              leading: const Icon(Icons.flag_outlined),
              title: Text(l.reportTitle),
              onTap: () {
                Navigator.of(sheet).pop();
                showReportSheet(
                  context,
                  target: p.isCompany ? ReportTarget.companyPost : ReportTarget.post,
                  targetId: '${p.id}',
                  ownerCode: p.code,
                );
              },
            ),
            // KO'TARISH — faqat O'Z reelim, iPhone va `boostEnabled`
            // (Apple consumable). Android va kalit o'chiq — yo'q.
            if (ref.read(isMineProvider(p.code)) &&
                !p.isStory &&
                p.id > 0 &&
                ref.read(iapBoostEnabledProvider))
              ListTile(
                key: const ValueKey('reel-boost'),
                leading: const Icon(Icons.trending_up_rounded),
                title: Text(l.boostAction),
                onTap: () {
                  Navigator.of(sheet).pop();
                  showBoostSheet(context, ref, p);
                },
              ),
            // QIZIQ EMAS — reel shu ro'yxatdan darhol olinadi (Instagram
            // kabi) va serverga aytiladi (`/api/reels/hide`). Javob
            // kutilmaydi, xatosi ko'rsatilmaydi: eski serverda bu manzil
            // yo'q, mahalliy yashirish baribir ishlaydi.
            if (!ref.read(isMineProvider(p.code)))
              ListTile(
                key: const ValueKey('reel-not-interested'),
                leading: const Icon(Icons.visibility_off_outlined),
                title: Text(l.reelNotInterested),
                onTap: () {
                  Navigator.of(sheet).pop();
                  // Avval xabar: yashirilgach bu sahifa yo'q qilinadi.
                  _snack(l.reelNotInterestedDone);
                  ref.read(socialRepositoryProvider).hideReel(p).ignore();
                  ref
                      .read(reelsHiddenProvider.notifier)
                      .update((s) => {...s, likeKey(p)});
                },
              ),
            if (!ref.read(isMineProvider(p.code)) && p.code.isNotEmpty)
              ListTile(
                key: const ValueKey('reel-block'),
                leading: const Icon(Icons.block_rounded),
                title: Text(l.reelBlockAuthor),
                onTap: () async {
                  Navigator.of(sheet).pop();
                  final res = await ref.read(moderationRepositoryProvider).block(
                      p.isCompany ? BlockKind.company : BlockKind.record, p.code);
                  if (!context.mounted) return;
                  res.when(
                    ok: (_) {
                      _snack(l.reelBlocked);
                      ref.invalidate(reelsProvider);
                    },
                    err: (e) => _snack(describeError(l, e)),
                  );
                },
              ),
            const SizedBox(height: Gap.sm),
          ],
        ),
      ),
    );
  }
}

/// Muallifga obuna — video ustida o'qiladigan shaffof kapsula.
class _FollowPill extends StatelessWidget {
  const _FollowPill({required this.following, required this.onTap});
  final bool following;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final label = following ? l.actionFollowing : l.actionFollow;
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          key: const ValueKey('reel-follow'),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: following ? Colors.transparent : Colors.white,
            borderRadius: R.pill,
            border: Border.all(color: Colors.white.withValues(alpha: .7)),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: following ? Colors.white : Colors.black,
            ),
          ),
        ),
      ),
    );
  }
}

/// Reel izohlari — video ustidan ochiladigan varaq.
///
/// Ilgari izoh tugmasi alohida post ekraniga o'tardi va video
/// to'xtab, lenta joyi yo'qolardi. Endi varaq ochiladi, video orqada
/// qoladi. Manba o'sha `CommentsSection` — ikkinchi izoh tizimi yo'q.
Future<void> showReelComments(
  BuildContext context,
  Post p, {
  ValueChanged<int>? onTotal,
}) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.tokens.surfaceSolid,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (_) => _CommentsSheet(post: p, onTotal: onTotal),
  );
}

class _CommentsSheet extends ConsumerStatefulWidget {
  const _CommentsSheet({required this.post, this.onTotal});
  final Post post;
  final ValueChanged<int>? onTotal;

  @override
  ConsumerState<_CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends ConsumerState<_CommentsSheet> {
  /// Yozish maydonining fokusi — "Javob berish" bosilganda klaviatura
  /// ochilsin. Ilgari varaq `CommentsSection` ga fokus bermasdi: javob
  /// yo'lakchasi chiqardi-yu, odam maydonni yana alohida bosishi kerak
  /// edi (post ekranida esa ishlardi).
  final _focus = FocusNode();

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final onTotal = widget.onTotal;
    final kind = post.isCompany ? 'company_post' : 'post';
    ref.listen(commentsProvider((kind: kind, id: post.id)), (_, next) {
      final total = next.valueOrNull?.total;
      if (total != null) onTotal?.call(total);
    });
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * .72),
        child: SingleChildScrollView(
          // Telefonning pastki paneli (jest chizig'i / 3 tugma) ostida
          // oxirgi izoh va "Javob berish" qolib ketmasin (egasi,
          // 2026-09 surat).
          padding: EdgeInsets.only(
              bottom: Gap.xl + MediaQuery.viewPaddingOf(context).bottom),
          child: CommentsSection(
            kind: kind,
            id: post.id,
            ownerCode: post.code,
            focusNode: _focus,
          ),
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    super.key,
    required this.icon,
    required this.label,
    required this.semantic,
    this.tint = Colors.white,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String semantic;
  final Color tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: semantic,
        excludeSemantics: true,
        child: PressableScale(
        onTap: onTap,
        scale: .86,
        // Shaffof hoshiya — bosish maydoni (ovoz va "yana" tugmalari
        // ilgari 60x32 edi). Simmetrik: bosilgandagi kichrayish
        // markazi ham o'zgarmaydi.
        child: Padding(
        padding: const EdgeInsets.symmetric(vertical: Gap.lg / 2),
        child: SizedBox(
        width: 60,
        child: Column(
          children: [
            Icon(icon, size: 28, color: tint, shadows: const [
              Shadow(color: Colors.black54, blurRadius: 10),
            ]),
            const SizedBox(height: 4),
            if (label.isNotEmpty)
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                  shadows: [Shadow(color: Colors.black54, blurRadius: 10)],
                ),
              ),
          ],
        ),
      ),
      ),
      ),
      );
}


/// Yuklanish belgisi faqat KECHIKSA chiqadi (0.5 s dan keyin).
///
/// Oldindan yuklangan yoki tez ochilgan video uchun bir lahzalik
/// aylanayotgan doira "qotyapti" degan his berardi (egasi, 2026-09-27).
class _LateSpinner extends StatefulWidget {
  const _LateSpinner();

  @override
  State<_LateSpinner> createState() => _LateSpinnerState();
}

class _LateSpinnerState extends State<_LateSpinner> {
  bool _show = false;
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _t = Timer(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _show = true);
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _show
      ? const Center(
          child: CircularProgressIndicator(
              color: Colors.white70, strokeWidth: 2),
        )
      : const SizedBox.shrink();
}

/// Ko'rishlar soni — ko'z belgisi + son (Instagram'dagi kabi).
///
/// Belgi va son bitta `Semantics` yozuvida o'qiladi ("1,2 ming
/// ko'rish"), ekran o'quvchi alohida ikkita narsa demaydi.
class ReelViewsLabel extends StatelessWidget {
  const ReelViewsLabel({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return Semantics(
      key: const ValueKey('reel-views'),
      label: l.viewsCount(formatCount(count)),
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.visibility_outlined, size: 15, color: Colors.white),
          const SizedBox(width: 4),
          Text(
            formatCount(count),
            style: const TextStyle(
              fontFamily: AppType.sans,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: Colors.white,
              shadows: [Shadow(blurRadius: 4, color: Colors.black54)],
            ),
          ),
        ],
      ),
    );
  }
}


/// Reels izohi: 3 qatordan uzun bo'lsa "…ko'proq", bosilsa to'liq
/// (egasi, 2026-10-05: Instagram kabi). Juda uzun matn ekranning
/// uchdan biridan oshmaydi — ichida aylantiriladi.
class _ReelCaption extends StatelessWidget {
  const _ReelCaption({
    required this.text,
    required this.open,
    required this.onToggle,
  });

  final String text;
  final bool open;
  final VoidCallback onToggle;

  static const _style = TextStyle(
    fontFamily: AppType.sans,
    fontSize: 13,
    fontWeight: FontWeight.w500,
    height: 1.35,
    color: Colors.white,
  );

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return LayoutBuilder(builder: (context, box) {
      final tp = TextPainter(
        text: TextSpan(text: text, style: _style),
        maxLines: 3,
        textDirection: Directionality.of(context),
        textScaler: MediaQuery.textScalerOf(context),
      )..layout(maxWidth: box.maxWidth);
      final long = tp.didExceedMaxLines;
      // O'lchov tugadi — mahalliy (C++) paragraf darhol bo'shatiladi.
      // Ilgari har qurishda (har kadr surishda ham) yangi `TextPainter`
      // yaratilib, hech qachon `dispose` qilinmasdi — xotira sizardi.
      tp.dispose();
      if (!long) return Text(text, style: _style);
      return GestureDetector(
        key: const ValueKey('reel-caption'),
        behavior: HitTestBehavior.opaque,
        onTap: onToggle,
        child: open
            ? ConstrainedBox(
                constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(context).height * .33),
                child: SingleChildScrollView(child: Text(text, style: _style)),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(text,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: _style),
                  Text(l.reelCaptionMore,
                      style: _style.copyWith(
                          color: Colors.white70, fontWeight: FontWeight.w700)),
                ],
              ),
      );
    });
  }
}
