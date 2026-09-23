import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/music_player.dart';
import '../ui/widgets.dart';

class MusicEditorScreen extends StatefulWidget {
  const MusicEditorScreen({super.key, required this.profile});

  final IdentityProfile profile;

  @override
  State<MusicEditorScreen> createState() => _MusicEditorScreenState();
}

class _MusicEditorScreenState extends State<MusicEditorScreen> {
  late List<String> _tracks;
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _tracks = [...widget.profile.musicUrls];
  }

  String _name(String url, int index) {
    try {
      final name = Uri.parse(url).pathSegments.last;
      if (name.isNotEmpty) return Uri.decodeComponent(name);
    } catch (_) {}
    return 'Track ' + (index + 1).toString();
  }

  String _contentType(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.m4a') || n.endsWith('.mp4')) return 'audio/mp4';
    if (n.endsWith('.wav')) return 'audio/wav';
    if (n.endsWith('.ogg')) return 'audio/ogg';
    if (n.endsWith('.webm')) return 'audio/webm';
    if (n.endsWith('.aac')) return 'audio/aac';
    return 'audio/mpeg';
  }

  Future<void> _add() async {
    if (_busy) return;
    if (_tracks.length >= 5) {
      setState(() => _message = 'Oddiy profilga 5 tagacha musiqa qo‘shish mumkin.');
      return;
    }

    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'webm'],
      allowMultiple: false,
      withData: false,
    );
    if (result == null || result.files.isEmpty || !mounted) return;

    final picked = result.files.single;
    final path = picked.path;
    if (path == null || path.isEmpty) {
      setState(() => _message = 'Musiqa fayli o‘qilmadi.');
      return;
    }
    if (picked.size > 100 * 1024 * 1024) {
      setState(() => _message = 'Musiqa 100 MB dan katta bo‘lmasin.');
      return;
    }
    final bytes = await File(path).readAsBytes();
    if (bytes.isEmpty) {
      setState(() => _message = 'Musiqa fayli o‘qilmadi.');
      return;
    }
    if (bytes.length > 100 * 1024 * 1024) {
      setState(() => _message = 'Musiqa 100 MB dan katta bo‘lmasin.');
      return;
    }

    setState(() {
      _busy = true;
      _message = 'Musiqa yuklanmoqda…';
    });

    try {
      final url = await SessionScope.read(context).repo.uploadFile(
            bytes,
            contentType: _contentType(picked.name),
          );
      if (!mounted) return;
      setState(() {
        _tracks = [..._tracks, url];
        _message = 'Yuklandi. Saqlashni bosing.';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _message = switch (e.key) {
          'too_large' => 'Fayl hajmi juda katta.',
          'quota_exceeded' => 'Yuklash limiti tugagan.',
          _ => 'Musiqa yuklanmadi.',
        };
      });
    } catch (_) {
      if (mounted) setState(() => _message = 'Musiqa yuklanmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final session = SessionScope.read(context);
      await session.repo.updateProfile(
        widget.profile.code,
        {'musicUrls': _tracks},
      );
      await session.refresh();
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) setState(() => _message = 'Musiqalar saqlanmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Profil musiqasi',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
        children: [
          Container(
            padding: const EdgeInsets.all(19),
            decoration: BoxDecoration(
              color: const Color(0xFF111110),
              borderRadius: BorderRadius.circular(27),
            ),
            child: Row(
              children: [
                Container(
                  width: 58,
                  height: 58,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .055),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Image.asset(
                    'assets/images/nfcstore_logo_mark.png',
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Your profile. Your sound.',
                        style: TextStyle(
                          color: Colors.white,
                          fontFamily: 'InstrumentSerif',
                          fontSize: 22,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        'Avatar yonidagi musiqa belgisidan player ochiladi.',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: .5),
                          fontSize: 9.8,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Text(
                'Musiqalar',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const Spacer(),
              Text(
                _tracks.length.toString() + '/5',
                style: TextStyle(
                  color: p.ink2,
                  fontFamily: 'IBMPlexMono',
                  fontSize: 10,
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          if (_tracks.isEmpty)
            SurfaceCard(
              shadow: false,
              child: Row(
                children: [
                  Icon(Icons.music_note_rounded, color: p.ink2),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Hozircha musiqa yo‘q. MP3, M4A, AAC, WAV, OGG yoki WEBM qo‘shing.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            )
          else
            for (var i = 0; i < _tracks.length; i++) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 9),
                padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
                decoration: BoxDecoration(
                  color: p.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: p.line),
                ),
                child: Row(
                  children: [
                    IconButton.filledTonal(
                      onPressed: () => showPremiumMusicPlayer(
                        context,
                        urls: _tracks,
                        title: widget.profile.name,
                        initialIndex: i,
                      ),
                      icon: const Icon(Icons.play_arrow_rounded),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _name(_tracks[i], i),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    IconButton(
                      tooltip: 'Olib tashlash',
                      onPressed: _busy
                          ? null
                          : () => setState(() {
                                _tracks = [..._tracks]..removeAt(i);
                              }),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
            ],
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _busy || _tracks.length >= 5 ? null : _add,
            icon: const Icon(Icons.library_music_outlined),
            label: const Text('Musiqa qo‘shish'),
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(
              _message!,
              style: TextStyle(color: p.ink2, fontSize: 10.5),
            ),
          ],
          const SizedBox(height: 18),
          SizedBox(
            height: 54,
            child: FilledButton(
              onPressed: _busy ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: p.ink,
                foregroundColor: p.background,
              ),
              child: _busy
                  ? SizedBox(
                      width: 19,
                      height: 19,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: p.background,
                      ),
                    )
                  : const Text('Musiqalarni saqlash'),
            ),
          ),
        ],
      ),
    );
  }
}