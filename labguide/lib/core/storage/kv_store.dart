import 'package:shared_preferences/shared_preferences.dart';

/// Maxfiy bo'lmagan lokal holat uchun kichik kalit-qiymat ombori.
///
/// UI va domen qatlamlari `shared_preferences` ga to'g'ridan-to'g'ri
/// bog'lanmaydi: testlarda [MemoryKeyValueStore], ilovada
/// [PrefsKeyValueStore] beriladi. Token va boshqa sirlar bu yerga
/// yozilmaydi (keyingi bosqich: flutter_secure_storage).
abstract interface class KeyValueStore {
  String? getString(String key);
  List<String>? getStringList(String key);
  bool? getBool(String key);
  Future<void> setString(String key, String value);
  Future<void> setStringList(String key, List<String> value);
  Future<void> setBool(String key, bool value);
  Future<void> remove(String key);
  Future<void> clear();
}

/// Ilova ishlatadigan barcha kalitlar — bitta joyda.
abstract final class StoreKeys {
  static const language = 'settings.language';
  static const themeMode = 'settings.theme';
  static const role = 'settings.role';
  static const onboarded = 'settings.onboarded';
  static const session = 'auth.session';
  static const bookmarks = 'content.bookmarks';
  static const researchQuestion = 'research.question';
  static const researchNotes = 'research.notes';
  static const lessonQuestion = 'lesson.question';
  static const lessonNotes = 'lesson.notes';
  static const qcData = 'qc.data';

  static const all = <String>{
    language,
    themeMode,
    role,
    onboarded,
    session,
    bookmarks,
    researchQuestion,
    researchNotes,
    lessonQuestion,
    lessonNotes,
    qcData,
  };
}

class PrefsKeyValueStore implements KeyValueStore {
  PrefsKeyValueStore._(this._prefs);

  final SharedPreferencesWithCache _prefs;

  static Future<PrefsKeyValueStore> open() async {
    final prefs = await SharedPreferencesWithCache.create(
      cacheOptions: const SharedPreferencesWithCacheOptions(
        allowList: StoreKeys.all,
      ),
    );
    return PrefsKeyValueStore._(prefs);
  }

  @override
  String? getString(String key) => _prefs.getString(key);

  @override
  List<String>? getStringList(String key) => _prefs.getStringList(key);

  @override
  bool? getBool(String key) => _prefs.getBool(key);

  @override
  Future<void> setString(String key, String value) =>
      _prefs.setString(key, value);

  @override
  Future<void> setStringList(String key, List<String> value) =>
      _prefs.setStringList(key, value);

  @override
  Future<void> setBool(String key, bool value) => _prefs.setBool(key, value);

  @override
  Future<void> remove(String key) => _prefs.remove(key);

  @override
  Future<void> clear() => _prefs.clear();
}

/// Testlar uchun xotiradagi ombor. [PrefsKeyValueStore] kabi faqat
/// [StoreKeys.all] dagi kalitlarni qabul qiladi — ro'yxatga qo'shilmagan
/// kalit testda darhol xato beradi (ilovada esa saqlanmay qolardi).
class MemoryKeyValueStore implements KeyValueStore {
  MemoryKeyValueStore([Map<String, Object>? initial]) : _data = {...?initial};

  final Map<String, Object> _data;

  void _check(String key) {
    if (!StoreKeys.all.contains(key)) {
      throw ArgumentError.value(key, 'key', 'not in StoreKeys.all');
    }
  }

  Map<String, Object> get snapshot => Map.unmodifiable(_data);

  @override
  String? getString(String key) => _data[key] as String?;

  @override
  List<String>? getStringList(String key) =>
      (_data[key] as List<String>?)?.toList();

  @override
  bool? getBool(String key) => _data[key] as bool?;

  @override
  Future<void> setString(String key, String value) async {
    _check(key);
    _data[key] = value;
  }

  @override
  Future<void> setStringList(String key, List<String> value) async {
    _check(key);
    _data[key] = List<String>.of(value);
  }

  @override
  Future<void> setBool(String key, bool value) async {
    _check(key);
    _data[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    _check(key);
    _data.remove(key);
  }

  @override
  Future<void> clear() async => _data.clear();
}
