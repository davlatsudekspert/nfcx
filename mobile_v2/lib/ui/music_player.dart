import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../core/theme.dart';

Future<void> showPremiumMusicPlayer(
  BuildContext context, {
  required List<String> urls,
  String title = 'Profil musiqasi',
  int initialIndex = 0,
}) async {
  if (urls.isEmpty) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _PremiumMusicPlayer(
      urls: urls,
      title: title,
      initialIndex: initialIndex.clamp(0, urls.length - 1),
    ),
  );
}

class _PremiumMusicPlayer extends StatefulWidget {
  const _PremiumMusicPlayer({
    required this.urls,
    required this.title,
    required this.initialIndex,
  });

  final List<String> urls;
  final String title;
  final int initialIndex;

  @override
  State<_PremiumMusicPlayer> createState() => _PremiumMusicPlayerState();
}

class _PremiumMusicPlayerState extends State<_PremiumMusicPlayer> {
  final AudioPlayer _player = AudioPlayer();
  late int _index;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(autoPlay: true));
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  String _name(String url) {
    try {
      final p = Uri.parse(url).pathSegments.last;
      return Uri.decodeComponent(p).replaceAll(RegExp(r'^[a-f0-9_]{8,}'), 'Track');
    } catch (_) {
      return 'Track ' + (_index + 1).toString();
    }
  }

  Future<void> _load({bool autoPlay = false}) async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _player.setUrl(widget.urls[_index]);
      if (autoPlay) await _player.play();
    } catch (_) {
      if (mounted) setState(() => _error = 'Musiqa ochilmadi.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _jump(int delta) async {
    if (widget.urls.length < 2) return;
    _index = (_index + delta) % widget.urls.length;
    if (_index < 0) _index += widget.urls.length;
    await _load(autoPlay: true);
  }

  String _time(Duration d) {
    final m = d.inMinutes;
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return m.toString() + ':' + s;
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: const EdgeInsets.fromLTRB(20, 11, 20, 24),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: p.line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .18),
            blurRadius: 36,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 4,
            decoration: BoxDecoration(
              color: p.line,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: const Color(0xFF111110),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: Image.asset(
                    'assets/images/nfcstore_logo_mark.png',
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _name(widget.urls[_index]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: p.ink2,
                        fontSize: 10.5,
                        fontFamily: 'IBMPlexMono',
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                (_index + 1).toString() + '/' + widget.urls.length.toString(),
                style: TextStyle(
                  color: p.ink2,
                  fontSize: 9,
                  fontFamily: 'IBMPlexMono',
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(_error!, style: TextStyle(color: p.ink2)),
            ),
          StreamBuilder<Duration?>(
            stream: _player.durationStream,
            builder: (context, durationSnap) {
              final duration = durationSnap.data ?? Duration.zero;
              return StreamBuilder<Duration>(
                stream: _player.positionStream,
                builder: (context, positionSnap) {
                  final position = positionSnap.data ?? Duration.zero;
                  final maxMs = duration.inMilliseconds <= 0
                      ? 1.0
                      : duration.inMilliseconds.toDouble();
                  final value = position.inMilliseconds
                      .clamp(0, maxMs.toInt())
                      .toDouble();
                  return Column(
                    children: [
                      Slider(
                        value: value,
                        max: maxMs,
                        onChanged: duration == Duration.zero
                            ? null
                            : (v) => _player.seek(
                                  Duration(milliseconds: v.round()),
                                ),
                      ),
                      Row(
                        children: [
                          Text(
                            _time(position),
                            style: TextStyle(
                              color: p.ink2,
                              fontSize: 9,
                              fontFamily: 'IBMPlexMono',
                            ),
                          ),
                          const Spacer(),
                          Text(
                            _time(duration),
                            style: TextStyle(
                              color: p.ink2,
                              fontSize: 9,
                              fontFamily: 'IBMPlexMono',
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              );
            },
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton.filledTonal(
                onPressed: widget.urls.length > 1 ? () => _jump(-1) : null,
                icon: const Icon(Icons.skip_previous_rounded),
              ),
              const SizedBox(width: 18),
              StreamBuilder<PlayerState>(
                stream: _player.playerStateStream,
                builder: (context, snap) {
                  final playing = snap.data?.playing == true;
                  final complete =
                      snap.data?.processingState == ProcessingState.completed;
                  return SizedBox(
                    width: 62,
                    height: 62,
                    child: FilledButton(
                      onPressed: _loading
                          ? null
                          : () async {
                              if (complete) {
                                await _player.seek(Duration.zero);
                                await _player.play();
                              } else if (playing) {
                                await _player.pause();
                              } else {
                                await _player.play();
                              }
                            },
                      style: FilledButton.styleFrom(
                        padding: EdgeInsets.zero,
                        shape: const CircleBorder(),
                        backgroundColor: p.ink,
                        foregroundColor: p.background,
                      ),
                      child: _loading
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: p.background,
                              ),
                            )
                          : Icon(
                              playing
                                  ? Icons.pause_rounded
                                  : Icons.play_arrow_rounded,
                              size: 31,
                            ),
                    ),
                  );
                },
              ),
              const SizedBox(width: 18),
              IconButton.filledTonal(
                onPressed: widget.urls.length > 1 ? () => _jump(1) : null,
                icon: const Icon(Icons.skip_next_rounded),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
