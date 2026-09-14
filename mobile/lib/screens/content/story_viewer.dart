import 'dart:async';
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/surface.dart';
import '../home/home.dart' show LikeButton;
import '../../l10n/dates.dart';
import '../../design/components/buttons.dart';
import '../../design/components/media.dart';
import '../../design/components/video_view.dart';
import '../../design/components/sheet.dart';
import 'report_sheet.dart';
import '../../design/components/states.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../../l10n/strings.dart';

/// STORY KO'RUVCHI.
///
/// Handoff xatti-harakati:
///   - yuqorida segmentli progress, har rasmga 5 soniya;
///   - o'ngga tegish — oldinga, chapga — orqaga;
///   - UZOQ BOSISH — pauza (o'qish uchun);
///   - pastga surish — yopish.
class StoryViewerScreen extends StatefulWidget {
  const StoryViewerScreen({
    super.key,
    required this.code,
    this.isCompany = false,
    this.owned,
  });

  /// Chaqiruvchi EGALIKNI ANIQ BILSA — shu yerda aytadi.
  ///
  /// Profil ekrani buni biladi: Profile tabi faol shaxsni beradi,
  /// ya'ni u ta'rifi bo'yicha egasiniki. Ro'yxatdan qidirish esa
  /// taxminiy — ro'yxat hali yuklanmagan bo'lishi mumkin va o'shanda
  /// odam O'Z story'sida o'chirish tugmasini ko'rmasdi.
  final bool? owned;

  final String code;
  final bool isCompany;

  @override
  State<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends State<StoryViewerScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progress = AnimationController(
    vsync: this,
    duration: M.storySegment,
  )..addStatusListener((s) {
      if (s == AnimationStatus.completed) _next();
    });

  /// Video istorya uchun eng uzun segment.
  static const _maxSegment = Duration(seconds: 60);

  List<Post> _stories = const [];
  int _index = 0;

  /// Ayni damda serverga ketayotgan yurak so'rovi.
  final _liking = <String>{};

  /// Ko'rish hisobi YUBORILGAN istoryalar — bitta ochilishda bir
  /// marta. Aks holda har `setState` da qayta yuborilardi.
  final _viewed = <String>{};
  bool _loading = true;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = AppScope.read(context).repo;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = widget.isCompany
          ? await repo.companyStories(widget.code)
          : await repo.recordStories(widget.code);
      if (!mounted) return;
      setState(() {
        _stories = list;
        _loading = false;
      });
      if (list.isNotEmpty) {
        _progress.forward(from: 0);
        _markViewed();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  /// VIDEO UZUNLIGI — progress chizig'i shunga moslanadi.
  ///
  /// Ilgari har istorya qat'iy 5 soniya edi (`M.storySegment`).
  /// Video ishlay boshlagach bu darhol sezildi: uzunroq video
  /// beshinchi soniyada uzilib, keyingisiga o'tib ketardi.
  ///
  /// YUQORI CHEGARA bor: juda uzun video butun ko'ruvchini
  /// bloklab qo'ymasin — odam baribir tegib oldinga o'ta oladi,
  /// lekin o'zi ham oxiri kelishini bilishi kerak.
  void _videoDuration(Duration d) {
    if (!mounted) return;
    final capped = d > _maxSegment ? _maxSegment : d;
    if (capped <= Duration.zero) return;
    setState(() => _progress.duration = capped);
    _progress.forward(from: 0);
  }

  /// KO'RILDI deb belgilash. Natija kutilmaydi — ekran bundan
  /// to'xtab turmasligi kerak. Xatosi ham yutiladi: hisob
  /// yozilmagani uchun istoryani ko'rsatmaslik mantiqsiz.
  void _markViewed() {
    if (_index >= _stories.length) return;
    final story = _stories[_index];
    final id = int.tryParse(story.id);
    if (id == null || !_viewed.add(story.id)) return;
    AppScope.read(context).repo.viewStory(id).then((count) {
      if (!mounted) return;
      // Egasi o'z istoryasini ochganda raqam DARHOL to'g'ri
      // ko'rinsin — qayta yuklashni kutmasdan.
      setState(() {
        final i = _stories.indexWhere((p) => p.id == story.id);
        if (i >= 0) _stories[i] = _stories[i].copyWith(views: count);
      });
    }).catchError((_) {});
  }

  /// O'Z ISTORYASINI O'CHIRISH — 24 soat tugashini kutmasdan.
  ///
  /// Ilgari ilovada bunday yo'l yo'q edi: xato qo'yilgan istoryani
  /// faqat saytdan yoki bir sutkani kutib olib tashlash mumkin edi.
  Future<void> _delete() async {
    if (_index >= _stories.length) return;
    final story = _stories[_index];
    final id = int.tryParse(story.id);
    if (id == null) return;

    _progress.stop();
    final sure = await showSheet<bool>(
      context,
      title: tr('Storyni o‘chirish'),
      subtitle: tr('Bu amalni qaytarib bo‘lmaydi.'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
        child: Column(
          children: [
            PrimaryButton(tr('O‘chirish'),
                onTap: () => Navigator.of(context).pop(true)),
            const SizedBox(height: S.x8),
            SecondaryButton(tr('Bekor qilish'),
                onTap: () => Navigator.of(context).pop(false)),
          ],
        ),
      ),
    );
    if (!mounted) return;
    if (sure != true) {
      _progress.forward();
      return;
    }

    final repo = AppScope.read(context).repo;
    try {
      widget.isCompany
          ? await repo.deleteCompanyStory(widget.code, id)
          : await repo.deleteStory(id);
      if (!mounted) return;
      successHaptic();
      final left = _stories.where((p) => p.id != story.id).toList();
      // OXIRGISI O'CHIRILSA — ko'ruvchining ma'nosi qolmaydi.
      if (left.isEmpty) {
        Navigator.of(context).maybePop();
        return;
      }
      setState(() {
        _stories = left;
        if (_index >= left.length) _index = left.length - 1;
        _progress.duration = M.storySegment;
      });
      _progress.forward(from: 0);
    } catch (e) {
      if (!mounted) return;
      await showError(context, humanError(e));
      if (mounted) _progress.forward();
    }
  }

  /// SHIKOYAT. Varaq ochilguncha progress TO'XTAYDI — aks holda
  /// odam sabab tanlayotganda istorya o'zi keyingisiga o'tib
  /// ketardi va shikoyat boshqa yozuvga ketardi.
  /// "⋯" MENYUSI — begona story'da. Ilgari bu yerda bayroq
  /// turardi; izohi `report_sheet.dart` da.
  ///
  /// Menyu ochilganda taymer TO'XTAYDI: aks holda odam sabab
  /// tanlab ulgurmay, story keyingisiga o'tib ketardi.
  Future<void> _more() async {
    if (_index >= _stories.length) return;
    final story = _stories[_index];
    _progress.stop();
    await showContentMenu(
      context,
      title: story.authorName.isEmpty ? widget.code : story.authorName,
      targetKind: widget.isCompany ? 'company_post' : 'story',
      targetId: story.id,
      ownerCode: widget.code,
    );
    if (mounted) _progress.forward();
  }

  /// YURAK. Bosilishi bilan ko'rinadi, keyin server tasdiqlaydi —
  /// Reels'dagi bilan bir xil xulq.
  Future<void> _like() async {
    if (_index >= _stories.length) return;
    final story = _stories[_index];
    final id = int.tryParse(story.id);
    if (id == null || !_liking.add(story.id)) return;

    final before = story;
    setState(() {
      _stories[_index] = story.copyWith(
        liked: !story.liked,
        likes: story.likes + (story.liked ? -1 : 1),
      );
    });
    successHaptic();

    try {
      final res = await AppScope.read(context).repo.likeStory(id);
      if (!mounted) return;
      setState(() {
        final i = _stories.indexWhere((p) => p.id == story.id);
        if (i >= 0) _stories[i] = before.copyWith(liked: res.liked, likes: res.count);
      });
    } catch (_) {
      if (!mounted) return;
      // HAQIQAT SERVERDA: tasdiq kelmasa eski holat qaytariladi.
      setState(() {
        final i = _stories.indexWhere((p) => p.id == story.id);
        if (i >= 0) _stories[i] = before;
      });
    } finally {
      _liking.remove(story.id);
    }
  }

  void _next() {
    if (_index >= _stories.length - 1) {
      Navigator.of(context).maybePop();
      return;
    }
    setState(() {
      _index++;
      // Keyingi istorya rasm bo'lsa — yana standart 5 soniya.
      // Video bo'lsa `_videoDuration` uni qayta sozlaydi.
      _progress.duration = M.storySegment;
    });
    _progress.forward(from: 0);
    _markViewed();
  }

  void _prev() {
    if (_index == 0) {
      _progress.forward(from: 0);
      return;
    }
    setState(() {
      _index--;
      _progress.duration = M.storySegment;
    });
    _progress.forward(from: 0);
    _markViewed();
  }

  @override
  void dispose() {
    _progress.dispose();
    super.dispose();
  }

  /// Bu istorya MENIKIMI — ko'rishlar soni faqat egasiga.
  bool get _isOwner {
    if (widget.owned != null) return widget.owned!;
    final state = AppScope.read(context);
    return widget.isCompany
        ? state.companies.any((c) => c.id.toUpperCase() == widget.code.toUpperCase())
        : state.ownsRecord(widget.code);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return ColoredBox(
        color: C.backdrop,
        child: const Center(child: Spinner()),
      );
    }
    if (_error != null || _stories.isEmpty) {
      return ColoredBox(
        color: C.backdrop,
        child: SafeArea(
          child: Center(
            child: _error != null
                ? ErrorState(humanError(_error), onRetry: _load)
                : EmptyState(
                    tr('Story 24 soat turadi va keyin o‘zi o‘chadi.'),
                    title: tr('Story yo‘q'),
                    icon: Ico.camera,
                  ),
          ),
        ),
      );
    }

    final story = _stories[_index];
    return ColoredBox(
      color: C.backdrop,
      child: GestureDetector(
        onTapUp: (d) {
          final w = MediaQuery.sizeOf(context).width;
          if (d.localPosition.dx < w * .32) {
            _prev();
          } else {
            _next();
          }
        },
        onLongPressStart: (_) => _progress.stop(),
        onLongPressEnd: (_) => _progress.forward(),
        onVerticalDragEnd: (d) {
          if ((d.primaryVelocity ?? 0) > 220) Navigator.of(context).maybePop();
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Story — to'liq ekran, shuning uchun chegara ekran eni
            // bo'yicha (NetImage ichidagi standart) qoladi: bundan
            // kattaroq dekodlash ko'zga ko'rinmaydi, lekin xotirani
            // yeydi.
            // VIDEO YOKI RASM.
            //
            // Ilgari bu yerda faqat `NetImage` turardi va VIDEO
            // istorya QORA EKRAN bo'lib ochilardi: server
            // `videoUrl` ni qaytaradi, `imageUrl` esa bo'sh bo'ladi,
            // ya'ni rasm ko'rsatgich ko'rsatadigan narsa topmasdi.
            if ((story.videoUrl ?? '').isNotEmpty)
              VideoView(
                // Kalit MUHIM: `PageView` emas, oddiy almashish —
                // kalitsiz Flutter eski holatni qayta ishlatib,
                // keyingi istoryada eski videoni ko'rsatib qo'yardi.
                key: ValueKey(story.id),
                url: story.videoUrl!,
                poster: story.images.isEmpty ? null : story.images.first,
                fit: BoxFit.contain,
                loop: false,
                onDuration: _videoDuration,
              )
            else
              NetImage(
                story.images.isEmpty ? null : story.images.first,
                radius: 0,
                fit: BoxFit.contain
              ),
            // Pastki scrim — izoh va tugmalar har qanday rasm
            // ustida o'qilsin.
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 260,
              child: DecoratedBox(
                decoration: BoxDecoration(gradient: C.bottomScrim),
              ),
            ),
            // Yuqori gradient — progress va muallif qatori uchun.
            const Positioned(
              top: 0, left: 0, right: 0, height: 160,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter, end: Alignment.bottomCenter,
                    colors: [Color(0xB3000000), Color(0x00000000)],
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.x12, vertical: S.x8),
                    child: Row(
                      children: [
                        for (var i = 0; i < _stories.length; i++) ...[
                          if (i > 0) const SizedBox(width: 3),
                          Expanded(
                            child: SizedBox(
                              height: 2.5,
                              child: AnimatedBuilder(
                                animation: _progress,
                                builder: (_, __) => _Segment(
                                  fill: i < _index ? 1 : (i == _index ? _progress.value : 0),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.x16, vertical: S.x8),
                    child: Row(
                      children: [
                        Avatar(url: story.authorAvatar, name: story.authorName, size: 32),
                        const SizedBox(width: S.x8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                story.authorName.isEmpty
                                    ? widget.code
                                    : story.authorName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: T.cardTitle.copyWith(fontSize: 14.5),
                              ),
                              const SizedBox(height: 1),
                              Text(
                                ago(story.createdAt).toUpperCase(),
                                style: T.meta.copyWith(fontSize: 9.5),
                              ),
                            ],
                          ),
                        ),
                        // EGADA — o'chirish, mehmonda — "⋯"
                        // menyusi (ichida shikoyat). O'z story'siga
                        // shikoyat qilish ma'nosiz.
                        RoundButton(
                          _isOwner ? Ico.trash : Ico.more,
                          size: 38,
                          iconSize: 17,
                          glass: true,
                          onTap: _isOwner ? _delete : _more,
                        ),
                        const SizedBox(width: S.x8),
                        RoundButton(
                          Ico.close,
                          size: 38,
                          iconSize: 17,
                          glass: true,
                          onTap: () => Navigator.of(context).maybePop(),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  if (story.caption.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
                      child: Text(
                        story.caption,
                        style: T.body.copyWith(color: C.ink),
                      ),
                    ),
                  // YURAK VA KO'RISHLAR.
                  //
                  // Ilgari istoryani ko'rish mumkin edi, lekin unga
                  // JAVOB BERIB bo'lmasdi: yurak tugmasi yo'q edi,
                  // egasi esa "nechta odam ko'rdi" ni bilolmasdi.
                  // Server ikkalasini ham beradi.
                  Padding(
                    padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x20),
                    child: Row(
                      children: [
                        // Yurak 220 ms spring bilan 1 → 1.25 → 1
                        // bo'ladi — dizayn shuni aniq belgilaydi.
                        LikeButton(
                          liked: story.liked,
                          count: story.likes,
                          onTap: _like,
                          size: 26,
                          color: C.ink,
                        ),
                        const Spacer(),
                        // KO'RISHLAR — FAQAT EGASIGA.
                        //
                        // Begona odamga "sizdan oldin 40 kishi
                        // ko'rgan" deyishning ma'nosi yo'q va
                        // Instagram ham buni faqat egasiga
                        // ko'rsatadi. Egasi uchun esa bu istorya
                        // qo'yishning asosiy o'lchovi.
                        // KO'RISHLAR — FAQAT EGASIGA, va qolgan
                        // vaqt bilan birga. Server ko'ruvchilar
                        // RO'YXATINI bermaydi, faqat sonini —
                        // shuning uchun avatarlar chizilmaydi.
                        if (_isOwner) ...[
                          StatusChip(
                            remaining(
                              story.createdAt?.add(const Duration(hours: 24)),
                            ),
                            tone: StatusTone.neutral,
                          ),
                          const SizedBox(width: S.x8),
                          NIcon(Ico.eye, size: 18, color: C.ink2),
                          const SizedBox(width: 6),
                          Text(
                            '${story.views}',
                            style: T.meta.copyWith(color: C.ink2),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({required this.fill});
  final double fill;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(2),
        child: Stack(
          children: [
            const Positioned.fill(child: ColoredBox(color: Color(0x4DFFFFFF))),
            FractionallySizedBox(
              widthFactor: fill.clamp(0.0, 1.0),
              child: const ColoredBox(color: C.ink),
            ),
          ],
        ),
      );
}
