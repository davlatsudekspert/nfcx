import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/backdrop.dart';
import 'package:nfcstore/design/components/buttons.dart';
import 'package:nfcstore/design/components/icons.dart';
import 'package:nfcstore/design/components/identity_card.dart';
import 'package:nfcstore/design/components/input.dart';
import 'package:nfcstore/design/components/logo.dart';
import 'package:nfcstore/design/components/nav_bar.dart';
import 'package:nfcstore/design/components/skeleton.dart';
import 'package:nfcstore/design/components/states.dart';
import 'package:nfcstore/design/components/story_ring.dart';
import 'package:nfcstore/design/components/surface.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/design/type.dart';

import 'preview.dart';

void main() {
  setUpAll(loadFonts);

  testWidgets('tokenlar lavhasi', (tester) async {
    mockImageCacheDir();
    await shot(tester, const _Tokens(), 'tokens', size: const Size(390, 1180));
  });

  testWidgets('komponentlar lavhasi', (tester) async {
    mockImageCacheDir();
    await shot(
      tester,
      const _Components(),
      'components',
      size: const Size(390, 1500),
    );
  });

  testWidgets('metall kartalar', (tester) async {
    mockImageCacheDir();
    await shot(tester, const _Cards(), 'cards', size: const Size(390, 1240));
  });
}

// ─────────────────────────────────────────────────────────────

class _Tokens extends StatelessWidget {
  const _Tokens();

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.home,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(S.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 30),
              Row(
                children: [
                  const BrandMark(size: 46),
                  const SizedBox(width: S.x12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('NFCSTORE · Yorug‘ metall', style: T.h2),
                        const SizedBox(height: 3),
                        const Eyebrow('Dizayn tokenlari · mobil (dp)'),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: S.x24),
              const Eyebrow('Fon va yuzalar'),
              const SizedBox(height: S.x12),
              Row(
                children: [
                  _Swatch('background.primary', '#0A0805', color: C.bg),
                  _Swatch('surface.raised', '#141009', color: C.surface),
                  _Swatch('background.cool', '#080A0E', color: C.bgCool),
                ],
              ),
              const SizedBox(height: S.x24),
              const Eyebrow('Matn · chiziq · urg‘u · holat'),
              const SizedBox(height: S.x12),
              Row(
                children: [
                  _Swatch('text.primary', '#FAF7F0', color: C.ink),
                  _Swatch('text.secondary', '#98918A', color: C.ink2),
                  _Swatch('text.muted', '#5F5A55', color: C.ink3),
                ],
              ),
              const SizedBox(height: S.x8),
              Row(
                children: [
                  _Swatch('action.primary', 'gradient',
                      gradient: C.actionFace),
                  _Swatch('accent.secondary', '#FF9F43',
                      color: C.accentSecondary),
                  _Swatch('state.success', '#63D694', color: C.ok),
                ],
              ),
              const SizedBox(height: S.x24),
              const Eyebrow('Tarif materiallari · o‘zgarmaydi'),
              const SizedBox(height: S.x12),
              Row(
                children: [
                  for (final t in Tier.values)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              height: 54,
                              decoration: BoxDecoration(
                                gradient: TierStyle.of(t).hasMaterial
                                    ? TierStyle.of(t).swatch
                                    : null,
                                borderRadius: BorderRadius.circular(R.tile),
                                border: TierStyle.of(t).hasMaterial
                                    ? null
                                    : Border.all(
                                        color: C.ink3,
                                        style: BorderStyle.solid,
                                      ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              TierStyle.of(t).label,
                              style: T.navLabel.copyWith(color: C.ink2),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: S.x24),
              const Eyebrow('Tipografika'),
              const SizedBox(height: S.x12),
              Text('Aa Oo G‘o‘', style: T.display),
              Text('display / Instrument Serif 46', style: T.meta),
              const SizedBox(height: S.x12),
              Text('Sarlavha 800', style: T.h1),
              Text('title / Manrope 800 · 26', style: T.meta),
              const SizedBox(height: S.x12),
              Text('Tana matni 15/1.55 — o‘zbek lotin belgilari.',
                  style: T.body),
              Text('body / Manrope 400', style: T.meta),
              const SizedBox(height: S.x12),
              Text('GLD777 · 149 000', style: T.code(19)),
              Text('mono / IBM Plex Mono 600', style: T.meta),
              const SizedBox(height: S.x24),
              const Eyebrow('Masofa · radius · harakat'),
              const SizedBox(height: S.x12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (final v in [4.0, 8.0, 12.0, 16.0, 20.0, 24.0, 32.0])
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: Container(
                        width: v,
                        height: v,
                        decoration: BoxDecoration(
                          gradient: C.actionFace,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: S.x12),
              Text(
                'press 120 · fade 200 · push 280 + 8 dp · sheet 280\n'
                'flip 720 · mavzu 420 · sweep 4.2 s · halqa 9 s',
                style: T.meta.copyWith(height: 1.7),
              ),
              const SizedBox(height: S.x32),
            ],
          ),
        ),
      );
}

class _Swatch extends StatelessWidget {
  const _Swatch(this.name, this.hex, {this.color, this.gradient});

  final String name;
  final String hex;
  final Color? color;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 58,
                decoration: BoxDecoration(
                  color: color,
                  gradient: gradient,
                  borderRadius: BorderRadius.circular(R.tile),
                  border: Border.all(color: C.line),
                ),
              ),
              const SizedBox(height: 6),
              Text(name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.navLabel.copyWith(color: C.ink2)),
              Text(hex, style: T.meta.copyWith(fontSize: 10)),
            ],
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────

class _Components extends StatelessWidget {
  const _Components();

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.none,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(S.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 30),
              Text('Komponentlar', style: T.title),
              const SizedBox(height: S.x24),
              const Eyebrow('Tugmalar · 48 dp minimal bosish maydoni'),
              const SizedBox(height: S.x12),
              PrimaryButton('Kontaktni saqlash', onTap: () {}),
              const SizedBox(height: S.x8),
              Wrap(
                spacing: S.x8,
                runSpacing: S.x8,
                children: [
                  PrimaryButton('Asosiy · M',
                      size: BtnSize.m, expand: false, onTap: () {}),
                  PrimaryButton('Asosiy · S',
                      size: BtnSize.s, expand: false, onTap: () {}),
                  const PrimaryButton('O‘chiq', size: BtnSize.s, expand: false),
                  SecondaryButton('Ikkilamchi',
                      size: BtnSize.m, expand: false, onTap: () {}),
                  GhostButton('Ghost', onTap: () {}),
                  const PrimaryButton('Yuklanmoqda',
                      size: BtnSize.m, expand: false, loading: true),
                ],
              ),
              const SizedBox(height: S.x8),
              DangerButton('Postni o‘chirish', size: BtnSize.m, onTap: () {}),
              const SizedBox(height: S.x24),
              const Eyebrow('Maydonlar · 56 dp'),
              const SizedBox(height: S.x12),
              Field(
                label: 'Ism va familiya',
                controller: TextEditingController(text: 'Dilshod Karimov'),
              ),
              const SizedBox(height: S.x16),
              Field(
                label: 'Lavozim',
                maxLength: 60,
                counter: true,
                controller: TextEditingController(text: 'Savdo direktori'),
                helper: 'Ochiq profilda ko‘rinadi',
              ),
              const SizedBox(height: S.x16),
              Field(
                label: 'Telegram',
                controller: TextEditingController(text: 't.me dilshod'),
                error: 'Havola “t.me/” bilan boshlanishi kerak',
              ),
              const SizedBox(height: S.x16),
              CodeField(
                controller: TextEditingController(text: '481'),
                autofocus: false,
              ),
              const SizedBox(height: S.x24),
              const Eyebrow('Chip · badge · switch'),
              const SizedBox(height: S.x12),
              Wrap(
                spacing: S.x8,
                runSpacing: S.x8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  FilterChip('Hammasi', active: true, onTap: () {}),
                  FilterChip('Restoran', onTap: () {}),
                  const StatusChip('Tasdiqlandi', tone: StatusTone.ok),
                ],
              ),
              const SizedBox(height: S.x8),
              Wrap(
                spacing: S.x8,
                runSpacing: S.x8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const StatusChip('Tayyorlanmoqda', tone: StatusTone.pending),
                  const StatusChip('Bekor qilindi', tone: StatusTone.fail),
                  Toggle(value: true, onChanged: (_) {}),
                  Toggle(value: false, onChanged: (_) {}),
                ],
              ),
              const SizedBox(height: S.x24),
              const Eyebrow('Avatar va story halqasi'),
              const SizedBox(height: S.x12),
              const Wrap(
                spacing: S.x12,
                runSpacing: S.x12,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  StoryRing(addButton: true, showLabel: false),
                  StoryRing(name: 'Malika', showLabel: false),
                  StoryRing(name: 'Aziz', reels: true, showLabel: false),
                  StoryRing(name: 'Nodira', seen: true, showLabel: false),
                  VerifiedBadge(size: 20),
                ],
              ),
              const SizedBox(height: S.x24),
              const Eyebrow('Statistika va ro‘yxat'),
              const SizedBox(height: S.x12),
              const StatRow(
                tiles: [
                  StatTile(value: '4 812', label: 'Ko‘rish'),
                  StatTile(value: '312', label: 'Kontakt'),
                  StatTile(value: '1 204', label: 'Obunachi'),
                ],
              ),
              const SizedBox(height: S.x12),
              RowGroup(
                children: [
                  ListRow(
                    title: 'Mening ID’larim',
                    subtitle: '2 faol ID',
                    leading: const NIcon(Ico.card, size: 20),
                    onTap: () {},
                  ),
                  ListRow(
                    title: 'Profil Premium',
                    subtitle: '20 000 so‘m',
                    leading: const NIcon(Ico.sparkle, size: 20),
                    onTap: () {},
                  ),
                ],
              ),
              const SizedBox(height: S.x24),
              const Eyebrow('Skeleton va bo‘sh holat'),
              const SizedBox(height: S.x12),
              const SkeletonRow(),
              const SizedBox(height: S.x8),
              const EmptyState(
                'Birinchi story 24 soat ko‘rinadi.',
                title: 'Hali story yo‘q',
                icon: Ico.image,
                compact: true,
              ),
              const SizedBox(height: S.x32),
              const _NavPreview(),
            ],
          ),
        ),
      );
}

class _NavPreview extends StatelessWidget {
  const _NavPreview();

  @override
  Widget build(BuildContext context) => NavBar(active: 0, onSelect: (_) {});
}

// ─────────────────────────────────────────────────────────────

class _Cards extends StatelessWidget {
  const _Cards();

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.spotlight,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(S.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 30),
              Text('Metall materiallar', style: T.title),
              const SizedBox(height: S.x24),
              for (final t in [
                Tier.gold,
                Tier.exclusive,
                Tier.silver,
                Tier.bronze,
                Tier.premium,
              ]) ...[
                IdentityCard(
                  code: switch (t) {
                    Tier.gold => 'GLD777',
                    Tier.exclusive => 'VIP',
                    Tier.silver => 'SLV414',
                    Tier.bronze => 'BRZ101',
                    _ => 'PRM199',
                  },
                  tier: t,
                  holder: 'Dilshod Karimov',
                  url: 'nfcstore.uz/gld777',
                  sweep: false,
                ),
                const SizedBox(height: S.x16),
              ],
              Row(
                children: [
                  const MiniIdCard(code: 'GLD777', tier: Tier.gold, active: true),
                  const SizedBox(width: S.x12),
                  const MiniIdCard(code: 'SLV414', tier: Tier.silver),
                ],
              ),
              const SizedBox(height: S.x32),
            ],
          ),
        ),
      );
}
