/// Barcha marshrut manzillari — bitta joyda.
///
/// NIMA UCHUN: `context.go('/nfc/ids')` kabi qo'lda yozilgan satr bitta
/// harfda xato bo'lsa, xato faqat ISHGA TUSHGANDA bilinadi. Bu yerdagi
/// doimiylar esa kompilyatsiya paytida tekshiriladi.
abstract final class Routes {
  static const splash = '/';
  static const welcome = '/welcome';

  // Auth
  static const login = '/login';
  static const loginVerify = '/login/verify';
  static const register = '/register';
  static const registerVerify = '/register/verify';
  static const profileSetup = '/register/setup';

  // Asosiy tablar
  static const home = '/home';
  static const discover = '/discover';
  static const reels = '/reels';
  static const nfc = '/nfc';
  static const profile = '/profile';

  // Kashfiyot qidiruvi alohida marshrut EMAS: u Discover ekranining
  // ichida yashaydi, shuning uchun bu yerda yo'l yo'q.

  // Social
  static const postCreate = '/post/create';
  static const storyCreate = '/story/create';
  static const reelCreate = '/reel/create';
  static String post(int id) => '/post/$id';
  static String story(String code) => '/story/$code';
  static String user(String code) => '/u/$code';

  // NFC
  static const nfcIds = '/nfc/ids';
  static const nfcScan = '/nfc/scan';
  static const nfcHistory = '/nfc/history';
  static const nfcCards = '/nfc/cards';
  static const nfcSecurity = '/nfc/security';
  static String nfcId(String code) => '/nfc/id/$code';
  static String nfcIdEdit(String code) => '/nfc/id/$code/edit';
  static String nfcGift(String code) => '/nfc/id/$code/gift';

  // Profil
  static const profileEdit = '/profile/edit';

  // Biznes
  static const business = '/business';
  static const businessOnboard = '/business/new';
  static const businessDashboard = '/business/dashboard';
  static const businessEdit = '/business/edit';
  static const businessCatalog = '/business/catalog';
  static const businessAnalytics = '/business/analytics';
  static const businessProductNew = '/business/catalog/new';
  static String businessProduct(int id) => '/business/catalog/$id';
  static String storefront(String companyId) => '/c/$companyId';

  // Do'kon
  static const shop = '/shop';
  static const checkout = '/shop/checkout';
  static const orders = '/orders';
  static String shopProduct(String id) => '/shop/$id';
  static String paymentResult(String state) => '/shop/payment/$state';

  // Boshqalar
  static const activity = '/activity';
  static const settings = '/settings';
  static const settingsSecurity = '/settings/security';
  static const settingsLanguage = '/settings/language';
  static const settingsTheme = '/settings/theme';
  static const settingsNotifications = '/settings/notifications';
  static const settingsPrivacy = '/settings/privacy';
  static const settingsPayment = '/settings/payment';
  static const settingsReferral = '/settings/referral';
  static const settingsPremium = '/settings/premium';
  static const settingsSupport = '/settings/support';
  static const settingsAbout = '/settings/about';
  static const paymentHistory = '/settings/payment/history';
}
