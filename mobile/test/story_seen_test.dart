// ISTORYA HALQASI KO'RILGANDAN KEYIN SO'NADIMI.
//
// DIZAYN QOIDASI (egasining talabi):
//   • yangi (24 soat ichida) istorya bor — oltin gradient halqa va u
//     sekin aylanadi;
//   • ko'rilgandan keyin — xira, kulrang va QOTGAN halqa;
//   • istorya yo'q — halqa umuman yo'q (o'z profilida "+" turadi).
//
// BIRINCHI IKKITASI SERVERGA BOG'LIQ EMAS: backend'da "kim qaysi
// istoryani ko'rgan" degan jadval yo'q va uni qo'shish server
// o'zgarishi bo'lardi. Shuning uchun ko'rilganlar QURILMADA
// saqlanadi — shu fayl aynan o'sha mantiqni qo'riqlaydi.
//
// UCHINCHISI o'z-o'zidan bajariladi: `/api/stories/feed` faqat
// muddati o'tmagan istoryasi BOR odamlarni qaytaradi, ya'ni
// istoryasizlar qatorda umuman paydo bo'lmaydi.
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/state/seen_stories.dart';
import 'package:shared_preferences/shared_preferences.dart';

StoryFeedEntry entry(List<int> ids) =>
    StoryFeedEntry(code: 'AAA111', name: 'Jasur', ids: ids);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<SeenStories> ready() async {
    final s = SeenStories();
    await s.load();
    return s;
  }

  test('ko‘rilmagan istorya — halqa yonadi', () async {
    final seen = await ready();
    expect(seen.hasUnseen(entry([1, 2])), isTrue);
  });

  test('ko‘rilgandan keyin — halqa so‘nadi', () async {
    final seen = await ready();
    await seen.markSeen([1, 2]);
    expect(seen.hasUnseen(entry([1, 2])), isFalse);
  });

  test('YANGISI QO‘YILSA HALQA QAYTA YONADI', () async {
    // Eng nozik joyi: odam kechagi ikkitasini ko'rgan, bugun uchinchi
    // qo'yilgan. Faqat SON saqlansa bu holat sezilmasdi — shuning
    // uchun ID'lar saqlanadi.
    final seen = await ready();
    await seen.markSeen([1, 2]);
    expect(seen.hasUnseen(entry([1, 2, 3])), isTrue);
  });

  test('qurilmada ESLAB QOLINADI — ilova yopilib ochilsa ham', () async {
    final first = await ready();
    await first.markSeen([7]);

    final second = await ready();
    expect(second.hasUnseen(entry([7])), isFalse);
  });

  test('ro‘yxat cheksiz o‘smaydi — eng eskisi tushib qoladi', () async {
    final seen = await ready();
    await seen.markSeen(List.generate(600, (i) => i + 1));
    // Eng eskisi unutildi, eng yangilari joyida.
    expect(seen.hasUnseen(entry([1])), isTrue);
    expect(seen.hasUnseen(entry([600])), isFalse);
  });

  test('lentadagi ID‘lar model orqali yetib keladi', () async {
    // Server javobi shaklidan ID'lar olinmasa, butun mantiq ishlamay
    // qolardi — halqa hamma vaqt oltin bo'lib turardi.
    final e = StoryFeedEntry.fromJson({
      'code': 'aaa111',
      'name': 'Jasur',
      'avatarUrl': '/uploads/a.jpg',
      'stories': [
        {'id': 11, 'imageUrl': '/uploads/1.jpg'},
        {'id': 12, 'imageUrl': '/uploads/2.jpg'},
      ],
    });

    expect(e.ids, [11, 12]);
    expect(e.count, 2);
    expect(e.code, 'AAA111');
  });
}
