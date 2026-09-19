import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/media_url.dart';
import 'package:nfcstore_nova/data/models/models.dart';

/// NISBIY MANZIL — ILOVADA ISHLAMAYDI.
///
/// Backend yuklangan fayllarni `/uploads/...` deb, domensiz
/// qaytaradi (`hosting/worker.js` → `safeUrl`). Saytda bu to'g'ri:
/// u o'sha domenda turadi. Ilova esa hech qanday domenda turmaydi,
/// shuning uchun `Uri.parse('/uploads/x')` — sxemasiz manzil va uni
/// na `video_player`, na rasm keshi ocha oladi.
///
/// E2E #6 da `Music player` aynan shu sababdan FAIL bo'lgan edi.
void main() {
  group('mediaUrl', () {
    test('nisbiy yo\'l to\'liq manzilga aylanadi', () {
      expect(mediaUrl('/uploads/abc'), '$kApiBase/uploads/abc');
    });

    test('boshida slash bo\'lmasa ham qo\'shiladi', () {
      expect(mediaUrl('uploads/abc'), '$kApiBase/uploads/abc');
    });

    test('TASHQI havolaga TEGILMAYDI', () {
      // Server tashqi manzilga ham ruxsat beradi — `safeUrl`
      // ichidagi `new URL(...)` shoxi. Uni buzib qo'ymaslik kerak.
      const ext = 'https://cdn.example.com/a.mp3';
      expect(mediaUrl(ext), ext);
      expect(mediaUrl('http://x.uz/a.png'), 'http://x.uz/a.png');
    });

    test('data: manzili o\'zgarmaydi', () {
      expect(mediaUrl('data:image/png;base64,AAAA'),
          'data:image/png;base64,AAAA');
    });

    test('bo\'sh qiymat bo\'sh qoladi', () {
      // Bo'shni bazaga ulab qo'yish eng yomoni bo'lardi: manzil
      // "bor" ko'rinardi va ekran zaxira ko'rinishini emas, buzuq
      // rasmni ko'rsatardi.
      expect(mediaUrl(''), '');
      expect(mediaUrl('   '), '');
    });
  });

  group('storageUrl — serverga YOZISH uchun', () {
    test('bizning bazamiz olib tashlanadi', () {
      // O'qishda model manzilni to'ldiradi, shuning uchun tahrir
      // maydoni to'liq manzil bilan to'ladi. Foydalanuvchi faqat
      // ismini o'zgartirsa ham, o'sha manzil serverga qaytadi —
      // va baza domenga bog'lanib qolardi.
      expect(storageUrl('$kApiBase/uploads/a.jpg'), '/uploads/a.jpg');
    });

    test('BEGONA domen tegilmaydi', () {
      const ext = 'https://cdn.example.com/a.mp3';
      expect(storageUrl(ext), ext);
    });

    test('allaqachon nisbiy bo\'lsa o\'zgarmaydi', () {
      expect(storageUrl('/uploads/a.jpg'), '/uploads/a.jpg');
    });

    test('bo\'sh bo\'sh qoladi', () {
      expect(storageUrl(''), '');
    });

    test('mediaUrl va storageUrl bir-birini QAYTARADI', () {
      // Aylanma: nisbiy → to'liq → nisbiy. Shu xossa buzilsa,
      // saqlangan qiymat har tahrirda o'zgarib ketardi.
      const rel = '/uploads/6b8fd42d944f7543da7c';
      expect(storageUrl(mediaUrl(rel)), rel);
    });
  });

  group('modellar manzilni TO\'LIQ qaytaradi', () {
    test('NfcId — avatar, muqova va MUSIQA', () {
      final id = NfcId.fromJson({
        'code': 'VIP001',
        'avatar': '/uploads/av.jpg',
        'bgUrl': '/uploads/cover.jpg',
        'musicUrls': ['/uploads/6b8fd42d944f7543da7c'],
      });
      expect(id.avatarUrl, '$kApiBase/uploads/av.jpg');
      expect(id.coverUrl, '$kApiBase/uploads/cover.jpg');
      // AYNAN shu qator E2E #6 dagi FAIL ni qaytarmaslik uchun.
      expect(id.musicUrls.single, '$kApiBase/uploads/6b8fd42d944f7543da7c');
    });

    test('NfcId — eski bitta `musicUrl` ham', () {
      final id = NfcId.fromJson({
        'code': 'VIP001',
        'musicUrl': '/uploads/one.mp3',
      });
      expect(id.musicUrls.single, '$kApiBase/uploads/one.mp3');
    });

    test('Post — media ro\'yxati va muallif avatari', () {
      final p = Post.fromJson({
        'id': 1,
        'media': ['/uploads/a.jpg', '/uploads/b.jpg'],
        'authorAvatar': '/uploads/av.jpg',
      });
      expect(p.mediaUrls,
          ['$kApiBase/uploads/a.jpg', '$kApiBase/uploads/b.jpg']);
      expect(p.authorAvatar, '$kApiBase/uploads/av.jpg');
    });

    test('Post — yolg\'iz `imageUrl` ham ro\'yxatga tushadi', () {
      final p = Post.fromJson({'id': 2, 'imageUrl': '/uploads/c.jpg'});
      expect(p.mediaUrls.single, '$kApiBase/uploads/c.jpg');
    });

    test('StoryItem — video ustun, rasm zaxira', () {
      final v = StoryItem.fromJson({'id': 1, 'videoUrl': '/uploads/v.mp4'});
      expect(v.mediaUrl, '$kApiBase/uploads/v.mp4');
      final i = StoryItem.fromJson({'id': 2, 'imageUrl': '/uploads/i.jpg'});
      expect(i.mediaUrl, '$kApiBase/uploads/i.jpg');
    });

    test('Business — logo va muqova', () {
      final b = Business.fromJson({
        'companyId': 'NFCSTOREUZ',
        'logoUrl': '/uploads/logo.png',
        'coverUrl': '/uploads/cov.png',
      });
      expect(b.logoUrl, '$kApiBase/uploads/logo.png');
      expect(b.coverUrl, '$kApiBase/uploads/cov.png');
    });
  });

  test('YUKLASH natijasi ko\'rsatishdan oldin to\'ldiriladi', () {
    // Yuklash javobi MODELDAN O'TMAYDI — u to'g'ridan-to'g'ri
    // `uploadImage` dan keladi va darhol ekranga chiziladi.
    // Ya'ni modeldagi tuzatish bu yerga YETIB KELMAYDI: yangi
    // avatar o'rnida bo'shliq chiqardi va buni faqat ilovani
    // qayta ochgandan keyin sezish mumkin edi.
    for (final f in [
      'lib/features/profile/profile_edit_screen.dart',
      'lib/features/auth/profile_setup_screen.dart',
    ]) {
      final src = File(f).readAsStringSync();
      expect(src.contains('_avatarUrl = url'), isFalse,
          reason: '$f: yuklash natijasi XOM holda ko\'rsatilmoqda — '
              '`mediaUrl(url)` bo\'lishi kerak');
      expect(src.contains('mediaUrl(url)'), isTrue,
          reason: '$f: `mediaUrl` chaqiruvi yo\'q');
    }
  });

  test('yangi MANZIL maydoni `_s` da qolib ketmaydi', () {
    // QO'RIQCHA. Kelajakda modelga yangi manzil maydoni qo'shilsa
    // va u `_u` o'rniga `_s` dan o'tsa, xato JIMGINA qaytardi:
    // ekranda rasm o'rniga bo'shliq, musiqada esa "ochilmadi".
    // Shuning uchun manba matni tekshiriladi.
    final src = File('lib/data/models/models.dart').readAsStringSync();
    final bad = <String>[];
    final re = RegExp(
      r"_s\(\s*j\[[^\]]*(?:[Uu]rl|avatar|image|logo|cover|media|video|photo)"
      r"[^\]]*\][^)]*\)",
      caseSensitive: false,
    );
    for (final m in re.allMatches(src)) {
      final hit = m.group(0)!;
      // `.isNotEmpty` — bu manzil EMAS, borlik tekshiruvi; unga
      // bazani ulash ma'nosiz va zararsiz emas.
      final after = src.substring(m.end, (m.end + 12).clamp(0, src.length));
      if (after.startsWith('.isNotEmpty')) continue;
      final line = '\n'.allMatches(src.substring(0, m.start)).length + 1;
      bad.add('models.dart:$line  $hit');
    }
    expect(bad, isEmpty,
        reason: 'Bu manzil maydonlari `_u` dan O\'TMAYDI, ya\'ni '
            'ilovaga nisbiy yo\'l bo\'lib yetadi va ochilmaydi:\n'
            '${bad.join('\n')}');
  });
}
