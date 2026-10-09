import 'package:flutter/foundation.dart';

/// Kontent sxemasi versiyasi. Paket `min_schema` dan katta bo'lsa rad
/// etiladi (eski ilova yangi formatni noto'g'ri o'qimasligi uchun).
const int kSupportedContentSchema = 1;

/// Uch tildagi matn. Tarjima yo'q bo'lsa inglizchaga, keyin istalgan
/// mavjud tilga qaytadi — bo'sh joy ko'rsatilmaydi.
@immutable
class LocalizedText {
  const LocalizedText(this.values);

  /// Paketdagi har bir matn uch tilda bo'lishi shart: bo'sh yoki yo'q til
  /// foydalanuvchiga bo'sh joy bo'lib ko'rinardi.
  factory LocalizedText.fromJson(Object? json) {
    if (json is! Map) throw const FormatException('localized text expected');
    final values = <String, String>{};
    for (final e in json.entries) {
      final v = e.value;
      if (e.key is! String || v is! String) {
        throw const FormatException('localized text: string values expected');
      }
      values[e.key as String] = v;
    }
    for (final lang in requiredLanguages) {
      if ((values[lang] ?? '').trim().isEmpty) {
        throw FormatException('localized text without "$lang": $values');
      }
    }
    return LocalizedText(values);
  }

  static const requiredLanguages = ['uz', 'ru', 'en'];

  final Map<String, String> values;

  /// So'ralgan til, bo'lmasa (yoki bo'sh bo'lsa) inglizcha, keyin istalgani.
  String of(String lang) {
    String? usable(String? v) => v == null || v.trim().isEmpty ? null : v;
    return usable(values[lang]) ??
        usable(values['en']) ??
        values.values.map(usable).nonNulls.firstOrNull ??
        '';
  }

  Iterable<String> get all => values.values;
}

enum ContentStatus {
  draft,
  verified,
  published;

  static ContentStatus parse(String raw) => ContentStatus.values.firstWhere(
    (s) => s.name == raw,
    orElse: () => throw FormatException('unknown status: $raw'),
  );
}

/// Karta mazmuni qay darajada tayyor.
enum ContentState {
  /// Faqat nom/guruh/tuzilma. Klinik matn yo'q.
  structureOnly,

  /// Manbaga bog'langan o'quv namunasi; mustaqil tekshiruvdan o'tmagan.
  sourcedSample,

  /// Tekshirilgan va nashrga tayyor.
  reviewed;

  static ContentState parse(String raw) => switch (raw) {
    'structure_only' => structureOnly,
    'sourced_sample' => sourcedSample,
    'reviewed' => reviewed,
    _ => throw FormatException('unknown content_state: $raw'),
  };
}

enum ReviewState {
  pending,
  approved,
  rejected;

  static ReviewState parse(String raw) => ReviewState.values.firstWhere(
    (s) => s.name == raw,
    orElse: () => throw FormatException('unknown review state: $raw'),
  );
}

@immutable
class ContentSource {
  const ContentSource({
    required this.id,
    required this.kind,
    required this.title,
    required this.publisher,
    required this.reuseRights,
    this.url,
    this.accessed,
    this.libraryItemId,
    this.sourceDate,
    this.jurisdiction,
    this.note,
  });

  factory ContentSource.fromJson(Map<String, Object?> json) {
    final source = ContentSource(
      id: json['id']! as String,
      kind: json['kind'] as String? ?? 'web',
      title: json['title']! as String,
      publisher: json['publisher']! as String,
      url: json['url'] as String?,
      accessed: json['accessed'] as String?,
      libraryItemId: json['library_item_id'] as String?,
      reuseRights: json['reuse_rights']! as String,
      sourceDate: json['source_date'] as String?,
      jurisdiction: json['jurisdiction'] as String?,
      note: json['note'] as String?,
    );
    if (source.kind == 'web' &&
        (source.url == null || source.accessed == null)) {
      throw FormatException('${source.id}: web source needs url and accessed');
    }
    if (source.kind != 'web' && source.libraryItemId == null) {
      throw FormatException('${source.id}: ${source.kind} needs library item');
    }
    return source;
  }

  final String id;

  /// `web` yoki kutubxona elementi turi (`book`, `manual`, `method`...).
  final String kind;
  final String title;
  final String publisher;

  /// Veb-manbalar uchun majburiy.
  final String? url;

  /// Veb-manba ko'rilgan sana, ISO (YYYY-MM-DD).
  final String? accessed;

  /// Kitob/qo'llanma bo'lsa — [LibraryItem.id].
  final String? libraryItemId;
  final String reuseRights;

  /// Manba sahifasining o'z sanasi (yangilangan/ko'rib chiqilgan).
  final String? sourceDate;

  /// Qaysi mamlakat/tizim tavsiyasi (masalan, US).
  final String? jurisdiction;
  final String? note;
}

/// Manbaga aniq havola: qaysi manba, qaysi sahifa(lar), qaysi bo'lim.
///
/// JSON da ikki ko'rinishda yoziladi:
/// * `"refs": [{"source_id": "...", "pages": "45–47", "locator": "..."}]`
///   — kitob va qo'llanmalar uchun (sahifa raqami bilan);
/// * eski qisqa shakl: `"source_ids": [...]` + ixtiyoriy `"locator"`.
@immutable
class SourceRef {
  const SourceRef(this.sourceId, {this.pages, this.locator});

  factory SourceRef.fromJson(Map<String, Object?> json) => SourceRef(
    json['source_id']! as String,
    pages: json['pages'] as String?,
    locator: json['locator'] as String?,
  );

  final String sourceId;

  /// Kitob/qo'llanmadagi sahifa yoki oraliq ("45", "45–47").
  final String? pages;

  /// Bo'lim nomi yoki veb-sahifadagi sarlavha.
  final String? locator;

  static List<SourceRef> listFromJson(Map<String, Object?> json) {
    final refs = json['refs'];
    if (refs is List) {
      return [
        for (final r in refs)
          SourceRef.fromJson((r as Map).cast<String, Object?>()),
      ];
    }
    final ids = _strings(json['source_ids'], 'source_ids');
    return [
      for (final id in ids)
        SourceRef(
          id,
          pages: json['pages'] as String?,
          locator: json['locator'] as String?,
        ),
    ];
  }
}

/// Bitta da'vo: matn + manbaga havola + manbadagi joy.
@immutable
class Claim {
  const Claim({required this.section, required this.text, required this.refs});

  factory Claim.fromJson(Map<String, Object?> json) => Claim(
    section: json['section']! as String,
    text: LocalizedText.fromJson(json['text']),
    refs: SourceRef.listFromJson(json),
  );

  final String section;
  final LocalizedText text;
  final List<SourceRef> refs;

  List<String> get sourceIds => [for (final r in refs) r.sourceId];
}

/// Diagnostik qaror chegarasi. Referens interval EMAS — alohida saqlanadi.
@immutable
class DecisionLimit {
  const DecisionLimit({
    required this.label,
    required this.unit,
    required this.population,
    required this.refs,
    this.low,
    this.high,
    this.lowExclusive = false,
    this.highExclusive = false,
    this.note,
  });

  factory DecisionLimit.fromJson(Map<String, Object?> json) => DecisionLimit(
    label: LocalizedText.fromJson(json['label']),
    unit: json['unit']! as String,
    low: (json['low'] as num?)?.toDouble(),
    high: (json['high'] as num?)?.toDouble(),
    lowExclusive: json['low_exclusive'] as bool? ?? false,
    highExclusive: json['high_exclusive'] as bool? ?? false,
    population: LocalizedText.fromJson(json['population']),
    note: json['note'] == null ? null : LocalizedText.fromJson(json['note']),
    refs: SourceRef.listFromJson(json),
  );

  final LocalizedText label;
  final String unit;

  /// Pastki chegara. `null` bo'lsa — faqat yuqori chegara.
  final double? low;

  /// Yuqori chegara. `null` bo'lsa — faqat pastki chegara.
  final double? high;

  /// Chegara qiymatning o'zi kirmaydi: manba “more than 30” / “less than 60”
  /// desa `true` (“> 30”, “< 60”); “30 or more” bo'lsa `false` (“≥ 30”).
  final bool lowExclusive;
  final bool highExclusive;
  final LocalizedText population;
  final LocalizedText? note;
  final List<SourceRef> refs;

  List<String> get sourceIds => [for (final r in refs) r.sourceId];
}

/// Referens interval: metod, namuna va populyatsiyaga bog'liq. Hozircha
/// bironta analitda to'ldirilmagan — UI "laboratoriya blankidan" deydi.
@immutable
class ReferenceInterval {
  const ReferenceInterval({
    required this.unit,
    required this.population,
    required this.method,
    required this.refs,
    this.low,
    this.high,
  });

  factory ReferenceInterval.fromJson(Map<String, Object?> json) =>
      ReferenceInterval(
        unit: json['unit']! as String,
        low: (json['low'] as num?)?.toDouble(),
        high: (json['high'] as num?)?.toDouble(),
        population: LocalizedText.fromJson(json['population']),
        method: json['method']! as String,
        refs: SourceRef.listFromJson(json),
      );

  final String unit;
  final double? low;
  final double? high;
  final LocalizedText population;
  final String method;
  final List<SourceRef> refs;

  List<String> get sourceIds => [for (final r in refs) r.sourceId];
}

/// Moddaga xos birlik konversiyasi (mg/dL ↔ mmol/L).
@immutable
class UnitConversion {
  const UnitConversion({
    required this.molarMass,
    required this.basis,
    this.siUnit = 'mmol/L',
  });

  factory UnitConversion.fromJson(Map<String, Object?> json) {
    final si = json['si_unit'] as String? ?? 'mmol/L';
    if (si != 'mmol/L' && si != 'µmol/L') {
      throw FormatException('unsupported si_unit: $si');
    }
    final molarMass = (json['molar_mass_g_per_mol']! as num).toDouble();
    if (!molarMass.isFinite || molarMass <= 0) {
      throw FormatException('molar mass must be positive: $molarMass');
    }
    return UnitConversion(
      molarMass: molarMass,
      basis: json['basis']! as String,
      siUnit: si,
    );
  }

  /// g/mol.
  final double molarMass;

  /// Qiymat qayerdan olingani (masalan, standart atom massalaridan hisob).
  final String basis;

  /// Laboratoriyalar odatda beradigan SI birlik: `mmol/L` yoki `µmol/L`.
  final String siUnit;

  /// 1 mmol/L necha [siUnit] ga teng.
  double get siPerMmol => siUnit == 'µmol/L' ? 1000 : 1;
}

@immutable
class InstrumentBinding {
  const InstrumentBinding({
    this.manufacturer,
    this.model,
    this.reagentRef,
    this.ifuRevision,
    this.calibratorLot,
  });

  factory InstrumentBinding.fromJson(Map<String, Object?>? json) =>
      InstrumentBinding(
        manufacturer: json?['manufacturer'] as String?,
        model: json?['model'] as String?,
        reagentRef: json?['reagent_ref'] as String?,
        ifuRevision: json?['ifu_revision'] as String?,
        calibratorLot: json?['calibrator_lot'] as String?,
      );

  final String? manufacturer;
  final String? model;
  final String? reagentRef;
  final String? ifuRevision;
  final String? calibratorLot;

  bool get isBound =>
      manufacturer != null &&
      model != null &&
      reagentRef != null &&
      ifuRevision != null;
}

@immutable
class Analyte {
  const Analyte({
    required this.id,
    required this.status,
    required this.contentState,
    required this.names,
    required this.synonyms,
    required this.group,
    required this.units,
    required this.sections,
    required this.claims,
    required this.decisionLimits,
    required this.referenceIntervals,
    required this.sourceIds,
    required this.reviewState,
    required this.translationReview,
    required this.related,
    required this.instrumentBinding,
    this.notes = const {},
    this.tagline,
    this.specimen,
    this.population,
    this.method,
    this.conversion,
    this.reviewerId,
    this.reviewedAt,
  });

  factory Analyte.fromJson(Map<String, Object?> json) {
    final review = (json['review'] as Map?)?.cast<String, Object?>() ?? {};
    return Analyte(
      id: json['id']! as String,
      status: ContentStatus.parse(json['status']! as String),
      contentState: ContentState.parse(json['content_state']! as String),
      names: LocalizedText.fromJson(json['names']),
      tagline: json['tagline'] == null
          ? null
          : LocalizedText.fromJson(json['tagline']),
      synonyms: _strings(json['synonyms'], 'synonyms'),
      group: json['group']! as String,
      specimen: json['specimen'] == null
          ? null
          : LocalizedText.fromJson(json['specimen']),
      population: json['population'] == null
          ? null
          : LocalizedText.fromJson(json['population']),
      method: json['method'] as String?,
      units: _strings(json['units'], 'units'),
      sections: _strings(json['sections'], 'sections'),
      claims: [
        for (final c in json['claims'] as List? ?? const [])
          Claim.fromJson((c as Map).cast<String, Object?>()),
      ],
      decisionLimits: [
        for (final d in json['decision_limits'] as List? ?? const [])
          DecisionLimit.fromJson((d as Map).cast<String, Object?>()),
      ],
      referenceIntervals: [
        for (final r in json['reference_intervals'] as List? ?? const [])
          ReferenceInterval.fromJson((r as Map).cast<String, Object?>()),
      ],
      sourceIds: _strings(json['source_ids'], 'source_ids'),
      reviewState: ReviewState.parse(review['state'] as String? ?? 'pending'),
      reviewerId: review['reviewer_id'] as String?,
      reviewedAt: review['reviewed_at'] as String?,
      translationReview: {
        for (final e
            in ((json['translation_review'] as Map?) ?? const {}).entries)
          e.key as String: e.value as String,
      },
      related: _strings(json['related'], 'related'),
      conversion: json['conversion'] == null
          ? null
          : UnitConversion.fromJson(
              (json['conversion']! as Map).cast<String, Object?>(),
            ),
      instrumentBinding: InstrumentBinding.fromJson(
        (json['instrument_binding'] as Map?)?.cast<String, Object?>(),
      ),
      notes: {
        for (final e in ((json['notes'] as Map?) ?? const {}).entries)
          e.key as String: LocalizedText.fromJson(e.value),
      },
    );
  }

  final String id;
  final ContentStatus status;
  final ContentState contentState;
  final LocalizedText names;
  final LocalizedText? tagline;
  final List<String> synonyms;
  final String group;
  final LocalizedText? specimen;
  final LocalizedText? population;
  final String? method;
  final List<String> units;
  final List<String> sections;
  final List<Claim> claims;
  final List<DecisionLimit> decisionLimits;
  final List<ReferenceInterval> referenceIntervals;
  final List<String> sourceIds;
  final ReviewState reviewState;
  final String? reviewerId;
  final String? reviewedAt;
  final Map<String, String> translationReview;
  final List<String> related;
  final UnitConversion? conversion;
  final InstrumentBinding instrumentBinding;

  /// Bo'lim bo'yicha tahririy izohlar (masalan, "universal parametr
  /// berilmaydi"). Klinik da'vo emas — da'volar faqat [claims] da va
  /// har biri manbaga bog'langan.
  final Map<String, LocalizedText> notes;

  List<Claim> claimsFor(String section) =>
      claims.where((c) => c.section == section).toList(growable: false);

  /// Mustaqil mutaxassis tasdiqlaganmi. Faqat shunda "reviewed" deyiladi.
  bool get isReviewerApproved =>
      reviewState == ReviewState.approved && reviewerId != null;
}

@immutable
class AnalyteGroup {
  const AnalyteGroup({required this.id, required this.names});

  factory AnalyteGroup.fromJson(Map<String, Object?> json) => AnalyteGroup(
    id: json['id']! as String,
    names: LocalizedText.fromJson(json['names']),
  );

  final String id;
  final LocalizedText names;
}

@immutable
class QuizOption {
  const QuizOption({required this.text, required this.explanation});

  factory QuizOption.fromJson(Map<String, Object?> json) => QuizOption(
    text: LocalizedText.fromJson(json['text']),
    explanation: LocalizedText.fromJson(json['explanation']),
  );

  final LocalizedText text;

  /// Nega bu javob to'g'ri yoki noto'g'ri — har bir variant uchun.
  final LocalizedText explanation;
}

@immutable
class QuizQuestion {
  const QuizQuestion({
    required this.id,
    required this.prompt,
    required this.options,
    required this.correctIndex,
    required this.basis,
    required this.refs,
    required this.reviewState,
    this.topicIds = const [],
  });

  factory QuizQuestion.fromJson(Map<String, Object?> json) {
    final options = [
      for (final o in json['options']! as List)
        QuizOption.fromJson((o as Map).cast<String, Object?>()),
    ];
    final correct = json['correct_index']! as int;
    if (correct < 0 || correct >= options.length) {
      throw FormatException('correct_index out of range in ${json['id']}');
    }
    return QuizQuestion(
      id: json['id']! as String,
      prompt: LocalizedText.fromJson(json['prompt']),
      options: options,
      correctIndex: correct,
      basis: LocalizedText.fromJson(json['basis']),
      refs: SourceRef.listFromJson(json),
      reviewState: ReviewState.parse(json['review_state'] as String),
      topicIds: _strings(json['topic_ids'], 'topic_ids'),
    );
  }

  final String id;
  final LocalizedText prompt;
  final List<QuizOption> options;
  final int correctIndex;

  /// Javob nimaga asoslangani (manba yoki ta'rifdan keltirib chiqarish).
  final LocalizedText basis;

  /// Manba va sahifa. Tasdiqlangan savolda kamida bittasi bo'lishi shart.
  final List<SourceRef> refs;

  /// Tasdiqlanmagan savol — qoralama (draft) sifatida ko'rsatiladi.
  final ReviewState reviewState;

  /// Bog'liq dars mavzulari yoki analitlar.
  final List<String> topicIds;

  List<String> get sourceIds => [for (final r in refs) r.sourceId];

  bool get isDraft => reviewState != ReviewState.approved;
}

/// Kutubxona elementi turkumlari (domla materiallarini saralash uchun).
enum LibraryCategory {
  biochemistry('biochemistry'),
  clinicalLab('clinical_lab'),
  instruments('instruments'),
  methods('methods'),
  tests('tests');

  const LibraryCategory(this.key);
  final String key;

  static LibraryCategory parse(String raw) => values.firstWhere(
    (c) => c.key == raw,
    orElse: () => throw FormatException('unknown category: $raw'),
  );
}

enum LibraryItemKind {
  book,
  manual,
  method,
  ifu,
  article,
  questionSet,
  website;

  static LibraryItemKind parse(String raw) => switch (raw) {
    'book' => book,
    'manual' => manual,
    'method' => method,
    'ifu' => ifu,
    'article' => article,
    'question_set' => questionSet,
    'website' => website,
    _ => throw FormatException('unknown library kind: $raw'),
  };
}

/// Material qaysi bosqichda. Fayl kelmaguncha `notReceived`: bunday
/// elementdan iqtibos keltirib bo'lmaydi.
enum ImportState {
  notReceived('not_received'),
  received('received'),
  cataloged('cataloged'),
  linked('linked'),
  reviewed('reviewed');

  const ImportState(this.key);
  final String key;

  /// Ichidagi ma'lumotga manba sifatida tayanish mumkinmi.
  bool get citable => index >= ImportState.cataloged.index;

  static ImportState parse(String raw) => values.firstWhere(
    (s) => s.key == raw,
    orElse: () => throw FormatException('unknown import_state: $raw'),
  );
}

enum DistributionRights {
  unknown('unknown'),
  personalOnly('personal_only'),
  permitted('permitted'),
  denied('denied');

  const DistributionRights(this.key);
  final String key;

  static DistributionRights parse(String raw) => values.firstWhere(
    (r) => r.key == raw,
    orElse: () => throw FormatException('unknown distribution: $raw'),
  );
}

/// Material qanday olinadi (katalogda ko'rsatiladi).
enum LibraryAccess {
  /// Ochiq litsenziya (CC BY, CC BY-SA, CC BY-NC, jamoat mulki) — havola
  /// orqali; to'liq matn paketi baribir alohida qayd talab qiladi.
  openLicence('open_licence'),

  /// Onlayn bepul o'qiladi, lekin ochiq litsenziya yo'q — faqat havola.
  freeToRead('free_to_read'),

  /// Erkin onlayn emas (bosma/pullik) — faqat bibliografik yozuv.
  catalogOnly('catalog_only');

  const LibraryAccess(this.key);
  final String key;

  static LibraryAccess parse(String raw) => values.firstWhere(
    (a) => a.key == raw,
    orElse: () => throw FormatException('unknown access: $raw'),
  );
}

/// Tarqatish huquqi qaydi: kim, qachon, qanday dalil bilan.
@immutable
class RightsRecord {
  const RightsRecord({
    required this.distribution,
    this.recordedAt,
    this.recordedBy,
    this.evidence,
    this.note,
  });

  factory RightsRecord.fromJson(Map<String, Object?>? json) => RightsRecord(
    distribution: DistributionRights.parse(
      json?['distribution'] as String? ?? 'unknown',
    ),
    recordedAt: json?['recorded_at'] as String?,
    recordedBy: json?['recorded_by'] as String?,
    evidence: json?['evidence'] as String?,
    note: json?['note'] as String?,
  );

  final DistributionRights distribution;
  final String? recordedAt;
  final String? recordedBy;

  /// Masalan, nashriyot xati yoki litsenziya havolasi.
  final String? evidence;
  final String? note;

  /// Umumiy kutubxonaga (hammaga yuklanadigan paket) qo'yish mumkinmi.
  bool get allowsSharedPack =>
      distribution == DistributionRights.permitted &&
      recordedAt != null &&
      evidence != null;
}

/// Alohida yuklanadigan oflayn paket (masalan, to'liq kitob).
@immutable
class FilePackRef {
  const FilePackRef({
    required this.packId,
    required this.version,
    required this.size,
    required this.sha256,
  });

  factory FilePackRef.fromJson(Map<String, Object?> json) => FilePackRef(
    packId: json['pack_id']! as String,
    version: json['version']! as String,
    size: json['size']! as int,
    sha256: json['sha256']! as String,
  );

  final String packId;
  final String version;
  final int size;
  final String sha256;
}

/// Kitob, qo'llanma, metodika, IFU yoki test to'plami katalogi yozuvi.
@immutable
class LibraryItem {
  const LibraryItem({
    required this.id,
    required this.kind,
    required this.title,
    required this.authors,
    required this.language,
    required this.categories,
    required this.topics,
    required this.importState,
    required this.rights,
    this.year,
    this.edition,
    this.publisher,
    this.isbn,
    this.providedBy,
    this.receivedAt,
    this.supersedes,
    this.filePack,
    this.url,
    this.licence,
    this.access = LibraryAccess.catalogOnly,
    this.accessed,
    this.note,
  });

  factory LibraryItem.fromJson(Map<String, Object?> json) => LibraryItem(
    id: json['id']! as String,
    kind: LibraryItemKind.parse(json['kind']! as String),
    title: json['title']! as String,
    authors: _strings(json['authors'], 'authors'),
    year: json['year'] as int?,
    edition: json['edition'] as String?,
    publisher: json['publisher'] as String?,
    isbn: json['isbn'] as String?,
    language: json['language']! as String,
    categories: [
      for (final c in json['categories']! as List)
        LibraryCategory.parse(c as String),
    ],
    topics: _strings(json['topics'], 'topics'),
    providedBy: json['provided_by'] as String?,
    receivedAt: json['received_at'] as String?,
    importState: ImportState.parse(json['import_state']! as String),
    rights: RightsRecord.fromJson(
      (json['rights'] as Map?)?.cast<String, Object?>(),
    ),
    supersedes: json['supersedes'] as String?,
    filePack: json['file_pack'] == null
        ? null
        : FilePackRef.fromJson(
            (json['file_pack']! as Map).cast<String, Object?>(),
          ),
    url: json['url'] as String?,
    licence: json['licence'] as String?,
    access: LibraryAccess.parse(json['access'] as String? ?? 'catalog_only'),
    accessed: json['accessed'] as String?,
    note: json['note'] == null ? null : LocalizedText.fromJson(json['note']),
  );

  final String id;
  final LibraryItemKind kind;
  final String title;
  final List<String> authors;
  final int? year;
  final String? edition;
  final String? publisher;
  final String? isbn;

  /// Asl til kodi (uz, ru, en...).
  final String language;
  final List<LibraryCategory> categories;

  /// Guruh, analit yoki dars mavzusi id lari.
  final List<String> topics;

  /// Masalan, `teacher` (domla), `user`, `publisher`.
  final String? providedBy;
  final String? receivedAt;
  final ImportState importState;
  final RightsRecord rights;

  /// Shu materialning eski nashri (yangi/eski farqlarini kuzatish uchun).
  final String? supersedes;

  /// To'liq matn alohida oflayn paket sifatida (faqat ruxsat qayd etilgan
  /// bo'lsa).
  final FilePackRef? filePack;

  /// Rasmiy sahifa (o'qish yoki yozuvni ko'rish uchun).
  final String? url;

  /// Sahifada ko'rsatilgan litsenziya nomi (masalan, “CC BY 4.0”).
  final String? licence;
  final LibraryAccess access;

  /// Sahifa va litsenziya tekshirilgan sana.
  final String? accessed;

  /// Nega foydali — qisqa izoh (3 tilda).
  final LocalizedText? note;
}

/// Dars mavzusi: analitlar, savollar va manbalarni bog'laydi.
@immutable
class Lesson {
  const Lesson({
    required this.id,
    required this.title,
    required this.analyteIds,
    required this.quizIds,
    required this.refs,
    required this.reviewState,
    this.groupId,
  });

  factory Lesson.fromJson(Map<String, Object?> json) => Lesson(
    id: json['id']! as String,
    title: LocalizedText.fromJson(json['title']),
    groupId: json['group'] as String?,
    analyteIds: _strings(json['analyte_ids'], 'analyte_ids'),
    quizIds: _strings(json['quiz_ids'], 'quiz_ids'),
    refs: SourceRef.listFromJson(json),
    reviewState: ReviewState.parse(
      json['review_state'] as String? ?? 'pending',
    ),
  );

  final String id;
  final LocalizedText title;
  final String? groupId;
  final List<String> analyteIds;
  final List<String> quizIds;
  final List<SourceRef> refs;
  final ReviewState reviewState;
}

/// Bitta manbadagi pozitsiya (qiymat yoki da'vo).
@immutable
class DiscrepancyPosition {
  const DiscrepancyPosition({required this.ref, required this.statement});

  factory DiscrepancyPosition.fromJson(Map<String, Object?> json) =>
      DiscrepancyPosition(
        ref: SourceRef.fromJson(json),
        statement: json['statement']! as String,
      );

  final SourceRef ref;

  /// Manbada aynan nima deyilgani (asl tilda, tarjimasiz).
  final String statement;
}

/// Eski va yangi (yoki ikki turli) manba bir-biriga zid bo'lgan holat.
/// Hal qilinmaguncha hech biri "fakt" sifatida nashr etilmaydi — domla
/// (tekshiruvchi) qarori kutiladi.
@immutable
class Discrepancy {
  const Discrepancy({
    required this.id,
    required this.subjectId,
    required this.field,
    required this.positions,
    required this.resolved,
    this.resolutionNote,
    this.reviewerId,
    this.resolvedAt,
  });

  factory Discrepancy.fromJson(Map<String, Object?> json) {
    final resolution = (json['resolution'] as Map?)?.cast<String, Object?>();
    return Discrepancy(
      id: json['id']! as String,
      subjectId: json['subject_id']! as String,
      field: json['field']! as String,
      positions: [
        for (final p in json['positions']! as List)
          DiscrepancyPosition.fromJson((p as Map).cast<String, Object?>()),
      ],
      resolved: (json['status'] as String? ?? 'open') == 'resolved',
      resolutionNote: resolution?['note'] as String?,
      reviewerId: resolution?['reviewer_id'] as String?,
      resolvedAt: resolution?['resolved_at'] as String?,
    );
  }

  final String id;

  /// Analit, dars yoki savol id si.
  final String subjectId;

  /// Masalan, `decision_limits`, `reference_intervals`, `method`.
  final String field;
  final List<DiscrepancyPosition> positions;
  final bool resolved;
  final String? resolutionNote;
  final String? reviewerId;
  final String? resolvedAt;
}

/// Tasdiqlangan IFU yozuvi. Bu buildda katalog bo'sh: parametrlar faqat
/// haqiqiy IFU bilan solishtirilgandan keyin qo'shiladi.
@immutable
class IfuRecord {
  const IfuRecord({required this.binding, required this.analyteId});

  factory IfuRecord.fromJson(Map<String, Object?> json) => IfuRecord(
    binding: InstrumentBinding.fromJson(
      (json['binding']! as Map).cast<String, Object?>(),
    ),
    analyteId: json['analyte_id']! as String,
  );

  final InstrumentBinding binding;
  final String analyteId;
}

@immutable
class ContentPack {
  const ContentPack({
    required this.packId,
    required this.schemaVersion,
    required this.contentVersion,
    required this.groups,
    required this.analytes,
    required this.sources,
    required this.quiz,
    required this.ifuRecords,
    this.library = const [],
    this.lessons = const [],
    this.discrepancies = const [],
  });

  factory ContentPack.fromJson(Map<String, Object?> json) {
    final pack = ContentPack(
      packId: json['pack_id']! as String,
      schemaVersion: json['schema_version']! as int,
      contentVersion: json['content_version']! as String,
      groups: [
        for (final g in json['groups']! as List)
          AnalyteGroup.fromJson((g as Map).cast<String, Object?>()),
      ],
      analytes: [
        for (final a in json['analytes']! as List)
          Analyte.fromJson((a as Map).cast<String, Object?>()),
      ],
      sources: [
        for (final s in json['sources']! as List)
          ContentSource.fromJson((s as Map).cast<String, Object?>()),
      ],
      quiz: [
        for (final q in json['quiz'] as List? ?? const [])
          QuizQuestion.fromJson((q as Map).cast<String, Object?>()),
      ],
      ifuRecords: [
        for (final r in json['ifu_records'] as List? ?? const [])
          IfuRecord.fromJson((r as Map).cast<String, Object?>()),
      ],
      library: [
        for (final i in json['library'] as List? ?? const [])
          LibraryItem.fromJson((i as Map).cast<String, Object?>()),
      ],
      lessons: [
        for (final i in json['lessons'] as List? ?? const [])
          Lesson.fromJson((i as Map).cast<String, Object?>()),
      ],
      discrepancies: [
        for (final i in json['discrepancies'] as List? ?? const [])
          Discrepancy.fromJson((i as Map).cast<String, Object?>()),
      ],
    );
    pack._validateReferences();
    return pack;
  }

  final String packId;
  final int schemaVersion;
  final String contentVersion;
  final List<AnalyteGroup> groups;
  final List<Analyte> analytes;
  final List<ContentSource> sources;
  final List<QuizQuestion> quiz;
  final List<IfuRecord> ifuRecords;

  /// Kitoblar, qo'llanmalar, metodikalar katalogi.
  final List<LibraryItem> library;

  /// Dars mavzulari (analit, savol va manbalarni bog'laydi).
  final List<Lesson> lessons;

  /// Manbalar orasidagi farqlar — tekshiruvchi uchun navbat.
  final List<Discrepancy> discrepancies;

  LibraryItem? libraryItem(String id) =>
      library.where((i) => i.id == id).firstOrNull;

  List<Discrepancy> get openDiscrepancies =>
      discrepancies.where((d) => !d.resolved).toList(growable: false);

  Analyte? analyte(String id) => analytes.where((a) => a.id == id).firstOrNull;

  ContentSource? source(String id) =>
      sources.where((s) => s.id == id).firstOrNull;

  AnalyteGroup? group(String id) => groups.where((g) => g.id == id).firstOrNull;

  /// Kontent yaxlitligi: har bir da'vo mavjud manbaga, har bir analit
  /// mavjud guruhga bog'langan; tekshirilmagan karta "reviewed" emas.
  void _validateReferences() {
    Set<String> unique(Iterable<String> ids, String what) {
      final seen = <String>{};
      for (final id in ids) {
        if (!seen.add(id)) throw FormatException('duplicate $what id $id');
      }
      return seen;
    }

    final sourceIds = unique(sources.map((s) => s.id), 'source');
    final groupIds = unique(groups.map((g) => g.id), 'group');
    unique(quiz.map((q) => q.id), 'quiz');
    unique(lessons.map((l) => l.id), 'lesson');
    final analyteIds = <String>{};
    for (final a in analytes) {
      if (!analyteIds.add(a.id)) {
        throw FormatException('duplicate analyte id ${a.id}');
      }
      if (!groupIds.contains(a.group)) {
        throw FormatException('${a.id}: unknown group ${a.group}');
      }
      // Kartadagi manbalar ro'yxati: har biri mavjud, takrorlanmaydi va
      // kamida bitta da'vo/chegara/interval tomonidan keltiriladi; har bir
      // iqtibos shu ro'yxatda (aks holda raqam “[0]” bo'lib chiqardi).
      final listed = <String>{};
      for (final id in a.sourceIds) {
        if (!sourceIds.contains(id)) {
          throw FormatException('${a.id}: unknown source $id');
        }
        if (!listed.add(id)) {
          throw FormatException('${a.id}: duplicate source $id');
        }
      }
      final cited = <String>{};
      void cite(List<String> ids, String what) {
        if (ids.isEmpty) throw FormatException('${a.id}: $what without source');
        for (final id in ids) {
          if (!listed.contains(id)) {
            throw FormatException('${a.id}: $what cites unlisted source $id');
          }
          cited.add(id);
        }
      }

      for (final c in a.claims) {
        cite(c.sourceIds, 'claim');
        if (!a.sections.contains(c.section)) {
          throw FormatException(
            '${a.id}: claim in unknown section ${c.section}',
          );
        }
      }
      for (final d in a.decisionLimits) {
        cite(d.sourceIds, 'decision limit');
        _checkBounds(a.id, d.low, d.high);
      }
      for (final r in a.referenceIntervals) {
        cite(r.sourceIds, 'reference interval');
        _checkBounds(a.id, r.low, r.high);
      }
      final uncited = listed.difference(cited);
      if (a.contentState != ContentState.structureOnly && uncited.isNotEmpty) {
        throw FormatException('${a.id}: listed but never cited: $uncited');
      }
      if (a.related.contains(a.id) ||
          a.related.toSet().length != a.related.length) {
        throw FormatException('${a.id}: self or duplicate related');
      }
      if (a.reviewState == ReviewState.approved && a.reviewedAt == null) {
        throw FormatException('${a.id}: approved without reviewed_at');
      }
      if (a.contentState == ContentState.structureOnly &&
          (a.claims.isNotEmpty || a.decisionLimits.isNotEmpty)) {
        throw FormatException('${a.id}: structure-only card has claims');
      }
      if (a.contentState == ContentState.reviewed && !a.isReviewerApproved) {
        throw FormatException('${a.id}: reviewed without approved reviewer');
      }
      if (a.status == ContentStatus.published && !a.isReviewerApproved) {
        throw FormatException('${a.id}: published without review');
      }
    }
    for (final a in analytes) {
      for (final r in a.related) {
        if (!analyteIds.contains(r)) {
          throw FormatException('${a.id}: unknown related $r');
        }
      }
    }
    for (final q in quiz) {
      for (final id in q.sourceIds) {
        if (!sourceIds.contains(id)) {
          throw FormatException('${q.id}: unknown source $id');
        }
      }
      if (!q.isDraft && q.refs.isEmpty) {
        throw FormatException('${q.id}: approved question without source');
      }
      if (q.options.length < 2) {
        throw FormatException('${q.id}: needs at least two options');
      }
      // Mavzu — analit yoki guruh (mashq shu bo'yicha tanlaydi).
      for (final t in q.topicIds) {
        if (!analyteIds.contains(t) && !groupIds.contains(t)) {
          throw FormatException('${q.id}: topic $t is not an analyte or group');
        }
      }
    }
    _validateLibrary(
      sourceIds: sourceIds,
      groupIds: groupIds,
      analyteIds: analyteIds,
    );
  }

  static void _checkBounds(String id, double? low, double? high) {
    if (low == null && high == null) {
      throw FormatException('$id: limit without bounds');
    }
    if (low != null && high != null && low > high) {
      throw FormatException('$id: low > high ($low > $high)');
    }
  }

  void _validateLibrary({
    required Set<String> sourceIds,
    required Set<String> groupIds,
    required Set<String> analyteIds,
  }) {
    final libraryIds = <String>{};
    for (final item in library) {
      if (!libraryIds.add(item.id)) {
        throw FormatException('duplicate library item ${item.id}');
      }
    }
    final lessonIds = {for (final l in lessons) l.id};
    final quizIds = {for (final q in quiz) q.id};
    final topicIds = {...groupIds, ...analyteIds, ...lessonIds};
    for (final item in library) {
      if (item.categories.isEmpty) {
        throw FormatException('${item.id}: no category');
      }
      for (final t in item.topics) {
        if (!topicIds.contains(t)) {
          throw FormatException('${item.id}: unknown topic $t');
        }
      }
      if (item.supersedes != null && !libraryIds.contains(item.supersedes)) {
        throw FormatException(
          '${item.id}: unknown supersedes ${item.supersedes}',
        );
      }
      // To'liq matnni umumiy kutubxonaga faqat tarqatish ruxsati qayd
      // etilgandan keyin qo'yish mumkin.
      if (item.filePack != null && !item.rights.allowsSharedPack) {
        throw FormatException('${item.id}: file pack without recorded rights');
      }
      if (item.filePack != null && !item.importState.citable) {
        throw FormatException('${item.id}: file pack for unprocessed item');
      }
      // Ochiq litsenziya — litsenziya nomi va sahifa bilan; bepul o'qish —
      // sahifa havolasi bilan.
      if (item.access == LibraryAccess.openLicence &&
          (item.licence == null || item.url == null || item.accessed == null)) {
        throw FormatException('${item.id}: open licence without evidence');
      }
      if (item.access == LibraryAccess.freeToRead && item.url == null) {
        throw FormatException('${item.id}: free-to-read item without url');
      }
    }
    for (final s in sources) {
      final itemId = s.libraryItemId;
      if (itemId == null) continue;
      final item = libraryItem(itemId);
      if (item == null) {
        throw FormatException('${s.id}: unknown library item $itemId');
      }
      // Kelmagan yoki kataloglanmagan materialdan iqtibos keltirilmaydi.
      if (!item.importState.citable) {
        throw FormatException(
          '${s.id}: cites ${item.id} (${item.importState.key})',
        );
      }
    }
    for (final lesson in lessons) {
      if (lesson.groupId != null && !groupIds.contains(lesson.groupId)) {
        throw FormatException('${lesson.id}: unknown group ${lesson.groupId}');
      }
      for (final a in lesson.analyteIds) {
        if (!analyteIds.contains(a)) {
          throw FormatException('${lesson.id}: unknown analyte $a');
        }
      }
      for (final q in lesson.quizIds) {
        if (!quizIds.contains(q)) {
          throw FormatException('${lesson.id}: unknown question $q');
        }
      }
      for (final r in lesson.refs) {
        if (!sourceIds.contains(r.sourceId)) {
          throw FormatException('${lesson.id}: unknown source ${r.sourceId}');
        }
      }
    }
    for (final d in discrepancies) {
      if (d.positions.length < 2) {
        throw FormatException('${d.id}: needs at least two positions');
      }
      if (!topicIds.contains(d.subjectId) && !quizIds.contains(d.subjectId)) {
        throw FormatException('${d.id}: unknown subject ${d.subjectId}');
      }
      for (final p in d.positions) {
        if (!sourceIds.contains(p.ref.sourceId)) {
          throw FormatException('${d.id}: unknown source ${p.ref.sourceId}');
        }
      }
      if (d.resolved && (d.reviewerId == null || d.resolutionNote == null)) {
        throw FormatException('${d.id}: resolved without reviewer and note');
      }
    }
  }
}

/// JSON satrlar ro'yxati — darhol tekshiriladi (`cast` dangasa: buzuq
/// element paket qabul qilingandan keyin, ekran qurilayotganda yiqitardi).
List<String> _strings(Object? raw, String field) {
  if (raw == null) return const [];
  if (raw is! List) throw FormatException('$field: expected a list');
  return List.unmodifiable([
    for (final v in raw)
      if (v is String) v else throw FormatException('$field: not a string: $v'),
  ]);
}
