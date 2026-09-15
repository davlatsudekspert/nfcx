# Vizual preview

Bu papkadagi fayllar `_preview.dart` bilan tugaydi, ya'ni `flutter test`
ularni O'ZI ishga tushirmaydi. Ular tekshiruv emas — dizaynni ko'z
bilan baholash uchun rasm chiqaradi.

Ishga tushirish:

```
flutter test --update-goldens test/preview/screens_preview.dart
flutter test --update-goldens test/preview/components_preview.dart
```

Natija `test/preview/out/` ga yoziladi va git'ga qo'shilmaydi
(`.gitignore`). Haqiqiy vizual tekshiruv — `test/audit/` dagi
goldenlar zimmasida: ular `flutter test` bilan har safar ishlaydi.
