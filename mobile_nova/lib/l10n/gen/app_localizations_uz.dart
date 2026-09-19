// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Uzbek (`uz`).
class LUz extends L {
  LUz([String locale = 'uz']) : super(locale);

  @override
  String get appName => 'NFCSTORE Nova';

  @override
  String get actionContinue => 'Davom etish';

  @override
  String get actionBack => 'Orqaga';

  @override
  String get actionNext => 'Keyingi';

  @override
  String get actionSave => 'Saqlash';

  @override
  String get actionCancel => 'Bekor qilish';

  @override
  String get actionDelete => 'O‘chirish';

  @override
  String get actionEdit => 'Tahrirlash';

  @override
  String get actionShare => 'Ulashish';

  @override
  String get actionCopy => 'Nusxa olish';

  @override
  String get actionCopied => 'Nusxa olindi';

  @override
  String get actionRetry => 'Qayta urinish';

  @override
  String get actionClose => 'Yopish';

  @override
  String get actionOpen => 'Ochish';

  @override
  String get actionDone => 'Tayyor';

  @override
  String get actionConfirm => 'Tasdiqlash';

  @override
  String get actionAdd => 'Qo‘shish';

  @override
  String get actionSearch => 'Qidirish';

  @override
  String get actionSeeAll => 'Hammasi';

  @override
  String get actionFollow => 'Kuzatish';

  @override
  String get actionUnfollow => 'Bekor qilish';

  @override
  String get actionPublish => 'Chop etish';

  @override
  String get actionSelect => 'Tanlash';

  @override
  String get actionPreview => 'Ko‘rib chiqish';

  @override
  String get actionUpload => 'Yuklash';

  @override
  String get actionRefresh => 'Yangilash';

  @override
  String get yes => 'Ha';

  @override
  String get no => 'Yo‘q';

  @override
  String get errRequired => 'Bu maydon to‘ldirilishi kerak';

  @override
  String get errBadEmail => 'Email manzili noto‘g‘ri';

  @override
  String get errBadPhone => 'Telefon raqami noto‘g‘ri';

  @override
  String get errPasswordShort => 'Parol kamida 8 belgidan iborat bo‘lsin';

  @override
  String get errNameShort => 'Ism juda qisqa';

  @override
  String get errBadCode => 'Kod 6 ta raqamdan iborat';

  @override
  String get errPasswordMismatch => 'Parollar mos kelmadi';

  @override
  String get errOffline => 'Internet aloqasi yo‘q';

  @override
  String get errTimeout => 'Server javob bermadi';

  @override
  String get errServer => 'Serverda xatolik';

  @override
  String get errUnauthorized => 'Sessiya tugadi, qaytadan kiring';

  @override
  String get errForbidden => 'Ruxsat yo‘q';

  @override
  String get errNotFound => 'Topilmadi';

  @override
  String get errConflict => 'Bu ma’lumot allaqachon band';

  @override
  String get errRateLimited => 'Juda ko‘p urinish. Biroz kuting';

  @override
  String get errUnknown => 'Nimadir noto‘g‘ri ketdi';

  @override
  String get errBadCredentials => 'Email yoki parol noto‘g‘ri';

  @override
  String get errEmailTaken => 'Bu email allaqachon ro‘yxatdan o‘tgan';

  @override
  String get errEndpointMissing => 'Bu imkoniyat serverda hali yoqilmagan';

  @override
  String get devBackendRequired => 'BACKEND ENDPOINT REQUIRED';

  @override
  String get devConfigRequired => 'CONFIG REQUIRED';

  @override
  String get stateLoading => 'Yuklanmoqda…';

  @override
  String get stateEmpty => 'Hozircha bo‘sh';

  @override
  String get stateEmptyHint => 'Birinchi bo‘lib qo‘shing';

  @override
  String get stateNoResults => 'Hech narsa topilmadi';

  @override
  String get stateNoResultsHint => 'Boshqa so‘z bilan qidirib ko‘ring';

  @override
  String get stateOfflineTitle => 'Oflayn';

  @override
  String get stateOfflineHint => 'Internetga ulaning va qayta urinib ko‘ring';

  @override
  String get stateErrorTitle => 'Xatolik yuz berdi';

  @override
  String get welcomeTitle => 'Raqamli\nshaxsingiz';

  @override
  String get welcomeSubtitle =>
      'Bitta tegish bilan o‘zingizni, ishingizni va do‘koningizni ulashing.';

  @override
  String get welcomeLogin => 'Kirish';

  @override
  String get welcomeRegister => 'Ro‘yxatdan o‘tish';

  @override
  String get loginTitle => 'Xush kelibsiz';

  @override
  String get loginSubtitle => 'Email va telefon raqamingizni kiriting';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPhone => 'Telefon';

  @override
  String get fieldPassword => 'Parol';

  @override
  String get fieldPasswordRepeat => 'Parolni takrorlang';

  @override
  String get fieldName => 'Ism va familiya';

  @override
  String get fieldUsername => 'Foydalanuvchi nomi';

  @override
  String get fieldBio => 'O‘zingiz haqingizda';

  @override
  String get loginSendCode => 'Kodni yuborish';

  @override
  String get loginWithPassword => 'Parol bilan kirish';

  @override
  String get loginUseCode => 'Kod bilan kirish';

  @override
  String get loginNoAccount => 'Hisobingiz yo‘qmi?';

  @override
  String get loginHaveAccount => 'Hisobingiz bormi?';

  @override
  String get verifyTitle => 'Kodni kiriting';

  @override
  String verifySentTo(String email) {
    return '6 xonali kod $email manziliga yuborildi';
  }

  @override
  String verifyResendIn(int seconds) {
    return 'Qayta yuborish $seconds soniyadan keyin';
  }

  @override
  String get verifyResend => 'Kodni qayta yuborish';

  @override
  String get verifyChangeEmail => 'Email manzilini o‘zgartirish';

  @override
  String get verifyWrongCode => 'Kod noto‘g‘ri';

  @override
  String get verifyWrongCodeHint => 'Kodni tekshirib, qaytadan kiriting';

  @override
  String get verifyExpired => 'Kod muddati tugadi';

  @override
  String get verifyExpiredHint => 'Yangi kod so‘rang';

  @override
  String get verifySuccess => 'Email tasdiqlandi';

  @override
  String get verifySending => 'Kod yuborilmoqda…';

  @override
  String get registerTitle => 'Hisob yaratish';

  @override
  String registerStep(int current, int total) {
    return '$current / $total-qadam';
  }

  @override
  String get registerNameHint => 'Sizni qanday chaqiraylik?';

  @override
  String get registerEmailHint => 'Tasdiqlash kodi shu manzilga yuboriladi';

  @override
  String get registerPhoneHint => 'O‘zbekiston raqami: +998';

  @override
  String get registerPasswordHint => 'Kamida 8 belgi';

  @override
  String get setupTitle => 'Profilingizni to‘ldiring';

  @override
  String get setupSubtitle => 'Buni keyin ham o‘zgartirishingiz mumkin';

  @override
  String get setupSkip => 'Keyinroq';

  @override
  String get setupPhoto => 'Rasm qo‘shish';

  @override
  String get logout => 'Chiqish';

  @override
  String get logoutConfirm => 'Hisobdan chiqasizmi?';

  @override
  String get navHome => 'Asosiy';

  @override
  String get navDiscover => 'Kashfiyot';

  @override
  String get navNfc => 'NFC';

  @override
  String get navReels => 'Reels';

  @override
  String get navProfile => 'Profil';

  @override
  String get homeGreetingMorning => 'Xayrli tong';

  @override
  String get homeGreetingDay => 'Xayrli kun';

  @override
  String get homeGreetingEvening => 'Xayrli kech';

  @override
  String get homeActiveId => 'Faol NFC ID';

  @override
  String get homeNoId => 'NFC ID hali yo‘q';

  @override
  String get homeNoIdHint => 'Do‘kondan karta oling yoki ID yarating';

  @override
  String get homeQuickActions => 'Tezkor amallar';

  @override
  String get homeStories => 'Stories';

  @override
  String get homeYourStory => 'Sizning story';

  @override
  String get homePosts => 'Postlar';

  @override
  String get homeReels => 'Reels';

  @override
  String get homeActivity => 'So‘nggi harakatlar';

  @override
  String get homeShop => 'Do‘kon';

  @override
  String get homeBusiness => 'Biznes';

  @override
  String get modePersonal => 'Shaxsiy';

  @override
  String get modeBusiness => 'Biznes';

  @override
  String modeSwitched(String mode) {
    return '$mode rejimga o‘tildi';
  }

  @override
  String get nfcCenter => 'NFC markazi';

  @override
  String get nfcTapToScan => 'Skanerlash uchun bosing';

  @override
  String get nfcHoldCard => 'Kartani telefon orqasiga tegizing';

  @override
  String get nfcScanning => 'Qidirilmoqda…';

  @override
  String get nfcScanSuccess => 'Karta o‘qildi';

  @override
  String get nfcScanFailed => 'Karta o‘qilmadi';

  @override
  String get nfcUnsupported => 'Bu qurilmada NFC yo‘q';

  @override
  String get nfcUnsupportedHint =>
      'NFC ID’laringizni QR kod orqali ulashishingiz mumkin';

  @override
  String get nfcDisabled => 'NFC o‘chirilgan';

  @override
  String get nfcDisabledHint =>
      'Sozlamalar → Ulanishlar → NFC bo‘limidan yoqing';

  @override
  String get nfcOpenSettings => 'Sozlamalarni ochish';

  @override
  String get nfcMyIds => 'NFC ID’larim';

  @override
  String get nfcIdDetail => 'ID ma’lumotlari';

  @override
  String get nfcCards => 'Kartalar';

  @override
  String get nfcHistory => 'Tarix';

  @override
  String get nfcGift => 'Sovg‘a qilish';

  @override
  String get nfcSecurity => 'Xavfsizlik';

  @override
  String get nfcActive => 'Faol';

  @override
  String get nfcInactive => 'Faol emas';

  @override
  String get nfcSetPrimary => 'Asosiy qilish';

  @override
  String get nfcPrimary => 'Asosiy';

  @override
  String get nfcLinkCard => 'Kartani ulash';

  @override
  String get nfcUnlinkCard => 'Kartani uzish';

  @override
  String get nfcUnlinkConfirm =>
      'Karta uzilsinmi? Uni keyin qayta ulashingiz mumkin.';

  @override
  String get nfcDeleteConfirm =>
      'Bu NFC ID o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.';

  @override
  String get nfcScans => 'Skanerlashlar';

  @override
  String get nfcViews => 'Ko‘rishlar';

  @override
  String get nfcShowQr => 'QR kodni ko‘rsatish';

  @override
  String get nfcQrHint => 'Profilingizni ochish uchun shu kodni skanerlang';

  @override
  String get nfcGiftHint => 'ID’ni boshqa foydalanuvchiga sovg‘a qiling';

  @override
  String get nfcGiftRecipient => 'Qabul qiluvchining emaili';

  @override
  String get nfcGiftSent => 'Sovg‘a taklifi yuborildi';

  @override
  String get profileFollowers => 'Obunachilar';

  @override
  String get profileFollowing => 'Obunalar';

  @override
  String get profilePosts => 'Postlar';

  @override
  String get profileEdit => 'Profilni tahrirlash';

  @override
  String get profileLinks => 'Havolalar';

  @override
  String get profileContact => 'Aloqa';

  @override
  String get profileSaved => 'Profil saqlandi';

  @override
  String get profileNoBio => 'Tavsif qo‘shilmagan';

  @override
  String get discoverTitle => 'Kashf eting';

  @override
  String get discoverPeople => 'Odamlar';

  @override
  String get discoverBusinesses => 'Bizneslar';

  @override
  String get discoverProducts => 'Mahsulotlar';

  @override
  String get discoverTrending => 'Ommabop';

  @override
  String get discoverSuggested => 'Tavsiya etiladi';

  @override
  String get searchHint => 'Odam, biznes yoki NFC ID';

  @override
  String get searchRecent => 'So‘nggi qidiruvlar';

  @override
  String get searchClear => 'Tozalash';

  @override
  String get storyCreate => 'Story yaratish';

  @override
  String get storyDeleteConfirm => 'Bu story o‘chirilsinmi?';

  @override
  String get postCreate => 'Post yaratish';

  @override
  String get postCaption => 'Izoh yozing…';

  @override
  String get postComments => 'Izohlar';

  @override
  String get postNoComments => 'Izohlar yo‘q';

  @override
  String get postAddComment => 'Izoh qoldiring…';

  @override
  String get postLiked => 'Yoqdi';

  @override
  String get postSave => 'Saqlash';

  @override
  String get postDeleteConfirm => 'Bu post o‘chirilsinmi?';

  @override
  String get reelCreate => 'Reel yaratish';

  @override
  String get reelsEmpty => 'Hozircha reels yo‘q';

  @override
  String uploadProgress(int percent) {
    return 'Yuklanmoqda $percent%';
  }

  @override
  String get uploadFailed => 'Yuklab bo‘lmadi';

  @override
  String get mediaPickPhoto => 'Rasm tanlash';

  @override
  String get mediaPickVideo => 'Video tanlash';

  @override
  String get mediaCamera => 'Kamera';

  @override
  String get mediaGallery => 'Galereya';

  @override
  String get bizTitle => 'Biznes';

  @override
  String get bizDashboard => 'Boshqaruv paneli';

  @override
  String get bizStorefront => 'Vitrina';

  @override
  String get bizCatalog => 'Katalog';

  @override
  String get bizAnalytics => 'Tahlil';

  @override
  String get bizCreate => 'Biznes yaratish';

  @override
  String get bizNone => 'Sizda biznes hisobi yo‘q';

  @override
  String get bizNoneHint => 'Kompaniyangizni bir necha qadamda oching';

  @override
  String get bizId => 'Biznes manzili';

  @override
  String get bizIdHint => 'nfcstore.uz/c/nomingiz';

  @override
  String get bizIdChecking => 'Tekshirilmoqda…';

  @override
  String get bizIdFree => 'Bo‘sh';

  @override
  String get bizIdTaken => 'Band';

  @override
  String get bizName => 'Kompaniya nomi';

  @override
  String get bizCategory => 'Yo‘nalish';

  @override
  String get bizCity => 'Shahar';

  @override
  String get bizAddress => 'Manzil';

  @override
  String get bizDescription => 'Tavsif';

  @override
  String get bizWebsite => 'Veb-sayt';

  @override
  String get bizHours => 'Ish vaqti';

  @override
  String get bizContactSheet => 'Bog‘lanish';

  @override
  String get bizProducts => 'Mahsulotlar';

  @override
  String get bizServices => 'Xizmatlar';

  @override
  String get bizAddProduct => 'Mahsulot qo‘shish';

  @override
  String get bizProductName => 'Nomi';

  @override
  String get bizPrice => 'Narxi';

  @override
  String get bizSalePrice => 'Chegirma narxi';

  @override
  String get bizAvailable => 'Mavjud';

  @override
  String get bizUnavailable => 'Mavjud emas';

  @override
  String get bizCatalogEmpty => 'Katalog bo‘sh';

  @override
  String get bizSubmitReview => 'Ko‘rib chiqishga yuborish';

  @override
  String get bizPending => 'Ko‘rib chiqilmoqda';

  @override
  String get shopTitle => 'Do‘kon';

  @override
  String get shopAll => 'Barchasi';

  @override
  String get shopCards => 'NFC kartalar';

  @override
  String get shopIds => 'NFC ID’lar';

  @override
  String get shopBuy => 'Buyurtma berish';

  @override
  String get shopSoldOut => 'Sotuvda yo‘q';

  @override
  String get checkoutTitle => 'Buyurtmani rasmiylashtirish';

  @override
  String get checkoutTotal => 'Jami';

  @override
  String get checkoutPayWith => 'To‘lov usuli';

  @override
  String get checkoutPlace => 'To‘lovga o‘tish';

  @override
  String get paymentPending => 'To‘lov kutilmoqda';

  @override
  String get paymentPendingHint =>
      'To‘lovni yakunlang, natija shu yerda ko‘rinadi';

  @override
  String get paymentSuccess => 'To‘lov muvaffaqiyatli';

  @override
  String get paymentFailed => 'To‘lov amalga oshmadi';

  @override
  String get paymentCancelled => 'To‘lov bekor qilindi';

  @override
  String get paymentNotConfigured => 'To‘lov tizimi sozlanmagan';

  @override
  String get orders => 'Buyurtmalar';

  @override
  String get ordersEmpty => 'Buyurtmalar yo‘q';

  @override
  String orderNumber(String id) {
    return 'Buyurtma №$id';
  }

  @override
  String get paymentHistory => 'To‘lovlar tarixi';

  @override
  String get activityTitle => 'Bildirishnomalar';

  @override
  String get activityEmpty => 'Yangi bildirishnoma yo‘q';

  @override
  String get activityMarkRead => 'Hammasini o‘qilgan deb belgilash';

  @override
  String get activityAll => 'Barchasi';

  @override
  String get activityUnread => 'O‘qilmagan';

  @override
  String get settings => 'Sozlamalar';

  @override
  String get settingsAccount => 'Hisob';

  @override
  String get settingsSecurity => 'Xavfsizlik';

  @override
  String get settingsChangePassword => 'Parolni o‘zgartirish';

  @override
  String get settingsCurrentPassword => 'Joriy parol';

  @override
  String get settingsNewPassword => 'Yangi parol';

  @override
  String get settingsPasswordChanged => 'Parol o‘zgartirildi';

  @override
  String get settingsAppearance => 'Ko‘rinish';

  @override
  String get settingsTheme => 'Mavzu';

  @override
  String get settingsLanguage => 'Til';

  @override
  String get settingsNotifications => 'Bildirishnomalar';

  @override
  String get settingsPrivacy => 'Maxfiylik';

  @override
  String get settingsPayment => 'To‘lov';

  @override
  String get settingsReferral => 'Referal';

  @override
  String get settingsReferralHint =>
      'Do‘stingiz sizning kodingiz bilan ro‘yxatdan o‘tsa, ikkovingiz ham chegirma olasiz';

  @override
  String get settingsPremium => 'Premium';

  @override
  String get settingsSupport => 'Yordam';

  @override
  String get settingsNews => 'Yangiliklar';

  @override
  String get settingsAbout => 'Ilova haqida';

  @override
  String settingsVersion(String version) {
    return 'Versiya $version';
  }

  @override
  String get settingsDeleteAccount => 'Hisobni o‘chirish';

  @override
  String get settingsDeleteConfirm =>
      'Hisob butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.';

  @override
  String get settingsDeleteTypeEmail =>
      'Tasdiqlash uchun email manzilingizni yozing';

  @override
  String get themePearl => 'Marvarid';

  @override
  String get themeGraphite => 'Grafit';

  @override
  String get themeOcean => 'Okean';

  @override
  String get themeAurora => 'Aurora';

  @override
  String get themeMidnight => 'Yarim tun';

  @override
  String get langUz => 'O‘zbekcha';

  @override
  String get langRu => 'Русский';

  @override
  String get langEn => 'English';

  @override
  String get supportWriteUs => 'Bizga yozing';

  @override
  String get supportSent => 'Murojaat yuborildi';
}
