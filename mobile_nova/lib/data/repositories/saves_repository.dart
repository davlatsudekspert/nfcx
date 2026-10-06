import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/secure_store.dart';
import '../../core/utils/result.dart';

/// Saqlanganlar turi — server `kind` bilan bir xil.
enum SaveKind { reel, listing }

/// SAQLANGANLAR SERVERDA (`/api/saves`, hosting/api/saves.js).
///
/// Ilgari saqlangan Reels va katalog sevimlilari faqat telefon
/// xotirasida turardi — telefon almashsa yo'qolardi. Endi hisobga
/// yoziladi; telefon xotirasi faqat tezkor kesh.
class SavesRepository {
  SavesRepository(this._api);
  final ApiClient _api;

  Future<Result<List<String>>> list(SaveKind kind) async {
    final res = await _api.get<Map<String, dynamic>>('/api/saves',
        query: {'kind': kind.name});
    return res.map((j) => [
          for (final e in (j['items'] as List? ?? const []))
            if (e is Map && e['ref'] != null) '${e['ref']}',
        ]);
  }

  Future<Result<bool>> set(SaveKind kind, String ref, bool saved) async {
    final res = await _api.post<Map<String, dynamic>>('/api/saves',
        {'kind': kind.name, 'ref': ref, 'saved': saved});
    return res.map((j) => j['saved'] == true);
  }
}

final savesRepositoryProvider = Provider<SavesRepository>(
  (ref) => SavesRepository(ref.watch(apiProvider)),
);

/// Telefon keshi + server. UMUMIY qoida (Reels va katalog uchun):
///
///   * ochilishda darhol keshdan ko'rsatiladi (tarmoq kutilmaydi);
///   * keyin server ro'yxati olinadi va u ASOSIY manba: boshqa
///     qurilmada o'chirilgan yozuv bu yerda ham yo'qoladi;
///   * telefonda bor-u serverda yo'q ESKI yozuvlar (hisobsiz eski
///     versiyada saqlanganlar) serverga faqat BIR MARTA ko'chiriladi
///     (`savesMigrated`). Ilgari bu har sinxronda qilinardi va boshqa
///     qurilmada o'chirilganlar "tirilib" qolardi;
///   * bosilganda darhol o'zgaradi va serverga yuboriladi. Yetmasa
///     (internet yo'q) — `pending` ga yoziladi va keyingi sinxronda
///     qayta yuboriladi;
///   * kesh HISOB bo'yicha (`Prefs.savesOf(kind, uid)`): bir telefonda
///     hisob almashsa, ro'yxatlar aralashmaydi. Hisob yo'q — bo'sh,
///     sinxron yo'q.
class SyncedSaves extends StateNotifier<Set<String>> {
  SyncedSaves(this._repo, this.kind,
      {required Iterable<String> initial,
      required Future<void> Function(List<String>) persist,
      bool migrated = true,
      Future<void> Function()? markMigrated,
      Iterable<String> pending = const [],
      Future<void> Function(List<String>)? persistPending,
      this.enabled = true})
      : _persist = persist,
        _migrated = migrated,
        _markMigrated = markMigrated,
        _persistPending = persistPending,
        _pending = {
          for (final op in pending)
            if (op.length > 2) op.substring(2): op.startsWith('1:'),
        },
        super(initial.toSet()) {
    if (enabled) Future.microtask(sync);
  }

  /// Joriy hisob uchun — kesh, ko'chirish belgisi va kutilayotgan
  /// bosishlar shu hisob kalitlarida. `uid == null` — bo'sh, o'chiq.
  factory SyncedSaves.forUser(
      SavesRepository repo, SaveKind kind, Prefs prefs, int? uid) {
    if (uid == null) {
      return SyncedSaves(repo, kind,
          initial: const [], persist: (_) async {}, enabled: false);
    }
    return SyncedSaves(
      repo,
      kind,
      initial: prefs.savesOf(kind.name, uid),
      persist: (keys) => prefs.setSavesOf(kind.name, uid, keys),
      migrated: prefs.savesMigrated(kind.name, uid),
      markMigrated: () => prefs.setSavesMigrated(kind.name, uid),
      pending: prefs.savesPending(kind.name, uid),
      persistPending: (ops) => prefs.setSavesPending(kind.name, uid, ops),
    );
  }

  final SavesRepository _repo;
  final SaveKind kind;
  final bool enabled;
  final Future<void> Function(List<String>) _persist;
  final Future<void> Function()? _markMigrated;
  final Future<void> Function(List<String>)? _persistPending;
  bool _migrated;

  /// Serverga yetmagan bosishlar: kalit -> `true` saqlash / `false` olish.
  final Map<String, bool> _pending;
  bool _syncing = false;

  bool contains(String key) => state.contains(key);

  Future<void> _savePending() async => _persistPending?.call([
        for (final e in _pending.entries) '${e.value ? 1 : 0}:${e.key}',
      ]);

  Future<void> sync() async {
    if (!enabled || _syncing || !mounted) return;
    _syncing = true;
    try {
      final res = await _repo.list(kind);
      final server = res.valueOrNull;
      if (server == null || !mounted) return;
      final next = server.toSet();

      // 1) Eski, hisobsiz yozuvlar — BIR MARTA.
      if (!_migrated) {
        for (final k in state.difference(next)) {
          if (_pending.containsKey(k)) continue;
          if ((await _repo.set(kind, k, true)).isOk) next.add(k);
        }
        _migrated = true;
        await _markMigrated?.call();
      }

      // 2) Yetmagan bosishlar — qayta yuboriladi; yetmasa ham ko'rinishda
      //    qoladi (odamning so'nggi tanlovi).
      for (final e in [..._pending.entries]) {
        if ((await _repo.set(kind, e.key, e.value)).isOk) {
          _pending.remove(e.key);
        }
        e.value ? next.add(e.key) : next.remove(e.key);
      }
      if (!mounted) return;
      state = next;
      await _persist(state.toList());
      await _savePending();
    } finally {
      _syncing = false;
    }
  }

  /// `true` — endi saqlangan.
  Future<bool> toggle(String key) async {
    final next = {...state};
    final added = next.add(key);
    if (!added) next.remove(key);
    state = next;
    await _persist(next.toList());
    if (!enabled) return added;
    final res = await _repo.set(kind, key, added);
    if (res.isOk) {
      _pending.remove(key);
    } else {
      _pending[key] = added;
    }
    await _savePending();
    return added;
  }
}
