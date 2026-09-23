import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../design/motion/motion.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../design/theme/typography.dart';
import '../social/media_frame.dart' show mediaImage;

/// Profil musiqasi.
///
/// ## Manba — backend, ilova emas
///
/// Musiqa `cards.music_url` ustunida saqlanadi va yozuv bilan birga
/// `musicUrls` bo'lib keladi (ko'pi bilan 5 ta havola). Bu maydon
/// HAR QANDAY yozuvda bor — shaxsiy ham, biznes ham. Shuning uchun
/// pleyer "faqat biznesda" deb cheklanmaydi.
///
/// Backend'da qo'shiq NOMI va IJROCHISI uchun maydon YO'Q. Shuning
/// uchun bu yerda faqat manzildan olingan fayl nomi ko'rsatiladi va
/// ijrochi umuman ko'rsatilmaydi — to'qib chiqarilmaydi.
///
/// ## Nega `video_player`
///
/// Loyihada allaqachon Reels uchun `video_player` bor va u audio
/// faylni ham xuddi shunday o'ynatadi. Faqat musiqa uchun yangi
/// paket qo'shish ilova hajmini bekorga oshirardi.

/// Bir vaqtda faqat BITTA audio manbasi ovoz chiqaradi.
///
/// Reels videosi ham, profil musiqasi ham shu yerdan navbat oladi.
/// Yangi egasi kelganda avvalgisiga to'xtash buyrug'i boradi.
///
/// ## NIMA UCHUN BU `StateNotifier` EMAS
///
/// Ilgari shunday edi va egalik `state` ichida turardi. Oqibati:
/// `take()` yoki `release()` vidjet hayot siklidan chaqirilsa
/// (`initState`, `didUpdateWidget`, `dispose`) Riverpod istisno
/// otardi:
///
///     Tried to modify a provider while the widget tree was building.
///
/// Reels aynan shunga yiqildi: `_ReelPage.initState` -> `_open()`
/// -> `take()`, va bu sliver dangasa qurayotgan paytda sodir
/// bo'lardi. E2E da u "failed after test completion" bo'lib
/// chiqardi — ya'ni har bir tekshiruv o'tsa ham to'plam qizil edi.
///
/// Sabab tuzilishda: egalik reyestri UI HOLATI EMAS. Uni hech kim
/// `watch` qilmaydi — butun ilovada faqat `.notifier` o'qilardi.
/// Ya'ni `state` shunchaki ichki daftar edi va uni provayder
/// holatida saqlashning sababi yo'q edi.
///
/// Endi bu oddiy obyekt: egalik `_current` da turadi, provayder
/// esa uni bir marta yaratadi. Shu bilan butun xatolar sinfi
/// yopildi — reyestrni ISTALGAN joydan chaqirish xavfsiz.
class AudioOwner {
  final _stoppers = <Object, VoidCallback>{};
  Object? _current;

  /// Hozirgi egasi — sinovlar uchun.
  Object? get current => _current;

  /// Egalikni oladi. Avvalgi egasi to'xtatiladi.
  void take(Object owner, VoidCallback stop) {
    final prev = _current;
    if (prev != null && prev != owner) _stoppers[prev]?.call();
    _stoppers[owner] = stop;
    _current = owner;
  }

  /// Egalikni bo'shatadi — faqat o'zi egasi bo'lsa.
  void release(Object owner) {
    _stoppers.remove(owner);
    if (_current == owner) _current = null;
  }

  /// HAMMA MANBANI DARHOL TO'XTATADI.
  ///
  /// Ekran YOPILISHIDAN OLDIN chaqiriladi. Nima uchun `dispose()`
  /// ga tayanib bo'lmaydi: `context.pop()` marshrutni animatsiya
  /// bilan yopadi va vidjet DARHOL o'chmaydi. Odam X ni bosgan
  /// zahoti ovoz to'xtashi kerak, `dispose()` kelishini kutmasdan.
  ///
  /// Ro'yxat NUSXASI bo'ylab yuriladi: to'xtatuvchi o'z navbatida
  /// `release()` chaqirib ro'yxatni o'zgartirishi mumkin.
  void stopAll() {
    for (final stop in _stoppers.values.toList()) {
      stop();
    }
  }
}

final audioOwnerProvider = Provider<AudioOwner>((ref) => AudioOwner());

/// Musiqa boshqaruvi — avatar/orbning pastki CHAP tomonida.
///
/// Brend nishoni o'ngda turadi, shuning uchun bu chapda: kompozitsiya
/// muvozanatda qoladi. Musiqa YO'Q bo'lsa widget umuman qurilmaydi.
class MusicControl extends ConsumerStatefulWidget {
  const MusicControl({
    super.key,
    required this.urls,
    required this.size,
    this.ownerName = '',
    this.ownerAvatar = '',
  });

  final List<String> urls;
  final double size;

  /// Varaqda muqova va sarlavha uchun — kimning profil musiqasi.
  final String ownerName;
  final String ownerAvatar;

  @override
  ConsumerState<MusicControl> createState() => _MusicControlState();
}

class _MusicControlState extends ConsumerState<MusicControl> {
  @override
  Widget build(BuildContext context) {
    if (widget.urls.isEmpty) return const SizedBox.shrink();
    final t = context.tokens;
    final l = L.of(context);
    final playing = ref.watch(musicPlayerProvider).playing;

    return Semantics(
      button: true,
      label: l.musicTitle,
      child: PressableScale(
        onTap: () => showMusicSheet(context, widget.urls,
            ownerName: widget.ownerName, ownerAvatar: widget.ownerAvatar),
        child: Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: t.surfaceSolid,
            border: Border.all(color: t.bg1, width: widget.size * .08),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: .16),
                blurRadius: widget.size * .3,
                offset: Offset(0, widget.size * .06),
              ),
            ],
          ),
          // EKVALAYZER BELGISI — doim. Ijro etilayotganda ustunlar
          // harakatlanadi, to'xtaganda jim turadi: "bu profilda
          // musiqa bor" va "hozir o'ynayapti" bir belgida.
          child: Center(
            child: _Equalizer(
              key: const ValueKey('music-eq'),
              size: widget.size * .44,
              color: t.brandInk,
              animate: playing,
            ),
          ),
        ),
      ),
    );
  }
}

/// Uchta ustun sekin ko'tarilib-tushadi.
///
/// Ataylab juda mayin va sekin: bu holat ko'rsatkichi, e'tibor
/// tortadigan animatsiya emas. `reduceMotion` yoqilganda umuman
/// harakatlanmaydi.
class _Equalizer extends StatefulWidget {
  const _Equalizer({
    super.key,
    required this.size,
    required this.color,
    this.animate = true,
  });
  final double size;
  final Color color;

  /// `false` — ustunlar jim (musiqa bor, lekin o'ynamayapti).
  final bool animate;

  @override
  State<_Equalizer> createState() => _EqualizerState();
}

class _EqualizerState extends State<_Equalizer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(covariant _Equalizer old) {
    super.didUpdateWidget(old);
    if (old.animate != widget.animate) _sync();
  }

  void _sync() {
    if (!widget.animate || reduceMotion(context)) {
      _c.stop();
      _c.value = .5;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final w = widget.size / 5;
          return SizedBox(
            width: widget.size,
            height: widget.size,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < 3; i++) ...[
                  if (i > 0) SizedBox(width: w * .5),
                  Container(
                    width: w,
                    height: widget.size *
                        (.35 + .55 * _wave(_c.value, i)).clamp(.2, 1),
                    decoration: BoxDecoration(
                      color: widget.color,
                      borderRadius: BorderRadius.circular(w),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      );

  /// Har ustun o'z fazasida — bir vaqtda ko'tarilmaydi.
  double _wave(double v, int i) {
    final x = (v + i / 3) % 1.0;
    return x < .5 ? x * 2 : (1 - x) * 2;
  }
}

/// Pleyerning holati.
class MusicState {
  const MusicState({
    this.url = '',
    this.playing = false,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.loading = false,
    this.failed = false,
    this.error = '',
  });

  final String url;
  final bool playing;
  final Duration position;
  final Duration duration;
  final bool loading;

  /// Manzil ochilmadi — buzuq havola yoki tarmoq yo'q.
  final bool failed;

  /// Nega ochilmagani. Foydalanuvchiga ko'rsatilmaydi, lekin E2E
  /// hisobotiga tushadi: "ochilmadi" degan xabar bilan xatoni
  /// topib bo'lmaydi, dekoderning o'z matni bilan esa bo'ladi.
  final String error;

  MusicState copyWith({
    String? url,
    bool? playing,
    Duration? position,
    Duration? duration,
    bool? loading,
    bool? failed,
    String? error,
  }) =>
      MusicState(
        url: url ?? this.url,
        playing: playing ?? this.playing,
        position: position ?? this.position,
        duration: duration ?? this.duration,
        loading: loading ?? this.loading,
        failed: failed ?? this.failed,
        error: error ?? this.error,
      );
}

/// Butun ilova uchun bitta pleyer.
///
/// QOIDALAR:
/// * foydalanuvchi bosmaguncha HECH QACHON o'z-o'zidan ijro etilmaydi;
/// * bir vaqtda bitta manba — `AudioOwner` orqali;
/// * ilova fonga ketganda to'xtaydi;
/// * kontroller har almashuvda va `dispose` da yopiladi.
class MusicPlayer extends StateNotifier<MusicState>
    with WidgetsBindingObserver {
  MusicPlayer(this._ref) : super(const MusicState()) {
    WidgetsBinding.instance.addObserver(this);
  }

  final Ref _ref;
  VideoPlayerController? _c;

  /// Profil musiqalari ro'yxati — oldingi/keyingi uchun.
  List<String> _queue = const [];
  List<String> get queue => _queue;

  /// Ro'yxatni o'rnatadi (varaq ochilganda). Ijro BOSHLANMAYDI.
  void setQueue(List<String> urls) => _queue = List.unmodifiable(urls);

  int get _index => _queue.indexOf(state.url);

  bool get hasNext => _queue.length > 1;

  /// Keyingi qo'shiq (oxiridan keyin — boshiga).
  Future<void> next() async {
    if (_queue.isEmpty) return;
    final i = _index;
    await play(_queue[(i + 1) % _queue.length]);
  }

  /// Oldingi. 3 soniyadan ko'p o'ynagan bo'lsa — shu qo'shiq boshiga
  /// (odatdagi pleyerlar kabi).
  Future<void> previous() async {
    if (_queue.isEmpty) return;
    if (state.position > const Duration(seconds: 3) || _queue.length == 1) {
      await seek(Duration.zero);
      return;
    }
    final i = _index;
    await play(_queue[(i - 1 + _queue.length) % _queue.length]);
  }

  bool _advancing = false;

  /// Ilova fonga ketsa musiqa to'xtaydi.
  ///
  /// Qaytganda O'ZI QAYTA BOSHLANMAYDI: ijro har doim foydalanuvchi
  /// harakatidan boshlanadi.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && this.state.playing) stop();
  }

  Future<void> toggle(String url) async {
    if (state.url == url && _c != null && !state.failed) {
      if (state.playing) {
        await pause();
      } else {
        _ref.read(audioOwnerProvider).take(this, stop);
        await _c!.play();
        state = state.copyWith(playing: true);
      }
      return;
    }
    await play(url);
  }

  Future<void> play(String url) async {
    await _dispose();
    state = MusicState(url: url, loading: true);

    final c = VideoPlayerController.networkUrl(Uri.parse(url));
    _c = c;
    try {
      await c.initialize();
    } catch (e) {
      // Buzuq havola yoki qo'llab-quvvatlanmaydigan format — buni
      // yashirmaymiz, lekin ilova ham qulamaydi.
      //
      // Sabab SAQLANADI. E2E #6 da bu qator "trek ochilmadi"
      // deyishdan boshqa hech narsa bilmasdi va xatoni topish
      // uchun serverni qo'lda titishga to'g'ri keldi.
      if (!mounted) return;
      state = MusicState(
        url: url,
        failed: true,
        error: '${c.value.errorDescription ?? e}',
      );
      await _dispose();
      return;
    }
    if (!mounted) {
      await c.dispose();
      return;
    }

    c.addListener(_onTick);
    _ref.read(audioOwnerProvider).take(this, stop);
    await c.play();
    state = state.copyWith(
      playing: true,
      loading: false,
      duration: c.value.duration,
    );
  }

  void _onTick() {
    final c = _c;
    if (c == null || !mounted) return;
    final v = c.value;
    state = state.copyWith(
      position: v.position,
      duration: v.duration,
      playing: v.isPlaying,
    );
    // Oxiriga yetdi — ro'yxatda keyingisi bo'lsa O'SHANGA o'tiladi
    // (foydalanuvchi o'zi boshlagan ijroning davomi), bo'lmasa
    // egalik bo'shatiladi.
    if (v.duration > Duration.zero && v.position >= v.duration) {
      if (_queue.length > 1 && !_advancing) {
        _advancing = true;
        next().whenComplete(() => _advancing = false);
      } else {
        _ref.read(audioOwnerProvider).release(this);
      }
    }
  }

  Future<void> pause() async {
    await _c?.pause();
    if (mounted) state = state.copyWith(playing: false);
    _ref.read(audioOwnerProvider).release(this);
  }

  /// Boshqa audio egalik olganda chaqiriladi.
  void stop() {
    _c?.pause();
    if (mounted) state = state.copyWith(playing: false);
  }

  Future<void> seek(Duration to) async {
    await _c?.seekTo(to);
    if (mounted) state = state.copyWith(position: to);
  }

  Future<void> _dispose() async {
    final c = _c;
    _c = null;
    if (c != null) {
      c.removeListener(_onTick);
      await c.dispose();
    }
    _ref.read(audioOwnerProvider).release(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    final c = _c;
    _c = null;
    if (c != null) {
      c.removeListener(_onTick);
      c.dispose();
    }
    super.dispose();
  }
}

final musicPlayerProvider =
    StateNotifierProvider<MusicPlayer, MusicState>(MusicPlayer.new);

/// Mini-pleyer varag'i.
Future<void> showMusicSheet(
  BuildContext context,
  List<String> urls, {
  String ownerName = '',
  String ownerAvatar = '',
}) {
  final t = Theme.of(context).extension<NfcTokens>()!;
  return showModalBottomSheet<void>(
    context: context,
    // ILDIZ NAVIGATORDA — suzuvchi pastki panel varaq ustiga chizilmasin.
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(
        left: Gap.md,
        right: Gap.md,
        bottom: MediaQuery.viewInsetsOf(context).bottom +
            MediaQuery.paddingOf(context).bottom +
            Gap.md,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: t.border2),
          boxShadow: t.shadowFloat,
        ),
        child: _MusicSheet(
          urls: urls,
          ownerName: ownerName,
          ownerAvatar: ownerAvatar,
        ),
      ),
    ),
  );
}

/// Manzildan o'qiladigan qo'shiq nomi.
///
/// Backend qo'shiq NOMINI ham, IJROCHISINI ham saqlamaydi — faqat
/// manzil bor. Shuning uchun bu yerda faylning o'z nomi ko'rsatiladi
/// va ijrochi umuman ko'rsatilmaydi: mavjud bo'lmagan ma'lumot
/// to'qib chiqarilmaydi.
String musicTitleOf(String url) {
  var name = Uri.tryParse(url)?.pathSegments.lastOrNull ?? '';
  if (name.isEmpty) name = url;
  final dot = name.lastIndexOf('.');
  if (dot > 0) name = name.substring(0, dot);
  name = Uri.decodeComponent(name).replaceAll(RegExp(r'[_\-]+'), ' ').trim();
  return name.isEmpty ? url : name;
}

/// Premium pleyer varag'i.
///
/// Muqova — profil egasining SURATI (bo'lmasa brend tusidagi sirt).
/// Qo'shiq nomi — fayl nomidan; ijrochi YO'Q, chunki server uni
/// saqlamaydi (`musicTitleOf`). Hech narsa to'qib chiqarilmaydi.
class _MusicSheet extends ConsumerStatefulWidget {
  const _MusicSheet({
    required this.urls,
    this.ownerName = '',
    this.ownerAvatar = '',
  });
  final List<String> urls;
  final String ownerName;
  final String ownerAvatar;

  static String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString();
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  ConsumerState<_MusicSheet> createState() => _MusicSheetState();
}

class _MusicSheetState extends ConsumerState<_MusicSheet> {
  @override
  void initState() {
    super.initState();
    ref.read(musicPlayerProvider.notifier).setQueue(widget.urls);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final st = ref.watch(musicPlayerProvider);
    final player = ref.read(musicPlayerProvider.notifier);
    final current = widget.urls.contains(st.url) ? st.url : widget.urls.first;
    final active = st.url == current;
    final playing = active && st.playing;
    final total = active ? st.duration.inMilliseconds : 0;
    final pos = active ? st.position : Duration.zero;
    final many = widget.urls.length > 1;

    Widget round(IconData icon, String tip, VoidCallback? onTap,
            {Key? key}) =>
        IconButton(
          key: key,
          tooltip: tip,
          onPressed: onTap,
          iconSize: 30,
          color: t.text1,
          disabledColor: t.text3.withValues(alpha: .4),
          icon: Icon(icon),
        );

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.md, Gap.xl, Gap.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                  color: t.border1, borderRadius: R.pill),
            ),
            const SizedBox(height: Gap.lg),
            // MUQOVA
            Container(
              width: 168,
              height: 168,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [t.brandSoft, t.brand],
                ),
                boxShadow: t.shadowSoft,
              ),
              clipBehavior: Clip.antiAlias,
              child: widget.ownerAvatar.isNotEmpty
                  ? mediaImage(context, widget.ownerAvatar, fit: BoxFit.cover)
                  : Center(
                      child: _Equalizer(
                          size: 56, color: t.brandInk, animate: playing)),
            ),
            const SizedBox(height: Gap.lg),
            Text(
              (widget.ownerName.isEmpty ? l.musicTitle : widget.ownerName)
                  .toUpperCase(),
              style: AppType.eyebrow(color: t.brandInk),
            ),
            const SizedBox(height: 4),
            Text(
              musicTitleOf(current),
              key: const ValueKey('music-title'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: AppType.displayStyle(color: t.text1, size: 26),
            ),
            if (st.failed && active) ...[
              const SizedBox(height: Gap.sm),
              Text(l.musicFailed,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall!
                      .copyWith(color: t.error)),
            ],
            const SizedBox(height: Gap.md),
            // PROGRESS + VAQT
            SliderTheme(
              data: SliderThemeData(
                trackHeight: 3,
                activeTrackColor: t.text1,
                inactiveTrackColor: t.border1,
                thumbColor: t.text1,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
              ),
              child: Slider(
                key: const ValueKey('music-progress'),
                value: total > 0
                    ? pos.inMilliseconds.clamp(0, total).toDouble()
                    : 0,
                max: total > 0 ? total.toDouble() : 1,
                onChanged: total > 0
                    ? (v) => player.seek(Duration(milliseconds: v.round()))
                    : null,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(_MusicSheet._fmt(pos),
                      key: const ValueKey('music-pos'),
                      style: AppType.monoStyle(color: t.text2, size: 11.5)),
                  Text(_MusicSheet._fmt(active ? st.duration : Duration.zero),
                      style: AppType.monoStyle(color: t.text2, size: 11.5)),
                ],
              ),
            ),
            const SizedBox(height: Gap.sm),
            // BOSHQARUV
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                round(Icons.skip_previous_rounded, l.musicPrevious,
                    active ? player.previous : null,
                    key: const ValueKey('music-prev')),
                const SizedBox(width: Gap.lg),
                PressableScale(
                  onTap: () => player.toggle(current),
                  child: Container(
                    key: const ValueKey('music-play'),
                    width: 68,
                    height: 68,
                    decoration: BoxDecoration(
                      color: t.text1,
                      shape: BoxShape.circle,
                      boxShadow: t.shadowSoft,
                    ),
                    child: active && st.loading
                        ? Padding(
                            padding: const EdgeInsets.all(22),
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: t.bg1),
                          )
                        : Icon(
                            playing
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            size: 34,
                            color: t.bg1,
                            semanticLabel:
                                playing ? l.musicPause : l.musicPlay,
                          ),
                  ),
                ),
                const SizedBox(width: Gap.lg),
                round(Icons.skip_next_rounded, l.musicNext,
                    many ? player.next : null,
                    key: const ValueKey('music-next')),
              ],
            ),
            if (many) ...[
              const SizedBox(height: Gap.lg),
              Divider(height: 1, color: t.border2),
              const SizedBox(height: Gap.sm),
              for (final url in widget.urls)
                InkWell(
                  borderRadius: R.tile,
                  onTap: () => player.play(url),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        vertical: 10, horizontal: 6),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 22,
                          child: url == st.url && st.playing
                              ? _Equalizer(size: 14, color: t.brandInk)
                              : Icon(Icons.music_note_rounded,
                                  size: 16, color: t.text3),
                        ),
                        const SizedBox(width: Gap.md),
                        Expanded(
                          child: Text(
                            musicTitleOf(url),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: AppType.sans,
                              fontSize: 14,
                              fontWeight: url == current
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: t.text1,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
