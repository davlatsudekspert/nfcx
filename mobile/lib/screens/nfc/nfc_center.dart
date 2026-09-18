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
import '../identity/profile_stats.dart';
import 'qr_share.dart';
import '../../state/scan_history.dart';
import 'scan_history_screen.dart';
import 'tag_info.dart';

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
  /// Tegizishlar tarixi — "Bosh karta: yozilgan" chipi shundan
  /// o'qiydi.
  final _history = ScanHistory();

  int _gifts = 0;

  @override
  void initState() {
    super.initState();
    _history.addListener(_onHistory);
    _history.load();
  }

  @override
  void dispose() {
    _history.removeListener(_onHistory);
    _history.dispose();
    super.dispose();
  }

  void _onHistory() {
    if (mounted) setState(() {});
  }

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
    try {
      await AppScope.read(context).refreshIdentities();
      await _loadGifts();
    } finally {
      if (mounted) setState(() {});
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
            onTap: () => Navigator.of(context, rootNavigator: true).pop('open'),
          ),
          SheetAction(
            label: tr('Asosiy ID qilish'),
            icon: Ico.star,
            subtitle: tr('Ilova shu ID bilan ochiladi'),
            onTap: () => Navigator.of(context, rootNavigator: true).pop('primary'),
          ),
          SheetAction(
            label: tr('Kartaga yozish'),
            icon: Ico.write,
            onTap: () => Navigator.of(context, rootNavigator: true).pop('write'),
          ),
          SheetAction(
            label: tr('Sovg‘a qilish'),
            icon: Ico.gift,
            onTap: () => Navigator.of(context, rootNavigator: true).pop('gift'),
          ),
          const RowDivider(indent: 0),
          SheetAction(
            label: tr('ID‘ni o‘chirish'),
            icon: Ico.trash,
            danger: true,
            onTap: () => Navigator.of(context, rootNavigator: true).pop('delete'),
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
                tr('Kartani o‘qing,'),
                accent: tr('yozing, boshqaring'),
                eyebrow: tr('NFC markazi'),
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

              // SKANERLASH QUTISI (prototip: `.scanbox`).
              //
              // Markazda — SIZNING kartangizning kichik nusxasi:
              // odam telefonga qaysi kartani tegizishini ko'rib
              // turadi. Ortida urg'u rangli yumshoq nur va
              // skanerlash paytida tarqaladigan to'lqinlar.
              Padding(
                padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
                child: _ScanBox(
                  identity: active,
                  onScan: () => push<void>(context, (_) => const NfcScanScreen()),
                ),
              ),
              const SizedBox(height: S.x24),

              // NFC TOOLS — uchtadan ikki qator (prototip: `.tools`).
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: SectionHeader(
                  tr('NFC Tools'),
                  actionLabel: tr('QR bilan ulashish'),
                  onAction: active == null
                      ? null
                      : () => push<void>(
                            context,
                            (_) => QrShareScreen(identity: active),
                          ),
                  // BOSH KARTA YOZILGANMI (prototip: yashil chip).
                  //
                  // Belgi SHU TELEFONDA saqlanadi: teg fizik narsa
                  // va uni kim yozganini serverdan bilib bo'lmaydi.
                  // Yozilmagan bo'lsa chip umuman ko'rsatilmaydi —
                  // "yozilmagan" degan qizil yozuv yangi
                  // foydalanuvchini bekorga qo'rqitardi.
                  trailing: active != null && _history.wroteCode(active.code)
                      ? StatusChip(
                          tr('Bosh karta: yozilgan'),
                          tone: StatusTone.ok,
                        )
                      : null,
                ),
              ),
              const SizedBox(height: S.x12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: _Tools(
                  identity: active,
                  onScan: () => push<void>(context, (_) => const NfcScanScreen()),
                  onWrite: () => push<void>(context, (_) => const NfcWriteScreen()),
                ),
              ),
              const SizedBox(height: S.x8),

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
/// SKANERLASH QUTISI (prototip: `.scanbox`).
///
/// Ortidagi nur — urg'u rangining yumshoq radial gradienti. Kartaning
/// kichik nusxasi biroz burilgan: u "qo'lda ushlab turilgan" hisni
/// beradi va tekis turgan to'rtburchakdan ko'ra jonliroq.
class _ScanBox extends StatelessWidget {
  const _ScanBox({required this.identity, required this.onScan});

  final Identity? identity;
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(S.x20, S.x24, S.x20, S.x20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(R.card),
          border: Border.all(color: C.line),
          gradient: RadialGradient(
            center: const Alignment(0, -1),
            radius: 1.2,
            colors: [
              C.accent.withValues(alpha: C.palette.light ? .16 : .26),
              C.surface,
            ],
            stops: const [0, .62],
          ),
        ),
        child: Column(
          children: [
            if (identity != null)
              Transform.rotate(
                angle: -.14,
                child: SizedBox(
                  width: 156,
                  child: IdentityCard(
                    code: identity!.code,
                    tier: identity!.record?.tier ?? Tier.free,
                    holder: identity!.name,
                    url: identity!.publicUrl.replaceFirst('https://', ''),
                    flippable: false,
                  ),
                ),
              )
            else
              NfcWave(size: 96, active: true),
            const SizedBox(height: S.x20),
            Text(
              tr('Kartani telefon orqasiga tegizing'),
              textAlign: TextAlign.center,
              style: T.section,
            ),
            const SizedBox(height: 6),
            Text(
              tr('NFC yoqilgan. Skanerlashni boshlang va kartani '
                  'yaqinlashtiring.'),
              textAlign: TextAlign.center,
              style: T.caption.copyWith(fontSize: 12.5),
            ),
            const SizedBox(height: S.x16),
            PrimaryButton(tr('Skanerlashni boshlash'), onTap: onScan),
          ],
        ),
      );
}

/// NFC TOOLS — uchtadan ikki qator shisha plita (prototip: `.tools`).
class _Tools extends StatelessWidget {
  const _Tools({
    required this.identity,
    required this.onScan,
    required this.onWrite,
  });

  final Identity? identity;
  final VoidCallback onScan;
  final VoidCallback onWrite;

  @override
  Widget build(BuildContext context) {
    final items = <({Ico icon, String title, String sub, VoidCallback? tap})>[
      (icon: Ico.scan, title: tr('Skanerlash'), sub: tr('Kartani o‘qish'), tap: onScan),
      (icon: Ico.write, title: tr('Kartaga yozish'), sub: tr('Profil havolasi'), tap: onWrite),
      (
        icon: Ico.shield,
        title: tr('Kartani tekshirish'),
        sub: tr('Haqiqiylik'),
        // Haqiqiylik ham teg ma'lumotidan ko'rinadi: ichidagi
        // yozuv NFCSTORE havolasimi yoki yo'q.
        tap: () => push<void>(context, (_) => const TagInfoScreen()),
      ),
      (
        icon: Ico.qr,
        title: 'QR',
        sub: tr('Yaratish · skanerlash'),
        tap: identity == null
            ? null
            : () => push<void>(context, (_) => QrShareScreen(identity: identity!)),
      ),
      (
        icon: Ico.info,
        title: tr('Teg ma’lumoti'),
        sub: tr('Turi, hajmi, qulf'),
        tap: () => push<void>(context, (_) => const TagInfoScreen()),
      ),
      (
        // PROTOTIPDA OLTINCHI KATAK — "Tegizishlar tarixi".
        //
        // Bu SHU TELEFON nimalarga tekkani: begona teg ham, bo'sh
        // teg ham shu yerda. O'z kartangizga kim tekkani esa
        // profil statistikasida ("Ko'rish") — ikki xil savol.
        icon: Ico.clock,
        title: tr('Tegizishlar tarixi'),
        sub: tr('Oxirgi skanerlar'),
        tap: () => push<void>(context, (_) => const ScanHistoryScreen()),
      ),
      (
        icon: Ico.chart,
        title: tr('Tegish statistikasi'),
        sub: tr('Kun · hafta · oy'),
        tap: identity == null
            ? null
            : () => push<void>(
                  context,
                  (_) => ProfileStatsScreen(
                    code: identity!.code,
                    name: identity!.name,
                  ),
                ),
      ),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: S.x12,
      crossAxisSpacing: S.x12,
      childAspectRatio: 1.28,
      children: [
        for (final it in items)
          _ToolTile(icon: it.icon, title: it.title, sub: it.sub, onTap: it.tap),
      ],
    );
  }
}

class _ToolTile extends StatelessWidget {
  const _ToolTile({
    required this.icon,
    required this.title,
    required this.sub,
    this.onTap,
  });

  final Ico icon;
  final String title;
  final String sub;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final on = onTap != null;
    final tint = on ? C.accent : C.ink3;

    return Press(
      onTap: onTap,
      minSize: 0,
      scale: .97,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              C.surface,
              C.surfaceHigh.withValues(alpha: .94),
            ],
          ),
          borderRadius: BorderRadius.circular(R.card),
          border: Border.all(
            color: on
                ? C.accent.withValues(alpha: .20)
                : C.lineCool,
          ),
          boxShadow: C.e1,
        ),
        child: Stack(
          children: [
            // MINI-ILLUSTRATSIYA: funksiyaning o'z belgisi katta,
            // yumshoq metall nurlar ichida. Oldingi kataklarda ikon
            // juda kichik bo'lib, qolgan joy bo'sh qolardi.
            Positioned(
              right: -10,
              top: -12,
              child: Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      tint.withValues(alpha: on ? .22 : .10),
                      tint.withValues(alpha: 0),
                    ],
                  ),
                ),
                alignment: Alignment.center,
                child: NIcon(
                  icon,
                  size: 44,
                  color: tint.withValues(alpha: on ? .42 : .24),
                ),
              ),
            ),
            Positioned(
              right: 18,
              top: 52,
              child: Container(
                width: 34,
                height: 2,
                decoration: BoxDecoration(
                  color: tint.withValues(alpha: .20),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(S.x12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          tint.withValues(alpha: .22),
                          tint.withValues(alpha: .08),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: tint.withValues(alpha: .24),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: NIcon(icon, size: 19, color: tint),
                  ),
                  const Spacer(),
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle.copyWith(
                      fontSize: 13.5,
                      color: on ? C.ink : C.ink3,
                      height: 1.16,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.caption.copyWith(
                      fontSize: 11,
                      color: on ? C.ink2 : C.ink3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
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
