import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../core/api/api_client.dart';
import '../../core/models/ocorrencia_local.dart';
import '../../core/storage/sync_service.dart';

// Categorias padrão — usadas quando API falha ou retorna vazio
const _categoriasDefault = [
  {'id': 'default-1', 'nome': 'Buraco na Via'},
  {'id': 'default-2', 'nome': 'Alagamento'},
  {'id': 'default-3', 'nome': 'Iluminação'},
  {'id': 'default-4', 'nome': 'Incêndio'},
  {'id': 'default-5', 'nome': 'Deslizamento'},
  {'id': 'default-6', 'nome': 'Lixo/Entulho'},
  {'id': 'default-7', 'nome': 'Risco Elétrico'},
  {'id': 'default-8', 'nome': 'Outros'},
];

const _orange = Color(0xFFFF6B2B);

class NovaOcorrenciaScreen extends ConsumerStatefulWidget {
  const NovaOcorrenciaScreen({super.key});
  @override
  ConsumerState<NovaOcorrenciaScreen> createState() => _State();
}

class _State extends ConsumerState<NovaOcorrenciaScreen> {
  final _descCtrl = TextEditingController();
  final _formKey  = GlobalKey<FormState>();

  Position? _position;
  bool      _localizando = false;
  String?   _erroGps;
  bool      _salvando = false;
  String    _severity = 'alta';

  List<XFile>               _imagens   = [];
  List<Map<String, dynamic>> _categorias = [];
  bool    _catsLoading = false;
  String? _catSelecionada;

  @override
  void initState() {
    super.initState();
    _loadCats();
    _locate();
  }

  @override
  void dispose() { _descCtrl.dispose(); super.dispose(); }

  // ── GPS ──────────────────────────────────────────────────
  Future<void> _locate() async {
    setState(() { _localizando = true; _erroGps = null; });
    try {
      final svcOk = await Geolocator.isLocationServiceEnabled();
      if (!svcOk) {
        setState(() { _erroGps = 'GPS desligado.\nAcesse Configurações → Localização e ative.'; _localizando = false; });
        return;
      }
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.deniedForever) {
        setState(() { _erroGps = 'Permissão bloqueada.\nAbra Config → Apps → Alerta Cidadão → Permissões.'; _localizando = false; });
        return;
      }
      if (perm == LocationPermission.denied) {
        setState(() { _erroGps = 'Permissão de localização negada.'; _localizando = false; });
        return;
      }
      Position? pos;
      try {
        pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high, timeLimit: const Duration(seconds: 15));
      } catch (_) {
        try {
          pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.medium, timeLimit: const Duration(seconds: 10));
        } catch (_) {
          pos = await Geolocator.getLastKnownPosition();
        }
      }
      if (pos != null) {
        setState(() { _position = pos; _localizando = false; _erroGps = null; });
      } else {
        setState(() { _erroGps = 'Não foi possível obter localização.\nTente ao ar livre.'; _localizando = false; });
      }
    } catch (_) {
      setState(() { _erroGps = 'Erro ao acessar GPS. Tente novamente.'; _localizando = false; });
    }
  }

  // ── Categorias ───────────────────────────────────────────
  Future<void> _loadCats() async {
    setState(() => _catsLoading = true);
    try {
      final raw = await ref.read(apiClientProvider).getCategorias();
      final list = raw.cast<Map<String, dynamic>>();
      setState(() { _categorias = list.isEmpty ? List.from(_categoriasDefault) : list; _catsLoading = false; });
    } catch (_) {
      setState(() { _categorias = List.from(_categoriasDefault); _catsLoading = false; });
    }
  }

  // ── Imagem ───────────────────────────────────────────────
  Future<void> _pickImage(ImageSource src) async {
    if (_imagens.length >= 5) return;
    final f = await ImagePicker().pickImage(source: src, imageQuality: 75, maxWidth: 1280);
    if (f != null) setState(() => _imagens.add(f));
  }

  void _showImgSheet() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF21253A) : Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 36, height: 4, margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: isDark ? const Color(0xFF2E3347) : const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2))),
          ListTile(leading: const Icon(Icons.camera_alt_outlined, color: _orange), title: const Text('Tirar foto'),
            onTap: () { Navigator.pop(context); _pickImage(ImageSource.camera); }),
          ListTile(leading: const Icon(Icons.photo_library_outlined, color: _orange), title: const Text('Galeria'),
            onTap: () { Navigator.pop(context); _pickImage(ImageSource.gallery); }),
        ]),
      )),
    );
  }

  // ── Salvar ───────────────────────────────────────────────
  Future<void> _salvar() async {
    if (!_formKey.currentState!.validate()) return;
    if (_position == null) {
      if (!_localizando) _locate();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('⏳ Aguardando GPS...'), backgroundColor: _orange));
      return;
    }
    setState(() => _salvando = true);
    final clientId = const Uuid().v4();
    final paths = _imagens.map((f) => f.path).toList();
    final catId = (_catSelecionada?.startsWith('default-') ?? false) ? null : _catSelecionada;

    try {
      final result = await ref.read(apiClientProvider).createOcorrencia(
        descricao: _descCtrl.text.trim(), latitude: _position!.latitude,
        longitude: _position!.longitude, categoriaId: catId, clientId: clientId);
      if (paths.isNotEmpty && result['id'] != null)
        await ref.read(apiClientProvider).uploadImagens(result['id'] as String, paths);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Ocorrência registrada!'), backgroundColor: Color(0xFF22C55E)));
        context.go('/ocorrencias');
      }
    } catch (_) {
      final local = OcorrenciaLocal(clientId: clientId, descricao: _descCtrl.text.trim(),
        latitude: _position!.latitude, longitude: _position!.longitude,
        categoriaId: catId, imagemPaths: paths, criadoEm: DateTime.now());
      await ref.read(syncServiceProvider).salvarESync(local);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('📦 Salvo offline'), backgroundColor: _orange, duration: Duration(seconds: 4)));
        context.go('/ocorrencias');
      }
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  // ── Build ────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg          = isDark ? const Color(0xFF0F1117) : const Color(0xFFF4F5F7);
    final cardBg      = isDark ? const Color(0xFF21253A) : Colors.white;
    final border      = isDark ? const Color(0xFF2E3347) : const Color(0xFFE5E7EB);
    final muted       = isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280);
    final textColor   = isDark ? Colors.white : const Color(0xFF0F1117);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF0F1117) : Colors.white,
        title: RichText(text: TextSpan(children: [
          TextSpan(text: 'Alerta', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: textColor)),
          const TextSpan(text: 'Cidadão', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: _orange)),
        ])),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [

            // ── Mini Mapa ─────────────────────────────────
            _MapaPreview(position: _position, localizando: _localizando, erroGps: _erroGps, onRetry: _locate, isDark: isDark, cardBg: cardBg, border: border),
            const SizedBox(height: 20),

            // ── Tipo de Ocorrência ─────────────────────────
            _Label('TIPO DE OCORRÊNCIA', muted),
            const SizedBox(height: 10),
            _CatGrid(cats: _categorias, loading: _catsLoading, selected: _catSelecionada,
              onTap: (id) => setState(() => _catSelecionada = id), isDark: isDark, cardBg: cardBg, border: border),
            const SizedBox(height: 20),

            // ── Severidade ─────────────────────────────────
            _Label('SEVERIDADE', muted),
            const SizedBox(height: 10),
            _SevRow(selected: _severity, onChanged: (v) => setState(() => _severity = v), isDark: isDark, cardBg: cardBg, border: border),
            const SizedBox(height: 20),

            // ── Descrição ──────────────────────────────────
            _Label('DESCRIÇÃO *', muted),
            const SizedBox(height: 10),
            TextFormField(
              controller: _descCtrl,
              maxLines: 4, maxLength: 2000,
              style: TextStyle(fontSize: 14, color: textColor),
              decoration: InputDecoration(
                hintText: 'Descreva a ocorrência com detalhes...',
                hintStyle: TextStyle(color: muted, fontSize: 13),
                filled: true, fillColor: cardBg,
                counterStyle: TextStyle(color: muted, fontSize: 11),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: border)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _orange, width: 1.5)),
                errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFEF4444))),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Descrição é obrigatória';
                if (v.trim().length < 10) return 'Mínimo 10 caracteres';
                return null;
              },
            ),
            const SizedBox(height: 20),

            // ── Fotos ──────────────────────────────────────
            _Label('FOTOS (máx. 5)', muted),
            const SizedBox(height: 10),
            SizedBox(
              height: 88,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  ..._imagens.asMap().entries.map((e) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Stack(children: [
                      ClipRRect(borderRadius: BorderRadius.circular(10),
                        child: Image.file(File(e.value.path), width: 80, height: 80, fit: BoxFit.cover)),
                      Positioned(top: 3, right: 3,
                        child: GestureDetector(
                          onTap: () => setState(() => _imagens.removeAt(e.key)),
                          child: Container(padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(color: Colors.black.withOpacity(0.65), shape: BoxShape.circle),
                            child: const Icon(Icons.close, size: 12, color: Colors.white)))),
                    ]),
                  )),
                  if (_imagens.length < 5)
                    GestureDetector(
                      onTap: _showImgSheet,
                      child: Container(width: 80, height: 80,
                        decoration: BoxDecoration(color: cardBg, borderRadius: BorderRadius.circular(10), border: Border.all(color: border)),
                        child: Icon(Icons.add_photo_alternate_outlined, color: muted, size: 28)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // ── Botão ──────────────────────────────────────
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _salvando ? null : _salvar,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _orange,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: _orange.withOpacity(0.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: _salvando
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text('🚨', style: TextStyle(fontSize: 18)),
                      SizedBox(width: 8),
                      Text('Registrar Ocorrência', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    ]),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Mini mapa completo com grid + ruas + pin + badges
// ─────────────────────────────────────────────────────────────
class _MapaPreview extends StatelessWidget {
  final Position? position;
  final bool localizando;
  final String? erroGps;
  final VoidCallback onRetry;
  final bool isDark;
  final Color cardBg, border;

  const _MapaPreview({
    required this.position, required this.localizando, required this.erroGps,
    required this.onRetry, required this.isDark, required this.cardBg, required this.border,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 170,
      decoration: BoxDecoration(color: cardBg, borderRadius: BorderRadius.circular(16), border: Border.all(color: border)),
      clipBehavior: Clip.antiAlias,
      child: Stack(children: [
        // Grade de fundo
        Positioned.fill(child: CustomPaint(painter: _Grid(isDark: isDark))),
        // Ruas decorativas
        Positioned.fill(child: CustomPaint(painter: _Streets(isDark: isDark))),

        // Estado: carregando
        if (localizando)
          Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2.5, color: _orange)),
            const SizedBox(height: 10),
            Text('Obtendo localização GPS...', style: TextStyle(fontSize: 12,
              color: isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280))),
          ])),

        // Estado: com posição — pin
        if (!localizando && position != null)
          Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 34, height: 34,
              decoration: BoxDecoration(color: _orange, shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: _orange.withOpacity(0.45), blurRadius: 14, spreadRadius: 2)]),
              child: const Icon(Icons.my_location, size: 18, color: Colors.white)),
            Container(width: 2, height: 16, color: _orange),
            Container(width: 10, height: 4,
              decoration: BoxDecoration(color: _orange.withOpacity(0.4), borderRadius: BorderRadius.circular(2))),
          ])),

        // Estado: erro GPS
        if (!localizando && position == null)
          Center(child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.location_off_outlined, size: 32,
                color: isDark ? const Color(0xFF8B90A0) : const Color(0xFF9CA3AF)),
              const SizedBox(height: 8),
              Text(erroGps ?? 'GPS não disponível', textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280))),
              const SizedBox(height: 10),
              GestureDetector(
                onTap: onRetry,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                  decoration: BoxDecoration(color: _orange, borderRadius: BorderRadius.circular(20)),
                  child: const Text('Tentar novamente',
                    style: TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600)),
                ),
              ),
            ]),
          )),

        // Chip de coordenadas (rodapé esquerdo)
        if (position != null)
          Positioned(bottom: 10, left: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: (isDark ? const Color(0xFF1A1D27) : Colors.white).withOpacity(0.92),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: border),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 6)],
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFF22C55E), shape: BoxShape.circle)),
                const SizedBox(width: 6),
                Text(
                  '${position!.latitude.toStringAsFixed(5)}, ${position!.longitude.toStringAsFixed(5)}',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF0F1117)),
                ),
              ]),
            )),

        // Badge de precisão (topo direito)
        if (position != null)
          Positioned(top: 10, right: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: (isDark ? const Color(0xFF1A1D27) : Colors.white).withOpacity(0.9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: border),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.gps_fixed, size: 11, color: Color(0xFF22C55E)),
                const SizedBox(width: 4),
                Text('±${position!.accuracy.toStringAsFixed(0)}m',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white70 : const Color(0xFF374151))),
              ]),
            )),
      ]),
    );
  }
}

class _Grid extends CustomPainter {
  final bool isDark;
  _Grid({required this.isDark});
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = (isDark ? Colors.white : Colors.black).withOpacity(0.05)..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 22) canvas.drawLine(Offset(x, 0), Offset(x, size.height), p);
    for (double y = 0; y < size.height; y += 22) canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
  }
  @override bool shouldRepaint(_) => false;
}

class _Streets extends CustomPainter {
  final bool isDark;
  _Streets({required this.isDark});
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = (isDark ? Colors.white : Colors.black).withOpacity(0.07)..strokeWidth = 7..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(0, size.height * 0.56), Offset(size.width, size.height * 0.56), p);
    canvas.drawLine(Offset(size.width * 0.38, 0), Offset(size.width * 0.38, size.height), p);
  }
  @override bool shouldRepaint(_) => false;
}

// ─────────────────────────────────────────────────────────────
// Grid 4 colunas de categorias
// ─────────────────────────────────────────────────────────────
class _CatGrid extends StatelessWidget {
  final List<Map<String, dynamic>> cats;
  final bool loading;
  final String? selected;
  final ValueChanged<String?> onTap;
  final bool isDark;
  final Color cardBg, border;

  const _CatGrid({required this.cats, required this.loading, required this.selected,
    required this.onTap, required this.isDark, required this.cardBg, required this.border});

  IconData _icon(String n) {
    final l = n.toLowerCase();
    if (l.contains('buraco') || l.contains('via')) return Icons.construction;
    if (l.contains('alaga') || l.contains('enchente')) return Icons.water;
    if (l.contains('ilum') || l.contains('luz')) return Icons.lightbulb_outline;
    if (l.contains('incê') || l.contains('fogo')) return Icons.local_fire_department;
    if (l.contains('desliz')) return Icons.landslide_outlined;
    if (l.contains('lixo') || l.contains('entulho')) return Icons.delete_outline;
    if (l.contains('elét') || l.contains('risco')) return Icons.bolt;
    if (l.contains('vazam') || l.contains('água')) return Icons.water_drop_outlined;
    return Icons.warning_amber_outlined;
  }

  Color _color(String n) {
    final l = n.toLowerCase();
    if (l.contains('incê') || l.contains('fogo')) return const Color(0xFFEF4444);
    if (l.contains('alaga') || l.contains('vazam')) return const Color(0xFFFF8C5A);
    if (l.contains('desliz')) return const Color(0xFFF97316);
    if (l.contains('elét') || l.contains('risco')) return const Color(0xFFEAB308);
    if (l.contains('ilum')) return const Color(0xFFEAB308);
    return _orange;
  }

  @override
  Widget build(BuildContext context) {
    // Shimmer enquanto carrega e ainda não tem fallback
    if (loading && cats.isEmpty) {
      return GridView.builder(
        shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.85),
        itemCount: 8,
        itemBuilder: (_, __) => Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF2E3347) : const Color(0xFFE5E7EB),
            borderRadius: BorderRadius.circular(12))),
      );
    }

    return GridView.builder(
      shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.85),
      itemCount: cats.length,
      itemBuilder: (_, i) {
        final cat  = cats[i];
        final id   = cat['id'] as String;
        final nome = cat['nome'] as String;
        final isSel = selected == id;
        final col  = _color(nome);

        return GestureDetector(
          onTap: () => onTap(isSel ? null : id),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            decoration: BoxDecoration(
              color: isSel ? col.withOpacity(0.14) : cardBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: isSel ? col : border, width: isSel ? 1.5 : 1),
            ),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(_icon(nome),
                color: isSel ? col : (isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280)),
                size: 26),
              const SizedBox(height: 6),
              Text(
                nome.split('/').first.split(' ').first,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                  color: isSel ? col : (isDark ? Colors.white70 : const Color(0xFF374151)),
                ),
                textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
              ),
            ]),
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Seletor de severidade
// ─────────────────────────────────────────────────────────────
class _SevRow extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;
  final bool isDark;
  final Color cardBg, border;

  const _SevRow({required this.selected, required this.onChanged,
    required this.isDark, required this.cardBg, required this.border});

  @override
  Widget build(BuildContext context) {
    const opts = [
      ('baixa',  'Baixa', Color(0xFF22C55E)),
      ('normal', 'Média', Color(0xFFEAB308)),
      ('alta',   'Alta',  Color(0xFFEF4444)),
    ];
    return Row(
      children: opts.map((o) {
        final isSel = selected == o.$1;
        return Expanded(child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: GestureDetector(
            onTap: () => onChanged(o.$1),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              height: 44,
              decoration: BoxDecoration(
                color: isSel ? o.$3.withOpacity(0.14) : cardBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: isSel ? o.$3 : border, width: isSel ? 1.5 : 1),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: o.$3, shape: BoxShape.circle)),
                const SizedBox(width: 6),
                Text(o.$2, style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                  color: isSel ? o.$3 : (isDark ? const Color(0xFF8B90A0) : const Color(0xFF6B7280)),
                )),
              ]),
            ),
          ),
        ));
      }).toList(),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Label de seção
// ─────────────────────────────────────────────────────────────
class _Label extends StatelessWidget {
  final String text;
  final Color color;
  const _Label(this.text, this.color);
  @override
  Widget build(BuildContext context) => Text(text,
    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: color));
}
