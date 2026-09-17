import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'data/deep_link.dart';
import 'data/nfc.dart';
import 'design/nav.dart';
import 'design/theme.dart';
import 'design/components/toast.dart';
import 'design/route_watch.dart';
import 'design/tokens.dart';
import 'design/type.dart';
import 'screens/entry/login.dart';
import 'screens/entry/onboarding.dart';
import 'screens/entry/splash.dart';
import 'screens/identity/profile_screen.dart';
import 'screens/lock/lock_screen.dart';
import 'screens/shell.dart';
import 'l10n/strings.dart';
import 'state/app_lock.dart';
import 'state/app_prefs.dart';
import 'state/app_state.dart';

/// Ilova ildizi.
///
/// Ildiz FAQAT uchta holatni biladi: yuklanmoqda, kirilmagan, kirilgan.
/// Ekranlar orasidagi qolgan navigatsiya har bo'limning o'z
/// `Navigator`ida qoladi.
class NfcstoreApp extends StatefulWidget {
  const NfcstoreApp({
    super.key,
    required this.state,
    this.lock,
    this.links,
    this.prefs,
  });
  final AppState state;

  /// Testda soxta qulf berish uchun. Odatda `null` — o'zi yaratiladi.
  final AppLock? lock;

  /// Testda soxta havola oqimi berish uchun. Odatda `null`.
  final DeepLinks? links;

  /// Testda mavzu/tilni belgilash uchun. Odatda `null`.
  final AppPrefs? prefs;

  @override
  State<NfcstoreApp> createState() => _NfcstoreAppState();
}

class _NfcstoreAppState extends State<NfcstoreApp> with WidgetsBindingObserver {
  late final AppLock _lock = widget.lock ?? AppLock();
  late final DeepLinks _links = widget.links ?? DeepLinks();
  late final AppPrefs _prefs = widget.prefs ?? AppPrefs();
  final _navKey = GlobalKey<NavigatorState>();
  StreamSubscription<NfcLink>? _linkSub;

  /// Kelgan, lekin HALI OCHILMAGAN havola.
  ///
  /// Karta ilova yopiq yoki qulflangan holatda tegizilishi mumkin.
  /// Bunday havolani tashlab yuborish — foydalanuvchi uchun "karta
  /// ishlamadi" degani. Shuning uchun u saqlanadi va ilova tayyor
  /// bo'lishi bilan ochiladi.
  NfcLink? _pending;
  /// Tanishtiruv faqat BIRINCHI ochilishda. Keyin to'g'ridan-to'g'ri
  /// kirish ekrani chiqadi.
  bool _onboarded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.state.boot();
    _lock.load();
    // MAVZU VA TIL — ildiz qurilishidan OLDIN. `C` va `tr()` statik
    // o'qiydi, ya'ni saqlangan qiymat kech kelsa ekran avval asl
    // ko'rinishda chiqib, keyin sakrab o'zgarardi.
    _prefs.load();
    _prefs.addListener(_onPrefs);
    _listenLinks();
    // Kutayotgan havola qulf ochilishi yoki hisobga kirish bilan
    // ochilsin: bu ikki hodisa ildiz widgetni O'ZI qayta qurmaydi.
    _lock.addListener(_onReady);
    widget.state.addListener(_onReady);

    // SESSIYA TUGAGANDA — NAVIGATSIYA TOZALANADI VA BITTA XABAR.
    //
    // Holatning o'zgarishi ildizni kirish ekraniga qaytaradi, lekin
    // USTIDAGI ochiq sahifalar (profil, sozlamalar, varaqalar)
    // joyida qolardi: odam kirish ekrani o'rniga o'sha eski
    // sahifalarni ko'rib turardi va orqaga bosa-bosa chiqishga
    // majbur bo'lardi.
    //
    // XABAR BIR MARTA: tokeni eskirgan ilovada o'nlab so'rov birga
    // yiqiladi. Takrorlanishning oldi `Api` da olinadi, bu yer esa
    // faqat ko'rsatadi.
    widget.state.onSessionExpired = () {
      final nav = _navKey.currentState;
      nav?.popUntil((r) => r.isFirst);
      final ctx = _navKey.currentContext;
      if (ctx != null && ctx.mounted) {
        showToast(ctx, tr('Sessiyangiz tugadi. Qayta kiring.'));
      }
    };
  }

  void _onReady() {
    if (_pending != null && mounted) setState(() {});
  }

  /// Mavzu yoki til almashdi — BUTUN daraxt qayta quriladi.
  ///
  /// Bu shunchaki `setState` bilan ishlaydi, chunki rang va matn
  /// `C.x` / `tr()` orqali BUILD ICHIDA o'qiladi. Ularni ishlatgan
  /// widget `const` bo'la olmaydi (kompilyator buni majburlaydi),
  /// demak u qayta qurilishdan chetda qolmaydi.
  void _onPrefs() {
    applyLocale(_prefs.locale);
    if (mounted) setState(() {});
  }

  Future<void> _listenLinks() async {
    _linkSub = _links.stream().listen(_queue);
    final first = await _links.initial();
    if (first != null) _queue(first);
  }

  void _queue(NfcLink link) {
    _pending = link;
    if (mounted) setState(() {});
  }

  /// Ilova ochiq va qulfsiz bo'lgandagina profilga o'tiladi.
  ///
  /// Qulf ustidan o'tib ketmaslik SHART: aks holda begona odam
  /// kartani tegizib, qulflangan ilovadan ma'lumot ko'ra olardi.
  void _flushPending() {
    final link = _pending;
    if (link == null) return;
    // Qulf sozlamasi hali o'qilmagan bo'lsa KUTAMIZ: aks holda
    // `locked` bir lahza `false` bo'lib turadi va havola qulf
    // ustidan o'tib ketadi.
    if (!_lock.loaded) return;
    if (_lock.locked && widget.state.phase == AuthPhase.signedIn) return;
    if (widget.state.phase == AuthPhase.loading) return;
    _pending = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navKey.currentState?.push(SlidePage<void>(
        builder: (_) => link.company
            ? ProfileScreen(companyId: link.code)
            : ProfileScreen(code: link.code),
      ));
      if (!link.company) {
        widget.state.repo.tap(link.code).catchError((_) {});
      }
    });
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    _prefs.removeListener(_onPrefs);
    _lock.removeListener(_onReady);
    widget.state.removeListener(_onReady);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// ILOVA FONGA O'TSA — QAYTA QULFLANADI.
  ///
  /// Aks holda qulf faqat birinchi ochilishda so'ralardi va telefon
  /// birov qo'liga tushganda ilova allaqachon ochiq bo'lardi.
  /// `paused` — ekran o'chdi yoki boshqa ilovaga o'tildi.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      _lock.lock();
    }
    // Internet qaytganini bilishning yagona ishonchli yo'li — so'rov
    // yuborish. Foydalanuvchi odatda aynan tarmoqni tuzatib qaytadi,
    // shuning uchun FAQAT uzilgan holatda va FAQAT qaytishda bitta
    // yengil so'rov yuboriladi.
    if (state == AppLifecycleState.resumed && !widget.state.api.online.value) {
      widget.state.repo.paymentsEnabled().catchError((_) => <String, dynamic>{});
    }
  }

  @override
  Widget build(BuildContext context) {
    _flushPending();
    return AppScope(
      state: widget.state,
      child: AppPrefsScope(
        prefs: _prefs,
        child: AppLockScope(
        lock: _lock,
        child: MaterialApp(
        navigatorKey: _navKey,
        // Ekran ustiga ekran ochilganini kuzatadi — video shunda
        // to'xtaydi (izohi `route_watch.dart` da).
        navigatorObservers: [rootRouteObserver],
        title: 'NFCSTORE',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        // Ekran matnlari o'zbekcha va shrift o'lchamlari dizaynda
        // qat'iy belgilangan. Tizimdagi juda katta shrift maketni
        // buzmasligi uchun masshtab 1.3 bilan cheklanadi — butunlay
        // o'chirib qo'yish esa ko'rish qiyinchiligi bor odamga
        // adolatsizlik bo'lardi.
        builder: (context, child) => MediaQuery.withClampedTextScaling(
          minScaleFactor: 1,
          maxScaleFactor: 1.3,
          child: AnnotatedRegion<SystemUiOverlayStyle>(
            value: systemOverlay,
            // MATERIAL AJDODI — BUTUN ILOVA UCHUN SHU YERDA.
            //
            // Ekranlar `Scaffold` ishlatmaydi (ular o'z maketini o'zi
            // quradi), `MaterialApp` esa Material qatlamini O'ZI
            // qo'shmaydi. Natijada har bir `Text` "uslub meros
            // qilinmagan" deb SARIQ IKKI CHIZIQ bilan chiziladi —
            // ya'ni ilovaning HAMMA ekrani buzuq ko'rinardi. Buni
            // faqat ilovani haqiqatan ochib ko'rgandagina bilish
            // mumkin edi: testlar ham, `flutter analyze` ham buni
            // xato deb hisoblamaydi.
            //
            // Bitta joyda hal qilinadi: shu builder `Navigator` ni
            // o'raydi, demak barcha ekranlar uning ichida.
            // Ildiz navigatorining kuzatuvchisi — ekranlar shu
            // orqali "ustimga ekran ochildimi" ni biladi.
            child: RouteWatchScope(
              observer: rootRouteObserver,
              child: Material(
                type: MaterialType.canvas,
                color: C.bg,
                // Standart matn uslubi ham shu yerdan — uslubsiz
                // qolgan `Text` ilovaning o'z shriftini oladi.
                textStyle: T.body.copyWith(color: C.ink),
                // TOAST QATLAMI — butun ilova uchun bitta.
                //
                // Ilova `Scaffold` ishlatmaydi, ya'ni Material'ning
                // `SnackBar` i mavjud emas. Toast esa har joyda
                // kerak: "Kontakt saqlandi", "Post o'chirildi"
                // (5 soniyalik "Bekor" tugmasi bilan).
                child: ToastHost(child: child ?? const SizedBox()),
              ),
            ),
          ),
        ),
        home: _Root(onboarded: _onboarded, onOnboarded: () => setState(() => _onboarded = true)),
        ),
      ),
      ),
    );
  }
}

/// Ko'rinish sozlamalariga kirish — `AppPrefsScope.of(context)`.
class AppPrefsScope extends InheritedNotifier<AppPrefs> {
  const AppPrefsScope({super.key, required AppPrefs prefs, required super.child})
      : super(notifier: prefs);

  static AppPrefs of(BuildContext context) {
    final s = context.dependOnInheritedWidgetOfExactType<AppPrefsScope>();
    assert(s?.notifier != null, 'AppPrefsScope topilmadi.');
    return s!.notifier!;
  }

  static AppPrefs read(BuildContext context) {
    final s = context.getInheritedWidgetOfExactType<AppPrefsScope>();
    assert(s?.notifier != null, 'AppPrefsScope topilmadi.');
    return s!.notifier!;
  }
}

/// Qulf holatiga kirish — `AppLockScope.of(context)`.
class AppLockScope extends InheritedNotifier<AppLock> {
  const AppLockScope({super.key, required AppLock lock, required super.child})
      : super(notifier: lock);

  static AppLock of(BuildContext context) {
    final s = context.dependOnInheritedWidgetOfExactType<AppLockScope>();
    assert(s?.notifier != null, 'AppLockScope topilmadi.');
    return s!.notifier!;
  }

  static AppLock read(BuildContext context) {
    final s = context.getInheritedWidgetOfExactType<AppLockScope>();
    assert(s?.notifier != null, 'AppLockScope topilmadi.');
    return s!.notifier!;
  }
}

class _Root extends StatelessWidget {
  const _Root({required this.onboarded, required this.onOnboarded});
  final bool onboarded;
  final VoidCallback onOnboarded;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final lock = AppLockScope.of(context);
    // QULF ENG USTIDA: hisobga kirilgan bo'lsa va qulf yopiq bo'lsa,
    // boshqa hech narsa ko'rinmaydi.
    if (state.phase == AuthPhase.signedIn && lock.locked) {
      return LockScreen(lock: lock);
    }
    final child = switch (state.phase) {
      AuthPhase.loading => const SplashScreen(),
      AuthPhase.signedIn => const Shell(),
      AuthPhase.signedOut =>
        onboarded ? const LoginScreen() : OnboardingScreen(onDone: onOnboarded),
    };
    // Holat almashganda yumshoq o'tish — splashdan ilovaga "sakrash"
    // bo'lmaydi.
    return AnimatedSwitcher(
      duration: M.fade,
      // MAKETNI EKRANGA TO'LDIRAMIZ.
      //
      // `AnimatedSwitcher` ning standart joylashuvi bolani `Stack`
      // ichida MARKAZGA qo'yadi va unga bo'sh (loose) o'lcham beradi.
      // Natijada ekranlar o'z tarkibi bo'yicha kichrayib, ekran
      // o'rtasida osilib qolardi — kirish ekrani aynan shunday
      // ko'rinardi. `StackFit.expand` bilan har bir ekran to'liq
      // balandlikni oladi.
      layoutBuilder: (current, previous) => Stack(
        fit: StackFit.expand,
        children: [...previous, if (current != null) current],
      ),
      child: KeyedSubtree(key: ValueKey(state.phase.name + (onboarded ? '1' : '0')), child: child),
    );
  }
}
