import 'package:cached_network_image/cached_network_image.dart'
    show CachedNetworkImageProvider;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/top_bar.dart';
import '../../design/components/video_view.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../home/home.dart' show CommentButton, LikeButton;
import 'comments_sheet.dart';
import 'report_sheet.dart';

/// POST TAFSILOTI (dizayn 5d).
///
/// TARTIB: muallif → media → izoh → yurak va ko'rishlar. Media
/// ekranning markazi, shuning uchun u ustida hech qanday boshqaruv
/// turmaydi: "⋯" tepa panelda, yurak esa pastda.
///
/// IZOHLAR — yurakning yonida. Server `/api/comments/:kind/:id`
/// beradi; soni SHU EKRAN OCHILGANDA olinadi (postning o'zi bilan
/// kelmaydi, chunki post ro'yxatlari izohlarni sanamaydi). Kelguncha
/// tugma soni "0" bo'lib turadi va bosilsa baribir ochiladi — bo'sh
/// raqam odamni to'xtatib qo'ymasligi kerak.
class PostDetailScreen extends StatefulWidget {
  const PostDetailScreen({
    super.key,
    required this.post,
    this.canDelete = false,
    this.commentKind = 'post',
  });

  final Post post;

  /// Izoh jadvalidagi tur: shaxsiy post uchun `post`, kompaniya
  /// posti uchun `company_post`. Ikkalasining id'lari bir-biriga
  /// bog'liq emas, shuning uchun turni chaqiruvchi beradi.
  final String commentKind;

  /// Postni OCHGAN ekran uni "meniki" deb biladimi (o'z profilidagi
  /// to'rdan ochilgan). Shu bayroq "⋯" menyusiga `owned` bo'lib
  /// uzatiladi: menyuda "O'chirish" chiqadi va "Shikoyat qilish"
  /// yo'qoladi.
  final bool canDelete;

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  late bool _liked = widget.post.liked;
  late int _likes = widget.post.likes;
  int _comments = 0;
  bool _countLoaded = false;

  int get _postId => int.tryParse(widget.post.id) ?? 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_countLoaded) return;
    _countLoaded = true;
    _loadCommentCount();
  }

  /// IZOHLAR SONI — faqat ko'rsatish uchun.
  ///
  /// Xatosi YUTILADI: izohlar sanalmagani uchun postni ko'rsatmaslik
  /// mantiqsiz bo'lardi. Bunday holatda tugma "0" bilan turadi va
  /// bosilganda ro'yxat baribir ochiladi.
  Future<void> _loadCommentCount() async {
    try {
      final r = await AppScope.read(context).repo.comments(widget.commentKind, _postId);
      if (!mounted) return;
      setState(() => _comments = r.total);
    } catch (_) {
      // Jim: yuqoridagi izohga qarang.
    }
  }

  Future<void> _openComments() async {
    final total = await showCommentsSheet(
      context,
      targetKind: widget.commentKind,
      targetId: _postId,
      initialCount: _comments,
    );
    if (!mounted || total == null) return;
    setState(() => _comments = total);
  }

  /// YURAK — OPTIMISTIK.
  ///
  /// Bosilishi bilan to'ladi, so'rov fonda ketadi va server javobi
  /// ustiga yoziladi. Xato bo'lsa avvalgi holat qaytariladi:
  /// raqamni mijoz o'zi sanab qolsa, ikkita qurilmada ikki xil son
  /// chiqardi.
  Future<void> _toggleLike() async {
    final repo = AppScope.read(context).repo;
    final wasLiked = _liked;
    final wasLikes = _likes;
    setState(() {
      _liked = !wasLiked;
      _likes = wasLikes + (wasLiked ? -1 : 1);
    });
    try {
      final r = widget.commentKind == 'company_post'
          ? await repo.likeCompanyPost(widget.post.authorCode, _postId)
          : await repo.likePost(_postId);
      if (!mounted) return;
      setState(() {
        _liked = r.liked;
        _likes = r.count;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _liked = wasLiked;
        _likes = wasLikes;
      });
    }
  }

  /// "⋯" — egalikka qarab o'zgaradigan menyu (`report_sheet.dart`).
  ///
  /// EGALIK IKKI MANBADAN. `canDelete` — chaqiruvchi ekranning
  /// bilgani, `_isOwner` — ma'lumotdan chiqarilgani (lentadan
  /// ochilgan post). Ikkinchisisiz odam O'Z postini lentadan ochsa
  /// menyuda "Shikoyat qilish" chiqardi.
  Future<void> _menu() async {
    final p = widget.post;
    await showContentMenu(
      context,
      title: p.authorName.isEmpty ? tr('Post') : p.authorName,
      targetKind: widget.commentKind,
      targetId: p.id,
      ownerCode: p.authorCode,
      owned: widget.canDelete || _isOwner(context, p),
      // O'chirilgan postning tafsiloti ochiq qolishi mumkin emas —
      // ekran yopiladi va ro'yxat ekrani o'zini yangilaydi.
      onDeleted: () => Navigator.of(context).pop(true),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.post;

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(
              title: tr('Post'),
              trailing: RoundButton(Ico.more, onTap: _menu),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x8,
                  S.gutter,
                  S.x32,
                ),
                children: [
                  _AuthorRow(post: p),
                  const SizedBox(height: S.x16),
                  _Media(post: p),
                  if (p.caption.trim().isNotEmpty) ...[
                    const SizedBox(height: S.x16),
                    Text(p.caption, style: T.body),
                  ],
                  const SizedBox(height: S.x20),
                  Row(
                    children: [
                      LikeButton(
                        liked: _liked,
                        count: _likes,
                        onTap: _toggleLike,
                      ),
                      const SizedBox(width: S.x20),
                      CommentButton(count: _comments, onTap: _openComments),
                      const SizedBox(width: S.x20),
                      NIcon(Ico.eye, size: 17, color: C.ink2),
                      const SizedBox(width: 7),
                      Text(
                        compact(p.views),
                        style: T.meta.copyWith(fontSize: 12.5, color: C.ink2),
                      ),
                    ],
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

/// Post MENIKIMI — shikoyat tugmasi faqat begonada chiqadi.
bool _isOwner(BuildContext context, Post p) {
  final code = p.authorCode.trim();
  if (code.isEmpty) return false;
  final state = AppScope.read(context);
  return state.ownsRecord(code) ||
      state.companies.any((c) => c.id.toUpperCase() == code.toUpperCase());
}

// ─────────────────────────────────────────────────────────────
// MUALLIF
// ─────────────────────────────────────────────────────────────

class _AuthorRow extends StatelessWidget {
  const _AuthorRow({required this.post});

  final Post post;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Avatar(url: post.authorAvatar, name: post.authorName, size: 44),
          const SizedBox(width: S.x12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  post.authorName.isEmpty ? tr('Post') : post.authorName,
                  style: T.cardTitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (post.createdAt != null) ...[
                  const SizedBox(height: 3),
                  // Nisbiy vaqt — mono, KATTA HARF. Aniq sana
                  // lentada keraksiz: "4 SOAT" tezroq o'qiladi.
                  Text(
                    ago(post.createdAt).toUpperCase(),
                    style: T.meta.copyWith(fontSize: 10),
                  ),
                ],
              ],
            ),
          ),
        ],
      );
}

// ─────────────────────────────────────────────────────────────
// MEDIA
// ─────────────────────────────────────────────────────────────

/// POST MEDIASI — TABIIY NISBATDA.
///
/// NIMA UCHUN QAT'IY 4:5 EMAS: post kvadrat ham, bo'yiga ham,
/// eniga ham bo'lishi mumkin. Qat'iy ramka kengroq rasmning
/// chetlarini kesib tashlardi.
///
/// O'LCHAM KESHDAN O'QILADI: bu yerdagi provayder `NetImage`
/// ishlatadigani bilan bir xil (`CachedNetworkImageProvider`),
/// shuning uchun rasm IKKI MARTA yuklanmaydi — nisbat aniqlangach
/// o'sha kesh kadri chiziladi.
class _Media extends StatefulWidget {
  const _Media({required this.post});

  final Post post;

  @override
  State<_Media> createState() => _MediaState();
}

class _MediaState extends State<_Media> {
  /// Nisbat kelmaguncha — 4:5. Ilovada post media shu nisbatda
  /// tayyorlanadi, ya'ni ko'pchilik postda ramka umuman sakramaydi.
  static const double _fallback = 4 / 5;

  double _aspect = _fallback;
  int _page = 0;

  ImageStream? _stream;
  ImageStreamListener? _listener;

  String get _first =>
      widget.post.images.isEmpty ? '' : widget.post.images.first;

  @override
  void initState() {
    super.initState();
    _resolveAspect();
  }

  void _resolveAspect() {
    final url = _first.trim();
    if (url.isEmpty) return;
    final listener = ImageStreamListener((info, _) {
      if (!mounted) return;
      final w = info.image.width.toDouble();
      final h = info.image.height.toDouble();
      if (w <= 0 || h <= 0) return;
      setState(() {
        // Juda cho'zilgan rasm butun ekranni egallab olmasligi
        // kerak — chegara qo'yiladi.
        _aspect = (w / h).clamp(.5, 1.8);
      });
    });
    final stream = CachedNetworkImageProvider(url).resolve(
      ImageConfiguration.empty,
    );
    stream.addListener(listener);
    _stream = stream;
    _listener = listener;
  }

  @override
  void dispose() {
    if (_stream != null && _listener != null) {
      _stream!.removeListener(_listener!);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.post;
    final video = (p.videoUrl ?? '').trim();

    return AspectRatio(
      aspectRatio: _aspect,
      // VIDEO POST. Ilgari bu ekran faqat rasm ko'rsatardi: video
      // postda `images` bo'sh bo'ladi va joy bo'm-bo'sh chiqardi.
      child: video.isNotEmpty
          ? ClipRRect(
              borderRadius: BorderRadius.circular(R.card),
              child: VideoView(
                url: video,
                poster: _first.isEmpty ? null : _first,
              ),
            )
          : _Gallery(
              images: p.images.isEmpty ? const [''] : p.images,
              page: _page,
              onPage: (i) => setState(() => _page = i),
            ),
    );
  }
}

/// Bir nechta rasmli post — suriladigan galereya va "2 / 5"
/// hisoblagichi. Bitta rasmda hisoblagich umuman chizilmaydi.
class _Gallery extends StatelessWidget {
  const _Gallery({required this.images, required this.page, required this.onPage});

  final List<String> images;
  final int page;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) => Stack(
        children: [
          Positioned.fill(
            child: PageView.builder(
              itemCount: images.length,
              onPageChanged: onPage,
              itemBuilder: (_, i) => NetImage(
                images[i].isEmpty ? null : images[i],
                radius: R.card,
                slotIcon: Ico.image,
              ),
            ),
          ),
          if (images.length > 1)
            Positioned(
              right: S.x12,
              top: S.x12,
              child: _Counter(page: page, total: images.length),
            ),
        ],
      );
}

/// "2 / 5" — media ustidagi shisha yorliq.
class _Counter extends StatelessWidget {
  const _Counter({required this.page, required this.total});

  final int page;
  final int total;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: S.x8, vertical: 4),
        decoration: BoxDecoration(
          color: C.backdrop.withValues(alpha: .55),
          borderRadius: BorderRadius.circular(R.status),
          border: Border.all(color: C.onMedia3),
        ),
        child: Text(
          '${page + 1} / $total',
          style: T.statusLabel.copyWith(color: C.onMedia),
        ),
      );
}
