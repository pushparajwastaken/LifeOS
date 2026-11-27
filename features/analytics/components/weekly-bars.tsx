'use client'

import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const chartConfig = { value: { label: 'Value', color: 'var(--chart-1)' } } satisfies ChartConfig

/**
 * Twelve weekly bars for one event metric. Weeks with nothing to measure (null) are left blank, not drawn as 0.
 * The chart is decorative for screen readers; the parent renders the same numbers as a table.
 */
export function WeeklyBars({ labels, values, unit, metricLabel }: { labels: string[]; values: Array<number | null>; unit: 'minutes' | 'percent' | 'count'; metricLabel: string }) {
  const data = labels.map((week, index) => ({ week, value: values[index] }))
  const format = (value: number) => (unit === 'percent' ? `${value}%` : unit === 'minutes' ? `${value} min` : String(value))
  return (
    <div aria-hidden="true">
      <ChartContainer config={{ value: { ...chartConfig.value, label: metricLabel } }} style={{ height: 96, width: '100%', aspectRatio: 'auto' }}>
        <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <XAxis dataKey="week" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
          <YAxis hide domain={unit === 'percent' ? [0, 100] : [0, 'auto']} allowDecimals={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => (typeof value === 'number' ? format(value) : 'No data')} />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}
