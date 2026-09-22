import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_v2/core/models.dart';

void main() {
  group('FeedItem target normalization', () {
    test('personal post maps to post', () {
      final item = FeedItem.fromJson({
        'kind': 'post',
        'id': 11,
        'code': 'VIP001',
        'name': 'Muhammad',
        'authorKind': 'card',
        'likeCount': 3,
        'commentCount': 4,
      });
      expect(item.targetKind, 'post');
      expect(item.isCompany, isFalse);
      expect(item.isStory, isFalse);
      expect(item.commentCount, 4);
    });

    test('company story maps to company_story', () {
      final item = FeedItem.fromJson({
        'kind': 'story',
        'id': 12,
        'code': 'NOIR01',
        'name': 'Noir Coffee',
        'authorKind': 'company',
      });
      expect(item.targetKind, 'company_story');
      expect(item.isCompany, isTrue);
      expect(item.isStory, isTrue);
    });

    test('explicit company_post stays company_post', () {
      final item = FeedItem.fromJson({
        'kind': 'company_post',
        'id': 13,
        'code': 'LUMEN7',
        'name': 'Lumen Studio',
      });
      expect(item.targetKind, 'company_post');
      expect(item.isCompany, isTrue);
    });
  });

  test('comment parser accepts server author field aliases', () {
    final item = CommentItem.fromJson({
      'id': 5,
      'targetKind': 'post',
      'targetId': 7,
      'authorCode': 'ALI000',
      'authorName': 'Ali',
      'authorAvatar': '/media/a.jpg',
      'body': 'Zo‘r!',
      'parent_id': 2,
      'likes': 8,
      'liked': true,
    });
    expect(item.code, 'ALI000');
    expect(item.name, 'Ali');
    expect(item.parentId, 2);
    expect(item.likes, 8);
    expect(item.liked, isTrue);
    expect(item.avatarUrl, 'https://nfcstore.uz/media/a.jpg');
  });
}
