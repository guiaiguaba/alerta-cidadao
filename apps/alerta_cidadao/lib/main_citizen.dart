// lib/main_citizen.dart
// Ponto de entrada do flavor CIDADÃO
// flutter run --flavor citizen --target lib/main_citizen.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:firebase_core/firebase_core.dart';
import 'app.dart';
import 'models/category.dart';
import 'models/occurrence.dart';
import 'models/sync_item.dart';
import 'models/user.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor:          Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness:     Brightness.dark,
  ));

  await Hive.initFlutter();
  // Registrar adaptadores gerados pelo build_runner:
  Hive.registerAdapter(OccurrenceAdapter());
  Hive.registerAdapter(OccurrenceMediaAdapter());
  Hive.registerAdapter(AppUserAdapter());
  Hive.registerAdapter(CategoryAdapter());
  Hive.registerAdapter(SyncQueueItemAdapter());

  await Firebase.initializeApp();

  runApp(
    const ProviderScope(
      child: AlertaCidadaoApp(),
    ),
  );
}
