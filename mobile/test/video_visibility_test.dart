// VIDEO KO'RINMAY QOLGANDA TO'XTAYDIMI.
//
// Egasining xabari: "Reels'ga kirsam, profilga o'tsam ham ovozi
// eshitilyapti. Boshqa punktga o'tsam ham o'chmayapti."
//
// Uch xil holat, bitta sabab: video faqat "shu kadr ekranda"
// shartiga qarardi va qolgan uchtasini bilmasdi. Bu test o'sha
// to'rt shartni qulflaydi — haqiqiy pleyer qurilmasiz ishlamaydi,
// shuning uchun qaror alohida funksiyaga ajratilgan.
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/video_view.dart';

void main() {
  bool play({
    bool active = true,
    bool autoPlay = true,
    bool covered = false,
    bool foreground = true,
    bool tabVisible = true,
  }) =>
      videoShouldPlay(
        active: active,
        autoPlay: autoPlay,
        covered: covered,
        foreground: foreground,
        tabVisible: tabVisible,
      );

  test('hammasi joyida — o‘ynaydi', () {
    expect(play(), isTrue);
  });

  test('boshqa tabga o‘tildi — to‘xtaydi', () {
    expect(play(tabVisible: false), isFalse);
  });

  test('ustiga boshqa ekran ochildi — to‘xtaydi', () {
    expect(play(covered: true), isFalse);
  });

  test('ilova fonga ketdi — to‘xtaydi', () {
    expect(play(foreground: false), isFalse);
  });

  test('qo‘shni kadr (Reels) — o‘ynamaydi', () {
    expect(play(active: false), isFalse);
  });

  test('avtomatik ishga tushirish o‘chirilgan — o‘ynamaydi', () {
    expect(play(autoPlay: false), isFalse);
  });

  test('bir nechta sabab birga — baribir to‘xtaydi', () {
    expect(play(covered: true, foreground: false, tabVisible: false), isFalse);
  });
}
