import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/utils/validators.dart';
import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';
import '../../design/widgets/edit_section.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../discover/listing_labels.dart';
import '../home/widgets/identity_card.dart' show formatCount;
import '../profile/profile_repository.dart' show profileRepositoryProvider;
import '../social/media_frame.dart' show mediaImage;
import '../profile/contact_editor.dart';
import '../../core/utils/media_url.dart';
import 'business_providers.dart';
import 'business_screens.dart';
import '../shop/store_policy.dart';

/// Backend qabul qiladigan yo'nalishlar (`COMPANY_V2_CATEGORIES`).
///
/// Ro'yxat ilovada TO'QILMAYDI — u backend'dagi to'plam bilan bir xil,
/// aks holda "bad_company_id" xatosi chiqardi.
const kBusinessCategories = [
  'restaurant', 'cafe', 'market', 'shop', 'services',
  'construction', 'clinic', 'pharmacy', 'education', 'other',
];

/// Yo'nalish nomi — foydalanuvchi tilida.
///
/// Ilgari chiplarda XOM kalit turardi (`restaurant`, `cafe`,
/// `construction`) — tester skrinshotida aynan shunday ko'rindi.
/// Kalit serverga o'zgarmasdan ketadi, faqat KO'RINISHI tarjima.
String businessCategoryLabel(L l, String slug) => switch (slug) {
      'restaurant' => l.bizCatRestaurant,
      'cafe' => l.bizCatCafe,
      'market' => l.bizCatMarket,
      'shop' => l.bizCatShop,
      'services' => l.bizCatServices,
      'construction' => l.bizCatConstruction,
      'clinic' => l.bizCatClinic,
      'pharmacy' => l.bizCatPharmacy,
      'education' => l.bizCatEducation,
      _ => l.bizCatOther,
    };

/// Maxsus nom: 3–15 lotin harfi, shuningdek O' va G'.
///
/// Server qoidasi (`hosting/worker.js` -> `companyId()`). Ilgari bu
/// yerda `[a-z0-9_-]` turardi: raqam va chiziqcha yozish mumkin edi,
/// server esa ularni jimgina OLIB TASHLAB boshqa nomni tekshirardi —
/// odam "nfc2" deb yozib, aslida "NFC" ni tekshirgan bo'lardi.
final _companyIdChars = RegExp(r"[A-Za-z'ʻʼ‘’]");

/// Biznes ochish — ikki rejim.
///
///   * BEPUL ([custom] = false) — manzil maydoni YO'Q. Server
///     `auto: true` bilan tasodifiy, bepul Business ID beradi va
///     to'lov talab qilmaydi. Tester "free biznes yo'q" degan
///     edi: server buni qo'llardi, ilova esa bu yo'lni umuman
///     ko'rsatmasdi.
///   * MAXSUS NOM ([custom] = true) — faqat TEKSHIRUV: nom bo'shmi va
///     narxi qancha. Yaratish tugmasi YO'Q — xarid saytda, ilovada
///     to'lov bo'lmaydi (`store_policy.dart`).
class BusinessOnboardScreen extends ConsumerStatefulWidget {
  const BusinessOnboardScreen({super.key, this.custom = false});

  final bool custom;

  @override
  ConsumerState<BusinessOnboardScreen> createState() =>
      _BusinessOnboardScreenState();
}

class _BusinessOnboardScreenState extends ConsumerState<BusinessOnboardScreen> {
  final _id = TextEditingController();
  final _name = TextEditingController();
  final _city = TextEditingController();
  final _phone = TextEditingController();
  final _description = TextEditingController();

  String _category = 'other';
  Timer? _check;
  bool? _available;
  bool _checking = false;
  int _price = 0;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Tavsif hisoblagichi yozilgan sari yangilansin.
    _description.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _check?.cancel();
    _id.dispose();
    _name.dispose();
    _city.dispose();
    _phone.dispose();
    _description.dispose();
    super.dispose();
  }

  /// Manzil bo'shligini tekshirish — har harfda emas, tinchlikdan keyin.
  void _onIdChanged(String v) {
    _check?.cancel();
    setState(() {
      _available = null;
      _price = 0;
    });
    if (v.trim().length < 3) return;
    _check = Timer(const Duration(milliseconds: 450), () async {
      setState(() => _checking = true);
      final res =
          await ref.read(businessRepositoryProvider).checkId(v.trim());
      if (!mounted) return;
      setState(() {
        _checking = false;
        res.when(
          ok: (r) {
            _available = r.valid && r.available;
            _price = r.price;
          },
          err: (_) => _available = null,
        );
      });
    });
  }

  Future<void> _createFree() async {
    final l = L.of(context);
    if (Validate.required(_name.text) != null ||
        Validate.required(_city.text) != null ||
        Validate.phone(_phone.text) != null) {
      setState(() => _error = l.errRequired);
      return;
    }
    // Server 20 belgidan qisqa tavsifni rad etadi. Ilgari xato umumiy
    // "maydonlarni to'ldiring" edi — odam tavsifni YOZGAN bo'lsa ham
    // nima yetishmayotganini bilmasdi.
    if (_description.text.trim().length < 20) {
      setState(() => _error = l.bizDescriptionMin);
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(businessRepositoryProvider).create({
      // BEPUL YO'L: nom yuborilmaydi, server o'zi beradi.
      'auto': true,
      'companyId': '',
      'displayName': _name.text.trim(),
      'category': _category,
      'city': _city.text.trim(),
      'phone': Validate.normalizePhone(_phone.text),
      'description': _description.text.trim(),
    });
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (b) {
        ref.invalidate(myBusinessesProvider);
        rememberBusiness(ref, b.companyId);
        context.go(Routes.businessDashboard);
      },
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return NovaScaffold(
      title: widget.custom ? l.bizPremiumTitle : l.bizFreeTitle,
      showBack: true,
      body: NovaScroll(
        children: widget.custom ? _customChildren(l) : _freeChildren(l),
      ),
    );
  }

  List<Widget> _freeChildren(L l) {
    final t = context.tokens;
    final desc = _description.text.trim().length;
    return [
      // Nom so'ralmasligining SABABI ko'rinib tursin — aks holda odam
      // "manzilimni qayerga yozaman" deb qidiradi.
      Container(
        padding: const EdgeInsets.symmetric(
            horizontal: Gap.lg, vertical: Gap.md),
        decoration: BoxDecoration(
          color: t.surface2,
          borderRadius: R.gentle,
        ),
        child: Row(
          children: [
            Icon(Icons.auto_awesome_outlined, size: 18, color: t.brandInk),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Text(l.bizFreeIdNote,
                  style: Theme.of(context).textTheme.bodyMedium),
            ),
          ],
        ),
      ),
      const SizedBox(height: Gap.xl),
      NovaField(label: l.bizName, controller: _name, enabled: !_busy),
      const SizedBox(height: Gap.lg),
      Text(l.bizCategory,
          style: Theme.of(context)
              .textTheme
              .labelMedium
              ?.copyWith(color: t.text2)),
      const SizedBox(height: Gap.sm),
      Wrap(
        spacing: Gap.sm,
        runSpacing: Gap.sm,
        children: [
          for (final c in kBusinessCategories)
            Capsule(
              label: businessCategoryLabel(l, c),
              dense: true,
              selected: _category == c,
              onTap: _busy ? null : () => setState(() => _category = c),
            ),
        ],
      ),
      const SizedBox(height: Gap.lg),
      NovaField(label: l.bizCity, controller: _city, enabled: !_busy),
      const SizedBox(height: Gap.lg),
      PhoneField(label: l.fieldPhone, controller: _phone),
      const SizedBox(height: Gap.lg),
      NovaField(
        label: l.bizDescription,
        controller: _description,
        maxLines: 4,
        maxLength: 1200,
        enabled: !_busy,
      ),
      const SizedBox(height: 6),
      Text(
        '${l.bizDescriptionMin} · ${desc.clamp(0, 20)}/20',
        style: AppType.monoStyle(
          color: desc >= 20 ? t.success : t.text3,
          size: 11,
          letterSpacing: .3,
        ),
      ),
      if (_error != null) ...[
        const SizedBox(height: Gap.lg),
        Text(_error!,
            textAlign: TextAlign.center,
            style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: t.error)),
      ],
      const SizedBox(height: Gap.xxl),
      NovaButton(
        key: const ValueKey('biz-create-free'),
        label: l.bizFreeCta,
        busy: _busy,
        onPressed: _createFree,
      ),
      const SizedBox(height: Gap.md),
      Text(l.bizReviewNote,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: Gap.xxl),
    ];
  }

  List<Widget> _customChildren(L l) {
    final t = context.tokens;
    return [
      Text(l.bizPremiumHint, style: Theme.of(context).textTheme.bodyMedium),
      const SizedBox(height: Gap.xl),
      NovaField(
        label: l.bizId,
        controller: _id,
        hint: 'NOMINGIZ',
        technical: true,
        onChanged: _onIdChanged,
        inputFormatters: [
          FilteringTextInputFormatter.allow(_companyIdChars),
          LengthLimitingTextInputFormatter(17),
          _UpperCase(),
        ],
        suffix: _checking
            ? const Padding(
                padding: EdgeInsets.all(14),
                child: SizedBox(
                    width: 15,
                    height: 15,
                    child: CircularProgressIndicator(strokeWidth: 2)),
              )
            : _available == null
                ? null
                : Icon(
                    _available!
                        ? Icons.check_circle_rounded
                        : Icons.cancel_rounded,
                    color: _available! ? t.success : t.error,
                    size: 19,
                  ),
      ),
      const SizedBox(height: Gap.sm),
      Text(
        'nfcstore.uz/c/${_id.text.isEmpty ? 'NOMINGIZ' : _id.text}',
        style: AppType.monoStyle(color: t.text3, size: 12),
      ),
      if (_available != null) ...[
        const SizedBox(height: Gap.md),
        Row(
          children: [
            Capsule(
              label: _available! ? l.bizIdFree : l.bizIdTaken,
              dense: true,
              selected: _available!,
              tone: _available! ? t.success : t.error,
            ),
            if (_available! && _price > 0) ...[
              const SizedBox(width: Gap.sm),
              Text(formatMoney(_price, 'UZS'),
                  style: AppType.monoStyle(color: t.text1, size: 13)),
            ],
          ],
        ),
      ],
      const SizedBox(height: Gap.xl),
      // XARID SAYTDA — manzil MATN, havola emas (Play qoidasi).
      StoreNotice(text: l.storeBuyOnSiteBizName),
      const SizedBox(height: Gap.xxl),
    ];
  }
}

/// Maxsus nom katta harflarda yoziladi — server ham shunday saqlaydi.
class _UpperCase extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
          TextEditingValue oldValue, TextEditingValue newValue) =>
      newValue.copyWith(text: newValue.text.toUpperCase());
}

class BusinessEditScreen extends ConsumerStatefulWidget {
  const BusinessEditScreen({super.key});

  @override
  ConsumerState<BusinessEditScreen> createState() => _BusinessEditScreenState();
}

class _BusinessEditScreenState extends ConsumerState<BusinessEditScreen> {
  final _name = TextEditingController();
  final _city = TextEditingController();
  final _description = TextEditingController();

  bool _filled = false;
  bool _busy = false;
  bool _uploading = false;
  String? _error;

  /// Logotip va muqova — ilgari ilovada umuman o'zgartirib
  /// bo'lmasdi (faqat saytda). Serverga NISBIY yo'l ketadi.
  String _logoUrl = '';
  String _coverUrl = '';

  /// Telefon, Telegram, WhatsApp, Instagram, Facebook, sayt, manzil,
  /// qo'shimcha havolalar — `ContactEditor` yangilaydi.
  ContactInfo? _contact;

  @override
  void dispose() {
    for (final c in [_name, _city, _description]) {
      c.dispose();
    }
    super.dispose();
  }

  void _fillOnce(Business b) {
    if (_filled) return;
    _filled = true;
    _name.text = b.displayName;
    _city.text = b.city;
    _description.text = b.description;
    _logoUrl = b.logoUrl;
    _coverUrl = b.coverUrl;
    _contact = b.contact;
  }

  Future<void> _pick({required bool cover}) async {
    final l = L.of(context);
    final path = await ref.read(listingImagePickerProvider)();
    if (path == null || !mounted) return;
    setState(() {
      _uploading = true;
      _error = null;
    });
    final res = await ref
        .read(profileRepositoryProvider)
        .uploadImage(path, kind: cover ? 'cover' : null);
    if (!mounted) return;
    setState(() {
      _uploading = false;
      res.when(
        ok: (url) {
          if (url.isEmpty) {
            _error = l.uploadFailed;
          } else if (cover) {
            _coverUrl = mediaUrl(url);
          } else {
            _logoUrl = mediaUrl(url);
          }
        },
        err: (e) => _error = describeError(l, e),
      );
    });
  }

  Future<void> _save(Business b) async {
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(businessRepositoryProvider).update(b.companyId, {
      'displayName': _name.text.trim(),
      'city': _city.text.trim(),
      'description': _description.text.trim(),
      if (_logoUrl.isNotEmpty) 'logoUrl': storageUrl(_logoUrl),
      if (_coverUrl.isNotEmpty) 'coverUrl': storageUrl(_coverUrl),
      ...(_contact ?? b.contact).toCompanyJson(),
    });
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (_) {
        ref.invalidate(myBusinessesProvider);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l.profileSaved)));
        context.pop();
      },
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  Widget _imageTile({
    required String label,
    required String url,
    required bool cover,
  }) {
    final t = context.tokens;
    return PressableScale(
      key: ValueKey(cover ? 'biz-cover' : 'biz-logo'),
      onTap: _busy || _uploading ? null : () => _pick(cover: cover),
      child: Column(
        children: [
          Container(
            width: cover ? 150 : 88,
            height: 88,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: t.surface2,
              shape: cover ? BoxShape.rectangle : BoxShape.circle,
              borderRadius: cover ? R.gentle : null,
              border: Border.all(color: t.border1),
            ),
            child: url.isEmpty
                ? Icon(Icons.add_photo_alternate_outlined, color: t.text3)
                : mediaImage(context, url, fit: BoxFit.cover),
          ),
          const SizedBox(height: 6),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final b = ref.watch(activeBusinessProvider);
    if (b == null) {
      return NovaScaffold(
        showBack: true,
        body: StatePanel(icon: Icons.storefront_outlined, title: l.bizNone),
      );
    }
    _fillOnce(b);

    return NovaScaffold(
      title: l.actionEdit,
      showBack: true,
      body: NovaScroll(
        children: [
          // ── 1. LOGOTIP VA MUQOVA (sayt bilan teng) ──────────
          EditSection(
            key: const ValueKey('edit-section-brand'),
            title: l.editBrandSection,
            icon: Icons.image_outlined,
            gap: Gap.md,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _imageTile(label: l.bizLogo, url: _logoUrl, cover: false),
                  const SizedBox(width: Gap.xl),
                  _imageTile(label: l.bizCover, url: _coverUrl, cover: true),
                ],
              ),
              if (_uploading) const LinearProgressIndicator(minHeight: 2),
            ],
          ),
          const SizedBox(height: Gap.xxl),
          // ── 2. ASOSIY MA'LUMOT ──────────────────────────────
          EditSection(
            key: const ValueKey('edit-section-basics'),
            title: l.editBasicsSection,
            icon: Icons.storefront_outlined,
            children: [
              NovaField(label: l.bizName, controller: _name, enabled: !_busy),
              NovaField(label: l.bizCity, controller: _city, enabled: !_busy),
              NovaField(
                label: l.bizDescription,
                controller: _description,
                maxLines: 4,
                maxLength: 1200,
                enabled: !_busy,
              ),
            ],
          ),
          const SizedBox(height: Gap.xxl),
          // ── 3. ALOQA VA HAVOLALAR ───────────────────────────
          EditSection(
            key: const ValueKey('edit-section-contact'),
            title: l.editContactSection,
            icon: Icons.link_rounded,
            hint: l.editContactHint,
            children: [
              ContactEditor(
                key: const ValueKey('contact-editor'),
                initial: b.contact,
                business: true,
                enabled: !_busy,
                onChanged: (c) => _contact = c,
              ),
            ],
          ),
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: context.tokens.error)),
          ],
          // "Saqlash" pastki panelda (doim ko'rinadi) — ro'yxat oxiri
          // uning ostida qolmasin.
          const SizedBox(height: 96),
        ],
      ),
      bottomNav: EditSaveBar(
        child: NovaButton(
              label: l.actionSave,
              busy: _busy,
              onPressed: _uploading ? null : () => _save(b)),
      ),
    );
  }
}

/// Katalog boshqaruvi.
class BusinessCatalogScreen extends ConsumerWidget {
  const BusinessCatalogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final b = ref.watch(activeBusinessProvider);

    if (b == null) {
      return NovaScaffold(
        title: l.bizCatalog,
        showBack: true,
        body: StatePanel(icon: Icons.storefront_outlined, title: l.bizNone),
      );
    }

    final catalog = ref.watch(businessCatalogProvider(b.companyId));
    final count = catalog.valueOrNull?.length ?? 0;
    final atLimit = b.plan.atLimit(count);

    // LIMITGA YETGANDA forma ochilmaydi: server baribir 409 qaytarardi
    // va odam hamma narsani yozib bo'lgach "xato" ko'rardi. Buning
    // o'rniga OLDINDAN nima qilish kerakligi aytiladi.
    void add() {
      if (atLimit) {
        showModalBottomSheet<void>(
          context: context,
          useRootNavigator: true,
          showDragHandle: true,
          isScrollControlled: true,
          backgroundColor: context.tokens.surfaceSolid,
          builder: (_) => SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                  Gap.screenX, 0, Gap.screenX, Gap.xl),
              child: BusinessPlanCard(plan: b.plan, count: count),
            ),
          ),
        );
        return;
      }
      context.push(Routes.businessProductNew);
    }

    return NovaScaffold(
      title: l.bizCatalog,
      showBack: true,
      actions: [
        NovaIconButton(
          key: const ValueKey('catalog-add'),
          icon: Icons.add_rounded,
          tooltip: l.bizAddProduct,
          filled: !atLimit,
          onPressed: add,
        ),
        const SizedBox(width: Gap.sm),
      ],
      body: catalog.when(
        loading: () => const SkeletonList(count: 4),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(businessCatalogProvider(b.companyId))),
        data: (items) => items.isEmpty && !b.plan.limited
            ? StatePanel(
                icon: Icons.inventory_2_outlined,
                title: l.bizCatalogEmpty,
                message: l.stateEmptyHint,
                actionLabel: l.bizAddProduct,
                onAction: add,
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                    Gap.screenX, Gap.md, Gap.screenX, 120),
                itemCount: items.length + 1,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                itemBuilder: (context, i) {
                  if (i == 0) {
                    return BusinessPlanCard(plan: b.plan, count: items.length);
                  }
                  final item = items[i - 1];
                  return CatalogTile(
                    item: item,
                    onTap: () => context.push(Routes.businessProduct(item.key)),
                    trailing: NovaIconButton(
                      icon: Icons.delete_outline_rounded,
                      tooltip: l.actionDelete,
                      size: 36,
                      onPressed: () async {
                        final res = await ref
                            .read(businessRepositoryProvider)
                            .deleteItem(b.companyId, item.key);
                        if (!context.mounted) return;
                        res.when(
                          ok: (_) => ref
                              .invalidate(businessCatalogProvider(b.companyId)),
                          err: (e) => ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(describeError(l, e)))),
                        );
                      },
                    ),
                  );
                },
              ),
      ),
    );
  }
}

/// Tarif kartasi: nechta tovar qo'yilgan, limit, keyingi qadam.
///
/// PLAY QOIDASI: Premium va nom RAQAMLI xizmat — ilovada xarid tugmasi
/// ham, saytga bosiladigan havola ham YO'Q ([StoreNotice] — faqat matn).
class BusinessPlanCard extends StatelessWidget {
  const BusinessPlanCard({super.key, required this.plan, required this.count});

  final CompanyPlan plan;
  final int count;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    if (plan.trialActive) {
      return Row(
        key: const ValueKey('plan-trial'),
        children: [
          Icon(Icons.auto_awesome_rounded, size: 16, color: t.brandInk),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(l.bizPlanTrial,
                style: Theme.of(context).textTheme.bodySmall),
          ),
        ],
      );
    }
    if (!plan.limited) return const SizedBox.shrink();

    final limit = plan.itemLimit!;
    final full = plan.atLimit(count);
    return FloatingSurface(
      key: const ValueKey('plan-card'),
      solid: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  plan.premium
                      ? l.bizPlanPremiumTitle(limit)
                      : l.bizPlanFreeTitle(limit),
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
              Text(
                l.bizPlanUsage(count, limit),
                key: const ValueKey('plan-usage'),
                style: AppType.monoStyle(
                    color: full ? t.error : t.text2, size: 12),
              ),
            ],
          ),
          const SizedBox(height: Gap.sm),
          ClipRRect(
            borderRadius: R.pill,
            child: LinearProgressIndicator(
              value: (count / limit).clamp(0.0, 1.0),
              minHeight: 6,
              backgroundColor: t.surface2,
              color: full ? t.error : t.brandInk,
            ),
          ),
          if (full) ...[
            const SizedBox(height: Gap.md),
            Text(
              l.bizPlanLimitReached,
              key: const ValueKey('plan-limit-reached'),
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: t.error,
              ),
            ),
          ],
          const SizedBox(height: Gap.md),
          // Premium qancha berishini SERVER aytadi. Eski server buni
          // bilmaydi — o'shanda Premium haqida va'da berilmaydi.
          Text(
            plan.free && plan.premiumItemLimit != null
                ? l.bizPlanFreeBody(plan.premiumItemLimit!)
                : l.bizPlanPremiumBody,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: Gap.md),
          StoreNotice(text: l.bizPlanStoreNotice),
        ],
      ),
    );
  }
}

/// Listing rasmi tanlash — testda almashtiriladi (haqiqiy galereya
/// platforma kanali, widget testida ochilmaydi). `null` — bekor qilindi.
final listingImagePickerProvider = Provider<Future<String?> Function()>(
  (ref) => () async {
    final f = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      // Yuklashdan OLDIN kichraytiriladi (composer bilan bir xil).
      maxWidth: 1600,
      imageQuality: 85,
    );
    return f?.path;
  },
);

/// NFCSTORE sub-turlari uchun bo'lim matni. SAYT `category` ni o'z
/// sahifasida filtr sifatida ko'rsatadi — shuning uchun slug emas,
/// odam o'qiydigan matn yoziladi (kalit so'z bo'yicha baribir NFC
/// sub-turi bo'lib taniladi).
const _nfcSection = <NfcProductType, String>{
  NfcProductType.card: 'NFC karta',
  NfcProductType.sticker: 'NFC stiker',
  NfcProductType.keychain: 'NFC brelok',
  NfcProductType.accessory: 'NFC aksessuar',
};

/// Listing (mahsulot yoki xizmat) qo'shish / tahrirlash.
///
/// UMUMIY KATALOG: har qanday biznes istalgan qonuniy mahsulot yoki
/// xizmatni joylaydi — nom, rasmlar, narx / aksiya narxi yoki "Narx
/// kelishiladi" (faqat xizmat), tavsif, global kategoriya, o'z bo'limi
/// va mavjudlik. NFC sub-turlari (karta, stiker...) FAQAT NFCSTORE
/// biznesida ko'rinadi.
class BusinessProductFormScreen extends ConsumerStatefulWidget {
  const BusinessProductFormScreen({super.key, this.itemId});

  /// `null` — yangi listing. Aks holda `CatalogItem.key` (server UUID).
  final String? itemId;

  @override
  ConsumerState<BusinessProductFormScreen> createState() =>
      _BusinessProductFormScreenState();
}

class _BusinessProductFormScreenState
    extends ConsumerState<BusinessProductFormScreen> {
  final _name = TextEditingController();
  final _description = TextEditingController();
  final _price = TextEditingController();
  final _salePrice = TextEditingController();
  final _section = TextEditingController();

  ListingKind _kind = ListingKind.product;
  bool _available = true;
  bool _priceOnRequest = false;
  MarketCategory? _market;
  NfcProductType? _sub;
  List<String> _images = [];
  bool _uploading = false;
  bool _filled = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _price.dispose();
    _salePrice.dispose();
    _section.dispose();
    super.dispose();
  }

  void _fillOnce(CatalogItem? item) {
    if (_filled || item == null) return;
    _filled = true;
    _name.text = item.name;
    _description.text = item.description;
    _price.text = item.price == 0 ? '' : '${item.price}';
    _salePrice.text = (item.salePrice ?? 0) == 0 ? '' : '${item.salePrice}';
    _kind = item.kind;
    _available = item.available;
    _priceOnRequest = item.isService && item.priceOnRequest;
    _market = item.marketCategory;
    _sub = item.sub;
    _images = [...item.images];
    _section.text = _sub != null ? '' : item.category;
  }

  int _maxImages(Business b) => b.catalogSchema >= 2 ? 6 : 1;

  Future<void> _addImage(Business b) async {
    final l = L.of(context);
    final path = await ref.read(listingImagePickerProvider)();
    if (path == null || !mounted) return;
    setState(() {
      _uploading = true;
      _error = null;
    });
    final res = await ref.read(profileRepositoryProvider).uploadImage(path);
    if (!mounted) return;
    setState(() {
      _uploading = false;
      res.when(
        ok: (url) {
          if (url.isEmpty) {
            _error = l.uploadFailed;
          } else if (_maxImages(b) == 1) {
            _images = [url];
          } else {
            _images = [..._images, url];
          }
        },
        err: (e) => _error = describeError(l, e),
      );
    });
  }

  Future<void> _save(Business b) async {
    final l = L.of(context);
    if (Validate.required(_name.text) != null) {
      setState(() => _error = l.errRequired);
      return;
    }
    final price = int.tryParse(_price.text.replaceAll(RegExp(r'\D'), '')) ?? 0;
    final sale =
        int.tryParse(_salePrice.text.replaceAll(RegExp(r'\D'), '')) ?? 0;
    final onRequest = _kind == ListingKind.service && _priceOnRequest;
    // Mahsulotda narx majburiy; xizmatda "Narx kelishiladi" bo'lmasa ham.
    if (!onRequest && price <= 0) {
      setState(() => _error = l.bizPriceRequired);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });

    final section = _sub != null ? _nfcSection[_sub]! : _section.text.trim();
    final body = {
      'name': _name.text.trim(),
      'description': _description.text.trim(),
      'price': onRequest ? 0 : price,
      // SERVER `promotionPrice` KUTADI. 0 — chegirma yo'q (null bilan
      // tozalanadi).
      'promotionPrice': !onRequest && sale > 0 ? sale : null,
      'salePrice': onRequest ? 0 : sale,
      'category': section,
      'available': _available,
      'imageUrl': _images.isEmpty ? '' : _images.first,
      // Qo'shimcha maydonlar — eski server ularni e'tiborsiz qoldiradi,
      // shuning uchun forma ularni faqat `catalogSchema >= 2` da
      // ko'rsatadi (yuqoridagi izoh). Yuborish zararsiz.
      'kind': _kind.name,
      'type': _kind.name,
      if (_market != null) 'marketCategory': _market!.name,
      'images': _images,
      'priceOnRequest': onRequest,
    };

    final repo = ref.read(businessRepositoryProvider);
    final res = widget.itemId == null
        ? await repo.addItem(b.companyId, body).then((r) => r.map((_) => null))
        : await repo
            .updateItem(b.companyId, widget.itemId!, body)
            .then((r) => r.map((_) => null));

    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (_) {
        ref.invalidate(businessCatalogProvider(b.companyId));
        context.pop();
      },
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  Widget _label(BuildContext context, String text, [String? hint]) {
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(text, style: Theme.of(context).textTheme.labelMedium),
        if (hint != null) ...[
          const SizedBox(height: 2),
          Text(hint,
              style: TextStyle(
                  fontFamily: AppType.sans, fontSize: 12, color: t.text3)),
        ],
        const SizedBox(height: Gap.sm),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final b = ref.watch(activeBusinessProvider);
    if (b == null) {
      return NovaScaffold(
        showBack: true,
        body: StatePanel(icon: Icons.storefront_outlined, title: l.bizNone),
      );
    }

    if (widget.itemId != null) {
      final items = ref.watch(businessCatalogProvider(b.companyId)).valueOrNull;
      _fillOnce(items?.where((e) => e.key == widget.itemId).firstOrNull);
    }

    final full = b.catalogSchema >= 2;
    final market = _market ??
        MarketCategory.infer(null, b.category, _section.text, _name.text);
    final isNfcStore = b.companyId.toUpperCase() == 'NFCSTORE';
    final maxImages = _maxImages(b);
    final onRequest = _kind == ListingKind.service && _priceOnRequest;

    return NovaScaffold(
      title: widget.itemId != null
          ? l.actionEdit
          : _kind == ListingKind.service
              ? l.bizAddService
              : l.bizAddProduct,
      showBack: true,
      body: NovaScroll(
        children: [
          _label(context, l.bizListingKind),
          Row(
            children: [
              for (final k in ListingKind.values) ...[
                if (k != ListingKind.values.first) const SizedBox(width: Gap.sm),
                Capsule(
                  key: ValueKey('listing-kind-${k.name}'),
                  label: kindLabel(l, k),
                  icon: kindIcon(k),
                  selected: _kind == k,
                  onTap: _busy ? null : () => setState(() => _kind = k),
                ),
              ],
            ],
          ),
          const SizedBox(height: Gap.xl),
          NovaField(
            key: const ValueKey('listing-name'),
            label: l.bizProductName,
            controller: _name,
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.lg),
          _label(context, l.bizPhotos),
          SizedBox(
            height: 92,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (var i = 0; i < _images.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(right: Gap.sm),
                    child: _PhotoThumb(
                      key: ValueKey('listing-photo-$i'),
                      url: _images[i],
                      cover: i == 0 && _images.length > 1,
                      coverLabel: l.bizPhotoCover,
                      onRemove: _busy
                          ? null
                          : () => setState(() => _images = [..._images]..removeAt(i)),
                    ),
                  ),
                if (_images.length < maxImages)
                  _AddPhotoTile(
                    key: const ValueKey('listing-add-photo'),
                    label: l.bizAddPhoto,
                    busy: _uploading,
                    onTap: _busy || _uploading ? null : () => _addImage(b),
                  ),
              ],
            ),
          ),
          const SizedBox(height: Gap.lg),
          if (_kind == ListingKind.service) ...[
            FloatingSurface(
              solid: true,
              padding: const EdgeInsets.symmetric(
                  horizontal: Gap.lg, vertical: Gap.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.bizPriceOnRequest,
                            style: Theme.of(context).textTheme.bodyLarge),
                        Text(l.bizPriceOnRequestHint,
                            style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  Switch(
                    key: const ValueKey('listing-price-on-request'),
                    value: _priceOnRequest,
                    activeThumbColor: t.accent2,
                    onChanged: _busy
                        ? null
                        : (v) => setState(() => _priceOnRequest = v),
                  ),
                ],
              ),
            ),
            const SizedBox(height: Gap.lg),
          ],
          if (!onRequest)
            Row(
              children: [
                Expanded(
                  child: NovaField(
                    key: const ValueKey('listing-price'),
                    label: l.bizPrice,
                    controller: _price,
                    keyboardType: TextInputType.number,
                    enabled: !_busy,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  ),
                ),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: NovaField(
                    key: const ValueKey('listing-sale'),
                    label: l.bizSalePrice,
                    controller: _salePrice,
                    keyboardType: TextInputType.number,
                    enabled: !_busy,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  ),
                ),
              ],
            ),
          const SizedBox(height: Gap.lg),
          NovaField(
            label: l.bizDescription,
            controller: _description,
            maxLines: 3,
            maxLength: 600,
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.lg),
          if (full) ...[
            _label(context, l.bizMarketCategory, l.bizMarketCategoryHint),
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: [
                for (final m in MarketCategory.values)
                  Capsule(
                    key: ValueKey('listing-cat-${m.name}'),
                    label: marketLabel(l, m),
                    icon: marketIcon(m),
                    selected: market == m,
                    onTap: _busy
                        ? null
                        : () => setState(() {
                              _market = m;
                              if (m != MarketCategory.electronics) _sub = null;
                            }),
                  ),
              ],
            ),
            const SizedBox(height: Gap.lg),
          ],
          if (isNfcStore && market == MarketCategory.electronics) ...[
            _label(context, l.bizNfcSub),
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: [
                for (final ty in _nfcSection.keys)
                  Capsule(
                    key: ValueKey('nfc-type-${ty.name}'),
                    label: nfcTypeLabel(l, ty),
                    icon: nfcTypeIcon(ty),
                    selected: _sub == ty,
                    onTap: _busy
                        ? null
                        : () => setState(() => _sub = _sub == ty ? null : ty),
                  ),
              ],
            ),
            const SizedBox(height: Gap.lg),
          ],
          if (_sub == null) ...[
            NovaField(
              key: const ValueKey('listing-section'),
              label: l.bizSection,
              hint: l.bizSectionHint,
              controller: _section,
              enabled: !_busy,
              maxLength: 100,
            ),
            const SizedBox(height: Gap.lg),
          ],
          FloatingSurface(
            solid: true,
            padding: const EdgeInsets.symmetric(
                horizontal: Gap.lg, vertical: Gap.sm),
            child: Row(
              children: [
                Expanded(
                    child: Text(l.bizAvailable,
                        style: Theme.of(context).textTheme.bodyLarge)),
                Switch(
                  key: const ValueKey('listing-available'),
                  value: _available,
                  activeThumbColor: t.accent2,
                  onChanged: _busy ? null : (v) => setState(() => _available = v),
                ),
              ],
            ),
          ),
          if (!full) ...[
            const SizedBox(height: Gap.lg),
            Row(
              key: const ValueKey('listing-schema-old'),
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline_rounded, size: 16, color: t.text3),
                const SizedBox(width: Gap.sm),
                Expanded(
                  child: Text(l.bizListingSchemaOld,
                      style: Theme.of(context).textTheme.bodySmall),
                ),
              ],
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(_error!,
                key: const ValueKey('listing-error'),
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: t.error)),
          ],
          const SizedBox(height: Gap.xxl),
          NovaButton(
              key: const ValueKey('listing-save'),
              label: l.actionSave,
              busy: _busy,
              onPressed: _uploading ? null : () => _save(b)),
        ],
      ),
    );
  }
}

class _PhotoThumb extends StatelessWidget {
  const _PhotoThumb({
    super.key,
    required this.url,
    required this.cover,
    required this.coverLabel,
    this.onRemove,
  });
  final String url;
  final bool cover;
  final String coverLabel;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return SizedBox(
      width: 92,
      height: 92,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: R.tile,
            child: mediaImage(context, url, fit: BoxFit.cover),
          ),
          if (cover)
            Positioned(
              left: 6,
              bottom: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: t.text1, borderRadius: R.pill),
                child: Text(coverLabel,
                    style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w700,
                        color: t.bg1)),
              ),
            ),
          Positioned(
            right: 2,
            top: 2,
            child: Semantics(
              button: true,
              label: L.of(context).actionDelete,
              child: GestureDetector(
                onTap: onRemove,
                child: Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: t.surfaceSolid.withValues(alpha: .92),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.close_rounded, size: 15, color: t.text1),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddPhotoTile extends StatelessWidget {
  const _AddPhotoTile({
    super.key,
    required this.label,
    required this.busy,
    this.onTap,
  });
  final String label;
  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 92,
          height: 92,
          decoration: BoxDecoration(
            color: t.surface2,
            borderRadius: R.tile,
            border: Border.all(color: t.border1),
          ),
          child: busy
              ? const Center(
                  child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2)))
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.add_photo_alternate_outlined,
                        size: 22, color: t.text2),
                    const SizedBox(height: 4),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(label,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontFamily: AppType.sans,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: t.text2)),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Biznes tahlili.
class BusinessAnalyticsScreen extends ConsumerWidget {
  const BusinessAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final b = ref.watch(activeBusinessProvider);
    final catalog = b == null
        ? const AsyncValue<List<CatalogItem>>.data([])
        : ref.watch(businessCatalogProvider(b.companyId));
    // HAQIQIY STATISTIKA — `GET /api/companies/:id/stats`.
    //
    // Ilgari bu ekran hech qanday statistika endpointini
    // chaqirmasdi: faqat kompaniya yozuvidagi `views` va obunachilar
    // soni ko'rsatilardi. Repozitoriyadagi `analytics()` esa KARTA
    // yo'liga borardi va 403 olardi — ya'ni haqiqiy raqamlar
    // ilovada umuman ko'rinmagan.
    final stats = b == null
        ? const AsyncValue<Map<String, dynamic>>.data({})
        : ref.watch(businessStatsProvider(b.companyId));

    if (b == null) {
      return NovaScaffold(
        title: l.bizAnalytics,
        showBack: true,
        body: StatePanel(icon: Icons.insights_outlined, title: l.bizNone),
      );
    }

    return NovaScaffold(
      title: l.bizAnalytics,
      showBack: true,
      body: NovaScroll(
        children: [
          // Server 30 kunlik ko'rish/bosish/buyurtma sonini beradi.
          // Yuklanayotganda yoki xato bo'lsa — kompaniya yozuvidagi
          // umumiy `views` ko'rsatiladi, ya'ni ekran hech qachon
          // bo'sh qolmaydi.
          stats.when(
            loading: () => Row(
              children: const [
                Expanded(child: Skeleton(height: 70, radius: R.gentle)),
                SizedBox(width: Gap.md),
                Expanded(child: Skeleton(height: 70, radius: R.gentle)),
              ],
            ),
            error: (_, __) => Row(
              children: [
                Expanded(
                  child: _Tile(
                      label: l.nfcViews,
                      value: formatCount(b.views),
                      tone: t.accentB),
                ),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: _Tile(
                      label: l.profileFollowers,
                      value: formatCount(b.followers),
                      tone: t.accentC),
                ),
              ],
            ),
            data: (m) {
              final views = m['views'] is int ? m['views'] as int : b.views;
              final taps = m['taps'] is int ? m['taps'] as int : 0;
              final orders = m['orders'] is int ? m['orders'] as int : 0;
              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _Tile(
                            label: l.nfcViews,
                            value: formatCount(views),
                            tone: t.accentB),
                      ),
                      const SizedBox(width: Gap.md),
                      Expanded(
                        child: _Tile(
                            label: l.profileFollowers,
                            value: formatCount(b.followers),
                            tone: t.accentC),
                      ),
                    ],
                  ),
                  const SizedBox(height: Gap.md),
                  Row(
                    children: [
                      Expanded(
                        child: _Tile(
                            label: l.bizTaps,
                            value: formatCount(taps),
                            tone: t.accent1),
                      ),
                      const SizedBox(width: Gap.md),
                      Expanded(
                        child: _Tile(
                            label: l.orders,
                            value: formatCount(orders),
                            tone: t.accentD),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: Gap.md),
          catalog.when(
            loading: () => const Skeleton(height: 70, radius: R.gentle),
            error: (_, __) => const SizedBox.shrink(),
            data: (items) => Row(
              children: [
                Expanded(
                  child: _Tile(
                      label: l.bizProducts,
                      value: '${items.where((e) => !e.isService).length}',
                      tone: t.accentD),
                ),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: _Tile(
                      label: l.bizServices,
                      value: '${items.where((e) => e.isService).length}',
                      tone: t.accent1),
                ),
              ],
            ),
          ),
          SectionHeader(title: l.bizCatalog),
          catalog.when(
            loading: () => const SkeletonList(count: 3),
            error: (e, __) => StatePanel.fromError(context, asAppError(e)),
            data: (items) => items.isEmpty
                ? FloatingSurface(
                    solid: true,
                    child: Text(l.bizCatalogEmpty,
                        style: Theme.of(context).textTheme.bodyMedium),
                  )
                : Column(
                    children: [
                      for (final item in items.take(8))
                        Padding(
                          padding: const EdgeInsets.only(bottom: Gap.sm),
                          child: FloatingSurface(
                            solid: true,
                            padding: const EdgeInsets.all(Gap.md),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(item.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyLarge),
                                ),
                                Text(
                                    formatMoney(
                                        item.effectivePrice, item.currency),
                                    style: AppType.monoStyle(
                                        color: t.text2, size: 12)),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.label, required this.value, required this.tone});

  final String label;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: R.gentle,
        border: Border.all(color: tone.withValues(alpha: .3)),
        boxShadow: t.shadowTiny,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value,
              style: Theme.of(context)
                  .textTheme
                  .displayMedium
                  ?.copyWith(fontSize: 26)),
          Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium),
        ],
      ),
    );
  }
}
