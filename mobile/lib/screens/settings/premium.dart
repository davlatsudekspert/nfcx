import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../common/top_bar.dart';
import '../orders/my_orders.dart';

/// PREMIUM PROFIL.
///
/// TO'LOV OQIMI TAKRORLANMAYDI: bu ekran `POST /api/premium/request`
/// ni chaqiradi va serverdan kelgan havolani tashqi ilovada ochadi
/// — `order_card` dagi bilan aynan bir xil naqsh. Premium faol
/// bo'lganini SERVER aytadi (`user.isPremium`); ilova buni o'zi
/// hech qachon belgilamaydi.
///
/// KUTAYOTGAN BUYURTMA XATO EMAS: server o'sha buyurtmaning
/// havolasini qaytaradi, yangisini yaratmaydi. Shu sababli ikki
/// marta pul yechilishi mumkin emas va "davom ettirish" alohida
/// tugma talab qilmaydi.
class PremiumScreen extends StatefulWidget {
  const PremiumScreen({super.key});

  @override
  State<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends State<PremiumScreen> {
  Order? _order;
  bool _busy = false;
  String? _error;

  Future<void> _request() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final order = await AppScope.read(context).repo.requestPremium();
      successHaptic();
      if (!mounted) return;
      setState(() => _order = order);
      // TO'LOV OQIMI TAKRORLANMAYDI: `order_card` dagi kabi
      // serverdan kelgan havola tashqi ilovada ochiladi. Buyurtma
      // «Buyurtmalarim» da ham turadi, ya'ni odam uni istalgan
      // paytda davom ettira oladi.
      final link = order.payLink;
      if (link != null) await openExternal(Uri.parse(link));
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() => _error = switch (e.key) {
              'ALREADY_PREMIUM' => tr('Sizda premium allaqachon bor.'),
              'payments_disabled' => tr('To‘lov tizimi hozir o‘chirilgan.'),
              _ => humanError(e),
            });
      }
    } catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = AppScope.of(context).user;
    final active = user?.isPremium ?? false;

    return ColoredBox(
      color: C.obsidian,
      child: SafeArea(
        child: Column(
          children: [
            TopBar(title: tr('Premium obuna')),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  if (active)
                    _ActiveCard()
                  else if (_order != null)
                    _Pending(order: _order!)
                  else ...[
                    Eyebrow(tr('Nimalar kiradi')),
                    const SizedBox(height: S.x12),
                    Surface(
                      padding: const EdgeInsets.all(S.x16),
                      shadow: E.e1,
                      child: Column(
                        children: [
                          for (final f in _features) ...[
                            _Feature(f.icon, f.title, f.hint),
                            if (f != _features.last) const SizedBox(height: S.x16),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: S.x24),
                    if (_error != null) ...[
                      Text(_error!, style: T.caption.copyWith(color: C.signal)),
                      const SizedBox(height: S.x12),
                    ],
                    PrimaryButton(tr('Premium olish'),
                        loading: _busy, onTap: _busy ? null : _request),
                    const SizedBox(height: S.x12),
                    Text(
                      tr('To‘lov Payme orqali. Narx to‘lov ekranida '
                          'ko‘rsatiladi.'),
                      textAlign: TextAlign.center,
                      style: T.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Premium imkoniyatlari.
///
/// NARX BU YERDA YO'Q: u serverdan keladi. Ilovada yozib qo'yilsa,
/// saytda narx o'zgarganda ikkalasi mos kelmay qolardi.
final _features = <({Ico icon, String title, String hint})>[
  (
    icon: Ico.star,
    title: tr('Tasdiqlangan nishon'),
    hint: tr('Profil nomingiz yonida ko‘rinadi.')
  ),
  (
    icon: Ico.image,
    title: tr('Ko‘proq post va story'),
    hint: tr('Chegara kengayadi.')
  ),
  (
    icon: Ico.chart,
    title: tr('To‘liq statistika'),
    hint: tr('Kunlik grafik va manbalar.')
  ),
  (
    icon: Ico.card,
    title: tr('Jismoniy karta dizayni'),
    hint: tr('O‘z maketingiz bilan buyurtma.')
  ),
];

/// TO'LOV OCHILGANDAN KEYIN.
///
/// Ilova to'lov o'tganini O'ZI belgilamaydi — buni faqat server
/// aytadi. Shuning uchun bu yerda "to'landi" deyilmaydi: odam
/// «Buyurtmalarim» ga yo'naltiriladi, holat o'sha yerda serverdan
/// o'qiladi.
class _Pending extends StatelessWidget {
  const _Pending({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          const SizedBox(height: S.x20),
          NIcon(Ico.clock, size: 28, color: C.champagne),
          const SizedBox(height: S.x12),
          Text(tr('To‘lov kutilmoqda'), style: T.section),
          const SizedBox(height: S.x8),
          Text(
            tr('To‘lov sahifasi ochildi. Yakunlangach premium o‘zi '
                'faollashadi.'),
            textAlign: TextAlign.center,
            style: T.caption,
          ),
          const SizedBox(height: S.x24),
          if (order.payLink != null)
            SecondaryButton(
              tr('To‘lov sahifasini qayta ochish'),
              onTap: () => openExternal(Uri.parse(order.payLink!)),
            ),
          const SizedBox(height: S.x8),
          GhostButton(
            tr('Buyurtmalarim'),
            onTap: () => push(context, (_) => const MyOrdersScreen()),
          ),
        ],
      );
}

class _ActiveCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x20),
        border: C.champagne.withValues(alpha: .35),
        shadow: E.e2,
        child: Column(
          children: [
            NIcon(Ico.star, size: 28, color: C.champagne),
            const SizedBox(height: S.x12),
            Text(tr('Premium faol'), style: T.section),
            const SizedBox(height: S.x8),
            Text(
              tr('Barcha imkoniyatlar ochiq. Rahmat!'),
              textAlign: TextAlign.center,
              style: T.caption,
            ),
          ],
        ),
      );
}

class _Feature extends StatelessWidget {
  const _Feature(this.icon, this.title, this.hint);
  final Ico icon;
  final String title;
  final String hint;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NIcon(icon, size: 19, color: C.champagne),
          const SizedBox(width: S.x12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: T.cardTitle.copyWith(fontSize: 13.5)),
                const SizedBox(height: 2),
                Text(hint, style: T.caption.copyWith(fontSize: 11.5)),
              ],
            ),
          ),
        ],
      );
}
