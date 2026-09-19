package uz.nfcstore.nova

import io.flutter.embedding.android.FlutterFragmentActivity

/// `FlutterActivity` EMAS, `FlutterFragmentActivity`.
///
/// `local_auth` biometrik oynani `BiometricPrompt` orqali ochadi va u
/// `FragmentActivity` talab qiladi. Oddiy `FlutterActivity` bilan
/// biometrika `no_fragment_activity` xatosi bilan yiqilardi — ya'ni
/// ilova qulfi faqat PIN bilan ishlagan bo'lardi.
class MainActivity : FlutterFragmentActivity()
