import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useThemeColors } from '../src/theme/theme-provider';
import { useAuthStore } from '../src/stores/auth-store';
import { AuthModal } from '../src/components/auth/AuthModal';

function RootNavigator() {
  const { isLoading, checkAuth } = useAuthStore();
  const colors = useThemeColors();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
