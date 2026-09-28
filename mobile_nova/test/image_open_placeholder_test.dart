import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/social/media_frame.dart';

import 'helpers.dart';

/// TOVAR SAHIFASI "SAKRAB" OCHILMASIN (egasi, 2026-09-28: "mahsulot va
/// demolar sekin ochilyapti, ochganda sakrash bo'ladi").
///
/// Katalog katakchasi rasmni kichik o'lchamda ochadi; tovar sahifasi
/// o'sha rasmni ekran kengligida qayta ochardi va shu orada KULRANG
/// bo'sh quti turardi. Endi katta rasm tayyor bo'lguncha o'rnida
/// xotiradagi kichik nusxa turadi.
void main() {
  Future<void> box(WidgetTester tester, String url, double side) async {
    await tester.pumpWidget(wrapScreen(Center(
      child: SizedBox(
        width: side,
        height: side,
        child: Builder(
          builder: (c) => mediaImage(c, url, fit: BoxFit.cover),
        ),
      ),
    )));
    await tester.pump();
  }

  // Asosiy rasm ham (OctoImage ichida) ResizeImage — o'rinbosar esa
  // undan KICHIK o'lchamdagisi.
  Iterable<int?> thumbs(WidgetTester tester) {
    final w = tester
        .widgetList<Image>(find.byType(Image))
        .map((i) => i.image)
        .whereType<ResizeImage>()
        .map((r) => r.width)
        .toList();
    final main = w.whereType<int>().fold<int>(0, (a, b) => b > a ? b : a);
    return w.where((x) => x != null && x < main);
  }

  testWidgets('katta quti — kichik nusxa o‘rinbosar, kulrang emas',
      (tester) async {
    const url = 'https://nfcstore.uz/uploads/thumb_test_a.jpg';
    await box(tester, url, 90);
    final small = smallestDecodeWidth(url);
    expect(small, isNotNull, reason: 'katakcha o‘lchami eslab qolinsin');

    await box(tester, url, 390);
    expect(thumbs(tester), contains(small),
        reason: 'katta rasm tayyor bo‘lguncha kichik nusxa ko‘rinsin');
    expect(smallestDecodeWidth(url), small,
        reason: 'katta ochilish kichik o‘lchamni almashtirmaydi — '
            'qayta qurilganda o‘rinbosar kulrangga qaytmaydi');

    // Qayta qurilish (masalan, sotuvchi ma'lumoti keldi) — o'sha nusxa.
    await box(tester, url, 390);
    expect(thumbs(tester), contains(small));
  });

  testWidgets('avval ko‘rilmagan rasm — oddiy kulrang o‘rinbosar',
      (tester) async {
    const url = 'https://nfcstore.uz/uploads/thumb_test_b.jpg';
    await box(tester, url, 390);
    expect(thumbs(tester), isEmpty,
        reason: 'tarmoqdan ikki marta yuklanmasin');
  });

  testWidgets('kichik quti — o‘rinbosar kerak emas', (tester) async {
    const url = 'https://nfcstore.uz/uploads/thumb_test_c.jpg';
    await box(tester, url, 390);
    await box(tester, url, 90);
    expect(thumbs(tester), isEmpty);
  });

  test('o‘rinbosar kaliti CachedNetworkImage kaliti bilan bir xil', () {
    // `CachedNetworkImage(memCacheWidth: w)` ichida OctoImage
    // `ResizeImage(CachedNetworkImageProvider(url), width: w)` quradi —
    // o'rinbosar AYNAN shu kalit bilan xotiradan olinadi.
    final src = File('lib/features/social/media_frame.dart').readAsStringSync();
    expect(src, contains('image: ResizeImage('));
    expect(src,
        contains('CachedNetworkImageProvider(url, cacheManager: NovaImageCache.manager)'));
    expect(src, contains('memCacheWidth: width,'));
  });
}
