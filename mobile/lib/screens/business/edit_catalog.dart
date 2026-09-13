import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/media.dart';
import '../../design/components/media_picker.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// KATALOG BOSHQARUVI — mahsulot qo'shish, tahrirlash, o'chirish.
///
/// NIMA UCHUN RO'YXAT VA TAHRIR ALOHIDA EKRAN: bitta mahsulotda
/// oltita maydon bor (rasm, nom, turkum, tavsif, narx, chegirma).
/// Ularni ro'yxat ichida ochish har qatorni akkordeonga aylantirardi
/// va o'ndan ortiq mahsulotda ekran boshqarib bo'lmas holga kelardi.
///
/// CHEGIRMA NARXI SERVERDA TEKSHIRILADI (`bad_promotion_price`):
/// u asosiy narxdan KICHIK bo'lishi shart. Ilova ham tekshiradi,
/// lekin faqat odam xatosini erta ko'rsatish uchun — haqiqat
/// serverda.
class EditCatalogScreen extends StatefulWidget {
  const EditCatalogScreen({super.key, required this.company});
  final Company company;

  @override
  State<EditCatalogScreen> createState() => _EditCatalogScreenState();
}

class _EditCatalogScreenState extends State<EditCatalogScreen> {
  List<Product>? _items;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items =
          await AppScope.read(context).repo.companyCatalog(widget.company.id);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _edit([Product? product]) async {
    final saved = await push<bool>(
      context,
      (_) => _ProductScreen(companyId: widget.company.id, product: product),
    );
    if (saved == true) await _load();
  }

  Future<void> _delete(Product p) async {
    final sure = await showSheet<bool>(
      context,
      title: p.name,
      subtitle: tr('Mahsulot katalogdan o‘chiriladi. Buni qaytarib '
          'bo‘lmaydi.'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
        child: Column(
          children: [
            GhostButton(tr('Ha, o‘chirilsin'),
                color: C.signal, onTap: () => Navigator.of(context).pop(true)),
            const SizedBox(height: S.x8),
            SecondaryButton(tr('Bekor qilish'),
                onTap: () => Navigator.of(context).pop(false)),
          ],
        ),
      ),
    );
    if (sure != true || !mounted) return;

    try {
      await AppScope.read(context).repo.deleteProduct(widget.company.id, p.id);
      successHaptic();
      await _load();
    } catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: C.obsidian,
        child: SafeArea(
          child: Column(
            children: [
              TopBar(title: tr('Katalog'), subtitle: widget.company.name),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  color: C.champagne,
                  backgroundColor: C.slate,
                  child: AsyncView<List<Product>>(
                    loading: _loading,
                    error: _error,
                    data: _items,
                    onRetry: _load,
                    skeleton: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                      children: const [
                        SkeletonCard(aspect: 5),
                        SizedBox(height: S.x8),
                        SkeletonCard(aspect: 5),
                      ],
                    ),
                    builder: (data) => ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding:
                          const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                      children: [
                        // QO'SHISH TEPADA: ro'yxat uzun bo'lsa, pastdagi
                        // tugmagacha aylantirish kerak bo'lardi.
                        SecondaryButton(
                          tr('Mahsulot qo‘shish'),
                          icon: NIcon(Ico.plus, size: 17, color: C.champagne),
                          onTap: () => _edit(),
                        ),
                        const SizedBox(height: S.x16),
                        if (data.isEmpty)
                          EmptyState(
                            tr('Birinchi mahsulotni qo‘shing — mijoz uni '
                                'profilingizdan ko‘radi va buyurtma beradi.'),
                            title: tr('Katalog bo‘sh'),
                            icon: Ico.bag,
                          )
                        else
                          for (final p in data) ...[
                            _ProductRow(
                              product: p,
                              onEdit: () => _edit(p),
                              onDelete: () => _delete(p),
                            ),
                            const SizedBox(height: S.x8),
                          ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}

class _ProductRow extends StatelessWidget {
  const _ProductRow({
    required this.product,
    required this.onEdit,
    required this.onDelete,
  });

  final Product product;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onEdit,
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          shadow: E.e1,
          child: Row(
            children: [
              SizedBox(
                width: 52,
                height: 52,
                // Rasm 52px — undan kattaroq dekodlash xotirani
                // behuda yeydi.
                child: NetImage(product.imageUrl, radius: R.tile, cacheWidth: 110),
              ),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.cardTitle.copyWith(fontSize: 13.5)),
                    const SizedBox(height: 3),
                    // CHEGIRMA RO'YXATDA HAM KO'RINSIN: egasi qaysi
                    // mahsulotda aksiya turganini ochmasdan bilsin.
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(som(product.effectivePrice),
                            style: T.price.copyWith(fontSize: 12.5)),
                        if (product.salePrice != null) ...[
                          const SizedBox(width: 6),
                          Text(
                            som(product.price),
                            style: T.meta.copyWith(
                              fontSize: 11,
                              color: C.muted,
                              decoration: TextDecoration.lineThrough,
                              decorationColor: C.muted,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Press(
                haptic: true,
                onTap: onDelete,
                child: Padding(
                  padding: const EdgeInsets.all(S.x8),
                  child: NIcon(Ico.close, size: 16, color: C.signal),
                ),
              ),
            ],
          ),
        ),
      );
}

/// BITTA MAHSULOT — qo'shish yoki tahrirlash.
///
/// `product` `null` bo'lsa — yangi qo'shiladi.
class _ProductScreen extends StatefulWidget {
  const _ProductScreen({required this.companyId, this.product});
  final String companyId;
  final Product? product;

  @override
  State<_ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<_ProductScreen> {
  late final _name = TextEditingController(text: widget.product?.name ?? '');
  late final _category =
      TextEditingController(text: widget.product?.categoryName ?? '');
  late final _about = TextEditingController(text: widget.product?.description ?? '');
  late final _price = TextEditingController(
      text: widget.product == null ? '' : '${widget.product!.price}');
  late final _promo = TextEditingController(
      text: (widget.product?.salePrice ?? 0) > 0
          ? '${widget.product!.salePrice}'
          : '');

  String? _image;
  bool _busy = false;
  String? _error;

  bool get _isNew => widget.product == null;

  @override
  void dispose() {
    for (final c in [_name, _category, _about, _price, _promo]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final price = int.tryParse(_price.text.replaceAll(RegExp(r'\D'), '')) ?? 0;
    final promoText = _promo.text.replaceAll(RegExp(r'\D'), '');
    final promo = promoText.isEmpty ? null : int.tryParse(promoText);

    if (name.isEmpty) {
      setState(() => _error = tr('Mahsulot nomini kiriting.'));
      return;
    }
    // Server ham tekshiradi — bu faqat xatoni ERTA ko'rsatish uchun.
    if (promo != null && promo >= price) {
      setState(() => _error = tr('Chegirma narxi asosiy narxdan kichik '
          'bo‘lsin.'));
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final repo = AppScope.read(context).repo;
      final body = <String, dynamic>{
        'name': name,
        'category': _category.text.trim(),
        'description': _about.text.trim(),
        'price': price,
        'promotionPrice': promo,
        if (_image != null) 'imageUrl': _image,
      };
      if (_isNew) {
        await repo.addProduct(widget.companyId, body);
      } else {
        await repo.updateProduct(widget.companyId, widget.product!.id, body);
      }
      successHaptic();
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() => _error = switch (e.key) {
              'name_required' => tr('Mahsulot nomini kiriting.'),
              'bad_promotion_price' =>
                tr('Chegirma narxi asosiy narxdan kichik bo‘lsin.'),
              // Server kaliti aynan shunday nomlanadi
              // (`plan_limit_reached`) — bepul tarifda yangi
              // mahsulot qo'shish chegarasi. Mavjudlari
              // o'chirilmaydi.
              'plan_limit_reached' =>
                tr('Bepul tarifdagi mahsulot chegarasiga yetdingiz.'),
              _ => humanError(e),
            });
      }
    } catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;

    return ColoredBox(
      color: C.obsidian,
      child: SafeArea(
        child: Column(
          children: [
            TopBar(title: _isNew ? tr('Yangi mahsulot') : tr('Mahsulot')),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  MediaPickField(
                    label: tr('Rasm'),
                    repo: repo,
                    url: widget.product?.imageUrl,
                    hint: tr('Kvadrat rasm eng yaxshi ko‘rinadi.'),
                    onUploaded: (u) => setState(() => _image = u),
                  ),
                  const SizedBox(height: S.x20),
                  Field(
                    label: tr('Nomi'),
                    controller: _name,
                    hint: tr('Mahsulot nomi'),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  // HAR MAYDONGA O'Z IZOHI: uchala joyda ham
                  // "Ixtiyoriy" yozilsa, ular nima uchun kerakligi
                  // umuman tushunarsiz bo'lardi.
                  Field(
                    label: tr('Turkum'),
                    controller: _category,
                    hint: tr('Masalan: Ichimliklar'),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Tavsif'),
                    controller: _about,
                    hint: tr('Qisqacha tavsif — ixtiyoriy'),
                    maxLines: 3,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Narxi'),
                    controller: _price,
                    hint: '0',
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Chegirma narxi'),
                    controller: _promo,
                    hint: tr('Aksiya bo‘lsa'),
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _save(),
                    error: _error,
                  ),
                  const SizedBox(height: S.x24),
                  PrimaryButton(tr('Saqlash'),
                      loading: _busy, onTap: _busy ? null : _save),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
