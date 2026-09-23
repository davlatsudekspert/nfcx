import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ru.dart';
import 'app_localizations_uz.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of L
/// returned by `L.of(context)`.
///
/// Applications need to include `L.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: L.localizationsDelegates,
///   supportedLocales: L.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the L.supportedLocales
/// property.
abstract class L {
  L(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static L of(BuildContext context) {
    return Localizations.of<L>(context, L)!;
  }

  static const LocalizationsDelegate<L> delegate = _LDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ru'),
    Locale('uz'),
  ];

  /// No description provided for @appName.
  ///
  /// In uz, this message translates to:
  /// **'NFCSTORE'**
  String get appName;

  /// No description provided for @actionContinue.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish'**
  String get actionContinue;

  /// No description provided for @actionBack.
  ///
  /// In uz, this message translates to:
  /// **'Orqaga'**
  String get actionBack;

  /// No description provided for @actionNext.
  ///
  /// In uz, this message translates to:
  /// **'Keyingi'**
  String get actionNext;

  /// No description provided for @actionSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get actionSave;

  /// No description provided for @actionCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get actionCancel;

  /// No description provided for @actionDelete.
  ///
  /// In uz, this message translates to:
  /// **'O‘chirish'**
  String get actionDelete;

  /// No description provided for @actionEdit.
  ///
  /// In uz, this message translates to:
  /// **'Tahrirlash'**
  String get actionEdit;

  /// No description provided for @actionShare.
  ///
  /// In uz, this message translates to:
  /// **'Ulashish'**
  String get actionShare;

  /// No description provided for @shareCopied.
  ///
  /// In uz, this message translates to:
  /// **'Havola nusxalandi'**
  String get shareCopied;

  /// No description provided for @actionMute.
  ///
  /// In uz, this message translates to:
  /// **'Ovozni o‘chirish'**
  String get actionMute;

  /// No description provided for @actionUnmute.
  ///
  /// In uz, this message translates to:
  /// **'Ovozni yoqish'**
  String get actionUnmute;

  /// No description provided for @actionCopy.
  ///
  /// In uz, this message translates to:
  /// **'Nusxa olish'**
  String get actionCopy;

  /// No description provided for @actionCopied.
  ///
  /// In uz, this message translates to:
  /// **'Nusxa olindi'**
  String get actionCopied;

  /// No description provided for @actionRetry.
  ///
  /// In uz, this message translates to:
  /// **'Qayta urinish'**
  String get actionRetry;

  /// No description provided for @actionClose.
  ///
  /// In uz, this message translates to:
  /// **'Yopish'**
  String get actionClose;

  /// No description provided for @actionOpen.
  ///
  /// In uz, this message translates to:
  /// **'Ochish'**
  String get actionOpen;

  /// No description provided for @actionDone.
  ///
  /// In uz, this message translates to:
  /// **'Tayyor'**
  String get actionDone;

  /// No description provided for @actionConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash'**
  String get actionConfirm;

  /// No description provided for @actionAdd.
  ///
  /// In uz, this message translates to:
  /// **'Qo‘shish'**
  String get actionAdd;

  /// No description provided for @actionSearch.
  ///
  /// In uz, this message translates to:
  /// **'Qidirish'**
  String get actionSearch;

  /// No description provided for @actionSeeAll.
  ///
  /// In uz, this message translates to:
  /// **'Hammasi'**
  String get actionSeeAll;

  /// No description provided for @actionFollow.
  ///
  /// In uz, this message translates to:
  /// **'Kuzatish'**
  String get actionFollow;

  /// No description provided for @actionUnfollow.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get actionUnfollow;

  /// No description provided for @actionPublish.
  ///
  /// In uz, this message translates to:
  /// **'Chop etish'**
  String get actionPublish;

  /// No description provided for @actionSelect.
  ///
  /// In uz, this message translates to:
  /// **'Tanlash'**
  String get actionSelect;

  /// No description provided for @actionPreview.
  ///
  /// In uz, this message translates to:
  /// **'Ko‘rib chiqish'**
  String get actionPreview;

  /// No description provided for @actionUpload.
  ///
  /// In uz, this message translates to:
  /// **'Yuklash'**
  String get actionUpload;

  /// No description provided for @actionRefresh.
  ///
  /// In uz, this message translates to:
  /// **'Yangilash'**
  String get actionRefresh;

  /// No description provided for @yes.
  ///
  /// In uz, this message translates to:
  /// **'Ha'**
  String get yes;

  /// No description provided for @no.
  ///
  /// In uz, this message translates to:
  /// **'Yo‘q'**
  String get no;

  /// No description provided for @errRequired.
  ///
  /// In uz, this message translates to:
  /// **'Bu maydon to‘ldirilishi kerak'**
  String get errRequired;

  /// No description provided for @errBadEmail.
  ///
  /// In uz, this message translates to:
  /// **'Email manzili noto‘g‘ri'**
  String get errBadEmail;

  /// No description provided for @errBadPhone.
  ///
  /// In uz, this message translates to:
  /// **'Telefon raqami noto‘g‘ri'**
  String get errBadPhone;

  /// No description provided for @errPasswordShort.
  ///
  /// In uz, this message translates to:
  /// **'Parol kamida 8 belgidan iborat bo‘lsin'**
  String get errPasswordShort;

  /// No description provided for @errNameShort.
  ///
  /// In uz, this message translates to:
  /// **'Ism juda qisqa'**
  String get errNameShort;

  /// No description provided for @errBadCode.
  ///
  /// In uz, this message translates to:
  /// **'Kod 6 ta raqamdan iborat'**
  String get errBadCode;

  /// No description provided for @errPasswordMismatch.
  ///
  /// In uz, this message translates to:
  /// **'Parollar mos kelmadi'**
  String get errPasswordMismatch;

  /// No description provided for @errOffline.
  ///
  /// In uz, this message translates to:
  /// **'Internet aloqasi yo‘q'**
  String get errOffline;

  /// No description provided for @errTimeout.
  ///
  /// In uz, this message translates to:
  /// **'Server javob bermadi. Internetni tekshiring — Wi-Fi bo‘lsa, mobil internetga o‘tib ko‘ring.'**
  String get errTimeout;

  /// No description provided for @errServer.
  ///
  /// In uz, this message translates to:
  /// **'Serverda xatolik'**
  String get errServer;

  /// No description provided for @errUnauthorized.
  ///
  /// In uz, this message translates to:
  /// **'Sessiya tugadi, qaytadan kiring'**
  String get errUnauthorized;

  /// No description provided for @errForbidden.
  ///
  /// In uz, this message translates to:
  /// **'Ruxsat yo‘q'**
  String get errForbidden;

  /// No description provided for @errNotFound.
  ///
  /// In uz, this message translates to:
  /// **'Topilmadi'**
  String get errNotFound;

  /// No description provided for @errConflict.
  ///
  /// In uz, this message translates to:
  /// **'Bu ma’lumot allaqachon band'**
  String get errConflict;

  /// No description provided for @errRateLimited.
  ///
  /// In uz, this message translates to:
  /// **'Juda ko‘p urinish. Biroz kuting'**
  String get errRateLimited;

  /// No description provided for @errUnknown.
  ///
  /// In uz, this message translates to:
  /// **'Nimadir noto‘g‘ri ketdi'**
  String get errUnknown;

  /// No description provided for @errBadCredentials.
  ///
  /// In uz, this message translates to:
  /// **'Email yoki parol noto‘g‘ri'**
  String get errBadCredentials;

  /// No description provided for @errEmailTaken.
  ///
  /// In uz, this message translates to:
  /// **'Bu email allaqachon ro‘yxatdan o‘tgan'**
  String get errEmailTaken;

  /// No description provided for @errEndpointMissing.
  ///
  /// In uz, this message translates to:
  /// **'Bu imkoniyat serverda hali yoqilmagan'**
  String get errEndpointMissing;

  /// No description provided for @devBackendRequired.
  ///
  /// In uz, this message translates to:
  /// **'BACKEND ENDPOINT REQUIRED'**
  String get devBackendRequired;

  /// No description provided for @devConfigRequired.
  ///
  /// In uz, this message translates to:
  /// **'CONFIG REQUIRED'**
  String get devConfigRequired;

  /// No description provided for @stateLoading.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda…'**
  String get stateLoading;

  /// No description provided for @stateEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha bo‘sh'**
  String get stateEmpty;

  /// No description provided for @stateEmptyHint.
  ///
  /// In uz, this message translates to:
  /// **'Birinchi bo‘lib qo‘shing'**
  String get stateEmptyHint;

  /// No description provided for @stateNoResults.
  ///
  /// In uz, this message translates to:
  /// **'Hech narsa topilmadi'**
  String get stateNoResults;

  /// No description provided for @stateNoResultsHint.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa so‘z bilan qidirib ko‘ring'**
  String get stateNoResultsHint;

  /// No description provided for @stateOfflineTitle.
  ///
  /// In uz, this message translates to:
  /// **'Oflayn'**
  String get stateOfflineTitle;

  /// No description provided for @stateOfflineHint.
  ///
  /// In uz, this message translates to:
  /// **'Internetga ulaning va qayta urinib ko‘ring'**
  String get stateOfflineHint;

  /// No description provided for @stateErrorTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik yuz berdi'**
  String get stateErrorTitle;

  /// No description provided for @welcomeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Raqamli\nshaxsingiz'**
  String get welcomeTitle;

  /// No description provided for @welcomeSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Bitta tegish bilan o‘zingizni, ishingizni va do‘koningizni ulashing.'**
  String get welcomeSubtitle;

  /// No description provided for @welcomeLogin.
  ///
  /// In uz, this message translates to:
  /// **'Kirish'**
  String get welcomeLogin;

  /// No description provided for @welcomeRegister.
  ///
  /// In uz, this message translates to:
  /// **'Ro‘yxatdan o‘tish'**
  String get welcomeRegister;

  /// No description provided for @loginTitle.
  ///
  /// In uz, this message translates to:
  /// **'Xush kelibsiz'**
  String get loginTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Email va telefon raqamingizni kiriting'**
  String get loginSubtitle;

  /// No description provided for @loginSubtitlePassword.
  ///
  /// In uz, this message translates to:
  /// **'Email va parolingizni kiriting'**
  String get loginSubtitlePassword;

  /// No description provided for @fieldEmail.
  ///
  /// In uz, this message translates to:
  /// **'Email'**
  String get fieldEmail;

  /// No description provided for @fieldPhone.
  ///
  /// In uz, this message translates to:
  /// **'Telefon'**
  String get fieldPhone;

  /// No description provided for @fieldPassword.
  ///
  /// In uz, this message translates to:
  /// **'Parol'**
  String get fieldPassword;

  /// No description provided for @a11yShowPassword.
  ///
  /// In uz, this message translates to:
  /// **'Parolni ko‘rsatish'**
  String get a11yShowPassword;

  /// No description provided for @a11yHidePassword.
  ///
  /// In uz, this message translates to:
  /// **'Parolni yashirish'**
  String get a11yHidePassword;

  /// No description provided for @fieldPasswordRepeat.
  ///
  /// In uz, this message translates to:
  /// **'Parolni takrorlang'**
  String get fieldPasswordRepeat;

  /// No description provided for @fieldName.
  ///
  /// In uz, this message translates to:
  /// **'Ism va familiya'**
  String get fieldName;

  /// No description provided for @fieldUsername.
  ///
  /// In uz, this message translates to:
  /// **'Foydalanuvchi nomi'**
  String get fieldUsername;

  /// No description provided for @fieldBio.
  ///
  /// In uz, this message translates to:
  /// **'O‘zingiz haqingizda'**
  String get fieldBio;

  /// No description provided for @loginSendCode.
  ///
  /// In uz, this message translates to:
  /// **'Kodni yuborish'**
  String get loginSendCode;

  /// No description provided for @loginWithPassword.
  ///
  /// In uz, this message translates to:
  /// **'Parol bilan kirish'**
  String get loginWithPassword;

  /// No description provided for @loginUseCode.
  ///
  /// In uz, this message translates to:
  /// **'Kod bilan kirish'**
  String get loginUseCode;

  /// No description provided for @loginNoAccount.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz yo‘qmi?'**
  String get loginNoAccount;

  /// No description provided for @loginHaveAccount.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz bormi?'**
  String get loginHaveAccount;

  /// No description provided for @verifyTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kodni kiriting'**
  String get verifyTitle;

  /// No description provided for @verifySentTo.
  ///
  /// In uz, this message translates to:
  /// **'6 xonali kod {email} manziliga yuborildi'**
  String verifySentTo(String email);

  /// No description provided for @verifySentTelegram.
  ///
  /// In uz, this message translates to:
  /// **'6 xonali kod Telegram botiga yuborildi'**
  String get verifySentTelegram;

  /// No description provided for @verifyNoChannel.
  ///
  /// In uz, this message translates to:
  /// **'Kod yuborilmadi. Serverda email xizmati sozlanmagan — qo‘llab-quvvatlashga murojaat qiling.'**
  String get verifyNoChannel;

  /// No description provided for @verifyResendIn.
  ///
  /// In uz, this message translates to:
  /// **'Qayta yuborish {seconds} soniyadan keyin'**
  String verifyResendIn(int seconds);

  /// No description provided for @verifyResend.
  ///
  /// In uz, this message translates to:
  /// **'Kodni qayta yuborish'**
  String get verifyResend;

  /// No description provided for @verifyChangeEmail.
  ///
  /// In uz, this message translates to:
  /// **'Email manzilini o‘zgartirish'**
  String get verifyChangeEmail;

  /// No description provided for @verifyWrongCode.
  ///
  /// In uz, this message translates to:
  /// **'Kod noto‘g‘ri'**
  String get verifyWrongCode;

  /// No description provided for @verifyWrongCodeHint.
  ///
  /// In uz, this message translates to:
  /// **'Kodni tekshirib, qaytadan kiriting'**
  String get verifyWrongCodeHint;

  /// No description provided for @verifyExpired.
  ///
  /// In uz, this message translates to:
  /// **'Kod muddati tugadi'**
  String get verifyExpired;

  /// No description provided for @verifyExpiredHint.
  ///
  /// In uz, this message translates to:
  /// **'Yangi kod so‘rang'**
  String get verifyExpiredHint;

  /// No description provided for @verifySuccess.
  ///
  /// In uz, this message translates to:
  /// **'Email tasdiqlandi'**
  String get verifySuccess;

  /// No description provided for @verifySending.
  ///
  /// In uz, this message translates to:
  /// **'Kod yuborilmoqda…'**
  String get verifySending;

  /// No description provided for @registerTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hisob yaratish'**
  String get registerTitle;

  /// No description provided for @registerStep.
  ///
  /// In uz, this message translates to:
  /// **'{current} / {total}-qadam'**
  String registerStep(int current, int total);

  /// No description provided for @registerNameHint.
  ///
  /// In uz, this message translates to:
  /// **'Sizni qanday chaqiraylik?'**
  String get registerNameHint;

  /// No description provided for @registerEmailHint.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash kodi shu manzilga yuboriladi'**
  String get registerEmailHint;

  /// No description provided for @registerPhoneHint.
  ///
  /// In uz, this message translates to:
  /// **'O‘zbekiston raqami: +998'**
  String get registerPhoneHint;

  /// No description provided for @registerPasswordHint.
  ///
  /// In uz, this message translates to:
  /// **'Kamida 8 belgi'**
  String get registerPasswordHint;

  /// No description provided for @setupTitle.
  ///
  /// In uz, this message translates to:
  /// **'Profilingizni to‘ldiring'**
  String get setupTitle;

  /// No description provided for @setupSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Buni keyin ham o‘zgartirishingiz mumkin'**
  String get setupSubtitle;

  /// No description provided for @setupSkip.
  ///
  /// In uz, this message translates to:
  /// **'Keyinroq'**
  String get setupSkip;

  /// No description provided for @setupPhoto.
  ///
  /// In uz, this message translates to:
  /// **'Rasm qo‘shish'**
  String get setupPhoto;

  /// No description provided for @logout.
  ///
  /// In uz, this message translates to:
  /// **'Chiqish'**
  String get logout;

  /// No description provided for @logoutConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Hisobdan chiqasizmi?'**
  String get logoutConfirm;

  /// No description provided for @navHome.
  ///
  /// In uz, this message translates to:
  /// **'Asosiy'**
  String get navHome;

  /// No description provided for @navDiscover.
  ///
  /// In uz, this message translates to:
  /// **'Tanlov'**
  String get navDiscover;

  /// No description provided for @navNfc.
  ///
  /// In uz, this message translates to:
  /// **'NFC'**
  String get navNfc;

  /// No description provided for @navReels.
  ///
  /// In uz, this message translates to:
  /// **'Reels'**
  String get navReels;

  /// No description provided for @navProfile.
  ///
  /// In uz, this message translates to:
  /// **'Profil'**
  String get navProfile;

  /// No description provided for @homeGreetingMorning.
  ///
  /// In uz, this message translates to:
  /// **'Xayrli tong'**
  String get homeGreetingMorning;

  /// No description provided for @homeGreetingDay.
  ///
  /// In uz, this message translates to:
  /// **'Xayrli kun'**
  String get homeGreetingDay;

  /// No description provided for @homeGreetingEvening.
  ///
  /// In uz, this message translates to:
  /// **'Xayrli kech'**
  String get homeGreetingEvening;

  /// No description provided for @homeActiveId.
  ///
  /// In uz, this message translates to:
  /// **'Faol NFC ID'**
  String get homeActiveId;

  /// No description provided for @homeNoId.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID hali yo‘q'**
  String get homeNoId;

  /// No description provided for @homeNoIdHint.
  ///
  /// In uz, this message translates to:
  /// **'Do‘kondan karta oling yoki ID yarating'**
  String get homeNoIdHint;

  /// No description provided for @homeBizAddress.
  ///
  /// In uz, this message translates to:
  /// **'BIZNES MANZILI'**
  String get homeBizAddress;

  /// No description provided for @homeBizPitchTitle.
  ///
  /// In uz, this message translates to:
  /// **'Biznesingizni shu yerga qo‘shing'**
  String get homeBizPitchTitle;

  /// No description provided for @homeBizPitchHint.
  ///
  /// In uz, this message translates to:
  /// **'Katalog, narxlar va buyurtma — mijoz bitta tegishda ko‘radi'**
  String get homeBizPitchHint;

  /// No description provided for @homeQuickActions.
  ///
  /// In uz, this message translates to:
  /// **'Tezkor amallar'**
  String get homeQuickActions;

  /// No description provided for @homeStories.
  ///
  /// In uz, this message translates to:
  /// **'Stories'**
  String get homeStories;

  /// No description provided for @homeYourStory.
  ///
  /// In uz, this message translates to:
  /// **'Sizning story'**
  String get homeYourStory;

  /// No description provided for @homePosts.
  ///
  /// In uz, this message translates to:
  /// **'Postlar'**
  String get homePosts;

  /// No description provided for @homeReels.
  ///
  /// In uz, this message translates to:
  /// **'Reels'**
  String get homeReels;

  /// No description provided for @homeActivity.
  ///
  /// In uz, this message translates to:
  /// **'So‘nggi harakatlar'**
  String get homeActivity;

  /// No description provided for @homeShop.
  ///
  /// In uz, this message translates to:
  /// **'Do‘kon'**
  String get homeShop;

  /// No description provided for @homeBusiness.
  ///
  /// In uz, this message translates to:
  /// **'Biznes'**
  String get homeBusiness;

  /// No description provided for @modePersonal.
  ///
  /// In uz, this message translates to:
  /// **'Shaxsiy'**
  String get modePersonal;

  /// No description provided for @modeBusiness.
  ///
  /// In uz, this message translates to:
  /// **'Biznes'**
  String get modeBusiness;

  /// No description provided for @modeSwitched.
  ///
  /// In uz, this message translates to:
  /// **'{mode} rejimga o‘tildi'**
  String modeSwitched(String mode);

  /// No description provided for @nfcCenter.
  ///
  /// In uz, this message translates to:
  /// **'NFC markazi'**
  String get nfcCenter;

  /// No description provided for @nfcTapToScan.
  ///
  /// In uz, this message translates to:
  /// **'Skanerlash uchun bosing'**
  String get nfcTapToScan;

  /// No description provided for @nfcScanShort.
  ///
  /// In uz, this message translates to:
  /// **'Skanerlash'**
  String get nfcScanShort;

  /// No description provided for @nfcHoldCard.
  ///
  /// In uz, this message translates to:
  /// **'Kartani telefon orqasiga tegizing'**
  String get nfcHoldCard;

  /// No description provided for @nfcScanning.
  ///
  /// In uz, this message translates to:
  /// **'Qidirilmoqda…'**
  String get nfcScanning;

  /// No description provided for @nfcScanSuccess.
  ///
  /// In uz, this message translates to:
  /// **'Karta o‘qildi'**
  String get nfcScanSuccess;

  /// No description provided for @nfcScanFailed.
  ///
  /// In uz, this message translates to:
  /// **'Karta o‘qilmadi'**
  String get nfcScanFailed;

  /// No description provided for @nfcUnsupported.
  ///
  /// In uz, this message translates to:
  /// **'Bu qurilmada NFC yo‘q'**
  String get nfcUnsupported;

  /// No description provided for @nfcUnsupportedHint.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID’laringizni QR kod orqali ulashishingiz mumkin'**
  String get nfcUnsupportedHint;

  /// No description provided for @nfcDisabled.
  ///
  /// In uz, this message translates to:
  /// **'NFC o‘chirilgan'**
  String get nfcDisabled;

  /// No description provided for @nfcDisabledHint.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalar → Ulanishlar → NFC bo‘limidan yoqing'**
  String get nfcDisabledHint;

  /// No description provided for @nfcOpenSettings.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalarni ochish'**
  String get nfcOpenSettings;

  /// No description provided for @nfcMyIds.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID’larim'**
  String get nfcMyIds;

  /// No description provided for @nfcIdDetail.
  ///
  /// In uz, this message translates to:
  /// **'ID ma’lumotlari'**
  String get nfcIdDetail;

  /// No description provided for @nfcCards.
  ///
  /// In uz, this message translates to:
  /// **'Kartalar'**
  String get nfcCards;

  /// No description provided for @nfcHistory.
  ///
  /// In uz, this message translates to:
  /// **'Tarix'**
  String get nfcHistory;

  /// No description provided for @nfcGift.
  ///
  /// In uz, this message translates to:
  /// **'Sovg‘a qilish'**
  String get nfcGift;

  /// No description provided for @nfcSecurity.
  ///
  /// In uz, this message translates to:
  /// **'Xavfsizlik'**
  String get nfcSecurity;

  /// No description provided for @nfcActive.
  ///
  /// In uz, this message translates to:
  /// **'Faol'**
  String get nfcActive;

  /// No description provided for @nfcInactive.
  ///
  /// In uz, this message translates to:
  /// **'Faol emas'**
  String get nfcInactive;

  /// No description provided for @nfcSetPrimary.
  ///
  /// In uz, this message translates to:
  /// **'Asosiy qilish'**
  String get nfcSetPrimary;

  /// No description provided for @nfcPrimary.
  ///
  /// In uz, this message translates to:
  /// **'Asosiy'**
  String get nfcPrimary;

  /// No description provided for @nfcLinkCard.
  ///
  /// In uz, this message translates to:
  /// **'Kartani ulash'**
  String get nfcLinkCard;

  /// No description provided for @nfcBlockCard.
  ///
  /// In uz, this message translates to:
  /// **'Kartani bloklash'**
  String get nfcBlockCard;

  /// No description provided for @nfcBlockConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Karta bloklansinmi? Tegizilganda u profilni ochmay qo‘yadi. Keyin blokdan chiqarish mumkin.'**
  String get nfcBlockConfirm;

  /// No description provided for @nfcUnblockCard.
  ///
  /// In uz, this message translates to:
  /// **'Blokdan chiqarish'**
  String get nfcUnblockCard;

  /// No description provided for @nfcDeleteConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Bu NFC ID o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.'**
  String get nfcDeleteConfirm;

  /// No description provided for @nfcScans.
  ///
  /// In uz, this message translates to:
  /// **'Skanerlashlar'**
  String get nfcScans;

  /// No description provided for @nfcViews.
  ///
  /// In uz, this message translates to:
  /// **'Ko‘rishlar'**
  String get nfcViews;

  /// No description provided for @bizTaps.
  ///
  /// In uz, this message translates to:
  /// **'Bosishlar'**
  String get bizTaps;

  /// No description provided for @nfcShowQr.
  ///
  /// In uz, this message translates to:
  /// **'QR kodni ko‘rsatish'**
  String get nfcShowQr;

  /// No description provided for @nfcQrHint.
  ///
  /// In uz, this message translates to:
  /// **'Profilingizni ochish uchun shu kodni skanerlang'**
  String get nfcQrHint;

  /// No description provided for @nfcGiftHint.
  ///
  /// In uz, this message translates to:
  /// **'ID’ni boshqa foydalanuvchiga sovg‘a qiling'**
  String get nfcGiftHint;

  /// No description provided for @nfcGiftRecipient.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qiluvchining emaili'**
  String get nfcGiftRecipient;

  /// No description provided for @nfcGiftSent.
  ///
  /// In uz, this message translates to:
  /// **'Sovg‘a taklifi yuborildi'**
  String get nfcGiftSent;

  /// No description provided for @profileFollowers.
  ///
  /// In uz, this message translates to:
  /// **'Obunachilar'**
  String get profileFollowers;

  /// No description provided for @profileFollowing.
  ///
  /// In uz, this message translates to:
  /// **'Obunalar'**
  String get profileFollowing;

  /// No description provided for @profilePosts.
  ///
  /// In uz, this message translates to:
  /// **'Postlar'**
  String get profilePosts;

  /// No description provided for @profileEdit.
  ///
  /// In uz, this message translates to:
  /// **'Profilni tahrirlash'**
  String get profileEdit;

  /// No description provided for @profileMusic.
  ///
  /// In uz, this message translates to:
  /// **'Profil musiqasi'**
  String get profileMusic;

  /// No description provided for @profileMusicAdd.
  ///
  /// In uz, this message translates to:
  /// **'Musiqa qo‘shish'**
  String get profileMusicAdd;

  /// No description provided for @profileLinks.
  ///
  /// In uz, this message translates to:
  /// **'Havolalar'**
  String get profileLinks;

  /// No description provided for @profileContact.
  ///
  /// In uz, this message translates to:
  /// **'Aloqa'**
  String get profileContact;

  /// No description provided for @profileSaved.
  ///
  /// In uz, this message translates to:
  /// **'Profil saqlandi'**
  String get profileSaved;

  /// No description provided for @profileNoBio.
  ///
  /// In uz, this message translates to:
  /// **'Tavsif qo‘shilmagan'**
  String get profileNoBio;

  /// No description provided for @discoverTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kashf eting'**
  String get discoverTitle;

  /// No description provided for @discoverPeople.
  ///
  /// In uz, this message translates to:
  /// **'Odamlar'**
  String get discoverPeople;

  /// No description provided for @discoverBusinesses.
  ///
  /// In uz, this message translates to:
  /// **'Bizneslar'**
  String get discoverBusinesses;

  /// No description provided for @discoverProducts.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulotlar'**
  String get discoverProducts;

  /// No description provided for @discoverTrending.
  ///
  /// In uz, this message translates to:
  /// **'Ommabop'**
  String get discoverTrending;

  /// No description provided for @discoverSuggested.
  ///
  /// In uz, this message translates to:
  /// **'Tavsiya etiladi'**
  String get discoverSuggested;

  /// No description provided for @searchHint.
  ///
  /// In uz, this message translates to:
  /// **'Odam, biznes yoki NFC ID'**
  String get searchHint;

  /// No description provided for @searchRecent.
  ///
  /// In uz, this message translates to:
  /// **'So‘nggi qidiruvlar'**
  String get searchRecent;

  /// No description provided for @searchClear.
  ///
  /// In uz, this message translates to:
  /// **'Tozalash'**
  String get searchClear;

  /// No description provided for @storyCreate.
  ///
  /// In uz, this message translates to:
  /// **'Story qo‘shish'**
  String get storyCreate;

  /// No description provided for @storyDeleteConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Bu story o‘chirilsinmi?'**
  String get storyDeleteConfirm;

  /// No description provided for @postCreate.
  ///
  /// In uz, this message translates to:
  /// **'Post qo‘shish'**
  String get postCreate;

  /// No description provided for @postCaption.
  ///
  /// In uz, this message translates to:
  /// **'Izoh yozing…'**
  String get postCaption;

  /// No description provided for @postComments.
  ///
  /// In uz, this message translates to:
  /// **'Izohlar'**
  String get postComments;

  /// No description provided for @postNoComments.
  ///
  /// In uz, this message translates to:
  /// **'Izohlar yo‘q'**
  String get postNoComments;

  /// No description provided for @postAddComment.
  ///
  /// In uz, this message translates to:
  /// **'Izoh qoldiring…'**
  String get postAddComment;

  /// No description provided for @postLiked.
  ///
  /// In uz, this message translates to:
  /// **'Yoqdi'**
  String get postLiked;

  /// No description provided for @postSave.
  ///
  /// In uz, this message translates to:
  /// **'Saqlash'**
  String get postSave;

  /// No description provided for @postDeleteConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Bu post o‘chirilsinmi?'**
  String get postDeleteConfirm;

  /// No description provided for @reelCreate.
  ///
  /// In uz, this message translates to:
  /// **'Reel qo‘shish'**
  String get reelCreate;

  /// No description provided for @storyPublish.
  ///
  /// In uz, this message translates to:
  /// **'Storyni joylash'**
  String get storyPublish;

  /// No description provided for @postPublish.
  ///
  /// In uz, this message translates to:
  /// **'Postni joylash'**
  String get postPublish;

  /// No description provided for @reelPublish.
  ///
  /// In uz, this message translates to:
  /// **'Reelni joylash'**
  String get reelPublish;

  /// No description provided for @storyLike.
  ///
  /// In uz, this message translates to:
  /// **'Yoqtirish'**
  String get storyLike;

  /// No description provided for @storyComments.
  ///
  /// In uz, this message translates to:
  /// **'Izohlar'**
  String get storyComments;

  /// No description provided for @storyCommentHint.
  ///
  /// In uz, this message translates to:
  /// **'Izoh yozing…'**
  String get storyCommentHint;

  /// No description provided for @actionFollowing.
  ///
  /// In uz, this message translates to:
  /// **'Kuzatilmoqda'**
  String get actionFollowing;

  /// No description provided for @postLike.
  ///
  /// In uz, this message translates to:
  /// **'Yoqtirish'**
  String get postLike;

  /// No description provided for @reelsEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha reels yo‘q'**
  String get reelsEmpty;

  /// No description provided for @uploadProgress.
  ///
  /// In uz, this message translates to:
  /// **'Yuklanmoqda {percent}%'**
  String uploadProgress(int percent);

  /// No description provided for @uploadFailed.
  ///
  /// In uz, this message translates to:
  /// **'Yuklab bo‘lmadi'**
  String get uploadFailed;

  /// No description provided for @mediaPickPhoto.
  ///
  /// In uz, this message translates to:
  /// **'Rasm tanlash'**
  String get mediaPickPhoto;

  /// No description provided for @mediaPickVideo.
  ///
  /// In uz, this message translates to:
  /// **'Video tanlash'**
  String get mediaPickVideo;

  /// No description provided for @mediaCamera.
  ///
  /// In uz, this message translates to:
  /// **'Kamera'**
  String get mediaCamera;

  /// No description provided for @mediaGallery.
  ///
  /// In uz, this message translates to:
  /// **'Galereya'**
  String get mediaGallery;

  /// No description provided for @bizTitle.
  ///
  /// In uz, this message translates to:
  /// **'Biznes'**
  String get bizTitle;

  /// No description provided for @bizDashboard.
  ///
  /// In uz, this message translates to:
  /// **'Boshqaruv paneli'**
  String get bizDashboard;

  /// No description provided for @bizStorefront.
  ///
  /// In uz, this message translates to:
  /// **'Vitrina'**
  String get bizStorefront;

  /// No description provided for @bizCatalog.
  ///
  /// In uz, this message translates to:
  /// **'Katalog'**
  String get bizCatalog;

  /// No description provided for @bizAnalytics.
  ///
  /// In uz, this message translates to:
  /// **'Tahlil'**
  String get bizAnalytics;

  /// No description provided for @bizCreate.
  ///
  /// In uz, this message translates to:
  /// **'Biznes yaratish'**
  String get bizCreate;

  /// No description provided for @bizNone.
  ///
  /// In uz, this message translates to:
  /// **'Sizda biznes hisobi yo‘q'**
  String get bizNone;

  /// No description provided for @bizNoneHint.
  ///
  /// In uz, this message translates to:
  /// **'Kompaniyangizni bir necha qadamda oching'**
  String get bizNoneHint;

  /// No description provided for @bizPitchTitle.
  ///
  /// In uz, this message translates to:
  /// **'Biznesingiz uchun alohida sahifa'**
  String get bizPitchTitle;

  /// No description provided for @bizPitchLead.
  ///
  /// In uz, this message translates to:
  /// **'Mijoz NFC kartani tegizadi yoki havolani ochadi — kompaniyangiz, mahsulotlaringiz va narxlaringiz darhol qarshisida.'**
  String get bizPitchLead;

  /// No description provided for @bizPitchCatalog.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot va xizmatlar katalogi — narxi bilan'**
  String get bizPitchCatalog;

  /// No description provided for @bizPitchOrders.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani to‘g‘ridan-to‘g‘ri qabul qilish'**
  String get bizPitchOrders;

  /// No description provided for @bizPitchReach.
  ///
  /// In uz, this message translates to:
  /// **'Postlar, istoryalar va «Tanlov» ro‘yxatida ko‘rinish'**
  String get bizPitchReach;

  /// No description provided for @bizPitchAddress.
  ///
  /// In uz, this message translates to:
  /// **'O‘z manzilingiz: nfcstore.uz/c/nomingiz'**
  String get bizPitchAddress;

  /// No description provided for @bizPitchDemo.
  ///
  /// In uz, this message translates to:
  /// **'Namunani ko‘rish'**
  String get bizPitchDemo;

  /// No description provided for @bizPitchDemoHint.
  ///
  /// In uz, this message translates to:
  /// **'Haqiqiy biznes sahifasi qanday ko‘rinishini oching'**
  String get bizPitchDemoHint;

  /// No description provided for @bizId.
  ///
  /// In uz, this message translates to:
  /// **'Biznes manzili'**
  String get bizId;

  /// No description provided for @bizIdHint.
  ///
  /// In uz, this message translates to:
  /// **'nfcstore.uz/c/nomingiz'**
  String get bizIdHint;

  /// No description provided for @bizIdChecking.
  ///
  /// In uz, this message translates to:
  /// **'Tekshirilmoqda…'**
  String get bizIdChecking;

  /// No description provided for @bizIdFree.
  ///
  /// In uz, this message translates to:
  /// **'Bo‘sh'**
  String get bizIdFree;

  /// No description provided for @bizIdTaken.
  ///
  /// In uz, this message translates to:
  /// **'Band'**
  String get bizIdTaken;

  /// No description provided for @bizName.
  ///
  /// In uz, this message translates to:
  /// **'Kompaniya nomi'**
  String get bizName;

  /// No description provided for @bizCategory.
  ///
  /// In uz, this message translates to:
  /// **'Yo‘nalish'**
  String get bizCategory;

  /// No description provided for @bizCity.
  ///
  /// In uz, this message translates to:
  /// **'Shahar'**
  String get bizCity;

  /// No description provided for @bizAddress.
  ///
  /// In uz, this message translates to:
  /// **'Manzil'**
  String get bizAddress;

  /// No description provided for @bizDescription.
  ///
  /// In uz, this message translates to:
  /// **'Tavsif'**
  String get bizDescription;

  /// No description provided for @bizWebsite.
  ///
  /// In uz, this message translates to:
  /// **'Veb-sayt'**
  String get bizWebsite;

  /// No description provided for @bizHours.
  ///
  /// In uz, this message translates to:
  /// **'Ish vaqti'**
  String get bizHours;

  /// No description provided for @bizContactSheet.
  ///
  /// In uz, this message translates to:
  /// **'Bog‘lanish'**
  String get bizContactSheet;

  /// No description provided for @bizProducts.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulotlar'**
  String get bizProducts;

  /// No description provided for @bizServices.
  ///
  /// In uz, this message translates to:
  /// **'Xizmatlar'**
  String get bizServices;

  /// No description provided for @bizAddProduct.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot qo‘shish'**
  String get bizAddProduct;

  /// No description provided for @bizProductName.
  ///
  /// In uz, this message translates to:
  /// **'Nomi'**
  String get bizProductName;

  /// No description provided for @bizPrice.
  ///
  /// In uz, this message translates to:
  /// **'Narxi'**
  String get bizPrice;

  /// No description provided for @bizSalePrice.
  ///
  /// In uz, this message translates to:
  /// **'Chegirma narxi'**
  String get bizSalePrice;

  /// No description provided for @bizAvailable.
  ///
  /// In uz, this message translates to:
  /// **'Mavjud'**
  String get bizAvailable;

  /// No description provided for @bizUnavailable.
  ///
  /// In uz, this message translates to:
  /// **'Mavjud emas'**
  String get bizUnavailable;

  /// No description provided for @bizCatalogEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Katalog bo‘sh'**
  String get bizCatalogEmpty;

  /// No description provided for @bizSubmitReview.
  ///
  /// In uz, this message translates to:
  /// **'Ko‘rib chiqishga yuborish'**
  String get bizSubmitReview;

  /// No description provided for @bizPending.
  ///
  /// In uz, this message translates to:
  /// **'Ko‘rib chiqilmoqda'**
  String get bizPending;

  /// No description provided for @shopTitle.
  ///
  /// In uz, this message translates to:
  /// **'Do‘kon'**
  String get shopTitle;

  /// No description provided for @shopAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get shopAll;

  /// No description provided for @shopCards.
  ///
  /// In uz, this message translates to:
  /// **'NFC kartalar'**
  String get shopCards;

  /// No description provided for @shopIds.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID’lar'**
  String get shopIds;

  /// No description provided for @shopBuy.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma berish'**
  String get shopBuy;

  /// No description provided for @shopSoldOut.
  ///
  /// In uz, this message translates to:
  /// **'Sotuvda yo‘q'**
  String get shopSoldOut;

  /// No description provided for @checkoutTitle.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmani rasmiylashtirish'**
  String get checkoutTitle;

  /// No description provided for @checkoutTotal.
  ///
  /// In uz, this message translates to:
  /// **'Jami'**
  String get checkoutTotal;

  /// No description provided for @checkoutPayWith.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov usuli'**
  String get checkoutPayWith;

  /// No description provided for @checkoutPlace.
  ///
  /// In uz, this message translates to:
  /// **'To‘lovga o‘tish'**
  String get checkoutPlace;

  /// No description provided for @paymentPending.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov kutilmoqda'**
  String get paymentPending;

  /// No description provided for @paymentPendingHint.
  ///
  /// In uz, this message translates to:
  /// **'To‘lovni yakunlang, natija shu yerda ko‘rinadi'**
  String get paymentPendingHint;

  /// No description provided for @paymentSuccess.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov muvaffaqiyatli'**
  String get paymentSuccess;

  /// No description provided for @paymentFailed.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov amalga oshmadi'**
  String get paymentFailed;

  /// No description provided for @paymentCancelled.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov bekor qilindi'**
  String get paymentCancelled;

  /// No description provided for @paymentNotConfigured.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov tizimi sozlanmagan'**
  String get paymentNotConfigured;

  /// No description provided for @orders.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar'**
  String get orders;

  /// No description provided for @ordersEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtmalar yo‘q'**
  String get ordersEmpty;

  /// No description provided for @orderNumber.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma №{id}'**
  String orderNumber(String id);

  /// No description provided for @paymentHistory.
  ///
  /// In uz, this message translates to:
  /// **'To‘lovlar tarixi'**
  String get paymentHistory;

  /// No description provided for @activityTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get activityTitle;

  /// No description provided for @activityEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Yangi bildirishnoma yo‘q'**
  String get activityEmpty;

  /// No description provided for @activityMarkRead.
  ///
  /// In uz, this message translates to:
  /// **'Hammasini o‘qilgan deb belgilash'**
  String get activityMarkRead;

  /// No description provided for @activityAll.
  ///
  /// In uz, this message translates to:
  /// **'Barchasi'**
  String get activityAll;

  /// No description provided for @activityUnread.
  ///
  /// In uz, this message translates to:
  /// **'O‘qilmagan'**
  String get activityUnread;

  /// No description provided for @settings.
  ///
  /// In uz, this message translates to:
  /// **'Sozlamalar'**
  String get settings;

  /// No description provided for @settingsAccount.
  ///
  /// In uz, this message translates to:
  /// **'Hisob'**
  String get settingsAccount;

  /// No description provided for @settingsSecurity.
  ///
  /// In uz, this message translates to:
  /// **'Xavfsizlik'**
  String get settingsSecurity;

  /// No description provided for @settingsChangePassword.
  ///
  /// In uz, this message translates to:
  /// **'Parolni o‘zgartirish'**
  String get settingsChangePassword;

  /// No description provided for @settingsCurrentPassword.
  ///
  /// In uz, this message translates to:
  /// **'Joriy parol'**
  String get settingsCurrentPassword;

  /// No description provided for @settingsNewPassword.
  ///
  /// In uz, this message translates to:
  /// **'Yangi parol'**
  String get settingsNewPassword;

  /// No description provided for @settingsPasswordChanged.
  ///
  /// In uz, this message translates to:
  /// **'Parol o‘zgartirildi'**
  String get settingsPasswordChanged;

  /// No description provided for @settingsAppearance.
  ///
  /// In uz, this message translates to:
  /// **'Ko‘rinish'**
  String get settingsAppearance;

  /// No description provided for @settingsTheme.
  ///
  /// In uz, this message translates to:
  /// **'Mavzu'**
  String get settingsTheme;

  /// No description provided for @settingsLanguage.
  ///
  /// In uz, this message translates to:
  /// **'Til'**
  String get settingsLanguage;

  /// No description provided for @settingsNotifications.
  ///
  /// In uz, this message translates to:
  /// **'Bildirishnomalar'**
  String get settingsNotifications;

  /// No description provided for @settingsPrivacy.
  ///
  /// In uz, this message translates to:
  /// **'Maxfiylik'**
  String get settingsPrivacy;

  /// No description provided for @settingsPayment.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov'**
  String get settingsPayment;

  /// Sozlamalar: jismoniy karta buyurtmalari bo'limi
  ///
  /// In uz, this message translates to:
  /// **'NFC karta'**
  String get settingsShopSection;

  /// No description provided for @settingsReferral.
  ///
  /// In uz, this message translates to:
  /// **'Referal'**
  String get settingsReferral;

  /// No description provided for @settingsReferralHint.
  ///
  /// In uz, this message translates to:
  /// **'Do‘stingiz sizning kodingiz bilan ro‘yxatdan o‘tsa, ikkovingiz ham chegirma olasiz'**
  String get settingsReferralHint;

  /// No description provided for @settingsPremium.
  ///
  /// In uz, this message translates to:
  /// **'Premium'**
  String get settingsPremium;

  /// No description provided for @settingsSupport.
  ///
  /// In uz, this message translates to:
  /// **'Yordam'**
  String get settingsSupport;

  /// No description provided for @settingsNews.
  ///
  /// In uz, this message translates to:
  /// **'Yangiliklar'**
  String get settingsNews;

  /// No description provided for @settingsAbout.
  ///
  /// In uz, this message translates to:
  /// **'Ilova haqida'**
  String get settingsAbout;

  /// No description provided for @legalPrivacy.
  ///
  /// In uz, this message translates to:
  /// **'Maxfiylik siyosati'**
  String get legalPrivacy;

  /// No description provided for @legalTerms.
  ///
  /// In uz, this message translates to:
  /// **'Foydalanish shartlari'**
  String get legalTerms;

  /// No description provided for @settingsVersion.
  ///
  /// In uz, this message translates to:
  /// **'Versiya {version}'**
  String settingsVersion(String version);

  /// No description provided for @settingsDeleteAccount.
  ///
  /// In uz, this message translates to:
  /// **'Hisobni o‘chirish'**
  String get settingsDeleteAccount;

  /// No description provided for @settingsDeleteConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Hisob butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.'**
  String get settingsDeleteConfirm;

  /// No description provided for @settingsDeleteTypeEmail.
  ///
  /// In uz, this message translates to:
  /// **'Tasdiqlash uchun email manzilingizni yozing'**
  String get settingsDeleteTypeEmail;

  /// No description provided for @themePearl.
  ///
  /// In uz, this message translates to:
  /// **'Marvarid'**
  String get themePearl;

  /// No description provided for @themeGraphite.
  ///
  /// In uz, this message translates to:
  /// **'Grafit'**
  String get themeGraphite;

  /// No description provided for @themeOcean.
  ///
  /// In uz, this message translates to:
  /// **'Okean'**
  String get themeOcean;

  /// No description provided for @themeAurora.
  ///
  /// In uz, this message translates to:
  /// **'Aurora'**
  String get themeAurora;

  /// No description provided for @langUz.
  ///
  /// In uz, this message translates to:
  /// **'O‘zbekcha'**
  String get langUz;

  /// No description provided for @langRu.
  ///
  /// In uz, this message translates to:
  /// **'Русский'**
  String get langRu;

  /// No description provided for @langEn.
  ///
  /// In uz, this message translates to:
  /// **'English'**
  String get langEn;

  /// No description provided for @supportWriteUs.
  ///
  /// In uz, this message translates to:
  /// **'Bizga yozing'**
  String get supportWriteUs;

  /// No description provided for @supportSent.
  ///
  /// In uz, this message translates to:
  /// **'Murojaat yuborildi'**
  String get supportSent;

  /// No description provided for @musicTitle.
  ///
  /// In uz, this message translates to:
  /// **'Musiqa'**
  String get musicTitle;

  /// No description provided for @musicFailed.
  ///
  /// In uz, this message translates to:
  /// **'Qo‘shiqni ochib bo‘lmadi'**
  String get musicFailed;

  /// No description provided for @rulesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Joylashdan oldin o‘qing'**
  String get rulesTitle;

  /// No description provided for @rulesBody.
  ///
  /// In uz, this message translates to:
  /// **'Joylashtirilayotgan kontent quyidagilarni o‘z ichiga olmasligi shart: diniy targ‘ibot yoki ekstremistik mazmun, pornografik yoki jinsiy xarakterdagi tasvirlar, siyosiy targ‘ibot, shuningdek O‘zbekiston Respublikasi qonunchiligiga zid har qanday material. Ushbu qoidalar buzilgan taqdirda kontent ogohlantirishsiz o‘chiriladi.'**
  String get rulesBody;

  /// No description provided for @rulesAccept.
  ///
  /// In uz, this message translates to:
  /// **'Men qoidalarni o‘qidim va roziman'**
  String get rulesAccept;

  /// No description provided for @rulesContinue.
  ///
  /// In uz, this message translates to:
  /// **'Davom etish'**
  String get rulesContinue;

  /// No description provided for @rulesReminder.
  ///
  /// In uz, this message translates to:
  /// **'Joylash bilan kontent qoidalariga rozilik bildirasiz.'**
  String get rulesReminder;

  /// Izoh yozish maydoni ustidagi qoidalar eslatmasi
  ///
  /// In uz, this message translates to:
  /// **'Izohda haqorat, so‘kinish, tahdid, diniy yoki siyosiy targ‘ibot taqiqlanadi. Qoidabuzar izoh shikoyat qilinadi va o‘chiriladi.'**
  String get commentRulesNote;

  /// No description provided for @rulesOpen.
  ///
  /// In uz, this message translates to:
  /// **'Kontent qoidalari'**
  String get rulesOpen;

  /// No description provided for @rulesNotAccepted.
  ///
  /// In uz, this message translates to:
  /// **'Kontent qoidalariga rozilik berilmadi.'**
  String get rulesNotAccepted;

  /// No description provided for @reportTitle.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat qilish'**
  String get reportTitle;

  /// No description provided for @reportSent.
  ///
  /// In uz, this message translates to:
  /// **'Shikoyat yuborildi'**
  String get reportSent;

  /// No description provided for @reportReasonPorn.
  ///
  /// In uz, this message translates to:
  /// **'Pornografik yoki jinsiy mazmun'**
  String get reportReasonPorn;

  /// No description provided for @reportReasonReligious.
  ///
  /// In uz, this message translates to:
  /// **'Diniy targ‘ibot yoki ekstremizm'**
  String get reportReasonReligious;

  /// No description provided for @reportReasonPolitical.
  ///
  /// In uz, this message translates to:
  /// **'Siyosiy targ‘ibot'**
  String get reportReasonPolitical;

  /// No description provided for @reportReasonViolence.
  ///
  /// In uz, this message translates to:
  /// **'Zo‘ravonlik yoki shafqatsizlik'**
  String get reportReasonViolence;

  /// No description provided for @reportReasonInsult.
  ///
  /// In uz, this message translates to:
  /// **'Haqorat yoki kamsitish'**
  String get reportReasonInsult;

  /// No description provided for @reportReasonSpam.
  ///
  /// In uz, this message translates to:
  /// **'Spam yoki aldov'**
  String get reportReasonSpam;

  /// No description provided for @reportReasonIllegal.
  ///
  /// In uz, this message translates to:
  /// **'Qonunga zid material'**
  String get reportReasonIllegal;

  /// No description provided for @reportReasonCopyright.
  ///
  /// In uz, this message translates to:
  /// **'Mualliflik huquqi'**
  String get reportReasonCopyright;

  /// No description provided for @reportReasonOther.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa'**
  String get reportReasonOther;

  /// No description provided for @reportNote.
  ///
  /// In uz, this message translates to:
  /// **'Izoh (ixtiyoriy)'**
  String get reportNote;

  /// No description provided for @blockUser.
  ///
  /// In uz, this message translates to:
  /// **'Bloklash'**
  String get blockUser;

  /// No description provided for @unblockUser.
  ///
  /// In uz, this message translates to:
  /// **'Blokdan chiqarish'**
  String get unblockUser;

  /// No description provided for @blockedList.
  ///
  /// In uz, this message translates to:
  /// **'Bloklanganlar'**
  String get blockedList;

  /// No description provided for @lockTitle.
  ///
  /// In uz, this message translates to:
  /// **'Ilova qulfi'**
  String get lockTitle;

  /// No description provided for @lockHint.
  ///
  /// In uz, this message translates to:
  /// **'PIN kodni kiriting'**
  String get lockHint;

  /// No description provided for @lockWrong.
  ///
  /// In uz, this message translates to:
  /// **'PIN noto‘g‘ri'**
  String get lockWrong;

  /// No description provided for @lockSetPin.
  ///
  /// In uz, this message translates to:
  /// **'Yangi PIN kod'**
  String get lockSetPin;

  /// No description provided for @lockRepeatPin.
  ///
  /// In uz, this message translates to:
  /// **'PIN kodni takrorlang'**
  String get lockRepeatPin;

  /// No description provided for @lockMismatch.
  ///
  /// In uz, this message translates to:
  /// **'PIN kodlar mos kelmadi'**
  String get lockMismatch;

  /// No description provided for @lockEnabled.
  ///
  /// In uz, this message translates to:
  /// **'Ilova qulfi yoqildi'**
  String get lockEnabled;

  /// No description provided for @lockBiometricReason.
  ///
  /// In uz, this message translates to:
  /// **'NFCSTORE’ni ochish'**
  String get lockBiometricReason;

  /// No description provided for @lockBiometric.
  ///
  /// In uz, this message translates to:
  /// **'Biometrika bilan ochish'**
  String get lockBiometric;

  /// No description provided for @lockBiometricNone.
  ///
  /// In uz, this message translates to:
  /// **'Bu qurilmada biometrika yo‘q'**
  String get lockBiometricNone;

  /// No description provided for @lockOff.
  ///
  /// In uz, this message translates to:
  /// **'Qulfni o‘chirish'**
  String get lockOff;

  /// No description provided for @lockDesc.
  ///
  /// In uz, this message translates to:
  /// **'Ilovani shu qurilmada ochishni PIN bilan to‘sadi. Bu akkaunt paroli emas.'**
  String get lockDesc;

  /// No description provided for @actionSend.
  ///
  /// In uz, this message translates to:
  /// **'Yuborish'**
  String get actionSend;

  /// No description provided for @giftOffers.
  ///
  /// In uz, this message translates to:
  /// **'Sovg‘a takliflari'**
  String get giftOffers;

  /// No description provided for @giftIncoming.
  ///
  /// In uz, this message translates to:
  /// **'Sizga kelgan'**
  String get giftIncoming;

  /// No description provided for @giftOutgoing.
  ///
  /// In uz, this message translates to:
  /// **'Siz yuborgan'**
  String get giftOutgoing;

  /// No description provided for @giftAccept.
  ///
  /// In uz, this message translates to:
  /// **'Qabul qilish'**
  String get giftAccept;

  /// No description provided for @giftReject.
  ///
  /// In uz, this message translates to:
  /// **'Rad etish'**
  String get giftReject;

  /// No description provided for @giftCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get giftCancel;

  /// No description provided for @giftNoOffers.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha sovg‘a taklifi yo‘q'**
  String get giftNoOffers;

  /// No description provided for @profilePickBusiness.
  ///
  /// In uz, this message translates to:
  /// **'Biznes profilni tanlang'**
  String get profilePickBusiness;

  /// No description provided for @profilePickPersonal.
  ///
  /// In uz, this message translates to:
  /// **'Shaxsiy profilni tanlang'**
  String get profilePickPersonal;

  /// ID lentasidan profil almashganda
  ///
  /// In uz, this message translates to:
  /// **'Faol profil: {name}'**
  String profileSwitchedTo(String name);

  /// No description provided for @businessNoneTitle.
  ///
  /// In uz, this message translates to:
  /// **'Sizda biznes profil yo‘q'**
  String get businessNoneTitle;

  /// No description provided for @businessNoneHint.
  ///
  /// In uz, this message translates to:
  /// **'Biznes profil yarating yoki shaxsiy rejimga qayting'**
  String get businessNoneHint;

  /// No description provided for @premiumTitle.
  ///
  /// In uz, this message translates to:
  /// **'Premium obuna'**
  String get premiumTitle;

  /// No description provided for @premiumTagline.
  ///
  /// In uz, this message translates to:
  /// **'Reels, istorya va to‘liq imkoniyatlar'**
  String get premiumTagline;

  /// No description provided for @premiumPerMonth.
  ///
  /// In uz, this message translates to:
  /// **'oyiga'**
  String get premiumPerMonth;

  /// No description provided for @premiumActive.
  ///
  /// In uz, this message translates to:
  /// **'Premium faol'**
  String get premiumActive;

  /// No description provided for @premiumUntil.
  ///
  /// In uz, this message translates to:
  /// **'Amal qiladi: {date}'**
  String premiumUntil(String date);

  /// No description provided for @premiumForever.
  ///
  /// In uz, this message translates to:
  /// **'Muddatsiz'**
  String get premiumForever;

  /// No description provided for @premiumTrial.
  ///
  /// In uz, this message translates to:
  /// **'Sinov muddati'**
  String get premiumTrial;

  /// No description provided for @premiumExtend.
  ///
  /// In uz, this message translates to:
  /// **'Muddatni uzaytirish'**
  String get premiumExtend;

  /// No description provided for @premiumBuy.
  ///
  /// In uz, this message translates to:
  /// **'Premium olish'**
  String get premiumBuy;

  /// No description provided for @premiumPerksTitle.
  ///
  /// In uz, this message translates to:
  /// **'Nimalar ochiladi'**
  String get premiumPerksTitle;

  /// No description provided for @premiumPerkVideo.
  ///
  /// In uz, this message translates to:
  /// **'Video post va Reels'**
  String get premiumPerkVideo;

  /// No description provided for @premiumPerkStory.
  ///
  /// In uz, this message translates to:
  /// **'Istorya qo‘yish'**
  String get premiumPerkStory;

  /// No description provided for @premiumPerkPosts.
  ///
  /// In uz, this message translates to:
  /// **'Ko‘proq post (60 tagacha)'**
  String get premiumPerkPosts;

  /// No description provided for @premiumPerkMusic.
  ///
  /// In uz, this message translates to:
  /// **'10 ta profil qo‘shig‘i'**
  String get premiumPerkMusic;

  /// No description provided for @premiumPayWith.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov usulini tanlang'**
  String get premiumPayWith;

  /// No description provided for @premiumPayme.
  ///
  /// In uz, this message translates to:
  /// **'Payme'**
  String get premiumPayme;

  /// No description provided for @premiumClick.
  ///
  /// In uz, this message translates to:
  /// **'Click'**
  String get premiumClick;

  /// No description provided for @premiumOpening.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov sahifasi ochilmoqda…'**
  String get premiumOpening;

  /// No description provided for @premiumPending.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov kutilmoqda. To‘lagach shu yerga qayting.'**
  String get premiumPending;

  /// No description provided for @premiumCheck.
  ///
  /// In uz, this message translates to:
  /// **'To‘lovni tekshirish'**
  String get premiumCheck;

  /// No description provided for @premiumPaid.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov qabul qilindi. Premium faollashdi.'**
  String get premiumPaid;

  /// No description provided for @premiumNotYet.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov hali tasdiqlanmadi.'**
  String get premiumNotYet;

  /// No description provided for @premiumNoProvider.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha to‘lov tizimi ulanmagan.'**
  String get premiumNoProvider;

  /// No description provided for @premiumBrowserFailed.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov sahifasini ocholmadik. Havola nusxalandi.'**
  String get premiumBrowserFailed;

  /// No description provided for @premiumLocked.
  ///
  /// In uz, this message translates to:
  /// **'Bu imkoniyat Premiumda'**
  String get premiumLocked;

  /// No description provided for @premiumLockedVideo.
  ///
  /// In uz, this message translates to:
  /// **'Video post va Reels uchun Premium kerak.'**
  String get premiumLockedVideo;

  /// No description provided for @premiumLockedStory.
  ///
  /// In uz, this message translates to:
  /// **'Istorya qo‘yish uchun darajangiz yetmaydi.'**
  String get premiumLockedStory;

  /// No description provided for @premiumLockedPost.
  ///
  /// In uz, this message translates to:
  /// **'Post qo‘yish uchun darajangiz yetmaydi.'**
  String get premiumLockedPost;

  /// No description provided for @payKindCard.
  ///
  /// In uz, this message translates to:
  /// **'Raqamli tashrif qog‘ozi'**
  String get payKindCard;

  /// No description provided for @payKindPhysical.
  ///
  /// In uz, this message translates to:
  /// **'Jismoniy NFC karta'**
  String get payKindPhysical;

  /// No description provided for @payKindAuction.
  ///
  /// In uz, this message translates to:
  /// **'Auksion to‘lovi'**
  String get payKindAuction;

  /// No description provided for @payKindPremium.
  ///
  /// In uz, this message translates to:
  /// **'Premium obuna'**
  String get payKindPremium;

  /// No description provided for @payKindFollow.
  ///
  /// In uz, this message translates to:
  /// **'Premium kuzatuv'**
  String get payKindFollow;

  /// No description provided for @payKindOther.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov'**
  String get payKindOther;

  /// No description provided for @payStatusPaid.
  ///
  /// In uz, this message translates to:
  /// **'To‘landi'**
  String get payStatusPaid;

  /// No description provided for @payStatusPending.
  ///
  /// In uz, this message translates to:
  /// **'Kutilmoqda'**
  String get payStatusPending;

  /// No description provided for @payStatusCancelled.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilindi'**
  String get payStatusCancelled;

  /// No description provided for @payStatusFailed.
  ///
  /// In uz, this message translates to:
  /// **'Xatolik'**
  String get payStatusFailed;

  /// No description provided for @payPendingHint.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov tugallanmagan — to‘lash mumkin'**
  String get payPendingHint;

  /// No description provided for @demoBadge.
  ///
  /// In uz, this message translates to:
  /// **'Demo'**
  String get demoBadge;

  /// No description provided for @demoSectionTitle.
  ///
  /// In uz, this message translates to:
  /// **'NFC Mobile'**
  String get demoSectionTitle;

  /// No description provided for @demoSectionHint.
  ///
  /// In uz, this message translates to:
  /// **'NFC bilan nimalar mumkin?'**
  String get demoSectionHint;

  /// No description provided for @demoHeroTitle.
  ///
  /// In uz, this message translates to:
  /// **'NFC bilan tanishing'**
  String get demoHeroTitle;

  /// No description provided for @demoHeroBody.
  ///
  /// In uz, this message translates to:
  /// **'Shaxsiy profil, biznes sahifa va NFC ID — barchasi bitta mobil ilovada.'**
  String get demoHeroBody;

  /// No description provided for @demoChipIphone.
  ///
  /// In uz, this message translates to:
  /// **'iPhone 18 bilan ishlaydi'**
  String get demoChipIphone;

  /// No description provided for @demoChipSamsung.
  ///
  /// In uz, this message translates to:
  /// **'Samsung S26 bilan ishlaydi'**
  String get demoChipSamsung;

  /// No description provided for @demoChipReady.
  ///
  /// In uz, this message translates to:
  /// **'NFC ready'**
  String get demoChipReady;

  /// No description provided for @demoPersonalBtn.
  ///
  /// In uz, this message translates to:
  /// **'Personal demo'**
  String get demoPersonalBtn;

  /// No description provided for @demoBusinessBtn.
  ///
  /// In uz, this message translates to:
  /// **'Business demo'**
  String get demoBusinessBtn;

  /// No description provided for @demoPersonalTitle.
  ///
  /// In uz, this message translates to:
  /// **'Shaxsiy profil'**
  String get demoPersonalTitle;

  /// No description provided for @demoPersonalRole.
  ///
  /// In uz, this message translates to:
  /// **'Digital creator'**
  String get demoPersonalRole;

  /// No description provided for @demoSampleBtn.
  ///
  /// In uz, this message translates to:
  /// **'Namuna profil'**
  String get demoSampleBtn;

  /// No description provided for @demoBusinessTitle.
  ///
  /// In uz, this message translates to:
  /// **'Biznes profil'**
  String get demoBusinessTitle;

  /// No description provided for @demoBusinessBody.
  ///
  /// In uz, this message translates to:
  /// **'Katalog, aloqa va buyurtmalar — barchasi bitta NFC profil ichida.'**
  String get demoBusinessBody;

  /// No description provided for @demoCatalogBtn.
  ///
  /// In uz, this message translates to:
  /// **'Katalogni ko‘rish'**
  String get demoCatalogBtn;

  /// No description provided for @demoBuyBtn.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID olish'**
  String get demoBuyBtn;

  /// No description provided for @demoNotice.
  ///
  /// In uz, this message translates to:
  /// **'Bu namuna ma’lumot — sizning profilingizga ta’sir qilmaydi.'**
  String get demoNotice;

  /// No description provided for @demoViewProfile.
  ///
  /// In uz, this message translates to:
  /// **'Profilni ko‘rish'**
  String get demoViewProfile;

  /// No description provided for @demoViewBusiness.
  ///
  /// In uz, this message translates to:
  /// **'Biznes profilni ko‘rish'**
  String get demoViewBusiness;

  /// No description provided for @demoBizSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Business NFC Profile'**
  String get demoBizSubtitle;

  /// No description provided for @demoPersonalSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Personal NFC Profile'**
  String get demoPersonalSubtitle;

  /// No description provided for @demoBadgePersonal.
  ///
  /// In uz, this message translates to:
  /// **'DEMO · PERSONAL'**
  String get demoBadgePersonal;

  /// No description provided for @demoBadgeBusiness.
  ///
  /// In uz, this message translates to:
  /// **'DEMO · BUSINESS'**
  String get demoBadgeBusiness;

  /// No description provided for @welcomeHeadline.
  ///
  /// In uz, this message translates to:
  /// **'Haqiqiy uchrashuvlar endi uzoq davom etadi.'**
  String get welcomeHeadline;

  /// No description provided for @welcomeStart.
  ///
  /// In uz, this message translates to:
  /// **'Boshlash'**
  String get welcomeStart;

  /// No description provided for @demoProductTitle.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot'**
  String get demoProductTitle;

  /// No description provided for @demoAddToCart.
  ///
  /// In uz, this message translates to:
  /// **'Bog‘lanish'**
  String get demoAddToCart;

  /// No description provided for @siteCardTitle.
  ///
  /// In uz, this message translates to:
  /// **'nfcstore.uz'**
  String get siteCardTitle;

  /// No description provided for @siteCardBody.
  ///
  /// In uz, this message translates to:
  /// **'NFC kartalar, jismoniy buyurtma va to‘liq katalog — saytda.'**
  String get siteCardBody;

  /// No description provided for @siteCardCta.
  ///
  /// In uz, this message translates to:
  /// **'Saytga o‘tish'**
  String get siteCardCta;

  /// Maxfiylik / bildirishnoma / to‘lov holati matni
  ///
  /// In uz, this message translates to:
  /// **'Profil ommaviy'**
  String get privacyPublicProfile;

  /// Maxfiylik / bildirishnoma / to‘lov holati matni
  ///
  /// In uz, this message translates to:
  /// **'Yoqilgan bo‘lsa, profilingiz “Tanlov” ro‘yxatida va ommaviy katalogda ko‘rinadi. O‘chirsangiz, profil faqat to‘g‘ridan-to‘g‘ri havola yoki NFC karta orqali ochiladi.'**
  String get privacyPublicHint;

  /// Maxfiylik / bildirishnoma / to‘lov holati matni
  ///
  /// In uz, this message translates to:
  /// **'Tanlovlar shu qurilmada saqlanadi.'**
  String get notifOnDeviceHint;

  /// Maxfiylik / bildirishnoma / to‘lov holati matni
  ///
  /// In uz, this message translates to:
  /// **'Hozircha onlayn to‘lov usullari yoqilmagan. Biroz keyinroq urinib ko‘ring yoki saytdan buyurtma bering.'**
  String get paymentNotConfiguredHint;

  /// Profil muqovasi tugmasi
  ///
  /// In uz, this message translates to:
  /// **'Muqova'**
  String get profileCover;

  /// NFCSTORE premium mavzusi
  ///
  /// In uz, this message translates to:
  /// **'Noir'**
  String get themeNoir;

  /// Mavzu nomi — saytdagi iliq ko‘mir-qora
  ///
  /// In uz, this message translates to:
  /// **'Onyx'**
  String get themeOnyx;

  /// Ro‘yxatdan o‘tishda oferta roziligi
  ///
  /// In uz, this message translates to:
  /// **'Davom etish uchun oferta shartlariga va shaxsga doir ma’lumotlaringizni qayta ishlashga rozilik bering.'**
  String get registerTosRequired;

  /// Ro‘yxatdan o‘tishda oferta roziligi
  ///
  /// In uz, this message translates to:
  /// **'Ro‘yxatdan o‘tish bilan '**
  String get registerTosPrefix;

  /// Ro‘yxatdan o‘tishda oferta roziligi
  ///
  /// In uz, this message translates to:
  /// **'ommaviy oferta'**
  String get registerTosLink;

  /// Ro‘yxatdan o‘tishda oferta roziligi
  ///
  /// In uz, this message translates to:
  /// **' shartlariga roziman, '**
  String get registerTosSuffix;

  /// Ro‘yxatdan o‘tishda shaxsga doir ma’lumotlar roziligi (O‘RQ-547)
  ///
  /// In uz, this message translates to:
  /// **'maxfiylik siyosati'**
  String get registerPrivacyLink;

  /// Ro‘yxatdan o‘tishda shaxsga doir ma’lumotlar roziligi (O‘RQ-547)
  ///
  /// In uz, this message translates to:
  /// **'ga muvofiq shaxsga doir ma’lumotlarim qayta ishlanishiga rozilik beraman va 18 yoshga to‘lganimni tasdiqlayman.'**
  String get registerPrivacySuffix;

  /// Bildirishnoma matni
  ///
  /// In uz, this message translates to:
  /// **'sizga obuna bo‘ldi'**
  String get activityFollowed;

  /// Bildirishnoma matni
  ///
  /// In uz, this message translates to:
  /// **'postingizni yoqtirdi'**
  String get activityLiked;

  /// Bildirishnoma matni
  ///
  /// In uz, this message translates to:
  /// **'postingizga izoh yozdi'**
  String get activityCommented;

  /// Bildirishnoma matni
  ///
  /// In uz, this message translates to:
  /// **'Hammasini o‘qildi'**
  String get activityMarkAll;

  /// No description provided for @nfcWrite.
  ///
  /// In uz, this message translates to:
  /// **'NFC kartaga yozish'**
  String get nfcWrite;

  /// No description provided for @nfcWriteSubtitle.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa joydan olingan qayta yoziladigan kartani o‘z profilingizga aylantiring'**
  String get nfcWriteSubtitle;

  /// No description provided for @nfcWriteChooseId.
  ///
  /// In uz, this message translates to:
  /// **'Qaysi profil yozilsin'**
  String get nfcWriteChooseId;

  /// No description provided for @nfcWriteNoId.
  ///
  /// In uz, this message translates to:
  /// **'Avval NFC ID yarating — tegga yoziladigan profil kerak'**
  String get nfcWriteNoId;

  /// No description provided for @nfcWriteUrlLabel.
  ///
  /// In uz, this message translates to:
  /// **'Tegga yoziladi'**
  String get nfcWriteUrlLabel;

  /// No description provided for @nfcWriteStepCheck.
  ///
  /// In uz, this message translates to:
  /// **'1-qadam — kartani tekshirish'**
  String get nfcWriteStepCheck;

  /// No description provided for @nfcWriteStepCheckHint.
  ///
  /// In uz, this message translates to:
  /// **'Kartani telefon orqasiga tegizing. Hozircha hech narsa yozilmaydi.'**
  String get nfcWriteStepCheckHint;

  /// No description provided for @nfcWriteCheckAction.
  ///
  /// In uz, this message translates to:
  /// **'Kartani tekshirish'**
  String get nfcWriteCheckAction;

  /// No description provided for @nfcWriteStepWrite.
  ///
  /// In uz, this message translates to:
  /// **'2-qadam — yozish'**
  String get nfcWriteStepWrite;

  /// No description provided for @nfcWriteStepWriteHint.
  ///
  /// In uz, this message translates to:
  /// **'O‘sha kartani yana tegizing.'**
  String get nfcWriteStepWriteHint;

  /// No description provided for @nfcWriteAction.
  ///
  /// In uz, this message translates to:
  /// **'Kartaga yozish'**
  String get nfcWriteAction;

  /// No description provided for @nfcWriteAgain.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa kartaga yozish'**
  String get nfcWriteAgain;

  /// No description provided for @nfcWriteChecking.
  ///
  /// In uz, this message translates to:
  /// **'Karta qidirilmoqda…'**
  String get nfcWriteChecking;

  /// No description provided for @nfcWriteWriting.
  ///
  /// In uz, this message translates to:
  /// **'Yozilmoqda…'**
  String get nfcWriteWriting;

  /// No description provided for @nfcWriteVerifying.
  ///
  /// In uz, this message translates to:
  /// **'Tekshirilmoqda…'**
  String get nfcWriteVerifying;

  /// No description provided for @nfcWriteEmptyTag.
  ///
  /// In uz, this message translates to:
  /// **'Karta bo‘sh — ustiga bemalol yozish mumkin'**
  String get nfcWriteEmptyTag;

  /// No description provided for @nfcWriteTagHasData.
  ///
  /// In uz, this message translates to:
  /// **'Bu kartada allaqachon ma’lumot bor'**
  String get nfcWriteTagHasData;

  /// No description provided for @nfcWriteOverwriteTitle.
  ///
  /// In uz, this message translates to:
  /// **'Kartadagi ma’lumot o‘chiriladi'**
  String get nfcWriteOverwriteTitle;

  /// No description provided for @nfcWriteOverwriteBody.
  ///
  /// In uz, this message translates to:
  /// **'Yozilsa, kartadagi quyidagi ma’lumot butunlay o‘chadi va o‘rniga sizning profilingiz yoziladi. Buni qaytarib bo‘lmaydi.'**
  String get nfcWriteOverwriteBody;

  /// No description provided for @nfcWriteOverwriteConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Ha, ustiga yozilsin'**
  String get nfcWriteOverwriteConfirm;

  /// No description provided for @nfcWriteCapacity.
  ///
  /// In uz, this message translates to:
  /// **'Karta sig‘imi: {size} bayt'**
  String nfcWriteCapacity(int size);

  /// No description provided for @nfcWriteDone.
  ///
  /// In uz, this message translates to:
  /// **'Yozildi va tekshirildi'**
  String get nfcWriteDone;

  /// No description provided for @nfcWriteDoneBody.
  ///
  /// In uz, this message translates to:
  /// **'Kartani telefonga tegizsangiz profilingiz ochiladi.'**
  String get nfcWriteDoneBody;

  /// No description provided for @nfcWriteErrTimeout.
  ///
  /// In uz, this message translates to:
  /// **'Karta topilmadi. Uni telefon orqasiga, kamera atrofiga tegizib ko‘ring.'**
  String get nfcWriteErrTimeout;

  /// No description provided for @nfcWriteErrNotNdef.
  ///
  /// In uz, this message translates to:
  /// **'Bu kartaga yozib bo‘lmaydi — u NDEF formatini qo‘llamaydi'**
  String get nfcWriteErrNotNdef;

  /// No description provided for @nfcWriteErrReadOnly.
  ///
  /// In uz, this message translates to:
  /// **'Bu karta qulflangan, qayta yozib bo‘lmaydi'**
  String get nfcWriteErrReadOnly;

  /// No description provided for @nfcWriteErrTooLarge.
  ///
  /// In uz, this message translates to:
  /// **'Manzil karta sig‘imiga sig‘maydi ({need} bayt kerak, {size} bayt bor)'**
  String nfcWriteErrTooLarge(int need, int size);

  /// No description provided for @nfcWriteErrDifferentTag.
  ///
  /// In uz, this message translates to:
  /// **'Bu boshqa karta. Tekshirilgan kartaning o‘zini tegizing.'**
  String get nfcWriteErrDifferentTag;

  /// No description provided for @nfcWriteErrVerify.
  ///
  /// In uz, this message translates to:
  /// **'Yozildi, lekin qayta o‘qiganda manzil to‘g‘ri chiqmadi. Kartani qayta tegizib ko‘ring.'**
  String get nfcWriteErrVerify;

  /// No description provided for @nfcWriteErrIo.
  ///
  /// In uz, this message translates to:
  /// **'Karta bilan aloqa uzildi. Kartani qimirlatmasdan qayta urinib ko‘ring.'**
  String get nfcWriteErrIo;

  /// No description provided for @nfcWriteIosHint.
  ///
  /// In uz, this message translates to:
  /// **'iPhone’da yozish uchun kartani tegizib turing — tizim oynasi ochiladi.'**
  String get nfcWriteIosHint;

  /// No description provided for @nfcWriteSafety.
  ///
  /// In uz, this message translates to:
  /// **'Kartaga faqat ochiq profil manzili yoziladi. Hech qanday maxfiy kalit yozilmaydi.'**
  String get nfcWriteSafety;

  /// No description provided for @feedSponsored.
  ///
  /// In uz, this message translates to:
  /// **'Homiylik'**
  String get feedSponsored;

  /// No description provided for @homeFeed.
  ///
  /// In uz, this message translates to:
  /// **'Lenta'**
  String get homeFeed;

  /// No description provided for @homeFeedEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Hozircha post yo‘q. Obuna bo‘lgan odamlaringiz post qo‘yganda shu yerda ko‘rinadi.'**
  String get homeFeedEmpty;

  /// No description provided for @homeFeedMore.
  ///
  /// In uz, this message translates to:
  /// **'Hammasini ko‘rish'**
  String get homeFeedMore;

  /// No description provided for @featuredTitle.
  ///
  /// In uz, this message translates to:
  /// **'Lentada ko‘tarish'**
  String get featuredTitle;

  /// No description provided for @featuredIntro.
  ///
  /// In uz, this message translates to:
  /// **'Postingiz belgilangan muddat davomida lentaning eng boshida turadi.'**
  String get featuredIntro;

  /// No description provided for @featuredPick.
  ///
  /// In uz, this message translates to:
  /// **'Muddatni tanlang'**
  String get featuredPick;

  /// No description provided for @featuredDays.
  ///
  /// In uz, this message translates to:
  /// **'{days} kun'**
  String featuredDays(int days);

  /// No description provided for @featuredBuy.
  ///
  /// In uz, this message translates to:
  /// **'To‘lovga o‘tish'**
  String get featuredBuy;

  /// No description provided for @featuredPaymentOff.
  ///
  /// In uz, this message translates to:
  /// **'To‘lovlar vaqtincha o‘chirilgan. Keyinroq urinib ko‘ring.'**
  String get featuredPaymentOff;

  /// No description provided for @featuredPending.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov kutilmoqda'**
  String get featuredPending;

  /// No description provided for @featuredPendingHint.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov tasdiqlangach post lentaning boshiga chiqadi. Sahifani yangilang.'**
  String get featuredPendingHint;

  /// No description provided for @featuredActive.
  ///
  /// In uz, this message translates to:
  /// **'Lentada turibdi'**
  String get featuredActive;

  /// No description provided for @featuredDaysLeft.
  ///
  /// In uz, this message translates to:
  /// **'{days} kun qoldi'**
  String featuredDaysLeft(int days);

  /// No description provided for @featuredMine.
  ///
  /// In uz, this message translates to:
  /// **'Ko‘tarilgan postlarim'**
  String get featuredMine;

  /// No description provided for @featuredNone.
  ///
  /// In uz, this message translates to:
  /// **'Hali ko‘tarilgan post yo‘q.'**
  String get featuredNone;

  /// No description provided for @featuredCancel.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilish'**
  String get featuredCancel;

  /// No description provided for @featuredCancelConfirm.
  ///
  /// In uz, this message translates to:
  /// **'To‘lanmagan so‘rov bekor qilinsinmi?'**
  String get featuredCancelConfirm;

  /// No description provided for @featuredAlready.
  ///
  /// In uz, this message translates to:
  /// **'Bu post allaqachon ko‘tarilgan.'**
  String get featuredAlready;

  /// No description provided for @featuredTooMany.
  ///
  /// In uz, this message translates to:
  /// **'Bir vaqtda ko‘pi bilan 3 ta post ko‘tarilishi mumkin.'**
  String get featuredTooMany;

  /// No description provided for @featuredNotYours.
  ///
  /// In uz, this message translates to:
  /// **'Faqat o‘z postingizni ko‘tara olasiz.'**
  String get featuredNotYours;

  /// No description provided for @featuredOpenPayment.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov sahifasi ochilmadi. Havolani brauzerda oching.'**
  String get featuredOpenPayment;

  /// No description provided for @featuredStopped.
  ///
  /// In uz, this message translates to:
  /// **'Admin to‘xtatgan'**
  String get featuredStopped;

  /// No description provided for @featuredExpired.
  ///
  /// In uz, this message translates to:
  /// **'Muddati tugagan'**
  String get featuredExpired;

  /// No description provided for @idMarketTitle.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID olish'**
  String get idMarketTitle;

  /// No description provided for @idMarketSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID yozing — masalan VIP001'**
  String get idMarketSearchHint;

  /// No description provided for @idMarketTiers.
  ///
  /// In uz, this message translates to:
  /// **'Darajalar va narxlar'**
  String get idMarketTiers;

  /// No description provided for @idMarketMinChars.
  ///
  /// In uz, this message translates to:
  /// **'Kamida 3 belgi kiriting'**
  String get idMarketMinChars;

  /// No description provided for @idTierFree.
  ///
  /// In uz, this message translates to:
  /// **'Bronza'**
  String get idTierFree;

  /// No description provided for @idTierSilver.
  ///
  /// In uz, this message translates to:
  /// **'Kumush'**
  String get idTierSilver;

  /// No description provided for @idTierGold.
  ///
  /// In uz, this message translates to:
  /// **'Oltin'**
  String get idTierGold;

  /// No description provided for @idTierPremium.
  ///
  /// In uz, this message translates to:
  /// **'Premium'**
  String get idTierPremium;

  /// No description provided for @idTierExclusive.
  ///
  /// In uz, this message translates to:
  /// **'Eksklyuziv'**
  String get idTierExclusive;

  /// No description provided for @idPriceFrom.
  ///
  /// In uz, this message translates to:
  /// **'dan boshlab'**
  String get idPriceFrom;

  /// No description provided for @idStateAvailable.
  ///
  /// In uz, this message translates to:
  /// **'Sotuvda'**
  String get idStateAvailable;

  /// No description provided for @idStateTaken.
  ///
  /// In uz, this message translates to:
  /// **'Sotilgan'**
  String get idStateTaken;

  /// No description provided for @idStateReserved.
  ///
  /// In uz, this message translates to:
  /// **'Band qilingan'**
  String get idStateReserved;

  /// No description provided for @idStateMine.
  ///
  /// In uz, this message translates to:
  /// **'Sizniki'**
  String get idStateMine;

  /// No description provided for @idStateNotForSale.
  ///
  /// In uz, this message translates to:
  /// **'Sotuvda emas'**
  String get idStateNotForSale;

  /// No description provided for @idBuy.
  ///
  /// In uz, this message translates to:
  /// **'Sotib olish'**
  String get idBuy;

  /// No description provided for @idDetailTitle.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID'**
  String get idDetailTitle;

  /// No description provided for @idOrderTitle.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma'**
  String get idOrderTitle;

  /// No description provided for @idOrderPending.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov kutilmoqda'**
  String get idOrderPending;

  /// No description provided for @idOrderPaid.
  ///
  /// In uz, this message translates to:
  /// **'To‘landi'**
  String get idOrderPaid;

  /// No description provided for @idOrderCancelled.
  ///
  /// In uz, this message translates to:
  /// **'Bekor qilindi'**
  String get idOrderCancelled;

  /// No description provided for @idOrderFailed.
  ///
  /// In uz, this message translates to:
  /// **'To‘lov o‘tmadi'**
  String get idOrderFailed;

  /// No description provided for @idOrderCheck.
  ///
  /// In uz, this message translates to:
  /// **'Holatni tekshirish'**
  String get idOrderCheck;

  /// No description provided for @idPaidHint.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID hisobingizga biriktirildi.'**
  String get idPaidHint;

  /// No description provided for @idPendingHint.
  ///
  /// In uz, this message translates to:
  /// **'To‘lovni yakunlang — ID shundan keyin biriktiriladi.'**
  String get idPendingHint;

  /// No description provided for @idNameLabel.
  ///
  /// In uz, this message translates to:
  /// **'Kartadagi ism'**
  String get idNameLabel;

  /// No description provided for @idSearchEmpty.
  ///
  /// In uz, this message translates to:
  /// **'Bunday NFC ID topilmadi'**
  String get idSearchEmpty;

  /// No description provided for @idSearchShort.
  ///
  /// In uz, this message translates to:
  /// **'ID qidirish'**
  String get idSearchShort;

  /// No description provided for @commentReply.
  ///
  /// In uz, this message translates to:
  /// **'Javob berish'**
  String get commentReply;

  /// No description provided for @commentReplyingTo.
  ///
  /// In uz, this message translates to:
  /// **'{name} ga javob'**
  String commentReplyingTo(String name);

  /// No description provided for @storeBuyOnSiteId.
  ///
  /// In uz, this message translates to:
  /// **'NFC ID xaridi saytda rasmiylashtiriladi:'**
  String get storeBuyOnSiteId;

  /// No description provided for @storeBuyOnSitePremium.
  ///
  /// In uz, this message translates to:
  /// **'Premium obunani saytdan olasiz:'**
  String get storeBuyOnSitePremium;

  /// No description provided for @themeMono.
  ///
  /// In uz, this message translates to:
  /// **'Oq-qora'**
  String get themeMono;

  /// No description provided for @themeIvory.
  ///
  /// In uz, this message translates to:
  /// **'Ivory'**
  String get themeIvory;

  /// No description provided for @registerTypeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Hisob turi'**
  String get registerTypeTitle;

  /// No description provided for @registerTypeHint.
  ///
  /// In uz, this message translates to:
  /// **'Keyin ilova ichida istalgan vaqt o‘zgartirasiz.'**
  String get registerTypeHint;

  /// No description provided for @registerTypeRequired.
  ///
  /// In uz, this message translates to:
  /// **'Hisob turini tanlang'**
  String get registerTypeRequired;

  /// No description provided for @accountPersonalHint.
  ///
  /// In uz, this message translates to:
  /// **'Raqamli vizitka, NFC ID, lenta va story'**
  String get accountPersonalHint;

  /// No description provided for @accountBusinessHint.
  ///
  /// In uz, this message translates to:
  /// **'Mini-sayt, katalog, buyurtmalar va analitika'**
  String get accountBusinessHint;

  /// No description provided for @bizIntroEyebrow.
  ///
  /// In uz, this message translates to:
  /// **'NFCSTORE Business'**
  String get bizIntroEyebrow;

  /// No description provided for @bizIntroTitle.
  ///
  /// In uz, this message translates to:
  /// **'Biznesingiz uchun raqamli vitrina'**
  String get bizIntroTitle;

  /// No description provided for @bizIntroLead.
  ///
  /// In uz, this message translates to:
  /// **'Mijoz kartaga tegadi yoki havolani ochadi — kompaniyangiz, mahsulotlaringiz va aloqa bir sahifada.'**
  String get bizIntroLead;

  /// No description provided for @bizFeatSite.
  ///
  /// In uz, this message translates to:
  /// **'Mini-sayt'**
  String get bizFeatSite;

  /// No description provided for @bizFeatSiteHint.
  ///
  /// In uz, this message translates to:
  /// **'Logotip, muqova, manzil va ish vaqti — tayyor sahifa'**
  String get bizFeatSiteHint;

  /// No description provided for @bizFeatCatalog.
  ///
  /// In uz, this message translates to:
  /// **'Katalog'**
  String get bizFeatCatalog;

  /// No description provided for @bizFeatCatalogHint.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot va xizmatlar narxi bilan, buyurtma to‘g‘ridan-to‘g‘ri'**
  String get bizFeatCatalogHint;

  /// No description provided for @bizFeatNfc.
  ///
  /// In uz, this message translates to:
  /// **'NFC bilan ochilish'**
  String get bizFeatNfc;

  /// No description provided for @bizFeatNfcHint.
  ///
  /// In uz, this message translates to:
  /// **'Karta yoki stikerga tegilsa sahifangiz darhol ochiladi'**
  String get bizFeatNfcHint;

  /// No description provided for @bizFeatContent.
  ///
  /// In uz, this message translates to:
  /// **'Post · Story · Reels'**
  String get bizFeatContent;

  /// No description provided for @bizFeatContentHint.
  ///
  /// In uz, this message translates to:
  /// **'Kompaniya nomidan kontent — obunachilar lentasiga chiqadi'**
  String get bizFeatContentHint;

  /// No description provided for @bizFeatAnalytics.
  ///
  /// In uz, this message translates to:
  /// **'Analitika'**
  String get bizFeatAnalytics;

  /// No description provided for @bizFeatAnalyticsHint.
  ///
  /// In uz, this message translates to:
  /// **'Ko‘rishlar va bosishlar — kunma-kun'**
  String get bizFeatAnalyticsHint;

  /// No description provided for @bizFeatContacts.
  ///
  /// In uz, this message translates to:
  /// **'Kontaktlar'**
  String get bizFeatContacts;

  /// No description provided for @bizFeatContactsHint.
  ///
  /// In uz, this message translates to:
  /// **'Telefon, Telegram, WhatsApp va sayt bir bosishda'**
  String get bizFeatContactsHint;

  /// No description provided for @bizOptionsTitle.
  ///
  /// In uz, this message translates to:
  /// **'Qanday boshlaysiz?'**
  String get bizOptionsTitle;

  /// No description provided for @bizFreeBadge.
  ///
  /// In uz, this message translates to:
  /// **'Bepul'**
  String get bizFreeBadge;

  /// No description provided for @bizFreeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bepul Business ID'**
  String get bizFreeTitle;

  /// No description provided for @bizFreeHint.
  ///
  /// In uz, this message translates to:
  /// **'ID avtomatik beriladi, biznes sahifangiz shu yerda, ilovada ochiladi.'**
  String get bizFreeHint;

  /// No description provided for @bizFreeCta.
  ///
  /// In uz, this message translates to:
  /// **'Bepul ochish'**
  String get bizFreeCta;

  /// No description provided for @bizPremiumBadge.
  ///
  /// In uz, this message translates to:
  /// **'Premium'**
  String get bizPremiumBadge;

  /// No description provided for @bizPremiumTitle.
  ///
  /// In uz, this message translates to:
  /// **'Maxsus nom · Premium ID'**
  String get bizPremiumTitle;

  /// No description provided for @bizPremiumHint.
  ///
  /// In uz, this message translates to:
  /// **'O‘z nomingiz: nfcstore.uz/c/NOMINGIZ. Narx nom uzunligiga qarab.'**
  String get bizPremiumHint;

  /// No description provided for @bizPremiumCta.
  ///
  /// In uz, this message translates to:
  /// **'Nomni tekshirish'**
  String get bizPremiumCta;

  /// No description provided for @bizFreeIdNote.
  ///
  /// In uz, this message translates to:
  /// **'Business ID avtomatik beriladi'**
  String get bizFreeIdNote;

  /// No description provided for @bizDescriptionMin.
  ///
  /// In uz, this message translates to:
  /// **'Kamida 20 belgi'**
  String get bizDescriptionMin;

  /// No description provided for @bizReviewNote.
  ///
  /// In uz, this message translates to:
  /// **'Sahifangiz qisqa tekshiruvdan keyin ommaga chiqadi.'**
  String get bizReviewNote;

  /// No description provided for @storeBuyOnSiteBizName.
  ///
  /// In uz, this message translates to:
  /// **'Maxsus nom saytda rasmiylashtiriladi:'**
  String get storeBuyOnSiteBizName;

  /// No description provided for @bizOpenCta.
  ///
  /// In uz, this message translates to:
  /// **'Biznes ochish'**
  String get bizOpenCta;

  /// No description provided for @bizCatRestaurant.
  ///
  /// In uz, this message translates to:
  /// **'Restoran'**
  String get bizCatRestaurant;

  /// No description provided for @bizCatCafe.
  ///
  /// In uz, this message translates to:
  /// **'Kafe'**
  String get bizCatCafe;

  /// No description provided for @bizCatMarket.
  ///
  /// In uz, this message translates to:
  /// **'Market'**
  String get bizCatMarket;

  /// No description provided for @bizCatShop.
  ///
  /// In uz, this message translates to:
  /// **'Do‘kon'**
  String get bizCatShop;

  /// No description provided for @bizCatServices.
  ///
  /// In uz, this message translates to:
  /// **'Xizmatlar'**
  String get bizCatServices;

  /// No description provided for @bizCatConstruction.
  ///
  /// In uz, this message translates to:
  /// **'Qurilish'**
  String get bizCatConstruction;

  /// No description provided for @bizCatClinic.
  ///
  /// In uz, this message translates to:
  /// **'Klinika'**
  String get bizCatClinic;

  /// No description provided for @bizCatPharmacy.
  ///
  /// In uz, this message translates to:
  /// **'Dorixona'**
  String get bizCatPharmacy;

  /// No description provided for @bizCatEducation.
  ///
  /// In uz, this message translates to:
  /// **'Ta’lim'**
  String get bizCatEducation;

  /// No description provided for @bizCatOther.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa'**
  String get bizCatOther;

  /// No description provided for @errEmailSendFailed.
  ///
  /// In uz, this message translates to:
  /// **'Kodni emailga yuborib bo‘lmadi. Manzilni tekshirib, bir daqiqadan keyin qayta urinib ko‘ring.'**
  String get errEmailSendFailed;

  /// No description provided for @errNameNotAllowed.
  ///
  /// In uz, this message translates to:
  /// **'Bu nomdan foydalanib bo‘lmaydi — boshqasini yozing.'**
  String get errNameNotAllowed;

  /// No description provided for @nfcWriteShort.
  ///
  /// In uz, this message translates to:
  /// **'Kartaga yozish'**
  String get nfcWriteShort;

  /// No description provided for @nfcCardsHint.
  ///
  /// In uz, this message translates to:
  /// **'Ulangan kartalar va stikerlar'**
  String get nfcCardsHint;

  /// No description provided for @nfcSecurityHint.
  ///
  /// In uz, this message translates to:
  /// **'Yo‘qolgan kartani bloklash va himoya'**
  String get nfcSecurityHint;

  /// No description provided for @nfcScanStart.
  ///
  /// In uz, this message translates to:
  /// **'Skanerlashni boshlash'**
  String get nfcScanStart;

  /// No description provided for @catalogTypeLabel.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot turi'**
  String get catalogTypeLabel;

  /// No description provided for @catalogCards.
  ///
  /// In uz, this message translates to:
  /// **'Kartalar'**
  String get catalogCards;

  /// No description provided for @catalogStickers.
  ///
  /// In uz, this message translates to:
  /// **'Stikerlar'**
  String get catalogStickers;

  /// No description provided for @catalogKeychains.
  ///
  /// In uz, this message translates to:
  /// **'Breloklar'**
  String get catalogKeychains;

  /// No description provided for @catalogAccessories.
  ///
  /// In uz, this message translates to:
  /// **'Aksessuarlar'**
  String get catalogAccessories;

  /// No description provided for @catalogOther.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa'**
  String get catalogOther;

  /// No description provided for @discoverCatalog.
  ///
  /// In uz, this message translates to:
  /// **'Katalog'**
  String get discoverCatalog;

  /// No description provided for @catalogAll.
  ///
  /// In uz, this message translates to:
  /// **'Hammasi'**
  String get catalogAll;

  /// No description provided for @catalogCount.
  ///
  /// In uz, this message translates to:
  /// **'{count} ta natija'**
  String catalogCount(int count);

  /// No description provided for @catalogSort.
  ///
  /// In uz, this message translates to:
  /// **'Saralash'**
  String get catalogSort;

  /// No description provided for @catalogSortNew.
  ///
  /// In uz, this message translates to:
  /// **'Yangi'**
  String get catalogSortNew;

  /// No description provided for @catalogSortPriceAsc.
  ///
  /// In uz, this message translates to:
  /// **'Avval arzon'**
  String get catalogSortPriceAsc;

  /// No description provided for @catalogSortPriceDesc.
  ///
  /// In uz, this message translates to:
  /// **'Avval qimmat'**
  String get catalogSortPriceDesc;

  /// No description provided for @catalogSoon.
  ///
  /// In uz, this message translates to:
  /// **'Katalog tez orada'**
  String get catalogSoon;

  /// No description provided for @catalogSoonHint.
  ///
  /// In uz, this message translates to:
  /// **'Bizneslarning mahsulot va xizmatlari shu yerda bitta ro‘yxatda chiqadi'**
  String get catalogSoonHint;

  /// No description provided for @catalogEmptyHint.
  ///
  /// In uz, this message translates to:
  /// **'Bizneslar mahsulot yoki xizmat qo‘shganda shu yerda ko‘rinadi'**
  String get catalogEmptyHint;

  /// No description provided for @catalogSeller.
  ///
  /// In uz, this message translates to:
  /// **'Sotuvchi'**
  String get catalogSeller;

  /// No description provided for @catalogOpenSeller.
  ///
  /// In uz, this message translates to:
  /// **'Sotuvchi sahifasi'**
  String get catalogOpenSeller;

  /// No description provided for @catalogFavorite.
  ///
  /// In uz, this message translates to:
  /// **'Sevimlilar'**
  String get catalogFavorite;

  /// No description provided for @catalogNoPaymentNote.
  ///
  /// In uz, this message translates to:
  /// **'Buyurtma va to‘lov sotuvchi bilan kelishiladi. Sevimlilar shu telefonda saqlanadi.'**
  String get catalogNoPaymentNote;

  /// No description provided for @reelSavedLocal.
  ///
  /// In uz, this message translates to:
  /// **'Saqlandi — shu telefonda'**
  String get reelSavedLocal;

  /// No description provided for @reelUnsaved.
  ///
  /// In uz, this message translates to:
  /// **'Saqlanganlardan olindi'**
  String get reelUnsaved;

  /// No description provided for @reelBlockAuthor.
  ///
  /// In uz, this message translates to:
  /// **'Muallifni bloklash'**
  String get reelBlockAuthor;

  /// No description provided for @reelBlocked.
  ///
  /// In uz, this message translates to:
  /// **'Bloklandi — uning kontenti endi ko‘rinmaydi'**
  String get reelBlocked;

  /// No description provided for @setupFreeId.
  ///
  /// In uz, this message translates to:
  /// **'Bepul NFC ID'**
  String get setupFreeId;

  /// No description provided for @bizShowcaseSample.
  ///
  /// In uz, this message translates to:
  /// **'Namuna'**
  String get bizShowcaseSample;

  /// No description provided for @bizFeaturesTitle.
  ///
  /// In uz, this message translates to:
  /// **'Biznes nima beradi'**
  String get bizFeaturesTitle;

  /// No description provided for @musicPrevious.
  ///
  /// In uz, this message translates to:
  /// **'Oldingi'**
  String get musicPrevious;

  /// No description provided for @musicNext.
  ///
  /// In uz, this message translates to:
  /// **'Keyingi'**
  String get musicNext;

  /// No description provided for @musicPlay.
  ///
  /// In uz, this message translates to:
  /// **'Ijro etish'**
  String get musicPlay;

  /// No description provided for @musicPause.
  ///
  /// In uz, this message translates to:
  /// **'Pauza'**
  String get musicPause;

  /// No description provided for @errBanned.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz qoidabuzarlik uchun vaqtincha bloklangan — hozir joylay olmaysiz.'**
  String get errBanned;

  /// No description provided for @mediaChange.
  ///
  /// In uz, this message translates to:
  /// **'Almashtirish'**
  String get mediaChange;

  /// No description provided for @rulesCardTitle.
  ///
  /// In uz, this message translates to:
  /// **'Taqiqlangan kontent'**
  String get rulesCardTitle;

  /// No description provided for @rulesBan18.
  ///
  /// In uz, this message translates to:
  /// **'18+'**
  String get rulesBan18;

  /// No description provided for @rulesBanViolence.
  ///
  /// In uz, this message translates to:
  /// **'Zo‘ravonlik'**
  String get rulesBanViolence;

  /// No description provided for @rulesBanExtremism.
  ///
  /// In uz, this message translates to:
  /// **'Ekstremizm'**
  String get rulesBanExtremism;

  /// No description provided for @rulesBanIllegal.
  ///
  /// In uz, this message translates to:
  /// **'Noqonuniy'**
  String get rulesBanIllegal;

  /// No description provided for @rulesBanSpam.
  ///
  /// In uz, this message translates to:
  /// **'Spam va aldov'**
  String get rulesBanSpam;

  /// No description provided for @rulesBanInsult.
  ///
  /// In uz, this message translates to:
  /// **'Haqorat'**
  String get rulesBanInsult;

  /// No description provided for @rulesCardProcess.
  ///
  /// In uz, this message translates to:
  /// **'Har bir post, reel, istoriya va izohda “Shikoyat qilish” bor. Yuklangan rasmlar avtomatik tekshiriladi. Shikoyatlarni moderator ko‘rib chiqadi: qoidabuzar kontent o‘chiriladi, takrorlansa hisob bloklanadi.'**
  String get rulesCardProcess;

  /// No description provided for @storyCaption.
  ///
  /// In uz, this message translates to:
  /// **'Istoryaga qisqa matn'**
  String get storyCaption;

  /// No description provided for @noNfcExplain.
  ///
  /// In uz, this message translates to:
  /// **'Bu telefon NFC kartani o‘qiy olmaydi va unga yoza olmaydi. Lekin profilingizni baribir ulashasiz — QR kod har qanday telefon kamerasida ochiladi.'**
  String get noNfcExplain;

  /// No description provided for @noNfcShareLink.
  ///
  /// In uz, this message translates to:
  /// **'Havolani ulashish'**
  String get noNfcShareLink;

  /// No description provided for @noNfcShareHint.
  ///
  /// In uz, this message translates to:
  /// **'Telegram, SMS…'**
  String get noNfcShareHint;

  /// No description provided for @noNfcManageHint.
  ///
  /// In uz, this message translates to:
  /// **'Tahrirlash, asosiy qilish'**
  String get noNfcManageHint;

  /// No description provided for @noNfcGetHint.
  ///
  /// In uz, this message translates to:
  /// **'Yangi ID tanlash'**
  String get noNfcGetHint;

  /// No description provided for @catalogKindProduct.
  ///
  /// In uz, this message translates to:
  /// **'Tovarlar'**
  String get catalogKindProduct;

  /// No description provided for @catalogKindService.
  ///
  /// In uz, this message translates to:
  /// **'Xizmatlar'**
  String get catalogKindService;

  /// No description provided for @listingProduct.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot'**
  String get listingProduct;

  /// No description provided for @listingService.
  ///
  /// In uz, this message translates to:
  /// **'Xizmat'**
  String get listingService;

  /// No description provided for @marketFood.
  ///
  /// In uz, this message translates to:
  /// **'Ovqat'**
  String get marketFood;

  /// No description provided for @marketFashion.
  ///
  /// In uz, this message translates to:
  /// **'Kiyim'**
  String get marketFashion;

  /// No description provided for @marketElectronics.
  ///
  /// In uz, this message translates to:
  /// **'Elektronika'**
  String get marketElectronics;

  /// No description provided for @marketBeauty.
  ///
  /// In uz, this message translates to:
  /// **'Go‘zallik'**
  String get marketBeauty;

  /// No description provided for @marketEducation.
  ///
  /// In uz, this message translates to:
  /// **'Ta’lim'**
  String get marketEducation;

  /// No description provided for @marketHealth.
  ///
  /// In uz, this message translates to:
  /// **'Sog‘liq'**
  String get marketHealth;

  /// No description provided for @marketHome.
  ///
  /// In uz, this message translates to:
  /// **'Uy va qurilish'**
  String get marketHome;

  /// No description provided for @marketAuto.
  ///
  /// In uz, this message translates to:
  /// **'Avto'**
  String get marketAuto;

  /// No description provided for @marketOther.
  ///
  /// In uz, this message translates to:
  /// **'Boshqa'**
  String get marketOther;

  /// No description provided for @catalogCategoryLabel.
  ///
  /// In uz, this message translates to:
  /// **'Kategoriya'**
  String get catalogCategoryLabel;

  /// No description provided for @catalogKindLabel.
  ///
  /// In uz, this message translates to:
  /// **'Turi'**
  String get catalogKindLabel;

  /// No description provided for @catalogNfcSub.
  ///
  /// In uz, this message translates to:
  /// **'NFC mahsulotlari'**
  String get catalogNfcSub;

  /// No description provided for @catalogPriceOnRequest.
  ///
  /// In uz, this message translates to:
  /// **'Narx kelishiladi'**
  String get catalogPriceOnRequest;

  /// No description provided for @catalogUnavailable.
  ///
  /// In uz, this message translates to:
  /// **'Mavjud emas'**
  String get catalogUnavailable;

  /// No description provided for @catalogInStock.
  ///
  /// In uz, this message translates to:
  /// **'Mavjud'**
  String get catalogInStock;

  /// No description provided for @catalogSearchHint.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot, xizmat, Business yoki NFC ID'**
  String get catalogSearchHint;

  /// No description provided for @catalogContact.
  ///
  /// In uz, this message translates to:
  /// **'Sotuvchi bilan bog‘lanish'**
  String get catalogContact;

  /// No description provided for @catalogCall.
  ///
  /// In uz, this message translates to:
  /// **'Qo‘ng‘iroq'**
  String get catalogCall;

  /// No description provided for @catalogAddress.
  ///
  /// In uz, this message translates to:
  /// **'Manzil'**
  String get catalogAddress;

  /// No description provided for @catalogSection.
  ///
  /// In uz, this message translates to:
  /// **'Bo‘lim'**
  String get catalogSection;

  /// No description provided for @catalogOrderNote.
  ///
  /// In uz, this message translates to:
  /// **'Ilovada to‘lov yo‘q: buyurtma va to‘lov sotuvchi bilan bevosita kelishiladi.'**
  String get catalogOrderNote;

  /// No description provided for @catalogFavoritesLocal.
  ///
  /// In uz, this message translates to:
  /// **'Sevimlilar shu telefonda saqlanadi.'**
  String get catalogFavoritesLocal;

  /// No description provided for @bizListingKind.
  ///
  /// In uz, this message translates to:
  /// **'Nima joylaysiz?'**
  String get bizListingKind;

  /// No description provided for @bizMarketCategory.
  ///
  /// In uz, this message translates to:
  /// **'Katalog kategoriyasi'**
  String get bizMarketCategory;

  /// No description provided for @bizMarketCategoryHint.
  ///
  /// In uz, this message translates to:
  /// **'Umumiy katalogda qaysi bo‘limda chiqadi'**
  String get bizMarketCategoryHint;

  /// No description provided for @bizSection.
  ///
  /// In uz, this message translates to:
  /// **'O‘z bo‘limingiz'**
  String get bizSection;

  /// No description provided for @bizSectionHint.
  ///
  /// In uz, this message translates to:
  /// **'Masalan: Ichimliklar, Salatlar, Kurslar'**
  String get bizSectionHint;

  /// No description provided for @bizPriceOnRequest.
  ///
  /// In uz, this message translates to:
  /// **'Narx kelishiladi'**
  String get bizPriceOnRequest;

  /// No description provided for @bizPriceOnRequestHint.
  ///
  /// In uz, this message translates to:
  /// **'Narx ko‘rsatilmaydi — mijoz siz bilan bog‘lanadi'**
  String get bizPriceOnRequestHint;

  /// No description provided for @bizPhotos.
  ///
  /// In uz, this message translates to:
  /// **'Rasmlar'**
  String get bizPhotos;

  /// No description provided for @bizAddPhoto.
  ///
  /// In uz, this message translates to:
  /// **'Rasm qo‘shish'**
  String get bizAddPhoto;

  /// No description provided for @bizPhotoCover.
  ///
  /// In uz, this message translates to:
  /// **'Muqova'**
  String get bizPhotoCover;

  /// No description provided for @bizNfcSub.
  ///
  /// In uz, this message translates to:
  /// **'NFC mahsulot turi'**
  String get bizNfcSub;

  /// No description provided for @bizPriceRequired.
  ///
  /// In uz, this message translates to:
  /// **'Mahsulot narxini kiriting'**
  String get bizPriceRequired;

  /// No description provided for @bizListingSchemaOld.
  ///
  /// In uz, this message translates to:
  /// **'Server hali eski: tur, katalog kategoriyasi va qo‘shimcha rasmlar yangilanishdan keyin saqlanadi. Hozircha ular nom va bo‘limdan avtomatik aniqlanadi.'**
  String get bizListingSchemaOld;

  /// No description provided for @bizAddService.
  ///
  /// In uz, this message translates to:
  /// **'Xizmat qo‘shish'**
  String get bizAddService;

  /// No description provided for @bizPlanUsage.
  ///
  /// In uz, this message translates to:
  /// **'Katalog: {count} / {limit}'**
  String bizPlanUsage(int count, int limit);

  /// No description provided for @bizPlanFreeTitle.
  ///
  /// In uz, this message translates to:
  /// **'Bepul tarif — {limit} ta tovar'**
  String bizPlanFreeTitle(int limit);

  /// No description provided for @bizPlanFreeBody.
  ///
  /// In uz, this message translates to:
  /// **'Premium (oylik) bilan {premium} tagacha tovar, post va istoriya ochiladi. O‘z nomingizni (Business ID) sotib olsangiz — cheksiz.'**
  String bizPlanFreeBody(int premium);

  /// No description provided for @bizPlanPremiumTitle.
  ///
  /// In uz, this message translates to:
  /// **'Premium — {limit} ta tovar'**
  String bizPlanPremiumTitle(int limit);

  /// No description provided for @bizPlanPremiumBody.
  ///
  /// In uz, this message translates to:
  /// **'Cheksiz tovar uchun o‘z nomingizni (Business ID) sotib oling.'**
  String get bizPlanPremiumBody;

  /// No description provided for @bizPlanLimitReached.
  ///
  /// In uz, this message translates to:
  /// **'Limit to‘ldi: yangi tovar qo‘shish uchun tarifni oshiring. Qo‘shilganlari o‘chmaydi.'**
  String get bizPlanLimitReached;

  /// No description provided for @bizPlanStoreNotice.
  ///
  /// In uz, this message translates to:
  /// **'Premium va o‘z nomi saytda rasmiylashtiriladi:'**
  String get bizPlanStoreNotice;

  /// No description provided for @bizPlanTrial.
  ///
  /// In uz, this message translates to:
  /// **'Sinov davri: hozircha hech qanday cheklov yo‘q'**
  String get bizPlanTrial;

  /// No description provided for @errPlanLimit.
  ///
  /// In uz, this message translates to:
  /// **'Tarif limiti to‘ldi. Ko‘proq tovar uchun Premium yoki o‘z nomingiz kerak (sayt orqali).'**
  String get errPlanLimit;

  /// No description provided for @errPlanLocked.
  ///
  /// In uz, this message translates to:
  /// **'Bepul tarifda post va istoriya yopiq. Premium (sayt orqali) bilan ochiladi.'**
  String get errPlanLocked;

  /// No description provided for @errContentBlocked.
  ///
  /// In uz, this message translates to:
  /// **'Rasm yuklanmadi: {reason}. Bunday kontent qonun va NFCSTORE qoidalariga zid. Xato deb o‘ylasangiz, boshqa rasm tanlang yoki qo‘llab-quvvatlashga yozing.'**
  String errContentBlocked(String reason);

  /// No description provided for @blockSexual.
  ///
  /// In uz, this message translates to:
  /// **'18+ yoki behayo kontent aniqlandi'**
  String get blockSexual;

  /// No description provided for @blockViolence.
  ///
  /// In uz, this message translates to:
  /// **'zo‘ravonlik yoki qonli kontent aniqlandi'**
  String get blockViolence;

  /// No description provided for @blockExtremism.
  ///
  /// In uz, this message translates to:
  /// **'ekstremistik yoki terroristik belgi yoki targ‘ibot aniqlandi'**
  String get blockExtremism;

  /// No description provided for @blockDrugs.
  ///
  /// In uz, this message translates to:
  /// **'giyohvand moddalar aniqlandi'**
  String get blockDrugs;

  /// No description provided for @blockHate.
  ///
  /// In uz, this message translates to:
  /// **'nafrat yoki kamsitish belgisi aniqlandi'**
  String get blockHate;

  /// No description provided for @privacyPolicy.
  ///
  /// In uz, this message translates to:
  /// **'Maxfiylik siyosati'**
  String get privacyPolicy;

  /// No description provided for @deleteAccountWhat.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz, barcha NFC ID profillaringiz, postlar, istoriyalar, izohlar va saqlanganlar ommadan darhol olib tashlanadi. Siz qayta kira olmaysiz. Buni qaytarib bo‘lmaydi.'**
  String get deleteAccountWhat;

  /// No description provided for @deleteAccountUnderstood.
  ///
  /// In uz, this message translates to:
  /// **'Tushundim, hisobimni o‘chirish'**
  String get deleteAccountUnderstood;

  /// No description provided for @deleteAccountDone.
  ///
  /// In uz, this message translates to:
  /// **'Hisobingiz o‘chirildi'**
  String get deleteAccountDone;

  /// Server `premium_required` (403) — izoh yozish faqat Premium'ga. Sabab aytiladi, umumiy "Ruxsat yo'q" emas.
  ///
  /// In uz, this message translates to:
  /// **'Izoh yozish uchun Premium obuna kerak. Izohlarni esa hamma o‘qiy oladi.'**
  String get errCommentPremium;

  /// No description provided for @commentPremiumTitle.
  ///
  /// In uz, this message translates to:
  /// **'Izoh yozish — Premium a’zolar uchun'**
  String get commentPremiumTitle;
}

class _LDelegate extends LocalizationsDelegate<L> {
  const _LDelegate();

  @override
  Future<L> load(Locale locale) {
    return SynchronousFuture<L>(lookupL(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ru', 'uz'].contains(locale.languageCode);

  @override
  bool shouldReload(_LDelegate old) => false;
}

L lookupL(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return LEn();
    case 'ru':
      return LRu();
    case 'uz':
      return LUz();
  }

  throw FlutterError(
    'L.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
