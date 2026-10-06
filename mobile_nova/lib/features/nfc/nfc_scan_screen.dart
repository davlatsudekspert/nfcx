import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/errors/app_error.dart';
import '../../data/repositories/nfc_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nfc_orb.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import 'nfc_center_screen.dart' show NoNfcPanel;
import 'nfc_service.dart';
import 'scan_target.dart';
import '../../core/utils/external_link.dart';

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

  /// NFCSTORE yorlig'i bo'lmagan teg mazmuni.
  ScanForeign? _foreign;

  /// Oxirgi o'qilgan teg holati (qulflanganmi, identifikatori) —
  /// begona / bo'sh yorliq amallari uchun.
  TagInspection? _tag;

  /// Teg bo'sh, lekin yoziladi (yoki hozirgina tozalandi).
  bool _blank = false;

  /// Tozalash ketmoqda (ikkinchi tegizish kutilmoqda).
  bool _erasing = false;
  String _eraseError = '';

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
      _foreign = null;
      _tag = null;
      _blank = false;
      _eraseError = '';
    });

    // `inspect` — faqat O'QIYDI (hech narsa yozmaydi), lekin matn bilan
    // birga tegning holatini ham beradi: qulflanganmi va identifikatori.
    // Begona yorliqda "Profilimni yozish" / "Tozalash" shu bo'yicha.
    // Xato bo'lsa ham ekran "Qidirilmoqda…" da QOLMAYDI.
    TagInspection tag;
    try {
      tag = await _nfc.inspect();
    } catch (_) {
      tag = const TagInspection(found: false, error: TagError.io);
    }
    if (!mounted) return;

    // iPhone: odam tizim oynasida "Bekor qilish" ni bosdi — xato emas.
    if (tag.error == TagError.cancelled || (!tag.found && _nfc.lastCancelled)) {
      setState(() {
        _state = OrbState.idle;
        _message = l.nfcCancelled;
      });
      return;
    }

    final payload = tag.found ? tag.text : null;
    if (payload == null || payload.trim().isEmpty) {
      // BO'SH, lekin yoziladigan teg (yangi stiker, formatlanmagan
      // teg ham) — xato emas: unga profil yozish taklif qilinadi.
      if (tag.found && tag.canWrite && !tag.hasContent) {
        setState(() {
          _state = OrbState.idle;
          _message = l.nfcTagBlank;
          _tag = tag;
          _blank = true;
        });
        return;
      }
      setState(() {
        _state = OrbState.error;
        _message = l.nfcScanFailed;
      });
      return;
    }

    // FAQAT NFCSTORE manzillari ichkariga olib kiradi (`scan_target`).
    final target = classifyScan(payload);
    String? code;
    switch (target) {
      case ScanForeign():
        setState(() {
          _state = OrbState.error;
          _message = l.nfcNotNfcstore;
          _foreign = target;
          _tag = tag;
        });
        return;
      case ScanRoute(:final location):
        // Ilovada bunday sahifa bo'lmasa — begona yorliq kabi.
        final match =
            GoRouter.of(context).configuration.findMatch(Uri.parse(location));
        if (match.routes.isEmpty || match.error != null) {
          setState(() {
            _state = OrbState.error;
            _message = l.nfcNotNfcstore;
            _foreign = ScanForeign(payload.trim());
            _tag = tag;
          });
          return;
        }
        setState(() => _state = OrbState.idle);
        context.push(location);
        return;
      case ScanProfile(code: final c):
        code = c;
      case ScanChip(:final token):
        final res = await ref.read(nfcRepositoryProvider).resolveChip(token);
        if (!mounted) return;
        final chip = res.valueOrNull;
        // Sotilgan, lekin ULANMAGAN stiker — faollashtirishga, token bilan
        // (shu stiker faollashtirishda bog'lanadi).
        if (chip != null && chip.unlinked) {
          setState(() => _state = OrbState.idle);
          context.push(Routes.nfcActivateSticker(token));
          return;
        }
        // Egasi o'chirib qo'ygan — profil ochilmaydi (sayt kabi).
        if (chip != null && chip.found && !chip.active) {
          setState(() {
            _state = OrbState.error;
            _message = '${l.stickerOffTitle}. ${l.stickerOffBody}';
          });
          return;
        }
        if (chip != null && !chip.found) {
          setState(() {
            _state = OrbState.error;
            _message = l.stickerUnknownBody;
          });
          return;
        }
        if (chip != null && chip.company && chip.code.isNotEmpty) {
          context.push(Routes.storefront(chip.code));
          return;
        }
        code = chip?.code;
        if (code == null || code.isEmpty) {
          setState(() {
            _state = OrbState.error;
            // Token bor, lekin hali hech narsaga bog'lanmagan (Ok, bo'sh
            // kod) — ilgari bu yerda `errorOrNull!` null ustida qulardi.
            _message = describeError(
                l, res.errorOrNull ?? const AppError(AppErrorKind.notFound));
          });
          return;
        }
    }

    setState(() {
      _state = OrbState.success;
      _message = l.nfcScanSuccess;
      _resolvedCode = code;
    });
  }

  /// ASOSIY AMAL — begona / bo'sh yorliqni NFCSTORE'ga ulash.
  ///
  /// Yangi auth yoki yozish oqimi QURILMAYDI — mavjud marshrutlar:
  ///   * NFC ID bor — yozish ekrani (u o'zi tegni tekshiradi, ustiga
  ///     yozishdan oldin so'raydi va o'sha tegning o'zi ekanini
  ///     solishtiradi);
  ///   * NFC ID yo'q — "NFC ID'larim"; ID paydo bo'lib qaytsa, darhol
  ///     yozish ekrani;
  ///   * kirmagan — yozish manzili `go` bilan ochiladi: router uni
  ///     "kutilayotgan manzil" sifatida saqlab, kirish / ro'yxatdan
  ///     o'tish ekraniga buradi va hisob ochilgach AYNAN yozishga
  ///     qaytaradi.
  Future<void> _connect(ForeignPrimary p) async {
    switch (p) {
      case ForeignPrimary.writeProfile:
        context.push(Routes.nfcWrite);
      case ForeignPrimary.getId:
        await context.push(Routes.nfcIds);
        if (!mounted) return;
        if (ref.read(myIdsProvider).isNotEmpty) context.push(Routes.nfcWrite);
      case ForeignPrimary.signUp:
        context.go(Routes.nfcWrite);
    }
  }

  /// IKKINCHI DARAJALI AMAL — begona, qulflanmagan yorliqni tozalash.
  ///
  /// Avval aniq rozilik (nima o'chishi ko'rsatiladi), keyin yana
  /// tegizish. Xizmat faqat SKANERLANGAN tegning o'zini tozalaydi
  /// (`expectIdentity`) va natijani qayta o'qib tasdiqlaydi.
  Future<void> _erase() async {
    final tag = _tag;
    final foreign = _foreign;
    if (tag == null || foreign == null || _erasing) return;
    final l = L.of(context);

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        key: const ValueKey('nfc-erase-dialog'),
        title: Text(l.nfcEraseTitle, style: Theme.of(ctx).textTheme.titleLarge),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.nfcEraseBody, style: Theme.of(ctx).textTheme.bodyMedium),
            const SizedBox(height: Gap.md),
            Text(
              erasePreview(foreign.raw),
              style: AppType.monoStyle(color: ctx.tokens.text2, size: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l.actionCancel),
          ),
          TextButton(
            key: const ValueKey('nfc-erase-confirm'),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l.nfcEraseConfirm,
                style: TextStyle(color: ctx.tokens.error)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    setState(() {
      _erasing = true;
      _eraseError = '';
      _state = OrbState.scanning;
      _message = l.nfcEraseTapAgain;
    });

    NfcWriteResult res;
    try {
      res = await _nfc.eraseTag(expectIdentity: tag.identity);
    } catch (_) {
      res = const NfcWriteResult(ok: false, error: TagError.io);
    }
    if (!mounted) return;

    if (res.ok) {
      setState(() {
        _erasing = false;
        _state = OrbState.success;
        _message = l.nfcEraseDone;
        _foreign = null;
        _blank = true;
        // Endi bu — bo'sh, yoziladigan teg.
        _tag = TagInspection(
          found: true,
          isNdef: tag.isNdef,
          writable: tag.isNdef || tag.writable,
          formattable: tag.formattable,
          maxSize: tag.maxSize,
          identity: tag.identity,
        );
      });
      return;
    }

    setState(() {
      _erasing = false;
      _state = OrbState.error;
      _message = l.nfcNotNfcstore;
      // iPhone "Bekor qilish" — xato emas, jim qaytamiz.
      _eraseError = res.error == TagError.cancelled
          ? ''
          : switch (res.error) {
              TagError.timeout => l.nfcWriteErrTimeout,
              TagError.notNdef => l.nfcWriteErrNotNdef,
              TagError.readOnly => l.nfcWriteErrReadOnly,
              TagError.differentTag => l.nfcWriteErrDifferentTag,
              TagError.verifyFailed => l.nfcEraseErrVerify,
              _ => l.nfcWriteErrIo,
            };
    });
    if (res.error == TagError.cancelled) {
      ScaffoldMessenger.maybeOf(context)
        ?..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l.nfcCancelled)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final availability = ref.watch(nfcAvailabilityProvider);
    final tag = _tag;
    final actions = tag == null || (_foreign == null && !_blank)
        ? null
        : foreignTagActions(
            isNdef: tag.isNdef,
            writable: tag.writable,
            formattable: tag.formattable,
            hasContent: tag.hasContent,
            loggedIn: ref.watch(sessionProvider) is SessionActive,
            hasId: ref.watch(myIdsProvider).isNotEmpty,
            webUrl: _foreign?.webUrl,
          );
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
          // Boshi berk ko'cha emas: QR, havola, ID boshqaruvi.
          NfcAvailability.unsupported => const SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                  Gap.screenX, Gap.lg, Gap.screenX, Gap.section),
              child: NoNfcPanel(),
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
              foreign: _foreign,
              actions: actions,
              erasing: _erasing,
              eraseError: _eraseError,
              onScan: _scan,
              onConnect: _connect,
              onErase: _erase,
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
    required this.onConnect,
    required this.onErase,
    this.foreign,
    this.actions,
    this.erasing = false,
    this.eraseError = '',
  });

  final double orb;
  final OrbState state;
  final String? message;
  final String? resolvedCode;
  final ScanForeign? foreign;

  /// Begona / bo'sh yorliq amallari (`foreignTagActions`).
  final ForeignTagActions? actions;
  final bool erasing;
  final String eraseError;
  final VoidCallback onScan;
  final ValueChanged<ForeignPrimary> onConnect;
  final VoidCallback onErase;

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
        if (foreign != null) ...[
          // BEGONA YORLIQ — mazmuni ko'rinadi, ilova ichida ochilmaydi.
          const SizedBox(height: Gap.md),
          Container(
            key: const ValueKey('nfc-foreign'),
            padding: const EdgeInsets.all(Gap.lg),
            decoration: BoxDecoration(
              color: t.surface2,
              borderRadius: R.gentle,
              border: Border.all(color: t.border2),
            ),
            child: SelectableText(
              foreign!.raw,
              textAlign: TextAlign.center,
              style: AppType.monoStyle(color: t.text1, size: 13),
            ),
          ),
          ..._tagActions(context, l.nfcForeignWritableHint),
        ] else if (actions != null) ...[
          // BO'SH (yoki hozirgina tozalangan) yorliq.
          ..._tagActions(context, l.nfcBlankHint),
        ] else if (resolvedCode != null) ...[
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

  /// Begona / bo'sh yorliq ostidagi amallar.
  ///
  /// Tartib ATAYIN: asosiy — NFCSTORE'ga ulash (to'ldirilgan tugma),
  /// ikkinchi — tozalash (tinch tugma), uchinchi — kichik havolalar
  /// (brauzerda ochish, qayta skanerlash). Qulflangan yorliq — faqat
  /// ma'lumot qatori.
  List<Widget> _tagActions(BuildContext context, String writableHint) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    final a = actions;
    final busy = erasing;
    return [
      if (a != null && a.locked) ...[
        const SizedBox(height: Gap.md),
        Row(
          key: const ValueKey('nfc-foreign-locked'),
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.lock_rounded, size: 16, color: t.text3),
            const SizedBox(width: Gap.sm),
            Flexible(
              child: Text(l.nfcForeignLocked,
                  textAlign: TextAlign.center,
                  style: text.bodySmall?.copyWith(color: t.text2)),
            ),
          ],
        ),
      ],
      if (a?.primary case final p?) ...[
        const SizedBox(height: Gap.md),
        Text(writableHint,
            key: const ValueKey('nfc-foreign-hint'),
            textAlign: TextAlign.center,
            style: text.bodySmall?.copyWith(color: t.text2)),
        const SizedBox(height: Gap.xl),
        NovaButton(
          key: const ValueKey('nfc-foreign-write'),
          label: switch (p) {
            ForeignPrimary.writeProfile => l.nfcForeignWrite,
            ForeignPrimary.getId => l.nfcForeignGetId,
            ForeignPrimary.signUp => l.nfcForeignSignUp,
          },
          icon: Icons.edit_rounded,
          onPressed: busy ? null : () => onConnect(p),
        ),
      ],
      if (a != null && a.canErase) ...[
        const SizedBox(height: Gap.md),
        NovaButton(
          key: const ValueKey('nfc-foreign-erase'),
          label: l.nfcEraseAction,
          icon: Icons.delete_outline_rounded,
          tone: ButtonTone.quiet,
          busy: busy,
          onPressed: busy ? null : onErase,
        ),
      ],
      if (eraseError.isNotEmpty) ...[
        const SizedBox(height: Gap.md),
        Row(
          key: const ValueKey('nfc-erase-error'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.error_outline_rounded, size: 18, color: t.error),
            const SizedBox(width: Gap.sm),
            Expanded(
              child: Text(eraseError,
                  style: text.bodySmall?.copyWith(color: t.error)),
            ),
          ],
        ),
      ],
      const SizedBox(height: Gap.lg),
      Wrap(
        alignment: WrapAlignment.center,
        spacing: Gap.xl,
        runSpacing: Gap.sm,
        children: [
          if (foreign?.webUrl case final url?)
            _LinkAction(
              key: const ValueKey('nfc-foreign-open'),
              icon: Icons.open_in_new_rounded,
              label: l.nfcOpenInBrowser,
              onTap: () => openLink(url.toString()),
            ),
          _LinkAction(
            key: const ValueKey('nfc-foreign-retry'),
            icon: Icons.replay_rounded,
            label: l.actionRetry,
            onTap: busy ? null : onScan,
          ),
        ],
      ),
    ];
  }
}

/// Kichik matnli havola — uchinchi darajali amal (tugma emas).
class _LinkAction extends StatelessWidget {
  const _LinkAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = onTap == null ? t.text3 : t.accent2;
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: Padding(
          // Bosish maydoni matndan kattaroq (kamida ~44 dp balandlik).
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 15, color: color),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .labelLarge
                      ?.copyWith(color: color),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tozalash oynasidagi qisqa ko'rinish — tegdagi narsa (90 belgigacha).
String erasePreview(String raw) {
  final v = raw.trim().replaceAll(RegExp(r'\s+'), ' ');
  return v.length > 90 ? '${v.substring(0, 90)}…' : v;
}
