import 'package:flutter/widgets.dart';

/// EKRAN USTIGA BOSHQA EKRAN OCHILGANINI BILISH.
///
/// MUAMMO: Reels'da video o'ynab turganda muallif profiliga
/// o'tilsa, Reels ekrani daraxtdan CHIQIB KETMAYDI — u yangi ekran
/// ostida qolib, o'ynashda davom etardi. Ya'ni ekranda boshqa
/// sahifa, quloqda esa oldingi video ovozi. Egasi shuni xabar
/// qildi: "profilga o'tsam ham ovozi eshitilyapti".
///
/// Flutter'da buni bilishning ishonchli yo'li — `RouteObserver`: u
/// ekran ustiga boshqa ekran qo'yilganda (`didPushNext`) va u
/// yopilganda (`didPopNext`) xabar beradi. `ModalRoute.isCurrent`
/// ning o'zi yetarli emas: u o'zgarganda widget qayta qurilmaydi,
/// ya'ni hech kim bilmay qoladi.
///
/// HAR NAVIGATORGA O'Z KUZATUVCHISI — SHART.
///
/// Ilovada bir nechta navigator bor: ildiz va har bir tabniki.
/// Bitta kuzatuvchini ikkitasiga ulab bo'lmaydi — Flutter buni
/// `observer.navigator == null` tekshiruvi bilan darhol rad etadi
/// (butun ekran qizil xato bo'lib chiqadi). Shuning uchun har
/// navigator o'zinikini yaratadi va uni SHU navigator ichidagi
/// ekranlarga `RouteWatchScope` orqali uzatadi. Video esa eng
/// yaqinini oladi — ya'ni o'zi turgan navigatorникini.
class RouteWatchScope extends InheritedWidget {
  const RouteWatchScope({
    super.key,
    required this.observer,
    required super.child,
  });

  final RouteObserver<ModalRoute<void>> observer;

  /// Eng yaqin kuzatuvchi. Topilmasa `null` — video shunchaki
  /// "ustimda ekran yo'q" deb hisoblaydi (xato emas: masalan
  /// testdagi yalang'och widget).
  static RouteObserver<ModalRoute<void>>? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<RouteWatchScope>()?.observer;

  @override
  bool updateShouldNotify(RouteWatchScope old) => old.observer != observer;
}

/// Ildiz navigatorniki — `MaterialApp` ga beriladi.
final RouteObserver<ModalRoute<void>> rootRouteObserver =
    RouteObserver<ModalRoute<void>>();
