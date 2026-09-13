import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart' show Share;
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import '../../l10n/strings.dart';

/// Profilni ulashish — tizimning o'z ulashish oynasi orqali.
Future<void> shareIdentity(Identity id) async {
  await Share.share(
    '${id.name} — NFCSTORE\n${id.publicUrl}',
    subject: id.name,
  );
}

/// QR ekrani.
///
/// QR MIJOZ TOMONIDA chiziladi (`qr_flutter`): serverdan rasm so'rash
/// internetsiz ishlamasdi, holbuki QR ko'rsatish aynan "telefonni
/// uzatish" payti — ya'ni internet bo'lmasligi mumkin.
class QrShareScreen extends StatelessWidget {
  const QrShareScreen({super.key, required this.identity});
  final Identity identity;

  @override
  Widget build(BuildContext context) {
    final url = identity.publicUrl;
    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        child: Column(
          children: [
            TopBar(title: identity.code, trailing: const IdChipSpacer()),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Column(
                  children: [
                    const SizedBox(height: S.x24),
                    // QR oq fonda bo'lishI SHART: qorong'i fonda skaner
                    // kontrastni topolmaydi va o'qimaydi.
                    Container(
                      padding: const EdgeInsets.all(S.x20),
                      decoration: BoxDecoration(
                        color: C.offWhite,
                        borderRadius: BorderRadius.circular(R.hero),
                        boxShadow: E.e3,
                      ),
                      child: QrImageView(
                        data: url,
                        version: QrVersions.auto,
                        size: 230,
                        backgroundColor: C.offWhite,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: Color(0xFF0A0805),
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: Color(0xFF0A0805),
                        ),
                      ),
                    ),
                    const SizedBox(height: S.x20),
                    Text(identity.name, style: T.profileName.copyWith(fontSize: 18)),
                    const SizedBox(height: 4),
                    Text(url.replaceFirst('https://', ''), style: T.meta),
                    const SizedBox(height: S.x24),
                    Surface(
                      child: Row(
                        children: [
                          NIcon(Ico.nfc, size: 20, color: C.platinum),
                          const SizedBox(width: S.x12),
                          Expanded(
                            child: Text(tr('Yoki telefonni kartaga tegizing'), style: T.caption),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: S.x16),
                    PrimaryButton(tr('Ulashish'), onTap: () => shareIdentity(identity)),
                    const SizedBox(height: S.x12),
                    GhostButton(
                      tr('Havolani nusxalash'),
                      onTap: () => Clipboard.setData(ClipboardData(text: url)),
                    ),
                    const SizedBox(height: S.x32),
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

/// Sarlavha qatoridagi bo'shliq — chip turmagan ekranlarda maketni
/// bir xil saqlaydi (tugmalar joyi siljimasin).
class IdChipSpacer extends StatelessWidget {
  const IdChipSpacer({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox(width: 40);
}
