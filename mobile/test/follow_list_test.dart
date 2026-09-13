import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/repo.dart';
import 'package:nfcstore/design/theme.dart';
import 'package:nfcstore/screens/identity/follow_list.dart';
import 'package:nfcstore/state/app_state.dart';
import 'widget_test.dart' show FakeStore;

Widget host(Widget child, AppState state) => AppScope(
      state: state,
      child: MaterialApp(theme: buildTheme(), home: child),
    );

void main() {
  group('Obunachilar ro‘yxati', () {
    testWidgets('kompaniya nomidan obuna bo‘lgan odam ham ko‘rinadi', (tester) async {
      // Handoff qoidasi: odam kompaniya yuzi bilan obuna bo‘lishi
      // mumkin, lekin kim ekani BILINIB TURISHI kerak — kompaniya
      // ortiga butunlay yashirinib olmaydi.
      final state = AppState(
        api: Api(client: MockClient((_) async => http.Response(
              jsonEncode({
                'list': [
                  {'kind': 'person', 'code': 'aaa512', 'name': 'Oddiy odam', 'verified': false},
                  {
                    'kind': 'company',
                    'code': 'ddd333',
                    'name': 'Biznes nomi',
                    'verified': true,
                    'personCode': 'zzz100',
                    'personName': 'Ortidagi odam',
                  },
                ],
              }),
              200,
            ))),
        storage: FakeStore(),
      );

      await tester.pumpWidget(host(
        const FollowListScreen(code: 'VIP001', title: 'Profil'),
        state,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Oddiy odam'), findsOneWidget);
      expect(find.text('AAA512'), findsOneWidget);
      expect(find.text('Biznes nomi'), findsOneWidget);
      // Kompaniya qatorida ortidagi odam ham yozilgan.
      expect(find.text('DDD333 · Ortidagi odam'), findsOneWidget);
      expect(find.text('BIZNES'), findsOneWidget);
    });

    testWidgets('yo‘nalish so‘rovga to‘g‘ri uzatiladi', (tester) async {
      final urls = <String>[];
      final state = AppState(
        api: Api(client: MockClient((r) async {
          urls.add(r.url.toString());
          return http.Response(jsonEncode({'list': []}), 200);
        })),
        storage: FakeStore(),
      );

      // "Obunalar" tabidan boshlanadi.
      await tester.pumpWidget(host(
        const FollowListScreen(code: 'VIP001', title: 'P', startWithFollowing: true),
        state,
      ));
      await tester.pumpAndSettle();
      expect(urls.single, contains('dir=following'));

      // Boshqa tabga o‘tilganda ikkinchi so‘rov — `dir` YO‘Q.
      await tester.tap(find.text('OBUNACHILAR'));
      await tester.pumpAndSettle();
      expect(urls.length, 2);
      expect(urls.last, isNot(contains('dir=')));

      // Qaytib kelinganda so‘rov TAKRORLANMAYDI — kesh ishlaydi.
      await tester.tap(find.text('OBUNALAR'));
      await tester.pumpAndSettle();
      expect(urls.length, 2);
    });

    testWidgets('bo‘sh ro‘yxatda yo‘nalishga mos yozuv', (tester) async {
      final state = AppState(
        api: Api(client: MockClient((_) async => http.Response(jsonEncode({'list': []}), 200))),
        storage: FakeStore(),
      );
      await tester.pumpWidget(host(
        const FollowListScreen(code: 'VIP001', title: 'P'),
        state,
      ));
      await tester.pumpAndSettle();
      expect(find.text('Hali obunachi yo‘q.'), findsOneWidget);
    });

    test('repo yo‘nalishni to‘g‘ri so‘raydi', () async {
      final urls = <Uri>[];
      final repo = Repo(Api(client: MockClient((r) async {
        urls.add(r.url);
        return http.Response(jsonEncode({'list': []}), 200);
      })));

      await repo.followList('VIP001');
      expect(urls.last.path, '/api/follow-list/VIP001');
      expect(urls.last.queryParameters, isEmpty);

      await repo.followList('VIP001', following: true);
      expect(urls.last.queryParameters['dir'], 'following');
    });
  });
}
