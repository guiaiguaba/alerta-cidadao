// lib/core/theme/app_theme.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../constants/app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    const colorScheme = ColorScheme.dark(
      brightness:    Brightness.dark,
      primary:       AppColors.amber,
      onPrimary:     Colors.black,
      secondary:     AppColors.amber300,
      onSecondary:   Colors.black,
      error:         AppColors.critical,
      onError:       Colors.white,
      surface:       AppColors.surface,
      onSurface:     AppColors.textPrimary,
      surfaceContainerHighest: AppColors.panel,
      outline:       AppColors.border,
    );

    return ThemeData(
      useMaterial3:  true,
      colorScheme:   colorScheme,
      brightness:    Brightness.dark,
      scaffoldBackgroundColor: AppColors.base,

      // ==========================================
      // TYPOGRAPHY — IBM Plex Sans
      // ==========================================
      fontFamily: 'IBMPlexSans',
      textTheme: const TextTheme(
        displayLarge:  TextStyle(fontSize: 32, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: AppColors.textPrimary),
        displayMedium: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        titleLarge:    TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        titleMedium:   TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        titleSmall:    TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        bodyLarge:     TextStyle(fontSize: 15, fontWeight: FontWeight.w400, color: AppColors.textPrimary, height: 1.5),
        bodyMedium:    TextStyle(fontSize: 13, fontWeight: FontWeight.w400, color: AppColors.textSecondary, height: 1.4),
        bodySmall:     TextStyle(fontSize: 11, fontWeight: FontWeight.w400, color: AppColors.textTertiary),
        labelLarge:    TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.textPrimary),
        labelMedium:   TextStyle(fontSize: 11, fontWeight: FontWeight.w500, letterSpacing: 0.5),
        labelSmall:    TextStyle(fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 0.8, color: AppColors.textTertiary),
      ),

      // ==========================================
      // APP BAR
      // ==========================================
      appBarTheme: const AppBarTheme(
        backgroundColor:  AppColors.surface,
        foregroundColor:  AppColors.textPrimary,
        elevation:        0,
        centerTitle:      false,
        titleTextStyle: TextStyle(
          fontFamily:   'IBMPlexSans',
          fontSize:     16,
          fontWeight:   FontWeight.w600,
          color:        AppColors.textPrimary,
        ),
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor:           Colors.transparent,
          statusBarIconBrightness:  Brightness.light,
          statusBarBrightness:      Brightness.dark,
        ),
      ),

      // ==========================================
      // BOTTOM NAVIGATION
      // ==========================================
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor:     AppColors.surface,
        indicatorColor:      AppColors.amber.withOpacity(0.15),
        iconTheme:           WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.amber, size: 22);
          }
          return const IconThemeData(color: AppColors.textTertiary, size: 22);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              fontFamily: 'IBMPlexSans',
              fontSize:   10,
              fontWeight: FontWeight.w600,
              color:      AppColors.amber,
            );
          }
          return const TextStyle(
            fontFamily: 'IBMPlexSans',
            fontSize:   10,
            color:      AppColors.textTertiary,
          );
        }),
        elevation: 0,
        height: 64,
      ),

      // ==========================================
      // CARDS
      // ==========================================
      cardTheme: const CardThemeData(
        color:        AppColors.surface,
        elevation:    0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(12)),
          side: BorderSide(color: AppColors.border),
        ),
        margin: EdgeInsets.zero,
        clipBehavior: Clip.antiAlias,
      ),

      // ==========================================
      // BUTTONS
      // ==========================================
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.amber,
          foregroundColor: Colors.black,
          elevation:       0,
          padding:         const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
          shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle:       const TextStyle(
            fontFamily:  'IBMPlexSans',
            fontWeight:  FontWeight.w600,
            fontSize:    14,
            letterSpacing: 0.2,
          ),
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.textPrimary,
          side:            const BorderSide(color: AppColors.border),
          padding:         const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
          shape:           RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle:       const TextStyle(
            fontFamily: 'IBMPlexSans',
            fontWeight: FontWeight.w500,
            fontSize:   14,
          ),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.amber,
          textStyle:       const TextStyle(
            fontFamily: 'IBMPlexSans',
            fontWeight: FontWeight.w500,
            fontSize:   14,
          ),
        ),
      ),

      // ==========================================
      // INPUT FIELDS
      // ==========================================
      inputDecorationTheme: InputDecorationTheme(
        filled:       true,
        fillColor:    AppColors.panel,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.amber, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.critical),
        ),
        hintStyle: const TextStyle(color: AppColors.textTertiary, fontSize: 14),
        labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
      ),

      // ==========================================
      // DIVIDERS / LIST TILES
      // ==========================================
      dividerTheme: const DividerThemeData(
        color:     AppColors.border,
        thickness: 1,
        space:     1,
      ),

      listTileTheme: const ListTileThemeData(
        tileColor:     Colors.transparent,
        iconColor:     AppColors.textSecondary,
        textColor:     AppColors.textPrimary,
        subtitleTextStyle: TextStyle(color: AppColors.textTertiary, fontSize: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(8))),
      ),

      // ==========================================
      // CHIPS
      // ==========================================
      chipTheme: ChipThemeData(
        backgroundColor:  AppColors.panel,
        selectedColor:    AppColors.amber.withOpacity(0.15),
        side:             const BorderSide(color: AppColors.border),
        labelStyle:       const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        shape:            RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        padding:          const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      ),

      // ==========================================
      // FLOATING ACTION BUTTON
      // ==========================================
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.amber,
        foregroundColor: Colors.black,
        elevation:       4,
        shape:           CircleBorder(),
      ),

      // ==========================================
      // SNACKBAR
      // ==========================================
      snackBarTheme: SnackBarThemeData(
        backgroundColor:  AppColors.panel,
        contentTextStyle: const TextStyle(color: AppColors.textPrimary, fontFamily: 'IBMPlexSans'),
        shape:            RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side:         const BorderSide(color: AppColors.border),
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
