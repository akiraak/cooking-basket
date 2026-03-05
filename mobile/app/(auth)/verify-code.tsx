import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeColors } from '../../src/theme/theme-provider';
import { useAuthStore } from '../../src/stores/auth-store';

export default function VerifyCodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const colors = useThemeColors();
  const verify = useAuthStore((s) => s.verify);

  const handleVerify = async () => {
    const trimmed = code.trim();
    if (!trimmed || !email) return;

    setLoading(true);
    try {
      await verify(email, trimmed);
      // 認証成功 → _layout.tsx が自動的に (tabs) へリダイレクト
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '認証に失敗しました';
      Alert.alert('エラー', message);
    } finally {
      setLoading(false);
    }
  };

  const styles = makeStyles(colors);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>認証コード入力</Text>
        <Text style={styles.subtitle}>{email} に送信されたコードを入力</Text>

        <TextInput
          style={styles.input}
          placeholder="認証コード"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoFocus
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading || !code.trim()}
        >
          <Text style={styles.buttonText}>
            {loading ? '認証中...' : 'ログイン'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.back()}
        >
          <Text style={styles.linkText}>別のメールアドレスで試す</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    inner: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primaryLight,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 32,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 14,
      fontSize: 24,
      color: colors.text,
      textAlign: 'center',
      letterSpacing: 8,
      marginBottom: 16,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    linkButton: {
      marginTop: 20,
      alignItems: 'center',
    },
    linkText: {
      color: colors.primaryLight,
      fontSize: 14,
    },
  });
}
