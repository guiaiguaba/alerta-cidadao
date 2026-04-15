import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../api/api_client.dart';

// Stream do Firebase Auth
final authStateProvider = StreamProvider<User?>((ref) {
  return FirebaseAuth.instance.authStateChanges();
});

// Usuário sincronizado com o backend
final dbUserProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final fbUser = ref.watch(authStateProvider).valueOrNull;
  if (fbUser == null) return null;

  final token = await fbUser.getIdToken();
  final client = ref.read(apiClientProvider);
  return client.syncUser(token!);
});

// Notifier para ações de auth
final authNotifierProvider = Provider<AuthNotifier>((ref) => AuthNotifier(ref));

class AuthNotifier {
  final Ref _ref;
  AuthNotifier(this._ref);

  Future<void> signInWithGoogle() async {
    final googleUser = await GoogleSignIn().signIn();
    if (googleUser == null) return;
    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    await FirebaseAuth.instance.signInWithCredential(credential);
  }

  Future<void> signInWithEmail(String email, String password) async {
    await FirebaseAuth.instance.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
  }

  Future<void> signOut() async {
    await GoogleSignIn().signOut();
    await FirebaseAuth.instance.signOut();
  }
}
