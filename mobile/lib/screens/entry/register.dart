import 'package:flutter/services.dart'
    show FilteringTextInputFormatter, TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
import '../../design/components/surface.dart';
import '../../design/components/states.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import 'verify_email.dart';

/// RO'YXATDAN O'TISH — avval profil turi, keyin ism, email,
/// telefon, parol.
///
/// PROFIL TURI BIRINCHI QADAMDA — SAYTDAGIDEK. Saytda odam
/// "Men" yoki "Kompaniya profili" ni formani ochishdan OLDIN
/// tanlaydi. Ilovada bu savol ilgari oxirida, tasdiqlashdan keyin
/// chiqardi: odam formani to'ldirib bo'lgach "nima ochayotganini"
/// bilib olardi. Endi tartib sayt bilan bir xil.
///
/// TANLOV NIMANI HAL QILADI: server `/api/auth/register` da profil
/// turini QABUL QILMAYDI — u har doim shaxsiy 8 xonali bepul ID
/// yaratadi. Shuning uchun tanlov faqat KEYINGI QADAMNI belgilaydi:
/// kompaniya → Company ID ochish oqimi, shaxsiy → kabinet. Soxta
/// tanlov ko'rsatilmaydi va bu matn ekranda ham yozilgan.
///
/// Maydonlar backend'dagi HAQIQIY maydonlar. Telefon KONTAKT
/// ma'lumoti sifatida olinadi, tasdiqlash uchun emas: hisob EMAIL
/// orqali tasdiqlanadi. Shuning uchun email maydonining ostida
/// "KOD SHU MANZILGA" deb yozilgan — odam kodni qayerdan
/// kutishini FORMANI TO'LDIRAYOTGANDA biladi, keyingi ekranda
/// emas.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

/// Profil turi — faqat ro'yxatdan o'tishdan keyingi yo'lni
/// belgilaydi (server hisob turini bilmaydi).
enum RegKind { personal, company }

class _RegisterScreenState extends State<RegisterScreen> {
  /// `null` — hali tanlanmagan: birinchi qadam ko'rinadi.
  RegKind? _kind;

  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();

  /// PAROLNI TAKRORLASH.
  ///
  /// Parol yopiq yoziladi va odam nima yozganini KO'RMAYDI. Bitta
  /// maydon bo'lsa, xato bosilgan bitta harf keyin faqat kirish
  /// paytida — parolni tiklash orqali — aniqlanardi. Ikkinchi
  /// maydon shu xatoni yozilayotgan paytida ushlaydi.
  final _password2 = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    _password2.dispose();
    super.dispose();
  }

  static final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

  Future<void> _submit() async {
    final email = _email.text.trim().toLowerCase();
    final phone = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (!_emailRe.hasMatch(email)) {
      setState(() => _error = tr('Email manzilini tekshiring.'));
      return;
    }
    if (phone.length < 9) {
      setState(() => _error = tr('Telefon raqamini to‘liq kiriting.'));
      return;
    }
    if (_password.text.length < 8) {
      setState(() => _error = tr('Parol kamida 8 belgi bo‘lsin.'));
      return;
    }
    if (_password2.text != _password.text) {
      setState(() => _error = tr('Parollar bir xil emas. Qaytadan kiriting.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });

    final state = AppScope.read(context);
    try {
      // Kod yuborish — javobdagi `channel` qaysi kanal ishlaganini
      // aytadi. `none` bo'lsa xizmat o'chirilgan: bu holatda soxta
      // "kod yuborildi" ekraniga O'TMAYMIZ.
      final channel = await state.repo.requestRegisterCode(
        email: email,
        phone: '+998$phone',
      );
      if (!mounted) return;
      if (channel == 'none') {
        setState(() => _error =
            tr('Hozir emailga kod yuborib bo‘lmayapti. Birozdan so‘ng qayta urining.'));
        return;
      }
      await push(context, (_) => VerifyEmailScreen(
            email: email,
            phone: '+998$phone',
            password: _password.text,
            name: _name.text.trim(),
            wantsBusiness: _kind == RegKind.company,
          ));
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// BIRINCHI QADAM — profil turi.
  ///
  /// Ikki karta, saytdagi matn bilan: "Men — Odam, mutaxassis" va
  /// "Kompaniya profili — Biznes, do'kon, restoran". Ostida esa
  /// tanlov NIMANI o'zgartirishi ochiq yozilgan: hisob bitta,
  /// farq faqat keyingi qadamda. Bu yashirilsa, odam "kompaniya
  /// hisobi" ochdim deb o'ylaydi va keyin kabinetni topa olmaydi.
  Widget _kindStep() => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, S.x32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _KindCard(
              icon: Ico.user,
              title: tr('Men'),
              subtitle: tr('Odam, mutaxassis'),
              detail: tr('Ism, kasb, kontaktlar, havolalar, story va postlar. '
                  'Bepul 8 xonali ID darhol beriladi.'),
              onTap: () => setState(() => _kind = RegKind.personal),
            ),
            const SizedBox(height: S.x12),
            _KindCard(
              icon: Ico.building,
              title: tr('Kompaniya profili'),
              subtitle: tr('Biznes, do‘kon, restoran'),
              detail: tr('Katalog, narxlar, galereya, ish vaqti, xarita va '
                  'buyurtmalar. Avval hisob ochiladi, so‘ng Company ID.'),
              onTap: () => setState(() => _kind = RegKind.company),
            ),
            const SizedBox(height: S.x20),
            Text(
              tr('Hisob bitta — shaxsiy va kompaniya profillarini keyin '
                  'ikkalasini ham qo‘shsangiz bo‘ladi.'),
              textAlign: TextAlign.center,
              style: T.caption.copyWith(color: C.ink3, fontSize: 12.5),
            ),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.none,
        child: SafeArea(
          child: Padding(
            // Asosiy tugma klaviatura ostida qolmasligi uchun.
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TopBar(
                  // Forma ochilganda "orqaga" — turni qayta tanlashga
                  // qaytaradi, ekrandan chiqib ketmaydi.
                  onBack: _kind == null
                      ? null
                      : () => setState(() {
                            _kind = null;
                            _error = null;
                          }),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_kind == null)
                          ScreenTitle(
                            tr('Qanday profil ochasiz?'),
                            subtitle: tr('Keyin ikkalasini ham qo‘shishingiz '
                                'mumkin — tanlov faqat birinchi qadamni '
                                'belgilaydi.'),
                          )
                        else
                          ScreenTitle(
                            tr('Ro‘yxatdan o‘tish'),
                            subtitle: tr('Tasdiqlash kodi emailga yuboriladi. '
                                'Telefon raqami profil aloqasi uchun '
                                'saqlanadi.'),
                          ),
                        if (_kind == null)
                          _kindStep()
                        else
                          Padding(
                          padding: const EdgeInsets.fromLTRB(
                            S.gutter,
                            S.x8,
                            S.gutter,
                            S.x32,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Field(
                                label: tr('Ism va familiya'),
                                controller: _name,
                                hint: tr('Ismingiz'),
                                keyboardType: TextInputType.name,
                                textInputAction: TextInputAction.next,
                              ),
                              const SizedBox(height: S.x16),
                              Field(
                                label: tr('Email'),
                                controller: _email,
                                hint: 'ism@gmail.com',
                                helper: tr('KOD SHU MANZILGA'),
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                              ),
                              const SizedBox(height: S.x16),
                              Field(
                                label: tr('Telefon'),
                                controller: _phone,
                                hint: '90 123 45 67',
                                prefix: '+998',
                                helper: tr('Raqamni keyin Sozlamalarda Telegram '
                                    'botga ulaysiz — parolni tiklashda kerak '
                                    'bo‘ladi'),
                                keyboardType: TextInputType.phone,
                                textInputAction: TextInputAction.next,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                              ),
                              const SizedBox(height: S.x16),
                              Field(
                                label: tr('Parol'),
                                controller: _password,
                                hint: '••••••••',
                                obscure: true,
                                helper: tr('Kamida 8 belgi'),
                                keyboardType: TextInputType.visiblePassword,
                                textInputAction: TextInputAction.next,
                              ),
                              const SizedBox(height: S.x16),
                              Field(
                                label: tr('Parolni takrorlang'),
                                controller: _password2,
                                hint: '••••••••',
                                obscure: true,
                                keyboardType: TextInputType.visiblePassword,
                                textInputAction: TextInputAction.done,
                                onSubmitted: (_) => _submit(),
                                // XATO SHU YERDA CHIQADI: oxirgi maydon
                                // — tugmaga eng yaqin joy, ya'ni odam
                                // uni ko'rmasdan bosib yuborolmaydi.
                                error: _error,
                              ),
                              const SizedBox(height: S.x24),
                              PrimaryButton(
                                tr('Kodni emailga yuborish'),
                                loading: _busy,
                                onTap: _busy ? null : _submit,
                              ),
                              const SizedBox(height: S.x16),
                              Text(
                                tr('Ro‘yxatdan o‘tganda bepul 8 xonali ID beriladi'),
                                textAlign: TextAlign.center,
                                style: T.caption
                                    .copyWith(color: C.ink3, fontSize: 12.5),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

/// PROFIL TURI KARTASI — birinchi qadamdagi ikki tanlovdan biri.
///
/// Ikonka + nom + bir qatorli izoh + tafsilot. Tafsilot bor, chunki
/// "Men" va "Kompaniya" nomlarining o'zi nima ochilishini aytmaydi:
/// odam nimani olishini KO'RIB tanlashi kerak.
class _KindCard extends StatelessWidget {
  const _KindCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.detail,
    required this.onTap,
  });

  final Ico icon;
  final String title;
  final String subtitle;
  final String detail;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        child: Surface(
          padding: const EdgeInsets.all(S.x16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: C.accent.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(R.tile),
                ),
                alignment: Alignment.center,
                child: NIcon(icon, size: 22, color: C.accent),
              ),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: T.cardTitle),
                    const SizedBox(height: 2),
                    Text(subtitle, style: T.caption.copyWith(color: C.accent)),
                    const SizedBox(height: S.x8),
                    Text(detail, style: T.caption.copyWith(color: C.ink3)),
                  ],
                ),
              ),
              const SizedBox(width: S.x8),
              Padding(
                padding: const EdgeInsets.only(top: S.x12),
                child: NIcon(Ico.chevronRight, size: 18, color: C.ink3),
              ),
            ],
          ),
        ),
      );
}
