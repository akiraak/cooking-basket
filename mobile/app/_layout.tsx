import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useThemeColors } from '../src/theme/theme-provider';
import { useAuthStore } from '../src/stores/auth-store';
import { useShoppingStore } from '../src/stores/shopping-store';
import { useRecipeStore } from '../src/stores/recipe-store';
import { useAiStore } from '../src/stores/ai-store';
import { AuthModal } from '../src/components/auth/AuthModal';

function RootNavigator() {
  const { isLoading, isAuthenticated, checkAuth } = useAuthStore();
  const colors = useThemeColors();
  const didInitStoresRef = useRef(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 起動時に 1 回だけ、checkAuth 完了後の認証状態に合わせて mode と各ストアを初期化する。
  // ログイン/ログアウト操作で再発火させると、verify 直後に setMode('server') が走って
  // 未ログインのローカルデータを空配列で潰す race condition が再発するため、
  // 認証フラグの変更に伴う mode 切替・データロードは auth-store 側 (finishLogin / logout) に集約している。
  useEffect(() => {
    if (isLoading) return;
    if (didInitStoresRef.current) return;
    didInitStoresRef.current = true;

    const mode = isAuthenticated ? 'server' : 'local';
    useShoppingStore.getState().setMode(mode);
    useRecipeStore.getState().setMode(mode);
    if (isAuthenticated) {
      useShoppingStore.getState().loadAll();
      useRecipeStore.getState().loadSavedRecipes();
    }
    useAiStore.getState().loadQuota();
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Slot />
      <AuthModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </ThemeProvider>
  );
}
