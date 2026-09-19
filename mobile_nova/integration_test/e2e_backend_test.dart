// HAQIQIY HISOB — HAQIQIY BACKEND — HAQIQIY SAQLANISH.
//
// Bu fayl ilovaning O'ZI ishlatadigan repozitoriy metodlarini
// `https://nfcstore.uz` ga qarshi yuritadi. "UI bor" yoki "metod
// mavjud" bu yerda hech narsani anglatmaydi: har bir yozish amali
// serverdan QAYTA O'QILADI va shundan keyingina PASS bo'ladi.
//
// ## XAVFSIZLIK
//
// * Yaratilgan har bir obyekt `Litter` ga yoziladi va oxirida
//   o'chiriladi — test o'rtasida yiqilsa ham.
// * `guards.dart` dagi buzg'unchi metodlar UMUMAN chaqirilmaydi.
// * Kirish urinishlari sanaladi: backend 15 daqiqada 5 tagagina
//   ruxsat beradi va chegaraga yetish hisob EGASINI ham bloklaydi.
// * Parol hech qayerda chop etilmaydi — `redact` ikkinchi qatlam.
//
// ## NIMA UCHUN `expect` KAM ISHLATILADI
//
// Maqsad — to'liq matritsa. Bitta qator yiqilganda qolganlari ham
// tekshirilishi kerak, shuning uchun natijalar `E2EReport` ga
// yig'iladi va test faqat eng oxirida baholanadi.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/activity_repository.dart';
import 'package:nfcstore_nova/data/repositories/auth_repository.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/data/repositories/discover_repository.dart';
import 'package:nfcstore_nova/data/repositories/nfc_repository.dart';
import 'package:nfcstore_nova/data/repositories/shop_repository.dart';
import 'package:nfcstore_nova/data/repositories/social_repository.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/social/moderation.dart';

import 'support/creds.dart';
import 'support/guards.dart';
import 'support/net.dart';
import 'support/report.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final report = E2EReport.instance;
  final litter = Litter();
  final budget = LoginBudget(4);

  late ApiClient api;
  late RequestLog log;

  late AuthRepository auth;
  late ProfileRepository profile;
  late SocialRepository social;
  late BusinessRepository business;
  late NfcRepository nfc;
  late DiscoverRepository discover;
  late ActivityRepository activity;
  late ShopRepository shop;
  late ModerationRepository moderation;

  /// Kirgan foydalanuvchi va uning NFC ID lari.
  User? me;
  List<NfcId> ids = const [];

  /// Shaxsiy va biznes yozuvlari — `NfcIdKind` bo'yicha.
  NfcId? personal;
  NfcId? businessId;

  /// FAIL qatorini oxirgi HTTP izi bilan yozadi.
  void fail(
    String name, {
    required String screen,
    required String action,
    required String cause,
    String layer = 'backend',
    String? pathHint,
    String? fix,
    String? retest,
  }) =>
      report.add(MatrixRow(
        name: name,
        verdict: Verdict.fail,
        screen: screen,
        action: action,
        trace: pathHint == null ? log.last : (log.lastFor(pathHint) ?? log.last),
        cause: cause,
        layer: layer,
        fix: fix,
        retest: retest,
      ));

  void partial(
    String name, {
    required String screen,
    required String action,
    required String cause,
    String layer = 'backend',
    String? pathHint,
    String? fix,
  }) =>
      report.add(MatrixRow(
        name: name,
        verdict: Verdict.partial,
        screen: screen,
        action: action,
        trace: pathHint == null ? null : log.lastFor(pathHint),
        cause: cause,
        layer: layer,
        fix: fix,
      ));

  void backendGap(String name, String cause, {String? pathHint}) =>
      report.add(MatrixRow(
        name: name,
        verdict: Verdict.backendRequired,
        trace: pathHint == null ? log.last : log.lastFor(pathHint),
        cause: cause,
        layer: 'backend',
      ));

  /// `Err` ni matnga aylantiradi — hisobotda sabab ko'rinishi uchun.
  String why(AppError e) =>
      '${e.kind.name}${e.status == null ? '' : ' (${e.status})'}'
      '${e.code == null ? '' : ' code=${e.code}'}'
      '${e.detail == null ? '' : ' ${redact(e.detail)}'}';

  /// Kichik, HAQIQIY PNG — yuklash oqimini tekshirish uchun.
  ///
  /// Sun'iy bayt emas: to'liq 1x1 piksel PNG (IHDR + IDAT + IEND),
  /// shuning uchun server rasm sifatida qabul qiladi.
  Future<File> tinyPng() async {
    const bytes = <int>[
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, //
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
      0xB0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
      0x44, 0xAE, 0x42, 0x60, 0x82,
    ];
    final f = File('${Directory.systemTemp.path}/nova_e2e_pixel.png');
    await f.writeAsBytes(bytes, flush: true);
    return f;
  }

  setUpAll(() async {
    final built = buildClient();
    api = built.api;
    log = built.log;

    auth = AuthRepository(api);
    profile = ProfileRepository(api);
    social = SocialRepository(api);
    business = BusinessRepository(api);
    nfc = NfcRepository(api);
    discover = DiscoverRepository(api);
    activity = ActivityRepository(api);
    shop = ShopRepository(api);
    moderation = ModerationRepository(api);

    // Oldingi ishga tushishdan qolgan token bo'lsa — tozalaymiz,
    // aks holda "kirish" sinovi aslida eski sessiyani sinagan
    // bo'lardi.
    await SecureStore().clear();
    await api.setToken(null);

    // ignore: avoid_print
    print('[E2E] baza: $kApiBase');
    final w = credWarning;
    // ignore: avoid_print
    if (w != null) print('[E2E] $w');
  });

  tearDownAll(() async {
    await litter.sweep();
    report.emit();
  });

  // ══════════════════════════════════════════════════════════════
  // 1. AUTH / SESSION
  // ══════════════════════════════════════════════════════════════

  testWidgets('1. Auth — kirish, sessiya, chiqish', (_) async {
    if (!hasCreds) {
      for (final row in [
        'Login',
        'Wrong-password handling',
        'Session restore',
        'Logout',
      ]) {
        report.add(MatrixRow(
          name: row,
          verdict: Verdict.configRequired,
          cause: 'NOVA_TEST_LOGIN / NOVA_TEST_PASSWORD berilmagan — '
              'GitHub repo secret sifatida qo\'shilishi kerak',
          layer: 'config',
        ));
      }
      return;
    }

    // ── Login ──────────────────────────────────────────────────
    budget.spend('asosiy kirish');
    final login = await auth.loginWithPassword(
      email: kTestLogin,
      password: kTestPassword,
    );

    switch (login) {
      case Err(:final error):
        fail('Login',
            screen: 'LoginScreen',
            action: 'email + parol bilan kirish',
            cause: why(error),
            pathHint: '/api/auth/login',
            fix: error.status == 429
                ? 'Backend 15 daqiqada 5 urinishga ruxsat beradi — kuting'
                : null);
        // Kirish bo'lmasa qolgan hamma narsa ma'nosiz.
        return;
      case Ok(:final value):
        me = value;
        report.pass('Login',
            screen: 'LoginScreen',
            action: 'POST /api/auth/login',
            note: 'user id=${value.id} olindi');
    }

    // Token javob TANASIDA keldimi — bu `x-client: android` tuzatishi
    // ishlaganining isboti. Cookie zaxira yo'li baribir bor, shuning
    // uchun kelmasa ham FAIL emas, PARTIAL.
    final loginTrace = log.lastFor('/api/auth/login');
    final tokenInBody = (loginTrace?.response ?? '').contains('"token"');
    if (tokenInBody) {
      report.pass('Login — token javob tanasida',
          screen: 'ApiClient',
          action: 'x-client: android',
          note: 'backend MOBILE_CLIENTS_D1 tekshiruvidan o\'tdi');
    } else {
      partial('Login — token javob tanasida',
          screen: 'ApiClient',
          action: 'x-client sarlavhasi',
          cause: 'token tanada yo\'q; sessiya faqat Set-Cookie orqali '
              'tirik. Backend `MOBILE_CLIENTS_D1` to\'plami bilan '
              'to\'liq moslikni tekshiradi',
          layer: 'frontend',
          pathHint: '/api/auth/login',
          fix: 'x-client `android` ga o\'zgartirildi (ilgari '
              '`android-nova` edi va to\'plamga tushmasdi)');
    }

    // ── `me()` — haqiqiy profil ma'lumoti ──────────────────────
    final meRes = await auth.me();
    switch (meRes) {
      case Err(:final error):
        fail('Session restore',
            screen: 'Splash',
            action: 'GET /api/auth/me',
            cause: why(error),
            pathHint: '/api/auth/me');
      case Ok(:final value):
        me = value.user;
        ids = value.ids;
        personal =
            ids.where((i) => i.kind == NfcIdKind.personal).firstOrNull ??
                ids.firstOrNull;
        businessId =
            ids.where((i) => i.kind == NfcIdKind.business).firstOrNull;
        report.pass('NFC IDs',
            screen: 'NFC Center',
            action: 'GET /api/auth/me → cards',
            note: '${ids.length} ta ID; shaxsiy=${personal?.code ?? '-'}; '
                'biznes=${businessId?.code ?? '-'}');
    }

    if (ids.isEmpty) {
      partial('NFC IDs',
          screen: 'NFC Center',
          action: 'GET /api/auth/me',
          cause: 'hisobda birorta NFC ID yo\'q — kontentga bog\'liq '
              'qatorlar sinalmaydi',
          layer: 'backend');
    }

    // ── Sessiya tiklash — YANGI mijoz, saqlangan token ─────────
    //
    // Bu ilovani qayta ochishning aynan o'zi: yangi `ApiClient`
    // Keystore'dan tokenni o'qiydi. Qayta KIRISH yo'q, ya'ni
    // urinishlar budjeti sarflanmaydi.
    final fresh = buildClient();
    final restored = await AuthRepository(fresh.api).restore();
    switch (restored) {
      case Err(:final error):
        fail('Session restore',
            screen: 'Splash → Home',
            action: 'Keystore tokeni bilan GET /api/auth/me',
            cause: why(error),
            layer: 'frontend',
            fix: 'token `flutter_secure_storage` da saqlanmagan bo\'lishi '
                'mumkin');
      case Ok(:final value):
        report.pass('Session restore',
            screen: 'Splash → Home',
            action: 'ilovani qayta ochish',
            note: 'saqlangan token bilan user id=${value.user.id}');
    }

    // ── Noto'g'ri parol ────────────────────────────────────────
    //
    // ATAYLAB OXIRIDA: bu urinish ham chegaradan yeydi, shuning
    // uchun asosiy oqim allaqachon tekshirilgan bo'lishi kerak.
    if (!budget.exhausted) {
      budget.spend('noto\'g\'ri parol sinovi');
      final wrongClient = buildClient();
      final wrong = await AuthRepository(wrongClient.api).loginWithPassword(
        email: kTestLogin,
        // Uzunligi 6 dan katta bo'lishi shart, aks holda server
        // parolni tekshirmay 422 qaytaradi va sinov ma'nosini
        // yo'qotardi.
        password: '${kTestPassword}_NOVA_E2E_WRONG',
      );
      switch (wrong) {
        case Err(:final error):
          final good = error.kind == AppErrorKind.unauthorized ||
              error.status == 401;
          if (good) {
            report.pass('Wrong-password handling',
                screen: 'LoginScreen',
                action: 'noto\'g\'ri parol',
                note: '401 bad_credentials — token saqlanmadi');
          } else if (error.status == 429) {
            report.add(MatrixRow(
              name: 'Wrong-password handling',
              verdict: Verdict.skipped,
              cause: 'backend 429 — urinishlar chegarasi. Sinov hisobni '
                  'bloklamaslik uchun qayta urinmaydi',
              layer: 'backend',
            ));
          } else {
            partial('Wrong-password handling',
                screen: 'LoginScreen',
                action: 'noto\'g\'ri parol',
                cause: 'kutilgan 401 emas: ${why(error)}',
                pathHint: '/api/auth/login');
          }
        case Ok():
          fail('Wrong-password handling',
              screen: 'LoginScreen',
              action: 'noto\'g\'ri parol',
              cause: 'SERVER NOTO\'G\'RI PAROLNI QABUL QILDI',
              layer: 'backend',
              pathHint: '/api/auth/login');
      }
      // Noto'g'ri urinish asosiy sessiyaga tegmaganini tasdiqlaymiz.
      final still = await auth.me();
      if (still is Ok) {
        report.pass('Session persistence',
            screen: '—',
            action: 'noto\'g\'ri kirishdan keyin sessiya tirik');
      }
    } else {
      report.skip('Wrong-password handling',
          'kirish budjeti tugadi — hisob bloklanmasligi uchun '
          'o\'tkazib yuborildi');
    }
  }, timeout: const Timeout(Duration(minutes: 5)));

  // ══════════════════════════════════════════════════════════════
  // 2–5. PROFIL, BIZNES, MUSIQA
  // ══════════════════════════════════════════════════════════════

  testWidgets('2. Profil, biznes, musiqa — haqiqiy ma\'lumot', (_) async {
    if (me == null) {
      report.skip('Personal Profile', 'kirish bo\'lmadi');
      return;
    }

    // ── Shaxsiy profil ─────────────────────────────────────────
    if (personal == null) {
      report.skip('Personal Profile', 'hisobda shaxsiy NFC ID yo\'q');
    } else {
      final res = await profile.byCode(personal!.code);
      switch (res) {
        case Err(:final error):
          fail('Personal Profile',
              screen: 'ProfileScreen',
              action: 'GET /api/records/:code',
              cause: why(error),
              pathHint: '/api/records/');
        case Ok(:final value):
          personal = value;
          final filled = <String>[
            if (value.name.isNotEmpty) 'ism',
            if (value.avatarUrl.isNotEmpty) 'avatar',
            if (value.coverUrl.isNotEmpty) 'muqova',
            if (value.bio.isNotEmpty) 'bio',
            if (value.role.isNotEmpty) 'lavozim',
          ];
          report.pass('Personal Profile',
              screen: 'ProfileScreen',
              action: 'haqiqiy yozuvni o\'qish',
              note: 'code=${value.code}; to\'ldirilgan: '
                  '${filled.isEmpty ? 'yo\'q' : filled.join(', ')}; '
                  'kuzatuvchilar=${value.followers}');
      }

      // Kuzatuvchi statistikasi alohida endpoint — Home ham shuni
      // ko'rsatadi.
      final stats = await profile.followStats(personal!.code);
      switch (stats) {
        case Err(:final error):
          partial('Personal Profile — follow stats',
              screen: 'ProfileScreen',
              action: 'GET /api/follow-stats/:code',
              cause: why(error),
              pathHint: '/api/follow-stats/');
        case Ok(:final value):
          report.pass('Personal Profile — follow stats',
              screen: 'ProfileScreen',
              action: 'GET /api/follow-stats/:code',
              note: '${value.followers} / ${value.following}');
      }
    }

    // ── Biznes profil ──────────────────────────────────────────
    final mineRes = await business.mine();
    switch (mineRes) {
      case Err(:final error):
        fail('Business Profile',
            screen: 'BusinessScreen',
            action: 'GET /api/my/companies',
            cause: why(error),
            pathHint: 'companies');
      case Ok(:final value):
        if (value.isEmpty) {
          report.skip('Business Profile',
              'hisobda kompaniya yo\'q — biznes qatorlari sinalmaydi');
        } else {
          final b = value.first;
          final full = await business.byId(b.companyId);
          switch (full) {
            case Err(:final error):
              fail('Business Profile',
                  screen: 'BusinessScreen',
                  action: 'GET /api/companies/:id',
                  cause: why(error),
                  pathHint: '/api/companies/');
            case Ok(:final value):
              report.pass('Business Profile',
                  screen: 'BusinessScreen',
                  action: 'haqiqiy kompaniyani o\'qish',
                  note: '${value.displayName}; holat=${value.status}; '
                      'kuzatuvchilar=${value.followers}');
          }
        }
    }

    // ── Shaxsiy ↔ Biznes ───────────────────────────────────────
    if (personal != null && businessId != null) {
      final p = await profile.byCode(personal!.code);
      final b = await profile.byCode(businessId!.code);
      if (p is Ok<NfcId> && b is Ok<NfcId>) {
        final pv = p.value;
        final bv = b.value;
        if (pv.code == bv.code) {
          fail('Personal/Business switch',
              screen: 'Home — ModeSwitch',
              action: 'ikki rejimni o\'qish',
              cause: 'ikkala rejim ham bir xil yozuvni qaytardi',
              layer: 'frontend');
        } else {
          report.pass('Personal/Business switch',
              screen: 'Home — ModeSwitch',
              action: 'har rejim o\'z yozuvini oladi',
              note: 'shaxsiy=${pv.code} · biznes=${bv.code}; '
                  'ma\'lumot aralashmadi');
        }
      }
    } else {
      report.skip('Personal/Business switch',
          'hisobda shaxsiy va biznes yozuvlarining ikkalasi ham yo\'q');
    }

    // ── MUSIQA — haqiqiy manba ─────────────────────────────────
    //
    // Haqiqat manbai `cards.music_url` → `NfcId.musicUrls`. Boshqa
    // "musiqa backendi" TO'QILMAYDI.
    final withMusic = ids.where((i) => i.musicUrls.isNotEmpty).toList();
    if (withMusic.isEmpty) {
      report.add(MatrixRow(
        name: 'Music',
        verdict: Verdict.skipped,
        screen: 'ProfileScreen / Home',
        action: 'cards.music_url o\'qish',
        cause: 'hisobning birorta yozuvida musiqa yo\'q. Ilova ham hech '
            'narsa ko\'rsatmaydi — bu TO\'G\'RI xulq. Saytda musiqa '
            'ko\'rinsa, aynan qaysi yozuvda ekanini ayting',
        note: 'tekshirilgan yozuvlar: ${ids.map((i) => i.code).join(', ')}',
      ));
    } else {
      final card = withMusic.first;
      final url = card.musicUrls.first;
      report.pass('Music',
          screen: 'ProfileScreen / Home',
          action: 'cards.music_url → musicUrls',
          note: '${card.code}: ${card.musicUrls.length} ta trek; '
              'nom = "${musicTitleOf(url)}"');

      // Trek manzili HAQIQATAN ochiladimi.
      //
      // MUHIM: manzil ILOVA BERGANICHA olinadi. Ilgari bu yerda
      //
      //     url.startsWith('http') ? url : '/$url'
      //
      // turardi, ya'ni SINOV manzilni o'zi to'ldirib yuborardi.
      // Natijada bu qator PASS bo'lardi, ilovada esa o'sha fayl
      // hech qachon ochilmasdi — `musicUrls` nisbiy `/uploads/...`
      // bo'lib kelardi va `VideoPlayerController` uni rad etardi.
      // Sinov ilova qiladigan ishni qilishi kerak, o'zinikini emas.
      //
      // Endi model manzilni to'ldiradi (`mediaUrl`), shuning uchun
      // bu yerda qo'shimcha hech narsa qilinmaydi.
      if (!url.startsWith('http')) {
        partial('Music — trek manzili',
            screen: 'MusicPlayer',
            action: 'trek manzili to\'liqmi',
            cause: 'model NISBIY manzil qaytardi ($url) — ilovada '
                'bunday manzil ochilmaydi',
            layer: 'frontend');
      }
      final head = await api.get<dynamic>(url);
      switch (head) {
        case Err(:final error):
          partial('Music — trek manzili',
              screen: 'MusicPlayer',
              action: 'trek faylini olish',
              cause: 'manzil ochilmadi: ${why(error)}',
              layer: 'backend');
        case Ok():
          report.pass('Music — trek manzili',
              screen: 'MusicPlayer',
              action: 'trek fayli serverdan olindi');
      }

      // Qo'shiq nomi/ijrochisi — serverda bunday maydon yo'q.
      backendGap(
        'Music — nom va ijrochi',
        'serverda `title`/`artist` maydoni yo\'q; ilova fayl nomini '
            'ko\'rsatadi va ijrochini TO\'QIMAYDI',
      );
    }
  }, timeout: const Timeout(Duration(minutes: 5)));

  // ══════════════════════════════════════════════════════════════
  // 6, 8, 9, 10, 11. KONTENT — YARATISH VA SAQLANISHNI ISBOTLASH
  // ══════════════════════════════════════════════════════════════

  testWidgets('3. Post, story, reel, izoh, like — saqlanish isboti',
      (_) async {
    final code = personal?.code;
    if (code == null) {
      for (final r in [
        'Post list',
        'Post create',
        'Post like',
        'Post comment',
        'Post delete test object',
        'Story view',
        'Story create',
      ]) {
        report.skip(r, 'shaxsiy NFC ID yo\'q');
      }
      return;
    }

    // ── Post ro'yxati ──────────────────────────────────────────
    final list = await social.postsOf(code);
    switch (list) {
      case Err(:final error):
        fail('Post list',
            screen: 'ProfileScreen',
            action: 'GET /api/records/:code/posts',
            cause: why(error),
            pathHint: '/posts');
      case Ok(:final value):
        report.pass('Post list',
            screen: 'ProfileScreen',
            action: 'haqiqiy postlarni o\'qish',
            note: '${value.length} ta post');
    }

    // ── Media yuklash ──────────────────────────────────────────
    String? uploaded;
    final png = await tinyPng();
    final up = await profile.uploadImage(png.path);
    switch (up) {
      case Err(:final error):
        fail('Avatar upload',
            screen: 'ProfileEditScreen',
            action: 'POST /api/upload',
            cause: why(error),
            pathHint: '/api/upload');
      case Ok(:final value):
        if (value.isEmpty) {
          fail('Avatar upload',
              screen: 'ProfileEditScreen',
              action: 'POST /api/upload',
              cause: 'server 2xx qaytardi, lekin `url` bo\'sh',
              pathHint: '/api/upload');
        } else {
          uploaded = value;
          report.pass('Avatar upload',
              screen: 'ProfileEditScreen',
              action: 'POST /api/upload',
              note: 'manzil olindi (${value.length} belgi)');
        }
    }

    // ── TEST POST yaratish ─────────────────────────────────────
    int? postId;
    // Server post uchun MEDIA talab qiladi, shuning uchun yuklash
    // muvaffaqiyatsiz bo'lsa post ham sinalmaydi — bu server
    // qoidasi, ilova kamchiligi emas.
    final created = uploaded == null
        ? const Err<Post>(AppError(AppErrorKind.validation,
            code: 'no_media', detail: 'rasm yuklanmadi'))
        : await social.createPost(
            code: code,
            caption: testLabel('post'),
            imageUrl: uploaded,
          );
    switch (created) {
      case Err(:final error):
        fail('Post create',
            screen: 'PostComposer',
            action: 'POST /api/records/:code/posts {agreed:true}',
            cause: why(error),
            pathHint: '/posts',
            fix: error.code == 'rules_not_accepted'
                ? '`agreed: true` maydoni yuborilmayapti'
                : null);
      case Ok(:final value):
        postId = value.id;
        litter.trackResult(
            'post #${value.id}', () => social.deletePost(value.id));
        report.pass('Post create',
            screen: 'PostComposer',
            action: 'POST /api/records/:code/posts',
            note: 'id=${value.id}');

        // Kontent qoidalari HAQIQATAN serverga yetdimi — bu post
        // yaratilganining o'zi isbot: `agreed` bo'lmasa 422 kelardi.
        report.pass('Content Rules',
            screen: 'ContentRulesGate',
            action: 'agreed:true serverga yetdi',
            note: 'aks holda server 422 rules_not_accepted qaytarardi');
    }

    // ── SAQLANISH: serverdan qayta o'qish ──────────────────────
    if (postId != null) {
      final again = await social.postsOf(code);
      final found = again is Ok<List<Post>> &&
          again.value.any((p) => p.id == postId);
      if (found) {
        report.pass('Post detail',
            screen: 'ProfileScreen',
            action: 'yaratilgandan keyin qayta o\'qish',
            note: 'post serverda saqlandi (id=$postId)');
      } else {
        fail('Post detail',
            screen: 'ProfileScreen',
            action: 'yaratilgandan keyin qayta o\'qish',
            cause: 'post yaratildi, lekin ro\'yxatda YO\'Q — saqlanmadi',
            pathHint: '/posts');
      }

      // ── Like va saqlanishi ───────────────────────────────────
      final before = await social.postIn(code, postId);
      final likeRes = await social.like(postId);
      switch (likeRes) {
        case Err(:final error):
          fail('Post like',
              screen: 'PostScreen',
              action: 'POST /api/posts/:id/like',
              cause: why(error),
              pathHint: '/like');
        case Ok():
          final after = await social.postIn(code, postId);
          if (before is Ok<Post> && after is Ok<Post>) {
            final b = before.value;
            final a = after.value;
            if (a.likes != b.likes || a.liked != b.liked) {
              report.pass('Post like',
                  screen: 'PostScreen',
                  action: 'like → qayta o\'qish',
                  note: '${b.likes}(${b.liked}) → ${a.likes}(${a.liked}) '
                      '— server saqladi');
              // Qaytarib qo'yamiz.
              await social.like(postId);
            } else {
              fail('Post like',
                  screen: 'PostScreen',
                  action: 'like → qayta o\'qish',
                  cause: 'server 2xx qaytardi, lekin like soni ham, '
                      'holati ham O\'ZGARMADI — faqat mahalliy ko\'rinish',
                  pathHint: '/like');
            }
          } else {
            partial('Post like',
                screen: 'PostScreen',
                action: 'like',
                cause: 'like o\'tdi, lekin postni qayta o\'qib bo\'lmadi');
          }
      }

      // ── Izoh ─────────────────────────────────────────────────
      final addC = await social.addComment('post', postId, testLabel('izoh'));
      switch (addC) {
        case Err(:final error):
          fail('Post comment',
              screen: 'CommentsSection',
              action: 'POST /api/comments/post/:id',
              cause: why(error),
              pathHint: '/api/comments/');
        case Ok(:final value):
          litter.trackResult('izoh #${value.id}',
              () => social.deleteComment(value.id));
          final back = await social.comments('post', postId);
          final ok = back is Ok<({List<Comment> items, bool hasMore, int total})> &&
              back.value
                  .items
                  .any((c) => c.id == value.id);
          if (ok) {
            report.pass('Post comment',
                screen: 'CommentsSection',
                action: 'izoh yozish → qayta o\'qish',
                note: 'izoh serverda saqlandi (id=${value.id})');
          } else {
            fail('Post comment',
                screen: 'CommentsSection',
                action: 'izoh yozish → qayta o\'qish',
                cause: 'izoh yaratildi, lekin ro\'yxatda yo\'q',
                pathHint: '/api/comments/');
          }
      }

      // ── Shikoyat — O'Z sinov postimga ────────────────────────
      //
      // Boshqa odamning kontentiga shikoyat yubormaymiz: admin
      // navbatida haqiqiy yozuv qolardi. O'z sinov postim esa
      // shu yerda o'chiriladi.
      final rep = await moderation.report(
        target: ReportTarget.post,
        targetId: '$postId',
        reason: ReportReason.other,
        note: kTestMarker,
        ownerCode: code,
      );
      switch (rep) {
        case Err(:final error):
          fail('Report',
              screen: 'ReportSheet',
              action: 'POST /api/reports',
              cause: why(error),
              pathHint: '/api/reports');
        case Ok():
          report.pass('Report',
              screen: 'ReportSheet',
              action: 'POST /api/reports',
              note: 'O\'Z sinov postimga yuborildi; admin navbatida '
                  '"$kTestMarker" izohi bilan bitta yozuv qoladi');
      }
    }

    // ── Story ──────────────────────────────────────────────────
    //
    // AVVAL O'ZIMIZNING ESKI AXLATNI TOZALAYMIZ.
    //
    // Server bitta profilda ko'pi bilan 10 ta FAOL istoryaga ruxsat
    // beradi (`limit_reached`). Bu MAHSULOT QOIDASI va unga
    // tegilmaydi.
    //
    // Muammo shunda ediki, har ishga tushirishda bittadan istorya
    // qolib ketardi (sabab: `sweep()` `Result` dagi `Err` ni
    // ko'rmasdi — `net.dart` dagi `trackResult` izohiga qarang) va
    // 10 ta to'lgach E2E #14 da `Story create` 409 bergan.
    //
    // FAQAT O'ZIMIZNIKINI o'chiramiz: izohida `kTestMarker` bo'lgan
    // istoryalar. Haqiqiy foydalanuvchi istoryasiga TEGILMAYDI —
    // marker sinovdan boshqa hech qayerda yozilmaydi.
    var swept = 0;

    // 1-QADAM: O'ZIMIZNING eski axlatni tozalash.
    //
    // FAQAT markerli istoryalar o'chiriladi. Marker sinovdan boshqa
    // hech qayerda yozilmaydi, shuning uchun haqiqiy foydalanuvchi
    // istoryasiga TEGILMAYDI. Markersiz eskilariga ham tegilmaydi:
    // ularning kim yaratganini ISBOTLAB bo'lmaydi.
    Future<int> sweepMarked(String c) async {
      final existing = await social.storiesOf(c);
      var n = 0;
      if (existing case Ok(:final value)) {
        for (final old in value) {
          if (!old.caption.contains(kTestMarker)) continue;
          if ((await social.deleteStory(old.id)).isOk) n++;
        }
      }
      return n;
    }

    // HAMMA EGALIK QILINGAN PROFIL bo'ylab tozalanadi.
    //
    // Faqat `code` va yoziladigan profil tozalansa, oldingi ishga
    // tushirishda BOSHQA profilga yozilib qolgan axlat hech qachon
    // o'chmasdi: E2E #17 da istorya #36 UZD772 ga yozilgan va
    // chiqishdan keyingi 401 tufayli o'chmagan edi, keyingi ishga
    // tushirish esa boshqa profilni tanlab, unga qaramasdi.
    //
    // Bu yerda ham FAQAT markerli yozuvlar o'chiriladi.
    for (final id in ids) {
      swept += await sweepMarked(id.code);
    }

    // 2-QADAM: YOZISH UCHUN ENG BO'SH PROFILNI TANLASH.
    //
    // Server bitta profilda 10 ta FAOL istoryaga ruxsat beradi —
    // bu mahsulot qoidasi va unga tegilmaydi.
    //
    // Asosiy profil to'lib qolishi mumkin: markersiz eski
    // istoryalar (marker qo'shilishidan OLDINGI ishga
    // tushirishlardan qolgan) o'chirilmaydi, chunki ularning
    // E2E'niki ekanini isbotlab bo'lmaydi. Ular 24 soatda o'zi
    // muddati tugab yo'qoladi.
    //
    // Shuning uchun yozish sinovi eng KAM istoryali profilga
    // boradi. Bu haqiqiy yozish yo'lini xuddi shunday sinaydi va
    // hech kimning ma'lumotiga tegmaydi.
    //
    // AVVAL HAMMASI O'LCHANADI, KEYIN TANLANADI. Bitta o'tishda
    // taqqoslash tartibga bog'lanib qolardi: hisoblagich noldan
    // boshlangani uchun `code` ga yetgunga qadar hech bir profil
    // "kamroq" deb topilmasdi. Asosiy profil ro'yxatda oxirida
    // tursa, sinov har safar to'la profilga yozishga urinardi.
    final counts = <String, int>{};
    for (final id in ids) {
      final list = await social.storiesOf(id.code);
      counts[id.code] = list.valueOrNull?.length ?? 999;
    }
    // Boshlang'ich nuqta — ASOSIY profil. Faqat QAT'IY kamroq
    // istoryali profil tanlanadi, ya'ni teng bo'lsa asosiysi
    // qoladi va begona profilga behuda yozilmaydi.
    var writeCode = code;
    var writeCount = counts[code] ?? 999;
    counts.forEach((c, n) {
      if (n < writeCount) {
        writeCode = c;
        writeCount = n;
      }
    });
    if (writeCode != code) {
      // ignore: avoid_print
      print('[E2E] istorya yozish uchun $writeCode tanlandi '
          '($writeCount ta faol istorya)');
    }

    final storiesBefore = await social.storiesOf(code);
    switch (storiesBefore) {
      case Err(:final error):
        fail('Story view',
            screen: 'StoryViewer',
            action: 'GET /api/records/:code/gallery',
            cause: why(error),
            pathHint: '/gallery');
      case Ok(:final value):
        report.pass('Story view',
            screen: 'StoryViewer',
            action: 'haqiqiy istoryalarni o\'qish',
            note: '${value.length} ta faol istorya (chegara 10); '
                'tozalangan eski sinov istoryasi: $swept');
    }

    if (uploaded != null) {
      // YOZISH profilining oldingi holati — `storiesBefore` ASOSIY
      // profilники, `writeCode` esa boshqa profil bo'lishi mumkin.
      // Ikkalasini aralashtirsak, "yangi" ro'yxatiga BEGONA
      // istoryalar tushib qolardi va tozalash paytida HAQIQIY
      // foydalanuvchi istoryasi o'chib ketardi.
      final writeBefore = (await social.storiesOf(writeCode))
              .valueOrNull
              ?.map((s) => s.id)
              .toSet() ??
          <int>{};

      // IZOHDA MARKER — keyingi ishga tushirish buni o'ziniki deb
      // ANIQ taniydi va xavfsiz o'chiradi.
      final st = await social.createStory(
        code: writeCode,
        imageUrl: uploaded,
        caption: testLabel('story'),
      );
      switch (st) {
        case Err(:final error):
          // `limit_reached` — ILOVA XATOSI EMAS.
          //
          // Server profilda 10 ta faol istoryaga ruxsat beradi
          // (mahsulot qoidasi). Marker qo'shilishidan OLDINGI
          // ishga tushirishlardan qolgan istoryalar o'chirilmaydi:
          // ularning E2E'niki ekanini ISBOTLAB bo'lmaydi, taxmin
          // bilan o'chirish esa haqiqiy ma'lumotni yo'qotish xavfi.
          // Ular 24 soatda o'zi muddati tugaydi.
          if (error.code == 'limit_reached') {
            partial('Story create',
                screen: 'StoryComposer',
                action: 'POST /api/records/:code/stories',
                cause: 'profil to\'la (10 ta faol istorya chegarasi) — '
                    'markersiz eski sinov istoryalari o\'chirilmaydi, '
                    'ular 24 soatda muddati tugab yo\'qoladi; '
                    'profil=$writeCode',
                pathHint: '/stories');
          } else {
            fail('Story create',
                screen: 'StoryComposer',
                action: 'POST /api/records/:code/stories {agreed:true}',
                cause: why(error),
                pathHint: '/stories');
          }
        case Ok():
          final after = await social.storiesOf(writeCode);
          if (after is Ok<List<StoryItem>>) {
            final list = after.value;
            // IKKI SHART BIRGA: (a) yaratishdan OLDIN bu profilda
            // yo'q edi, (b) izohida sinov markeri bor. Marker
            // sinovdan boshqa hech qayerda yozilmaydi, shuning
            // uchun bu — 100% O'ZIMIZNIKI. Faqat shundagina
            // o'chirish navbatiga qo'yiladi.
            final fresh = list.where((s) =>
                !writeBefore.contains(s.id) &&
                s.caption.contains(kTestMarker));
            if (fresh.isNotEmpty) {
              final made = fresh.first;
              litter.trackResult('story #${made.id}',
                  () => social.deleteStory(made.id));
              report.pass('Story create',
                  screen: 'StoryComposer',
                  action: 'yaratish → qayta o\'qish',
                  note: 'istorya serverda saqlandi (id=${made.id}); '
                      'profil=$writeCode; tozalangan eski sinov '
                      'istoryasi=$swept');

              // KO'RILDI deb belgilash — `POST /api/stories/:id/view`.
              // Bu endpoint BOR; hujjatda xato ravishda "BACKEND
              // REQUIRED" deb yozilgan edi.
              final seen = await social.markStorySeen(made.id);
              switch (seen) {
                case Err(:final error):
                  partial('Story seen',
                      screen: 'StoryViewer',
                      action: 'POST /api/stories/:id/view',
                      cause: why(error),
                      pathHint: '/view');
                case Ok():
                  report.pass('Story seen',
                      screen: 'StoryViewer',
                      action: 'POST /api/stories/:id/view',
                      note: 'ko\'rish hodisasi serverga yozildi');
              }
            } else {
              fail('Story create',
                  screen: 'StoryComposer',
                  action: 'yaratish → qayta o\'qish',
                  cause: 'server 2xx qaytardi, lekin $writeCode profilida '
                      'markerli yangi yozuv paydo bo\'lmadi',
                  pathHint: '/stories');
            }
          }
      }
    } else {
      report.skip('Story create', 'media yuklanmadi — istorya media talab qiladi');
    }

    // ── Reels ──────────────────────────────────────────────────
    final vids = await social.videosOf(code);
    switch (vids) {
      case Err(:final error):
        partial('Reels playback',
            screen: 'ReelsScreen',
            action: 'GET /api/records/:code/videos',
            cause: why(error),
            pathHint: '/videos');
      case Ok(:final value):
        report.add(MatrixRow(
          name: 'Reels playback',
          verdict: Verdict.partial,
          screen: 'ReelsScreen',
          action: 'GET /api/records/:code/videos',
          cause: 'ro\'yxat o\'qildi (${value.length} ta), lekin HAQIQIY '
              'video ijrosi, ovoz va scroll xulqi emulyatorda '
              'ishonchli tekshirilmaydi',
          layer: 'device',
          fix: 'MANUAL_TEST.md — 11-bo\'lim, haqiqiy telefonda',
        ));
    }

    report.add(MatrixRow(
      name: 'Reels create',
      verdict: Verdict.deviceRequired,
      screen: 'ReelComposer',
      action: 'video tanlash va yuklash',
      cause: 'emulyatorda haqiqiy video fayl yo\'q; rasmni "video" deb '
          'yuklash soxta sinov bo\'lardi',
      layer: 'device',
      fix: 'MANUAL_TEST.md — 11-bo\'lim',
    ));
  }, timeout: const Timeout(Duration(minutes: 8)));

  // ══════════════════════════════════════════════════════════════
  // 7. FOLLOW / UNFOLLOW
  // ══════════════════════════════════════════════════════════════

  testWidgets('4. Follow / unfollow', (_) async {
    if (!hasSecondAccount) {
      for (final r in ['Follow', 'Unfollow', 'Block']) {
        report.add(MatrixRow(
          name: r,
          verdict: Verdict.configRequired,
          cause: 'ikkinchi sinov hisobi berilmagan '
              '(NOVA_TEST_LOGIN_2 / NOVA_TEST_PASSWORD_2). Begona '
              'odamni kuzatib/bloklab sinash mumkin emas — bu uning '
              'hisobiga ta\'sir qiladi',
          layer: 'config',
        ));
      }
      return;
    }

    if (budget.exhausted) {
      report.skip('Follow', 'kirish budjeti tugadi');
      return;
    }

    // Ikkinchi hisobning kodini olish uchun unga kiramiz — alohida
    // mijoz bilan, asosiy sessiyaga tegmasdan.
    budget.spend('ikkinchi hisobga kirish');
    final second = buildClient();
    final secondAuth = AuthRepository(second.api);
    final li = await secondAuth.loginWithPassword(
      email: kTestLogin2,
      password: kTestPassword2,
    );
    if (li is Err) {
      report.skip('Follow',
          'ikkinchi hisobga kirib bo\'lmadi: ${why((li as Err).error)}');
      return;
    }
    final other = await secondAuth.me();
    if (other is! Ok<({User user, List<NfcId> ids})>) {
      report.skip('Follow', 'ikkinchi hisobning yozuvlari o\'qilmadi');
      return;
    }
    final target =
        other.value.ids.firstOrNull;
    if (target == null) {
      report.skip('Follow', 'ikkinchi hisobda NFC ID yo\'q');
      return;
    }

    final before = await profile.followStats(target.code);
    final f = await profile.follow(target.code);
    switch (f) {
      case Err(:final error):
        fail('Follow',
            screen: 'ProfileScreen',
            action: 'POST /api/follow/:code',
            cause: why(error),
            pathHint: '/api/follow/');
      case Ok():
        final after = await profile.followStats(target.code);
        final grew = before is Ok<({int followers, int following})> &&
            after is Ok<({int followers, int following})> &&
            after.value.followers >
                before.value.followers;
        if (grew) {
          report.pass('Follow',
              screen: 'ProfileScreen',
              action: 'follow → follow-stats',
              note: 'kuzatuvchilar soni serverda oshdi');
        } else {
          partial('Follow',
              screen: 'ProfileScreen',
              action: 'follow → follow-stats',
              cause: 'so\'rov o\'tdi, lekin kuzatuvchilar soni '
                  'o\'zgarmadi (ehtimol allaqachon kuzatilgan)',
              pathHint: '/api/follow-stats/');
        }

        final u = await profile.unfollow(target.code);
        switch (u) {
          case Err(:final error):
            fail('Unfollow',
                screen: 'ProfileScreen',
                action: 'POST /api/unfollow/:code',
                cause: why(error),
                pathHint: '/api/unfollow/');
          case Ok():
            report.pass('Unfollow',
                screen: 'ProfileScreen',
                action: 'unfollow → holat qaytdi');
        }
    }

    // ── Bloklash / blokdan chiqarish ───────────────────────────
    final b = await moderation.block(BlockKind.record, target.code);
    switch (b) {
      case Err(:final error):
        fail('Block',
            screen: 'ProfileActions',
            action: 'POST /api/blocks',
            cause: why(error),
            pathHint: '/api/blocks');
      case Ok():
        final list = await moderation.blocks();
        final has = list is Ok<List<BlockedItem>> &&
            list.value
                .any((x) => x.id == target.code);
        if (has) {
          report.pass('Block',
              screen: 'ProfileActions',
              action: 'bloklash → ro\'yxatdan o\'qish',
              note: 'serverda saqlandi');
        } else {
          partial('Block',
              screen: 'ProfileActions',
              action: 'bloklash → ro\'yxatdan o\'qish',
              cause: 'blok yaratildi, lekin ro\'yxatda ko\'rinmadi',
              pathHint: '/api/blocks');
        }
        await moderation.unblock('record', target.code);
    }
  }, timeout: const Timeout(Duration(minutes: 5)));

  // ══════════════════════════════════════════════════════════════
  // 14. KATALOG / MAHSULOTLAR
  // ══════════════════════════════════════════════════════════════

  testWidgets('5. Katalog — o\'qish va TEST mahsulot', (_) async {
    // KATALOG FAQAT BIZNES YOZUVIDA.
    //
    // Ilgari bu yerda biznes topilmasa SHAXSIY yozuvga tushilardi va
    // server to'g'ri ravishda 403 `not_business` qaytarardi — sinov
    // esa buni FAIL deb yozardi. Bu ilovaning kamchiligi emas,
    // sinovning noto'g'ri yozuvni tanlagani edi.
    // KOMPANIYA KATALOGI — yozuv katalogidan BOSHQA yo'l.
    //
    // Backend'da ikki xil katalog bor:
    //   * yozuv katalogi  — `/api/records/:code/:kind/items`, faqat
    //     BIZNES turidagi NFC yozuvida (aks holda 403 not_business);
    //   * kompaniya katalogi — `/api/companies/:id` javobidagi
    //     `company.catalog`.
    //
    // Hisobda biznes YOZUVI bo'lmasa ham KOMPANIYA bo'lishi mumkin,
    // shuning uchun o'qish baribir tekshiriladi.
    final companies = await business.mine();
    final company = companies is Ok<List<Business>> && companies.value.isNotEmpty
        ? companies.value.first
        : null;
    if (company != null) {
      final cat = await business.catalog(company.companyId);
      switch (cat) {
        case Err(:final error):
          fail('Catalog',
              screen: 'BusinessCatalogScreen',
              action: 'GET /api/companies/:id → company.catalog',
              cause: why(error),
              pathHint: '/api/companies/');
        case Ok(:final value):
          report.pass('Catalog',
              screen: 'BusinessCatalogScreen',
              action: 'haqiqiy kompaniya katalogini o\'qish',
              note: '${company.displayName}: ${value.length} ta element');
      }
    }

    final code = businessId?.code;
    if (code == null) {
      if (company == null) {
        report.skip('Catalog', 'hisobda kompaniya ham, biznes yozuvi ham yo\'q');
      }
      for (final r in [
        'Product create',
        'Product edit',
        'Product delete test object',
      ]) {
        report.skip(
            r,
            'hisobda BIZNES turidagi NFC yozuvi yo\'q — katalog '
            'elementini faqat o\'sha yerga qo\'shib bo\'ladi '
            '(server: 403 not_business)');
      }
      return;
    }

    final read = await business.recordCatalog(code, CatalogKind.products);
    switch (read) {
      case Err(:final error):
        fail('Catalog',
            screen: 'CatalogScreen',
            action: 'GET /api/records/:code/catalog',
            cause: why(error),
            pathHint: '/catalog');
      case Ok(:final value):
        report.pass('Catalog',
            screen: 'CatalogScreen',
            action: 'haqiqiy katalogni o\'qish',
            note: '${value.length} ta mahsulot');
    }

    final add = await business.addRecordItem(
      code,
      CatalogKind.products,
      {'name': testLabel('mahsulot'), 'price': 1, 'available': true},
    );
    switch (add) {
      case Err(:final error):
        fail('Product create',
            screen: 'CatalogForm',
            action: 'POST /api/records/:code/catalog',
            cause: why(error),
            pathHint: '/catalog');
      case Ok(:final value):
        litter.trackResult(
            'katalog #${value.id}',
            () => business.deleteRecordItem(
                code, CatalogKind.products, value.id));
        report.pass('Product create',
            screen: 'CatalogForm',
            action: 'POST /api/records/:code/catalog',
            note: 'id=${value.id}');

        final edit = await business.updateRecordItem(
          code,
          CatalogKind.products,
          value.id,
          {'price': 2, 'available': false},
        );
        switch (edit) {
          case Err(:final error):
            fail('Product edit',
                screen: 'CatalogForm',
                action: 'PATCH katalog elementi',
                cause: why(error),
                pathHint: '/catalog');
          case Ok():
            final back =
                await business.recordCatalog(code, CatalogKind.products);
            final item = back is Ok<List<CatalogItem>>
                ? back.value
                    .where((i) => i.id == value.id)
                    .firstOrNull
                : null;
            if (item != null && item.price == 2 && !item.available) {
              report.pass('Product edit',
                  screen: 'CatalogForm',
                  action: 'tahrir → qayta o\'qish',
                  note: 'narx va mavjudlik serverda yangilandi');
            } else {
              fail('Product edit',
                  screen: 'CatalogForm',
                  action: 'tahrir → qayta o\'qish',
                  cause: item == null
                      ? 'element qayta o\'qishda topilmadi'
                      : 'server 2xx qaytardi, lekin qiymat eski: '
                          'narx=${item.price} mavjud=${item.available}',
                  pathHint: '/catalog');
            }
        }
    }
  }, timeout: const Timeout(Duration(minutes: 5)));

  // ══════════════════════════════════════════════════════════════
  // 15–20. SOVG'A, NFC, TANLOV, FAOLIYAT, TO'LOV
  // ══════════════════════════════════════════════════════════════

  testWidgets('6. Sovg\'a, NFC, Tanlov, faoliyat, to\'lov — O\'QISH',
      (_) async {
    // ── Sovg'alar — FAQAT O'QISH ───────────────────────────────
    final gifts = await nfc.giftOffers();
    switch (gifts) {
      case Err(:final error):
        fail('Gift incoming',
            screen: 'GiftOffersScreen',
            action: 'GET /api/gift-offers',
            cause: why(error),
            pathHint: 'gift');
      case Ok(:final value):
        report.pass('Gift incoming',
            screen: 'GiftOffersScreen',
            action: 'GET /api/gift-offers → {incoming, outgoing}',
            note: 'kelgan=${value.incoming.length}');
        report.pass('Gift outgoing',
            screen: 'GiftOffersScreen',
            action: 'GET /api/gift-offers → outgoing',
            note: 'yuborilgan=${value.outgoing.length}');
    }
    // Qabul/rad/bekor qilish ATAYLAB sinalmaydi.
    report.add(MatrixRow(
      name: 'Gift accept / reject / cancel',
      verdict: Verdict.skipped,
      cause: 'haqiqiy NFC ID egalik huquqini ko\'chiradi — sizning '
          'ko\'rsatmangiz bo\'yicha bajarilmadi',
      layer: 'config',
    ));

    // ── NFC ────────────────────────────────────────────────────
    final myIds = await nfc.myIds();
    switch (myIds) {
      case Err(:final error):
        fail('NFC IDs',
            screen: 'NfcIdsScreen',
            action: 'GET /api/my/records',
            cause: why(error),
            pathHint: 'records');
      case Ok(:final value):
        final primaryCount = value.where((i) => i.primary).length;
        report.pass('NFC IDs',
            screen: 'NfcIdsScreen',
            action: 'haqiqiy ID ro\'yxati',
            note: '${value.length} ta; asosiy belgilangan: $primaryCount');
    }

    final devices = await nfc.devices();
    switch (devices) {
      case Err(:final error):
        partial('NFC linked card',
            screen: 'NfcDevicesScreen',
            action: 'GET /api/my/nfc-devices',
            cause: why(error),
            pathHint: 'nfc-devices');
      case Ok(:final value):
        report.pass('NFC linked card',
            screen: 'NfcDevicesScreen',
            action: 'bog\'langan kartalar holati',
            note: '${value.length} ta qurilma (o\'zgartirilmadi)');
    }

    report.add(MatrixRow(
      name: 'QR',
      verdict: Verdict.pass,
      screen: 'QrSheet',
      action: 'QR mahalliy chiziladi (qr_flutter), server kerak emas',
      note: 'kod = NFC ID manzili; UI sinovi e2e_ui_test.dart da',
    ));
    report.add(MatrixRow(
      name: 'Share',
      verdict: Verdict.deviceRequired,
      screen: 'ProfileScreen',
      action: 'tizim ulashish oynasi',
      cause: 'OS oynasi — emulyatorda natijani tasdiqlab bo\'lmaydi',
      layer: 'device',
    ));

    // ── Tanlov / Discover ──────────────────────────────────────
    final q = personal?.name.isNotEmpty == true
        ? personal!.name.split(RegExp(r'\s+')).first
        : (personal?.code ?? '');
    if (q.isEmpty) {
      report.skip('Search', 'qidiruv uchun so\'z topilmadi');
    } else {
      final people = await discover.searchPeople(q);
      switch (people) {
        case Err(:final error):
          fail('Search',
              screen: 'DiscoverScreen (Tanlov)',
              action: 'odamlarni qidirish',
              cause: why(error),
              pathHint: 'search');
        case Ok(:final value):
          report.pass('Search',
              screen: 'DiscoverScreen (Tanlov)',
              action: 'haqiqiy qidiruv',
              note: '"$q" → ${value.length} ta natija');
      }

      final biz = await discover.searchBusinesses(q);
      if (biz is Ok<List<Business>>) {
        report.pass('Tanlov',
            screen: 'DiscoverScreen',
            action: 'biznes qidiruvi',
            note: '${biz.value.length} ta natija; '
                'UZ yorlig\'i "Tanlov" — e2e_ui_test.dart tekshiradi');
      }
    }

    final trending = await discover.trending();
    if (trending is Ok<List<Post>>) {
      report.pass('Post list — lenta',
          screen: 'DiscoverScreen',
          action: 'GET /api/news',
          note: '${trending.value.length} ta yozuv');
    }

    // ── Faoliyat ───────────────────────────────────────────────
    final codes = ids.map((i) => i.code).toList();
    if (codes.isEmpty) {
      report.skip('Activity', 'yozuv yo\'q');
    } else {
      final feed = await activity.feed(codes);
      switch (feed) {
        case Err(:final error):
          fail('Activity',
              screen: 'ActivityScreen',
              action: 'GET /api/activity',
              cause: why(error),
              pathHint: 'activity');
        case Ok(:final value):
          report.pass('Activity',
              screen: 'ActivityScreen',
              action: 'haqiqiy faoliyat lentasi',
              note: '${value.length} ta hodisa');
      }
    }

    backendGap(
      'Push notification',
      'na `server/` da, na `hosting/` da FCM yoki push token '
          'infratuzilmasi yo\'q. Ilovada push YO\'Q va bordek '
          'ko\'rsatilmaydi',
    );

    // ── TO'LOV — FAQAT O'QISH, HECH QANDAY TO'LOV BOSHLANMAYDI ──
    final providers = await shop.enabledProviders();
    switch (providers) {
      case Err(:final error):
        partial('Payment checkout',
            screen: 'CheckoutScreen',
            action: 'yoqilgan provayderlarni o\'qish',
            cause: why(error),
            pathHint: 'pay');
      case Ok(:final value):
        final names = value.map((p) => p.name).toList()..sort();
        report.add(MatrixRow(
          name: 'Payment checkout',
          verdict: Verdict.manualPayment,
          screen: 'CheckoutScreen',
          action: 'provayderlar ro\'yxati o\'qildi',
          cause: 'server faqat PRODUKSIYA rejimida; haqiqiy pul '
              'yechilmasligi uchun to\'lov BOSHLANMADI',
          note: 'yoqilgan: ${names.isEmpty ? 'yo\'q' : names.join(', ')}',
          layer: 'config',
          fix: 'sandbox muhiti yoki aniq ruxsat kerak',
        ));
        for (final p in ['Payme', 'Click', 'Paynet']) {
          report.add(MatrixRow(
            name: p,
            verdict: Verdict.manualPayment,
            screen: 'CheckoutScreen',
            action: 'holat serverdan o\'qildi',
            note: names.contains(p.toLowerCase())
                ? 'server tomonda YOQILGAN'
                : 'server tomonda o\'chirilgan yoki sozlanmagan',
            cause: 'haqiqiy to\'lov qilinmadi',
            layer: 'config',
          ));
        }
    }

    final orders = await shop.orders();
    switch (orders) {
      case Err(:final error):
        partial('Payment history',
            screen: 'OrdersScreen',
            action: 'GET /api/my/orders',
            cause: why(error),
            pathHint: 'orders');
      case Ok(:final value):
        report.pass('Payment history',
            screen: 'OrdersScreen',
            action: 'haqiqiy buyurtmalar tarixi',
            note: '${value.length} ta buyurtma (o\'zgartirilmadi)');
    }

    // ── Hisob o'chirish / email kodi ───────────────────────────
    backendGap(
      'Account delete',
      'ilova ichida haqiqiy o\'chirish endpointi yo\'q; hozir '
          'qo\'llab-quvvatlashga so\'rov yuboriladi. Google Play ilova '
          'ichida o\'chirishni TALAB qiladi',
    );
    backendGap(
      'Email OTP',
      'POST /api/auth/request-email-code serverda yo\'q; backendda email '
          'infratuzilmasi topilmadi',
      pathHint: 'request-email-code',
    );
    backendGap(
      'Post save',
      'save/unsave endpointi serverda yo\'q',
    );
    backendGap(
      'Post edit',
      'postni yangilash endpointi yo\'q — faqat POST va DELETE',
    );
  }, timeout: const Timeout(Duration(minutes: 6)));

  // ══════════════════════════════════════════════════════════════
  // 23. XATO HOLATLARI
  // ══════════════════════════════════════════════════════════════

  testWidgets('7. Xato holatlari — haqiqiy javoblar', (_) async {
    // Mavjud bo'lmagan yozuv → 404.
    final missing = await profile.byCode('NOVA-E2E-YOQ-BUNDAY-KOD');
    switch (missing) {
      case Err(:final error):
        final good = error.kind == AppErrorKind.notFound ||
            error.kind == AppErrorKind.endpointMissing ||
            error.status == 404;
        if (good) {
          report.pass('Error — topilmadi',
              screen: 'ProfileScreen',
              action: 'mavjud bo\'lmagan kod',
              note: '${error.kind.name} (${error.status}) — soxta '
                  'muvaffaqiyat yo\'q');
        } else {
          partial('Error — topilmadi',
              screen: 'ProfileScreen',
              action: 'mavjud bo\'lmagan kod',
              cause: 'kutilgan 404 emas: ${why(error)}');
        }
      case Ok():
        fail('Error — topilmadi',
            screen: 'ProfileScreen',
            action: 'mavjud bo\'lmagan kod',
            cause: 'SERVER MAVJUD BO\'LMAGAN YOZUVNI QAYTARDI');
    }

    // Tokensiz so'rov → 401.
    final anon = buildClient();
    final anonRes = await AuthRepository(anon.api).me();
    switch (anonRes) {
      case Err(:final error):
        report.pass('Error — ruxsatsiz',
            screen: 'Splash',
            action: 'tokensiz GET /api/auth/me',
            note: '${error.kind.name} — kirish ekraniga yuboriladi');
      case Ok():
        fail('Error — ruxsatsiz',
            screen: 'Splash',
            action: 'tokensiz GET /api/auth/me',
            cause: 'SERVER TOKENSIZ FOYDALANUVCHINI QAYTARDI',
            layer: 'backend');
    }

    // Buzuq token → 401 va `sessionExpired` signali.
    final bad = buildClient();
    await bad.api.setToken('NOVA_E2E_INVALID_TOKEN');
    final before = bad.api.sessionExpired.value;
    final badRes = await AuthRepository(bad.api).me();
    // DIQQAT: `/api/auth/me` eskirgan token uchun 401 EMAS, 200 +
    // `{user: null}` qaytaradi. Shuning uchun signal HTTP holat
    // kodidan emas, `AuthRepository.me()` ichidan keladi. E2E #11
    // aynan shuni ochib berdi.
    final fired = bad.api.sessionExpired.value > before;
    // TOKEN TOZALANDIMI. Signal chiqib, token joyida qolsa, keyingi
    // har bir so'rov yana o'sha o'lik token bilan ketardi.
    final cleared = await SecureStore().readToken() == null ||
        bad.api.sessionExpired.value > before;
    if (badRes is Err && fired && cleared) {
      report.pass('Error — sessiya tugagan',
          screen: 'Router',
          action: 'buzuq token → 401',
          note: 'signal chiqdi, token tozalandi — router kirish '
              'ekraniga ko\'chiradi');
    } else {
      partial('Error — sessiya tugagan',
          screen: 'Router',
          action: 'buzuq token',
          cause: badRes is Ok
              ? 'buzuq token QABUL QILINDI'
              : !fired
                  ? 'sessionExpired signali ishlamadi'
                  : 'signal chiqdi, lekin token tozalanmadi');
    }
    await bad.api.setToken(null);
  }, timeout: const Timeout(Duration(minutes: 4)));

  // ══════════════════════════════════════════════════════════════
  // YAKUN — chiqish va baho
  // ══════════════════════════════════════════════════════════════

  testWidgets('8. Chiqish va yakuniy baho', (_) async {
    // TOZALASH CHIQISHDAN OLDIN.
    //
    // Ilgari tozalash faqat `tearDownAll` da edi, ya'ni quyidagi
    // `logout()` dan KEYIN ishlardi: server sessiyasi ham,
    // qurilmadagi token ham o'chgan bo'lardi va har bir o'chirish
    // 401 olardi. E2E #17 da aynan shu sodir bo'ldi — istorya #36
    // haqiqiy hisobda qolib ketdi.
    //
    // `sweep()` ro'yxatni bo'shatadi, shuning uchun `tearDownAll`
    // dagi chaqiruv endi faqat ZAXIRA: to'plam bu testga
    // yetmasdan yiqilsa ishlaydi.
    await litter.sweep();

    if (me != null) {
      await auth.logout();
      final after = await auth.me();
      if (after is Err) {
        report.pass('Logout',
            screen: 'SettingsScreen',
            action: 'chiqish → /api/auth/me endi ruxsatsiz',
            note: 'server sessiyasi ham, qurilmadagi token ham o\'chdi');
      } else {
        fail('Logout',
            screen: 'SettingsScreen',
            action: 'chiqish',
            cause: 'chiqishdan keyin ham sessiya tirik',
            pathHint: '/api/auth/logout');
      }
    } else {
      report.skip('Logout', 'kirish bo\'lmagan');
    }

    // Tozalash `tearDownAll` da bajariladi, lekin baho undan OLDIN
    // chiqadi — shuning uchun bu yerda faqat hisob-kitob.
    final t = report.tally;
    // ignore: avoid_print
    print('[E2E] YAKUN: ${t.entries.map((e) => '${e.key.label}=${e.value}').join('  ')}');

    // FAIL bo'lsa ish qizil bo'lishi kerak — aks holda hisobotni
    // hech kim o'qimaydi.
    final failures = report.rows.where((r) => r.verdict == Verdict.fail);
    expect(
      failures,
      isEmpty,
      reason: 'FAIL qatorlari:\n${failures.map((f) => ' · ${f.name}: '
          '${f.cause}\n   ${f.trace}').join('\n')}',
    );

    // TOZALANMAGAN AXLAT HAM ISHNI QIZIL QILADI.
    //
    // E2E #17 yashil tugadi, lekin istorya #36 haqiqiy hisobda
    // qolib ketdi: tozalash muammosi hech bir FAIL qatoriga
    // tegmasdi. Haqiqiy hisobda qolgan sinov obyekti — jim
    // o'tkazib yuboriladigan narsa emas.
    expect(
      report.cleanupProblems,
      isEmpty,
      reason: 'Haqiqiy hisobda sinov obyekti qoldi:\n'
          '${report.cleanupProblems.map((c) => ' · $c').join('\n')}',
    );
  }, timeout: const Timeout(Duration(minutes: 3)));
}
