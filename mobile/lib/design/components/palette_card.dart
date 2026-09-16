import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'press.dart';

/// MAVZU KARTASI — o'z ranglarida chiziladi.
///
/// NIMA UCHUN ALOHIDA FAYL: bu karta IKKI joyda kerak —
/// "Ko'rinish" ekranida va Sozlamalarning tepasida (prototipda
/// palitra aynan Sozlamalar ichida turadi). Nusxa ko'chirilganda
/// ikkitasi vaqt o'tib bir-biridan farq qila boshlardi.
class PaletteCard extends StatelessWidget {
  const PaletteCard({
    super.key,
    required this.palette,
    required this.selected,
    required this.onTap,
  });

  final Palette palette;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .97,
        child: Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.tile),
            border: Border.all(
              color: selected ? C.accent : C.line,
              width: selected ? 2 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Namuna — mavzuning O'Z ranglaridan, joriy
              // mavzuniki emas: aks holda uchala karta bir xil
              // ko'rinardi.
              Container(
                height: 70,
                color: palette.baseBottom,
                padding: const EdgeInsets.all(8),
                alignment: Alignment.bottomLeft,
                child: Container(
                  height: 16,
                  decoration: BoxDecoration(
                    color: palette.accent,
                    borderRadius: BorderRadius.circular(5),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
                child: Text(
                  palette.label,
                  maxLines: 2,
                  style: T.caption.copyWith(
                    fontSize: 12,
                    color: selected ? C.accent : C.ink,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}
/// Tanlangan qatordagi belgi.