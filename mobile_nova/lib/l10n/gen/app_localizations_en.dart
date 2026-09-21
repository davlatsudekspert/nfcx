// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class LEn extends L {
  LEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'NFCSTORE Nova';

  @override
  String get actionContinue => 'Continue';

  @override
  String get actionBack => 'Back';

  @override
  String get actionNext => 'Next';

  @override
  String get actionSave => 'Save';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionDelete => 'Delete';

  @override
  String get actionEdit => 'Edit';

  @override
  String get actionShare => 'Share';

  @override
  String get shareCopied => 'Link copied';

  @override
  String get actionMute => 'Mute';

  @override
  String get actionUnmute => 'Unmute';

  @override
  String get actionCopy => 'Copy';

  @override
  String get actionCopied => 'Copied';

  @override
  String get actionRetry => 'Retry';

  @override
  String get actionClose => 'Close';

  @override
  String get actionOpen => 'Open';

  @override
  String get actionDone => 'Done';

  @override
  String get actionConfirm => 'Confirm';

  @override
  String get actionAdd => 'Add';

  @override
  String get actionSearch => 'Search';

  @override
  String get actionSeeAll => 'See all';

  @override
  String get actionFollow => 'Follow';

  @override
  String get actionUnfollow => 'Unfollow';

  @override
  String get actionPublish => 'Publish';

  @override
  String get actionSelect => 'Select';

  @override
  String get actionPreview => 'Preview';

  @override
  String get actionUpload => 'Upload';

  @override
  String get actionRefresh => 'Refresh';

  @override
  String get yes => 'Yes';

  @override
  String get no => 'No';

  @override
  String get errRequired => 'This field is required';

  @override
  String get errBadEmail => 'Invalid email address';

  @override
  String get errBadPhone => 'Invalid phone number';

  @override
  String get errPasswordShort => 'Password must be at least 8 characters';

  @override
  String get errNameShort => 'Name is too short';

  @override
  String get errBadCode => 'The code has 6 digits';

  @override
  String get errPasswordMismatch => 'Passwords do not match';

  @override
  String get errOffline => 'No internet connection';

  @override
  String get errTimeout => 'The server did not respond';

  @override
  String get errServer => 'Server error';

  @override
  String get errUnauthorized => 'Session expired, please sign in again';

  @override
  String get errForbidden => 'Access denied';

  @override
  String get errNotFound => 'Not found';

  @override
  String get errConflict => 'This value is already taken';

  @override
  String get errRateLimited => 'Too many attempts. Please wait';

  @override
  String get errUnknown => 'Something went wrong';

  @override
  String get errBadCredentials => 'Wrong email or password';

  @override
  String get errEmailTaken => 'This email is already registered';

  @override
  String get errEndpointMissing =>
      'This feature is not enabled on the server yet';

  @override
  String get devBackendRequired => 'BACKEND ENDPOINT REQUIRED';

  @override
  String get devConfigRequired => 'CONFIG REQUIRED';

  @override
  String get stateLoading => 'Loading…';

  @override
  String get stateEmpty => 'Nothing here yet';

  @override
  String get stateEmptyHint => 'Be the first to add something';

  @override
  String get stateNoResults => 'No results found';

  @override
  String get stateNoResultsHint => 'Try a different search';

  @override
  String get stateOfflineTitle => 'Offline';

  @override
  String get stateOfflineHint => 'Connect to the internet and try again';

  @override
  String get stateErrorTitle => 'Something went wrong';

  @override
  String get welcomeTitle => 'Your digital\nidentity';

  @override
  String get welcomeSubtitle =>
      'Share yourself, your work and your store with a single tap.';

  @override
  String get welcomeLogin => 'Sign in';

  @override
  String get welcomeRegister => 'Create account';

  @override
  String get loginTitle => 'Welcome back';

  @override
  String get loginSubtitle => 'Enter your email and phone number';

  @override
  String get loginSubtitlePassword => 'Enter your email and password';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPhone => 'Phone';

  @override
  String get fieldPassword => 'Password';

  @override
  String get a11yShowPassword => 'Show password';

  @override
  String get a11yHidePassword => 'Hide password';

  @override
  String get fieldPasswordRepeat => 'Repeat password';

  @override
  String get fieldName => 'Full name';

  @override
  String get fieldUsername => 'Username';

  @override
  String get fieldBio => 'About you';

  @override
  String get loginSendCode => 'Send code';

  @override
  String get loginWithPassword => 'Sign in with password';

  @override
  String get loginUseCode => 'Sign in with a code';

  @override
  String get loginNoAccount => 'No account yet?';

  @override
  String get loginHaveAccount => 'Already have an account?';

  @override
  String get verifyTitle => 'Enter the code';

  @override
  String verifySentTo(String email) {
    return 'A 6-digit code was sent to $email';
  }

  @override
  String get verifySentTelegram =>
      'A 6-digit code was sent to the Telegram bot';

  @override
  String get verifyNoChannel =>
      'The code was not sent. Email delivery is not configured on the server — please contact support.';

  @override
  String verifyResendIn(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get verifyResend => 'Resend code';

  @override
  String get verifyChangeEmail => 'Change email address';

  @override
  String get verifyWrongCode => 'Wrong code';

  @override
  String get verifyWrongCodeHint => 'Check the code and try again';

  @override
  String get verifyExpired => 'The code has expired';

  @override
  String get verifyExpiredHint => 'Request a new code';

  @override
  String get verifySuccess => 'Email verified';

  @override
  String get verifySending => 'Sending the code…';

  @override
  String get registerTitle => 'Create an account';

  @override
  String registerStep(int current, int total) {
    return 'Step $current of $total';
  }

  @override
  String get registerNameHint => 'What should we call you?';

  @override
  String get registerEmailHint => 'The verification code will be sent here';

  @override
  String get registerPhoneHint => 'Uzbekistan number: +998';

  @override
  String get registerPasswordHint => 'At least 8 characters';

  @override
  String get setupTitle => 'Set up your profile';

  @override
  String get setupSubtitle => 'You can change this later';

  @override
  String get setupSkip => 'Later';

  @override
  String get setupPhoto => 'Add a photo';

  @override
  String get logout => 'Sign out';

  @override
  String get logoutConfirm => 'Sign out of your account?';

  @override
  String get navHome => 'Home';

  @override
  String get navDiscover => 'Discover';

  @override
  String get navNfc => 'NFC';

  @override
  String get navReels => 'Reels';

  @override
  String get navProfile => 'Profile';

  @override
  String get homeGreetingMorning => 'Good morning';

  @override
  String get homeGreetingDay => 'Good afternoon';

  @override
  String get homeGreetingEvening => 'Good evening';

  @override
  String get homeActiveId => 'Active NFC ID';

  @override
  String get homeNoId => 'No NFC ID yet';

  @override
  String get homeNoIdHint => 'Order a card from the shop or create an ID';

  @override
  String get homeQuickActions => 'Quick actions';

  @override
  String get homeStories => 'Stories';

  @override
  String get homeYourStory => 'Your story';

  @override
  String get homePosts => 'Posts';

  @override
  String get homeReels => 'Reels';

  @override
  String get homeActivity => 'Recent activity';

  @override
  String get homeShop => 'Shop';

  @override
  String get homeBusiness => 'Business';

  @override
  String get modePersonal => 'Personal';

  @override
  String get modeBusiness => 'Business';

  @override
  String modeSwitched(String mode) {
    return 'Switched to $mode mode';
  }

  @override
  String get nfcCenter => 'NFC Center';

  @override
  String get nfcTapToScan => 'Tap to scan';

  @override
  String get nfcScanShort => 'Scan';

  @override
  String get nfcHoldCard => 'Hold the card against the back of your phone';

  @override
  String get nfcScanning => 'Scanning…';

  @override
  String get nfcScanSuccess => 'Card read';

  @override
  String get nfcScanFailed => 'Could not read the card';

  @override
  String get nfcUnsupported => 'This device has no NFC';

  @override
  String get nfcUnsupportedHint =>
      'You can still share your NFC IDs with a QR code';

  @override
  String get nfcDisabled => 'NFC is off';

  @override
  String get nfcDisabledHint => 'Turn it on in Settings → Connections → NFC';

  @override
  String get nfcOpenSettings => 'Open settings';

  @override
  String get nfcMyIds => 'My NFC IDs';

  @override
  String get nfcIdDetail => 'ID details';

  @override
  String get nfcCards => 'Cards';

  @override
  String get nfcHistory => 'History';

  @override
  String get nfcGift => 'Gift';

  @override
  String get nfcSecurity => 'Security';

  @override
  String get nfcActive => 'Active';

  @override
  String get nfcInactive => 'Inactive';

  @override
  String get nfcSetPrimary => 'Make primary';

  @override
  String get nfcPrimary => 'Primary';

  @override
  String get nfcLinkCard => 'Link a card';

  @override
  String get nfcBlockCard => 'Block card';

  @override
  String get nfcBlockConfirm =>
      'Block this card? Tapping it will stop opening your profile. You can unblock it later.';

  @override
  String get nfcUnblockCard => 'Unblock card';

  @override
  String get nfcDeleteConfirm => 'Delete this NFC ID? This cannot be undone.';

  @override
  String get nfcScans => 'Scans';

  @override
  String get nfcViews => 'Views';

  @override
  String get bizTaps => 'Taps';

  @override
  String get nfcShowQr => 'Show QR code';

  @override
  String get nfcQrHint => 'Scan this code to open the profile';

  @override
  String get nfcGiftHint => 'Gift this ID to another user';

  @override
  String get nfcGiftRecipient => 'Recipient email';

  @override
  String get nfcGiftSent => 'Gift offer sent';

  @override
  String get profileFollowers => 'Followers';

  @override
  String get profileFollowing => 'Following';

  @override
  String get profilePosts => 'Posts';

  @override
  String get profileEdit => 'Edit profile';

  @override
  String get profileMusic => 'Profile music';

  @override
  String get profileMusicAdd => 'Add music';

  @override
  String get profileLinks => 'Links';

  @override
  String get profileContact => 'Contact';

  @override
  String get profileSaved => 'Profile saved';

  @override
  String get profileNoBio => 'No bio yet';

  @override
  String get discoverTitle => 'Discover';

  @override
  String get discoverPeople => 'People';

  @override
  String get discoverBusinesses => 'Businesses';

  @override
  String get discoverProducts => 'Products';

  @override
  String get discoverTrending => 'Trending';

  @override
  String get discoverSuggested => 'Suggested';

  @override
  String get searchHint => 'People, businesses or NFC IDs';

  @override
  String get searchRecent => 'Recent searches';

  @override
  String get searchClear => 'Clear';

  @override
  String get storyCreate => 'Add a story';

  @override
  String get storyDeleteConfirm => 'Delete this story?';

  @override
  String get postCreate => 'Add a post';

  @override
  String get postCaption => 'Write a caption…';

  @override
  String get postComments => 'Comments';

  @override
  String get postNoComments => 'No comments yet';

  @override
  String get postAddComment => 'Add a comment…';

  @override
  String get postLiked => 'Liked';

  @override
  String get postSave => 'Save';

  @override
  String get postDeleteConfirm => 'Delete this post?';

  @override
  String get reelCreate => 'Add a reel';

  @override
  String get storyPublish => 'Share story';

  @override
  String get postPublish => 'Share post';

  @override
  String get reelPublish => 'Share reel';

  @override
  String get storyLike => 'Like';

  @override
  String get storyComments => 'Comments';

  @override
  String get storyCommentHint => 'Write a comment…';

  @override
  String get actionFollowing => 'Following';

  @override
  String get postLike => 'Like';

  @override
  String get reelsEmpty => 'No reels yet';

  @override
  String uploadProgress(int percent) {
    return 'Uploading $percent%';
  }

  @override
  String get uploadFailed => 'Upload failed';

  @override
  String get mediaPickPhoto => 'Choose a photo';

  @override
  String get mediaPickVideo => 'Choose a video';

  @override
  String get mediaCamera => 'Camera';

  @override
  String get mediaGallery => 'Gallery';

  @override
  String get bizTitle => 'Business';

  @override
  String get bizDashboard => 'Dashboard';

  @override
  String get bizStorefront => 'Storefront';

  @override
  String get bizCatalog => 'Catalog';

  @override
  String get bizAnalytics => 'Analytics';

  @override
  String get bizCreate => 'Create a business';

  @override
  String get bizNone => 'You have no business account';

  @override
  String get bizNoneHint => 'Set up your company in a few steps';

  @override
  String get bizId => 'Business address';

  @override
  String get bizIdHint => 'nfcstore.uz/c/your-name';

  @override
  String get bizIdChecking => 'Checking…';

  @override
  String get bizIdFree => 'Available';

  @override
  String get bizIdTaken => 'Taken';

  @override
  String get bizName => 'Company name';

  @override
  String get bizCategory => 'Category';

  @override
  String get bizCity => 'City';

  @override
  String get bizAddress => 'Address';

  @override
  String get bizDescription => 'Description';

  @override
  String get bizWebsite => 'Website';

  @override
  String get bizHours => 'Working hours';

  @override
  String get bizContactSheet => 'Get in touch';

  @override
  String get bizProducts => 'Products';

  @override
  String get bizServices => 'Services';

  @override
  String get bizAddProduct => 'Add a product';

  @override
  String get bizProductName => 'Name';

  @override
  String get bizPrice => 'Price';

  @override
  String get bizSalePrice => 'Sale price';

  @override
  String get bizAvailable => 'Available';

  @override
  String get bizUnavailable => 'Out of stock';

  @override
  String get bizCatalogEmpty => 'The catalog is empty';

  @override
  String get bizSubmitReview => 'Submit for review';

  @override
  String get bizPending => 'Under review';

  @override
  String get shopTitle => 'Shop';

  @override
  String get shopAll => 'All';

  @override
  String get shopCards => 'NFC cards';

  @override
  String get shopIds => 'NFC IDs';

  @override
  String get shopBuy => 'Order';

  @override
  String get shopSoldOut => 'Sold out';

  @override
  String get checkoutTitle => 'Checkout';

  @override
  String get checkoutTotal => 'Total';

  @override
  String get checkoutPayWith => 'Payment method';

  @override
  String get checkoutPlace => 'Proceed to payment';

  @override
  String get paymentPending => 'Payment pending';

  @override
  String get paymentPendingHint =>
      'Finish the payment and the result will appear here';

  @override
  String get paymentSuccess => 'Payment successful';

  @override
  String get paymentFailed => 'Payment failed';

  @override
  String get paymentCancelled => 'Payment cancelled';

  @override
  String get paymentNotConfigured => 'Payment provider is not configured';

  @override
  String get orders => 'Orders';

  @override
  String get ordersEmpty => 'No orders yet';

  @override
  String orderNumber(String id) {
    return 'Order #$id';
  }

  @override
  String get paymentHistory => 'Payment history';

  @override
  String get activityTitle => 'Activity';

  @override
  String get activityEmpty => 'No new notifications';

  @override
  String get activityMarkRead => 'Mark all as read';

  @override
  String get activityAll => 'All';

  @override
  String get activityUnread => 'Unread';

  @override
  String get settings => 'Settings';

  @override
  String get settingsAccount => 'Account';

  @override
  String get settingsSecurity => 'Security';

  @override
  String get settingsChangePassword => 'Change password';

  @override
  String get settingsCurrentPassword => 'Current password';

  @override
  String get settingsNewPassword => 'New password';

  @override
  String get settingsPasswordChanged => 'Password changed';

  @override
  String get settingsAppearance => 'Appearance';

  @override
  String get settingsTheme => 'Theme';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get settingsNotifications => 'Notifications';

  @override
  String get settingsPrivacy => 'Privacy';

  @override
  String get settingsPayment => 'Payment';

  @override
  String get settingsReferral => 'Referral';

  @override
  String get settingsReferralHint =>
      'When a friend signs up with your code you both get a discount';

  @override
  String get settingsPremium => 'Premium';

  @override
  String get settingsSupport => 'Support';

  @override
  String get settingsNews => 'News';

  @override
  String get settingsAbout => 'About';

  @override
  String settingsVersion(String version) {
    return 'Version $version';
  }

  @override
  String get settingsDeleteAccount => 'Delete account';

  @override
  String get settingsDeleteConfirm =>
      'Your account will be deleted permanently. This cannot be undone.';

  @override
  String get settingsDeleteTypeEmail => 'Type your email address to confirm';

  @override
  String get themePearl => 'Pearl';

  @override
  String get themeGraphite => 'Graphite';

  @override
  String get themeOcean => 'Ocean';

  @override
  String get themeAurora => 'Aurora';

  @override
  String get themeMidnight => 'Midnight';

  @override
  String get langUz => 'Uzbek';

  @override
  String get langRu => 'Russian';

  @override
  String get langEn => 'English';

  @override
  String get supportWriteUs => 'Write to us';

  @override
  String get supportSent => 'Your message was sent';

  @override
  String get musicTitle => 'Music';

  @override
  String get musicFailed => 'Could not open the track';

  @override
  String get rulesTitle => 'Read before you publish';

  @override
  String get rulesBody =>
      'Published content must not contain: religious propaganda or extremist material, pornographic or sexually explicit images, political propaganda, or any material contrary to the laws of the Republic of Uzbekistan. Content that breaks these rules is removed without warning.';

  @override
  String get rulesAccept => 'I have read the rules and agree';

  @override
  String get rulesContinue => 'Continue';

  @override
  String get rulesReminder => 'By publishing you agree to the content rules.';

  @override
  String get rulesOpen => 'Content rules';

  @override
  String get rulesNotAccepted => 'Content rules were not accepted.';

  @override
  String get reportTitle => 'Report';

  @override
  String get reportSent => 'Report sent';

  @override
  String get reportReasonPorn => 'Pornographic or sexual content';

  @override
  String get reportReasonReligious => 'Religious propaganda or extremism';

  @override
  String get reportReasonPolitical => 'Political propaganda';

  @override
  String get reportReasonViolence => 'Violence or cruelty';

  @override
  String get reportReasonInsult => 'Insult or harassment';

  @override
  String get reportReasonSpam => 'Spam or fraud';

  @override
  String get reportReasonIllegal => 'Illegal material';

  @override
  String get reportReasonCopyright => 'Copyright';

  @override
  String get reportReasonOther => 'Other';

  @override
  String get reportNote => 'Note (optional)';

  @override
  String get blockUser => 'Block';

  @override
  String get unblockUser => 'Unblock';

  @override
  String get blockedList => 'Blocked';

  @override
  String get lockTitle => 'App lock';

  @override
  String get lockHint => 'Enter your PIN';

  @override
  String get lockWrong => 'Wrong PIN';

  @override
  String get lockSetPin => 'New PIN';

  @override
  String get lockRepeatPin => 'Repeat the PIN';

  @override
  String get lockMismatch => 'PINs did not match';

  @override
  String get lockEnabled => 'App lock enabled';

  @override
  String get lockBiometricReason => 'Unlock NFCSTORE';

  @override
  String get lockBiometric => 'Unlock with biometrics';

  @override
  String get lockBiometricNone => 'No biometrics on this device';

  @override
  String get lockOff => 'Turn off app lock';

  @override
  String get lockDesc =>
      'Asks for a PIN when opening the app on this device. This is not your account password.';

  @override
  String get actionSend => 'Send';

  @override
  String get giftOffers => 'Gift offers';

  @override
  String get giftIncoming => 'Offered to you';

  @override
  String get giftOutgoing => 'You sent';

  @override
  String get giftAccept => 'Accept';

  @override
  String get giftReject => 'Decline';

  @override
  String get giftCancel => 'Cancel';

  @override
  String get giftNoOffers => 'No gift offers yet';

  @override
  String get profilePickBusiness => 'Choose a business profile';

  @override
  String get profilePickPersonal => 'Choose a personal profile';

  @override
  String get businessNoneTitle => 'You have no business profile';

  @override
  String get businessNoneHint =>
      'Create a business profile or switch back to personal';

  @override
  String get premiumTitle => 'Premium subscription';

  @override
  String get premiumTagline => 'Reels, stories and every feature';

  @override
  String get premiumPerMonth => 'per month';

  @override
  String get premiumActive => 'Premium active';

  @override
  String premiumUntil(String date) {
    return 'Valid until: $date';
  }

  @override
  String get premiumForever => 'No expiry';

  @override
  String get premiumTrial => 'Trial period';

  @override
  String get premiumExtend => 'Extend';

  @override
  String get premiumBuy => 'Get Premium';

  @override
  String get premiumPerksTitle => 'What you unlock';

  @override
  String get premiumPerkVideo => 'Video posts and Reels';

  @override
  String get premiumPerkStory => 'Posting stories';

  @override
  String get premiumPerkPosts => 'More posts (up to 60)';

  @override
  String get premiumPerkMusic => '10 profile tracks';

  @override
  String get premiumPayWith => 'Choose a payment method';

  @override
  String get premiumPayme => 'Payme';

  @override
  String get premiumClick => 'Click';

  @override
  String get premiumOpening => 'Opening the payment page…';

  @override
  String get premiumPending =>
      'Waiting for payment. Come back here once you have paid.';

  @override
  String get premiumCheck => 'Check payment';

  @override
  String get premiumPaid => 'Payment received. Premium is active.';

  @override
  String get premiumNotYet => 'The payment is not confirmed yet.';

  @override
  String get premiumNoProvider => 'No payment provider is connected yet.';

  @override
  String get premiumBrowserFailed =>
      'Could not open the payment page. The link was copied.';

  @override
  String get premiumLocked => 'This feature is in Premium';

  @override
  String get premiumLockedVideo => 'Video posts and Reels need Premium.';

  @override
  String get premiumLockedStory => 'Your tier is not high enough for stories.';

  @override
  String get premiumLockedPost => 'Your tier is not high enough for posts.';

  @override
  String get payKindCard => 'Digital business card';

  @override
  String get payKindPhysical => 'Physical NFC card';

  @override
  String get payKindAuction => 'Auction payment';

  @override
  String get payKindPremium => 'Premium subscription';

  @override
  String get payKindFollow => 'Premium follow';

  @override
  String get payKindOther => 'Payment';

  @override
  String get payStatusPaid => 'Paid';

  @override
  String get payStatusPending => 'Pending';

  @override
  String get payStatusCancelled => 'Cancelled';

  @override
  String get payStatusFailed => 'Failed';

  @override
  String get payPendingHint => 'Payment not finished — you can still pay';

  @override
  String get demoBadge => 'Demo';

  @override
  String get demoSectionTitle => 'NFC Mobile';

  @override
  String get demoSectionHint => 'What can NFC do?';

  @override
  String get demoHeroTitle => 'Meet NFC';

  @override
  String get demoHeroBody =>
      'Personal profile, business page and NFC ID — all in one app.';

  @override
  String get demoChipIphone => 'Works with iPhone 18';

  @override
  String get demoChipSamsung => 'Works with Samsung S26';

  @override
  String get demoChipReady => 'NFC ready';

  @override
  String get demoPersonalBtn => 'Personal demo';

  @override
  String get demoBusinessBtn => 'Business demo';

  @override
  String get demoPersonalTitle => 'Personal profile';

  @override
  String get demoPersonalRole => 'Digital creator';

  @override
  String get demoSampleBtn => 'Sample profile';

  @override
  String get demoBusinessTitle => 'Business profile';

  @override
  String get demoBusinessBody =>
      'Catalog, contacts and orders — all inside one NFC profile.';

  @override
  String get demoCatalogBtn => 'Open the catalog';

  @override
  String get demoBuyBtn => 'Get an NFC ID';

  @override
  String get demoNotice =>
      'This is sample data — it does not affect your profile.';

  @override
  String get demoViewProfile => 'View the profile';

  @override
  String get demoViewBusiness => 'View the business profile';

  @override
  String get demoBizSubtitle => 'Business NFC Profile';

  @override
  String get demoPersonalSubtitle => 'Personal NFC Profile';

  @override
  String get demoBadgePersonal => 'DEMO · PERSONAL';

  @override
  String get demoBadgeBusiness => 'DEMO · BUSINESS';

  @override
  String get welcomeHeadline => 'Real meetings now last longer.';

  @override
  String get welcomeStart => 'Get started';

  @override
  String get demoProductTitle => 'Product';

  @override
  String get demoAddToCart => 'Get in touch';

  @override
  String get siteCardTitle => 'nfcstore.uz';

  @override
  String get siteCardBody =>
      'NFC cards, physical orders and the full catalog — on the site.';

  @override
  String get siteCardCta => 'Open the site';

  @override
  String get privacyPublicProfile => 'Public profile';

  @override
  String get privacyPublicHint =>
      'When on, your profile appears in Discover and the public catalogue. Turn it off and the profile opens only via a direct link or an NFC card.';

  @override
  String get notifOnDeviceHint => 'Choices are saved on this device.';

  @override
  String get paymentNotConfiguredHint =>
      'Online payment is not available yet. Try again later or order from the website.';

  @override
  String get profileCover => 'Cover';

  @override
  String get themeOnyx => 'Onyx';

  @override
  String get registerTosRequired =>
      'Accept the public offer terms to continue.';

  @override
  String get registerTosPrefix => 'By signing up I accept the ';

  @override
  String get registerTosLink => 'public offer';

  @override
  String get registerTosSuffix => ' terms.';

  @override
  String get activityFollowed => 'followed you';

  @override
  String get activityLiked => 'liked your post';

  @override
  String get activityCommented => 'commented on your post';

  @override
  String get activityMarkAll => 'Mark all as read';

  @override
  String get nfcWrite => 'Write to NFC card';

  @override
  String get nfcWriteSubtitle =>
      'Turn any rewritable NFC card or sticker into your profile';

  @override
  String get nfcWriteChooseId => 'Which profile to write';

  @override
  String get nfcWriteNoId =>
      'Create an NFC ID first — a profile is needed to write';

  @override
  String get nfcWriteUrlLabel => 'Will be written';

  @override
  String get nfcWriteStepCheck => 'Step 1 — check the card';

  @override
  String get nfcWriteStepCheckHint =>
      'Hold the card to the back of your phone. Nothing is written yet.';

  @override
  String get nfcWriteCheckAction => 'Check the card';

  @override
  String get nfcWriteStepWrite => 'Step 2 — write';

  @override
  String get nfcWriteStepWriteHint => 'Hold the same card again.';

  @override
  String get nfcWriteAction => 'Write to card';

  @override
  String get nfcWriteAgain => 'Write to another card';

  @override
  String get nfcWriteChecking => 'Looking for a card…';

  @override
  String get nfcWriteWriting => 'Writing…';

  @override
  String get nfcWriteVerifying => 'Verifying…';

  @override
  String get nfcWriteEmptyTag => 'The card is empty — safe to write';

  @override
  String get nfcWriteTagHasData => 'This card already holds data';

  @override
  String get nfcWriteOverwriteTitle => 'The data on the card will be erased';

  @override
  String get nfcWriteOverwriteBody =>
      'Writing erases the data below completely and replaces it with your profile. This cannot be undone.';

  @override
  String get nfcWriteOverwriteConfirm => 'Yes, overwrite';

  @override
  String nfcWriteCapacity(int size) {
    return 'Card capacity: $size bytes';
  }

  @override
  String get nfcWriteDone => 'Written and verified';

  @override
  String get nfcWriteDoneBody =>
      'Hold the card to a phone and your profile opens.';

  @override
  String get nfcWriteErrTimeout =>
      'No card found. Hold it against the back of the phone, near the camera.';

  @override
  String get nfcWriteErrNotNdef =>
      'This card cannot be written — it does not support the NDEF format';

  @override
  String get nfcWriteErrReadOnly =>
      'This card is locked and cannot be rewritten';

  @override
  String nfcWriteErrTooLarge(int need, int size) {
    return 'The address does not fit on this card ($need bytes needed, $size available)';
  }

  @override
  String get nfcWriteErrDifferentTag =>
      'That is a different card. Hold the one you checked.';

  @override
  String get nfcWriteErrVerify =>
      'The write went through, but reading it back gave a different address. Try again.';

  @override
  String get nfcWriteErrIo =>
      'Lost contact with the card. Keep it still and try again.';

  @override
  String get nfcWriteIosHint =>
      'On iPhone, hold the card near the phone — the system sheet opens.';

  @override
  String get nfcWriteSafety =>
      'Only the public profile address is written. No secret key is ever written to the card.';

  @override
  String get feedSponsored => 'Sponsored';

  @override
  String get homeFeed => 'Feed';

  @override
  String get homeFeedEmpty =>
      'No posts yet. Posts from people you follow will appear here.';

  @override
  String get homeFeedMore => 'See all';

  @override
  String get featuredTitle => 'Boost in feed';

  @override
  String get featuredIntro =>
      'Your post sits at the very top of the feed for the chosen period.';

  @override
  String get featuredPick => 'Choose a period';

  @override
  String featuredDays(int days) {
    return '$days days';
  }

  @override
  String get featuredBuy => 'Go to payment';

  @override
  String get featuredPaymentOff =>
      'Payments are temporarily disabled. Please try later.';

  @override
  String get featuredPending => 'Awaiting payment';

  @override
  String get featuredPendingHint =>
      'Once payment is confirmed the post moves to the top. Refresh the page.';

  @override
  String get featuredActive => 'In the feed';

  @override
  String featuredDaysLeft(int days) {
    return '$days days left';
  }

  @override
  String get featuredMine => 'My boosted posts';

  @override
  String get featuredNone => 'No boosted posts yet.';

  @override
  String get featuredCancel => 'Cancel';

  @override
  String get featuredCancelConfirm => 'Cancel the unpaid request?';

  @override
  String get featuredAlready => 'This post is already boosted.';

  @override
  String get featuredTooMany => 'At most 3 posts can be boosted at once.';

  @override
  String get featuredNotYours => 'You can only boost your own post.';

  @override
  String get featuredOpenPayment =>
      'The payment page did not open. Open the link in a browser.';

  @override
  String get featuredStopped => 'Stopped by admin';

  @override
  String get featuredExpired => 'Expired';
}
