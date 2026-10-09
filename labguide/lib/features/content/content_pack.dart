import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';

import 'content_model.dart';

/// Paket rad etilganda tashlanadi. Sabab foydalanuvchiga emas, logga.
class PackRejected implements Exception {
  const PackRejected(this.reason);

  final String reason;

  @override
  String toString() => 'PackRejected: $reason';
}

@immutable
class PackFile {
  const PackFile({
    required this.path,
    required this.size,
    required this.sha256,
  });

  factory PackFile.fromJson(Map<String, Object?> json) => PackFile(
    path: json['path']! as String,
    size: json['size']! as int,
    sha256: json['sha256']! as String,
  );

  final String path;
  final int size;
  final String sha256;

  Map<String, Object> toJson() => {
    'path': path,
    'size': size,
    'sha256': sha256,
  };
}

/// Paket manifesti: version, size, hash, language, licence, minimum schema.
@immutable
class PackManifest {
  const PackManifest({
    required this.packId,
    required this.version,
    required this.minSchema,
    required this.languages,
    required this.licence,
    required this.files,
  });

  factory PackManifest.fromJson(Map<String, Object?> json) => PackManifest(
    packId: json['pack_id']! as String,
    version: json['version']! as String,
    minSchema: json['min_schema']! as int,
    languages: [for (final l in json['languages']! as List) l as String],
    licence: json['licence']! as String,
    files: [
      for (final f in json['files']! as List)
        PackFile.fromJson((f as Map).cast<String, Object?>()),
    ],
  );

  final String packId;
  final String version;
  final int minSchema;
  final List<String> languages;
  final String licence;
  final List<PackFile> files;

  int get totalSize => files.fold(0, (sum, f) => sum + f.size);

  Map<String, Object> toJson() => {
    'pack_id': packId,
    'version': version,
    'min_schema': minSchema,
    'languages': languages,
    'licence': licence,
    'files': [for (final f in files) f.toJson()],
  };
}

@immutable
class VerifiedPack {
  const VerifiedPack(this.manifest, this.pack);

  final PackManifest manifest;
  final ContentPack pack;
}

/// Asosiy kontent fayli nomi (manifestda shu yo'l bo'lishi shart).
const kPackDataFile = 'pack.json';

/// Manifest va fayl baytlarini tekshiradi; muvaffaqiyatli bo'lsa paketni
/// parse qiladi. Har qanday nomuvofiqlikda [PackRejected] — qisman yoki
/// buzilgan kontent hech qachon UI ga chiqmaydi.
VerifiedPack verifyPack({
  required Uint8List manifestBytes,
  required Map<String, Uint8List> files,
  String? expectedPackId,
  int supportedSchema = kSupportedContentSchema,
  Set<String> requiredLanguages = const {'uz', 'ru', 'en'},
}) {
  final PackManifest manifest;
  try {
    manifest = PackManifest.fromJson(
      (jsonDecode(utf8.decode(manifestBytes)) as Map).cast<String, Object?>(),
    );
  } on Object catch (e) {
    throw PackRejected('manifest unreadable: $e');
  }
  if (expectedPackId != null && manifest.packId != expectedPackId) {
    throw PackRejected('pack id ${manifest.packId} != $expectedPackId');
  }
  if (manifest.minSchema > supportedSchema) {
    throw PackRejected(
      'requires schema ${manifest.minSchema}, app supports $supportedSchema',
    );
  }
  final missingLanguages = requiredLanguages.difference(
    manifest.languages.toSet(),
  );
  if (missingLanguages.isNotEmpty) {
    throw PackRejected('missing languages $missingLanguages');
  }
  if (!manifest.files.any((f) => f.path == kPackDataFile)) {
    throw PackRejected('manifest does not list $kPackDataFile');
  }
  for (final f in manifest.files) {
    final bytes = files[f.path];
    if (bytes == null) throw PackRejected('missing file ${f.path}');
    if (bytes.length != f.size) {
      throw PackRejected('size mismatch for ${f.path}');
    }
    if (sha256.convert(bytes).toString() != f.sha256.toLowerCase()) {
      throw PackRejected('hash mismatch for ${f.path}');
    }
  }
  final ContentPack pack;
  try {
    pack = ContentPack.fromJson(
      (jsonDecode(utf8.decode(files[kPackDataFile]!)) as Map)
          .cast<String, Object?>(),
    );
  } on Object catch (e) {
    throw PackRejected('content invalid: $e');
  }
  if (pack.packId != manifest.packId) {
    throw PackRejected('content pack id differs from manifest');
  }
  if (pack.contentVersion != manifest.version) {
    throw PackRejected('content version differs from manifest');
  }
  if (pack.schemaVersion < manifest.minSchema ||
      pack.schemaVersion > supportedSchema) {
    throw PackRejected('unsupported content schema ${pack.schemaVersion}');
  }
  return VerifiedPack(manifest, pack);
}

/// Yuklab olingan paketlarni diskka atomar o'rnatadi.
///
/// Tartib: vaqtinchalik papkaga yozish → diskdan qayta o'qib tekshirish →
/// versiya papkasiga rename → `active.json` ni vaqtinchalik fayl + rename
/// bilan almashtirish. Har qanday bosqich buzilsa, avvalgi faol paket
/// o'zgarmaydi. Oxirgi ikki sog'lom versiya saqlanadi.
class PackInstaller {
  PackInstaller(this.root);

  /// Masalan, ilova support papkasi ichidagi `packs/`.
  final Directory root;

  Directory _packDir(String packId) =>
      Directory('${root.path}/${_safe(packId)}');

  File _activeFile(String packId) =>
      File('${_packDir(packId).path}/active.json');

  Future<String?> activeVersion(String packId) async {
    final f = _activeFile(packId);
    if (!await f.exists()) return null;
    try {
      final json = jsonDecode(await f.readAsString()) as Map;
      return json['version'] as String?;
    } on Object {
      return null;
    }
  }

  /// Faol paketni diskdan o'qib qayta tekshiradi. Buzilgan bo'lsa `null` —
  /// chaqiruvchi ilova ichidagi (bundled) paketga qaytadi.
  Future<VerifiedPack?> loadActive(String packId) async {
    final version = await activeVersion(packId);
    if (version == null) return null;
    final dir = Directory('${_packDir(packId).path}/${_safe(version)}');
    try {
      return await _verifyDir(dir, packId);
    } on Object {
      return null;
    }
  }

  Future<VerifiedPack> install({
    required String packId,
    required Uint8List manifestBytes,
    required Map<String, Uint8List> files,
  }) async {
    // 1. Xotirada tekshirish — yomon paket diskka ham yozilmaydi.
    final verified = verifyPack(
      manifestBytes: manifestBytes,
      files: files,
      expectedPackId: packId,
    );
    final packDir = _packDir(packId);
    await packDir.create(recursive: true);
    final version = _safe(verified.manifest.version);
    final target = Directory('${packDir.path}/$version');
    final staging = Directory(
      '${packDir.path}/.staging-$version-${DateTime.now().microsecondsSinceEpoch}',
    );
    try {
      // 2. Vaqtinchalik papkaga yozish va diskdan qayta tekshirish.
      await staging.create(recursive: true);
      await File('${staging.path}/manifest.json')
          .writeAsBytes(manifestBytes, flush: true);
      for (final f in verified.manifest.files) {
        final file = File('${staging.path}/${_safe(f.path)}');
        await file.writeAsBytes(files[f.path]!, flush: true);
      }
      await _verifyDir(staging, packId);

      // 3. Versiya papkasiga ko'chirish.
      if (await target.exists()) await target.delete(recursive: true);
      await staging.rename(target.path);

      // 4. Faol ko'rsatkichni atomar almashtirish.
      final previous = await activeVersion(packId);
      final tmp = File('${packDir.path}/active.json.tmp');
      await tmp.writeAsString(
        jsonEncode({
          'version': verified.manifest.version,
          'previous': previous,
        }),
        flush: true,
      );
      await tmp.rename(_activeFile(packId).path);

      await _prune(
        packDir,
        keep: {version, if (previous != null) _safe(previous)},
      );
      return verified;
    } catch (_) {
      if (await staging.exists()) await staging.delete(recursive: true);
      rethrow;
    }
  }

  Future<VerifiedPack> _verifyDir(Directory dir, String packId) async {
    final manifestBytes = await File('${dir.path}/manifest.json').readAsBytes();
    final manifest = PackManifest.fromJson(
      (jsonDecode(utf8.decode(manifestBytes)) as Map).cast<String, Object?>(),
    );
    final files = <String, Uint8List>{
      for (final f in manifest.files)
        f.path: await File('${dir.path}/${_safe(f.path)}').readAsBytes(),
    };
    return verifyPack(
      manifestBytes: manifestBytes,
      files: files,
      expectedPackId: packId,
    );
  }

  Future<void> _prune(Directory packDir, {required Set<String> keep}) async {
    await for (final entity in packDir.list()) {
      if (entity is! Directory) continue;
      final name = entity.uri.pathSegments.where((s) => s.isNotEmpty).last;
      if (name.startsWith('.staging-') || !keep.contains(name)) {
        await entity.delete(recursive: true);
      }
    }
  }

  /// Yo'l komponentidan papkadan chiqib ketishni (`..`, `/`) olib tashlaydi.
  static String _safe(String segment) {
    final cleaned = segment.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    if (cleaned.isEmpty || cleaned == '.' || cleaned == '..') {
      throw PackRejected('unsafe path segment "$segment"');
    }
    return cleaned;
  }
}
