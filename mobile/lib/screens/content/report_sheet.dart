import 'package:flutter/widgets.dart';

import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/sheet.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/toast.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/share.dart';

/// SHIKOYAT, BLOKLASH VA O'CHIRISH — "⋯" menyusi ortidagi hamma
/// narsa.
///
/// NIMA UCHUN MENYU, NIMA UCHUN BAYROQ EMAS: bayroq belgisi post va
/// story ustida doim ko'rinib turardi va ilovani "shikoyat
/// qilinadigan joy" qilib ko'rsatardi. Shikoyatning O'ZI esa
/// qoladi — Google Play foydalanuvchi kontenti bor ilovadan ilova
/// ICHIDA xabar berish yo'lini TALAB qiladi.
///
/// MENYU EGALIKKA QARAB O'ZGARADI (dizayn 5d va 10b):
/// • boshqa odamning kontenti — "Shikoyat qilish" bor, "O'chirish"
///   YO'Q;
/// • o'z kontentingiz — "O'chirish" bor, "Shikoyat qilish" YO'Q.
/// Foydalanuvchiga tegishli bo'lmagan boshqaruv hech qachon
/// chiqmaydi.

/// Serverdagi `REPORT_REASONS` bilan BIR XIL kalitlar.
///
/// Kalit — server tili, yozuv — odam tili. Ikkalasini bir joyda
/// ushlash kerak: kalit o'zgarsa server tanimay qoladi.
const _reasonKeys = <String>[
  'porn',
  'religious',
  'political',
  'violence',
  'insult',
  'spam',
  'illegal',
  'copyright',
  'other',
];

/// YORLIQLAR QISQA — ATAYLAB.
///
/// Qoidalar to'liq matni O'Z JOYIDA bor: u post yoki story
/// yuklashdan OLDIN ko'rsatiladi. Bu yerda esa boshqa vazifa —
/// allaqachon joylangan kontentni bir so'z bilan turkumlash.
///
/// TILGA BOG'LIQ, ya'ni `const` bo'la olmaydi.
String _reasonLabel(String key) => switch (key) {
      'porn' => tr('Pornografiya'),
      'religious' => tr('Diniy targ‘ibot'),
      'political' => tr('Siyosat'),
      'violence' => tr('Zo‘ravonlik'),
      'insult' => tr('Haqorat'),
      'spam' => tr('Spam'),
      'illegal' => tr('Qonunga zid'),
      'copyright' => tr('Mualliflik huquqi'),
      _ => tr('Boshqa'),
    };

// ─────────────────────────────────────────────────────────────
// SHIKOYAT
// ─────────────────────────────────────────────────────────────

/// Shikoyat oynasini ochadi. Yuborilsa `true` qaytaradi.
///
/// [targetKind] — `post` | `story` | `company_post` | `record` |
/// `company`. [ownerCode] adminga kimning kontenti ekanini tez
/// ko'rsatadi.
Future<bool> showReportSheet(
  BuildContext context, {
  required String targetKind,
  required String targetId,
  String ownerCode = '',
}) async {
  final sent = await showSheet<bool>(
    context,
    title: tr('Shikoyat qilish'),
    subtitle: tr('Sabab tanlang. Shikoyat moderatorga yuboriladi va '
        'kontent tekshiriladi.'),
    child: _ReportBody(
      targetKind: targetKind,
      targetId: targetId,
      ownerCode: ownerCode,
    ),
  );
  return sent == true;
}

class _ReportBody extends StatefulWidget {
  const _ReportBody({
    required this.targetKind,
    required this.targetId,
    required this.ownerCode,
  });

  final String targetKind;
  final String targetId;
  final String ownerCode;

  @override
  State<_ReportBody> createState() => _ReportBodyState();
}

class _ReportBodyState extends State<_ReportBody> {
  String? _reason;
  bool _busy = false;
  String? _error;

  Future<void> _send() async {
    final reason = _reason;
    if (reason == null) {
      setState(() => _error = tr('Avval sababni tanlang.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.report(
            targetKind: widget.targetKind,
            targetId: widget.targetId,
            reason: reason,
            ownerCode: widget.ownerCode,
          );
      if (!mounted) return;
      successHaptic();
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().contains('too_many_requests')
            ? tr('Juda ko‘p shikoyat yubordingiz. Ertaga qayta urining.')
            : humanError(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // QATOR EMAS, CHIPLAR: to'qqizta sabab butun kenglikdagi
          // qatorlarda turganda oyna ekranni to'ldirib, "qoidalar
          // ro'yxati" ga o'xshab qolardi.
          Wrap(
            spacing: S.x8,
            runSpacing: S.x8,
            children: [
              for (final key in _reasonKeys)
                FilterChip(
                  _reasonLabel(key),
                  active: _reason == key,
                  onTap: () => setState(() {
                    _reason = key;
                    _error = null;
                  }),
                ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: S.x12),
            Row(
              children: [
                NIcon(Ico.warning, size: 14, color: C.fail),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _error!,
                    style: T.caption.copyWith(color: C.fail),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: S.x20),
          PrimaryButton(
            tr('Shikoyatni yuborish'),
            loading: _busy,
            onTap: _busy ? null : _send,
          ),
          const SizedBox(height: S.x8),
          GhostButton(
            tr('Bekor qilish'),
            expand: true,
            color: C.ink2,
            onTap: () => Navigator.of(context).pop(false),
          ),
        ],
      );
}

/// SHIKOYAT + TASDIQ — bitta joyda.
Future<void> reportAndConfirm(
  BuildContext context, {
  required String targetKind,
  required String targetId,
  String ownerCode = '',
}) async {
  final sent = await showReportSheet(
    context,
    targetKind: targetKind,
    targetId: targetId,
    ownerCode: ownerCode,
  );
  if (!sent || !context.mounted) return;
  showToast(context, tr('Shikoyat yuborildi. Moderator tekshiradi.'));
}

// ─────────────────────────────────────────────────────────────
// "⋯" MENYUSI
// ─────────────────────────────────────────────────────────────

/// Kontent menyusi.
///
/// [owned] — kontent SHU foydalanuvchiniki. Shunda "O'chirish"
/// ko'rinadi va "Shikoyat qilish" yo'qoladi.
///
/// [onDeleted] o'chirish MUVAFFAQIYATLI bo'lganda chaqiriladi —
/// chaqiruvchi ekran elementni ro'yxatdan olib tashlaydi.
Future<void> showContentMenu(
  BuildContext context, {
  required String targetKind,
  required String targetId,
  String ownerCode = '',
  bool owned = false,
  String? title,
  VoidCallback? onDeleted,
  VoidCallback? onUnfollow,
}) async {
  // `endsWith` — `company_story` ham story hisoblanadi.
  // `==` bo'lganda kompaniya storysi POST endpointiga ketib,
  // bir xil raqamli ID'li boshqa yozuvni o'chirib yuborardi.
  final isStory = targetKind.endsWith('story');
  final isCompany = targetKind.startsWith('company');

  final choice = await showSheet<String>(
    context,
    title: title ?? (isStory ? tr('Story') : tr('Post')),
    subtitle: owned
        ? tr('Bu sizning kontentingiz')
        : tr('Boshqa odamning kontenti'),
    child: Column(
      children: [
        SheetAction(
          label: tr('Havolani nusxalash'),
          icon: Ico.link,
          onTap: () => Navigator.of(context).pop('copy'),
        ),
        if (!owned && onUnfollow != null)
          SheetAction(
            label: tr('Obunani bekor qilish'),
            icon: Ico.close,
            onTap: () => Navigator.of(context).pop('unfollow'),
          ),
        const RowDivider(indent: 0),
        if (owned)
          SheetAction(
            label: isStory ? tr('Storyni o‘chirish') : tr('Postni o‘chirish'),
            icon: Ico.trash,
            danger: true,
            onTap: () => Navigator.of(context).pop('delete'),
          )
        else
          SheetAction(
            label: tr('Shikoyat qilish'),
            icon: Ico.warning,
            danger: true,
            onTap: () => Navigator.of(context).pop('report'),
          ),
      ],
    ),
  );

  if (choice == null || !context.mounted) return;

  switch (choice) {
    case 'copy':
      await shareText(
        context,
        profileUrl(context, ownerCode, company: isCompany),
      );
      return;

    case 'unfollow':
      onUnfollow?.call();
      return;

    case 'report':
      await reportAndConfirm(
        context,
        targetKind: targetKind,
        targetId: targetId,
        ownerCode: ownerCode,
      );
      return;

    case 'delete':
      await _delete(
        context,
        targetKind: targetKind,
        targetId: targetId,
        ownerCode: ownerCode,
        onDeleted: onDeleted,
      );
      return;
  }
}

/// O'CHIRISH — IKKI QADAM.
///
/// 1. Oqibati aniq yozilgan tasdiq oynasi.
/// 2. O'chgandan keyin 5 soniyalik "Bekor" toasti.
///
/// Ikkinchi qadam serverdagi amalni qaytarmaydi — u foydalanuvchiga
/// nima bo'lganini ko'rsatadi va xato bosgan bo'lsa darhol
/// bilishiga imkon beradi. Shuning uchun toast matnida "bekor
/// qilish" emas, nima o'chganini aytamiz.
Future<void> _delete(
  BuildContext context, {
  required String targetKind,
  required String targetId,
  required String ownerCode,
  VoidCallback? onDeleted,
}) async {
  // `endsWith` — `company_story` ham story hisoblanadi.
  // `==` bo'lganda kompaniya storysi POST endpointiga ketib,
  // bir xil raqamli ID'li boshqa yozuvni o'chirib yuborardi.
  final isStory = targetKind.endsWith('story');
  final isCompany = targetKind.startsWith('company');

  final sure = await confirmSheet(
    context,
    title: isStory ? tr('Storyni o‘chirasizmi?') : tr('Postni o‘chirasizmi?'),
    message: isStory
        ? tr('Story va uning layklari profilingizdan olib tashlanadi. '
            'Bu amalni qaytarib bo‘lmaydi.')
        : tr('Post va uning layklari profilingizdan olib tashlanadi. '
            'Bu amalni qaytarib bo‘lmaydi.'),
    confirmLabel: tr('Ha, o‘chirish'),
  );
  if (!sure || !context.mounted) return;

  final repo = AppScope.read(context).repo;
  final id = int.tryParse(targetId) ?? 0;

  try {
    if (isCompany) {
      if (isStory) {
        await repo.deleteCompanyStory(ownerCode, id);
      } else {
        await repo.deleteCompanyPost(ownerCode, id);
      }
    } else {
      if (isStory) {
        await repo.deleteStory(id);
      } else {
        await repo.deletePost(id);
      }
    }
    if (!context.mounted) return;
    successHaptic();
    onDeleted?.call();
    showToast(
      context,
      isStory ? tr('Story o‘chirildi') : tr('Post o‘chirildi'),
      tone: StatusTone.neutral,
    );
  } catch (e) {
    if (context.mounted) showError(context, humanError(e));
  }
}
