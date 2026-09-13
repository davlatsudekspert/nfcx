import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import '../identity/id_chip.dart';
import '../identity/profile_screen.dart';
import 'gift_id.dart';
import 'id_catalog.dart';
import 'nfc_scan.dart';
import 'nfc_write.dart';
import 'order_card.dart';
import 'qr_share.dart';

/// NFC CENTER — mahsulotning o'zagi.
///
/// Faol ID katta karta sifatida, uning ostida tezkor amallar, keyin
/// egalik qilinadigan barcha ID'lar ro'yxati va oxirida "yangi ID olish".
class NfcCenterScreen extends StatefulWidget {
  const NfcCenterScreen({super.key});

  @override
  State<NfcCenterScreen> createState() => _NfcCenterScreenState();
}

class _NfcCenterScreenState extends State<NfcCenterScreen> {
  bool _refreshing = false;

  Future<void> _refresh() async {
    setState(() => _refreshing = true);
    try {
      await AppScope.read(context).refreshIdentities();
    } catch (_) {
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final active = state.active;
    final owned = state.cards;

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: _refresh,
        color: C.champagne,
        backgroundColor: C.slate,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: S.x32),
          children: [
            ScreenTitle('NFC', subtitle: 'ID‘laringiz va kartalar', trailing: const IdChip()),
            if (active == null && !_refreshing)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Column(
                  children: [
                    const EmptyState('Hali NFC ID‘ingiz yo‘q.'),
                    _NewIdCard(onTap: () => push(context, (_) => const IdCatalogScreen())),
                  ],
                ),
              )
            else if (active == null)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: S.gutter),
                child: SkeletonCard(),
              )
            else ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Eyebrow('Faol ID'),
                    const SizedBox(height: S.x8),
                    IdentityCard(
                      code: active.code,
                      holder: active.name,
                      subtitle: active.isBusiness ? 'Biznes' : 'Shaxsiy',
                      tier: active.isBusiness ? Tier.gold : (active.record?.tier ?? Tier.free),
                      // Havola va ko'rishlar soni — bu ekran
                      // mahsulotning o'zagi, karta shu yerda eng to'liq
                      // ko'rinishda bo'lishi kerak.
                      url: active.publicUrl.replaceFirst('https://', ''),
                      taps: active.record?.views,
                      active: true,
                      onTap: () => push(context, (_) => ProfileScreen(identity: active)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: S.x16),
              _Actions(active: active, owned: owned),
            ],
            const SizedBox(height: S.x16),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: S.gutter),
              child: _NfcActions(),
            ),
            if (owned.isNotEmpty) ...[
              const SizedBox(height: S.x32),
              SectionHeader('Mening ID‘larim', actionLabel: '${owned.length} TA'),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Column(
                  children: [
                    for (var i = 0; i < owned.length; i++) ...[
                      if (i > 0) const SizedBox(height: S.x8),
                      _OwnedRow(
                        record: owned[i],
                        active: owned[i].code == active?.code,
                        onTap: () => state.switchIdentity(Identity.personal(owned[i])),
                      ),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: S.x16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: S.gutter),
              child: _NewIdCard(onTap: () => push(context, (_) => const IdCatalogScreen())),
            ),
          ],
        ),
      ),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({required this.active, required this.owned});
  final Identity active;
  final List<Record> owned;

  @override
  Widget build(BuildContext context) {
    // Karta buyurtmasi va sovg'a — FAQAT o'z SHAXSIY ID'sida.
    // Biznes profilini sovg'a qilish alohida oqim (egalik, katalog va
    // buyurtmalar ham ko'chadi) va backend uni
    // `/api/records/:code/gift` orqali qo'llab-quvvatlamaydi.
    final card = active.record;
    final ownsCard = card != null && owned.any((c) => c.code == card.code);

    final items = <({Ico icon, String label, VoidCallback? onTap})>[
      (icon: Ico.qr, label: 'QR', onTap: () => push(context, (_) => QrShareScreen(identity: active))),
      (icon: Ico.share, label: 'Ulashish', onTap: () => shareIdentity(active)),
      (
        icon: Ico.card,
        label: 'Karta',
        // Jismoniy karta faqat O'Z shaxsiy ID'siga buyurtma qilinadi.
        onTap: ownsCard ? () => push(context, (_) => OrderCardScreen(record: card)) : null,
      ),
      (
        icon: Ico.gift,
        label: 'Sovg‘a',
        onTap: ownsCard ? () => push(context, (_) => GiftIdScreen(record: card)) : null,
      ),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: S.gutter),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: S.x8),
            Expanded(
              child: Press(
                onTap: items[i].onTap,
                child: Opacity(
                  opacity: items[i].onTap == null ? .45 : 1,
                  child: Surface(
                    padding: const EdgeInsets.symmetric(vertical: S.x12),
                    shadow: E.e1,
                    child: Column(
                      children: [
                        NIcon(items[i].icon, size: 21, color: C.platinum),
                        const SizedBox(height: 7),
                        Text(items[i].label,
                            style: T.caption.copyWith(fontSize: 10.5, color: C.ash)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// NFC apparatura amallari — o'qish va yozish.
///
/// NIMA UCHUN tezkor amallar qatoridan ALOHIDA: yuqoridagi to'rtlik
/// FAOL ID bilan ishlaydi (QR, ulashish, karta, sovg'a), bular esa
/// telefonning NFC moduli bilan. Aralashtirilsa, qaysi tugma nima
/// qilishi tushunarsiz bo'lardi.
class _NfcActions extends StatelessWidget {
  const _NfcActions();

  @override
  Widget build(BuildContext context) => Column(
        children: [
          _NfcRow(
            icon: Ico.nfc,
            title: 'Kartani o‘qish',
            sub: 'Begona kartani tegizib, profilini oching',
            onTap: () => push(context, (_) => const NfcScanScreen()),
          ),
          const SizedBox(height: S.x8),
          _NfcRow(
            icon: Ico.edit,
            title: 'Kartaga yozish',
            sub: 'Bo‘sh kartaga o‘z ID havolangizni yozing',
            onTap: () => push(context, (_) => const NfcWriteScreen()),
          ),
        ],
      );
}

class _NfcRow extends StatelessWidget {
  const _NfcRow({
    required this.icon,
    required this.title,
    required this.sub,
    required this.onTap,
  });

  final Ico icon;
  final String title;
  final String sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          shadow: E.e1,
          child: Row(
            children: [
              NIcon(icon, size: 20, color: C.platinum),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: T.cardTitle),
                    const SizedBox(height: 2),
                    Text(sub,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.caption.copyWith(fontSize: 11)),
                  ],
                ),
              ),
              const NIcon(Ico.chevronRight, size: 16, color: C.muted),
            ],
          ),
        ),
      );
}

class _OwnedRow extends StatelessWidget {
  const _OwnedRow({required this.record, required this.active, required this.onTap});
  final Record record;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          border: active ? C.champagne.withValues(alpha: .35) : null,
          shadow: E.e1,
          child: Row(
            children: [
              TierDot(record.tier, size: 18),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(record.code, style: T.code.copyWith(fontSize: 13.5)),
                    const SizedBox(height: 2),
                    Text(
                      '${TierStyle.of(record.tier).label} · '
                      '${record.name.isEmpty ? (record.isBusiness ? 'Biznes' : 'Shaxsiy') : record.name}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              if (active) const StatusChip('Faol', tone: StatusTone.pending),
            ],
          ),
        ),
      );
}

class _NewIdCard extends StatelessWidget {
  const _NewIdCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(S.x16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.card),
            border: Border.all(color: C.warmHairline),
          ),
          child: Row(
            children: [
              const NIcon(Ico.plus, size: 20, color: C.champagne),
              const SizedBox(width: S.x12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Yangi NFC ID olish', style: T.cardTitle),
                    SizedBox(height: 2),
                    Text('Bronze‘dan Exclusive‘gacha', style: T.caption),
                  ],
                ),
              ),
              const NIcon(Ico.chevronRight, size: 18, color: C.muted),
            ],
          ),
        ),
      );
}
