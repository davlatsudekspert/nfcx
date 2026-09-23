import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';

enum ComposeKind { post, story }

class ComposeScreen extends StatefulWidget {
  const ComposeScreen({super.key, required this.kind});
  final ComposeKind kind;

  @override
  State<ComposeScreen> createState() => _ComposeScreenState();
}

class _ComposeScreenState extends State<ComposeScreen> {
  final _picker = ImagePicker();
  final _caption = TextEditingController();
  XFile? _file;
  Uint8List? _preview;
  bool _video = false;
  bool _agreed = false;
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _caption.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 90,
      maxWidth: 2048,
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();
    if (!mounted) return;
    setState(() {
      _file = file;
      _preview = bytes;
      _video = false;
    });
  }

  Future<void> _pickVideo() async {
    final file = await _picker.pickVideo(source: ImageSource.gallery);
    if (file == null) return;
    if (!mounted) return;
    setState(() {
      _file = file;
      _preview = null;
      _video = true;
    });
  }

  Future<void> _submit() async {
    final file = _file;
    final active = SessionScope.read(context).activeProfile;
    if (active == null) {
      setState(() => _message = 'Faol NFC ID topilmadi.');
      return;
    }
    if (file == null) {
      setState(() => _message = 'Rasm yoki video tanlang.');
      return;
    }
    if (!_agreed) {
      setState(() => _message = 'Kontent qoidalariga rozilik kerak.');
      return;
    }
    if (_busy) return;

    setState(() {
      _busy = true;
      _message = null;
    });

    final repo = SessionScope.read(context).repo;
    try {
      final bytes = await file.readAsBytes();
      final contentType = _video ? 'video/mp4' : 'image/jpeg';
      final mediaUrl = await repo.uploadMedia(bytes, contentType: contentType);

      if (widget.kind == ComposeKind.story) {
        await repo.addStory(
          active.code,
          videoUrl: _video ? mediaUrl : null,
          imageUrl: _video ? null : mediaUrl,
          caption: _caption.text.trim(),
          agreed: true,
        );
      } else {
        await repo.addPost(
          active.code,
          videoUrl: _video ? mediaUrl : null,
          imageUrl: _video ? null : mediaUrl,
          caption: _caption.text.trim(),
          agreed: true,
        );
      }

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() => _message = 'Kontent joylanmadi. Internetni tekshirib qayta urinib ko‘ring.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final story = widget.kind == ComposeKind.story;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          story ? 'Yangi story' : 'Yangi post',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
        children: [
          SurfaceCard(
            padding: EdgeInsets.zero,
            child: AspectRatio(
              aspectRatio: story ? 9 / 14 : 4 / 5,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(21),
                child: _file == null
                    ? ColoredBox(
                        color: p.background2,
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.add_photo_alternate_outlined, color: p.ink2, size: 48),
                              const SizedBox(height: 10),
                              Text(
                                'Media tanlang',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      )
                    : _video
                        ? ColoredBox(
                            color: p.hero,
                            child: Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.play_circle_fill_rounded, color: p.heroInk, size: 64),
                                  const SizedBox(height: 10),
                                  Text(
                                    _file!.name,
                                    style: TextStyle(color: p.heroInk, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : Image.memory(_preview!, fit: BoxFit.cover),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _pickImage,
                  icon: const Icon(Icons.image_outlined),
                  label: const Text('Rasm'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _pickVideo,
                  icon: const Icon(Icons.videocam_outlined),
                  label: const Text('Video'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _caption,
            maxLines: 4,
            maxLength: 600,
            decoration: const InputDecoration(
              labelText: 'Izoh',
              hintText: 'Nima haqida?',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 10),
          SurfaceCard(
            shadow: false,
            child: Column(
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.shield_outlined, color: p.accent, size: 21),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Xavfsiz kontent',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 9),
                Text(
                  'Pornografiya, zo‘ravonlik, ekstremistik yoki diniy adovat qo‘zg‘atuvchi material, noqonuniy kontent, haqorat/so‘kinish, spam, mualliflik huquqini buzuvchi yoki siyosiy provokatsion material joylamang. Qonunga zid kontent uchun foydalanuvchi amaldagi qonunchilik va platforma qoidalari doirasida javobgar bo‘lishi mumkin.',
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(fontSize: 10.8, height: 1.45),
                ),
                const SizedBox(height: 6),
                CheckboxListTile(
                  value: _agreed,
                  contentPadding: EdgeInsets.zero,
                  onChanged: _busy ? null : (v) => setState(() => _agreed = v == true),
                  title: const Text('Kontent qoidalariga roziman'),
                  subtitle: const Text(
                    'Media va matn moderatsiyaga yuborilishi, shikoyat qilinishi yoki qoidabuzarlik aniqlansa olib tashlanishi mumkin.',
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: () => launchUrl(
                      Uri.parse('https://nfcstore.uz/shartlar'),
                      mode: LaunchMode.externalApplication,
                    ),
                    child: const Text('Qoidalarni ochish'),
                  ),
                ),
              ],
            ),
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(_message!, style: Theme.of(context).textTheme.bodyMedium),
          ],
          const SizedBox(height: 18),
          SizedBox(
            height: 54,
            child: FilledButton.icon(
              onPressed: _busy ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: p.hero,
                foregroundColor: p.heroInk,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              ),
              icon: _busy
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: p.heroInk),
                    )
                  : Icon(story ? Icons.auto_stories_outlined : Icons.publish_rounded),
              label: Text(story ? 'Story joylash' : 'Post joylash'),
            ),
          ),
        ],
      ),
    );
  }
}