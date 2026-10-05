import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';
import 'package:nfcstore_nova/features/profile/music_source.dart';

/// Profil musiqasida YouTube / Yandex Music havolalari.
///
/// 2026-10-05: PPP777 profilida ikki YouTube va bitta Yandex havola
/// bor edi. Pleyer ularni audio fayl deb `video_player` ga berardi,
/// u esa sahifani ocha olmay "Qo'shiqni ochib bo'lmadi" derdi
/// (iPhone ham, Android ham). Nomi o'rniga video ID ko'rinardi.
void main() {
  test('turi to‘g‘ri aniqlanadi — sayt bilan bir xil qoidalar', () {
    final yt =
        MusicSource.parse('https://youtu.be/lKhxTeC2h9s?si=KK_7ZidJqcB7T39Z');
    expect(yt.kind, MusicKind.youtube);
    expect(yt.id, 'lKhxTeC2h9s');
    expect(yt.isExternal, isTrue);
    expect(
        MusicSource.parse('https://www.youtube.com/watch?v=48Heq9b3UNU&t=3').id,
        '48Heq9b3UNU');
    expect(MusicSource.parse('https://youtube.com/shorts/48Heq9b3UNU').id,
        '48Heq9b3UNU');
    expect(
        MusicSource.parse('https://music.youtube.com/watch?v=48Heq9b3UNU').kind,
        MusicKind.youtube);
    expect(
        MusicSource.parse('https://music.yandex.com/album/1581808/track/'
                '44093415?utm_medium=copy_link')
            .kind,
        MusicKind.yandex);
    expect(MusicSource.parse('https://music.yandex.ru/album/1581808').kind,
        MusicKind.yandex);

    final mp3 = MusicSource.parse('https://nfcstore.uz/uploads/a.mp3');
    expect(mp3.kind, MusicKind.audio);
    expect(mp3.isExternal, isFalse);
    expect(MusicSource.parse('/uploads/My%20Track.m4a').kind, MusicKind.audio);
  });

  test('nomi video ID emas — xizmat nomi', () {
    expect(musicTitleOf('https://youtu.be/lKhxTeC2h9s?si=x'), 'YouTube');
    expect(
        musicTitleOf('https://music.yandex.com/album/1581808/track/44093415'),
        'Yandex Music');
    // Oddiy fayl — avvalgidek fayl nomi.
    expect(musicTitleOf('https://nfcstore.uz/uploads/night_drive.mp3'),
        'night drive');
  });
}
