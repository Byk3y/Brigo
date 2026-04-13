/**
 * Send Friend Streak Death Notifications
 *
 * Triggered by cron after update_friend_streaks runs.
 * Picks up 'friend_streak_died' activity log entries (created by the RPC when
 * a streak of 7+ days dies) and sends push notifications to both users.
 *
 * Verify JWT: FALSE — this is called by cron (service role), not users.
 */

import { createClient } from "supabase"
import { sendUserPush } from "../_shared/push.ts"

// Dramatic but recoverable templates
const deathTemplates = [
  { title: '💔 Your {{streak}}-day streak just ended', body: "{{friend}}, your streak with {{other}} died. Start a new one?" },
  { title: '⚰️ RIP {{streak}}-day streak', body: "Your run with {{other}} just ended. Time to build it back, {{friend}}." },
  { title: "😭 It's gone", body: "Your {{streak}}-day streak with {{other}} just ended. One more try?" },
  { title: '🪦 {{streak}} days, ended', body: "Your streak with {{other}} didn't make it. Restart today, {{friend}}?" },
  { title: '💔 {{friend}}...', body: "Your {{streak}}-day streak with {{other}} just died. Come back stronger." },
]

function renderTemplate(
  template: { title: string; body: string },
  ctx: { friend: string; other: string; streak: number }
) {
  const replace = (text: string) =>
    text
      .replace(/\{\{friend\}\}/g, ctx.friend)
      .replace(/\{\{other\}\}/g, ctx.other)
      .replace(/\{\{streak\}\}/g, String(ctx.streak))

  return { title: replace(template.title), body: replace(template.body) }
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch unprocessed death events from last 24 hours
    const { data: events, error: eventsError } = await supabase
      .from('user_activity_log')
      .select('id, user_id, metadata, created_at')
      .eq('activity_type', 'friend_streak_died')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (eventsError) {
      console.error('Failed to fetch death events:', eventsError)
      return new Response(JSON.stringify({ success: false, error: eventsError.message }), { status: 500 })
    }

    const unprocessed = (events || []).filter((e: any) => !e.metadata?.notified)

    if (unprocessed.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    let skipped = 0

    for (const event of unprocessed) {
      const { user_id, metadata, id: eventId } = event
      const friendId = metadata.friend_id
      const lostStreak = metadata.lost_streak

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('first_name, name, expo_push_token, meta')
        .eq('id', user_id)
        .single()

      if (!userProfile) {
        skipped++
        continue
      }

      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('first_name, name')
        .eq('id', friendId)
        .single()

      const friendName = userProfile.first_name || userProfile.name || 'there'
      const otherName = otherProfile?.first_name || otherProfile?.name || 'Your friend'

      const template = deathTemplates[Math.floor(Math.random() * deathTemplates.length)]
      const { title, body } = renderTemplate(template, {
        friend: friendName,
        other: otherName,
        streak: lostStreak,
      })

      const pushResult = await sendUserPush({
        supabase,
        userId: user_id,
        title,
        body,
        data: {
          type: 'friend_streak_died',
          friend_streak_id: metadata.friend_streak_id,
          screen: '/friends',
        },
        preferenceKey: 'friend_activity',
        preloadedProfile: userProfile,
      })

      const logMetadata = pushResult.sent
        ? { ...metadata, notified: true }
        : { ...metadata, notified: true, skipped: true, skip_reason: pushResult.reason }

      await supabase
        .from('user_activity_log')
        .update({ metadata: logMetadata })
        .eq('id', eventId)

      if (pushResult.sent) sent++
      else skipped++
    }

    return new Response(
      JSON.stringify({ success: true, sent, skipped, total: unprocessed.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('send-friend-streak-death error:', error)
    return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 500 })
  }
})
