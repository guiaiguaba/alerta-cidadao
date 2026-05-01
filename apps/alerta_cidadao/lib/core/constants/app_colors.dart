// lib/core/constants/app_colors.dart
import 'package:flutter/material.dart';

/// Palette do sistema de design "Centro de Controle"
/// Consistente com o painel web Next.js
abstract class AppColors {
  // === BASE ===
  static const void_ = Color(0xFF060810);
  static const base  = Color(0xFF0A0C12);
  static const surface = Color(0xFF111520);
  static const panel   = Color(0xFF161B28);
  static const border  = Color(0xFF1E2535);
  static const muted   = Color(0xFF252D3F);

  // === TEXT ===
  static const textPrimary   = Color(0xFFE8EDF5);
  static const textSecondary = Color(0xFF8A96A8);
  static const textTertiary  = Color(0xFF4E5A6B);

  // === BRAND AMBER ===
  static const amber    = Color(0xFFF59E0B);
  static const amber300 = Color(0xFFFCD34D);
  static const amber700 = Color(0xFFB45309);

  // === SEVERITY ===
  static const critical       = Color(0xFFEF4444);
  static const criticalBg     = Color(0xFF1A0808);
  static const criticalBorder = Color(0xFF3D1515);

  static const high       = Color(0xFFF97316);
  static const highBg     = Color(0xFF1A0D04);
  static const highBorder = Color(0xFF3D2010);

  static const medium       = Color(0xFFEAB308);
  static const mediumBg     = Color(0xFF1A1602);
  static const mediumBorder = Color(0xFF3D3408);

  static const low       = Color(0xFF22C55E);
  static const lowBg     = Color(0xFF031A0B);
  static const lowBorder = Color(0xFF083D1A);

  static const info       = Color(0xFF3B82F6);
  static const infoBg     = Color(0xFF020B1A);
  static const infoBorder = Color(0xFF071E3D);

  // === STATUS ===
  static const statusOpen       = Color(0xFFF97316);
  static const statusAssigned   = Color(0xFF3B82F6);
  static const statusInProgress = Color(0xFF8B5CF6);
  static const statusResolved   = Color(0xFF22C55E);
  static const statusRejected   = Color(0xFFEF4444);
  static const statusDuplicate  = Color(0xFF6B7280);

  static const violet           = Color(0xFF7C3AED);

  // === HELPERS ===
  static Color priorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'critical': return critical;
      case 'high':     return high;
      case 'medium':
      case 'normal':   return medium;  // "normal" é alias de medium
      case 'low':      return low;
      default:         return textSecondary;
    }
  }

  static Color priorityBg(String priority) {
    switch (priority.toLowerCase()) {
      case 'critical':               return criticalBg;
      case 'high':                   return highBg;
      case 'medium': case 'normal':  return mediumBg;
      case 'low':                    return lowBg;
      default:                       return surface;
    }
  }

  static Color statusColor(String status) {
    switch (status) {
      case 'open':        return statusOpen;
      case 'assigned':    return statusAssigned;
      case 'in_progress': return statusInProgress;
      case 'resolved':    return statusResolved;
      case 'rejected':    return statusRejected;
      case 'duplicate':   return statusDuplicate;
      default:            return textSecondary;
    }
  }
}