// Kontent paketining manifestini (size + sha256) qayta hisoblaydi.
//
// Ishlatish (labguide/ ichida):
//   dart run tool/build_content_manifest.dart [pack_id] [version]
//
// pack.json o'zgarganda albatta ishga tushiring: aks holda ilova paketni
// "hash mismatch" bilan rad etadi (test/content_pack_test.dart buni
// CI da ham ushlaydi).
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';

void main(List<String> args) {
  final packId = args.isNotEmpty ? args[0] : 'core';
  final dir = Directory('assets/content/$packId');
  final dataFile = File('${dir.path}/pack.json');
  final bytes = dataFile.readAsBytesSync();
  final pack = jsonDecode(utf8.decode(bytes)) as Map<String, dynamic>;
  final version = args.length > 1 ? args[1] : pack['content_version'] as String;
  if (version != pack['content_version']) {
    stderr.writeln('version $version != pack content_version');
    exit(1);
  }
  final manifest = {
    'pack_id': packId,
    'version': version,
    'min_schema': pack['schema_version'],
    'languages': ['uz', 'ru', 'en'],
    'licence':
        'LabGuide draft content — internal review copy, not for redistribution',
    'files': [
      {
        'path': 'pack.json',
        'size': bytes.length,
        'sha256': sha256.convert(bytes).toString(),
      },
    ],
  };
  File('${dir.path}/manifest.json').writeAsStringSync(
    '${const JsonEncoder.withIndent('  ').convert(manifest)}\n',
  );
  stdout.writeln('manifest.json: ${bytes.length} bytes, ${manifest['files']}');
}
