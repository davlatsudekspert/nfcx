import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/states.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../../app/profile_context.dart';
import '../auth/session.dart';
import 'comments.dart';
import 'moderation.dart';
import '../profile/music_player.dart';
import 'inline_video.dart';
import 'media_frame.dart';
import 'media_sound.dart';
import '../home/widgets/avatar.dart';
import '../business/business_providers.dart';
import '../profile/profile_repository.dart';
import '../../design/icons/nova_icons.dart';
import '../../design/widgets/id_plate.dart';
import '../../core/media/image_cache.dart';
import '../home/home_screen.dart' show homeStoriesProvider;

// RIVERPOD `dependencies` — DEMO DARAXTI UCHUN SHART.
//
// "NFC Mobile" demo ekranlari repozitoriylarni ichki
// `ProviderScope` da almashtiradi. Riverpod esa almashtirilgan
// provayderga TAYANADIGAN har bir provayderdan buni OLDINDAN
// e'lon qilishni talab qiladi — aks holda u ichki doirada qayta
// yaratilmaydi va "Tried to read ... from a place where one of
// its dependencies were overridden" xatosi chiqadi.
//
// Ishlab chiqarish xulqi O'ZGARMAYDI.
/// ISTORYA EGASI — KOD VA U KIMNIKI.
///
/// ## NIMA UCHUN FAQAT KOD YETMAYDI
///
/// Shaxsiy va kompaniya istoryalari SERVERDA boshqa-boshqa
/// jadvalda va boshqa manzilda yashaydi:
///
///     shaxsiy    -> GET /api/records/:code/stories
///     kompaniya  -> GET /api/companies/:id/stories
///
/// Kod esa ikkalasida ham shunchaki satr. Shuning uchun
/// `storiesOfProvider` uzoq vaqt FAQAT shaxsiy yo'lni chaqirib
/// keldi: kompaniya istoryasi saytda ko'rinardi, ilovada esa
/// yo'q edi — server kompaniya identifikatorini shaxsiy
/// kartalar orasidan qidirib, bo'sh ro'yxat qaytarardi.
///
/// Xato BILINMASDI, chunki bo'sh ro'yxat 404 emas: halqa
/// shunchaki chizilmasdi va hech qanday ogohlantirish
/// chiqmasdi.
@immutable
class StoryOwner {
  const StoryOwner(this.code, {this.isBusiness = false});

  final String code;
  final bool isBusiness;

  @override
  bool operator ==(Object other) =>
      other is StoryOwner &&
      other.code == code &&
      other.isBusiness == isBusiness;

  @override
  int get hashCode => Object.hash(code, isBusiness);

  @override
  String toString() => 'StoryOwner($code, business: $isBusiness)';
}

final storiesOfProvider = FutureProvider.autoDispose
    .family<List<StoryItem>, StoryOwner>(
        dependencies: [socialRepositoryProvider, businessRepositoryProvider],
        (ref, owner) async {
      // Manba egasiga qarab tanlanadi — `homeStoriesProvider` ham
      // ayni shunday qiladi. Ikki joyda ikki xil qoida bo'lsa,
      // bosh sahifada ko'rinib, profilda ko'rinmaydigan istorya
      // paydo bo'lardi.
      final res = owner.isBusiness
          ? await ref.watch(businessRepositoryProvider).stories(owner.code)
          : await ref.watch(socialRepositoryProvider).storiesOf(owner.code);
      return res.when(ok: (v) => v, err: (e) => throw e);
    });

/// ISTORYA RASMLARINI OLDINDAN YUKLASH (disk keshiga).
///
/// Egasi (2026-09): "istorya ochilganda avval qora ekran chiqib, keyin
/// boshlanyapti". Eng sekin qism — tarmoqdan fayl olish; dekodlash
/// tez. Shuning uchun keyingi istorya (va bosh sahifadagi birinchi
/// bir nechta doiracha) rasmi FONDA diskka tushiriladi: bosilganda
/// u keshdan darhol ochiladi. Video oldindan yuklanmaydi (og'ir).
final _prefetched = <String>{};

void prefetchStoryImage(StoryItem? s) {
  if (s == null || s.isVideo) return;
  final url = s.mediaUrl;
  if (url.isEmpty || isAssetMedia(url) || !_prefetched.add(url)) return;
  try {
    unawaited(NovaImageCache.manager
        .getSingleFile(url)
        .then((_) {}, onError: (Object _) => _prefetched.remove(url)));
  } catch (_) {
    _prefetched.remove(url);
  }
}

/// SHU SEANSDA KO'RILGAN ISTORYALAR (`id`).
///
/// Server "ko'rildi" signalini oladi, lekin bosh sahifa ro'yxati
/// QAYTA YUKLANMAGUNCHA halqa "ko'rilmagan" (oltin) bo'lib turardi —
/// odam istoryani ko'rib qaytsa ham doiracha o'zgarmasdi. Ro'yxatni
/// har safar serverdan qayta so'rash qatorni qayta chizib, rasmlarni
/// yangidan yuklatardi; shuning uchun ko'rilganlar shu yerda
/// eslab qolinadi va qator ularni `seen` bilan birga hisoblaydi.
/// `autoDispose` ATAYLAB yo'q: ko'ruvchi yopilgach ham eslab qolinadi.
final seenStoryIdsProvider = StateProvider<Set<int>>((_) => const {});

/// Istorya ko'rilganmi — server bergan belgi YOKI shu seansda ko'rilgan.
bool storySeen(StoryItem s, Set<int> local) => s.seen || local.contains(s.id);

/// BOSH SAHIFA QATORIDAGI ODAMLAR NAVBATI.
///
/// Instagram'da bir odamning istoryalari tugasa KEYINGI odamniki
/// o'zi boshlanadi. Buning uchun ko'ruvchi qatordagi tartibni
/// bilishi kerak, marshrut (`/story/:code`) esa faqat BITTA kodni
/// tashiydi — App Link va jismoniy karta ham shu manzilga keladi.
/// Shuning uchun bosh sahifa navbatni shu yerga qo'yib, keyin
/// marshrutni ochadi; ko'ruvchi uni BIR MARTA oladi va tozalaydi.
/// Profil halqasi kabi boshqa kirishlar navbat qo'ymaydi — ular
/// avvalgidek bitta odamni ko'rsatadi.
@immutable
class StoryQueue {
  const StoryQueue(this.owners, this.start);

  final List<StoryOwner> owners;
  final int start;
}

final storyQueueProvider = StateProvider<StoryQueue?>((_) => null);

/// Bosh sahifa: har odamning BIRINCHI istoryasi (ko'pi bilan [max]).
void prefetchStoryRow(List<StoryItem> all, {int max = 4}) {
  final seen = <String>{};
  for (final s in all) {
    if (seen.length >= max) break;
    if (seen.add(s.code)) prefetchStoryImage(s);
  }
}

/// Story ko'rish oynasi.
///
/// Chap/o'ng yarmiga tegish oldingi/keyingi story'ga o'tkazadi, bosib
/// turish esa taymerni to'xtatadi — bu shakl foydalanuvchiga tanish
/// bo'lgani uchun tanlangan, lekin ramka NFCSTORE vizual tilida:
/// kapsula shaklidagi progress va yumshoq gradient.
///
/// ODAMLAR ORASIDA — Instagram kabi: bir odamning oxirgi istoryasi
/// tugasa (yoki o'ngga tegilsa) keyingi odamniki boshlanadi, birinchi
/// istoryada chapga tegish oldingi odamga qaytaradi, yon tomonga
/// surish ham odam almashtiradi. Ko'ruvchi faqat ENG OXIRGI odamdan
/// keyin yopiladi.
class StoryViewerScreen extends ConsumerStatefulWidget {
  const StoryViewerScreen({
    super.key,
    required this.code,
    this.isBusiness = false,
    this.owners,
    this.initialIndex = 0,
  });

  final String code;

  /// Kod kompaniyanikimi. Marshrut `?business=1` orqali uzatadi.
  final bool isBusiness;

  /// Odamlar navbati (bosh sahifa qatori tartibida). `null` bo'lsa
  /// [storyQueueProvider] dan olinadi, u ham bo'lmasa — faqat [owner].
  final List<StoryOwner>? owners;

  /// [owners] ichida qaysi odamdan boshlanadi.
  final int initialIndex;

  StoryOwner get owner => StoryOwner(code, isBusiness: isBusiness);

  @override
  ConsumerState<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends ConsumerState<StoryViewerScreen> {
  late final List<StoryOwner> _owners;
  late final PageController _pager;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    final given = widget.owners;
    final queued = ref.read(storyQueueProvider);
    if (given != null &&
        widget.initialIndex >= 0 &&
        widget.initialIndex < given.length) {
      _owners = given;
      _page = widget.initialIndex;
    } else if (queued != null &&
        queued.start >= 0 &&
        queued.start < queued.owners.length &&
        // Navbat AYNAN shu marshrut uchun qo'yilgan bo'lsagina.
        queued.owners[queued.start] == widget.owner) {
      _owners = queued.owners;
      _page = queued.start;
    } else {
      _owners = [widget.owner];
    }
    _pager = PageController(initialPage: _page);
    // Navbat BIR MARTALIK: keyin profil halqasidan ochilgan istorya
    // eskirgan navbat bo'yicha boshqa odamlarga o'tib ketmasin.
    // Kadrdan keyin — provayderni `initState` ichida o'zgartirib
    // bo'lmaydi.
    if (queued != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final q = ref.read(storyQueueProvider.notifier);
        if (identical(q.state, queued)) q.state = null;
      });
    }
  }

  @override
  void dispose() {
    _pager.dispose();
    super.dispose();
  }

  /// Boshqa odamga o'tish — yumshoq varaqlash bilan.
  void _toOwner(int i) {
    if (i < 0 || i >= _owners.length || !_pager.hasClients) return;
    _pager.animateToPage(
      i,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Varaqlar orasida oq fon chaqnamasin.
    return ColoredBox(
      color: Colors.black,
      child: PageView.builder(
        key: const ValueKey('story-pager'),
        controller: _pager,
        itemCount: _owners.length,
        onPageChanged: (i) => setState(() => _page = i),
        itemBuilder: (_, i) {
          final o = _owners[i];
          return _OwnerStories(
            key: ValueKey(o),
            code: o.code,
            isBusiness: o.isBusiness,
            active: i == _page,
            onNextOwner: i + 1 < _owners.length ? () => _toOwner(i + 1) : null,
            onPrevOwner: i > 0 ? () => _toOwner(i - 1) : null,
          );
        },
      ),
    );
  }
}

/// BITTA ODAMNING ISTORYALARI — varaqlovchining bitta sahifasi.
///
/// Avval bu butun ekran edi; mantiq o'zgarmadi, faqat [active]
/// (taymer va video FAQAT ko'rinib turgan sahifada yuradi) va
/// qo'shni odamga o'tish chaqiruvlari qo'shildi.
class _OwnerStories extends ConsumerStatefulWidget {
  const _OwnerStories({
    super.key,
    required this.code,
    required this.isBusiness,
    required this.active,
    this.onNextOwner,
    this.onPrevOwner,
  });

  final String code;
  final bool isBusiness;

  /// Sahifa hozir ekrandami. Surish paytida qo'shni sahifa ham
  /// chiziladi — uning taymeri yurmasligi, videosi ochilmasligi va
  /// "ko'rildi" yuborilmasligi kerak.
  final bool active;

  /// Keyingi/oldingi odam — `null` bo'lsa u tomonda hech kim yo'q.
  final VoidCallback? onNextOwner;
  final VoidCallback? onPrevOwner;

  StoryOwner get owner => StoryOwner(code, isBusiness: isBusiness);

  @override
  ConsumerState<_OwnerStories> createState() => _OwnerStoriesState();
}

class _OwnerStoriesState extends ConsumerState<_OwnerStories>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  static const _perStory = Duration(seconds: 5);

  /// TAYMER `initState` DA YARATILADI.
  ///
  /// Ilgari bu maydon `late final ... = AnimationController(...)` edi,
  /// ya'ni kontroller BIRINCHI O'QILGANDA tug'ilardi. Istoryasi
  /// bo'lmagan profil ochilsa `build` bo'sh holatni qaytarardi va
  /// kontrollerga umuman tegilmasdi — natijada uni BIRINCHI marta
  /// `dispose()` uyg'otardi va `createTicker` o'chirilgan element
  /// ustida chaqirilib, "Looking up a deactivated widget's ancestor
  /// is unsafe" xatosi chiqardi.
  late final AnimationController _progress;

  /// BOSH SAHIFADA ALLAQACHON YUKLANGAN ISTORYALAR.
  ///
  /// Ilgari ko'ruvchi har ochilishda ro'yxatni serverdan QAYTA so'rardi
  /// va javob kelguncha qora ekranda aylanuvchi belgi turardi — holbuki
  /// o'sha istoryalar bosh sahifada allaqachon bor edi. Endi ular darhol
  /// ko'rsatiladi, server javobi esa fonda keladi va joriy istorya
  /// (`id` bo'yicha) o'z joyida qoladi.
  ///
  /// `ref.exists` — bosh sahifa provayderi TIRIK bo'lsagina; aks holda
  /// (App Link, jismoniy karta) keraksiz ikkinchi so'rov boshlanmaydi.
  List<StoryItem>? _seed;

  /// Joriy istorya va uning MEDIASI tayyorligi.
  ///
  /// Taymer faqat media ekranda paydo bo'lgach yuradi. Ilgari u
  /// ro'yxat kelishi bilan boshlanardi: sekin internetda video 5
  /// soniyada ochilmasa, istorya KO'RILMASDAN o'tib ketardi.
  int? _currentId;
  int? _readyId;
  Timer? _watchdog;
  List<StoryItem> _items = const [];

  bool get _mediaReady => _readyId != null && _readyId == _currentId;

  @override
  void initState() {
    super.initState();
    _progress = AnimationController(vsync: this, duration: _perStory)
      ..addStatusListener((s) {
        if (s == AnimationStatus.completed) _next();
      });
    WidgetsBinding.instance.addObserver(this);
    _seed = _seedFromHome();
  }

  /// Sahifa ekranga keldi yoki ketdi (odamlar orasida surish).
  @override
  void didUpdateWidget(covariant _OwnerStories old) {
    super.didUpdateWidget(old);
    if (widget.active == old.active) return;
    if (!widget.active) {
      // Ketayotgan odamning taymeri to'xtaydi — aks holda u ortda
      // tugab, `_next` orqali YANA bir odamga sakratib yuborardi.
      _watchdog?.cancel();
      _progress.stop();
      _holding = false;
      return;
    }
    // Keldi: joriy istorya media tayyorligini qaytadan kutadi (video
    // faqat faol sahifada ochiladi).
    final id = _currentId;
    if (id != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _prepare(id));
    }
  }

  List<StoryItem>? _seedFromHome() {
    if (!ref.exists(homeStoriesProvider)) return null;
    final all = ref.read(homeStoriesProvider).valueOrNull;
    if (all == null || all.isEmpty) return null;
    final p = ref.read(activeProfileProvider);
    // O'z istoryalarim bosh sahifada kodsiz keladi (server qo'shmaydi).
    final own = p != null &&
        p.code == widget.code &&
        p.isBusiness == widget.isBusiness;
    final mine = all
        .where((s) => s.code == widget.code || (own && s.code.isEmpty))
        .toList();
    return mine.isEmpty ? null : mine;
  }

  /// Yangi istorya ko'rsatilmoqda — taymer to'xtaydi va MEDIANI kutadi.
  ///
  /// Media hech qachon "tayyor" demasa ham (buzuq video) ko'ruvchi
  /// osilib qolmasin: 10 soniyadan keyin taymer baribir boshlanadi.
  void _prepare(int id) {
    if (!mounted || id != _currentId) return;
    _watchdog?.cancel();
    _readyId = null;
    _progress
      ..stop()
      ..duration = _perStory
      ..reset();
    if (widget.active) {
      _watchdog = Timer(const Duration(seconds: 10), () => _onReady(id));
    }
    if (mounted) setState(() {});
  }

  /// Media ekranda — taymer boshlanadi. Video bo'lsa uning uzunligi
  /// bilan (60 soniyadan oshmaydi).
  void _onReady(int id, [Duration? d]) {
    // Qo'shni (ko'rinmayotgan) sahifaning rasmi ham yuklanadi — lekin
    // uning taymeri faqat sahifa ekranga kelganda boshlanadi.
    if (!mounted || id != _currentId || !widget.active) return;
    final video = d != null && d > Duration.zero;
    // Bir istorya uchun bir marta; kechikib kelgan video uzunligi esa
    // (qo'riqchi taymerdan keyin) progressni to'g'rilaydi.
    if (_readyId == id && !video) return;
    _watchdog?.cancel();
    _readyId = id;
    final dur = !video
        ? _perStory
        : (d > const Duration(seconds: 60) ? const Duration(seconds: 60) : d);
    _progress
      ..duration = dur
      ..reset();
    if (!_paused && !_holding) _progress.forward();
    setState(() {});
    final at = _items.indexWhere((e) => e.id == id);
    if (at >= 0 && at + 1 < _items.length) prefetchStoryImage(_items[at + 1]);
  }

  /// Pauzadan qaytish — faqat media tayyor bo'lsa.
  void _resume() {
    if (_mediaReady && !_paused && !_holding && widget.active && mounted) {
      _progress.forward();
    }
  }

  /// MEDIANI TO'XTATADI — ekran yopilishidan OLDIN.
  ///
  /// `dispose()` ga tayanib bo'lmaydi: `context.pop()` marshrutni
  /// ANIMATSIYA bilan yopadi va vidjet darhol o'chmaydi. APK #48
  /// gacha ovoz aynan shu oraliqda eshitilib turardi — X bosilgan,
  /// ekran ketgan, ovoz esa davom etardi.
  void _stopMedia() {
    _progress.stop();
    ref.read(audioOwnerProvider).stopAll();
  }

  /// YAGONA CHIQISH NUQTASI.
  ///
  /// Hamma yo'l shu yerdan o'tadi: X tugmasi, Android orqaga,
  /// pastga surish, oxirgi story tugashi va bo'sh holatdagi
  /// "yopish". Har joyda alohida `context.pop()` qoldirilsa,
  /// ulardan biri ertami-kechmi to'xtatishni o'tkazib yuborardi.
  void _close() {
    _stopMedia();
    if (!mounted) return;
    // STEK BO'SH BO'LISHI MUMKIN. Istorya jismoniy kartadan yoki
    // App Link orqali TO'G'RIDAN-TO'G'RI ochilsa, ortida hech
    // narsa yo'q va `pop()` istisno beradi — ya'ni X tugmasi
    // ishlamay qolardi. Bunday holatda uyga qaytamiz.
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Routes.home);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Ilova fonga ketdi — ovoz telefon cho'ntakda davom etmasin.
    if (state != AppLifecycleState.resumed) _stopMedia();
  }

  int _index = 0;
  int _total = 0;

  /// Mahalliy layk holati — `id -> (liked, likes)`.
  ///
  /// Server javobi kelguncha tugma DARHOL o'zgaradi, xato bo'lsa
  /// eski holatga qaytariladi. Provayderni butunlay qayta o'qish
  /// istoryani boshidan boshlab yuborardi.
  final _likes = <int, ({bool liked, int count})>{};

  /// Varaq yoki dialog ochiqmi — shunda taymer TO'XTAB turadi.
  bool _paused = false;

  /// Barmoq ekranni bosib turibdi — taymer ham, video ham to'xtaydi
  /// va ustki belgilar yashiriladi (Instagram kabi: odam kadrni toza
  /// ko'rmoqchi).
  bool _holding = false;

  /// Serverga "ko'rildi" deb yuborilgan story'lar.
  ///
  /// Bir story ekranda bir necha marta qayta chizilishi mumkin
  /// (progress animatsiyasi har kadrda `build` chaqiradi), shuning
  /// uchun takroriy so'rov yuborilmasligi kerak.
  final _seen = <int>{};

  @override
  void dispose() {
    _watchdog?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _progress.dispose();
    super.dispose();
  }

  /// O'Z story'ingni o'chirish.
  ///
  /// `deleteStory` repozitoriyda BOR edi, `storyDeleteConfirm`
  /// tarjimasi ham uchala tilda tayyor edi — lekin ilovada BU
  /// AMALGA KIRISH NUQTASI YO'Q edi. Ya'ni foydalanuvchi o'z
  /// story'sini ilova ichida o'chira olmasdi.
  Future<void> _delete(StoryItem s) async {
    final l = L.of(context);
    _progress.stop();
    final ok =
        await showDialog<bool>(
          context: context,
          builder: (d) => AlertDialog(
            title: Text(l.actionDelete),
            content: Text(l.storyDeleteConfirm),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(d).pop(false),
                child: Text(l.actionCancel),
              ),
              TextButton(
                onPressed: () => Navigator.of(d).pop(true),
                child: Text(
                  l.actionDelete,
                  style: TextStyle(color: context.tokens.error),
                ),
              ),
            ],
          ),
        ) ??
        false;
    if (!mounted) return;
    if (!ok) {
      _resume();
      return;
    }
    final res = await ref.read(socialRepositoryProvider).deleteStory(s.id);
    if (!mounted) return;
    res.when(
      ok: (_) {
        // Ro'yxat SERVERDAN qayta o'qiladi — mahalliy ro'yxatdan
        // olib qo'yish "o'chdi" deb ko'rsatib, aslida qolib
        // ketishi mumkin edi.
        ref.invalidate(storiesOfProvider(widget.owner));
        // Faqat istoryalar qatori — ilgari butun repozitoriy qayta
        // qurilib, lenta, Reels va izohlar ham qaytadan yuklanardi.
        ref.invalidate(homeStoriesProvider);
        _close();
      },
      err: (e) {
        _resume();
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(describeError(l, e))));
      },
    );
  }

  /// Varaq/dialog ochilganda taymer to'xtaydi, yopilganda davom
  /// etadi. Aks holda izoh yozib turganda istorya keyingisiga
  /// o'tib ketardi.
  ///
  /// VIDEO HAM TO'XTAYDI. Ilgari faqat taymer to'xtardi: izoh yozib
  /// turganda video orqada ovozi bilan o'ynab turaverardi. `setState`
  /// — `_StoryFrame` pauzani videoga uzatadi.
  Future<T?> _whilePaused<T>(Future<T?> Function() run) async {
    setState(() => _paused = true);
    _progress.stop();
    try {
      return await run();
    } finally {
      if (mounted) {
        setState(() => _paused = false);
        _resume();
      }
    }
  }

  void _hold(bool on) {
    if (_holding == on || !mounted) return;
    setState(() => _holding = on);
    on ? _progress.stop() : _resume();
  }

  /// LAYK — optimistik, xatoda ORQAGA QAYTADI.
  Future<void> _like(StoryItem s) async {
    final now = _likes[s.id] ?? (liked: s.liked, count: s.likes);
    setState(
      () => _likes[s.id] = (
        liked: !now.liked,
        count: now.count + (now.liked ? -1 : 1),
      ),
    );
    final res = await ref.read(socialRepositoryProvider).likeStory(s.id);
    if (!mounted) return;
    res.when(
      // Server QAYTARGAN sanoq o'rnatiladi — mahalliy taxmin emas.
      ok: (v) =>
          setState(() => _likes[s.id] = (liked: v.liked, count: v.likeCount)),
      err: (_) => setState(() => _likes[s.id] = now),
    );
  }

  /// Izohlar — mavjud `CommentsSection` qayta ishlatiladi.
  ///
  /// `kind` kontekstga qarab: shaxsiy istorya `story`, kompaniya
  /// istoryasi `company_story`.
  Future<void> _comments(StoryItem s) => _whilePaused(
    () => showModalBottomSheet<void>(
      context: context,
      // ILDIZ NAVIGATORDA OCHILADI.
      //
      // Aks holda varaq TAB navigatorida ochiladi va pastki suzuvchi
      // navigatsiya paneli uning ustiga chiziladi — varaqning eng
      // pastki tugmalari panel ostida qolib ko'rinmay qoladi.
      // Ildiz navigatorda varaq butun ekranni qoplaydi.
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CommentsSheet(story: s, business: widget.isBusiness),
    ),
  );

  /// "Ko'rildi" belgisini SERVERGA yuborish.
  ///
  /// `markStorySeen` repozitoriyada bor edi va `POST
  /// /api/stories/:id/view` endpointi ham ishlaydi (E2E buni
  /// tasdiqlagan), lekin ilovada BU METODNI CHAQIRADIGAN JOY
  /// YO'Q edi. Ya'ni story ochilardi, ko'rilardi — va Home
  /// ekranidagi halqa baribir "ko'rilmagan" bo'lib turaverardi.
  ///
  /// Natijasi KUTILMAYDI va xatosi yutiladi: bu yordamchi signal,
  /// uning tufayli story ko'rish to'xtab qolmasligi kerak.
  void _markSeen(StoryItem s) {
    if (!mounted || !widget.active) return;
    if (s.id == 0 || !_seen.add(s.id)) return;
    ref.read(socialRepositoryProvider).markStorySeen(s.id);
    // Bosh sahifa halqasi ham DARHOL "ko'rilgan"ga o'tsin.
    final local = ref.read(seenStoryIdsProvider.notifier);
    if (!local.state.contains(s.id)) local.state = {...local.state, s.id};
  }

  // Indeks o'zgargach `build` yangi istoryani ko'radi va `_prepare`
  // uni media tayyorligini kutishga qo'yadi.
  void _next() {
    if (_index + 1 >= _total) {
      // Oxirgi istorya — KEYINGI ODAM bo'lsa unga o'tiladi, yo'qsa
      // (eng oxirgi odam) ko'ruvchi yopiladi.
      final next = widget.onNextOwner;
      if (next == null) {
        _close();
        return;
      }
      _progress.stop();
      next();
      return;
    }
    setState(() => _index++);
  }

  void _prev() {
    if (_index == 0) {
      // Birinchi istorya — oldingi odam bo'lsa unga qaytiladi.
      final prev = widget.onPrevOwner;
      if (prev != null) {
        _progress.stop();
        prev();
        return;
      }
      // Birinchi istorya — boshidan (media allaqachon ekranda).
      if (_mediaReady) {
        _progress.reset();
        _resume();
      }
      return;
    }
    setState(() => _index--);
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final stories = ref.watch(storiesOfProvider(widget.owner));

    // ANDROID ORQASI HAM SHU OQIMDAN O'TADI.
    //
    // Tizim tugmasi marshrutni TO'G'RIDAN-TO'G'RI yopadi va X
    // tugmasidagi kod umuman ishlamaydi. `canPop: false` bilan
    // yopishni o'zimiz boshqaramiz: avval media to'xtaydi, keyin
    // ekran ketadi.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        // Surish paytida ikki sahifa chiziladi — yopishni faqat
        // ekrandagisi boshqaradi, aks holda marshrut IKKI marta yopilardi.
        if (didPop || !widget.active) return;
        _close();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Builder(builder: (context) {
          // Server javobi bo'lmasa — bosh sahifadagi tayyor ro'yxat.
          final items = stories.valueOrNull ?? _seed;
          if (items == null) {
            if (stories.hasError) {
              // Qora fonda o'qiladigan matn, qayta urinish va yopish.
              return Stack(
                fit: StackFit.expand,
                children: [
                  StatePanel.fromError(
                    context,
                    asAppError(stories.error!),
                    onDark: true,
                    onRetry: () =>
                        ref.invalidate(storiesOfProvider(widget.owner)),
                  ),
                  SafeArea(
                    child: Align(
                      alignment: Alignment.topRight,
                      child: IconButton(
                        onPressed: _close,
                        icon: const Icon(Icons.close_rounded,
                            color: Colors.white),
                        tooltip: l.actionClose,
                      ),
                    ),
                  ),
                ],
              );
            }
            // QORA EKRAN EMAS: egasining surati va oltin halqa.
            final face = _ownerFace();
            return Stack(
              fit: StackFit.expand,
              children: [
                _StoryLoading(url: face.avatar, initials: face.initials),
                SafeArea(
                  child: Align(
                    alignment: Alignment.topRight,
                    child: IconButton(
                      onPressed: _close,
                      icon: const Icon(Icons.close_rounded,
                          color: Colors.white),
                      tooltip: l.actionClose,
                    ),
                  ),
                ),
              ],
            );
          }
          {
            if (items.isEmpty) {
              // Navbatda bu odamning istoryasi qolmagan (muddati o'tgan
              // yoki o'chirilgan) — bo'sh ekranda to'xtamasdan keyingisiga.
              if (widget.active && widget.onNextOwner != null) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted && widget.active) widget.onNextOwner?.call();
                });
              }
              return StatePanel(
                icon: Icons.auto_stories_outlined,
                title: l.stateEmpty,
                actionLabel: l.actionClose,
                onAction: _close,
                onDark: true,
              );
            }
            // Ro'yxat yangilansa (bosh sahifa -> server) JORIY istorya
            // o'z joyida qoladi — indeks `id` bo'yicha qayta topiladi.
            // FAQAT ro'yxatning o'zi almashganda: har `build` da qilinsa
            // "keyingisi" bosilgan indeksni eski istoryaga qaytarardi.
            if (!identical(items, _items) && _currentId != null) {
              final at = items.indexWhere((e) => e.id == _currentId);
              if (at >= 0) _index = at;
            }
            // INSTAGRAM KABI: odam ochilganda birinchi KO'RILMAGAN
            // istoryasidan boshlanadi (hammasi ko'rilgan bo'lsa —
            // boshidan). Faqat BIRINCHI ro'yxatda — keyin indeksni
            // odam o'zi boshqaradi.
            if (_currentId == null && _items.isEmpty) {
              final local = ref.read(seenStoryIdsProvider);
              final at = items.indexWhere((e) => !storySeen(e, local));
              if (at > 0) _index = at;
            }
            _index = _index.clamp(0, items.length - 1);
            _items = items;
            _total = items.length;
            final s = items[_index];
            if (_currentId != s.id) {
              _currentId = s.id;
              _readyId = null;
              WidgetsBinding.instance
                  .addPostFrameCallback((_) => _prepare(s.id));
            }
            WidgetsBinding.instance.addPostFrameCallback((_) => _markSeen(s));

            // "Meniki" — story kodi o'zimning NFC yozuvlarimdan
            // birida bo'lsa. Egalik huquqini baribir SERVER hal
            // qiladi (o'zganikida 403 keladi); bu shunchaki
            // ishlamaydigan tugmani ko'rsatmaslik uchun.
            //
            // EGASI. `GET /api/records/:code/stories` va kompaniya
            // yo'li istoryaga egasining kodi, ismi va suratini
            // QO'SHMAYDI (faqat `/api/stories/feed` qo'shadi). Shuning
            // uchun o'z istoryangda tepada bo'sh oq doira turardi, ism
            // yo'q edi, "meniki" ham aniqlanmay, o'chirish o'rniga
            // shikoyat tugmasi chiqardi (egasi, 2026-09 surat).
            // Kod marshrutdan, ism va surat profil ma'lumotidan olinadi.
            final code = s.code.isEmpty ? widget.code : s.code;
            final business = widget.isBusiness;
            final ownId = business
                ? null
                : ref
                    .watch(myIdsProvider)
                    .where((e) => e.code == code)
                    .firstOrNull;
            final ownBiz = business
                ? ref
                    .watch(myBusinessesProvider)
                    .valueOrNull
                    ?.where((b) => b.companyId == code)
                    .firstOrNull
                : null;
            final mine = ownId != null || ownBiz != null;
            final public = (business || ownId != null ||
                    (s.authorName.isNotEmpty && s.authorAvatar.isNotEmpty))
                ? null
                : ref.watch(publicProfileProvider(code)).valueOrNull;
            final authorName = s.authorName.isNotEmpty
                ? s.authorName
                : (ownId?.name ?? ownBiz?.displayName ?? public?.name ?? '');
            final authorAvatar = s.authorAvatar.isNotEmpty
                ? s.authorAvatar
                : (ownId?.avatarUrl ?? ownBiz?.logoUrl ?? public?.avatarUrl ?? '');

            // Mahalliy layk holati bo'lsa o'sha, aks holda serverniki.
            final lk = _likes[s.id];
            final liked = lk?.liked ?? s.liked;
            final likeCount = lk?.count ?? s.likes;
            final ago = storyAgo(l, s.createdAt);

            return GestureDetector(
              onTapUp: (d) {
                final half = MediaQuery.sizeOf(context).width / 2;
                d.localPosition.dx < half ? _prev() : _next();
              },
              onLongPressStart: (_) => _hold(true),
              onLongPressEnd: (_) => _hold(false),
              onVerticalDragEnd: (d) {
                if ((d.primaryVelocity ?? 0) > 260) _close();
              },
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // ISTORYALAR ORASIDA YUMSHOQ O'TISH.
                  //
                  // Ilgari `setState(() => _index++)` media'ni BIR
                  // ZUMDA almashtirardi: ekran chaqnab ketardi va
                  // ko'z har o'tishda "sakrash" sezardi.
                  // Instagram'da o'tish sezilmaydi, chunki kadr
                  // so'nib, keyingisi ochiladi.
                  //
                  // Kalit — istorya `id`si, ya'ni almashuv AYNAN
                  // yangi istoryaga o'tganda ishga tushadi; ichki
                  // qayta chizishlar (progress, layk) animatsiya
                  // qo'zg'atmaydi.
                  //
                  // `layoutBuilder`: eski kadr yangisining OSTIDA
                  // so'nadi. Standart holatda ikkisi markazga
                  // tekislanadi va o'tish paytida orqadagi qora fon
                  // bir lahza ko'rinib qolardi.
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 260),
                    switchInCurve: Curves.easeOutCubic,
                    switchOutCurve: Curves.easeInCubic,
                    layoutBuilder: (cur, prev) => Stack(
                      fit: StackFit.expand,
                      children: [...prev, if (cur != null) cur],
                    ),
                    child: _StoryFrame(
                      key: ValueKey(s.id),
                      story: s,
                      active: widget.active,
                      paused: _holding || _paused,
                      onReady: (d) => _onReady(s.id, d),
                    ),
                  ),
                  // MEDIA YUKLANGUNCHA — qora ekran o'rniga egasining
                  // surati va oltin halqa; tayyor bo'lgach so'nadi.
                  Positioned.fill(
                    child: IgnorePointer(
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 220),
                        child: _mediaReady
                            ? const SizedBox.expand()
                            : _StoryLoading(
                                key: const ValueKey('story-loading'),
                                url: authorAvatar,
                                initials: _initials(authorName, code),
                                transparent: true,
                              ),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: _chrome(IgnorePointer(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.center,
                            colors: [
                              Colors.black.withValues(alpha: .55),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    )),
                  ),
                  // Pastki amallar (izoh, layk, ulashish) och rasm ustida
                  // ham o'qilsin — ilgari rasmdagi yozuv bilan qo'shilib
                  // ketardi.
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 180,
                    child: _chrome(IgnorePointer(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [
                              Colors.black.withValues(alpha: .6),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    )),
                  ),
                  _chrome(SafeArea(
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: Gap.md,
                            vertical: Gap.sm,
                          ),
                          child: Row(
                            children: [
                              for (var i = 0; i < items.length; i++)
                                Expanded(
                                  child: Padding(
                                    padding: EdgeInsets.only(
                                      right: i == items.length - 1 ? 0 : 4,
                                    ),
                                    child: ClipRRect(
                                      borderRadius: R.pill,
                                      child: AnimatedBuilder(
                                        animation: _progress,
                                        builder: (_, __) =>
                                            LinearProgressIndicator(
                                              value: i < _index
                                                  ? 1
                                                  : i == _index
                                                  ? _progress.value
                                                  : 0,
                                              minHeight: 2.5,
                                              backgroundColor: Colors.white
                                                  .withValues(alpha: .3),
                                              valueColor:
                                                  const AlwaysStoppedAnimation(
                                                    Colors.white,
                                                  ),
                                            ),
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: Gap.lg,
                          ),
                          child: Row(
                            children: [
                              Avatar(
                                url: authorAvatar,
                                initials: _initials(authorName, code),
                                size: 38,
                                onTap: () => context.push(
                                    Routes.author(code, company: business)),
                              ),
                              const SizedBox(width: Gap.sm),
                              Expanded(
                                child: Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        authorName.isEmpty ? code : authorName,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontFamily: AppType.sans,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                    // QACHON QO'YILGANI ("3 soat oldin").
                                    // Istorya 24 soat yashaydi — eskimi
                                    // yoki yangimi, ko'ruvchi bilishi
                                    // kerak. Sana kelmasa chizilmaydi.
                                    if (ago != null) ...[
                                      const SizedBox(width: Gap.sm),
                                      Text(
                                        ago,
                                        key: const ValueKey('story-time'),
                                        maxLines: 1,
                                        style: TextStyle(
                                          fontFamily: AppType.sans,
                                          fontSize: 12.5,
                                          color: Colors.white
                                              .withValues(alpha: .75),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              // OVOZ — faqat video istoryada. Holat
                              // lenta va Reels bilan UMUMIY: bir joyda
                              // o'chirilsa, hamma joyda o'chiq qoladi.
                              if (s.isVideo) const MuteButton(),
                              // O'chirish FAQAT o'z story'ingda
                              // ko'rinadi. Begonanikida tugma umuman
                              // chizilmaydi — bosilib "ruxsat yo'q"
                              // deydigan tugma qoldirilmadi.
                              if (mine)
                                IconButton(
                                  onPressed: () => _delete(s),
                                  icon: const Icon(
                                    Icons.delete_outline_rounded,
                                    color: Colors.white,
                                  ),
                                  tooltip: l.actionDelete,
                                ),
                              // Begona istoriyada — shikoyat va bloklash.
                              if (!mine)
                                IconButton(
                                  key: const ValueKey('story-actions'),
                                  onPressed: () => _whilePaused(
                                    () => showContentActions(
                                      context,
                                      ref,
                                      target: ReportTarget.story,
                                      targetId: '${s.id}',
                                      ownerCode: code,
                                      blockKind: business
                                          ? BlockKind.company
                                          : BlockKind.record,
                                      blockId: code,
                                      keyPrefix: 'story',
                                    ),
                                  ),
                                  icon: const Icon(
                                    Icons.more_horiz_rounded,
                                    color: Colors.white,
                                  ),
                                  tooltip: l.reportTitle,
                                ),
                              IconButton(
                                onPressed: _close,
                                icon: const Icon(
                                  Icons.close_rounded,
                                  color: Colors.white,
                                ),
                                tooltip: l.actionClose,
                              ),
                            ],
                          ),
                        ),
                        // IZOH. Server uni har doim qaytaradi, model
                        // esa tashlab yuborardi — shuning uchun
                        // istoryaga yozilgan matn hech qachon
                        // ko'rinmasdi.
                        if (s.caption.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(
                              Gap.lg,
                              Gap.md,
                              Gap.lg,
                              0,
                            ),
                            child: Text(
                              s.caption,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontFamily: AppType.sans,
                                fontSize: 13.5,
                                height: 1.35,
                                color: Colors.white,
                                shadows: [
                                  Shadow(color: Colors.black54, blurRadius: 10),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  )),

                  // ── PASTKI AMALLAR: layk, izoh, ulashish ────────
                  //
                  // Ilgari istorya ko'ruvchisida HECH QANDAY amal yo'q
                  // edi: ko'rib, chiqib ketishdan boshqa ish qilib
                  // bo'lmasdi. Uchala endpoint ham serverda allaqachon
                  // bor edi.
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _chrome(SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          Gap.lg,
                          0,
                          Gap.lg,
                          Gap.md,
                        ),
                        child: Row(
                          children: [
                            // KIM KO'RDI — faqat EGASIGA (Instagram'dagi
                            // ko'z). Begonaga boshqa odamning
                            // statistikasi ko'rsatilmaydi.
                            if (mine) ...[
                              _StoryViews(count: s.viewCount),
                              const SizedBox(width: Gap.sm),
                            ],
                            Expanded(
                              child: _StoryAction(
                                icon: NovaIcons.comment,
                                label: l.storyCommentHint,
                                onTap: () => _comments(s),
                              ),
                            ),
                            const SizedBox(width: Gap.sm),
                            _StoryIcon(
                              icon: liked
                                  ? NovaIcons.liked
                                  : NovaIcons.like,
                              tint: liked ? t.error : Colors.white,
                              label: l.storyLike,
                              count: likeCount,
                              onTap: () => _like(s),
                            ),
                            const SizedBox(width: Gap.sm),
                            _StoryIcon(
                              icon: NovaIcons.share,
                              tint: Colors.white,
                              label: l.actionShare,
                              // Ulashiladigan narsa — MUALLIFNING OCHIQ
                              // profili. Istoryaning o'zi 24 soatda
                              // yo'qoladi va yopiq havola bo'lardi.
                              onTap: () => _whilePaused(
                                () => shareLink(
                                  business
                                      ? '$kApiBase/c/${Uri.encodeComponent(code)}'
                                      : '$kApiBase/${Uri.encodeComponent(code)}',
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )),
                  ),
                ],
              ),
            );
          }
        }),
      ),
    );
  }

  /// Ustki belgilar (progress, sarlavha, amallar, soyalar) — barmoq
  /// bosib turilganda yashiriladi, qo'yib yuborilganda qaytadi.
  Widget _chrome(Widget child) => AnimatedOpacity(
        opacity: _holding ? 0 : 1,
        duration: const Duration(milliseconds: 180),
        child: child,
      );

  String _initials(String name, String fallback) {
    final s = name.trim().isEmpty ? fallback : name.trim();
    return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
  }

  /// Ro'yxat hali kelmagan paytda — egasining surati va bosh harflari.
  ({String avatar, String initials}) _ownerFace() {
    final code = widget.code;
    if (widget.isBusiness) {
      final b = ref
          .watch(myBusinessesProvider)
          .valueOrNull
          ?.where((b) => b.companyId == code)
          .firstOrNull;
      return (
        avatar: b?.logoUrl ?? '',
        initials: _initials(b?.displayName ?? '', code),
      );
    }
    final id = ref.watch(myIdsProvider).where((e) => e.code == code).firstOrNull;
    if (id != null) {
      final avatar = id.avatarUrl.isNotEmpty
          ? id.avatarUrl
          : (ref.watch(currentUserProvider)?.avatarUrl ?? '');
      return (avatar: avatar, initials: _initials(id.name, code));
    }
    final pub = ref.watch(publicProfileProvider(code)).valueOrNull;
    return (
      avatar: pub?.avatarUrl ?? '',
      initials: _initials(pub?.name ?? '', code),
    );
  }
}

/// "3 soat oldin" — istorya sarlavhasidagi nisbiy vaqt.
///
/// Sana bo'lmasa `null` (vaqt chizilmaydi — to'qib chiqarilmaydi).
/// Telefon soati serverdan biroz orqada bo'lsa farq manfiy chiqadi —
/// u ham "hozirgina".
String? storyAgo(L l, DateTime? at, {DateTime? now}) {
  if (at == null) return null;
  final d = (now ?? DateTime.now()).difference(at.toLocal());
  if (d.inMinutes < 1) return l.storyTimeJustNow;
  if (d.inHours < 1) return l.storyTimeMinutes(d.inMinutes);
  if (d.inDays < 1) return l.storyTimeHours(d.inHours);
  return l.storyTimeDays(d.inDays);
}

/// Ko'rishlar soni — ko'z belgisi bilan, faqat egasining istoryasida.
class _StoryViews extends StatelessWidget {
  const _StoryViews({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: L.of(context).viewsCount('$count'),
      excludeSemantics: true,
      child: Container(
        key: const ValueKey('story-views'),
        height: 42,
        padding: const EdgeInsets.symmetric(horizontal: Gap.md),
        decoration: BoxDecoration(
          borderRadius: R.pill,
          color: Colors.white.withValues(alpha: .14),
          border: Border.all(color: Colors.white.withValues(alpha: .35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.visibility_outlined,
                size: 18, color: Colors.white),
            const SizedBox(width: 6),
            Text(
              '$count',
              style: const TextStyle(
                fontFamily: AppType.sans,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// ISTORYA YUKLANMOQDA — qora bo'sh ekran EMAS.
///
/// Egasining surati markazda, atrofida ingichka oltin aylanuvchi
/// halqa (NFCSTORE istorya halqasi rangida). `transparent` — media
/// ustida (kadr foni ko'rinib turadi), aks holda qora fonda.
class _StoryLoading extends StatelessWidget {
  const _StoryLoading({
    super.key,
    required this.url,
    required this.initials,
    this.transparent = false,
  });

  final String url;
  final String initials;
  final bool transparent;

  @override
  Widget build(BuildContext context) {
    final body = Center(
      child: SizedBox(
        width: 96,
        height: 96,
        child: Stack(
          alignment: Alignment.center,
          children: [
            SizedBox.expand(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: context.tokens.goldOnDark(IdPlate.goldLight),
              ),
            ),
            Avatar(url: url, initials: initials, size: 82, ring: false),
          ],
        ),
      ),
    );
    if (transparent) return body;
    return ColoredBox(color: Colors.black, child: body);
  }
}

/// Istorya ostidagi "izoh yozing…" maydoni ko'rinishi.
///
/// Haqiqiy matn maydoni EMAS: bosilganda izohlar varag'i ochiladi
/// va yozish o'sha yerda bo'ladi. Shunda klaviatura istorya
/// ko'rinishini buzmaydi va taymer ham to'xtab turadi.
class _StoryAction extends StatelessWidget {
  const _StoryAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 42,
          padding: const EdgeInsets.symmetric(horizontal: Gap.md),
          decoration: BoxDecoration(
            borderRadius: R.pill,
            color: Colors.white.withValues(alpha: .14),
            border: Border.all(color: Colors.white.withValues(alpha: .35)),
          ),
          child: Row(
            children: [
              Icon(icon, size: 17, color: Colors.white),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 13,
                    color: Colors.white,
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

/// Dumaloq amal tugmasi — ostida sanoq (bo'lsa).
class _StoryIcon extends StatelessWidget {
  const _StoryIcon({
    required this.icon,
    required this.tint,
    required this.label,
    required this.onTap,
    this.count = 0,
  });

  final IconData icon;
  final Color tint;
  final String label;
  final VoidCallback onTap;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: count > 0 ? '$label: $count' : label,
      child: Tooltip(
        message: label,
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: .14),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: .35),
                  ),
                ),
                child: Icon(icon, size: 19, color: tint),
              ),
              if (count > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    '$count',
                    style: const TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                      shadows: [Shadow(color: Colors.black54, blurRadius: 8)],
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

/// Izohlar varag'i.
///
/// Mavjud `CommentsSection` QAYTA ISHLATILADI — istorya uchun
/// alohida izoh tizimi yozilmaydi. `kind` istorya EGASIGA qarab
/// tanlanadi: shaxsiy istorya `story`, kompaniya istoryasi
/// `company_story`.
class _CommentsSheet extends ConsumerWidget {
  const _CommentsSheet({required this.story, required this.business});

  final StoryItem story;

  /// Istorya kompaniyaniki (ko'ruvchining `isBusiness` i). Ilgari tur
  /// KO'RUVCHINING faol profilidan olinardi — biznes rejimidagi odam
  /// shaxsiy istoryaga izoh yozolmasdi (404) va aksincha.
  final bool business;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final l = L.of(context);

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      // BALANDLIK ANIQ BERILADI.
      //
      // `DraggableScrollableSheet` + ichki ro'yxat birikmasi
      // "Vertical viewport was given unbounded height" xatosini
      // berardi: `CommentsSection` ning o'zi `Column`, ya'ni
      // scrollni TASHQARIDAN olishi kerak. Shuning uchun balandlik
      // ekranning 70% i qilib belgilanadi va ichida bitta scroll
      // qoladi.
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .7,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            border: Border.all(color: t.border2),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: Gap.sm),
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: t.border2,
                    borderRadius: R.pill,
                  ),
                ),
              ),
              const SizedBox(height: Gap.sm),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
                child: Text(
                  l.storyComments,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  // Pastki tizim paneli ostida oxirgi izoh qolmasin
                  // (Reels izohlari bilan bir xil tuzatish).
                  padding: EdgeInsets.only(
                      bottom: Gap.lg + MediaQuery.viewPaddingOf(context).bottom),
                  child: CommentsSection(
                    kind: business ? 'company_story' : 'story',
                    id: story.id,
                    ownerCode: story.code,
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

/// BITTA ISTORYA KADRI.
///
/// Ilgari bu uchlik shart `Stack` ichida to'g'ridan-to'g'ri
/// turardi. `AnimatedSwitcher` esa BITTA bola kutadi va uni
/// kalit bo'yicha almashtiradi — shuning uchun kadr alohida
/// vidjetga ajratildi. Mantiq o'zgarmadi.
class _StoryFrame extends StatelessWidget {
  const _StoryFrame({
    super.key,
    required this.story,
    required this.onReady,
    this.active = true,
    this.paused = false,
  });

  final StoryItem story;

  /// Sahifa ekrandami. Qo'shni (surish paytida chetdan ko'rinadigan)
  /// odamning videosi OCHILMAYDI — aks holda ikki video bir vaqtda
  /// tarmoq va ovoz talashardi.
  final bool active;

  /// Bosib turish yoki varaq ochiq — video to'xtab turadi.
  final bool paused;

  /// Media EKRANDA — taymer shundan keyin yuradi. Videoda uzunligi
  /// bilan, rasmda `null`.
  final ValueChanged<Duration?> onReady;

  void _readyNextFrame() =>
      WidgetsBinding.instance.addPostFrameCallback((_) => onReady(null));

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    if (story.mediaUrl.isEmpty) {
      _readyNextFrame();
      return DecoratedBox(
        decoration: BoxDecoration(gradient: t.accentGradient),
      );
    }

    if (story.isVideo) {
      if (!active) return const ColoredBox(color: Colors.black);
      // `contain`: yotiq video ekranga sig'sin, usti va osti
      // kesilib ketmasin. Tik video uchun farqi yo'q — u baribir
      // ekranni to'ldiradi.
      return FullBleedMedia(
        child: InlineVideo(
          key: ValueKey(story.id),
          url: story.mediaUrl,
          onDuration: onReady,
          onFailed: () => onReady(null),
          fit: BoxFit.contain,
          paused: paused,
        ),
      );
    }

    // RASM KESILMAYDI. Ilgari `cover` edi: kvadrat rasm (masalan
    // logotip) butun ekranni to'ldirishi uchun kattalashtirilar va
    // hoshiyasi qirqilardi. Endi rasm butunligicha ko'rinadi,
    // atrofi esa o'sha rasmning xira nusxasi bilan to'ladi.
    final url = story.mediaUrl;
    if (isAssetMedia(url)) {
      _readyNextFrame();
      return FullBleedMedia(
        backdropUrl: url,
        child: Image.asset(url, fit: BoxFit.contain),
      );
    }
    return FullBleedMedia(
      backdropUrl: url,
      child: LayoutBuilder(builder: (context, box) {
        final side = [box.maxWidth, box.maxHeight]
            .where((v) => v.isFinite && v > 0)
            .fold<double?>(null, (a, v) => a == null || v > a ? v : a);
        return CachedNetworkImage(
          cacheManager: NovaImageCache.manager,
          imageUrl: url,
          fit: BoxFit.contain,
          memCacheWidth: decodeWidth(context, side),
          fadeInDuration: NovaImageCache.fadeIn,
          fadeOutDuration: NovaImageCache.fadeOut,
          // Yuklanguncha — shaffof: ustida egasining surati turadi.
          placeholder: (_, __) => const SizedBox.shrink(),
          imageBuilder: (_, image) {
            _readyNextFrame();
            return Image(image: image, fit: BoxFit.contain);
          },
          errorWidget: (_, __, ___) {
            // Buzuq rasmda ham ko'ruvchi osilib qolmasin.
            _readyNextFrame();
            return Icon(Icons.broken_image_outlined,
                size: 34, color: Colors.white.withValues(alpha: .6));
          },
        );
      }),
    );
  }
}
