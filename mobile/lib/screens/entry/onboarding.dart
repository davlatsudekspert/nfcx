import 'package:flutter/widgets.dart';
import '../../design/components/icons.dart';
import '../../design/components/buttons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/media.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';

/// Uch panelli tanishtiruv.
///
/// Har panelning tepasida ilovaning HAQIQIY elementi ko'rsatiladi
/// (metall ID kartasi, shaxs ro'yxati, biznes profil) — sxematik rasm
/// emas. Odam birinchi ekrandayoq mahsulotni ko'radi.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onDone});
  final VoidCallback onDone;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pager = PageController();
  int _page = 0;

  static const _panels = [
    (
      title: 'Bitta teginish —\nbarcha kontaktlaringiz',
      body: 'Telefon, ijtimoiy tarmoqlar, sayt va boshqa muhim '
          'ma‘lumotlaringizni bitta raqamli profilda jamlang va NFC karta '
          'orqali ulashing.',
    ),
    (
      title: 'Bitta akkaunt,\nko‘p shaxs',
      body: 'Shaxsiy va biznes ID‘laringiz bir joyda. Sarlavhaga tegib, '
          'faol shaxsni bir tegishda almashtirasiz.',
    ),
    (
      title: 'Biznesingiz —\nmobil do‘kon',
      body: 'Mahsulot, narx, ish vaqti va buyurtma — hammasi profilingizda. '
          'Mijoz kartani o‘qiydi va to‘g‘ridan-to‘g‘ri buyurtma beradi.',
    ),
  ];

  @override
  void dispose() {
    _pager.dispose();
    super.dispose();
  }

  void _next() {
    if (_page >= _panels.length - 1) {
      widget.onDone();
    } else {
      _pager.nextPage(duration: M.push, curve: M.curve);
    }
  }

  @override
  Widget build(BuildContext context) {
    final last = _page == _panels.length - 1;
    return ColoredBox(
      color: C.obsidian,
      child: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, S.x8, S.gutter, 0),
                child: GestureDetector(
                  onTap: widget.onDone,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.all(S.x8),
                    child: Text('O‘tkazish', style: T.caption.copyWith(color: C.ash)),
                  ),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pager,
                itemCount: _panels.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) => _Panel(index: i, data: _panels[i]),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < _panels.length; i++)
                  AnimatedContainer(
                    duration: M.fade,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == _page ? 18 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: i == _page ? C.champagne : C.hairline,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(S.gutter, S.x24, S.gutter, S.x16),
              child: Column(
                children: [
                  PrimaryButton(last ? 'Boshlash' : 'Keyingisi', onTap: _next),
                  if (last) ...[
                    const SizedBox(height: S.x12),
                    GhostButton('Akkauntim bor', onTap: widget.onDone),
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

class _Panel extends StatelessWidget {
  const _Panel({required this.index, required this.data});
  final int index;
  final ({String title, String body}) data;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Spacer(),
            SizedBox(height: 230, child: _art(index)),
            const Spacer(),
            Text(data.title, style: T.display),
            const SizedBox(height: S.x16),
            Text(data.body, style: T.body),
            const SizedBox(height: S.x32),
          ],
        ),
      );

  Widget _art(int i) {
    switch (i) {
      case 0:
        return const Center(
          child: IdentityCard(
            code: 'VIP001', holder: 'Aziz Karimov',
            subtitle: 'Shaxsiy profil', taps: 284, tier: Tier.exclusive,
          ),
        );
      case 1:
        return Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            _IdRow(name: 'Aziz Karimov', code: 'VIP001', type: 'SHAXSIY', active: false),
            SizedBox(height: S.x8),
            _IdRow(name: 'Ali Market', code: 'AAA111', type: 'BIZNES', active: false),
            SizedBox(height: S.x8),
            _IdRow(name: 'NFCSTORE', code: 'DDD333', type: 'BIZNES', active: true),
          ],
        );
      default:
        return Surface(
          padding: EdgeInsets.zero,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(
                height: 92, width: double.infinity,
                child: MediaSlot(label: 'COVER 16:7', radius: R.card),
              ),
              Padding(
                padding: const EdgeInsets.all(S.x12),
                child: Row(
                  children: [
                    const Avatar(name: 'Ali Market', size: 38),
                    const SizedBox(width: S.x12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Ali Market', style: T.cardTitle),
                          Text('Do‘kon · Toshkent', style: T.caption),
                        ],
                      ),
                    ),
                    const StatusChip('Ochiq', tone: StatusTone.ok),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(S.x12, 0, S.x12, S.x12),
                child: Row(
                  children: const [
                    Expanded(child: AspectRatio(aspectRatio: 1, child: MediaSlot(label: '5:4'))),
                    SizedBox(width: S.x8),
                    Expanded(child: AspectRatio(aspectRatio: 1, child: MediaSlot(label: '5:4'))),
                  ],
                ),
              ),
            ],
          ),
        );
    }
  }
}

class _IdRow extends StatelessWidget {
  const _IdRow({required this.name, required this.code, required this.type, required this.active});
  final String name;
  final String code;
  final String type;
  final bool active;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        border: active ? C.champagne.withValues(alpha: .35) : null,
        child: Row(
          children: [
            Avatar(name: name, size: 36),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: T.cardTitle.copyWith(fontSize: 13)),
                  Text('$code · $type', style: T.meta.copyWith(fontSize: 10.5)),
                ],
              ),
            ),
            if (active) const NIcon(Ico.check, size: 16, color: C.champagne),
          ],
        ),
      );
}
