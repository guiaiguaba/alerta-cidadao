import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kThemeKey = 'app_theme_mode';

final themeNotifierProvider = AsyncNotifierProvider<ThemeNotifier, ThemeMode>(ThemeNotifier.new);

class ThemeNotifier extends AsyncNotifier<ThemeMode> {
  @override
  Future<ThemeMode> build() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kThemeKey);
    return switch (saved) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.dark, // padrão escuro como no mockup
    };
  }

  Future<void> setTheme(ThemeMode mode) async {
    state = AsyncData(mode);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kThemeKey, mode.name);
  }

  Future<void> toggle() async {
    final current = state.valueOrNull ?? ThemeMode.dark;
    await setTheme(current == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
  }
}

// Helper para acessar isDark facilmente
final isDarkProvider = Provider<bool>((ref) {
  final mode = ref.watch(themeNotifierProvider).valueOrNull ?? ThemeMode.dark;
  return mode == ThemeMode.dark;
});
