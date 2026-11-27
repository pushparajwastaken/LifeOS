import { Download, LogOut } from 'lucide-react'
import { signOutAction } from '@/app/auth/actions'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { updateProfileAction } from '../settings-actions'
import { DEFAULT_DISPLAY_NAME, PROFILE_LIMITS, timeZoneOptions } from '../settings-domain'
import { DetectTimeZoneButton } from './detect-timezone-button'

type Props = { displayName: string | null; timeZone: string; email: string; notice?: string }

export function AccountSettings({ displayName, timeZone, email, notice }: Props) {
  const message = resolveNotice(notice)
  const now = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date())
  return (
    <>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>SETTINGS</p>
          <h1>Your account and preferences.</h1>
          <p className={styles.heroCopy}>Your name and timezone shape every page: days, weeks, due dates and streaks all follow the timezone you choose here.</p>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}

      <section className={styles.panel} id="profile" aria-labelledby="profile-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>PROFILE</p><h2 id="profile-heading">Name and timezone</h2></div></div>
        <form action={updateProfileAction} className={styles.editorForm}>
          <div className={styles.fieldGrid}>
            <Field>
              <FieldLabel htmlFor="profile-name">Display name</FieldLabel>
              <Input id="profile-name" name="displayName" maxLength={PROFILE_LIMITS.displayName} defaultValue={displayName && displayName !== DEFAULT_DISPLAY_NAME ? displayName : ''} placeholder="How LifeOS greets you" />
              <FieldDescription>Optional. Leave empty to use “{DEFAULT_DISPLAY_NAME}”.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-timezone">Timezone</FieldLabel>
              <select id="profile-timezone" name="timeZone" className={styles.nativeSelect} defaultValue={timeZone} required>
                {timeZoneOptions(timeZone).map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
              </select>
              <FieldDescription>Currently {now} in {timeZone.replaceAll('_', ' ')}. Changing it moves where days and weeks begin; saved records keep their exact times.</FieldDescription>
            </Field>
          </div>
          <div className={styles.editorFooter}>
            <DetectTimeZoneButton selectId="profile-timezone" />
            <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
          </div>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="account-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>ACCOUNT</p><h2 id="account-heading">Sign-in</h2></div></div>
        <dl className={styles.factList}>
          <dt>Email</dt><dd>{email || 'Not available'}</dd>
        </dl>
        <form action={signOutAction} style={{ marginTop: 12 }}>
          <SubmitButton variant="outline" size="sm" pendingLabel="Signing out…"><LogOut size={14} aria-hidden="true" /> Sign out</SubmitButton>
        </form>
        <p className={styles.mutedNote}>Changing your email or deleting your account is not available in the app yet. Your data export below works at any time.</p>
      </section>

      <section className={styles.panel} id="data" aria-labelledby="data-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>YOUR DATA</p><h2 id="data-heading">Export everything</h2></div></div>
        <p className={styles.mutedNote} style={{ marginTop: 0 }}>Download one JSON file with every record you have in LifeOS: tasks, habits, goals, quests, learning sessions, your library, notes, imports and the rest. Only your own records are included, and no sign-in tokens are stored in LifeOS to begin with.</p>
        <a href="/settings/export" className={styles.primaryLink} download><Download size={16} aria-hidden="true" /> Download my data</a>
      </section>
    </>
  )
}
