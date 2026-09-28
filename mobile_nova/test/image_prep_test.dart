import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/media/image_prep.dart';
import 'package:nfcstore_nova/core/media/video_prep.dart' show videoPrepChannel;

/// RASM YUKLASHDAN OLDIN TELEFONGA MOSLANADI (egasi, 2026-09-28).
///
/// Audit: lentadagi post rasmlari 2.2 va 1.9 MB PNG edi — `image_picker`
/// PNG'ni siqmaydi, server esa oddiy rasm uchun 700 KB dan kattasini
/// qabul qilmaydi. Endi katta rasm telefonda JPEG ga o'tkaziladi
/// (Android + iPhone, bitta kanal); xato bo'lsa asl fayl.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late Directory dir;
  setUp(() => dir = Directory.systemTemp.createTempSync('img_prep'));
  tearDown(() => dir.deleteSync(recursive: true));

  final calls = <MethodCall>[];
  void mock(Future<Object?>? Function(MethodCall) handler) {
    calls.clear();
    messenger.setMockMethodCallHandler(videoPrepChannel, (c) {
      calls.add(c);
      return handler(c);
    });
    addTearDown(() => messenger.setMockMethodCallHandler(videoPrepChannel, null));
  }

  String file(String name, int bytes) {
    final f = File('${dir.path}/$name')..writeAsBytesSync(List.filled(bytes, 1));
    return f.path;
  }

  test('katta PNG — telefonda JPEG ga, 1600 px, sifat 85', () async {
    mock((_) async => '/tmp/nova_i_1.jpg');
    final p = file('Screenshot.png', 2 * 1024 * 1024);
    expect(await prepareImageForUpload(p), '/tmp/nova_i_1.jpg');
    final a = calls.single.arguments as Map;
    expect(calls.single.method, 'toJpeg');
    expect(a['path'], p);
    expect(a['out'], endsWith('.jpg'));
    expect(a['maxSide'], 1600);
    expect(a['quality'], 85);
  });

  test('muqova — kattaroq chegara', () async {
    mock((_) async => '/tmp/nova_i_2.jpg');
    await prepareImageForUpload(file('cover.png', 900 * 1024), maxSide: 2048);
    expect((calls.single.arguments as Map)['maxSide'], 2048);
  });

  test('kichik rasm va GIF — tegilmaydi, kanal chaqirilmaydi', () async {
    mock((_) async => '/tmp/x.jpg');
    final small = file('small.jpg', 200 * 1024);
    expect(await prepareImageForUpload(small), small);
    final gif = file('anim.gif', 2 * 1024 * 1024);
    expect(await prepareImageForUpload(gif), gif);
    expect(calls, isEmpty);
  });

  test('shaffof / kichraymadi / xato / plagin yo‘q — asl fayl', () async {
    final p = file('logo.png', 1024 * 1024);
    mock((_) async => null);
    expect(await prepareImageForUpload(p), p);
    mock((_) async => throw PlatformException(code: 'x'));
    expect(await prepareImageForUpload(p), p);
    messenger.setMockMethodCallHandler(videoPrepChannel, null);
    expect(await prepareImageForUpload(p), p);
    expect(await prepareImageForUpload('${dir.path}/yoq.png'), '${dir.path}/yoq.png');
  });

  test('hamma rasm yuklash shu yo‘ldan o‘tadi', () {
    final repo = File('lib/features/profile/profile_repository.dart').readAsStringSync();
    expect(repo, contains('await prepareImageForUpload(filePath,'));
    expect(repo, contains("maxSide: kind == 'cover' ? 2048 : kImagePrepMaxSide"));
    // Rasm yuklaydigan boshqa joy yo'q (bitta endpoint).
    final hits = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .where((f) => f.readAsStringSync().contains("'/api/upload'"))
        .map((f) => f.path)
        .toList();
    expect(hits, ['lib/features/profile/profile_repository.dart']);
  });

  test('Android va iPhone: toJpeg — shaffoflik, EXIF, kichraymasa asl', () {
    final kt = File('android/app/src/main/kotlin/uz/nfcstore/nova/ImageShrinker.kt')
        .readAsStringSync();
    expect(kt, contains('hasTransparency(bmp)'));
    expect(kt, contains('ExifInterface.TAG_ORIENTATION'));
    expect(kt, contains('Bitmap.CompressFormat.JPEG'));
    expect(kt, contains('outFile.length() >= File(path).length()'));
    expect(kt, contains('Thread {'), reason: 'asosiy oqimni to‘xtatmasin');
    final main = File('android/app/src/main/kotlin/uz/nfcstore/nova/MainActivity.kt')
        .readAsStringSync();
    expect(main, contains('"toJpeg" ->'));

    final swift = File('ios/Runner/AppDelegate.swift').readAsStringSync();
    expect(swift, contains('case "toJpeg":'));
    expect(swift, contains('hasTransparency(cg)'));
    expect(swift, contains('jpegData(compressionQuality:'));
    expect(swift, contains('data.count >= original'));
    expect(swift, contains('DispatchQueue.global('));
  });
}
