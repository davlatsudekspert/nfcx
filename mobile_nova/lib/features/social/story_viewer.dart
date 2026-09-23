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
import '../home/widgets/avatar.dart';
import '../business/business_providers.dart';
import '../profile/profile_repository.dart';

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

/// Story ko'rish oynasi.
///
/// Chap/o'ng yarmiga tegish oldingi/keyingi story'ga o'tkazadi, bosib
/// turish esa taymerni to'xtatadi — bu shakl foydalanuvchiga tanish
/// bo'lgani uchun tanlangan, lekin ramka NFCSTORE vizual tilida:
/// kapsula shaklidagi progress va yumshoq gradient.
class StoryViewerScreen extends ConsumerStatefulWidget {
  const StoryViewerScreen({
    super.key,
    required this.code,
    this.isBusiness = false,
  });

  final String code;

  /// Kod kompaniyanikimi. Marshrut `?business=1` orqali uzatadi.
  final bool isBusiness;

  StoryOwner get owner => StoryOwner(code, isBusiness: isBusiness);

  @override
  ConsumerState<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends ConsumerState<StoryViewerScreen>
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

  @override
  void initState() {
    super.initState();
    _progress = AnimationController(vsync: this, duration: _perStory)
      ..addStatusListener((s) {
        if (s == AnimationStatus.completed) _next();
      });
    WidgetsBinding.instance.addObserver(this);
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

  /// Serverga "ko'rildi" deb yuborilgan story'lar.
  ///
  /// Bir story ekranda bir necha marta qayta chizilishi mumkin
  /// (progress animatsiyasi har kadrda `build` chaqiradi), shuning
  /// uchun takroriy so'rov yuborilmasligi kerak.
  final _seen = <int>{};

  @override
  void dispose() {
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
      _progress.forward();
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
        ref.invalidate(socialRepositoryProvider);
        _close();
      },
      err: (e) {
        _progress.forward();
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(describeError(l, e))));
      },
    );
  }

  void _start() {
    _progress
      ..duration = _perStory
      ..reset()
      ..forward();
    if (_paused) _progress.stop();
  }

  /// Varaq/dialog ochilganda taymer to'xtaydi, yopilganda davom
  /// etadi. Aks holda izoh yozib turganda istorya keyingisiga
  /// o'tib ketardi.
  Future<T?> _whilePaused<T>(Future<T?> Function() run) async {
    _paused = true;
    _progress.stop();
    try {
      return await run();
    } finally {
      if (mounted) {
        _paused = false;
        _progress.forward();
      }
    }
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
      builder: (_) => _CommentsSheet(story: s),
    ),
  );

  /// Video uzunligi ma'lum bo'lgach, progress shunga moslanadi.
  ///
  /// Aks holda 5 soniyada keyingisiga o'tib ketardi va uzunroq
  /// video hech qachon oxirigacha ko'rilmasdi.
  void _useVideoDuration(Duration d) {
    if (!mounted || d <= Duration.zero) return;
    // Juda uzun videoni ham cheksiz kutmaymiz.
    final capped = d > const Duration(seconds: 60)
        ? const Duration(seconds: 60)
        : d;
    setState(() {
      _progress
        ..duration = capped
        ..reset()
        ..forward();
    });
  }

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
    if (s.id == 0 || !_seen.add(s.id)) return;
    ref.read(socialRepositoryProvider).markStorySeen(s.id);
  }

  void _next() {
    if (_index + 1 >= _total) {
      _close();
      return;
    }
    setState(() => _index++);
    _start();
  }

  void _prev() {
    if (_index == 0) {
      _start();
      return;
    }
    setState(() => _index--);
    _start();
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
        if (didPop) return;
        _close();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: stories.when(
          loading: () => Center(
            child: CircularProgressIndicator(color: t.accent2, strokeWidth: 2),
          ),
          error: (e, __) => StatePanel.fromError(context, asAppError(e)),
          data: (items) {
            if (items.isEmpty) {
              return StatePanel(
                icon: Icons.auto_stories_outlined,
                title: l.stateEmpty,
                actionLabel: l.actionClose,
                onAction: _close,
              );
            }
            if (_total != items.length) {
              _total = items.length;
              WidgetsBinding.instance.addPostFrameCallback((_) => _start());
            }
            final s = items[_index.clamp(0, items.length - 1)];
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

            return GestureDetector(
              onTapUp: (d) {
                final half = MediaQuery.sizeOf(context).width / 2;
                d.localPosition.dx < half ? _prev() : _next();
              },
              onLongPressStart: (_) => _progress.stop(),
              onLongPressEnd: (_) => _progress.forward(),
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
                      onDuration: _useVideoDuration,
                    ),
                  ),
                  Positioned.fill(
                    child: IgnorePointer(
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
                    ),
                  ),
                  // Pastki amallar (izoh, layk, ulashish) och rasm ustida
                  // ham o'qilsin — ilgari rasmdagi yozuv bilan qo'shilib
                  // ketardi.
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 180,
                    child: IgnorePointer(
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
                    ),
                  ),
                  SafeArea(
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
                  ),

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
                    child: SafeArea(
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
                            Expanded(
                              child: _StoryAction(
                                icon: Icons.mode_comment_outlined,
                                label: l.storyCommentHint,
                                onTap: () => _comments(s),
                              ),
                            ),
                            const SizedBox(width: Gap.sm),
                            _StoryIcon(
                              icon: liked
                                  ? Icons.favorite_rounded
                                  : Icons.favorite_border_rounded,
                              tint: liked ? t.error : Colors.white,
                              label: l.storyLike,
                              count: likeCount,
                              onTap: () => _like(s),
                            ),
                            const SizedBox(width: Gap.sm),
                            _StoryIcon(
                              icon: Icons.ios_share_rounded,
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
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  String _initials(String name, String fallback) {
    final s = name.trim().isEmpty ? fallback : name.trim();
    return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
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
/// alohida izoh tizimi yozilmaydi. `kind` kontekstga qarab
/// tanlanadi: shaxsiy istorya `story`, kompaniya istoryasi
/// `company_story`.
class _CommentsSheet extends ConsumerWidget {
  const _CommentsSheet({required this.story});

  final StoryItem story;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final l = L.of(context);
    // Kompaniya istoryasimi — faol profil turiga qarab.
    final company = ref.watch(activeProfileProvider)?.isBusiness ?? false;

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
                    kind: company ? 'company_story' : 'story',
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
    required this.onDuration,
  });

  final StoryItem story;
  final ValueChanged<Duration> onDuration;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    if (story.mediaUrl.isEmpty) {
      return DecoratedBox(
        decoration: BoxDecoration(gradient: t.accentGradient),
      );
    }

    if (story.isVideo) {
      // `contain`: yotiq video ekranga sig'sin, usti va osti
      // kesilib ketmasin. Tik video uchun farqi yo'q — u baribir
      // ekranni to'ldiradi.
      return FullBleedMedia(
        child: InlineVideo(
          key: ValueKey(story.id),
          url: story.mediaUrl,
          onDuration: onDuration,
          fit: BoxFit.contain,
        ),
      );
    }

    // RASM KESILMAYDI. Ilgari `cover` edi: kvadrat rasm (masalan
    // logotip) butun ekranni to'ldirishi uchun kattalashtirilar va
    // hoshiyasi qirqilardi. Endi rasm butunligicha ko'rinadi,
    // atrofi esa o'sha rasmning xira nusxasi bilan to'ladi.
    return FullBleedMedia(
      backdropUrl: story.mediaUrl,
      child: mediaImage(context, story.mediaUrl, fit: BoxFit.contain),
    );
  }
}
