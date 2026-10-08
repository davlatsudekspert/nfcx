import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';

/// Post modeli — ko'rgazma maydonlari (shartnoma §3).
void main() {
  test('ko‘rgazma posti — hamma yangi maydonlar o‘qiladi', () {
    final p = Post.fromJson({
      'id': 9,
      'code': 'C7',
      'authorKind': 'company',
      'showcase': true,
      'title': '  Qizil ko‘ylak  ',
      'priceUzs': 125000,
      'linkUrl': 'https://youtu.be/abc',
      'catalogItem': {
        'id': 'b9fa1d77-794a-4b7a-b972-aecb1dce7c02',
        'companyId': 'C7',
        'name': 'Ko‘ylak',
        'priceUzs': 125000,
        'image': '/uploads/k.jpg',
      },
      'mediaUrls': ['/uploads/a.jpg', '/uploads/b.jpg'],
      'pending': true,
    });
    expect(p.showcase, isTrue);
    expect(p.inShowcase, isTrue);
    expect(p.title, 'Qizil ko‘ylak');
    expect(p.priceUzs, 125000);
    expect(p.linkUrl, 'https://youtu.be/abc');
    expect(p.catalogItem!.id, 'b9fa1d77-794a-4b7a-b972-aecb1dce7c02');
    expect(p.catalogItem!.companyId, 'C7');
    expect(p.catalogItem!.name, 'Ko‘ylak');
    expect(p.catalogItem!.image, endsWith('/uploads/k.jpg'));
    expect(p.mediaUrls, hasLength(2));
    expect(p.mediaUrls.first, endsWith('/uploads/a.jpg'));
    expect(p.pending, isTrue);
    expect(p.isVideo, isFalse);
  });

  test('maydonlar yo‘q yoki null — xavfsiz sukut qiymatlari', () {
    final p = Post.fromJson({
      'id': 1,
      'imageUrl': '/uploads/x.jpg',
      'title': null,
      'priceUzs': null,
      'linkUrl': null,
      'catalogItem': null,
      'mediaUrls': null,
      'pending': null,
      'showcase': null,
    });
    expect(p.showcase, isFalse);
    expect(p.title, '');
    expect(p.priceUzs, isNull);
    expect(p.linkUrl, '');
    expect(p.catalogItem, isNull);
    expect(p.pending, isFalse);
    expect(p.mediaUrls, hasLength(1));
  });

  test('raqamli catalogItem.id satrga, buzuq narx — null', () {
    final p = Post.fromJson({
      'id': 2,
      'priceUzs': 'abc',
      'catalogItem': {'id': 123, 'companyId': 7},
    });
    expect(p.priceUzs, isNull);
    expect(p.catalogItem!.id, '123');
    expect(p.catalogItem!.companyId, '7');
    expect(Post.fromJson({'id': 3, 'priceUzs': '5000'}).priceUzs, 5000);
    expect(Post.fromJson({'id': 3, 'priceUzs': -1}).priceUzs, isNull);
    // id yoki kompaniyasiz tovar — tugma chizilmaydi.
    expect(
        Post.fromJson({'id': 4, 'catalogItem': {'id': 'x'}}).catalogItem,
        isNull);
  });

  test('bo‘sh `media` mediaUrls ni yashirmaydi', () {
    final p = Post.fromJson({
      'id': 5,
      'media': <String>[],
      'mediaUrls': ['/uploads/a.jpg'],
    });
    expect(p.mediaUrls, hasLength(1));
  });

  test('rasmli reel ko‘rgazmada, video — yo‘q', () {
    expect(Post.fromJson({'id': 1, 'reel': true, 'imageUrl': '/u/a.jpg'})
        .inShowcase, isTrue);
    expect(Post.fromJson({'id': 1, 'reel': true, 'videoUrl': '/u/a.mp4'})
        .inShowcase, isFalse);
    expect(Post.fromJson({'id': 1, 'imageUrl': '/u/a.jpg'}).inShowcase,
        isFalse);
  });

  test('copyWith yangi maydonlarni saqlaydi', () {
    final p = Post.fromJson({
      'id': 9,
      'showcase': true,
      'title': 'T',
      'priceUzs': 10,
      'linkUrl': 'https://youtu.be/a',
      'pending': true,
      'catalogItem': {'id': 'u', 'companyId': 'C'},
    });
    for (final q in [p.copyWith(likes: 3), p.copyWithKind(authorKind: 'company')]) {
      expect(q.showcase, isTrue);
      expect(q.title, 'T');
      expect(q.priceUzs, 10);
      expect(q.linkUrl, 'https://youtu.be/a');
      expect(q.pending, isTrue);
      expect(q.catalogItem!.id, 'u');
    }
  });
}
