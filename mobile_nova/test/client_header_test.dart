import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';

/// `X-Client` PLATFORMAGA MOS.
///
/// Ilgari iPhone ham `android` yuborardi va admin panelda iPhone
/// foydalanuvchilari Android bo'lib ko'rinardi. Server `ios` ni
/// taniydi (token bilan kirish, ro'yxatdan o'tish manbai, statistika).
void main() {
  tearDown(() => debugDefaultTargetPlatformOverride = null);

  String header() {
    final dio = Dio();
    ApiClient(dio: dio);
    return '${dio.options.headers['x-client']}';
  }

  test('iPhone — ios', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    expect(header(), 'ios');
  });

  test('Android — android', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    expect(header(), 'android');
  });

  test('boshqa platforma — eski qiymat android', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.linux;
    expect(header(), 'android');
  });

  test('x-app o‘zgarmadi', () {
    final dio = Dio();
    ApiClient(dio: dio);
    expect(dio.options.headers['x-app'], 'nova');
  });
}
