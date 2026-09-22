import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_v2/core/theme.dart';

void main() {
  test('two premium palettes are materially different', () {
    expect(
      BrandPalette.editorial.background,
      isNot(BrandPalette.midnight.background),
    );
    expect(
      BrandPalette.editorial.brightness,
      isNot(BrandPalette.midnight.brightness),
    );
  });

  test('editorial theme stays restrained', () {
    expect(BrandPalette.editorial.hero, BrandPalette.editorial.ink);
    expect(BrandPalette.editorial.accent, isNot(BrandPalette.editorial.ink));
  });
}
