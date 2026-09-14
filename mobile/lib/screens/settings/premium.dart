import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/logo.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../orders/my_orders.dart';

/// PROFIL PREMIUM.
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
///
/// NARX VA MUDDAT: narx faqat server javobidagi `amount` dan
/// olinadi. Server obuna MUDDATINI umuman aytmaydi, shuning uchun
/// bu ekranda "oyiga" yoki "yiliga" degan so'z YO'Q — bo'lmagan
/// shartni va'da qilib bo'lmaydi.
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
    final order = _order;

    return ScreenBackdrop(
      aura: Aura.spotlight,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(child: TopBar()),
            SliverToBoxAdapter(child: ScreenTitle(tr('Profil Premium'))),

            // HERO — narx FAQAT server javobidan.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: _Hero(active: active, order: order),
              ),
            ),

            if (active)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x16,
                    S.gutter,
                    S.x32,
                  ),
                  child: Text(
                    tr('Barcha imkoniyatlar ochiq. Rahmat!'),
                    textAlign: TextAlign.center,
                    style: T.caption,
                  ),
                ),
              )
            else if (order != null)
              // TO'LOV OCHILGANDAN KEYIN.
              //
              // Ilova to'lov o'tganini O'ZI belgilamaydi — buni faqat
              // server aytadi. Shuning uchun bu yerda "to'landi"
              // deyilmaydi: odam «Buyurtmalarim» ga yo'naltiriladi,
              // holat o'sha yerda serverdan o'qiladi.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x24,
                    S.gutter,
                    S.x32,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        tr('To‘lov sahifasi ochildi. Yakunlangach premium o‘zi '
                            'faollashadi.'),
                        textAlign: TextAlign.center,
                        style: T.caption,
                      ),
                      const SizedBox(height: S.x20),
                      if (order.payLink != null)
                        SecondaryButton(
                          tr('To‘lov sahifasini qayta ochish'),
                          onTap: () => openExternal(Uri.parse(order.payLink!)),
                        ),
                      const SizedBox(height: S.x8),
                      GhostButton(
                        tr('Buyurtmalarim'),
                        expand: true,
                        color: C.ink2,
                        onTap: () =>
                            push(context, (_) => const MyOrdersScreen()),
                      ),
                      const SizedBox(height: S.x16),
                      _ServerNote(),
                    ],
                  ),
                ),
              )
            else ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x24,
                    S.gutter,
                    0,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Eyebrow(tr('Nimalar kiradi')),
                      const SizedBox(height: S.x12),
                      RowGroup(
                        children: [
                          // Ro'yxat FUNKSIYA orqali olinadi: `static
                          // final` bo'lsa, til almashganda muzlab
                          // qolardi.
                          for (final f in _features())
                            ListRow(
                              title: f.title,
                              subtitle: f.hint,
                              chevron: false,
                              leading: _Tick(),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x24,
                    S.gutter,
                    S.x32,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        Text(
                          _error!,
                          style: T.caption.copyWith(color: C.fail),
                        ),
                        const SizedBox(height: S.x12),
                      ],
                      PrimaryButton(
                        tr('Premium olish'),
                        loading: _busy,
                        onTap: _busy ? null : _request,
                      ),
                      const SizedBox(height: S.x12),
                      Text(
                        tr('To‘lov Payme orqali. Narx to‘lov ekranida '
                            'ko‘rsatiladi.'),
                        textAlign: TextAlign.center,
                        style: T.caption.copyWith(fontSize: 12.5),
                      ),
                      const SizedBox(height: S.x12),
                      _ServerNote(),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// HERO KARTA.
///
/// Narx SERVER JAVOBIDAN keladi (`amount`) va u faqat so'rovdan
/// keyin ma'lum bo'ladi — mijozda narx jadvali YO'Q. Shu sababli
/// narx joyi so'rovgacha bo'sh emas, balki serverdan olinishi
/// yozib qo'yiladi.
class _Hero extends StatelessWidget {
  const _Hero({required this.active, required this.order});

  final bool active;
  final Order? order;

  @override
  Widget build(BuildContext context) {
    final price = order?.price;
    return Surface(
      padding: const EdgeInsets.all(S.x20),
      radius: R.hero,
      glow: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const BrandMark(size: 48, glow: true),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Eyebrow(tr('Profil Premium')),
                    const SizedBox(height: 4),
                    Text(
                      active
                          ? tr('Premium faol')
                          : tr('Profilingiz uchun kengaytirilgan imkoniyatlar'),
                      style: T.cardTitle,
                    ),
                  ],
                ),
              ),
              if (active) ...[
                const SizedBox(width: S.x12),
                StatusChip(tr('Faol'), tone: StatusTone.ok),
              ],
            ],
          ),
          if (price != null) ...[
            const SizedBox(height: S.x20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(som(price), style: T.price),
                const SizedBox(width: S.x8),
                Text(tr('so‘m'), style: T.amount.copyWith(color: C.ink2)),
              ],
            ),
            const SizedBox(height: 6),
            // MUDDAT YOZILMAYDI: server obuna davrini aytmaydi.
            Text(
              tr('Summa server javobidan olindi.'),
              style: T.caption.copyWith(color: C.ink3),
            ),
          ] else if (!active) ...[
            const SizedBox(height: S.x16),
            Text(
              tr('Narx to‘lov so‘ralganda serverdan olinadi.'),
              style: T.caption.copyWith(color: C.ink3),
            ),
          ],
        ],
      ),
    );
  }
}

/// Ro'yxatdagi belgi — imkoniyat kiradi.
class _Tick extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          color: C.accent.withValues(alpha: .12),
          shape: BoxShape.circle,
          border: Border.all(color: C.accent.withValues(alpha: .38)),
        ),
        alignment: Alignment.center,
        child: NIcon(Ico.check, size: 14, color: C.accent),
      );
}

/// TO'LOVNI FAQAT SERVER TASDIQLAYDI.
class _ServerNote extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Text(
        tr('Premium holatini faqat server tasdiqlaydi. Provayder '
            'ilovasidan qaytish o‘zi tasdiq emas.'),
        textAlign: TextAlign.center,
        style: T.caption.copyWith(color: C.ink3),
      );
}

/// Premium imkoniyatlari.
///
/// NARX BU YERDA YO'Q: u serverdan keladi. Ilovada yozib qo'yilsa,
/// saytda narx o'zgarganda ikkalasi mos kelmay qolardi.
/// Funksiya, `final` emas: tarjima til almashganda qayta
/// hisoblansin.
List<({String title, String hint})> _features() =>
    <({String title, String hint})>[
      (
        title: tr('Tasdiqlangan nishon'),
        hint: tr('Profil nomingiz yonida ko‘rinadi.')
      ),
      (
        title: tr('Ko‘proq post va story'),
        hint: tr('Chegara kengayadi.')
      ),
      (
        title: tr('To‘liq statistika'),
        hint: tr('Kunlik grafik va manbalar.')
      ),
      (
        title: tr('Jismoniy karta dizayni'),
        hint: tr('O‘z maketingiz bilan buyurtma.')
      ),
    ];
