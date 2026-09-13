import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// FOTOGALEREYA — biznes profilidagi rasmlar to'plami.
///
/// SERVER CHEGARASI 12 TA: ortig'i jimgina kesib tashlanadi
/// (`gallery.slice(0, 12)`). Shuning uchun bu yerda ham 12 dan
/// keyin qo'shish tugmasi ko'rinmaydi — odam rasm yuklab, keyin
/// uning yo'qolganini ko'rmasin.
///
/// RASM DARHOL YUKLANADI, LEKIN GALEREYA SAQLASHDA YOZILADI:
/// yuklash sekin (fayl katta), tartib esa bir necha marta
/// o'zgarishi mumkin. Ikkalasini birga qilsak, har bir o'chirish
/// serverga so'rov bo'lardi.
class EditGalleryScreen extends StatefulWidget {
  const EditGalleryScreen({super.key, required this.company});
  final Company company;

  @override
  State<EditGalleryScreen> createState() => _EditGalleryScreenState();
}

/// Serverdagi chegara bilan bir xil bo'lishi SHART.
const _maxPhotos = 12;

class _EditGalleryScreenState extends State<EditGalleryScreen> {
  final _picker = ImagePicker();

  late final List<String> _urls = [...widget.company.gallery];

  /// Nechta rasm yuklanmoqda — panjarada shuncha "kutish" katagi
  /// ko'rsatiladi, ya'ni odam ish borayotganini ko'rib turadi.
  int _uploading = 0;
  bool _busy = false;
  String? _error;

  Future<void> _add() async {
    if (_urls.length >= _maxPhotos) return;
    setState(() => _error = null);
    try {
      // Bir nechtasini birdan tanlash — o'n ikki rasmni bittalab
      // qo'shish ma'nosiz uzoq bo'lardi.
      final files = await _picker.pickMultiImage(
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 88,
      );
      if (files.isEmpty || !mounted) return;

      // Chegaradan ortig'i OLDINDAN kesiladi: yuklab bo'lgandan
      // keyin "sig'madi" deyish vaqtni behuda sarflash bo'lardi.
      final room = _maxPhotos - _urls.length;
      final take = files.length > room ? files.sublist(0, room) : files;
      if (files.length > room) {
        setState(() => _error = trf('Galereyaga {n} tagacha rasm sig‘adi.',
            {'n': '$_maxPhotos'}));
      }

      setState(() => _uploading = take.length);
      final repo = AppScope.read(context).repo;
      for (final f in take) {
        final bytes = await f.readAsBytes();
        final url = await repo.uploadMedia(bytes, contentType: _mime(f.name));
        if (!mounted) return;
        setState(() {
          _urls.add(url);
          _uploading--;
        });
      }
      successHaptic();
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() {
          _uploading = 0;
          _error = switch (e.key) {
            'too_large' => tr('Rasm juda katta.'),
            'bad_image' => tr('Bu fayl rasm emas.'),
            'too_many_requests' =>
              tr('Juda ko‘p urinish. Birozdan keyin qayta urining.'),
            _ => humanError(e),
          };
        });
      }
    } catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() {
          _uploading = 0;
          _error = humanError(e);
        });
      }
    }
  }

  static String _mime(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic';
    return 'image/jpeg';
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final state = AppScope.read(context);
      await state.repo.updateGallery(widget.company.id, _urls);
      successHaptic();
      await state.refreshIdentities();
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canAdd = _urls.length + _uploading < _maxPhotos;

    return ColoredBox(
      color: C.obsidian,
      child: SafeArea(
        child: Column(
          children: [
            TopBar(title: tr('Galereya'), subtitle: widget.company.name),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  if (_urls.isEmpty && _uploading == 0)
                    EmptyState(
                      tr('Ish jarayoni, ichki ko‘rinish yoki mahsulot '
                          'rasmlari — mijoz sizni shu orqali tanidi.'),
                      title: tr('Galereya bo‘sh'),
                      icon: Ico.image,
                      actionLabel: tr('Rasm qo‘shish'),
                      onAction: _add,
                    )
                  else ...[
                    GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: S.x8,
                      crossAxisSpacing: S.x8,
                      children: [
                        for (var i = 0; i < _urls.length; i++)
                          _Tile(
                            url: _urls[i],
                            onRemove: () => setState(() => _urls.removeAt(i)),
                          ),
                        for (var i = 0; i < _uploading; i++) const _Pending(),
                        if (canAdd) _AddTile(onTap: _add),
                      ],
                    ),
                    const SizedBox(height: S.x12),
                    Text(
                      trf('{n} / {max} rasm.',
                          {'n': '${_urls.length}', 'max': '$_maxPhotos'}),
                      style: T.caption.copyWith(fontSize: 11),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: S.x12),
                    Text(_error!, style: T.caption.copyWith(color: C.signal)),
                  ],
                  const SizedBox(height: S.x24),
                  PrimaryButton(tr('Saqlash'),
                      loading: _busy, onTap: _busy ? null : _save),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.url, required this.onRemove});
  final String url;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    // Katak ekran enining uchdan biri — 300px dan ortig'ini
    // dekodlash behuda.
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return Stack(
      fit: StackFit.expand,
      children: [
        NetImage(url, radius: R.tile, cacheWidth: (150 * dpr).round()),
        Positioned(
          top: 4,
          right: 4,
          child: Press(
            haptic: true,
            onTap: onRemove,
            child: Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: C.backdrop.withValues(alpha: .72),
                border: Border.all(color: C.hairline),
              ),
              child: NIcon(Ico.close, size: 13, color: C.offWhite),
            ),
          ),
        ),
      ],
    );
  }
}

class _Pending extends StatelessWidget {
  const _Pending();

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: C.placeholder,
          borderRadius: BorderRadius.circular(R.tile),
          border: Border.all(color: C.warmHairline),
        ),
        child: const Center(child: Spinner(size: 18)),
      );
}

class _AddTile extends StatelessWidget {
  const _AddTile({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: C.graphite,
            borderRadius: BorderRadius.circular(R.tile),
            border: Border.all(color: C.hairline),
          ),
          child: Center(child: NIcon(Ico.plus, size: 20, color: C.champagne)),
        ),
      );
}
