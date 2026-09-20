import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';

/// HAQIQIY SERVER JAVOBI BILAN SHARTNOMA SINOVI.
///
/// Oldingi sinovlar soxta `Post(isVideo: true, mediaUrls: [...])`
/// yasab tekshirardi — ya'ni PARSERNI CHETLAB O'TARDI va aynan
/// shuning uchun telefonda yiqilgan narsani ko'rmadi.
///
/// Bu yerdagi JSON qo'lda yozilmagan: u E2E #26 da haqiqiy
/// `nfcstore.uz` dan kelgan javobning AYNAN nusxasi.
void main() {
  // E2E #26, `POST /api/records/VIP001/posts` javobi.
  // Diqqat: `imageUrl` — BO'SH SATR, `null` emas.
  const reelJson = '''
{"id":21,"code":"VIP001","imageUrl":"",
 "videoUrl":"/uploads/cardvid_7cd1cd69d969b2d809d18032.mp4",
 "caption":"NOVA E2E TEST","createdAt":1789891554000,
 "likeCount":0,"liked":false}''';

  // O'sha ro'yxatdagi ODDIY post — teskari holat.
  const imageJson = '''
{"id":20,"code":"VIP001","imageUrl":"/uploads/6575b79c0ba54bb44fa3.png",
 "videoUrl":"","caption":"NOVA E2E TEST","createdAt":1789891535000,
 "likeCount":0,"liked":false}''';

  Post parse(String raw) =>
      Post.fromJson(jsonDecode(raw) as Map<String, dynamic>);

  group('Haqiqiy server javobi — video post', () {
    test('`videoUrl` MEDIA sifatida o‘qiladi', () {
      final p = parse(reelJson);

      // Ildiz sabab shu yerda edi: `j['imageUrl'] ?? j['videoUrl']`
      // bo'sh satrda keyingisiga O'TMAYDI, shuning uchun media
      // ro'yxati bo'sh qolardi.
      expect(p.mediaUrls, isNotEmpty,
          reason: 'bo‘sh `imageUrl` `videoUrl` ni bosib qoldi');
      expect(p.mediaUrls.first, contains('cardvid_'));
      expect(p.mediaUrls.first, endsWith('.mp4'));
    });

    test('`isVideo` va media BIRGA to‘g‘ri bo‘ladi', () {
      final p = parse(reelJson);

      // E2E #26 da aynan shu ziddiyat chiqdi: isVideo=true,
      // media=0. Reels filtri IKKALASIGA ham qaraydi, shuning
      // uchun bo'lim bo'sh turardi.
      expect(p.isVideo, isTrue);
      expect(p.isVideo && p.mediaUrls.isNotEmpty, isTrue,
          reason: 'Reels filtri (`isVideo && mediaUrls.isNotEmpty`) '
              'bu postni rad etadi');
    });

    test('manzil TO‘LIQ bo‘ladi — pleyer nisbiy yo‘lni ocholmaydi', () {
      final p = parse(reelJson);
      expect(p.mediaUrls.first, startsWith('http'),
          reason: 'ExoPlayer `/uploads/...` ni ocholmaydi');
    });
  });

  group('Haqiqiy server javobi — rasmli post', () {
    test('bo‘sh `videoUrl` rasmni buzmaydi', () {
      final p = parse(imageJson);
      expect(p.mediaUrls.single, contains('6575b79c0ba54bb44fa3.png'));
      expect(p.isVideo, isFalse);
    });
  });

  group('Chegara holatlari', () {
    test('ikkala manzil ham bo‘sh — media yo‘q', () {
      final p = parse('{"id":1,"code":"A","imageUrl":"","videoUrl":""}');
      expect(p.mediaUrls, isEmpty);
      expect(p.isVideo, isFalse);
    });

    test('`imageUrl` umuman yo‘q — `videoUrl` olinadi', () {
      final p = parse('{"id":2,"code":"A","videoUrl":"/uploads/v.webm"}');
      expect(p.mediaUrls.single, endsWith('/uploads/v.webm'));
      expect(p.isVideo, isTrue);
    });

    test('ro‘yxat shakli ustun turadi', () {
      final p = parse('{"id":3,"code":"A","imageUrl":"",'
          '"videoUrl":"/uploads/v.mp4",'
          '"mediaUrls":["/uploads/a.png","/uploads/b.png"]}');
      expect(p.mediaUrls.length, 2);
    });
  });
}
