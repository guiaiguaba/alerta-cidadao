import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'core/models/ocorrencia_local.dart';
import 'core/router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp();

  await Hive.initFlutter();
  Hive.registerAdapter(OcorrenciaLocalAdapter());
  await Hive.openBox<OcorrenciaLocal>('ocorrencias_pendentes');

  runApp(
    const ProviderScope(
      child: AlertaCidadaoApp(),
    ),
  );
}

class AlertaCidadaoApp extends ConsumerWidget {
  const AlertaCidadaoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Alerta Cidadão',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1D4ED8)),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF1D4ED8),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
      ),
    );
  }
}
