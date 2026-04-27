import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/theme-provider';
import { HighlightedText } from './HighlightedText';
import type { Recipe, Ingredient } from '../../types/models';

interface RecipeCardProps {
  recipe: Recipe;
  allIngredients: Ingredient[];
  addedNames: Set<string>;
  onAddToList?: (recipe: Recipe) => void;
  onPressIngredient?: (name: string) => void;
}

export function RecipeCard({
  recipe,
  allIngredients,
  addedNames,
  onAddToList,
  onPressIngredient,
}: RecipeCardProps) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {recipe.title}
        </Text>
      </View>

      <View style={styles.summary}>
        <HighlightedText
          text={recipe.summary}
          ingredients={allIngredients}
          addedNames={addedNames}
          onPressIngredient={onPressIngredient}
        />
      </View>

      {onAddToList && (
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: colors.primary }]}
          onPress={() => onAddToList(recipe)}
        >
          <Text style={[styles.addBtnText, { color: colors.primary }]}>＋リストに追加</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => setExpanded(!expanded)}>
        <Text style={[styles.toggleText, { color: colors.textMuted }]}>
          {expanded ? '▲ ステップを閉じる' : '▼ ステップを見る'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.steps}>
          {recipe.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              <Text style={[styles.stepNum, { color: colors.primaryLight }]}>{i + 1}.</Text>
              <View style={styles.stepText}>
                <HighlightedText
                  text={step}
                  ingredients={allIngredients}
                  addedNames={addedNames}
                  onPressIngredient={onPressIngredient}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  summary: {
    marginBottom: 10,
  },
  addBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleText: {
    fontSize: 13,
    textAlign: 'center',
  },
  steps: {
    marginTop: 10,
    gap: 8,
  },
  step: {
    flexDirection: 'row',
    gap: 6,
  },
  stepNum: {
    fontWeight: '600',
    fontSize: 14,
    minWidth: 20,
  },
  stepText: {
    flex: 1,
  },
});
