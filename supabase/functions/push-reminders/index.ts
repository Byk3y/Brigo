import { createClient } from "supabase"

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'

// Types for the Edge Function
interface Profile {
    id: string
    expo_push_token: string
    timezone: string
    last_streak_date: string
    streak: number
    last_notification_sent_at: string | null
    first_name: string | null
}

interface NotificationPayload {
    to: string
    sound: string
    title: string
    body: string
    data: Record<string, any>
    mutableContent: boolean
    _displayInForeground: boolean
    _profileId: string
}

interface NotificationContext {
    petName: string
    streak: number
    lastNotebook: string
    subject: string
    quizScore: number | null
    quizTitle: string | null
    quizCompletedAt: string | null
    pointsToLevelUp: number
    petStage: number
    topic: string
    firstName: string
}

type NotificationCategory = 'passive_aggressive' | 'loss_aversion' | 'hype' | 'context_rich' | 'soft' | 'comeback' | 'onboarding'

interface MessageTemplate {
    title: string
    body: string
}

// ============================================================================
// NOTIFICATION TEMPLATE LIBRARY (50+ Duolingo-style messages)
// ============================================================================

const templateLibrary: Record<NotificationCategory, MessageTemplate[]> = {
    // Category 1: Passive-Aggressive (The "Unhinged Duo" Move)
    // Best for: Users who have ignored 2+ reminders
    passive_aggressive: [
        { title: `🙄 Wow, okay.`, body: `So we're just ignoring "{{lastNotebook}}" today? I see how it is, {{firstName}}. 💅` },
        { title: `🤡 Is this a joke?`, body: `Your streak is crying. I'm crying. Even "{{lastNotebook}}" is crying. Fix it, {{firstName}}.` },
        { title: `🤐 No words.`, body: `If you wanted to lose your streak, you could have just said so, {{firstName}}. 💅` },
        { title: `Hi, {{firstName}}, it's {{petName}}.`, body: `These reminders don't seem to be working. I'll stop for now. ✌️` },
        { title: `Oh, {{firstName}}, so we're just 'friends' now?`, body: `Cool. {{petName}} noticed you haven't opened "{{lastNotebook}}" today. 💅` },
        { title: `🤐 Since you're clearly busy...`, body: `I've started studying on my own, {{firstName}}. I'm already smarter than you. 🧠` },
        { title: `👀 I see you opening other apps.`, body: `It's okay, {{firstName}}. I'm not jealous. I'm just... disappointed. 🦉` },
        { title: `{{petName}} is packing their bags.`, body: `One session in "{{lastNotebook}}" is the only thing that will make them stay, {{firstName}}.` },
        { title: `Is this a joke to you, {{firstName}}?`, body: `Your {{streak}}-day streak is literally crying. Fix it. 🤡` },
        { title: `I guess "{{lastNotebook}}" isn't important.`, body: `I'll just wait here... forever, {{firstName}}. 🕯️` },
    ],

    // Category 2: High-Stakes / Loss Aversion
    // Best for: Late-night "Streak Saver" nudges
    loss_aversion: [
        { title: `🚨 SOS: Save {{petName}}!`, body: `Your {{streak}}-day streak is gasping for air!` },
        { title: `Don't let the fire go out!`, body: `🕯️ 1 minute in "{{lastNotebook}}" keeps the streak alive.` },
        { title: `⏰ Last chance!`, body: `In 60 minutes, your {{streak}}-day streak becomes 0. Don't do it. 😱` },
        { title: `🏃‍♀️ Your streak is in DANGER.`, body: `Open Brigo now to rescue your {{streak}} days!` },
        { title: `You've worked {{streak}} days for this.`, body: `Don't throw it all away for a TikTok scroll. 📱` },
        { title: `🧊 The streak freeze is melting!`, body: `Save your {{streak}} days before it's too late.` },
        { title: `{{petName}} found a lost flashcard!`, body: `Review it to save your streak! 🃏` },
        { title: `Don't be that person.`, body: `You know, the one who loses a {{streak}}-day streak. 📉` },
        { title: `⏳ Tik-tok.`, body: `The clock is ticking on those {{streak}} days.` },
        { title: `Everything you studied is fading...`, body: `Keep "{{lastNotebook}}" fresh! 🌫️` },
    ],

    // Category 3: The "Hype" Bestie
    // Best for: Mid-day nudges or milestone mornings
    hype: [
        { title: `🚀 LET'S GOOO!`, body: `You're only 1 session away from a {{streak}}-day milestone, {{firstName}}!` },
        { title: `You're crushing it!`, body: `{{petName}} is doing a happy dance. 💃 Keep it up, {{firstName}}!` },
        { title: `☀️ Morning, superstar!`, body: `Ready to make "{{lastNotebook}}" your masterpiece today?` },
        { title: `🧠 I just saw your progress—`, body: `you're basically a genius now, {{firstName}}. Review "{{lastNotebook}}" to confirm.` },
        { title: `⚡️ Energy check!`, body: `5 minutes of study = 0% guilt later tonight, {{firstName}}.` },
        { title: `You + Brigo = Academic Weapon.`, body: `⚔️ Let's get it, {{firstName}}!` },
        { title: `🏆 Big moves, {{firstName}}!`, body: `Your {{streak}}-day streak is legendary!` },
        { title: `New day, new gains.`, body: `Let's tackle "{{lastNotebook}}" together, {{firstName}}! 🤝` },
        { title: `🦸‍♂️ Consistency is your superpower.`, body: `Keep the streak alive, {{firstName}}!` },
        { title: `🎯 Milestone Alert!`, body: `Only {{pointsToLevelUp}} points until {{petName}} evolves! Let's get to work. 🚀` },
        { title: `Evolution incoming! 🐣`, body: `{{petName}} is almost at Stage {{nextPetStage}}. Hit your goal to level up!` },
    ],

    // Category 4: Context-Rich / Topic-Specific (The "Smart" Nudge)
    // Best for: Afternoon "Deep Dive" nudges
    context_rich: [
        { title: `🤔 Still thinking about it?`, body: `{{petName}} is still curious about those {{subject}} notes.` },
        { title: `📖 Ready to dive in?`, body: `Your {{subject}} materials are waiting for you, {{firstName}}. ✨` },
        { title: `📝 Quick check-in!`, body: `You were doing great with {{subject}}. Ready for a quick session?` },
        { title: `🧩 Brain teaser!`, body: `{{petName}} found a tricky concept in your {{subject}} notes. Can you master it?` },
        { title: `✅ Focus time!`, body: `Only 5 minutes on {{subject}} to keep your brain sharp today.` },
        { title: `🧠 Save future you—`, body: `Reviewing "{{lastNotebook}}" now means no cramming later. Smart move.` },
        { title: `😤 Growth mindset!`, body: `Level up {{petName}} (Stage {{petStage}}) by mastering {{subject}} today.` },
        { title: `☕ Study break is over!`, body: `How's the {{subject}} progress coming along, {{firstName}}?` },
        { title: `👥 {{petName}} missed you!`, body: `They're waiting to help you with {{subject}} right now.` },
        { title: `🛀 Wind down with {{subject}}`, body: `A 2-minute review is the perfect way to finish your day.` },
    ],

    // Category 5: Soft / Supportive
    // Best for: High-stress periods (Exam weeks)
    soft: [
        { title: `🧘‍♀️ Take a deep breath.`, body: `2 minutes of {{subject}} is enough to stay on track.` },
        { title: `I know it's a lot.`, body: `But {{petName}} is here to help. Just one quick look at {{subject}}? 🕯️` },
        { title: `🌸 Small steps lead to big wins.`, body: `Keep going gently with {{subject}}.` },
        { title: `☁️ Studying is hard.`, body: `You're doing great. See you in "{{lastNotebook}}"?` },
        { title: `💖 You're more than your grades.`, body: `But a quick review of {{subject}} won't hurt!` },
        { title: `🏔️ Don't stress about the mountain.`, body: `Just focus on one small {{subject}} concept.` },
        { title: `📣 {{petName}} is cheering for you quietly.`, body: `(Shhh, keep studying!)` },
        { title: `💌 Your future self will thank you`, body: `for those 5 minutes in "{{lastNotebook}}" today.` },
        { title: `👯‍♀️ You've got the brains,`, body: `I've got the reminders. Perfect team.` },
        { title: `✨ Stay curious. Keep learning.`, body: `See you inside {{lastNotebook}}!` },
    ],

    // Category 6: Comeback (For users with streak = 0)
    // Best for: Re-engaging lapsed users without guilt-tripping about "broken" streaks
    comeback: [
        { title: `👋 Hey stranger!`, body: `{{petName}} has been waiting for you. Ready to pick up {{subject}} again?` },
        { title: `🌱 Fresh start?`, body: `Today is a perfect day to begin a new streak. {{petName}} believes in you!` },
        { title: `🎯 No streak? No problem.`, body: `Everyone starts somewhere. Let's go review {{subject}}!` },
        { title: `🦋 Welcome back!`, body: `{{petName}} missed you. Ready to pick up where you left off with {{subject}}?` },
        { title: `🔄 Time for a comeback?`, body: `"{{lastNotebook}}" is waiting. Let's start fresh!` },
        { title: `☀️ New day, new you.`, body: `{{petName}} is ready when you are. No judgment here.` },
        { title: `🚀 Ready to restart?`, body: `One session today = Day 1 of your new streak!` },
        { title: `💪 You've got this.`, body: `{{petName}} is cheering for your comeback. Start with {{subject}}?` },
        { title: `🌈 Every expert was once a beginner.`, body: `Let's build something great together, starting now.` },
        { title: `🎬 Plot twist incoming!`, body: `{{petName}} senses a comeback arc. Prove them right?` },
    ],

    // Category 7: Onboarding (For users with 0 notebooks)
    // Best for: New users who signed up but haven't started yet
    onboarding: [
        { title: `👋 Hi {{firstName}}!`, body: `{{petName}} is lonely! Add your first material to get started. ✨` },
        { title: `Ready to ace your exams?`, body: `Create your first notebook and let's start the journey! 🚀` },
        { title: `{{petName}} is waiting!`, body: `Upload a PDF or link to see the magic happen. ✨` },
        { title: `First step is the hardest,`, body: `but {{firstName}}, I'm here to make it easy. Add a source? 🕯️` },
        { title: `Your pet is hungry!`, body: `Feed {{petName}} some study material to help them grow. 🌱` },
    ],
}

// ============================================================================
// SMART CATEGORY SELECTION
// ============================================================================

function selectCategory(
    diffDays: number,
    quizScore: number | null,
    quizCompletedAt: string | null,
    pointsToLevelUp: number,
    currentHour: number,
    streak: number,
    hasNotebooks: boolean
): NotificationCategory {
    // Priority 0: Empty State - Onboarding
    if (!hasNotebooks) {
        return 'onboarding'
    }

    // Priority 1: Streak at risk (URGENT loss aversion)
    // If it's night time (8 PM+) and streak is not secured
    if (currentHour >= 20 && streak > 0) {
        return 'loss_aversion'
    }

    // Priority 2: Streak is 0 - use comeback messages
    if (streak === 0) {
        return 'comeback'
    }

    // Priority 3: Quiz recovery (only if bombed a quiz in the last 7 days)
    if (quizScore !== null && quizScore < 50 && quizCompletedAt) {
        const quizDate = new Date(quizCompletedAt)
        const now = new Date()
        const daysSinceQuiz = Math.ceil((now.getTime() - quizDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceQuiz <= 7) {
            return 'context_rich'
        }
    }

    // Priority 4: Smart Context (Subject-driven)
    // If it's afternoon and they have active studies, use context-rich 50% of time
    if (currentHour >= 12 && currentHour < 18 && Math.random() > 0.5) {
        return 'context_rich'
    }

    // Priority 5: Pet level-up nudge (gamification hook)
    if (pointsToLevelUp > 0 && pointsToLevelUp <= 20) {
        return 'hype'
    }

    // Priority 6: Been gone a while (2+ days)
    if (diffDays > 1) {
        return 'passive_aggressive'
    }

    // Priority 7: Morning encouragement
    if (currentHour >= 8 && currentHour <= 11) {
        return 'hype'
    }

    // Default: Random between hype and soft
    return Math.random() > 0.5 ? 'hype' : 'soft'
}

// ============================================================================
// TEMPLATE VARIABLE INJECTION
// ============================================================================

function injectVariables(template: MessageTemplate, context: NotificationContext): MessageTemplate {
    let title = template.title
    let body = template.body

    const replacements: Record<string, string> = {
        '{{petName}}': context.petName,
        '{{streak}}': String(context.streak),
        '{{lastNotebook}}': context.lastNotebook,
        '{{subject}}': context.subject,
        '{{quizScore}}': context.quizScore !== null ? String(context.quizScore) : '',
        '{{quizTitle}}': context.quizTitle || '',
        '{{pointsToLevelUp}}': String(context.pointsToLevelUp),
        '{{petStage}}': String(context.petStage),
        '{{nextPetStage}}': String(context.petStage + 1),
        '{{topic}}': context.topic,
        '{{firstName}}': context.firstName
    }

    for (const [key, value] of Object.entries(replacements)) {
        title = title.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
        body = body.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value)
    }

    return { title, body }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req: Request) => {
    try {
        // Parse body for debug flag
        let debug = false
        try {
            const body = await req.json()
            debug = body?.debug === true
        } catch (_e) {
            // No body or not JSON, ignore
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Get users with push tokens
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, expo_push_token, timezone, last_streak_date, streak, last_notification_sent_at, first_name')
            .not('expo_push_token', 'is', null)

        if (profileError) throw profileError

        const notifications: NotificationPayload[] = []
        const now = new Date()
        const COOLDOWN_HOURS = 8

        for (const profile of profiles as Profile[]) {
            const timezone = profile.timezone || 'UTC'

            // === SPAM PREVENTION ===
            if (profile.last_notification_sent_at && !debug) {
                const lastSent = new Date(profile.last_notification_sent_at)
                const hoursSinceLastNotification = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60)
                if (hoursSinceLastNotification < COOLDOWN_HOURS) {
                    continue
                }
            }

            // Get current hour in user's timezone
            const userTime = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: 'numeric',
                hour12: false,
            }).format(now)
            const currentHour = parseInt(userTime)

            // Only send if it's evening (6 PM to 11 PM) or morning (8 AM to 11 AM)
            const isValidTime = (currentHour >= 18 && currentHour <= 23) || (currentHour >= 8 && currentHour <= 11)
            if (!isValidTime && !debug) continue

            // Format today's date in user's timezone
            const userDate = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(now)
            const [mm, dd, yyyy] = userDate.split('/')
            const formattedToday = `${yyyy}-${mm}-${dd}`

            if (profile.last_streak_date === formattedToday && !debug) continue

            // Calculate days since last activity
            let diffDays = 0
            if (profile.last_streak_date) {
                const lastDate = new Date(profile.last_streak_date)
                const todayDate = new Date(formattedToday)
                const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime())
                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            }

            // Step 2: Fetch notebook with subject
            const { data: notebook } = await supabase
                .from('notebooks')
                .select('id, title, meta')
                .eq('user_id', profile.id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .single()

            // Fetch pet with points
            const { data: pet } = await supabase
                .from('pet_states')
                .select('name, current_stage, current_points')
                .eq('user_id', profile.id)
                .single()

            // Fetch last quiz score
            const { data: lastQuiz } = await supabase
                .from('quiz_completions')
                .select('score_percentage, completed_at, quiz:studio_quizzes(title)')
                .eq('user_id', profile.id)
                .order('completed_at', { ascending: false })
                .limit(1)
                .single()

            // Extract subject from notebook metadata
            const contentClassification = notebook?.meta?.content_classification
            const subject = contentClassification?.subject_area || 'your studies'

            // Personalized Persona Names for users without first_name
            const personas: Record<'supportive' | 'playful' | 'urgent', string[]> = {
                supportive: ['superstar', 'champion', 'legend', 'ace', 'hero'],
                playful: ['friend', 'bestie', 'scholar', 'partner in crime', 'pet parent'],
                urgent: ['slacker', 'stranger', 'procrastinator', 'missing student']
            }

            const getPersonalizedName = (cat: NotificationCategory, firstName: string | null) => {
                if (firstName) return firstName
                let personaType: 'supportive' | 'playful' | 'urgent' = 'supportive'
                if (cat === 'passive_aggressive') personaType = 'urgent'
                else if (cat === 'soft' || cat === 'hype') personaType = 'supportive'
                else if (cat === 'comeback' || cat === 'onboarding') personaType = 'playful'

                const pool = personas[personaType]
                return pool[Math.floor(Math.random() * pool.length)]
            }

            // Build context object
            const context: NotificationContext = {
                petName: pet?.name || 'Nova',
                streak: profile.streak || 0,
                lastNotebook: notebook?.title || 'your notes',
                subject: subject,
                quizScore: lastQuiz?.score_percentage ?? null,
                quizTitle: (lastQuiz?.quiz as any)?.title ?? null,
                quizCompletedAt: lastQuiz?.completed_at ?? null,
                pointsToLevelUp: Math.max(0, ((pet?.current_stage || 1) * 100) - (pet?.current_points || 0)),
                petStage: pet?.current_stage || 1,
                topic: subject, // Use subject as topic fallback
                firstName: '', // Will be set after category selection
            }

            // Get pet bubble image
            const bucketUrl = 'https://tunjjtfnvtscgmuxjkng.supabase.co/storage/v1/object/public/assets'
            const petImageUrl = `${bucketUrl}/pets/stage-${context.petStage}/bubble.png`

            // ================================================================
            // PHASE 3: SMART CATEGORY SELECTION
            // ================================================================

            const category = selectCategory(
                diffDays,
                context.quizScore,
                context.quizCompletedAt,
                context.pointsToLevelUp,
                currentHour,
                context.streak,
                !!notebook
            )

            // Finalize firstName based on category
            context.firstName = getPersonalizedName(category, profile.first_name)

            // ================================================================
            // PHASE 4: TEMPLATE SELECTION & VARIABLE INJECTION
            // ================================================================

            const templates = templateLibrary[category]
            const rawTemplate = templates[Math.floor(Math.random() * templates.length)]

            const message = injectVariables(rawTemplate, context)

            console.log(`[${profile.id}] Category: ${category}, Template: ${rawTemplate.title.substring(0, 30)}...`)

            notifications.push({
                to: profile.expo_push_token,
                sound: 'default',
                title: message.title,
                body: message.body,
                data: {
                    notebookId: notebook?.id,
                    screen: '/(tabs)/home',
                    imageUrl: petImageUrl,
                    category: category, // Track for analytics
                },
                mutableContent: true,
                _displayInForeground: true,
                _profileId: profile.id,
            })
        }

        // ================================================================
        // SEND TO EXPO
        // ================================================================

        let ticketIds: string[] = []
        const sentProfileIds: string[] = []

        if (notifications.length > 0) {
            notifications.forEach(n => sentProfileIds.push(n._profileId))
            const expoPayloads = notifications.map(({ _profileId, ...rest }) => rest)

            const response = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Accept-encoding': 'gzip, deflate',
                },
                body: JSON.stringify(expoPayloads),
            })

            const result = await response.json()
            console.log('Expo Response:', result)

            if (result.data) {
                ticketIds = result.data
                    .filter((ticket: any) => ticket.id)
                    .map((ticket: any) => ticket.id)
            }

            // Update last_notification_sent_at
            if (sentProfileIds.length > 0) {
                await supabase
                    .from('profiles')
                    .update({ last_notification_sent_at: now.toISOString() })
                    .in('id', sentProfileIds)
            }

            // Handle invalid tokens
            if (result.data) {
                const invalidTokenProfiles: string[] = []
                result.data.forEach((ticket: any, index: number) => {
                    if (ticket.status === 'error') {
                        if (ticket.details?.error === 'DeviceNotRegistered') {
                            invalidTokenProfiles.push(sentProfileIds[index])
                        }
                        console.error(`Push failed for profile ${sentProfileIds[index]}:`, ticket.message)
                    }
                })

                if (invalidTokenProfiles.length > 0) {
                    console.log(`Cleaning ${invalidTokenProfiles.length} invalid tokens`)
                    await supabase
                        .from('profiles')
                        .update({ expo_push_token: null })
                        .in('id', invalidTokenProfiles)
                }
            }
        }

        await checkAndCleanupReceipts(supabase, ticketIds)

        return new Response(JSON.stringify({
            success: true,
            count: notifications.length,
            ticketsGenerated: ticketIds.length
        }), {
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (err: any) {
        console.error(err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
})

/**
 * Check Expo receipts for delivery errors and clean up invalid tokens
 */
async function checkAndCleanupReceipts(supabase: any, ticketIds: string[]) {
    if (ticketIds.length === 0) return

    try {
        const response = await fetch(EXPO_RECEIPTS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: ticketIds }),
        })

        const { data: receipts } = await response.json()

        if (!receipts) return

        for (const [ticketId, receipt] of Object.entries(receipts as Record<string, any>)) {
            if (receipt.status === 'error') {
                console.log(`Receipt error for ${ticketId}:`, receipt.message)

                if (receipt.details?.error === 'DeviceNotRegistered') {
                    console.log(`Token for ticket ${ticketId} is no longer valid`)
                }
            }
        }

        console.log(`Processed ${Object.keys(receipts).length} receipts`)
    } catch (error) {
        console.error('Error checking receipts:', error)
    }
}
