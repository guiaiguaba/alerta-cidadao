import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ─── Design tokens ────────────────────────────────────────────
class AppColors {
  // Brand
  static const orange = Color(0xFFFF6B2B);
  static const orangeLight = Color(0xFFFF8C5A);
  static const orangeDark = Color(0xFFE85520);

  // Dark theme surfaces
  static const darkBg = Color(0xFF0F1117);
  static const darkSurface = Color(0xFF1A1D27);
  static const darkCard = Color(0xFF21253A);
  static const darkBorder = Color(0xFF2E3347);
  static const darkMuted = Color(0xFF8B90A0);

  // Light theme surfaces
  static const lightBg = Color(0xFFF0F2F8);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightCard = Color(0xFFF7F8FC);
  static const lightBorder = Color(0xFFE2E6F0);
  static const lightMuted = Color(0xFF8A92A6);

  // Semantic
  static const critical = Color(0xFFEF4444);
  static const high = Color(0xFFF97316);
  static const medium = Color(0xFFEAB308);
  static const low = Color(0xFF22C55E);
  static const info = Color(0xFF3B82F6);

  static const statusAberta = Color(0xFFEF4444);
  static const statusAndamento = Color(0xFF3B82F6);
  static const statusResolvida = Color(0xFF22C55E);
  static const statusCancelada = Color(0xFF6B7280);
}

class AppTheme {
  static ThemeData dark() {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.darkBg,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.orange,
        secondary: AppColors.orangeLight,
        surface: AppColors.darkSurface,
        error: AppColors.critical,
      ),
      cardTheme: const CardThemeData(
        color: AppColors.darkCard,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
          side: BorderSide(color: AppColors.darkBorder),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.darkBg,
        elevation: 0,
        scrolledUnderElevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        iconTheme: IconThemeData(color: Colors.white),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.darkSurface,
        selectedItemColor: AppColors.orange,
        unselectedItemColor: AppColors.darkMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.darkSurface,
        indicatorColor: AppColors.orange.withOpacity(0.15),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.orange);
          }
          return const IconThemeData(color: AppColors.darkMuted);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(color: AppColors.orange, fontSize: 11, fontWeight: FontWeight.w600);
          }
          return const TextStyle(color: AppColors.darkMuted, fontSize: 11);
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.darkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.darkBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.orange, width: 1.5),
        ),
        labelStyle: const TextStyle(color: AppColors.darkMuted),
        hintStyle: const TextStyle(color: AppColors.darkMuted),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.orange,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.2),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.darkCard,
        selectedColor: AppColors.orange.withOpacity(0.2),
        side: const BorderSide(color: AppColors.darkBorder),
        labelStyle: const TextStyle(fontSize: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.darkBorder, thickness: 1),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, letterSpacing: -0.5),
        headlineMedium: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, letterSpacing: -0.3),
        titleLarge: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        titleMedium: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: Colors.white),
        bodyMedium: TextStyle(color: AppColors.darkMuted),
        labelSmall: TextStyle(color: AppColors.darkMuted, fontSize: 11),
      ),
    );
  }

  static ThemeData light() {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.lightBg,
      colorScheme: const ColorScheme.light(
        primary: AppColors.orange,
        secondary: AppColors.orangeLight,
        surface: AppColors.lightSurface,
        error: AppColors.critical,
      ),
      cardTheme: const CardThemeData(
        color: AppColors.lightSurface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
          side: BorderSide(color: AppColors.lightBorder),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.lightSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        titleTextStyle: TextStyle(
          color: Color(0xFF1A1D27),
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        iconTheme: IconThemeData(color: Color(0xFF1A1D27)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.lightSurface,
        indicatorColor: AppColors.orange.withOpacity(0.12),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.orange);
          }
          return const IconThemeData(color: AppColors.lightMuted);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(color: AppColors.orange, fontSize: 11, fontWeight: FontWeight.w600);
          }
          return const TextStyle(color: AppColors.lightMuted, fontSize: 11);
        }),
        shadowColor: AppColors.lightBorder,
        elevation: 2,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.lightCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lightBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lightBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.orange, width: 1.5),
        ),
        labelStyle: const TextStyle(color: AppColors.lightMuted),
        hintStyle: const TextStyle(color: AppColors.lightMuted),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.orange,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.2),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.lightCard,
        selectedColor: AppColors.orange.withOpacity(0.12),
        side: const BorderSide(color: AppColors.lightBorder),
        labelStyle: const TextStyle(fontSize: 12, color: Color(0xFF1A1D27)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.lightBorder, thickness: 1),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(color: Color(0xFF0F1117), fontWeight: FontWeight.w800, letterSpacing: -0.5),
        headlineMedium: TextStyle(color: Color(0xFF0F1117), fontWeight: FontWeight.w700, letterSpacing: -0.3),
        titleLarge: TextStyle(color: Color(0xFF1A1D27), fontWeight: FontWeight.w700),
        titleMedium: TextStyle(color: Color(0xFF1A1D27), fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: Color(0xFF1A1D27)),
        bodyMedium: TextStyle(color: AppColors.lightMuted),
        labelSmall: TextStyle(color: AppColors.lightMuted, fontSize: 11),
      ),
    );
  }
}
