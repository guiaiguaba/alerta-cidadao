// lib/features/citizen/report_occurrence/report_screen.dart
// Fluxo em 3 passos: Categoria → Localização → Detalhes → Enviar
// Meta: < 30 segundos do início ao envio

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/location/geo_blocker.dart';
import '../../../core/location/location_service.dart';
import '../../../models/category.dart';
import '../../../providers/providers.dart';

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});

  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  final _pageController = PageController();
  final _uuid = const Uuid();

  int _step = 0;  // 0=categoria, 1=localização, 2=detalhes

  // Dados do formulário
  Category?        _selectedCategory;
  LocationResult?  _location;
  final _descCtrl = TextEditingController();
  File?            _photo;
  bool _locating  = false;
  bool _submitting = false;

  static const _stepsLabels = ['Categoria', 'Localização', 'Detalhes'];

  @override
  void dispose() {
    _pageController.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider);
    final isOnline   = ref.watch(isOnlineProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Registrar Ocorrência'),
        leading: _step == 0
          ? const BackButton()
          : IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: _prevStep,
            ),
        actions: [
          // Indicador offline
          if (!isOnline)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Chip(
                label: const Text('OFFLINE', style: TextStyle(fontSize: 10)),
                backgroundColor: AppColors.criticalBg,
                side: const BorderSide(color: AppColors.criticalBorder),
                labelStyle: const TextStyle(
                  color: AppColors.critical,
                  fontFamily: 'IBMPlexMono',
                  fontSize: 9,
                ),
              ),
            ),
        ],
      ),

      body: Column(
        children: [
          // ==========================================
          // PROGRESS STEPS
          // ==========================================
          _StepIndicator(current: _step, labels: _stepsLabels),

          // ==========================================
          // PÁGINAS
          // ==========================================
          Expanded(
            child: PageView(
              controller: _pageController,
              physics:    const NeverScrollableScrollPhysics(),
              children: [
                // STEP 0: Categoria
                _CategoryStep(
                  categories: categories.when(
                    data: (c) => c,
                    loading: () => [],
                    error: (_, __) => [],
                  ),
                  loading:    categories.isLoading,
                  selected:   _selectedCategory,
                  onSelect:   (cat) {
                    setState(() => _selectedCategory = cat);
                    _nextStep();
                  },
                ),

                // STEP 1: Localização
                _LocationStep(
                  location:  _location,
                  loading:   _locating,
                  onLocate:  _getLocation,
                  onNext:    _location != null ? _nextStep : null,
                ),

                // STEP 2: Detalhes
                _DetailsStep(
                  descController: _descCtrl,
                  photo:          _photo,
                  onPickPhoto:    _pickPhoto,
                  category:       _selectedCategory,
                  location:       _location,
                ),
              ],
            ),
          ),

          // ==========================================
          // BOTTOM ACTION (Passo 2)
          // ==========================================
          if (_step == 2)
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: SizedBox(
                  width:  double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                      ? const SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.black,
                          ),
                        )
                      : Text(isOnline ? 'Registrar Ocorrência' : 'Salvar Offline'),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _nextStep() {
    if (_step < 2) {
      setState(() => _step++);
      _pageController.animateToPage(
        _step,
        duration: const Duration(milliseconds: 300),
        curve:    Curves.easeInOut,
      );
    }
  }

  void _prevStep() {
    if (_step > 0) {
      setState(() => _step--);
      _pageController.animateToPage(
        _step,
        duration: const Duration(milliseconds: 300),
        curve:    Curves.easeInOut,
      );
    } else {
      context.pop();
    }
  }

  Future<void> _getLocation() async {
    setState(() => _locating = true);
    try {
      final locationService = ref.read(locationServiceProvider);
      final result = await locationService.getCurrentLocation();
      setState(() => _location = result);
      // Auto-advance se obteve localização
      if (result != null) {
        await Future.delayed(const Duration(milliseconds: 600));
        _nextStep();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e is LocationException ? e.message : 'Erro ao obter localização'),
            backgroundColor: AppColors.critical,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.surface,
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.camera_alt_outlined),
            title:   const Text('Câmera'),
            onTap:   () => Navigator.pop(context, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title:   const Text('Galeria'),
            onTap:   () => Navigator.pop(context, ImageSource.gallery),
          ),
        ],
      ),
    );

    if (source == null) return;

    final picked = await picker.pickImage(
      source:    source,
      maxWidth:  1280,
      maxHeight: 960,
      imageQuality: 80,
    );

    if (picked != null) {
      setState(() => _photo = File(picked.path));
    }
  }

  Future<void> _submit() async {
    if (_selectedCategory == null || _location == null) return;

    setState(() => _submitting = true);

    final permitido = await GeoBlocker.verificar(
      context,
      ref.read(apiClientProvider),
    );

    if (!permitido) {
      if (mounted) setState(() => _submitting = false);
      return;
    }

    final clientId = _uuid.v4();
    final isOnline = ref.read(isOnlineProvider);
    final queue    = ref.read(offlineQueueProvider);
    final api      = ref.read(apiClientProvider);

    final payload = {
      'categoryId': _selectedCategory!.id,
      'description': _descCtrl.text.trim().isEmpty
          ? null
          : _descCtrl.text.trim(),
      'lat': _location!.lat,
      'lng': _location!.lng,
      'address': _location!.address,
      'clientId': clientId,
    };

    try {
      if (isOnline) {
        final occ = await api.createOccurrence(payload);

        // 🔒 Extração segura
        final occId = occ['id']?.toString() ?? '';
        final protocol = occ['protocol']?.toString() ?? '---';

        // Upload foto
        if (_photo != null && occId.isNotEmpty) {
          try {
            await api.uploadMedia(occId, _photo!, 'report');
          } catch (_) {
            // falha não bloqueia fluxo
          }
        }

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Ocorrência registrada: $protocol ✅'),
              backgroundColor: AppColors.low,
            ),
          );

          context.go('/citizen/occurrences');
        }
      } else {
        // Offline
        await queue.enqueueCreateOccurrence(payload);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Salvo offline — será enviado ao reconectar 📶'),
              backgroundColor: AppColors.medium,
            ),
          );

          context.go('/citizen/occurrences');
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro: $e'),
            backgroundColor: AppColors.critical,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

// ============================================================
// SUB-WIDGETS DOS PASSOS
// ============================================================

class _StepIndicator extends StatelessWidget {
  final int    current;
  final List<String> labels;

  const _StepIndicator({required this.current, required this.labels});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: List.generate(labels.length, (i) {
          final isActive   = i == current;
          final isComplete = i < current;
          return Expanded(
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  width:  24, height: 24,
                  decoration: BoxDecoration(
                    color:        isComplete ? AppColors.low
                                : isActive  ? AppColors.amber
                                : AppColors.muted,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: isComplete
                      ? const Icon(Icons.check, size: 14, color: Colors.black)
                      : Text(
                          '${i + 1}',
                          style: TextStyle(
                            fontSize:   11,
                            fontWeight: FontWeight.w700,
                            color:      isActive ? Colors.black : AppColors.textTertiary,
                          ),
                        ),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  labels[i],
                  style: TextStyle(
                    fontFamily: 'IBMPlexMono',
                    fontSize:   10,
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                    color:      isActive ? AppColors.amber : AppColors.textTertiary,
                  ),
                ),
                if (i < labels.length - 1)
                  Expanded(
                    child: Container(
                      height:  1,
                      margin:  const EdgeInsets.symmetric(horizontal: 6),
                      color:   i < current ? AppColors.low : AppColors.border,
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

// ---- Step 0: Seleção de Categoria ----
class _CategoryStep extends StatelessWidget {
  final List<Category> categories;
  final bool           loading;
  final Category?      selected;
  final void Function(Category) onSelect;

  const _CategoryStep({
    required this.categories,
    required this.loading,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.amber));
    }

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'O que está acontecendo?',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(
            'Selecione a categoria da ocorrência',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: GridView.builder(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount:   3,
                mainAxisSpacing:  10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.85,
              ),
              itemCount: categories.length,
              itemBuilder: (context, i) {
                final cat = categories[i];
                final color = cat.color != null
                  ? Color(int.parse(cat.color!.replaceFirst('#', '0xFF')))
                  : AppColors.amber;

                return GestureDetector(
                  onTap: () => onSelect(cat),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    decoration: BoxDecoration(
                      color:        color.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color:  color.withOpacity(0.3),
                        width:  1.5,
                      ),
                    ),
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.warning_amber_rounded, color: color, size: 28),
                        const SizedBox(height: 8),
                        Text(
                          cat.name,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize:   11,
                            fontWeight: FontWeight.w500,
                            color:      AppColors.textPrimary,
                            height:     1.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ---- Step 1: Localização ----
class _LocationStep extends StatelessWidget {
  final LocationResult? location;
  final bool            loading;
  final VoidCallback    onLocate;
  final VoidCallback?   onNext;

  const _LocationStep({
    required this.location,
    required this.loading,
    required this.onLocate,
    this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(
            location != null ? Icons.location_on : Icons.location_searching,
            size:  64,
            color: location != null ? AppColors.low : AppColors.amber,
          ),
          const SizedBox(height: 24),

          if (location != null) ...[
            const Text(
              'Localização obtida ✅',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.low),
            ),
            const SizedBox(height: 8),
            if (location!.address != null)
              Text(
                location!.address!,
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
              ),
            Text(
              '${location!.lat.toStringAsFixed(6)}, ${location!.lng.toStringAsFixed(6)}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'IBMPlexMono',
                fontSize:   11,
                color:      AppColors.textTertiary,
              ),
            ),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              onPressed: onLocate,
              icon:  const Icon(Icons.my_location),
              label: const Text('Usar outra localização'),
            ),
          ] else ...[
            Text(
              'Precisamos saber onde está a ocorrência',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 15),
            ),
            const SizedBox(height: 32),
            if (loading)
              Column(
                children: [
                  const CircularProgressIndicator(color: AppColors.amber),
                  const SizedBox(height: 12),
                  Text(
                    'Obtendo localização GPS...',
                    style: TextStyle(color: AppColors.textSecondary, fontFamily: 'IBMPlexMono', fontSize: 12),
                  ),
                ],
              )
            else
              ElevatedButton.icon(
                onPressed: onLocate,
                icon:  const Icon(Icons.my_location),
                label: const Text('Usar minha localização atual'),
              ),
          ],
        ],
      ),
    );
  }
}

// ---- Step 2: Detalhes ----
class _DetailsStep extends StatelessWidget {
  final TextEditingController descController;
  final File?                 photo;
  final VoidCallback          onPickPhoto;
  final Category?             category;
  final LocationResult?       location;

  const _DetailsStep({
    required this.descController,
    required this.photo,
    required this.onPickPhoto,
    required this.category,
    required this.location,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Resumo
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color:        AppColors.panel,
              borderRadius: BorderRadius.circular(10),
              border:       const BorderSide(color: AppColors.border).style != BorderStyle.none
                ? const Border.fromBorderSide(BorderSide(color: AppColors.border))
                : null,
            ),
            child: Column(
              children: [
                _SummaryRow(
                  icon:  Icons.category_outlined,
                  label: 'Categoria',
                  value: category?.name ?? '—',
                ),
                const Divider(height: 12),
                _SummaryRow(
                  icon:  Icons.location_on_outlined,
                  label: 'Local',
                  value: location?.address ?? 'GPS obtido',
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          const Text(
            'DESCRIÇÃO',
            style: TextStyle(
              fontFamily:    'IBMPlexMono',
              fontSize:      10,
              letterSpacing: 1.2,
              color:         AppColors.textTertiary,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller:   descController,
            maxLines:     4,
            maxLength:    500,
            decoration: const InputDecoration(
              hintText: 'Descreva o que está acontecendo (opcional)...',
              counterStyle: TextStyle(color: AppColors.textTertiary, fontSize: 10),
            ),
          ),

          const SizedBox(height: 20),

          const Text(
            'FOTO (OPCIONAL)',
            style: TextStyle(
              fontFamily:    'IBMPlexMono',
              fontSize:      10,
              letterSpacing: 1.2,
              color:         AppColors.textTertiary,
            ),
          ),
          const SizedBox(height: 8),

          GestureDetector(
            onTap: onPickPhoto,
            child: photo != null
              ? Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.file(photo!, height: 180, width: double.infinity, fit: BoxFit.cover),
                    ),
                    Positioned(
                      top: 8, right: 8,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color:        Colors.black54,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(Icons.edit, size: 16, color: Colors.white),
                      ),
                    ),
                  ],
                )
              : Container(
                  height:       120,
                  decoration: BoxDecoration(
                    color:        AppColors.panel,
                    borderRadius: BorderRadius.circular(10),
                    border:       Border.all(color: AppColors.border, style: BorderStyle.solid),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.add_a_photo_outlined, color: AppColors.textTertiary, size: 32),
                      const SizedBox(height: 8),
                      Text(
                        'Toque para adicionar foto',
                        style: TextStyle(color: AppColors.textTertiary, fontSize: 13),
                      ),
                    ],
                  ),
                ),
          ),

          const SizedBox(height: 16),

          // Dica de urgência
          if (category?.defaultPriority == 'critical' || category?.defaultPriority == 'high')
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color:        AppColors.criticalBg,
                borderRadius: BorderRadius.circular(8),
                border:       const Border.fromBorderSide(BorderSide(color: AppColors.criticalBorder)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning, color: AppColors.critical, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Esta categoria é de alta prioridade. Os agentes serão notificados imediatamente.',
                      style: const TextStyle(
                        fontSize: 12,
                        color:    AppColors.critical,
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

class _SummaryRow extends StatelessWidget {
  final IconData icon;
  final String   label;
  final String   value;

  const _SummaryRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 16, color: AppColors.textTertiary),
      const SizedBox(width: 8),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 10, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono')),
            Text(value, style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
          ],
        ),
      ),
    ],
  );
}
