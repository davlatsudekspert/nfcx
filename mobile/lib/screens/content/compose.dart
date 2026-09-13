import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';

import '../../data/api_client.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// Nima yaratilyapti.
enum ComposeKind { post, story }

/// POST / STORY YARATISH.
///
/// NIMA UCHUN BITTA EKRAN: ikkalasining oqimi bir xil — rasm tanlash,
/// izoh, joylash. Farqi faqat qaysi endpointga borishi va istoryada
/// kontent qoidalariga rozilik so'ralishi. Ikkita deyarli bir xil
/// ekran yozish ularning vaqt o'tib bir-biridan uzoqlashishiga olib
/// kelardi.
///
/// TARIF CHEKLOVI SERVERDA: `feature_locked` va `limit_reached`
/// javoblarini ilova O'ZI oldindan taxmin qilmaydi — narx va tarif
/// qoidalari bitta joyda, serverda turishi kerak.
class ComposeScreen extends StatefulWidget {
  const ComposeScreen({
    super.key,
    required this.code,
    required this.kind,
    this.company = false,
  });

  /// Shaxsiy ID kodi yoki Company ID.
  final String code;
  final ComposeKind kind;

  /// Biznes profili uchunmi.
  ///
  /// Oqim AYNAN bir xil — faqat so'rov boshqa endpointga ketadi.
  /// Ikkita alohida ekran yozish ularning vaqt o'tib bir-biridan
  /// uzoqlashishiga olib kelardi.
  final bool company;

  @override
  State<ComposeScreen> createState() => _ComposeScreenState();
}

class _ComposeScreenState extends State<ComposeScreen> {
  final _caption = TextEditingController();
  final _picker = ImagePicker();

  Uint8List? _bytes;
  String _name = '';
  bool _agreed = false;
  bool _busy = false;
  String? _error;

  bool get _isStory => widget.kind == ComposeKind.story;

  @override
  void dispose() {
    _caption.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    setState(() => _error = null);
    try {
      // O'LCHAM SHU YERDA CHEGARALANADI: zamonaviy telefon 4000px
      // rasm beradi — u ~10 MB va mobil internetda bir daqiqa
      // yuklanadi, holbuki ekranda 1080px dan ortig'i ko'rinmaydi.
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 88,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _bytes = bytes;
        _name = file.name;
      });
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    }
  }

  Future<void> _submit() async {
    final bytes = _bytes;
    if (bytes == null) {
      setState(() => _error = 'Avval rasm tanlang.');
      return;
    }
    if (_isStory && !_agreed) {
      setState(() => _error = 'Kontent qoidalariga rozilik bering.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final repo = AppScope.read(context).repo;
      final url = await repo.uploadMedia(bytes, contentType: _mime(_name));
      final caption = _caption.text.trim();
      if (widget.company) {
        if (_isStory) {
          await repo.addCompanyStory(widget.code,
              imageUrl: url, caption: caption, agreed: _agreed);
        } else {
          await repo.addCompanyPost(widget.code, imageUrl: url, caption: caption);
        }
      } else {
        if (_isStory) {
          await repo.addStory(widget.code,
              imageUrl: url, caption: caption, agreed: _agreed);
        } else {
          await repo.addPost(widget.code, imageUrl: url, caption: caption);
        }
      }
      successHaptic();
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = _composeError(e));
    } catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Server kalitlarini o'zbekcha jumlaga aylantirish.
  ///
  /// `feature_locked` va `limit_reached` — bular xato emas, TARIF
  /// chegarasi. Odam nima qilishini bilishi kerak, "xato" degan
  /// umumiy yozuv esa hech narsa aytmaydi.
  String _composeError(ApiError e) => switch (e.key) {
        'feature_locked' => _isStory
            ? 'Istorya yuqoriroq tarifda ochiladi.'
            : 'Post yuqoriroq tarifda ochiladi.',
        'limit_reached' => 'Post chegarasiga yetdingiz.',
        // Biznesda bepul tarifda post va istorya yopiq.
        'plan_locked' => 'Bepul tarifda post va story yopiq.',
        'rules_not_accepted' => 'Kontent qoidalariga rozilik bering.',
        'too_large' => 'Rasm juda katta.',
        'bad_image' => 'Bu fayl rasm emas.',
        'not_owner' => 'Bu ID sizga tegishli emas.',
        'too_many_requests' => 'Juda ko‘p urinish. Birozdan keyin qayta urining.',
        _ => humanError(e),
      };

  static String _mime(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic';
    return 'image/jpeg';
  }

  @override
  Widget build(BuildContext context) {
    final bytes = _bytes;

    return SafeArea(
      child: Column(
        children: [
          TopBar(title: _isStory ? 'Yangi istorya' : 'Yangi post'),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
              children: [
                // RASM O'RNI — nisbat turiga mos: post 4:5, istorya 9:16.
                AspectRatio(
                  aspectRatio: _isStory ? 9 / 16 : 4 / 5,
                  child: Press(
                    onTap: _busy ? null : () => _pick(ImageSource.gallery),
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(R.card),
                        color: C.placeholder,
                        border: Border.all(color: C.warmHairline),
                      ),
                      clipBehavior: Clip.antiAlias,
                      alignment: Alignment.center,
                      child: bytes == null
                          ? Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const NIcon(Ico.image, size: 30, color: C.champagne),
                                const SizedBox(height: S.x12),
                                Text('Rasm tanlash', style: T.cardTitle),
                                const SizedBox(height: 3),
                                Text('Galereyadan', style: T.caption),
                              ],
                            )
                          : Image.memory(
                              bytes,
                              fit: BoxFit.cover,
                              // XOTIRA CHEGARASI. `Image.memory` rasmni
                              // TABIIY o'lchamida dekodlaydi: 1600×1600
                              // JPEG xom holda ~10 MB oladi, holbuki
                              // ekranda ~380px ko'rinadi. Chegarasiz
                              // zaif telefonda bu kadr tushishi va
                              // ba'zan yiqilishga olib keladi.
                              cacheWidth:
                                  (MediaQuery.sizeOf(context).width *
                                          MediaQuery.devicePixelRatioOf(context))
                                      .round(),
                            ),
                    ),
                  ),
                ),
                const SizedBox(height: S.x12),
                Row(
                  children: [
                    Expanded(
                      child: SecondaryButton(
                        bytes == null ? 'Galereya' : 'Boshqasi',
                        icon: const NIcon(Ico.image, size: 17, color: C.platinum),
                        height: 46,
                        onTap: _busy ? null : () => _pick(ImageSource.gallery),
                      ),
                    ),
                    const SizedBox(width: S.x8),
                    Expanded(
                      child: SecondaryButton(
                        'Kamera',
                        icon: const NIcon(Ico.camera, size: 17, color: C.platinum),
                        height: 46,
                        onTap: _busy ? null : () => _pick(ImageSource.camera),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: S.x20),
                Field(
                  label: 'Izoh',
                  controller: _caption,
                  hint: 'Ixtiyoriy',
                  maxLines: 4,
                ),
                if (_isStory) ...[
                  const SizedBox(height: S.x16),
                  _Rules(
                    value: _agreed,
                    onChanged: _busy ? null : (v) => setState(() => _agreed = v),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: S.x16),
                  Text(_error!, style: T.caption.copyWith(color: C.signal)),
                ],
                const SizedBox(height: S.x20),
                PrimaryButton(
                  _isStory ? 'Istoryani joylash' : 'Postni joylash',
                  loading: _busy,
                  onTap: _busy ? null : _submit,
                ),
                if (_isStory) ...[
                  const SizedBox(height: S.x12),
                  Text('Istorya 24 soatdan keyin o‘zi o‘chadi.',
                      textAlign: TextAlign.center, style: T.caption),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// KONTENT QOIDALARIGA ROZILIK.
///
/// Server buni `agreed` maydoni orqali TALAB QILADI. Ilova uni
/// avtomatik `true` qilib yuborishi mumkin edi — lekin o'shanda
/// rozilik degan narsa qolmasdi. Shuning uchun odam o'zi belgilaydi.
class _Rules extends StatelessWidget {
  const _Rules({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onChanged == null ? null : () => onChanged!(!value),
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          border: value ? C.champagne.withValues(alpha: .35) : null,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 20,
                height: 20,
                margin: const EdgeInsets.only(top: 1),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  color: value ? C.champagne : C.slate,
                  border: Border.all(color: value ? C.champagne : C.warmHairline),
                ),
                alignment: Alignment.center,
                child: value
                    ? const NIcon(Ico.check, size: 13, color: C.ink)
                    : null,
              ),
              const SizedBox(width: S.x12),
              Expanded(
                child: Text(
                  'Joylayotgan kontentim uchun javobgarlikni olaman va '
                  'u boshqalarning huquqini buzmasligini tasdiqlayman.',
                  style: T.caption,
                ),
              ),
            ],
          ),
        ),
      );
}
