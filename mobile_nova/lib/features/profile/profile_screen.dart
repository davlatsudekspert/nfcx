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
import '../../design/widgets/id_plate.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/contact_buttons.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import '../shop/nfc_id_market.dart' show tierLabel;
import '../../design/widgets/id_lux.dart';
import '../home/widgets/mode_switch.dart';
import '../home/widgets/my_ids_strip.dart';
import '../../app/profile_context.dart';
import '../business/business_providers.dart';
import '../business/store_catalog.dart';
import '../../core/utils/external_link.dart';
import '../../data/repositories/business_repository.dart';
import '../nfc/qr_sheet.dart';
import 'profile_switcher.dart';
import '../demo/demo_mode.dart';
import '../demo/demo_mosaic.dart';
import '../social/engagement.dart';
import '../social/story_viewer.dart';
import '../social/video_poster.dart';
import '../social/media_frame.dart';
import '../social/moderation.dart';
import 'music_player.dart';
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
  const ProfileScreen({super.key, this.code, this.companyId});

  /// `null` — o'z profili. Aks holda boshqa foydalanuvchi.
  final String? code;

  /// BIZNES PROFILI (`/c/:companyId`) — shaxsiy profil bilan AYNAN bir
  /// xil premium ko'rinishda (egasi, 2026-09-24: "Tanlovdan biznes
  /// profilga kirganda ham shaxsiy profildek premium bo'lsin").
  /// Qo'shimcha: tavsif va katalog.
  final String? companyId;

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
    final cid = companyId;
    final company = cid != null;
    final companyRemote = company ? ref.watch(storefrontProvider(cid)) : null;
    // O'z kompaniyasi — tahrir tugmasi, shikoyat menyusi yo'q.
    final ownCompany = company &&
        (ref.watch(myBusinessesProvider).valueOrNull?.any(
                (b) => b.companyId.toUpperCase() == cid.toUpperCase()) ??
            false);

    final isMe = company
        ? ownCompany
        : code == null || ids.any((e) => e.code == code);
    final remote = (company || code == null || isMe)
        ? null
        : ref.watch(publicProfileProvider(code!));
    final other = (company || code == null)
        ? null
        : (ids.where((e) => e.code == code).firstOrNull ?? remote?.valueOrNull);
    final active = company
        ? (companyRemote!.valueOrNull == null
            ? null
            : ActiveProfile.company(companyRemote.valueOrNull!))
        : code == null
            ? ref.watch(activeProfileProvider)
            : (other == null ? null : ActiveProfile.personal(other));

    /// Begona (yoki ko'rilayotgan) profil kodi: shaxsiy NFC kodi yoki
    /// `companyId`. `null` — o'z profilim (tab).
    final target = cid ?? code;

    /// BIZNES PROFILI — premium vitrina (shaxsiy profildan ALOHIDA
    /// tuzilma): muqova, logotip, Business ID, ish vaqti, katalog.
    final biz = (active != null && active.isBusiness) ? active.business : null;

    // Biznes rejimi tanlangan, lekin hisobda kompaniya yo'q.
    final noBusiness =
        target == null && ref.watch(businessMissingProvider);

    // QR va ulashish FAQAT NFC yozuvida ma'noga ega — kompaniyaning
    // ommaviy manzili boshqacha quriladi va QR kodi shaxsiy yozuvniki
    // emas. Shuning uchun biznes kontekstida bu tugmalar shaxsiy
    // yozuvga tegmaydi.
    final id = active != null && !active.isBusiness ? active.id : null;

    // Obuna holati — lenta kartasi bilan BITTA manba.
    final following =
        target == null ? false : ref.watch(followingOfProvider(target));

    // DEMO holati. Ishlab chiqarishda DOIM `null` — ya'ni pastdagi
    // hech bir shart ishlamaydi va ekran avvalgidek qoladi.
    final demo = ref.watch(demoModeProvider);

    if (user == null) return const SizedBox.shrink();

    return NovaScaffold(
      // Asosiy tab: pastki bo'shliq `navSafeBottom` da (suzuvchi menyu).
      padBottom: false,
      showBack: target != null,
      actions: target != null
          ? [
              // DEMO profilni shikoyat qilish yoki bloklash
              // ma'nosiz — o'rnida "Demo" yorlig'i turadi.
              if (demo != null)
                Padding(
                  padding: const EdgeInsets.only(right: Gap.sm),
                  child: Capsule(label: l.demoBadge, dense: true),
                )
              else if (company && !ownCompany) ...[
                // Biznesga shikoyat va uni bloklash (Play UGC talabi).
                NovaIconButton(
                  key: const ValueKey('storefront-actions'),
                  icon: Icons.more_horiz_rounded,
                  tooltip: l.reportTitle,
                  onPressed: () => showContentActions(
                    context,
                    ref,
                    target: ReportTarget.company,
                    targetId: cid,
                    ownerCode: cid,
                    blockKind: BlockKind.company,
                    blockId: cid,
                    keyPrefix: 'storefront',
                  ),
                ),
                const SizedBox(width: Gap.sm),
              ] else if (!company) ...[
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
          if (company) {
            ref
              ..invalidate(storefrontProvider(cid))
              ..invalidate(businessCatalogProvider(cid))
              ..invalidate(companyPostsProvider(cid));
            return;
          }
          await ref.read(sessionProvider.notifier).refresh();
          if (!context.mounted) return;
          // Biznes profilda KOMPANIYA postlari yangilanadi (UIQ-1:
          // ilgari faqat shaxsiy ro'yxat yangilanardi).
          if (active != null && active.isBusiness) {
            ref.invalidate(companyPostsProvider(active.code));
          } else if (id != null) {
            ref.invalidate(profilePostsProvider(id.code));
          }
        },
        child: NovaScroll(
          padding: EdgeInsets.only(bottom: navSafeBottom(context)),
          // POSTLAR TO'RI — `children` dan KEYIN, sliver (dangasa).
          // Ilgari u `children` ichida `Wrap` edi va profil ochilishi
          // bilan HAMMA postning rasmi yuklanib, har video uchun muqova
          // navbatga qo'yilardi. To'r bo'lmaganda ham bo'sh sliver:
          // profil kelganda scroll turi (va ichidagi holat) almashmasin.
          tail: active == null
              ? const SliverToBoxAdapter()
              : _PostsGrid(code: active.code, company: active.isBusiness),
          children: [
            if (biz != null)
              _StorefrontHeader(business: biz)
            else
              _Hero(
                  user: user,
                  profile: active,
                  mode: company ? AppMode.business : mode),
            const SizedBox(height: Gap.xl),
            if (isMe && target == null)
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
            const SizedBox(height: Gap.lg),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: biz != null
                  ? _StoreStats(business: biz)
                  : _StatCapsules(profile: active),
            ),
            const SizedBox(height: Gap.lg),
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
                          ? Icons.edit_outlined
                          : (following
                              ? Icons.check_rounded
                              : Icons.person_add_alt_rounded),
                      tone: (!isMe && following)
                          ? ButtonTone.outline
                          : ButtonTone.accent,
                      // BIZNES REJIMIDA — BIZNES TAHRIRI (egasi, 2026-09:
                      // "biznes profilni tahrirlash yo'q"). Ilgari bu
                      // tugma har doim shaxsiy NFC ID tahririni ochardi.
                      onPressed: isMe
                          ? () => context.push(company ||
                                  (ref.read(activeProfileProvider)?.isBusiness ??
                                      false)
                              ? Routes.businessEdit
                              : Routes.profileEdit)
                          : () async {
                              final e = await ref
                                  .read(followOverridesProvider.notifier)
                                  .toggle(target!,
                                      following: following, company: company);
                              if (e == null || !context.mounted) return;
                              ScaffoldMessenger.of(context)
                                ..hideCurrentSnackBar()
                                ..showSnackBar(SnackBar(
                                    content: Text(describeError(l, e))));
                            },
                    ),
                  ),
                  const SizedBox(width: Gap.md),
                  // QR — NFC yozuvida uning manzili, biznesda
                  // `nfcstore.uz/c/<ID>` (vitrina manzili).
                  NovaIconButton(
                    key: const ValueKey('profile-qr'),
                    icon: Icons.qr_code_rounded,
                    tooltip: l.nfcShowQr,
                    size: 52,
                    onPressed: biz != null
                        ? () => showQrSheet(
                            context,
                            NfcId(code: biz.companyId, name: biz.displayName),
                            urlOverride: demo?.shareUrl ??
                                '$kApiBase/c/${Uri.encodeComponent(biz.companyId)}')
                        : id == null
                            ? null
                            : () => showQrSheet(context, id,
                                urlOverride: demo?.shareUrl),
                  ),
                  const SizedBox(width: Gap.sm),
                  NovaIconButton(
                    icon: Icons.ios_share_rounded,
                    tooltip: l.actionShare,
                    size: 52,
                    onPressed: id == null && biz == null
                        ? null
                        : () async {
                            // Tizim oynasi ochilmasa manzil buferga
                            // ko'chiriladi — odam boshi berk
                            // ko'chada qolmasin.
                            final String url;
                            if (biz != null) {
                              url = demo?.shareUrl ??
                                  '$kApiBase/c/${Uri.encodeComponent(biz.companyId)}';
                            } else {
                              if (id == null) return;
                              url = demo?.shareUrl ?? id.publicUrl(kApiBase);
                            }
                            final ok = await shareLink(url);
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
            // ALOQA TUGMALARI — saytdagi biznes sahifasidek logoli
            // dumaloq tugmalar (egasi, 2026-09). Bo'sh bo'lsa chizilmaydi.
            if (active != null && active.contact.actions().isNotEmpty) ...[
              const SizedBox(height: Gap.xl),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: ContactButtons(actions: active.contact.actions()),
              ),
            ],
            // BUYURTMA — egasi yoqqan bo'lsa (mavjud server oqimi).
            if (biz != null && biz.ordersEnabled && !isMe) ...[
              const SizedBox(height: Gap.md),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: NovaButton(
                  key: const ValueKey('store-order'),
                  label: l.storeOrder,
                  icon: Icons.shopping_bag_outlined,
                  tone: ButtonTone.quiet,
                  onPressed: () =>
                      showOrderSheet(context, companyId: biz.companyId),
                ),
              ),
            ],
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
            if (companyId == null &&
                code == null && ref.watch(myIdsProvider).isNotEmpty) ...[
              SectionHeader(
                title: l.nfcMyIds,
                action: l.actionSeeAll,
                onAction: () => context.push(Routes.nfcIds),
              ),
              const MyIdsStrip(),
            ],
            if (biz != null && isMe && !noBusiness) ...[
              SectionHeader(title: l.bizTitle),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: _BusinessTiles(),
              ),
            ],
            // KATALOG — rasmli toifalar + 4 ta tovar + "Barchasini
            // ko'rish" (to'liq ro'yxat alohida sahifada).
            if (biz != null) StoreCatalogPreview(business: biz),
            // Sarlavha o'rniga "Postlar | Reels" tablari — ular
            // `_PostsGrid` ichida (shaxsiy profilda). Kompaniyada
            // oddiy sarlavha qoladi.
            if (active == null || active.isBusiness)
              SectionHeader(title: l.profilePosts)
            else
              const SizedBox(height: Gap.xl),
            // Begona profil hali kelmagan yoki kelmadi — SABABNI
            // ko'rsatamiz. Ilgari bu yerda "Do'kondan karta oling
            // yoki ID yarating" chiqardi, ya'ni begona odamning
            // profili o'rniga MENGA tegishli maslahat.
            if (active == null && (remote ?? companyRemote) != null)
              (remote ?? companyRemote)!.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(horizontal: Gap.screenX),
                  child: SkeletonList(count: 3),
                ),
                error: (e, __) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                  child: StatePanel.fromError(
                    context,
                    asAppError(e),
                    onRetry: () {
                      if (company) {
                        ref
                          ..invalidate(storefrontProvider(cid))
                          ..invalidate(businessCatalogProvider(cid));
                      } else {
                        ref.invalidate(publicProfileProvider(code!));
                      }
                    },
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
              ),
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
            shaderCallback: (rect) => LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              // Uch emas, to'rt to'xtash: shaffoflikning O'ZGARISH
              // TEZLIGI ham asta susayadi. Ikki bosqichli chiziqli
              // so'nishda burilish nuqtasi ko'z uchun yengil chiziq
              // (Mach band) bo'lib seziladi.
              //
              // MUQOVA YO'Q BO'LSA — TEPADAN HAM ASTA PAYDO BO'LADI.
              // Nur aynan sarlavha paneli ostidan eng kuchli holatda
              // boshlanardi va panel bilan orasida KESKIN CHIZIQ
              // ko'rinardi (2026-09 dizayn tekshiruvi).
              colors: [
                cover.isEmpty ? const Color(0x00FFFFFF) : Colors.white,
                Colors.white,
                const Color(0x40FFFFFF),
                Colors.transparent,
              ],
              stops: const [0, .30, .70, 1],
            ).createShader(rect),
            blendMode: BlendMode.dstIn,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (cover.isEmpty)
                  DecoratedBox(
                    decoration: BoxDecoration(
                      // ATMOSFERA — DOG' EMAS.
                      //
                      // ## NIMA UCHUN DIAGONAL EMAS
                      //
                      // Ilgari bu yerda chap tepadan o'ng pastga
                      // ketadigan DIAGONAL gradient turardi.
                      // Alfani pasaytirish yetmadi: muammo
                      // kuchda emas, YO'NALIShDA edi. Diagonal
                      // gradient bitta burchakni ajratib
                      // ko'rsatadi va ko'z uni fon emas, ekranga
                      // tushgan DOG' deb o'qiydi. `noir`,
                      // `graphite` va `onyx` da u zaytun-kulrang
                      // iflos burchak bo'lib turardi.
                      //
                      // Radial gradient esa SIMMETRIK: markazi
                      // tepada, hamma tomonga teng so'nadi. Hech
                      // bir burchak ajralmaydi, shuning uchun u
                      // dog' emas, YORUG'LIK bo'lib ko'rinadi.
                      //
                      // ## KUCH
                      //
                      // Qorong'i mavzularda ham pasaytirildi:
                      // .24 hali og'ir edi. `washScale` esa
                      // oq-qora mavzuda buni yana susaytiradi,
                      // chunki u yerda aksent qora.
                      gradient: RadialGradient(
                        center: Alignment.topCenter,
                        radius: 1.15,
                        colors: [
                          t.wash(tone, .17),
                          t.wash(toneDark, .05),
                          Colors.transparent,
                        ],
                        stops: const [0, .55, 1],
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
                // Muqova bo'lsa avatar uning ustiga tushadi (86); muqova
                // yo'q bo'lsa tepada ortiqcha bo'sh joy qolmasin —
                // avatar sarlavhaga yaqin, ko'z darhol ism va ID'ga
                // tushadi (egasi, 2026-09: "yuqoridagi bo'sh joy").
                SizedBox(height: cover.isEmpty ? 16 : 86),
                _DemoNotice(sample: profile?.isDemo ?? false),
                // ISTORYA HALQASI — FAQAT istorya BOR bo'lsa.
                //
                // Ilgari profil ekrani istoryani umuman
                // ko'rsatmasdi: odam istorya qo'yardi, lekin uni
                // profilidan ochib bo'lmasdi. Halqa ro'yxat bo'sh
                // bo'lganda umuman chizilmaydi, shuning uchun
                // istoryasiz profil avvalgidek ko'rinadi.
                _AvatarWithStory(
                  code: profile?.code,
                  isBusiness: business,
                  child: _HeroAvatar(
                    user: user,
                    profile: profile,
                    glow: glow,
                    business: business,
                  ),
                ),
                // Ism avatarga yopishib qolmasin.
                const SizedBox(height: Gap.lg),
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
                // BIO — DEMO PROFILDA.
                //
                // Odam "bu profil bo'sh emas" degan fikrni ism va
                // rolning o'zidan olmaydi: unga nima qilishi
                // yozilgan bo'lishi kerak. Haqiqiy profil bu
                // qatorni ko'rsatmaydi — u yerda tartib
                // o'zgarmaydi.
                _DemoBio(text: profile?.bio ?? ''),
                if (profile != null) ...[
                  const SizedBox(height: Gap.md),
                  _IdPill(
                    code: profile!.code,
                    // Kompaniyada "faol" holati `status` bilan
                    // beriladi, shaxsiy yozuvda — `active`.
                    active: profile!.isBusiness
                        ? profile!.business!.isPublished
                        : profile!.id!.active,
                    // Kompaniyada daraja tushunchasi yo'q.
                    tier: profile!.isBusiness ? '' : profile!.id!.tier,
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
/// Demo profilning bio matni.
///
/// Odam "bu profil bo'sh emas" degan fikrni ism va rolning
/// o'zidan olmaydi: unga nima qilishi yozilgan bo'lishi kerak.
/// Haqiqiy profil bu qatorni KO'RSATMAYDI — u yerda tartib
/// o'zgarmaydi.
class _DemoBio extends ConsumerWidget {
  const _DemoBio({required this.text});

  final String text;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Haqiqiy profilda ham ko'rinadi (egasi, 2026-09: profil saytdagidek
    // bo'lsin). Ilgari bio faqat namuna (demo) profilda chiqardi —
    // odam tahrirda yozgan matnini profilida umuman ko'rmasdi.
    if (text.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: Gap.md),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: Theme.of(context)
            .textTheme
            .bodySmall
            ?.copyWith(height: 1.5, color: context.tokens.text2),
      ),
    );
  }
}

/// "Bu namuna" eslatmasi.
///
/// O'zi `demoModeProvider` ni o'qiydi, shuning uchun uni ekranning
/// istalgan joyiga qo'yish mumkin va ishlab chiqarishda u
/// UMUMAN chizilmaydi.
class _DemoNotice extends ConsumerWidget {
  const _DemoNotice({this.sample = false});

  /// Serverdagi NAMUNA biznes (to'qima profil, 2026-09-25): kapsula
  /// ishlab chiqarishda ham chiqadi — tashrifchi aldanmasin.
  final bool sample;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!sample && ref.watch(demoModeProvider) == null) {
      return const SizedBox.shrink();
    }
    final t = context.tokens;
    // YUMSHOQ KAPSULA.
    //
    // Ilgari bu matn to'g'ridan-to'g'ri MUQOVA SURATI ustida
    // turardi va o'qilmasdi: har bir profilning muqovasi boshqa
    // rangda. Kapsula o'z foniga ega, shuning uchun u har qanday
    // surat ustida bir xil o'qiladi.
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.lg),
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: Gap.md, vertical: Gap.sm),
        decoration: BoxDecoration(
          color: t.surfaceSolid.withValues(alpha: .86),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: t.border2),
        ),
        child: Text(
          sample ? L.of(context).sampleBusinessNotice : L.of(context).demoNotice,
          key: sample ? const ValueKey('sample-business-notice') : null,
          textAlign: TextAlign.center,
          style: Theme.of(context)
              .textTheme
              .bodySmall
              ?.copyWith(color: t.text2, height: 1.4),
        ),
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
  const _AvatarWithStory({
    required this.code,
    required this.child,
    this.isBusiness = false,
  });

  final String? code;

  /// Kod kompaniyanikimi.
  ///
  /// Shaxsiy va kompaniya istoryalari serverda boshqa manzilda
  /// yashaydi (`StoryOwner` izohiga qarang). Usiz kompaniya
  /// istoryasi saytda ko'rinib, ilovada halqa umuman
  /// chizilmasdi.
  final bool isBusiness;

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    if (code == null || code!.isEmpty) return child;

    final owner = StoryOwner(code!, isBusiness: isBusiness);
    final stories = ref.watch(storiesOfProvider(owner)).valueOrNull;
    if (stories == null || stories.isEmpty) return child;

    return GestureDetector(
      onTap: () =>
          context.push(Routes.story(code!, business: isBusiness)),
      child: Container(
        // HALQA QALINLIGI — 3 dan 4.5 ga.
        //
        // 3 dp 112 dp li avatar yonida ingichka ip bo'lib
        // ko'rinardi: "istorya bor" belgisi sezilmasdi. Halqa
        // belgi, bezak emas — u ko'zga birinchi tashlanishi
        // kerak.
        padding: const EdgeInsets.all(5),
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          // OLTIN + ZUMRAD — bosh sahifa va istoriyalar qatori bilan bir xil.
          gradient: IdPlate.storyRing,
        ),
        child: Container(
          // Ichki oraliq esa biroz torroq: halqa qalinlashgani
          // bilan butun doira kattalashib ketmasin, aks holda
          // avatar sahifadagi boshqa elementlardan uzoqlashadi.
          padding: const EdgeInsets.all(2.5),
          decoration: BoxDecoration(shape: BoxShape.circle, color: t.bg1),
          child: child,
        ),
      ),
    );
  }
}

/// Profil avatari. Egasi (2026-09-25): "avatar kichkina bo'lib qolgan,
/// kattalashtirish kerak" — 112 dan 136 ga.
const double _heroAvatar = 136;

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
      width: _heroAvatar,
      height: _heroAvatar,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                // Mayinroq nur: ilgari u pastga 20 px tushib, ism
                // yozuvining ostida jigarrang "dog'" bo'lib turardi.
                BoxShadow(
                  color: glow,
                  blurRadius: 40,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            // HALQA — MAYIN BREND RANGI (bosh sahifadagi portret bilan
            // bir xil). Ilgari qalin qora siyoh halqa edi va profil
            // bosh sahifadan og'irroq ko'rinardi.
            child: Avatar(
              url: avatar,
              // Ko'rilayotgan profilning bosh harflari — ilgari begona
              // odam yoki kompaniyada ham KO'RUVCHINING o'z harflari
              // ("TF") chiqardi.
              initials: _nameInitials(profile?.name ?? '') ?? user.initials,
              size: _heroAvatar,
              ringWidth: 1.6,
              ringColor: business
                  ? t.accentB
                  : t.brand.withValues(alpha: .6),
            ),
          ),
          // MUSIQA — pastki CHAPDA.
          //
          // Play testeri: "Musiqa yo'q". Musiqa tahrirlash ekranida
          // qo'shilardi, lekin FAQAT bosh sahifa orbida chalinardi —
          // profilda (o'zimniki ham, boshqa odamniki ham) belgi ham,
          // pleyer ham yo'q edi. Ya'ni mehmon uni hech qachon
          // eshitmasdi.
          //
          // Chapda turadi: o'ng pastki burchak tasdiq/biznes belgisi
          // uchun band. Musiqa yo'q bo'lsa `MusicControl` o'zi bo'sh
          // widget qaytaradi.
          if ((profile?.musicUrls ?? const <String>[]).isNotEmpty)
            Positioned(
              left: 0,
              bottom: 0,
              child: MusicControl(
                urls: profile!.musicUrls,
                size: 34,
                ownerName: profile!.name,
                ownerAvatar: avatar,
              ),
            ),
          // NISHON FAQAT IKKI HOLATDA: biznes yoki HAQIQIY tasdiq.
          //
          // Ilgari shart `profile!.id!.primary` edi — ya'ni ✓
          // har bir odamning asosiy ID'sida chizilardi. Odam esa
          // uni Instagram'dagi ko'k belgidek o'qiydi: "bu hisob
          // tasdiqlangan". Natijada ilova HAMMANI tasdiqlangan
          // deb ko'rsatib turardi.
          //
          // Serverda haqiqiy `cards.verified` maydoni bor va uni
          // admin qo'yadi — endi nishon aynan shunga bog'liq.
          // "Asosiy ID" esa ishonch bildiruvchi belgi emas: u
          // shunchaki qaysi karta birinchi ekanini bildiradi va
          // NFC ID ro'yxatida allaqachon ko'rinadi.
          //
          // NAMUNA biznesda nishon YO'Q: u to'qima profil, tasdiqlangan
          // emas — o'rniga tepada «Namuna» kapsulasi turadi.
          if (profile != null &&
              ((profile!.isBusiness && !profile!.isDemo) || profile!.verified))
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
                  color: t.onAccent,
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
  const _IdPill({
    required this.code,
    required this.active,
    this.tier = '',
  });
  final String code;
  final bool active;

  /// NFC ID darajasi — qimmat kod oltin bo'lib chiziladi.
  final String tier;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // Teskari (quyuq) fonda yashil nuqta yo'qoladi — u yerda
    // siyoh rangida chiziladi.
    final dot = active ? t.success : t.text3;

    // QIMMAT KOD AJRALIB TURSIN — LEKIN QOIDA BITTA JOYDA.
    //
    // Profil — odam o'z ID'sini eng ko'p ko'radigan joy. Ilgari
    // bu yerda ranglar QO'LDA takrorlangan edi va `IdPlate`
    // o'zgarganda profil orqada qolardi: bitta kod Tanlovda
    // oltin, profilda kulrang ko'rinardi.
    //
    // Endi ikkalasi ham `IdPlate.skin()` dan o'qiydi. Kapsulaning
    // SHAKLI o'ziniki bo'lib qoladi (nuqta + kengroq to'ldirish),
    // faqat RANG umumiy.
    final c = IdPlate.skin(t, tier, active: active);

    // Qimmat daraja yozuv bilan ham aytiladi (rang yolg'iz yetmaydi:
    // rang ko'rmaydiganlar va oq-qora skrinshot uchun).
    final precious = IdPlate.isPrecious(tier);

    // PULLIK ID — METALL KAPSULA: material yuza, metall hoshiya,
    // folga raqam va toifa belgisi (`id_lux.dart` — hamma joyda bir xil).
    final lux = active ? IdLux.of(t, tier) : null;
    if (lux != null) {
      return Container(
        key: const ValueKey('profile-id-pill-lux'),
        padding: const EdgeInsets.all(1.2),
        decoration: BoxDecoration(
          gradient: lux.edge,
          borderRadius: R.pill,
          boxShadow: lux.depth,
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 7, 7, 7),
          decoration: BoxDecoration(gradient: lux.surface, borderRadius: R.pill),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(shape: BoxShape.circle, color: dot),
              ),
              const SizedBox(width: Gap.sm),
              Flexible(child: LuxIdNumber(code: code, lux: lux, size: 16)),
              const SizedBox(width: Gap.md),
              IdTierBadge(tier: tier, dense: true),
            ],
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      decoration: BoxDecoration(
        color: c.fill,
        borderRadius: R.pill,
        border: Border.all(color: c.line),
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
              // Nur (glow) emas — ingichka halqa.
              boxShadow: [
                BoxShadow(color: dot.withValues(alpha: .18), spreadRadius: 3),
              ],
            ),
          ),
          const SizedBox(width: Gap.sm),
          Flexible(
            child: Text(
              code,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppType.monoStyle(
                color: c.ink,
                size: 15,
                weight: FontWeight.w600,
                letterSpacing: 2.4,
              ),
            ),
          ),
          if (precious) ...[
            const SizedBox(width: Gap.md),
            Text(
              tierLabel(L.of(context), tier).toUpperCase(),
              maxLines: 1,
              style: AppType.eyebrow(color: c.ink.withValues(alpha: .75), size: 9),
            ),
          ],
        ],
      ),
    );
  }
}

/// Statistika — katta karta emas, uchta kapsula.
/// Uchta raqam: postlar, obunachilar, obunalar.
///
/// ## RAQAMLAR QAYERDAN KELADI — VA NIMA UCHUN ILGARI 0 EDI
///
/// Ilgari uchalasi ham `ActiveProfile` dan, ya'ni oxir-oqibat
/// `GET /api/records/:code` javobidan o'qilardi. O'sha javobda
/// esa `posts`, `followers`, `following` maydonlari UMUMAN YO'Q
/// (o'lchab tekshirilgan — javobda 50 ga yaqin maydon bor,
/// bulardan bittasi ham emas). Model `?? 0` qilardi, ekran esa
/// har doim uchta nol ko'rsatardi — profilda 10 ta post va
/// o'nlab obunachi bo'lsa ham.
///
/// Endi:
///   * obunachilar/obunalar — `GET /api/follow-stats/:code`
///     (server hisoblaydi, obuna bosilgach qayta o'qiladi);
///   * postlar — profil postlari ro'yxatining uzunligi, ya'ni
///     ekranning O'ZI ko'rsatib turgan narsa. Yangi endpoint
///     o'ylab topilmadi.
///
/// Javob hali kelmagan bo'lsa raqam o'rniga "—" turadi: nol
/// ko'rsatish yolg'on bo'lardi.
///
/// Obunachilar va obunalar BOSILADI — haqiqiy ro'yxat ochiladi.
class _StatCapsules extends ConsumerWidget {
  const _StatCapsules({required this.profile});
  final ActiveProfile? profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final code = profile?.code ?? '';
    final business = profile?.isBusiness ?? false;

    final stats = ref.watch(followStatsProvider(code)).valueOrNull;
    final posts = ref
        .watch(business ? companyPostsProvider(code) : profilePostsProvider(code))
        .valueOrNull
        ?.length;

    String n(int? v) => v == null ? '—' : formatCount(v);

    final items = <(String, String, VoidCallback?)>[
      (n(posts), l.profilePosts, null),
      (
        // Kompaniyada `follow-stats` bo'lmasa — kompaniyaning o'z soni.
        n(stats?.followers ?? (business ? profile?.followers : null)),
        l.profileFollowers,
        code.isEmpty ? null : () => context.push(Routes.followers(code)),
      ),
      (
        // Kompaniya hech kimga obuna bo'lolmaydi — server ham
        // shunday deydi. Raqam ko'rsatiladi, lekin bosilmaydi.
        n(business ? 0 : stats?.following),
        l.profileFollowing,
        code.isEmpty || business
            ? null
            : () => context.push(Routes.following(code)),
      ),
    ];

    final t = context.tokens;

    // QUTILAR EMAS — INGICHKA CHIZIQ.
    //
    // Ilgari har bir raqam o'z kapsulasida, chegara bilan turardi:
    // uchta quti yonma-yon "og'ir" ko'rinardi va sahifaning katta
    // qismini egallardi.
    //
    // `nfcstore.uz/c/...` da esa boshqacha: raqamlar markazda,
    // ustida va ostida bittadan ingichka chiziq, atrofida quti
    // YO'Q. Raqam — serif (brend tili), yorliq — kichik, katta
    // harflarda, keng oraliqli sans. Ilova endi aynan shunday.
    return Column(
      children: [
        _Hairline(color: t.border2),
        // IXCHAM QATOR (egasi, 2026-09: "post, obunachilar turgan
        // joyni kichraytir"): raqam va yorliq bir-biriga yaqin,
        // yuqori-past bo'shliq kichik — lekin bosiladigan maydon
        // 44 dp dan kam emas.
        Padding(
          // Yanada ixcham (egasi, 2026-09-24: "statistika kichikroq,
          // bachkana bo'lmasin").
          padding: const EdgeInsets.symmetric(vertical: Gap.sm),
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: items[i].$3,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 44),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            items[i].$1,
                            maxLines: 1,
                            style: TextStyle(
                              fontFamily: AppType.display,
                              fontFamilyFallback: AppType.displayFallback,
                              fontSize: 19,
                              height: 1.05,
                              color: t.text1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            items[i].$2,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontFamily: AppType.sans,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: .2,
                              color: t.text2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        _Hairline(color: t.border2),
      ],
    );
  }
}

/// Bir piksellik ajratgich — quti o'rniga.
///
/// Balandligi qurilma zichligiga bog'liq: 3x ekranda 1 mantiqiy
/// piksel qalin ko'rinadi, shuning uchun eng ingichka chiziq
/// beriladi.
class _Hairline extends StatelessWidget {
  const _Hairline({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        height: 1 / MediaQuery.devicePixelRatioOf(context),
        color: color,
      );
}

class _BusinessTiles extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final tiles = [
      (Icons.dashboard_outlined, l.bizDashboard, Routes.businessDashboard),
      (Icons.inventory_2_outlined, l.bizCatalog, Routes.businessCatalog),
      (Icons.insights_rounded, l.bizAnalytics, Routes.businessAnalytics),
      (Icons.storefront_outlined, l.bizStorefront, Routes.business),
    ];
    // PREMIUM KARTALAR (egasi, 2026-09-24): Asosiy sahifadagi tezkor
    // amallar bilan BIR TIL — siyoh doira ichida sirt rangidagi belgi,
    // champagne hoshiya, toza oq karta, yengil soya.
    return LayoutBuilder(builder: (context, c) {
      final w = (c.maxWidth - Gap.md) / 2;
      return Wrap(
        spacing: Gap.md,
        runSpacing: Gap.md,
        children: [
          for (final e in tiles)
            PressableScale(
              onTap: () => context.push(e.$3),
              child: Container(
                width: w,
                padding: const EdgeInsets.all(Gap.md),
                decoration: BoxDecoration(
                  color: t.surfaceSolid,
                  borderRadius: R.gentle,
                  border: Border.all(color: t.border1),
                  boxShadow: t.shadowSoft,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: t.text1,
                        border: Border.all(
                            color: t.brand.withValues(alpha: .55)),
                      ),
                      child: Icon(e.$1, size: 19, color: t.surfaceSolid),
                    ),
                    const SizedBox(width: Gap.sm),
                    Expanded(
                      child: Text(
                        e.$2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded,
                        size: 18, color: t.text3),
                  ],
                ),
              ),
            ),
        ],
      );
    });
  }
}

class _PostsGrid extends ConsumerStatefulWidget {
  const _PostsGrid({required this.code, this.company = false});
  final String code;

  /// `true` — kod KOMPANIYA identifikatori, NFC yozuvi emas.
  final bool company;

  @override
  ConsumerState<_PostsGrid> createState() => _PostsGridState();
}

/// POSTLAR | REELS.
///
/// Reels alohida API emas: Reels bo'limi ham aynan shu postlarning
/// VIDEOLILARIDAN quriladi (`reelsProvider`). Shuning uchun tab
/// yangi so'rov yubormaydi — bitta ro'yxat ikkiga ajratiladi va
/// sonlar profildagi "Postlar" soni bilan doim mos keladi.
///
/// "Saqlangan" tabi ATAYLAB yo'q: serverda saqlash API'si yo'q,
/// bo'sh yoki soxta tab ko'rsatilmaydi.
class _PostsGridState extends ConsumerState<_PostsGrid> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final code = widget.code;
    final company = widget.company;
    final l = L.of(context);
    final t = context.tokens;
    // Ikki manba ikki xil endpoint: shaxsiy yozuv
    // `/api/records/:code/posts`, kompaniya esa
    // `/api/companies/:id/posts`. Ilgari ikkalasi uchun ham birinchi
    // yo'l chaqirilardi.
    final posts = ref.watch(
      company ? companyPostsProvider(code) : profilePostsProvider(code),
    );

    // Natija SLIVER: to'r `NovaScroll.tail` sifatida turadi va faqat
    // ko'rinadigan katakchalar quriladi. Qolgan holatlar — oddiy
    // vidjet, `SliverToBoxAdapter` ichida (ko'rinishi o'zgarmagan).
    return posts.when(
      loading: () => SliverToBoxAdapter(
        child: Padding(
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
      ),
      error: (e, __) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: StatePanel.fromError(
            context,
            asAppError(e),
            // To'r qaysi manbani ko'rsatsa, o'shani qayta o'qiydi (UIQ-1).
            onRetry: () => ref.invalidate(company
                ? companyPostsProvider(code)
                : profilePostsProvider(code)),
          ),
        ),
      ),
      data: (all) {
        // Kompaniyada tab yo'q — hammasi bitta to'rda.
        final tabs = !company;
        final photos = all.where((p) => !p.isVideo).toList();
        final reels = all.where((p) => p.isVideo).toList();
        final items = !tabs ? all : (_tab == 0 ? photos : reels);
        final bar = tabs
            ? _GridTabs(
                index: _tab,
                labels: [
                  '${l.profilePosts} · ${photos.length}',
                  '${l.navReels} · ${reels.length}',
                ],
                onChanged: (i) => setState(() => _tab = i),
              )
            : const SizedBox.shrink();
        // Tab paneli HAR DOIM guruhning birinchi bolasi: bo'sh va
        // to'la tab orasida o'tganda u qayta yaratilmaydi (chiziq
        // animatsiyasi sakramaydi, ekran o'quvchi fokusi yo'qolmaydi).
        Widget withBar(Widget body) => SliverMainAxisGroup(
            slivers: [SliverToBoxAdapter(child: bar), body]);
        if (items.isEmpty) {
          return withBar(SliverToBoxAdapter(child: Column(children: [
            Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: FloatingSurface(
              solid: true,
              child: Column(
                children: [
                  Icon(
                      _tab == 1 && tabs
                          ? Icons.slow_motion_video_rounded
                          : Icons.photo_library_outlined,
                      size: 27,
                      color: t.text3),
                  const SizedBox(height: Gap.sm),
                  Text(
                    l.stateEmpty,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ),
          ])));
        }
        // DEMO'DA MOZAIK, HAQIQIY PROFILDA 3x3 TO'R.
        //
        // Demo — reklama: odam shaxsiy profil qanday chiroyli
        // bo'lishini ko'rishi kerak, kvadratchalar to'rini emas.
        // Haqiqiy profil UMUMAN o'zgarmaydi.
        if (ref.watch(demoModeProvider) != null) {
          return withBar(SliverToBoxAdapter(
            child: Column(
                children: [DemoMosaicPosts(items: items, code: code)]),
          ));
        }
        final side =
            (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3;
        // Reels — vertikal (4:5) katakchalar, postlar — kvadrat.
        final tall = tabs && _tab == 1;
        // DANGASA TO'R: faqat ekranga yaqin katakchalar quriladi.
        //
        // Ilgari bu `Wrap` edi — u HAMMA bolasini birdan quradi:
        // 60 postli profil ochilishi bilan 60 ta rasm yuklanib,
        // 30 ta video muqovasi navbatga turardi. Katakcha o'lchami,
        // oralig'i va nisbati AYNAN avvalgidek: kenglik
        // (ekran - 40 - 12) / 3, oraliq 6, Reels 4:5.
        //
        // 1–2 ta postda `Wrap` o'z kengligiga qisqarib, markazda
        // turardi — o'sha joylashuv saqlanadi.
        final cols = items.length < 3 ? items.length : 3;
        final inset = (3 - cols) * (side + 6) / 2;
        return withBar(
          SliverPadding(
            padding: EdgeInsets.symmetric(horizontal: Gap.screenX + inset),
            sliver: SliverGrid.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: cols,
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                childAspectRatio: tall ? 1 / 1.25 : 1,
              ),
              itemCount: items.length,
              itemBuilder: (_, i) {
                final p = items[i];
                return PressableScale(
                  onTap: () => context.push(
                      Routes.post(p.id, code: code, company: company)),
                  child: ClipRRect(
                    borderRadius: R.tile,
                    // O'lchamni to'r katakchasi beradi.
                    child: SizedBox.expand(
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
                          // bermaydi. Ilgari HAR katakcha o'z
                          // `InlineVideo` pleerini ochib turardi —
                          // 10 ta video = 10 ta pleer, telefon
                          // qotardi. Endi `VideoPoster` navbat
                          // bilan BITTA pleerda birinchi kadrni
                          // rasmga oladi va pleerni darhol yopadi.
                          ? Stack(
                              fit: StackFit.expand,
                              children: [
                                VideoPoster(
                                  key: ValueKey('tile-${p.id}'),
                                  url: p.mediaUrls.first,
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
                );
              },
            ),
          ),
        );
      },
    );
  }
}

/// Postlar | Reels — ingichka tagchiziqli matn tablari.
///
/// Soft editorial: to'ldirilgan segment emas, faqat faol yozuv ostida
/// qora chiziq; almashuv 200ms.
class _GridTabs extends StatelessWidget {
  const _GridTabs({
    required this.index,
    required this.labels,
    required this.onChanged,
  });

  final int index;
  final List<String> labels;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.screenX, 0, Gap.screenX, Gap.md),
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: t.border2)),
        ),
        child: Row(
          children: [
            for (var i = 0; i < labels.length; i++)
              Semantics(
                button: true,
                selected: i == index,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(i),
                  child: Padding(
                    padding: const EdgeInsets.only(right: Gap.xl),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeOutCubic,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: i == index ? t.text1 : Colors.transparent,
                            width: 2,
                          ),
                        ),
                      ),
                      child: Text(
                        labels[i],
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 14,
                          fontWeight:
                              i == index ? FontWeight.w700 : FontWeight.w500,
                          color: i == index ? t.text1 : t.text3,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Ismdan ikki harf: "Ali Market" → "AM", "NFCSTORE" → "NF".
/// Bo'sh ism — `null` (chaqiruvchi o'z zaxirasini beradi).
String? _nameInitials(String name) {
  final parts =
      name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return null;
  if (parts.length == 1) {
    final w = parts.first;
    return (w.length >= 2 ? w.substring(0, 2) : w).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ============================================================ BIZNES VITRINASI

/// BIZNES PROFILI BOSHI — premium kompaniya vitrinasi (egasi,
/// 2026-09-24: "business profil oddiy social profil emas, premium
/// kompaniya vitrinasidek ko'rinsin").
///
/// Shaxsiy profildan farqli: keng muqova (banner), uning ustiga
/// tushgan logotip, Business ID + Premium belgisi, soha va shahar,
/// tavsif, ish vaqti ("Hozir ochiq · Bugun 09:00–18:00") va manzil.
/// Muqova bo'lmasa — siyoh fon va champagne nur (demo rasm qo'yilmaydi).
class _StorefrontHeader extends StatelessWidget {
  const _StorefrontHeader({required this.business});
  final Business business;

  static const _coverH = 176.0;
  // Egasi (2026-09-25): avatar/logotip kattaroq — 104 dan 124 ga.
  static const _logo = 124.0;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final b = business;
    final name = b.displayName.isEmpty ? b.companyId : b.displayName;
    final sub = [
      if (b.subcategory.isNotEmpty) b.subcategory,
      if (b.city.isNotEmpty) b.city,
    ].join(' · ');
    // PREMIUM BELGISI — faqat HAQIQIY asos bo'lsa: egasining Premium
    // tarifi yoki qimmat Business ID (gold/premium/exclusive). Bepul
    // ID'ga soxta "Premium" yozilmaydi.
    // Qimmat daraja ID kapsulasining O'ZIDA (metall + yozuv) — alohida
    // belgi faqat egasining Premium tarifi uchun (takror bo'lmasin).
    final premium = b.plan.premium;
    final badge = l.storePremium;

    return Column(
      key: const ValueKey('store-header'),
      children: [
        SizedBox(
          height: _coverH + _logo / 2,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // MUQOVA — to'liq kenglik, pastki burchaklari yumaloq.
              Positioned(
                left: Gap.screenX,
                right: Gap.screenX,
                top: 0,
                height: _coverH,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (b.coverUrl.isNotEmpty)
                        mediaImage(context, b.coverUrl, fit: BoxFit.cover)
                      else
                        const StoreInkCover(),
                      // Pastda yengil soya — logotip halqasi ajralsin.
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Color(0x00000000), Color(0x59000000)],
                            stops: [.45, 1],
                          ),
                        ),
                      ),
                      // Champagne ichki hoshiya — premium ramka.
                      DecoratedBox(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(28),
                          border: Border.all(
                              color: t.brand.withValues(alpha: .35)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // LOGOTIP — muqova ustiga tushadi; istoriya bo'lsa
              // yashil + oltin halqa (bosh sahifadagi bilan bir xil).
              Positioned(
                left: 0,
                right: 0,
                top: _coverH - _logo / 2,
                child: Center(
                  child: _AvatarWithStory(
                    code: b.companyId,
                    isBusiness: true,
                    child: Container(
                      width: _logo,
                      height: _logo,
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            IdPlate.goldLight,
                            IdPlate.gold,
                            IdPlate.goldDeep,
                          ],
                        ),
                        boxShadow: t.shadowFloat,
                      ),
                      child: Container(
                        padding: const EdgeInsets.all(2.5),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: t.surfaceSolid,
                        ),
                        child: Avatar(
                          url: b.logoUrl,
                          initials: _nameInitials(name) ?? '?',
                          size: _logo - 11,
                          ring: false,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: Gap.md),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: Column(
            children: [
              Text(
                name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: AppType.displayStyle(
                    color: t.text1, size: 27, height: 1.12, letterSpacing: -.5),
              ),
              if (sub.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall),
              ],
              // NAMUNA biznes — to'qima profil ekanini aytib turadi.
              if (b.isDemo) ...[
                const SizedBox(height: Gap.md),
                const _DemoNotice(sample: true),
              ],
              const SizedBox(height: Gap.md),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: Gap.sm,
                runSpacing: Gap.sm,
                children: [
                  _IdPill(
                      code: b.companyId, active: b.isPublished, tier: b.tier),
                  if (premium)
                    Container(
                      key: const ValueKey('store-premium'),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        borderRadius: R.pill,
                        gradient: const LinearGradient(colors: [
                          IdPlate.goldLight,
                          IdPlate.gold,
                          IdPlate.goldDeep,
                        ]),
                        boxShadow: t.shadowTiny,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.workspace_premium_rounded,
                              size: 14, color: IdPlate.goldInk),
                          const SizedBox(width: 4),
                          Text(
                            badge.toUpperCase(),
                            style: const TextStyle(
                              fontFamily: AppType.sans,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.2,
                              color: IdPlate.goldInk,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              if (b.description.trim().isNotEmpty) ...[
                const SizedBox(height: Gap.md),
                Text(
                  b.description.trim(),
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: t.text2, height: 1.5),
                ),
              ],
              if (b.openNow != null || b.address.isNotEmpty || b.city.isNotEmpty) ...[
                const SizedBox(height: Gap.md),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: Gap.sm,
                  runSpacing: Gap.sm,
                  children: [
                    if (b.openNow != null)
                      _InfoChip(
                        key: const ValueKey('store-hours'),
                        dot: b.openNow! ? t.success : t.error,
                        text: [
                          b.openNow! ? l.storeOpenNow : l.storeClosedNow,
                          if (b.todayOpen.isNotEmpty && b.todayClose.isNotEmpty)
                            l.storeToday(b.todayOpen, b.todayClose)
                          else
                            l.storeDayOff,
                        ].join(' · '),
                      ),
                    if (b.address.isNotEmpty || b.city.isNotEmpty)
                      _InfoChip(
                        key: const ValueKey('store-address'),
                        icon: Icons.place_outlined,
                        text: [b.city, b.address]
                            .where((e) => e.isNotEmpty)
                            .join(', '),
                        onTap: () => openLink(
                            'https://www.google.com/maps/search/?api=1&query='
                            '${Uri.encodeQueryComponent([b.city, b.address].where((e) => e.isNotEmpty).join(', '))}'),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Kichik ma'lumot kapsulasi (ish vaqti, manzil).
class _InfoChip extends StatelessWidget {
  const _InfoChip({super.key, required this.text, this.icon, this.dot, this.onTap});
  final String text;
  final IconData? icon;
  final Color? dot;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: R.pill,
        border: Border.all(color: t.border1),
        boxShadow: t.shadowTiny,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot != null)
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
            )
          else if (icon != null)
            Icon(icon, size: 15, color: t.text1),
          const SizedBox(width: 6),
          ConstrainedBox(
            constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 60),
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: t.text1,
              ),
            ),
          ),
        ],
      ),
    );
    return onTap == null ? chip : PressableScale(onTap: onTap, child: chip);
  }
}

/// Biznes statistikasi — Mahsulotlar · Obunachilar · Ko'rishlar · Postlar.
class _StoreStats extends ConsumerWidget {
  const _StoreStats({required this.business});
  final Business business;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final code = business.companyId;
    final items =
        ref.watch(businessCatalogProvider(code)).valueOrNull?.length;
    final posts = ref.watch(companyPostsProvider(code)).valueOrNull?.length;
    final followers = ref.watch(followStatsProvider(code)).valueOrNull?.followers ??
        business.followers;
    String n(int? v) => v == null ? '—' : formatCount(v);

    final cells = <(String, String, VoidCallback?)>[
      (n(items), l.storeProducts, () => context.push(Routes.storeCatalog(code))),
      (n(followers), l.profileFollowers,
          () => context.push(Routes.followers(code))),
      (n(business.views), l.nfcViews, null),
      (n(posts), l.profilePosts, null),
    ];
    return Column(
      key: const ValueKey('store-stats'),
      children: [
        _Hairline(color: t.border2),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: Gap.sm),
          child: Row(
            children: [
              for (final c in cells)
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: c.$3,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 44),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            c.$1,
                            maxLines: 1,
                            style: TextStyle(
                              fontFamily: AppType.display,
                              fontFamilyFallback: AppType.displayFallback,
                              fontSize: 19,
                              height: 1.05,
                              color: t.text1,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            c.$2,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: AppType.sans,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: .2,
                              color: t.text2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        _Hairline(color: t.border2),
      ],
    );
  }
}
