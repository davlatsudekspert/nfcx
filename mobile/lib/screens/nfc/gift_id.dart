import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/input.dart';
import '../../design/components/media.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// ID'NI SOVG'A QILISH / O'TKAZISH.
///
/// Backend qabul qiluvchini KOD bo'yicha topadi (`toCode`), telefon
/// bo'yicha emas. Shuning uchun bu yerda ham kod so'raladi va
/// kiritilgach profil ko'rsatiladi — odam kimga yuborayotganini
/// ko'rib turadi.
///
/// TABRIK MATNI YO'Q. `POST /api/records/:code/gift` FAQAT `toCode`
/// oladi; matn maydoni chizilsa, u hech qayerga bormasdi.
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

  /// Qidiruv natijasi haqida izoh — "topilmadi" yoki tarmoq xatosi.
  ///
  /// Ilgari qidiruv xatosi JIMGINA yutilardi: odam kod yozardi,
  /// ekranda hech narsa chiqmasdi va u "yuborish" ni bosgunicha
  /// qabul qiluvchi bor-yo'qligini bilmasdi.
  String? _lookupNote;
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
      setState(() {
        _recipient = null;
        _lookupNote = null;
      });
      return;
    }
    setState(() {
      _looking = true;
      _lookupNote = null;
    });
    try {
      final r = await AppScope.read(context).repo.record(code);
      if (mounted) {
        setState(() {
          _recipient = r;
          _lookupNote = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _recipient = null;
          _lookupNote = e is ApiError && e.key == 'not_found'
              ? tr('Bunday ID topilmadi.')
              : humanError(e);
        });
      }
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
  Widget build(BuildContext context) => _sent ? _success() : _form();

  // ── YUBORILDI ────────────────────────────────────────────────

  Widget _success() => ScreenBackdrop(
        aura: Aura.center,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Spacer(),
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: C.ok.withValues(alpha: .12),
                    border: Border.all(
                      color: C.ok.withValues(alpha: .5),
                      width: 2,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: NIcon(Ico.gift, size: 40, color: C.ok),
                ),
                const SizedBox(height: S.x32),
                Text(tr('Sovg‘a yuborildi'), style: T.title),
                const SizedBox(height: S.x12),
                Text(
                  trf(
                    '{kimga} egasi tasdiqlagandan keyin {kod} unga o‘tadi. '
                    'Unga qadar ID sizda qoladi.',
                    {
                      'kimga': _toCode.text.trim().toUpperCase(),
                      'kod': widget.record.code,
                    },
                  ),
                  style: T.body,
                ),
                const Spacer(),
                PrimaryButton(
                  tr('Tayyor'),
                  onTap: () => Navigator.of(context).pop(),
                ),
                const SizedBox(height: S.x32),
              ],
            ),
          ),
        ),
      );

  // ── FORMA ────────────────────────────────────────────────────

  Widget _form() {
    final recipient = _recipient;

    return ScreenBackdrop(
      aura: Aura.spotlight,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: S.x24),
                children: [
                  ScreenTitle(
                    tr('Sovg‘a qilish'),
                    eyebrow: tr('Bepul o‘tkazish'),
                    subtitle: tr('Qabul qiluvchi tasdiqlagandan keyin ID '
                        'unga o‘tadi.'),
                  ),

                  // ── 1-QADAM: QAYSI ID ──────────────────────────
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Row(
                      children: [
                        MiniIdCard(
                          code: widget.record.code,
                          tier: widget.record.tier,
                          width: 158,
                        ),
                        const SizedBox(width: S.x12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                widget.record.name.isEmpty
                                    ? tr('Shaxsiy')
                                    : widget.record.name,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: T.cardTitle,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                TierStyle.of(widget.record.tier).label,
                                style: T.meta,
                              ),
                              const SizedBox(height: S.x8),
                              GhostButton(
                                tr('O‘zgartirish'),
                                size: BtnSize.s,
                                onTap: () => Navigator.of(context).maybePop(),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: S.x32),

                  // ── 2-QADAM: KIMGA ─────────────────────────────
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(tr('Kimga').toUpperCase(), style: T.label),
                        const SizedBox(height: S.x8),
                        SearchField(
                          controller: _toCode,
                          hint: tr('ID kodi — masalan AAA904'),
                          onChanged: _lookup,
                        ),
                        const SizedBox(height: S.x12),

                        if (_looking)
                          Row(
                            children: [
                              const Spinner(size: 14),
                              const SizedBox(width: S.x8),
                              Text(tr('Qidirilmoqda…'), style: T.caption),
                            ],
                          )
                        else if (_lookupNote != null)
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              NIcon(Ico.warning, size: 14, color: C.fail),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  _lookupNote!,
                                  style: T.caption.copyWith(
                                    color: C.fail,
                                    fontSize: 12.5,
                                  ),
                                ),
                              ),
                            ],
                          )
                        else if (recipient != null)
                          _RecipientRow(record: recipient)
                        else
                          Text(
                            tr('Qabul qiluvchining ID kodini yozing.'),
                            style: T.caption.copyWith(color: C.ink3),
                          ),

                        const SizedBox(height: S.x24),

                        // ── OGOHLANTIRISH ──────────────────────
                        Surface(
                          padding: const EdgeInsets.all(S.x16),
                          border: Border.all(
                            color: C.warn.withValues(alpha: .38),
                          ),
                          shadow: C.e1,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              NIcon(Ico.warning, size: 18, color: C.warn),
                              const SizedBox(width: S.x12),
                              Expanded(
                                child: Text(
                                  trf(
                                    'Sovg‘a qilingandan keyin {kod} sizning '
                                    'profilingizdan uziladi va qabul '
                                    'qilinganda unga o‘tadi.',
                                    {'kod': widget.record.code},
                                  ),
                                  style: T.caption,
                                ),
                              ),
                            ],
                          ),
                        ),

                        if (_error != null) ...[
                          const SizedBox(height: S.x12),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              NIcon(Ico.warning, size: 14, color: C.fail),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  _error!,
                                  style: T.caption.copyWith(
                                    color: C.fail,
                                    fontSize: 12.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            StickyBar(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  PrimaryButton(
                    tr('Sovg‘ani yuborish'),
                    loading: _busy,
                    onTap: _busy ? null : _send,
                  ),
                  const SizedBox(height: S.x8),
                  Text(
                    tr('Qabul qiluvchi tasdiqlamaguncha ID o‘tmaydi.'),
                    textAlign: TextAlign.center,
                    style: T.caption.copyWith(fontSize: 12.5, color: C.ink3),
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

/// Topilgan qabul qiluvchi — tanlangan qator.
///
/// Natija bitta bo'ladi (server kodni AYNAN topadi), shuning uchun u
/// doim tanlangan holatda chiziladi: oltin halqa va belgi bilan.
class _RecipientRow extends StatelessWidget {
  const _RecipientRow({required this.record});

  final Record record;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        border: Border.all(color: C.lineStrong, width: 1.4),
        shadow: C.e1,
        child: Row(
          children: [
            Avatar(url: record.avatarUrl, name: record.name, size: 44),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    record.name.isEmpty ? record.code : record.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'nfcstore.uz/${record.code.toLowerCase()}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.link,
                  ),
                ],
              ),
            ),
            const SizedBox(width: S.x8),
            const VerifiedBadge(size: 20),
          ],
        ),
      );
}
