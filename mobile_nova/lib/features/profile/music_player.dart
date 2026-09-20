import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../design/motion/motion.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';

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
class AudioOwner extends StateNotifier<Object?> {
  AudioOwner() : super(null);

  final _stoppers = <Object, VoidCallback>{};

  /// Egalikni oladi. Avvalgi egasi to'xtatiladi.
  void take(Object owner, VoidCallback stop) {
    final prev = state;
    if (prev != null && prev != owner) _stoppers[prev]?.call();
    _stoppers[owner] = stop;
    state = owner;
  }

  /// Egalikni bo'shatadi — faqat o'zi egasi bo'lsa.
  void release(Object owner) {
    _stoppers.remove(owner);
    if (state == owner) state = null;
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

final audioOwnerProvider =
    StateNotifierProvider<AudioOwner, Object?>((ref) => AudioOwner());

/// Musiqa boshqaruvi — avatar/orbning pastki CHAP tomonida.
///
/// Brend nishoni o'ngda turadi, shuning uchun bu chapda: kompozitsiya
/// muvozanatda qoladi. Musiqa YO'Q bo'lsa widget umuman qurilmaydi.
class MusicControl extends ConsumerStatefulWidget {
  const MusicControl({
    super.key,
    required this.urls,
    required this.size,
  });

  final List<String> urls;
  final double size;

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
        onTap: () => showMusicSheet(context, widget.urls),
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
          child: Center(
            child: playing
                ? _Equalizer(size: widget.size * .42, color: t.accent2)
                : Icon(
                    Icons.music_note_rounded,
                    size: widget.size * .46,
                    color: t.accent2,
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
  const _Equalizer({required this.size, required this.color});
  final double size;
  final Color color;

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
    if (reduceMotion(context)) {
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
        _ref.read(audioOwnerProvider.notifier).take(this, stop);
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
    _ref.read(audioOwnerProvider.notifier).take(this, stop);
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
    // Oxiriga yetdi — egalikni bo'shatamiz.
    if (v.duration > Duration.zero && v.position >= v.duration) {
      _ref.read(audioOwnerProvider.notifier).release(this);
    }
  }

  Future<void> pause() async {
    await _c?.pause();
    if (mounted) state = state.copyWith(playing: false);
    _ref.read(audioOwnerProvider.notifier).release(this);
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
    _ref.read(audioOwnerProvider.notifier).release(this);
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
Future<void> showMusicSheet(BuildContext context, List<String> urls) {
  final t = Theme.of(context).extension<NfcTokens>()!;
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => Padding(
      // PASTKI NAVIGATSIYA PANELNI YOPIB QO'YMASIN.
      //
      // Ilgari bu yerda faqat `viewInsets.bottom` (klaviatura)
      // hisobga olinardi — u esa odatda NOL. Ilovaning pastki
      // navigatsiyasi SUZUVCHI va varaq ustiga tushardi: ijro
      // tugmasi va vaqt chizig'i ekran ostida qolib ketardi.
      // `navSafeBottom` navigatsiya balandligini ham, qurilmaning
      // jest panelini ham qo'shadi.
      padding: EdgeInsets.only(
        left: Gap.lg,
        right: Gap.lg,
        bottom: MediaQuery.viewInsetsOf(context).bottom +
            navSafeBottom(context),
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: R.soft,
          border: Border.all(color: t.border2),
        ),
        child: _MusicSheet(urls: urls),
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

class _MusicSheet extends ConsumerWidget {
  const _MusicSheet({required this.urls});
  final List<String> urls;

  static String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString();
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final l = L.of(context);
    final st = ref.watch(musicPlayerProvider);
    final player = ref.read(musicPlayerProvider.notifier);

    return Padding(
      padding: const EdgeInsets.all(Gap.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.music_note_rounded, size: 18, color: t.accent2),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Text(l.musicTitle,
                    style: Theme.of(context).textTheme.titleMedium),
              ),
              IconButton(
                tooltip: l.actionClose,
                icon: const Icon(Icons.close_rounded, size: 20),
                color: t.text3,
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          if (st.failed) ...[
            const SizedBox(height: Gap.sm),
            Text(l.musicFailed,
                style: Theme.of(context).textTheme.bodySmall!
                    .copyWith(color: t.error)),
          ],
          const SizedBox(height: Gap.sm),
          for (final url in urls) ...[
            _Track(
              url: url,
              active: st.url == url,
              state: st,
              onToggle: () => player.toggle(url),
              onSeek: player.seek,
            ),
            if (url != urls.last) const SizedBox(height: Gap.sm),
          ],
        ],
      ),
    );
  }
}

class _Track extends StatelessWidget {
  const _Track({
    required this.url,
    required this.active,
    required this.state,
    required this.onToggle,
    required this.onSeek,
  });

  final String url;
  final bool active;
  final MusicState state;
  final VoidCallback onToggle;
  final ValueChanged<Duration> onSeek;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final playing = active && state.playing;
    final total = state.duration.inMilliseconds;

    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: active ? t.surface2 : Colors.transparent,
        borderRadius: R.tile,
        border: Border.all(color: active ? t.border2 : Colors.transparent),
      ),
      child: Column(
        children: [
          Row(
            children: [
              PressableScale(
                onTap: onToggle,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    gradient: t.accentGradient,
                    shape: BoxShape.circle,
                  ),
                  child: active && state.loading
                      ? Padding(
                          padding: const EdgeInsets.all(11),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: t.onAccent,
                          ),
                        )
                      : Icon(
                          playing
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          size: 21,
                          color: t.onAccent,
                        ),
                ),
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Text(
                  musicTitleOf(url),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ),
            ],
          ),
          if (active && total > 0) ...[
            const SizedBox(height: Gap.sm),
            SliderTheme(
              data: SliderThemeData(
                trackHeight: 2.5,
                activeTrackColor: t.accent2,
                inactiveTrackColor: t.border2,
                thumbColor: t.accent2,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
              ),
              child: Slider(
                value: state.position.inMilliseconds
                    .clamp(0, total)
                    .toDouble(),
                max: total.toDouble(),
                onChanged: (v) =>
                    onSeek(Duration(milliseconds: v.round())),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_MusicSheet._fmt(state.position),
                    style: Theme.of(context).textTheme.labelMedium),
                Text(_MusicSheet._fmt(state.duration),
                    style: Theme.of(context).textTheme.labelMedium),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
