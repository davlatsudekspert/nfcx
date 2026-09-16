import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform;
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart';

import '../../data/nfc.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/logo.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../../state/scan_history.dart';
import '../common/contact_actions.dart' show openExternal;
import '../identity/profile_screen.dart';
import 'qr_share.dart';

/// NFC SKANER — begona kartani telefonga tegizib, profilini ochish.
///
/// NIMA UCHUN KERAK: ilova NFCSTORE deb ataladi. Kartani tegizganda
/// nima bo'lishini ilovaning O'ZI ko'rsatmasa, mahsulotning asosiy
/// harakati ilovadan tashqarida qolardi.
///
/// XULQ: bitta o'qishdan keyin sessiya yopiladi va profil ochiladi.
/// Ochilganda `/api/tap/:code` chaqiriladi — statistika serverda
/// hisoblanadi, mijoz tomonda emas.
///
/// EKRANNING O'ZAGI — markazdagi medalyon va undan tarqaluvchi
/// uchta halqa. Ular `M.wave` (1.6 s) bilan navbatma-navbat
/// chiqadi va "harakatni kamaytirish" rejimida TO'XTAYDI: halqalar
/// dekorativ, ular kutishni bildirmaydi.
///
/// QR HAR DOIM PASTDA. NFC bo'lmagan yoki o'chirilgan qurilmada ham
/// odam boshi berk ko'chaga tushmasin — profilni ulashishning
/// ishlaydigan yo'li doim ko'rinib turadi.
class NfcScanScreen extends StatefulWidget {
  const NfcScanScreen({super.key});

  @override
  State<NfcScanScreen> createState() => _NfcScanScreenState();
}

enum _Phase { checking, unsupported, waiting, unknown, error }

class _NfcScanScreenState extends State<NfcScanScreen> {
  _Phase _phase = _Phase.checking;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    // Ochiq qolgan sessiya keyingi o'qishni bloklaydi.
    Nfc.stop();
    super.dispose();
  }

  Future<void> _start() async {
    if (_busy) return;
    _busy = true;
    setState(() => _phase = _Phase.checking);

    final ok = await Nfc.available();
    if (!mounted) return;
    if (!ok) {
      _busy = false;
      setState(() => _phase = _Phase.unsupported);
      return;
    }

    setState(() => _phase = _Phase.waiting);
    final res = await Nfc.readLink();
    _busy = false;
    if (!mounted) return;

    final link = res.link;
    if (link == null) {
      // BEGONA TEG HAM TARIXGA TUSHADI: odam "men nimaga tegdim?"
      // degan savolga javob topa olsin. Faqat teg haqiqatan
      // sezilgan bo'lsa — havoda o'tgan urinish hodisa emas.
      if (res.tagSeen) {
        ScanHistory().add(ScanEntry(
          at: DateTime.now(),
          outcome: tr('NFCSTORE kartasi emas'),
        ));
      }
      // Karta TEGIZILDIMI — shunga qarab boshqa xabar: "bizniki
      // emas" va "umuman sezilmadi" ikki xil muammo.
      setState(() => _phase = res.tagSeen ? _Phase.unknown : _Phase.error);
      return;
    }

    HapticFeedback.mediumImpact();
    _open(link);
  }

  void _open(NfcLink link) {
    final state = AppScope.read(context);

    // TEGIZISHLAR TARIXI — qurilmada. Server bilan bog'liq emas:
    // u faqat "menga kim tegdi" ni biladi, bu esa "men nimaga
    // tegdim".
    ScanHistory().add(ScanEntry(
      at: DateTime.now(),
      code: link.code,
      isCompany: link.company,
      outcome: link.company ? tr('kompaniya') : tr('profil ochildi'),
    ));

    // Statistika serverda: natijani kutmaymiz, xatosi profilni yopmaydi.
    if (!link.company) {
      state.repo.tap(link.code).catchError((_) {});
    }
    Navigator.of(context).pushReplacement(
      SlidePage<void>(
        builder: (_) => link.company
            ? ProfileScreen(companyId: link.code)
            : ProfileScreen(code: link.code),
      ),
    );
  }

  /// QURILMA SOZLAMALARI — ilovada plagin yo'q.
  ///
  /// `app_settings` bog'liqligi qo'shilmagan, `url_launcher` esa
  /// Android sozlamalar intentini ocholmaydi. iOS'da `app-settings:`
  /// ishlaydi, Android'da esa `openExternal` xatoni jimgina yutadi.
  /// Har ikki holda ham qaytgandan keyin NFC holati QAYTA
  /// tekshiriladi — asl foyda shunda: odam NFC'ni yoqib qaytsa,
  /// ekran o'zi tiklanadi.
  Future<void> _openSettings() async {
    await openExternal(Uri.parse('app-settings:'));
    if (!mounted) return;
    await _start();
  }

  void _openQr(Identity? active) {
    if (active == null) return;
    push<void>(context, (_) => QrShareScreen(identity: active));
  }

  /// Yordam sahifasi — SAYTDA.
  ///
  /// Manzil `Api.baseUrl` dan olinadi: u ilovada bitta joyda
  /// turadi va ikkinchi marta yozilsa, ilova bilan sayt ikkiga
  /// bo'linib ketardi (buni `test/rules_test.dart` qo'riqlaydi).
  Future<void> _openHelp() => openExternal(
        Uri.parse('${AppScope.read(context).api.baseUrl}/qollanma'),
      );

  @override
  Widget build(BuildContext context) {
    final active = AppScope.of(context).active;

    return ScreenBackdrop(
      aura: Aura.nfc,
      child: SafeArea(
        child: Column(
          children: [
            TopBar(title: tr('Kartani o‘qish')),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x8,
                  S.gutter,
                  S.x32,
                ),
                child: Center(child: _body(active)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _body(Identity? active) {
    switch (_phase) {
      // ── NFC YO'Q YOKI O'CHIRILGAN ────────────────────────────
      //
      // `Nfc.available()` bitta `bool` qaytaradi va u ikki holatni
      // BIRLASHTIRADI: modul yo'q va modul o'chirilgan. Farqni
      // platformadan chiqaramiz — iOS'da NFC'ni o'chirish tugmasi
      // umuman yo'q, ya'ni u yerda `false` faqat "modul yo'q"
      // degani.
      case _Phase.unsupported:
        final noModule = defaultTargetPlatform == TargetPlatform.iOS;
        return noModule
            ? _Fix(
                icon: Ico.ban,
                title: tr('NFC qo‘llanmaydi'),
                text: tr('Bu qurilmada NFC moduli yo‘q. Profilni QR yoki '
                    'havola bilan ulashing.'),
                primaryLabel: tr('QR kodni ko‘rsatish'),
                onPrimary: active == null ? null : () => _openQr(active),
              )
            : _Fix(
                icon: Ico.nfc,
                title: tr('NFC o‘chirilgan'),
                text: tr('Kartani o‘qish uchun qurilma sozlamalarida '
                    'NFC‘ni yoqing.'),
                primaryLabel: tr('Sozlamalarni ochish'),
                onPrimary: _openSettings,
                secondaryLabel: tr('QR bilan ulashish'),
                onSecondary: active == null ? null : () => _openQr(active),
              );

      // ── KARTA TEGIZILDI, LEKIN O'QILMADI ─────────────────────
      //
      // `unknown` — bizniki bo'lmagan teg, `error` — teg umuman
      // sezilmadi (tegizish uzildi yoki vaqt tugadi). Sabab bitta
      // jumlada ikkalasini ham qamraydi.
      case _Phase.unknown:
      case _Phase.error:
        return _Fix(
          icon: Ico.card,
          title: tr('Karta o‘qilmadi'),
          text: tr('Bu karta NFCSTORE ID‘siga ulanmagan yoki tegizish '
              'uzilgan.'),
          primaryLabel: tr('Qayta urinish'),
          onPrimary: _start,
          secondaryLabel: tr('Yordam'),
          onSecondary: _openHelp,
        );

      // ── KUTISH ───────────────────────────────────────────────
      case _Phase.checking:
      case _Phase.waiting:
        final polling = _phase == _Phase.waiting;
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: S.x20),
            _ScanPulse(active: polling),
            const SizedBox(height: S.x32),
            Text(
              polling ? tr('O‘QILMOQDA') : tr('TAYYOR · TEGIZING'),
              textAlign: TextAlign.center,
              style: T.statusLabel.copyWith(color: C.accent),
            ),
            const SizedBox(height: S.x12),
            Text(
              tr('Kartani telefon orqasiga tegizing — profil ochiladi.'),
              textAlign: TextAlign.center,
              style: T.caption,
            ),
            const SizedBox(height: S.x32),
            SecondaryButton(
              tr('QR bilan ulashish'),
              icon: Ico.qr,
              onTap: active == null ? null : () => _openQr(active),
            ),
          ],
        );
    }
  }
}

// ─────────────────────────────────────────────────────────────
// XATO BLOKI
// ─────────────────────────────────────────────────────────────

/// Belgi · sarlavha · BITTA jumla sabab · bitta asosiy yechim.
///
/// Uch xato holati ham shu bitta blok bilan chiziladi: ular bir xil
/// ko'rinishi kerak, aks holda odam har safar yangi ekranga tushgandek
/// his qiladi.
class _Fix extends StatelessWidget {
  const _Fix({
    required this.icon,
    required this.title,
    required this.text,
    required this.primaryLabel,
    required this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
  });

  final Ico icon;
  final String title;
  final String text;
  final String primaryLabel;
  final VoidCallback? onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: S.x24),
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              gradient: C.raisedSurface,
              shape: BoxShape.circle,
              border: Border.all(color: C.line),
            ),
            alignment: Alignment.center,
            child: NIcon(icon, size: 30, color: C.ink2),
          ),
          const SizedBox(height: S.x20),
          Text(title, textAlign: TextAlign.center, style: T.section),
          const SizedBox(height: S.x8),
          Text(text, textAlign: TextAlign.center, style: T.caption),
          const SizedBox(height: S.x24),
          PrimaryButton(primaryLabel, onTap: onPrimary),
          if (secondaryLabel != null) ...[
            const SizedBox(height: S.x12),
            SecondaryButton(secondaryLabel!, onTap: onSecondary),
          ],
        ],
      );
}

// ─────────────────────────────────────────────────────────────
// TO'LQIN
// ─────────────────────────────────────────────────────────────

/// Markazda brend medalyoni, atrofida uchta tarqaluvchi halqa.
///
/// Halqalar `M.wave` sikli bo'yicha 1/3 dan siljib chiqadi — ko'z
/// uzluksiz oqim ko'radi. `RepaintBoundary` ichida: uzluksiz
/// animatsiya butun ekranni qayta chizishga majburlamasin.
///
/// HARAKATNI KAMAYTIRISH rejimida kontroller to'xtaydi va halqalar
/// qimirlamaydigan uch doira bo'lib qoladi — ma'lumot yo'qolmaydi.
class _ScanPulse extends StatefulWidget {
  const _ScanPulse({required this.active});

  /// Faqat o'qish ketayotganda harakatlanadi.
  final bool active;

  @override
  State<_ScanPulse> createState() => _ScanPulseState();
}

class _ScanPulseState extends State<_ScanPulse>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: M.wave,
  );

  void _sync() {
    final should = widget.active && !reduceMotion(context);
    if (should && !_c.isAnimating) {
      _c.repeat();
    } else if (!should && _c.isAnimating) {
      _c.stop();
      _c.value = 0;
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(covariant _ScanPulse old) {
    super.didUpdateWidget(old);
    _sync();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RepaintBoundary(
        child: SizedBox(
          width: 240,
          height: 240,
          child: Stack(
            alignment: Alignment.center,
            children: [
              AnimatedBuilder(
                animation: _c,
                builder: (context, _) => CustomPaint(
                  size: const Size(240, 240),
                  painter: _WavePainter(_c.value, C.accent),
                ),
              ),
              const BrandMark(size: 104, glow: true),
            ],
          ),
        ),
      );
}

class _WavePainter extends CustomPainter {
  _WavePainter(this.t, this.color);

  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    const minR = 58.0;
    final maxR = size.shortestSide / 2;

    for (var i = 0; i < 3; i++) {
      final p = (t + i / 3) % 1.0;
      final r = minR + (maxR - minR) * p;
      // Chetga borgan sari yo'qoladi — "tarqalish" hissi.
      final a = (1 - p) * .5;
      if (a <= 0) continue;
      canvas.drawCircle(
        center,
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = color.withValues(alpha: a),
      );
    }
  }

  @override
  bool shouldRepaint(_WavePainter old) => old.t != t || old.color != color;
}
