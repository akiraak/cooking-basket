import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../src/theme/theme-provider';

export default function ShoppingListScreen() {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.placeholder, { color: colors.textMuted }]}>
        買い物リスト（Phase 3 で実装）
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 16,
  },
});
