import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/media_picker.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// PROFILNI TAHRIRLASH.
///
/// Backend `PUT /api/records/:code` da TO'LIQ yozuvni kutadi, shuning
/// uchun mavjud qiymatlar avval o'qiladi va faqat o'zgargani ustiga
/// yoziladi. Aks holda bu ekranda ko'rsatilmaydigan maydonlar
/// (mavzu, havolalar, karta dizayni) jimgina tozalanib ketardi.
///
/// RASM YUKLASH: avatar va muqova `MediaPickField` orqali tanlanadi
/// va DARHOL yuklanadi (`/api/upload-media`).
///
/// TELEGRAM MAYDONI HAVOLA SHAKLIDA ko'rsatiladi (`t.me/nom`), lekin
/// serverga AVVALGIDEK faqat nom yuboriladi: profil sahifasi
/// `https://t.me/<nom>` ni o'zi yig'adi va u yerga "t.me/" tushib
/// qolsa havola buzilardi.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key, required this.record});

  final Record record;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final _name = TextEditingController(text: widget.record.name);
  late final _role = TextEditingController(text: widget.record.role);
  late final _about = TextEditingController(text: widget.record.about);
  late final _city = TextEditingController(text: widget.record.city);
  late final _phone = TextEditingController(text: widget.record.phone);
  late final _tg = TextEditingController(
    text: widget.record.tg.trim().isEmpty ? '' : 't.me/${widget.record.tg.trim()}',
  );
  late final _website = TextEditingController(text: widget.record.website);

  /// Yuklangan yangi rasmlar. `null` — o'zgarmagan, ya'ni eski
  /// qiymat saqlanadi.
  String? _avatar;
  String? _bg;

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _role, _about, _city, _phone, _tg, _website]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Havoladan faqat NOMNI ajratib olish — server shuni kutadi.
  String get _tgName {
    var v = _tg.text.trim();
    if (v.isEmpty) return '';
    v = v.replaceFirst(RegExp('^https?://', caseSensitive: false), '');
    v = v.replaceFirst(RegExp(r'^(www\.)?t\.me/', caseSensitive: false), '');
    return v.replaceAll('@', '').trim();
  }

  /// Maydon xatosi — xato FAQAT rang bilan emas, jumla bilan
  /// ko'rsatiladi (`Field` buni o'zi belgi bilan chizadi).
  String? get _tgError {
    final v = _tg.text.trim();
    if (v.isEmpty) return null;
    final bare = v.replaceFirst(RegExp('^https?://', caseSensitive: false), '');
    return bare.toLowerCase().startsWith('t.me/')
        ? null
        : tr('Havola "t.me/" bilan boshlanishi kerak');
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = tr('Ism bo‘sh bo‘lmasin.'));
      return;
    }
    if (_tgError != null) {
      setState(() => _error = _tgError);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final repo = AppScope.read(context).repo;
    try {
      // MAVJUD YOZUVNI qayta o'qiymiz — ko'rsatilmaydigan maydonlar
      // saqlanib qolishi uchun (tahrirlash ochilgandan beri ular
      // boshqa qurilmada o'zgargan bo'lishi ham mumkin).
      final current = await repo.record(widget.record.code);
      await repo.updateRecord(widget.record.code, {
        ..._recordToJson(current),
        'name': _name.text.trim(),
        'role': _role.text.trim(),
        'about': _about.text.trim(),
        'city': _city.text.trim(),
        'phone': _phone.text.trim(),
        'tg': _tgName,
        'website': _website.text.trim(),
      });
      if (!mounted) return;
      await AppScope.read(context).refreshIdentities();
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Yozuvni backend kutgan shaklga qaytarish.
  Map<String, dynamic> _recordToJson(Record r) => {
        'name': r.name,
        'role': r.role,
        // Yangi rasm tanlangan bo'lsa o'sha, aks holda eskisi.
        // Server TO'LIQ yozuvni kutadi, shuning uchun bo'sh
        // qoldirib bo'lmaydi — rasm o'chib ketardi.
        'avatarUrl': _avatar ?? r.avatarUrl ?? '',
        'bgUrl': _bg ?? r.bgUrl ?? '',
        'about': r.about,
        'city': r.city,
        'address': r.address,
        'phone': r.phone,
        'email': r.email,
        'tg': r.tg,
        'instagram': r.instagram,
        'website': r.website,
        'profileType': r.profileType,
        'categorySlug': r.categorySlug,
        'extraLinks': r.extraLinks,
      };

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;
    final url = 'nfcstore.uz/${widget.record.code.toLowerCase()}';

    return ScreenBackdrop(
      // Forma — sokin ekran, nur yo'q.
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: S.x24),
                children: [
                  ScreenTitle(tr('Profilni tahrirlash')),

                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // ── RASM ────────────────────────────────
                        MediaPickField(
                          label: tr('Rasmni o‘zgartirish'),
                          repo: repo,
                          url: widget.record.avatarUrl,
                          circle: true,
                          hint: tr('Kvadrat rasm eng yaxshi ko‘rinadi.'),
                          onUploaded: (u) => setState(() => _avatar = u),
                        ),
                        const SizedBox(height: S.x24),

                        // ── ASOSIY ──────────────────────────────
                        Field(
                          label: tr('Ism va familiya'),
                          controller: _name,
                          hint: tr('Ismingiz'),
                          keyboardType: TextInputType.name,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: S.x16),
                        Field(
                          label: tr('Lavozim'),
                          controller: _role,
                          hint: tr('Masalan: Founder · NFC Studio'),
                          maxLength: 60,
                          counter: true,
                          keyboardType: TextInputType.text,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: S.x16),
                        Field(
                          label: 'Telegram',
                          controller: _tg,
                          hint: 't.me/foydalanuvchi',
                          helper: tr('Havola "t.me/" bilan boshlanishi kerak'),
                          error: _tgError,
                          keyboardType: TextInputType.url,
                          textInputAction: TextInputAction.next,
                          onChanged: (_) => setState(() {}),
                        ),
                        const SizedBox(height: S.x16),
                        Field(
                          label: tr('Haqida'),
                          controller: _about,
                          maxLines: 4,
                          maxLength: 160,
                          counter: true,
                          hint: tr('O‘zingiz haqingizda qisqacha'),
                        ),

                        const SizedBox(height: S.x32),

                        // ── ALOQA VA MUQOVA ─────────────────────
                        //
                        // Dizayn maketida bu maydonlar ko'rinmaydi,
                        // lekin ular ilovadagi YAGONA tahrirlash
                        // joyi: olib tashlansa, odam shahar yoki
                        // telefonini faqat saytdan o'zgartira olardi.
                        Eyebrow(tr('Aloqa')),
                        const SizedBox(height: S.x12),
                        Field(
                          label: tr('Shahar'),
                          controller: _city,
                          hint: tr('Toshkent'),
                          keyboardType: TextInputType.text,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: S.x16),
                        Field(
                          label: tr('Telefon'),
                          controller: _phone,
                          hint: '+998 90 123 45 67',
                          keyboardType: TextInputType.phone,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: S.x16),
                        Field(
                          label: tr('Veb-sayt'),
                          controller: _website,
                          hint: 'sayt.uz',
                          keyboardType: TextInputType.url,
                        ),
                        const SizedBox(height: S.x24),
                        MediaPickField(
                          label: tr('Muqova'),
                          repo: repo,
                          url: widget.record.bgUrl,
                          aspect: 16 / 7,
                          hint: tr('Profil tepasidagi keng rasm.'),
                          onUploaded: (u) => setState(() => _bg = u),
                        ),

                        const SizedBox(height: S.x32),

                        // ── OMMAVIY HAVOLA ──────────────────────
                        Surface(
                          padding: const EdgeInsets.symmetric(
                            horizontal: S.x16,
                            vertical: S.x12,
                          ),
                          shadow: C.e1,
                          child: Row(
                            children: [
                              NIcon(Ico.globe, size: 18, color: C.ink3),
                              const SizedBox(width: S.x12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      url,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: T.code(13),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      trf('{url} hammaga ko‘rinadi',
                                          {'url': url}),
                                      maxLines: 2,
                                      style: T.caption.copyWith(
                                        fontSize: 12.5,
                                        color: C.ink3,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        if (_error != null) ...[
                          const SizedBox(height: S.x16),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              NIcon(Ico.warning, size: 14, color: C.fail),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  _error!,
                                  style: T.caption.copyWith(
                                    color: C.fail,
                                    fontSize: 12.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            StickyBar(
              child: PrimaryButton(
                tr('Saqlash'),
                loading: _busy,
                onTap: _busy ? null : _save,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
