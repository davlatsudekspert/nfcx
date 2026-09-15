import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter/widgets.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart' show Share;

import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/surface.dart';
import '../../design/components/toast.dart';
import '../../design/components/top_bar.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../identity/switcher.dart' show identityTier;

/// Profilni ulashish — tizimning o'z ulashish oynasi orqali.
Future<void> shareIdentity(Identity id) async {
  await Share.share(
    '${id.name} — NFCSTORE\n${id.publicUrl}',
    subject: id.name,
  );
}

/// QR EKRANI — NFC ishlamaganda ham ishlaydigan yo'l.
///
/// QR MIJOZ TOMONIDA chiziladi (`qr_flutter`): serverdan rasm so'rash
/// internetsiz ishlamasdi, holbuki QR ko'rsatish aynan "telefonni
/// uzatish" payti — ya'ni internet bo'lmasligi mumkin.
///
/// QR OQ YUZADA TURADI VA SHART: skaner kontrastni qorong'i fonda
/// topolmaydi. Shuning uchun bu ekranning markazida ilovadagi yagona
/// yorug' yuza bor — bu qoida emas, istisno va u ataylab qilingan.
class QrShareScreen extends StatelessWidget {
  const QrShareScreen({super.key, required this.identity});

  final Identity identity;

  @override
  Widget build(BuildContext context) {
    final url = identity.publicUrl;
    final tier = identityTier(identity);

    return ScreenBackdrop(
      aura: Aura.center,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(title: identity.code, trailing: const IdChipSpacer()),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  0,
                  S.gutter,
                  S.x32,
                ),
                children: [
                  // TARIF — kartadagi bilan bir xil nom va namuna.
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      TierDot(tier, size: 10),
                      const SizedBox(width: S.x8),
                      Eyebrow(TierStyle.of(tier).label),
                    ],
                  ),
                  const SizedBox(height: S.x20),

                  Center(
                    child: Surface(
                      // Yorug' yuza — QR o'qilishi uchun. `C.ink`
                      // matn rangi bo'lsa ham, bu yerda u YUZA:
                      // shkaladagi eng yorug' qiymat.
                      color: C.ink,
                      radius: R.hero,
                      padding: const EdgeInsets.all(S.x20),
                      border: Border.all(color: C.lineCool),
                      shadow: C.e3,
                      child: QrImageView(
                        data: url,
                        version: QrVersions.auto,
                        size: 230,
                        backgroundColor: C.ink,
                        eyeStyle: QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: C.bg,
                        ),
                        dataModuleStyle: QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: C.bg,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: S.x20),

                  Text(
                    identity.name.isEmpty ? identity.code : identity.name,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.section,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    url.replaceFirst('https://', ''),
                    textAlign: TextAlign.center,
                    style: T.link,
                  ),

                  const SizedBox(height: S.x24),
                  Surface(
                    padding: const EdgeInsets.symmetric(
                      horizontal: S.x16,
                      vertical: S.x12,
                    ),
                    shadow: C.e1,
                    child: Text(
                      tr('Skanerlagan odam shu profilni ochadi. Yoki '
                          'telefonni kartaga tegizsin.'),
                      textAlign: TextAlign.center,
                      style: T.caption,
                    ),
                  ),

                  const SizedBox(height: S.x24),
                  PrimaryButton(
                    tr('Ulashish'),
                    icon: Ico.share,
                    onTap: () => shareIdentity(identity),
                  ),
                  const SizedBox(height: S.x12),
                  SecondaryButton(
                    tr('Havolani nusxalash'),
                    icon: Ico.copy,
                    onTap: () async {
                      await Clipboard.setData(ClipboardData(text: url));
                      if (context.mounted) {
                        showToast(context, tr('Havola nusxalandi'));
                      }
                    },
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

/// Sarlavha qatoridagi bo'shliq — chip turmagan ekranlarda maketni
/// bir xil saqlaydi (tugmalar joyi siljimasin).
class IdChipSpacer extends StatelessWidget {
  const IdChipSpacer({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox(width: 42);
}
