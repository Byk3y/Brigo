/**
 * Shared helper for sending one-off push notifications to a single user.
 *
 * Fire-and-forget: never throws. Silently skips when the user has no token
 * or has opted out. Expo-side failures are reported to Sentry so they don't
 * disappear — only DeviceNotRegistered is treated as "expected" and clears
 * the stale token instead of alerting.
 */

import { captureException } from './sentry.ts'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export interface SendUserPushParams {
  // deno-lint-ignore no-explicit-any
  supabase: any
  userId: string
  title: string
  body: string
  // deno-lint-ignore no-explicit-any
  data?: Record<string, any>
  /**
   * Key under profiles.meta.notification_settings to gate this send on.
   * Defaults to true when unset on the profile (matches existing convention).
   */
  preferenceKey?: string
  /**
   * Pre-fetched profile row, to avoid an extra SELECT when the caller already
   * has it in scope. Must include expo_push_token + meta to cover all checks.
   */
  preloadedProfile?: {
    expo_push_token?: string | null
    // deno-lint-ignore no-explicit-any
    meta?: any
  } | null
}

export async function sendUserPush({
  supabase,
  userId,
  title,
  body,
  data = {},
  preferenceKey,
  preloadedProfile,
}: SendUserPushParams): Promise<{ sent: boolean; reason?: string }> {
  try {
    let profile = preloadedProfile
    if (!profile) {
      const { data: fetched, error } = await supabase
        .from('profiles')
        .select('expo_push_token, meta')
        .eq('id', userId)
        .single()
      if (error || !fetched) {
        return { sent: false, reason: 'profile_not_found' }
      }
      profile = fetched
    }

    if (!profile.expo_push_token) {
      return { sent: false, reason: 'no_token' }
    }

    if (preferenceKey) {
      const enabled = profile.meta?.notification_settings?.[preferenceKey] ?? true
      if (!enabled) {
        return { sent: false, reason: 'opted_out' }
      }
    }

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: profile.expo_push_token,
        sound: 'default',
        title,
        body,
        data,
        mutableContent: true,
      }),
    })

    const result = await response.json()
    const ticket = result?.data

    if (ticket?.status === 'error') {
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        await supabase
          .from('profiles')
          .update({ expo_push_token: null })
          .eq('id', userId)
        return { sent: false, reason: 'device_not_registered' }
      }
      await captureException(new Error(`Expo push rejected: ${ticket.message || 'unknown'}`), {
        user_id: userId,
        operation: 'send-user-push',
        expo_error: ticket.details?.error,
      })
      return { sent: false, reason: 'expo_error' }
    }

    return { sent: true }
  } catch (err) {
    console.error('[sendUserPush] Failed:', err)
    await captureException(err, { user_id: userId, operation: 'send-user-push' })
    return { sent: false, reason: 'error' }
  }
}

/**
 * Convenience wrapper for "your generated content is ready" pushes.
 * Gates on profiles.meta.notification_settings.generation_ready (default true).
 */
export async function sendGenerationReadyPush(params: {
  // deno-lint-ignore no-explicit-any
  supabase: any
  userId: string
  contentType: 'audio' | 'quiz' | 'flashcards' | 'prediction'
  title: string
  body: string
  // deno-lint-ignore no-explicit-any
  data: Record<string, any>
}) {
  return sendUserPush({
    supabase: params.supabase,
    userId: params.userId,
    title: params.title,
    body: params.body,
    data: { type: params.contentType, ...params.data },
    preferenceKey: 'generation_ready',
  })
}
