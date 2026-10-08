import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../../core/storage/kv_store.dart';
import 'content_model.dart';
import 'content_pack.dart';

enum ContentLoadState { loading, ready, failed }

/// Ilova ichidagi (bundled) asosiy paketni tekshirib yuklaydi.
///
/// Keyingi bosqichda: [PackInstaller.loadActive] dagi yangiroq va sog'lom
/// paket bo'lsa, u ustun bo'ladi; buzilgan bo'lsa bundled paket qoladi.
class ContentController extends ChangeNotifier {
  ContentController({required this.bundle, this.packId = 'core'});

  final AssetBundle bundle;
  final String packId;

  ContentLoadState _state = ContentLoadState.loading;
  VerifiedPack? _verified;
  String? _error;

  ContentLoadState get state => _state;
  ContentPack? get pack => _verified?.pack;
  PackManifest? get manifest => _verified?.manifest;

  /// Faqat log/diagnostika uchun; UI umumiy xabar ko'rsatadi.
  String? get error => _error;

  Future<void> load() async {
    _state = ContentLoadState.loading;
    _error = null;
    notifyListeners();
    try {
      final base = 'assets/content/$packId';
      final manifestBytes = await _load('$base/manifest.json');
      // Fayllar ro'yxatini olish uchun o'qiladi; verifyPack manifestni
      // qayta va qat'iy tekshiradi.
      final manifest = PackManifest.fromJson(_decodeMap(manifestBytes));
      final files = <String, Uint8List>{
        for (final f in manifest.files) f.path: await _load('$base/${f.path}'),
      };
      // ~0.7 MB JSON: hash, decode va tekshiruv fon isolate'da — ishga
      // tushishda UI kadrlar tashlab yubormaydi.
      _verified = await compute(_verifyBundled, (manifestBytes, files, packId));
      _state = ContentLoadState.ready;
    } on Object catch (e) {
      _verified = null;
      _error = e.toString();
      _state = ContentLoadState.failed;
      debugPrint('Content pack "$packId" rejected: $e');
    }
    notifyListeners();
  }

  Future<Uint8List> _load(String key) async {
    final data = await bundle.load(key);
    return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
  }

  static Map<String, Object?> _decodeMap(Uint8List bytes) =>
      (jsonDecode(utf8.decode(bytes)) as Map).cast<String, Object?>();
}

VerifiedPack _verifyBundled(
  (Uint8List manifest, Map<String, Uint8List> files, String packId) args,
) =>
    verifyPack(manifestBytes: args.$1, files: args.$2, expectedPackId: args.$3);

/// Saqlangan (xatcho'p) analitlar — qurilmada saqlanadi, qayta ochilganda
/// tiklanadi.
class BookmarksController extends ChangeNotifier {
  BookmarksController(this._store)
    : _ids = (_store.getStringList(StoreKeys.bookmarks) ?? const []).toList();

  final KeyValueStore _store;
  final List<String> _ids;

  /// Saqlangan tartibda (oxirgisi oxirida).
  List<String> get ids => List.unmodifiable(_ids);

  bool contains(String id) => _ids.contains(id);

  /// Qo'shilgan bo'lsa `true`, olib tashlangan bo'lsa `false`.
  Future<bool> toggle(String id) async {
    final added = !_ids.remove(id);
    if (added) _ids.add(id);
    notifyListeners();
    await _store.setStringList(StoreKeys.bookmarks, _ids);
    return added;
  }

  void resetInMemory() {
    _ids.clear();
    notifyListeners();
  }
}
