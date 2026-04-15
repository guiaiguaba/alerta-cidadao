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

class NovaOcorrenciaScreen extends ConsumerStatefulWidget {
  const NovaOcorrenciaScreen({super.key});

  @override
  ConsumerState<NovaOcorrenciaScreen> createState() => _NovaOcorrenciaScreenState();
}

class _NovaOcorrenciaScreenState extends ConsumerState<NovaOcorrenciaScreen> {
  final _descricaoCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  Position? _position;
  bool _localizando = false;
  bool _salvando = false;
  String? _erro;

  List<XFile> _imagens = [];
  List<Map<String, dynamic>> _categorias = [];
  String? _categoriaSelecionada;

  @override
  void initState() {
    super.initState();
    _obterLocalizacao();
    _carregarCategorias();
  }

  @override
  void dispose() {
    _descricaoCtrl.dispose();
    super.dispose();
  }

  Future<void> _obterLocalizacao() async {
    setState(() => _localizando = true);
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        setState(() { _erro = 'Permissão de localização negada permanentemente.'; _localizando = false; });
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15),
      );
      setState(() { _position = pos; _localizando = false; });
    } catch (e) {
      setState(() { _erro = 'Não foi possível obter localização.'; _localizando = false; });
    }
  }

  Future<void> _carregarCategorias() async {
    try {
      final cats = await ref.read(apiClientProvider).getCategorias();
      setState(() => _categorias = cats.cast<Map<String, dynamic>>());
    } catch (_) {}
  }

  Future<void> _adicionarImagem(ImageSource source) async {
    if (_imagens.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Máximo de 5 imagens')),
      );
      return;
    }
    final picker = ImagePicker();
    final XFile? file = await picker.pickImage(source: source, imageQuality: 75, maxWidth: 1280);
    if (file != null) setState(() => _imagens.add(file));
  }

  Future<void> _salvar() async {
    if (!_formKey.currentState!.validate()) return;
    if (_position == null) {
      setState(() => _erro = 'Aguardando localização GPS...');
      return;
    }

    setState(() { _salvando = true; _erro = null; });

    final clientId = const Uuid().v4();
    final paths = _imagens.map((f) => f.path).toList();

    try {
      // Tenta enviar online; se falhar, salva offline
      final result = await ref.read(apiClientProvider).createOcorrencia(
        descricao: _descricaoCtrl.text.trim(),
        latitude: _position!.latitude,
        longitude: _position!.longitude,
        categoriaId: _categoriaSelecionada,
        clientId: clientId,
      );

      // Upload de imagens se online
      if (paths.isNotEmpty && result['id'] != null) {
        await ref.read(apiClientProvider).uploadImagens(result['id'] as String, paths);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Ocorrência registrada com sucesso!'),
            backgroundColor: Colors.green,
          ),
        );
        context.go('/ocorrencias');
      }
    } catch (_) {
      // Offline — salva local
      final local = OcorrenciaLocal(
        clientId: clientId,
        descricao: _descricaoCtrl.text.trim(),
        latitude: _position!.latitude,
        longitude: _position!.longitude,
        categoriaId: _categoriaSelecionada,
        imagemPaths: paths,
        criadoEm: DateTime.now(),
      );
      await ref.read(syncServiceProvider).salvarESync(local);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('📦 Salvo localmente — será enviado quando houver internet'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 4),
          ),
        );
        context.go('/ocorrencias');
      }
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nova Ocorrência')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // GPS status
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _position != null
                    ? Colors.green.shade50
                    : _localizando
                        ? Colors.blue.shade50
                        : Colors.red.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: _position != null
                      ? Colors.green.shade200
                      : _localizando
                          ? Colors.blue.shade200
                          : Colors.red.shade200,
                ),
              ),
              child: Row(
                children: [
                  _localizando
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : Icon(
                          _position != null ? Icons.location_on : Icons.location_off,
                          size: 18,
                          color: _position != null ? Colors.green : Colors.red,
                        ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _localizando
                          ? 'Obtendo localização GPS...'
                          : _position != null
                              ? 'GPS: ${_position!.latitude.toStringAsFixed(5)}, ${_position!.longitude.toStringAsFixed(5)}'
                              : 'Localização não disponível',
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                  if (!_localizando && _position == null)
                    TextButton(onPressed: _obterLocalizacao, child: const Text('Tentar novamente')),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Categoria
            if (_categorias.isNotEmpty) ...[
              const Text('Categoria', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _categorias.map((cat) {
                  final selected = _categoriaSelecionada == cat['id'];
                  return ChoiceChip(
                    label: Text(cat['nome'] as String, style: TextStyle(fontSize: 12, color: selected ? Colors.white : Colors.black87)),
                    selected: selected,
                    selectedColor: const Color(0xFF1D4ED8),
                    onSelected: (_) => setState(() => _categoriaSelecionada = selected ? null : cat['id'] as String),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
            ],

            // Descrição
            const Text('Descrição *', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(height: 8),
            TextFormField(
              controller: _descricaoCtrl,
              maxLines: 4,
              maxLength: 2000,
              decoration: InputDecoration(
                hintText: 'Descreva a ocorrência com o máximo de detalhes...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                filled: true,
                fillColor: Colors.grey.shade50,
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Descrição é obrigatória';
                if (v.trim().length < 10) return 'Mínimo 10 caracteres';
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Fotos
            const Text('Fotos (máx. 5)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(height: 8),
            if (_imagens.isNotEmpty)
              SizedBox(
                height: 100,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _imagens.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(File(_imagens[i].path), width: 100, height: 100, fit: BoxFit.cover),
                      ),
                      Positioned(
                        top: 4, right: 4,
                        child: GestureDetector(
                          onTap: () => setState(() => _imagens.removeAt(i)),
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(12)),
                            child: const Icon(Icons.close, size: 14, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _imagens.length < 5 ? () => _adicionarImagem(ImageSource.camera) : null,
                    icon: const Icon(Icons.camera_alt_outlined, size: 18),
                    label: const Text('Câmera'),
                    style: OutlinedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _imagens.length < 5 ? () => _adicionarImagem(ImageSource.gallery) : null,
                    icon: const Icon(Icons.photo_library_outlined, size: 18),
                    label: const Text('Galeria'),
                    style: OutlinedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                  ),
                ),
              ],
            ),

            if (_erro != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.red.shade200)),
                child: Text(_erro!, style: TextStyle(color: Colors.red.shade700, fontSize: 13)),
              ),
            ],

            const SizedBox(height: 24),
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _salvando ? null : _salvar,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _salvando
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Registrar Ocorrência', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
