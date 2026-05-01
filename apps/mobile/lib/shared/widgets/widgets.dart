// lib/shared/widgets/priority_badge.dart
import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/occurrence.dart';
import '../../providers/providers.dart';


class PriorityBadge extends StatelessWidget {
  final String priority;
  const PriorityBadge({super.key, required this.priority});

  @override
  Widget build(BuildContext context) {
    final color = AppColors.priorityColor(priority);
    final bg    = AppColors.priorityBg(priority);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color:        bg,
        borderRadius: BorderRadius.circular(4),
        border:       Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        priority.toUpperCase(),
        style: TextStyle(
          fontFamily:    'IBMPlexMono',
          fontSize:      9,
          fontWeight:    FontWeight.w600,
          letterSpacing: 0.8,
          color:         color,
        ),
      ),
    );
  }
}

// ============================================================

// lib/shared/widgets/status_badge.dart
class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge({super.key, required this.status});

  static const _labels = {
    'open':        'Aberta',
    'assigned':    'Atribuída',
    'in_progress': 'Em Andamento',
    'resolved':    'Resolvida',
    'rejected':    'Rejeitada',
    'duplicate':   'Duplicata',
  };

  @override
  Widget build(BuildContext context) {
    final color = AppColors.statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color:        color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
        border:       Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        (_labels[status] ?? status).toUpperCase(),
        style: TextStyle(
          fontFamily:    'IBMPlexMono',
          fontSize:      9,
          fontWeight:    FontWeight.w600,
          letterSpacing: 0.8,
          color:         color,
        ),
      ),
    );
  }
}

// ============================================================

// lib/shared/widgets/occurrence_card.dart
class OccurrenceCard extends StatelessWidget {
  final Occurrence occurrence;
  final VoidCallback onTap;
  final bool showAgent;

  const OccurrenceCard({
    super.key,
    required this.occurrence,
    required this.onTap,
    this.showAgent = false,
  });

  @override
  Widget build(BuildContext context) {
    final occ   = occurrence;
    final color = AppColors.priorityColor(occ.priority);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        decoration: BoxDecoration(
          color:        AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border:       Border(left: BorderSide(color: color, width: 3)),
          boxShadow:    [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    occ.protocol,
                    style: const TextStyle(
                      fontFamily:  'IBMPlexMono',
                      fontSize:    12,
                      fontWeight:  FontWeight.w600,
                      color:       AppColors.amber,
                    ),
                  ),
                  Row(
                    children: [
                      PriorityBadge(priority: occ.priority),
                      const SizedBox(width: 6),
                      StatusBadge(status: occ.status),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 8),
              // Category
              Text(occ.categoryName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
              // Address
              if (occ.address != null) ...[
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 13, color: AppColors.textTertiary),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        occ.address!,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
              // Description preview
              if (occ.description != null && occ.description!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  occ.description!,
                  style: const TextStyle(fontSize: 12, color: AppColors.textTertiary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 8),
              // Footer
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (showAgent && occ.agentName != null)
                    Row(
                      children: [
                        const Icon(Icons.person_outline, size: 13, color: AppColors.textTertiary),
                        const SizedBox(width: 4),
                        Text(occ.agentName!, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                      ],
                    )
                  else const SizedBox.shrink(),
                  Text(
                    _formatRelative(occ.createdAt),
                    style: const TextStyle(fontFamily: 'IBMPlexMono', fontSize: 10, color: AppColors.textTertiary),
                  ),
                ],
              ),
              // SLA breach indicator
              if (occ.slaBreached)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.timer_off_outlined, size: 13, color: AppColors.critical),
                      const SizedBox(width: 4),
                      const Text('SLA violado', style: TextStyle(fontSize: 11, color: AppColors.critical, fontFamily: 'IBMPlexMono')),
                    ],
                  ),
                ),
              // Offline indicator
              if (occ.pendingSync)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off_outlined, size: 13, color: AppColors.medium),
                      const SizedBox(width: 4),
                      const Text('Aguardando sincronização', style: TextStyle(fontSize: 11, color: AppColors.medium, fontFamily: 'IBMPlexMono')),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatRelative(String iso) {
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1)  return 'agora';
    if (diff.inMinutes < 60) return '${diff.inMinutes}min';
    if (diff.inHours   < 24) return '${diff.inHours}h';
    return '${diff.inDays}d';
  }
}

// ============================================================

// lib/shared/widgets/offline_banner.dart
class OfflineBanner extends ConsumerWidget {
  final int pendingCount;
  const OfflineBanner({super.key, required this.pendingCount});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(isOnlineProvider);
    if (isOnline && pendingCount == 0) return const SizedBox.shrink();

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      color: isOnline ? AppColors.medium.withOpacity(0.15) : AppColors.criticalBg,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Icon(
                isOnline ? Icons.sync : Icons.wifi_off,
                size:  16,
                color: isOnline ? AppColors.medium : AppColors.critical,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isOnline
                    ? '$pendingCount ocorrência(s) aguardando sincronização'
                    : 'Sem conexão — salvando localmente',
                  style: TextStyle(
                    fontSize:   12,
                    color:      isOnline ? AppColors.medium : AppColors.critical,
                    fontFamily: 'IBMPlexMono',
                  ),
                ),
              ),
              if (isOnline && pendingCount > 0)
                TextButton(
                  onPressed: () => ref.read(offlineQueueProvider).syncPending(),
                  style:     TextButton.styleFrom(
                    padding:         const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    foregroundColor: AppColors.medium,
                  ),
                  child: const Text('Sincronizar', style: TextStyle(fontFamily: 'IBMPlexMono', fontSize: 11)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
