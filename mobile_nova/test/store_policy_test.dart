import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/shop/store_policy.dart';

/// ILOVA ICHIDA RAQAMLI TOVAR SOTILMAYDI.
///
/// ## NIMA UCHUN BU SINOV BOR
///
/// Google Play qoidasi: ilova ichida raqamli tovar sotilsa, to'lov
/// Google Play Billing orqali o'tishi kerak. Payme/Click bilan
/// sotish ilovaning rad etilishiga yoki keyinchalik olib
/// tashlanishiga olib keladi.
///
/// Jismoniy tovar bu qoidadan OZOD. Bizdagi jismoniy NFC karta
/// aynan shunday: buyurtmada yetkazib berish MANZILI so'raladi va
/// karta pochta bilan jo'natiladi.
///
/// Ilgari ilovada uchta raqamli xarid bor edi: NFC ID, Premium va
/// FEATURED. Ular olib tashlandi. Bu sinov ularning QAYTIB
/// KELMASLIGINI qo'riqlaydi — yangi tugma qo'shilsa CI yiqiladi.
void main() {
  group('qaysi buyurtmani ilovada to\'lash mumkin', () {
    test('faqat jismoniy karta', () {
      expect(canPayInApp(OrderKind.physicalCard), isTrue);
    });

    test('raqamli mahsulotlar — yo\'q', () {
      for (final kind in [
        OrderKind.nfcId,
        OrderKind.premium,
        OrderKind.premiumFollow,
        OrderKind.auction,
      ]) {
        expect(canPayInApp(kind), isFalse, reason: kind);
      }
    });

    /// RO'YXAT "RUXSAT ETILGANLAR" SHAKLIDA.
    ///
    /// Kelajakda yangi tur qo'shilsa u AVTOMATIK ruxsat etilmagan
    /// bo'ladi. Teskarisi ("taqiqlanganlar ro'yxati") bo'lsa, yangi
    /// raqamli mahsulot jimgina to'lanadigan bo'lib qolardi.
    test('noma\'lum tur — yo\'q', () {
      expect(canPayInApp('yangi_mahsulot'), isFalse);
      expect(canPayInApp(''), isFalse);
    });
  });

  group('ekranlarda xarid tugmasi yo\'q', () {
    final files = {
      'NFC ID': 'lib/features/shop/nfc_id_market.dart',
      'Premium': 'lib/features/settings/settings_subscreens.dart',
      'FEATURED': 'lib/features/social/featured_screen.dart',
    };

    /// TO'LOVGA OLIB BORADIGAN HAVOLA OCHILMAYDI.
    ///
    /// Google "anti-steering" deb ataydigan narsa: ilova ichidan
    /// tashqi to'lov sahifasiga yo'naltirish. Shuning uchun bu uch
    /// ekranda `openLink` umuman bo'lmasligi kerak.
    for (final entry in files.entries) {
      test('${entry.key} ekranida tashqi to\'lov havolasi yo\'q', () {
        // IZOHLAR HISOBGA OLINMAYDI: hujjatda "payLinks" deb
        // yozilgani qoidabuzarlik emas, u shunchaki tushuntirish.
        final src = File(entry.value)
            .readAsStringSync()
            .replaceAll(RegExp(r'^\s*///?.*$', multiLine: true), '');
        expect(src.contains('openLink('), isFalse,
            reason: '${entry.key}: tashqi havola ochilyapti');
        // NAQSH ANIQ BO'LISHI KERAK. Oddiy `payme|click` "Payment"
        // va "PaymentHistory" so'zlarini ham ushlab, sinovni yolg'on
        // qizartirardi. Shuning uchun HAQIQIY to'lov havolalari
        // qidiriladi.
        for (final marker in [
          'paymeLink',
          'clickLink',
          'payLink',
          'launchUrl(',
          'checkout.paycom',
          'my.click.uz',
        ]) {
          expect(src.contains(marker), isFalse,
              reason: '${entry.key}: `$marker` qolgan');
        }
      });
    }

    /// SAYT MANZILI — MATN, HAVOLA EMAS.
    test('sayt manzili bosiladigan havola emas', () {
      final src = File('lib/features/shop/store_policy.dart').readAsStringSync();
      expect(src, contains("const kSiteHost = 'nfcstore.uz'"));
      // Bosish, ochish yoki brauzerga yuborish — hech biri yo'q.
      for (final banned in ['openLink', 'launchUrl', 'onTap:', 'GestureDetector']) {
        expect(src.contains(banned), isFalse,
            reason: 'manzil bosiladigan bo\'lib qolgan: $banned');
      }
    });
  });

  /// RAD ETILSA — BITTA KALIT.
  ///
  /// Play anti-steering bo'yicha rad etsa, tuzatish besh ekranni
  /// qayta yozishni emas, bitta so'zni almashtirishni talab
  /// qilishi kerak. Bosim ostida qo'lda o'chirishda bitta joy
  /// albatta esdan chiqadi.
  group('sayt yozuvi kaliti', () {
    final src =
        File('lib/features/shop/store_policy.dart').readAsStringSync();

    test('kalit mavjud', () {
      expect(src, contains('const kShowSiteNotice'),
          reason: 'kalit o\'chirib yuborilgan');
    });

    test('kalit `StoreNotice` ni HAQIQATAN o\'chiradi', () {
      // Kalit bor, lekin hech qayerda tekshirilmasa — u bezak.
      expect(src, contains('if (!kShowSiteNotice) return'),
          reason: 'kalit tekshirilmayapti');
    });

    test('XARIDGA yo\'naltiruvchi matn faqat `StoreNotice` orqali', () {
      // MUHIMI QAYSI MATN EKANI.
      //
      // `nfcstore.uz` ilovada ko'p joyda uchraydi va ularning
      // aksariyati anti-steering'ga umuman aloqasiz: ulashish
      // havolasi (`nfcstore.uz/c/...`), API manzili, Sozlamalardagi
      // "bizning saytimiz" kartasi. Bularni o'chirish ilovani
      // buzardi va Play'ning talabi ham bu emas.
      //
      // Xavfli narsa bitta: "buni saytdan sotib olasiz" degan
      // matn, ya'ni `storeBuyOnSite*` satrlari. Ular FAQAT
      // `StoreNotice` ichidan chiqishi kerak — aks holda kalit
      // ularni o'chira olmaydi va rad etishdan keyin yozuv
      // ilovada qolib ketadi.
      final leaks = <String>[];
      for (final f in Directory('lib').listSync(recursive: true)
          .whereType<File>()) {
        if (!f.path.endsWith('.dart')) continue;
        if (f.path.contains('/l10n/')) continue; // tarjima manbalari
        if (f.path.endsWith('store_policy.dart')) continue;
        final body = f.readAsStringSync();
        if (body.contains('storeBuyOnSite') && !body.contains('StoreNotice')) {
          leaks.add(f.path);
        }
      }
      expect(leaks, isEmpty,
          reason: 'xarid matni `StoreNotice` dan tashqarida ishlatilgan');
    });
  });

  /// JISMONIY KARTA DO'KONI TEGILMAGAN.
  ///
  /// U qoidadan ozod va ilovadagi yagona to'lov kanali bo'lib
  /// qoladi. Uni ham o'chirib qo'yish daromadni bekorga yo'qotardi.
  test('do\'kon (jismoniy karta) hamon to\'lay oladi', () {
    final src = File('lib/features/shop/shop_screens.dart').readAsStringSync();
    expect(src.contains('startPayment'), isTrue,
        reason: 'jismoniy karta to\'lovi ham olib tashlangan');
  });
}
