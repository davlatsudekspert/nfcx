import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/video_view.dart';

/// VIDEO OCHILMAGANDA NIMA KO'RINADI.
///
/// NIMA UCHUN BU TEST BOR: qurilmada video istorya QORA EKRAN
/// bo'lib ochilardi. Sabab pleyerning o'zida emas, KUTISHDA edi —
/// `initialize()` da muddat yo'q, ya'ni manzil yetib bormasa yoki
/// format qo'llab-quvvatlanmasa u hech qachon tugamaydi va istisno
/// ham chiqarmaydi. Video istoryada muqova rasmi bo'lmagani uchun
/// ekranda qorong'i fon va kichkina aylanuvchi belgi qolardi.
///
/// Bu test eng muhim va'dani qo'riqlaydi: VIDEO OCHILMASA HAM
/// EKRAN BO'SH QOLMAYDI — sabab yoziladi.
void main() {
  Widget wrap(Widget child) => Directionality(
        textDirection: TextDirection.ltr,
        child: Center(child: SizedBox(width: 300, height: 500, child: child)),
      );

  /// Ekranda biror o'qiladigan yozuv bormi.
  bool hasAnyText(WidgetTester tester) => tester
      .widgetList<Text>(find.byType(Text))
      .any((t) => (t.data ?? '').trim().isNotEmpty);

  testWidgets('manzil bo‘sh bo‘lsa sabab yoziladi', (tester) async {
    await tester.pumpWidget(wrap(const VideoView(url: '')));
    await tester.pump();
    expect(find.text('Video manzili bo‘sh.'), findsOneWidget);
  });

  testWidgets('ochib bo‘lmasa EKRAN BO‘SH QOLMAYDI', (tester) async {
    // Testda video_player plagini ro'yxatdan o'tmagan, ya'ni
    // `initialize()` xato beradi — qurilmadagi "ochilmadi"
    // holatining eng yaqin ko'rinishi.
    await tester.pumpWidget(wrap(
      const VideoView(url: 'https://nfcstore.uz/uploads/yoq.mp4'),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(hasAnyText(tester), isTrue,
        reason: 'Video ochilmadi, lekin ekranda hech qanday sabab yo‘q — '
            'odam uchun bu qora ekran');
  });

  testWidgets('muqova bo‘lsa ham sabab USTIDA ko‘rinadi', (tester) async {
    // Muqova bor bo'lsa, ilgari faqat u ko'rsatilardi va odam
    // videoning umuman ochilmaganini bilmasdi: u qimirlamaydigan
    // rasmga qarab o'tirardi.
    await tester.pumpWidget(wrap(const VideoView(
      url: 'https://nfcstore.uz/uploads/yoq.mp4',
      poster: 'https://nfcstore.uz/uploads/muqova.jpg',
    )));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(hasAnyText(tester), isTrue);
  });
}
