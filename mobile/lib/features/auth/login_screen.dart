import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_provider.dart';

const _orange = Color(0xFFFF6B2B);

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool    _loading = false;
  String? _error;

  @override
  void dispose() { _emailCtrl.dispose(); _passCtrl.dispose(); super.dispose(); }

  Future<void> _emailLogin() async {
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authNotifierProvider).signInWithEmail(_emailCtrl.text.trim(), _passCtrl.text);
    } catch (_) {
      setState(() => _error = 'Email ou senha inválidos.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _googleLogin() async {
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authNotifierProvider).signInWithGoogle();
    } catch (e) {
      final code = (e as dynamic)?.code as String? ?? '';
      if (code != 'sign_in_canceled' && code != 'sign_in_aborted') {
        setState(() => _error = 'Erro ao entrar com Google.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_orange, Color(0xFFC94A15)],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.18), blurRadius: 40, offset: const Offset(0, 16)),
                  ],
                ),
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Logo
                    const Text('🚨', style: TextStyle(fontSize: 52)),
                    const SizedBox(height: 12),
                    RichText(text: const TextSpan(children: [
                      TextSpan(text: 'Alerta', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0F1117))),
                      TextSpan(text: 'Cidadão', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: _orange)),
                    ])),
                    const SizedBox(height: 6),
                    const Text('Reporte ocorrências no seu município',
                      style: TextStyle(color: Color(0xFF6B7280), fontSize: 13), textAlign: TextAlign.center),
                    const SizedBox(height: 28),

                    // Erro
                    if (_error != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text('⚠️ $_error', style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
                      ),

                    // Email
                    _Field(ctrl: _emailCtrl, label: 'Email', hint: 'seu@email.com',
                      icon: Icons.email_outlined, keyboard: TextInputType.emailAddress),
                    const SizedBox(height: 12),
                    _Field(ctrl: _passCtrl, label: 'Senha', hint: '••••••••',
                      icon: Icons.lock_outlined, obscure: true, onSubmit: (_) => _emailLogin()),
                    const SizedBox(height: 20),

                    // Botão entrar
                    SizedBox(
                      width: double.infinity, height: 50,
                      child: ElevatedButton(
                        onPressed: _loading ? null : _emailLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _orange,
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: _orange.withOpacity(0.5),
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _loading
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Entrar', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Divider
                    Row(children: [
                      const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text('ou', style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                      ),
                      const Expanded(child: Divider(color: Color(0xFFE5E7EB))),
                    ]),
                    const SizedBox(height: 14),

                    // Google
                    SizedBox(
                      width: double.infinity, height: 50,
                      child: OutlinedButton(
                        onPressed: _loading ? null : _googleLogin,
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFE5E7EB), width: 1.5),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          backgroundColor: const Color(0xFFFAFAFA),
                        ),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          _loading
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: _orange))
                            : const _GoogleIcon(),
                          const SizedBox(width: 10),
                          Text(
                            _loading ? 'Aguardando Google...' : 'Entrar com Google',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF374151)),
                          ),
                        ]),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController ctrl;
  final String label, hint;
  final IconData icon;
  final bool obscure;
  final TextInputType? keyboard;
  final ValueChanged<String>? onSubmit;

  const _Field({required this.ctrl, required this.label, required this.hint,
    required this.icon, this.obscure = false, this.keyboard, this.onSubmit});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
      const SizedBox(height: 6),
      TextField(
        controller: ctrl,
        obscureText: obscure,
        keyboardType: keyboard,
        onSubmitted: onSubmit,
        style: const TextStyle(fontSize: 14, color: Color(0xFF111827)),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
          prefixIcon: Icon(icon, color: const Color(0xFF9CA3AF), size: 20),
          filled: true,
          fillColor: const Color(0xFFFAFAFA),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _orange, width: 1.5)),
        ),
      ),
    ],
  );
}

class _GoogleIcon extends StatelessWidget {
  const _GoogleIcon();
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 18, height: 18,
    child: CustomPaint(painter: _GooglePainter()),
  );
}

class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final r = s.width / 2;
    void arc(Color col, double start, double sweep) {
      c.drawArc(Rect.fromCircle(center: Offset(r, r), radius: r),
        start, sweep, false, Paint()..color = col..strokeWidth = r * 0.38..style = PaintingStyle.stroke..strokeCap = StrokeCap.butt);
    }
    arc(const Color(0xFF4285F4), -0.52, 1.57);
    arc(const Color(0xFF34A853),  1.05, 1.57);
    arc(const Color(0xFFFBBC05),  2.62, 0.79);
    arc(const Color(0xFFEA4335),  3.40, 1.00);
    final p = Paint()..color = const Color(0xFF4285F4)..style = PaintingStyle.fill;
    c.drawRect(Rect.fromLTWH(r, r * 0.62, r, r * 0.38), p);
  }
  @override bool shouldRepaint(_) => false;
}
