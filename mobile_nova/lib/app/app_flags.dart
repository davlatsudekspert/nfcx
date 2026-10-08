import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/storage/secure_store.dart';
import '../core/utils/resume_refresher.dart';
import '../data/repositories/app_config_repository.dart';
import 'providers.dart';

export '../data/repositories/app_config_repository.dart' show AppFlags;

/// Server kalitlari ilova fondan qaytganda shundan tez-tez so'ralmaydi
/// (server o'zi ham ~60 s keshlaydi).
const kAppFlagsResumeGap = Duration(seconds: 60);

@visibleForTesting
DateTime Function() appFlagsResumeClock = DateTime.now;

/// SERVER KALITLARI — ilova bo'ylab bitta holat.
///
/// * Boshlanishda — telefonda saqlangan oxirgi javob (bo'lmasa hammasi
///   o'chiq, [AppFlags.off]).
/// * [refresh] muvaffaqiyatli bo'lsa — yangi qiymat va u saqlanadi.
/// * Xato (tarmoq yo'q, eski server 404, buzuq javob) — holat
///   O'ZGARMAYDI: keshdagisi yoki hammasi o'chiq. Xato hech qachon
///   kalitni yoqmaydi.
class AppFlagsController extends StateNotifier<AppFlags> {
  AppFlagsController(this._repo, this._prefs)
      : super(AppFlags.tryDecode(_prefs.appFlagsJson) ?? AppFlags.off);

  final AppConfigRepository _repo;
  final Prefs _prefs;
  Future<void>? _running;

  /// Bir vaqtda bittadan ortiq so'rov ketmaydi.
  Future<void> refresh() => _running ??= _fetch().whenComplete(() => _running = null);

  Future<void> _fetch() async {
    final res = await _repo.config();
    if (!mounted) return;
    final flags = res.valueOrNull;
    if (flags == null) return;
    state = flags;
    await _prefs.setAppFlagsJson(flags.encode());
  }
}

final appFlagsProvider =
    StateNotifierProvider<AppFlagsController, AppFlags>((ref) {
  return AppFlagsController(
    ref.watch(appConfigRepositoryProvider),
    ref.watch(prefsProvider),
  );
});

/// Ilova ochilganda va fondan qaytganda (≥ [kAppFlagsResumeGap])
/// kalitlarni yangilaydi. `NovaApp` kuzatadi.
final appFlagsWatcherProvider = Provider<void>((ref) {
  final c = ref.read(appFlagsProvider.notifier);
  c.refresh().ignore();
  final obs = ResumeRefresher(
    gap: kAppFlagsResumeGap,
    clock: () => appFlagsResumeClock(),
    onResume: () => c.refresh().ignore(),
  );
  WidgetsBinding.instance.addObserver(obs);
  ref.onDispose(() => WidgetsBinding.instance.removeObserver(obs));
});
