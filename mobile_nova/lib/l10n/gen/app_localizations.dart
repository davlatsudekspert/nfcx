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
  /// **'NFCSTORE Nova'**
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
  /// **'Server javob bermadi'**
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
  /// **'Kashfiyot'**
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

  /// No description provided for @nfcUnlinkCard.
  ///
  /// In uz, this message translates to:
  /// **'Kartani uzish'**
  String get nfcUnlinkCard;

  /// No description provided for @nfcUnlinkConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Karta uzilsinmi? Uni keyin qayta ulashingiz mumkin.'**
  String get nfcUnlinkConfirm;

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
  /// **'Story yaratish'**
  String get storyCreate;

  /// No description provided for @storyDeleteConfirm.
  ///
  /// In uz, this message translates to:
  /// **'Bu story o‘chirilsinmi?'**
  String get storyDeleteConfirm;

  /// No description provided for @postCreate.
  ///
  /// In uz, this message translates to:
  /// **'Post yaratish'**
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
  /// **'Reel yaratish'**
  String get reelCreate;

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

  /// No description provided for @themeMidnight.
  ///
  /// In uz, this message translates to:
  /// **'Yarim tun'**
  String get themeMidnight;

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
