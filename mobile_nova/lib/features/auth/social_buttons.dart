import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart'
    show SignInWithAppleButton, SignInWithAppleButtonStyle;

import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/states.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import 'session.dart';
import 'social_auth.dart';

/// Ijtimoiy kirish tugmalari — kirish va ro'yxat ekranlarida BITTA kod.
///
/// Ikkala ekranda ham aynan bir xil ish bajariladi (tokenni olish,
/// serverga yuborish, sessiyani ochish, yangi hisobni profil sozlashga
/// yuborish). Ikki nusxa yozilsa, biri yangilanib ikkinchisi qolib
/// ketardi — shuning uchun bitta vidjet.

final socialAuthProvider = Provider<SocialAuth>((_) => SocialAuth());

/// Mijoz ID'lari — SERVERDAN, bir marta.
///
/// Xato bo'lsa (internet yo'q, eski server) bo'sh sozlama qaytadi va
/// tugmalar UMUMAN ko'rinmaydi. Email bilan kirish ishlayveradi —
/// ya'ni sozlama olinmagani odamni kirishdan to'sib qo'ymaydi.
final socialConfigProvider = FutureProvider<SocialAuthConfig>((ref) async {
  final res = await ref.watch(authRepositoryProvider).socialConfig();
  final cfg = res.when(
    ok: (c) => c,
    err: (_) => const SocialAuthConfig(),
  );
  ref.read(socialAuthProvider).config = cfg;
  return cfg;
});

class SocialSignInButtons extends ConsumerStatefulWidget {
  const SocialSignInButtons({super.key, this.onBusy});

  /// Ekran o'z tugmalarini bloklashi uchun: ikkita kirish bir vaqtda
  /// ketmasin.
  final ValueChanged<bool>? onBusy;

  @override
  ConsumerState<SocialSignInButtons> createState() =>
      _SocialSignInButtonsState();
}

class _SocialSignInButtonsState extends ConsumerState<SocialSignInButtons> {
  bool _busy = false;
  String? _error;
  String? _detail;

  Future<void> _start(SocialProvider provider) async {
    if (_busy) return;
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
      _detail = null;
    });
    widget.onBusy?.call(true);
    try {
      final cred = await ref.read(socialAuthProvider).signIn(provider);
      // Paket `null` qaytarsa — hech narsa bo'lmagan. Bu ham bekor
      // qilish: ekranda qizil yozuv chiqmaydi.
      if (cred == null || !mounted) return;

      final res = await ref.read(authRepositoryProvider).socialLogin(cred);
      if (!mounted) return;
      await res.when(
        ok: (v) async {
          await ref.read(sessionProvider.notifier).adopt(v.user);
          if (!mounted) return;
          // YANGI HISOB — profil sozlashga.
          //
          // U yerda ism/rasm so'raladi va "Shaxsiy yoki Biznes" tanlanadi,
          // so'ng `finishSignup()` odamni to'g'ri joyga olib boradi.
          // Ya'ni ijtimoiy kirish uchun ALOHIDA oqim yozilmadi —
          // ro'yxatdan o'tishning o'sha dumi ishlatiladi.
          context.go(v.isNew ? Routes.profileSetup : Routes.home);
        },
        err: (e) async => setState(() {
          _error = describeError(l, e);
          _detail = e.detail ?? e.code;
        }),
      );
    } on SocialCancelled {
      // Odam oynani yopdi — bu xato emas, hech narsa ko'rsatilmaydi.
    } on SocialFailed catch (e) {
      if (mounted) {
        setState(() {
          _error = l.socialFailed;
          _detail = e.detail;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
      widget.onBusy?.call(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final cfg = ref.watch(socialConfigProvider).valueOrNull;

    // Sozlama kelmaguncha ham, provayder o'chiq bo'lganda ham —
    // bo'sh joy. Ishlamaydigan tugmani ko'rsatib qo'yish eng yomon
    // variant: odam bosadi, hech narsa bo'lmaydi va ilovani buzuq
    // deb o'ylaydi.
    if (cfg == null || (!cfg.showGoogle && !cfg.showApple)) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: Gap.xl),
        _OrDivider(label: l.socialOr),
        const SizedBox(height: Gap.xl),
        if (cfg.showApple) ...[
          // APPLE'NING O'Z TUGMASI.
          //
          // Apple ko'rinishni qat'iy belgilaydi: belgi, matn, rang va
          // o'lcham uning ko'rsatmasiga mos bo'lishi shart, aks holda
          // ilova App Review'dan o'tmaydi. Shuning uchun bu yerda
          // ilovaning o'z tugmasi EMAS, paketning tayyor, mos tugmasi
          // ishlatiladi — faqat burchak radiusi va balandligi
          // qo'shnisiga tenglashtiriladi.
          SignInWithAppleButton(
            onPressed: _busy ? () {} : () => _start(SocialProvider.apple),
            text: l.socialApple,
            height: 54,
            style: t.isDark
                ? SignInWithAppleButtonStyle.white
                : SignInWithAppleButtonStyle.black,
            borderRadius: const BorderRadius.all(Radius.circular(999)),
          ),
          const SizedBox(height: Gap.md),
        ],
        if (cfg.showGoogle)
          _GoogleButton(
            label: l.socialGoogle,
            onPressed: _busy ? null : () => _start(SocialProvider.google),
          ),
        if (_error != null) ...[
          const SizedBox(height: Gap.lg),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Manrope',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: t.error,
            ),
          ),
          if (_detail != null) ...[
            const SizedBox(height: 4),
            // Texnik qator — odamga emas, muammoni hal qiladiganga.
            // Ekranda turgani uchun "ilova ishlamayapti" o'rniga aniq
            // sabab keladi.
            Text(
              _detail!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 10.5,
                color: t.text3,
              ),
            ),
          ],
        ],
      ],
    );
  }
}

/// Nozik chiziq va o'rtada "yoki".
class _OrDivider extends StatelessWidget {
  const _OrDivider({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final line = Expanded(child: Container(height: 1, color: t.border1));
    return Row(
      children: [
        line,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: 'Manrope',
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: t.text3,
            ),
          ),
        ),
        line,
      ],
    );
  }
}

/// Google tugmasi.
///
/// Apple'ning tayyor tugmasi bilan BIR O'LCHAMDA va bir shaklda
/// turadi, lekin Google'ning ko'rsatmasiga ko'ra oq fon va to'rt
/// rangli "G" belgisi bilan. Belgi rasm fayli EMAS, chizma:
/// ilovaga qo'shimcha asset kiritmaydi va har qanday zichlikda
/// tiniq chiqadi.
class _GoogleButton extends StatelessWidget {
  const _GoogleButton({required this.label, this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: Opacity(
        opacity: onPressed == null ? .45 : 1,
        child: Material(
          color: Colors.white,
          borderRadius: const BorderRadius.all(Radius.circular(999)),
          child: InkWell(
            onTap: onPressed,
            borderRadius: const BorderRadius.all(Radius.circular(999)),
            child: Container(
              height: 54,
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.all(Radius.circular(999)),
                border: Border.all(color: const Color(0xFFDADCE0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CustomPaint(painter: _GoogleGPainter()),
                  ),
                  const SizedBox(width: 12),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'Manrope',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        // Google oq tugmada qat'iy shu kulrangni
                        // talab qiladi — mavzuga bog'lanmaydi.
                        color: Color(0xFF3C4043),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Google'ning to'rt rangli "G" belgisi.
///
/// Rasmlar o'rniga chizma: hajm qo'shmaydi va har qanday ekran
/// zichligida tiniq. Ranglar Google'ning brend ko'rsatmasidan:
/// ko'k #4285F4, yashil #34A853, sariq #FBBC05, qizil #EA4335.
class _GoogleGPainter extends CustomPainter {
  const _GoogleGPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final c = Offset(size.width / 2, size.height / 2);
    // Halqa qalinligi belgining ~23% i — asl nisbat shunday.
    final stroke = s * 0.23;
    final r = (s - stroke) / 2;
    final rect = Rect.fromCircle(center: c, radius: r);

    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    // Soat strelkasi bo'yicha: qizil (tepa-chap), sariq (chap),
    // yashil (past), ko'k (o'ng).
    void sweep(double startDeg, double sweepDeg, Color color) {
      arc.color = color;
      canvas.drawArc(rect, startDeg * 3.1415926535 / 180,
          sweepDeg * 3.1415926535 / 180, false, arc);
    }

    sweep(-45, -135, const Color(0xFFEA4335)); // qizil
    sweep(180, -90, const Color(0xFFFBBC05));  // sariq  (chap-past)
    sweep(90, -90, const Color(0xFF34A853));   // yashil (past-o'ng)
    sweep(-45, 70, const Color(0xFF4285F4));   // ko'k   (o'ng)

    // O'rtadagi ko'ndalang chiziq — "G" ning tilchasi.
    final bar = Paint()..color = const Color(0xFF4285F4);
    canvas.drawRect(
      Rect.fromLTRB(c.dx, c.dy - stroke / 2, c.dx + r + stroke / 2, c.dy + stroke / 2),
      bar,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
