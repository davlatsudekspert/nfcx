import '../errors/app_error.dart';

/// Muvaffaqiyat yoki xato — `try/catch` ni UI qatlamiga chiqarmaslik uchun.
///
/// Repository metodlari istisno OTMAYDI: ular `Result` qaytaradi, shuning
/// uchun har bir chaqiruvda xato holatini hisobga olish MAJBURIY bo'ladi
/// va "unutilgan catch" tufayli ilova qulamaydi.
sealed class Result<T> {
  const Result();

  bool get isOk => this is Ok<T>;
  T? get valueOrNull => this is Ok<T> ? (this as Ok<T>).value : null;
  AppError? get errorOrNull => this is Err<T> ? (this as Err<T>).error : null;

  R when<R>({
    required R Function(T value) ok,
    required R Function(AppError error) err,
  }) =>
      this is Ok<T> ? ok((this as Ok<T>).value) : err((this as Err<T>).error);

  Result<R> map<R>(R Function(T) f) =>
      this is Ok<T> ? Ok(f((this as Ok<T>).value)) : Err((this as Err<T>).error);
}

class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;
}

class Err<T> extends Result<T> {
  const Err(this.error);
  final AppError error;
}
