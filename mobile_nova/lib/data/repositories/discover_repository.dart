import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// Qidiruv va kashfiyot.
class DiscoverRepository {
  DiscoverRepository(this._api);
  final ApiClient _api;

  /// Odamlar va NFC ID'lar bo'yicha qidiruv.
  Future<Result<List<NfcId>>> searchPeople(String q) async {
    final res =
        await _api.get<Map<String, dynamic>>('/api/records/search', query: {'q': q});
    return res.map((j) => parseList(j['records'] ?? j['items'], NfcId.fromJson));
  }

  Future<Result<List<Business>>> searchBusinesses(String q) async {
    final res =
        await _api.get<Map<String, dynamic>>('/api/companies/search', query: {'q': q});
    return res.map((j) => parseList(j['companies'] ?? j['items'], Business.fromJson));
  }

  /// Tavsiya etiladigan profillar — qidiruv bo'sh bo'lganda ko'rinadi.
  Future<Result<List<NfcId>>> suggested() async {
    final res = await _api
        .get<Map<String, dynamic>>('/api/records/search', query: {'q': '', 'limit': 12});
    return res.map((j) => parseList(j['records'] ?? j['items'], NfcId.fromJson));
  }

  Future<Result<List<Post>>> trending() async {
    final res = await _api.get<Map<String, dynamic>>('/api/news', query: {'limit': 20});
    return res.map((j) => parseList(j['news'] ?? j['items'], Post.fromJson));
  }
}

final discoverRepositoryProvider = Provider<DiscoverRepository>(
  (ref) => DiscoverRepository(ref.watch(apiProvider)),
);
