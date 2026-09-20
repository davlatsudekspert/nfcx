import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/utils/sharing.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import '../home/widgets/mode_switch.dart';
import '../home/widgets/my_ids_strip.dart';
import '../../app/profile_context.dart';
import '../../data/repositories/business_repository.dart';
import '../nfc/qr_sheet.dart';
import 'profile_switcher.dart';
import '../demo/demo_mode.dart';
import '../social/engagement.dart';
import '../social/story_viewer.dart';
import '../social/inline_video.dart';
import '../social/media_frame.dart';
import '../social/moderation.dart';
import 'profile_repository.dart';

// RIVERPOD `dependencies` — DEMO DARAXTI UCHUN SHART.
//
// "NFC Mobile" demo ekranlari repozitoriylarni ichki
// `ProviderScope` da almashtiradi. Riverpod esa almashtirilgan
// provayderga TAYANADIGAN har bir provayderdan buni OLDINDAN
// e'lon qilishni talab qiladi — aks holda u ichki doirada qayta
// yaratilmaydi va "Tried to read ... from a place where one of
// its dependencies were overridden" xatosi chiqadi.
//
// Ishlab chiqarish xulqi O'ZGARMAYDI.
final profilePostsProvider = FutureProvider.autoDispose
    .family<List<Post>, String>(dependencies: [socialRepositoryProvider], (ref, code) async {
      final res = await ref.watch(socialRepositoryProvider).postsOf(code);
      return res.when(ok: (v) => v, err: (e) => throw e);
    });

/// Kompaniya postlari — SHAXSIY postlardan boshqa manba.
///
/// `/api/records/:code/posts` kompaniya uchun ishlamaydi: u NFC
/// yozuvlari bilan ishlaydi. Kompaniyaniki `/api/companies/:id/posts`
/// da. Ilgari biznes rejimida ham shaxsiy yo'l chaqirilardi va
/// natijada biznes profilida shaxsiy postlar ko'rinardi.
final companyPostsProvider = FutureProvider.autoDispose
    .family<List<Post>, String>(dependencies: [businessRepositoryProvider], (ref, id) async {
      final res = await ref.watch(businessRepositoryProvider).posts(id);
      return res.when(ok: (v) => v, err: (e) => throw e);
    });

/// Digital Identity Canvas.
///
/// Bir xil katta to'rtburchak kartalar TO'PLAMI EMAS: muqova, suzuvchi
/// avatar, kapsula shaklidagi statistika va ixcham plitkalar — har biri
/// boshqa shakl va o'lchamda. Kompozitsiya ataylab nosimmetrik.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key, this.code});

  /// `null` — o'z profili. Aks holda boshqa foydalanuvchi.
  final String? code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final mode = ref.watch(modeProvider);
    final ids = ref.watch(myIdsProvider);

    // O'Z profili — FAOL KONTEKST (shaxsiy yozuv yoki kompaniya).
    // Boshqa odamniki — SERVERDAN o'qiladi.
    //
    // Ilgari bu yerda faqat `ids.where(...)` turardi, ya'ni begona
    // kod MENING ID larim orasidan qidirilardi. U yerda u hech
    // qachon bo'lmaydi, shuning uchun natija doim `null` edi va
    // ekran serverga umuman murojaat qilmasdi: Kashfiyotdan qaysi
    // odamni tanlasangiz ham bir xil BO'SH panel ochilardi.
    final isMe = code == null || ids.any((e) => e.code == code);
    final remote = (code == null || isMe)
        ? null
        : ref.watch(publicProfileProvider(code!));
    final other = code == null
        ? null
        : (ids.where((e) => e.code == code).firstOrNull ?? remote?.valueOrNull);
    final active = code == null
        ? ref.watch(activeProfileProvider)
        : (other == null ? null : ActiveProfile.personal(other));

    // Biznes rejimi tanlangan, lekin hisobda kompaniya yo'q.
    final noBusiness = code == null && ref.watch(businessMissingProvider);

    // QR va ulashish FAQAT NFC yozuvida ma'noga ega — kompaniyaning
    // ommaviy manzili boshqacha quriladi va QR kodi shaxsiy yozuvniki
    // emas. Shuning uchun biznes kontekstida bu tugmalar shaxsiy
    // yozuvga tegmaydi.
    final id = active != null && !active.isBusiness ? active.id : null;

    // Obuna holati — lenta kartasi bilan BITTA manba.
    final following = code == null ? false : ref.watch(followingOfProvider(code!));

    // DEMO holati. Ishlab chiqarishda DOIM `null` — ya'ni pastdagi
    // hech bir shart ishlamaydi va ekran avvalgidek qoladi.
    final demo = ref.watch(demoModeProvider);

    if (user == null) return const SizedBox.shrink();

    return NovaScaffold(
      showBack: code != null,
      actions: code != null
          ? [
              // DEMO profilni shikoyat qilish yoki bloklash
              // ma'nosiz — o'rnida "Demo" yorlig'i turadi.
              if (demo != null)
                Padding(
                  padding: const EdgeInsets.only(right: Gap.sm),
                  child: Capsule(label: l.demoBadge, dense: true),
                )
              else ...[
                // O'ZGANING profili — shikoyat va bloklash.
                NovaIconButton(
                  icon: Icons.more_horiz_rounded,
                  tooltip: l.reportTitle,
                  onPressed: () => _showProfileActions(context, ref, code!),
                ),
                const SizedBox(width: Gap.sm),
              ],
            ]
          : [
              NovaIconButton(
                icon: Icons.settings_outlined,
                tooltip: l.settings,
                onPressed: () => context.push(Routes.settings),
              ),
              const SizedBox(width: Gap.sm),
            ],
      body: RefreshIndicator(
        color: t.accent2,
        backgroundColor: t.surfaceSolid,
        onRefresh: () async {
          await ref.read(sessionProvider.notifier).refresh();
          if (id != null) ref.invalidate(profilePostsProvider(id.code));
        },
        child: NovaScroll(
          padding: EdgeInsets.only(bottom: navSafeBottom(context)),
          children: [
            _Hero(user: user, profile: active, mode: mode),
            const SizedBox(height: Gap.xl),
            if (isMe && code == null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: ModeSwitch(
                  mode: mode,
                  // Rejimni to'g'ridan-to'g'ri o'rnatish YETARLI EMAS:
                  // biznesga o'tishda qaysi kompaniya ekanini ham hal
                  // qilish kerak (bitta bo'lsa — darhol, bir nechta
                  // bo'lsa — tanlagich).
                  onChanged: (m) => m == AppMode.business
                      ? switchToBusiness(context, ref)
                      : switchToPersonal(context, ref),
                ),
              ),
            const SizedBox(height: Gap.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: _StatCapsules(profile: active),
            ),
            const SizedBox(height: Gap.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: Row(
                children: [
                  Expanded(
                    child: NovaButton(
                      // Obuna holati KO'RINADI. Ilgari yozuv
                      // "Kuzatish" deb qotib qolgan edi, shuning
                      // uchun bosilganda hech narsa o'zgarmagandek
                      // tuyulardi.
                      label: isMe
                          ? l.profileEdit
                          : (following ? l.actionFollowing : l.actionFollow),
                      icon: isMe
                          ? Icons.edit_rounded
                          : (following
                              ? Icons.check_rounded
                              : Icons.person_add_alt_rounded),
                      tone: (!isMe && following)
                          ? ButtonTone.outline
                          : ButtonTone.accent,
                      onPressed: isMe
                          ? () => context.push(Routes.profileEdit)
                          : () async {
                              final e = await ref
                                  .read(followOverridesProvider.notifier)
                                  .toggle(code!, following: following);
                              if (e == null || !context.mounted) return;
                              ScaffoldMessenger.of(context)
                                ..hideCurrentSnackBar()
                                ..showSnackBar(SnackBar(
                                    content: Text(describeError(l, e))));
                            },
                    ),
                  ),
                  const SizedBox(width: Gap.md),
                  NovaIconButton(
                    icon: Icons.qr_code_rounded,
                    tooltip: l.nfcShowQr,
                    size: 52,
                    onPressed: id == null
                        ? null
                        : () => showQrSheet(context, id,
                            urlOverride: demo?.shareUrl),
                  ),
                  const SizedBox(width: Gap.sm),
                  NovaIconButton(
                    icon: Icons.ios_share_rounded,
                    tooltip: l.actionShare,
                    size: 52,
                    onPressed: id == null
                        ? null
                        : () async {
                            // Tizim oynasi ochilmasa manzil buferga
                            // ko'chiriladi — odam boshi berk
                            // ko'chada qolmasin.
                            final ok = await shareLink(
                                demo?.shareUrl ?? id.publicUrl(kApiBase));
                            if (ok || !context.mounted) return;
                            ScaffoldMessenger.of(context)
                              ..hideCurrentSnackBar()
                              ..showSnackBar(
                                  SnackBar(content: Text(l.shareCopied)));
                          },
                  ),
                ],
              ),
            ),
            if (noBusiness) ...[
              const SizedBox(height: Gap.xl),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: StatePanel(
                  icon: Icons.storefront_outlined,
                  title: l.businessNoneTitle,
                  message: l.businessNoneHint,
                ),
              ),
            ],
            // "NFC ID'LARIM" — BOSH SAHIFADAN SHU YERGA KO'CHDI.
            //
            // Bosh sahifaning vazifasi boshqa: FAOL yozuv va uning
            // ustidagi amallar. Egalik qilingan ID'lar ro'yxati esa
            // profilning ishi — o'zingiz haqingizdagi sahifada.
            //
            // FAQAT O'Z profilida: begona odamning profilida
            // sizning ID'laringiz ko'rinishi mantiqsiz.
            //
            // "Hammasi" mavjud boshqaruv ekraniga olib boradi —
            // u o'zgarmadi. Sozlamalar va NFC markazidagi yo'llar
            // ham joyida qoldi.
            if (code == null && ref.watch(myIdsProvider).isNotEmpty) ...[
              SectionHeader(
                title: l.nfcMyIds,
                action: l.actionSeeAll,
                onAction: () => context.push(Routes.nfcIds),
              ),
              const MyIdsStrip(),
            ],
            if (mode == AppMode.business && isMe && !noBusiness) ...[
              SectionHeader(title: l.bizTitle),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: _BusinessTiles(),
              ),
            ],
            SectionHeader(title: l.profilePosts),
            // Begona profil hali kelmagan yoki kelmadi — SABABNI
            // ko'rsatamiz. Ilgari bu yerda "Do'kondan karta oling
            // yoki ID yarating" chiqardi, ya'ni begona odamning
            // profili o'rniga MENGA tegishli maslahat.
            if (active == null && remote != null)
              remote.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(horizontal: Gap.screenX),
                  child: SkeletonList(count: 3),
                ),
                error: (e, __) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                  child: StatePanel.fromError(
                    context,
                    asAppError(e),
                    onRetry: () => ref.invalidate(publicProfileProvider(code!)),
                  ),
                ),
                data: (_) => const SizedBox.shrink(),
              )
            else if (active == null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: FloatingSurface(
                  solid: true,
                  child: Text(
                    noBusiness ? l.businessNoneHint : l.homeNoIdHint,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              )
            else
              _PostsGrid(code: active.code, company: active.isBusiness),
          ],
        ),
      ),
    );
  }
}

/// O'zga profil ustidagi amallar: shikoyat va bloklash.
void _showProfileActions(BuildContext context, WidgetRef ref, String code) {
  final l = L.of(context);
  showModalBottomSheet<void>(
    context: context,
    // ILDIZ NAVIGATORDA OCHILADI.
    //
    // Aks holda varaq TAB navigatorida ochiladi va pastki suzuvchi
    // navigatsiya paneli uning ustiga chiziladi — varaqning eng
    // pastki tugmalari panel ostida qolib ko'rinmay qoladi.
    // Ildiz navigatorda varaq butun ekranni qoplaydi.
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    builder: (sheet) => Padding(
      padding: EdgeInsets.only(
        left: Gap.lg,
        right: Gap.lg,
        bottom: MediaQuery.viewPaddingOf(sheet).bottom + Gap.lg,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: sheet.tokens.surfaceSolid,
          borderRadius: R.soft,
          border: Border.all(color: sheet.tokens.border2),
        ),
        padding: const EdgeInsets.all(Gap.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(
                Icons.flag_outlined,
                color: sheet.tokens.warn,
                size: 20,
              ),
              title: Text(
                l.reportTitle,
                style: Theme.of(sheet).textTheme.bodyLarge,
              ),
              onTap: () {
                Navigator.of(sheet).pop();
                showReportSheet(
                  context,
                  target: ReportTarget.record,
                  targetId: code,
                  ownerCode: code,
                );
              },
            ),
            ListTile(
              leading: Icon(
                Icons.block_rounded,
                color: sheet.tokens.error,
                size: 20,
              ),
              title: Text(
                l.blockUser,
                style: Theme.of(sheet).textTheme.bodyLarge,
              ),
              onTap: () async {
                Navigator.of(sheet).pop();
                final res = await ref
                    .read(moderationRepositoryProvider)
                    .block(BlockKind.record, code);
                if (!context.mounted) return;
                res.when(
                  ok: (_) => ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text(l.blockUser))),
                  err: (e) => ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text(describeError(l, e)))),
                );
              },
            ),
          ],
        ),
      ),
    ),
  );
}

/// Kuzatish holati — optimistik.
// `ProfileFollow` OLIB TASHLANDI.
//
// U obunaning IKKINCHI, mustaqil tizimi edi: o'z ro'yxatini bo'sh
// holatdan boshlardi va serverdagi "kimga obunaman" ro'yxatini
// UMUMAN o'qimasdi. Natijada allaqachon obuna bo'lgan odamda ham
// tugma "Kuzatish" deb turardi va bosilganda holat ko'rinmasdi.
//
// Endi lenta kartasi bilan BITTA tizim ishlatiladi
// (`followingOfProvider` + `followOverridesProvider`): u serverdan
// urug'lanadi, darhol o'zgaradi, xato bo'lsa orqaga qaytadi va
// sababni ko'rsatadi.

/// Profil boshi — Concept B'dagi markazlashgan "identity" ustuni.
///
/// Concept B'da muqova YO'Q: ekran tepasida atmosfera (aurora) turadi,
/// undan keyin markazda avatar-blob, ism, ikkilamchi yozuv va NFC ID
/// kapsulasi — hammasi bitta o'qda. Bizda muqova HAQIQIY ma'lumot
/// (`id.coverUrl`), shuning uchun u o'chirilmaydi, lekin endi KARTA
/// emas: to'liq kenglikdagi, pastga qarab fonga singib ketadigan
/// atmosfera bo'lib turadi. Fokus kartada emas, odamda.
class _Hero extends StatelessWidget {
  const _Hero({required this.user, required this.profile, required this.mode});

  final User user;

  /// Faol kontekst — shaxsiy yozuv YOKI kompaniya.
  ///
  /// Ilgari bu yerda `NfcId?` turardi va biznes rejimida ham o'sha
  /// SHAXSIY yozuv kelardi: ekran "Biznes" deb turib, shaxsiy ism,
  /// avatar va kodni ko'rsatardi.
  final ActiveProfile? profile;
  final AppMode mode;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final business = mode == AppMode.business;
    final cover = profile?.coverUrl ?? '';

    // Rejim atmosferaning ham, avatar nurining ham rangini belgilaydi.
    final tone = business ? t.accentB : t.accent1;
    final toneDark = business ? t.accentBDark : t.accent2;
    final glow = business ? t.glowB : t.glow;

    // Ikkilamchi yozuv faqat backend bergan bo'lsa chiqadi. Concept B'da
    // bu yerda `@handle` turadi — bizning backend'da bunday maydon yo'q,
    // shuning uchun UNI TO'QIB CHIQARMAYMIZ.
    final subtitle = (profile?.subtitle ?? '').trim();

    return Stack(
      children: [
        // Atmosfera: to'liq kenglik, hoshiyasiz, pastda fonga so'nadi.
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 150,
          child: ShaderMask(
            // So'nishni SCRIM bilan emas, muqovaning O'ZINI shaffoflashtirib
            // qilamiz. Ustiga `bg1` to'rtburchagi qo'yilsa, uning pastki
            // qirrasi orqadagi jonli fon (backdrop) ustida TO'G'RI CHIZIQ
            // bo'lib ko'rinib qolardi — karta yana paydo bo'lardi.
            shaderCallback: (rect) => const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              // Uch emas, to'rt to'xtash: shaffoflikning O'ZGARISH
              // TEZLIGI ham asta susayadi. Ikki bosqichli chiziqli
              // so'nishda burilish nuqtasi ko'z uchun yengil chiziq
              // (Mach band) bo'lib seziladi.
              colors: [
                Colors.white,
                Colors.white,
                Color(0x40FFFFFF),
                Colors.transparent,
              ],
              stops: [0, .30, .70, 1],
            ).createShader(rect),
            blendMode: BlendMode.dstIn,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (cover.isEmpty)
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          tone.withValues(alpha: .34),
                          toneDark.withValues(alpha: .12),
                        ],
                      ),
                    ),
                  )
                else
                  mediaImage(context, cover, fit: BoxFit.cover),
              ],
            ),
          ),
        ),
        // Stack ichidagi o'lchamsiz bola bo'sh constraint oladi va CHAPGA
        // yopishadi — shuning uchun ustun ataylab to'liq kenglikka yoyiladi.
        SizedBox(
          width: double.infinity,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 86),
                const _DemoNotice(),
                // ISTORYA HALQASI — FAQAT istorya BOR bo'lsa.
                //
                // Ilgari profil ekrani istoryani umuman
                // ko'rsatmasdi: odam istorya qo'yardi, lekin uni
                // profilidan ochib bo'lmasdi. Halqa ro'yxat bo'sh
                // bo'lganda umuman chizilmaydi, shuning uchun
                // istoryasiz profil avvalgidek ko'rinadi.
                _AvatarWithStory(
                  code: profile?.code,
                  child: _HeroAvatar(
                    user: user,
                    profile: profile,
                    glow: glow,
                    business: business,
                  ),
                ),
                const SizedBox(height: Gap.md),
                Text(
                  (profile?.name ?? '').isNotEmpty
                      ? profile!.name
                      // Kompaniya nomi bo'sh bo'lishi mumkin emas,
                      // shaxsiy yozuvda esa bo'lishi mumkin — shunda
                      // hisob egasining ismi ishlatiladi.
                      : (business ? '' : user.displayName),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: AppType.displayStyle(
                    color: t.text1,
                    size: 24,
                    height: 1.18,
                    letterSpacing: -.6,
                  ),
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                if (profile != null) ...[
                  const SizedBox(height: Gap.md),
                  _IdPill(
                    code: profile!.code,
                    // Kompaniyada "faol" holati `status` bilan
                    // beriladi, shaxsiy yozuvda — `active`.
                    active: profile!.isBusiness
                        ? profile!.business!.isPublished
                        : profile!.id!.active,
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

/// Avatar + holat nishoni.
///
/// Concept B'da avatar 120px, aksent gradientida va o'z nuri bilan
/// suzib turadi. `Avatar` widgeti butun ilovada bir xil — shuning uchun
/// u qayta yozilmaydi, faqat ostiga nur qo'yiladi.
/// "Bu namuna" eslatmasi.
///
/// O'zi `demoModeProvider` ni o'qiydi, shuning uchun uni ekranning
/// istalgan joyiga qo'yish mumkin va ishlab chiqarishda u
/// UMUMAN chizilmaydi.
class _DemoNotice extends ConsumerWidget {
  const _DemoNotice();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(demoModeProvider) == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.lg),
      child: Text(
        L.of(context).demoNotice,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall,
      ),
    );
  }
}

/// Avatar ustidagi istorya halqasi.
///
/// Halqa FAQAT istorya bo'lganda paydo bo'ladi va bosilganda
/// ko'ruvchini ochadi. Istoryasi yo'q profilda hech narsa
/// o'zgarmaydi — hatto bosish ham ishlamaydi.
class _AvatarWithStory extends ConsumerWidget {
  const _AvatarWithStory({required this.code, required this.child});

  final String? code;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    if (code == null || code!.isEmpty) return child;

    final stories = ref.watch(storiesOfProvider(code!)).valueOrNull;
    if (stories == null || stories.isEmpty) return child;

    return GestureDetector(
      onTap: () => context.push(Routes.story(code!)),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: t.accentGradient,
        ),
        child: Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(shape: BoxShape.circle, color: t.bg1),
          child: child,
        ),
      ),
    );
  }
}

class _HeroAvatar extends StatelessWidget {
  const _HeroAvatar({
    required this.user,
    required this.profile,
    required this.glow,
    required this.business,
  });

  final User user;
  final ActiveProfile? profile;
  final Color glow;
  final bool business;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // Biznes kontekstida hisob egasining avatariga QAYTILMAYDI:
    // kompaniya logotipi bo'lmasa, bosh harf ko'rsatiladi. Aks holda
    // biznes profilida odamning surati turardi.
    final avatar = (profile?.avatarUrl ?? '').isNotEmpty
        ? profile!.avatarUrl
        : (business ? '' : user.avatarUrl);

    return SizedBox(
      width: 112,
      height: 112,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: glow,
                  blurRadius: 46,
                  offset: const Offset(0, 20),
                ),
              ],
            ),
            child: Avatar(
              url: avatar,
              initials: user.initials,
              size: 112,
              ringColor: business ? t.accentB : null,
            ),
          ),
          // Nishon FAQAT haqiqiy holat bo'lganda: asosiy ID yoki biznes.
          if (profile != null && (profile!.isBusiness || profile!.id!.primary))
            Positioned(
              right: 2,
              bottom: 2,
              child: Container(
                width: 27,
                height: 27,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [t.accentB, t.accentBDark],
                  ),
                  border: Border.all(color: t.bg1, width: 3.4),
                  boxShadow: [BoxShadow(color: t.glowB, blurRadius: 12)],
                ),
                child: Icon(
                  profile!.isBusiness
                      ? Icons.storefront_rounded
                      : Icons.check_rounded,
                  size: 12,
                  color: kOnAccent,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// NFC ID kapsulasi — Concept B'dagi nuqta + kod.
///
/// Nuqta bezak emas: ID faol bo'lmasa u so'nik rangda turadi.
class _IdPill extends StatelessWidget {
  const _IdPill({required this.code, required this.active});
  final String code;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final dot = active ? t.success : t.text3;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: t.surface2,
        borderRadius: R.pill,
        border: Border.all(color: t.border2),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: dot,
              boxShadow: [BoxShadow(color: dot, blurRadius: 9)],
            ),
          ),
          const SizedBox(width: Gap.sm),
          Flexible(
            child: Text(
              code,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppType.monoStyle(
                color: t.accent3,
                size: 11.5,
                weight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Statistika — katta karta emas, uchta kapsula.
class _StatCapsules extends StatelessWidget {
  const _StatCapsules({required this.profile});
  final ActiveProfile? profile;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final items = [
      (formatCount(profile?.posts ?? 0), l.profilePosts),
      (formatCount(profile?.followers ?? 0), l.profileFollowers),
      (formatCount(profile?.following ?? 0), l.profileFollowing),
    ];

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: Gap.sm),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: Gap.md),
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: R.pill,
                border: Border.all(color: t.border2),
              ),
              child: Column(
                children: [
                  Text(
                    items[i].$1,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    items[i].$2,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _BusinessTiles extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final tiles = [
      (Icons.dashboard_rounded, l.bizDashboard, Routes.businessDashboard),
      (Icons.inventory_2_rounded, l.bizCatalog, Routes.businessCatalog),
      (Icons.insights_rounded, l.bizAnalytics, Routes.businessAnalytics),
      (Icons.storefront_rounded, l.bizStorefront, Routes.business),
    ];
    return Wrap(
      spacing: Gap.md,
      runSpacing: Gap.md,
      children: [
        for (final e in tiles)
          PressableScale(
            onTap: () => context.push(e.$3),
            child: Container(
              width:
                  (MediaQuery.sizeOf(context).width -
                      Gap.screenX * 2 -
                      Gap.md) /
                  2,
              padding: const EdgeInsets.all(Gap.lg),
              decoration: BoxDecoration(
                color: t.surface,
                borderRadius: R.gentle,
                border: Border.all(color: t.border2),
                boxShadow: t.shadowTiny,
              ),
              child: Row(
                children: [
                  Icon(e.$1, size: 19, color: t.accentBDark),
                  const SizedBox(width: Gap.sm),
                  Expanded(
                    child: Text(
                      e.$2,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _PostsGrid extends ConsumerWidget {
  const _PostsGrid({required this.code, this.company = false});
  final String code;

  /// `true` — kod KOMPANIYA identifikatori, NFC yozuvi emas.
  final bool company;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    // Ikki manba ikki xil endpoint: shaxsiy yozuv
    // `/api/records/:code/posts`, kompaniya esa
    // `/api/companies/:id/posts`. Ilgari ikkalasi uchun ham birinchi
    // yo'l chaqirilardi.
    final posts = ref.watch(
      company ? companyPostsProvider(code) : profilePostsProvider(code),
    );

    return posts.when(
      loading: () => Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        child: Wrap(
          spacing: 6,
          runSpacing: 6,
          children: List.generate(
            6,
            (_) => Skeleton(
              width:
                  (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3,
              height:
                  (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3,
              radius: R.tile,
            ),
          ),
        ),
      ),
      error: (e, __) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        child: StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () => ref.invalidate(profilePostsProvider(code)),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: FloatingSurface(
              solid: true,
              child: Column(
                children: [
                  Icon(Icons.photo_library_outlined, size: 27, color: t.text3),
                  const SizedBox(height: Gap.sm),
                  Text(
                    l.stateEmpty,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          );
        }
        final side =
            (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final p in items)
                PressableScale(
                  onTap: () => context.push(Routes.post(p.id, code: code)),
                  child: ClipRRect(
                    borderRadius: R.tile,
                    child: SizedBox(
                      width: side,
                      height: side,
                      child: p.mediaUrls.isEmpty
                          ? Container(
                              color: t.surface2,
                              padding: const EdgeInsets.all(Gap.sm),
                              child: Text(
                                p.text,
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            )
                          : p.isVideo
                          // VIDEO KATAKCHASI — BIRINCHI KADR.
                          //
                          // Ilgari bu yerda `CachedNetworkImage`
                          // turardi va unga `.mp4` manzili
                          // berilardi — rasm yuklovchi uni hech
                          // qachon ocholmaydi, shuning uchun video
                          // post BO'SH kvadrat bo'lib turardi.
                          // Keyin o'rniga ijro belgisi qo'yildi,
                          // lekin muqova baribir ko'rinmasdi.
                          //
                          // Server video uchun surat (poster)
                          // bermaydi, shuning uchun muqovani
                          // ilovaning o'zi ochadi: `InlineVideo`
                          // faylni yuklab birinchi kadrni chizadi.
                          //
                          // `autoPlay: false` SHART — aks holda
                          // panjaradagi hamma video bir vaqtda
                          // o'ynab, ovozlar qo'shilib ketardi va
                          // telefon qiynalardi.
                          ? Stack(
                              fit: StackFit.expand,
                              children: [
                                InlineVideo(
                                  key: ValueKey('tile-${p.id}'),
                                  url: p.mediaUrls.first,
                                  autoPlay: false,
                                ),
                                const DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.center,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        Colors.transparent,
                                        Color(0x55000000),
                                      ],
                                    ),
                                  ),
                                ),
                                const Align(
                                  alignment: Alignment.bottomRight,
                                  child: Padding(
                                    padding: EdgeInsets.all(6),
                                    child: Icon(
                                      Icons.play_circle_fill_rounded,
                                      size: 20,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : Stack(
                              fit: StackFit.expand,
                              children: [
                                mediaImage(context, p.mediaUrls.first,
                                    fit: BoxFit.cover),
                                if (p.isVideo)
                                  const Positioned(
                                    right: 5,
                                    top: 5,
                                    child: Icon(
                                      Icons.play_circle_fill_rounded,
                                      size: 15,
                                      color: Colors.white,
                                    ),
                                  ),
                              ],
                            ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
