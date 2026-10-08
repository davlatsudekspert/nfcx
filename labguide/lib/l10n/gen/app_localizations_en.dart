// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTagline => 'BIOCHEMISTRY · LABORATORY';

  @override
  String get navHome => 'Home';

  @override
  String get navTests => 'Tests';

  @override
  String get navLab => 'Lab';

  @override
  String get navLibrary => 'Library';

  @override
  String get navLearn => 'Learn';

  @override
  String get actionBack => 'Back';

  @override
  String get actionProfile => 'Profile and settings';

  @override
  String get actionLanguage => 'Language';

  @override
  String get actionOpen => 'Explore';

  @override
  String get actionRetry => 'Try again';

  @override
  String get actionContinue => 'Continue';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionDelete => 'Delete';

  @override
  String get actionCopyLink => 'Copy link';

  @override
  String get linkCopied => 'Link copied';

  @override
  String plannedStage(String stage) {
    return 'Planned for stage $stage';
  }

  @override
  String get notAvailableYet => 'Not available yet';

  @override
  String get debugBuildBadge => 'DEBUG · DEMO ADAPTERS';

  @override
  String get welcomeEyebrow => 'Your laboratory companion';

  @override
  String get welcomeTitle => 'Biochemistry.\nClear and practical.';

  @override
  String get welcomeSubtitle =>
      'Tests, laboratory practice and learning in one place.';

  @override
  String get welcomeDevices => 'Phone and tablet';

  @override
  String get welcomeRoles => 'Physician · lab professional · student · teacher';

  @override
  String get welcomeGetStarted => 'Get started / sign up';

  @override
  String get welcomeGuest => 'Explore as guest';

  @override
  String get welcomeSignIn => 'Sign in';

  @override
  String get welcomeGuestNote =>
      'No account is needed to read content. Sign-in is used for sync, classes and purchases.';

  @override
  String get authTitle => 'Welcome';

  @override
  String get authSubtitle => 'Sign in or create an account with email.';

  @override
  String get authEmailLabel => 'Email';

  @override
  String get authEmailHint => 'name@example.com';

  @override
  String get authEmailInvalid => 'Enter a valid email address.';

  @override
  String get authConsent => 'I accept the terms of use and privacy policy.';

  @override
  String get authConsentRequired => 'Accept the terms to continue.';

  @override
  String get authGetCode => 'Get code';

  @override
  String get authViewTerms => 'View terms';

  @override
  String get authDemoNotice =>
      'Debug build: demo sign-in. No email is sent; the code is shown on the next screen.';

  @override
  String get authUnavailableTitle => 'Email sign-in isn\'t connected yet';

  @override
  String get authUnavailableBody =>
      'All reading content is available to guests. Sign-in will be enabled once the email service is configured.';

  @override
  String get authContinueGuest => 'Continue as guest';

  @override
  String authRateLimited(int seconds) {
    return 'Too many requests. Try again in $seconds s.';
  }

  @override
  String get authGenericError =>
      'Something went wrong. Check the connection and try again.';

  @override
  String get otpTitle => 'Verify your email';

  @override
  String get otpCodeLabel => '6-digit code';

  @override
  String get otpVerify => 'Verify';

  @override
  String otpDemoCode(String code) {
    return 'Demo code: $code. No email was sent (debug build only).';
  }

  @override
  String otpInvalid(int attempts) {
    return 'Incorrect code. Attempts left: $attempts.';
  }

  @override
  String get otpExpired => 'The code has expired. Request a new one.';

  @override
  String get otpTooManyAttempts => 'Too many attempts. Request a new code.';

  @override
  String get otpNoActiveCode => 'No active code. Request a new one.';

  @override
  String get otpFormat => 'Enter the 6-digit code.';

  @override
  String get otpResend => 'Resend code';

  @override
  String otpResendIn(int seconds) {
    return 'Resend in $seconds s';
  }

  @override
  String otpValidFor(int minutes) {
    return 'The code is valid for $minutes min.';
  }

  @override
  String get otpResent => 'A new code was issued.';

  @override
  String get rolesTitle => 'Your workspace';

  @override
  String get rolesSubtitle => 'Choose your main role. You can change it later.';

  @override
  String get rolesNote =>
      'The role only adapts the home screen. It doesn\'t grant access to other people\'s classes or data.';

  @override
  String get roleDoctor => 'Physician';

  @override
  String get roleDoctorDesc => 'Results and clinical context';

  @override
  String get roleLab => 'Laboratory professional';

  @override
  String get roleLabDesc => 'Methods, instruments and QC';

  @override
  String get roleStudent => 'Student';

  @override
  String get roleStudentDesc => 'Learn, practice and prepare';

  @override
  String get roleTeacher => 'Teacher / researcher';

  @override
  String get roleTeacherDesc => 'Classes, assignments and research';

  @override
  String get homeTitle => 'Knowledge. Precision. Practice.';

  @override
  String get homeFocusTag => 'Your focus';

  @override
  String get homeHeroDoctorTitle => 'Understand the result in context';

  @override
  String get homeHeroDoctorBody =>
      'Tests, influencing factors and related investigations.';

  @override
  String get homeHeroDoctorCta => 'Explore tests';

  @override
  String get homeHeroLabTitle => 'Confidence at the bench';

  @override
  String get homeHeroLabBody =>
      'Samples, methods and quality control in one place.';

  @override
  String get homeHeroLabCta => 'Open quality control';

  @override
  String get homeHeroStudentTitle => 'Learn biochemistry with understanding';

  @override
  String get homeHeroStudentBody => 'Topic → explanation → practice → review.';

  @override
  String get homeHeroStudentCta => 'Start learning';

  @override
  String get homeHeroTeacherTitle => 'Turn knowledge into teaching';

  @override
  String get homeHeroTeacherBody =>
      'Classes, explained questions and assignments with deadlines.';

  @override
  String get homeHeroTeacherCta => 'Open classes';

  @override
  String get homeQuickAccess => 'Quick access';

  @override
  String get homeUsefulTests => 'Useful tests';

  @override
  String get featureTests => 'Tests';

  @override
  String get featureCalculators => 'Calculators';

  @override
  String get featureSampleFactors => 'Sample factors';

  @override
  String get featureSaved => 'Saved';

  @override
  String get featureCalibration => 'Calibration';

  @override
  String get featureQc => 'QC';

  @override
  String get featureSampling => 'Sampling';

  @override
  String get featureTopics => 'Topics';

  @override
  String get featureQuiz => 'Quiz';

  @override
  String get featureMicroscopy => 'Microscopy';

  @override
  String get featureExam => 'Exam';

  @override
  String get featureClasses => 'Classes';

  @override
  String get featureQuestionBank => 'Questions';

  @override
  String get featureSources => 'Sources';

  @override
  String get featureResearch => 'Research';

  @override
  String get testsTitle => 'Test atlas';

  @override
  String get testsSubtitle => 'From a marker to practical knowledge.';

  @override
  String get testsSearchLabel => 'Search tests';

  @override
  String get testsSearchHint => 'ALT, creatinine, HbA1c…';

  @override
  String get testsFilterAll => 'All';

  @override
  String get testsEmptyTitle => 'No results';

  @override
  String get testsEmptyBody => 'Try another name, abbreviation or synonym.';

  @override
  String get testsClearSearch => 'Clear search';

  @override
  String testsResultCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count tests',
      one: '$count test',
    );
    return '$_temp0';
  }

  @override
  String get statusDraft => 'Draft';

  @override
  String get statusVerified => 'Verified';

  @override
  String get statusPublished => 'Published';

  @override
  String get statusSourcedSample => 'Sourced sample';

  @override
  String get statusStructureOnly => 'Structure only';

  @override
  String get contentLoading => 'Loading content…';

  @override
  String get contentErrorTitle => 'Content couldn\'t be loaded';

  @override
  String get contentErrorBody =>
      'The content pack failed verification. Unverified data is never shown.';

  @override
  String get analyteSave => 'Save';

  @override
  String get analyteSaved => 'Saved';

  @override
  String get analyteSavedToast => 'Added to saved';

  @override
  String get analyteRemovedToast => 'Removed from saved';

  @override
  String get analyteNotFound => 'This test card wasn\'t found.';

  @override
  String get analyteStructureOnlyTitle => 'Content in preparation';

  @override
  String get analyteStructureOnlyBody =>
      'This card shows the structure only. Clinical text is added after sourcing and independent expert review — generic text is never shown as ready.';

  @override
  String get analyteSampleNotice =>
      'Learning sample based on the cited sources. Independent expert review is pending — not for clinical decisions.';

  @override
  String get analyteNotWritten =>
      'Not written yet: requires sources and review.';

  @override
  String get analyteAtAGlance => 'At a glance';

  @override
  String get analyteSpecimen => 'Specimen';

  @override
  String get analytePopulation => 'Population';

  @override
  String get analyteMethod => 'Method';

  @override
  String get analyteMethodNotSet =>
      'Not specified — depends on the reagent IFU';

  @override
  String get analyteUnits => 'Units';

  @override
  String get analyteRefIntervals => 'Reference intervals';

  @override
  String get analyteRefIntervalNone =>
      'No reference interval is given here. Use the interval on your laboratory\'s report: it depends on the method, specimen and population.';

  @override
  String get analyteDecisionLimits => 'Diagnostic thresholds';

  @override
  String get analyteDecisionNotRef =>
      'Diagnostic thresholds are not laboratory reference intervals.';

  @override
  String get analyteNoInterpretation =>
      'LabGuide doesn\'t interpret individual results or suggest diagnoses or doses.';

  @override
  String get analyteSources => 'Sources';

  @override
  String analyteSourceAccessed(String date) {
    return 'Accessed $date';
  }

  @override
  String get analyteReuseRightsVerify =>
      'Reuse rights: verify before distribution';

  @override
  String get analyteReview => 'Review status';

  @override
  String get analyteReviewPending => 'Expert review pending';

  @override
  String get analyteReviewApproved => 'Reviewed';

  @override
  String get analyteReviewerNotAssigned => 'Reviewer not assigned';

  @override
  String get analyteTranslationPending => 'Translation review pending';

  @override
  String analyteContentVersion(String version) {
    return 'Content version $version';
  }

  @override
  String get analyteConvertUnits => 'Convert units';

  @override
  String get analyteConvertUnitsSub => 'Analyte-specific factor';

  @override
  String get analyteMethodCalibration => 'Method and calibration';

  @override
  String get analyteMethodCalibrationSub => 'IFU · QC';

  @override
  String get analyteCalculatorSub => 'Calculator · published formula';

  @override
  String get analytePractice => 'Practice the topic';

  @override
  String get analytePracticeSub => 'Explained questions';

  @override
  String get analyteRelated => 'Related tests';

  @override
  String get sectionPurpose => 'Purpose';

  @override
  String get sectionPhysiology => 'Physiology';

  @override
  String get sectionHighResult => 'High result';

  @override
  String get sectionLowResult => 'Low result';

  @override
  String get sectionPreanalytics => 'Specimen and preanalytics';

  @override
  String get sectionInterference => 'Interference';

  @override
  String get sectionLimitations => 'Limitations';

  @override
  String get labTitle => 'Laboratory';

  @override
  String get labSubtitle => 'A clear path at every stage.';

  @override
  String get labHeroEyebrow => 'At the bench';

  @override
  String get labHeroTitle => 'Instrument → reagent → method';

  @override
  String get labHeroBody =>
      'Instructions and controls matched to the exact model.';

  @override
  String get labHeroCta => 'Open calibration';

  @override
  String get labQcSub => 'Control charts and rules';

  @override
  String get labPreanalytics => 'Preanalytics';

  @override
  String get labPreanalyticsSub => 'Prepare, collect, store, transport';

  @override
  String get labCalculatorsSub => 'Dilution and units';

  @override
  String get labInstruments => 'Instruments and methods';

  @override
  String get labInstrumentsSub => 'Mindray · HUMAN · other';

  @override
  String get labMicroscopySub => 'Compare images and structures';

  @override
  String get calTitle => 'Calibration workflow';

  @override
  String get calSubtitle =>
      'Exact matching is needed to select the correct instructions.';

  @override
  String get calManufacturer => 'Manufacturer';

  @override
  String get calManufacturerOther => 'Other';

  @override
  String get calModel => 'Instrument model';

  @override
  String get calModelHint => 'Exact model name';

  @override
  String get calReagentRef => 'Reagent REF';

  @override
  String get calIfuRevision => 'IFU revision';

  @override
  String get calCalibratorLot => 'Calibrator lot';

  @override
  String get calCheck => 'Check match';

  @override
  String get calFieldsRequired =>
      'Fill in the model, reagent REF and IFU revision.';

  @override
  String get calNoMatchTitle => 'No verified instructions for this combination';

  @override
  String get calNoMatchBody =>
      'Calibration parameters are shown only from a verified IFU that matches the manufacturer, model, reagent REF, IFU revision and calibrator lot. Use the manufacturer\'s current IFU.';

  @override
  String calCatalogCount(int count) {
    return 'Verified IFU records in this build: $count';
  }

  @override
  String get calBrandWarning =>
      'A brand name (e.g. Mindray or HUMAN) doesn\'t mean all models share settings. The reagent IFU and the instrument manual are separate documents.';

  @override
  String get calWorkflow => 'Workflow';

  @override
  String get calStep1 => 'Model, reagent and instruction revision';

  @override
  String get calStep2 => 'Calibrator lot and assigned values';

  @override
  String get calStep3 => 'Method-specific preparation';

  @override
  String get calStep4 => 'Calibration according to the instructions';

  @override
  String get calStep5 => 'Post-calibration QC';

  @override
  String get calStep6 => 'Records and troubleshooting';

  @override
  String get calNoServiceCodes =>
      'Service codes and safety-bypass procedures are not included.';

  @override
  String get qcTitle => 'Quality control';

  @override
  String get qcChartTitle => 'Levey–Jennings';

  @override
  String get qcChartBody =>
      'A chart needs the test, control lot, level, target mean and SD. No invented results are plotted.';

  @override
  String get qcEmptyTitle => 'No control records yet';

  @override
  String get qcEmptyBody =>
      'Add a test with its control levels to start a Levey–Jennings chart. Data is stored only on this device.';

  @override
  String get qcIntro =>
      'Enter each control level’s target mean and SD, then record every run. The app checks Westgard rules; it never invents target values or results.';

  @override
  String get qcLoadError =>
      'Saved QC data could not be read. Nothing was overwritten.';

  @override
  String get qcAddSet => 'Add test';

  @override
  String get qcSetName => 'Test name';

  @override
  String get qcUnit => 'Unit';

  @override
  String get qcTargetSource => 'Source of the target mean and SD';

  @override
  String get qcSourceLab => 'Our laboratory’s data';

  @override
  String get qcSourceManufacturer => 'Manufacturer’s sheet';

  @override
  String qcLevel(String label) {
    return 'Level $label';
  }

  @override
  String qcLevelsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count levels',
      one: '1 level',
    );
    return '$_temp0';
  }

  @override
  String qcRunsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count runs',
      one: '1 run',
      zero: 'no runs',
    );
    return '$_temp0';
  }

  @override
  String get qcLot => 'Lot';

  @override
  String get qcMean => 'Target mean';

  @override
  String get qcSd => 'Target SD';

  @override
  String get qcAddLevel => 'Add level';

  @override
  String get qcRemoveLevel => 'Remove level';

  @override
  String get qcSave => 'Save';

  @override
  String get qcTargetNote =>
      'Westgard et al. (1981) calculate the mean and SD from the laboratory’s own control measurements — initially about 20 (one run a day), then revised as more data accumulate. The app does not supply these values.';

  @override
  String get qcManufacturerWarning =>
      'Manufacturer’s values are a guide only; Westgard’s lessons recommend limits calculated from your own control data — the assay sheet’s ranges are often too wide.';

  @override
  String get qcErrName => 'Enter the test name.';

  @override
  String qcErrLevel(String label) {
    return 'Level $label: enter the mean and an SD greater than zero.';
  }

  @override
  String get qcAccept => 'Accepted';

  @override
  String get qcWarning => 'Warning';

  @override
  String get qcReject => 'Rejected';

  @override
  String get qcAcceptBody => 'No rule violated.';

  @override
  String get qcLatestRun => 'Latest run';

  @override
  String get qcNoRunsYet => 'No runs yet — add the first one below.';

  @override
  String get qcAddRun => 'Add run';

  @override
  String get qcNote => 'Note (optional)';

  @override
  String get qcSaveRun => 'Save run';

  @override
  String get qcErrRunEmpty => 'Enter at least one control value.';

  @override
  String qcErrRunInvalid(String label) {
    return 'Level $label: not a number.';
  }

  @override
  String get qcRunHistory => 'Runs';

  @override
  String get qcStats => 'Observed';

  @override
  String get qcChartLegend => '● in control   ▲ warning   ■ rejected';

  @override
  String qcChartSemantics(String label, int count) {
    return 'Levey–Jennings chart, level $label: $count values';
  }

  @override
  String get qcDeleteRun => 'Delete run';

  @override
  String get qcDeleteSet => 'Delete test and all runs';

  @override
  String get qcConfirmDelete => 'This can’t be undone.';

  @override
  String get qcSetMissing => 'This test no longer exists.';

  @override
  String get qcCopyCsv => 'Copy runs as a table (CSV)';

  @override
  String qcCopied(int count) {
    return 'Copied $count rows — paste into Excel or Google Sheets';
  }

  @override
  String get qcChangeTarget => 'Change target or lot';

  @override
  String get qcChangeTargetBody =>
      'Use this when a new control lot starts or your laboratory recalculates the mean and SD. The new values apply from the chosen time (usually now); earlier runs keep being evaluated against the targets that were in effect then.';

  @override
  String get qcErrTarget => 'Enter the mean and an SD greater than zero.';

  @override
  String qcSince(String date) {
    return 'since $date';
  }

  @override
  String qcPreviousTarget(String target, String date) {
    return 'Previous: $target (from $date)';
  }

  @override
  String get qcRulesSource =>
      'Rules: Westgard multirule procedure (Westgard JO et al., Clin Chem 1981; doi:10.1093/clinchem/27.3.493). A learning and checking aid — it does not replace your laboratory’s QC procedure.';

  @override
  String get qcErrSave => 'Couldn’t save. Please try again.';

  @override
  String qcErrNotFinite(String label) {
    return 'Level $label: the value is too large or too small.';
  }

  @override
  String get qcLevelName => 'Level name (optional, e.g. “Low”)';

  @override
  String get qcStatsExcluded => 'Rejected runs are excluded.';

  @override
  String qcStatsFew(int count) {
    return 'n = $count: still few values — Westgard et al. (1981) initially calculate targets from about 20 values.';
  }

  @override
  String qcUseObserved(int count) {
    return 'Use observed x̄ and SD (n = $count)';
  }

  @override
  String get qcEffectiveFrom => 'Effective from';

  @override
  String get qcFromNow => 'From now';

  @override
  String qcFromDate(String date) {
    return 'From $date';
  }

  @override
  String get qcPickDate => 'Pick a date';

  @override
  String qcRunTime(String time) {
    return 'Run time: $time';
  }

  @override
  String get qcRunTimeNow => 'now';

  @override
  String get qcRunTimeHint =>
      'For a run entered late, pick the actual measurement time — the rules check runs in time order.';

  @override
  String qcShowAllRuns(int count) {
    return 'Show all ($count)';
  }

  @override
  String get qcRejectedExcluded => 'Not used in later rules or statistics';

  @override
  String get qcBackupTitle => 'Backup';

  @override
  String get qcBackupBody =>
      'QC data is stored only on this device. Copy the backup (JSON) and keep it somewhere safe; on another device you can restore it from the clipboard.';

  @override
  String get qcBackupCopy => 'Copy backup';

  @override
  String get qcBackupCopied => 'Backup copied to the clipboard';

  @override
  String get qcBackupRestore => 'Restore from clipboard';

  @override
  String qcRestoreConfirm(int sets, int runs) {
    return 'Current QC data will be replaced by the backup from the clipboard: $sets tests, $runs runs.';
  }

  @override
  String get qcRestoreAction => 'Replace';

  @override
  String get qcRestoreInvalid =>
      'The clipboard does not contain a valid QC backup.';

  @override
  String get qcRestored => 'QC data restored';

  @override
  String get qcCopyRaw => 'Copy the saved text';

  @override
  String get qcDiscard => 'Delete the unreadable data';

  @override
  String get qcDiscardConfirm =>
      'Copy the saved text first. Once deleted, it cannot be recovered.';

  @override
  String get preTitle => 'Specimen journey';

  @override
  String get preStep1 => 'Prepare for testing';

  @override
  String get preStep2 => 'Select specimen and additive';

  @override
  String get preStep3 => 'Collect and identify';

  @override
  String get preStep4 => 'Separate and store';

  @override
  String get preStep5 => 'Transport and receive';

  @override
  String get preNotice =>
      'Tube color, time and temperature are tied to the specific tube, method and instructions. No universal parameters are given.';

  @override
  String get preOrderTitle => 'Order of draw (venepuncture)';

  @override
  String get preOrderSub =>
      'WHO 2010, Table 2.3 (based on the NCCLS 2003 consensus). Check your laboratory’s current procedure.';

  @override
  String preCap(String cap) {
    return 'Cap: $cap';
  }

  @override
  String get preHaemolysisTitle => 'Causes of hemolysis';

  @override
  String get preTourniquetTitle => 'Tourniquet';

  @override
  String get preIdTitle => 'Patient identification and labelling';

  @override
  String get calcTitle => 'Calculators';

  @override
  String get calcLearningTag => 'Learning calculator';

  @override
  String get calcDilution => 'Dilution';

  @override
  String get calcDilutionSub => 'C₁V₁ = C₂V₂';

  @override
  String get calcUnits => 'Unit conversion';

  @override
  String get calcUnitsSub => 'Analyte-specific';

  @override
  String get dilC1 => 'C₁ · Stock concentration';

  @override
  String get dilC2 => 'C₂ · Target concentration';

  @override
  String get dilV2 => 'V₂ · Final volume (mL)';

  @override
  String get dilNote =>
      'Use the same units for C₁ and C₂. Simple dilution model: reactions, safety and volume changes are not modelled.';

  @override
  String get dilCalculate => 'Calculate';

  @override
  String dilResult(String volume) {
    return 'V₁ = $volume mL';
  }

  @override
  String get dilResultBody =>
      'Volume of stock solution. Bring the total final volume to V₂.';

  @override
  String dilDiluent(String volume) {
    return 'Diluent ≈ $volume mL (assuming volumes add up)';
  }

  @override
  String get dilNoDilution => 'C₂ equals C₁: no dilution is needed.';

  @override
  String get dilErrorInvalid =>
      'Enter a number greater than zero in every field.';

  @override
  String get dilErrorC2GtC1 =>
      'C₂ can\'t exceed C₁: dilution can\'t raise the concentration.';

  @override
  String get dilErrorRange => 'The values are outside the calculable range.';

  @override
  String get ucTitle => 'Unit conversion';

  @override
  String get ucSubtitle =>
      'Each substance has its own factor — one shared mg/dL → mmol/L factor would be wrong.';

  @override
  String get ucAnalyte => 'Analyte';

  @override
  String get ucValue => 'Value';

  @override
  String get ucSwap => 'Swap units';

  @override
  String get ucConvert => 'Convert';

  @override
  String ucNote(String mass) {
    return 'Calculated from the molar mass $mass g/mol. Laboratories may round differently; report the units your laboratory uses.';
  }

  @override
  String get ucNotAvailable =>
      'No verified molar mass for this analyte, so conversion is not offered.';

  @override
  String get ucErrorInvalid => 'Enter a number of 0 or more.';

  @override
  String get ucErrorRange => 'The value is outside the calculable range.';

  @override
  String get calcSectionClinical => 'Clinical formulas';

  @override
  String get calcSectionLab => 'Laboratory';

  @override
  String get calcEgfr => 'eGFR · CKD-EPI 2021';

  @override
  String get calcEgfrSub => 'Creatinine, age, sex';

  @override
  String get calcAcr => 'Albumin/creatinine ratio';

  @override
  String get calcAcrSub => 'Urine ACR · KDIGO A category';

  @override
  String get calcAnionGap => 'Anion gap';

  @override
  String get calcAnionGapSub => 'Na, Cl, HCO₃ · K and albumin optional';

  @override
  String get calcCalcium => 'Corrected calcium';

  @override
  String get calcCalciumSub => 'By albumin · Payne 1973';

  @override
  String get calcLdl => 'LDL-C and non-HDL-C';

  @override
  String get calcLdlSub => 'Friedewald · Sampson';

  @override
  String get calcOsmo => 'Calculated osmolality';

  @override
  String get calcOsmoSub => 'And osmolal gap';

  @override
  String get calcHba1c => 'HbA1c units and eAG';

  @override
  String get calcHba1cSub => 'NGSP ↔ IFCC · ADAG';

  @override
  String get calcFormulaTag => 'Published formula';

  @override
  String get calcOptional => 'optional';

  @override
  String get calcNotDiagnosis =>
      'A calculation aid for learning and checking. It does not diagnose: interpret the result with the clinical picture and your laboratory’s reference intervals.';

  @override
  String get calcFormula => 'Formula';

  @override
  String get calcLimitations => 'Limitations';

  @override
  String get calcSources => 'Sources';

  @override
  String get fieldCreatinine => 'Serum creatinine';

  @override
  String get fieldAge => 'Age, years';

  @override
  String get fieldSex => 'Sex';

  @override
  String get fieldSodium => 'Sodium (Na⁺)';

  @override
  String get fieldChloride => 'Chloride (Cl⁻)';

  @override
  String get fieldBicarbonate => 'Bicarbonate (HCO₃⁻)';

  @override
  String get fieldPotassium => 'Potassium (K⁺)';

  @override
  String get fieldAlbumin => 'Serum albumin';

  @override
  String get fieldNormalAlbumin => 'Normal albumin used by your laboratory';

  @override
  String get fieldCalcium => 'Total serum calcium';

  @override
  String get fieldTotalCholesterol => 'Total cholesterol';

  @override
  String get fieldHdl => 'HDL cholesterol';

  @override
  String get fieldTriglycerides => 'Triglycerides';

  @override
  String get fieldGlucose => 'Glucose';

  @override
  String get fieldUrea => 'Urea (or BUN)';

  @override
  String get fieldMeasuredOsmolality => 'Measured osmolality';

  @override
  String get fieldHba1c => 'HbA1c';

  @override
  String get fieldUrineAlbumin => 'Urine albumin';

  @override
  String get fieldUrineCreatinine => 'Urine creatinine';

  @override
  String get sexFemale => 'Female';

  @override
  String get sexMale => 'Male';

  @override
  String resGfrCategory(String code) {
    return 'KDIGO GFR category $code';
  }

  @override
  String resAlbCategory(String code) {
    return 'KDIGO albuminuria category $code';
  }

  @override
  String get resCategoryBasisSi => 'Determined on the mg/mmol cut-offs.';

  @override
  String get resCategoryBasisConv => 'Determined on the mg/g cut-offs.';

  @override
  String get resAnionGap => 'Anion gap';

  @override
  String get resAnionGapK => 'With potassium';

  @override
  String get resAnionGapAlb => 'Albumin-corrected (Figge)';

  @override
  String get resCorrectedCa => 'Corrected calcium (Payne)';

  @override
  String get resNonHdl => 'Non-HDL cholesterol';

  @override
  String get resLdlFriedewald => 'LDL-C · Friedewald';

  @override
  String get resLdlSampson => 'LDL-C · Sampson';

  @override
  String get resOsmCalc => 'Calculated osmolality';

  @override
  String get resOsmGap => 'Osmolal gap';

  @override
  String get resEag => 'Estimated average glucose (eAG)';

  @override
  String errCalcMissing(String field) {
    return 'Enter a number: $field.';
  }

  @override
  String errCalcImplausible(String field, String min, String max, String unit) {
    return '$field: outside the range this calculator accepts ($min–$max$unit). Check the value and the unit.';
  }

  @override
  String get errEgfrAge =>
      'The CKD-EPI 2021 equation was developed in participants aged 18 or older; it is not calculated for children.';

  @override
  String errFriedewaldTg(String limit) {
    return 'Not calculated: Friedewald is not reliable when triglycerides exceed $limit.';
  }

  @override
  String errSampsonTg(String limit) {
    return 'Not calculated: the Sampson equation was validated for triglycerides up to $limit.';
  }

  @override
  String errEagRange(String range) {
    return 'eAG not shown: the ADAG data cover HbA1c $range.';
  }

  @override
  String get errHdlGeTc =>
      'HDL cholesterol can\'t be equal to or greater than total cholesterol.';

  @override
  String get errNotPositive =>
      'Not calculated: the result is not positive — check the values.';

  @override
  String get errSexMissing => 'Choose sex.';

  @override
  String get micTitle => 'Microscopy atlas';

  @override
  String get micNotice =>
      'Image slot. Authentic micrographs are added only after usage rights and labels are verified.';

  @override
  String get micRedCells => 'Red blood cells';

  @override
  String get micWhiteCells => 'White blood cells';

  @override
  String get micEpithelium => 'Epithelial cells';

  @override
  String get micCasts => 'Casts';

  @override
  String get micCrystals => 'Crystals';

  @override
  String get micItemSub => 'Appearance · distinctions · limitations';

  @override
  String get micImagePending => 'Image pending rights check';

  @override
  String get insTitle => 'Instruments';

  @override
  String get insMindraySub => 'Exact model required';

  @override
  String get insHumanSub => 'Instrument and reagent documents are separate';

  @override
  String get insOther => 'Other manufacturer';

  @override
  String get insOtherSub => 'Match by exact model and IFU';

  @override
  String get libTitle => 'Library';

  @override
  String get libSubtitle => 'Your knowledge in one place.';

  @override
  String get libBooks => 'Books and guides';

  @override
  String get libBooksSub => 'PDF · language · revision · size';

  @override
  String get libPacks => 'Offline packs';

  @override
  String get libPacksSub => 'Installed and upcoming packs';

  @override
  String get libSavedSub => 'Bookmarked tests';

  @override
  String get libResearchSub => 'Question, plan, real data and sources';

  @override
  String get libSources => 'Sources and licences';

  @override
  String get libSourcesSub => 'Review and reuse conditions';

  @override
  String get booksEmptyTitle => 'No books yet';

  @override
  String get booksEmptyBody =>
      'Books are added only with confirmed distribution rights. A PDF you add yourself stays for personal study and isn\'t shared.';

  @override
  String get packsInstalled => 'Installed';

  @override
  String get packsCoreTitle => 'Core content';

  @override
  String packsVersion(String version) {
    return 'Version $version';
  }

  @override
  String packsSize(String size) {
    return 'Size: $size';
  }

  @override
  String packsLanguages(String languages) {
    return 'Languages: $languages';
  }

  @override
  String packsLicence(String licence) {
    return 'Licence: $licence';
  }

  @override
  String get packsVerified => 'Integrity verified (SHA-256)';

  @override
  String get packsUpcoming => 'Upcoming packs';

  @override
  String get packsUpcomingBody =>
      'The size is shown before any download. Packs are published only after content review.';

  @override
  String get packsBiochem => 'Biochemistry essentials';

  @override
  String get packsSpecimensQc => 'Specimens and QC';

  @override
  String get packsMicroscopy => 'Microscopy atlas';

  @override
  String get packsNotPublished => 'Not published yet';

  @override
  String get savedEmptyTitle => 'No bookmarks yet';

  @override
  String get savedEmptyBody => 'Select Save on a test card to keep it here.';

  @override
  String get sourcesTitle => 'Sources and licences';

  @override
  String get sourcesContent => 'Analyte cards';

  @override
  String get sourcesMethods => 'Calculators, QC and preanalytics';

  @override
  String get sourcesBody =>
      'Every published claim links to its original source, access date, scope and review status.';

  @override
  String get researchTitle => 'Research workspace';

  @override
  String get researchQuestion => 'Topic or research question';

  @override
  String get researchQuestionHint => 'Enter a topic';

  @override
  String get researchNotes => 'Aim and notes';

  @override
  String get researchNotesHint => 'Your own data and sources';

  @override
  String get researchSave => 'Save draft';

  @override
  String get researchSaved => 'Draft saved on this device';

  @override
  String get researchOutline => 'Outline structure';

  @override
  String get researchStep1 => 'Question and aim';

  @override
  String get researchStep2 => 'Literature review';

  @override
  String get researchStep3 => 'Methods and real data';

  @override
  String get researchStep4 => 'Results, limitations and conclusions';

  @override
  String get researchNoFabrication =>
      'LabGuide never generates results, patient data or citations. Use only your own data and sources.';

  @override
  String get learnTitle => 'Learn with understanding';

  @override
  String get learnHeroTag => 'Visual biochemistry';

  @override
  String get learnHeroTitle => 'From molecule to practice';

  @override
  String get learnHeroBody => 'Topics, mechanisms and knowledge checks.';

  @override
  String get learnHeroCta => 'Explore topics';

  @override
  String get learnClassesSub => 'Teacher → assignment → student → results';

  @override
  String get learnQuiz => 'Explained quiz';

  @override
  String learnQuizSub(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count practice questions',
      one: '$count practice question',
    );
    return '$_temp0';
  }

  @override
  String get learnExam => 'Exam mode';

  @override
  String get learnExamSub => 'Time, topic and questions';

  @override
  String get learnLessonPlan => 'Lesson plan';

  @override
  String get learnLessonPlanSub => 'Teacher workspace';

  @override
  String quizProgress(int current, int total) {
    return 'Question $current of $total';
  }

  @override
  String get quizCorrect => 'Correct.';

  @override
  String get quizIncorrect => 'This answer is incorrect.';

  @override
  String get quizNext => 'Next';

  @override
  String get quizFinish => 'See result';

  @override
  String get quizDoneTitle => 'Practice complete';

  @override
  String quizScore(int correct, int total) {
    return '$correct of $total correct';
  }

  @override
  String get quizRestart => 'Try again';

  @override
  String quizBasis(String basis) {
    return 'Basis: $basis';
  }

  @override
  String get quizReviewNote => 'Practice questions are pending expert review.';

  @override
  String get quizMistakes => 'Review your mistakes';

  @override
  String get quizNoMistakes => 'No mistakes — well done.';

  @override
  String get quizYourAnswer => 'Your answer';

  @override
  String get quizCorrectAnswer => 'Correct answer';

  @override
  String get quizChooseTopic => 'Choose a topic';

  @override
  String quizTopicMixed(int count) {
    return 'Mixed: $count random questions';
  }

  @override
  String get quizTopicGeneral => 'Laboratory calculations';

  @override
  String quizQuestionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count questions',
      one: '1 question',
    );
    return '$_temp0';
  }

  @override
  String get quizOtherTopic => 'Another topic';

  @override
  String get quizTopicMistakes => 'Review my mistakes';

  @override
  String quizMastered(int correct, int total) {
    return '$correct of $total correct last time';
  }

  @override
  String get examTitle => 'Exam mode';

  @override
  String get examBody =>
      'Timed exams and result history come with the learning module. The practice questions are available now.';

  @override
  String get examOpenPractice => 'Open practice questions';

  @override
  String get classesTitle => 'Classes and assignments';

  @override
  String get classesSignInTitle => 'Sign in to use classes';

  @override
  String get classesSignInBody =>
      'Creating, joining and submitting assignments is tied to an account. Reading content stays open without sign-in.';

  @override
  String get classesSignIn => 'Sign in';

  @override
  String get classesUnavailableTitle => 'The class server isn\'t connected yet';

  @override
  String get classesUnavailableBody =>
      'Nothing is sent or stored. When it\'s connected, teachers see only their own classes and students see only their own results — checked on the server.';

  @override
  String get profileTitle => 'Profile and settings';

  @override
  String get profileGuest => 'Guest';

  @override
  String get profileGuestSub => 'Content is open without an account';

  @override
  String get profileDemoSession => 'Demo session · debug build';

  @override
  String get profileRole => 'Role';

  @override
  String get profileRoleSub => 'Home adapts to your role';

  @override
  String get profileLanguage => 'Language';

  @override
  String get profileAppearance => 'Appearance';

  @override
  String get themeSystem => 'System';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';

  @override
  String get profilePurchase => 'Subscription and restore';

  @override
  String get profilePurchaseSub => 'Free · Pro';

  @override
  String get profilePrivacy => 'Privacy and help';

  @override
  String get profilePrivacySub => 'Data and account controls';

  @override
  String get profileSignIn => 'Sign in with email';

  @override
  String get profileSignOut => 'Sign out';

  @override
  String profileVersion(String version) {
    return 'Version $version';
  }

  @override
  String get purchaseTitle => 'LabGuide Pro';

  @override
  String get purchaseFree => 'Free: demo and basic cards.';

  @override
  String get purchasePro =>
      'Pro, monthly or yearly: complete published packs, extended learning and laboratory tools.';

  @override
  String get purchaseNotice =>
      'Store products aren\'t connected. Prices will come from the App Store / Google Play in your currency. Nothing is charged here, and features that aren\'t built yet are not sold.';

  @override
  String get purchaseSubscribe => 'Subscribe';

  @override
  String get purchaseRestore => 'Restore purchases';

  @override
  String get privacyTitle => 'Privacy and help';

  @override
  String get privacyBody =>
      'This build sends no data to a server. Settings, bookmarks and drafts are stored only on this device.';

  @override
  String get privacyTerms => 'Terms of use';

  @override
  String get privacyTermsSub => 'Final text to be prepared';

  @override
  String get privacyDeleteLocal => 'Delete local data';

  @override
  String get privacyDeleteLocalSub =>
      'Settings, bookmarks and drafts on this device';

  @override
  String get privacyDeleteConfirmTitle => 'Delete local data?';

  @override
  String get privacyDeleteConfirmBody =>
      'Settings, bookmarks and drafts on this device will be removed. This can\'t be undone.';

  @override
  String get privacyDeleted => 'Local data deleted';

  @override
  String get termsTitle => 'Terms of use';

  @override
  String get termsBody =>
      'Final terms, the privacy policy and clinical-use boundaries will be prepared before release. LabGuide is a reference and learning tool: it doesn\'t diagnose, prescribe or replace your laboratory\'s procedures.';

  @override
  String citePage(String page) {
    return 'p. $page';
  }

  @override
  String get rightsUnknown => 'Distribution rights not confirmed';

  @override
  String get rightsPersonal => 'Personal study only — not distributed';

  @override
  String get rightsPermitted => 'Distribution permission recorded';

  @override
  String get rightsDenied => 'Distribution not permitted';

  @override
  String get catBiochemistry => 'Biochemistry';

  @override
  String get catClinicalLab => 'Clinical laboratory';

  @override
  String get catInstruments => 'Instruments';

  @override
  String get catMethods => 'Methods';

  @override
  String get catTests => 'Test questions';

  @override
  String get kindBook => 'Book';

  @override
  String get kindManual => 'Manual';

  @override
  String get kindMethod => 'Method';

  @override
  String get kindIfu => 'IFU';

  @override
  String get kindArticle => 'Article';

  @override
  String get kindQuestionSet => 'Question set';

  @override
  String get kindWebsite => 'Website';

  @override
  String libAccessOpen(String licence) {
    return 'Open licence · $licence';
  }

  @override
  String get libAccessFree => 'Free to read · link only';

  @override
  String get libAccessCatalog => 'Catalogue record only';

  @override
  String get libOpenSource => 'Open the official page';

  @override
  String libChecked(String date) {
    return 'Page and licence checked: $date';
  }

  @override
  String libItemPack(String size) {
    return 'Offline pack · $size';
  }

  @override
  String get libItemNoPack => 'Not available as a shared offline pack';

  @override
  String libItemSupersedes(String title) {
    return 'Newer edition of: $title';
  }

  @override
  String get libReview => 'Review queue';

  @override
  String get libReviewSub => 'Source discrepancies and drafts';

  @override
  String get reviewDiscrepancies => 'Source discrepancies';

  @override
  String get reviewDiscrepanciesBody =>
      'When older and newer sources disagree, both positions are listed here for expert review. Neither is published as fact until resolved.';

  @override
  String get reviewNoDiscrepancies => 'No open discrepancies.';

  @override
  String reviewDraftQuestions(int count) {
    return 'Draft questions: $count';
  }

  @override
  String reviewDraftCards(int count) {
    return 'Cards awaiting expert review: $count';
  }

  @override
  String reviewCatalog(int count) {
    return 'Catalogued materials: $count';
  }

  @override
  String reviewField(String field) {
    return 'Field: $field';
  }

  @override
  String get quizDraftTag => 'Draft · not reviewed';

  @override
  String get lessonsTitle => 'Lesson topics';
}
