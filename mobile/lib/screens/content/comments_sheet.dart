import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/toast.dart';
import '../../design/nav.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../identity/profile_screen.dart';
import '../settings/premium.dart';

/// IZOHLAR — lentadagi va Reels'dagi kontent ostidagi yozishmalar.
///
/// NIMA UCHUN VARAQA, ALOHIDA EKRAN EMAS: Reels'da video davom
/// etayotgan bo'ladi va odam izohni O'SHA kadrni ko'rib turib
/// o'qiydi. Alohida ekran video'ni to'xtatib, kontekstni yo'qotardi.
///
/// NIMA UCHUN HISOB SERVERDAN: izoh yozilganda yangi son javobda
/// keladi va shu qaytariladi. Mijozda "+1" qilish ikki qurildagi
/// raqamlarni ajratib yuborardi (yoqtirish bilan bir xil qoida).
///
/// KIM O'CHIRA OLADI: izoh muallifi va KONTENT EGASI. Egasisiz odam
/// o'z posti ostidagi haqoratni olib tashlay olmasdi. Huquqni
/// baribir SERVER tekshiradi — bu yerdagi bayroq faqat tugmani
/// ko'rsatish uchun.

/// Izohlar varaqasini ochadi va YOPILGANDAGI jami sonni qaytaradi
/// (chaqiruvchi ekran o'z hisobini yangilashi uchun).
Future<int?> showCommentsSheet(
  BuildContext context, {
  required String targetKind,
  required int targetId,
  int initialCount = 0,
  bool owned = false,
}) =>
    showSheet<int>(
      context,
      title: tr('Izohlar'),
      child: _CommentsBody(
        targetKind: targetKind,
        targetId: targetId,
        initialCount: initialCount,
        owned: owned,
      ),
    );

class _CommentsBody extends StatefulWidget {
  const _CommentsBody({
    required this.targetKind,
    required this.targetId,
    required this.initialCount,
    required this.owned,
  });

  /// Bu kontent SHU foydalanuvchiniki. Server ham shu huquqni
  /// beradi (`DELETE /api/comments/:id` — muallif YOKI kontent
  /// egasi), bu yerdagi bayroq faqat tugmani ko'rsatish uchun.

  final String targetKind;
  final int targetId;
  final int initialCount;
  final bool owned;

  @override
  State<_CommentsBody> createState() => _CommentsBodyState();
}

class _CommentsBodyState extends State<_CommentsBody> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  List<Comment> _items = const [];
  int _total = 0;
  int _page = 1;
  bool _hasMore = false;
  bool _loading = true;
  bool _sending = false;
  bool _loadingMore = false;
  Object? _error;
  String? _inputError;

  @override
  void initState() {
    super.initState();
    _total = widget.initialCount;
    _scroll.addListener(() {
      // Pastga yetganda keyingi sahifa. 240px oldindan —
      // ro'yxat "to'xtab qolmasin".
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 240) {
        _loadMore();
      }
    });
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loading && _items.isEmpty && _error == null) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await AppScope.read(context).repo.comments(widget.targetKind, widget.targetId);
      if (!mounted) return;
      setState(() {
        _items = r.items;
        _hasMore = r.hasMore;
        _total = r.total;
        _page = 1;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _loading) return;
    _loadingMore = true;
    try {
      final r = await AppScope.read(context)
          .repo
          .comments(widget.targetKind, widget.targetId, page: _page + 1);
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...r.items];
        _hasMore = r.hasMore;
        _total = r.total;
        _page += 1;
      });
    } catch (_) {
      // Keyingi sahifa kelmasa, mavjud ro'yxat ishlashda davom etadi.
    } finally {
      _loadingMore = false;
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty) {
      setState(() => _inputError = tr('Avval izoh yozing.'));
      return;
    }
    setState(() {
      _sending = true;
      _inputError = null;
    });
    try {
      final r = await AppScope.read(context)
          .repo
          .addComment(widget.targetKind, widget.targetId, text);
      if (!mounted) return;
      successHaptic();
      setState(() {
        // Yangisi yuqorida — serverdagi tartib bilan bir xil.
        _items = [r.comment, ..._items];
        _total = r.total;
        _input.clear();
        _sending = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _inputError = _humanCommentError(e);
      });
    }
  }

  Future<void> _delete(Comment c) async {
    final yes = await confirmSheet(
      context,
      title: tr('Izohni o‘chirish'),
      message: tr('Izoh butunlay o‘chadi. Buni qaytarib bo‘lmaydi.'),
      confirmLabel: tr('O‘chirish'),
    );
    if (!yes || !mounted) return;
    // Optimistik: ro'yxatdan darhol olib tashlanadi. Xato bo'lsa
    // qaytariladi — bo'sh joy "o'chdi" degan yolg'on taassurot
    // qoldirmasligi kerak.
    final before = _items;
    setState(() => _items = _items.where((x) => x.id != c.id).toList());
    try {
      final total = await AppScope.read(context).repo.deleteComment(c.id);
      if (!mounted) return;
      setState(() => _total = total);
    } catch (e) {
      if (!mounted) return;
      setState(() => _items = before);
      showToast(context, humanError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.read(context);
    final signedIn = app.phase == AuthPhase.signedIn;

    // IZOH YOZISH — FAQAT PREMIUM OBUNACHILARGA (egasining qarori).
    //
    // O'QISH HAMMAGA OCHIQ: ro'yxat yuqorida turaveradi. Cheklov
    // faqat yozishda — aks holda lentada gap ketayotgani
    // bilinmasdi va Premium olishning ma'nosi ham ko'rinmasdi.
    //
    // ASOSIY QOIDA SERVERDA. Bu yer faqat odamni behuda yozib,
    // "ruxsat yo'q" xatosini kutishdan saqlaydi.
    final canWrite = signedIn && (app.user?.isPremium ?? false);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // JAMI SON — sarlavha ostida. Varaqa sarlavhasi "Izohlar"
        // bo'lgani uchun son alohida qatorda turadi va yangilanadi.
        Text(
          _total == 0 ? tr('Hali izoh yo‘q') : '$_total ${tr('ta izoh')}',
          style: T.caption.copyWith(color: C.ink2),
        ),
        const SizedBox(height: S.x12),

        // RO'YXAT — balandligi cheklangan: varaqa ekranni to'liq
        // egallab ketmasligi kerak, kontent orqada ko'rinib tursin.
        ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * .42,
          ),
          child: _list(),
        ),

        const SizedBox(height: S.x12),

        // YOZISH QATORI.
        if (!signedIn)
          Text(
            tr('Izoh yozish uchun hisobingizga kiring.'),
            style: T.caption.copyWith(color: C.ink2),
          )
        else if (!canWrite)
          // BOSHI BERK EMAS: nima yetishmayotgani va uni qayerdan
          // olish aytiladi.
          Surface(
            padding: const EdgeInsets.all(S.x16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    NIcon(Ico.sparkle, size: 18, color: C.accentSecondary),
                    const SizedBox(width: S.x8),
                    Expanded(
                      child: Text(
                        tr('Izoh yozish Premium obunachilar uchun.'),
                        style: T.cardTitle.copyWith(fontSize: 14),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: S.x12),
                SecondaryButton(
                  tr('Premium olish'),
                  size: BtnSize.m,
                  onTap: () {
                    Navigator.of(context).pop();
                    push<void>(context, (_) => const PremiumScreen());
                  },
                ),
              ],
            ),
          )
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Field(
                  label: tr('IZOH'),
                  controller: _input,
                  hint: tr('Fikringizni yozing'),
                  maxLength: 1000,
                  maxLines: 3,
                  error: _inputError,
                  enabled: !_sending,
                  textInputAction: TextInputAction.newline,
                ),
              ),
              const SizedBox(width: S.x8),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: RoundButton(
                  Ico.send,
                  size: 52,
                  iconSize: 20,
                  accent: true,
                  onTap: _sending ? null : _send,
                ),
              ),
            ],
          ),
      ],
    );
  }

  Widget _list() {
    if (_loading) {
      return Column(
        children: [
          for (var i = 0; i < 3; i++)
            const Padding(
              padding: EdgeInsets.only(bottom: S.x12),
              child: SkeletonRow(),
            ),
        ],
      );
    }
    if (_error != null) {
      return ErrorState(
        humanError(_error),
        detail: errorDetail(_error),
        onRetry: _load,
      );
    }
    if (_items.isEmpty) {
      return EmptyState(
        tr('Birinchi bo‘lib fikr bildiring.'),
        title: tr('Hali izoh yo‘q'),
        icon: Ico.comment,
        compact: true,
      );
    }
    return ListView.separated(
      controller: _scroll,
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      itemCount: _items.length,
      separatorBuilder: (_, __) => const SizedBox(height: S.x16),
      itemBuilder: (context, i) => _CommentRow(
        comment: _items[i],
        // O'CHIRISH HUQUQI IKKI KISHIDA: izoh muallifida va
        // KONTENT EGASIDA. Ilgari faqat muallif ko'rsatilardi —
        // ya'ni odam o'z posti ostidagi haqoratni olib tashlay
        // olmasdi, garchi server buni allaqachon ruxsat bersa ham.
        onDelete: (_items[i].mine || widget.owned)
            ? () => _delete(_items[i])
            : null,
      ),
    );
  }
}

/// Server xatosini odam tiliga o'giradi.
///
/// Ikki holat alohida: chegara (juda tez yozilyapti) va ban. Qolgani
/// umumiy `humanError` ga tushadi — aks holda har bir xato "Xatolik"
/// bo'lib, odam nima qilishini bilmasdi.
String _humanCommentError(Object e) {
  final s = e.toString();
  if (s.contains('too_many_requests')) {
    return tr('Juda tez yozyapsiz. Bir daqiqadan so‘ng urining.');
  }
  if (s.contains('banned')) return tr('Hisobingiz vaqtincha cheklangan.');
  if (s.contains('unauthorized')) return tr('Izoh yozish uchun hisobingizga kiring.');
  if (s.contains('empty')) return tr('Avval izoh yozing.');
  return humanError(e);
}

class _CommentRow extends StatelessWidget {
  const _CommentRow({required this.comment, this.onDelete});

  final Comment comment;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // MUALLIF PROFILIGA O'TISH — faqat kodi bor bo'lsa.
          // Kartasi yo'q odamning ochiladigan profili ham yo'q.
          Press(
            onTap: comment.code.isEmpty
                ? null
                : () => push(context, (_) => ProfileScreen(code: comment.code)),
            child: Avatar(url: comment.avatarUrl, name: comment.name, size: 36),
          ),
          const SizedBox(width: S.x12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        comment.name,
                        style: T.cardTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: S.x8),
                    Text(ago(comment.createdAt), style: T.caption.copyWith(color: C.ink3)),
                  ],
                ),
                const SizedBox(height: 2),
                Text(comment.body, style: T.body),
              ],
            ),
          ),
          if (onDelete != null) ...[
            const SizedBox(width: S.x8),
            Press(
              onTap: onDelete,
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: NIcon(Ico.trash, size: 16, color: C.ink3),
              ),
            ),
          ],
        ],
      );
}
