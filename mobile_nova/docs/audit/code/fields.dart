import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
          style: TextStyle(
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

class _CodeFieldState extends State<CodeField> {
  late final TextEditingController _c =
      widget.controller ?? TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _c.addListener(_onChange);
  }

  void _onChange() {
    setState(() {});
    if (_c.text.length == widget.length) widget.onCompleted(_c.text);
  }

  @override
  void dispose() {
    _c.removeListener(_onChange);
    if (widget.controller == null) _c.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final text = _c.text;

    return Semantics(
      textField: true,
      label: '${widget.length}-digit code',
      child: Stack(
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
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(widget.length),
                ],
              ),
            ),
          ),
          Positioned.fill(
            child: GestureDetector(
              onTap: () => _focus.requestFocus(),
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
