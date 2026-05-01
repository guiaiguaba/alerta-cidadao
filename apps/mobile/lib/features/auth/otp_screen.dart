// lib/features/auth/otp_screen.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/providers.dart';

class OtpScreen extends ConsumerStatefulWidget {
  final String phone;
  final String tenantSlug;

  const OtpScreen({
    super.key,
    required this.phone,
    required this.tenantSlug,
  });

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final List<TextEditingController> _ctrl =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focus = List.generate(6, (_) => FocusNode());

  int _resendCooldown = 60;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCooldown();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focus.first.requestFocus();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in _ctrl) c.dispose();
    for (final f in _focus) f.dispose();
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _resendCooldown = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_resendCooldown <= 0) { t.cancel(); return; }
      setState(() => _resendCooldown--);
    });
  }

  String get _code => _ctrl.map((c) => c.text).join();
  bool   get _isComplete => _code.length == 6;

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);

    ref.listen(authProvider, (_, next) {
      if (next.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content:         Text(next.error!),
            backgroundColor: AppColors.critical,
          ),
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Verificar Telefone'),
        leading: const BackButton(),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),

              // Ícone
              Center(
                child: Container(
                  width:  64,
                  height: 64,
                  decoration: BoxDecoration(
                    color:        AppColors.info.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(16),
                    border:       Border.all(color: AppColors.info.withOpacity(0.3)),
                  ),
                  child: const Icon(Icons.sms_outlined, color: AppColors.info, size: 32),
                ),
              ),

              const SizedBox(height: 24),

              // Instrução
              Text(
                'Código enviado para',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
              ),
              const SizedBox(height: 4),
              Text(
                widget.phone,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily:  'IBMPlexMono',
                  fontSize:    16,
                  fontWeight:  FontWeight.w600,
                  color:       AppColors.textPrimary,
                ),
              ),

              const SizedBox(height: 40),

              // ==========================================
              // INPUTS OTP
              // ==========================================
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: List.generate(6, (i) => _OtpBox(
                  controller: _ctrl[i],
                  focusNode:  _focus[i],
                  onChanged: (val) {
                    if (val.isNotEmpty && i < 5) {
                      _focus[i + 1].requestFocus();
                    }
                    if (val.isEmpty && i > 0) {
                      _focus[i - 1].requestFocus();
                    }
                    setState(() {});
                    if (_isComplete) _submit();
                  },
                )),
              ),

              const SizedBox(height: 40),

              // ==========================================
              // VERIFICAR
              // ==========================================
              if (auth.isLoading)
                const Center(child: CircularProgressIndicator(color: AppColors.amber))
              else
                ElevatedButton(
                  onPressed: _isComplete ? _submit : null,
                  child: const Text('Verificar'),
                ),

              const SizedBox(height: 20),

              // ==========================================
              // REENVIAR
              // ==========================================
              Center(
                child: _resendCooldown > 0
                  ? Text(
                      'Reenviar em ${_resendCooldown}s',
                      style: TextStyle(
                        fontFamily: 'IBMPlexMono',
                        fontSize:   12,
                        color:      AppColors.textTertiary,
                      ),
                    )
                  : TextButton(
                      onPressed: _resend,
                      child: const Text('Reenviar código'),
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_isComplete) return;
    await ref.read(authProvider.notifier).loginWithOtp(
      widget.phone,
      _code,
      widget.tenantSlug,
    );
  }

  Future<void> _resend() async {
    try {
      await ref.read(apiClientProvider).sendOtp(widget.phone);
      _startCooldown();
      for (final c in _ctrl) c.clear();
      _focus.first.requestFocus();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Novo código enviado ✅')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:         Text('Erro: $e'),
          backgroundColor: AppColors.critical,
        ),
      );
    }
  }
}

class _OtpBox extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode             focusNode;
  final ValueChanged<String>  onChanged;

  const _OtpBox({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width:  48,
      height: 56,
      child: TextFormField(
        controller:   controller,
        focusNode:    focusNode,
        onChanged:    onChanged,
        textAlign:    TextAlign.center,
        keyboardType: TextInputType.number,
        maxLength:    1,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
        style: const TextStyle(
          fontFamily:  'IBMPlexMono',
          fontSize:    22,
          fontWeight:  FontWeight.w700,
          color:       AppColors.textPrimary,
        ),
        decoration: InputDecoration(
          contentPadding: EdgeInsets.zero,
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide:   const BorderSide(color: AppColors.border, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide:   const BorderSide(color: AppColors.amber, width: 2),
          ),
          filled:     true,
          fillColor:  AppColors.panel,
        ),
      ),
    );
  }
}
