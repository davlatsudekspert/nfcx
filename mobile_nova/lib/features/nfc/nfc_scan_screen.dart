import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/repositories/nfc_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nfc_orb.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import 'nfc_service.dart';

/// Kartani o'qish.
///
/// SOXTA NATIJA YO'Q. "Karta o'qildi" yozuvi FAQAT tegdan haqiqiy
/// ma'lumot kelganda chiqadi. Qurilmada NFC bo'lmasa yoki o'chirilgan
/// bo'lsa — buning o'rniga aniq holat va chiqish yo'li ko'rsatiladi.
class NfcScanScreen extends ConsumerStatefulWidget {
  const NfcScanScreen({super.key});

  @override
  ConsumerState<NfcScanScreen> createState() => _NfcScanScreenState();
}

class _NfcScanScreenState extends ConsumerState<NfcScanScreen> {
  OrbState _state = OrbState.idle;
  String? _message;
  String? _resolvedCode;

  /// Xizmat oldindan ushlab olinadi.
  ///
  /// `dispose()` ichida `ref.read` Riverpod tomonidan TAQIQLANGAN va
  /// istisno otadi — ya'ni skanerlash sessiyasi ekran yopilganda
  /// yopilmay qolardi va NFC antennasi band bo'lib turaverardi.
  late final NfcService _nfc = ref.read(nfcServiceProvider);

  @override
  void initState() {
    super.initState();
    _nfc;
  }

  @override
  void dispose() {
    _nfc.stop();
    super.dispose();
  }

  Future<void> _scan() async {
    // Ikki marta bosish ikkinchi sessiya ochmaydi.
    if (_state == OrbState.scanning) return;
    final l = L.of(context);
    setState(() {
      _state = OrbState.scanning;
      _message = l.nfcScanning;
      _resolvedCode = null;
    });

    // Xato bo'lsa ham ekran "Qidirilmoqda…" da QOLMAYDI.
    String? payload;
    try {
      payload = await _nfc.readOnce();
    } catch (_) {
      payload = null;
    }
    if (!mounted) return;

    if (payload == null || payload.isEmpty) {
      setState(() {
        _state = OrbState.error;
        _message = l.nfcScanFailed;
      });
      return;
    }

    // Kartadagi havoladan NFC ID kodini ajratamiz. Chip tokeni bo'lsa
    // uni faqat SERVER kodga aylantira oladi.
    final uri = Uri.tryParse(payload);
    final segments = uri?.pathSegments.where((s) => s.isNotEmpty).toList() ?? const [];

    String? code;
    if (segments.length >= 2 && segments.first == 'tap') {
      final res = await ref.read(nfcRepositoryProvider).resolveChip(segments[1]);
      if (!mounted) return;
      code = res.valueOrNull;
      if (code == null || code.isEmpty) {
        setState(() {
          _state = OrbState.error;
          _message = describeError(l, res.errorOrNull!);
        });
        return;
      }
    } else if (segments.isNotEmpty) {
      code = segments.last;
    } else {
      code = payload.trim();
    }

    setState(() {
      _state = OrbState.success;
      _message = l.nfcScanSuccess;
      _resolvedCode = code;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final availability = ref.watch(nfcAvailabilityProvider);
    final orb = (MediaQuery.sizeOf(context).width * .58).clamp(190.0, 280.0);

    return NovaScaffold(
      title: l.nfcTapToScan,
      showBack: true,
      body: availability.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: t.accent2, strokeWidth: 2),
        ),
        error: (e, __) => StatePanel.fromError(context, asAppError(e)),
        data: (a) => switch (a) {
          NfcAvailability.unsupported => StatePanel(
              icon: Icons.do_not_disturb_on_outlined,
              title: l.nfcUnsupported,
              message: l.nfcUnsupportedHint,
              actionLabel: l.nfcMyIds,
              onAction: () => context.push(Routes.nfcIds),
            ),
          NfcAvailability.disabled => StatePanel(
              icon: Icons.nfc_rounded,
              title: l.nfcDisabled,
              message: l.nfcDisabledHint,
              tone: t.warn,
              actionLabel: l.actionRetry,
              onAction: () => ref.invalidate(nfcAvailabilityProvider),
            ),
          _ => _ScanBody(
              orb: orb,
              state: _state,
              message: _message,
              resolvedCode: _resolvedCode,
              onScan: _scan,
            ),
        },
      ),
    );
  }
}

class _ScanBody extends StatelessWidget {
  const _ScanBody({
    required this.orb,
    required this.state,
    required this.message,
    required this.resolvedCode,
    required this.onScan,
  });

  final double orb;
  final OrbState state;
  final String? message;
  final String? resolvedCode;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return NovaScroll(
      children: [
        const SizedBox(height: Gap.section),
        Center(
          child: NfcOrb(
            size: orb,
            state: state,
            onTap: state == OrbState.scanning ? null : onScan,
            child: state == OrbState.success
                ? Icon(Icons.check_rounded, size: orb * .3, color: t.onAccent)
                : state == OrbState.error
                    ? Icon(Icons.close_rounded, size: orb * .3, color: t.onAccent)
                    // Orb ichida plastina yo'q — faqat belgi.
                    : BrandLogo(
                        size: orb * kOrbMarkRatio,
                        style: BrandLogoStyle.markOnly,
                        // Sokin holatdagi yadro qorong'i — belgi
                        // oltin. Muvaffaqiyat/xato holatida sirt
                        // hali ham to'liq rangli, shuning uchun
                        // yuqoridagi ikkita ikonka `onAccent`
                        // bo'lib qoladi.
                        tint: t.accent2,
                      ),
          ),
        ),
        const SizedBox(height: Gap.section),
        Text(
          message ?? l.nfcHoldCard,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        if (resolvedCode != null) ...[
          const SizedBox(height: Gap.md),
          Center(
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: Gap.xl, vertical: Gap.md),
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: R.pill,
                border: Border.all(color: t.border2),
              ),
              child: Text(
                resolvedCode!,
                style: AppType.monoStyle(
                    color: t.text1, size: 17, letterSpacing: 2.2),
              ),
            ),
          ),
          const SizedBox(height: Gap.xxl),
          NovaButton(
            label: l.actionOpen,
            icon: Icons.open_in_new_rounded,
            onPressed: () => context.push(Routes.user(resolvedCode!)),
          ),
          const SizedBox(height: Gap.md),
          NovaButton(
            label: l.actionRetry,
            tone: ButtonTone.quiet,
            onPressed: onScan,
          ),
        ] else ...[
          const SizedBox(height: Gap.section),
          NovaButton(
            label: state == OrbState.scanning ? l.nfcScanning : l.nfcTapToScan,
            busy: state == OrbState.scanning,
            onPressed: state == OrbState.scanning ? null : onScan,
          ),
        ],
      ],
    );
  }
}
