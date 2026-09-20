import 'package:flutter/material.dart';

import 'package:nfcstore_nova/design/theme/typography.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/tokens/shapes.dart';
import 'package:nfcstore_nova/design/widgets/buttons.dart';
import 'package:nfcstore_nova/design/widgets/nova_scaffold.dart';
import 'package:nfcstore_nova/design/widgets/surfaces.dart';
import 'package:nfcstore_nova/features/home/widgets/avatar.dart';

/// TAKLIF QILINADIGAN KO'RINISHLAR — FAQAT KO'RISH UCHUN.
///
/// Bu fayl `test/` ichida va ilovaga KIRMAYDI. Maqsadi — taklifni
/// haqiqiy dizayn tilida ko'rsatish: bu yerda hech narsa qaytadan
/// chizilmaydi, hammasi ilovaning O'Z komponentlari va
/// tokenlaridan yig'iladi:
///
///   `FloatingSurface`, `PressableScale`, `Avatar`, `NovaButton`,
///   `NovaScaffold`, `Gap`, `R`, `context.tokens`, `AppType`.
///
/// Shuning uchun tasdiqlangandan keyin bu vidjetlarni `lib/` ga
/// ko'chirish deyarli nusxa ko'chirish ishidan iborat bo'ladi —
/// qayta dizayn qilinmaydi.

/// Bitta amal tugmasi: ikonka + sanoq.
///
/// `_Action` nomi post ekranida allaqachon bor va xuddi shu
/// shaklda ishlaydi — bu yerda u lenta kartasi uchun ixchamroq
/// o'lchamda takrorlanadi.
class ProposedAction extends StatelessWidget {
  const ProposedAction({
    super.key,
    required this.icon,
    required this.label,
    this.count,
    this.tint,
  });

  final IconData icon;
  final String label;
  final String? count;
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final c = tint ?? t.text2;
    return Semantics(
      button: true,
      label: count == null ? label : '$label: $count',
      child: Tooltip(
        message: label,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: c),
              if (count != null) ...[
                const SizedBox(width: 5),
                Text(
                  count!,
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: c,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Obuna holati — kapsula tugma.
///
/// Ikki holat aniq farq qiladi: obuna bo'lmagan — aksent to'ldirilgan,
/// obuna bo'lgan — faqat chegara. Shunda "men obuna bo'lganmanmi"
/// degan savolga bir qarashda javob bo'ladi.
class ProposedFollow extends StatelessWidget {
  const ProposedFollow({super.key, required this.following});

  final bool following;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Gap.md, vertical: 6),
      decoration: BoxDecoration(
        color: following ? Colors.transparent : t.accent2,
        borderRadius: R.pill,
        border: Border.all(color: following ? t.border2 : t.accent2),
      ),
      child: Text(
        following ? 'Obuna bo‘lingan' : 'Obuna bo‘lish',
        style: TextStyle(
          fontFamily: AppType.sans,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: following ? t.text2 : t.onAccent,
        ),
      ),
    );
  }
}

/// LENTA KARTASI — TAKLIF.
///
/// Hozir bosh ekranda lenta 128px kenglikdagi gorizontal
/// "ko'rinish" kartalaridan iborat va ularda HECH QANDAY amal
/// yo'q: postni ochmasdan layk bosib bo'lmaydi.
///
/// Taklif: to'liq kenglikdagi vertikal karta. Tepada muallif va
/// obuna holati, o'rtada media/matn, pastda layk/izoh/ulashish.
class ProposedFeedCard extends StatelessWidget {
  const ProposedFeedCard({
    super.key,
    required this.author,
    required this.code,
    required this.text,
    required this.likes,
    required this.comments,
    this.liked = false,
    this.following,
    this.hasMedia = true,
  });

  final String author;
  final String code;
  final String text;
  final String likes;
  final String comments;
  final bool liked;

  /// `null` — o'z postim, obuna tugmasi UMUMAN chizilmaydi.
  final bool? following;
  final bool hasMedia;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Avatar(initials: author.substring(0, 2).toUpperCase(), size: 38),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      author,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: t.text1,
                      ),
                    ),
                    Text(
                      code,
                      style: TextStyle(
                        fontFamily: AppType.mono,
                        fontSize: 11,
                        color: t.text3,
                      ),
                    ),
                  ],
                ),
              ),
              if (following != null) ProposedFollow(following: following!),
            ],
          ),
          const SizedBox(height: Gap.md),
          if (hasMedia)
            ClipRRect(
              borderRadius: R.gentle,
              child: AspectRatio(
                aspectRatio: 4 / 3,
                child: DecoratedBox(
                  decoration: BoxDecoration(gradient: t.accentGradient),
                ),
              ),
            ),
          const SizedBox(height: Gap.md),
          Text(
            text,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: Gap.sm),
          Divider(height: 1, color: t.border2),
          const SizedBox(height: 6),
          Row(
            children: [
              ProposedAction(
                icon: liked
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                label: 'Yoqtirish',
                count: likes,
                tint: liked ? t.error : null,
              ),
              const SizedBox(width: Gap.lg),
              ProposedAction(
                icon: Icons.mode_comment_outlined,
                label: 'Izohlar',
                count: comments,
              ),
              const Spacer(),
              const ProposedAction(
                icon: Icons.ios_share_rounded,
                label: 'Ulashish',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// REELS — TAKLIF.
///
/// Hozir Reels ekranida amallar umuman yo'q. Taklif: o'ng
/// tomonda vertikal amal ustuni, pastda muallif va izoh —
/// NFCSTORE ohangida, oq shaffof doiralar bilan.
class ProposedReels extends StatelessWidget {
  const ProposedReels({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    Widget round(IconData icon, String label, {String? count, Color? tint}) =>
        Semantics(
          button: true,
          label: count == null ? label : '$label: $count',
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: .14),
                  border: Border.all(color: Colors.white.withValues(alpha: .3)),
                ),
                child: Icon(icon, size: 21, color: tint ?? Colors.white),
              ),
              if (count != null)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(
                    count,
                    style: const TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
        );

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(gradient: t.accentGradient),
          ),
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.center,
                    colors: [
                      Colors.black.withValues(alpha: .6),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Ovoz tugmasi — yuqori o'ngda, hozirgi Reels bilan bir joyda.
          Positioned(
            top: 48,
            right: Gap.lg,
            child: round(Icons.volume_off_rounded, 'Ovozni yoqish'),
          ),
          // O'NG USTUN — amallar.
          Positioned(
            right: Gap.lg,
            bottom: 140,
            child: Column(
              children: [
                Avatar(initials: 'MU', size: 46),
                const SizedBox(height: Gap.lg),
                round(Icons.favorite_border_rounded, 'Yoqtirish', count: '128'),
                const SizedBox(height: Gap.lg),
                round(Icons.mode_comment_outlined, 'Izohlar', count: '14'),
                const SizedBox(height: Gap.lg),
                round(Icons.ios_share_rounded, 'Ulashish'),
              ],
            ),
          ),
          // Pastda — muallif, obuna va izoh.
          Positioned(
            left: Gap.lg,
            right: 90,
            bottom: 108,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      'Muhammad',
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: Gap.sm),
                    const ProposedFollow(following: false),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Yangi NFC stikerlar — bir tegishda profil ochiladi.',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 13,
                    height: 1.35,
                    color: Colors.white,
                    shadows: [Shadow(color: Colors.black54, blurRadius: 10)],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// NFC TOOLS PLITKASI.
class ProposedNfcTool extends StatelessWidget {
  const ProposedNfcTool({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.disabled = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  /// Platforma qo'llamasa — tugma o'chiq va sababi yoziladi.
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Opacity(
      opacity: disabled ? .45 : 1,
      child: FloatingSurface(
        solid: true,
        padding: const EdgeInsets.all(Gap.md),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: R.tile,
                border: Border.all(color: t.border2),
              ),
              child: Icon(icon, size: 20, color: t.accent2),
            ),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: t.text1,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 11.5,
                      color: t.text3,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 20, color: t.text3),
          ],
        ),
      ),
    );
  }
}

/// NFC YOZISH EKRANI — TAKLIF.
class ProposedNfcWrite extends StatelessWidget {
  const ProposedNfcWrite({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NovaScaffold(
      title: 'NFC ga yozish',
      showBack: true,
      body: NovaScroll(
        children: [
          Text(
            'Nima yozishni tanlang',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: Gap.md),
          const ProposedNfcTool(
            icon: Icons.link_rounded,
            title: 'Havola (URL)',
            subtitle: 'https://…',
          ),
          const SizedBox(height: Gap.sm),
          const ProposedNfcTool(
            icon: Icons.text_fields_rounded,
            title: 'Matn',
            subtitle: 'Oddiy matn yozuvi',
          ),
          const SizedBox(height: Gap.sm),
          const ProposedNfcTool(
            icon: Icons.contact_page_outlined,
            title: 'Kontakt (vCard)',
            subtitle: 'Ism, telefon, e-pochta',
          ),
          const SizedBox(height: Gap.sm),
          const ProposedNfcTool(
            icon: Icons.badge_outlined,
            title: 'NFCSTORE profilim',
            subtitle: 'VIP001 — ochiq profil havolasi',
          ),
          const SizedBox(height: Gap.sm),
          const ProposedNfcTool(
            icon: Icons.storefront_outlined,
            title: 'Biznes profil',
            subtitle: 'NFCSTORE — kompaniya sahifasi',
          ),
          const SizedBox(height: Gap.xl),
          FloatingSurface(
            solid: true,
            child: Row(
              children: [
                Icon(Icons.info_outline_rounded, size: 18, color: t.text3),
                const SizedBox(width: Gap.sm),
                Expanded(
                  child: Text(
                    'Tegga faqat ochiq havola yoziladi. Jismoniy '
                    'NFCSTORE kartasining maxfiy kaliti hech qachon '
                    'boshqa tegga ko‘chirilmaydi.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: Gap.xl),
          NovaButton(label: 'Davom etish', onPressed: () {}),
        ],
      ),
    );
  }
}

/// NFC YOZISH — TEGNI KUTISH VA TASDIQ.
class ProposedNfcWriteWaiting extends StatelessWidget {
  const ProposedNfcWriteWaiting({super.key, this.done = false});

  final bool done;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NovaScaffold(
      title: 'NFC ga yozish',
      showBack: true,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: done
                      ? t.success.withValues(alpha: .12)
                      : t.surface2,
                  border: Border.all(
                      color: done ? t.success : t.border2, width: 1.4),
                ),
                child: Icon(
                  done ? Icons.check_rounded : Icons.nfc_rounded,
                  size: 46,
                  color: done ? t.success : t.accent2,
                ),
              ),
              const SizedBox(height: Gap.xl),
              Text(
                done ? 'Yozildi' : 'Tegni yaqinlashtiring',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: Gap.sm),
              Text(
                done
                    ? 'Yozuv qayta o‘qib tasdiqlandi.'
                    : 'Telefon orqasini NFC tegga tegizing.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (done) ...[
                const SizedBox(height: Gap.xxl),
                NovaButton(label: 'Tayyor', onPressed: () {}),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
