import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/nav_bar.dart';
import '../../design/components/nfc_wave.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../identity/profile_screen.dart';
import 'gift_id.dart';
import 'gift_offers.dart';
import 'id_catalog.dart';
import 'nfc_scan.dart';
import 'nfc_write.dart';
import 'order_card.dart';
import 'qr_share.dart';

/// NFC MARKAZI — mahsulotning o'zagi.
///
/// Ekranning markazida brend medalyoni va undan tarqaluvchi
/// halqalar turadi: odam telefonni kartaga tegizish kerakligini
/// so'zsiz tushunadi.
///
/// SKANERLASH VA YOZISH — IKKI ALOHIDA AMAL. Ular bitta tugmaga
/// birlashtirilmaydi: biri o'qiydi, ikkinchisi kartani QAYTA
/// YOZADI. Ikkinchisi qaytarib bo'lmaydigan amal va u alohida
/// ogohlantirish bilan boradi.
///
/// QR har doim pastda turadi — NFC ishlamaydigan qurilmada ham
/// mahsulot ishlashi kerak.
class NfcCenterScreen extends StatefulWidget {
  const NfcCenterScreen({super.key});

  @override
  State<NfcCenterScreen> createState() => _NfcCenterScreenState();
}

class _NfcCenterScreenState extends State<NfcCenterScreen> {
  bool _refreshing = false;
  int _gifts = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _loadGifts();
  }

  Future<void> _loadGifts() async {
    try {
      final offers = await AppScope.read(context).repo.giftOffers();
      if (!mounted) return;
      setState(() => _gifts = offers.incoming.length);
    } catch (_) {
      // Sovg'a taklifi ixtiyoriy ma'lumot — xatosi ekranni
      // buzmasligi kerak.
    }
  }

  Future<void> _refresh() async {
    setState(() => _refreshing = true);
    try {
      await AppScope.read(context).refreshIdentities();
      await _loadGifts();
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  /// ID BOSHQARUVI — asosiy qilish, sovg'a qilish va o'chirish.
  ///
  /// NIMA UCHUN OYNA ICHIDA: uchalasi ham kamdan-kam ishlatiladi,
  /// biri esa qaytarib bo'lmaydi. Ro'yxat qatoriga to'g'ridan-to'g'ri
  /// "o'chirish" qo'yilsa, ID almashtirmoqchi bo'lgan odam uni
  /// tasodifan bosib yuborardi.
  Future<void> _manage(Record record) async {
    final state = AppScope.read(context);
    final choice = await showSheet<String>(
      context,
      title: record.code,
      subtitle: TierStyle.of(record.tier).label,
      child: Column(
        children: [
          SheetAction(
            label: tr('Profilni ochish'),
            icon: Ico.user,
            onTap: () => Navigator.of(context).pop('open'),
          ),
          SheetAction(
            label: tr('Asosiy ID qilish'),
            icon: Ico.star,
            subtitle: tr('Ilova shu ID bilan ochiladi'),
            onTap: () => Navigator.of(context).pop('primary'),
          ),
          SheetAction(
            label: tr('Kartaga yozish'),
            icon: Ico.write,
            onTap: () => Navigator.of(context).pop('write'),
          ),
          SheetAction(
            label: tr('Sovg‘a qilish'),
            icon: Ico.gift,
            onTap: () => Navigator.of(context).pop('gift'),
          ),
          const RowDivider(indent: 0),
          SheetAction(
            label: tr('ID‘ni o‘chirish'),
            icon: Ico.trash,
            danger: true,
            onTap: () => Navigator.of(context).pop('delete'),
          ),
        ],
      ),
    );
    if (!mounted || choice == null) return;

    switch (choice) {
      case 'open':
        await push<void>(context, (_) => ProfileScreen(code: record.code));
        return;
      case 'write':
        await push<void>(context, (_) => const NfcWriteScreen());
        return;
      case 'gift':
        await push<void>(context, (_) => GiftIdScreen(record: record));
        if (mounted) await _refresh();
        return;
      case 'primary':
        try {
          await state.repo.setPrimary(record.code);
          successHaptic();
          await state.refreshIdentities();
        } catch (e) {
          if (mounted) showError(context, humanError(e));
        }
        return;
      case 'delete':
        await _delete(record, state);
        return;
    }
  }

  /// O'CHIRISH — oqibati aniq yozilgan tasdiq bilan.
  Future<void> _delete(Record record, AppState state) async {
    final sure = await confirmSheet(
      context,
      title: trf('{code} o‘chirilsinmi?', {'code': record.code}),
      message: tr('Profil, postlar va statistika butunlay yo‘qoladi. '
          'Buni qaytarib bo‘lmaydi.'),
      confirmLabel: tr('Ha, o‘chirilsin'),
    );
    if (!mounted || !sure) return;

    try {
      await state.repo.deleteRecord(record.code);
      successHaptic();
      await state.refreshIdentities();
    } on ApiError catch (e) {
      if (!mounted) return;
      // Server oxirgi ID ni o'chirishga yo'l qo'ymaydi — sababini
      // odam tilida aytamiz.
      showError(
        context,
        e.key == 'last_card'
            ? tr('Bu sizning yagona ID‘ingiz. Avval yangisini oling.')
            : humanError(e),
      );
    } catch (e) {
      if (mounted) showError(context, humanError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final cards = state.cards;
    final active = state.active;

    return ScreenBackdrop(
      aura: Aura.nfc,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _refresh,
          color: C.accent,
          backgroundColor: C.surface,
          displacement: 28,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: NavBar.inset(context)),
            children: [
              ScreenTitle(
                tr('NFC markazi'),
                subtitle: tr('Kartani telefon orqasiga tegizing — profil '
                    'ochiladi yoki yangi ID yoziladi.'),
                trailing: _gifts > 0
                    ? RoundButton(
                        Ico.gift,
                        badge: _gifts,
                        onTap: () async {
                          await push<void>(
                            context,
                            (_) => const GiftOffersScreen(),
                          );
                          if (mounted) await _refresh();
                        },
                      )
                    : null,
              ),

              // FOTO HERO — karta va telefonning jismoniy hissi NFC
              // bo'limni ikonka-to'plam emas, premium mahsulotga aylantiradi.
              Padding(
                padding: const EdgeInsets.fromLTRB(S.gutter, S.x12, S.gutter, 0),
                child: _NfcHero(active: !_refreshing),
              ),
              const SizedBox(height: S.x24),

              // IKKI ASOSIY AMAL.
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Row(
                  children: [
                    Expanded(
                      child: _BigAction(
                        icon: Ico.scan,
                        title: tr('Skanerlash'),
                        subtitle: tr('Kartani o‘qish'),
                        highlighted: true,
                        onTap: () =>
                            push<void>(context, (_) => const NfcScanScreen()),
                      ),
                    ),
                    const SizedBox(width: S.x12),
                    Expanded(
                      child: _BigAction(
                        icon: Ico.write,
                        title: tr('Kartaga yozish'),
                        subtitle: tr('ID‘ni kartaga yuklash'),
                        onTap: () =>
                            push<void>(context, (_) => const NfcWriteScreen()),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: S.x12),

              // QR — NFC ishlamaganda ham ishlaydigan yo'l.
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Surface(
                  padding: const EdgeInsets.symmetric(
                    horizontal: S.x16,
                    vertical: S.x12,
                  ),
                  onTap: active == null
                      ? null
                      : () => push<void>(
                            context,
                            (_) => QrShareScreen(identity: active),
                          ),
                  child: Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: C.platinum.withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(R.status),
                        ),
                        alignment: Alignment.center,
                        child: NIcon(Ico.qr, size: 19, color: C.platinum),
                      ),
                      const SizedBox(width: S.x12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(tr('QR bilan ulashish'), style: T.cardTitle),
                            const SizedBox(height: 2),
                            Text(
                              tr('NFC ishlamasa ham ishlaydi'),
                              style: T.caption.copyWith(fontSize: 12.5),
                            ),
                          ],
                        ),
                      ),
                      NIcon(Ico.chevronRight, size: 18, color: C.ink3),
                    ],
                  ),
                ),
              ),

              // MENING ID'LARIM.
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x32,
                  S.gutter,
                  S.x12,
                ),
                child: SectionHeader(
                  tr('Mening ID’larim'),
                  actionLabel: tr('Katalog'),
                  onAction: () =>
                      push<void>(context, (_) => const IdCatalogScreen()),
                ),
              ),

              if (cards.isEmpty)
                EmptyState(
                  tr('Ro‘yxatdan o‘tganda bepul 8 xonali ID beriladi. '
                      'Katalogdan chiroyliroq kod tanlashingiz mumkin.'),
                  title: tr('Hali ID yo‘q'),
                  icon: Ico.card,
                  actionLabel: tr('ID katalogini ochish'),
                  onAction: () =>
                      push<void>(context, (_) => const IdCatalogScreen()),
                )
              else
                SizedBox(
                  height: 100,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    itemCount: cards.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(width: S.x12),
                    itemBuilder: (context, i) {
                      if (i == cards.length) {
                        return _AddIdTile(
                          onTap: () => push<void>(
                            context,
                            (_) => const IdCatalogScreen(),
                          ),
                        );
                      }
                      final card = cards[i];
                      return MiniIdCard(
                        code: card.code,
                        tier: card.tier,
                        active: active?.code == card.code,
                        onTap: () => _manage(card),
                      );
                    },
                  ),
                ),

              // JISMONIY KARTA BUYURTMASI.
              if (active?.record != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x24,
                    S.gutter,
                    0,
                  ),
                  child: SecondaryButton(
                    tr('NFC ID karta buyurtma berish'),
                    icon: Ico.truck,
                    onTap: () => push<void>(
                      context,
                      (_) => OrderCardScreen(record: active!.record!),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────

/// NFC markazining premium hero qismi. Rasm ostidagi jonli halqalar
/// foydalanuvchiga kartani qayerga tutishni ko'rsatadi.
class _NfcHero extends StatelessWidget {
  const _NfcHero({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) => Container(
        height: 248,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(R.card),
          border: Border.all(color: C.accent.withValues(alpha: .32)),
          boxShadow: C.e2,
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              'assets/img/premium_contact_sheet.png',
              fit: BoxFit.cover,
              alignment: const Alignment(1, 1),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x12000000), Color(0xE8000000)],
                ),
              ),
            ),
            Align(
              alignment: const Alignment(0, -.05),
              child: Transform.scale(
                scale: .72,
                child: NfcWave(active: active),
              ),
            ),
            Positioned(
              left: S.x20,
              right: S.x20,
              bottom: S.x16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Kartani telefon tepasiga\nyaqinlashtiring', style: T.section),
                  const SizedBox(height: 4),
                  Text(
                    'NFC yoqilgan bo‘lishi kerak',
                    style: T.caption.copyWith(color: C.ink2),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────

/// Katta amal kartasi — skanerlash va yozish.
class _BigAction extends StatelessWidget {
  const _BigAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.highlighted = false,
  });

  final Ico icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  /// Asosiy amal — oltin qirra bilan ajralib turadi.
  final bool highlighted;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .97,
        child: Container(
          height: 128,
          padding: const EdgeInsets.all(S.x16),
          decoration: BoxDecoration(
            // YUZA SHAFFOF EMAS — QORISHTIRILGAN.
            //
            // Ilgari bu yerda shaffof oltin gradient turardi
            // (`accent` 10% → 2%). Ostidagi `rimGlow` esa
            // kartaning ORTIDA to'liq to'rtburchak bo'lib
            // chiziladi — shaffof yuza uni o'tkazib yuborardi va
            // karta butunlay sarg'ish-loyqa bo'lib ketardi,
            // yozuvlari esa xiralashardi.
            //
            // Endi oltin tus `raised` yuzaga OLDINDAN qorishtiriladi:
            // natija bir xil ko'rinadi, lekin yuza qattiq — nur
            // faqat chetdan taraladi.
            gradient: highlighted
                ? LinearGradient(
                    begin: const Alignment(-.8, -1),
                    end: const Alignment(.8, 1),
                    colors: [
                      Color.alphaBlend(
                        C.accent.withValues(alpha: .10),
                        C.surfaceHigh,
                      ),
                      Color.alphaBlend(
                        C.accent.withValues(alpha: .03),
                        C.surface,
                      ),
                    ],
                  )
                : C.raisedSurface,
            borderRadius: BorderRadius.circular(R.card),
            border: Border.all(
              color: highlighted ? C.accent.withValues(alpha: .4) : C.line,
            ),
            boxShadow: highlighted ? C.rimGlow : C.e1,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              NIcon(
                icon,
                size: 24,
                color: highlighted ? C.accent : C.platinum,
              ),
              const Spacer(),
              Text(title, style: T.cardTitle),
              const SizedBox(height: 3),
              Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: T.caption.copyWith(fontSize: 12),
              ),
            ],
          ),
        ),
      );
}

/// "+" katakchasi — yangi ID olish.
class _AddIdTile extends StatelessWidget {
  const _AddIdTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .96,
        child: Container(
          width: 108,
          height: 84,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.card),
            border: Border.all(color: C.line),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              NIcon(Ico.plus, size: 20, color: C.accent),
              const SizedBox(height: 6),
              Text(
                tr('ID qo‘shish'),
                style: T.navLabel.copyWith(color: C.ink2),
              ),
            ],
          ),
        ),
      );
}
