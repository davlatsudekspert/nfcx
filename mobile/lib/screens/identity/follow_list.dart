import 'package:flutter/material.dart' show Scaffold, DefaultTabController, TabBar, TabBarView, Tab;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import 'profile_screen.dart';
import '../../l10n/strings.dart';

/// OBUNACHILAR VA OBUNALAR.
///
/// Ikkalasi BITTA ekranda ikkita tab sifatida: ular bir xil ro'yxat
/// komponenti va faqat munosabat yo'nalishi bilan farq qiladi. Alohida
/// ikki ekran yasash bir xil kodni ikki marta yozish bo'lardi.
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

  /// `true` — "Obunalar" tabidan boshlanadi (odam shu raqamni bosgan).
  final bool startWithFollowing;

  /// KOMPANIYADA "OBUNALAR" TABI YO'Q.
  ///
  /// Kompaniya hech kimga obuna bo'lolmaydi — faqat odam
  /// kompaniyaga obuna bo'ladi. Tab ko'rsatilsa, u DOIM bo'sh
  /// bo'lardi va odam "nega hech kim yo'q" deb o'ylardi.
  final bool isCompany;

  @override
  State<FollowListScreen> createState() => _FollowListScreenState();
}

class _FollowListScreenState extends State<FollowListScreen> {
  final _cache = <bool, List<FollowEntry>>{};
  final _errors = <bool, Object?>{};
  final _loading = <bool>{};

  bool get _twoTabs => !widget.isCompany;

  @override
  void initState() {
    super.initState();
    _load(_twoTabs && widget.startWithFollowing);
  }

  /// Har tab O'Z ma'lumotini birinchi ochilganda yuklaydi va keyin
  /// keshdan oladi — tablar orasida har o'tganda so'rov takrorlanmaydi.
  ///
  /// `force` — faqat "Qayta urinish" uchun. Usiz allaqachon yuklangan
  /// tab qayta so'ralmaydi: test ko'rsatdi (uch marta o'tganda uchta
  /// so'rov ketardi), ya'ni odam tablar bilan o'ynagan sayin serverga
  /// keraksiz yuk tushardi.
  Future<void> _load(bool following, {bool force = false}) async {
    if (_loading.contains(following)) return;
    if (!force && _cache.containsKey(following)) return;
    setState(() {
      _loading.add(following);
      _errors[following] = null;
    });
    try {
      final list = await AppScope.read(context)
          .repo
          .followList(widget.code, following: following);
      if (!mounted) return;
      setState(() => _cache[following] = list);
    } catch (e) {
      if (!mounted) return;
      setState(() => _errors[following] = e);
    } finally {
      if (mounted) setState(() => _loading.remove(following));
    }
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: _twoTabs ? 2 : 1,
        initialIndex: _twoTabs && widget.startWithFollowing ? 1 : 0,
        child: Scaffold(
          backgroundColor: C.obsidian,
          body: SafeArea(
            bottom: false,
            child: Column(
              children: [
                TopBar(title: widget.title, subtitle: widget.code),
                if (_twoTabs)
                  TabBar(
                  indicatorColor: C.champagne,
                  indicatorWeight: 2,
                  dividerColor: C.hairline,
                  labelColor: C.offWhite,
                  unselectedLabelColor: C.muted,
                  labelStyle: T.statusLabel.copyWith(fontSize: 10.5, fontWeight: FontWeight.w700),
                  unselectedLabelStyle: T.statusLabel.copyWith(fontSize: 10.5),
                  onTap: (i) => _load(i == 1),
                  tabs: const [
                    Tab(height: 42, text: 'OBUNACHILAR'),
                    Tab(height: 42, text: 'OBUNALAR'),
                  ],
                  )
                else
                  Padding(
                    padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, S.x4),
                    child: Eyebrow(tr('Obunachilar')),
                  ),
                Expanded(
                  child: TabBarView(
                    children: _twoTabs ? [_tab(false), _tab(true)] : [_tab(false)],
                  ),
                ),
              ],
            ),
          ),
        ),
      );

  Widget _tab(bool following) => AsyncView<List<FollowEntry>>(
        loading: _loading.contains(following),
        error: _errors[following],
        data: _cache[following],
        onRetry: () => _load(following, force: true),
        isEmpty: (d) => d.isEmpty,
        emptyMessage: following ? tr('Hali hech kimga obuna emas.') : tr('Hali obunachi yo‘q.'),
        skeleton: ListView(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          children: const [SkeletonRow(), SkeletonRow(), SkeletonRow(), SkeletonRow()],
        ),
        builder: (data) => ListView.separated(
          padding: const EdgeInsets.fromLTRB(S.gutter, S.x12, S.gutter, S.x32),
          itemCount: data.length,
          separatorBuilder: (_, __) => const SizedBox(height: S.x8),
          itemBuilder: (_, i) => _Row(entry: data[i]),
        ),
      );
}

class _Row extends StatelessWidget {
  const _Row({required this.entry});
  final FollowEntry entry;

  @override
  Widget build(BuildContext context) => Press(
        onTap: () => push(
          context,
          (_) => entry.isCompany
              ? ProfileScreen(companyId: entry.code)
              : ProfileScreen(code: entry.code),
        ),
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          shadow: E.e1,
          child: Row(
            children: [
              Avatar(url: entry.avatarUrl, name: entry.name, size: 44),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
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
                    const SizedBox(height: 2),
                    Text(
                      // Kompaniya nomidan obuna bo'lgan bo'lsa, orqasidagi
                      // odam ham ko'rinadi.
                      entry.isCompany && entry.personName.isNotEmpty
                          ? '${entry.code} · ${entry.personName}'
                          : entry.code,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              if (entry.isCompany)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(5),
                    border: Border.all(color: C.hairline),
                  ),
                  child: Text(tr('Biznes').toUpperCase(), style: T.statusLabel.copyWith(color: C.ash)),
                ),
            ],
          ),
        ),
      );
}
