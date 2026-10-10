import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/errors/app_error.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import 'engagement.dart';
import 'image_viewer.dart';
import 'media_carousel.dart';
import 'media_frame.dart';
import 'moderation.dart';
import 'music_picker.dart' show MusicChip;
import 'pending_badge.dart';
import 'post_contact_bar.dart';
import 'time_ago.dart';
import '../../design/icons/nova_icons.dart';
import '../showcase/showcase_extras.dart';

/// LENTA KARTASI — LAYK, IZOH, ULASHISH VA OBUNA.
///
/// Ilgari bosh ekrandagi lenta 128px kenglikdagi gorizontal
/// "ko'rinish" kartalaridan iborat edi va ularda HECH QANDAY amal
/// yo'q edi: postni ochmasdan layk bosib bo'lmasdi, muallifga
/// obuna bo'lish uchun esa avval uning profiliga o'tish kerak
/// edi.
///
/// Endpointlarning hammasi serverda allaqachon bor edi.
class FeedCard extends ConsumerWidget {
  const FeedCard(
      {super.key, required this.post, this.activeVideo, this.onBlocked});

  /// Muallif "⋯" menyusidan bloklandi — lenta yangilansin.
  final VoidCallback? onBlocked;

  /// Lentadagi DOMINANT karta shumi.
  ///
  /// `null` — ko'rinishga bog'liq ijro o'chiq (masalan Kashfiyot
  /// ro'yxatida), odam o'zi bosadi.
  final bool? activeVideo;

  final Post post;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final l = L.of(context);

    final like = ref.watch(
      postLikesProvider.select(
        (m) => m[likeKey(post)] ?? (liked: post.liked, count: post.likes),
      ),
    );
    final mine = ref.watch(isMineProvider(post.code));
    // O'z postimda "Kuzatish" yo'q — obuna holati so'ralmaydi
    // (ilgari har o'z posti uchun `/api/follow-stats` ketardi).
    final following = (mine || post.code.isEmpty)
        ? false
        : ref.watch(followingOfProvider(post.code));

    final name = post.authorName.isEmpty ? post.code : post.authorName;
    final media = post.mediaUrls.isEmpty ? '' : post.mediaUrls.first;

    void openPost() => context.push(Routes.post(post.id, code: post.code, company: post.isCompany));

    /// Amal yiqilganda holat eskisiga qaytadi. Buni AYTISH kerak:
    /// jimgina orqaga sakragan yurak odamga "bosilmadi" emas,
    /// "ilova buzuq" bo'lib ko'rinadi.
    void reportIfFailed(AppError? e) {
      if (e == null || !context.mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(describeError(l, e))));
    }

    return FloatingSurface(
      solid: true,
      // Pastki hoshiya amallar qatorining ICHIDA (`_CardAction`): u
      // yerda u bosish maydonining shaffof qismi. Karta balandligi va
      // belgilar joyi o'zgarmaydi.
      padding: const EdgeInsets.fromLTRB(Gap.md, Gap.md, Gap.md, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Avatar(
                url: post.authorAvatar,
                initials: _initials(name),
                size: 38,
                onTap: post.code.isEmpty
                    ? null
                    : () => context.push(
                        Routes.author(post.code, company: post.isCompany)),
              ),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: GestureDetector(
                  onTap: post.code.isEmpty
                      ? null
                      : () => context.push(
                        Routes.author(post.code, company: post.isCompany)),
                  behavior: HitTestBehavior.opaque,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: t.text1,
                        ),
                      ),
                      // Kod va "Homiylik" belgisi bir qatorda.
                      //
                      // TO'LANGAN JOYLASHUV BELGISIZ QOLMAYDI.
                      // Ko'tarilgan kontent lentaning boshida
                      // turadi; agar u oddiy postdan farq qilmasa,
                      // bu yashirin reklama bo'lardi — odam nima
                      // uchun aynan shu post birinchi turganini
                      // bilmaydi.
                      Row(
                        children: [
                          if (post.code.isNotEmpty)
                            Flexible(
                              child: Text(
                                post.code,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppType.monoStyle(
                                    color: t.text3, size: 11),
                              ),
                            ),
                          if (post.featured) ...[
                            if (post.code.isNotEmpty)
                              const SizedBox(width: Gap.sm),
                            const _FeaturedBadge(),
                          ],
                          // VAQT — "2 soat oldin" (Instagram kabi).
                          // Usiz bugungi post bilan bir yillik post
                          // lentada farq qilmasdi.
                          if (post.createdAt != null)
                            Flexible(
                              child: Text(
                                '${post.code.isEmpty && !post.featured ? '' : ' · '}'
                                '${timeAgo(post.createdAt!, l)}',
                                key: const ValueKey('feed-time'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontFamily: AppType.sans,
                                  fontSize: 11,
                                  color: t.text3,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              // O'Z postingda obuna tugmasi UMUMAN chizilmaydi —
              // o'zingga obuna bo'lish ma'nosiz.
              if (!mine && post.code.isNotEmpty)
                _FollowChip(
                  following: following,
                  onTap: () async => reportIfFailed(await ref
                      .read(followOverridesProvider.notifier)
                      .toggle(post.code,
                          following: following, company: post.isCompany)),
                ),
              // "⋯" — SHIKOYAT VA BLOKLASH (UGC talabi) lentaning o'zida,
              // post tafsilotidagi varaqning aynan o'zi.
              if (!mine && post.id > 0)
                Semantics(
                  button: true,
                  label: l.reportTitle,
                  excludeSemantics: true,
                  child: InkResponse(
                    key: const ValueKey('feed-more'),
                    radius: 22,
                    onTap: () => showContentActions(
                      context,
                      ref,
                      target: post.isCompany
                          ? ReportTarget.companyPost
                          : ReportTarget.post,
                      targetId: '${post.id}',
                      ownerCode: post.code,
                      blockKind:
                          post.isCompany ? BlockKind.company : BlockKind.record,
                      blockId: post.code,
                      keyPrefix: 'feed',
                      onBlocked: onBlocked,
                    ),
                    // Balandligi avatar bilan bir xil (38) — sarlavha
                    // qatori va karta balandligi o'zgarmaydi.
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(8, 8, 0, 8),
                      child: Icon(Icons.more_horiz_rounded,
                          size: 22, color: t.text2),
                    ),
                  ),
                ),
            ],
          ),
          // O'Z POSTIM HALI TEKSHIRILMAGAN — boshqalar uni ko'rmaydi.
          if (post.pending) ...[
            const SizedBox(height: Gap.sm),
            const Align(
              alignment: Alignment.centerLeft,
              child: PendingBadge(),
            ),
          ],
          // KARUSEL — bir nechta RASM (ko'rgazma posti): yon tomonga
          // surish, ostida nuqtalar. Video post avvalgidek bitta media.
          if (media.isNotEmpty && !post.isVideo && post.mediaUrls.length > 1) ...[
            const SizedBox(height: Gap.md),
            // Bosish — o'sha rasm butun ekranda (ikki marta bosib layk
            // bu yerda yo'q: surish va bosish bilan to'qnashmasin).
            MediaCarousel(
              key: const ValueKey('feed-carousel'),
              urls: post.mediaUrls,
              keyPrefix: 'feed-carousel',
              borderRadius: R.gentle,
              background: t.surface2,
              onTap: (i) =>
                  openImageViewer(context, post.mediaUrls, initial: i),
            ),
          ] else if (media.isNotEmpty) ...[
            const SizedBox(height: Gap.md),
            // Quti media shakliga MOSLASHADI. Ilgari bu yerda
            // `AspectRatio(4 / 3)` + `cover` turardi: tik rasm usti
            // va osti bilan kesilardi, kvadrat logotip esa cho'zilib
            // hoshiyasi chiqib ketardi.
            // IKKI MARTA BOSIB LAYK — rasmda HAM, videoda HAM
            // (Instagram kabi, egasi 2026-10-05). Faqat yoqadi,
            // o'chirmaydi. Videoni BIR bosish avvalgidek to'liq
            // ekranni ochadi — faqat ikkinchi bosish kutilgani uchun
            // ~300 ms keyin (Reels'dagi bilan bir xil).
            //
            // Rasmni BIR bosish — butun ekranda kattalashtirib ko'rish
            // (`openImageViewer`, katalogdagi bilan bitta). Ilgari rasm
            // bosilganda hech narsa bo'lmasdi.
            _DoubleTapLike(
              onTap: post.isVideo
                  ? null
                  : () => openImageViewer(context, post.mediaUrls),
              onLike: () async {
                if (like.liked) return;
                reportIfFailed(
                    await ref.read(postLikesProvider.notifier).toggle(post));
              },
              child: AdaptiveMedia(
                url: media,
                isVideo: post.isVideo,
                videoKey: ValueKey(post.id),
                borderRadius: R.gentle,
                // LENTADA VIDEO O'ZI BOSHLANMAYDI.
                //
                // Standart qiymat `true` edi, ya'ni ekranda beshta
                // video post bo'lsa BESHTASI ham ochilardi: beshta
                // dekoder, beshta tarmoq so'rovi va ketma-ket ovoz
                // egaligini tortib olish. Ko'ringan narsa esa —
                // eng oxirgisining ovozi.
                //
                // Endi odam bosadi. Trafik ham tejaladi: mobil
                // internet qimmat, ko'rilmagan video uchun pul
                // sarflash odamning roziligisiz bo'lardi.
                autoPlayVideo: false,
                tapToToggleVideo: true,
                // Bosish — belgilarsiz to'liq ekran (Instagram).
                fullscreenVideo: true,
                // Dominant karta bo'lsa dangasalik shart emas — u
                // baribir darhol ochiladi.
                lazyVideo: activeVideo == null,
                activeVideo: activeVideo,
                // Burchakda 🔇/🔊 (egasi, 2026-10-05) — Reels bilan umumiy.
                showMuteVideo: true,
                videoPoster: post.posterUrl,
                videoMusic: post.music,
              ),
            ),
          ],
          // KO'RGAZMA: sarlavha, narx, tovar va havola — ixcham.
          if (ShowcaseExtras.hasAny(post)) ...[
            const SizedBox(height: Gap.md),
            ShowcaseExtras(post: post, keyPrefix: 'feed-showcase'),
          ],
          // Postdagi musiqa — bosilsa tinglash va «Shu musiqani ishlatish».
          if (post.music != null) ...[
            const SizedBox(height: Gap.md),
            Align(
              alignment: Alignment.centerLeft,
              child: MusicChip(track: post.music!),
            ),
          ],
          if (post.text.isNotEmpty) ...[
            const SizedBox(height: Gap.md),
            _FeedCaption(text: post.text, onOpen: openPost),
          ],
          // BIZNES POSTI: "Qo'ng'iroq / Telegram / Xarita" — izohdan
          // keyin, amallar qatoridan oldin; maydon bo'lmasa joy ham yo'q.
          if (postContactActions(post).isNotEmpty) ...[
            const SizedBox(height: Gap.md),
            PostContactBar(post: post),
          ],
          const SizedBox(height: Gap.sm),
          Divider(height: 1, color: t.border1),
          Row(
            children: [
              _CardAction(
                icon: like.liked
                    ? NovaIcons.liked
                    : NovaIcons.like,
                label: l.postLike,
                count: like.count,
                tint: like.liked ? t.error : null,
                // Chap cheti karta hoshiyasiga tegib turadi; o'ngga
                // izohgacha bo'lgan oraliqning yarmi.
                padRight: 2 + Gap.lg / 2,
                onTap: () async => reportIfFailed(
                    await ref.read(postLikesProvider.notifier).toggle(post)),
              ),
              // Izoh — mavjud oqim: post ochiladi va izoh maydoni
              // fokusga keladi. Alohida izoh tizimi yaratilmaydi.
              _CardAction(
                icon: NovaIcons.comment,
                label: l.postComments,
                count: post.comments,
                // Oraliqning ikkinchi yarmi + o'ngdagi `Spacer` dan.
                padLeft: 2 + Gap.lg / 2,
                padRight: Gap.lg,
                onTap: openPost,
              ),
              const Spacer(),
              _CardAction(
                icon: NovaIcons.share,
                label: l.actionShare,
                padLeft: 24,
                // Kompaniya sahifasi `/c/<ID>` da; `/<ID>` shaxsiy karta
                // deb qidiriladi va "topilmadi" (yoki BEGONA odam) chiqardi.
                onTap: () => shareWithFeedback(
                  context,
                  contentShareText(
                      caption: post.text,
                      code: post.code,
                      company: post.isCompany,
                      postId: post.isStory ? 0 : post.id),
                  subject: name,
                  copiedMessage: l.shareCopied,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _initials(String s) {
    final v = s.trim();
    if (v.isEmpty) return '?';
    return (v.length >= 2 ? v.substring(0, 2) : v).toUpperCase();
  }
}

/// Amal tugmasi — ikonka va (bo'lsa) sanoq.
class _CardAction extends StatelessWidget {
  const _CardAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.count,
    this.tint,
    this.padLeft = 2,
    this.padRight = 2,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final int? count;
  final Color? tint;

  /// Yon tomondagi SHAFFOF bosish maydoni. Belgi joyidan siljimaydi:
  /// qo'shilgan kenglik qo'shni oraliq yoki `Spacer` hisobidan.
  final double padLeft;
  final double padRight;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // PREMIUM: kulrang emas — pastki panel belgilari bilan bir xil
    // to'q siyoh ton (hamma mavzularda `text1` ga yaqin).
    final c = tint ?? Color.lerp(t.text1, t.text2, .35)!;
    final n = (count ?? 0) > 0 ? formatCount(count!) : null;

    return Semantics(
      button: true,
      label: n == null ? label : '$label: $n',
      child: Tooltip(
        message: label,
        child: _ActionInk(
          onTap: onTap,
          // Eski (2, 8, 2, 8) qutiga qo'shilgan shaffof qism.
          extra: EdgeInsets.fromLTRB(padLeft - 2, 2, padRight - 2, Gap.md),
          child: Padding(
            // BOSISH MAYDONI ~48 dp. Ilgari 22x34 edi: barmoq belgidan
            // sal pastga tushsa hech narsa bo'lmasdi. Tepadagi 10 =
            // ajratgich ostidagi 2 + eski 8; pastdagisi eski 8 + karta
            // hoshiyasi (u endi shu yerda). Belgi AYNAN o'sha joyda.
            padding: EdgeInsets.fromLTRB(padLeft, 10, padRight, 8 + Gap.md),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: c),
                if (n != null) ...[
                  const SizedBox(width: 5),
                  Text(
                    n,
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: c,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// `_CardAction` ning siyohi: bosilgandagi kulrang doira kattalashgan
/// quti markaziga emas, ESKI quti (belgi) markaziga chiziladi — shaffof
/// hoshiya uni siljitmaydi. `InkResponse.getRectCallback` aynan shunday
/// holatlar uchun (masalan `TableRowInkWell`).
class _ActionInk extends InkResponse {
  const _ActionInk({
    required super.onTap,
    required super.child,
    required this.extra,
  }) : super(radius: 26);

  /// Eski qutiga nisbatan qo'shilgan shaffof hoshiya.
  final EdgeInsets extra;

  @override
  RectCallback? getRectCallback(RenderBox referenceBox) =>
      () => extra.deflateRect(Offset.zero & referenceBox.size);
}

/// Obuna holati — ikki holat aniq farq qiladi.
class _FollowChip extends StatelessWidget {
  const _FollowChip({required this.following, required this.onTap});

  final bool following;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final label = following ? l.actionFollowing : l.actionFollow;

    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: 6),
          // PREMIUM: "Kuzatish" — siyoh kapsula (Ivory'da qora, qorong'i
          // mavzularda yorug'), "Kuzatilmoqda" — ingichka hoshiyali sirt.
          decoration: BoxDecoration(
            color: following ? t.surfaceSolid : t.text1,
            borderRadius: R.pill,
            border: Border.all(color: following ? t.border1 : t.text1),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: .2,
              color: following ? t.text1 : t.surfaceSolid,
            ),
          ),
        ),
      ),
    );
  }
}


/// "Homiylik" belgisi — pullik ko'tarilgan kontent uchun.
///
/// Ataylab KICHIK va TINCH: u ogohlantirish emas, oddiy ma'lumot.
/// Katta rangli yorliq lentaning ohangini buzardi, belgisiz qolishi
/// esa yashirin reklama bo'lardi.
class _FeaturedBadge extends StatelessWidget {
  const _FeaturedBadge();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: t.accent2.withValues(alpha: .14),
        borderRadius: R.pill,
      ),
      child: Text(
        L.of(context).feedSponsored,
        style: TextStyle(
          fontFamily: AppType.sans,
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          letterSpacing: .3,
          color: t.accent2,
        ),
      ),
    );
  }
}


/// Lenta izohi — 2 qatordan uzun bo'lsa ostida "ko'proq".
///
/// Ilgari uzun matn 2 qatorda kesilib qolardi va oxirini o'qish uchun
/// postni OCHISH kerak edi. Endi "ko'proq" bosilsa matn shu kartaning
/// o'zida to'liq ochiladi (Instagram kabi). Matnning qolgan joyini
/// bosish avvalgidek postni ochadi. Yozuv Reels'dagi bilan bitta
/// (`reelCaptionMore`).
class _FeedCaption extends StatefulWidget {
  const _FeedCaption({required this.text, required this.onOpen});

  final String text;
  final VoidCallback onOpen;

  @override
  State<_FeedCaption> createState() => _FeedCaptionState();
}

class _FeedCaptionState extends State<_FeedCaption> {
  bool _open = false;

  @override
  void didUpdateWidget(_FeedCaption old) {
    super.didUpdateWidget(old);
    // Karta boshqa postga qayta ishlatilsa — yana yig'iq holda.
    if (old.text != widget.text) _open = false;
  }

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodySmall;
    final body = GestureDetector(
      onTap: widget.onOpen,
      behavior: HitTestBehavior.opaque,
      child: Text(
        widget.text,
        maxLines: _open ? null : 2,
        overflow: _open ? null : TextOverflow.ellipsis,
        style: style,
      ),
    );
    if (_open) return body;
    return LayoutBuilder(builder: (context, box) {
      // Matn 2 qatorga sig'adimi — o'lchab ko'riladi. `TextPainter`
      // darhol yo'q qilinadi: u o'z ichida mahalliy (C++) paragraf
      // ushlab turadi va har qurishda yangisi yaratilib tashlab
      // qo'yilsa xotira sizib chiqardi.
      final tp = TextPainter(
        text: TextSpan(text: widget.text, style: style),
        maxLines: 2,
        textDirection: Directionality.of(context),
        textScaler: MediaQuery.textScalerOf(context),
      )..layout(maxWidth: box.maxWidth);
      final long = tp.didExceedMaxLines;
      tp.dispose();
      if (!long) return body;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          body,
          GestureDetector(
            key: const ValueKey('feed-caption-more'),
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _open = true),
            // Barmoq uchun maydon — yozuvning o'zi juda kichik.
            child: Padding(
              padding: const EdgeInsets.fromLTRB(0, 4, Gap.lg, 4),
              child: Text(
                L.of(context).reelCaptionMore,
                style: style?.copyWith(
                    color: context.tokens.text3, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      );
    });
  }
}

/// Rasm ustida ikki marta bosish → layk va qisqa yurak animatsiyasi.
class _DoubleTapLike extends StatefulWidget {
  const _DoubleTapLike({
    this.onTap,
    required this.onLike,
    required this.child,
  });

  /// Bir bosish (rasm — kattalashtirib ko'rish). `null` bo'lsa bir
  /// bosish ichkaridagi vidjetga qoladi (video — to'liq ekran).
  final VoidCallback? onTap;
  final VoidCallback onLike;
  final Widget child;

  @override
  State<_DoubleTapLike> createState() => _DoubleTapLikeState();
}

class _DoubleTapLikeState extends State<_DoubleTapLike> {
  bool _burst = false;

  void _go() {
    widget.onLike();
    setState(() => _burst = true);
    Future<void>.delayed(const Duration(milliseconds: 650), () {
      if (mounted) setState(() => _burst = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      key: const ValueKey('feed-double-like'),
      onTap: widget.onTap,
      onDoubleTap: _go,
      child: Stack(
        alignment: Alignment.center,
        children: [
          widget.child,
          IgnorePointer(
            child: AnimatedScale(
              scale: _burst ? 1 : .4,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutBack,
              child: AnimatedOpacity(
                opacity: _burst ? 1 : 0,
                duration: const Duration(milliseconds: 180),
                child: const Icon(Icons.favorite_rounded,
                    size: 86,
                    color: Colors.white,
                    shadows: [Shadow(blurRadius: 18, color: Colors.black38)]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
