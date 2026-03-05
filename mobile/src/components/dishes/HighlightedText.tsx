import { Text } from 'react-native';
import { useThemeColors } from '../../theme/theme-provider';
import type { Ingredient } from '../../types/models';

interface HighlightedTextProps {
  text: string;
  ingredients: Ingredient[];
  addedNames: Set<string>;
  onPressIngredient?: (name: string) => void;
}

export function HighlightedText({ text, ingredients, addedNames, onPressIngredient }: HighlightedTextProps) {
  const colors = useThemeColors();

  // 具材名を長い順にソート（部分一致の問題を回避）
  const names = ingredients.map((i) => i.name).sort((a, b) => b.length - a.length);
  if (names.length === 0) return <Text style={{ color: colors.text }}>{text}</Text>;

  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(regex);

  return (
    <Text style={{ color: colors.text }}>
      {parts.map((part, i) => {
        const isIngredient = names.includes(part);
        if (!isIngredient) return <Text key={i}>{part}</Text>;

        const isAdded = addedNames.has(part);
        return (
          <Text
            key={i}
            style={{
              color: isAdded ? colors.primaryLight : colors.textMuted,
              textDecorationLine: isAdded ? 'none' : 'underline',
              textDecorationStyle: isAdded ? undefined : 'dashed',
            }}
            onPress={onPressIngredient ? () => onPressIngredient(part) : undefined}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
