import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/theme-provider';

interface SuggestionsListProps {
  suggestions: string[];
  onSelect: (name: string) => void;
}

export function SuggestionsList({ suggestions, onSelect }: SuggestionsListProps) {
  const colors = useThemeColors();

  if (suggestions.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {suggestions.map((name) => (
        <TouchableOpacity
          key={name}
          style={[styles.item, { borderBottomColor: colors.border }]}
          onPress={() => onSelect(name)}
        >
          <Text style={[styles.text, { color: colors.text }]}>{name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    overflow: 'hidden',
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 15,
  },
});
