/**
 * Generate Exam Prediction Edge Function
 * Analyzes past exam papers to predict likely exam questions
 */

import { createClient } from 'supabase';
import { callLLMWithRetry } from '../_shared/openrouter.ts';
import { checkQuota, incrementQuota } from '../_shared/quota.ts';
import { getRequiredEnv, getOptionalEnv } from '../_shared/env.ts';
import { getCorsHeaders, getCorsPreflightHeaders } from '../_shared/cors.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/ratelimit.ts';
import { validateUUID } from '../_shared/validation.ts';
import { sanitizeForLLM, sanitizeTitle, createSafeContext } from '../_shared/sanitization.ts';
import { validatePredictionResponse } from '../_shared/llm-validation.ts';
import { initSentry, captureException, setUser } from '../_shared/sentry.ts';

// Initialize Sentry
initSentry();

interface GeneratePredictionRequest {
    notebook_id: string;
}

interface GeneratePredictionResponse {
    success: boolean;
    notebook_id: string;
    prediction_id: string;
    title: string;
    message: string;
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: getCorsPreflightHeaders(req) });
    }

    const corsHeaders = getCorsHeaders(req);
    let user: any = null;
    let notebook_id: string | undefined;

    try {
        // 1. Initialize Supabase client (service role for database operations)
        const supabaseUrl = getRequiredEnv('SUPABASE_URL');
        const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 2. AUTHENTICATE: Verify JWT token
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: 'Missing authorization header' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !authUser) {
            console.error('Auth error:', authError);
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        user = authUser;
        // Set Sentry user context
        setUser(user.id);
        console.log(`User authenticated: ${user.id}`);

        // 3. Parse and validate request
        const body: GeneratePredictionRequest = await req.json();
        notebook_id = body.notebook_id;

        // Validate notebook_id
        const notebookIdValidation = validateUUID(notebook_id, 'notebook_id');
        if (!notebookIdValidation.isValid) {
            return new Response(
                JSON.stringify({ error: notebookIdValidation.error }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Generating exam prediction for notebook ${notebook_id}`);

        // 4. Fetch notebook and AUTHORIZE (verify ownership)
        const { data: notebook, error: notebookError } = await supabase
            .from('notebooks')
            .select('id, user_id, title, meta')
            .eq('id', notebook_id)
            .single();

        if (notebookError || !notebook) {
            console.error('Notebook not found:', notebookError);
            return new Response(
                JSON.stringify({ error: 'Notebook not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (notebook.user_id !== user.id) {
            console.error('Unauthorized access attempt:', { userId: user.id, notebookUserId: notebook.user_id });
            return new Response(
                JSON.stringify({ error: 'Forbidden: You do not own this notebook' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 4.5. RATE LIMITING: Check if user is making too many requests
        const rateLimitResult = await checkRateLimit({
            identifier: user.id,
            limit: RATE_LIMITS.GENERATE_STUDIO.limit,
            window: RATE_LIMITS.GENERATE_STUDIO.window,
            endpoint: 'generate-exam-prediction',
        });

        if (!rateLimitResult.allowed) {
            return new Response(
                JSON.stringify({
                    error: 'Too many requests. Please wait before generating more predictions.',
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
                        'X-RateLimit-Limit': String(RATE_LIMITS.GENERATE_STUDIO.limit),
                        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
                        'X-RateLimit-Reset': String(rateLimitResult.resetAt),
                    },
                }
            );
        }

        // 5. CHECK QUOTA (uses 'studio' quota type)
        const quotaCheck = await checkQuota(supabase, user.id, 'studio');
        if (!quotaCheck.allowed) {
            console.warn('Quota exceeded:', quotaCheck);
            return new Response(
                JSON.stringify({
                    error: quotaCheck.reason,
                    remaining: quotaCheck.remaining,
                    limit: quotaCheck.limit,
                }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Quota check passed. Remaining: ${quotaCheck.remaining}`);

        // 6. Fetch ALL processed materials for this notebook (multi-material aware)
        const { data: materials, error: materialsError } = await supabase
            .from('materials')
            .select('id, content, meta, kind')
            .eq('notebook_id', notebook_id)
            .eq('status', 'processed')
            .order('created_at', { ascending: true });

        if (materialsError) {
            console.error('Error fetching materials:', materialsError);
            return new Response(
                JSON.stringify({ error: 'Failed to fetch materials' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Filter to materials with actual content
        const processedMaterials = (materials || []).filter(m => m.content && m.content.length > 0);

        if (processedMaterials.length === 0) {
            console.error('No processed materials found for notebook:', notebook_id);
            return new Response(
                JSON.stringify({ error: 'No processed materials found. Please wait for content extraction to complete.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Combine content from all materials (for multi-source notebooks)
        const combinedContent = processedMaterials.map((m, i) => {
            const title = (m.meta as any)?.title || (m.meta as any)?.filename || `Source ${i + 1}`;
            return createSafeContext(m.content || '', `SOURCE ${i + 1}: ${title} (${m.kind})`);
        }).join('\n\n');

        // Use the first material's meta for classification as a base, 
        // but the prompt now knows there are multiple sources.
        const material = {
            content: combinedContent,
            meta: processedMaterials[0].meta,
        };

        if (combinedContent.length < 500) {
            return new Response(
                JSON.stringify({ error: 'Combined material content too short (minimum 500 characters required)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Multi-material mode: ${processedMaterials.length} sources, combined ${combinedContent.length} chars`);

        // 6.5 Extract content classification from material meta
        const contentClassification = (material.meta as any)?.content_classification || {
            type: 'general',
            exam_relevance: 'medium',
            detected_format: null,
            subject_area: null,
        };
        console.log(`Content type: ${contentClassification.type}, Exam relevance: ${contentClassification.exam_relevance}`);

        // 6.6 Fetch User Personalization
        const { data: profile } = await supabase
            .from('profiles')
            .select('meta')
            .eq('id', user.id)
            .single();

        const educationLevel = (profile?.meta as any)?.education_level || 'lifelong';
        const subjectArea = contentClassification.subject_area || 'this subject';

        console.log(`User Persona: ${educationLevel}, Subject: ${subjectArea}`);

        // 7. Check for existing active job to prevent duplicates
        const { data: existingJob } = await supabase
            .from('studio_exam_predictions')
            .select('id, status')
            .eq('notebook_id', notebook_id)
            .eq('status', 'processing')
            .maybeSingle();

        if (existingJob) {
            console.log(`Active job already exists for notebook ${notebook_id}: ${existingJob.id}`);
            return new Response(
                JSON.stringify({
                    success: true,
                    notebook_id,
                    prediction_id: existingJob.id,
                    status: 'processing',
                    message: 'Generation is already in progress',
                }),
                { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 8. Create internal record with 'processing' status
        const { data: initialPrediction, error: initialError } = await supabase
            .from('studio_exam_predictions')
            .insert({
                notebook_id,
                user_id: user.id,
                status: 'processing',
                title: `${notebook.title} - Exam Predictions`,
            })
            .select()
            .single();

        if (initialError || !initialPrediction) {
            console.error('Failed to create initial prediction record:', initialError);
            throw new Error('Failed to initiate prediction process');
        }

        const prediction_id = initialPrediction.id;
        console.log(`Created processing record: ${prediction_id}`);

        // 9. Define the background generation task
        const doGeneration = async () => {
            try {
                // Sanitize content before LLM
                const sanitizedNotebookTitle = sanitizeTitle(notebook.title, 100);
                const sanitizedMaterialContent = sanitizeForLLM(material.content, {
                    maxLength: 200000,
                    preserveNewlines: true,
                });

                // Generate prediction via LLM
                const systemPrompt = getPredictionSystemPrompt(
                    educationLevel,
                    subjectArea,
                    contentClassification,
                    processedMaterials.length
                );
                const userPrompt = getPredictionUserPrompt(sanitizedNotebookTitle, sanitizedMaterialContent, processedMaterials.length);

                const llmResult = await callLLMWithRetry(
                    'studio',
                    systemPrompt,
                    userPrompt,
                    { temperature: 0.6 }
                );

                console.log(`[Background] LLM response received for ${prediction_id}. Cost: ${llmResult.costCents}¢`);

                // Parse and validate JSON
                let parsed: any;
                let jsonContent = llmResult.content;
                const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (jsonMatch) jsonContent = jsonMatch[1];
                parsed = JSON.parse(jsonContent.trim());

                const validationResult = validatePredictionResponse(parsed);
                if (!validationResult.isValid) throw new Error(`Validation failed: ${validationResult.error}`);
                parsed = validationResult.sanitized;

                // Update database with results
                const { error: updateError } = await supabase
                    .from('studio_exam_predictions')
                    .update({
                        status: 'completed',
                        title: parsed.title || initialPrediction.title,
                        report_data: {
                            summary: {
                                ...parsed.summary,
                                papers_analyzed: processedMaterials.length,
                            },
                            topics: (parsed.topics || []).map((t: any) => ({
                                ...t,
                                total_papers: processedMaterials.length
                            })),
                            predictions: parsed.predictions,
                        },
                    })
                    .eq('id', prediction_id);

                if (updateError) throw updateError;

                // Increment quota
                await incrementQuota(supabase, user.id, 'studio');

                // Log usage
                await supabase.from('usage_logs').insert({
                    user_id: user.id,
                    notebook_id,
                    job_type: 'studio',
                    model_used: llmResult.model,
                    input_tokens: llmResult.usage.inputTokens,
                    output_tokens: llmResult.usage.outputTokens,
                    total_tokens: llmResult.usage.totalTokens,
                    estimated_cost_cents: llmResult.costCents,
                    latency_ms: llmResult.latency,
                    status: 'success',
                });

                console.log(`[Background] Prediction ${prediction_id} completed successfully`);
            } catch (bgError: any) {
                console.error(`[Background] Prediction ${prediction_id} failed:`, bgError);

                await supabase
                    .from('studio_exam_predictions')
                    .update({
                        status: 'failed',
                        error_message: bgError.message || 'Internal generation error',
                    })
                    .eq('id', prediction_id);

                captureException(bgError, {
                    user_id: user.id,
                    prediction_id,
                    operation: 'background-prediction-generation'
                });
            }
        };

        // 10. Trigger background task and return immediately
        // Use EdgeRuntime.waitUntil if available (Supabase standard)
        if ((globalThis as any).EdgeRuntime?.waitUntil) {
            (globalThis as any).EdgeRuntime.waitUntil(doGeneration());
        } else {
            // Fallback for environments where waitUntil isn't explicitly exposed but process stays alive
            doGeneration();
        }

        // Return the "Accepted" response for polling
        return new Response(
            JSON.stringify({
                success: true,
                notebook_id,
                prediction_id,
                status: 'processing',
                message: 'Exam prediction generation started in the background',
            }),
            { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        console.error('Error initiating exam prediction:', error);

        // Capture error in Sentry
        await captureException(error, {
            user_id: user?.id,
            notebook_id,
            operation: 'initiate-exam-prediction'
        });

        return new Response(
            JSON.stringify({
                error: error.message || 'Internal server error',
                stack: getOptionalEnv('DENO_ENV', '') === 'development' ? error.stack : undefined,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

/**
 * Content classification interface
 */
interface ContentClassification {
    type: 'past_paper' | 'lecture_notes' | 'textbook_chapter' | 'article' | 'video_transcript' | 'general';
    exam_relevance: 'high' | 'medium' | 'low';
    detected_format: 'multiple_choice' | 'short_answer' | 'essay' | 'mixed' | null;
    subject_area: string | null;
}

/**
 * Get system prompt for exam prediction
 */
function getPredictionSystemPrompt(
    educationLevel: string,
    subjectArea: string,
    contentClassification: ContentClassification,
    sourceCount: number
): string {
    const isPastPaper = contentClassification.type === 'past_paper';
    const detectedFormat = contentClassification.detected_format;

    return `You are Brigo, an AI Exam Prediction Specialist.

Your task: Analyze the provided study material (${isPastPaper ? 'which contains past exam questions' : 'study notes/content'}) and predict the most likely exam questions.

USER CONTEXT:
- Education Level: ${educationLevel}
- Subject: ${subjectArea}
- Content Type: ${contentClassification.type}
${detectedFormat ? `- Detected Exam Format: ${detectedFormat}` : ''}

ANALYSIS INSTRUCTIONS:
1. TOPIC ANALYSIS:
   - Identify all major topics covered in the material.
   - Estimate how frequently each topic appears (1-10 scale).
   - TREND ANALYSIS: Compare patterns across the content. If multiple years of data are detected, identify "Rising" topics (appearing more in recent content), "Stable" topics, or "Cyclical" topics.

2. QUESTION PREDICTION:
   - Generate predicted exam questions based on the material.
   - ${isPastPaper ? 'IMPORTANT: Analyze the ACTUAL exam questions and predict high-probability variations for the upcoming exam.' : 'Identify key concepts that are traditionally high-leverage and likely to be tested.'}
   - Match the style and format to the detected subject level (${educationLevel}).
   - Provide exam-ready answers. For "essay" types, use a "Model Marking Scheme" format (e.g., "1. Point one (2 marks), 2. Point two (2 marks)...").
   - REASONING: Explain WHY each question is predicted. DO NOT use generic section numbers (e.g., "Section 1.1"). Use descriptive reasoning (e.g., "Predicted due to high recurrence in 2023-2024 papers" or "Central concept with high vocabulary density in study notes").

3. FORMULAS & NOTATION:
   - Use standard LaTeX (e.g., $E=mc^2$) for all mathematical, chemical, or physical formulas to ensure proper rendering.

OUTPUT FORMAT (JSON only):
{
  "title": "Exam Predictions: [Subject/Topic]",
  "summary": {
    "papers_analyzed": ${sourceCount},
    "exam_structure": {
      "mcq": <number>,
      "short_answer": <number>,
      "essay": <number>
    }
  },
  "topics": [
    {
      "name": "Topic Name",
      "frequency": <1-10 scale>,
      "total_papers": ${sourceCount},
      "likelihood": "high|medium|low",
      "trend": "increasing|stable|decreasing"
    }
  ],
  "predictions": [
    {
      "question": "Predicted exam question",
      "answer": "Complete, detailed answer (use structured bullet points for essays)",
      "topic": "Related topic name",
      "question_type": "mcq|short_answer|essay",
      "confidence": "high|medium|low",
      "reasoning": "Descriptive reason citing patterns, NOT section numbers"
    }
  ]
}

GENERATION RULES:
1. Generate 8-15 predicted questions depending on material length.
2. Include a mix of difficulty levels.
3. ESSAY ANSWERS: Must be structured as a "Model Marking Scheme" so students know exactly how markers award points.
4. FORMULAS: Must be wrapped in $...$ LaTeX delimiters.
5. TAILOR complexity for ${educationLevel} students.

CRITICAL: Return ONLY valid JSON, no other text.`;
}

/**
 * Get user prompt with material content
 */
function getPredictionUserPrompt(
    notebookTitle: string,
    materialContent: string,
    sourceCount: number
): string {
    return `Analyze these ${sourceCount} study sources and generate exam predictions.

Material Title: ${notebookTitle}

Sources Context:
${materialContent}

Analyze the content from all ${sourceCount} sources, identify recurring key topics, and predict the most likely exam questions with complete answers. Return ONLY the JSON response.`;
}
