import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import '../tokens.dart';

/// EKRAN FONI — tirik asos.
///
/// Eski ilovaning asosiy muammosi "qora va o'lik" edi: hamma ekran
/// bir xil tekis qora fonda turardi. Yangi tizimda fon uch
/// qatlamdan iborat:
///
/// 1. **Asos gradienti** — tepadan pastga iliq (yoki sovuq).
/// 2. **Ambient nur** — bir yoki ikki katta, yumshoq dog'. HAR
///    EKRANNING O'Z YORUG'LIK MANBAI BOR: Bosh sahifa tepadan,
///    NFC markazi markazdan, Reels pastdan, to'lov markazdan.
///    Shuning uchun ekranlar bir-biriga o'xshamaydi.
/// 3. **Grain** — juda nozik don. U gradientdagi "halqa" (banding)
///    effektini yo'q qiladi: to'q fonda yumshoq o'tish telefon
///    ekranida chiziq-chiziq bo'lib ko'rinadi, don esa uni
///    aralashtirib yuboradi.
///
/// Uchala qatlam ham arzon: gradient va bitta takrorlanuvchi
/// 96×96 tekstura. Blur yo'q — blur faqat shisha panellarda.

// ─────────────────────────────────────────────────────────────
// YORUG'LIK MANBAI
// ─────────────────────────────────────────────────────────────

/// Bitta nur dog'i.
@immutable
class AuraLayer {
  const AuraLayer({
    required this.center,
    required this.color,
    this.radius = 1.15,
    this.opacity = .28,
    this.falloff = .46,
  });

  /// Nur markazi. `Alignment(0, -1.2)` — ekran tepasidan biroz
  /// yuqorida, ya'ni yorug'lik "tepadan tushadi".
  final Alignment center;

  final Color color;

  /// Radius — eng qisqa tomonga nisbatan.
  final double radius;

  /// Markazdagi kuchi.
  final double opacity;

  /// Yorug'lik qayerda yarmiga tushishi. Kichik qiymat —
  /// yig'ilgan nur, katta qiymat — yoyilgan.
  final double falloff;

  RadialGradient get gradient => RadialGradient(
        center: center,
        radius: radius,
        colors: [
          color.withValues(alpha: opacity),
          color.withValues(alpha: opacity * .2),
          color.withValues(alpha: 0),
        ],
        stops: [0, falloff, 1],
      );
}

/// Ekranning yorug'lik imzosi.
///
/// Presetlar mavzuga bog'liq, shuning uchun ular funksiya — `const`
/// qiymat mavzu almashganda muzlab qolardi.
///
/// NUR KUCHI — 2026-09-15 da PASAYTIRILDI.
///
/// Egasi: "yumshoqlik, mayinlik, boylik ko'rinmayapti". Saytdagi
/// biznes profil bilan yonma-yon qo'yilganda sabab aniq bo'ldi:
/// u yerda qobiq nuri `rgba(201,161,74,.10)` — atigi 10%. Ilovada
/// esa bosh sahifada 30% edi, ya'ni uch baravar kuchli.
///
/// Kuchli nur "yorug'" qilmaydi — u fonni JIGARRANG PARDA bilan
/// yopadi. Qorong'ilik chuqurlik beradi, nur esa faqat ishora
/// bo'lishi kerak; ikkalasi almashib ketsa ekran loyqa ko'rinadi.
/// Shuning uchun barcha qatlamlar 0.09–0.13 oralig'iga tushirildi.
@immutable
class Aura {
  const Aura(this.layers, {this.cool = false, this.grain = .75});

  final List<AuraLayer> layers;

  /// Sovuq asos gradienti (NFC markazi, Qidiruv).
  final bool cool;

  /// Don kuchi (0 — yo'q, 1 — standart).
  final double grain;

  /// Nur yo'q — forma va sozlamalar ekranlari. Ular sokin bo'lishi
  /// kerak, aks holda ilovada tinch joy qolmaydi.
  static Aura get none => const Aura([], grain: .6);

  /// BOSH SAHIFA — tepadan iliq oltin + o'ngdan amber aks.
  static Aura get home => Aura([
        AuraLayer(
          center: const Alignment(0, -1.22),
          color: C.palette.aura,
          radius: 1.18,
          opacity: .13,
          falloff: .46,
        ),
        AuraLayer(
          center: const Alignment(1.1, -.12),
          color: C.accentSecondary,
          radius: .78,
          opacity: .13,
          falloff: .5,
        ),
      ]);

  /// NFC MARKAZI — nur MARKAZDAN tarqaladi (skanerlash to'lqinining
  /// markazi) va pastdan sovuq platina aks tushadi.
  static Aura get nfc => Aura(
        [
          AuraLayer(
            center: const Alignment(0, -.12),
            color: C.accent,
            radius: .92,
            opacity: .11,
            falloff: .5,
          ),
          AuraLayer(
            center: const Alignment(0, 1.08),
            color: const Color(0xFF9CC1EE),
            radius: .95,
            opacity: .09,
            falloff: .55,
          ),
        ],
        cool: true,
      );

  /// QIDIRUV — sovuq va sokin. Bosh sahifadan ATAYLAB farq qiladi.
  static Aura get search => Aura(
        [
          AuraLayer(
            center: const Alignment(-.5, -1.1),
            color: const Color(0xFF9CC1EE),
            radius: 1.1,
            opacity: .10,
            falloff: .5,
          ),
        ],
        cool: true,
      );

  /// SOVUQ YORUG'LIK O'NGDAN — onboardingning ikkinchi slaydi va
  /// shisha panel ko'rsatiladigan joylar.
  ///
  /// Ketma-ket ekranlar bir xil yoritilsa, ular bir xil ko'rinadi.
  /// Shuning uchun uch slayd uch xil manbadan yoritiladi: tepadan,
  /// o'ngdan, pastdan.
  static Aura get coolRight => Aura([
        AuraLayer(
          center: const Alignment(1.05, -.35),
          color: const Color(0xFF9CC1EE),
          radius: 1.0,
          opacity: .10,
          falloff: .48,
        ),
      ]);

  /// REELS — yorug'lik PASTDAN. Ekranning o'z manbai.
  static Aura get reels => Aura(
        [
          AuraLayer(
            center: const Alignment(0, 1.15),
            color: C.accent,
            radius: 1.05,
            opacity: .09,
            falloff: .5,
          ),
        ],
        grain: .5,
      );

  /// TO'LOV va MUVAFFAQIYAT — nur markazdan portlaydi.
  static Aura get center => Aura([
        AuraLayer(
          center: Alignment.center,
          color: C.accent,
          radius: .95,
          opacity: .10,
          falloff: .45,
        ),
      ]);

  /// KARTA QAHRAMON — ID tafsiloti, katalog. Tepadan to'g'ridan.
  static Aura get spotlight => Aura([
        AuraLayer(
          center: const Alignment(0, -1.06),
          color: const Color(0xFFF0C419),
          radius: 1.14,
          opacity: .12,
          falloff: .48,
        ),
      ]);

  /// PROFIL — yumshoq, ism atrofida.
  static Aura get profile => Aura([
        AuraLayer(
          center: const Alignment(0, -.78),
          color: C.palette.aura,
          radius: 1.0,
          opacity: .11,
          falloff: .46,
        ),
      ]);
}

// ─────────────────────────────────────────────────────────────
// FON WIDGETI
// ─────────────────────────────────────────────────────────────

/// Ekran foni. Har ekranning ildizida turadi.
class ScreenBackdrop extends StatelessWidget {
  const ScreenBackdrop({
    super.key,
    required this.child,
    required this.aura,
  });

  final Widget child;
  final Aura aura;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: aura.cool ? C.screenBaseCool : C.screenBase,
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          for (final layer in aura.layers)
            // `IgnorePointer` shart emas: `DecoratedBox` bosishni
            // tutmaydi. `RepaintBoundary` ham shart emas — bu
            // qatlamlar hech qachon qayta chizilmaydi.
            DecoratedBox(decoration: BoxDecoration(gradient: layer.gradient)),
          if (aura.grain > 0)
            CustomPaint(painter: _GrainPainter(aura.grain), size: Size.infinite),
          child,
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GRAIN
// ─────────────────────────────────────────────────────────────

ui.Image? _grainTile;

/// 96×96 don teksturasi — bir marta yaratiladi va butun ilova
/// bo'ylab takrorlanadi.
///
/// `toImageSync` ishlatiladi (Flutter 3.7+): u kadr ichida
/// bloklanmasdan rasm qaytaradi, shuning uchun birinchi chizishda
/// "don yo'q" kadri ko'rinmaydi.
ui.Image _grain() {
  final cached = _grainTile;
  if (cached != null) return cached;

  const size = 96;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  // Doimiy urug' — har ishga tushirishda bir xil naqsh. Tasodifiy
  // urug' bo'lsa, goldenlar har safar boshqacha chiqardi.
  final rnd = math.Random(20260914);
  final paint = Paint();
  for (var i = 0; i < 1400; i++) {
    final dx = rnd.nextDouble() * size;
    final dy = rnd.nextDouble() * size;
    // Yorug' va quyuq donlar aralash — faqat yorug'i bo'lsa fon
    // kulrangga tortadi.
    final bright = rnd.nextBool();
    paint.color = (bright ? const Color(0xFFFFFFFF) : const Color(0xFF000000))
        .withValues(alpha: rnd.nextDouble() * .038);
    canvas.drawRect(Rect.fromLTWH(dx, dy, .9, .9), paint);
  }
  final image = recorder.endRecording().toImageSync(size, size);
  _grainTile = image;
  return image;
}

/// Birlik matritsa — `ImageShader` teksturani qanday joylashini
/// belgilaydi. `Matrix4` o'rniga to'g'ridan-to'g'ri ro'yxat:
/// qo'shimcha import keltirmaydi va bir marta yaratiladi.
final Float64List _identity = Float64List.fromList(
  <double>[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
);

class _GrainPainter extends CustomPainter {
  _GrainPainter(this.strength);

  final double strength;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = ImageShader(
        _grain(),
        TileMode.repeated,
        TileMode.repeated,
        _identity,
      )
      // DIQQAT: shader qo'yilganda `paint.color` E'TIBORGA
      // OLINMAYDI. Kuchni boshqarish uchun `modulate` ishlatiladi —
      // u kanallarni ko'paytiradi, ya'ni donning shaffofligini
      // `strength` ga qisqartiradi. `saveLayer` dan arzonroq.
      ..colorFilter = ColorFilter.mode(
        const Color(0xFFFFFFFF).withValues(alpha: strength.clamp(0, 1)),
        BlendMode.modulate,
      );
    canvas.drawRect(Offset.zero & size, paint);
  }

  @override
  bool shouldRepaint(_GrainPainter old) => old.strength != strength;
}
