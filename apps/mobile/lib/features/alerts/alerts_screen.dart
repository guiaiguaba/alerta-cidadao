// lib/features/alerts/alerts_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/providers.dart';
import '../../models/alert.dart';


// Provider de alertas
final _alertsProvider = FutureProvider.autoDispose<List<AppAlert>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.getAlerts();
  final data = (res['data'] as List?) ?? [];
  return data.map((j) => AppAlert.fromJson(j as Map<String, dynamic>)).toList();
});

class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = ref.watch(_alertsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Alertas'),
        actions: [
          IconButton(
            icon:     const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_alertsProvider),
          ),
        ],
      ),
      body: alerts.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.amber)),
        error: (e, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppColors.critical, size: 40),
              const SizedBox(height: 12),
              Text('Erro ao carregar alertas', style: TextStyle(color: AppColors.textSecondary)),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () => ref.invalidate(_alertsProvider),
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
        data: (list) {
          if (list.isEmpty) {
            return const _EmptyAlerts();
          }

          // Separar: ativos vs histórico
          final active  = list.where((a) => !a.isExpired && a.status == 'sent').toList();
          final history = list.where((a) => a.isExpired  || a.status != 'sent').toList();

          return RefreshIndicator(
            color:    AppColors.amber,
            onRefresh: () async => ref.invalidate(_alertsProvider),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Alertas ativos
                if (active.isNotEmpty) ...[
                  Row(
                    children: [
                      Container(
                        width: 8, height: 8,
                        decoration: const BoxDecoration(
                          color: AppColors.critical, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 8),
                      const Text('ALERTAS ATIVOS', style: TextStyle(
                        fontFamily: 'IBMPlexMono', fontSize: 10,
                        letterSpacing: 1.2, color: AppColors.critical,
                        fontWeight: FontWeight.w600,
                      )),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ...active.map((a) => _AlertCard(alert: a, isActive: true)),
                  const SizedBox(height: 20),
                ],

                // Histórico
                if (history.isNotEmpty) ...[
                  const Text('HISTÓRICO', style: TextStyle(
                    fontFamily: 'IBMPlexMono', fontSize: 10,
                    letterSpacing: 1.2, color: AppColors.textTertiary,
                  )),
                  const SizedBox(height: 10),
                  ...history.map((a) => _AlertCard(alert: a, isActive: false)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _AlertCard extends StatelessWidget {
  final AppAlert alert;
  final bool     isActive;

  const _AlertCard({required this.alert, required this.isActive});

  Color get _severityColor {
    switch (alert.severity) {
      case 'critical': return AppColors.critical;
      case 'high':     return AppColors.high;
      case 'medium':   return AppColors.medium;
      default:         return AppColors.info;
    }
  }

  String get _typeLabel {
    const labels = {
      'flood_warning': 'Alagamento',
      'evacuation':    'Evacuação',
      'storm':         'Tempestade',
      'landslide':     'Deslizamento',
      'fire':          'Incêndio',
      'earthquake':    'Terremoto',
      'other':         'Aviso Geral',
    };
    return labels[alert.alertType] ?? alert.alertType;
  }

  String get _scopeLabel {
    switch (alert.targetScope) {
      case 'all':     return 'Toda a cidade';
      case 'regions': return 'Região específica';
      case 'radius':  return 'Área delimitada';
      default:        return 'Geral';
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _severityColor;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color:        isActive ? color.withOpacity(0.06) : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border:       Border(
          left: BorderSide(color: color, width: isActive ? 4 : 2),
          top:    BorderSide(color: isActive ? color.withOpacity(0.2) : AppColors.border),
          right:  BorderSide(color: isActive ? color.withOpacity(0.2) : AppColors.border),
          bottom: BorderSide(color: isActive ? color.withOpacity(0.2) : AppColors.border),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Type + scope badges
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color:        color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(4),
                    border:       Border.all(color: color.withOpacity(0.3)),
                  ),
                  child: Text(_typeLabel, style: TextStyle(
                    fontFamily: 'IBMPlexMono', fontSize: 9,
                    fontWeight: FontWeight.w600, color: color,
                    letterSpacing: 0.5,
                  )),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color:        AppColors.panel,
                    borderRadius: BorderRadius.circular(4),
                    border:       Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.location_on_outlined, size: 9, color: AppColors.textTertiary),
                      const SizedBox(width: 3),
                      Text(_scopeLabel, style: const TextStyle(
                        fontFamily: 'IBMPlexMono', fontSize: 9,
                        color: AppColors.textTertiary,
                      )),
                    ],
                  ),
                ),
                const Spacer(),
                if (isActive)
                  Row(
                    children: [
                      Container(
                        width: 6, height: 6,
                        decoration: const BoxDecoration(
                          color: AppColors.critical, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 4),
                      Text('ATIVO', style: const TextStyle(
                        fontFamily: 'IBMPlexMono', fontSize: 9,
                        color: AppColors.critical, fontWeight: FontWeight.w700,
                      )),
                    ],
                  ),
              ],
            ),

            const SizedBox(height: 10),

            // Title
            Text(
              alert.title,
              style: TextStyle(
                fontSize:   isActive ? 16 : 14,
                fontWeight: FontWeight.w600,
                color:      isActive ? AppColors.textPrimary : AppColors.textSecondary,
              ),
            ),

            const SizedBox(height: 6),

            // Message
            Text(
              alert.message,
              style: TextStyle(
                fontSize: 13,
                color:    AppColors.textSecondary,
                height:   1.4,
              ),
            ),

            const SizedBox(height: 10),

            // Footer: data + destinatários
            Row(
              children: [
                const Icon(Icons.schedule, size: 12, color: AppColors.textTertiary),
                const SizedBox(width: 4),
                Text(_relativeTime(alert.sentAt ?? alert.createdAt),
                  style: const TextStyle(
                    fontSize: 11, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono')),
                if (alert.recipientsCount > 0) ...[
                  const SizedBox(width: 12),
                  const Icon(Icons.people_outline, size: 12, color: AppColors.textTertiary),
                  const SizedBox(width: 4),
                  Text('${_formatNumber(alert.recipientsCount)} dispositivos',
                    style: const TextStyle(
                      fontSize: 11, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono')),
                ],
              ],
            ),

            // Aviso de expiração
            if (alert.expiresAt != null && !alert.isExpired) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.timer_outlined, size: 12, color: AppColors.medium),
                  const SizedBox(width: 4),
                  Text('Expira em ${_relativeTime(alert.expiresAt!)}',
                    style: const TextStyle(
                      fontSize: 11, color: AppColors.medium, fontFamily: 'IBMPlexMono')),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _relativeTime(String iso) {
    final dt   = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.isNegative) {
      final pos = dt.difference(DateTime.now());
      if (pos.inMinutes < 60) return '${pos.inMinutes}min';
      return '${pos.inHours}h';
    }
    if (diff.inMinutes < 1)  return 'agora';
    if (diff.inMinutes < 60) return '${diff.inMinutes}min atrás';
    if (diff.inHours   < 24) return '${diff.inHours}h atrás';
    return '${diff.inDays}d atrás';
  }

  String _formatNumber(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000)    return '${(n / 1000).toStringAsFixed(1)}k';
    return n.toString();
  }
}

class _EmptyAlerts extends StatelessWidget {
  const _EmptyAlerts();

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 72, height: 72,
          decoration: BoxDecoration(
            color:        AppColors.low.withOpacity(0.1),
            shape:        BoxShape.circle,
          ),
          child: const Icon(Icons.notifications_none, size: 36, color: AppColors.low),
        ),
        const SizedBox(height: 16),
        const Text('Nenhum alerta ativo', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
        const SizedBox(height: 6),
        Text(
          'Você será notificado quando houver\nalertas para a sua região.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
      ],
    ),
  );
}
