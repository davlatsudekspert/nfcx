import 'package:flutter/widgets.dart';

import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../business/create_company.dart';
import '../nfc/id_catalog.dart';

/// Shaxsning tarifi — chip, almashtirgich va QR ekrani uchun.
///
/// Shaxsiy ID tarifni `Record.tier` dan oladi (u serverdan kelgan
/// qiymatga tayanadi), kompaniya esa satr sifatida saqlaydi.
Tier identityTier(Identity id) => id.isBusiness
    ? TierStyle.parse(id.company?.tier)
    : (id.record?.tier ?? Tier.free);

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
    title: tr('Shaxsni tanlash'),
    subtitle: tr('Tanlangan shaxs butun ilova uchun faol bo‘ladi.'),
    child: _SwitcherBody(state: state),
  );
}

class _SwitcherBody extends StatelessWidget {
  const _SwitcherBody({required this.state});

  final AppState state;

  /// Varaq yopilgandan KEYIN yangi ekran ochiladi: aks holda u
  /// yopilayotgan varaq ustiga chiqib, o'zi ham yopilib ketardi.
  void _openAfterClose(BuildContext context, WidgetBuilder builder) {
    final nav = Navigator.of(context, rootNavigator: true);
    Navigator.of(context).pop();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      nav.push(SlidePage<void>(builder: builder));
    });
  }

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
        tier: c.tier,
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
        tier: TierStyle.parse(c.tier),
        business: true,
        active: c.id == activeCode,
        onTap: () {
          state.switchIdentity(Identity.business(c));
          Navigator.of(context).pop();
        },
      ));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: S.x24),
            child: Text(
              tr('Hali ID‘ingiz yo‘q. NFC bo‘limidan ID tanlashingiz mumkin.'),
              textAlign: TextAlign.center,
              style: T.body,
            ),
          )
        else
          for (final r in rows) ...[r, const SizedBox(height: S.x8)],

        const SizedBox(height: S.x8),
        const RowDivider(indent: 0),

        // YANGI ID — katalog. Ro'yxatning oxirida, handoff tartibi.
        SheetAction(
          label: tr('+ ID qo‘shish'),
          icon: Ico.card,
          subtitle: tr('Katalogdan bo‘sh ID tanlash'),
          onTap: () => _openAfterClose(context, (_) => const IdCatalogScreen()),
        ),

        // BIZNES — haqiqiy kompaniya ochish oqimi (`POST /api/companies`).
        SheetAction(
          label: tr('Yangi Company ID yaratish'),
          icon: Ico.building,
          onTap: () => _openAfterClose(context, (_) => CreateCompanyScreen()),
        ),
      ],
    );
  }
}

/// Bitta shaxs qatori — mini karta namunasi, ism, mono kod va faolda
/// belgi.
class _Row extends StatelessWidget {
  const _Row({
    required this.name,
    required this.code,
    required this.avatarUrl,
    required this.tier,
    required this.business,
    required this.active,
    required this.onTap,
  });

  final String name;
  final String code;
  final String? avatarUrl;
  final Tier tier;
  final bool business;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(tier);
    final hasAvatar = (avatarUrl ?? '').trim().isNotEmpty;

    return Press(
      haptic: true,
      onTap: onTap,
      minSize: 0,
      scale: .985,
      child: Surface(
        padding: const EdgeInsets.all(S.x12),
        border: Border.all(
          color: active ? C.lineStrong : C.line,
          width: active ? 1.4 : 1,
        ),
        shadow: C.e1,
        child: Row(
          children: [
            // Rasm bo'lsa avatar, bo'lmasa MINI KARTA NAMUNASI —
            // shaxsning tarifi qatorning o'zidan ko'rinadi.
            if (hasAvatar)
              Avatar(url: avatarUrl, name: name, size: 44, square: business)
            else
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: style.hasMaterial ? style.swatch : C.raisedSurface,
                  borderRadius: BorderRadius.circular(R.tile),
                  border: Border.all(color: C.line),
                ),
                alignment: Alignment.center,
                child: NIcon(
                  business ? Ico.building : Ico.card,
                  size: 18,
                  color: style.hasMaterial ? const Color(0xFF1C1405) : C.ink2,
                ),
              ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(code, style: T.code(12.5, color: C.ink2)),
                      const SizedBox(width: S.x8),
                      Text(
                        business ? tr('Biznes') : tr('Shaxsiy'),
                        style: T.meta.copyWith(fontSize: 10.5),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // FAOL SHAXS — belgi bilan, faqat qirra rangi bilan emas.
            if (active) ...[
              const SizedBox(width: S.x8),
              const VerifiedBadge(size: 20),
            ],
          ],
        ),
      ),
    );
  }
}
