// lib/features/auth/login_screen.dart
// Login sem campo de município — tenant configurado internamente via AppConfig
// App do agente tem aba extra: "Ativar conta" (código de 6 dígitos)

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_config.dart';
import '../../providers/providers.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {

  late TabController _tabs;
  final _emailCtrl = TextEditingController();
  final _senhaCtrl = TextEditingController();
  bool _verSenha = false;

  @override
  void initState() {
    super.initState();
    // App do agente: 2 abas (entrar + ativar). Cidadão: só 1.
    _tabs = TabController(length: AppConfig.isAgent ? 2 : 1, vsync: this);
    // Configurar o tenant slug internamente — sem o usuário ver
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(tokenStorageProvider).saveTenantSlug(AppConfig.tenantSlug);
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    _emailCtrl.dispose();
    _senhaCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    ref.listen(authProvider, (_, next) {
      if (next.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(next.error!),
          backgroundColor: AppColors.critical,
        ));
      }
    });

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),

              // ---- LOGO ----
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 64, height: 64,
                      decoration: BoxDecoration(
                        color:        AppColors.amber.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(17),
                        border:       Border.all(color: AppColors.amber.withOpacity(0.3)),
                      ),
                      child: const Icon(Icons.warning_amber_rounded,
                          color: AppColors.amber, size: 32),
                    ),
                    const SizedBox(height: 14),
                    const Text('ALERTA CIDADÃO', style: TextStyle(
                      fontFamily: 'IBMPlexSans', fontSize: 19,
                      fontWeight: FontWeight.w700, letterSpacing: 2,
                      color: AppColors.amber,
                    )),
                    const SizedBox(height: 3),
                    Text(
                      AppConfig.nomeMunicipio.toUpperCase(),
                      style: const TextStyle(
                        fontFamily: 'IBMPlexMono', fontSize: 9,
                        letterSpacing: 1.5, color: AppColors.textTertiary,
                      ),
                    ),
                    if (AppConfig.isAgent) ...[
                      const SizedBox(height: 7),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color:  AppColors.violet.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.violet.withOpacity(0.3)),
                        ),
                        child: const Text('APP DO AGENTE', style: TextStyle(
                          fontFamily: 'IBMPlexMono', fontSize: 8.5,
                          letterSpacing: 1.5, color: AppColors.violet,
                          fontWeight: FontWeight.w600,
                        )),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // ---- TABS ----
              if (AppConfig.isAgent) ...[
                TabBar(
                  controller: _tabs,
                  indicatorColor:       AppColors.amber,
                  labelColor:           AppColors.amber,
                  unselectedLabelColor: AppColors.textTertiary,
                  labelStyle: const TextStyle(
                    fontFamily: 'IBMPlexMono', fontSize: 12, fontWeight: FontWeight.w600),
                  tabs: const [Tab(text: 'Entrar'), Tab(text: 'Ativar conta')],
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 310,
                  child: TabBarView(
                    controller: _tabs,
                    children: [
                      _FormLogin(
                        emailCtrl: _emailCtrl, senhaCtrl: _senhaCtrl,
                        verSenha: _verSenha,
                        onVerSenha: () => setState(() => _verSenha = !_verSenha),
                        carregando: auth.isLoading, onLogin: _login,
                      ),
                      const _FormAtivacao(),
                    ],
                  ),
                ),
              ] else ...[
                // Cidadão: login simples
                _FormLogin(
                  emailCtrl: _emailCtrl, senhaCtrl: _senhaCtrl,
                  verSenha: _verSenha,
                  onVerSenha: () => setState(() => _verSenha = !_verSenha),
                  carregando: auth.isLoading, onLogin: _login,
                ),
                const SizedBox(height: 20),
                _Divisor(),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _loginGoogle,
                  icon: _IconeGoogle(),
                  label: const Text('Entrar com Google'),
                  style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14)),
                ),
              ],

              const SizedBox(height: 28),
              Center(child: Text(
                '© ${DateTime.now().year} Alerta Cidadão',
                style: const TextStyle(
                  fontFamily: 'IBMPlexMono', fontSize: 9, color: AppColors.textTertiary),
              )),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _login() async {
    final email = _emailCtrl.text.trim();
    final senha = _senhaCtrl.text;
    if (email.isEmpty || senha.isEmpty) return;
    await ref.read(authProvider.notifier).loginWithEmail(
      email: email, password: senha, tenantSlug: AppConfig.tenantSlug);
  }

  Future<void> _loginGoogle() async {
    try {
      final g = await GoogleSignIn().signIn();
      if (g == null) return;
      final token = (await g.authentication).idToken;
      if (token == null) return;
      await ref.read(authProvider.notifier).loginWithGoogle(
          token, AppConfig.tenantSlug);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erro: $e'), backgroundColor: AppColors.critical));
    }
  }
}

// ============================================================
// FORMULÁRIO DE LOGIN NORMAL
// ============================================================
class _FormLogin extends StatelessWidget {
  final TextEditingController emailCtrl, senhaCtrl;
  final bool verSenha, carregando;
  final VoidCallback onVerSenha, onLogin;

  const _FormLogin({
    required this.emailCtrl, required this.senhaCtrl,
    required this.verSenha,  required this.onVerSenha,
    required this.carregando, required this.onLogin,
  });

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _Label('E-mail'),
      const SizedBox(height: 8),
      TextFormField(
        controller: emailCtrl,
        keyboardType: TextInputType.emailAddress,
        autofillHints: const [AutofillHints.email],
        decoration: const InputDecoration(
          hintText: 'seu@email.com',
          prefixIcon: Icon(Icons.email_outlined, color: AppColors.textTertiary),
        ),
      ),
      const SizedBox(height: 14),
      _Label('Senha'),
      const SizedBox(height: 8),
      TextFormField(
        controller: senhaCtrl,
        obscureText: !verSenha,
        autofillHints: const [AutofillHints.password],
        decoration: InputDecoration(
          hintText: '••••••••',
          prefixIcon: const Icon(Icons.lock_outline, color: AppColors.textTertiary),
          suffixIcon: GestureDetector(
            onTap: onVerSenha,
            child: Icon(
              verSenha ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: AppColors.textTertiary,
            ),
          ),
        ),
      ),
      const SizedBox(height: 20),
      if (carregando)
        const Center(child: CircularProgressIndicator(color: AppColors.amber))
      else
        ElevatedButton(onPressed: onLogin, child: const Text('Entrar')),
    ],
  );
}

// ============================================================
// FORMULÁRIO DE ATIVAÇÃO — ETAPA 1: e-mail + código
// ============================================================
class _FormAtivacao extends ConsumerStatefulWidget {
  const _FormAtivacao();
  @override
  ConsumerState<_FormAtivacao> createState() => _FormAtivacaoState();
}

class _FormAtivacaoState extends ConsumerState<_FormAtivacao> {
  final _emailCtrl   = TextEditingController();
  final _codigoCtrl  = TextEditingController();
  final _senhaCtrl   = TextEditingController();
  final _confirmCtrl = TextEditingController();

  int    _etapa        = 0; // 0 = código, 1 = criar senha
  bool   _carregando   = false;
  String _token        = '';
  String _nomeAgente   = '';

  @override
  void dispose() {
    _emailCtrl.dispose(); _codigoCtrl.dispose();
    _senhaCtrl.dispose(); _confirmCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _etapa == 0 ? _etapaCodigo() : _etapaSenha();

  // ---- Etapa 1: e-mail + código ----
  Widget _etapaCodigo() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _Label('Seu e-mail'),
      const SizedBox(height: 8),
      TextFormField(
        controller: _emailCtrl,
        keyboardType: TextInputType.emailAddress,
        decoration: const InputDecoration(
          hintText: 'e-mail cadastrado pelo supervisor',
          prefixIcon: Icon(Icons.email_outlined, color: AppColors.textTertiary),
        ),
      ),
      const SizedBox(height: 14),
      _Label('Código de ativação (6 dígitos)'),
      const SizedBox(height: 8),
      TextFormField(
        controller: _codigoCtrl,
        keyboardType: TextInputType.number,
        maxLength: 6,
        style: const TextStyle(
          fontFamily: 'IBMPlexMono', fontSize: 22,
          letterSpacing: 10, fontWeight: FontWeight.w700,
          color: AppColors.amber,
        ),
        decoration: const InputDecoration(
          hintText: '_ _ _ _ _ _',
          prefixIcon: Icon(Icons.key_outlined, color: AppColors.textTertiary),
          counterText: '',
        ),
        onChanged: (v) {
          if (v.length == 6) _validarCodigo();
        },
      ),
      const SizedBox(height: 16),
      if (_carregando)
        const Center(child: CircularProgressIndicator(color: AppColors.amber))
      else
        ElevatedButton(
          onPressed: _validarCodigo,
          child: const Text('Validar código'),
        ),
      const SizedBox(height: 12),
      Text(
        'O supervisor vai te passar um código de 6 dígitos.\nInforme seu e-mail e o código para ativar sua conta.',
        style: const TextStyle(
          fontSize: 11, color: AppColors.textTertiary,
          fontFamily: 'IBMPlexMono', height: 1.5,
        ),
        textAlign: TextAlign.center,
      ),
    ],
  );

  // ---- Etapa 2: criar senha ----
  Widget _etapaSenha() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('Olá, $_nomeAgente! 👋',
        style: const TextStyle(
          fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
      const SizedBox(height: 4),
      const Text('Crie uma senha para acessar o app.',
        style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      const SizedBox(height: 20),
      _Label('Nova senha'),
      const SizedBox(height: 8),
      TextFormField(
        controller: _senhaCtrl,
        obscureText: true,
        decoration: const InputDecoration(
          hintText: 'Mínimo 6 caracteres',
          prefixIcon: Icon(Icons.lock_outline, color: AppColors.textTertiary),
        ),
      ),
      const SizedBox(height: 12),
      _Label('Confirmar senha'),
      const SizedBox(height: 8),
      TextFormField(
        controller: _confirmCtrl,
        obscureText: true,
        decoration: const InputDecoration(
          hintText: 'Repita a senha',
          prefixIcon: Icon(Icons.lock_outline, color: AppColors.textTertiary),
        ),
      ),
      const SizedBox(height: 20),
      if (_carregando)
        const Center(child: CircularProgressIndicator(color: AppColors.amber))
      else
        ElevatedButton(
          onPressed: _criarSenha,
          child: const Text('Ativar minha conta'),
        ),
    ],
  );

  Future<void> _validarCodigo() async {
    final email  = _emailCtrl.text.trim();
    final codigo = _codigoCtrl.text.trim();
    if (email.isEmpty) { _erro('Informe seu e-mail.'); return; }
    if (codigo.length < 6) { _erro('O código tem 6 dígitos.'); return; }

    setState(() => _carregando = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.validarCodigoAtivacao(email: email, codigo: codigo);
      setState(() {
        _token      = res['tokenAtivacao'] ?? '';
        _nomeAgente = res['nome'] ?? '';
        _etapa      = 1;
        _carregando = false;
      });
    } catch (e) {
      setState(() => _carregando = false);
      _erro(_parsarErro(e));
    }
  }

  Future<void> _criarSenha() async {
    if (_senhaCtrl.text.length < 6) { _erro('Senha muito curta (mínimo 6).'); return; }
    if (_senhaCtrl.text != _confirmCtrl.text) { _erro('As senhas não coincidem.'); return; }

    setState(() => _carregando = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.criarSenhaAtivacao(
        tokenAtivacao:  _token,
        novaSenha:      _senhaCtrl.text,
        confirmarSenha: _confirmCtrl.text,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content:         Text('Conta ativada! Entre com seu e-mail e senha ✅'),
          backgroundColor: AppColors.low,
          duration:        Duration(seconds: 4),
        ));
        // Redirecionar para a aba de login
        DefaultTabController.of(context).animateTo(0);
      }
    } catch (e) {
      setState(() => _carregando = false);
      _erro(_parsarErro(e));
    }
  }

  void _erro(String msg) => ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(msg), backgroundColor: AppColors.critical));

  String _parsarErro(dynamic e) {
    final s = e.toString().toLowerCase();
    if (s.contains('inválido') || s.contains('invalid')) return 'Código inválido. Verifique o e-mail e o código.';
    if (s.contains('expir'))   return 'Código expirado. Peça um novo convite ao supervisor.';
    if (s.contains('ativada')) return 'Conta já ativada. Use a aba "Entrar".';
    return 'Erro inesperado. Tente novamente.';
  }
}

// ============================================================
// HELPERS
// ============================================================
Widget _Label(String text) => Text(
  text.toUpperCase(),
  style: const TextStyle(
    fontFamily: 'IBMPlexMono', fontSize: 9, fontWeight: FontWeight.w500,
    letterSpacing: 1.2, color: AppColors.textTertiary,
  ),
);

class _Divisor extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Row(children: [
    const Expanded(child: Divider(color: AppColors.border)),
    Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Text('ou', style: const TextStyle(
        fontFamily: 'IBMPlexMono', fontSize: 11, color: AppColors.textTertiary)),
    ),
    const Expanded(child: Divider(color: AppColors.border)),
  ]);
}

class _IconeGoogle extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    width: 18, height: 18,
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(2)),
    alignment: Alignment.center,
    child: const Text('G', style: TextStyle(
      color: Color(0xFF4285F4), fontSize: 12, fontWeight: FontWeight.w700)),
  );
}
