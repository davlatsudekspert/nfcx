import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ru.dart';
import 'app_localizations_uz.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
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
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

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

  /// No description provided for @appTagline.
  ///
  /// In en, this message translates to:
  /// **'BIOCHEMISTRY · LABORATORY'**
  String get appTagline;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navTests.
  ///
  /// In en, this message translates to:
  /// **'Tests'**
  String get navTests;

  /// No description provided for @navLab.
  ///
  /// In en, this message translates to:
  /// **'Lab'**
  String get navLab;

  /// No description provided for @navLibrary.
  ///
  /// In en, this message translates to:
  /// **'Library'**
  String get navLibrary;

  /// No description provided for @navLearn.
  ///
  /// In en, this message translates to:
  /// **'Learn'**
  String get navLearn;

  /// No description provided for @actionBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get actionBack;

  /// No description provided for @actionProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile and settings'**
  String get actionProfile;

  /// No description provided for @actionLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get actionLanguage;

  /// No description provided for @actionOpen.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get actionOpen;

  /// No description provided for @actionRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get actionRetry;

  /// No description provided for @actionContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get actionContinue;

  /// No description provided for @actionCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get actionCancel;

  /// No description provided for @actionDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get actionDelete;

  /// No description provided for @actionCopyLink.
  ///
  /// In en, this message translates to:
  /// **'Copy link'**
  String get actionCopyLink;

  /// No description provided for @linkCopied.
  ///
  /// In en, this message translates to:
  /// **'Link copied'**
  String get linkCopied;

  /// No description provided for @plannedStage.
  ///
  /// In en, this message translates to:
  /// **'Planned for stage {stage}'**
  String plannedStage(String stage);

  /// No description provided for @notAvailableYet.
  ///
  /// In en, this message translates to:
  /// **'Not available yet'**
  String get notAvailableYet;

  /// No description provided for @debugBuildBadge.
  ///
  /// In en, this message translates to:
  /// **'DEBUG · DEMO ADAPTERS'**
  String get debugBuildBadge;

  /// No description provided for @welcomeEyebrow.
  ///
  /// In en, this message translates to:
  /// **'Your laboratory companion'**
  String get welcomeEyebrow;

  /// No description provided for @welcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Biochemistry.\nClear and practical.'**
  String get welcomeTitle;

  /// No description provided for @welcomeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Tests, laboratory practice and learning in one place.'**
  String get welcomeSubtitle;

  /// No description provided for @welcomeDevices.
  ///
  /// In en, this message translates to:
  /// **'Phone and tablet'**
  String get welcomeDevices;

  /// No description provided for @welcomeRoles.
  ///
  /// In en, this message translates to:
  /// **'Physician · lab professional · student · teacher'**
  String get welcomeRoles;

  /// No description provided for @welcomeGetStarted.
  ///
  /// In en, this message translates to:
  /// **'Get started / sign up'**
  String get welcomeGetStarted;

  /// No description provided for @welcomeGuest.
  ///
  /// In en, this message translates to:
  /// **'Explore as guest'**
  String get welcomeGuest;

  /// No description provided for @welcomeSignIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get welcomeSignIn;

  /// No description provided for @welcomeGuestNote.
  ///
  /// In en, this message translates to:
  /// **'No account is needed to read content. Sign-in is used for sync, classes and purchases.'**
  String get welcomeGuestNote;

  /// No description provided for @authTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get authTitle;

  /// No description provided for @authSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in or create an account with email.'**
  String get authSubtitle;

  /// No description provided for @authEmailLabel.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get authEmailLabel;

  /// No description provided for @authEmailHint.
  ///
  /// In en, this message translates to:
  /// **'name@example.com'**
  String get authEmailHint;

  /// No description provided for @authEmailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address.'**
  String get authEmailInvalid;

  /// No description provided for @authConsent.
  ///
  /// In en, this message translates to:
  /// **'I accept the terms of use and privacy policy.'**
  String get authConsent;

  /// No description provided for @authConsentRequired.
  ///
  /// In en, this message translates to:
  /// **'Accept the terms to continue.'**
  String get authConsentRequired;

  /// No description provided for @authGetCode.
  ///
  /// In en, this message translates to:
  /// **'Get code'**
  String get authGetCode;

  /// No description provided for @authViewTerms.
  ///
  /// In en, this message translates to:
  /// **'View terms'**
  String get authViewTerms;

  /// No description provided for @authDemoNotice.
  ///
  /// In en, this message translates to:
  /// **'Debug build: demo sign-in. No email is sent; the code is shown on the next screen.'**
  String get authDemoNotice;

  /// No description provided for @authUnavailableTitle.
  ///
  /// In en, this message translates to:
  /// **'Email sign-in isn\'t connected yet'**
  String get authUnavailableTitle;

  /// No description provided for @authUnavailableBody.
  ///
  /// In en, this message translates to:
  /// **'All reading content is available to guests. Sign-in will be enabled once the email service is configured.'**
  String get authUnavailableBody;

  /// No description provided for @authContinueGuest.
  ///
  /// In en, this message translates to:
  /// **'Continue as guest'**
  String get authContinueGuest;

  /// No description provided for @authRateLimited.
  ///
  /// In en, this message translates to:
  /// **'Too many requests. Try again in {seconds} s.'**
  String authRateLimited(int seconds);

  /// No description provided for @authGenericError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Check the connection and try again.'**
  String get authGenericError;

  /// No description provided for @otpTitle.
  ///
  /// In en, this message translates to:
  /// **'Verify your email'**
  String get otpTitle;

  /// No description provided for @otpCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'6-digit code'**
  String get otpCodeLabel;

  /// No description provided for @otpVerify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get otpVerify;

  /// No description provided for @otpDemoCode.
  ///
  /// In en, this message translates to:
  /// **'Demo code: {code}. No email was sent (debug build only).'**
  String otpDemoCode(String code);

  /// No description provided for @otpInvalid.
  ///
  /// In en, this message translates to:
  /// **'Incorrect code. Attempts left: {attempts}.'**
  String otpInvalid(int attempts);

  /// No description provided for @otpExpired.
  ///
  /// In en, this message translates to:
  /// **'The code has expired. Request a new one.'**
  String get otpExpired;

  /// No description provided for @otpTooManyAttempts.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Request a new code.'**
  String get otpTooManyAttempts;

  /// No description provided for @otpNoActiveCode.
  ///
  /// In en, this message translates to:
  /// **'No active code. Request a new one.'**
  String get otpNoActiveCode;

  /// No description provided for @otpFormat.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit code.'**
  String get otpFormat;

  /// No description provided for @otpResend.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get otpResend;

  /// No description provided for @otpResendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend in {seconds} s'**
  String otpResendIn(int seconds);

  /// No description provided for @otpValidFor.
  ///
  /// In en, this message translates to:
  /// **'The code is valid for {minutes} min.'**
  String otpValidFor(int minutes);

  /// No description provided for @otpResent.
  ///
  /// In en, this message translates to:
  /// **'A new code was issued.'**
  String get otpResent;

  /// No description provided for @rolesTitle.
  ///
  /// In en, this message translates to:
  /// **'Your workspace'**
  String get rolesTitle;

  /// No description provided for @rolesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose your main role. You can change it later.'**
  String get rolesSubtitle;

  /// No description provided for @rolesNote.
  ///
  /// In en, this message translates to:
  /// **'The role only adapts the home screen. It doesn\'t grant access to other people\'s classes or data.'**
  String get rolesNote;

  /// No description provided for @roleDoctor.
  ///
  /// In en, this message translates to:
  /// **'Physician'**
  String get roleDoctor;

  /// No description provided for @roleDoctorDesc.
  ///
  /// In en, this message translates to:
  /// **'Results and clinical context'**
  String get roleDoctorDesc;

  /// No description provided for @roleLab.
  ///
  /// In en, this message translates to:
  /// **'Laboratory professional'**
  String get roleLab;

  /// No description provided for @roleLabDesc.
  ///
  /// In en, this message translates to:
  /// **'Methods, instruments and QC'**
  String get roleLabDesc;

  /// No description provided for @roleStudent.
  ///
  /// In en, this message translates to:
  /// **'Student'**
  String get roleStudent;

  /// No description provided for @roleStudentDesc.
  ///
  /// In en, this message translates to:
  /// **'Learn, practice and prepare'**
  String get roleStudentDesc;

  /// No description provided for @roleTeacher.
  ///
  /// In en, this message translates to:
  /// **'Teacher / researcher'**
  String get roleTeacher;

  /// No description provided for @roleTeacherDesc.
  ///
  /// In en, this message translates to:
  /// **'Classes, assignments and research'**
  String get roleTeacherDesc;

  /// No description provided for @homeTitle.
  ///
  /// In en, this message translates to:
  /// **'Knowledge. Precision. Practice.'**
  String get homeTitle;

  /// No description provided for @homeFocusTag.
  ///
  /// In en, this message translates to:
  /// **'Your focus'**
  String get homeFocusTag;

  /// No description provided for @homeHeroDoctorTitle.
  ///
  /// In en, this message translates to:
  /// **'Understand the result in context'**
  String get homeHeroDoctorTitle;

  /// No description provided for @homeHeroDoctorBody.
  ///
  /// In en, this message translates to:
  /// **'Tests, influencing factors and related investigations.'**
  String get homeHeroDoctorBody;

  /// No description provided for @homeHeroDoctorCta.
  ///
  /// In en, this message translates to:
  /// **'Explore tests'**
  String get homeHeroDoctorCta;

  /// No description provided for @homeHeroLabTitle.
  ///
  /// In en, this message translates to:
  /// **'Confidence at the bench'**
  String get homeHeroLabTitle;

  /// No description provided for @homeHeroLabBody.
  ///
  /// In en, this message translates to:
  /// **'Samples, methods and quality control in one place.'**
  String get homeHeroLabBody;

  /// No description provided for @homeHeroLabCta.
  ///
  /// In en, this message translates to:
  /// **'Open quality control'**
  String get homeHeroLabCta;

  /// No description provided for @homeHeroStudentTitle.
  ///
  /// In en, this message translates to:
  /// **'Learn biochemistry with understanding'**
  String get homeHeroStudentTitle;

  /// No description provided for @homeHeroStudentBody.
  ///
  /// In en, this message translates to:
  /// **'Topic → explanation → practice → review.'**
  String get homeHeroStudentBody;

  /// No description provided for @homeHeroStudentCta.
  ///
  /// In en, this message translates to:
  /// **'Start learning'**
  String get homeHeroStudentCta;

  /// No description provided for @homeHeroTeacherTitle.
  ///
  /// In en, this message translates to:
  /// **'Turn knowledge into teaching'**
  String get homeHeroTeacherTitle;

  /// No description provided for @homeHeroTeacherBody.
  ///
  /// In en, this message translates to:
  /// **'Classes, explained questions and assignments with deadlines.'**
  String get homeHeroTeacherBody;

  /// No description provided for @homeHeroTeacherCta.
  ///
  /// In en, this message translates to:
  /// **'Open classes'**
  String get homeHeroTeacherCta;

  /// No description provided for @homeQuickAccess.
  ///
  /// In en, this message translates to:
  /// **'Quick access'**
  String get homeQuickAccess;

  /// No description provided for @homeUsefulTests.
  ///
  /// In en, this message translates to:
  /// **'Useful tests'**
  String get homeUsefulTests;

  /// No description provided for @featureTests.
  ///
  /// In en, this message translates to:
  /// **'Tests'**
  String get featureTests;

  /// No description provided for @featureCalculators.
  ///
  /// In en, this message translates to:
  /// **'Calculators'**
  String get featureCalculators;

  /// No description provided for @featureSampleFactors.
  ///
  /// In en, this message translates to:
  /// **'Sample factors'**
  String get featureSampleFactors;

  /// No description provided for @featureSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get featureSaved;

  /// No description provided for @featureCalibration.
  ///
  /// In en, this message translates to:
  /// **'Calibration'**
  String get featureCalibration;

  /// No description provided for @featureQc.
  ///
  /// In en, this message translates to:
  /// **'QC'**
  String get featureQc;

  /// No description provided for @featureSampling.
  ///
  /// In en, this message translates to:
  /// **'Sampling'**
  String get featureSampling;

  /// No description provided for @featureTopics.
  ///
  /// In en, this message translates to:
  /// **'Topics'**
  String get featureTopics;

  /// No description provided for @featureQuiz.
  ///
  /// In en, this message translates to:
  /// **'Quiz'**
  String get featureQuiz;

  /// No description provided for @featureMicroscopy.
  ///
  /// In en, this message translates to:
  /// **'Microscopy'**
  String get featureMicroscopy;

  /// No description provided for @featureExam.
  ///
  /// In en, this message translates to:
  /// **'Exam'**
  String get featureExam;

  /// No description provided for @featureClasses.
  ///
  /// In en, this message translates to:
  /// **'Classes'**
  String get featureClasses;

  /// No description provided for @featureQuestionBank.
  ///
  /// In en, this message translates to:
  /// **'Questions'**
  String get featureQuestionBank;

  /// No description provided for @featureSources.
  ///
  /// In en, this message translates to:
  /// **'Sources'**
  String get featureSources;

  /// No description provided for @featureResearch.
  ///
  /// In en, this message translates to:
  /// **'Research'**
  String get featureResearch;

  /// No description provided for @testsTitle.
  ///
  /// In en, this message translates to:
  /// **'Test atlas'**
  String get testsTitle;

  /// No description provided for @testsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'From a marker to practical knowledge.'**
  String get testsSubtitle;

  /// No description provided for @testsSearchLabel.
  ///
  /// In en, this message translates to:
  /// **'Search tests'**
  String get testsSearchLabel;

  /// No description provided for @testsSearchHint.
  ///
  /// In en, this message translates to:
  /// **'ALT, creatinine, HbA1c…'**
  String get testsSearchHint;

  /// No description provided for @testsFilterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get testsFilterAll;

  /// No description provided for @testsEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No results'**
  String get testsEmptyTitle;

  /// No description provided for @testsEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Try another name, abbreviation or synonym.'**
  String get testsEmptyBody;

  /// No description provided for @testsClearSearch.
  ///
  /// In en, this message translates to:
  /// **'Clear search'**
  String get testsClearSearch;

  /// No description provided for @testsResultCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{{count} test} other{{count} tests}}'**
  String testsResultCount(int count);

  /// No description provided for @statusDraft.
  ///
  /// In en, this message translates to:
  /// **'Draft'**
  String get statusDraft;

  /// No description provided for @statusVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified'**
  String get statusVerified;

  /// No description provided for @statusPublished.
  ///
  /// In en, this message translates to:
  /// **'Published'**
  String get statusPublished;

  /// No description provided for @statusSourcedSample.
  ///
  /// In en, this message translates to:
  /// **'Sourced sample'**
  String get statusSourcedSample;

  /// No description provided for @statusStructureOnly.
  ///
  /// In en, this message translates to:
  /// **'Structure only'**
  String get statusStructureOnly;

  /// No description provided for @contentLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading content…'**
  String get contentLoading;

  /// No description provided for @contentErrorTitle.
  ///
  /// In en, this message translates to:
  /// **'Content couldn\'t be loaded'**
  String get contentErrorTitle;

  /// No description provided for @contentErrorBody.
  ///
  /// In en, this message translates to:
  /// **'The content pack failed verification. Unverified data is never shown.'**
  String get contentErrorBody;

  /// No description provided for @analyteSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get analyteSave;

  /// No description provided for @analyteSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get analyteSaved;

  /// No description provided for @analyteSavedToast.
  ///
  /// In en, this message translates to:
  /// **'Added to saved'**
  String get analyteSavedToast;

  /// No description provided for @analyteRemovedToast.
  ///
  /// In en, this message translates to:
  /// **'Removed from saved'**
  String get analyteRemovedToast;

  /// No description provided for @analyteNotFound.
  ///
  /// In en, this message translates to:
  /// **'This test card wasn\'t found.'**
  String get analyteNotFound;

  /// No description provided for @analyteStructureOnlyTitle.
  ///
  /// In en, this message translates to:
  /// **'Content in preparation'**
  String get analyteStructureOnlyTitle;

  /// No description provided for @analyteStructureOnlyBody.
  ///
  /// In en, this message translates to:
  /// **'This card shows the structure only. Clinical text is added after sourcing and independent expert review — generic text is never shown as ready.'**
  String get analyteStructureOnlyBody;

  /// No description provided for @analyteSampleNotice.
  ///
  /// In en, this message translates to:
  /// **'Learning sample based on the cited sources. Independent expert review is pending — not for clinical decisions.'**
  String get analyteSampleNotice;

  /// No description provided for @analyteNotWritten.
  ///
  /// In en, this message translates to:
  /// **'Not written yet: requires sources and review.'**
  String get analyteNotWritten;

  /// No description provided for @analyteAtAGlance.
  ///
  /// In en, this message translates to:
  /// **'At a glance'**
  String get analyteAtAGlance;

  /// No description provided for @analyteSpecimen.
  ///
  /// In en, this message translates to:
  /// **'Specimen'**
  String get analyteSpecimen;

  /// No description provided for @analytePopulation.
  ///
  /// In en, this message translates to:
  /// **'Population'**
  String get analytePopulation;

  /// No description provided for @analyteMethod.
  ///
  /// In en, this message translates to:
  /// **'Method'**
  String get analyteMethod;

  /// No description provided for @analyteMethodNotSet.
  ///
  /// In en, this message translates to:
  /// **'Not specified — depends on the reagent IFU'**
  String get analyteMethodNotSet;

  /// No description provided for @analyteUnits.
  ///
  /// In en, this message translates to:
  /// **'Units'**
  String get analyteUnits;

  /// No description provided for @analyteRefIntervals.
  ///
  /// In en, this message translates to:
  /// **'Reference intervals'**
  String get analyteRefIntervals;

  /// No description provided for @analyteRefIntervalNone.
  ///
  /// In en, this message translates to:
  /// **'No reference interval is given here. Use the interval on your laboratory\'s report: it depends on the method, specimen and population.'**
  String get analyteRefIntervalNone;

  /// No description provided for @analyteDecisionLimits.
  ///
  /// In en, this message translates to:
  /// **'Diagnostic thresholds'**
  String get analyteDecisionLimits;

  /// No description provided for @analyteDecisionNotRef.
  ///
  /// In en, this message translates to:
  /// **'Diagnostic thresholds are not laboratory reference intervals.'**
  String get analyteDecisionNotRef;

  /// No description provided for @analyteNoInterpretation.
  ///
  /// In en, this message translates to:
  /// **'LabGuide doesn\'t interpret individual results or suggest diagnoses or doses.'**
  String get analyteNoInterpretation;

  /// No description provided for @analyteSources.
  ///
  /// In en, this message translates to:
  /// **'Sources'**
  String get analyteSources;

  /// No description provided for @analyteSourceAccessed.
  ///
  /// In en, this message translates to:
  /// **'Accessed {date}'**
  String analyteSourceAccessed(String date);

  /// No description provided for @analyteReuseRightsVerify.
  ///
  /// In en, this message translates to:
  /// **'Reuse rights: verify before distribution'**
  String get analyteReuseRightsVerify;

  /// No description provided for @analyteReview.
  ///
  /// In en, this message translates to:
  /// **'Review status'**
  String get analyteReview;

  /// No description provided for @analyteReviewPending.
  ///
  /// In en, this message translates to:
  /// **'Expert review pending'**
  String get analyteReviewPending;

  /// No description provided for @analyteReviewApproved.
  ///
  /// In en, this message translates to:
  /// **'Reviewed'**
  String get analyteReviewApproved;

  /// No description provided for @analyteReviewerNotAssigned.
  ///
  /// In en, this message translates to:
  /// **'Reviewer not assigned'**
  String get analyteReviewerNotAssigned;

  /// No description provided for @analyteTranslationPending.
  ///
  /// In en, this message translates to:
  /// **'Translation review pending'**
  String get analyteTranslationPending;

  /// No description provided for @analyteContentVersion.
  ///
  /// In en, this message translates to:
  /// **'Content version {version}'**
  String analyteContentVersion(String version);

  /// No description provided for @analyteConvertUnits.
  ///
  /// In en, this message translates to:
  /// **'Convert units'**
  String get analyteConvertUnits;

  /// No description provided for @analyteConvertUnitsSub.
  ///
  /// In en, this message translates to:
  /// **'Analyte-specific factor'**
  String get analyteConvertUnitsSub;

  /// No description provided for @analyteMethodCalibration.
  ///
  /// In en, this message translates to:
  /// **'Method and calibration'**
  String get analyteMethodCalibration;

  /// No description provided for @analyteMethodCalibrationSub.
  ///
  /// In en, this message translates to:
  /// **'IFU · QC'**
  String get analyteMethodCalibrationSub;

  /// No description provided for @analyteCalculatorSub.
  ///
  /// In en, this message translates to:
  /// **'Calculator · published formula'**
  String get analyteCalculatorSub;

  /// No description provided for @analytePractice.
  ///
  /// In en, this message translates to:
  /// **'Practice the topic'**
  String get analytePractice;

  /// No description provided for @analytePracticeSub.
  ///
  /// In en, this message translates to:
  /// **'Explained questions'**
  String get analytePracticeSub;

  /// No description provided for @analyteRelated.
  ///
  /// In en, this message translates to:
  /// **'Related tests'**
  String get analyteRelated;

  /// No description provided for @sectionPurpose.
  ///
  /// In en, this message translates to:
  /// **'Purpose'**
  String get sectionPurpose;

  /// No description provided for @sectionPhysiology.
  ///
  /// In en, this message translates to:
  /// **'Physiology'**
  String get sectionPhysiology;

  /// No description provided for @sectionHighResult.
  ///
  /// In en, this message translates to:
  /// **'High result'**
  String get sectionHighResult;

  /// No description provided for @sectionLowResult.
  ///
  /// In en, this message translates to:
  /// **'Low result'**
  String get sectionLowResult;

  /// No description provided for @sectionPreanalytics.
  ///
  /// In en, this message translates to:
  /// **'Specimen and preanalytics'**
  String get sectionPreanalytics;

  /// No description provided for @sectionInterference.
  ///
  /// In en, this message translates to:
  /// **'Interference'**
  String get sectionInterference;

  /// No description provided for @sectionLimitations.
  ///
  /// In en, this message translates to:
  /// **'Limitations'**
  String get sectionLimitations;

  /// No description provided for @labTitle.
  ///
  /// In en, this message translates to:
  /// **'Laboratory'**
  String get labTitle;

  /// No description provided for @labSubtitle.
  ///
  /// In en, this message translates to:
  /// **'A clear path at every stage.'**
  String get labSubtitle;

  /// No description provided for @labHeroEyebrow.
  ///
  /// In en, this message translates to:
  /// **'At the bench'**
  String get labHeroEyebrow;

  /// No description provided for @labHeroTitle.
  ///
  /// In en, this message translates to:
  /// **'Instrument → reagent → method'**
  String get labHeroTitle;

  /// No description provided for @labHeroBody.
  ///
  /// In en, this message translates to:
  /// **'Instructions and controls matched to the exact model.'**
  String get labHeroBody;

  /// No description provided for @labHeroCta.
  ///
  /// In en, this message translates to:
  /// **'Open calibration'**
  String get labHeroCta;

  /// No description provided for @labQcSub.
  ///
  /// In en, this message translates to:
  /// **'Control charts and rules'**
  String get labQcSub;

  /// No description provided for @labPreanalytics.
  ///
  /// In en, this message translates to:
  /// **'Preanalytics'**
  String get labPreanalytics;

  /// No description provided for @labPreanalyticsSub.
  ///
  /// In en, this message translates to:
  /// **'Prepare, collect, store, transport'**
  String get labPreanalyticsSub;

  /// No description provided for @labCalculatorsSub.
  ///
  /// In en, this message translates to:
  /// **'Dilution and units'**
  String get labCalculatorsSub;

  /// No description provided for @labInstruments.
  ///
  /// In en, this message translates to:
  /// **'Instruments and methods'**
  String get labInstruments;

  /// No description provided for @labInstrumentsSub.
  ///
  /// In en, this message translates to:
  /// **'Mindray · HUMAN · other'**
  String get labInstrumentsSub;

  /// No description provided for @labMicroscopySub.
  ///
  /// In en, this message translates to:
  /// **'Compare images and structures'**
  String get labMicroscopySub;

  /// No description provided for @calTitle.
  ///
  /// In en, this message translates to:
  /// **'Calibration workflow'**
  String get calTitle;

  /// No description provided for @calSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Exact matching is needed to select the correct instructions.'**
  String get calSubtitle;

  /// No description provided for @calManufacturer.
  ///
  /// In en, this message translates to:
  /// **'Manufacturer'**
  String get calManufacturer;

  /// No description provided for @calManufacturerOther.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get calManufacturerOther;

  /// No description provided for @calModel.
  ///
  /// In en, this message translates to:
  /// **'Instrument model'**
  String get calModel;

  /// No description provided for @calModelHint.
  ///
  /// In en, this message translates to:
  /// **'Exact model name'**
  String get calModelHint;

  /// No description provided for @calReagentRef.
  ///
  /// In en, this message translates to:
  /// **'Reagent REF'**
  String get calReagentRef;

  /// No description provided for @calIfuRevision.
  ///
  /// In en, this message translates to:
  /// **'IFU revision'**
  String get calIfuRevision;

  /// No description provided for @calCalibratorLot.
  ///
  /// In en, this message translates to:
  /// **'Calibrator lot'**
  String get calCalibratorLot;

  /// No description provided for @calCheck.
  ///
  /// In en, this message translates to:
  /// **'Check match'**
  String get calCheck;

  /// No description provided for @calFieldsRequired.
  ///
  /// In en, this message translates to:
  /// **'Fill in the model, reagent REF and IFU revision.'**
  String get calFieldsRequired;

  /// No description provided for @calNoMatchTitle.
  ///
  /// In en, this message translates to:
  /// **'No verified instructions for this combination'**
  String get calNoMatchTitle;

  /// No description provided for @calNoMatchBody.
  ///
  /// In en, this message translates to:
  /// **'Calibration parameters are shown only from a verified IFU that matches the manufacturer, model, reagent REF, IFU revision and calibrator lot. Use the manufacturer\'s current IFU.'**
  String get calNoMatchBody;

  /// No description provided for @calCatalogCount.
  ///
  /// In en, this message translates to:
  /// **'Verified IFU records in this build: {count}'**
  String calCatalogCount(int count);

  /// No description provided for @calBrandWarning.
  ///
  /// In en, this message translates to:
  /// **'A brand name (e.g. Mindray or HUMAN) doesn\'t mean all models share settings. The reagent IFU and the instrument manual are separate documents.'**
  String get calBrandWarning;

  /// No description provided for @calWorkflow.
  ///
  /// In en, this message translates to:
  /// **'Workflow'**
  String get calWorkflow;

  /// No description provided for @calStep1.
  ///
  /// In en, this message translates to:
  /// **'Model, reagent and instruction revision'**
  String get calStep1;

  /// No description provided for @calStep2.
  ///
  /// In en, this message translates to:
  /// **'Calibrator lot and assigned values'**
  String get calStep2;

  /// No description provided for @calStep3.
  ///
  /// In en, this message translates to:
  /// **'Method-specific preparation'**
  String get calStep3;

  /// No description provided for @calStep4.
  ///
  /// In en, this message translates to:
  /// **'Calibration according to the instructions'**
  String get calStep4;

  /// No description provided for @calStep5.
  ///
  /// In en, this message translates to:
  /// **'Post-calibration QC'**
  String get calStep5;

  /// No description provided for @calStep6.
  ///
  /// In en, this message translates to:
  /// **'Records and troubleshooting'**
  String get calStep6;

  /// No description provided for @calNoServiceCodes.
  ///
  /// In en, this message translates to:
  /// **'Service codes and safety-bypass procedures are not included.'**
  String get calNoServiceCodes;

  /// No description provided for @qcTitle.
  ///
  /// In en, this message translates to:
  /// **'Quality control'**
  String get qcTitle;

  /// No description provided for @qcChartTitle.
  ///
  /// In en, this message translates to:
  /// **'Levey–Jennings'**
  String get qcChartTitle;

  /// No description provided for @qcChartBody.
  ///
  /// In en, this message translates to:
  /// **'A chart needs the test, control lot, level, target mean and SD. No invented results are plotted.'**
  String get qcChartBody;

  /// No description provided for @qcEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No control records yet'**
  String get qcEmptyTitle;

  /// No description provided for @qcEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Add a test with its control levels to start a Levey–Jennings chart. Data is stored only on this device.'**
  String get qcEmptyBody;

  /// No description provided for @qcIntro.
  ///
  /// In en, this message translates to:
  /// **'Enter each control level’s target mean and SD, then record every run. The app checks Westgard rules; it never invents target values or results.'**
  String get qcIntro;

  /// No description provided for @qcLoadError.
  ///
  /// In en, this message translates to:
  /// **'Saved QC data could not be read. Nothing was overwritten.'**
  String get qcLoadError;

  /// No description provided for @qcAddSet.
  ///
  /// In en, this message translates to:
  /// **'Add test'**
  String get qcAddSet;

  /// No description provided for @qcSetName.
  ///
  /// In en, this message translates to:
  /// **'Test name'**
  String get qcSetName;

  /// No description provided for @qcUnit.
  ///
  /// In en, this message translates to:
  /// **'Unit'**
  String get qcUnit;

  /// No description provided for @qcTargetSource.
  ///
  /// In en, this message translates to:
  /// **'Source of the target mean and SD'**
  String get qcTargetSource;

  /// No description provided for @qcSourceLab.
  ///
  /// In en, this message translates to:
  /// **'Our laboratory’s data'**
  String get qcSourceLab;

  /// No description provided for @qcSourceManufacturer.
  ///
  /// In en, this message translates to:
  /// **'Manufacturer’s sheet'**
  String get qcSourceManufacturer;

  /// No description provided for @qcLevel.
  ///
  /// In en, this message translates to:
  /// **'Level {label}'**
  String qcLevel(String label);

  /// No description provided for @qcLevelsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 level} other{{count} levels}}'**
  String qcLevelsCount(int count);

  /// No description provided for @qcRunsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{no runs} =1{1 run} other{{count} runs}}'**
  String qcRunsCount(int count);

  /// No description provided for @qcLot.
  ///
  /// In en, this message translates to:
  /// **'Lot'**
  String get qcLot;

  /// No description provided for @qcMean.
  ///
  /// In en, this message translates to:
  /// **'Target mean'**
  String get qcMean;

  /// No description provided for @qcSd.
  ///
  /// In en, this message translates to:
  /// **'Target SD'**
  String get qcSd;

  /// No description provided for @qcAddLevel.
  ///
  /// In en, this message translates to:
  /// **'Add level'**
  String get qcAddLevel;

  /// No description provided for @qcRemoveLevel.
  ///
  /// In en, this message translates to:
  /// **'Remove level'**
  String get qcRemoveLevel;

  /// No description provided for @qcSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get qcSave;

  /// No description provided for @qcTargetNote.
  ///
  /// In en, this message translates to:
  /// **'Westgard et al. (1981) calculate the mean and SD from the laboratory’s own control measurements — initially about 20 (one run a day), then revised as more data accumulate. The app does not supply these values.'**
  String get qcTargetNote;

  /// No description provided for @qcManufacturerWarning.
  ///
  /// In en, this message translates to:
  /// **'Manufacturer’s values are a guide only; Westgard’s lessons recommend limits calculated from your own control data — the assay sheet’s ranges are often too wide.'**
  String get qcManufacturerWarning;

  /// No description provided for @qcErrName.
  ///
  /// In en, this message translates to:
  /// **'Enter the test name.'**
  String get qcErrName;

  /// No description provided for @qcErrLevel.
  ///
  /// In en, this message translates to:
  /// **'Level {label}: enter the mean and an SD greater than zero.'**
  String qcErrLevel(String label);

  /// No description provided for @qcAccept.
  ///
  /// In en, this message translates to:
  /// **'Accepted'**
  String get qcAccept;

  /// No description provided for @qcWarning.
  ///
  /// In en, this message translates to:
  /// **'Warning'**
  String get qcWarning;

  /// No description provided for @qcReject.
  ///
  /// In en, this message translates to:
  /// **'Rejected'**
  String get qcReject;

  /// No description provided for @qcAcceptBody.
  ///
  /// In en, this message translates to:
  /// **'No rule violated.'**
  String get qcAcceptBody;

  /// No description provided for @qcLatestRun.
  ///
  /// In en, this message translates to:
  /// **'Latest run'**
  String get qcLatestRun;

  /// No description provided for @qcNoRunsYet.
  ///
  /// In en, this message translates to:
  /// **'No runs yet — add the first one below.'**
  String get qcNoRunsYet;

  /// No description provided for @qcAddRun.
  ///
  /// In en, this message translates to:
  /// **'Add run'**
  String get qcAddRun;

  /// No description provided for @qcNote.
  ///
  /// In en, this message translates to:
  /// **'Note (optional)'**
  String get qcNote;

  /// No description provided for @qcSaveRun.
  ///
  /// In en, this message translates to:
  /// **'Save run'**
  String get qcSaveRun;

  /// No description provided for @qcErrRunEmpty.
  ///
  /// In en, this message translates to:
  /// **'Enter at least one control value.'**
  String get qcErrRunEmpty;

  /// No description provided for @qcErrRunInvalid.
  ///
  /// In en, this message translates to:
  /// **'Level {label}: not a number.'**
  String qcErrRunInvalid(String label);

  /// No description provided for @qcRunHistory.
  ///
  /// In en, this message translates to:
  /// **'Runs'**
  String get qcRunHistory;

  /// No description provided for @qcStats.
  ///
  /// In en, this message translates to:
  /// **'Observed'**
  String get qcStats;

  /// No description provided for @qcChartLegend.
  ///
  /// In en, this message translates to:
  /// **'● in control   ▲ warning   ■ rejected'**
  String get qcChartLegend;

  /// No description provided for @qcChartSemantics.
  ///
  /// In en, this message translates to:
  /// **'Levey–Jennings chart, level {label}: {count} values'**
  String qcChartSemantics(String label, int count);

  /// No description provided for @qcDeleteRun.
  ///
  /// In en, this message translates to:
  /// **'Delete run'**
  String get qcDeleteRun;

  /// No description provided for @qcDeleteSet.
  ///
  /// In en, this message translates to:
  /// **'Delete test and all runs'**
  String get qcDeleteSet;

  /// No description provided for @qcConfirmDelete.
  ///
  /// In en, this message translates to:
  /// **'This can’t be undone.'**
  String get qcConfirmDelete;

  /// No description provided for @qcSetMissing.
  ///
  /// In en, this message translates to:
  /// **'This test no longer exists.'**
  String get qcSetMissing;

  /// No description provided for @qcCopyCsv.
  ///
  /// In en, this message translates to:
  /// **'Copy runs as a table (CSV)'**
  String get qcCopyCsv;

  /// No description provided for @qcCopied.
  ///
  /// In en, this message translates to:
  /// **'Copied {count} rows — paste into Excel or Google Sheets'**
  String qcCopied(int count);

  /// No description provided for @qcChangeTarget.
  ///
  /// In en, this message translates to:
  /// **'Change target or lot'**
  String get qcChangeTarget;

  /// No description provided for @qcChangeTargetBody.
  ///
  /// In en, this message translates to:
  /// **'Use this when a new control lot starts or your laboratory recalculates the mean and SD. The new values apply from now on; earlier runs keep being evaluated against the targets that were in effect then.'**
  String get qcChangeTargetBody;

  /// No description provided for @qcErrTarget.
  ///
  /// In en, this message translates to:
  /// **'Enter the mean and an SD greater than zero.'**
  String get qcErrTarget;

  /// No description provided for @qcSince.
  ///
  /// In en, this message translates to:
  /// **'since {date}'**
  String qcSince(String date);

  /// No description provided for @qcPreviousTarget.
  ///
  /// In en, this message translates to:
  /// **'Previous: {target} (from {date})'**
  String qcPreviousTarget(String target, String date);

  /// No description provided for @qcRulesSource.
  ///
  /// In en, this message translates to:
  /// **'Rules: Westgard multirule procedure (Westgard JO et al., Clin Chem 1981; doi:10.1093/clinchem/27.3.493). A learning and checking aid — it does not replace your laboratory’s QC procedure.'**
  String get qcRulesSource;

  /// No description provided for @preTitle.
  ///
  /// In en, this message translates to:
  /// **'Specimen journey'**
  String get preTitle;

  /// No description provided for @preStep1.
  ///
  /// In en, this message translates to:
  /// **'Prepare for testing'**
  String get preStep1;

  /// No description provided for @preStep2.
  ///
  /// In en, this message translates to:
  /// **'Select specimen and additive'**
  String get preStep2;

  /// No description provided for @preStep3.
  ///
  /// In en, this message translates to:
  /// **'Collect and identify'**
  String get preStep3;

  /// No description provided for @preStep4.
  ///
  /// In en, this message translates to:
  /// **'Separate and store'**
  String get preStep4;

  /// No description provided for @preStep5.
  ///
  /// In en, this message translates to:
  /// **'Transport and receive'**
  String get preStep5;

  /// No description provided for @preNotice.
  ///
  /// In en, this message translates to:
  /// **'Tube color, time and temperature are tied to the specific tube, method and instructions. No universal parameters are given.'**
  String get preNotice;

  /// No description provided for @preOrderTitle.
  ///
  /// In en, this message translates to:
  /// **'Order of draw (venepuncture)'**
  String get preOrderTitle;

  /// No description provided for @preOrderSub.
  ///
  /// In en, this message translates to:
  /// **'WHO 2010, Table 2.3 (based on the NCCLS 2003 consensus). Check your laboratory’s current procedure.'**
  String get preOrderSub;

  /// No description provided for @preCap.
  ///
  /// In en, this message translates to:
  /// **'Cap: {cap}'**
  String preCap(String cap);

  /// No description provided for @preHaemolysisTitle.
  ///
  /// In en, this message translates to:
  /// **'Causes of hemolysis'**
  String get preHaemolysisTitle;

  /// No description provided for @preTourniquetTitle.
  ///
  /// In en, this message translates to:
  /// **'Tourniquet'**
  String get preTourniquetTitle;

  /// No description provided for @preIdTitle.
  ///
  /// In en, this message translates to:
  /// **'Patient identification and labelling'**
  String get preIdTitle;

  /// No description provided for @calcTitle.
  ///
  /// In en, this message translates to:
  /// **'Calculators'**
  String get calcTitle;

  /// No description provided for @calcLearningTag.
  ///
  /// In en, this message translates to:
  /// **'Learning calculator'**
  String get calcLearningTag;

  /// No description provided for @calcDilution.
  ///
  /// In en, this message translates to:
  /// **'Dilution'**
  String get calcDilution;

  /// No description provided for @calcDilutionSub.
  ///
  /// In en, this message translates to:
  /// **'C₁V₁ = C₂V₂'**
  String get calcDilutionSub;

  /// No description provided for @calcUnits.
  ///
  /// In en, this message translates to:
  /// **'Unit conversion'**
  String get calcUnits;

  /// No description provided for @calcUnitsSub.
  ///
  /// In en, this message translates to:
  /// **'Analyte-specific'**
  String get calcUnitsSub;

  /// No description provided for @dilC1.
  ///
  /// In en, this message translates to:
  /// **'C₁ · Stock concentration'**
  String get dilC1;

  /// No description provided for @dilC2.
  ///
  /// In en, this message translates to:
  /// **'C₂ · Target concentration'**
  String get dilC2;

  /// No description provided for @dilV2.
  ///
  /// In en, this message translates to:
  /// **'V₂ · Final volume (mL)'**
  String get dilV2;

  /// No description provided for @dilNote.
  ///
  /// In en, this message translates to:
  /// **'Use the same units for C₁ and C₂. Simple dilution model: reactions, safety and volume changes are not modelled.'**
  String get dilNote;

  /// No description provided for @dilCalculate.
  ///
  /// In en, this message translates to:
  /// **'Calculate'**
  String get dilCalculate;

  /// No description provided for @dilResult.
  ///
  /// In en, this message translates to:
  /// **'V₁ = {volume} mL'**
  String dilResult(String volume);

  /// No description provided for @dilResultBody.
  ///
  /// In en, this message translates to:
  /// **'Volume of stock solution. Bring the total final volume to V₂.'**
  String get dilResultBody;

  /// No description provided for @dilDiluent.
  ///
  /// In en, this message translates to:
  /// **'Diluent ≈ {volume} mL (assuming volumes add up)'**
  String dilDiluent(String volume);

  /// No description provided for @dilNoDilution.
  ///
  /// In en, this message translates to:
  /// **'C₂ equals C₁: no dilution is needed.'**
  String get dilNoDilution;

  /// No description provided for @dilErrorInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a number greater than zero in every field.'**
  String get dilErrorInvalid;

  /// No description provided for @dilErrorC2GtC1.
  ///
  /// In en, this message translates to:
  /// **'C₂ can\'t exceed C₁: dilution can\'t raise the concentration.'**
  String get dilErrorC2GtC1;

  /// No description provided for @dilErrorRange.
  ///
  /// In en, this message translates to:
  /// **'The values are outside the calculable range.'**
  String get dilErrorRange;

  /// No description provided for @ucTitle.
  ///
  /// In en, this message translates to:
  /// **'Unit conversion'**
  String get ucTitle;

  /// No description provided for @ucSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Each substance has its own factor — one shared mg/dL → mmol/L factor would be wrong.'**
  String get ucSubtitle;

  /// No description provided for @ucAnalyte.
  ///
  /// In en, this message translates to:
  /// **'Analyte'**
  String get ucAnalyte;

  /// No description provided for @ucValue.
  ///
  /// In en, this message translates to:
  /// **'Value'**
  String get ucValue;

  /// No description provided for @ucSwap.
  ///
  /// In en, this message translates to:
  /// **'Swap units'**
  String get ucSwap;

  /// No description provided for @ucConvert.
  ///
  /// In en, this message translates to:
  /// **'Convert'**
  String get ucConvert;

  /// No description provided for @ucNote.
  ///
  /// In en, this message translates to:
  /// **'Calculated from the molar mass {mass} g/mol. Laboratories may round differently; report the units your laboratory uses.'**
  String ucNote(String mass);

  /// No description provided for @ucNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'No verified molar mass for this analyte, so conversion is not offered.'**
  String get ucNotAvailable;

  /// No description provided for @ucErrorInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a number of 0 or more.'**
  String get ucErrorInvalid;

  /// No description provided for @ucErrorRange.
  ///
  /// In en, this message translates to:
  /// **'The value is outside the calculable range.'**
  String get ucErrorRange;

  /// No description provided for @calcSectionClinical.
  ///
  /// In en, this message translates to:
  /// **'Clinical formulas'**
  String get calcSectionClinical;

  /// No description provided for @calcSectionLab.
  ///
  /// In en, this message translates to:
  /// **'Laboratory'**
  String get calcSectionLab;

  /// No description provided for @calcEgfr.
  ///
  /// In en, this message translates to:
  /// **'eGFR · CKD-EPI 2021'**
  String get calcEgfr;

  /// No description provided for @calcEgfrSub.
  ///
  /// In en, this message translates to:
  /// **'Creatinine, age, sex'**
  String get calcEgfrSub;

  /// No description provided for @calcAcr.
  ///
  /// In en, this message translates to:
  /// **'Albumin/creatinine ratio'**
  String get calcAcr;

  /// No description provided for @calcAcrSub.
  ///
  /// In en, this message translates to:
  /// **'Urine ACR · KDIGO A category'**
  String get calcAcrSub;

  /// No description provided for @calcAnionGap.
  ///
  /// In en, this message translates to:
  /// **'Anion gap'**
  String get calcAnionGap;

  /// No description provided for @calcAnionGapSub.
  ///
  /// In en, this message translates to:
  /// **'Na, Cl, HCO₃ · K and albumin optional'**
  String get calcAnionGapSub;

  /// No description provided for @calcCalcium.
  ///
  /// In en, this message translates to:
  /// **'Corrected calcium'**
  String get calcCalcium;

  /// No description provided for @calcCalciumSub.
  ///
  /// In en, this message translates to:
  /// **'By albumin · Payne 1973'**
  String get calcCalciumSub;

  /// No description provided for @calcLdl.
  ///
  /// In en, this message translates to:
  /// **'LDL-C and non-HDL-C'**
  String get calcLdl;

  /// No description provided for @calcLdlSub.
  ///
  /// In en, this message translates to:
  /// **'Friedewald · Sampson'**
  String get calcLdlSub;

  /// No description provided for @calcOsmo.
  ///
  /// In en, this message translates to:
  /// **'Calculated osmolality'**
  String get calcOsmo;

  /// No description provided for @calcOsmoSub.
  ///
  /// In en, this message translates to:
  /// **'And osmolal gap'**
  String get calcOsmoSub;

  /// No description provided for @calcHba1c.
  ///
  /// In en, this message translates to:
  /// **'HbA1c units and eAG'**
  String get calcHba1c;

  /// No description provided for @calcHba1cSub.
  ///
  /// In en, this message translates to:
  /// **'NGSP ↔ IFCC · ADAG'**
  String get calcHba1cSub;

  /// No description provided for @calcFormulaTag.
  ///
  /// In en, this message translates to:
  /// **'Published formula'**
  String get calcFormulaTag;

  /// No description provided for @calcOptional.
  ///
  /// In en, this message translates to:
  /// **'optional'**
  String get calcOptional;

  /// No description provided for @calcNotDiagnosis.
  ///
  /// In en, this message translates to:
  /// **'A calculation aid for learning and checking. It does not diagnose: interpret the result with the clinical picture and your laboratory’s reference intervals.'**
  String get calcNotDiagnosis;

  /// No description provided for @calcFormula.
  ///
  /// In en, this message translates to:
  /// **'Formula'**
  String get calcFormula;

  /// No description provided for @calcLimitations.
  ///
  /// In en, this message translates to:
  /// **'Limitations'**
  String get calcLimitations;

  /// No description provided for @calcSources.
  ///
  /// In en, this message translates to:
  /// **'Sources'**
  String get calcSources;

  /// No description provided for @fieldCreatinine.
  ///
  /// In en, this message translates to:
  /// **'Serum creatinine'**
  String get fieldCreatinine;

  /// No description provided for @fieldAge.
  ///
  /// In en, this message translates to:
  /// **'Age, years'**
  String get fieldAge;

  /// No description provided for @fieldSex.
  ///
  /// In en, this message translates to:
  /// **'Sex'**
  String get fieldSex;

  /// No description provided for @fieldSodium.
  ///
  /// In en, this message translates to:
  /// **'Sodium (Na⁺)'**
  String get fieldSodium;

  /// No description provided for @fieldChloride.
  ///
  /// In en, this message translates to:
  /// **'Chloride (Cl⁻)'**
  String get fieldChloride;

  /// No description provided for @fieldBicarbonate.
  ///
  /// In en, this message translates to:
  /// **'Bicarbonate (HCO₃⁻)'**
  String get fieldBicarbonate;

  /// No description provided for @fieldPotassium.
  ///
  /// In en, this message translates to:
  /// **'Potassium (K⁺)'**
  String get fieldPotassium;

  /// No description provided for @fieldAlbumin.
  ///
  /// In en, this message translates to:
  /// **'Serum albumin'**
  String get fieldAlbumin;

  /// No description provided for @fieldNormalAlbumin.
  ///
  /// In en, this message translates to:
  /// **'Normal albumin used by your laboratory'**
  String get fieldNormalAlbumin;

  /// No description provided for @fieldCalcium.
  ///
  /// In en, this message translates to:
  /// **'Total serum calcium'**
  String get fieldCalcium;

  /// No description provided for @fieldTotalCholesterol.
  ///
  /// In en, this message translates to:
  /// **'Total cholesterol'**
  String get fieldTotalCholesterol;

  /// No description provided for @fieldHdl.
  ///
  /// In en, this message translates to:
  /// **'HDL cholesterol'**
  String get fieldHdl;

  /// No description provided for @fieldTriglycerides.
  ///
  /// In en, this message translates to:
  /// **'Triglycerides'**
  String get fieldTriglycerides;

  /// No description provided for @fieldGlucose.
  ///
  /// In en, this message translates to:
  /// **'Glucose'**
  String get fieldGlucose;

  /// No description provided for @fieldUrea.
  ///
  /// In en, this message translates to:
  /// **'Urea (or BUN)'**
  String get fieldUrea;

  /// No description provided for @fieldMeasuredOsmolality.
  ///
  /// In en, this message translates to:
  /// **'Measured osmolality'**
  String get fieldMeasuredOsmolality;

  /// No description provided for @fieldHba1c.
  ///
  /// In en, this message translates to:
  /// **'HbA1c'**
  String get fieldHba1c;

  /// No description provided for @fieldUrineAlbumin.
  ///
  /// In en, this message translates to:
  /// **'Urine albumin'**
  String get fieldUrineAlbumin;

  /// No description provided for @fieldUrineCreatinine.
  ///
  /// In en, this message translates to:
  /// **'Urine creatinine'**
  String get fieldUrineCreatinine;

  /// No description provided for @sexFemale.
  ///
  /// In en, this message translates to:
  /// **'Female'**
  String get sexFemale;

  /// No description provided for @sexMale.
  ///
  /// In en, this message translates to:
  /// **'Male'**
  String get sexMale;

  /// No description provided for @resGfrCategory.
  ///
  /// In en, this message translates to:
  /// **'KDIGO GFR category {code}'**
  String resGfrCategory(String code);

  /// No description provided for @resAlbCategory.
  ///
  /// In en, this message translates to:
  /// **'KDIGO albuminuria category {code}'**
  String resAlbCategory(String code);

  /// No description provided for @resCategoryBasisSi.
  ///
  /// In en, this message translates to:
  /// **'Determined on the mg/mmol cut-offs.'**
  String get resCategoryBasisSi;

  /// No description provided for @resCategoryBasisConv.
  ///
  /// In en, this message translates to:
  /// **'Determined on the mg/g cut-offs.'**
  String get resCategoryBasisConv;

  /// No description provided for @resAnionGap.
  ///
  /// In en, this message translates to:
  /// **'Anion gap'**
  String get resAnionGap;

  /// No description provided for @resAnionGapK.
  ///
  /// In en, this message translates to:
  /// **'With potassium'**
  String get resAnionGapK;

  /// No description provided for @resAnionGapAlb.
  ///
  /// In en, this message translates to:
  /// **'Albumin-corrected (Figge)'**
  String get resAnionGapAlb;

  /// No description provided for @resCorrectedCa.
  ///
  /// In en, this message translates to:
  /// **'Corrected calcium (Payne)'**
  String get resCorrectedCa;

  /// No description provided for @resNonHdl.
  ///
  /// In en, this message translates to:
  /// **'Non-HDL cholesterol'**
  String get resNonHdl;

  /// No description provided for @resLdlFriedewald.
  ///
  /// In en, this message translates to:
  /// **'LDL-C · Friedewald'**
  String get resLdlFriedewald;

  /// No description provided for @resLdlSampson.
  ///
  /// In en, this message translates to:
  /// **'LDL-C · Sampson'**
  String get resLdlSampson;

  /// No description provided for @resOsmCalc.
  ///
  /// In en, this message translates to:
  /// **'Calculated osmolality'**
  String get resOsmCalc;

  /// No description provided for @resOsmGap.
  ///
  /// In en, this message translates to:
  /// **'Osmolal gap'**
  String get resOsmGap;

  /// No description provided for @resEag.
  ///
  /// In en, this message translates to:
  /// **'Estimated average glucose (eAG)'**
  String get resEag;

  /// No description provided for @errCalcMissing.
  ///
  /// In en, this message translates to:
  /// **'Enter a number: {field}.'**
  String errCalcMissing(String field);

  /// No description provided for @errCalcImplausible.
  ///
  /// In en, this message translates to:
  /// **'{field}: outside the range this calculator accepts ({min}–{max}{unit}). Check the value and the unit.'**
  String errCalcImplausible(String field, String min, String max, String unit);

  /// No description provided for @errEgfrAge.
  ///
  /// In en, this message translates to:
  /// **'The CKD-EPI 2021 equation was developed in participants aged 18 or older; it is not calculated for children.'**
  String get errEgfrAge;

  /// No description provided for @errFriedewaldTg.
  ///
  /// In en, this message translates to:
  /// **'Not calculated: Friedewald is not reliable when triglycerides exceed {limit}.'**
  String errFriedewaldTg(String limit);

  /// No description provided for @errSampsonTg.
  ///
  /// In en, this message translates to:
  /// **'Not calculated: the Sampson equation was validated for triglycerides up to {limit}.'**
  String errSampsonTg(String limit);

  /// No description provided for @errEagRange.
  ///
  /// In en, this message translates to:
  /// **'eAG not shown: the ADAG data cover HbA1c {range}.'**
  String errEagRange(String range);

  /// No description provided for @errHdlGeTc.
  ///
  /// In en, this message translates to:
  /// **'HDL cholesterol can\'t be equal to or greater than total cholesterol.'**
  String get errHdlGeTc;

  /// No description provided for @errNotPositive.
  ///
  /// In en, this message translates to:
  /// **'Not calculated: the result is not positive — check the values.'**
  String get errNotPositive;

  /// No description provided for @errSexMissing.
  ///
  /// In en, this message translates to:
  /// **'Choose sex.'**
  String get errSexMissing;

  /// No description provided for @micTitle.
  ///
  /// In en, this message translates to:
  /// **'Microscopy atlas'**
  String get micTitle;

  /// No description provided for @micNotice.
  ///
  /// In en, this message translates to:
  /// **'Image slot. Authentic micrographs are added only after usage rights and labels are verified.'**
  String get micNotice;

  /// No description provided for @micRedCells.
  ///
  /// In en, this message translates to:
  /// **'Red blood cells'**
  String get micRedCells;

  /// No description provided for @micWhiteCells.
  ///
  /// In en, this message translates to:
  /// **'White blood cells'**
  String get micWhiteCells;

  /// No description provided for @micEpithelium.
  ///
  /// In en, this message translates to:
  /// **'Epithelial cells'**
  String get micEpithelium;

  /// No description provided for @micCasts.
  ///
  /// In en, this message translates to:
  /// **'Casts'**
  String get micCasts;

  /// No description provided for @micCrystals.
  ///
  /// In en, this message translates to:
  /// **'Crystals'**
  String get micCrystals;

  /// No description provided for @micItemSub.
  ///
  /// In en, this message translates to:
  /// **'Appearance · distinctions · limitations'**
  String get micItemSub;

  /// No description provided for @micImagePending.
  ///
  /// In en, this message translates to:
  /// **'Image pending rights check'**
  String get micImagePending;

  /// No description provided for @insTitle.
  ///
  /// In en, this message translates to:
  /// **'Instruments'**
  String get insTitle;

  /// No description provided for @insMindraySub.
  ///
  /// In en, this message translates to:
  /// **'Exact model required'**
  String get insMindraySub;

  /// No description provided for @insHumanSub.
  ///
  /// In en, this message translates to:
  /// **'Instrument and reagent documents are separate'**
  String get insHumanSub;

  /// No description provided for @insOther.
  ///
  /// In en, this message translates to:
  /// **'Other manufacturer'**
  String get insOther;

  /// No description provided for @insOtherSub.
  ///
  /// In en, this message translates to:
  /// **'Match by exact model and IFU'**
  String get insOtherSub;

  /// No description provided for @libTitle.
  ///
  /// In en, this message translates to:
  /// **'Library'**
  String get libTitle;

  /// No description provided for @libSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your knowledge in one place.'**
  String get libSubtitle;

  /// No description provided for @libBooks.
  ///
  /// In en, this message translates to:
  /// **'Books and guides'**
  String get libBooks;

  /// No description provided for @libBooksSub.
  ///
  /// In en, this message translates to:
  /// **'PDF · language · revision · size'**
  String get libBooksSub;

  /// No description provided for @libPacks.
  ///
  /// In en, this message translates to:
  /// **'Offline packs'**
  String get libPacks;

  /// No description provided for @libPacksSub.
  ///
  /// In en, this message translates to:
  /// **'Installed and upcoming packs'**
  String get libPacksSub;

  /// No description provided for @libSavedSub.
  ///
  /// In en, this message translates to:
  /// **'Bookmarked tests'**
  String get libSavedSub;

  /// No description provided for @libResearchSub.
  ///
  /// In en, this message translates to:
  /// **'Question, plan, real data and sources'**
  String get libResearchSub;

  /// No description provided for @libSources.
  ///
  /// In en, this message translates to:
  /// **'Sources and licences'**
  String get libSources;

  /// No description provided for @libSourcesSub.
  ///
  /// In en, this message translates to:
  /// **'Review and reuse conditions'**
  String get libSourcesSub;

  /// No description provided for @booksEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No books yet'**
  String get booksEmptyTitle;

  /// No description provided for @booksEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Books are added only with confirmed distribution rights. A PDF you add yourself stays for personal study and isn\'t shared.'**
  String get booksEmptyBody;

  /// No description provided for @packsInstalled.
  ///
  /// In en, this message translates to:
  /// **'Installed'**
  String get packsInstalled;

  /// No description provided for @packsCoreTitle.
  ///
  /// In en, this message translates to:
  /// **'Core content'**
  String get packsCoreTitle;

  /// No description provided for @packsVersion.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String packsVersion(String version);

  /// No description provided for @packsSize.
  ///
  /// In en, this message translates to:
  /// **'Size: {size}'**
  String packsSize(String size);

  /// No description provided for @packsLanguages.
  ///
  /// In en, this message translates to:
  /// **'Languages: {languages}'**
  String packsLanguages(String languages);

  /// No description provided for @packsLicence.
  ///
  /// In en, this message translates to:
  /// **'Licence: {licence}'**
  String packsLicence(String licence);

  /// No description provided for @packsVerified.
  ///
  /// In en, this message translates to:
  /// **'Integrity verified (SHA-256)'**
  String get packsVerified;

  /// No description provided for @packsUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming packs'**
  String get packsUpcoming;

  /// No description provided for @packsUpcomingBody.
  ///
  /// In en, this message translates to:
  /// **'The size is shown before any download. Packs are published only after content review.'**
  String get packsUpcomingBody;

  /// No description provided for @packsBiochem.
  ///
  /// In en, this message translates to:
  /// **'Biochemistry essentials'**
  String get packsBiochem;

  /// No description provided for @packsSpecimensQc.
  ///
  /// In en, this message translates to:
  /// **'Specimens and QC'**
  String get packsSpecimensQc;

  /// No description provided for @packsMicroscopy.
  ///
  /// In en, this message translates to:
  /// **'Microscopy atlas'**
  String get packsMicroscopy;

  /// No description provided for @packsNotPublished.
  ///
  /// In en, this message translates to:
  /// **'Not published yet'**
  String get packsNotPublished;

  /// No description provided for @savedEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No bookmarks yet'**
  String get savedEmptyTitle;

  /// No description provided for @savedEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Select Save on a test card to keep it here.'**
  String get savedEmptyBody;

  /// No description provided for @sourcesTitle.
  ///
  /// In en, this message translates to:
  /// **'Sources and licences'**
  String get sourcesTitle;

  /// No description provided for @sourcesContent.
  ///
  /// In en, this message translates to:
  /// **'Analyte cards'**
  String get sourcesContent;

  /// No description provided for @sourcesMethods.
  ///
  /// In en, this message translates to:
  /// **'Calculators, QC and preanalytics'**
  String get sourcesMethods;

  /// No description provided for @sourcesBody.
  ///
  /// In en, this message translates to:
  /// **'Every published claim links to its original source, access date, scope and review status.'**
  String get sourcesBody;

  /// No description provided for @researchTitle.
  ///
  /// In en, this message translates to:
  /// **'Research workspace'**
  String get researchTitle;

  /// No description provided for @researchQuestion.
  ///
  /// In en, this message translates to:
  /// **'Topic or research question'**
  String get researchQuestion;

  /// No description provided for @researchQuestionHint.
  ///
  /// In en, this message translates to:
  /// **'Enter a topic'**
  String get researchQuestionHint;

  /// No description provided for @researchNotes.
  ///
  /// In en, this message translates to:
  /// **'Aim and notes'**
  String get researchNotes;

  /// No description provided for @researchNotesHint.
  ///
  /// In en, this message translates to:
  /// **'Your own data and sources'**
  String get researchNotesHint;

  /// No description provided for @researchSave.
  ///
  /// In en, this message translates to:
  /// **'Save draft'**
  String get researchSave;

  /// No description provided for @researchSaved.
  ///
  /// In en, this message translates to:
  /// **'Draft saved on this device'**
  String get researchSaved;

  /// No description provided for @researchOutline.
  ///
  /// In en, this message translates to:
  /// **'Outline structure'**
  String get researchOutline;

  /// No description provided for @researchStep1.
  ///
  /// In en, this message translates to:
  /// **'Question and aim'**
  String get researchStep1;

  /// No description provided for @researchStep2.
  ///
  /// In en, this message translates to:
  /// **'Literature review'**
  String get researchStep2;

  /// No description provided for @researchStep3.
  ///
  /// In en, this message translates to:
  /// **'Methods and real data'**
  String get researchStep3;

  /// No description provided for @researchStep4.
  ///
  /// In en, this message translates to:
  /// **'Results, limitations and conclusions'**
  String get researchStep4;

  /// No description provided for @researchNoFabrication.
  ///
  /// In en, this message translates to:
  /// **'LabGuide never generates results, patient data or citations. Use only your own data and sources.'**
  String get researchNoFabrication;

  /// No description provided for @learnTitle.
  ///
  /// In en, this message translates to:
  /// **'Learn with understanding'**
  String get learnTitle;

  /// No description provided for @learnHeroTag.
  ///
  /// In en, this message translates to:
  /// **'Visual biochemistry'**
  String get learnHeroTag;

  /// No description provided for @learnHeroTitle.
  ///
  /// In en, this message translates to:
  /// **'From molecule to practice'**
  String get learnHeroTitle;

  /// No description provided for @learnHeroBody.
  ///
  /// In en, this message translates to:
  /// **'Topics, mechanisms and knowledge checks.'**
  String get learnHeroBody;

  /// No description provided for @learnHeroCta.
  ///
  /// In en, this message translates to:
  /// **'Explore topics'**
  String get learnHeroCta;

  /// No description provided for @learnClassesSub.
  ///
  /// In en, this message translates to:
  /// **'Teacher → assignment → student → results'**
  String get learnClassesSub;

  /// No description provided for @learnQuiz.
  ///
  /// In en, this message translates to:
  /// **'Explained quiz'**
  String get learnQuiz;

  /// No description provided for @learnQuizSub.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{{count} practice question} other{{count} practice questions}}'**
  String learnQuizSub(int count);

  /// No description provided for @learnExam.
  ///
  /// In en, this message translates to:
  /// **'Exam mode'**
  String get learnExam;

  /// No description provided for @learnExamSub.
  ///
  /// In en, this message translates to:
  /// **'Time, topic and questions'**
  String get learnExamSub;

  /// No description provided for @learnLessonPlan.
  ///
  /// In en, this message translates to:
  /// **'Lesson plan'**
  String get learnLessonPlan;

  /// No description provided for @learnLessonPlanSub.
  ///
  /// In en, this message translates to:
  /// **'Teacher workspace'**
  String get learnLessonPlanSub;

  /// No description provided for @quizProgress.
  ///
  /// In en, this message translates to:
  /// **'Question {current} of {total}'**
  String quizProgress(int current, int total);

  /// No description provided for @quizCorrect.
  ///
  /// In en, this message translates to:
  /// **'Correct.'**
  String get quizCorrect;

  /// No description provided for @quizIncorrect.
  ///
  /// In en, this message translates to:
  /// **'This answer is incorrect.'**
  String get quizIncorrect;

  /// No description provided for @quizNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get quizNext;

  /// No description provided for @quizFinish.
  ///
  /// In en, this message translates to:
  /// **'See result'**
  String get quizFinish;

  /// No description provided for @quizDoneTitle.
  ///
  /// In en, this message translates to:
  /// **'Practice complete'**
  String get quizDoneTitle;

  /// No description provided for @quizScore.
  ///
  /// In en, this message translates to:
  /// **'{correct} of {total} correct'**
  String quizScore(int correct, int total);

  /// No description provided for @quizRestart.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get quizRestart;

  /// No description provided for @quizBasis.
  ///
  /// In en, this message translates to:
  /// **'Basis: {basis}'**
  String quizBasis(String basis);

  /// No description provided for @quizReviewNote.
  ///
  /// In en, this message translates to:
  /// **'Practice questions are pending expert review.'**
  String get quizReviewNote;

  /// No description provided for @quizMistakes.
  ///
  /// In en, this message translates to:
  /// **'Review your mistakes'**
  String get quizMistakes;

  /// No description provided for @quizNoMistakes.
  ///
  /// In en, this message translates to:
  /// **'No mistakes — well done.'**
  String get quizNoMistakes;

  /// No description provided for @quizYourAnswer.
  ///
  /// In en, this message translates to:
  /// **'Your answer'**
  String get quizYourAnswer;

  /// No description provided for @quizCorrectAnswer.
  ///
  /// In en, this message translates to:
  /// **'Correct answer'**
  String get quizCorrectAnswer;

  /// No description provided for @quizChooseTopic.
  ///
  /// In en, this message translates to:
  /// **'Choose a topic'**
  String get quizChooseTopic;

  /// No description provided for @quizTopicMixed.
  ///
  /// In en, this message translates to:
  /// **'Mixed: {count} random questions'**
  String quizTopicMixed(int count);

  /// No description provided for @quizTopicGeneral.
  ///
  /// In en, this message translates to:
  /// **'Laboratory calculations'**
  String get quizTopicGeneral;

  /// No description provided for @quizQuestionCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 question} other{{count} questions}}'**
  String quizQuestionCount(int count);

  /// No description provided for @quizOtherTopic.
  ///
  /// In en, this message translates to:
  /// **'Another topic'**
  String get quizOtherTopic;

  /// No description provided for @quizTopicMistakes.
  ///
  /// In en, this message translates to:
  /// **'Review my mistakes'**
  String get quizTopicMistakes;

  /// No description provided for @quizMastered.
  ///
  /// In en, this message translates to:
  /// **'{correct} of {total} correct last time'**
  String quizMastered(int correct, int total);

  /// No description provided for @examTitle.
  ///
  /// In en, this message translates to:
  /// **'Exam mode'**
  String get examTitle;

  /// No description provided for @examBody.
  ///
  /// In en, this message translates to:
  /// **'Timed exams and result history come with the learning module. The practice questions are available now.'**
  String get examBody;

  /// No description provided for @examOpenPractice.
  ///
  /// In en, this message translates to:
  /// **'Open practice questions'**
  String get examOpenPractice;

  /// No description provided for @classesTitle.
  ///
  /// In en, this message translates to:
  /// **'Classes and assignments'**
  String get classesTitle;

  /// No description provided for @classesSignInTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to use classes'**
  String get classesSignInTitle;

  /// No description provided for @classesSignInBody.
  ///
  /// In en, this message translates to:
  /// **'Creating, joining and submitting assignments is tied to an account. Reading content stays open without sign-in.'**
  String get classesSignInBody;

  /// No description provided for @classesSignIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get classesSignIn;

  /// No description provided for @classesUnavailableTitle.
  ///
  /// In en, this message translates to:
  /// **'The class server isn\'t connected yet'**
  String get classesUnavailableTitle;

  /// No description provided for @classesUnavailableBody.
  ///
  /// In en, this message translates to:
  /// **'Nothing is sent or stored. When it\'s connected, teachers see only their own classes and students see only their own results — checked on the server.'**
  String get classesUnavailableBody;

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'Profile and settings'**
  String get profileTitle;

  /// No description provided for @profileGuest.
  ///
  /// In en, this message translates to:
  /// **'Guest'**
  String get profileGuest;

  /// No description provided for @profileGuestSub.
  ///
  /// In en, this message translates to:
  /// **'Content is open without an account'**
  String get profileGuestSub;

  /// No description provided for @profileDemoSession.
  ///
  /// In en, this message translates to:
  /// **'Demo session · debug build'**
  String get profileDemoSession;

  /// No description provided for @profileRole.
  ///
  /// In en, this message translates to:
  /// **'Role'**
  String get profileRole;

  /// No description provided for @profileRoleSub.
  ///
  /// In en, this message translates to:
  /// **'Home adapts to your role'**
  String get profileRoleSub;

  /// No description provided for @profileLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get profileLanguage;

  /// No description provided for @profileAppearance.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get profileAppearance;

  /// No description provided for @themeSystem.
  ///
  /// In en, this message translates to:
  /// **'System'**
  String get themeSystem;

  /// No description provided for @themeLight.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get themeLight;

  /// No description provided for @themeDark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get themeDark;

  /// No description provided for @profilePurchase.
  ///
  /// In en, this message translates to:
  /// **'Subscription and restore'**
  String get profilePurchase;

  /// No description provided for @profilePurchaseSub.
  ///
  /// In en, this message translates to:
  /// **'Free · Pro'**
  String get profilePurchaseSub;

  /// No description provided for @profilePrivacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy and help'**
  String get profilePrivacy;

  /// No description provided for @profilePrivacySub.
  ///
  /// In en, this message translates to:
  /// **'Data and account controls'**
  String get profilePrivacySub;

  /// No description provided for @profileSignIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in with email'**
  String get profileSignIn;

  /// No description provided for @profileSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get profileSignOut;

  /// No description provided for @profileVersion.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String profileVersion(String version);

  /// No description provided for @purchaseTitle.
  ///
  /// In en, this message translates to:
  /// **'LabGuide Pro'**
  String get purchaseTitle;

  /// No description provided for @purchaseFree.
  ///
  /// In en, this message translates to:
  /// **'Free: demo and basic cards.'**
  String get purchaseFree;

  /// No description provided for @purchasePro.
  ///
  /// In en, this message translates to:
  /// **'Pro, monthly or yearly: complete published packs, extended learning and laboratory tools.'**
  String get purchasePro;

  /// No description provided for @purchaseNotice.
  ///
  /// In en, this message translates to:
  /// **'Store products aren\'t connected. Prices will come from the App Store / Google Play in your currency. Nothing is charged here, and features that aren\'t built yet are not sold.'**
  String get purchaseNotice;

  /// No description provided for @purchaseSubscribe.
  ///
  /// In en, this message translates to:
  /// **'Subscribe'**
  String get purchaseSubscribe;

  /// No description provided for @purchaseRestore.
  ///
  /// In en, this message translates to:
  /// **'Restore purchases'**
  String get purchaseRestore;

  /// No description provided for @privacyTitle.
  ///
  /// In en, this message translates to:
  /// **'Privacy and help'**
  String get privacyTitle;

  /// No description provided for @privacyBody.
  ///
  /// In en, this message translates to:
  /// **'This build sends no data to a server. Settings, bookmarks and drafts are stored only on this device.'**
  String get privacyBody;

  /// No description provided for @privacyTerms.
  ///
  /// In en, this message translates to:
  /// **'Terms of use'**
  String get privacyTerms;

  /// No description provided for @privacyTermsSub.
  ///
  /// In en, this message translates to:
  /// **'Final text to be prepared'**
  String get privacyTermsSub;

  /// No description provided for @privacyDeleteLocal.
  ///
  /// In en, this message translates to:
  /// **'Delete local data'**
  String get privacyDeleteLocal;

  /// No description provided for @privacyDeleteLocalSub.
  ///
  /// In en, this message translates to:
  /// **'Settings, bookmarks and drafts on this device'**
  String get privacyDeleteLocalSub;

  /// No description provided for @privacyDeleteConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete local data?'**
  String get privacyDeleteConfirmTitle;

  /// No description provided for @privacyDeleteConfirmBody.
  ///
  /// In en, this message translates to:
  /// **'Settings, bookmarks and drafts on this device will be removed. This can\'t be undone.'**
  String get privacyDeleteConfirmBody;

  /// No description provided for @privacyDeleted.
  ///
  /// In en, this message translates to:
  /// **'Local data deleted'**
  String get privacyDeleted;

  /// No description provided for @termsTitle.
  ///
  /// In en, this message translates to:
  /// **'Terms of use'**
  String get termsTitle;

  /// No description provided for @termsBody.
  ///
  /// In en, this message translates to:
  /// **'Final terms, the privacy policy and clinical-use boundaries will be prepared before release. LabGuide is a reference and learning tool: it doesn\'t diagnose, prescribe or replace your laboratory\'s procedures.'**
  String get termsBody;

  /// No description provided for @citePage.
  ///
  /// In en, this message translates to:
  /// **'p. {page}'**
  String citePage(String page);

  /// No description provided for @rightsUnknown.
  ///
  /// In en, this message translates to:
  /// **'Distribution rights not confirmed'**
  String get rightsUnknown;

  /// No description provided for @rightsPersonal.
  ///
  /// In en, this message translates to:
  /// **'Personal study only — not distributed'**
  String get rightsPersonal;

  /// No description provided for @rightsPermitted.
  ///
  /// In en, this message translates to:
  /// **'Distribution permission recorded'**
  String get rightsPermitted;

  /// No description provided for @rightsDenied.
  ///
  /// In en, this message translates to:
  /// **'Distribution not permitted'**
  String get rightsDenied;

  /// No description provided for @catBiochemistry.
  ///
  /// In en, this message translates to:
  /// **'Biochemistry'**
  String get catBiochemistry;

  /// No description provided for @catClinicalLab.
  ///
  /// In en, this message translates to:
  /// **'Clinical laboratory'**
  String get catClinicalLab;

  /// No description provided for @catInstruments.
  ///
  /// In en, this message translates to:
  /// **'Instruments'**
  String get catInstruments;

  /// No description provided for @catMethods.
  ///
  /// In en, this message translates to:
  /// **'Methods'**
  String get catMethods;

  /// No description provided for @catTests.
  ///
  /// In en, this message translates to:
  /// **'Test questions'**
  String get catTests;

  /// No description provided for @kindBook.
  ///
  /// In en, this message translates to:
  /// **'Book'**
  String get kindBook;

  /// No description provided for @kindManual.
  ///
  /// In en, this message translates to:
  /// **'Manual'**
  String get kindManual;

  /// No description provided for @kindMethod.
  ///
  /// In en, this message translates to:
  /// **'Method'**
  String get kindMethod;

  /// No description provided for @kindIfu.
  ///
  /// In en, this message translates to:
  /// **'IFU'**
  String get kindIfu;

  /// No description provided for @kindArticle.
  ///
  /// In en, this message translates to:
  /// **'Article'**
  String get kindArticle;

  /// No description provided for @kindQuestionSet.
  ///
  /// In en, this message translates to:
  /// **'Question set'**
  String get kindQuestionSet;

  /// No description provided for @kindWebsite.
  ///
  /// In en, this message translates to:
  /// **'Website'**
  String get kindWebsite;

  /// No description provided for @libAccessOpen.
  ///
  /// In en, this message translates to:
  /// **'Open licence · {licence}'**
  String libAccessOpen(String licence);

  /// No description provided for @libAccessFree.
  ///
  /// In en, this message translates to:
  /// **'Free to read · link only'**
  String get libAccessFree;

  /// No description provided for @libAccessCatalog.
  ///
  /// In en, this message translates to:
  /// **'Catalogue record only'**
  String get libAccessCatalog;

  /// No description provided for @libOpenSource.
  ///
  /// In en, this message translates to:
  /// **'Open the official page'**
  String get libOpenSource;

  /// No description provided for @libChecked.
  ///
  /// In en, this message translates to:
  /// **'Page and licence checked: {date}'**
  String libChecked(String date);

  /// No description provided for @libItemPack.
  ///
  /// In en, this message translates to:
  /// **'Offline pack · {size}'**
  String libItemPack(String size);

  /// No description provided for @libItemNoPack.
  ///
  /// In en, this message translates to:
  /// **'Not available as a shared offline pack'**
  String get libItemNoPack;

  /// No description provided for @libItemSupersedes.
  ///
  /// In en, this message translates to:
  /// **'Newer edition of: {title}'**
  String libItemSupersedes(String title);

  /// No description provided for @libReview.
  ///
  /// In en, this message translates to:
  /// **'Review queue'**
  String get libReview;

  /// No description provided for @libReviewSub.
  ///
  /// In en, this message translates to:
  /// **'Source discrepancies and drafts'**
  String get libReviewSub;

  /// No description provided for @reviewDiscrepancies.
  ///
  /// In en, this message translates to:
  /// **'Source discrepancies'**
  String get reviewDiscrepancies;

  /// No description provided for @reviewDiscrepanciesBody.
  ///
  /// In en, this message translates to:
  /// **'When older and newer sources disagree, both positions are listed here for expert review. Neither is published as fact until resolved.'**
  String get reviewDiscrepanciesBody;

  /// No description provided for @reviewNoDiscrepancies.
  ///
  /// In en, this message translates to:
  /// **'No open discrepancies.'**
  String get reviewNoDiscrepancies;

  /// No description provided for @reviewDraftQuestions.
  ///
  /// In en, this message translates to:
  /// **'Draft questions: {count}'**
  String reviewDraftQuestions(int count);

  /// No description provided for @reviewDraftCards.
  ///
  /// In en, this message translates to:
  /// **'Cards awaiting expert review: {count}'**
  String reviewDraftCards(int count);

  /// No description provided for @reviewCatalog.
  ///
  /// In en, this message translates to:
  /// **'Catalogued materials: {count}'**
  String reviewCatalog(int count);

  /// No description provided for @reviewField.
  ///
  /// In en, this message translates to:
  /// **'Field: {field}'**
  String reviewField(String field);

  /// No description provided for @quizDraftTag.
  ///
  /// In en, this message translates to:
  /// **'Draft · not reviewed'**
  String get quizDraftTag;

  /// No description provided for @lessonsTitle.
  ///
  /// In en, this message translates to:
  /// **'Lesson topics'**
  String get lessonsTitle;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ru', 'uz'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ru':
      return AppLocalizationsRu();
    case 'uz':
      return AppLocalizationsUz();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
