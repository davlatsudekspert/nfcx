import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/validators.dart';
import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';
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
import '../home/widgets/identity_card.dart' show formatCount;
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
        ref.read(selectedBusinessProvider.notifier).state = b.companyId;
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
  final _address = TextEditingController();
  final _phone = TextEditingController();
  final _telegram = TextEditingController();
  final _website = TextEditingController();
  final _description = TextEditingController();

  bool _filled = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _city, _address, _phone, _telegram, _website, _description]) {
      c.dispose();
    }
    super.dispose();
  }

  void _fillOnce(Business b) {
    if (_filled) return;
    _filled = true;
    _name.text = b.displayName;
    _city.text = b.city;
    _address.text = b.address;
    _phone.text = b.phone;
    _telegram.text = b.telegram;
    _website.text = b.website;
    _description.text = b.description;
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
      'address': _address.text.trim(),
      'phone': _phone.text.trim(),
      'telegram': _telegram.text.trim(),
      'website': _website.text.trim(),
      'description': _description.text.trim(),
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
          NovaField(label: l.bizName, controller: _name, enabled: !_busy),
          const SizedBox(height: Gap.lg),
          NovaField(label: l.bizCity, controller: _city, enabled: !_busy),
          const SizedBox(height: Gap.lg),
          NovaField(label: l.bizAddress, controller: _address, enabled: !_busy),
          const SizedBox(height: Gap.lg),
          NovaField(
            label: l.fieldPhone,
            controller: _phone,
            keyboardType: TextInputType.phone,
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.lg),
          NovaField(label: 'Telegram', controller: _telegram, enabled: !_busy),
          const SizedBox(height: Gap.lg),
          NovaField(
            label: l.bizWebsite,
            controller: _website,
            keyboardType: TextInputType.url,
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.lg),
          NovaField(
            label: l.bizDescription,
            controller: _description,
            maxLines: 4,
            maxLength: 1200,
            enabled: !_busy,
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
          const SizedBox(height: Gap.xxl),
          NovaButton(
              label: l.actionSave, busy: _busy, onPressed: () => _save(b)),
        ],
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

    return NovaScaffold(
      title: l.bizCatalog,
      showBack: true,
      actions: [
        NovaIconButton(
          icon: Icons.add_rounded,
          tooltip: l.bizAddProduct,
          filled: true,
          onPressed: () => context.push(Routes.businessProductNew),
        ),
        const SizedBox(width: Gap.sm),
      ],
      body: catalog.when(
        loading: () => const SkeletonList(count: 4),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(businessCatalogProvider(b.companyId))),
        data: (items) => items.isEmpty
            ? StatePanel(
                icon: Icons.inventory_2_outlined,
                title: l.bizCatalogEmpty,
                message: l.stateEmptyHint,
                actionLabel: l.bizAddProduct,
                onAction: () => context.push(Routes.businessProductNew),
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                    Gap.screenX, Gap.md, Gap.screenX, 120),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                itemBuilder: (context, i) => CatalogTile(
                  item: items[i],
                  onTap: () => context.push(Routes.businessProduct(items[i].key)),
                  trailing: NovaIconButton(
                    icon: Icons.delete_outline_rounded,
                    tooltip: l.actionDelete,
                    size: 36,
                    onPressed: () async {
                      final res = await ref
                          .read(businessRepositoryProvider)
                          .deleteItem(b.companyId, items[i].key);
                      if (!context.mounted) return;
                      res.when(
                        ok: (_) => ref
                            .invalidate(businessCatalogProvider(b.companyId)),
                        err: (e) => ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(describeError(l, e)))),
                      );
                    },
                  ),
                ),
              ),
      ),
    );
  }
}

/// NFC mahsulot turining tarjimasi.
String nfcTypeLabel(L l, NfcProductType t) => switch (t) {
      NfcProductType.card => l.catalogCards,
      NfcProductType.sticker => l.catalogStickers,
      NfcProductType.keychain => l.catalogKeychains,
      NfcProductType.accessory => l.catalogAccessories,
      NfcProductType.other => l.catalogOther,
    };

/// Mahsulot qo'shish / tahrirlash.
class BusinessProductFormScreen extends ConsumerStatefulWidget {
  const BusinessProductFormScreen({super.key, this.itemId});

  /// `null` — yangi mahsulot. Aks holda `CatalogItem.key` (server UUID).
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

  bool _service = false;
  bool _available = true;

  /// NFC mahsulot turi — Tanlov katalogidagi filtr shu bilan ishlaydi.
  NfcProductType _type = NfcProductType.other;
  bool _filled = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _price.dispose();
    _salePrice.dispose();
    super.dispose();
  }

  void _fillOnce(CatalogItem? item) {
    if (_filled || item == null) return;
    _filled = true;
    _name.text = item.name;
    _description.text = item.description;
    _price.text = item.price == 0 ? '' : '${item.price}';
    _salePrice.text = (item.salePrice ?? 0) == 0 ? '' : '${item.salePrice}';
    _service = item.isService;
    _available = item.available;
    _type = item.nfcType;
  }

  Future<void> _save(Business b) async {
    final l = L.of(context);
    if (Validate.required(_name.text) != null) {
      setState(() => _error = l.errRequired);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });

    final sale =
        int.tryParse(_salePrice.text.replaceAll(RegExp(r'\D'), '')) ?? 0;
    final body = {
      'name': _name.text.trim(),
      'description': _description.text.trim(),
      'price': int.tryParse(_price.text.replaceAll(RegExp(r'\D'), '')) ?? 0,
      // SERVER `promotionPrice` KUTADI. Ilgari faqat `salePrice`
      // yuborilardi va chegirma jimgina yo'qolardi. 0 — chegirma yo'q
      // (null bilan tozalanadi).
      'promotionPrice': sale > 0 ? sale : null,
      'salePrice': sale,
      'category': _type == NfcProductType.other ? '' : _type.name,
      'available': _available,
      'type': _service ? 'service' : 'product',
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

    return NovaScaffold(
      title: widget.itemId == null ? l.bizAddProduct : l.actionEdit,
      showBack: true,
      body: NovaScroll(
        children: [
          Row(
            children: [
              Capsule(
                label: l.bizProducts,
                icon: Icons.inventory_2_rounded,
                selected: !_service,
                onTap: () => setState(() => _service = false),
              ),
              const SizedBox(width: Gap.sm),
              Capsule(
                label: l.bizServices,
                icon: Icons.design_services_rounded,
                selected: _service,
                onTap: () => setState(() => _service = true),
              ),
            ],
          ),
          const SizedBox(height: Gap.xl),
          NovaField(label: l.bizProductName, controller: _name, enabled: !_busy),
          const SizedBox(height: Gap.lg),
          NovaField(
            label: l.bizDescription,
            controller: _description,
            maxLines: 3,
            maxLength: 600,
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.lg),
          Text(l.catalogTypeLabel,
              style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: Gap.sm),
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              for (final ty in NfcProductType.values)
                Capsule(
                  key: ValueKey('nfc-type-${ty.name}'),
                  label: nfcTypeLabel(l, ty),
                  selected: _type == ty,
                  onTap: _busy ? null : () => setState(() => _type = ty),
                ),
            ],
          ),
          const SizedBox(height: Gap.lg),
          Row(
            children: [
              Expanded(
                child: NovaField(
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
                  label: l.bizSalePrice,
                  controller: _salePrice,
                  keyboardType: TextInputType.number,
                  enabled: !_busy,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                ),
              ),
            ],
          ),
          const SizedBox(height: Gap.xl),
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
                  value: _available,
                  activeThumbColor: t.accent2,
                  onChanged: _busy ? null : (v) => setState(() => _available = v),
                ),
              ],
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
              label: l.actionSave, busy: _busy, onPressed: () => _save(b)),
        ],
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
