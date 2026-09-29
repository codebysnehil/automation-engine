// Fixed identity colors for workflow step actions and transform operations,
// so every option is distinguishable at a glance in both themes.

export const ACTION_COLORS: Record<string, string> = {
  transform: '#8b5cf6', // violet
  http_request: '#3b82f6', // blue
  notify: '#f59e0b', // amber
  export: '#10b981', // emerald
  delay: '#64748b', // slate
};

export const OP_COLORS: Record<string, string> = {
  dedupe: '#8b5cf6', // violet
  filter: '#3b82f6', // blue
  rename_column: '#06b6d4', // cyan
  drop_column: '#ef4444', // red
  trim: '#14b8a6', // teal
  uppercase: '#f59e0b', // amber
  lowercase: '#84cc16', // lime
  fill_empty: '#ec4899', // pink
};

export function actionColor(type: string): string {
  return ACTION_COLORS[type] ?? '#64748b';
}

export function opColor(type: string): string {
  return OP_COLORS[type] ?? '#64748b';
}
