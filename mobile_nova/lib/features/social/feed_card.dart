import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/errors/app_error.dart';
import '../../core/network/api_client.dart';
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
import 'media_frame.dart';
import '../../design/icons/nova_icons.dart';

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
  const FeedCard({super.key, required this.post, this.activeVideo});

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
            ],
          ),
          if (media.isNotEmpty) ...[
            const SizedBox(height: Gap.md),
            // Quti media shakliga MOSLASHADI. Ilgari bu yerda
            // `AspectRatio(4 / 3)` + `cover` turardi: tik rasm usti
            // va osti bilan kesilardi, kvadrat logotip esa cho'zilib
            // hoshiyasi chiqib ketardi.
            AdaptiveMedia(
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
              // Dominant karta bo'lsa dangasalik shart emas — u
              // baribir darhol ochiladi.
              lazyVideo: activeVideo == null,
              activeVideo: activeVideo,
            ),
          ],
          if (post.text.isNotEmpty) ...[
            const SizedBox(height: Gap.md),
            GestureDetector(
              onTap: openPost,
              behavior: HitTestBehavior.opaque,
              child: Text(
                post.text,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
          const SizedBox(height: Gap.sm),
          Divider(height: 1, color: t.border2),
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
                onTap: () => shareLink(
                  post.isCompany
                      ? '$kApiBase/c/${Uri.encodeComponent(post.code)}'
                      : '$kApiBase/${Uri.encodeComponent(post.code)}',
                  title: name,
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
    final c = tint ?? t.text2;
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
          decoration: BoxDecoration(
            color: following ? Colors.transparent : t.accent2,
            borderRadius: R.pill,
            border: Border.all(color: following ? t.border2 : t.accent2),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: following ? t.text2 : t.onAccent,
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
