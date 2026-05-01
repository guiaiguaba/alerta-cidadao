// lib/features/alerts/alerts_screen.dart
// Tela de notificações — mostra push recebidos, salvos localmente no Hive
// Suporta formatação: *negrito* e _itálico_

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/notifications/notification_storage.dart';

// ── Provider de notificações locais ───────────────────────
final _localNotifsProvider =
StateNotifierProvider<_NotifNotifier, List<LocalNotification>>(
      (ref) => _NotifNotifier(),
);

class _NotifNotifier extends StateNotifier<List<LocalNotification>> {
  _NotifNotifier() : super([]) { load(); }

  void load() {
    state = notificationStorage.getAll();
  }

  Future<void> markRead(String id) async {
    await notificationStorage.markAsRead(id);
    load();
  }

  Future<void> markAllRead() async {
    await notificationStorage.markAllAsRead();
    load();
  }

  Future<void> delete(String id) async {
    await notificationStorage.delete(id);
    load();
  }

  Future<void> clearAll() async {
    await notificationStorage.clearAll();
    load();
  }
}

// ── Tela principal ─────────────────────────────────────────
class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifs  = ref.watch(_localNotifsProvider);
    final notifier = ref.read(_localNotifsProvider.notifier);
    final unread  = notifs.where((n) => !n.isRead).length;

    return Scaffold(
      backgroundColor: AppColors.base,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(left: 16),
          child: Row(
            children: [
              const Text('Notificações', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              if (unread > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.critical,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text('$unread', style: const TextStyle(
                      fontSize: 10, color: Colors.white, fontWeight: FontWeight.w700)),
                ),
              ],
            ],
          ),
        ),
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: notifier.markAllRead,
              child: const Text('Ler todas', style: TextStyle(
                  fontSize: 11, color: AppColors.amber, fontFamily: 'IBMPlexMono')),
            ),
          if (notifs.isNotEmpty)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 20),
              onSelected: (val) async {
                if (val == 'clear') {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (_) => AlertDialog(
                      backgroundColor: AppColors.surface,
                      title: const Text('Limpar notificações'),
                      content: const Text('Remover todas as notificações salvas?'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(context, false),
                            child: const Text('Cancelar')),
                        TextButton(onPressed: () => Navigator.pop(context, true),
                            child: const Text('Limpar', style: TextStyle(color: AppColors.critical))),
                      ],
                    ),
                  );
                  if (ok == true) notifier.clearAll();
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'clear', child: Text('Limpar todas')),
              ],
            ),
        ],
      ),
      body: notifs.isEmpty
          ? _EmptyState()
          : RefreshIndicator(
        color: AppColors.amber,
        onRefresh: () async => notifier.load(),
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: notifs.length,
          itemBuilder: (_, i) => _NotifCard(
            notif: notifs[i],
            onTap: () async {
              if (!notifs[i].isRead) notifier.markRead(notifs[i].id);
              _showDetail(context, notifs[i]);
            },
            onDelete: () => notifier.delete(notifs[i].id),
          ),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context, LocalNotification notif) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        maxChildSize:     0.95,
        minChildSize:     0.4,
        expand:           false,
        builder: (_, ctrl) => _NotifDetail(notif: notif, scrollCtrl: ctrl),
      ),
    );
  }
}

// ── Card da lista ──────────────────────────────────────────
class _NotifCard extends StatelessWidget {
  final LocalNotification notif;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const _NotifCard({required this.notif, required this.onTap, required this.onDelete});

  Color get _color {
    switch (notif.severity) {
      case 'critical': return AppColors.critical;
      case 'high':     return AppColors.high;
      case 'medium':   return AppColors.medium;
      default:         return AppColors.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color;
    final isUnread = !notif.isRead;

    return Dismissible(
      key: ValueKey(notif.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: AppColors.critical.withOpacity(0.15),
        child: const Icon(Icons.delete_outline, color: AppColors.critical),
      ),
      onDismissed: (_) => onDelete(),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color:        isUnread ? color.withOpacity(0.05) : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border(
              left: BorderSide(color: color, width: isUnread ? 3 : 2),
              top:    BorderSide(color: AppColors.border),
              right:  BorderSide(color: AppColors.border),
              bottom: BorderSide(color: AppColors.border),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        notif.title,
                        style: TextStyle(
                          fontSize:   14,
                          fontWeight: isUnread ? FontWeight.w700 : FontWeight.w500,
                          color:      AppColors.textPrimary,
                        ),
                      ),
                    ),
                    if (isUnread)
                      Container(
                        width: 8, height: 8, margin: const EdgeInsets.only(top: 4, left: 6),
                        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  // Limpar marcadores para preview
                  notif.body.replaceAll(RegExp(r'\*|_'), ''),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.access_time, size: 11, color: AppColors.textTertiary),
                    const SizedBox(width: 3),
                    Text(_relTime(notif.receivedAt),
                        style: const TextStyle(fontSize: 10, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono')),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _relTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1)  return 'agora';
    if (diff.inMinutes < 60) return '${diff.inMinutes}min atrás';
    if (diff.inHours   < 24) return '${diff.inHours}h atrás';
    if (diff.inDays    < 7)  return '${diff.inDays}d atrás';
    return '${dt.day.toString().padLeft(2,'0')}/${dt.month.toString().padLeft(2,'0')}/${dt.year}';
  }
}

// ── Detalhe completo (bottom sheet) ───────────────────────
class _NotifDetail extends StatelessWidget {
  final LocalNotification notif;
  final ScrollController scrollCtrl;

  const _NotifDetail({required this.notif, required this.scrollCtrl});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Handle
        Center(
          child: Container(
            margin: const EdgeInsets.symmetric(vertical: 10),
            width: 40, height: 4,
            decoration: BoxDecoration(
                color: AppColors.muted, borderRadius: BorderRadius.circular(2)),
          ),
        ),
        // Título
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(notif.title, style: const TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              ),
            ],
          ),
        ),
        // Data
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              const Icon(Icons.access_time, size: 13, color: AppColors.textTertiary),
              const SizedBox(width: 4),
              Text(_formatDate(notif.receivedAt),
                  style: const TextStyle(fontSize: 11, color: AppColors.textTertiary, fontFamily: 'IBMPlexMono')),
            ],
          ),
        ),
        const Divider(height: 20, indent: 20, endIndent: 20),
        // Corpo com formatação
        Expanded(
          child: SingleChildScrollView(
            controller: scrollCtrl,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: _RichBody(text: notif.body),
          ),
        ),
      ],
    );
  }

  String _formatDate(DateTime dt) {
    final d  = dt.day.toString().padLeft(2,'0');
    final mo = dt.month.toString().padLeft(2,'0');
    final h  = dt.hour.toString().padLeft(2,'0');
    final mi = dt.minute.toString().padLeft(2,'0');
    return '$d/$mo/${dt.year} às $h:$mi';
  }
}

// ── Renderizador de texto rico ─────────────────────────────
// Suporta *negrito* e _itálico_ (formato WhatsApp / SEDEC)
class _RichBody extends StatelessWidget {
  final String text;
  const _RichBody({required this.text});

  @override
  Widget build(BuildContext context) {
    final lines = text.split('\n');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines.map((line) {
        if (line.trim().isEmpty) return const SizedBox(height: 8);

        // Linha toda em negrito (ex: *CENÁRIO ATUAL*)
        if (line.trim().startsWith('*') && line.trim().endsWith('*') && !line.trim().contains(' ') == false) {
          final clean = line.trim().replaceAll('*', '');
          return Padding(
            padding: const EdgeInsets.only(top: 14, bottom: 4),
            child: Text(clean, style: const TextStyle(
              fontSize: 13, fontWeight: FontWeight.w700,
              color: AppColors.amber, fontFamily: 'IBMPlexMono',
              letterSpacing: 0.5,
            )),
          );
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: RichText(
            text: TextSpan(
              style: const TextStyle(
                  fontSize: 13.5, color: AppColors.textSecondary, height: 1.6),
              children: _parseInline(line),
            ),
          ),
        );
      }).toList(),
    );
  }

  List<TextSpan> _parseInline(String line) {
    final spans = <TextSpan>[];
    final regex = RegExp(r'\*([^*]+)\*|_([^_]+)_');
    int last = 0;

    for (final match in regex.allMatches(line)) {
      if (match.start > last) {
        spans.add(TextSpan(text: line.substring(last, match.start)));
      }
      if (match.group(1) != null) {
        // *negrito*
        spans.add(TextSpan(
          text: match.group(1),
          style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        ));
      } else if (match.group(2) != null) {
        // _itálico_
        spans.add(TextSpan(
          text: match.group(2),
          style: const TextStyle(fontStyle: FontStyle.italic, color: AppColors.textSecondary),
        ));
      }
      last = match.end;
    }

    if (last < line.length) {
      spans.add(TextSpan(text: line.substring(last)));
    }

    return spans;
  }
}

// ── Estado vazio ───────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 72, height: 72,
          decoration: BoxDecoration(
              color: AppColors.low.withOpacity(0.1), shape: BoxShape.circle),
          child: const Icon(Icons.notifications_none, size: 36, color: AppColors.low),
        ),
        const SizedBox(height: 16),
        const Text('Nenhuma notificação', style: TextStyle(
            fontSize: 16, fontWeight: FontWeight.w500, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        const Text(
          'Você será notificado quando houver\nalertas ou atualizações da Defesa Civil.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
      ],
    ),
  );
}