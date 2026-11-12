'use client'

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { DashboardPillarId } from '@/features/dashboard/dashboard-service'

type PillarActivity = {
  id: DashboardPillarId
  label: string
  tasks: number
  habits: number
  goals: number
}

const chartConfig = {
  active: { label: 'Active records', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function PillarActivityChart({ items }: { items: PillarActivity[] }) {
  const data = items.map(({ id, label, tasks, habits, goals }) => ({
    id,
    pillar: label,
    active: tasks + habits + goals,
  }))
  const description = data.map(({ pillar, active }) => `${pillar}: ${active} active ${active === 1 ? 'record' : 'records'}`).join('. ')

  return (
    <div
      className="pillar-chart"
      role="img"
      aria-label={`Active saved records by development pillar. ${description}`}
    >
      <ChartContainer config={chartConfig} className="dashboard-pillar-chart" style={{ height: 232, width: '100%', aspectRatio: 'auto' }}>
        <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 24, top: 5, bottom: 5 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis
            dataKey="pillar"
            type="category"
            tickLine={false}
            axisLine={false}
            width={112}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
          <Bar dataKey="active" fill="var(--color-active)" radius={[0, 5, 5, 0]} maxBarSize={19}>
            <LabelList dataKey="active" position="right" fill="var(--foreground)" fontSize={12} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="sr-only">{description}</p>
    </div>
  )
}
