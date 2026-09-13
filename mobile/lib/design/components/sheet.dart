import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart' show showModalBottomSheet;
import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';

/// Pastki varaq — radius 28, blur 22, tepada 40×4 tutqich.
///
/// Barmoq bilan sudrab yopiladi (Flutter'ning `isScrollControlled` +
/// `enableDrag` bunga o'zi qodir), scrim 180ms da paydo bo'ladi.
Future<Tr?> showSheet<Tr>(
  BuildContext context, {
  required String title,
  String? subtitle,
  required Widget child,
}) {
  return showModalBottomSheet<Tr>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0x00000000),
    barrierColor: C.backdrop.withValues(alpha: .72),
    builder: (_) => SheetBody(title: title, subtitle: subtitle, child: child),
  );
}

class SheetBody extends StatelessWidget {
  const SheetBody({super.key, required this.title, this.subtitle, required this.child});

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(R.sheet)),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
          constraints: BoxConstraints(maxHeight: media.size.height * .86),
          decoration: BoxDecoration(
            color: const Color(0xE6100F14),
            border: const Border(top: BorderSide(color: C.warmHairline)),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(R.sheet)),
            boxShadow: E.sheet,
          ),
          padding: EdgeInsets.only(bottom: media.padding.bottom + S.x16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: S.x12),
              Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: C.muted.withValues(alpha: .5),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: S.x20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(width: double.infinity, child: Text(title, style: T.section.copyWith(fontSize: 17))),
                    if (subtitle != null) ...[
                      const SizedBox(height: 5),
                      Text(subtitle!, style: T.caption),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: S.x16),
              Flexible(child: SingleChildScrollView(child: child)),
            ],
          ),
        ),
      ),
    );
  }
}
