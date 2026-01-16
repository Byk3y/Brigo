/**
 * Generate Podcast Edge Function
 * Creates NotebookLM-style podcast audio using:
 * - Gemini 2.0 Pro for script generation
 * - Gemini 2.5 Flash TTS for audio generation
 */

import { createClient } from 'supabase';
import { checkQuota, incrementQuota } from '../_shared/quota.ts';
import { generatePodcastScript, validateScript } from '../_shared/script-generator.ts';
import { generatePodcastAudioWithRetry, getAudioDuration } from '../_shared/gemini-tts.ts';
import { getRequiredEnv, getOptionalEnv } from '../_shared/env.ts';
import { getCorsHeaders, getCorsPreflightHeaders } from '../_shared/cors.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/ratelimit.ts';
import { initSentry, captureException, setUser } from '../_shared/sentry.ts';
import { createSafeContext } from '../_shared/sanitization.ts';

// Initialize Sentry
initSentry();

interface GenerateAudioRequest {
  notebook_id: string;
}

interface GenerateAudioResponse {
  success: boolean;
  overview_id: string;
  status: string;
  estimated_completion_seconds?: number;
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
  let content_type: string | undefined;

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

    // 3. Parse request
    const body: GenerateAudioRequest = await req.json();
    notebook_id = body.notebook_id;

    if (!notebook_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: notebook_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating podcast for notebook ${notebook_id}`);

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
      limit: RATE_LIMITS.GENERATE_AUDIO.limit,
      window: RATE_LIMITS.GENERATE_AUDIO.window,
      endpoint: 'generate-audio-overview',
    });

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests. Please wait before generating more podcasts.',
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
            'X-RateLimit-Limit': String(RATE_LIMITS.GENERATE_AUDIO.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      );
    }

    // 5. CHECK QUOTA (free users: blocked, premium users: unlimited)
    const quotaCheck = await checkQuota(supabase, user.id, 'audio');
    if (!quotaCheck.allowed) {
      console.warn('Quota check failed:', quotaCheck.reason);
      return new Response(
        JSON.stringify({
          error: quotaCheck.reason,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Quota check passed for ${quotaCheck.tier} user`);


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

    // Combine content from all materials using safe context wrapping
    const combinedContent = processedMaterials.map((m, i) => {
      const title = (m.meta as any)?.title || (m.meta as any)?.filename || `Source ${i + 1}`;
      return createSafeContext(m.content || '', `SOURCE ${i + 1}: ${title} (${m.kind})`);
    }).join('\n\n');

    // Track source count for prompts
    const sourceCount = processedMaterials.length;

    // Build a unified material object for downstream code
    const material = {
      content: combinedContent,
      kind: processedMaterials[0].kind,
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

    // 6.55 Extract content summary for multi-material awareness
    const contentSummary = (notebook.meta as any)?.content_summary || {
      material_count: 1,
      has_past_paper: contentClassification.type === 'past_paper',
      has_notes: contentClassification.type === 'lecture_notes' || contentClassification.type === 'textbook_chapter',
      material_types: [contentClassification.type],
      exam_relevance: contentClassification.exam_relevance,
    };
    console.log(`Content summary: ${contentSummary.material_count} materials, has_past_paper: ${contentSummary.has_past_paper}`);

    // 6.6 Fetch User Personalization (Pet Name, Education, Age)
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

    console.log(`User Persona: ${educationLevel} (${ageBracket}), Pet: ${petName}, Goal: ${studyGoal}`);

    // 7. Delete any existing failed records for this notebook (to avoid UNIQUE constraint violation)
    await supabase
      .from('audio_overviews')
      .delete()
      .eq('notebook_id', notebook_id)
      .eq('status', 'failed');

    // 8. Find the next available version number
    const { data: existingVersions } = await supabase
      .from('audio_overviews')
      .select('version')
      .eq('notebook_id', notebook_id)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existingVersions && existingVersions.length > 0
      ? (existingVersions[0].version || 1) + 1
      : 1;

    // 9. Create audio_overviews record (status='generating_script')
    const { data: overview, error: createError } = await supabase
      .from('audio_overviews')
      .insert({
        notebook_id,
        user_id: user.id,
        title: `${notebook.title} - Podcast`,
        duration: 0, // Will be updated after generation
        storage_path: '', // Will be updated after upload
        script: '', // Will be updated after generation
        status: 'generating_script',
        version: nextVersion,
      })
      .select()
      .single();

    if (createError || !overview) {
      console.error('Failed to create podcast record:', createError);
      return new Response(
        JSON.stringify({
          error: 'Failed to create podcast record',
          details: createError?.message || 'Unknown error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Created podcast record: ${overview.id} (version ${nextVersion})`);

    // 10. TRIGGER ASYNCHRONOUS GENERATION
    // We move the heavy lifting to a background promise so we can return to the client immediately
    const backgroundTask = (async () => {
      try {
        // A. GENERATE SCRIPT (Gemini 2.5 Pro - two-stage, with content classification and summary)
        let scriptResult;
        try {
          scriptResult = await generatePodcastScript({
            materialContent: material.content,
            notebookTitle: notebook.title,
            materialKind: material.kind,
            petName: petName,
            educationLevel: educationLevel,
            ageBracket: ageBracket,
            studyGoal: studyGoal,
            contentClassification: contentClassification,
            contentSummary: contentSummary,
            sourceCount: sourceCount,
          });

          // Validate script
          const validation = validateScript(scriptResult.script);
          if (!validation.valid) {
            throw new Error(`Invalid script: ${validation.errors.join(', ')}`);
          }

          console.log(`[Background] Script generated: ${scriptResult.wordCount} words`);

          // Update record with script
          await supabase
            .from('audio_overviews')
            .update({
              script: scriptResult.script,
              llm_tokens: scriptResult.llmTokens,
              status: 'generating_audio',
            })
            .eq('id', overview.id);

        } catch (error: any) {
          console.error('[Background] Script generation failed:', error);

          // Report to Sentry before marking as failed
          await captureException(error, {
            user_id: user?.id,
            notebook_id,
            overview_id: overview.id,
            operation: 'generate-audio-script'
          });

          await supabase
            .from('audio_overviews')
            .update({
              status: 'failed',
              error_message: `Script generation failed: ${error.message}`,
            })
            .eq('id', overview.id);
          return;
        }

        // B. GENERATE AUDIO (Gemini 2.5 Flash TTS)
        let audioResult;
        try {
          audioResult = await generatePodcastAudioWithRetry({
            script: scriptResult.script,
            speakerMap: scriptResult.speakerMap,
          });

          console.log(`[Background] Audio generated: ${audioResult.audioBytes.length} bytes`);

        } catch (error: any) {
          console.error('[Background] Audio generation failed:', error);

          // Report to Sentry before marking as failed
          await captureException(error, {
            user_id: user?.id,
            notebook_id,
            overview_id: overview.id,
            operation: 'generate-audio-tts'
          });

          await supabase
            .from('audio_overviews')
            .update({
              status: 'failed',
              error_message: `Audio generation failed: ${error.message}`,
            })
            .eq('id', overview.id);
          return;
        }

        // C. UPLOAD TO STORAGE
        const mimeToExtension: Record<string, string> = {
          'audio/wav': 'wav',
          'audio/wave': 'wav',
          'audio/x-wav': 'wav',
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'audio/L16': 'wav',
        };
        const fileExtension = mimeToExtension[audioResult.mimeType] || 'wav';
        const contentType = audioResult.mimeType.startsWith('audio/L16') ? 'audio/wav' : audioResult.mimeType;
        const storagePath = `${user.id}/audio_overviews/${notebook_id}/${overview.id}.${fileExtension}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(storagePath, audioResult.audioBytes, {
              contentType: contentType,
              upsert: false,
            });

          if (uploadError) throw new Error(uploadError.message);
          console.log(`[Background] Uploaded to storage: ${storagePath}`);
        } catch (error: any) {
          console.error('[Background] Storage upload failed:', error);

          // Report to Sentry before marking as failed
          await captureException(error, {
            user_id: user?.id,
            notebook_id,
            overview_id: overview.id,
            operation: 'generate-audio-storage-upload'
          });

          await supabase
            .from('audio_overviews')
            .update({
              status: 'failed',
              error_message: `Storage upload failed: ${error.message}`,
            })
            .eq('id', overview.id);
          return;
        }

        // D. GENERATE SIGNED URL
        const { data: signedUrlData } = await supabase.storage
          .from('uploads')
          .createSignedUrl(storagePath, 7 * 24 * 3600);

        const audioUrl = signedUrlData?.signedUrl || null;

        // E. COMPLETE: Update record with final data
        const actualDuration =
          typeof audioResult.durationSeconds === 'number' && !Number.isNaN(audioResult.durationSeconds)
            ? Math.max(1, Math.round(audioResult.durationSeconds * 10) / 10)
            : getAudioDuration(audioResult.audioBytes);

        const ttsCostCents = Math.ceil((audioResult.audioTokens / 1000) * 10);
        const totalCostCents = scriptResult.costCents + ttsCostCents;

        await supabase
          .from('audio_overviews')
          .update({
            status: 'completed',
            duration: actualDuration,
            storage_path: storagePath,
            audio_url: audioUrl,
            file_size_bytes: audioResult.audioBytes.length,
            tts_audio_tokens: audioResult.audioTokens,
            generation_cost_cents: totalCostCents,
            completed_at: new Date().toISOString(),
          })
          .eq('id', overview.id);

        console.log(`[Background] Podcast completed: ${overview.id}`);

        // F. INCREMENT QUOTA & LOG USAGE
        await Promise.all([
          incrementQuota(supabase, user.id, 'audio'),
          supabase.from('usage_logs').insert({
            user_id: user.id,
            notebook_id,
            job_type: 'audio',
            model_used: 'gemini-2.0-flash-tts',
            input_tokens: scriptResult.llmTokens,
            output_tokens: audioResult.audioTokens,
            total_tokens: scriptResult.llmTokens + audioResult.audioTokens,
            estimated_cost_cents: totalCostCents,
            status: 'success',
          })
        ]);

      } catch (globalError: any) {
        console.error('[Background] Critical failure:', globalError);

        // Capture background error in Sentry
        await captureException(globalError, {
          user_id: user?.id,
          notebook_id,
          operation: 'generate-audio-overview-background'
        });

        try {
          await supabase.from('usage_logs').insert({
            user_id: user.id,
            job_type: 'audio',
            status: 'error',
            error_message: globalError.message,
          });
        } catch (logError) {
          console.error('[Background] Could not log global error:', logError);
        }
      }
    })();

    // 11. WAIT UNTIL (Ensures the promise continues after response is sent)
    // @ts-ignore: EdgeRuntime is available in Supabase environment
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundTask);
    }

    // 12. RETURN IMMEDIATELY
    // The client will get this within ~1-2 seconds and start polling the record status
    return new Response(
      JSON.stringify({
        success: true,
        overview_id: overview.id,
        status: 'generating_script',
        message: 'Podcast generation started in background',
        estimated_completion_seconds: 120, // Give user a rough idea
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Initial error starting podcast:', error);

    // Capture error in Sentry
    await captureException(error, {
      user_id: user?.id,
      notebook_id,
      operation: 'generate-audio-overview-initial'
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
