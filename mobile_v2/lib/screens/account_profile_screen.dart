import 'package:flutter/material.dart';

import '../core/session.dart';
import 'business_profile_screen.dart';
import 'profile_screen.dart';

class AccountProfileScreen extends StatelessWidget {
  const AccountProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    if (session.businessMode && session.companies.isNotEmpty) {
      final company = session.activeCompany ?? session.companies.first;
      return BusinessProfileScreen(companyId: company.id, own: true);
    }
    return const ProfileScreen();
  }
}
