import { Skeleton } from '@/components/ui/skeleton'
import styles from '@/features/habits/habit-management.module.css'

export default function HabitsLoading() {
  return (
    <section className={styles.loadingPage} role="status" aria-label="Loading your private habit records">
      <div className={styles.loadingHeader}>
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className={styles.loadingGrid} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
      </div>
      <div className={styles.loadingPanel} aria-hidden="true">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <span className="sr-only">Loading your habits and saved check-ins.</span>
    </section>
  )
}
