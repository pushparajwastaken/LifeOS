import 'server-only'

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ConnectError,
  ConnectorInstallationRequiredError,
  NoValidTokenError,
  UserAuthorizationRequiredError,
} from '@vercel/connect'

export type CalendarConnectFailureCode =
  | 'runtime_identity_unavailable'
  | 'connector_not_found'
  | 'project_link_missing'
  | 'environment_disabled'
  | 'user_authorization_required'
  | 'no_valid_token'
  | 'connector_installation_required'
  | 'connect_error'

export type CalendarConnectFailure = {
  code: CalendarConnectFailureCode
  message: string
}

type ErrorFields = {
  name?: unknown
  message?: unknown
  code?: unknown
  status?: unknown
  response?: { status?: unknown }
}

type DiagnosticContext = {
  callbackHost?: string
  subjectType?: 'user'
  requestedScopes?: string[]
}

function fields(error: unknown): ErrorFields {
  return error && typeof error === 'object' ? error as ErrorFields : {}
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
}

function getCode(error: unknown): string | undefined {
  const code = error instanceof ConnectError ? error.code : fields(error).code
  return typeof code === 'string' && /^[a-z0-9_.-]{1,80}$/i.test(code) ? code : undefined
}

function getStatus(error: unknown): number | undefined {
  const source = fields(error)
  const value = error instanceof ConnectError ? error.status : source.status ?? source.response?.status
  const status = Number(value)
  return Number.isInteger(status) && status > 0 ? status : undefined
}

function isVercelDeployment(): boolean {
  return Boolean(process.env.VERCEL_ENV || process.env.VERCEL_URL)
}

function classifyConnectFailure(error: unknown): CalendarConnectFailureCode | null {
  const name = normalize(fields(error).name ?? (error as { constructor?: { name?: string } } | null)?.constructor?.name)
  const code = normalize(getCode(error))
  const identifiers = `${name}${code}`

  if (identifiers.includes('verceloidctokenerror') || identifiers.includes('accesstokenmissingerror')) {
    return 'runtime_identity_unavailable'
  }
  if (identifiers.includes('connectornotfound') || identifiers.includes('clientnotfound')) {
    return 'connector_not_found'
  }
  if (identifiers.includes('clientnotlinkedtoproject') || identifiers.includes('connectornotlinkedtoproject') || identifiers.includes('projectnotlinked')) {
    return 'project_link_missing'
  }
  if (identifiers.includes('clientnotenabledforenvironment') || identifiers.includes('connectornotenabledforenvironment') || identifiers.includes('environmentnotenabled')) {
    return 'environment_disabled'
  }
  if (error instanceof UserAuthorizationRequiredError || identifiers.includes('userauthorizationrequired')) {
    return 'user_authorization_required'
  }
  if (error instanceof NoValidTokenError || identifiers.includes('novalidtoken') || identifiers.includes('notoken')) {
    return 'no_valid_token'
  }
  if (error instanceof ConnectorInstallationRequiredError || identifiers.includes('connectorinstallationrequired')) {
    return 'connector_installation_required'
  }
  if (error instanceof ConnectError) return 'connect_error'
  return null
}

function safeErrorMessage(error: unknown): string | undefined {
  const message = fields(error).message
  if (typeof message !== 'string') return undefined
  return message
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, '[JWT redacted]')
    .replace(/(access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|authorization[_-]?code|verifier)\s*[:=]\s*[^,\s;]+/gi, '$1=[redacted]')
    .slice(0, 240)
}

export function getCalendarConnectFailure(error: unknown): CalendarConnectFailure | null {
  const code = classifyConnectFailure(error)
  if (!code) return null

  const messageByCode: Record<CalendarConnectFailureCode, string> = {
    runtime_identity_unavailable: isVercelDeployment()
      ? 'Vercel Connect could not obtain a valid OIDC identity for this deployment. Check the deployment runtime diagnostics and retry.'
      : 'This v0 Preview workspace cannot refresh its Vercel OIDC identity because it is not linked to a Vercel project root. Test Google consent on a Preview deployment of this Vercel project.',
    connector_not_found: 'Vercel Connect could not find the configured connector google/lifeos-calendar for this project.',
    project_link_missing: 'The google/lifeos-calendar connector is not linked to the Vercel project serving this deployment.',
    environment_disabled: 'The google/lifeos-calendar connector is not enabled for this deployment environment.',
    user_authorization_required: 'This LifeOS user has not authorized Google Calendar yet. Start the Google consent flow again.',
    no_valid_token: 'No valid Google authorization is available for this LifeOS user. Reconnect Google Calendar.',
    connector_installation_required: 'Vercel Connect requires an installation for this connector before authorization can continue.',
    connect_error: 'Vercel Connect rejected the request. See the matching server diagnostic for its code and status.',
  }
  return { code, message: messageByCode[code] }
}

export function logCalendarIntegrationFailure(
  operation: string,
  connectorUid: string,
  error: unknown,
  context: DiagnosticContext = {},
): void {
  const source = fields(error)
  const errorName = typeof source.name === 'string'
    ? source.name
    : (error as { constructor?: { name?: string } } | null)?.constructor?.name ?? 'UnknownError'
  const hasLinkedProjectFile = existsSync(join(process.cwd(), '.vercel', 'project.json'))

  console.error('[LifeOS Calendar Connect]', {
    event: 'lifeos.calendar.integration_failure',
    operation,
    connectorUid,
    ...(context.callbackHost ? { callbackHost: context.callbackHost } : {}),
    ...(context.subjectType ? { subjectType: context.subjectType } : {}),
    ...(context.requestedScopes ? { requestedScopes: context.requestedScopes } : {}),
    runtime: {
      vercelEnvironment: process.env.VERCEL_ENV ?? null,
      isVercelDeployment: isVercelDeployment(),
      hasOidcTokenEnvOrFile: Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_OIDC_TOKEN_FILE),
      hasLinkedProjectFile,
    },
    error: {
      class: /^[A-Za-z0-9_$.-]{1,80}$/.test(errorName) ? errorName : 'UnknownError',
      ...(getCode(error) ? { code: getCode(error) } : {}),
      ...(getStatus(error) ? { status: getStatus(error) } : {}),
      ...(safeErrorMessage(error) ? { message: safeErrorMessage(error) } : {}),
    },
  })
}
