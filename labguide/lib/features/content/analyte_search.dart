import 'content_model.dart';

/// Qidiruv uchun matnni normallashtirish: kichik harf, o'zbekcha
/// apostrof variantlari (‘ ’ ʻ ʼ ` ') olib tashlanadi, ё → е, defis va
/// tinish belgilari bo'shliqqa aylanadi, bo'shliqlar siqiladi.
String normalizeForSearch(String input) {
  var s = input.toLowerCase();
  s = s.replaceAll(RegExp('[‘’ʻʼ`\'´]'), '');
  s = s.replaceAll('ё', 'е');
  s = s.replaceAll(RegExp(r'[\-‐–—_/,.;:()\[\]·]+'), ' ');
  s = s.replaceAll(RegExp(r'\s+'), ' ').trim();
  return s;
}

class AnalyteSearch {
  AnalyteSearch(this.pack)
    : _index = {for (final a in pack.analytes) a.id: _Entry.of(a)};

  final ContentPack pack;
  final Map<String, _Entry> _index;

  /// [query] bo'sh bo'lsa — guruh bo'yicha filtrlangan to'liq ro'yxat
  /// (paketdagi tartibda). Aks holda moslik darajasi bo'yicha tartiblanadi:
  /// to'liq nom/sinonim → boshlanishi → ichida uchrashi.
  List<Analyte> search(String query, {String? groupId, required String lang}) {
    final q = normalizeForSearch(query);
    final candidates = pack.analytes.where(
      (a) => groupId == null || a.group == groupId,
    );
    if (q.isEmpty) return candidates.toList();

    final tokens = q.split(' ');
    final compactQuery = q.replaceAll(' ', '');
    final scored = <(Analyte, int)>[];
    for (final a in candidates) {
      final e = _index[a.id]!;
      final score = e.score(q, compactQuery, tokens, lang);
      if (score > 0) scored.add((a, score));
    }
    scored.sort((x, y) {
      final byScore = y.$2.compareTo(x.$2);
      if (byScore != 0) return byScore;
      return x.$1.names.of(lang).compareTo(y.$1.names.of(lang));
    });
    return [for (final s in scored) s.$1];
  }
}

class _Entry {
  _Entry(this.termsByLang, this.synonyms);

  factory _Entry.of(Analyte a) => _Entry(
    {
      for (final e in a.names.values.entries)
        e.key: normalizeForSearch(e.value),
    },
    [for (final s in a.synonyms) normalizeForSearch(s)],
  );

  final Map<String, String> termsByLang;
  final List<String> synonyms;

  Iterable<String> get _allTerms => [...termsByLang.values, ...synonyms];

  int score(String q, String compact, List<String> tokens, String lang) {
    var best = 0;
    for (final term in _allTerms) {
      final isCurrentLang = term == termsByLang[lang];
      final bonus = isCurrentLang ? 5 : 0;
      final termCompact = term.replaceAll(' ', '');
      if (term == q || termCompact == compact) {
        best = _max(best, 100 + bonus);
      } else if (term.startsWith(q) || termCompact.startsWith(compact)) {
        best = _max(best, 60 + bonus);
      } else if (_words(term).any((w) => w.startsWith(q))) {
        best = _max(best, 40 + bonus);
      } else if (term.contains(q) || termCompact.contains(compact)) {
        best = _max(best, 20 + bonus);
      }
    }
    if (best == 0 && tokens.length > 1) {
      // Har bir so'z nom yoki sinonimlarning birortasida uchrashi kerak.
      final haystack = _allTerms.join(' ');
      if (tokens.every(haystack.contains)) best = 10;
    }
    return best;
  }

  static Iterable<String> _words(String s) => s.split(' ');

  static int _max(int a, int b) => a > b ? a : b;
}
