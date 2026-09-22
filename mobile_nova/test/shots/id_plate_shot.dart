@Tags(['shots'])
library;

// NFC ID PLASTINKASI — HAMMA TOIFA, HAMMA MAVZUDA.
//
// NIMA UCHUN BU SURAT KERAK.
//
// Plastinkaning "qimmat ko'rinishi" ikki marta ko'zga ko'rinmay
// qoldi va ikkalasida ham sabab bitta edi: alfa qiymati kodda
// to'g'ridek tuyuldi, lekin EKRANDA sezilmasdi. Sonni o'qib
// buni bilib bo'lmaydi — chizib ko'rish kerak.
//
// Bu surat sakkizta mavzuning har birida beshta toifani yonma-yon
// qo'yadi. Bir qarashda ikkita savolga javob beradi:
//   1) toifalar bir-biridan FARQ QILADIMI;
//   2) `mono` mavzusida oltin chiqib ketmadimi.
//
//   flutter test test/shots/id_plate_shot.dart \
//     --run-skipped -t shots --update-goldens

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle, FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/theme/app_theme.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/design/widgets/id_plate.dart';

const _tiers = ['free', 'silver', 'gold', 'premium', 'exclusive'];
const _codes = ['48210377', 'SIL500', 'GLD100', 'PRM777', 'VIP001'];

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final fams = {
      'Manrope': ['assets/fonts/Manrope-500.ttf', 'assets/fonts/Manrope-600.ttf'],
      'IBMPlexMono': ['assets/fonts/IBMPlexMono-500.ttf'],
    };
    for (final f in fams.entries) {
      final loader = FontLoader(f.key);
      var any = false;
      for (final p in f.value) {
        if (File(p).existsSync()) {
          loader.addFont(rootBundle.load(p));
          any = true;
        }
      }
      if (any) await loader.load();
    }
  });

  testWidgets('id plate — toifalar hamma mavzuda', (tester) async {
    tester.view
      ..devicePixelRatio = 2.0
      ..physicalSize = const Size(1180, 900);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: ColoredBox(
          color: const Color(0xFF3A3A3A),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final tokens in NfcTokens.all)
                Theme(
                  data: buildTheme(tokens),
                  child: Builder(
                    builder: (context) => Container(
                      width: 580,
                      color: tokens.bg1,
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tokens.id.toUpperCase(),
                            style: TextStyle(
                              fontFamily: 'Manrope',
                              fontSize: 9,
                              letterSpacing: 2,
                              color: tokens.text3,
                            ),
                          ),
                          const SizedBox(height: 7),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              for (var i = 0; i < _tiers.length; i += 1)
                                IdPlate(
                                  code: _codes[i],
                                  tier: _tiers[i],
                                  size: IdPlateSize.small,
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(Column).first,
      matchesGoldenFile('png/id-plate-tiers.png'),
    );
  }, tags: ['shots'], skip: false);
}
