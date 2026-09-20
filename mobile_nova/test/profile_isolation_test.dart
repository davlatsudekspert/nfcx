import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/auth/session.dart';

import 'helpers.dart';

/// HAR BIR PROFIL O'ZINI OCHISHI KERAK.
///
/// Haqiqiy hisobdagi E2E aynan shuni ushladi:
///
///     noto'g'ri kontekst: shaxsiy ALI777 -> TTS075; ZZZ007 -> TTS075
///
/// Sabab: `profileType` o'qiladigan bo'lgandan keyin saytda "biznes"
/// uslubi qo'yilgan yozuvlar `personalIdsProvider` filtridan tushib
/// qoldi, `activePersonalProvider` esa AYNAN o'sha filtrlangan
/// ro'yxatdan qidirardi. Topolmagach jimgina ASOSIY profilga
/// qaytardi — odam boshqa profilga o'tdim deb o'ylab, eskisini
/// ko'rib turardi.
void main() {
  const ids = [
    NfcId(code: 'TTS075', name: 'Asosiy', primary: true),
    NfcId(code: 'ALI777', name: 'Ali', kind: NfcIdKind.business),
    NfcId(code: 'ZZZ007', name: 'Zafar', kind: NfcIdKind.business),
    NfcId(code: 'UZD772', name: 'Uchinchi'),
  ];

  ProviderContainer build() {
    final c = ProviderContainer(overrides: [
      authRepositoryProvider
          .overrideWithValue(FakeAuthRepository(ids: ids)),
    ]);
    addTearDownContainer(c);
    return c;
  }

  test('har bir yozuv tanlanganda AYNAN o‘zi ochiladi', () async {
    final c = build();
    await c.read(sessionProvider.notifier).refresh();

    final wrong = <String>[];
    for (final id in ids) {
      c.read(selectedPersonalCodeProvider.notifier).state = id.code;
      final active = c.read(activePersonalProvider);
      if (active?.code != id.code) {
        wrong.add('${id.code} -> ${active?.code ?? "null"}');
      }
    }

    expect(wrong, isEmpty,
        reason: 'tanlangan profil o‘rniga boshqasi ochildi: $wrong');
  });

  test('saytda "biznes" uslubidagi yozuv ham tanlanadi', () async {
    final c = build();
    await c.read(sessionProvider.notifier).refresh();

    c.read(selectedPersonalCodeProvider.notifier).state = 'ALI777';
    expect(c.read(activePersonalProvider)?.code, 'ALI777',
        reason: '`profile_type = business` — bu saytdagi ko‘rinish '
            'uslubi, hisobdagi alohida kompaniya emas');
  });

  test('hech narsa tanlanmasa ASOSIY yozuv ochiladi', () async {
    final c = build();
    await c.read(sessionProvider.notifier).refresh();

    expect(c.read(selectedPersonalCodeProvider), isNull);
    expect(c.read(activePersonalProvider)?.code, 'TTS075');
  });

  test('mavjud bo‘lmagan kod tanlansa ASOSIYGA qaytadi', () async {
    final c = build();
    await c.read(sessionProvider.notifier).refresh();

    c.read(selectedPersonalCodeProvider.notifier).state = 'YOQ999';
    expect(c.read(activePersonalProvider)?.code, 'TTS075',
        reason: 'o‘chirilgan yozuv tanlangan bo‘lsa ilova profilsiz '
            'qolmasligi kerak');
  });
}
