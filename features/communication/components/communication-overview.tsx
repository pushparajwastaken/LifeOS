import { ChevronLeft, ChevronRight, ExternalLink, Mic, Plus, Trash2, Video } from 'lucide-react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import a from '@/features/analytics/analytics.module.css'
import { WeeklyBars } from '@/features/analytics/components/weekly-bars'
import { formatMinutes, plural } from '@/features/pillars/pillar-domain'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { addVideoAction, deleteSpeakingAction, deleteVideoAction, logSpeakingAction, moveVideoAction, updateVideoAction } from '../communication-actions'
import { COMMUNICATION_LIMITS, PRACTICE_TYPES, PRACTICE_TYPE_LABELS, VIDEO_STATUSES, VIDEO_STATUS_LABELS, adjacentStage } from '../communication-domain'
import type { VideoRow, getCommunicationData } from '../communication-service'

type Data = Awaited<ReturnType<typeof getCommunicationData>>
const weekLabel = (key: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${key}T00:00:00Z`))

function VideoCard({ video }: { video: VideoRow }) {
  const back = adjacentStage(video.status, -1)
  const forward = adjacentStage(video.status, 1)
  return (
    <li className={a.tile} style={{ listStyle: 'none' }}>
      <span className={styles.itemTitle} style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{video.title}</span>
      <span className={a.tileLabel}>{[video.topic, video.duration_seconds ? formatMinutes(Math.round(video.duration_seconds / 60)) : null].filter(Boolean).join(' · ') || 'No topic yet'}</span>
      {video.video_url ? <a href={video.video_url} target="_blank" rel="noopener noreferrer nofollow" className={styles.subtleLink} style={{ overflowWrap: 'anywhere' }}>Open <ExternalLink size={12} aria-hidden="true" /></a> : null}
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {back ? (
          <form action={moveVideoAction}><input type="hidden" name="videoId" value={video.id} /><input type="hidden" name="direction" value="back" /><IconSubmitButton label={`Move “${video.title}” back to ${VIDEO_STATUS_LABELS[back]}`}><ChevronLeft size={14} aria-hidden="true" /></IconSubmitButton></form>
        ) : null}
        {forward ? (
          <form action={moveVideoAction}><input type="hidden" name="videoId" value={video.id} /><input type="hidden" name="direction" value="forward" /><SubmitButton variant="outline" size="sm" pendingLabel="…">{VIDEO_STATUS_LABELS[forward]} <ChevronRight size={13} aria-hidden="true" /></SubmitButton></form>
        ) : null}
        <form action={deleteVideoAction}><input type="hidden" name="videoId" value={video.id} /><IconSubmitButton label={`Delete “${video.title}”`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton></form>
      </span>
      <details>
        <summary className={styles.itemMeta}>Edit</summary>
        <form action={updateVideoAction} className={styles.editorForm}>
          <input type="hidden" name="videoId" value={video.id} />
          <Field><FieldLabel htmlFor={`video-title-${video.id}`}>Title</FieldLabel><Input id={`video-title-${video.id}`} name="title" required maxLength={COMMUNICATION_LIMITS.title} defaultValue={video.title} /></Field>
          <Field><FieldLabel htmlFor={`video-topic-${video.id}`}>Topic</FieldLabel><Input id={`video-topic-${video.id}`} name="topic" maxLength={COMMUNICATION_LIMITS.topic} defaultValue={video.topic ?? ''} /></Field>
          <Field><FieldLabel htmlFor={`video-url-${video.id}`}>Link</FieldLabel><Input id={`video-url-${video.id}`} name="videoUrl" type="url" maxLength={2048} defaultValue={video.video_url ?? ''} /></Field>
          <Field><FieldLabel htmlFor={`video-minutes-${video.id}`}>Length (minutes)</FieldLabel><Input id={`video-minutes-${video.id}`} name="minutes" inputMode="numeric" maxLength={3} defaultValue={video.duration_seconds ? Math.round(video.duration_seconds / 60) : ''} /></Field>
          <SubmitButton size="sm" pendingLabel="Saving…">Save</SubmitButton>
        </form>
      </details>
    </li>
  )
}

export function CommunicationOverview({ data, today, timeZone, nowTime, notice }: { data: Data; today: string; timeZone: string; nowTime: string; notice?: string }) {
  const message = resolveNotice(notice)
  const time = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const published = data.videos.filter((video) => video.status === 'published').length
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>DEVELOPMENT PILLAR · COMMUNICATION</p>
          <h1>Say it clearly, then say it better.</h1>
          <p className={styles.heroCopy}>Log speaking practice with an honest self-rating and what you would change, and move video ideas through to publishing.</p>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some communication records could not be loaded. Refresh to try again; nothing was changed.</p> : null}

      <section className={styles.panel} aria-labelledby="week-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>THIS WEEK SO FAR</p><h2 id="week-heading">Right now</h2></div></div>
        <div className={a.stateGrid}>
          <div className={a.tile}><span className={a.tileLabel}>Practice time</span><strong className={a.tileValue}>{formatMinutes(data.thisWeek.minutes)}</strong><span className={a.tileLabel}>{plural(data.thisWeek.count, 'session')}</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Self-rating, last 4 weeks</span><strong className={a.tileValue}>{data.ratingFourWeeks === null ? '—' : `${data.ratingFourWeeks} / 5`}</strong><span className={a.tileLabel}>sessions you rated</span></div>
          <div className={a.tile}><span className={a.tileLabel}>Videos in progress</span><strong className={a.tileValue}>{data.videos.length - published}</strong><span className={a.tileLabel}>{plural(published, 'published video')}</span></div>
        </div>
        {data.minutesSeries.some(Boolean) ? (
          <>
            <h3 className={a.zoneTitle}>OVER TIME · LAST 8 WEEKS</h3>
            <div className={a.tile}>
              <span className={a.tileLabel}>Speaking practice per week</span>
              <WeeklyBars labels={data.weeks.map(weekLabel)} values={data.minutesSeries} unit="minutes" metricLabel="Practice" />
              <div className="sr-only"><table><caption>Speaking practice minutes per week</caption><tbody>{data.weeks.map((week, index) => <tr key={week}><th scope="row">Week of {weekLabel(week)}</th><td>{formatMinutes(data.minutesSeries[index])}</td></tr>)}</tbody></table></div>
            </div>
          </>
        ) : null}
      </section>

      <section className={styles.panel} id="practice" aria-labelledby="practice-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>SPEAKING PRACTICE</p><h2 id="practice-heading">Log a session</h2></div></div>
        <form action={logSpeakingAction} className={styles.editorForm}>
          <div className={styles.fieldGrid}>
            <Field><FieldLabel htmlFor="speaking-type">Kind of practice</FieldLabel>
              <select id="speaking-type" name="type" className={styles.nativeSelect} defaultValue="presentation">{PRACTICE_TYPES.map((type) => <option key={type} value={type}>{PRACTICE_TYPE_LABELS[type]}</option>)}</select>
            </Field>
            <Field><FieldLabel htmlFor="speaking-minutes">Minutes</FieldLabel><Input id="speaking-minutes" name="minutes" inputMode="numeric" required maxLength={4} /></Field>
            <Field><FieldLabel htmlFor="speaking-date">Date</FieldLabel><Input id="speaking-date" name="date" type="date" required max={today} defaultValue={today} /></Field>
            <Field><FieldLabel htmlFor="speaking-time">Time</FieldLabel><Input id="speaking-time" name="time" type="time" defaultValue={nowTime} /></Field>
            <Field><FieldLabel htmlFor="speaking-rating">How did it go? (1–5)</FieldLabel>
              <select id="speaking-rating" name="rating" className={styles.nativeSelect} defaultValue=""><option value="">Skip</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select>
            </Field>
            <Field><FieldLabel htmlFor="speaking-recording">Recording link (optional)</FieldLabel><Input id="speaking-recording" name="recordingUrl" type="url" maxLength={2048} placeholder="https://" /></Field>
            <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="speaking-feedback">What would you change next time?</FieldLabel><Textarea id="speaking-feedback" name="feedback" maxLength={COMMUNICATION_LIMITS.feedback} rows={2} /></Field>
          </div>
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…"><Mic size={15} aria-hidden="true" /> Log practice</SubmitButton></div>
        </form>
        {data.sessions.length ? (
          <ul className={styles.itemList}>
            {data.sessions.map((session) => (
              <li key={session.id} className={styles.checkItem}>
                <span className={styles.statusBadge}>{formatMinutes(session.duration_minutes)}</span>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>
                  {PRACTICE_TYPE_LABELS[session.practice_type]}{session.self_evaluation ? ` · ${session.self_evaluation}/5` : ''}
                  <span className={styles.itemMeta}>{[time.format(new Date(session.practiced_at)), session.feedback].filter(Boolean).join(' · ')}</span>
                  {session.recording_url ? <a href={session.recording_url} target="_blank" rel="noopener noreferrer nofollow" className={styles.subtleLink}>Recording <ExternalLink size={12} aria-hidden="true" /></a> : null}
                </span>
                <form action={deleteSpeakingAction}>
                  <input type="hidden" name="sessionId" value={session.id} />
                  <IconSubmitButton label={`Delete the ${PRACTICE_TYPE_LABELS[session.practice_type].toLowerCase()} session from ${time.format(new Date(session.practiced_at))}`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.panel} id="videos" aria-labelledby="videos-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>VIDEO PIPELINE · {data.videos.length}</p><h2 id="videos-heading">From idea to published</h2></div></div>
        {data.videos.length ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {VIDEO_STATUSES.map((status) => {
              const inStage = data.videos.filter((video) => video.status === status)
              return (
                <div key={status}>
                  <h3 className={a.zoneTitle} style={{ marginTop: 0 }}>{VIDEO_STATUS_LABELS[status].toUpperCase()} · {inStage.length}</h3>
                  {inStage.length ? <ul className={a.eventGrid} style={{ padding: 0, margin: 0 }}>{inStage.map((video) => <VideoCard key={video.id} video={video} />)}</ul> : <p className={styles.mutedNote} style={{ margin: 0 }}>Nothing here.</p>}
                </div>
              )
            })}
          </div>
        ) : <p className={styles.mutedNote} style={{ marginTop: 0 }}>No video ideas yet.</p>}
        <form action={addVideoAction} className={styles.searchForm} style={{ marginTop: 14 }}>
          <label className="sr-only" htmlFor="video-title">Video idea</label>
          <Input id="video-title" name="title" required maxLength={COMMUNICATION_LIMITS.title} placeholder="A video idea" />
          <label className="sr-only" htmlFor="video-topic">Topic</label>
          <Input id="video-topic" name="topic" maxLength={COMMUNICATION_LIMITS.topic} placeholder="Topic (optional)" style={{ maxWidth: 200 }} />
          <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Video size={14} aria-hidden="true" /> Add idea</SubmitButton>
        </form>
      </section>
    </div>
  )
}
