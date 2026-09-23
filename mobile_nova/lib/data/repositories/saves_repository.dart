import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
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
///   * keyin server ro'yxati olinadi; telefonda bor-u serverda yo'q
///     yozuvlar (eski versiyada saqlanganlar) serverga BIR MARTA
///     ko'chiriladi — hech narsa yo'qolmaydi;
///   * bosilganda darhol o'zgaradi va serverga yuboriladi. Internet
///     bo'lmasa keshda qoladi va keyingi sinxronda yuboriladi;
///   * server hali eski bo'lsa (endpoint yo'q) — avvalgidek faqat
///     telefonda ishlaydi, xato ko'rsatilmaydi.
class SyncedSaves extends StateNotifier<Set<String>> {
  SyncedSaves(this._repo, this.kind,
      {required Iterable<String> initial,
      required Future<void> Function(List<String>) persist})
      : _persist = persist,
        super(initial.toSet()) {
    Future.microtask(sync);
  }

  final SavesRepository _repo;
  final SaveKind kind;
  final Future<void> Function(List<String>) _persist;
  bool _syncing = false;

  bool contains(String key) => state.contains(key);

  Future<void> sync() async {
    if (_syncing || !mounted) return;
    _syncing = true;
    try {
      final res = await _repo.list(kind);
      final server = res.valueOrNull;
      if (server == null || !mounted) return;
      final serverSet = server.toSet();
      final localOnly = state.difference(serverSet);
      for (final k in localOnly) {
        await _repo.set(kind, k, true);
      }
      if (!mounted) return;
      state = {...serverSet, ...localOnly};
      await _persist(state.toList());
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
    await _repo.set(kind, key, added);
    return added;
  }
}
