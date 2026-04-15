import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'core/models/ocorrencia_local.dart';
import 'core/router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await Hive.initFlutter();
  Hive.registerAdapter(OcorrenciaLocalAdapter());
  await Hive.openBox<OcorrenciaLocal>('ocorrencias_pendentes');

  runApp(const ProviderScope(child: AlertaCidadaoApp()));
}

class AlertaCidadaoApp extends ConsumerWidget {
  const AlertaCidadaoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeAsync = ref.watch(themeNotifierProvider);
    final themeMode = themeAsync.valueOrNull ?? ThemeMode.dark;

    return MaterialApp.router(
      title: 'Alerta Cidadão',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: themeMode,
    );
  }
}
