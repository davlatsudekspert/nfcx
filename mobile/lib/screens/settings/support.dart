import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../design/refresh.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';

/// QO'LLAB-QUVVATLASH.
///
/// UCH QATLAM, TEZLIK BO'YICHA:
///
///   1. TEZ SAVOLLAR — javob darhol, hech kim kutmaydi. Ko'p
///      murojaat aslida shu yerda tugaydi.
///   2. TELEGRAM — jonli operator. Faqat bot SOZLANGAN bo'lsa
///      ko'rsatiladi: ishlamaydigan havola berish yomonroq.
///   3. XABAR YUBORISH — ilova ichidan, javob shu yerda ko'rinadi.
///
/// NIMA UCHUN JAVOB ILOVADA: odam murojaat yuborgandan keyin
/// "javob keldimi?" deb emailini tekshirib yurmasin. Server javobni
/// `GET /api/support` da qaytaradi.
class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

/// TEZ SAVOLLAR.
///
/// Bu ro'yxat SERVERDAN kelmaydi va kelishi ham shart emas: savollar
/// ilovaning o'z xulqi haqida va ilova bilan birga o'zgaradi.
/// Backend uchun alohida endpoint yasash faqat ortiqcha ish bo'lardi.
/// FUNKSIYA, `static final` emas — aks holda til almashganda
/// ro'yxat muzlab qolardi.
List<({String q, String a})> _faq() => [
      (
        q: tr('NFC ID nima?'),
        a: tr('Bu sizning raqamli vizitkangiz. Kartani telefonga '
            'tegizsangiz, profilingiz darhol ochiladi — ilova o‘rnatish '
            'shart emas.'),
      ),
      (
        q: tr('To‘lov o‘tdi, lekin ID berilmadi'),
        a: tr('To‘lovni bank tasdiqlashi bir necha daqiqa vaqt oladi. '
            '«Buyurtmalarim» bo‘limini oching — holat o‘zi yangilanadi. '
            'Yarim soatdan keyin ham o‘zgarmasa, quyida yozing.'),
      ),
      (
        q: tr('Kartani qanday faollashtiraman?'),
        a: tr('NFCSTORE‘dan kelgan karta allaqachon yozilgan — uni '
            'shunchaki telefonga tegizing. Bo‘sh karta bo‘lsa, NFC '
            'bo‘limidagi «Kartaga yozish» dan foydalaning.'),
      ),
      (
        q: tr('ID‘ni boshqa odamga o‘tkaza olamanmi?'),
        a: tr('Ha. NFC bo‘limida ID‘ni tanlab «Sovg‘a» ni bosing. ID '
            'qabul qiluvchi tasdiqlagandan keyin unga o‘tadi.'),
      ),
      (
        q: tr('Parolimni unutdim'),
        a: tr('Kirish ekranidagi «Parolni unutdingizmi?» havolasidan '
            'foydalaning — email yoki telefonga kod yuboriladi.'),
      ),
    ];

class _SupportScreenState extends State<SupportScreen> {
  final _message = TextEditingController();

  List<SupportMessage>? _messages;
  String? _bot;
  int? _openFaq;

  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final repo = AppScope.read(context).repo;
    // Bot nomi ixtiyoriy — yiqilsa ekran baribir ishlaydi.
    final bot = await repo.telegramBot();
    try {
      final list = await repo.supportMessages();
      if (!mounted) return;
      setState(() {
        _messages = list;
        _bot = bot;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _messages = const [];
          _bot = bot;
        });
      }
    }
  }

  Future<void> _send() async {
    final text = _message.text.trim();
    if (text.length < 10) {
      setState(() => _error = tr('Muammoni biroz batafsilroq yozing.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.sendSupport(text);
      successHaptic();
      _message.clear();
      if (mounted) setState(() => _sent = true);
      await _load();
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() => _error = e.key == 'too_many_requests'
            ? tr('Juda ko‘p murojaat. Birozdan keyin qayta urining.')
            : humanError(e));
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
    final messages = _messages;
    final bot = _bot;
    final faq = _faq();

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => pullRefresh(_load),
          color: C.accent,
          backgroundColor: C.surface,
          displacement: 28,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverToBoxAdapter(child: TopBar()),
              SliverToBoxAdapter(child: ScreenTitle(tr('Yordam'))),

              // 1) TELEGRAM — faqat bot sozlangan bo'lsa.
              if (bot != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Surface(
                      padding: const EdgeInsets.all(S.x16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: C.telegram.withValues(alpha: .13),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: C.telegram.withValues(alpha: .38),
                                  ),
                                ),
                                alignment: Alignment.center,
                                child: NIcon(
                                  Ico.telegram,
                                  size: 19,
                                  color: C.telegram,
                                ),
                              ),
                              const SizedBox(width: S.x12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      tr('Jonli yordam'),
                                      style: T.cardTitle,
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      '@$bot',
                                      style: T.code(12.5, color: C.ink2),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: S.x16),
                          SecondaryButton(
                            tr('Telegram orqali yozish'),
                            size: BtnSize.m,
                            icon: Ico.telegram,
                            onTap: () =>
                                openExternal(Uri.parse('https://t.me/$bot')),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

              // 2) TEZ SAVOLLAR — javob kutmasdan.
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
                      Eyebrow(tr('Tez savollar')),
                      const SizedBox(height: S.x12),
                      Surface(
                        padding: EdgeInsets.zero,
                        shadow: C.e1,
                        child: Column(
                          children: [
                            for (var i = 0; i < faq.length; i++) ...[
                              if (i > 0) const RowDivider(),
                              _FaqRow(
                                item: faq[i],
                                open: _openFaq == i,
                                onTap: () => setState(
                                  () => _openFaq = _openFaq == i ? null : i,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // 3) XABAR YUBORISH.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x24,
                    S.gutter,
                    0,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Eyebrow(tr('Xabar yuborish')),
                      const SizedBox(height: S.x12),
                      Field(
                        label: tr('Muammo yoki taklif'),
                        controller: _message,
                        hint: tr('Nima bo‘ldi va qaysi ekranda?'),
                        keyboardType: TextInputType.multiline,
                        maxLines: 5,
                        error: _error,
                      ),
                      const SizedBox(height: S.x12),
                      PrimaryButton(
                        tr('Yuborish'),
                        loading: _busy,
                        onTap: _busy ? null : _send,
                      ),
                      if (_sent) ...[
                        const SizedBox(height: S.x12),
                        Text(
                          tr('Murojaat yuborildi. Javob shu yerda ko‘rinadi.'),
                          textAlign: TextAlign.center,
                          style: T.caption.copyWith(color: C.ok),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // MUROJAATLAR TARIXI — javob bilan.
              if (messages != null && messages.isNotEmpty)
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
                        Eyebrow(tr('Murojaatlarim')),
                        const SizedBox(height: S.x12),
                        for (final m in messages) ...[
                          _MessageCard(m),
                          if (m != messages.last)
                            const SizedBox(height: S.x8),
                        ],
                      ],
                    ),
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: S.x32)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tez savol — ochiladigan qator.
class _FaqRow extends StatelessWidget {
  const _FaqRow({
    required this.item,
    required this.open,
    required this.onTap,
  });

  final ({String q, String a}) item;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        minSize: 0,
        scale: .99,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: S.x16,
              vertical: S.x12,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(child: Text(item.q, style: T.cardTitle)),
                    const SizedBox(width: S.x8),
                    // Strelka ochilganda buriladi — bu holatning
                    // ikkinchi ko'rsatkichi, rang emas.
                    AnimatedRotation(
                      turns: open ? .5 : 0,
                      duration: M.fade,
                      curve: M.curve,
                      child: NIcon(
                        Ico.chevronDown,
                        size: 16,
                        color: open ? C.accent : C.ink3,
                      ),
                    ),
                  ],
                ),
                AnimatedCrossFade(
                  duration: M.fade,
                  sizeCurve: M.curve,
                  crossFadeState: open
                      ? CrossFadeState.showSecond
                      : CrossFadeState.showFirst,
                  firstChild: const SizedBox(width: double.infinity),
                  secondChild: Padding(
                    padding: const EdgeInsets.only(top: S.x8),
                    child: Text(item.a, style: T.body),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

/// MUROJAAT VA JAVOB.
///
/// Javob ALOHIDA yuzada va "ADMIN" yozuvi bilan: odam o'z matnini
/// operator javobidan bir qarashda ajratishi kerak.
class _MessageCard extends StatelessWidget {
  const _MessageCard(this.m);
  final SupportMessage m;

  String get _when {
    final d = DateTime.tryParse(m.createdAt.replaceFirst(' ', 'T'));
    return d == null ? m.createdAt : dateTime(d);
  }

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x16),
        shadow: C.e1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (m.createdAt.isNotEmpty)
                  Expanded(child: Text(_when, style: T.meta)),
                if (m.createdAt.isEmpty) const Spacer(),
                if (!m.answered)
                  StatusChip(
                    tr('Javob kutilmoqda'),
                    tone: StatusTone.pending,
                  ),
              ],
            ),
            const SizedBox(height: S.x12),
            Text(m.message, style: T.body),
            if (m.answered) ...[
              const SizedBox(height: S.x12),
              Surface(
                padding: const EdgeInsets.all(S.x12),
                radius: R.tile,
                color: C.surfaceHigh,
                shadow: const [],
                border: Border.all(color: C.lineStrong),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Eyebrow(tr('Admin')),
                    const SizedBox(height: 6),
                    Text(m.reply, style: T.body),
                  ],
                ),
              ),
            ],
          ],
        ),
      );
}
