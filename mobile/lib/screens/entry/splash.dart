import 'package:flutter/widgets.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';

/// Splash — qora fonda logotip va nom.
///
/// 700ms: bu vaqt ichida sessiya tekshiriladi (`AppState.boot`).
/// Ya'ni bu "sun'iy kutish" emas — haqiqiy ishning ustini yopadi.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: C.obsidian,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image(image: AssetImage('assets/img/logo.png'), width: 104, height: 104),
              SizedBox(height: S.x24),
              Text('NFCSTORE', style: TextStyle(
                fontFamily: 'InstrumentSerif', fontSize: 30,
                letterSpacing: 3.4, color: C.offWhite, height: 1,
              )),
              SizedBox(height: S.x12),
              Text(tr('RAQAMLI PROFIL VA NFC KARTA'), style: T.eyebrow),
            ],
          ),
        ),
      );
}
