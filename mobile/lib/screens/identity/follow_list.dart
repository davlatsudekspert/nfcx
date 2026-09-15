import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/components/backdrop.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import 'profile_screen.dart';

/// OBUNACHILAR VA OBUNALAR.
///
/// Ikkalasi BITTA ekranda ikkita yo'nalish sifatida: ular bir xil
/// ro'yxat komponenti va faqat munosabat yo'nalishi bilan farq
/// qiladi. Alohida ikki ekran yasash bir xil kodni ikki marta yozish
/// bo'lardi.
///
/// QIDIRUV MIJOZDA. `/api/follow-list` 200 tagacha qator qaytaradi va
/// qidiruv uchun alohida endpoint yo'q — shuning uchun filtr
/// ALLAQACHON YUKLANGAN ro'yxat ustida ishlaydi va tarmoqqa
/// murojaat qilmaydi.
class FollowListScreen extends StatefulWidget {
  const FollowListScreen({
    super.key,
    required this.code,
    required this.title,
    this.startWithFollowing = false,
    this.isCompany = false,
  });

  final String code;
  final String title;

  /// `true` — "Obunalar" ro'yxatidan boshlanadi (odam shu raqamni
  /// bosgan).
  final bool startWithFollowing;

  /// KOMPANIYADA "OBUNALAR" YO'Q.
  ///
  /// Kompaniya hech kimga obuna bo'lolmaydi — faqat odam
  /// kompaniyaga obuna bo'ladi. Ko'rsatilsa, u DOIM bo'sh bo'lardi
  /// va odam "nega hech kim yo'q" deb o'ylardi.
  final bool isCompany;

  @override
  State<FollowListScreen> createState() => _FollowListScreenState();
}

class _FollowListScreenState extends State<FollowListScreen> {
  final _cache = <bool, List<FollowEntry>>{};
  final _errors = <bool, Object?>{};
  final _loading = <bool>{};
  final _search = TextEditingController();

  /// Kimga obuna ekanim. `/api/follow-list` HAR QATOR uchun bu
  /// belgini qaytarmaydi, shuning uchun yagona ishonchli manba —
  /// O'ZIMNING "obunalarim" ro'yxati. Qolgan qatorlar "Obuna
  /// bo'lish" deb boshlanadi va bosilganda holat shu to'plamda
  /// yangilanadi.
  final _followed = <String>{};

  /// Amal ketayotgan qatorlar — faqat o'sha tugma bloklanadi.
  final _acting = <String>{};

  late bool _following = !widget.isCompany && widget.startWithFollowing;
  String _query = '';

  bool get _twoTabs => !widget.isCompany;

  @override
  void initState() {
    super.initState();
    _load(_following);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  /// Har yo'nalish O'Z ma'lumotini birinchi ochilganda yuklaydi va
  /// keyin keshdan oladi — almashtirganda so'rov takrorlanmaydi.
  ///
  /// `force` — faqat "Qayta urinish" uchun. Usiz allaqachon yuklangan
  /// ro'yxat qayta so'ralmaydi: test ko'rsatdi (uch marta o'tganda
  /// uchta so'rov ketardi), ya'ni odam o'ynagan sayin serverga
  /// keraksiz yuk tushardi.
  Future<void> _load(bool following, {bool force = false}) async {
    if (_loading.contains(following)) return;
    if (!force && _cache.containsKey(following)) return;
    setState(() {
      _loading.add(following);
      _errors[following] = null;
    });
    try {
      final state = AppScope.read(context);
      final list = await state.repo.followList(widget.code, following: following);
      if (!mounted) return;
      setState(() {
        _cache[following] = list;
        // O'ZIMNING obunalarim — demak bu qatorlarning hammasiga
        // obunaman.
        if (following &&
            (state.ownsRecord(widget.code) || state.ownsCompany(widget.code))) {
          _followed.addAll(list.map((e) => e.code));
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _errors[following] = e);
    } finally {
      if (mounted) setState(() => _loading.remove(following));
    }
  }

  void _switch(bool following) {
    if (_following == following) return;
    setState(() => _following = following);
    _load(following);
  }

  Future<void> _toggleFollow(FollowEntry entry) async {
    final repo = AppScope.read(context).repo;
    final was = _followed.contains(entry.code);
    setState(() {
      _acting.add(entry.code);
      if (was) {
        _followed.remove(entry.code);
      } else {
        _followed.add(entry.code);
      }
    });
    try {
      if (was) {
        await repo.unfollow(entry.code);
      } else {
        await repo.follow(entry.code);
      }
    } catch (e) {
      if (!mounted) return;
      // Xato bo'lsa holat ORQAGA qaytadi: ekran serverda
      // bo'lmagan narsani ko'rsatmasin.
      setState(() {
        if (was) {
          _followed.add(entry.code);
        } else {
          _followed.remove(entry.code);
        }
      });
      await showError(context, humanError(e));
    } finally {
      if (mounted) setState(() => _acting.remove(entry.code));
    }
  }

  List<FollowEntry> _filter(List<FollowEntry> list) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return list;
    return list
        .where((e) =>
            e.name.toLowerCase().contains(q) ||
            e.code.toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final list = _cache[_following];
    final busy = _loading.contains(_following);

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(),
            ScreenTitle(
              widget.title,
              trailing: list == null
                  ? null
                  : Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text('${list.length}', style: T.statValue),
                    ),
            ),

            // ── YO'NALISH ──────────────────────────────────────
            if (_twoTabs)
              Padding(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
                child: Row(
                  children: [
                    FilterChip(
                      tr('Obunachilar'),
                      active: !_following,
                      onTap: () => _switch(false),
                    ),
                    const SizedBox(width: S.x8),
                    FilterChip(
                      tr('Obunalar'),
                      active: _following,
                      onTap: () => _switch(true),
                    ),
                  ],
                ),
              ),

            // ── QIDIRUV ────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
              child: SearchField(
                controller: _search,
                hint: tr('Ism yoki ID bo‘yicha qidirish'),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),

            Expanded(
              child: AsyncView<List<FollowEntry>>(
                loading: busy,
                error: _errors[_following],
                data: list,
                onRetry: () => _load(_following, force: true),
                isEmpty: (d) => d.isEmpty,
                emptyMessage: _following
                    ? tr('Hali hech kimga obuna emas.')
                    : tr('Hali obunachi yo‘q.'),
                skeleton: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  children: const [
                    SkeletonRow(),
                    SkeletonRow(),
                    SkeletonRow(),
                    SkeletonRow(),
                  ],
                ),
                builder: (data) {
                  final rows = _filter(data);
                  if (rows.isEmpty) {
                    return EmptyState(
                      tr('Boshqa so‘z bilan qidirib ko‘ring.'),
                      title: tr('Topilmadi'),
                      compact: true,
                    );
                  }
                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(
                      S.gutter,
                      0,
                      S.gutter,
                      S.x32,
                    ),
                    // Yuklanish davom etayotgan bo'lsa oxirida
                    // skeleton qatorlar turadi.
                    itemCount: rows.length + (busy ? 2 : 0),
                    separatorBuilder: (_, __) => const SizedBox(height: S.x8),
                    itemBuilder: (_, i) {
                      if (i >= rows.length) return const SkeletonRow();
                      final e = rows[i];
                      return _Row(
                        entry: e,
                        following: _followed.contains(e.code),
                        busy: _acting.contains(e.code),
                        onAction: () => _toggleFollow(e),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.entry,
    required this.following,
    required this.busy,
    required this.onAction,
  });

  final FollowEntry entry;
  final bool following;
  final bool busy;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final url = entry.isCompany
        ? 'nfcstore.uz/c/${entry.code.toLowerCase()}'
        : 'nfcstore.uz/${entry.code.toLowerCase()}';

    return Press(
      onTap: () => push(
        context,
        (_) => entry.isCompany
            ? ProfileScreen(companyId: entry.code)
            : ProfileScreen(code: entry.code),
      ),
      minSize: 0,
      scale: .99,
      child: Surface(
        padding: const EdgeInsets.all(S.x12),
        shadow: C.e1,
        child: Row(
          children: [
            Avatar(
              url: entry.avatarUrl,
              name: entry.name,
              size: 48,
              square: entry.isCompany,
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          entry.name.isEmpty ? entry.code : entry.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.cardTitle,
                        ),
                      ),
                      if (entry.verified) ...[
                        const SizedBox(width: 5),
                        const VerifiedBadge(size: 13),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    // Kompaniya nomidan obuna bo'lgan bo'lsa,
                    // orqasidagi odam ham ko'rinadi.
                    entry.isCompany && entry.personName.isNotEmpty
                        ? '$url · ${entry.personName}'
                        : url,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.link,
                  ),
                ],
              ),
            ),
            const SizedBox(width: S.x8),
            // HOLAT MATN BILAN: "Obuna" — allaqachon obunaman,
            // "Obuna bo'lish" — hali emas. Rang yagona belgi emas.
            following
                ? GhostButton(
                    tr('Obuna'),
                    size: BtnSize.s,
                    color: C.ink2,
                    onTap: busy ? null : onAction,
                  )
                : SecondaryButton(
                    tr('Obuna bo‘lish'),
                    size: BtnSize.s,
                    expand: false,
                    loading: busy,
                    onTap: busy ? null : onAction,
                  ),
          ],
        ),
      ),
    );
  }
}
