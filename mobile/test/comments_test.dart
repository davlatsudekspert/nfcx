// IZOHLAR — tugmadan serverga qadar.
//
// NIMA TEKSHIRILADI: Reels kadrida izoh tugmasi bor, u varaqani
// ochadi, varaqa serverdan ro'yxatni oladi, yozilgan izoh ro'yxat
// boshida paydo bo'ladi va JAMI SON serverning javobidan olinadi
// (mijoz o'zi sanamaydi — ikki qurilmada raqamlar ajralib ketardi).
//
// NIMA UCHUN KERAK: izoh — yagona joy bo'lib, u yerda foydalanuvchi
// MATN yozadi. Ya'ni bu yerda buzilish jim bo'lmaydi: odam yozgan
// gap yo'qoladi. Shuning uchun oqim uchma-uch qulflanadi.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/data/repo.dart';
import 'package:nfcstore/design/components/buttons.dart';
import 'package:nfcstore/design/components/icons.dart';
import 'package:nfcstore/screens/content/comments_sheet.dart';
import 'package:nfcstore/screens/content/reels.dart';
import 'package:nfcstore/screens/home/home.dart' show CommentButton;
import 'package:nfcstore/state/app_state.dart';
import 'audit/harness.dart';
import 'settle.dart';

void main() {
  setUpAll(loadAuditFonts);
  setUp(mockImageCacheDir);

  Future<AppState> ready() async {
    final s = auditState();
    await s.boot();
    return s;
  }

  // ─────────────────────────────────────────────────────────────
  // MODEL VA API QATLAMI
  // ─────────────────────────────────────────────────────────────

  test('FeedEntry izoh turini o‘zi to‘g‘ri yig‘adi', () {
    // Server `commentKind` bersa — o'shani ishlatadi.
    final fromServer = FeedEntry.fromJson({
      'kind': 'post', 'id': 5, 'code': 'AAA111', 'authorKind': 'company',
      'name': 'X', 'commentKind': 'company_post', 'commentCount': 7,
    });
    expect(fromServer.commentTarget, 'company_post');
    expect(fromServer.commentCount, 7);

    // ESKI SERVER `commentKind` bermasa ham ilova buzilmaydi:
    // tur kadrning o'zidan kelib chiqadi.
    final legacy = FeedEntry.fromJson({
      'kind': 'story', 'id': 5, 'code': 'AAA111', 'authorKind': 'company',
      'name': 'X',
    });
    expect(legacy.commentTarget, 'company_story');
    expect(legacy.commentCount, 0);

    final personalPost = FeedEntry.fromJson({
      'kind': 'post', 'id': 1, 'code': 'VIP001', 'authorKind': 'card', 'name': 'Y',
    });
    expect(personalPost.commentTarget, 'post');
  });

  test('repo izohni to‘g‘ri manzilga yuboradi va javobni o‘qiydi', () async {
    late http.Request sent;
    final api = Api(
      baseUrl: 'https://nfcstore.uz',
      client: MockClient((req) async {
        sent = req;
        return http.Response(
          jsonEncode({
            'comment': {
              'id': 12, 'code': 'VIP001', 'name': 'Dilshod',
              'body': 'Salom', 'createdAt': 1757801000000, 'mine': true,
            },
            'total': 4,
          }),
          201,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
    final r = await Repo(api).addComment('company_post', 33, 'Salom');

    expect(sent.method, 'POST');
    expect(sent.url.path, '/api/comments/company_post/33');
    expect(jsonDecode(sent.body)['body'], 'Salom');
    expect(r.comment.id, 12);
    expect(r.comment.mine, isTrue);
    // JAMI SON SERVERDAN: mijoz o'zi +1 qilmaydi.
    expect(r.total, 4);
  });

  test('repo izohlar ro‘yxatini sahifasi bilan so‘raydi', () async {
    late Uri asked;
    final api = Api(
      client: MockClient((req) async {
        asked = req.url;
        return http.Response(
          jsonEncode({
            'comments': [
              {'id': 1, 'name': 'A', 'body': 'birinchi', 'mine': false},
            ],
            'hasMore': true,
            'total': 30,
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
    final r = await Repo(api).comments('post', 7, page: 2);
    expect(asked.path, '/api/comments/post/7');
    expect(asked.queryParameters['page'], '2');
    expect(r.items.single.body, 'birinchi');
    expect(r.hasMore, isTrue);
    expect(r.total, 30);
  });

  // ─────────────────────────────────────────────────────────────
  // EKRAN
  // ─────────────────────────────────────────────────────────────

  testWidgets('Reels kadrida izoh tugmasi va soni bor', (t) async {
    final s = await ready();
    await pumpScreen(t, const ReelsScreen(), state: s);
    await settle(t);

    expect(find.byType(CommentButton), findsWidgets);
    // Fixture'dagi birinchi kadr — ikkita izoh.
    expect(find.text('2'), findsWidgets);
  });

  testWidgets('izoh tugmasi varaqani ochadi va ro‘yxat serverdan keladi', (t) async {
    final s = await ready();
    await pumpScreen(t, const ReelsScreen(), state: s);
    await settle(t);

    await t.tap(find.byType(CommentButton).first);
    await settle(t);

    expect(find.text('Izohlar'), findsOneWidget);
    expect(find.text('Zo‘r ish bo‘libdi, tabriklayman!'), findsOneWidget);
    expect(find.text('Rahmat! Yangi partiya keyingi hafta.'), findsOneWidget);
  });

  testWidgets('yozilgan izoh ro‘yxat boshida paydo bo‘ladi', (t) async {
    final s = await ready();
    await pumpScreen(t, const ReelsScreen(), state: s);
    await settle(t);
    await t.tap(find.byType(CommentButton).first);
    await settle(t);

    await t.enterText(find.byType(EditableText).first, 'Narxi qancha?');
    await settle(t);
    // Yuborish — `Ico.send` belgili dumaloq tugma.
    await t.tap(find.byWidgetPredicate(
      (w) => w is RoundButton && w.icon == Ico.send,
    ));
    await settle(t);

    expect(find.text('Narxi qancha?'), findsOneWidget);
    // Server 3 qaytardi — sarlavha ostidagi son shu bo'lishi kerak.
    expect(find.textContaining('3'), findsWidgets);
  });

  testWidgets('kirmagan odamga yozish maydoni ko‘rsatilmaydi', (t) async {
    // `boot()` CHAQIRILMAYDI — ya'ni sessiya yo'q (signedOut).
    // Bu holat muhim: izohlarni O'QISH hamma uchun ochiq, YOZISH
    // esa faqat kirganlar uchun. Ikkalasini chalkashtirish —
    // mehmonga bo'sh maydon ko'rsatib, yozgach 401 berish degani.
    final s = auditState();
    late BuildContext ctx;
    await pumpScreen(
      t,
      Builder(builder: (context) {
        ctx = context;
        return const SizedBox.shrink();
      }),
      state: s,
    );
    await settle(t);

    unawaited(showCommentsSheet(ctx, targetKind: 'post', targetId: 501));
    await settle(t);

    expect(find.text('Izoh yozish uchun hisobingizga kiring.'), findsOneWidget);
    expect(find.byType(EditableText), findsNothing);
    // O'qish esa ishlaydi: ro'yxat baribir ko'rinadi.
    expect(find.text('Zo‘r ish bo‘libdi, tabriklayman!'), findsOneWidget);
  });

  testWidgets('PREMIUMSIZ odam izoh YOZA OLMAYDI, lekin O‘QIY OLADI',
      (t) async {
    // EGASINING QOIDASI: izoh yozish — Premium obunachilarga.
    //
    // O'QISH OCHIQ QOLISHI SHART: aks holda lentada gap
    // ketayotgani umuman bilinmasdi va Premium olishning ma'nosi
    // ham ko'rinmasdi. Shuning uchun bu sinov ikkalasini bir
    // vaqtda tekshiradi.
    final s = auditState();
    await s.boot();
    // Hisob bor, lekin Premium yo'q.
    s.user = AppUser(id: 1, email: 'oddiy@nfcstore.uz');

    late BuildContext ctx;
    await pumpScreen(
      t,
      Builder(builder: (context) {
        ctx = context;
        return const SizedBox.shrink();
      }),
      state: s,
    );
    await settle(t);

    unawaited(showCommentsSheet(ctx, targetKind: 'post', targetId: 501));
    await settle(t);

    // YOZISH MAYDONI YO'Q — va sabab aytilgan.
    expect(find.byType(EditableText), findsNothing);
    expect(find.text('Izoh yozish Premium obunachilar uchun.'), findsOneWidget);

    // BOSHI BERK EMAS: Premium olish yo'li ko'rsatilgan.
    expect(find.text('Premium olish'), findsOneWidget);

    // O'QISH ISHLAYDI.
    expect(find.text('Zo‘r ish bo‘libdi, tabriklayman!'), findsOneWidget);
  });

  // ── O'CHIRISH HUQUQI ────────────────────────────────────────
  //
  // SERVER ALLAQACHON IKKI KISHIGA RUXSAT BERADI:
  // `DELETE /api/comments/:id` — izoh MUALLIFI yoki KONTENT
  // EGASI. Ilova esa faqat muallifga ko'rsatardi, ya'ni odam o'z
  // videosi ostidagi haqoratni olib tashlay olmasdi. Quyidagi
  // ikki sinov shu farqni qulflaydi.

  Finder trashIcons() => find.byWidgetPredicate(
        (w) => w is NIcon && w.icon == Ico.trash,
      );

  testWidgets('BEGONA kontentda faqat O‘Z izohini o‘chirish mumkin',
      (t) async {
    final s = await ready();
    late BuildContext ctx;
    await pumpScreen(
      t,
      Builder(builder: (context) {
        ctx = context;
        return const SizedBox.shrink();
      }),
      state: s,
    );
    await settle(t);

    unawaited(showCommentsSheet(ctx, targetKind: 'post', targetId: 501));
    await settle(t);

    // Fixture'da ikki izoh: 901 begona, 902 o'ziniki.
    expect(trashIcons(), findsOneWidget,
        reason: 'begona izohda o‘chirish tugmasi bo‘lmasligi kerak');
  });

  testWidgets('O‘Z KONTENTI ostida HAR QANDAY izohni o‘chira oladi',
      (t) async {
    final s = await ready();
    late BuildContext ctx;
    await pumpScreen(
      t,
      Builder(builder: (context) {
        ctx = context;
        return const SizedBox.shrink();
      }),
      state: s,
    );
    await settle(t);

    unawaited(showCommentsSheet(
      ctx,
      targetKind: 'post',
      targetId: 501,
      owned: true,
    ));
    await settle(t);

    expect(trashIcons(), findsNWidgets(2),
        reason: 'kontent egasi begona izohni ham o‘chira olishi kerak');
  });
}
