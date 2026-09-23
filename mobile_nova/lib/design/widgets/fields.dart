import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';

/// Yorliqli kiritish maydoni.
///
/// Yorliq maydon USTIDA turadi, ichida suzmaydi: rus tilidagi uzun
/// yorliqlar ("Повторите пароль") suzuvchi holatda maydon chegarasiga
/// urilib, kesilib qolardi.
class NovaField extends StatelessWidget {
  const NovaField({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.error,
    this.keyboardType,
    this.obscure = false,
    this.maxLines = 1,
    this.maxLength,
    this.prefix,
    this.suffix,
    this.onChanged,
    this.onSubmitted,
    this.enabled = true,
    this.autofocus = false,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
    this.technical = false,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;

  /// Tarjima QILINGAN xato matni — kalit emas.
  final String? error;
  final TextInputType? keyboardType;
  final bool obscure;
  final int maxLines;
  final int? maxLength;
  final Widget? prefix;
  final Widget? suffix;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool enabled;
  final bool autofocus;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;

  /// ID/kod kiritiladigan maydon — IBM Plex Mono. `0/O`, `1/I`
  /// chalkashmasin (egasining shrift qoidasi).
  final bool technical;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 7),
          child: Text(
            label,
            style: Theme.of(context)
                .textTheme
                .labelMedium
                ?.copyWith(color: t.text2),
          ),
        ),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscure,
          maxLines: obscure ? 1 : maxLines,
          maxLength: maxLength,
          enabled: enabled,
          autofocus: autofocus,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          inputFormatters: inputFormatters,
          textCapitalization: textCapitalization,
          style: technical
              ? AppType.monoStyle(
                  color: t.text1,
                  size: 15,
                  weight: FontWeight.w600,
                  letterSpacing: 1.6,
                )
              : TextStyle(
                  fontFamily: 'Manrope',
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: t.text1,
                ),
          decoration: InputDecoration(
            hintText: hint,
            errorText: error,
            counterText: '',
            prefixIcon: prefix,
            suffixIcon: suffix,
          ),
        ),
      ],
    );
  }
}

/// 6 xonali kod uchun maydon.
///
/// TEXNIK QAROR: oltita alohida `TextField` EMAS. Ular bilan
/// avtomatik to'ldirish (SMS/email autofill), nusxa-joylash va orqaga
/// o'chirish har bir platformada boshqacha buziladi. Bu yerda bitta
/// ko'rinmas maydon matnni oladi, ustida esa oltita quti chiziladi.
class CodeField extends StatefulWidget {
  const CodeField({
    super.key,
    required this.onCompleted,
    this.length = 6,
    this.hasError = false,
    this.enabled = true,
    this.controller,
  });

  final ValueChanged<String> onCompleted;
  final int length;
  final bool hasError;
  final bool enabled;
  final TextEditingController? controller;

  @override
  State<CodeField> createState() => _CodeFieldState();
}

class _CodeFieldState extends State<CodeField>
    with WidgetsBindingObserver {
  late final TextEditingController _c =
      widget.controller ?? TextEditingController();
  final _focus = FocusNode();

  /// Buferda topilgan kod — taklif tugmasi uchun.
  ///
  /// NIMA UCHUN AVTOMATIK QO'YILMAYDI: odam kodni nusxalamagan
  /// bo'lishi ham mumkin (buferda boshqa olti xonali son turgan
  /// bo'lsa), va maydonni o'zi to'ldirib qo'yish uni
  /// hayratlantiradi. Taklif ko'rinadi, bosish esa odamning
  /// ixtiyorida.
  String? _fromClipboard;

  @override
  void initState() {
    super.initState();
    _c.addListener(_onChange);
    WidgetsBinding.instance.addObserver(this);
    _checkClipboard();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    // TARTIB MUHIM: avval klaviatura, keyin bufer.
    //
    // `Clipboard.getData` platforma kanaliga boradi. Agar u
    // sekinlashsa, undan KEYIN turgan ish ham kechikadi. Yozish
    // imkoni — asosiy narsa, taklif esa qulaylik: shuning uchun
    // asosiy narsa birinchi qo'yiladi.
    _restoreFocus();
    // Odam pochtaga o'tib, kodni nusxalab qaytadi — taklif aynan
    // shu daqiqada kerak.
    _checkClipboard();
  }

  /// Pochtadan qaytganda klaviaturani QAYTA ochadi.
  ///
  /// HAQIQIY NOSOZLIK: odam kodni ko'rish uchun Gmail'ga o'tib
  /// qaytganida maydon fokusni yo'qotardi va klaviatura ochilmay
  /// qolardi. Ekranda oltita quti turardi, lekin raqam yozilmasdi —
  /// ilova qotib qolganday ko'rinardi. Bildirishnoma ustki
  /// lentada chiqqanda (ilovadan chiqilmaganda) hammasi ishlardi,
  /// chunki fokus yo'qolmasdi. Aynan shu farq sababni ko'rsatdi.
  ///
  /// `autofocus` bu yerda yordam bermaydi: u faqat maydon birinchi
  /// marta qurilganda ishlaydi, qaytib kirishda emas.
  ///
  /// NIMA UCHUN "fokus bormi" deb TEKSHIRILMAYDI: Android'da boshqa
  /// ilovaga o'tib qaytganda Flutter'ning fokus tuguni ko'pincha
  /// fokusni USHLAB TURADI — `hasFocus` rost qaytaradi. Lekin
  /// klaviatura bilan bog'lanish (text input connection) uzilgan
  /// bo'ladi. Ya'ni "fokus bor" degan javobga ishonib hech narsa
  /// qilmaslik — aynan nosozlikning o'zi. Shuning uchun bog'lanish
  /// har safar QAYTADAN quriladi: avval bo'shatiladi, keyingi
  /// kadrda qayta so'raladi va klaviatura ochilishi ochiq-oydin
  /// talab qilinadi.
  void _restoreFocus() {
    if (!widget.enabled) return;
    // Kod allaqachon to'liq bo'lsa, klaviaturani ochish bezovta
    // qiladi: so'rov ketayotgan bo'lishi mumkin.
    if (_c.text.length >= widget.length) return;
    // Kadrdan keyin: resume paytida Flutter fokus daraxtini hali
    // tiklab bo'lmagan bo'ladi va so'rov yo'qolib ketadi.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !widget.enabled) return;
      _focus.unfocus();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || !widget.enabled) return;
        _focus.requestFocus();
        // Ba'zi qobiqlarda (MIUI, ColorOS) fokus qaytgani bilan
        // klaviatura o'zi chiqmaydi — ochilishi alohida
        // so'raladi. Kanal javob bermasa ham ziyoni yo'q.
        SystemChannels.textInput
            .invokeMethod<void>('TextInput.show')
            .catchError((_) {});
      });
    });
  }

  /// Buferda AYNAN shu uzunlikdagi raqam bormi.
  ///
  /// NIMA UCHUN BU YERDA MUDDAT (`timeout`) YO'Q: `Clipboard.getData`
  /// Android'da platforma oqimiga boradi. Agar o'sha oqim band
  /// bo'lsa, Dart tomonidagi muddat uni BO'SHATMAYDI — ekran
  /// baribir javob bermay turardi, biz esa faqat o'zimizni
  /// aldagan bo'lardik. Shuning uchun ortiqcha chaqiruv
  /// qilinmaydi: kod allaqachon to'liq bo'lsa, bufer umuman
  /// o'qilmaydi.
  Future<void> _checkClipboard() async {
    if (!widget.enabled) return;
    if (_c.text.length >= widget.length) return;
    try {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final raw = (data?.text ?? '').trim();
      final ok = raw.length == widget.length &&
          RegExp('^[0-9]{${widget.length}}\$').hasMatch(raw);
      if (!mounted) return;
      setState(() => _fromClipboard = ok && raw != _c.text ? raw : null);
    } catch (_) {
      // Bufer o'qilmasa — taklif yo'q, xolos. Bu xato emas va
      // odamga ko'rsatilmaydi.
    }
  }

  /// Kataklarga bosilganda klaviaturani OCHADI.
  ///
  /// ILGARI BU YERDA `_focus.requestFocus()` TURARDI va aynan shu
  /// nosozlikning ildizi edi: boshqa ilovaga o'tib qaytganda
  /// Flutter'ning fokus tuguni fokusni USHLAB TURADI
  /// (`hasFocus == true`), klaviatura bilan bog'lanish esa uzilgan
  /// bo'ladi. Fokus allaqachon bor bo'lgani uchun `requestFocus()`
  /// HECH NARSA QILMAYDI — kataklarni necha bosmang, klaviatura
  /// ochilmaydi. Maydon o'lik qoladi va ilova qotib qolganday
  /// ko'rinadi.
  ///
  /// Shuning uchun fokus bor bo'lsa klaviatura ochilishi ALOHIDA
  /// so'raladi.
  void _openKeyboard() {
    if (!widget.enabled) return;
    if (_focus.hasFocus) {
      SystemChannels.textInput
          .invokeMethod<void>('TextInput.show')
          .catchError((_) {});
    } else {
      _focus.requestFocus();
    }
  }

  void _paste() {
    final v = _fromClipboard;
    if (v == null) return;
    _c.text = v;
    setState(() => _fromClipboard = null);
  }

  void _onChange() {
    setState(() {});
    if (_c.text.length == widget.length) widget.onCompleted(_c.text);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _c.removeListener(_onChange);
    if (widget.controller == null) _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final text = _c.text;

    final suggestion = _fromClipboard;

    return Semantics(
      textField: true,
      label: '${widget.length}-digit code',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // BUFERDAGI KOD — BIR BOSISHDA.
          //
          // Odam pochtadan kodni nusxalab qaytganda u bu yerda
          // ko'rinadi. Tizim autofill'i ishlamagan holatlar uchun
          // zaxira yo'l: `oneTimeCode` ishorasi hamma qurilmada
          // ham kafolatlanmaydi.
          // Kalitlar — NIYATNI qayd qilish uchun.
          //
          // Taklif qatori paydo bo'lganda `Column` bolalari
          // [qutilar] dan [taklif, oraliq, qutilar] ga aylanadi.
          // Flutter bolalarni pastdan ham solishtirgani uchun
          // qutilar kalitsiz ham saqlanib qoladi — bu TEKSHIRILDI,
          // ya'ni kalitlar nosozlikni tuzatmaydi va shunday deb
          // yozish noto'g'ri bo'lardi.
          //
          // Ular baribir qoldirildi: kelajakda bu ro'yxatga yana
          // bir shart qo'shilsa yoki tartib o'zgarsa, kiritish
          // maydoni jimgina qayta qurilib ketmasin. Pastdagi test
          // aynan shuni qo'riqlaydi.
          if (suggestion != null) ...[
            _ClipboardHint(
              key: const ValueKey('clipboard-hint'),
              code: suggestion,
              onTap: _paste,
            ),
            const SizedBox(key: ValueKey('clipboard-hint-gap'), height: 10),
          ],
          KeyedSubtree(
            key: const ValueKey('code-boxes'),
            child: _buildBoxes(context, t, text),
          ),
        ],
      ),
    );
  }

  Widget _buildBoxes(BuildContext context, NfcTokens t, String text) {
    return Stack(
        children: [
          // Ko'rinmas, lekin O'LCHAMLI maydon: `Offstage` bo'lsa
          // klaviatura ochilmasdi.
          Opacity(
            opacity: 0,
            child: SizedBox(
              height: 62,
              child: TextField(
                controller: _c,
                focusNode: _focus,
                enabled: widget.enabled,
                autofocus: true,
                keyboardType: TextInputType.number,
                // AUTOFILL ISHORASI ATAYLAB YO'Q — QAYTARMANG.
                //
                // `autofillHints: [AutofillHints.oneTimeCode]` shu
                // maydonga qo'shilgan edi va aynan o'shandan keyin
                // qurilmada quyidagi nosozlik paydo bo'ldi: odam
                // kodni ko'rish uchun pochtaga o'tib qaytganda
                // klaviatura umuman ochilmay qolardi va kod
                // yozilmasdi.
                //
                // Sababi: ishora berilganda Android'ning autofill
                // xizmati maydonni o'z nazoratiga oladi. Boshqa
                // ilovadan qaytilganda autofill seansi tiklanadi,
                // lekin kiritish bog'lanishi (input connection)
                // tiklanmasligi mumkin — maydon tirik ko'rinadi,
                // ammo hech narsa yozilmaydi.
                //
                // Ishorasiz ham odam yutqazmaydi: buferdagi kod
                // uchun taklif qatori bor va u qurilmada
                // ISHLAGANI tasdiqlangan.
                //
                // Qaytarmoqchi bo'lsangiz — avval HAQIQIY
                // qurilmada "pochtaga o'tib qaytish" yo'lini
                // sinab ko'ring, testlar buni ushlamaydi.
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(widget.length),
                ],
              ),
            ),
          ),
          Positioned.fill(
            child: GestureDetector(
              onTap: _openKeyboard,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(widget.length, (i) {
                  final filled = i < text.length;
                  final active = i == text.length && _focus.hasFocus;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3.5),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        height: 62,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: t.surface2,
                          borderRadius: R.gentle,
                          border: Border.all(
                            color: widget.hasError
                                ? t.error
                                : active
                                    ? t.accent2
                                    : t.border2,
                            width: active || widget.hasError ? 1.6 : 1,
                          ),
                        ),
                        child: Text(
                          filled ? text[i] : '',
                          style: TextStyle(
                            fontFamily: 'IBMPlexMono',
                            fontSize: 23,
                            fontWeight: FontWeight.w600,
                            color: widget.hasError ? t.error : t.text1,
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
        ],
    );
  }
}

/// Buferdagi kodni taklif qiluvchi qator.
class _ClipboardHint extends StatelessWidget {
  const _ClipboardHint({
    super.key,
    required this.code,
    required this.onTap,
  });

  final String code;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: t.surface2,
          borderRadius: R.gentle,
          border: Border.all(color: t.accent2.withValues(alpha: .45)),
        ),
        child: Row(
          children: [
            Icon(Icons.content_paste_rounded, size: 17, color: t.accent2),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                code,
                style: TextStyle(
                  fontFamily: AppType.mono,
                  fontSize: 15,
                  letterSpacing: 3,
                  fontWeight: FontWeight.w600,
                  color: t.text1,
                ),
              ),
            ),
            Icon(Icons.arrow_forward_rounded, size: 16, color: t.text3),
          ],
        ),
      ),
    );
  }
}

/// `+998` prefiksi bilan telefon maydoni.
class PhoneField extends StatelessWidget {
  const PhoneField({
    super.key,
    required this.label,
    required this.controller,
    this.error,
    this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final String? error;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return NovaField(
      label: label,
      controller: controller,
      error: error,
      onChanged: onChanged,
      keyboardType: TextInputType.phone,
      hint: '90 123 45 67',
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[\d\s]')),
        LengthLimitingTextInputFormatter(12),
      ],
      prefix: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 8, 0),
        child: Center(
          widthFactor: 1,
          child: Text(
            '+998',
            style: TextStyle(
              fontFamily: 'IBMPlexMono',
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: t.text2,
            ),
          ),
        ),
      ),
    );
  }
}
