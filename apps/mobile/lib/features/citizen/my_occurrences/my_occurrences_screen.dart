// lib/features/citizen/my_occurrences/my_occurrences_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/providers.dart';
import '../../../models/models.dart';
import '../../../shared/widgets/widgets.dart';

class MyOccurrencesScreen extends ConsumerWidget {
  const MyOccurrencesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(occurrencesProvider);

    // Apenas ocorrências do cidadão atual
    // (O backend filtra por reporter_id via JWT — aqui mostramos tudo retornado)
    final items = state.items;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Minhas Ocorrências'),
        actions: [
          IconButton(
            icon:     const Icon(Icons.refresh),
            onPressed: () => ref.read(occurrencesProvider.notifier).load(),
            tooltip:  'Atualizar',
          ),
        ],
      ),
      body: RefreshIndicator(
        color:    AppColors.amber,
        onRefresh: () => ref.read(occurrencesProvider.notifier).load(),
        child: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.amber))
          : items.isEmpty
            ? _EmptyState()
            : ListView.builder(
                padding:     const EdgeInsets.symmetric(vertical: 12),
                itemCount:   items.length,
                itemBuilder: (context, i) {
                  final occ = items[i];
                  return OccurrenceCard(
                    occurrence: occ,
                    onTap:      () => context.push('/citizen/occurrences/${occ.id}'),
                    showAgent:  true,
                  );
                },
              ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width:  80,
          height: 80,
          decoration: BoxDecoration(
            color:        AppColors.amber.withOpacity(0.08),
            borderRadius: BorderRadius.circular(40),
          ),
          child: const Icon(Icons.check_circle_outline, size: 40, color: AppColors.amber),
        ),
        const SizedBox(height: 16),
        const Text(
          'Nenhuma ocorrência registrada',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 8),
        Text(
          'Você ainda não registrou nenhuma ocorrência.\nToque no + para começar.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        const SizedBox(height: 24),
        ElevatedButton.icon(
          onPressed: () => context.go('/citizen/report'),
          icon:  const Icon(Icons.add),
          label: const Text('Registrar agora'),
        ),
      ],
    ),
  );
}
