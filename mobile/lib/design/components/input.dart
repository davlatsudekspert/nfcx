import 'package:flutter/material.dart'
    show InputDecoration, Material, MaterialType, TextField;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'press.dart';

/// MAYDONLAR — 56 dp, fokusda oltin chegara.
///
/// HOLATLAR (dizayn 13a): oddiy · fokus (oltin chegara + belgi
/// soni) · xato (matn bilan) · o'chiq. Xato HECH QACHON faqat rang
/// bilan ko'rsatilmaydi — doim belgi va jumla bilan birga.
///
/// KLAVIATURA TURI har maydonda ataylab beriladi: telefon uchun
/// raqamli, email uchun `@` bor klaviatura, kod uchun raqamli. Bu
/// kichik narsa emas — forma to'ldirish tezligini ikki barobar
/// oshiradi.
class Field extends StatefulWidget {
  const Field({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.helper,
    this.error,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.inputFormatters,
    this.maxLength,
    this.maxLines = 1,
    this.enabled = true,
    this.autofocus = false,
    this.prefix,
    this.suffix,
    this.onChanged,
    this.onSubmitted,
    this.counter = false,
  });

  /// KATTA HARFDA yoziladigan yorliq.
  final String label;

  final TextEditingController? controller;
  final String? hint;

  /// Maydon ostidagi tushuntirish.
  final String? helper;

  /// Xato matni — berilsa chegara qizil bo'ladi.
  final String? error;

  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final int maxLines;
  final bool enabled;
  final bool autofocus;

  /// Maydon ichida chapda turadigan doimiy matn (`+998`).
  final String? prefix;

  /// O'ngdagi widget (masalan "Ko'rsatish" tugmasi).
  final Widget? suffix;

  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  /// Belgi sonini ko'rsatish — `maxLength` bilan birga.
  final bool counter;

  @override
  State<Field> createState() => _FieldState();
}

class _FieldState extends State<Field> {
  late final FocusNode _focus = FocusNode()..addListener(_onFocus);
  late final TextEditingController _ctrl =
      widget.controller ?? TextEditingController();

  bool _focused = false;
  bool _reveal = false;

  void _onFocus() {
    if (_focus.hasFocus != _focused) setState(() => _focused = _focus.hasFocus);
  }

  @override
  void dispose() {
    _focus.removeListener(_onFocus);
    _focus.dispose();
    if (widget.controller == null) _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = (widget.error ?? '').isNotEmpty;
    final multiline = widget.maxLines > 1;

    final border = hasError
        ? C.fail
        : _focused
            ? C.accent.withValues(alpha: .75)
            : C.line;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(widget.label.toUpperCase(), style: T.label)),
            if (widget.counter && widget.maxLength != null)
              ValueListenableBuilder<TextEditingValue>(
                valueListenable: _ctrl,
                builder: (context, value, _) => Text(
                  '${value.text.characters.length} / ${widget.maxLength}',
                  style: T.meta.copyWith(
                    fontSize: 10.5,
                    color: _focused ? C.accent : C.ink3,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 7),
        AnimatedContainer(
          duration: M.fade,
          curve: M.curve,
          constraints: BoxConstraints(minHeight: multiline ? 104 : 56),
          padding: EdgeInsets.symmetric(
            horizontal: S.x16,
            vertical: multiline ? S.x12 : 0,
          ),
          decoration: BoxDecoration(
            gradient: widget.enabled ? C.raisedSurface : null,
            color: widget.enabled ? null : C.surface.withValues(alpha: .5),
            borderRadius: BorderRadius.circular(R.input),
            border: Border.all(color: border, width: _focused ? 1.4 : 1),
            boxShadow: _focused && !hasError
                ? [
                    BoxShadow(
                      color: C.accent.withValues(alpha: .14),
                      blurRadius: 16,
                      spreadRadius: -4,
                    ),
                  ]
                : null,
          ),
          child: Row(
            crossAxisAlignment:
                multiline ? CrossAxisAlignment.start : CrossAxisAlignment.center,
            children: [
              if (widget.prefix != null) ...[
                Text(
                  widget.prefix!,
                  style: T.amount.copyWith(color: C.ink2),
                ),
                const SizedBox(width: S.x8),
              ],
              Expanded(
                // `TextField` Material ajdodini talab qiladi. Butun
                // ekranga Material qo'yish o'rniga faqat shu yerda
                // shaffof qatlam beriladi.
                child: Material(
                  type: MaterialType.transparency,
                  child: EditableTextBox(
                    controller: _ctrl,
                    focusNode: _focus,
                    obscure: widget.obscure && !_reveal,
                    hint: widget.hint,
                    keyboardType: widget.keyboardType,
                    textInputAction: widget.textInputAction,
                    inputFormatters: widget.inputFormatters,
                    maxLength: widget.maxLength,
                    maxLines: widget.maxLines,
                    enabled: widget.enabled,
                    autofocus: widget.autofocus,
                    onChanged: widget.onChanged,
                    onSubmitted: widget.onSubmitted,
                  ),
                ),
              ),
              if (widget.obscure)
                Press(
                  onTap: () => setState(() => _reveal = !_reveal),
                  minSize: S.tap,
                  child: Padding(
                    padding: const EdgeInsets.only(left: S.x8),
                    child: NIcon(
                      Ico.eye,
                      size: 18,
                      color: _reveal ? C.accent : C.ink3,
                      filled: _reveal,
                    ),
                  ),
                )
              else if (widget.suffix != null) ...[
                const SizedBox(width: S.x8),
                widget.suffix!,
              ],
            ],
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: 7),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              NIcon(Ico.warning, size: 13, color: C.fail),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  widget.error!,
                  style: T.caption.copyWith(color: C.fail, fontSize: 12.5),
                ),
              ),
            ],
          ),
        ] else if ((widget.helper ?? '').isNotEmpty) ...[
          const SizedBox(height: 7),
          Text(
            widget.helper!,
            style: T.caption.copyWith(color: C.ink3, fontSize: 12.5),
          ),
        ],
      ],
    );
  }
}

/// Matn kiritish o'zagi.
///
/// Alohida ajratilgan, chunki uni `Field` ham, boshqa maxsus
/// maydonlar ham (izoh, qidiruv) bir xil uslubda ishlatadi.
class EditableTextBox extends StatelessWidget {
  const EditableTextBox({
    super.key,
    required this.controller,
    this.focusNode,
    this.obscure = false,
    this.hint,
    this.keyboardType,
    this.textInputAction,
    this.inputFormatters,
    this.maxLength,
    this.maxLines = 1,
    this.enabled = true,
    this.autofocus = false,
    this.style,
    this.onChanged,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final FocusNode? focusNode;
  final bool obscure;
  final String? hint;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final int? maxLength;
  final int maxLines;
  final bool enabled;
  final bool autofocus;
  final TextStyle? style;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    final text = style ?? T.bodyStrong.copyWith(fontSize: 15.5);
    // `TextField` ishlatiladi, `EditableText` emas: matn tanlash,
    // nusxalash-qo'yish, avtomatik to'ldirish va klaviatura
    // xatti-harakati tayyor holda keladi. Ko'rinishni esa
    // `InputDecoration.collapsed` butunlay bo'shatadi — chegara va
    // fonni tashqi `Container` chizadi.
    return TextField(
      controller: controller,
      focusNode: focusNode,
      style: text.copyWith(color: enabled ? C.ink : C.ink3),
      cursorColor: C.accent,
      cursorWidth: 1.6,
      cursorRadius: const Radius.circular(1),
      obscureText: obscure,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      inputFormatters: [
        if (maxLength != null) LengthLimitingTextInputFormatter(maxLength),
        ...?inputFormatters,
      ],
      maxLines: maxLines,
      minLines: 1,
      enabled: enabled,
      autofocus: autofocus,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      decoration: InputDecoration.collapsed(
        hintText: hint,
        hintStyle: text.copyWith(color: C.ink3),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// TASDIQLASH KODI
// ─────────────────────────────────────────────────────────────

/// 6 xonali kod maydoni — har katakcha 64 dp.
///
/// Ko'rinishda alohida katakchalar, aslida esa BITTA ko'rinmas
/// matn maydoni. Sabab: olti alohida maydon bo'lsa, o'chirish va
/// yopishtirish (paste) buziladi — foydalanuvchi kodni xatdan
/// nusxalab qo'yadi va u bitta katakchaga tushib qoladi.
class CodeField extends StatefulWidget {
  const CodeField({
    super.key,
    required this.controller,
    this.length = 6,
    this.hasError = false,
    this.autofocus = true,
    this.onCompleted,
    this.onChanged,
  });

  final TextEditingController controller;
  final int length;
  final bool hasError;
  final bool autofocus;
  final ValueChanged<String>? onCompleted;
  final ValueChanged<String>? onChanged;

  @override
  State<CodeField> createState() => _CodeFieldState();
}

class _CodeFieldState extends State<CodeField> {
  late final FocusNode _focus = FocusNode()..addListener(_refresh);

  void _refresh() => setState(() {});

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_refresh);
    _focus.removeListener(_refresh);
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final value = widget.controller.text;

    return Press(
      onTap: () => _focus.requestFocus(),
      minSize: 0,
      scale: 1,
      child: Stack(
        children: [
          Row(
            children: [
              for (var i = 0; i < widget.length; i++) ...[
                if (i > 0) const SizedBox(width: S.x8),
                Expanded(
                  child: _Cell(
                    char: i < value.length ? value[i] : '',
                    active: _focus.hasFocus && i == value.length,
                    error: widget.hasError,
                  ),
                ),
              ],
            ],
          ),
          // Ko'rinmas maydon — balandligi katakcha bilan bir xil,
          // shunda bosish joyi to'g'ri keladi.
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              child: Material(
                type: MaterialType.transparency,
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focus,
                  style: T.code(24),
                  showCursor: false,
                  keyboardType: TextInputType.number,
                  autofocus: widget.autofocus,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(widget.length),
                  ],
                  decoration: const InputDecoration.collapsed(hintText: ''),
                  onChanged: (v) {
                    widget.onChanged?.call(v);
                    if (v.length == widget.length) widget.onCompleted?.call(v);
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.char, required this.active, required this.error});

  final String char;
  final bool active;
  final bool error;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
        duration: M.fade,
        curve: M.curve,
        height: 64,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(R.input),
          border: Border.all(
            color: error
                ? C.fail
                : active
                    ? C.accent
                    : C.line,
            width: active || error ? 1.5 : 1,
          ),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: C.accent.withValues(alpha: .2),
                    blurRadius: 14,
                    spreadRadius: -3,
                  ),
                ]
              : null,
        ),
        child: Text(
          char,
          style: T.code(24, color: error ? C.fail : C.ink),
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// QIDIRUV MAYDONI
// ─────────────────────────────────────────────────────────────

/// Qidiruv qatori — lupa bilan.
class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.controller,
    this.hint = '',
    this.onChanged,
    this.onSubmitted,
    this.autofocus = false,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool autofocus;

  @override
  Widget build(BuildContext context) => Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: S.x16),
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(R.input),
          border: Border.all(color: C.line),
        ),
        child: Row(
          children: [
            NIcon(Ico.search, size: 18, color: C.ink3),
            const SizedBox(width: S.x12),
            Expanded(
              child: Material(
                type: MaterialType.transparency,
                child: EditableTextBox(
                  controller: controller,
                  hint: hint,
                  autofocus: autofocus,
                  textInputAction: TextInputAction.search,
                  onChanged: onChanged,
                  onSubmitted: onSubmitted,
                ),
              ),
            ),
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: controller,
              builder: (context, value, _) => value.text.isEmpty
                  ? const SizedBox.shrink()
                  : Press(
                      onTap: () {
                        controller.clear();
                        onChanged?.call('');
                      },
                      minSize: S.tap,
                      child: NIcon(Ico.close, size: 16, color: C.ink3),
                    ),
            ),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// SWITCH
// ─────────────────────────────────────────────────────────────

/// O'chirgich — oltin yoqilgan holat.
class Toggle extends StatelessWidget {
  const Toggle({
    super.key,
    required this.value,
    this.onChanged,
    this.tone,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;

  /// Holat rangi (barmoq izi qatorida yashil).
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final on = tone ?? C.accent;
    return Press(
      onTap: onChanged == null ? null : () => onChanged!(!value),
      minSize: S.tap,
      scale: .94,
      child: AnimatedContainer(
        duration: M.fade,
        curve: M.curve,
        width: 50,
        height: 29,
        padding: const EdgeInsets.all(3),
        alignment: value ? Alignment.centerRight : Alignment.centerLeft,
        decoration: BoxDecoration(
          gradient: value && onChanged != null
              ? LinearGradient(colors: [on.withValues(alpha: .9), on])
              : null,
          color: value && onChanged != null ? null : C.surfaceHigh,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(
            color: value ? const Color(0x00000000) : C.line,
          ),
        ),
        child: Container(
          width: 23,
          height: 23,
          decoration: BoxDecoration(
            color: value ? const Color(0xFF17130A) : C.ink3,
            shape: BoxShape.circle,
            boxShadow: C.e1,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// CHECKBOX
// ─────────────────────────────────────────────────────────────

/// Rozilik belgisi — kontent qoidalari va tasdiqlashlar uchun.
class CheckBox extends StatelessWidget {
  const CheckBox({
    super.key,
    required this.value,
    this.onChanged,
    this.label,
    this.size = 22,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;

  /// Yonidagi matn — bosilganda ham belgi almashadi.
  final String? label;

  final double size;

  @override
  Widget build(BuildContext context) {
    final box = AnimatedContainer(
      duration: M.press,
      curve: M.curve,
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: value ? C.actionFace : null,
        color: value ? null : C.surfaceHigh,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: value ? const Color(0x00000000) : C.line),
      ),
      alignment: Alignment.center,
      child: value
          ? NIcon(Ico.check, size: size * .62, color: C.onAccent)
          : null,
    );

    if (label == null) {
      return Press(
        onTap: onChanged == null ? null : () => onChanged!(!value),
        minSize: S.tap,
        child: box,
      );
    }

    return Press(
      onTap: onChanged == null ? null : () => onChanged!(!value),
      minSize: 0,
      scale: .99,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: S.x12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            box,
            const SizedBox(width: S.x12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Text(label!, style: T.bodyStrong.copyWith(fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
