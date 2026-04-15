import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';


// ─── AppCard ──────────────────────────────────────────────────
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final Color? borderColor;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: isDark ? AppColors.darkCard : AppColors.lightSurface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: padding ?? const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: borderColor ?? (isDark ? AppColors.darkBorder : AppColors.lightBorder),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

// ─── StatusBadge ──────────────────────────────────────────────
class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge(this.status, {super.key});

  static const _config = {
    'aberta':       ('Novo',         AppColors.statusAberta),
    'em_andamento': ('Em atend.',     AppColors.statusAndamento),
    'resolvida':    ('Concluído',    AppColors.statusResolvida),
    'cancelada':    ('Cancelado',    AppColors.statusCancelada),
  };

  @override
  Widget build(BuildContext context) {
    final (label, color) = _config[status] ?? ('—', AppColors.statusCancelada);
    return _pill(label, color);
  }
}

// ─── PriorityBadge ────────────────────────────────────────────
class PriorityBadge extends StatelessWidget {
  final String priority;
  const PriorityBadge(this.priority, {super.key});

  static const _config = {
    'baixa':   ('• Baixo',  AppColors.low),
    'normal':  ('• Médio',  AppColors.medium),
    'alta':    ('• Alto',   AppColors.high),
    'critica': ('• Crítico',AppColors.critical),
  };

  @override
  Widget build(BuildContext context) {
    final (label, color) = _config[priority] ?? ('• Normal', AppColors.medium);
    return _pill(label, color);
  }
}

Widget _pill(String label, Color color) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
    decoration: BoxDecoration(
      color: color.withOpacity(0.15),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: color.withOpacity(0.3)),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: color,
        fontSize: 11,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.2,
      ),
    ),
  );
}

// ─── SeveritySelector ─────────────────────────────────────────
class SeveritySelector extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;

  const SeveritySelector({
    super.key,
    required this.selected,
    required this.onChanged,
  });

  static const _options = [
    ('baixa',  'Baixa',  AppColors.low),
    ('normal', 'Média',  AppColors.medium),
    ('alta',   'Alta',   AppColors.critical),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: _options.map((opt) {
        final (value, label, color) = opt;
        final isSelected = selected == value;
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: GestureDetector(
              onTap: () => onChanged(value),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 44,
                decoration: BoxDecoration(
                  color: isSelected ? color.withOpacity(0.2) : (isDark ? AppColors.darkCard : AppColors.lightCard),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isSelected ? color : (isDark ? AppColors.darkBorder : AppColors.lightBorder),
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 8, height: 8,
                      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      label,
                      style: TextStyle(
                        color: isSelected ? color : (isDark ? AppColors.darkMuted : AppColors.lightMuted),
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ─── CategoryGrid ─────────────────────────────────────────────
class CategoryGrid extends StatelessWidget {
  final List<Map<String, dynamic>> categories;
  final String? selected;
  final ValueChanged<String?> onChanged;

  const CategoryGrid({
    super.key,
    required this.categories,
    required this.selected,
    required this.onChanged,
  });

  static const _icons = {
    'Alagamento':    (Icons.water, AppColors.info),
    'Deslizamento':  (Icons.landslide_outlined, AppColors.high),
    'Incêndio':      (Icons.local_fire_department, AppColors.critical),
    'Elétrica':      (Icons.bolt, AppColors.medium),
    'Vendaval':      (Icons.tornado, AppColors.info),
    'Via':           (Icons.construction, AppColors.medium),
    'Vazamento':     (Icons.water_drop_outlined, AppColors.info),
    'Outro':         (Icons.warning_amber_outlined, AppColors.medium),
    // fallback para categorias dinâmicas do backend
  };

  (IconData, Color) _iconFor(String nome) {
    for (final entry in _icons.entries) {
      if (nome.toLowerCase().contains(entry.key.toLowerCase())) return entry.value;
    }
    return (Icons.warning_amber_outlined, AppColors.medium);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.88,
      ),
      itemCount: categories.length,
      itemBuilder: (_, i) {
        final cat = categories[i];
        final id = cat['id'] as String;
        final nome = cat['nome'] as String;
        final isSelected = selected == id;
        final (icon, color) = _iconFor(nome);

        return GestureDetector(
          onTap: () => onChanged(isSelected ? null : id),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            decoration: BoxDecoration(
              color: isSelected
                  ? color.withOpacity(0.15)
                  : (isDark ? AppColors.darkCard : AppColors.lightCard),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected ? color : (isDark ? AppColors.darkBorder : AppColors.lightBorder),
                width: isSelected ? 1.5 : 1,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: isSelected ? color : (isDark ? AppColors.darkMuted : AppColors.lightMuted), size: 26),
                const SizedBox(height: 6),
                Text(
                  nome.split(' ').first,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? color : (isDark ? Colors.white70 : const Color(0xFF1A1D27)),
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ─── TimelineItem ─────────────────────────────────────────────
class TimelineItem extends StatelessWidget {
  final String label;
  final String subtitle;
  final bool done;
  final bool isLast;

  const TimelineItem({
    super.key,
    required this.label,
    required this.subtitle,
    required this.done,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dotColor = done ? AppColors.low : (isDark ? AppColors.darkBorder : AppColors.lightBorder);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 12, height: 12,
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 1.5,
                    color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: done
                        ? (isDark ? Colors.white : const Color(0xFF0F1117))
                        : (isDark ? AppColors.darkMuted : AppColors.lightMuted),
                  )),
                  const SizedBox(height: 2),
                  Text(subtitle, style: TextStyle(
                    fontSize: 11,
                    color: isDark ? AppColors.darkMuted : AppColors.lightMuted,
                  )),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── ThemeToggleButton ────────────────────────────────────────
class ThemeToggleButton extends ConsumerWidget {
  const ThemeToggleButton({super.key});

  @override
  Widget build(BuildContext context, ref) {
    // import handled by using file
    return const SizedBox.shrink();
  }
}
