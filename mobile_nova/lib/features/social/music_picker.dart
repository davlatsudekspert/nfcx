import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/models.dart';
import '../../data/repositories/music_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../profile/music_player.dart';

/// Reels / post uchun MUSIQA (2026-09-25).
///
/// Manba — faqat NFCSTORE kutubxonasi (`GET /api/music`): admin yuklagan
/// va yoqqan, huquqi bizda bo'lgan treklar. Telefondan ixtiyoriy mp3
/// yuklash hozircha YO'Q (mualliflik huquqi — egasi bilan kelishilgan).
///
/// Tinglash — butun ilova uchun bitta [musicPlayerProvider] orqali:
/// Reels videosi yoki profil musiqasi bilan ikki ovoz birga chiqmaydi.

/// Kutubxona — bir marta yuklanadi, janr va qidiruv ilovaning o'zida
/// (≤ 200 trek; har harfda tarmoqqa bormaymiz).
final musicLibraryProvider = FutureProvider.autoDispose<MusicLibrary>((ref) async {
  final res = await ref.watch(musicRepositoryProvider).library();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// «Shu musiqani ishlatish» — Reel yaratish ekraniga oldindan tanlangan
/// trek. Ekran uni o'qiydi va darhol tozalaydi.
final pendingComposerMusicProvider = StateProvider<MusicTrack?>((ref) => null);

String _mmss(int s) => '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';

/// Tinglash manzili — 30 soniyalik eng yaxshi bo'lak (bo'lmasa to'liq).
String _previewUrl(MusicTrack t) => t.clipUrl.isNotEmpty ? t.clipUrl : t.audioUrl;

/// Musiqa tanlash varag'i. Tanlangan trekni qaytaradi (`null` — bekor).
Future<MusicTrack?> showMusicPicker(BuildContext context) {
  return showModalBottomSheet<MusicTrack>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.tokens.surfaceSolid,
    builder: (_) => const _MusicPickerSheet(),
  );
}

class _MusicPickerSheet extends ConsumerStatefulWidget {
  const _MusicPickerSheet();

  @override
  ConsumerState<_MusicPickerSheet> createState() => _MusicPickerSheetState();
}

class _MusicPickerSheetState extends ConsumerState<_MusicPickerSheet> {
  final _q = TextEditingController();
  String _genre = '';
  late final MusicPlayer _player;
  final _previewed = <String>{};

  /// Pleyerning oxirgi holati (`dispose` da `ref` ishlatib bo'lmaydi).
  MusicState _last = const MusicState();

  @override
  void initState() {
    super.initState();
    _player = ref.read(musicPlayerProvider.notifier);
  }

  @override
  void dispose() {
    _q.dispose();
    // Varaq yopildi — tinglash to'xtaydi (faqat shu yerda boshlangan bo'lsa).
    if (_previewed.contains(_last.url) && _last.playing) _player.pause();
    super.dispose();
  }

  void _preview(MusicTrack t) {
    final url = _previewUrl(t);
    _previewed.add(url);
    _player.toggle(url);
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final lib = ref.watch(musicLibraryProvider);
    final player = _last = ref.watch(musicPlayerProvider);
    final h = MediaQuery.sizeOf(context).height * .82;

    return SizedBox(
      height: h,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screenX, 0, Gap.screenX, Gap.sm),
            child: Text(l.musicTitle,
                style: AppType.displayStyle(color: t.text1, size: 24)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: TextField(
              key: const ValueKey('music-search'),
              controller: _q,
              onChanged: (_) => setState(() {}),
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: l.musicSearch,
                prefixIcon: const Icon(Icons.search_rounded),
                isDense: true,
                filled: true,
                fillColor: t.surface2,
                border: OutlineInputBorder(
                  borderRadius: R.pill,
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(height: Gap.sm),
          Expanded(
            child: lib.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: SkeletonList(count: 6),
              ),
              error: (e, __) => StatePanel.fromError(context, asAppError(e),
                  onRetry: () => ref.invalidate(musicLibraryProvider)),
              data: (data) {
                final present = [
                  for (final g in data.genres)
                    if (data.tracks.any((x) => x.genre == g)) g,
                ];
                final q = _q.text.trim().toLowerCase();
                final shown = data.tracks.where((x) {
                  if (_genre.isNotEmpty && x.genre != _genre) return false;
                  if (q.isEmpty) return true;
                  return x.title.toLowerCase().contains(q) ||
                      x.artist.toLowerCase().contains(q);
                }).toList();
                return Column(
                  children: [
                    if (present.length > 1)
                      SizedBox(
                        height: 44,
                        child: ListView(
                          key: const ValueKey('music-genres'),
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                          children: [
                            for (final g in ['', ...present])
                              Padding(
                                padding: const EdgeInsets.only(right: Gap.sm),
                                child: ChoiceChip(
                                  label: Text(g.isEmpty ? l.catalogAll : g),
                                  selected: _genre == g,
                                  onSelected: (_) => setState(() => _genre = g),
                                ),
                              ),
                          ],
                        ),
                      ),
                    Expanded(
                      child: shown.isEmpty
                          ? StatePanel(
                              icon: Icons.music_off_rounded,
                              title: l.musicEmpty,
                            )
                          : ListView.builder(
                              key: const ValueKey('music-list'),
                              padding: const EdgeInsets.fromLTRB(
                                  Gap.screenX, Gap.xs, Gap.screenX, Gap.xl),
                              itemCount: shown.length,
                              itemBuilder: (context, i) {
                                final tr = shown[i];
                                final url = _previewUrl(tr);
                                final on = player.url == url && player.playing;
                                final loading = player.url == url && player.loading;
                                return _TrackRow(
                                  track: tr,
                                  playing: on,
                                  loading: loading,
                                  onPreview: () => _preview(tr),
                                  onPick: () => Navigator.of(context).pop(tr),
                                );
                              },
                            ),
                    ),
                    Padding(
                      padding: EdgeInsets.fromLTRB(Gap.screenX, 0, Gap.screenX,
                          MediaQuery.paddingOf(context).bottom + Gap.sm),
                      child: Row(
                        children: [
                          Icon(Icons.verified_outlined, size: 14, color: t.text3),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(l.musicLicensed,
                                style: TextStyle(
                                    fontFamily: AppType.sans,
                                    fontSize: 11.5,
                                    color: t.text3)),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TrackRow extends StatelessWidget {
  const _TrackRow({
    required this.track,
    required this.playing,
    required this.loading,
    required this.onPreview,
    required this.onPick,
  });

  final MusicTrack track;
  final bool playing;
  final bool loading;
  final VoidCallback onPreview;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return InkWell(
      key: ValueKey('music-track-${track.id}'),
      onTap: onPick,
      borderRadius: R.gentle,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: Gap.sm),
        child: Row(
          children: [
            // Tinglash — 30 s bo'lak.
            Semantics(
              button: true,
              label: track.title,
              child: InkResponse(
                key: ValueKey('music-play-${track.id}'),
                onTap: onPreview,
                radius: 28,
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: playing ? t.text1 : t.surface2,
                    shape: BoxShape.circle,
                  ),
                  child: loading
                      ? Padding(
                          padding: const EdgeInsets.all(14),
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: t.text2),
                        )
                      : Icon(
                          playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                          color: playing ? t.surfaceSolid : t.text1,
                        ),
                ),
              ),
            ),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(track.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: t.text1)),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (track.artist.isNotEmpty) track.artist,
                      if (track.genre.isNotEmpty) track.genre,
                      if (track.durationSec > 0) _mmss(track.durationSec),
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontFamily: AppType.sans, fontSize: 12, color: t.text2),
                  ),
                ],
              ),
            ),
            const SizedBox(width: Gap.sm),
            TextButton(
              key: ValueKey('music-pick-${track.id}'),
              onPressed: onPick,
              child: Text(l.actionSelect),
            ),
          ],
        ),
      ),
    );
  }
}

/// Postdagi musiqa belgisi: «♪ Nomi · Ijrochi». Bosilsa — «Shu musiqani
/// ishlatish» varag'i.
class MusicChip extends StatelessWidget {
  const MusicChip({
    super.key,
    required this.track,
    this.onDark = false,
    this.onTap,
  });

  final MusicTrack track;
  final bool onDark;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final fg = onDark ? Colors.white : t.text1;
    return PressableScale(
      onTap: onTap ?? () => showMusicUseSheet(context, track),
      child: Container(
        key: const ValueKey('music-chip'),
        padding: const EdgeInsets.fromLTRB(9, 5, 12, 5),
        decoration: BoxDecoration(
          color: onDark ? Colors.black.withValues(alpha: .38) : t.surface2,
          borderRadius: R.pill,
          border: onDark
              ? Border.all(color: Colors.white.withValues(alpha: .28), width: .8)
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.music_note_rounded, size: 14, color: fg),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                track.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: fg),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// «Shu musiqani ishlatish» — trekni tinglash va shu trek bilan yangi
/// Reel yaratish.
Future<void> showMusicUseSheet(BuildContext context, MusicTrack track) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    showDragHandle: true,
    backgroundColor: context.tokens.surfaceSolid,
    builder: (_) => _MusicUseSheet(track: track),
  );
}

class _MusicUseSheet extends ConsumerStatefulWidget {
  const _MusicUseSheet({required this.track});
  final MusicTrack track;

  @override
  ConsumerState<_MusicUseSheet> createState() => _MusicUseSheetState();
}

class _MusicUseSheetState extends ConsumerState<_MusicUseSheet> {
  late final MusicPlayer _player;
  bool _started = false;
  MusicState _last = const MusicState();

  @override
  void initState() {
    super.initState();
    _player = ref.read(musicPlayerProvider.notifier);
  }

  @override
  void dispose() {
    if (_started && _last.url == _previewUrl(widget.track) && _last.playing) _player.pause();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final tr = widget.track;
    final url = _previewUrl(tr);
    final st = _last = ref.watch(musicPlayerProvider);
    final playing = st.url == url && st.playing;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.screenX, 0, Gap.screenX, Gap.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _TrackRow(
              track: tr,
              playing: playing,
              loading: st.url == url && st.loading,
              onPreview: () {
                _started = true;
                _player.toggle(url);
              },
              onPick: () {
                _started = true;
                _player.toggle(url);
              },
            ),
            const SizedBox(height: Gap.md),
            NovaButton(
              key: const ValueKey('music-use'),
              label: l.musicUse,
              icon: Icons.music_note_rounded,
              onPressed: () {
                ref.read(pendingComposerMusicProvider.notifier).state = tr;
                Navigator.of(context).pop();
                context.push(Routes.reelCreate);
              },
            ),
          ],
        ),
      ),
    );
  }
}
