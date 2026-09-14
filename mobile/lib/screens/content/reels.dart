import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/video_view.dart';
import '../../design/feedback.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../identity/profile_screen.dart';
import '../shell.dart';

/// REELS — butun platformadagi post va istoryalar bitta oqimda.
///
/// NIMA UCHUN ALOHIDA TAB: qolgan uch tab SIZNIKI haqida — o'z
/// profilingiz, o'z ID'laringiz, qidiruv. Bu esa BOSHQALARNIKI:
/// odam hech narsa qidirmasdan, hech kimga obuna bo'lmasdan ham
/// ilovada ko'radigan narsa topadi. Yangi foydalanuvchida bosh
/// sahifadagi istorya lentasi doim bo'sh bo'lardi (u faqat obuna
/// bo'lganlarni ko'rsatadi) — bu tab shu bo'shliqni yopadi.
///
/// TIK OQIM, GORIZONTAL EMAS: har yozuv butun ekranni egallaydi va
/// barmoq bilan yuqoriga suriladi. Bu odamga tanish harakat va
/// rasmni eng katta o'lchamda ko'rsatadi.
class ReelsScreen extends StatefulWidget {
  const ReelsScreen({super.key});

  @override
  State<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends State<ReelsScreen> {
  final _pages = PageController();

  List<FeedEntry>? _items;
  Object? _error;
  bool _loading = true;
  bool _hasMore = false;
  bool _loadingMore = false;
  int _page = 1;

  /// Ko'rinib turgan kadr. Faqat shu kadrdagi video o'ynaydi.
  int _current = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await AppScope.read(context).repo.feed();
      if (!mounted) return;
      setState(() {
        _items = res.items;
        _hasMore = res.hasMore;
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

  /// KEYINGI SAHIFA — oxiriga YETMASDAN oldin so'raladi.
  ///
  /// Oxirgi kadrga kelib kutib turish "oqim tugadi" degan taassurot
  /// qoldirardi. Ikki kadr qolganda so'ralsa, odam uzilishni
  /// sezmaydi.
  Future<void> _more() async {
    if (_loadingMore || !_hasMore) return;
    _loadingMore = true;
    try {
      final res = await AppScope.read(context).repo.feed(page: _page + 1);
      if (!mounted) return;
      setState(() {
        _items = [...?_items, ...res.items];
        _hasMore = res.hasMore;
        _page += 1;
      });
    } catch (_) {
      // Jimgina: oqim ishlab turibdi, keyingi surishda qayta
      // urinadi. Xato oynasi bu yerda halaqit berardi.
    } finally {
      _loadingMore = false;
    }
  }

  Future<void> _like(int index) async {
    final list = _items;
    if (list == null) return;
    final item = list[index];
    if (!item.likeable) return;

    // Bosilishi BILAN ko'rinadi, keyin server tasdiqlaydi. Aks
    // holda yurak yarim soniya kechikib yonardi.
    setState(() {
      list[index] = item.copyWith(
        liked: !item.liked,
        likeCount: item.likeCount + (item.liked ? -1 : 1),
      );
    });
    successHaptic();

    try {
      final repo = AppScope.read(context).repo;
      final res = item.isStory
          ? await repo.likeStory(item.id)
          : await repo.likePost(item.id);
      if (!mounted) return;
      // HAQIQAT SERVERDA: mijozdagi taxmin ustiga yoziladi.
      setState(() => list[index] = item.copyWith(liked: res.liked, likeCount: res.count));
    } catch (_) {
      if (!mounted) return;
      setState(() => list[index] = item);
    }
  }

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: C.backdrop,
        child: Stack(
          children: [
            Positioned.fill(child: _feed(context)),
            // QAYTISH TUGMASI.
            //
            // Reels — ILDIZ ekran: uning ustida `Navigator` da hech
            // narsa yo'q, ya'ni "orqaga" qiladigan joyi yo'q va
            // odam tik oqim ichida qamalib qolgandek his qilardi.
            // Egasi shuni so'radi. Tugma Android'ning orqaga
            // tugmasi bilan BIR XIL ishni bajaradi — bosh sahifaga
            // qaytaradi.
            //
            // Tarkib ustida turgani uchun ORQASIDA quyuq doira
            // bor: och rangli kadrda oq strelka yo'qolib ketardi.
            Positioned(
              top: MediaQuery.paddingOf(context).top + S.x8,
              left: S.x8,
              child: Press(
                haptic: true,
                onTap: () => ShellScope.maybeOf(context)?.goHome(),
                child: Container(
                  padding: const EdgeInsets.all(S.x12),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: C.backdrop.withValues(alpha: .45),
                  ),
                  child: NIcon(Ico.chevronLeft, size: 22, color: C.offWhite),
                ),
              ),
            ),
          ],
        ),
      );

  Widget _feed(BuildContext context) => AsyncView<List<FeedEntry>>(
          loading: _loading,
          error: _error,
          data: _items,
          onRetry: _load,
          skeleton: const Center(child: Spinner(size: 22)),
          builder: (data) {
            if (data.isEmpty) {
              return SafeArea(
                child: RefreshIndicator(
                  onRefresh: _load,
                  color: C.champagne,
                  backgroundColor: C.slate,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 120),
                      EmptyState(
                        tr('Hali hech kim post yoki story joylamagan. '
                            'Birinchi bo‘ling.'),
                        title: tr('Lenta bo‘sh'),
                        icon: Ico.play,
                      ),
                    ],
                  ),
                ),
              );
            }
            return PageView.builder(
              controller: _pages,
              scrollDirection: Axis.vertical,
              itemCount: data.length,
              onPageChanged: (i) {
                setState(() => _current = i);
                if (i >= data.length - 2) _more();
              },
              itemBuilder: (context, i) => _Slide(
                entry: data[i],
                active: i == _current,
                onLike: () => _like(i),
              ),
            );
          },
      );
}

/// Bitta kadr — butun ekran rasm va uning ustida ma'lumot.
class _Slide extends StatelessWidget {
  const _Slide({required this.entry, required this.onLike, this.active = false});

  final FeedEntry entry;
  final VoidCallback onLike;

  /// Shu kadr ekranda turibdimi — videoni o'ynatish shartisi.
  final bool active;

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final dpr = MediaQuery.devicePixelRatioOf(context);

    return Stack(
      fit: StackFit.expand,
      children: [
        // RASM TO'LIQ KO'RINADI, QIRQILMAYDI.
        //
        // Ilgari bu yerda `BoxFit.cover` turardi: kadr tik (9:19),
        // lentadagi rasmlarning ko'pi esa yotiq yoki kvadrat.
        // `cover` ularni ekranga sig'dirish uchun KATTALASHTIRIB,
        // chetini qirqib tashlardi — egasi shuni xabar qildi:
        // "reelsda rasmlar katta bo'lib ketyapti". Afishaning yozuvi
        // ham, mahsulotning o'zi ham kadrdan chiqib ketardi.
        //
        // Endi `contain`: rasm butunligicha ko'rinadi. Yon tomonda
        // qoladigan bo'shliqni esa O'SHA rasmning qoraytirilgan va
        // xiralashtirilgan nusxasi to'ldiradi — qora chiziq
        // qolmaydi va ko'z rasmning o'zida qoladi.
        _Backdrop(url: entry.imageUrl, active: active, size: size, dpr: dpr),
        if ((entry.videoUrl ?? '').isNotEmpty)
          VideoView(
            url: entry.videoUrl!,
            poster: entry.imageUrl,
            fit: BoxFit.contain,
            active: active,
          )
        else
          NetImage(
            entry.imageUrl,
            radius: 0,
            fit: BoxFit.contain,
            // `cacheWidth` — ekran kengligi: undan kattaroq
            // dekodlash xotirani behuda yeydi va tik oqimda bu
            // darhol sezilardi.
            cacheWidth: size.width.round(),
            slotLabel: '',
          ),

        // MATN O'QILSIN: rasm och bo'lsa oq yozuv yo'qolardi.
        // Pastdan yuqoriga qorayadigan parda faqat matn turgan
        // joyni qoplaydi, rasmning o'zini emas.
        Positioned(
          left: 0, right: 0, bottom: 0,
          child: IgnorePointer(
            child: Container(
              height: 260,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    C.backdrop.withValues(alpha: .92),
                    C.backdrop.withValues(alpha: .55),
                    C.backdrop.withValues(alpha: 0),
                  ],
                ),
              ),
            ),
          ),
        ),

        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x16),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(child: _Author(entry: entry)),
                    if (entry.likeable) ...[
                      const SizedBox(width: S.x12),
                      _Like(
                        liked: entry.liked,
                        count: entry.likeCount,
                        onTap: onLike,
                      ),
                    ],
                  ],
                ),
                if (entry.caption.isNotEmpty) ...[
                  const SizedBox(height: S.x12),
                  Text(
                    entry.caption,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: T.body.copyWith(color: C.offWhite),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// ORQA FON — o'sha rasmning qoraytirilgan nusxasi.
///
/// NIMA UCHUN XIRALIK FAQAT FAOL KADRDA: `PageView` qo'shni
/// kadrlarni oldindan quradi, ya'ni bir vaqtda uchta fon bo'ladi.
/// Xiralik (`ImageFilter.blur`) — GPU uchun eng qimmat amallardan
/// biri va uchtasi birga arzon telefonda oqimni sekinlashtirardi.
/// Ko'rinmayotgan kadrga esa u umuman kerak emas.
class _Backdrop extends StatelessWidget {
  const _Backdrop({
    required this.url,
    required this.active,
    required this.size,
    required this.dpr,
  });

  final String? url;
  final bool active;
  final Size size;
  final double dpr;

  @override
  Widget build(BuildContext context) {
    final u = url ?? '';
    if (u.trim().isEmpty) return ColoredBox(color: C.backdrop);
    // Fon xira — ya'ni katta o'lchamda dekodlashning ma'nosi yo'q.
    // Ekran kengligining chorakda biri yetarli va bu xotirani
    // to'rt baravar tejaydi.
    final image = NetImage(
      u,
      radius: 0,
      fit: BoxFit.cover,
      cacheWidth: (size.width / 4).round(),
      slotLabel: '',
    );
    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: C.backdrop),
        if (active)
          ImageFiltered(
            imageFilter: ImageFilter.blur(sigmaX: 28, sigmaY: 28),
            child: image,
          )
        else
          image,
        // Qoraytirish — aks holda fon oldingi rasm bilan raqobat
        // qilib, ko'zni chalg'itardi.
        ColoredBox(color: C.backdrop.withValues(alpha: .68)),
      ],
    );
  }
}

class _Author extends StatelessWidget {
  const _Author({required this.entry});
  final FeedEntry entry;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        // Muallif bosilsa — profili. Lentaning butun ma'nosi shu:
        // yoqqan kontentdan odamga borish.
        onTap: () => push(
          context,
          (_) => entry.isCompany
              ? ProfileScreen(companyId: entry.code)
              : ProfileScreen(code: entry.code),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 38,
              height: 38,
              child: ClipOval(
                child: NetImage(entry.avatarUrl, radius: 999, cacheWidth: 114),
              ),
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    entry.name.isEmpty ? entry.code : entry.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle.copyWith(fontSize: 15.5),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(entry.code, style: T.code.copyWith(fontSize: 12.5)),
                      // ISTORYA EKANI AYTILADI: u 24 soatdan keyin
                      // yo'qoladi va odam nega topolmayotganini
                      // bilishi kerak.
                      if (entry.isStory) ...[
                        const SizedBox(width: 6),
                        Text(tr('Stories'),
                            style: T.statusLabel
                                .copyWith(fontSize: 11, color: C.champagne)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

class _Like extends StatelessWidget {
  const _Like({required this.liked, required this.count, required this.onTap});

  final bool liked;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        scale: .88,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            NIcon(Ico.heart,
                size: 26, color: liked ? C.signal : C.offWhite, filled: liked),
            const SizedBox(height: 3),
            Text('$count', style: T.caption.copyWith(fontSize: 12.5)),
          ],
        ),
      );
}
