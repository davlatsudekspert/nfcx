import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:video_player/video_player.dart';

import '../../design/tokens/nfc_tokens.dart';

/// VIDEO MUQOVASI — panjara katakchalari uchun.
///
/// ## NIMA UCHUN KERAK BO'LDI
///
/// Server video uchun surat (poster) bermaydi. Profil panjarasi
/// shuning uchun HAR video katakchaga `InlineVideo` qo'yardi: har
/// biri alohida video pleer (ExoPlayer) ochib, faylni yuklab, ekranda
/// turguncha dekoderni ushlab turardi. Profilda 10 ta video bo'lsa —
/// 10 ta pleer bir vaqtda. Telefonda aynan shu "qotib qolyapti"
/// hissini berardi (egasi, 2026-09).
///
/// ## QANDAY ISHLAYDI
///
///   1. Katakchalar NAVBATDA turadi: bir vaqtda faqat BITTA pleer.
///   2. Pleer ochiladi, birinchi kadr chiziladi va u kichik RASMGA
///      aylantiriladi.
///   3. Pleer DARHOL yopiladi. Katakchada faqat rasm qoladi.
///   4. Rasm xotirada saqlanadi — profilga qaytganda qayta
///      yuklanmaydi.
///
/// Rasmga aylantirib bo'lmasa (eski qurilma, buzuq fayl) — katakcha
/// tekis fon va ijro belgisi bilan qoladi, ilova qulamaydi.
///
/// ## FAQAT CHIZILGAN KATAKCHA
///
/// Profil to'ri dangasa (`SliverGrid`): ekran ostidagi ~250 px kesh
/// zonasidagi katakchalar QURILADI, lekin CHIZILMAYDI. Chizilmagan
/// qatlamni rasmga olib bo'lmaydi (`toImage` xato beradi) — ilgari
/// bunday katakcha pleer ochib, videoni yuklab, keyin muqovasiz
/// abadiy qolardi (release auditi). Endi navbatga katakcha BIRINCHI
/// MARTA CHIZILGANDA qo'yiladi; pleer ochilgach u chizilmay qolsa
/// (aylantirib ketilgan) — keyingi chizilishda qayta urinadi.
class VideoPoster extends StatefulWidget {
  const VideoPoster({super.key, required this.url});

  final String url;

  /// Oxirgi muqovalar. Chegaralangan: xotira cheksiz o'smaydi.
  static final _cache = <String, ui.Image>{};
  static const _cacheMax = 48;

  /// Bir vaqtda bitta pleer — navbatning dumi.
  static Future<void> _tail = Future<void>.value();

  /// Sinov uchun.
  @visibleForTesting
  static void clearCache() => _cache.clear();

  @override
  State<VideoPoster> createState() => _VideoPosterState();
}

class _VideoPosterState extends State<VideoPoster> {
  final _boundary = GlobalKey();
  ui.Image? _image;
  VideoPlayerController? _c;
  bool _gone = false;

  /// Yashirin bo'lgani uchun navbatdan CHIQDI — ko'ringanda qaytadi.
  bool _waiting = false;

  /// Navbatda yoki olinmoqda — ikkinchi marta qo'yilmaydi.
  bool _queued = false;

  /// Oxirgi belgilangandan beri ekranga chizildi.
  bool _painted = false;

  /// Haqiqiy xato (buzuq fayl, tarmoq) — qayta urinilmaydi.
  bool _failed = false;

  void _onPaint() {
    _painted = true;
    if (_image != null || _queued || _waiting || _failed || _gone) return;
    _queued = true;
    // Chizish bosqichida navbat/`setState` mumkin emas — kadrdan keyin.
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (_gone || !mounted) return;
      _enqueue();
    });
  }

  void _enqueue() {
    _queued = true;
    final next = VideoPoster._tail.then((_) => _capture());
    // Bitta katakchadagi xato navbatni to'xtatib qo'ymasin.
    VideoPoster._tail = next.catchError((_) {});
  }

  @override
  void initState() {
    super.initState();
    final cached = VideoPoster._cache.remove(widget.url);
    if (cached != null) {
      // LRU: oxirgi ishlatilgani oxiriga.
      VideoPoster._cache[widget.url] = cached;
      _image = cached;
    }
    // Aks holda navbatga birinchi chizilishda (`_onPaint`).
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Tab / marshrut yana ko'rindi — navbatga qaytadi.
    if (TickerMode.of(context) && _waiting && !_gone) {
      _waiting = false;
      _enqueue();
    }
  }

  Future<void> _capture() async {
    if (_gone || !mounted) return;
    // Yashirin tabda (Offstage) yoki ustiga ekran ochilganda kadr
    // chizilmaydi va rasmga olib bo'lmaydi. Ilgari shu yerda 500 ms
    // lik aylanishda KUTILARDI — navbat boshini egallab, BUTUN
    // ilovadagi boshqa muqovalarni (boshqa ekranlarda ham) to'xtatib
    // qo'yardi. Endi joy bo'shatiladi, ko'ringanda qaytadan navbatga.
    if (!TickerMode.of(context)) {
      _waiting = true;
      _queued = false;
      return;
    }
    final c = VideoPlayerController.networkUrl(
      Uri.parse(widget.url),
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );
    try {
      await c.initialize().timeout(const Duration(seconds: 15));
      await c.setVolume(0);
      if (_gone || !mounted) return;
      _painted = false;
      setState(() => _c = c);
      // Birinchi kadr teksturaga tushishi uchun qisqa kutish.
      await Future<void>.delayed(const Duration(milliseconds: 350));
      await WidgetsBinding.instance.endOfFrame;
      if (_gone || !mounted) return;
      // Pleer kadri ekranga chizilmadi (katakcha kesh zonasida) —
      // rasmga olib bo'lmaydi. Keyingi chizilishda qayta navbatga.
      if (!_painted) return;
      final box = _boundary.currentContext?.findRenderObject();
      if (box is RenderRepaintBoundary && box.hasSize) {
        final ratio = math.min(
          MediaQuery.devicePixelRatioOf(context),
          1.5,
        );
        final img = await box.toImage(pixelRatio: ratio);
        if (_gone || !mounted) {
          img.dispose();
          return;
        }
        VideoPoster._cache[widget.url] = img;
        while (VideoPoster._cache.length > VideoPoster._cacheMax) {
          VideoPoster._cache.remove(VideoPoster._cache.keys.first);
        }
        _image = img;
      }
    } catch (_) {
      // Muqova bo'lmaydi — tekis fon qoladi.
      _failed = true;
    } finally {
      _queued = false;
      if (mounted && !_gone) setState(() => _c = null);
      await c.dispose();
    }
  }

  @override
  void dispose() {
    _gone = true;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _PaintSignal(onPaint: _onPaint, child: _content(context));

  Widget _content(BuildContext context) {
    final t = context.tokens;
    final image = _image;
    if (image != null) {
      return RawImage(image: image, fit: BoxFit.cover);
    }
    final c = _c;
    if (c != null && c.value.isInitialized) {
      final size = c.value.size;
      return ClipRect(
        child: RepaintBoundary(
          key: _boundary,
          child: FittedBox(
            fit: BoxFit.cover,
            child: SizedBox(
              width: size.width <= 0 ? 1 : size.width,
              height: size.height <= 0 ? 1 : size.height,
              child: VideoPlayer(c),
            ),
          ),
        ),
      );
    }
    return ColoredBox(color: t.surface2);
  }
}

/// Bolasi ekranga chizilganda xabar beradi. Kesh zonasidagi (qurilgan,
/// lekin chizilmagan) katakchani ko'rinadiganidan ajratadi.
class _PaintSignal extends SingleChildRenderObjectWidget {
  const _PaintSignal({required this.onPaint, super.child});

  final VoidCallback onPaint;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      _RenderPaintSignal(onPaint);

  @override
  void updateRenderObject(
    BuildContext context,
    _RenderPaintSignal renderObject,
  ) =>
      renderObject.onPaint = onPaint;
}

class _RenderPaintSignal extends RenderProxyBox {
  _RenderPaintSignal(this.onPaint);

  VoidCallback onPaint;

  @override
  void paint(PaintingContext context, Offset offset) {
    super.paint(context, offset);
    onPaint();
  }
}
