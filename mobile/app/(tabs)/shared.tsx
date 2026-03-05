import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../src/theme/theme-provider';

export default function SharedRecipesScreen() {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.placeholder, { color: colors.textMuted }]}>
        みんなのレシピ（Phase 5 で実装）
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
