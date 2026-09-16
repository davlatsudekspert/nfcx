import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// TEGIZISHLAR TARIXI (prototip: "Tegizishlar tarixi").
///
/// NIMA UCHUN QURILMADA, SERVERDA EMAS: bu ro'yxat — SHU TELEFON
/// nimalarga tegganini ko'rsatadi, o'z kartangizga kim tekkanini
/// emas (u profil statistikasida). Serverda bunday jadval umuman
/// yo'q va bo'lishi ham shart emas: begona, bo'sh yoki boshqa
/// firmaning tegi ham shu ro'yxatga tushadi — ularni serverga
/// yuborish odamning harakatlarini bekordan-bekorga kuzatish
/// bo'lardi.
///
/// SHUNING UCHUN: hech qayerga yuborilmaydi, telefonda qoladi va
/// istalgan payt tozalanadi.
class ScanHistory extends ChangeNotifier {
  // ignore: prefer_initializing_formals
  ScanHistory({SharedPreferences? prefs}) : _prefs = prefs;

  static const _key = 'nfc_scan_history';

  /// Oxirgi 30 ta tegizish. Undan ortig'i ro'yxatni foydasiz
  /// uzaytiradi: odam kechagi-bugungini qidiradi, o'tgan oynikini
  /// emas.
  static const _limit = 30;

  SharedPreferences? _prefs;

  List<ScanEntry> _items = const [];

  /// Yangisidan eskisiga.
  List<ScanEntry> get items => _items;

  bool _loaded = false;
  bool get loaded => _loaded;

  Future<void> load() async {
    try {
      final p = _prefs ??= await SharedPreferences.getInstance();
      final raw = p.getStringList(_key) ?? const [];
      _items = raw
          .map((e) {
            try {
              final m = jsonDecode(e);
              return m is Map<String, dynamic> ? ScanEntry.fromJson(m) : null;
            } catch (_) {
              return null;
            }
          })
          .whereType<ScanEntry>()
          .toList();
    } catch (_) {
      // Tarix ochilmasa ro'yxat bo'sh qoladi — bu ekranni
      // buzmaydi.
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> add(ScanEntry entry) async {
    _items = [entry, ..._items].take(_limit).toList();
    notifyListeners();
    await _save();
  }

  /// Shu kod jismoniy tegga YOZILGANMI (shu telefonda).
  bool wroteCode(String code) {
    final key = code.toUpperCase();
    return _items.any(
      (e) => e.outcome == kWrittenOutcome && e.code.toUpperCase() == key,
    );
  }

  Future<void> clear() async {
    _items = const [];
    notifyListeners();
    await _save();
  }

  Future<void> _save() async {
    try {
      final p = _prefs ??= await SharedPreferences.getInstance();
      await p.setStringList(
        _key,
        _items.map((e) => jsonEncode(e.toJson())).toList(),
      );
    } catch (_) {
      // Yozilmasa joriy sessiyada ro'yxat baribir ko'rinadi.
    }
  }
}

/// "Kartaga yozildi" belgisi — `ScanEntry.outcome` qiymati.
///
/// Matn sifatida saqlanadi (tarix JSON'da), shuning uchun u bitta
/// joyda turadi: ikki faylda ikki xil yozilsa, NFC markazidagi
/// chip jimgina o'chib qolardi.
const kWrittenOutcome = 'yozildi';

/// Bitta tegizish.
class ScanEntry {
  const ScanEntry({
    required this.at,
    this.code = '',
    this.name = '',
    this.kind = '',
    this.outcome = '',
    this.isCompany = false,
  });

  final DateTime at;

  /// NFCSTORE kodi — begona tegda bo'sh.
  final String code;

  /// Profil yoki kompaniya nomi — bilinsa.
  final String name;

  /// Teg turi (`NTAG215`) — platforma aytsa.
  final String kind;

  /// Nima bo'ldi: "profil ochildi", "bo'sh", "yozildi".
  final String outcome;

  final bool isCompany;

  /// NFCSTORE kartasimi.
  bool get known => code.isNotEmpty;

  Map<String, dynamic> toJson() => {
        'at': at.millisecondsSinceEpoch,
        if (code.isNotEmpty) 'code': code,
        if (name.isNotEmpty) 'name': name,
        if (kind.isNotEmpty) 'kind': kind,
        if (outcome.isNotEmpty) 'outcome': outcome,
        if (isCompany) 'company': true,
      };

  factory ScanEntry.fromJson(Map<String, dynamic> j) => ScanEntry(
        at: DateTime.fromMillisecondsSinceEpoch(
          (j['at'] as num?)?.round() ?? 0,
        ),
        code: '${j['code'] ?? ''}',
        name: '${j['name'] ?? ''}',
        kind: '${j['kind'] ?? ''}',
        outcome: '${j['outcome'] ?? ''}',
        isCompany: j['company'] == true,
      );
}
