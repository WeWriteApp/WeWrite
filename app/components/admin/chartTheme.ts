export const ADMIN_CHART_THEME = {
  gridStroke: 'oklch(var(--border))',
  gridOpacity: 0.14,
  tickColor: 'oklch(var(--muted-foreground))',
  series1: 'var(--chart-1)',
  series2: 'var(--chart-2)',
  series3: 'var(--chart-3)',
  series4: 'var(--chart-4)',
  series5: 'var(--chart-5)',
  success: 'var(--chart-2)',
  destructive: 'oklch(var(--destructive))',
};

export function chartAxisTick(fontSize: number) {
  return {
    fontSize,
    fill: ADMIN_CHART_THEME.tickColor,
  };
}
