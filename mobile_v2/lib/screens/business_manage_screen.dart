import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';

class BusinessManageScreen extends StatefulWidget {
  const BusinessManageScreen({
    super.key,
    required this.companyId,
  });

  final String companyId;

  @override
  State<BusinessManageScreen> createState() => _BusinessManageScreenState();
}

class _BusinessManageScreenState extends State<BusinessManageScreen> {
  final _name = TextEditingController();
  final _about = TextEditingController();
  final _city = TextEditingController();
  final _address = TextEditingController();
  final _phone = TextEditingController();
  final _telegram = TextEditingController();
  final _instagram = TextEditingController();
  final _website = TextEditingController();

  Company? _company;
  List<Product> _catalog = const [];
  String? _logoUrl;
  String? _coverUrl;
  bool _loading = true;
  bool _busy = false;
  bool _uploading = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _about,
      _city,
      _address,
      _phone,
      _telegram,
      _instagram,
      _website,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _fill(Company c) {
    _company = c;
    _name.text = c.name;
    _about.text = c.about;
    _city.text = c.city;
    _address.text = c.address;
    _phone.text = c.phone;
    _telegram.text = c.telegram;
    _instagram.text = c.instagram;
    _website.text = c.website;
    _logoUrl = c.logoUrl;
    _coverUrl = c.coverUrl;
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final repo = SessionScope.read(context).repo;
      final r = await Future.wait<dynamic>([
        repo.company(widget.companyId),
        repo.companyCatalog(widget.companyId),
      ]);
      if (!mounted) return;
      setState(() {
        _fill(r[0] as Company);
        _catalog = r[1] as List<Product>;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _message = 'Business ma’lumotlari yuklanmadi.';
        });
      }
    }
  }

  Future<String?> _pickBusinessImage({required bool cover}) async {
    if (_uploading) return null;
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 90,
      maxWidth: cover ? 2400 : 1600,
    );
    if (picked == null || !mounted) return null;

    setState(() {
      _uploading = true;
      _message = null;
    });
    try {
      final bytes = await picked.readAsBytes();
      final name = picked.name.toLowerCase();
      final type = name.endsWith('.png')
          ? 'image/png'
          : name.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
      final url = await SessionScope.read(context).repo.uploadFile(
            bytes,
            contentType: type,
          );
      if (!mounted) return null;
      setState(() {
        if (cover) {
          _coverUrl = url;
        } else {
          _logoUrl = url;
        }
      });
      return url;
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _message = switch (e.key) {
            'too_large' => 'Rasm hajmi juda katta.',
            'quota_exceeded' => 'Yuklash limiti tugagan.',
            _ => 'Rasm yuklanmadi.',
          };
        });
      }
      return null;
    } catch (_) {
      if (mounted) setState(() => _message = 'Rasm yuklanmadi.');
      return null;
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _saveProfile() async {
    if (_busy) return;
    if (_name.text.trim().isEmpty) {
      setState(() => _message = 'Biznes nomini kiriting.');
      return;
    }
    if (_about.text.trim().length < 20) {
      setState(() => _message = 'Tavsif kamida 20 ta belgidan iborat bo‘lsin.');
      return;
    }

    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final session = SessionScope.read(context);
      final updated = await session.repo.updateCompany(
        widget.companyId,
        {
          'displayName': _name.text.trim(),
          'description': _about.text.trim(),
          'city': _city.text.trim(),
          'address': _address.text.trim(),
          'phone': _phone.text.trim(),
          'telegram': _telegram.text.trim(),
          'instagram': _instagram.text.trim(),
          'website': _website.text.trim(),
          'logoUrl': _logoUrl ?? '',
          'coverUrl': _coverUrl ?? '',
        },
      );
      await session.refresh();
      if (!mounted) return;
      setState(() {
        _fill(updated);
        _message = 'Business profil saqlandi.';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _message = switch (e.key) {
          'name_not_allowed' => 'Bu biznes nomidan foydalanib bo‘lmaydi.',
          'domain_taken' => 'Domen band.',
          'unauthorized' => 'Sessiya tugagan. Qayta kiring.',
          _ => e.detail.isNotEmpty ? e.detail : 'Business saqlanmadi.',
        };
      });
    } catch (_) {
      if (mounted) setState(() => _message = 'Business saqlanmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editProduct([Product? product]) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.brand.surface,
      showDragHandle: true,
      builder: (_) => _ProductEditorSheet(
        companyId: widget.companyId,
        product: product,
      ),
    );
    if (changed == true && mounted) {
      final list =
          await SessionScope.read(context).repo.companyCatalog(widget.companyId);
      if (mounted) setState(() => _catalog = list);
    }
  }

  Future<void> _deleteProduct(Product product) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Mahsulotni o‘chirish'),
        content: Text('“' + product.name + '” katalogdan o‘chirilsinmi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Bekor qilish'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('O‘chirish'),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;

    try {
      await SessionScope.read(context)
          .repo
          .deleteCompanyCatalogItem(widget.companyId, product.id);
      if (!mounted) return;
      setState(() => _catalog = [..._catalog]..removeWhere((e) => e.id == product.id));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mahsulot o‘chirilmadi.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;

    if (_loading && _company == null) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: p.ink, strokeWidth: 1.6),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'Business boshqaruvi',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
      ),
      body: RefreshIndicator(
        color: p.ink,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 38),
          children: [
            _BusinessMediaEditor(
              name: _name.text.isEmpty ? (_company?.name ?? 'Business') : _name.text,
              logoUrl: _logoUrl,
              coverUrl: _coverUrl,
              uploading: _uploading,
              onLogo: () => _pickBusinessImage(cover: false),
              onCover: () => _pickBusinessImage(cover: true),
            ),
            const SizedBox(height: 22),
            Text(
              'Profil',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 11),
            SurfaceCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _Field(controller: _name, label: 'Biznes nomi'),
                  const SizedBox(height: 11),
                  _Field(
                    controller: _about,
                    label: 'Tavsif',
                    maxLines: 4,
                    maxLength: 1200,
                  ),
                  const SizedBox(height: 11),
                  _Field(controller: _city, label: 'Shahar'),
                  const SizedBox(height: 11),
                  _Field(controller: _address, label: 'Manzil'),
                  const SizedBox(height: 11),
                  _Field(
                    controller: _phone,
                    label: 'Telefon',
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 11),
                  _Field(controller: _telegram, label: 'Telegram'),
                  const SizedBox(height: 11),
                  _Field(controller: _instagram, label: 'Instagram'),
                  const SizedBox(height: 11),
                  _Field(
                    controller: _website,
                    label: 'Veb-sayt',
                    keyboardType: TextInputType.url,
                  ),
                ],
              ),
            ),
            if (_message != null) ...[
              const SizedBox(height: 11),
              Text(
                _message!,
                style: TextStyle(color: p.ink2, fontSize: 10.5),
              ),
            ],
            const SizedBox(height: 14),
            SizedBox(
              height: 52,
              child: FilledButton(
                onPressed: (_busy || _uploading) ? null : _saveProfile,
                style: FilledButton.styleFrom(
                  backgroundColor: p.ink,
                  foregroundColor: p.background,
                ),
                child: _busy
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: p.background,
                        ),
                      )
                    : const Text('Business profilni saqlash'),
              ),
            ),
            const SizedBox(height: 31),
            Row(
              children: [
                Text(
                  'Katalog',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const Spacer(),
                Text(
                  _catalog.length.toString() + ' ta',
                  style: TextStyle(
                    color: p.ink2,
                    fontFamily: 'IBMPlexMono',
                    fontSize: 9.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 11),
            if (_catalog.isEmpty)
              SurfaceCard(
                shadow: false,
                child: Column(
                  children: [
                    Icon(
                      Icons.inventory_2_outlined,
                      color: p.ink2,
                      size: 30,
                    ),
                    const SizedBox(height: 9),
                    Text(
                      'Katalog hozircha bo‘sh.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              )
            else
              for (final product in _catalog) ...[
                _ProductManageTile(
                  product: product,
                  onEdit: () => _editProduct(product),
                  onDelete: () => _deleteProduct(product),
                ),
                const SizedBox(height: 9),
              ],
            const SizedBox(height: 4),
            OutlinedButton.icon(
              onPressed: () => _editProduct(),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Mahsulot yoki xizmat qo‘shish'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductEditorSheet extends StatefulWidget {
  const _ProductEditorSheet({
    required this.companyId,
    this.product,
  });

  final String companyId;
  final Product? product;

  @override
  State<_ProductEditorSheet> createState() => _ProductEditorSheetState();
}

class _ProductEditorSheetState extends State<_ProductEditorSheet> {
  late final TextEditingController _name;
  late final TextEditingController _description;
  late final TextEditingController _price;
  late final TextEditingController _promo;
  String? _imageUrl;
  bool _busy = false;
  bool _uploading = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    final p = widget.product;
    _name = TextEditingController(text: p?.name ?? '');
    _description = TextEditingController(text: p?.description ?? '');
    _price = TextEditingController(text: p == null ? '' : p.price.toString());
    _promo = TextEditingController(
      text: p?.salePrice == null ? '' : p!.salePrice.toString(),
    );
    _imageUrl = p?.imageUrl;
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _price.dispose();
    _promo.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    if (_uploading) return;
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
      maxWidth: 2000,
    );
    if (picked == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      final bytes = await picked.readAsBytes();
      final lower = picked.name.toLowerCase();
      final type = lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
      final url = await SessionScope.read(context).repo.uploadFile(
            bytes,
            contentType: type,
          );
      if (mounted) setState(() => _imageUrl = url);
    } catch (_) {
      if (mounted) setState(() => _message = 'Rasm yuklanmadi.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    if (_busy) return;
    final name = _name.text.trim();
    final price = int.tryParse(_price.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? -1;
    final promoText = _promo.text.replaceAll(RegExp(r'[^0-9]'), '');
    final promo = promoText.isEmpty ? null : int.tryParse(promoText);

    if (name.isEmpty || price < 0) {
      setState(() => _message = 'Nom va narxni to‘g‘ri kiriting.');
      return;
    }
    if (promo != null && promo >= price) {
      setState(() => _message = 'Aksiya narxi asosiy narxdan kichik bo‘lsin.');
      return;
    }

    setState(() {
      _busy = true;
      _message = null;
    });
    final body = <String, dynamic>{
      'name': name,
      'description': _description.text.trim(),
      'price': price,
      'promotionPrice': promo,
      'imageUrl': _imageUrl ?? '',
      'available': true,
    };

    try {
      final repo = SessionScope.read(context).repo;
      if (widget.product == null) {
        await repo.addCompanyCatalogItem(widget.companyId, body);
      } else {
        await repo.updateCompanyCatalogItem(
          widget.companyId,
          widget.product!.id,
          body,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _message = switch (e.key) {
          'plan_limit_reached' => 'Tarifdagi katalog limiti tugagan.',
          'bad_promotion_price' => 'Aksiya narxi noto‘g‘ri.',
          _ => e.detail.isNotEmpty ? e.detail : 'Saqlanmadi.',
        };
      });
    } catch (_) {
      if (mounted) setState(() => _message = 'Saqlanmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.product == null ? 'Katalogga qo‘shish' : 'Mahsulotni tahrirlash',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: _uploading ? null : _pick,
              child: Container(
                height: 150,
                decoration: BoxDecoration(
                  color: p.background2,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: p.line),
                ),
                clipBehavior: Clip.antiAlias,
                child: _imageUrl == null || _imageUrl!.isEmpty
                    ? Center(
                        child: _uploading
                            ? const CircularProgressIndicator(strokeWidth: 1.7)
                            : Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.add_photo_alternate_outlined,
                                    color: p.ink2,
                                  ),
                                  const SizedBox(height: 7),
                                  Text(
                                    'Rasm qo‘shish',
                                    style: TextStyle(
                                      color: p.ink2,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                      )
                    : CachedNetworkImage(
                        imageUrl: _imageUrl!,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
              ),
            ),
            const SizedBox(height: 13),
            _Field(controller: _name, label: 'Nomi'),
            const SizedBox(height: 10),
            _Field(
              controller: _description,
              label: 'Tavsif',
              maxLines: 3,
              maxLength: 600,
            ),
            const SizedBox(height: 10),
            _Field(
              controller: _price,
              label: 'Narxi (so‘m)',
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 10),
            _Field(
              controller: _promo,
              label: 'Aksiya narxi (ixtiyoriy)',
              keyboardType: TextInputType.number,
            ),
            if (_message != null) ...[
              const SizedBox(height: 10),
              Text(
                _message!,
                style: TextStyle(color: p.ink2, fontSize: 10.5),
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                onPressed: (_busy || _uploading) ? null : _save,
                style: FilledButton.styleFrom(
                  backgroundColor: p.ink,
                  foregroundColor: p.background,
                ),
                child: _busy
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: p.background,
                        ),
                      )
                    : const Text('Saqlash'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BusinessMediaEditor extends StatelessWidget {
  const _BusinessMediaEditor({
    required this.name,
    required this.logoUrl,
    required this.coverUrl,
    required this.uploading,
    required this.onLogo,
    required this.onCover,
  });

  final String name;
  final String? logoUrl;
  final String? coverUrl;
  final bool uploading;
  final VoidCallback onLogo;
  final VoidCallback onCover;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return SizedBox(
      height: 220,
      child: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              onTap: uploading ? null : onCover,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF111110),
                  borderRadius: BorderRadius.circular(28),
                ),
                clipBehavior: Clip.antiAlias,
                child: (coverUrl ?? '').isEmpty
                    ? Stack(
                        fit: StackFit.expand,
                        children: [
                          Center(
                            child: Opacity(
                              opacity: .18,
                              child: Image.asset(
                                'assets/images/nfcstore_logo_mark.png',
                                width: 120,
                                height: 120,
                              ),
                            ),
                          ),
                          const Positioned(
                            right: 14,
                            top: 14,
                            child: _MediaHint(label: 'Muqova'),
                          ),
                        ],
                      )
                    : Stack(
                        fit: StackFit.expand,
                        children: [
                          CachedNetworkImage(
                            imageUrl: coverUrl!,
                            fit: BoxFit.cover,
                            color: Colors.black.withValues(alpha: .38),
                            colorBlendMode: BlendMode.darken,
                          ),
                          const Positioned(
                            right: 14,
                            top: 14,
                            child: _MediaHint(label: 'Muqova'),
                          ),
                        ],
                      ),
              ),
            ),
          ),
          Positioned(
            left: 18,
            bottom: 18,
            child: GestureDetector(
              onTap: uploading ? null : onLogo,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  BrandAvatar(
                    url: logoUrl,
                    size: 76,
                    goldRing: true,
                    fallback: name,
                  ),
                  Positioned(
                    right: -5,
                    bottom: -5,
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: p.heroInk,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFF111110),
                          width: 3,
                        ),
                      ),
                      child: const Icon(
                        Icons.photo_camera_outlined,
                        size: 13,
                        color: Colors.black,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (uploading)
            const Positioned.fill(
              child: Center(
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 1.8,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MediaHint extends StatelessWidget {
  const _MediaHint({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: .42),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: Colors.white.withValues(alpha: .12)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.photo_camera_outlined,
              color: Colors.white,
              size: 13,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 8.8,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
}

class _ProductManageTile extends StatelessWidget {
  const _ProductManageTile({
    required this.product,
    required this.onEdit,
    required this.onDelete,
  });

  final Product product;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  String _money(int v) {
    final s = v.toString();
    final b = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
      b.write(s[i]);
    }
    return b.toString() + ' so‘m';
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(21),
        border: Border.all(color: p.line),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Container(
              width: 66,
              height: 66,
              color: p.background2,
              child: product.imageUrl == null
                  ? Icon(Icons.inventory_2_outlined, color: p.ink2)
                  : CachedNetworkImage(
                      imageUrl: product.imageUrl!,
                      fit: BoxFit.cover,
                    ),
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  _money(product.effectivePrice),
                  style: TextStyle(
                    color: p.ink2,
                    fontFamily: 'IBMPlexMono',
                    fontSize: 9.2,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Tahrirlash',
            onPressed: onEdit,
            icon: const Icon(Icons.edit_outlined),
          ),
          IconButton(
            tooltip: 'O‘chirish',
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline_rounded),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    this.keyboardType,
    this.maxLines = 1,
    this.maxLength,
  });

  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;
  final int maxLines;
  final int? maxLength;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        keyboardType: keyboardType,
        maxLines: maxLines,
        maxLength: maxLength,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
      );
}
