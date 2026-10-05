import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/profile/music_embed.dart';

/// YANDEX — pleerdagi play vidjetning o'zini boshqaradi (egasi,
/// 2026-10-05: ilgari ikki joyda play bosish kerak edi).
void main() {
  test('ko‘prik skript vidjet tugmasini bosuvchi nfcToggle beradi', () {
    const js = MusicEmbed.yandexBridgeJs;
    expect(js, contains('window.nfcToggle='));
    // Ikki marta qo'yilsa ham bitta ishlovchi qoladi.
    expect(js, contains('if (window.nfcToggle) return;'));
    // Ochilgach o'zi boshlaydi, lekin cheksiz urinmaydi.
    expect(js, contains('++n>16'));
    // Holat pleerga ketadi.
    expect(js, contains("post('playing')"));
    expect(js, contains("post('paused')"));
  });
}
