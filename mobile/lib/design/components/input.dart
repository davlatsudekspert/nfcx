import 'package:flutter/material.dart'
    show TextField, InputDecoration, InputBorder, Material, MaterialType;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import '../tokens.dart';
import 'surface.dart';
import '../type.dart';

/// Matn maydoni — balandlik 50, radius 14, fokusda chegara champagne'ga
/// o'tadi (to'liq emas, 40% shaffoflik: yorqin gold chegara qattiq
/// ko'rinadi).
class Field extends StatefulWidget {
  const Field({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.obscure = false,
    this.keyboardType,
    this.helper,
    this.error,
    this.prefix,
    this.maxLength,
    this.inputFormatters,
    this.onChanged,
    this.textInputAction,
    this.onSubmitted,
    this.maxLines = 1,
    this.enabled = true,
  });

  final String label;
  final TextEditingController? controller;
  final String? hint;
  final bool obscure;
  final TextInputType? keyboardType;
  final String? helper;
  final String? error;
  final Widget? prefix;
  final int? maxLength;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  final int maxLines;
  final bool enabled;

  @override
  State<Field> createState() => _FieldState();
}

class _FieldState extends State<Field> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = (widget.error ?? '').isNotEmpty;
    final border = hasError
        ? C.signal.withValues(alpha: .5)
        : _focus.hasFocus
            ? C.champagne.withValues(alpha: .4)
            : C.hairline;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow(widget.label),
        const SizedBox(height: 7),
        AnimatedContainer(
          duration: M.fade,
          constraints: BoxConstraints(minHeight: widget.maxLines > 1 ? 90 : 50),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: C.graphite,
            borderRadius: BorderRadius.circular(R.input),
            border: Border.all(color: border),
          ),
          child: Row(
            crossAxisAlignment: widget.maxLines > 1
                ? CrossAxisAlignment.start
                : CrossAxisAlignment.center,
            children: [
              if (widget.prefix != null) ...[
                widget.prefix!,
                const SizedBox(width: S.x8),
              ],
              // MATERIAL AJDODI SHART: `TextField` ("No Material widget
              // found" bilan yiqiladi). U SHU YERDA beriladi, chaqiruvchi
              // ekranda emas — aks holda `Scaffold`siz har bir ekran
              // ishga tushganda yiqilardi (test aynan shuni ushladi).
              // `transparency` — hech qanday fon ham, soya ham
              // qo'shmaydi, ya'ni dizayn o'zgarmaydi.
              Expanded(
                child: Material(
                  type: MaterialType.transparency,
                  child: TextField(
                  controller: widget.controller,
                  focusNode: _focus,
                  obscureText: widget.obscure,
                  keyboardType: widget.keyboardType,
                  maxLength: widget.maxLength,
                  maxLines: widget.maxLines,
                  // `minLines` HECH QACHON `maxLines` dan katta
                  // bo'lmasligi kerak — Flutter buni assertion bilan
                  // to'xtatadi va EKRAN YIQILADI. `maxLines: 2`
                  // berilgan joyda (jismoniy karta manzili) aynan
                  // shunday bo'lgan edi.
                  minLines: widget.maxLines > 1
                      ? (widget.maxLines < 3 ? widget.maxLines : 3)
                      : 1,
                  enabled: widget.enabled,
                  inputFormatters: widget.inputFormatters,
                  onChanged: widget.onChanged,
                  onSubmitted: widget.onSubmitted,
                  textInputAction: widget.textInputAction,
                  cursorColor: C.champagne,
                  cursorWidth: 1.6,
                  style: T.cardTitle.copyWith(fontWeight: FontWeight.w500, fontSize: 16),
                  decoration: InputDecoration(
                    isDense: true,
                    counterText: '',
                    border: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: widget.maxLines > 1 ? 14 : 0),
                    hintText: widget.hint,
                    hintStyle: T.cardTitle.copyWith(
                      fontWeight: FontWeight.w400, fontSize: 16, color: C.muted,
                    ),
                  ),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (hasError || (widget.helper ?? '').isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            hasError ? widget.error! : widget.helper!,
            style: T.caption.copyWith(color: hasError ? C.signal : C.muted, fontSize: 12.5),
          ),
        ],
      ],
    );
  }
}

/// Olti xonali kod maydoni.
///
/// Har raqam alohida katakcha ko'rinadi, lekin ORQADA BITTA `TextField`
/// turadi: alohida oltita maydon qilinsa, fokusni qo'lda ko'chirish,
/// backspace va nusxa-joylashtirish (SMS/email dan kod qo'yish) — hammasi
/// alohida tuzatishni talab qiladi va telefonlarda turlicha ishlaydi.
class CodeField extends StatefulWidget {
  const CodeField({
    super.key,
    required this.controller,
    this.length = 6,
    this.hasError = false,
    this.onCompleted,
  });

  final TextEditingController controller;
  final int length;
  final bool hasError;
  final ValueChanged<String>? onCompleted;

  @override
  State<CodeField> createState() => _CodeFieldState();
}

class _CodeFieldState extends State<CodeField> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChange);
  }

  void _onChange() {
    setState(() {});
    if (widget.controller.text.length == widget.length) {
      widget.onCompleted?.call(widget.controller.text);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChange);
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.controller.text;
    return GestureDetector(
      onTap: () => _focus.requestFocus(),
      behavior: HitTestBehavior.opaque,
      child: Stack(
        children: [
          Row(
            children: [
              for (var i = 0; i < widget.length; i++) ...[
                if (i > 0) const SizedBox(width: S.x8),
                Expanded(
                  child: AspectRatio(
                    aspectRatio: 0.84,
                    child: Container(
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: C.graphite,
                        borderRadius: BorderRadius.circular(R.tile),
                        border: Border.all(
                          color: widget.hasError
                              ? C.signal.withValues(alpha: .55)
                              : i == v.length && _focus.hasFocus
                                  ? C.champagne.withValues(alpha: .5)
                                  : C.hairline,
                        ),
                      ),
                      child: Text(
                        i < v.length ? v[i] : '',
                        style: T.nfcId(24).copyWith(
                          color: widget.hasError ? C.signal : C.offWhite,
                          letterSpacing: 0,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          // Ko'rinmas, lekin haqiqiy maydon — klaviatura va joylashtirish
          // shu orqali ishlaydi.
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              child: Material(
                type: MaterialType.transparency,
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focus,
                  keyboardType: TextInputType.number,
                  maxLength: widget.length,
                  showCursor: false,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(counterText: '', border: InputBorder.none),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
