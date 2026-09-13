import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../common/top_bar.dart';

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

    return ColoredBox(
      color: C.obsidian,
      child: SafeArea(
        child: Column(
          children: [
            TopBar(title: tr('Yordam')),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load,
                color: C.champagne,
                backgroundColor: C.slate,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                  children: [
                    // 1) TEZ SAVOLLAR — javob kutmasdan.
                    Eyebrow(tr('Tez savollar')),
                    const SizedBox(height: S.x12),
                    Surface(
                      padding: EdgeInsets.zero,
                      shadow: E.e1,
                      child: Column(
                        children: [
                          for (var i = 0; i < _faq().length; i++)
                            _FaqRow(
                              item: _faq()[i],
                              open: _openFaq == i,
                              last: i == _faq().length - 1,
                              onTap: () => setState(
                                  () => _openFaq = _openFaq == i ? null : i),
                            ),
                        ],
                      ),
                    ),

                    // 2) TELEGRAM — faqat bot sozlangan bo'lsa.
                    if (bot != null) ...[
                      const SizedBox(height: S.x24),
                      Eyebrow(tr('Jonli yordam')),
                      const SizedBox(height: S.x12),
                      SecondaryButton(
                        tr('Telegram orqali yozish'),
                        icon: const NIcon(Ico.telegram, size: 18, color: C.telegram),
                        onTap: () => openExternal(Uri.parse('https://t.me/$bot')),
                      ),
                    ],

                    // 3) XABAR YUBORISH.
                    const SizedBox(height: S.x24),
                    Eyebrow(tr('Xabar yuborish')),
                    const SizedBox(height: S.x12),
                    Field(
                      label: tr('Muammo yoki taklif'),
                      controller: _message,
                      hint: tr('Nima bo‘ldi va qaysi ekranda?'),
                      maxLines: 5,
                      error: _error,
                    ),
                    const SizedBox(height: S.x12),
                    PrimaryButton(tr('Yuborish'),
                        loading: _busy, onTap: _busy ? null : _send),
                    if (_sent) ...[
                      const SizedBox(height: S.x12),
                      Text(
                        tr('Murojaat yuborildi. Javob shu yerda ko‘rinadi.'),
                        textAlign: TextAlign.center,
                        style: T.caption.copyWith(color: C.verdant),
                      ),
                    ],

                    // MUROJAATLAR TARIXI — javob bilan.
                    if (messages != null && messages.isNotEmpty) ...[
                      const SizedBox(height: S.x24),
                      Eyebrow(tr('Murojaatlarim')),
                      const SizedBox(height: S.x12),
                      for (final m in messages) ...[
                        _MessageCard(m),
                        const SizedBox(height: S.x8),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FaqRow extends StatelessWidget {
  const _FaqRow({
    required this.item,
    required this.open,
    required this.last,
    required this.onTap,
  });

  final ({String q, String a}) item;
  final bool open;
  final bool last;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(S.x16),
          decoration: BoxDecoration(
            border: last ? null : Border(bottom: BorderSide(color: C.hairline)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(item.q, style: T.cardTitle.copyWith(fontSize: 13.5)),
                  ),
                  const SizedBox(width: S.x8),
                  // Strelka ochilganda buriladi — bu yagona
                  // ko'rsatkich, shuning uchun animatsiya qilinadi.
                  AnimatedRotation(
                    turns: open ? .5 : 0,
                    duration: M.fade,
                    curve: M.curve,
                    child: NIcon(Ico.chevronDown, size: 16, color: C.ash),
                  ),
                ],
              ),
              AnimatedCrossFade(
                duration: M.fade,
                sizeCurve: M.curve,
                crossFadeState:
                    open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                firstChild: const SizedBox(width: double.infinity),
                secondChild: Padding(
                  padding: const EdgeInsets.only(top: S.x8),
                  child: Text(item.a, style: T.caption),
                ),
              ),
            ],
          ),
        ),
      );
}

class _MessageCard extends StatelessWidget {
  const _MessageCard(this.m);
  final SupportMessage m;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x16),
        shadow: E.e1,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(m.message, style: T.body),
            const SizedBox(height: S.x12),
            if (m.answered) ...[
              Container(height: 1, color: C.hairline),
              const SizedBox(height: S.x12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  NIcon(Ico.check, size: 15, color: C.verdant),
                  const SizedBox(width: S.x8),
                  Expanded(child: Text(m.reply, style: T.caption)),
                ],
              ),
            ] else
              Text(tr('Javob kutilmoqda'),
                  style: T.statusLabel.copyWith(color: C.champagne)),
          ],
        ),
      );
}
