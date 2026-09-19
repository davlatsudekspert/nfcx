/// Ilova bo'ylab yagona xato turi.
///
/// NIMA UCHUN KALIT, MATN EMAS: xato uch tilda ko'rsatiladi. Agar
/// repository o'zbekcha jumla qaytarsa, rus tilidagi foydalanuvchi ham
/// o'zbekcha ko'rardi. Shuning uchun qatlam faqat KALIT qaytaradi,
/// tarjima esa UI qatlamida `L` orqali qilinadi.
enum AppErrorKind {
  offline,
  timeout,
  server,
  unauthorized,
  forbidden,
  notFound,
  validation,
  conflict,
  rateLimited,

  /// Backend'da bu endpoint hali yo'q. Sohta muvaffaqiyat o'rniga shu
  /// holat ko'rsatiladi — `API_GAPS.md` dagi ro'yxat bilan bir xil.
  endpointMissing,
  unknown,
}

class AppError implements Exception {
  const AppError(this.kind, {this.code, this.detail, this.status});

  /// Server qaytargan kalit: `bad_credentials`, `email_taken`, ...
  final String? code;

  /// Faqat tuzatuvchi uchun texnik tafsilot. Ekranda kichik kulrang
  /// qatorda ko'rsatiladi — usiz har xatoda taxmin qilishga to'g'ri kelardi.
  final String? detail;
  final int? status;
  final AppErrorKind kind;

  bool get isAuth => kind == AppErrorKind.unauthorized;
  bool get isOffline => kind == AppErrorKind.offline;

  String get technical => [
        code ?? kind.name,
        if (status != null && status! > 0) 'HTTP $status',
        if ((detail ?? '').isNotEmpty) detail,
      ].join(' · ');

  @override
  String toString() => 'AppError($technical)';
}
