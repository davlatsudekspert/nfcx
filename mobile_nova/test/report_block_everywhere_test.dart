import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/social/moderation.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

import 'helpers.dart';

/// GOOGLE PLAY UGC: har bir profil, post, Reels, istoriya, izoh va
/// biznes sahifasidan shikoyat qilish va muallifni bloklash mumkin.
class _Mod extends ModerationRepository {
  _Mod() : super(ApiClient());
  final blocked = <(BlockKind, String)>[];

  @override
  Future<Result<void>> block(BlockKind kind, String id) async {
    blocked.add((kind, id));
    return const Ok(null);
  }
}

void main() {
  test('izoh shikoyati alohida `comment` turi bilan ketadi', () {
    expect(ReportTarget.comment.wire, 'comment');
    final src = File('lib/features/social/comments.dart').readAsStringSync();
    expect(src, contains('target: ReportTarget.comment'));
    expect(src, isNot(contains("target: ReportTarget.post,\n                targetId: '\${comment.id}'")));
    // Server ham bu turni qabul qiladi.
    final server = File('../hosting/api/moderation.js').readAsStringSync();
    expect(server, contains("'comment'"));
  });

  test('shikoyat + bloklash hamma joyda ulangan', () {
    final places = {
      'lib/features/social/post_screens.dart': 'showContentActions(',
      'lib/features/social/comments.dart': 'showContentActions(',
      'lib/features/social/story_viewer.dart': 'showContentActions(',
      'lib/features/business/business_screens.dart': 'showContentActions(',
      'lib/features/social/reels_screen.dart': "ValueKey('reel-block')",
      'lib/features/profile/profile_screen.dart': 'BlockKind.record',
    };
    places.forEach((file, needle) {
      expect(File(file).readAsStringSync(), contains(needle), reason: file);
    });
    // Biznes posti o'z turi bilan.
    expect(File('lib/features/social/post_screens.dart').readAsStringSync(),
        contains('ReportTarget.companyPost'));
  });

  testWidgets('menyu: shikoyat va bloklash; o‘zinikida bloklash yo‘q',
      (tester) async {
    final mod = _Mod();
    late WidgetRef captured;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...await testOverrides(),
        moderationRepositoryProvider.overrideWithValue(mod),
      ],
      child: wrapScreen(
        Consumer(builder: (context, ref, _) {
          captured = ref;
          return const Scaffold(body: SizedBox.expand());
        }),
        tokens: NfcTokens.ivory,
      ),
    ));
    final ctx = tester.element(find.byType(Scaffold));
    final l = await L.delegate.load(const Locale('uz'));

    showContentActions(ctx, captured,
        target: ReportTarget.comment,
        targetId: '51',
        ownerCode: 'VIP001',
        blockKind: BlockKind.record,
        blockId: 'VIP001',
        keyPrefix: 'comment');
    await settle(tester, frames: 8);
    expect(find.byKey(const ValueKey('comment-report')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('comment-block')));
    await settle(tester, frames: 8);
    expect(mod.blocked, [(BlockKind.record, 'VIP001')]);
    expect(find.text(l.reelBlocked), findsOneWidget);

    showContentActions(ctx, captured,
        target: ReportTarget.post,
        targetId: '7',
        blockKind: BlockKind.record,
        blockId: 'ME001',
        mine: true,
        keyPrefix: 'post');
    await settle(tester, frames: 8);
    expect(find.byKey(const ValueKey('post-report')), findsOneWidget);
    expect(find.byKey(const ValueKey('post-block')), findsNothing,
        reason: 'o‘zini bloklash yo‘q');
  });
}
