// lib/shared/widgets/municipal_header.dart
// Header fixo com logo e nome da prefeitura — usado no app do cidadão e do agente

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_config.dart';
import '../../providers/tenant_config_provider.dart';


/// Widget que exibe logo + nome da prefeitura + subtítulo opcional
/// Tamanho compacto para uso em AppBar title
class MunicipalTitle extends ConsumerWidget {
  final String? subtitulo;

  const MunicipalTitle({super.key, this.subtitulo});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nome   = ref.watch(tenantNomeProvider);
    final logo   = ref.watch(tenantLogoProvider);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Logo ou ícone padrão
        Container(
          width:  34,
          height: 34,
          decoration: BoxDecoration(
            color:        AppColors.amber.withOpacity(0.12),
            borderRadius: BorderRadius.circular(8),
            border:       Border.all(color: AppColors.amber.withOpacity(0.25)),
          ),
          child: logo != null && logo.isNotEmpty
              ? ClipRRect(
            borderRadius: BorderRadius.circular(7),
            child: CachedNetworkImage(
              imageUrl: logo,
              fit:      BoxFit.contain,
              errorWidget: (_, __, ___) => _defaultIcon(),
            ),
          )
              : _defaultIcon(),
        ),

        const SizedBox(width: 10),

        // Nome + subtítulo
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize:       MainAxisSize.min,
          children: [
            Text(
              nome,
              style: const TextStyle(
                fontFamily:  'IBMPlexSans',
                fontSize:    14,
                fontWeight:  FontWeight.w700,
                color:       AppColors.textPrimary,
              ),
            ),
            if (subtitulo != null)
              Text(
                subtitulo!,
                style: const TextStyle(
                  fontFamily:  'IBMPlexMono',
                  fontSize:    10,
                  color:       AppColors.textTertiary,
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _defaultIcon() => const Icon(
    Icons.warning_amber_rounded,
    color: AppColors.amber,
    size:  20,
  );
}

/// PreferredSize widget pronto para usar como AppBar quando precisar
/// de header fixo com fundo completo
class MunicipalAppBar extends ConsumerWidget implements PreferredSizeWidget {
  final String?    subtitulo;
  final List<Widget>? actions;

  const MunicipalAppBar({super.key, this.subtitulo, this.actions});

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppBar(
      backgroundColor: AppColors.surface,
      elevation:       0,
      title: MunicipalTitle(subtitulo: subtitulo),
      actions: actions,
    );
  }
}