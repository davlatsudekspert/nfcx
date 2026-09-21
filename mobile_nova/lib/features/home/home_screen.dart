import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/utils/sharing.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/motion/motion.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/nfc_orb.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../profile/music_player.dart';
import '../social/feed_card.dart';
import '../nfc/qr_sheet.dart';
import 'widgets/avatar.dart';
import 'widgets/nfc_mobile_section.dart';
import 'widgets/identity_card.dart';
import 'widgets/mode_switch.dart';
import '../../app/profile_context.dart';
import '../../data/repositories/business_repository.dart';
import '../profile/profile_switcher.dart';
import '../social/visible_fraction.dart';
import '../../routing/shell.dart';

/// Faol NFC ID ning story'lari.
final homeStoriesProvider = FutureProvider.autoDispose<List<StoryItem>>((
  ref,
) async {
  final p = ref.watch(activeProfileProvider);
  if (p == null) return const [];
  // Kompaniya istoryalari boshqa jadvalda va boshqa manzilda
  // (`/api/companies/:id/stories`). Shaxsiy yo'lni kompaniya kodi
  // bilan chaqirish bo'sh ro'yxat qaytarardi.
  final res = p.isBusiness
      ? await ref.watch(businessRepositoryProvider).stories(p.code)
      : await ref.watch(socialRepositoryProvider).storiesOf(p.code);
  final own = res.when(ok: (v) => v, err: (e) => throw e);

  // OBUNA BO'LGANLARNING ISTORYALARI HAM QO'SHILADI.
  //
  // Ilgari bu qator FAQAT o'z profilingni ko'rsatardi: obuna
  // bo'lganing odam istorya qo'ysa, ilovada uni ko'rishning iloji
  // yo'q edi. Server uchun `GET /api/stories/feed` allaqachon bor
  // edi — ilova uni chaqirmasdi.
  //
  // Xatosi YUTILADI: obuna lentasi kelmasa ham o'z istoryang
  // ko'rinaverishi kerak, butun qator yo'qolib qolmasin.
  final followed = await ref.watch(socialRepositoryProvider).followedStories();
  return [...own, ...followed.valueOrNull ?? const <StoryItem>[]];
});

/// Lentaning boshidagi postlar.
final homeFeedProvider = FutureProvider.autoDispose<List<Post>>((ref) async {
  final res = await ref.watch(socialRepositoryProvider).feed();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Joriy rejimga mos NFC ID.
///
/// Biznes rejimida biznes ID'si, shaxsiyda shaxsiysi tanlanadi; mos
/// keladigani bo'lmasa asosiy ID qaytadi.
final activeIdProvider = Provider<NfcId?>((ref) {
  final ids = ref.watch(myIdsProvider);
  if (ids.isEmpty) return null;
  final mode = ref.watch(modeProvider);
  final want = mode == AppMode.business
      ? NfcIdKind.business
      : NfcIdKind.personal;
  final match = ids.where((e) => e.kind == want);
  if (match.isNotEmpty) {
    return match.firstWhere((e) => e.primary, orElse: () => match.first);
  }
  return ids.firstWhere((e) => e.primary, orElse: () => ids.first);
});

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  /// Ro'yxat kontrolleri — "Asosiy" qayta bosilganda tepaga
  /// qaytarish uchun. Boshqa hech qayerda ishlatilmaydi.
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// Eng tepaga — animatsiya bilan.
  void _toTop() {
    if (!_scroll.hasClients) return;
    // Allaqachon tepada bo'lsa hech narsa qilinmaydi: keraksiz
    // animatsiya ham, `jumpTo` sakrashi ham bo'lmaydi.
    if (_scroll.offset <= 0) return;
    _scroll.animateTo(
      0,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    // "Asosiy" tugmasi Home'da turib bosilganda signal keladi.
    ref.listen<int>(homeReselectProvider, (_, __) => _toTop());

    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final mode = ref.watch(modeProvider);
    final active = ref.watch(activeProfileProvider);
    final noBusiness = ref.watch(businessMissingProvider);

    // Identifikatsiya kartasi, QR va ulashish FAQAT NFC yozuvida
    // ma'noli — kompaniyaning QR kodi shaxsiy yozuvniki emas.
    final id = active != null && !active.isBusiness ? active.id : null;

    if (user == null) return const SizedBox.shrink();

    return NovaScaffold(
      body: RefreshIndicator(
        color: t.accent2,
        backgroundColor: t.surfaceSolid,
        onRefresh: () async {
          await ref.read(sessionProvider.notifier).refresh();
          ref.invalidate(homeStoriesProvider);
          ref.invalidate(homeFeedProvider);
        },
        child: NovaScroll(
          controller: _scroll,
          padding: EdgeInsets.only(bottom: navSafeBottom(context)),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                Gap.screenX,
                Gap.sm,
                Gap.screenX,
                0,
              ),
              child: Row(
                children: [
                  // SALOMLASHUV VA HISOB NOMI OLIB TASHLANDI.
                  //
                  // Bu yerda "Xayrli tong" va hisob login nomi
                  // (`ali77099`) turardi. Pastda avatar, ism
                  // ("Muhammad") va lavozim baribir ko'rinadi —
                  // ya'ni tepadagi blok bir xil ma'lumotni ikkinchi
                  // marta, lekin XOM ko'rinishda takrorlardi.
                  const Spacer(),
                  NovaIconButton(
                    icon: Icons.notifications_none_rounded,
                    tooltip: l.activityTitle,
                    onPressed: () => context.push(Routes.activity),
                  ),
                  const SizedBox(width: Gap.sm),
                  NovaIconButton(
                    icon: Icons.settings_outlined,
                    tooltip: l.settings,
                    onPressed: () => context.push(Routes.settings),
                  ),
                ],
              ),
            ),
            const SizedBox(height: Gap.lg),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: ModeSwitch(
                mode: mode,
                onChanged: (m) => m == AppMode.business
                    ? switchToBusiness(context, ref)
                    : switchToPersonal(context, ref),
              ),
            ),
            const SizedBox(height: Gap.xl),
            if (active != null)
              _IdentityHero(
                user: user,
                profile: active,
                // ORB SKANERGA OLIB BORMAYDI.
                //
                // Ilgari bu yerda `Routes.nfcScan` turardi va orbning
                // BUTUN yuzasi skanerni ochardi. Avatar esa orb ichida,
                // ya'ni suratni (yoki story halqasini) bosgan odam NFC
                // skaneriga tushib, apparati yo'q qurilmada "Bu
                // qurilmada NFC yo'q" degan xabarni olardi — story
                // ochilishi kerak bo'lgan joyda.
                //
                // NFC endi FAQAT pastki navigatsiyaning markaziy
                // tugmasi va NFC markazi orqali ochiladi. Orbni bosish
                // o'z profilini ochadi — bu kutilgan, zararsiz amal.
                onTap: () => context.push(
                  active.isBusiness
                      ? Routes.business
                      : Routes.nfcId(active.code),
                ),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: id == null
                  ? (noBusiness
                        ? _NoBusinessCard(
                            onPersonal: () => switchToPersonal(context, ref),
                          )
                        : _NoIdCard(onShop: () => context.push(Routes.shop)))
                  : IdentityCard(
                      user: user,
                      id: id,
                      mode: mode,
                      onTap: () => context.push(Routes.nfcId(id.code)),
                      onQr: () => showQrSheet(context, id),
                      onShare: () => shareLink(id.publicUrl(kApiBase)),
                    ),
            ),
            const SizedBox(height: Gap.xxl),
            _QuickActions(mode: mode),
            _StoriesRow(user: user),
            // BOSH EKRAN TARTIBI:
            //   faol NFC ID karta → tezkor amallar → storylar →
            //   NFC Mobile.
            //
            // "NFC ID'larim" va "So'nggi harakatlar" bu yerdan
            // OLIB TASHLANDI — o'chirilmadi:
            //
            //   * ID'lar ro'yxati endi PROFIL ichida turadi va u
            //     yerdan to'liq boshqaruvga o'tiladi. Yo'l NFC
            //     markazi, Sozlamalar va tezkor amallardan ham
            //     ochiq — hech bir kirish nuqtasi yo'qolmadi;
            //   * harakatlar ekrani tepadagi qo'ng'iroq
            //     tugmasidan ochiladi (o'sha joyda turibdi).
            //
            // Bo'shagan joyni tanishtiruv bo'limi egallaydi:
            // ilovaga birinchi kirgan odam pastga tushmasdan
            // "bu ilova nima beradi" degan savolga javob olsin.
            const NfcMobileSection(),

            // HAQIQIY LENTA — tanishtiruv bo'limidan KEYIN.
            //
            // TARTIB ATAYLAB SHUNDAY. Tanishtiruv bo'limi yangi
            // odam uchun: u "bu ilova nima beradi" degan savolga
            // javob beradi va uni pastga tushishga undaydi. Lenta
            // esa QAYTIB KELGAN odam uchun — u har kuni yangi
            // narsa ko'rish uchun keladi.
            //
            // `homeFeedProvider` allaqachon e'lon qilingan va
            // yangilanganda invalidate qilinardi, LEKIN hech
            // qayerda chizilmasdi: ya'ni so'rov yuborilmasdi ham,
            // bosh sahifada post umuman ko'rinmasdi.
            const _HomeFeed(),
            const SizedBox(height: Gap.xxl),
          ],
        ),
      ),
    );
  }
}

/// Home'ning IDENTITY OBYEKTI — markazlashgan NFC orb.
///
/// Concept B'da Home dashboard emas: uning markazida NFC orb turadi
/// va ism, rol, NFC ID undan pastda ierarxiya hosil qiladi. Shu
/// tartibda ekran "boshqaruv paneli" emas, "raqamli shaxs" bo'lib
/// o'qiladi.
///
/// Orb markazida FAQAT belgi — plastina yo'q, shakl yaxlit qoladi.
class _IdentityHero extends ConsumerWidget {
  const _IdentityHero({required this.user, required this.profile, this.onTap});

  final User user;

  /// Faol kontekst — shaxsiy yozuv yoki kompaniya.
  ///
  /// Ilgari bu yerda `NfcId` turardi, ya'ni biznes rejimida ham
  /// shaxsiy yozuv chizilardi.
  final ActiveProfile profile;

  /// Orbni bosish O'Z PROFILINI ochadi. NFC skaneri ATAYLAB emas:
  /// u faqat pastki navigatsiyaning markaziy tugmasida va NFC
  /// markazida bo'lishi kerak.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final width = MediaQuery.sizeOf(context).width;

    // 360 da ~208, 390 da ~226, 430 da ~249 — ekranni egallab
    // ketmaydi, lekin baribir ekranning eng katta obyekti.
    // HERO BIROZ IXCHAM.
    //
    // Ilgari orb ekran kengligining 58% ini olardi va u bilan
    // birga halqalar butun yuqori yarmini egallab, lenta ekran
    // ostiga tushib ketardi.
    final orb = (width * .50).clamp(176.0, 216.0);

    final title = profile.name.isNotEmpty
        ? profile.name
        : (profile.isBusiness ? '' : user.displayName);
    final subtitle = profile.subtitle;

    // Home — "raqamli shaxs" ekrani, shuning uchun orb markazida ODAM
    // turadi: faol NFC ID'ning surati, u bo'lmasa hisobning surati.
    // Ikkalasi ham bo'lmasa — brend belgisi. Bo'sh kulrang doira yoki
    // "surat yo'q" ikonkasi HECH QACHON ko'rsatilmaydi.
    //
    // NFC markazida esa bu mantiq YO'Q: u ekran amal haqida, shaxs
    // haqida emas, shuning uchun u yerda doim belgi turadi.
    // Biznes kontekstida hisob egasining suratiga QAYTILMAYDI —
    // kompaniya logotipi bo'lmasa brend belgisi chiziladi.
    final avatar = profile.avatarUrl.isNotEmpty
        ? profile.avatarUrl
        : (profile.isBusiness ? '' : user.avatarUrl);

    // Story halqasi FAQAT haqiqiy ma'lumotdan. `homeStoriesProvider`
    // backenddan faol ID ning story lentasini oladi; bizga ularning
    // ichidan AYNAN SHU ID ga tegishlilari kerak. Hech narsa
    // to'qilmaydi: so'rov yuklanayotgan bo'lsa ham, xato bo'lsa ham
    // halqa ko'rsatilmaydi.
    final mine = ref
        .watch(homeStoriesProvider)
        .maybeWhen(
          data: (all) => all
              .where((s) => s.code.isEmpty || s.code == profile.code)
              .toList(),
          orElse: () => const <StoryItem>[],
        );
    final ring = mine.isEmpty
        ? null
        : _StoryRingState(count: mine.length, unseen: mine.any((s) => !s.seen));

    return Column(
      children: [
        NfcOrb(
          size: orb,
          onTap: onTap,
          child: avatar.isEmpty
              ? BrandLogo(
                  size: orb * kOrbMarkRatio,
                  style: BrandLogoStyle.markOnly,
                  // Yadro endi qorong'i — belgi oltin bo'ladi.
                  tint: t.accent2,
                )
              : _OrbAvatar(
                  url: avatar,
                  orb: orb,
                  initials: user.initials,
                  music: profile.musicUrls,
                  ring: ring,
                  // Story BOR bo'lsa — Story Viewer.
                  //
                  // Story YO'Q bo'lsa `null` qoladi va bosish orbning
                  // o'z amaliga o'tadi (profil). Muhimi: ikkala holatda
                  // ham NFC skaneri OCHILMAYDI.
                  onOpenStory: ring == null
                      ? null
                      : () => context.push(Routes.story(profile.code)),
                ),
        ),
        const SizedBox(height: Gap.lg),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.xxl),
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppType.displayStyle(color: t.text1, size: 27),
          ),
        ),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.xxl),
            child: Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
        // NFC ID bu yerda TAKRORLANMAYDI: u darhol pastdagi kartada,
        // katta monospace bilan turadi va ierarxiyani davom ettiradi
        // (orb -> ism -> rol -> kod). Ikki joyda ko'rsatilsa, u
        // ierarxiya emas, takror bo'lardi.
        const SizedBox(height: Gap.lg),
      ],
    );
  }
}

/// Orb yadrosidagi foydalanuvchi surati.
///
/// Yadro organik shakl, uning eng tor joyidagi radiusi `orb * .270`.
/// Surat doirasi `orb * .46` diametrda — ya'ni radiusi `orb * .23`.
/// Orasidagi ~15% bo'shliq oltin halqa bo'lib qoladi: surat yadroni
/// to'lg'azib yubormaydi, nafas va wobble paytida ham qirraga
/// tegmaydi.
/// Foydalanuvchining o'z story'lari haqidagi HAQIQIY holat.
class _StoryRingState {
  const _StoryRingState({required this.count, required this.unseen});

  /// Nechta story bor — halqa shuncha bo'lakka bo'linadi.
  final int count;

  /// Hech bo'lmasa bittasi ko'rilmaganmi.
  final bool unseen;
}

class _OrbAvatar extends StatelessWidget {
  const _OrbAvatar({
    required this.url,
    required this.orb,
    required this.initials,
    this.music = const [],
    this.ring,
    this.onOpenStory,
  });

  final String url;
  final double orb;
  final String initials;

  /// `null` — story yo'q, halqa CHIZILMAYDI.
  final _StoryRingState? ring;
  final VoidCallback? onOpenStory;

  /// Profil musiqasi. Bo'sh bo'lsa boshqaruv UMUMAN ko'rinmaydi.
  final List<String> music;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // Halqa bo'lsa surat bir oz kichrayadi — halqa yadro qirrasiga
    // yaqinlashib qolmasligi uchun. 2% farq ko'zga tashlanmaydi.
    final d = orb * (ring == null ? .46 : .44);

    // Surat yuklanmaguncha yoki xato bo'lganda — bo'sh doira emas,
    // brend belgisi. Orb hech qachon "sinmaydi".
    Widget fallback() => Center(
      child: BrandLogo(
        size: orb * kOrbMarkRatio,
        style: BrandLogoStyle.markOnly,
        tint: t.onAccent,
      ),
    );

    // Halqa suratdan TASHQARIDA turadi va yadroga tegmaydi:
    //   surat  d        = orb * .46
    //   bo'shliq 3.5px + halqa 2.2px  => tashqi diametr d + 11.4
    //   yadroning eng tor diametri    = orb * .540
    // 390px ekranda: 104 -> 115.4 va yadro 122 — ya'ni ikki tomondan
    // ~3.3px oltin ko'rinib turadi. Halqa ataylab ingichka: orbning
    // o'z halo va pulse halqalari bilan raqobatlashmasligi kerak.
    const gap = 4.0;
    final stroke = ring != null && ring!.unseen ? 2.6 : 1.8;
    final outer = d + (gap + stroke) * 2;

    final photo = SizedBox(
      width: d,
      height: d,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            // Juda yengil soya — surat yadro ichida "yotgandek"
            // ko'rinsin, lekin atrofida qorong'i halqa hosil
            // BO'LMASIN: oltin sirtda qora halqa darhol "teshik"
            // bo'lib o'qiladi.
            BoxShadow(
              color: Colors.black.withValues(alpha: .09),
              blurRadius: 22,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipOval(
          child: Stack(
            fit: StackFit.expand,
            children: [
              CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                fadeInDuration: Motion.med,
                placeholder: (_, __) => fallback(),
                errorWidget: (_, __, ___) => fallback(),
              ),
              // Nozik ichki qirra — surat bilan oltin orasida yumshoq
              // o'tish, qattiq kesilgan chekka emas.
              DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withValues(alpha: .34),
                    width: 1.2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    // Surat bo'lsa ham brend butunlay yo'qolmaydi: suratning pastki
    // o'ng chekkasida kichik muhr turadi.
    //
    // Muhr ATAYLAB suratning ICHIDA: markazi markazdan `ra - rb - 2`
    // masofada, ya'ni eng tashqi nuqtasi surat qirrasiga yetmaydi.
    // Shunda u story halqasiga ham, yadro qirrasiga ham tegmaydi.
    final rb = d * .15;
    final off = (d / 2 - rb - 2) / math.sqrt2;

    final avatar = SizedBox(
      width: d,
      height: d,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          photo,
          // SURAT USTIDA FAQAT BITTA NISHON — MUSIQA.
          //
          // Ilgari bu yerda ikkita nishon turardi: pastki o'ngda
          // NFC brend muhri, pastki chapda musiqa tugmasi. Ikkalasi
          // birga suratning pastki yarmini yopib qo'yardi. Brend
          // belgisi ekranda allaqachon bor (orbning o'zi, sozlamalar,
          // yuklanmagan surat o'rnidagi belgi), shuning uchun muhr
          // olib tashlandi va MUSIQA nishoni uning o'rniga —
          // pastki o'ngga ko'chirildi.
          //
          // Musiqa yo'q bo'lsa `MusicControl` bo'sh widget qaytaradi,
          // ya'ni surat butunlay ochiq qoladi.
          Positioned(
            left: d / 2 + off - rb,
            top: d / 2 + off - rb,
            child: MusicControl(urls: music, size: rb * 2),
          ),
        ],
      ),
    );

    if (ring == null) return avatar;

    return GestureDetector(
      onTap: onOpenStory,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: outer,
        height: outer,
        child: CustomPaint(
          painter: _StoryRingPainter(t: t, state: ring!, stroke: stroke),
          child: Center(child: avatar),
        ),
      ),
    );
  }
}

/// Story halqasi.
///
/// Instagram gradienti EMAS: ranglar mavzuning o'z aksentlaridan
/// olinadi, shuning uchun halqa beshala mavzuda ham o'zinikidek
/// ko'rinadi.
///
/// Ko'rilmagan story — aksent gradientida, aniq va yorug'.
/// Ko'rilgan story — bitta so'nik ohangda, ingichkaroq. Farq bir
/// qarashda bilinadi, lekin e'tiborni tortib olmaydi.
class _StoryRingPainter extends CustomPainter {
  _StoryRingPainter({
    required this.t,
    required this.state,
    required this.stroke,
  });

  final NfcTokens t;
  final _StoryRingState state;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = (size.width - stroke) / 2;
    final rect = Rect.fromCircle(center: c, radius: r);

    // HALQA FAQAT YORUG' OHANGDA.
    //
    // Birinchi urinishda bu yerda `[accent3, accent1, accent2,
    // accent3]` sweep gradienti bor edi va halqa deyarli
    // KO'RINMASDI: u oltin yadro USTIDA turadi, aksentlarning
    // ko'pchiligi esa o'sha oltinning o'zi. Oltin ustida oltin
    // yo'qoladi — bu ilovada allaqachon uchragan muammo.
    //
    // Shuning uchun halqa doim yadrodan YORUG'ROQ: `accent1` dan
    // uning oqartirilgan variantigacha. Sweep sheni saqlaydi
    // (metall yaltirashi), lekin yoyning HECH BIR joyida qorayib
    // ketmaydi.
    final bright = Color.lerp(t.accent1, Colors.white, .78)!;

    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = stroke;

    if (state.unseen) {
      p.shader = SweepGradient(
        colors: [t.accent1, bright, t.accent1, bright, t.accent1],
        stops: const [0, .25, .5, .75, 1],
        transform: const GradientRotation(-math.pi / 2),
      ).createShader(rect);
    } else {
      // Ko'rilgan: o'sha oila, lekin so'nik — "bor, endi muhim emas".
      p.color = bright.withValues(alpha: .38);
    }

    // Bitta story bo'lsa yaxlit halqa. Bir nechta bo'lsa — shuncha
    // bo'lak. Bo'lak soni ataylab cheklangan: 8 tadan ortig'i
    // punktir chiziqqa aylanib, bezakka aylanardi.
    final segments = state.count <= 1 ? 1 : math.min(state.count, 8);
    if (segments == 1) {
      canvas.drawCircle(c, r, p);
      return;
    }

    const gapAngle = .10;
    final step = 2 * math.pi / segments;
    for (var i = 0; i < segments; i++) {
      final start = -math.pi / 2 + i * step + gapAngle / 2;
      canvas.drawArc(rect, start, step - gapAngle, false, p);
    }
  }

  @override
  bool shouldRepaint(_StoryRingPainter old) =>
      old.state.count != state.count ||
      old.state.unseen != state.unseen ||
      old.t.id != t.id ||
      old.stroke != stroke;
}

/// NFC ID hali yo'q — do'konga yo'naltiruvchi holat.
/// Biznes rejimi tanlangan, lekin hisobda kompaniya yo'q.
///
/// Bu holat ATAYLAB ko'rsatiladi. Jimgina shaxsiy profilga qaytish
/// aynan avvalgi xatoning o'zi bo'lardi: tugma "Biznes" da turib,
/// ekranda shaxsiy ma'lumot ko'rinardi.
class _NoBusinessCard extends StatelessWidget {
  const _NoBusinessCard({required this.onPersonal});
  final VoidCallback onPersonal;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return FloatingSurface(
      solid: true,
      child: Column(
        children: [
          Icon(
            Icons.storefront_outlined,
            size: 26,
            color: context.tokens.text3,
          ),
          const SizedBox(height: Gap.sm),
          Text(
            l.businessNoneTitle,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 4),
          Text(
            l.businessNoneHint,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: Gap.lg),
          NovaButton(
            label: l.modePersonal,
            tone: ButtonTone.quiet,
            onPressed: onPersonal,
          ),
        ],
      ),
    );
  }
}

class _NoIdCard extends StatelessWidget {
  const _NoIdCard({required this.onShop});
  final VoidCallback onShop;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return FloatingSurface(
      borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.nfc_rounded, size: 30, color: t.accent2),
          const SizedBox(height: Gap.md),
          Text(l.homeNoId, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(l.homeNoIdHint, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: Gap.xl),
          NovaButton(
            label: l.homeShop,
            onPressed: onShop,
            icon: Icons.storefront_rounded,
          ),
        ],
      ),
    );
  }
}

/// Tezkor amallar — Concept B'dagi `chip-scroll` kapsulalari.
///
/// Avval bu yerda 104x98 li to'rtburchak plitkalar qatori turardi:
/// rangli doira + ikki qatorli yozuv. U "boshqaruv paneli" tilida
/// gapirardi, holbuki Concept B'da Home'ning butun pastki qismi
/// KAPSULA tilida — orbdan keyin hech qanday karta kelmaydi.
///
/// Endi umumiy `Capsule` widgetidan foydalaniladi: bir xil balandlik,
/// bir xil radius va bir xil bosilish javobi butun ilovada.
class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.mode});
  final AppMode mode;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);

    // Biznes rejimida tezkor amallar BOSHQACHA — bu rejim almashuvi
    // shunchaki rang o'zgarishi emasligining amaliy isboti.
    final actions = mode == AppMode.business
        ? [
            (Icons.dashboard_rounded, l.bizDashboard, Routes.businessDashboard),
            (Icons.inventory_2_rounded, l.bizCatalog, Routes.businessCatalog),
            (Icons.insights_rounded, l.bizAnalytics, Routes.businessAnalytics),
            (Icons.storefront_rounded, l.bizStorefront, Routes.business),
          ]
        : [
            (Icons.nfc_rounded, l.nfcScanShort, Routes.nfcScan),
            (Icons.badge_rounded, l.nfcMyIds, Routes.nfcIds),
            (Icons.add_circle_outline_rounded, l.postCreate, Routes.postCreate),
            (Icons.storefront_rounded, l.homeShop, Routes.shop),
          ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
      // Gorizontal ro'yxat EMAS, `Wrap`: rus tilidagi uzun yorliqlar
      // ("Сканировать", "Аналитика") ekranga sig'masa, qator o'zi
      // ikkiga bo'linadi va qatori bo'ylab MARKAZDA qoladi — Concept
      // B'dagi `justify-content:center` shu. Hech narsa gorizontal
      // aylantirishga yashirinmaydi.
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: Gap.sm,
        runSpacing: Gap.sm,
        children: [
          for (final (icon, label, route) in actions)
            Capsule(icon: icon, label: label, onTap: () => context.push(route)),
        ],
      ),
    );
  }
}

class _StoriesRow extends ConsumerWidget {
  const _StoriesRow({required this.user});
  final User user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final stories = ref.watch(homeStoriesProvider);
    final id = ref.watch(activeIdProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: l.homeStories),
        SizedBox(
          height: 92,
          child: stories.when(
            loading: () => ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              itemCount: 5,
              separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
              itemBuilder: (_, __) => const Skeleton(height: 62, circle: true),
            ),
            error: (_, __) => const SizedBox.shrink(),
            data: (all) {
              // BITTA ODAM — BITTA DOIRACHA.
              //
              // Server istoryalarni odam bo'yicha guruhlab beradi,
              // bu yerda esa ular yassi ro'yxat bo'lib keladi. Agar
              // har bir istoryaga alohida doiracha chizilsa, uchta
              // istorya qo'ygan bitta odam qatorda uch marta
              // takrorlanardi. Doiracha bosilganda baribir o'sha
              // odamning HAMMA istoryasi ochiladi.
              final seenCodes = <String>{};
              final items = <StoryItem>[];
              for (final s in all) {
                if (seenCodes.add(s.code)) items.add(s);
              }
              return ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                itemCount: items.length + 1,
                separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
                itemBuilder: (context, i) {
                  if (i == 0) {
                    return _StoryBubble(
                      label: l.homeYourStory,
                      avatarUrl: user.avatarUrl,
                      initials: user.initials,
                      add: true,
                      onTap: () => context.push(Routes.storyCreate),
                    );
                  }
                  final s = items[i - 1];
                  return _StoryBubble(
                    label: s.authorName.isEmpty
                        ? (id?.name ?? '')
                        : s.authorName,
                    avatarUrl: s.authorAvatar.isEmpty
                        ? s.mediaUrl
                        : s.authorAvatar,
                    initials: user.initials,
                    seen: s.seen,
                    onTap: () => context.push(
                      Routes.story(s.code.isEmpty ? (id?.code ?? '') : s.code),
                    ),
                  );
                },
              );
            },
          ),
        ),
        if (stories.hasError) const SizedBox(height: Gap.sm),
      ],
    );
  }
}

class _StoryBubble extends StatelessWidget {
  const _StoryBubble({
    required this.label,
    required this.avatarUrl,
    required this.initials,
    this.add = false,
    this.seen = false,
    this.onTap,
  });

  final String label;
  final String avatarUrl;
  final String initials;
  final bool add;
  final bool seen;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return PressableScale(
      onTap: onTap,
      child: SizedBox(
        width: 66,
        child: Column(
          children: [
            Stack(
              children: [
                Avatar(
                  url: avatarUrl,
                  initials: initials,
                  size: 62,
                  ringColor: seen ? t.border2 : null,
                ),
                if (add)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 21,
                      height: 21,
                      decoration: BoxDecoration(
                        gradient: t.accentGradient,
                        shape: BoxShape.circle,
                        border: Border.all(color: t.bg1, width: 2),
                      ),
                      child: const Icon(
                        Icons.add_rounded,
                        size: 12,
                        color: kOnAccent,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                color: t.text2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}


/// Bosh sahifadagi lenta.
///
/// MANBA — `/api/feed`, ya'ni Reels va Kashfiyot bilan AYNAN bir
/// xil. Uchala joy uchun uchta so'rov yozilganda biri maxfiylik
/// filtrini yo'qotib qo'yishi mumkin edi.
///
/// Pullik ko'tarilgan kontent (`featured`) shu ro'yxatning
/// boshida keladi — server shunday tartiblaydi. Ilova uni qayta
/// saralamaydi: tartib SERVER qaroridir, aks holda to'lovning
/// ma'nosi ilova versiyasiga bog'liq bo'lib qolardi.
class _HomeFeed extends ConsumerWidget {
  const _HomeFeed();

  /// Bosh sahifada nechta post ko'rsatiladi.
  ///
  /// Bu LENTA EMAS, uning BOSHI: to'liq oqim Kashfiyotda. Bosh
  /// sahifa cheksiz uzaymasligi kerak — pastda NFC bo'limi va
  /// boshqa narsalar bor.
  static const _limit = 5;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final feed = ref.watch(homeFeedProvider);

    return feed.when(
      // Yuklanayotganda BO'SHLIQ emas, skelet: ekran sakramaydi.
      loading: () => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: l.homeFeed),
          const SkeletonList(count: 2, height: 108),
        ],
      ),
      // Lenta kelmasa bosh sahifa YIQILMAYDI — qolgan hamma narsa
      // joyida turadi va faqat shu bo'lim o'rniga sabab chiqadi.
      error: (e, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: l.homeFeed),
          StatePanel.fromError(
            context,
            asAppError(e),
            onRetry: () => ref.invalidate(homeFeedProvider),
          ),
        ],
      ),
      data: (posts) {
        if (posts.isEmpty) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeader(title: l.homeFeed),
              FloatingSurface(
                solid: true,
                child: Text(
                  l.homeFeedEmpty,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ],
          );
        }
        final shown = posts.take(_limit).toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              title: l.homeFeed,
              action: posts.length > _limit ? l.homeFeedMore : null,
              onAction: () => context.go(Routes.discover),
            ),
            _AutoplayFeed(posts: shown),
          ],
        );
      },
    );
  }
}


/// LENTADAGI VIDEO — INSTAGRAM KABI.
///
/// ## QOIDA
///
/// Ekranning yetarli qismi ko'ringan BITTA video o'ynaydi. U
/// "dominant" deb ataladi: ulushi eng katta va `_kThreshold` dan
/// yuqori bo'lgan karta. Dominant almashganda avvalgisi DARHOL
/// to'xtaydi.
///
/// ## NIMA UCHUN OVOZ REYESTRI BILAN
///
/// To'xtatishni bu yer O'ZI qilmaydi — `InlineVideo` dominant
/// bo'lganda `AudioOwner.take()` chaqiradi va reyestr avvalgi
/// egasini to'xtatadi. Ya'ni video, profil musiqasi va istorya
/// BITTA navbatda turadi; bu yerda parallel tizim yo'q.
///
/// Bu vidjet faqat ARIFMETIKA qiladi: kim qancha ko'rinyapti va
/// kim dominant.
///
/// ## CHEGARA NIMA UCHUN IKKITA EMAS
///
/// Bitta chegara (0.65) yetarli, chunki tanlov `argmax` orqali
/// boradi: ikkita karta bir vaqtda chegaradan o'tsa ham, faqat
/// ulushi kattarog'i dominant bo'ladi. "Ikkalasi ham o'ynab
/// ketdi" holati tuzilish jihatidan mumkin emas.
class _AutoplayFeed extends StatefulWidget {
  const _AutoplayFeed({required this.posts});

  final List<Post> posts;

  @override
  State<_AutoplayFeed> createState() => _AutoplayFeedState();
}

class _AutoplayFeedState extends State<_AutoplayFeed> {
  /// Ekranning kamida shuncha qismi ko'rinsa — ijroga nomzod.
  static const _kThreshold = 0.65;

  final _fraction = <int, double>{};
  int? _dominant;

  void _report(int i, double f) {
    _fraction[i] = f;
    final best = dominantIndex(_fraction, threshold: _kThreshold);
    if (best == _dominant) return;
    // O'lchov kadr chizilayotganda keladi — `setState` ni keyingi
    // kadrga suramiz, aks holda "setState during build" chiqadi.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && best != _dominant) setState(() => _dominant = best);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < widget.posts.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: Gap.md),
            child: widget.posts[i].isVideo
                ? VisibleFraction(
                    onChanged: (f) => _report(i, f),
                    child: FeedCard(
                      post: widget.posts[i],
                      activeVideo: _dominant == i,
                    ),
                  )
                : FeedCard(post: widget.posts[i]),
          ),
      ],
    );
  }
}
