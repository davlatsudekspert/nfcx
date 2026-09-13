import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import '../../design/feedback.dart';
import '../../l10n/strings.dart';

/// ID'NI SOVG'A QILISH / O'TKAZISH.
///
/// Backend qabul qiluvchini KOD bo'yicha topadi (`toCode`), telefon
/// bo'yicha emas. Shuning uchun bu yerda ham kod so'raladi va
/// kiritilgach profil ko'rsatiladi — odam kimga yuborayotganini
/// ko'rib turadi.
///
/// Amal QAYTARILMAYDI, lekin DARHOL ham bajarilmaydi: qabul qiluvchi
/// tasdiqlagunicha taklif `pending` holatda turadi.
class GiftIdScreen extends StatefulWidget {
  const GiftIdScreen({super.key, required this.record});
  final Record record;

  @override
  State<GiftIdScreen> createState() => _GiftIdScreenState();
}

class _GiftIdScreenState extends State<GiftIdScreen> {
  final _toCode = TextEditingController();
  Record? _recipient;
  bool _looking = false;
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _toCode.dispose();
    super.dispose();
  }

  /// Kod yozib bo'lingach qabul qiluvchini ko'rsatamiz. Xato bo'lsa
  /// jimgina o'chadi — har harfda qizil yozuv chiqarish shart emas.
  Future<void> _lookup(String v) async {
    final code = v.trim().toUpperCase();
    if (code.length < 5) {
      setState(() => _recipient = null);
      return;
    }
    setState(() => _looking = true);
    try {
      final r = await AppScope.read(context).repo.record(code);
      if (mounted) setState(() => _recipient = r);
    } catch (_) {
      if (mounted) setState(() => _recipient = null);
    } finally {
      if (mounted) setState(() => _looking = false);
    }
  }

  Future<void> _send() async {
    final to = _toCode.text.trim().toUpperCase();
    if (to.isEmpty) {
      setState(() => _error = tr('Qabul qiluvchining ID kodini kiriting.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.giftRecord(widget.record.code, {'toCode': to});
      if (mounted) {
        setState(() => _sent = true);
        successHaptic();
      }
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = _giftError(e));
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Backend bu yerda KATTA HARFLI kalitlar qaytaradi (legacy kontrakt).
  String _giftError(ApiError e) => switch (e.key) {
        'NOT_OWNER' => tr('Bu ID sizga tegishli emas.'),
        'NOT_GIFTABLE' => tr('Bu ID‘ni sovg‘a qilib bo‘lmaydi.'),
        'RECIPIENT_NOT_FOUND' => tr('Bunday ID topilmadi. Kodni tekshiring.'),
        'CANNOT_GIFT_SELF' => tr('O‘zingizga sovg‘a qilib bo‘lmaydi.'),
        'ALREADY_PENDING' => tr('Bu ID uchun tasdiqlanmagan sovg‘a allaqachon bor.'),
        _ => humanError(e),
      };

  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                Text(tr('Sovg‘a\nyuborildi'), style: T.display),
                const SizedBox(height: S.x12),
                Text(
                  '${_toCode.text.trim().toUpperCase()} egasi tasdiqlagandan keyin '
                  '${widget.record.code} unga o‘tadi. Unga qadar ID sizda qoladi.',
                  style: T.body,
                ),
                const Spacer(),
                PrimaryButton(tr('Tayyor'), onTap: () => Navigator.of(context).pop()),
                const SizedBox(height: S.x32),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(title: tr('Sovg‘a qilish')),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x24),
                children: [
                  Eyebrow(tr('Bepul o‘tkazish')),
                  const SizedBox(height: 6),
                  Text(tr('ID‘ni\nsovg‘a qilish'), style: T.display),
                  const SizedBox(height: S.x12),
                  Text(
                    tr('Qabul qiluvchi tasdiqlagandan keyin ID unga o‘tadi.'),
                    style: T.body,
                  ),
                  const SizedBox(height: S.x24),
                  IdentityCard(
                    code: widget.record.code,
                    holder: widget.record.name.isEmpty ? tr('Shaxsiy') : widget.record.name,
                    subtitle: TierStyle.of(widget.record.tier).label,
                    tier: widget.record.tier,
                  ),
                  const SizedBox(height: S.x24),
                  Field(
                    label: tr('Qabul qiluvchining ID kodi'),
                    controller: _toCode,
                    hint: tr('Masalan: AAA904'),
                    onChanged: _lookup,
                    error: _error,
                  ),
                  if (_looking) ...[
                    const SizedBox(height: S.x12),
                    Row(
                      children: [
                        Spinner(size: 13),
                        SizedBox(width: S.x8),
                        Text(tr('Qidirilmoqda…'), style: T.caption),
                      ],
                    ),
                  ] else if (_recipient != null) ...[
                    const SizedBox(height: S.x12),
                    Surface(
                      child: Row(
                        children: [
                          const NIconPlaceholder(),
                          const SizedBox(width: S.x12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _recipient!.name.isEmpty ? _recipient!.code : _recipient!.name,
                                  style: T.cardTitle,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  [
                                    _recipient!.code,
                                    if (_recipient!.city.isNotEmpty) _recipient!.city,
                                  ].join(' · '),
                                  style: T.caption.copyWith(fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: S.x20),
                  Surface(
                    shadow: E.e1,
                    child: Text(
                      tr('ID o‘tgandan keyin unga bog‘langan profil, postlar va ') +
                      tr('statistika yangi egasiga o‘tadi.'),
                      style: T.caption.copyWith(color: C.muted),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: EdgeInsets.fromLTRB(
                S.gutter, S.x12, S.gutter,
                MediaQuery.paddingOf(context).bottom + S.x12,
              ),
              decoration: BoxDecoration(
                color: C.obsidian,
                border: Border(top: BorderSide(color: C.hairline)),
              ),
              child: PrimaryButton(
                tr('Sovg‘a qilishni yuborish'),
                loading: _busy,
                onTap: _busy ? null : _send,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Qabul qiluvchi avatari o'rni — rasm hali yuklanmagan bo'lishi mumkin.
class NIconPlaceholder extends StatelessWidget {
  const NIconPlaceholder({super.key});

  @override
  Widget build(BuildContext context) => Container(
        width: 40, height: 40,
        decoration: BoxDecoration(color: C.graphite, shape: BoxShape.circle),
        child: Center(child: Text('ID', style: T.eyebrow)),
      );
}
