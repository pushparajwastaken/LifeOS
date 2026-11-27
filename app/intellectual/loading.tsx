import { Skeleton } from '@/components/ui/skeleton'
import styles from '@/features/quests/quests.module.css'

export default function IntellectualLoading() {
  return (
    <section className={styles.loadingPage} role="status" aria-label="Loading your reading">
      <div className={styles.loadingHeader}>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className={styles.loadingPanel} aria-hidden="true">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <span className="sr-only">Loading your reading.</span>
    </section>
  )
}
