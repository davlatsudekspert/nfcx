import 'package:flutter/material.dart';

import '../../data/models/models.dart';
import '../../l10n/gen/app_localizations.dart';

// Umumiy katalog yorliqlari va belgilari — Tanlov katalogi, listing
// sahifasi va biznes formasi BIR XIL so'zlarni ishlatsin.

String marketLabel(L l, MarketCategory m) => switch (m) {
      MarketCategory.food => l.marketFood,
      MarketCategory.fashion => l.marketFashion,
      MarketCategory.electronics => l.marketElectronics,
      MarketCategory.beauty => l.marketBeauty,
      MarketCategory.education => l.marketEducation,
      MarketCategory.health => l.marketHealth,
      MarketCategory.home => l.marketHome,
      MarketCategory.auto => l.marketAuto,
      MarketCategory.other => l.marketOther,
    };

IconData marketIcon(MarketCategory m) => switch (m) {
      MarketCategory.food => Icons.restaurant_rounded,
      MarketCategory.fashion => Icons.checkroom_rounded,
      MarketCategory.electronics => Icons.devices_other_rounded,
      MarketCategory.beauty => Icons.spa_outlined,
      MarketCategory.education => Icons.school_outlined,
      MarketCategory.health => Icons.medical_services_outlined,
      MarketCategory.home => Icons.handyman_outlined,
      MarketCategory.auto => Icons.directions_car_outlined,
      MarketCategory.other => Icons.inventory_2_outlined,
    };

/// Birlikda: "Mahsulot" / "Xizmat".
String kindLabel(L l, ListingKind k) =>
    k == ListingKind.service ? l.listingService : l.listingProduct;

/// Ko'plikda, filtr chipi uchun: "Tovarlar" / "Xizmatlar".
String kindPluralLabel(L l, ListingKind k) =>
    k == ListingKind.service ? l.catalogKindService : l.catalogKindProduct;

IconData kindIcon(ListingKind k) => k == ListingKind.service
    ? Icons.design_services_outlined
    : Icons.shopping_bag_outlined;

/// NFC sub-turi (faqat NFCSTORE mahsulotlari uchun).
String nfcTypeLabel(L l, NfcProductType t) => switch (t) {
      NfcProductType.card => l.catalogCards,
      NfcProductType.sticker => l.catalogStickers,
      NfcProductType.keychain => l.catalogKeychains,
      NfcProductType.accessory => l.catalogAccessories,
      NfcProductType.other => l.catalogOther,
    };

IconData nfcTypeIcon(NfcProductType t) => switch (t) {
      NfcProductType.card => Icons.credit_card_rounded,
      NfcProductType.sticker => Icons.circle_outlined,
      NfcProductType.keychain => Icons.key_rounded,
      NfcProductType.accessory => Icons.watch_outlined,
      NfcProductType.other => Icons.inventory_2_outlined,
    };

/// Kartochka ustidagi ko'z-qator: "ELEKTRONIKA · KARTALAR" yoki
/// "GO'ZALLIK · XIZMAT".
String listingEyebrow(L l, CatalogProduct p) {
  final parts = <String>[
    marketLabel(l, p.marketCategory),
    if (p.sub != null) nfcTypeLabel(l, p.sub!),
    if (p.sub == null && p.isService) l.listingService,
  ];
  return parts.join(' · ');
}

/// Telefon / Telegram / WhatsApp — tashqi kanal havolalari.
String telUrl(String phone) =>
    'tel:${phone.replaceAll(RegExp(r'[^\d+]'), '')}';
String telegramUrl(String handle) {
  final h = handle.trim();
  if (h.startsWith('http')) return h;
  return 'https://t.me/${h.replaceAll('@', '')}';
}

String whatsappUrl(String number) =>
    'https://wa.me/${number.replaceAll(RegExp(r'[^\d]'), '')}';
