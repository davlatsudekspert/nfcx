import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import 'ndef_payload.dart';
import 'nfc_service.dart';

/// BEGONA NFC KARTAGA O'Z PROFILINI YOZISH.
///
/// NIMA UCHUN BOR: foydalanuvchi NFCSTORE kartasini sotib olishga
/// MAJBUR EMAS. Bozordan olingan istalgan qayta yoziladigan NFC
/// stiker yoki oq karta ham uning profil tegiga aylanishi kerak.
///
/// IKKI BOSQICHLI, ATAYLAB:
///
///   1-tegizish — TEKSHIRISH. Hech narsa yozilmaydi. Kartaning
///     qulflanmaganligi, sig'imi va ICHIDA NIMA BORLIGI o'qiladi.
///   ogohlantirish — kartada allaqachon ma'lumot bo'lsa, u aynan
///     ko'rsatiladi va rozilik so'raladi.
///   2-tegizish — YOZISH va darhol QAYTA O'QIB TASDIQLASH.
///
/// Bitta tegizishda qilish mumkin emas edi: rozilik so'ralayotgan
/// paytda karta maydondan chiqib ketadi. Roziliksiz yozish esa —
/// odamning boshqa kartasidagi ma'lumotini so'ramasdan o'chirish.
///
/// XAVFSIZLIK: tegga FAQAT ochiq profil manzili yoziladi
/// (`https://nfcstore.uz/KOD`). NFCSTORE jismoniy kartasining
/// maxfiy chip tokeni bu yerga HECH QACHON tushmaydi — u faqat
/// bizning kartamizning o'zida yashaydi va tashqi tegga
/// ko'chirilsa istalgan o'quvchiga ochilib qolardi.
class NfcWriteScreen extends ConsumerStatefulWidget {
  const NfcWriteScreen({super.key});

  @override
  ConsumerState<NfcWriteScreen> createState() => _NfcWriteScreenState();
}

/// Ekranning qaysi bosqichda turgani.
enum _Phase { idle, checking, checked, writing, done }

class _NfcWriteScreenState extends ConsumerState<NfcWriteScreen> {
  _Phase _phase = _Phase.idle;
  String? _selectedCode;
  TagInspection? _tag;
  String _error = '';

  /// Xizmat SHU YERDA ushlab turiladi, `dispose()` da o'qilmaydi.
  ///
  /// Riverpod `dispose()` ichida `ref.read` ni TAQIQLAYDI (o'sha
  /// paytda element allaqachon yo'q qilingan) — u yerdagi chaqiruv
  /// `Bad state: Cannot use "ref" after the widget was disposed`
  /// bilan yiqiladi va NFC sessiyasi YOPILMAY QOLADI: antenna band
  /// bo'lib turaveradi.
  late final NfcService _nfc = ref.read(nfcServiceProvider);

  @override
  void initState() {
    super.initState();
    // `late final` ni ATAYLAB shu yerda ochamiz: birinchi murojaat
    // `dispose()` da bo'lsa, yuqoridagi muammo qaytib kelardi.
    _nfc;
  }

  @override
  void dispose() {
    // Ekran yopilsa NFC antennasi bo'sh qolsin.
    _nfc.stop();
    super.dispose();
  }

  NfcId? _target(List<NfcId> ids) {
    if (ids.isEmpty) return null;
    final code = _selectedCode;
    if (code != null) {
      for (final e in ids) {
        if (e.code == code) return e;
      }
    }
    for (final e in ids) {
      if (e.primary) return e;
    }
    return ids.first;
  }

  String _urlFor(NfcId id) => profileTagUrl(kApiBase, id.code);

  /// 1-BOSQICH — kartani o'qish. Hech narsa o'zgarmaydi.
  Future<void> _check() async {
    setState(() {
      _phase = _Phase.checking;
      _error = '';
      _tag = null;
    });

    final res = await ref.read(nfcServiceProvider).inspect();
    if (!mounted) return;

    if (!res.found || res.error != TagError.none) {
      setState(() {
        _phase = _Phase.idle;
        _error = _describe(res.error);
      });
      return;
    }
    setState(() {
      _phase = _Phase.checked;
      _tag = res;
    });
  }

  /// 2-BOSQICH — rozilik, so'ng yozish va qayta o'qib tasdiqlash.
  Future<void> _write(NfcId id) async {
    final tag = _tag;
    if (tag == null) return;
    final l = L.of(context);

    // Kartada ma'lumot bo'lsa — TASDIQSIZ yozilmaydi.
    if (tag.hasContent) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(l.nfcWriteOverwriteTitle,
              style: Theme.of(ctx).textTheme.titleLarge),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l.nfcWriteOverwriteBody,
                  style: Theme.of(ctx).textTheme.bodyMedium),
              const SizedBox(height: Gap.md),
              for (final r in tag.records)
                if (r.value.trim().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Gap.sm),
                    child: Text(
                      _preview(r),
                      style: AppType.monoStyle(
                          color: context.tokens.text2, size: 12),
                    ),
                  ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(l.actionCancel),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(l.nfcWriteOverwriteConfirm,
                  style: TextStyle(color: context.tokens.error)),
            ),
          ],
        ),
      );
      if (ok != true || !mounted) return;
    }

    setState(() {
      _phase = _Phase.writing;
      _error = '';
    });

    final url = _urlFor(id);
    final res = await ref.read(nfcServiceProvider).writeProfileUrl(
          url: url,
          expectIdentity: tag.identity,
        );
    if (!mounted) return;

    setState(() {
      _phase = res.ok ? _Phase.done : _Phase.checked;
      _error = res.ok ? '' : _describe(res.error, payloadSize: _sizeOf(url));
    });
  }

  /// Yoziladigan xabar teg sig'imiga solishtirish uchun.
  ///
  /// URI yozuvining teglar ustidagi uzunligi: 3 bayt sarlavha +
  /// 1 bayt tur (`U`) + yuklama. `NdefMessage.byteLength` aynan
  /// shuni beradi, lekin u `nfc_manager` sinfini talab qiladi —
  /// bu yerda esa faqat xato matnidagi raqam uchun kerak.
  int _sizeOf(String url) => 4 + encodeUriPayload(url).length;

  String _preview(NdefRecordData r) {
    final v = r.value.trim().replaceAll(RegExp(r'\s+'), ' ');
    final short = v.length > 90 ? '${v.substring(0, 90)}…' : v;
    return switch (r.kind) {
      NdefKind.uri => short,
      NdefKind.text => '“$short”',
      NdefKind.vcard => 'vCard · $short',
      NdefKind.unknown => r.mimeType.isEmpty ? short : '${r.mimeType} · $short',
    };
  }

  String _describe(TagError e, {int payloadSize = 0}) {
    final l = L.of(context);
    return switch (e) {
      TagError.none => '',
      TagError.timeout => l.nfcWriteErrTimeout,
      TagError.notNdef => l.nfcWriteErrNotNdef,
      TagError.readOnly => l.nfcWriteErrReadOnly,
      TagError.tooLarge =>
        l.nfcWriteErrTooLarge(payloadSize, _tag?.maxSize ?? 0),
      TagError.differentTag => l.nfcWriteErrDifferentTag,
      TagError.verifyFailed => l.nfcWriteErrVerify,
      TagError.io => l.nfcWriteErrIo,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final ids = ref.watch(myIdsProvider);
    final availability = ref.watch(nfcAvailabilityProvider);
    final id = _target(ids);

    return NovaScaffold(
      title: l.nfcWrite,
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
          _ => id == null
              ? StatePanel(
                  icon: Icons.badge_outlined,
                  title: l.nfcWriteNoId,
                  actionLabel: l.nfcMyIds,
                  onAction: () => context.push(Routes.nfcIds),
                )
              : _body(l, t, ids, id),
        },
      ),
    );
  }

  Widget _body(L l, NfcTokens t, List<NfcId> ids, NfcId id) {
    final url = _urlFor(id);

    return NovaScroll(
      children: [
        Text(l.nfcWriteSubtitle, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: Gap.lg),

        // ── Qaysi profil ──────────────────────────────────────────
        SectionHeader(title: l.nfcWriteChooseId),
        if (ids.length > 1)
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              for (final e in ids)
                GestureDetector(
                  onTap: _busy
                      ? null
                      : () => setState(() {
                            _selectedCode = e.code;
                            // Profil almashsa yozish qaytadan
                            // tasdiqlanadi — eski tekshiruv boshqa
                            // manzil uchun edi.
                            _phase = _Phase.idle;
                            _tag = null;
                            _error = '';
                          }),
                  child: Capsule(
                    label: e.name.isEmpty ? e.code : e.name,
                    selected: e.code == id.code,
                  ),
                ),
            ],
          ),
        const SizedBox(height: Gap.md),
        FloatingSurface(
          solid: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l.nfcWriteUrlLabel,
                  style: Theme.of(context).textTheme.labelSmall),
              const SizedBox(height: 4),
              SelectableText(
                url,
                style: AppType.monoStyle(color: t.text1, size: 13),
              ),
            ],
          ),
        ),

        const SizedBox(height: Gap.lg),
        _SafetyNote(text: l.nfcWriteSafety),

        // ── 1-qadam ───────────────────────────────────────────────
        SectionHeader(title: l.nfcWriteStepCheck),
        Text(l.nfcWriteStepCheckHint,
            style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: Gap.md),
        NovaButton(
          label: _phase == _Phase.checking
              ? l.nfcWriteChecking
              : l.nfcWriteCheckAction,
          icon: Icons.search_rounded,
          tone: _phase == _Phase.idle ? ButtonTone.accent : ButtonTone.quiet,
          busy: _phase == _Phase.checking,
          onPressed: _busy ? null : _check,
        ),

        if (_tag != null) ...[
          const SizedBox(height: Gap.md),
          _TagReport(tag: _tag!),
        ],

        // ── 2-qadam ───────────────────────────────────────────────
        if (_phase == _Phase.checked || _phase == _Phase.writing) ...[
          SectionHeader(title: l.nfcWriteStepWrite),
          Text(l.nfcWriteStepWriteHint,
              style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: Gap.md),
          NovaButton(
            label:
                _phase == _Phase.writing ? l.nfcWriteWriting : l.nfcWriteAction,
            icon: Icons.edit_rounded,
            busy: _phase == _Phase.writing,
            // Qulflangan yoki NDEF bo'lmagan tegda tugma umuman
            // bosilmaydi: sababi yuqorida yozilgan.
            onPressed: _busy || !_canWrite ? null : () => _write(id),
          ),
        ],

        // ── Natija ────────────────────────────────────────────────
        if (_phase == _Phase.done) ...[
          const SizedBox(height: Gap.md),
          _ResultPanel(
            icon: Icons.check_circle_rounded,
            tone: t.success,
            title: l.nfcWriteDone,
            body: l.nfcWriteDoneBody,
          ),
          const SizedBox(height: Gap.md),
          NovaButton(
            label: l.nfcWriteAgain,
            tone: ButtonTone.quiet,
            icon: Icons.replay_rounded,
            onPressed: () => setState(() {
              _phase = _Phase.idle;
              _tag = null;
              _error = '';
            }),
          ),
        ],

        if (_error.isNotEmpty) ...[
          const SizedBox(height: Gap.md),
          _ResultPanel(
            icon: Icons.error_outline_rounded,
            tone: t.error,
            title: _error,
          ),
        ],

        // iOS'da yozish tizim oynasi orqali ketadi — buni oldindan
        // aytamiz, aks holda "tugmani bosdim, hech narsa bo'lmadi"
        // degan taassurot qoladi.
        if (defaultTargetPlatform == TargetPlatform.iOS) ...[
          const SizedBox(height: Gap.md),
          Text(l.nfcWriteIosHint,
              style: Theme.of(context).textTheme.bodySmall),
        ],
      ],
    );
  }

  bool get _busy => _phase == _Phase.checking || _phase == _Phase.writing;

  /// Tekshiruv natijasiga ko'ra yozish MUMKINMI.
  ///
  /// Formatlanmagan (lekin formatlanadigan) bo'sh teg ham yoziladi —
  /// yangi stikerlar ko'pincha shunday keladi.
  bool get _canWrite {
    final tag = _tag;
    if (tag == null) return false;
    if (!tag.isNdef) return tag.formattable;
    return tag.writable;
  }
}

/// Tekshiruv natijasi — kartada nima bor va u yoziladimi.
class _TagReport extends StatelessWidget {
  const _TagReport({required this.tag});
  final TagInspection tag;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    final (icon, title, tone) = switch (true) {
      _ when !tag.isNdef && !tag.formattable => (
          Icons.block_rounded,
          l.nfcWriteErrNotNdef,
          t.error
        ),
      _ when tag.isNdef && !tag.writable => (
          Icons.lock_rounded,
          l.nfcWriteErrReadOnly,
          t.error
        ),
      _ when tag.hasContent => (
          Icons.warning_amber_rounded,
          l.nfcWriteTagHasData,
          t.warn
        ),
      _ => (Icons.check_circle_outline_rounded, l.nfcWriteEmptyTag, t.success),
    };

    return FloatingSurface(
      solid: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: tone),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Text(title,
                    style: Theme.of(context).textTheme.titleSmall),
              ),
            ],
          ),
          if (tag.maxSize > 0) ...[
            const SizedBox(height: 4),
            Text(l.nfcWriteCapacity(tag.maxSize),
                style: Theme.of(context).textTheme.bodySmall),
          ],
          for (final r in tag.records)
            if (r.value.trim().isNotEmpty) ...[
              const SizedBox(height: Gap.sm),
              Text(
                r.value.trim(),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: AppType.monoStyle(color: t.text2, size: 12),
              ),
            ],
        ],
      ),
    );
  }
}

/// Natija paneli — muvaffaqiyat yoki xato.
class _ResultPanel extends StatelessWidget {
  const _ResultPanel({
    required this.icon,
    required this.tone,
    required this.title,
    this.body,
  });

  final IconData icon;
  final Color tone;
  final String title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: .11),
        borderRadius: R.gentle,
        border: Border.all(color: tone.withValues(alpha: .3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: tone),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                if (body != null) ...[
                  const SizedBox(height: 3),
                  Text(body!,
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Maxfiy kalit yozilmasligi haqidagi tinch eslatma.
class _SafetyNote extends StatelessWidget {
  const _SafetyNote({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.shield_outlined, size: 15, color: t.text3),
        const SizedBox(width: Gap.sm),
        Expanded(
          child: Text(text, style: Theme.of(context).textTheme.bodySmall),
        ),
      ],
    );
  }
}
