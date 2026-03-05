import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/theme-provider';

export interface Suggestion {
  name: string;
  count?: number;
}

interface SuggestionsListProps {
  suggestions: (string | Suggestion)[];
  onSelect: (name: string) => void;
}

export function SuggestionsList({ suggestions, onSelect }: SuggestionsListProps) {
  const colors = useThemeColors();

  if (suggestions.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {suggestions.map((item, index) => {
        const name = typeof item === 'string' ? item : item.name;
        const count = typeof item === 'string' ? undefined : item.count;
        return (
          <TouchableOpacity
            key={`${name}-${index}`}
            style={[styles.item, { borderBottomColor: colors.border }]}
            onPress={() => onSelect(name)}
          >
            <Text style={[styles.text, { color: colors.text }]}>
              {name}{count ? ` (${count})` : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
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
