export type CalendarConnectionStatus =
  | 'disconnected'
  | 'connected'
  | 'reauthorize'
  | 'repair'
  | 'unavailable'

export type CalendarConnectionView = {
  status: CalendarConnectionStatus
  statusMessage: string
  calendarName: string
  calendarUrl: string | null
  lastSyncStatus: 'pending' | 'synced' | 'error' | null
  lastSyncedAt: string | null
  lastSyncError: string | null
}

export type CalendarSettingsData = {
  userName: string
  userEmail: string
  connection: CalendarConnectionView
}
