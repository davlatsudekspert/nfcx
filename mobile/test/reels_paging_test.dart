// REELS — TEPAGA SILKISH TUGAB QOLMASIN.
//
// EGASINING XABARI: "tepada silksa ham bor edi-ku" — V2 da Reels
// suriladi, ilovada esa birinchi sahifadagi videolar tugagach
// silkish hech narsa keltirmasdi.
//
// SABABI: `_load()` da `_hasMore = r.hasMore && videos.isEmpty`
// yozilgan edi. Ya'ni lentada VIDEO BO'LSA — aynan Reels'ning
// normal holati — `_hasMore` doim `false` bo'lib, sahifalash
// butunlay o'chib qolardi. Video umuman bo'lmaganda esa (zaxira
// yo'l) sahifalash ishlardi. Shart teskari edi.
//
// Ro'yxatni yig'ish qoidasi shu sababli ekran holatidan ajratildi
// (`reelsPick`, `reelsMerge`) — quyidagi sinovlar aynan o'sha
// qoidani qulflaydi.
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/screens/content/reels.dart';

FeedEntry e(int id, {String? video, String kind = 'post'}) => FeedEntry(
      kind: kind,
      id: id,
      code: 'AAA512',
      authorKind: 'card',
      name: 'Jasur Tolipov',
      imageUrl: '/uploads/p$id.jpg',
      videoUrl: video,
      caption: 'Kadr $id',
    );

void main() {
  group('reelsPick — ro‘yxatni yig‘ish', () {
    test('VIDEO BOR — faqat videolar qoladi, rejim "faqat video"', () {
      final r = reelsPick([e(1, video: '/v1.mp4'), e(2), e(3, video: '/v3.mp4')]);
      expect(r.items.map((x) => x.id), [1, 3]);
      expect(r.videoOnly, isTrue);
    });

    test('VIDEO YO‘Q — lentaning o‘zi ko‘rsatiladi, rejim o‘chiq', () {
      // "Bo'sh" ekrandan ko'ra rasm lentasi yaxshi. Lekin rejim
      // o'chiq bo'lishi SHART: aks holda keyingi sahifalarda ham
      // hamma narsa filtrlanib, ro'yxat to'satdan bo'shab qolardi.
      final r = reelsPick([e(1), e(2)]);
      expect(r.items.map((x) => x.id), [1, 2]);
      expect(r.videoOnly, isFalse);
    });

    test('bo‘sh lenta — bo‘sh ro‘yxat, rejim o‘chiq', () {
      final r = reelsPick(const []);
      expect(r.items, isEmpty);
      expect(r.videoOnly, isFalse);
    });

    test('bo‘sh satrli videoUrl video hisoblanmaydi', () {
      final r = reelsPick([e(1, video: '   '), e(2, video: '/v2.mp4')]);
      expect(r.items.map((x) => x.id), [2]);
    });
  });

  group('reelsMerge — keyingi sahifa', () {
    test('FAQAT VIDEO rejimida rasm postlari qo‘shilmaydi', () {
      final fresh = reelsMerge(
        current: [e(1, video: '/v1.mp4')],
        incoming: [e(2), e(3, video: '/v3.mp4'), e(4)],
        videoOnly: true,
      );
      expect(fresh.map((x) => x.id), [3]);
    });

    test('rejim o‘chiq bo‘lsa hamma narsa qo‘shiladi', () {
      final fresh = reelsMerge(
        current: [e(1)],
        incoming: [e(2), e(3)],
        videoOnly: false,
      );
      expect(fresh.map((x) => x.id), [2, 3]);
    });

    test('TAKRORLANGAN kadr ikki marta qo‘shilmaydi', () {
      // Sahifalar chegarasida server bir kadrni ikki marta berishi
      // mumkin: lentaga yangi post qo'shilsa hammasi bir pog'ona
      // siljiydi.
      final fresh = reelsMerge(
        current: [e(1, video: '/v1.mp4'), e(2, video: '/v2.mp4')],
        incoming: [e(2, video: '/v2.mp4'), e(3, video: '/v3.mp4')],
        videoOnly: true,
      );
      expect(fresh.map((x) => x.id), [3]);
    });

    test('bitta sahifa ichidagi takror ham bir marta olinadi', () {
      final fresh = reelsMerge(
        current: const [],
        incoming: [e(5, video: '/v5.mp4'), e(5, video: '/v5.mp4')],
        videoOnly: true,
      );
      expect(fresh.map((x) => x.id), [5]);
    });

    test('POST va STORY bir xil raqamli bo‘lsa — ikkalasi ham qoladi', () {
      // Post va istorya id ketma-ketligi ALOHIDA: 7-post va
      // 7-istorya bir vaqtda bo'lishi mumkin. Takrorni faqat id
      // bo'yicha aniqlash ulardan birini yo'qotardi.
      final fresh = reelsMerge(
        current: const [],
        incoming: [
          e(7, video: '/v7.mp4'),
          e(7, video: '/s7.mp4', kind: 'story'),
        ],
        videoOnly: true,
      );
      expect(fresh.length, 2);
    });

    test('videosiz sahifa BO‘SH qaytaradi — ekran keyingisini so‘raydi', () {
      // Ekran shu bo'sh natijani ko'rib keyingi sahifaga o'tadi
      // (cheklangan qadamda). Bo'sh qaytmasa, tepaga silkish
      // "tugadi" bo'lib qolardi.
      final fresh = reelsMerge(
        current: [e(1, video: '/v1.mp4')],
        incoming: [e(2), e(3)],
        videoOnly: true,
      );
      expect(fresh, isEmpty);
    });
  });
}
