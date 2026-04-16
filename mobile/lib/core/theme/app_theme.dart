import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ── Paleta 100% laranja ───────────────────────────────────────
class AppColors {
  // Laranja principal
  static const orange      = Color(0xFFFF6B2B);
  static const orangeLight = Color(0xFFFF8C5A);
  static const orangeDark  = Color(0xFFE85520);
  static const orangeFaint = Color(0xFFFFF0EB);

  // Semânticas
  static const success  = Color(0xFF22C55E);
  static const warning  = Color(0xFFEAB308);
  static const danger   = Color(0xFFEF4444);
  static const info     = Color(0xFFFF8C5A); // laranja claro, não azul

  // Prioridades (sem azul)
  static const prioBaixa   = Color(0xFF22C55E);
  static const prioNormal  = Color(0xFFEAB308);
  static const prioAlta    = Color(0xFFF97316);
  static const prioCritica = Color(0xFFEF4444);

  // Status
  static const stAberta     = Color(0xFFEF4444);
  static const stAndamento  = Color(0xFFFF6B2B); // laranja, não azul
  static const stResolvida  = Color(0xFF22C55E);
  static const stCancelada  = Color(0xFF9CA3AF);

  // Dark surfaces
  static const darkBg      = Color(0xFF0F1117);
  static const darkSurface = Color(0xFF1A1D27);
  static const darkCard    = Color(0xFF21253A);
  static const darkBorder  = Color(0xFF2E3347);
  static const darkMuted   = Color(0xFF8B90A0);

  // Light surfaces
  static const lightBg      = Color(0xFFF4F5F7);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightCard    = Color(0xFFF9FAFB);
  static const lightBorder  = Color(0xFFE5E7EB);
  static const lightMuted   = Color(0xFF6B7280);
}

class AppTheme {
  static ThemeData dark() => _build(Brightness.dark);
  static ThemeData light() => _build(Brightness.light);

  static ThemeData _build(Brightness br) {
    final d = br == Brightness.dark;
    final bg      = d ? AppColors.darkBg      : AppColors.lightBg;
    final surface = d ? AppColors.darkSurface : AppColors.lightSurface;
    final card    = d ? AppColors.darkCard    : AppColors.lightCard;
    final border  = d ? AppColors.darkBorder  : AppColors.lightBorder;
    final muted   = d ? AppColors.darkMuted   : AppColors.lightMuted;
    final text    = d ? Colors.white   : const Color(0xFF0F1117);

    return ThemeData(
      brightness: br,
      scaffoldBackgroundColor: bg,
      colorScheme: ColorScheme(
        brightness: br,
        primary:   AppColors.orange,
        onPrimary: Colors.white,
        secondary: AppColors.orangeLight,
        onSecondary: Colors.white,
        surface:   surface,
        onSurface: text,
        error:     AppColors.danger,
        onError:   Colors.white,
      ),

      // AppBar
      appBarTheme: AppBarTheme(
        backgroundColor: d ? AppColors.darkBg : AppColors.lightSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        systemOverlayStyle: d ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
        titleTextStyle: TextStyle(color: text, fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.3),
        iconTheme: IconThemeData(color: text),
      ),

      // NavigationBar — laranja puro, sem azul
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: AppColors.orange.withOpacity(0.12),
        elevation: 2,
        shadowColor: border,
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
          color: s.contains(WidgetState.selected) ? AppColors.orange : muted,
        )),
        labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
          color: s.contains(WidgetState.selected) ? AppColors.orange : muted,
          fontSize: 11,
          fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
        )),
      ),

      // Cards
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: border),
        ),
      ),

      // Inputs
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.orange, width: 1.5)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.danger)),
        labelStyle: TextStyle(color: muted),
        hintStyle: TextStyle(color: muted),
      ),

      // Buttons
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.orange,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          padding: const EdgeInsets.symmetric(vertical: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.orange,
          side: const BorderSide(color: AppColors.orange),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.orange),
      ),

      // Chips
      chipTheme: ChipThemeData(
        backgroundColor: card,
        selectedColor: AppColors.orange.withOpacity(0.15),
        side: BorderSide(color: border),
        labelStyle: TextStyle(fontSize: 12, color: text),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        showCheckmark: true,
        checkmarkColor: AppColors.orange,
      ),

      // ChoiceChip
      dividerTheme: DividerThemeData(color: border, thickness: 1),

      // FloatingActionButton
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.orange,
        foregroundColor: Colors.white,
        elevation: 4,
      ),

      // Progress indicators
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.orange),

      // Switch
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.orange : Colors.grey),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.orange.withOpacity(0.4) : Colors.grey.withOpacity(0.3)),
      ),

      textTheme: TextTheme(
        headlineLarge: TextStyle(color: text, fontWeight: FontWeight.w800, letterSpacing: -0.5),
        headlineMedium: TextStyle(color: text, fontWeight: FontWeight.w700),
        titleLarge: TextStyle(color: text, fontWeight: FontWeight.w700),
        titleMedium: TextStyle(color: text, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: text),
        bodyMedium: TextStyle(color: muted),
        labelSmall: TextStyle(color: muted, fontSize: 11),
      ),
    );
  }
}
