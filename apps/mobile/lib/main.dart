// lib/main.dart  (genérico — usado pelo main_citizen.dart e main_agent.dart)
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'app.dart';
import 'main.dart' as app;
import 'models/category.dart';
import 'models/occurrence.dart';
import 'models/sync_item.dart';
import 'models/user.dart';

Future<void> mainCommon() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Orientação bloqueada em portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Tema da status bar
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:           Colors.transparent,
    statusBarIconBrightness:  Brightness.light,
    statusBarBrightness:      Brightness.dark,
  ));

  // Inicializar Hive
  await Hive.initFlutter();
  // Adaptadores gerados pelo hive_generator (build_runner)
   Hive.registerAdapter(OccurrenceAdapter());
   Hive.registerAdapter(OccurrenceMediaAdapter());
   Hive.registerAdapter(AppUserAdapter());
   Hive.registerAdapter(CategoryAdapter());
   Hive.registerAdapter(SyncQueueItemAdapter());

  // Inicializar Firebase
  await Firebase.initializeApp();

  runApp(
    const ProviderScope(
      child: AlertaCidadaoApp(),
    ),
  );
}

// ============================================================

// lib/main_citizen.dart — Flavor CIDADÃO
// flutter run --flavor citizen --target lib/main_citizen.dart


void main() async {
  // Configurações específicas do flavor cidadão
  const String.fromEnvironment('FLAVOR', defaultValue: 'citizen');
  await app.mainCommon();
}

// ============================================================

// lib/main_agent.dart — Flavor AGENTE
// flutter run --flavor agent --target lib/main_agent.dart
// ignore_for_file: unused_import
