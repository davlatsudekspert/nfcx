import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/media.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// PROFILNI TAHRIRLASH.
///
/// Backend `PUT /api/records/:code` da TO'LIQ yozuvni kutadi, shuning
/// uchun mavjud qiymatlar avval o'qiladi va faqat o'zgargani ustiga
/// yoziladi. Aks holda bu ekranda ko'rsatilmaydigan maydonlar
/// (mavzu, havolalar, karta dizayni) jimgina tozalanib ketardi.
///
/// RASM YUKLASH bu ekranda YO'Q: u alohida `/api/upload` oqimini va
/// galereya ruxsatlarini talab qiladi. Hozircha mavjud rasm
/// ko'rsatiladi va uni saytda o'zgartirish mumkinligi aytiladi —
/// ishlamaydigan tugma qo'yishdan ko'ra shu halolroq.
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
  late final _tg = TextEditingController(text: widget.record.tg);
  late final _website = TextEditingController(text: widget.record.website);

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _role, _about, _city, _phone, _tg, _website]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Ism bo‘sh bo‘lmasin.');
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
        'tg': _tg.text.trim().replaceAll('@', ''),
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
        'avatarUrl': r.avatarUrl ?? '',
        'bgUrl': r.bgUrl ?? '',
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
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              TopBar(
                title: 'Tahrirlash',
                trailing: _busy
                    ? const Padding(padding: EdgeInsets.all(S.x8), child: Spinner(size: 16))
                    : GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _save,
                        child: Padding(
                          padding: const EdgeInsets.all(S.x8),
                          child: Text('Saqlash',
                              style: T.button.copyWith(fontSize: 13.5, color: C.champagne)),
                        ),
                      ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                  children: [
                    Surface(
                      child: Row(
                        children: [
                          Avatar(
                            url: widget.record.avatarUrl,
                            name: widget.record.name,
                            size: 56,
                          ),
                          const SizedBox(width: S.x12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Profil rasmi', style: T.cardTitle),
                                SizedBox(height: 3),
                                Text(
                                  'Rasm va muqovani hozircha saytdan almashtirasiz.',
                                  style: T.caption,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: S.x20),
                    Field(label: 'Ism', controller: _name, hint: 'Ismingiz'),
                    const SizedBox(height: S.x16),
                    Field(label: 'Kasb · kompaniya', controller: _role, hint: 'Masalan: Founder · NFC Studio'),
                    const SizedBox(height: S.x16),
                    Field(
                      label: 'Bio',
                      controller: _about,
                      maxLines: 4,
                      maxLength: 160,
                      hint: 'O‘zingiz haqingizda qisqacha',
                    ),
                    const SizedBox(height: S.x16),
                    Field(label: 'Shahar', controller: _city, hint: 'Toshkent'),
                    const SizedBox(height: S.x16),
                    Field(
                      label: 'Telefon',
                      controller: _phone,
                      hint: '+998 90 123 45 67',
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: S.x16),
                    Field(label: 'Telegram', controller: _tg, hint: 'foydalanuvchi_nomi'),
                    const SizedBox(height: S.x16),
                    Field(
                      label: 'Veb-sayt',
                      controller: _website,
                      hint: 'sayt.uz',
                      error: _error,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}
