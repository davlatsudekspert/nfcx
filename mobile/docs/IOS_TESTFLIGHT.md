# iOS → TestFlight (Mac'siz)

Workflow: `.github/workflows/ios-testflight.yml` (Actions → **iOS TestFlight** → Run workflow).
U faqat TestFlight'ga build yuklaydi. App Store'ga reliz va review'ga yuborish qo'lda qilinadi.

- Bundle ID: `uz.nfcstore.app` (Android Classic bilan bir xil; workflow uni Xcode loyihasidan o'qiydi)
- Versiya: `pubspec.yaml` → `1.0.0`; build raqami = workflow run raqami
- Imzo: Apple Distribution `.p12` + App Store provisioning profile (qo'lda imzo)
- Yuklash: App Store Connect API kaliti (`xcrun altool`), Apple ID paroli ishlatilmaydi
- NFC: `Runner/Runner.entitlements` → `com.apple.developer.nfc.readersession.formats = [TAG]`

## 1. Apple portalida (bir martalik)

### 1.1 App ID — developer.apple.com → Account → Certificates, Identifiers & Profiles → Identifiers
1. **+** → *App IDs* → *App* → Continue.
2. Description: `NFCSTORE`, Bundle ID: **Explicit** → `uz.nfcstore.app`.
3. Capabilities ro'yxatidan **NFC Tag Reading** ni belgilang → Continue → Register.
   (App ID allaqachon bo'lsa — uni ochib NFC Tag Reading'ni yoqing va Save.)

### 1.2 Distribution sertifikati (Mac'siz, OpenSSL bilan)
Windows'da Git Bash ichida yoki Linux'da:
```bash
openssl genrsa -out nfcstore_dist.key 2048
openssl req -new -key nfcstore_dist.key -out nfcstore_dist.certSigningRequest \
  -subj "/emailAddress=SIZNING@EMAIL/CN=NFCSTORE Distribution/C=UZ"
```
1. Certificates → **+** → **Apple Distribution** → Continue.
2. `nfcstore_dist.certSigningRequest` ni yuklang → Continue → **Download** (`distribution.cer`).
3. `.p12` yasang (parolni o'zingiz o'ylab toping va saqlang):
```bash
openssl x509 -inform DER -in distribution.cer -out distribution.pem
openssl pkcs12 -export -legacy -inkey nfcstore_dist.key -in distribution.pem \
  -name "NFCSTORE Distribution" -out nfcstore_dist.p12
```
`-legacy` muhim: OpenSSL 3 usiz yaratgan `.p12` ni macOS import qilmaydi.
(OpenSSL 1.x bo'lsa `-legacy` ni olib tashlang.)

`nfcstore_dist.key` va `.p12` ni xavfsiz joyda saqlang, repoga qo'ymang.

### 1.3 Provisioning profile
1. Profiles → **+** → Distribution → **App Store Connect** → Continue.
2. App ID: `uz.nfcstore.app` → Continue.
3. 1.2-bandda yaratilgan sertifikatni tanlang → Continue.
4. Nomi: `NFCSTORE App Store` → Generate → **Download** (`.mobileprovision`).

App ID'da capability o'zgarsa, profilni qayta yarating va secret'ni yangilang.

### 1.4 App Store Connect'da ilova yozuvi — appstoreconnect.apple.com → Apps
**+** → *New App* → Platform: iOS, Name: `NFCSTORE` (band bo'lsa boshqa nom),
Primary language, Bundle ID: `uz.nfcstore.app`, SKU: `nfcstore-ios` → Create.
Bu yozuvsiz yuklash "No suitable application records" xatosi bilan tugaydi.

### 1.5 App Store Connect API kaliti
appstoreconnect.apple.com → **Users and Access** → **Integrations** → **App Store Connect API** →
*Team Keys* → **+** (birinchi marta "Request Access" kerak bo'lishi mumkin).
- Name: `GitHub Actions`, Access: **App Manager**.
- **Download API Key** — `AuthKey_XXXXXXXXXX.p8` faqat BIR MARTA yuklab olinadi.
- Sahifadan **Key ID** va yuqoridagi **Issuer ID** ni ko'chirib oling.

## 2. GitHub Secrets

GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**.

| Secret | Qiymat | Qayerdan |
|---|---|---|
| `IOS_CERTIFICATE_BASE64` | `.p12` faylning base64'i | `base64 -w0 nfcstore_dist.p12` (Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("nfcstore_dist.p12"))`) |
| `IOS_CERTIFICATE_PASSWORD` | `.p12` paroli | 1.2-bandda o'zingiz qo'ygan parol |
| `IOS_PROVISIONING_PROFILE_BASE64` | profilning base64'i | `base64 -w0 NFCSTORE_App_Store.mobileprovision` |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID (10 belgi) | ASC → Integrations → App Store Connect API, kalit qatori |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID (UUID) | O'sha sahifaning yuqorisi |
| `APP_STORE_CONNECT_API_KEY_P8` | `.p8` fayl matni to'liq (`-----BEGIN PRIVATE KEY-----` dan `-----END PRIVATE KEY-----` gacha) | Yuklab olingan `AuthKey_XXXX.p8` ni Notepad'da ochib nusxa oling |

Team ID kerak emas: workflow uni profildan o'qiydi.

## 3. Ishga tushirish
*Run workflow* tugmasi faqat workflow fayli `main` branchda bo'lsa ko'rinadi.

Actions → **iOS TestFlight** → *Run workflow* → branch tanlang → `upload` belgilangan → Run.
Imzo secretlari bo'lmasa workflow faqat imzosiz tekshiruv build qiladi.

Tekshirilgan muhit (2026-10): macOS 26.6, Xcode 26.6, Flutter 3.47.4, altool 26.40.1;
imzosiz release build muvaffaqiyatli (`Runner.app` 24.2 MB).

## 4. Natija
App Store Connect → Apps → NFCSTORE → **TestFlight** → iOS builds. Apple qayta ishlashi 5–30 daqiqa.
`ITSAppUsesNonExemptEncryption = false` qo'yilgan (ilova faqat HTTPS ishlatadi), shuning uchun
"Missing Compliance" so'ralmaydi. Internal Testing guruhiga testerlar qo'shing.

## Muddatlar
Distribution sertifikati va profil 1 yildan keyin tugaydi — yangisini yaratib secretlarni yangilang.
