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

/// O'zbek kirill yozuvidagi so'rovni lotinga o'giradi (kartalar o'zbekcha
/// lotin yozuvida): “сийдик” → “siydik”. Apostroflar [normalizeForSearch]
/// da baribir olib tashlanadi (ғ → g, ў → o).
String uzCyrillicToLatin(String input) {
  const map = {
    'а': 'a',
    'б': 'b',
    'в': 'v',
    'г': 'g',
    'ғ': 'g',
    'д': 'd',
    'е': 'e',
    'ё': 'yo',
    'ж': 'j',
    'з': 'z',
    'и': 'i',
    'й': 'y',
    'к': 'k',
    'қ': 'q',
    'л': 'l',
    'м': 'm',
    'н': 'n',
    'о': 'o',
    'ў': 'o',
    'п': 'p',
    'р': 'r',
    'с': 's',
    'т': 't',
    'у': 'u',
    'ф': 'f',
    'х': 'x',
    'ҳ': 'h',
    'ц': 's',
    'ч': 'ch',
    'ш': 'sh',
    'щ': 'sh',
    'ъ': '',
    'ы': 'i',
    'ь': '',
    'э': 'e',
    'ю': 'yu',
    'я': 'ya',
  };
  final out = StringBuffer();
  final lower = input.toLowerCase();
  for (var i = 0; i < lower.length; i++) {
    final ch = lower[i];
    final wordStart =
        i == 0 || !RegExp(r'[\p{L}]', unicode: true).hasMatch(lower[i - 1]);
    // So'z boshidagi “е” — “ye” (ер → yer).
    if (ch == 'е' && wordStart) {
      out.write('ye');
    } else {
      out.write(map[ch] ?? ch);
    }
  }
  return out.toString();
}

final _cyrillic = RegExp('[а-яёўқғҳ]');

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

    // Kirillcha so'rov: ruscha nomlar bilan o'zicha, o'zbekcha (lotin)
    // nomlar bilan esa lotinga o'girilgan holda solishtiriladi.
    final queries = {
      q,
      if (_cyrillic.hasMatch(q)) normalizeForSearch(uzCyrillicToLatin(q)),
    };
    final scored = <(Analyte, int)>[];
    for (final a in candidates) {
      final e = _index[a.id]!;
      var score = 0;
      for (final query in queries) {
        final s = e.score(
          query,
          query.replaceAll(' ', ''),
          query.split(' '),
          lang,
        );
        if (s > score) score = s;
      }
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
