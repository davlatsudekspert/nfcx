import 'dart:async';

import 'package:flutter/services.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';
import 'package:in_app_purchase_storekit/in_app_purchase_storekit.dart';
import 'package:in_app_purchase_storekit/store_kit_2_wrappers.dart'
    show SK2SubscriptionPeriodUnit;

// ═══════════════════════════════════════════════════════════════════
// APP STORE (StoreKit 2) — ILOVA SHU YUPQA QATLAM ORQALI GAPLASHADI
//
// Nima uchun alohida interfeys: xarid oqimi (narx, xarid, tiklash,
// tranzaksiyani yopish) widget testida haqiqiy StoreKit'siz sinalishi
// kerak. Test [IapStore] ning soxta nusxasini beradi
// (`iapStoreProvider.overrideWithValue`).
//
// FAQAT iPHONE. Android'da bu qatlam umuman chaqirilmaydi:
// `iapConfigProvider` iPhone bo'lmasa tarmoqqa ham chiqmay "o'chiq"
// qaytaradi, `registerPlatform()` esa birinchi chaqiruvda (ya'ni faqat
// iPhone'da) ishlaydi. `pubspec.yaml` da umumiy `in_app_purchase` emas,
// faqat StoreKit plagini — Android ilovaga Play Billing kutubxonasi va
// `BILLING` ruxsati qo'shilmaydi.
// ═══════════════════════════════════════════════════════════════════

/// Obuna davri birligi (StoreKit `Product.SubscriptionPeriod.Unit`).
enum IapPeriodUnit { day, week, month, year }

/// Do'kondagi mahsulot — ilovaga kerakli qismi.
class IapProduct {
  const IapProduct({
    required this.id,
    required this.title,
    required this.price,
    this.periodUnit,
    this.periodValue = 1,
  });

  final String id;
  final String title;

  /// App Store'ning O'ZI formatlagan narx (`Product.displayPrice`):
  /// valyuta va mamlakatga mos. Ilova narxni hech qachon o'zi yozmaydi.
  final String price;

  /// Obuna davri. `null` — obuna emas yoki do'kon aytmadi.
  final IapPeriodUnit? periodUnit;
  final int periodValue;
}

enum IapPurchaseStatus { pending, purchased, restored, canceled, error }

/// Xarid / tiklash yangilanishi (`purchaseStream` dan).
class IapPurchase {
  const IapPurchase({
    required this.productId,
    required this.status,
    this.purchaseId,
    this.signedTransaction = '',
    this.needsCompletion = false,
    this.errorCode,
    this.raw,
  });

  final String productId;
  final IapPurchaseStatus status;

  /// StoreKit tranzaksiya raqami. Kutilayotgan / bekor qilinganda yo'q.
  final String? purchaseId;

  /// StoreKit 2 imzolangan tranzaksiyasi (JWS) — serverga shu yuboriladi
  /// (`verificationData.serverVerificationData`).
  final String signedTransaction;

  /// `completePurchase` kerakmi (StoreKit 2 da — faqat yangi xarid).
  final bool needsCompletion;
  final String? errorCode;

  /// Plagin obyekti — `complete()` ga qaytariladi.
  final Object? raw;
}

/// StoreKit bilan ishlash interfeysi.
abstract class IapStore {
  /// Bu qurilmada xarid qilish mumkinmi (`AppStore.canMakePayments`).
  Future<bool> isAvailable();

  /// Narx va davr — App Store'dan. Topilmaganlari ro'yxatda bo'lmaydi.
  Future<List<IapProduct>> products(Set<String> ids);

  /// Xarid oynasini ochadi. Natija [purchases] oqimiga keladi.
  /// [accountToken] — server bergan UUID (StoreKit 2 `appAccountToken`).
  Future<void> buy(String productId, {String? accountToken});

  /// Faol obunalarni qayta yuboradi ([IapPurchaseStatus.restored]).
  Future<void> restore();

  /// Tranzaksiyani yopadi — FAQAT server tasdiqlagandan keyin.
  Future<void> complete(IapPurchase purchase);

  Stream<List<IapPurchase>> get purchases;
}

/// Haqiqiy StoreKit 2 (`in_app_purchase_storekit`).
///
/// 0.4.x da StoreKit 2 sukut bo'yicha yoqilgan
/// (`enableStoreKit2()` eskirgan va shunchaki `true` qo'yadi), shuning
/// uchun `serverVerificationData` — tranzaksiyaning JWS ko'rinishi
/// (`VerificationResult.jwsRepresentation`).
class StoreKitIapStore implements IapStore {
  StoreKitIapStore();

  static bool _registered = false;
  final Map<String, ProductDetails> _details = {};

  InAppPurchasePlatform get _platform {
    if (!_registered) {
      InAppPurchaseStoreKitPlatform.registerPlatform();
      _registered = true;
    }
    return InAppPurchasePlatform.instance;
  }

  @override
  Future<bool> isAvailable() async {
    try {
      return await _platform.isAvailable();
    } catch (_) {
      return false;
    }
  }

  @override
  Future<List<IapProduct>> products(Set<String> ids) async {
    final res = await _platform.queryProductDetails(ids);
    final out = <IapProduct>[];
    for (final d in res.productDetails) {
      _details[d.id] = d;
      final sub = d is AppStoreProduct2Details
          ? d.sk2Product.subscription?.subscriptionPeriod
          : null;
      out.add(IapProduct(
        id: d.id,
        title: d.title,
        price: d.price,
        periodUnit: switch (sub?.unit) {
          SK2SubscriptionPeriodUnit.day => IapPeriodUnit.day,
          SK2SubscriptionPeriodUnit.week => IapPeriodUnit.week,
          SK2SubscriptionPeriodUnit.month => IapPeriodUnit.month,
          SK2SubscriptionPeriodUnit.year => IapPeriodUnit.year,
          null => null,
        },
        periodValue: sub?.value ?? 1,
      ));
    }
    if (out.isEmpty && res.error != null) {
      throw PlatformException(
          code: res.error!.code, message: res.error!.message);
    }
    return out;
  }

  @override
  Future<void> buy(String productId, {String? accountToken}) async {
    final d = _details[productId];
    if (d == null) {
      throw PlatformException(code: 'product_not_loaded', message: productId);
    }
    await _platform.buyNonConsumable(
      purchaseParam: PurchaseParam(
        productDetails: d,
        // StoreKit 2: UUID bo'lsa `appAccountToken` sifatida ketadi va
        // server tranzaksiyani shu hisobga bog'laydi.
        applicationUserName: accountToken,
      ),
    );
  }

  @override
  Future<void> restore() => _platform.restorePurchases();

  @override
  Future<void> complete(IapPurchase purchase) async {
    final raw = purchase.raw;
    // Tranzaksiya raqami yo'q bo'lsa (kutilayotgan / bekor) StoreKit 2
    // `finish` ni chaqirib bo'lmaydi — plagin `int.parse(null)` qiladi.
    if (raw is! PurchaseDetails || raw.purchaseID == null) return;
    await _platform.completePurchase(raw);
  }

  @override
  Stream<List<IapPurchase>> get purchases =>
      _platform.purchaseStream.map((list) => [for (final p in list) _map(p)]);

  static IapPurchase _map(PurchaseDetails p) => IapPurchase(
        productId: p.productID,
        purchaseId: p.purchaseID,
        status: switch (p.status) {
          PurchaseStatus.pending => IapPurchaseStatus.pending,
          PurchaseStatus.purchased => IapPurchaseStatus.purchased,
          PurchaseStatus.restored => IapPurchaseStatus.restored,
          PurchaseStatus.canceled => IapPurchaseStatus.canceled,
          PurchaseStatus.error => IapPurchaseStatus.error,
        },
        signedTransaction: p.verificationData.serverVerificationData,
        needsCompletion: p.pendingCompletePurchase,
        errorCode: p.error?.code,
        raw: p,
      );
}
