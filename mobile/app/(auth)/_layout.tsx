import { Stack } from 'expo-router';
import { useThemeColors } from '../../src/theme/theme-provider';

export default function AuthLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
