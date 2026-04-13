/**
 * Send Friend Nudge Edge Function
 *
 * Sends a push notification when a user taps "Nudge" on a study pal.
 * Called from the client after nudge_friend RPC succeeds.
 *
 * Flow:
 * 1. Client calls nudge_friend RPC → validates + logs nudge + rate limits
 * 2. Client calls this edge function with { friend_streak_id }
 * 3. This function looks up the friend's push token server-side
 * 4. Checks the friend's notification preferences
 * 5. Sends the push via Expo API
 */

import { createClient } from "supabase"
import { sendUserPush } from "../_shared/push.ts"

interface RequestBody {
  friend_streak_id: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Playful nudge message templates — mixed emotional categories
const nudgeTemplates = [
  // Cheeky / Sass
  { title: '🙈 {{nudger}} noticed', body: "Yeah, they saw you haven't studied today. Your {{streak}}-day streak is watching." },
  { title: '👀 Oh, {{friend}}.', body: "{{nudger}} studied. You didn't. The math isn't mathing. {{streak}} days on the line." },
  { title: '🫠 {{friend}}...', body: "{{nudger}} is doing the work. You're... not. Fix it. {{streak}}-day streak says hi." },

  // Playful Guilt
  { title: '🥺 {{nudger}} is sad', body: "They studied but you didn't, {{friend}}. What did the {{streak}}-day streak ever do to you?" },
  { title: "😔 It's quiet over here", body: "{{nudger}} hit the books. {{friend}}? Crickets. Your {{streak}}-day streak is getting awkward." },

  // Hype / Positive
  { title: '🚀 You + {{nudger}} = {{streak}} days strong', body: "Don't lose the momentum, {{friend}}. Go grab today's W." },
  { title: '💪 {{nudger}} believes in you', body: "They did their part for the {{streak}}-day streak. Time to hold up yours, {{friend}}." },
  { title: '🎯 Keep the combo alive', body: "{{nudger}} just studied. {{friend}}, join them — {{streak}} days and counting." },

  // Dramatic / Urgent
  { title: "😱 {{friend}}, it's happening", body: "{{nudger}} studied. Your {{streak}}-day streak is dangling by a thread. Save it." },
  { title: "⏰ Clock's ticking, {{friend}}", body: "Your {{streak}}-day streak with {{nudger}} doesn't wait. Go study." },
  { title: '🔥 Streak emergency', body: "{{nudger}} already studied. {{friend}}'s on deck. {{streak}} days to protect." },

  // Friendly / Warm
  { title: '👋 Hey {{friend}}', body: "{{nudger}} just finished studying. Wanna keep your {{streak}}-day streak alive together?" },
  { title: '🤝 Your {{streak}}-day streak misses you', body: "{{nudger}} did their part today, {{friend}}. Your turn." },

  // Competitive
  { title: '🏆 {{nudger}} is ahead', body: "They studied, you haven't. Don't let {{nudger}} carry your {{streak}}-day streak alone, {{friend}}." },
  { title: '⚡ {{nudger}}: 1, {{friend}}: 0', body: "Today's scoreboard isn't looking great. {{streak}}-day streak on the line." },
]

function renderTemplate(template: { title: string; body: string }, ctx: { nudger: string; friend: string; streak: number }) {
  const replace = (text: string) =>
    text
      .replace(/\{\{nudger\}\}/g, ctx.nudger)
      .replace(/\{\{friend\}\}/g, ctx.friend)
      .replace(/\{\{streak\}\}/g, String(ctx.streak))

  return {
    title: replace(template.title),
    body: replace(template.body),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing auth' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid auth' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { friend_streak_id }: RequestBody = await req.json()

    if (!friend_streak_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing friend_streak_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up the friendship and verify caller is part of it
    const { data: friendship, error: friendshipError } = await supabase
      .from('friend_streaks')
      .select('id, user_a, user_b, streak, status')
      .eq('id', friend_streak_id)
      .eq('status', 'active')
      .single()

    if (friendshipError || !friendship) {
      return new Response(
        JSON.stringify({ success: false, error: 'Friendship not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (friendship.user_a !== callerUser.id && friendship.user_b !== callerUser.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authorized for this friendship' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const friendId = friendship.user_a === callerUser.id ? friendship.user_b : friendship.user_a

    // Get friend's profile (push token, name, notification settings)
    // Note: "studied today" check is done in the RPC before we get here
    const { data: friendProfile, error: friendError } = await supabase
      .from('profiles')
      .select('id, first_name, name, expo_push_token, meta')
      .eq('id', friendId)
      .single()

    if (friendError || !friendProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Friend profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get nudger's name
    const { data: nudgerProfile } = await supabase
      .from('profiles')
      .select('first_name, name')
      .eq('id', callerUser.id)
      .single()

    const nudgerName = nudgerProfile?.first_name || nudgerProfile?.name || 'A friend'
    const friendName = friendProfile.first_name || friendProfile.name || 'there'

    const template = nudgeTemplates[Math.floor(Math.random() * nudgeTemplates.length)]
    const { title, body } = renderTemplate(template, {
      nudger: nudgerName,
      friend: friendName,
      streak: friendship.streak,
    })

    const pushResult = await sendUserPush({
      supabase,
      userId: friendId,
      title,
      body,
      data: {
        type: 'friend_nudge',
        friend_streak_id,
        nudger_id: callerUser.id,
      },
      preferenceKey: 'friend_nudges',
      preloadedProfile: friendProfile,
    })

    return new Response(
      JSON.stringify({ success: true, ...pushResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('send-friend-nudge error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
