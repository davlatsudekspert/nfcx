// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Uzbek (`uz`).
class AppLocalizationsUz extends AppLocalizations {
  AppLocalizationsUz([String locale = 'uz']) : super(locale);

  @override
  String get appTagline => 'BIOKIMYO · LABORATORIYA';

  @override
  String get navHome => 'Bosh';

  @override
  String get navTests => 'Tahlillar';

  @override
  String get navLab => 'Lab';

  @override
  String get navLibrary => 'Kutubxona';

  @override
  String get navLearn => 'O‘rganish';

  @override
  String get actionBack => 'Orqaga';

  @override
  String get actionProfile => 'Profil va sozlamalar';

  @override
  String get actionLanguage => 'Til';

  @override
  String get actionOpen => 'Ochish';

  @override
  String get actionRetry => 'Qayta urinish';

  @override
  String get actionContinue => 'Davom etish';

  @override
  String get actionCancel => 'Bekor qilish';

  @override
  String get actionDelete => 'O‘chirish';

  @override
  String get actionCopyLink => 'Havolani nusxalash';

  @override
  String get linkCopied => 'Havola nusxalandi';

  @override
  String plannedStage(String stage) {
    return '$stage-bosqichda rejalashtirilgan';
  }

  @override
  String get notAvailableYet => 'Hali mavjud emas';

  @override
  String get debugBuildBadge => 'DEBUG · DEMO ADAPTERLAR';

  @override
  String get welcomeEyebrow => 'Sizning laboratoriya yordamchingiz';

  @override
  String get welcomeTitle => 'Biokimyo.\nTushunarli va amaliy.';

  @override
  String get welcomeSubtitle =>
      'Tahlillar, laboratoriya amaliyoti va o‘rganish — bir joyda.';

  @override
  String get welcomeDevices => 'Telefon va planshet';

  @override
  String get welcomeRoles => 'Shifokor · laborant · student · ustoz';

  @override
  String get welcomeGetStarted => 'Boshlash / ro‘yxatdan o‘tish';

  @override
  String get welcomeGuest => 'Mehmon sifatida ko‘rish';

  @override
  String get welcomeSignIn => 'Kirish';

  @override
  String get welcomeGuestNote =>
      'Kontentni o‘qish uchun hisob shart emas. Kirish sinxronlash, guruhlar va xaridlar uchun kerak.';

  @override
  String get authTitle => 'Xush kelibsiz';

  @override
  String get authSubtitle => 'Email orqali kirish yoki yangi hisob ochish.';

  @override
  String get authEmailLabel => 'Email';

  @override
  String get authEmailHint => 'name@example.com';

  @override
  String get authEmailInvalid => 'To‘g‘ri email manzil kiriting.';

  @override
  String get authConsent =>
      'Foydalanish shartlari va maxfiylik siyosatini qabul qilaman.';

  @override
  String get authConsentRequired =>
      'Davom etish uchun shartlarni qabul qiling.';

  @override
  String get authGetCode => 'Kod olish';

  @override
  String get authViewTerms => 'Shartlarni ko‘rish';

  @override
  String get authDemoNotice =>
      'Debug build: demo kirish. Email yuborilmaydi; kod keyingi ekranda ko‘rsatiladi.';

  @override
  String get authUnavailableTitle => 'Email orqali kirish hali ulanmagan';

  @override
  String get authUnavailableBody =>
      'Barcha o‘qish kontenti mehmon uchun ochiq. Email xizmati sozlangach kirish yoqiladi.';

  @override
  String get authContinueGuest => 'Mehmon sifatida davom etish';

  @override
  String authRateLimited(int seconds) {
    return 'So‘rovlar juda ko‘p. $seconds soniyadan keyin urinib ko‘ring.';
  }

  @override
  String get authGenericError =>
      'Nimadir xato ketdi. Ulanishni tekshirib, qayta urinib ko‘ring.';

  @override
  String get otpTitle => 'Emailni tasdiqlash';

  @override
  String get otpCodeLabel => '6 xonali kod';

  @override
  String get otpVerify => 'Tasdiqlash';

  @override
  String otpDemoCode(String code) {
    return 'Demo kod: $code. Email yuborilmadi (faqat debug build).';
  }

  @override
  String otpInvalid(int attempts) {
    return 'Kod noto‘g‘ri. Qolgan urinishlar: $attempts.';
  }

  @override
  String get otpExpired => 'Kod muddati tugadi. Yangi kod oling.';

  @override
  String get otpTooManyAttempts => 'Urinishlar juda ko‘p. Yangi kod oling.';

  @override
  String get otpNoActiveCode => 'Faol kod yo‘q. Yangi kod oling.';

  @override
  String get otpFormat => '6 xonali kodni kiriting.';

  @override
  String get otpResend => 'Kodni qayta olish';

  @override
  String otpResendIn(int seconds) {
    return '$seconds soniyadan keyin qayta olish';
  }

  @override
  String otpValidFor(int minutes) {
    return 'Kod $minutes daqiqa amal qiladi.';
  }

  @override
  String get otpResent => 'Yangi kod berildi.';

  @override
  String get rolesTitle => 'Sizga mos ish maydoni';

  @override
  String get rolesSubtitle =>
      'Asosiy yo‘nalishni tanlang. Keyin o‘zgartirish mumkin.';

  @override
  String get rolesNote =>
      'Rol faqat bosh sahifani moslaydi. U boshqa guruhlar yoki ma’lumotlarga ruxsat bermaydi.';

  @override
  String get roleDoctor => 'Shifokor';

  @override
  String get roleDoctorDesc => 'Natija va klinik bog‘lanishlar';

  @override
  String get roleLab => 'Laboratoriya mutaxassisi';

  @override
  String get roleLabDesc => 'Metodika, apparat va sifat nazorati';

  @override
  String get roleStudent => 'Student';

  @override
  String get roleStudentDesc => 'Tushunish, mashq va imtihon';

  @override
  String get roleTeacher => 'Ustoz / tadqiqotchi';

  @override
  String get roleTeacherDesc => 'Guruh, topshiriq va ilmiy ish';

  @override
  String get homeTitle => 'Bilim. Aniqlik. Amaliyot.';

  @override
  String get homeFocusTag => 'Sizning yo‘nalishingiz';

  @override
  String get homeHeroDoctorTitle => 'Natijani kontekst bilan tushuning';

  @override
  String get homeHeroDoctorBody =>
      'Tahlil, ta’sir qiluvchi omillar va bog‘liq tekshiruvlar.';

  @override
  String get homeHeroDoctorCta => 'Tahlillarni ochish';

  @override
  String get homeHeroLabTitle => 'Ishonchli laboratoriya amaliyoti';

  @override
  String get homeHeroLabBody =>
      'Namuna, metodika va sifat nazorati — bir joyda.';

  @override
  String get homeHeroLabCta => 'Kalibrlash yo‘li';

  @override
  String get homeHeroStudentTitle => 'Biokimyoni tushunib o‘rganing';

  @override
  String get homeHeroStudentBody => 'Mavzu → izoh → mashq → takrorlash.';

  @override
  String get homeHeroStudentCta => 'O‘rganishni boshlash';

  @override
  String get homeHeroTeacherTitle => 'Bilimni darsga aylantiring';

  @override
  String get homeHeroTeacherBody =>
      'Guruhlar, izohli savollar va muddatli topshiriqlar.';

  @override
  String get homeHeroTeacherCta => 'Guruhlarni ochish';

  @override
  String get homeQuickAccess => 'Tez toping';

  @override
  String get homeUsefulTests => 'Foydali tahlillar';

  @override
  String get featureTests => 'Tahlillar';

  @override
  String get featureCalculators => 'Kalkulyatorlar';

  @override
  String get featureSampleFactors => 'Namuna omillari';

  @override
  String get featureSaved => 'Saqlanganlar';

  @override
  String get featureCalibration => 'Kalibrlash';

  @override
  String get featureQc => 'QC';

  @override
  String get featureSampling => 'Namuna olish';

  @override
  String get featureTopics => 'Mavzular';

  @override
  String get featureQuiz => 'Test';

  @override
  String get featureMicroscopy => 'Mikroskopiya';

  @override
  String get featureExam => 'Imtihon';

  @override
  String get featureClasses => 'Guruhlar';

  @override
  String get featureQuestionBank => 'Savollar';

  @override
  String get featureSources => 'Manbalar';

  @override
  String get featureResearch => 'Ilmiy ish';

  @override
  String get testsTitle => 'Tahlillar atlasi';

  @override
  String get testsSubtitle => 'Ko‘rsatkichdan amaliy ma’lumotgacha.';

  @override
  String get testsSearchLabel => 'Tahlil qidirish';

  @override
  String get testsSearchHint => 'ALT, kreatinin, HbA1c…';

  @override
  String get testsFilterAll => 'Barchasi';

  @override
  String get testsEmptyTitle => 'Natija topilmadi';

  @override
  String get testsEmptyBody => 'Boshqa nom, qisqartma yoki sinonimni kiriting.';

  @override
  String get testsClearSearch => 'Qidiruvni tozalash';

  @override
  String testsResultCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ta tahlil',
    );
    return '$_temp0';
  }

  @override
  String get statusDraft => 'Qoralama';

  @override
  String get statusVerified => 'Tekshirilgan';

  @override
  String get statusPublished => 'Nashr etilgan';

  @override
  String get statusSourcedSample => 'Manbali namuna';

  @override
  String get statusStructureOnly => 'Faqat tuzilma';

  @override
  String get contentLoading => 'Kontent yuklanmoqda…';

  @override
  String get contentErrorTitle => 'Kontentni yuklab bo‘lmadi';

  @override
  String get contentErrorBody =>
      'Kontent paketi tekshiruvdan o‘tmadi. Tekshirilmagan ma’lumot hech qachon ko‘rsatilmaydi.';

  @override
  String get analyteSave => 'Saqlash';

  @override
  String get analyteSaved => 'Saqlangan';

  @override
  String get analyteSavedToast => 'Saqlanganlarga qo‘shildi';

  @override
  String get analyteRemovedToast => 'Saqlanganlardan olib tashlandi';

  @override
  String get analyteNotFound => 'Bu tahlil kartasi topilmadi.';

  @override
  String get analyteStructureOnlyTitle => 'Kontent tayyorlanmoqda';

  @override
  String get analyteStructureOnlyBody =>
      'Bu kartada faqat tuzilma bor. Klinik matn manbalar bilan va mustaqil mutaxassis tekshiruvidan keyin qo‘shiladi — umumiy matn tayyor deb ko‘rsatilmaydi.';

  @override
  String get analyteSampleNotice =>
      'Ko‘rsatilgan manbalarga tayangan o‘quv namuna. Mustaqil mutaxassis tekshiruvi kutilmoqda — klinik qaror uchun emas.';

  @override
  String get analyteNotWritten =>
      'Hali yozilmagan: manba va tekshiruv talab qilinadi.';

  @override
  String get analyteAtAGlance => 'Bir qarashda';

  @override
  String get analyteSpecimen => 'Namuna';

  @override
  String get analytePopulation => 'Populyatsiya';

  @override
  String get analyteMethod => 'Metod';

  @override
  String get analyteMethodNotSet => 'Ko‘rsatilmagan — reagent IFUga bog‘liq';

  @override
  String get analyteUnits => 'Birliklar';

  @override
  String get analyteRefIntervals => 'Referens intervallar';

  @override
  String get analyteRefIntervalNone =>
      'Bu yerda referens interval berilmagan. Laboratoriyangiz blankidagi intervaldan foydalaning: u metod, namuna va populyatsiyaga bog‘liq.';

  @override
  String get analyteDecisionLimits => 'Diagnostik chegaralar';

  @override
  String get analyteDecisionNotRef =>
      'Diagnostik chegaralar laboratoriya referens intervali emas.';

  @override
  String get analyteNoInterpretation =>
      'LabGuide alohida natijani talqin qilmaydi, tashxis yoki doza taklif qilmaydi.';

  @override
  String get analyteSources => 'Manbalar';

  @override
  String analyteSourceAccessed(String date) {
    return 'Ko‘rilgan sana: $date';
  }

  @override
  String get analyteReuseRightsVerify =>
      'Foydalanish huquqi: tarqatishdan oldin tekshiriladi';

  @override
  String get analyteReview => 'Tekshiruv holati';

  @override
  String get analyteReviewPending => 'Mutaxassis tekshiruvi kutilmoqda';

  @override
  String get analyteReviewApproved => 'Tekshirilgan';

  @override
  String get analyteReviewerNotAssigned => 'Tekshiruvchi tayinlanmagan';

  @override
  String get analyteTranslationPending => 'Tarjima tekshiruvi kutilmoqda';

  @override
  String analyteContentVersion(String version) {
    return 'Kontent versiyasi $version';
  }

  @override
  String get analyteConvertUnits => 'Birliklarni o‘tkazish';

  @override
  String get analyteConvertUnitsSub => 'Moddaga xos koeffitsiyent';

  @override
  String get analyteMethodCalibration => 'Metodika va kalibrlash';

  @override
  String get analyteMethodCalibrationSub => 'IFU · QC';

  @override
  String get analytePractice => 'Mavzuni mustahkamlash';

  @override
  String get analytePracticeSub => 'Izohli savollar';

  @override
  String get analyteRelated => 'Bog‘liq tahlillar';

  @override
  String get sectionPurpose => 'Nima uchun?';

  @override
  String get sectionPhysiology => 'Fiziologiya';

  @override
  String get sectionHighResult => 'Yuqori natija';

  @override
  String get sectionLowResult => 'Past natija';

  @override
  String get sectionPreanalytics => 'Namuna va preanalitika';

  @override
  String get sectionInterference => 'Interferensiya';

  @override
  String get sectionLimitations => 'Cheklovlar';

  @override
  String get labTitle => 'Laboratoriya';

  @override
  String get labSubtitle => 'Har bosqichda aniq yo‘l.';

  @override
  String get labHeroEyebrow => 'Amaliy ish';

  @override
  String get labHeroTitle => 'Apparat → reagent → metod';

  @override
  String get labHeroBody => 'Aniq modelga mos yo‘riqnoma va nazorat.';

  @override
  String get labHeroCta => 'Kalibrlashni ochish';

  @override
  String get labQcSub => 'Nazorat kartalari va qoidalar';

  @override
  String get labPreanalytics => 'Preanalitika';

  @override
  String get labPreanalyticsSub => 'Tayyorlash, olish, saqlash, tashish';

  @override
  String get labCalculatorsSub => 'Suyultirish va birliklar';

  @override
  String get labInstruments => 'Apparatlar va metodikalar';

  @override
  String get labInstrumentsSub => 'Mindray · HUMAN · boshqa';

  @override
  String get labMicroscopySub => 'Tasvir va tuzilmalarni solishtirish';

  @override
  String get calTitle => 'Kalibrlash yo‘li';

  @override
  String get calSubtitle => 'To‘g‘ri yo‘riqnoma uchun aniq moslik kerak.';

  @override
  String get calManufacturer => 'Ishlab chiqaruvchi';

  @override
  String get calManufacturerOther => 'Boshqa';

  @override
  String get calModel => 'Apparat modeli';

  @override
  String get calModelHint => 'Aniq model nomi';

  @override
  String get calReagentRef => 'Reagent REF';

  @override
  String get calIfuRevision => 'IFU versiyasi';

  @override
  String get calCalibratorLot => 'Kalibrator loti';

  @override
  String get calCheck => 'Moslikni tekshirish';

  @override
  String get calFieldsRequired =>
      'Model, reagent REF va IFU versiyasini kiriting.';

  @override
  String get calNoMatchTitle =>
      'Bu kombinatsiya uchun tasdiqlangan yo‘riqnoma yo‘q';

  @override
  String get calNoMatchBody =>
      'Kalibrlash parametrlari faqat ishlab chiqaruvchi, model, reagent REF, IFU versiyasi va kalibrator lotiga mos tasdiqlangan IFUdan ko‘rsatiladi. Ishlab chiqaruvchining amaldagi IFUsidan foydalaning.';

  @override
  String calCatalogCount(int count) {
    return 'Bu buildda tasdiqlangan IFU yozuvlari: $count';
  }

  @override
  String get calBrandWarning =>
      'Brend nomi (masalan, Mindray yoki HUMAN) barcha modellar bir xil degani emas. Reagent IFU va apparat qo‘llanmasi alohida hujjatlar.';

  @override
  String get calWorkflow => 'Ish ketma-ketligi';

  @override
  String get calStep1 => 'Model, reagent va yo‘riqnoma versiyasi';

  @override
  String get calStep2 => 'Kalibrator loti va tayinlangan qiymatlar';

  @override
  String get calStep3 => 'Metodga mos tayyorlash';

  @override
  String get calStep4 => 'Yo‘riqnoma bo‘yicha kalibrlash';

  @override
  String get calStep5 => 'Kalibrlashdan keyingi QC';

  @override
  String get calStep6 => 'Qaydlar va muammolarni tekshirish';

  @override
  String get calNoServiceCodes =>
      'Servis kodlari va xavfsizlikni chetlab o‘tuvchi usullar kiritilmaydi.';

  @override
  String get qcTitle => 'Sifat nazorati';

  @override
  String get qcChartTitle => 'Levey–Jennings';

  @override
  String get qcChartBody =>
      'Grafik uchun test, nazorat loti, daraja, o‘rtacha qiymat va SD kerak. Uydirma natijalar chizilmaydi.';

  @override
  String get qcEmptyTitle => 'Hali nazorat qaydlari yo‘q';

  @override
  String get qcEmptyBody =>
      'Nazorat qaydlari va qoidalarni tekshirish manbali izohlar bilan birga qo‘shiladi.';

  @override
  String get preTitle => 'Namuna yo‘li';

  @override
  String get preStep1 => 'Tahlilga tayyorlash';

  @override
  String get preStep2 => 'Namuna va qo‘shimchani tanlash';

  @override
  String get preStep3 => 'Olish va identifikatsiya';

  @override
  String get preStep4 => 'Ajratish va saqlash';

  @override
  String get preStep5 => 'Tashish va qabul qilish';

  @override
  String get preNotice =>
      'Probirka rangi, vaqt va harorat aniq probirka, metod va yo‘riqnomaga bog‘lanadi. Universal parametrlar berilmaydi.';

  @override
  String get calcTitle => 'Kalkulyatorlar';

  @override
  String get calcLearningTag => 'O‘quv kalkulyatori';

  @override
  String get calcDilution => 'Suyultirish';

  @override
  String get calcDilutionSub => 'C₁V₁ = C₂V₂';

  @override
  String get calcUnits => 'Birliklarni o‘tkazish';

  @override
  String get calcUnitsSub => 'Moddaga xos';

  @override
  String get dilC1 => 'C₁ · Boshlang‘ich konsentratsiya';

  @override
  String get dilC2 => 'C₂ · Yakuniy konsentratsiya';

  @override
  String get dilV2 => 'V₂ · Yakuniy hajm (mL)';

  @override
  String get dilNote =>
      'C₁ va C₂ birliklari bir xil bo‘lsin. Oddiy suyultirish modeli: reaksiya, xavfsizlik va hajm o‘zgarishi hisoblanmaydi.';

  @override
  String get dilCalculate => 'Hisoblash';

  @override
  String dilResult(String volume) {
    return 'V₁ = $volume mL';
  }

  @override
  String get dilResultBody =>
      'Boshlang‘ich eritmadan olinadigan hajm. Umumiy hajmni V₂ gacha yetkazing.';

  @override
  String dilDiluent(String volume) {
    return 'Suyultiruvchi ≈ $volume mL (hajmlar qo‘shiladi deb)';
  }

  @override
  String get dilNoDilution => 'C₂ = C₁: suyultirish kerak emas.';

  @override
  String get dilErrorInvalid => 'Har bir maydonga noldan katta son kiriting.';

  @override
  String get dilErrorC2GtC1 =>
      'C₂ C₁ dan katta bo‘lmaydi: suyultirish konsentratsiyani oshirmaydi.';

  @override
  String get dilErrorRange => 'Qiymatlar hisoblash oralig‘idan tashqarida.';

  @override
  String get ucTitle => 'Birliklarni o‘tkazish';

  @override
  String get ucSubtitle =>
      'Har bir moddaning o‘z koeffitsiyenti bor — mg/dL → mmol/L uchun bitta umumiy koeffitsiyent noto‘g‘ri.';

  @override
  String get ucAnalyte => 'Modda';

  @override
  String get ucValue => 'Qiymat';

  @override
  String get ucSwap => 'Birliklarni almashtirish';

  @override
  String get ucConvert => 'O‘tkazish';

  @override
  String ucNote(String mass) {
    return 'Molyar massa $mass g/mol asosida hisoblandi. Laboratoriyalar boshqacha yaxlitlashi mumkin; laboratoriyangiz birligidan foydalaning.';
  }

  @override
  String get ucNotAvailable =>
      'Bu modda uchun tasdiqlangan molyar massa yo‘q, shuning uchun o‘tkazish taklif qilinmaydi.';

  @override
  String get ucErrorInvalid => '0 yoki undan katta son kiriting.';

  @override
  String get ucErrorRange => 'Qiymat hisoblash oralig‘idan tashqarida.';

  @override
  String get micTitle => 'Mikroskopiya atlasi';

  @override
  String get micNotice =>
      'Tasvir joyi. Haqiqiy mikrofotolar foydalanish huquqi va belgilari tekshirilgandan keyingina qo‘shiladi.';

  @override
  String get micRedCells => 'Eritrotsitlar';

  @override
  String get micWhiteCells => 'Leykotsitlar';

  @override
  String get micEpithelium => 'Epiteliy hujayralari';

  @override
  String get micCasts => 'Silindrlar';

  @override
  String get micCrystals => 'Kristallar';

  @override
  String get micItemSub => 'Ko‘rinish · farqlash · cheklov';

  @override
  String get micImagePending => 'Tasvir huquqi tekshirilmoqda';

  @override
  String get insTitle => 'Apparatlar';

  @override
  String get insMindraySub => 'Aniq modelni tanlash kerak';

  @override
  String get insHumanSub => 'Apparat va reagent hujjatlari alohida';

  @override
  String get insOther => 'Boshqa ishlab chiqaruvchi';

  @override
  String get insOtherSub => 'Aniq model va IFU bo‘yicha moslash';

  @override
  String get libTitle => 'Kutubxona';

  @override
  String get libSubtitle => 'Bilimlaringiz bir joyda.';

  @override
  String get libBooks => 'Kitob va qo‘llanmalar';

  @override
  String get libBooksSub => 'PDF · til · versiya · hajm';

  @override
  String get libPacks => 'Oflayn paketlar';

  @override
  String get libPacksSub => 'O‘rnatilgan va kutilayotgan paketlar';

  @override
  String get libSavedSub => 'Saqlangan tahlillar';

  @override
  String get libResearchSub => 'Savol, reja, haqiqiy ma’lumot va manba';

  @override
  String get libSources => 'Manbalar va litsenziyalar';

  @override
  String get libSourcesSub => 'Tekshiruv va foydalanish shartlari';

  @override
  String get booksEmptyTitle => 'Hali kitoblar yo‘q';

  @override
  String get booksEmptyBody =>
      'Kitoblar faqat tarqatish huquqi tasdiqlangandan keyin qo‘shiladi. O‘zingiz qo‘shgan PDF shaxsiy o‘rganish uchun qoladi va tarqatilmaydi.';

  @override
  String get packsInstalled => 'O‘rnatilgan';

  @override
  String get packsCoreTitle => 'Asosiy kontent';

  @override
  String packsVersion(String version) {
    return 'Versiya $version';
  }

  @override
  String packsSize(String size) {
    return 'Hajm: $size';
  }

  @override
  String packsLanguages(String languages) {
    return 'Tillar: $languages';
  }

  @override
  String packsLicence(String licence) {
    return 'Litsenziya: $licence';
  }

  @override
  String get packsVerified => 'Butunligi tekshirildi (SHA-256)';

  @override
  String get packsUpcoming => 'Kutilayotgan paketlar';

  @override
  String get packsUpcomingBody =>
      'Yuklashdan oldin haqiqiy hajm ko‘rsatiladi. Paketlar kontent tekshiruvidan keyingina nashr etiladi.';

  @override
  String get packsBiochem => 'Biokimyo asoslari';

  @override
  String get packsSpecimensQc => 'Namuna va QC';

  @override
  String get packsMicroscopy => 'Mikroskopiya atlasi';

  @override
  String get packsNotPublished => 'Hali nashr etilmagan';

  @override
  String get savedEmptyTitle => 'Hali xatcho‘p yo‘q';

  @override
  String get savedEmptyBody =>
      'Tahlil kartasida “Saqlash”ni bosing — u shu yerda turadi.';

  @override
  String get sourcesTitle => 'Manbalar va litsenziyalar';

  @override
  String get sourcesBody =>
      'Nashr etiladigan har bir da’vo asl manba, ko‘rilgan sana, qamrov va tekshiruv holatiga bog‘lanadi.';

  @override
  String get researchTitle => 'Ilmiy ish maydoni';

  @override
  String get researchQuestion => 'Mavzu yoki ilmiy savol';

  @override
  String get researchQuestionHint => 'Mavzuni kiriting';

  @override
  String get researchNotes => 'Maqsad va qaydlar';

  @override
  String get researchNotesHint => 'O‘z ma’lumotlaringiz va manbalaringiz';

  @override
  String get researchSave => 'Qoralamani saqlash';

  @override
  String get researchSaved => 'Qoralama shu qurilmada saqlandi';

  @override
  String get researchOutline => 'Reja tuzilmasi';

  @override
  String get researchStep1 => 'Savol va maqsad';

  @override
  String get researchStep2 => 'Manbalar sharhi';

  @override
  String get researchStep3 => 'Metod va haqiqiy ma’lumotlar';

  @override
  String get researchStep4 => 'Natija, cheklov va xulosa';

  @override
  String get researchNoFabrication =>
      'LabGuide natija, bemor ma’lumoti yoki iqtibos to‘qimaydi. Faqat o‘z ma’lumotlaringiz va manbalaringizdan foydalaning.';

  @override
  String get learnTitle => 'Tushunib o‘rganing';

  @override
  String get learnHeroTag => 'Rasmli biokimyo';

  @override
  String get learnHeroTitle => 'Molekuladan amaliyotgacha';

  @override
  String get learnHeroBody => 'Mavzular, mexanizmlar va bilimni tekshirish.';

  @override
  String get learnHeroCta => 'Mavzularni ko‘rish';

  @override
  String get learnClassesSub => 'Ustoz → topshiriq → talaba → natija';

  @override
  String get learnQuiz => 'Izohli test';

  @override
  String learnQuizSub(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ta mashq savoli',
    );
    return '$_temp0';
  }

  @override
  String get learnExam => 'Imtihon rejimi';

  @override
  String get learnExamSub => 'Vaqt, mavzu va savollar';

  @override
  String get learnLessonPlan => 'Dars rejasi';

  @override
  String get learnLessonPlanSub => 'Ustoz uchun ish maydoni';

  @override
  String quizProgress(int current, int total) {
    return 'Savol $current / $total';
  }

  @override
  String get quizCorrect => 'To‘g‘ri.';

  @override
  String get quizIncorrect => 'Bu javob to‘g‘ri emas.';

  @override
  String get quizNext => 'Keyingi';

  @override
  String get quizFinish => 'Natijani ko‘rish';

  @override
  String get quizDoneTitle => 'Mashq yakunlandi';

  @override
  String quizScore(int correct, int total) {
    return '$total tadan $correct ta to‘g‘ri';
  }

  @override
  String get quizRestart => 'Qayta boshlash';

  @override
  String quizBasis(String basis) {
    return 'Asos: $basis';
  }

  @override
  String get quizReviewNote =>
      'Mashq savollari mutaxassis tekshiruvini kutmoqda.';

  @override
  String get quizMistakes => 'Xatolar ustida ishlash';

  @override
  String get quizNoMistakes => 'Xato yo‘q — barakalla.';

  @override
  String get quizYourAnswer => 'Sizning javobingiz';

  @override
  String get quizCorrectAnswer => 'To‘g‘ri javob';

  @override
  String get examTitle => 'Imtihon rejimi';

  @override
  String get examBody =>
      'Vaqtli imtihon va natijalar tarixi o‘rganish moduli bilan qo‘shiladi. Mashq savollari hozir ochiq.';

  @override
  String get examOpenPractice => 'Mashq savollarini ochish';

  @override
  String get classesTitle => 'Guruh va topshiriqlar';

  @override
  String get classesSignInTitle => 'Guruhlar uchun hisobga kiring';

  @override
  String get classesSignInBody =>
      'Guruh yaratish, qo‘shilish va topshiriq yuborish hisobga bog‘langan. Kontentni o‘qish kirishsiz ochiq qoladi.';

  @override
  String get classesSignIn => 'Kirish';

  @override
  String get classesUnavailableTitle => 'Guruhlar serveri hali ulanmagan';

  @override
  String get classesUnavailableBody =>
      'Hech narsa yuborilmaydi va saqlanmaydi. Ulanganda ustoz faqat o‘z guruhini, talaba faqat o‘z natijasini ko‘radi — bu serverda tekshiriladi.';

  @override
  String get profileTitle => 'Profil va sozlamalar';

  @override
  String get profileGuest => 'Mehmon';

  @override
  String get profileGuestSub => 'Kontent hisobsiz ochiq';

  @override
  String get profileDemoSession => 'Demo sessiya · debug build';

  @override
  String get profileRole => 'Yo‘nalish';

  @override
  String get profileRoleSub => 'Bosh sahifa sizga moslashadi';

  @override
  String get profileLanguage => 'Til';

  @override
  String get profileAppearance => 'Tashqi ko‘rinish';

  @override
  String get themeSystem => 'Tizim';

  @override
  String get themeLight => 'Kunduzgi';

  @override
  String get themeDark => 'Tungi';

  @override
  String get profilePurchase => 'Obuna va tiklash';

  @override
  String get profilePurchaseSub => 'Free · Pro';

  @override
  String get profilePrivacy => 'Maxfiylik va yordam';

  @override
  String get profilePrivacySub => 'Ma’lumotlar va hisob boshqaruvi';

  @override
  String get profileSignIn => 'Email orqali kirish';

  @override
  String get profileSignOut => 'Chiqish';

  @override
  String profileVersion(String version) {
    return 'Versiya $version';
  }

  @override
  String get purchaseTitle => 'LabGuide Pro';

  @override
  String get purchaseFree => 'Free: demo va bazaviy kartalar.';

  @override
  String get purchasePro =>
      'Pro, oylik yoki yillik: to‘liq nashr etilgan paketlar, kengaytirilgan o‘rganish va laboratoriya vositalari.';

  @override
  String get purchaseNotice =>
      'Do‘kon mahsulotlari ulanmagan. Narxlar App Store / Google Play’dan mahalliy valyutada olinadi. Bu yerda pul yechilmaydi va hali tayyor bo‘lmagan imkoniyat sotilmaydi.';

  @override
  String get purchaseSubscribe => 'Obuna bo‘lish';

  @override
  String get purchaseRestore => 'Xaridni tiklash';

  @override
  String get privacyTitle => 'Maxfiylik va yordam';

  @override
  String get privacyBody =>
      'Bu build serverga ma’lumot yubormaydi. Sozlamalar, xatcho‘plar va qoralamalar faqat shu qurilmada saqlanadi.';

  @override
  String get privacyTerms => 'Foydalanish shartlari';

  @override
  String get privacyTermsSub => 'Yakuniy matn tayyorlanadi';

  @override
  String get privacyDeleteLocal => 'Lokal ma’lumotlarni o‘chirish';

  @override
  String get privacyDeleteLocalSub =>
      'Shu qurilmadagi sozlamalar, xatcho‘plar va qoralamalar';

  @override
  String get privacyDeleteConfirmTitle => 'Lokal ma’lumotlar o‘chirilsinmi?';

  @override
  String get privacyDeleteConfirmBody =>
      'Shu qurilmadagi sozlamalar, xatcho‘plar va qoralamalar o‘chiriladi. Buni qaytarib bo‘lmaydi.';

  @override
  String get privacyDeleted => 'Lokal ma’lumotlar o‘chirildi';

  @override
  String get termsTitle => 'Foydalanish shartlari';

  @override
  String get termsBody =>
      'Yakuniy shartlar, maxfiylik siyosati va klinik foydalanish chegaralari nashrdan oldin tayyorlanadi. LabGuide — ma’lumotnoma va o‘quv vositasi: u tashxis qo‘ymaydi, dori buyurmaydi va laboratoriyangiz tartiblarini almashtirmaydi.';

  @override
  String citePage(String page) {
    return '$page-bet';
  }

  @override
  String get rightsUnknown => 'Tarqatish huquqi tasdiqlanmagan';

  @override
  String get rightsPersonal => 'Faqat shaxsiy o‘rganish uchun — tarqatilmaydi';

  @override
  String get rightsPermitted => 'Tarqatish ruxsati qayd etilgan';

  @override
  String get rightsDenied => 'Tarqatishga ruxsat yo‘q';

  @override
  String get catBiochemistry => 'Biokimyo';

  @override
  String get catClinicalLab => 'Klinik laboratoriya';

  @override
  String get catInstruments => 'Apparatlar';

  @override
  String get catMethods => 'Metodikalar';

  @override
  String get catTests => 'Test savollari';

  @override
  String get kindBook => 'Kitob';

  @override
  String get kindManual => 'Qo‘llanma';

  @override
  String get kindMethod => 'Metodika';

  @override
  String get kindIfu => 'IFU';

  @override
  String get kindArticle => 'Maqola';

  @override
  String get kindQuestionSet => 'Savollar to‘plami';

  @override
  String libItemPack(String size) {
    return 'Oflayn paket · $size';
  }

  @override
  String get libItemNoPack => 'Umumiy oflayn paket sifatida mavjud emas';

  @override
  String libItemSupersedes(String title) {
    return 'Yangi nashr. Oldingisi: $title';
  }

  @override
  String get libReview => 'Tekshiruv navbati';

  @override
  String get libReviewSub => 'Manbalardagi farqlar va qoralamalar';

  @override
  String get reviewDiscrepancies => 'Manbalar orasidagi farqlar';

  @override
  String get reviewDiscrepanciesBody =>
      'Eski va yangi manbalar bir-biriga zid bo‘lsa, ikkala pozitsiya mutaxassis tekshiruvi uchun shu yerda ko‘rsatiladi. Hal qilinmaguncha hech biri fakt sifatida nashr etilmaydi.';

  @override
  String get reviewNoDiscrepancies => 'Ochiq farqlar yo‘q.';

  @override
  String reviewDraftQuestions(int count) {
    return 'Qoralama savollar: $count';
  }

  @override
  String reviewDraftCards(int count) {
    return 'Mutaxassis tekshiruvini kutayotgan kartalar: $count';
  }

  @override
  String reviewCatalog(int count) {
    return 'Kataloglangan materiallar: $count';
  }

  @override
  String reviewField(String field) {
    return 'Maydon: $field';
  }

  @override
  String get quizDraftTag => 'Qoralama · tekshirilmagan';

  @override
  String get lessonsTitle => 'Dars mavzulari';
}
