import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/models/ocorrencia_local.dart';
import '../../core/storage/sync_service.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/app_widgets.dart';

class NovaOcorrenciaScreen extends ConsumerStatefulWidget {
  const NovaOcorrenciaScreen({super.key});

  @override
  ConsumerState<NovaOcorrenciaScreen> createState() => _State();
}

class _State extends ConsumerState<NovaOcorrenciaScreen> {
  final _descCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  Position? _pos;
  bool _locating = false;
  bool _saving = false;
  String? _error;
  String _severity = 'alta'; // padrão como no mockup
  String? _categoryId;
  List<XFile> _images = [];
  List<Map<String, dynamic>> _categories = [];

  @override
  void initState() {
    super.initState();
    _locate();
    _loadCategories();
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _locate() async {
    setState(() => _locating = true);
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.deniedForever) {
        setState(() { _error = 'Permissão de GPS negada.'; _locating = false; });
        return;
      }
      final p = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15),
      );
      setState(() { _pos = p; _locating = false; });
    } catch (_) {
      setState(() { _locating = false; });
    }
  }

  Future<void> _loadCategories() async {
    try {
      final cats = await ref.read(apiClientProvider).getCategorias();
      setState(() => _categories = cats.cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  Future<void> _pickImage(ImageSource src) async {
    if (_images.length >= 5) return;
    final f = await ImagePicker().pickImage(source: src, imageQuality: 75, maxWidth: 1280);
    if (f != null) setState(() => _images.add(f));
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_pos == null) { setState(() => _error = 'GPS não disponível.'); return; }
    setState(() { _saving = true; _error = null; });
    final clientId = const Uuid().v4();
    try {
      final result = await ref.read(apiClientProvider).createOcorrencia(
        descricao: _descCtrl.text.trim(),
        latitude: _pos!.latitude,
        longitude: _pos!.longitude,
        categoriaId: _categoryId,
        clientId: clientId,
      );
      if (_images.isNotEmpty && result['id'] != null) {
        await ref.read(apiClientProvider).uploadImagens(result['id'] as String, _images.map((f) => f.path).toList());
      }
      if (mounted) {
        _showSuccess('✅ Ocorrência registrada!');
        context.go('/ocorrencias');
      }
    } catch (_) {
      final local = OcorrenciaLocal(
        clientId: clientId,
        descricao: _descCtrl.text.trim(),
        latitude: _pos!.latitude,
        longitude: _pos!.longitude,
        categoriaId: _categoryId,
        imagemPaths: _images.map((f) => f.path).toList(),
        criadoEm: DateTime.now(),
      );
      await ref.read(syncServiceProvider).salvarESync(local);
      if (mounted) {
        _showSuccess('📦 Salvo offline — será enviado em breve');
        context.go('/ocorrencias');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showSuccess(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: AppColors.prioBaixa,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dbUser = ref.watch(dbUserProvider).valueOrNull;
    final userName = dbUser?['name'] as String? ?? 'Usuário';
    final initials = userName.isNotEmpty ? userName[0].toUpperCase() : 'U';

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            RichText(
              text: const TextSpan(
                children: [
                  TextSpan(text: 'Alerta', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Colors.white)),
                  TextSpan(text: 'Cidadão', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppColors.orange)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: AppColors.orange,
                  child: Text(initials, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                ),
                const SizedBox(width: 8),
                Text(userName.split(' ').first, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Mapa mini ───────────────────────────────────────
            _MapPreview(position: _pos, loading: _locating),
            const SizedBox(height: 16),

            // ── Tipo de Ocorrência ──────────────────────────────
            _SectionLabel('TIPO DE OCORRÊNCIA'),
            const SizedBox(height: 10),
            if (_categories.isEmpty)
              const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
            else
              CategoryGrid(
                categories: _categories,
                selected: _categoryId,
                onChanged: (v) => setState(() => _categoryId = v),
              ),
            const SizedBox(height: 20),

            // ── Severidade ──────────────────────────────────────
            _SectionLabel('SEVERIDADE'),
            const SizedBox(height: 10),
            SeveritySelector(selected: _severity, onChanged: (v) => setState(() => _severity = v)),
            const SizedBox(height: 20),

            // ── Descrição ───────────────────────────────────────
            _SectionLabel('DESCRIÇÃO'),
            const SizedBox(height: 10),
            TextFormField(
              controller: _descCtrl,
              maxLines: 4,
              maxLength: 2000,
              style: TextStyle(fontSize: 14, color: isDark ? Colors.white : const Color(0xFF1A1D27)),
              decoration: const InputDecoration(
                hintText: 'Descreva a ocorrência com detalhes...',
                counterText: '',
              ),
              validator: (v) {
                if (v == null || v.trim().length < 10) return 'Mínimo 10 caracteres';
                return null;
              },
            ),
            const SizedBox(height: 20),

            // ── Fotos ───────────────────────────────────────────
            _SectionLabel('FOTOS'),
            const SizedBox(height: 10),
            SizedBox(
              height: 88,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  ..._images.asMap().entries.map((e) => _ImageThumb(
                    file: File(e.value.path),
                    onRemove: () => setState(() => _images.removeAt(e.key)),
                  )),
                  if (_images.length < 5)
                    _AddImageButton(onCamera: () => _pickImage(ImageSource.camera), onGallery: () => _pickImage(ImageSource.gallery)),
                ],
              ),
            ),

            if (_error != null) ...[
              const SizedBox(height: 12),
              _ErrorBox(_error!),
            ],

            const SizedBox(height: 24),

            // ── Submit ──────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _saving ? null : _submit,
                icon: _saving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('🚨', style: TextStyle(fontSize: 16)),
                label: Text(_saving ? 'Registrando...' : 'Registrar Ocorrência'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.orange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ── Sub-widgets ──────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      text,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
        color: isDark ? AppColors.darkMuted : AppColors.lightMuted,
      ),
    );
  }
}

class _MapPreview extends StatelessWidget {
  final Position? position;
  final bool loading;
  const _MapPreview({required this.position, required this.loading});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: 140,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
      ),
      child: Stack(
        children: [
          // Grid decorativo (fiel ao mockup)
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: CustomPaint(
              size: Size.infinite,
              painter: _GridPainter(isDark: isDark),
            ),
          ),
          if (loading)
            const Center(child: CircularProgressIndicator())
          else if (position != null)
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 28, height: 28,
                    decoration: const BoxDecoration(color: AppColors.orange, shape: BoxShape.circle),
                    child: const Icon(Icons.my_location, size: 14, color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Container(width: 2, height: 12, color: AppColors.orange),
                  Container(width: 8, height: 3, decoration: BoxDecoration(color: AppColors.orange, borderRadius: BorderRadius.circular(2))),
                ],
              ),
            ),
          if (position != null)
            Positioned(
              bottom: 10, left: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xCC1A1D27) : const Color(0xCCFFFFFF),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.prioBaixa, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    Text(
                      '${position!.latitude.toStringAsFixed(4)}, ${position!.longitude.toStringAsFixed(4)}',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: isDark ? Colors.white : const Color(0xFF1A1D27)),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _GridPainter extends CustomPainter {
  final bool isDark;
  _GridPainter({required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = (isDark ? Colors.white : Colors.black).withOpacity(0.05)
      ..strokeWidth = 1;
    const step = 24.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(_) => false;
}

class _ImageThumb extends StatelessWidget {
  final File file;
  final VoidCallback onRemove;
  const _ImageThumb({required this.file, required this.onRemove});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Image.file(file, width: 80, height: 80, fit: BoxFit.cover),
        ),
        Positioned(
          top: 3, right: 3,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(color: Colors.black.withOpacity(0.6), shape: BoxShape.circle),
              child: const Icon(Icons.close, size: 12, color: Colors.white),
            ),
          ),
        ),
      ],
    ),
  );
}

class _AddImageButton extends StatelessWidget {
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  const _AddImageButton({required this.onCamera, required this.onGallery});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: () => showModalBottomSheet(
        context: context,
        backgroundColor: isDark ? AppColors.darkCard : AppColors.lightSurface,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        builder: (_) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(width: 36, height: 4, decoration: BoxDecoration(color: isDark ? AppColors.darkBorder : AppColors.lightBorder, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt_outlined),
                title: const Text('Tirar foto'),
                onTap: () { Navigator.pop(context); onCamera(); },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Escolher da galeria'),
                onTap: () { Navigator.pop(context); onGallery(); },
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
      child: Container(
        width: 80, height: 80,
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkCard : AppColors.lightCard,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
            style: BorderStyle.solid,
          ),
        ),
        child: Icon(Icons.add, color: isDark ? AppColors.darkMuted : AppColors.lightMuted, size: 28),
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  final String msg;
  const _ErrorBox(this.msg);

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.prioCritica.withOpacity(0.1),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: AppColors.prioCritica.withOpacity(0.3)),
    ),
    child: Text(msg, style: const TextStyle(color: AppColors.prioCritica, fontSize: 13)),
  );
}
