import 'package:flutter_cache_manager/flutter_cache_manager.dart';

/// RASMLAR TELEFONDA — BITTA KESH, TEZ PAYDO BO'LISH (egasi, 2026-09:
/// "ilovadagi rasmlar sekin ochilmoqda").
///
/// Ikki sabab bor edi:
///
///   1. `CachedNetworkImage` sukut bo'yicha har rasmni 500 ms
///      xiralashtirib ko'rsatadi (va eskisini 1000 ms o'chiradi).
///      Telefonda saqlangan rasm ham har gal shu yarim soniyani
///      kutardi — lenta "sekin ochilyapti" ko'rinardi.
///   2. Standart kesh atigi 200 ta faylni saqlaydi. Lenta, profil
///      panjarasi, avatarlar va katalog birga bu chegaradan tez
///      oshadi: eski rasmlar o'chirilib, qayta yuklanardi.
///
/// Endi hamma rasm shu bitta keshdan o'tadi: 1500 ta fayl, 60 kun.
/// Fayl nomlari serverda o'zgarmaydi (`immutable`), ya'ni uzoq
/// saqlash eskirgan rasm ko'rsatmaydi.
class NovaImageCache {
  NovaImageCache._();

  static final CacheManager manager = CacheManager(
    Config(
      'nova_images_v1',
      stalePeriod: const Duration(days: 60),
      maxNrOfCacheObjects: 1500,
    ),
  );

  /// Tarmoqdan kelgan rasm uchun qisqa, sezilmaydigan paydo bo'lish.
  static const fadeIn = Duration(milliseconds: 120);
  static const fadeOut = Duration(milliseconds: 60);
}
