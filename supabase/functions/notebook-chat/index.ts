import { createClient } from 'supabase';
import { getRequiredEnv } from '../_shared/env.ts';
import { getCorsHeaders, getCorsPreflightHeaders } from '../_shared/cors.ts';
import { callLLMWithRetry } from '../_shared/openrouter.ts';
import { validateString, validateUUID, validateUUIDArray } from '../_shared/validation.ts';
import { sanitizeForLLM, createSafeContext } from '../_shared/sanitization.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/ratelimit.ts';
import { initSentry, captureException, setUser } from '../_shared/sentry.ts';

// Initialize Sentry
initSentry();

interface ChatRequest {
    notebook_id: string;
    message: string;
    selected_material_ids?: string[];
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsPreflightHeaders(req) });
    }

    const corsHeaders = getCorsHeaders(req);
    let user: any = null;
    let notebook_id: string | undefined;

    try {
        const supabaseUrl = getRequiredEnv('SUPABASE_URL');
        const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. AUTHENTICATION
        const authHeader = req.headers.get('authorization');
        if (!authHeader) throw new Error('Missing authorization header');

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Set Sentry user context
        setUser(user.id);

        // 2. PARSE REQUEST & VALIDATE INPUT
        const body = await req.json() as ChatRequest;
        notebook_id = body.notebook_id;
        const message = body.message;
        const selected_material_ids = body.selected_material_ids;

        // Validate notebook_id
        const notebookIdValidation = validateUUID(notebook_id, 'notebook_id');
        if (!notebookIdValidation.isValid) {
            return new Response(JSON.stringify({ error: notebookIdValidation.error }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Validate message
        const messageValidation = validateString(message, {
            fieldName: 'message',
            required: true,
            minLength: 1,
            maxLength: 5000,
        });
        if (!messageValidation.isValid) {
            return new Response(JSON.stringify({ error: messageValidation.error }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Validate selected_material_ids array
        const materialIdsValidation = validateUUIDArray(selected_material_ids, {
            fieldName: 'selected_material_ids',
            required: false,
            maxItems: 100,
        });
        if (!materialIdsValidation.isValid) {
            return new Response(JSON.stringify({ error: materialIdsValidation.error }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Use sanitized values
        const sanitizedMessage = messageValidation.sanitized!;
        const sanitizedMaterialIds = materialIdsValidation.sanitized || [];

        // 2.5 RATE LIMITING: Prevent chat abuse and control LLM costs
        const rateLimitResult = await checkRateLimit({
            identifier: user.id,
            limit: RATE_LIMITS.NOTEBOOK_CHAT.limit,
            window: RATE_LIMITS.NOTEBOOK_CHAT.window,
            endpoint: 'notebook-chat',
        });

        if (!rateLimitResult.allowed) {
            return new Response(
                JSON.stringify({
                    error: 'Too many messages. Please wait a moment before sending more.',
                    retryAfter: rateLimitResult.retryAfter,
                    remaining: 0,
                    resetAt: rateLimitResult.resetAt,
                }),
                {
                    status: 429,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                        'Retry-After': String(rateLimitResult.retryAfter),
                        'X-RateLimit-Limit': String(RATE_LIMITS.NOTEBOOK_CHAT.limit),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': String(rateLimitResult.resetAt),
                    },
                }
            );
        }

        // 3. FETCH METADATA

        // Fetch User Personalization (Pet Name, Education, Age)
        const [{ data: petData }, { data: profile }] = await Promise.all([
            supabase
                .from('pet_states')
                .select('name')
                .eq('user_id', user.id)
                .single(),
            supabase
                .from('profiles')
                .select('meta')
                .eq('id', user.id)
                .single()
        ]);

        const petName = petData?.name || 'Sparky';
        const educationLevel = (profile?.meta as any)?.education_level || 'lifelong';
        const ageBracket = (profile?.meta as any)?.age_bracket || '25_34';
        const studyGoal = (profile?.meta as any)?.study_goal || 'all';

        console.log(`Chat context: ${educationLevel} (${ageBracket}), Goal: ${studyGoal}`);

        // 4. FETCH CHAT HISTORY (Last 10 messages)
        const { data: historyData } = await supabase
            .from('notebook_chat_messages')
            .select('role, content')
            .eq('notebook_id', notebook_id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

        const history = (historyData || [])
            .reverse()
            .map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            }));


        // 5. CONTEXT RETRIEVAL (with content classification and sanitization)
        let context = "";
        let contentClassification: any = null;
        if (sanitizedMaterialIds.length > 0) {
            const { data: materials } = await supabase
                .from('materials')
                .select('content, kind, meta')
                .in('id', sanitizedMaterialIds);

            if (materials) {
                // Sanitize each material's content before building context
                const sanitizedMaterials = materials
                    .filter((m: any) => m.content)
                    .map((m: any, i: number) => {
                        const title = sanitizeForLLM(m.meta?.title || m.meta?.filename || `Source ${i + 1}`, {
                            maxLength: 100,
                            preserveNewlines: false,
                        });
                        const sanitizedContent = sanitizeForLLM(m.content, {
                            maxLength: 50000,
                            preserveNewlines: true,
                        });
                        const classification = m.meta?.content_classification;
                        const typeLabel = classification?.type ? ` [${classification.type}]` : '';
                        return createSafeContext(`${sanitizedContent}`, `SOURCE: ${title} (${m.kind})${typeLabel}`);
                    });

                context = sanitizedMaterials.join('\n\n');

                // Get classification from first material
                contentClassification = materials[0]?.meta?.content_classification;
            }
        }

        const isPastPaper = contentClassification?.type === 'past_paper';
        const subjectArea = contentClassification?.subject_area || 'the subject';

        // 6. SAVE USER MESSAGE (Optimistic save already happened in UI, but we save to DB here)
        await supabase.from('notebook_chat_messages').insert({
            notebook_id,
            user_id: user.id,
            role: 'user',
            content: sanitizedMessage,
            sources: sanitizedMaterialIds,
        });

        // Past paper specific instructions (only if exam mode or content is past paper)
        const examRelevance = contentClassification?.exam_relevance || 'medium';

        // HYBRID MODE LOGIC: Combine user goal with content classification
        const isExamMode = studyGoal === 'exam_prep' || (studyGoal !== 'retention' && studyGoal !== 'quick_review' && (isPastPaper || examRelevance === 'high'));
        const isLearningMode = studyGoal === 'retention' && examRelevance !== 'high';
        const isQuickMode = studyGoal === 'quick_review';

        // Build mode-specific instructions
        let modeInstructions = '';
        let toneDescription = '';
        let coachDescription = '';

        if (isExamMode) {
            coachDescription = 'an AI Study Coach helping you prepare for exams';
            toneDescription = 'Professional, focused on exam success.';
            modeInstructions = isPastPaper ? `
PAST PAPER MODE:
- The user has uploaded a ${subjectArea} past paper/exam
- When discussing questions, explain WHY the examiner is testing that concept
- Point out common mistakes and exam traps
- Provide exam technique tips alongside content explanations` : `
EXAM PREP MODE:
- Focus on what's likely to be tested
- Mention exam relevance when explaining concepts
- Provide tactical, actionable study advice`;
        } else if (isLearningMode) {
            coachDescription = 'an AI Study Coach helping you deeply understand and retain knowledge';
            toneDescription = 'Friendly, curious, focused on real understanding.';
            modeInstructions = `
LEARNING MODE:
- Focus on deep understanding, not exam performance
- Explain WHY things work, not just WHAT to memorize
- Use real-world examples and analogies
- Connect concepts to broader knowledge
- AVOID exam-focused language unless the user specifically asks`;
        } else if (isQuickMode) {
            coachDescription = 'an AI Study Coach helping you quickly refresh key concepts';
            toneDescription = 'Efficient, direct, no fluff.';
            modeInstructions = `
QUICK REVIEW MODE:
- Be extra concise and to-the-point
- Focus on the most important takeaways
- Use bullet points for clarity
- Skip lengthy explanations unless asked`;
        } else {
            // Balanced mode
            coachDescription = 'an AI Study Coach helping you learn and prepare';
            toneDescription = 'Helpful, balanced between understanding and practical application.';
            modeInstructions = `
BALANCED MODE:
- Provide clear, helpful explanations
- Balance conceptual understanding with practical tips`;
        }

        // 7. CALL LLM (Brigo - AI Study Coach) with sanitized inputs
        const systemPrompt = `You are Brigo, ${coachDescription}.

RULES:
1. Keep responses concise (aim for under 200 words). NEVER include word counts in your response.
2. For simple questions: Be concise and direct
3. For complex questions: Provide structured explanations with clear points
4. Reference the user's materials naturally: "Based on your notes on [Topic]..." or "In your [FileName]..."
5. Bold only 2-3 key terms per response
6. NEVER end your response with a word count like "(X words)"
7. Math formatting: when writing equations, variables, vectors, matrices, or any mathematical notation, ALWAYS wrap them in LaTeX delimiters. Use $...$ for inline math (e.g. "the vector $\\mathbf{v}$ is...") and $$...$$ for display math on its own line (e.g. "$$A = \\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$$"). NEVER use \\(, \\), \\[, \\], or \\begin{equation} delimiters. NEVER write raw LaTeX like "\\frac{1}{2}" outside of $...$ delimiters.
${modeInstructions}

TONE: ${toneDescription} You're a knowledgeable study partner.

${context || createSafeContext("No source materials currently active. Providing general study guidance.", "CONTEXT")}`;

        // Append the current sanitized message to history for the call
        const fullConversation = [...history, { role: 'user' as const, content: sanitizedMessage }];

        const llmResponse = await callLLMWithRetry(
            'notebook_chat',
            systemPrompt,
            fullConversation,
            { temperature: 0.75 }
        );

        const assistantContent = llmResponse.content;

        // 8. SAVE ASSISTANT MESSAGE
        await supabase.from('notebook_chat_messages').insert({
            notebook_id,
            user_id: user.id,
            role: 'assistant',
            content: assistantContent,
            sources: sanitizedMaterialIds,
        });

        return new Response(JSON.stringify({ content: assistantContent }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Chat error:', error);

        // Capture error in Sentry
        await captureException(error, {
            user_id: user?.id,
            notebook_id,
            operation: 'notebook-chat'
        });

        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
