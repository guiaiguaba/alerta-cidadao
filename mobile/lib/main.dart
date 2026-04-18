import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'core/models/ocorrencia_local.dart';
import 'core/router.dart';

const _orange = Color(0xFFFF6B2B);

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
    return MaterialApp.router(
      title: 'Alerta Cidadão',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: _orange,
          primary: _orange,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF0F1117),
          elevation: 0,
          scrolledUnderElevation: 0,
        ),
        navigationBarTheme: NavigationBarThemeData(
          indicatorColor: _orange.withOpacity(0.12),
          iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
            color: s.contains(WidgetState.selected) ? _orange : const Color(0xFF6B7280),
          )),
          labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            color: s.contains(WidgetState.selected) ? _orange : const Color(0xFF6B7280),
            fontSize: 11,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
          )),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: _orange,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: _orange,
          foregroundColor: Colors.white,
        ),
        progressIndicatorTheme: const ProgressIndicatorThemeData(color: _orange),
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: _orange,
          primary: _orange,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF0F1117),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0F1117),
          foregroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0,
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: const Color(0xFF1A1D27),
          indicatorColor: _orange.withOpacity(0.15),
          iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
            color: s.contains(WidgetState.selected) ? _orange : const Color(0xFF8B90A0),
          )),
          labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            color: s.contains(WidgetState.selected) ? _orange : const Color(0xFF8B90A0),
            fontSize: 11,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
          )),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: _orange,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: _orange,
          foregroundColor: Colors.white,
        ),
        progressIndicatorTheme: const ProgressIndicatorThemeData(color: _orange),
        cardTheme: CardThemeData(
          color: const Color(0xFF21253A),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFF2E3347)),
          ),
        ),
      ),
      themeMode: ThemeMode.system,
    );
  }
}
