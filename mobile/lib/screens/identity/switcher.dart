import 'package:flutter/widgets.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../business/create_company.dart';
import '../../design/nav.dart';

/// SHAXS ALMASHTIRGICH — ilovaning ildiz holati o'zgaradigan joy.
///
/// Ro'yxat HAQIQIY egalik qilinadigan shaxslardan tuziladi:
/// shaxsiy ID'lar `/api/auth/me` javobidan, kompaniyalar
/// `/api/companies/mine` dan. Dizayndagi "Aziz Karimov / Ali Market"
/// kabi nomlar faqat maket — ular hech qayerda yozilmagan.
///
/// Tanlangach butun ilova (Home, NFC, Profile) yangi shaxs bo'yicha
/// qayta chiziladi — chiqib qayta kirish talab qilinmaydi.
Future<void> showIdentitySwitcher(BuildContext context) async {
  final state = AppScope.read(context);
  await showSheet<void>(
    context,
    title: 'Shaxsni almashtirish',
    subtitle: 'Tanlangan shaxs butun ilova uchun faol bo‘ladi.',
    child: _SwitcherBody(state: state),
  );
}

class _SwitcherBody extends StatelessWidget {
  const _SwitcherBody({required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    final activeCode = state.active?.code;
    final rows = <Widget>[];

    // Shaxsiy va biznes ID'lar BIR RO'YXATDA — handoff talabi:
    // "listing every ID together regardless of type". Turini yonidagi
    // teg ko'rsatadi.
    for (final c in state.cards) {
      rows.add(_Row(
        name: c.name.isEmpty ? c.code : c.name,
        code: c.code,
        avatarUrl: c.avatarUrl,
        business: false,
        active: c.code == activeCode,
        onTap: () {
          state.switchIdentity(Identity.personal(c));
          Navigator.of(context).pop();
        },
      ));
    }
    for (final c in state.companies) {
      rows.add(_Row(
        name: c.name.isEmpty ? c.id : c.name,
        code: c.id,
        avatarUrl: c.logoUrl,
        business: true,
        active: c.id == activeCode,
        onTap: () {
          state.switchIdentity(Identity.business(c));
          Navigator.of(context).pop();
        },
      ));
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, 0),
      child: Column(
        children: [
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: S.x24),
              child: Text(
                'Hali ID‘ingiz yo‘q. NFC bo‘limidan ID tanlashingiz mumkin.',
                textAlign: TextAlign.center,
                style: T.body,
              ),
            )
          else
            for (final r in rows) ...[r, const SizedBox(height: S.x8)],
          const SizedBox(height: S.x4),
          // Yangi kompaniya — ro'yxatning OXIRIDA, handoff tartibi.
          //
          // Bu tugma ILGARI FAQAT VARAQNI YOPARDI: ko'rinishi tugma,
          // xulqi yo'q. Endi u haqiqiy biznes ochish oqimini ochadi
          // (`POST /api/companies`).
          Press(
            haptic: true,
            onTap: () {
              // Varaq yopilgandan KEYIN ochiladi: aks holda yangi
              // ekran yopilayotgan varaq ustiga chiqib, o'zi ham
              // yopilib ketardi.
              final nav = Navigator.of(context, rootNavigator: true);
              Navigator.of(context).pop();
              WidgetsBinding.instance.addPostFrameCallback((_) {
                nav.push(SlidePage<void>(
                  builder: (_) => const CreateCompanyScreen(),
                ));
              });
            },
            child: Container(
              padding: const EdgeInsets.all(S.x16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(R.card),
                border: Border.all(color: C.hairline),
              ),
              child: Row(
                children: [
                  const NIcon(Ico.plus, size: 18, color: C.champagne),
                  const SizedBox(width: S.x12),
                  Text('Yangi Company ID yaratish',
                      style: T.cardTitle.copyWith(color: C.champagne)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.name,
    required this.code,
    required this.avatarUrl,
    required this.business,
    required this.active,
    required this.onTap,
  });

  final String name;
  final String code;
  final String? avatarUrl;
  final bool business;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          border: active ? C.champagne.withValues(alpha: .38) : null,
          child: Row(
            children: [
              Avatar(url: avatarUrl, name: name, size: 42),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.cardTitle),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        // Biznes — champagne to'ldirma; shaxsiy — neytral
                        // konturli. Turi rangdan ham, yozuvdan ham bilinadi.
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: business ? C.champagne : null,
                            borderRadius: BorderRadius.circular(5),
                            border: Border.all(color: business ? C.champagne : C.hairline),
                          ),
                          child: Text(
                            business ? 'BIZNES' : 'SHAXSIY',
                            style: T.statusLabel.copyWith(color: business ? C.ink : C.ash),
                          ),
                        ),
                        const SizedBox(width: S.x8),
                        Text(code, style: T.code.copyWith(fontSize: 11, color: C.ash)),
                      ],
                    ),
                  ],
                ),
              ),
              if (active)
                const NIcon(Ico.check, size: 17, color: C.champagne),
            ],
          ),
        ),
      );
}
