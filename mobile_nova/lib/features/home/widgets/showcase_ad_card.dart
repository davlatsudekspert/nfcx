import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../app/app_flags.dart';
import '../../../app/providers.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/social_repository.dart';
import '../../../design/theme/typography.dart';
import '../../../design/tokens/shapes.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../routing/routes.dart';
import '../../../routing/shell.dart';
import '../../profile/music_player.dart' show audioOwnerProvider;
import '../../showcase/ad_video_loader.dart';
import '../../showcase/showcase_screen.dart'
    show showcaseFocusProvider, showcasePlayable;
import '../../social/engagement.dart' show likeKey;
import '../../social/media_frame.dart' show mediaImage;
import '../../social/visible_fraction.dart';

/// ASOSIYDAGI KO'RGAZMA REKLAMASI (egasi tasdiqlagan, 2026-10).
///
/// `GET /api/showcase/ads?video=1&limit=4` — Ko'rgazma lentasidagi
/// reklama bilan bir xil elementlar. Bosh sahifada BITTA vertikal karta
/// (NFC ID kartasi, tezkor amallar va storylardan keyin):
///
/// * qaysi biri — kun va ilova ochilishi bo'yicha navbat bilan
///   ([homeAdIndex]): BOY777, LOL707, ... almashib turadi;
/// * video OVOZSIZ, aylanib o'ynaydi — FAQAT karta kamida 60% ko'rinsa,
///   Asosiy tab ochiq, ustida boshqa ekran yo'q va ilova oldinda
///   bo'lsa. Ekrandan chiqsa yoki tab almashsa — pleer yo'q qilinadi.
///   Ilovada tarmoq turini (Wi‑Fi / mobil) aniqlaydigan paket yo'q,
///   shuning uchun yengil yo'l: faqat ko'ringanda, doim ovozsiz,
///   boshqa ilova ovozi bilan aralashadi (Spotify to'xtamaydi);
/// * bosilsa — Ko'rgazma tabi shu reklama bilan ochiladi (o'sha yerda
///   o'z ovozi/musiqasi, 🔇 va hamma belgilar bilan);
/// * "×" — shu kun oxirigacha chiqmaydi;
/// * so'rov xato, bo'sh javob yoki `showcase` kaliti o'chiq — HECH
///   NARSA chizilmaydi (bo'sh joy ham qolmaydi).

/// Video shuncha ko'rinsa o'ynaydi.
const kHomeAdPlayFraction = 0.6;

@visibleForTesting
DateTime Function() homeAdClock = DateTime.now;

/// Telefon vaqti bo'yicha kun: `YYYY-MM-DD`.
String homeAdDay(DateTime t) =>
    '${t.year.toString().padLeft(4, '0')}-'
    '${t.month.toString().padLeft(2, '0')}-'
    '${t.day.toString().padLeft(2, '0')}';

/// NAVBAT: kun raqami + ilova ochilishlari soni. Har kuni ham, har
/// ochilishda ham keyingi reklama chiqadi.
int homeAdIndex(int count, {required DateTime day, required int launch}) {
  if (count <= 0) return 0;
  final d =
      DateTime.utc(day.year, day.month, day.day).millisecondsSinceEpoch ~/
      Duration.millisecondsPerDay;
  return (d + launch) % count;
}

/// Reklamalar ro'yxati. Kalit o'chiq yoki xato — bo'sh ro'yxat.
final homeShowcaseAdsProvider = FutureProvider<List<Post>>((ref) async {
  final on = ref.watch(appFlagsProvider.select((f) => f.showcase));
  if (!on) return const [];
  final res = await ref.watch(socialRepositoryProvider).showcaseAds();
  final seen = <String>{};
  return [
    for (final p in res.valueOrNull?.items ?? const <Post>[])
      if (p.isAd && showcasePlayable(p) && seen.add(likeKey(p))) p,
  ];
});

/// Shu ishga tushirish raqami — ilova ochilganda bir marta oshadi.
final homeAdLaunchProvider = Provider<int>((ref) {
  final prefs = ref.watch(prefsProvider);
  final n = prefs.homeAdLaunch + 1;
  prefs.setHomeAdLaunch(n).ignore();
  return n;
});

/// "×" bosilgan kun (`YYYY-MM-DD`).
final homeAdHiddenDayProvider = StateProvider<String>(
  (ref) => ref.watch(prefsProvider).homeAdHiddenDay,
);

/// Hozir ko'rsatiladigan reklama yoki `null`.
final homeShowcaseAdProvider = Provider<Post?>((ref) {
  final ads = ref.watch(homeShowcaseAdsProvider).valueOrNull ?? const [];
  if (ads.isEmpty) return null;
  final now = homeAdClock();
  if (ref.watch(homeAdHiddenDayProvider) == homeAdDay(now)) return null;
  final i = homeAdIndex(
    ads.length,
    day: now,
    launch: ref.watch(homeAdLaunchProvider),
  );
  return ads[i];
});

class HomeShowcaseAdCard extends ConsumerStatefulWidget {
  const HomeShowcaseAdCard({super.key});

  @override
  ConsumerState<HomeShowcaseAdCard> createState() => _HomeShowcaseAdCardState();
}

class _HomeShowcaseAdCardState extends ConsumerState<HomeShowcaseAdCard>
    with WidgetsBindingObserver {
  Post? _ad;

  /// OVOZSIZ — boshqa ilova (musiqa) to'xtatilmaydi. Yiqilsa yo'q
  /// qilinib qayta ochiladi (avval bir marta yiqilsa, reklama
  /// almashguncha faqat poster qolardi).
  late final AdVideoLoader _video = AdVideoLoader(
    url: () => _ad?.videoUrl ?? '',
    onChanged: () {
      if (mounted) setState(() {});
    },
    mixWithOthers: () => true,
    beforePlay: (c) async {
      // Bosh sahifada OVOZ HECH QACHON YO'Q.
      await c.setVolume(0);
      return mounted && _shouldPlay;
    },
  );
  double _fraction = 0;
  bool _foreground = true;

  /// Ustida boshqa ekran yo'q va tab ko'rinyapti (`TickerMode`).
  bool _onStage = true;

  bool get _onHome => ref.read(activeTabProvider) == 0;

  /// Pleer turishi mumkin (aks holda yo'q qilinadi).
  bool get _present => _fraction > 0 && _onHome && _foreground;

  /// Video o'ynashi mumkin.
  bool get _shouldPlay =>
      _present && _onStage && _fraction >= kHomeAdPlayFraction;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final s = WidgetsBinding.instance.lifecycleState;
    _foreground =
        s == null ||
        s == AppLifecycleState.resumed ||
        s == AppLifecycleState.inactive;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final on = TickerMode.of(context);
    if (on == _onStage) return;
    _onStage = on;
    _later();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final fg =
        state == AppLifecycleState.resumed ||
        state == AppLifecycleState.inactive;
    if (fg == _foreground) return;
    _foreground = fg;
    if (mounted) _sync();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _video.dispose();
    super.dispose();
  }

  /// Kadrdan keyin (build/o'lchov paytida holat o'zgarmasin).
  void _later() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (mounted) _sync();
  });

  void _onFraction(double f) {
    _fraction = f;
    _later();
  }

  void _sync() {
    final ad = _ad;
    if (ad == null || ad.videoUrl.isEmpty || !_present) {
      _video.reset();
      return;
    }
    if (_shouldPlay) {
      _video.play();
    } else {
      _video.pause();
    }
  }

  void _open(Post ad) {
    _video.reset();
    // Tab almashganda boshqa ovoz to'xtaydi (pastki panel kabi).
    ref.read(audioOwnerProvider).stopAll();
    ref.read(showcaseFocusProvider.notifier).state = ad;
    context.go(Routes.showcase);
  }

  void _hideToday() {
    final day = homeAdDay(homeAdClock());
    ref.read(homeAdHiddenDayProvider.notifier).state = day;
    ref.read(prefsProvider).setHomeAdHiddenDay(day).ignore();
  }

  @override
  Widget build(BuildContext context) {
    final ad = ref.watch(homeShowcaseAdProvider);
    ref.listen<int>(activeTabProvider, (_, __) => _later());
    if (ad == null || _ad == null || likeKey(ad) != likeKey(_ad!)) {
      _video.reset();
      _ad = ad;
      if (ad != null) _later();
    }
    if (ad == null) return const SizedBox.shrink();

    final l = L.of(context);
    final mq = MediaQuery.sizeOf(context);
    final h = (mq.height * .5).clamp(300.0, 480.0);
    final c = _video.controller;
    final playing = _shouldPlay;
    final poster = ad.posterUrl;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        Gap.screenX,
        Gap.sm,
        Gap.screenX,
        Gap.lg,
      ),
      child: Center(
        child: VisibleFraction(
          onChanged: _onFraction,
          child: Semantics(
            button: true,
            label: [
              l.feedSponsored,
              ad.title,
              l.homeAdOpen,
            ].where((e) => e.isNotEmpty).join('. '),
            child: GestureDetector(
              key: const ValueKey('home-ad-card'),
              behavior: HitTestBehavior.opaque,
              onTap: () => _open(ad),
              child: SizedBox(
                width: h * 9 / 16,
                height: h,
                child: ClipRRect(
                  borderRadius: R.gentle,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      const ColoredBox(color: Colors.black),
                      if (c != null && c.value.isInitialized)
                        FittedBox(
                          fit: BoxFit.cover,
                          clipBehavior: Clip.hardEdge,
                          child: SizedBox(
                            width: c.value.size.width,
                            height: c.value.size.height,
                            child: VideoPlayer(
                              c,
                              key: const ValueKey('home-ad-player'),
                            ),
                          ),
                        ),
                      // Poster pleer ilk kadrni chizguncha (pozitsiya > 0)
                      // ko'rinadi: ilk kadr bo'sh gradient bo'lishi mumkin.
                      if (poster.isNotEmpty)
                        PosterUntilPlaying(
                          key: const ValueKey('home-ad-poster'),
                          controller: c,
                          child: mediaImage(context, poster,
                              fit: BoxFit.cover),
                        ),
                      AdVideoSpinner(
                        key: const ValueKey('home-ad-loading'),
                        loading: playing && _video.loading,
                        controller: playing ? c : null,
                      ),
                      // Pastda nozik gradient — sarlavha o'qilsin.
                      IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: const Alignment(0, .3),
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                Colors.black.withValues(alpha: .7),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: Gap.sm,
                        top: Gap.sm,
                        child: _Badge(
                          key: const ValueKey('home-ad-badge'),
                          text: l.feedSponsored,
                        ),
                      ),
                      Positioned(
                        right: 2,
                        top: 2,
                        child: IconButton(
                          key: const ValueKey('home-ad-close'),
                          tooltip: l.homeAdHideToday,
                          onPressed: _hideToday,
                          icon: Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: .45),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close_rounded,
                              size: 16,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      if (ad.title.isNotEmpty)
                        Positioned(
                          left: Gap.md,
                          right: Gap.md,
                          bottom: Gap.md,
                          child: Text(
                            ad.title,
                            key: const ValueKey('home-ad-title'),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: AppType.sans,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              height: 1.25,
                              color: Colors.white,
                              shadows: [
                                Shadow(color: Colors.black54, blurRadius: 8),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
    decoration: BoxDecoration(
      color: Colors.black.withValues(alpha: .45),
      borderRadius: R.pill,
    ),
    child: Text(
      text,
      style: const TextStyle(
        fontFamily: AppType.sans,
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
    ),
  );
}
