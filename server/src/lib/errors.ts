// route 層で 3 箇所以上重複しているエラーメッセージを集約する。
// 1〜2 箇所しか出ない文言は意図的に含めない（共通化しすぎると追跡しづらくなるため）。
export const ERR = {
  DISH_NOT_FOUND: '料理が見つかりません',
  ITEM_NOT_FOUND: '食材が見つかりません',
  SAVED_RECIPE_NOT_FOUND: 'レシピが見つかりません',
  NAME_REQUIRED: 'name は必須です',
  INVALID_AI_LIMIT: 'invalid_ai_limit',
  INVALID_SCOPE: 'invalid_scope',
} as const;
