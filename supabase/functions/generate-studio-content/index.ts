/**
 * Generate Studio Content Edge Function
 * Generates flashcards or quiz questions from material content using Grok 4.1 Fast
 */

import { createClient } from 'supabase';
import { callLLMWithRetry } from '../_shared/openrouter.ts';
import { checkQuota, incrementQuota } from '../_shared/quota.ts';
import { getRequiredEnv, getOptionalEnv } from '../_shared/env.ts';
import { getCorsHeaders, getCorsPreflightHeaders } from '../_shared/cors.ts';
import { checkRateLimit, RATE_LIMITS } from '../_shared/ratelimit.ts';
import { validateUUID, validateContentType } from '../_shared/validation.ts';
import { sanitizeForLLM, sanitizeTitle, createSafeContext } from '../_shared/sanitization.ts';
import { validateFlashcardsResponse, validateQuizResponse } from '../_shared/llm-validation.ts';
import { initSentry, captureException, setUser } from '../_shared/sentry.ts';
import { sendGenerationReadyPush } from '../_shared/push.ts';

// Initialize Sentry
initSentry();

interface GenerateStudioRequest {
  notebook_id: string;
  content_type: 'flashcards' | 'quiz';
}

interface GenerateStudioResponse {
  success: boolean;
  notebook_id: string;
  content_type: string;
  generated_count: number;
  content_id?: string; // quiz_id for quizzes
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

    // 3. Parse and validate request
    const body: GenerateStudioRequest = await req.json();
    notebook_id = body.notebook_id;
    content_type = body.content_type;

    // Validate notebook_id
    const notebookIdValidation = validateUUID(notebook_id, 'notebook_id');
    if (!notebookIdValidation.isValid) {
      return new Response(
        JSON.stringify({ error: notebookIdValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate content_type (case-insensitive)
    const contentTypeValidation = validateContentType(content_type);
    if (!contentTypeValidation.isValid) {
      return new Response(
        JSON.stringify({ error: contentTypeValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedContentType = contentTypeValidation.sanitized as 'flashcards' | 'quiz';

    console.log(`Generating ${sanitizedContentType} for notebook ${notebook_id}`);

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
      endpoint: 'generate-studio-content',
    });

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests. Please wait before generating more content.',
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

    // 5. CHECK QUOTA (free users: blocked, premium users: unlimited)
    const quotaCheck = await checkQuota(supabase, user.id, 'studio');
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

    // Use the first material's meta for classification as a base
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

    // 6.6 Extract content summary for multi-material awareness
    const contentSummary = (notebook.meta as any)?.content_summary || {
      material_count: 1,
      has_past_paper: contentClassification.type === 'past_paper',
      has_notes: contentClassification.type === 'lecture_notes' || contentClassification.type === 'textbook_chapter',
      material_types: [contentClassification.type],
      exam_relevance: contentClassification.exam_relevance,
    };
    console.log(`Content summary: ${contentSummary.material_count} materials, has_past_paper: ${contentSummary.has_past_paper}, has_notes: ${contentSummary.has_notes}`);

    // 6.7 Fetch User Personalization (Education, Age)
    const { data: profile } = await supabase
      .from('profiles')
      .select('meta')
      .eq('id', user.id)
      .single();

    const educationLevel = (profile?.meta as any)?.education_level || 'lifelong';
    const ageBracket = (profile?.meta as any)?.age_bracket || '25_34';
    const studyGoal = (profile?.meta as any)?.study_goal || 'all';

    console.log(`User Persona: ${educationLevel} (${ageBracket}), Goal: ${studyGoal}`);

    // 7. Calculate dynamic quantity based on word count
    const wordCount = material.content.split(/\s+/).length;
    // Increased density and capacity (Free: ~50 cards max, ~20 quiz max)
    const quantity = sanitizedContentType === 'flashcards'
      ? Math.max(10, Math.min(50, Math.floor(wordCount / 200)))
      : Math.max(5, Math.min(20, Math.floor(wordCount / 300)));

    console.log(`Calculated quantity: ${quantity} ${sanitizedContentType} (${wordCount} words)`);

    // 7.5. Sanitize notebook title and material content before LLM
    const sanitizedNotebookTitle = sanitizeTitle(notebook.title, 100);
    const sanitizedMaterialContent = sanitizeForLLM(material.content, {
      maxLength: 200000, // Keep existing window but sanitize
      preserveNewlines: true,
    });

    // 8. Generate content via LLM (with content classification, summary, study goal, and source count)
    const systemPrompt = getSystemPrompt(sanitizedContentType, quantity, educationLevel, ageBracket, contentClassification, contentSummary, studyGoal, sourceCount);
    const userPrompt = getUserPrompt(sanitizedContentType, quantity, sanitizedNotebookTitle, sanitizedMaterialContent, sourceCount);

    console.log('Calling LLM...');
    const llmResult = await callLLMWithRetry(
      'studio',
      systemPrompt,
      userPrompt,
      { temperature: sanitizedContentType === 'flashcards' ? 0.7 : 0.5 }
    );

    console.log(`LLM response received. Tokens: ${llmResult.usage.totalTokens}, Cost: ${llmResult.costCents}¢`);

    // 9. Parse and validate JSON (with markdown stripping and comprehensive validation)
    let parsed: any;
    try {
      let jsonContent = llmResult.content;

      // Strip markdown code blocks if present (LLMs sometimes wrap JSON in ```json ... ```)
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      parsed = JSON.parse(jsonContent.trim());
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', parseError);
      console.error('LLM response:', llmResult.content.substring(0, 500));
      throw new Error('Invalid JSON response from LLM');
    }

    // 9.5. Validate LLM response structure and content
    let validationResult;
    if (sanitizedContentType === 'flashcards') {
      validationResult = validateFlashcardsResponse(parsed, quantity);
    } else {
      validationResult = validateQuizResponse(parsed, quantity);
    }

    if (!validationResult.isValid) {
      console.error('LLM response validation failed:', validationResult.error);
      throw new Error(`Invalid ${sanitizedContentType} response: ${validationResult.error}`);
    }

    // Use sanitized/validated data
    parsed = validationResult.sanitized;

    // 10. Insert into database
    let generatedCount = 0;
    let contentId: string | undefined;

    if (sanitizedContentType === 'flashcards') {

      // Create a new flashcard set/deck
      const { count } = await supabase
        .from('studio_flashcard_sets')
        .select('id', { count: 'exact', head: true })
        .eq('notebook_id', notebook_id);

      const setNumber = (count || 0) + 1;
      const { data: set, error: setError } = await supabase
        .from('studio_flashcard_sets')
        .insert({
          notebook_id,
          title: parsed.title || `${notebook.title} Flashcards ${setNumber}`,
        })
        .select()
        .single();

      if (setError || !set) {
        console.error('Failed to create flashcard set:', setError);
        throw new Error(`Database error: ${setError?.message || 'Failed to create set'}`);
      }

      contentId = set.id;

      const { data: inserted, error: insertError } = await supabase
        .from('studio_flashcards')
        .insert(
          parsed.flashcards.map((fc: any) => ({
            notebook_id,
            set_id: set.id,
            question: fc.question,
            answer: fc.answer,
            explanation: fc.explanation || null,
            tags: fc.tags || [],
          }))
        )
        .select();

      if (insertError) {
        console.error('Failed to insert flashcards:', insertError);
        // Clean up orphaned set
        await supabase.from('studio_flashcard_sets').delete().eq('id', set.id);
        throw new Error(`Database error: ${insertError.message}`);
      }

      generatedCount = inserted?.length || 0;
      console.log(`Inserted ${generatedCount} flashcards into set ${set.id}`);
    } else {
      // Quiz generation
      if (!parsed.quiz || !parsed.quiz.questions || !Array.isArray(parsed.quiz.questions)) {
        throw new Error('Invalid quiz response structure');
      }

      // Validate explanations structure
      for (const q of parsed.quiz.questions) {
        if (q.explanations) {
          const keys = Object.keys(q.explanations);
          if (!keys.includes('A') || !keys.includes('B') ||
            !keys.includes('C') || !keys.includes('D')) {
            console.warn(`Question missing explanation keys: ${q.question.substring(0, 50)}...`);
            // Set to null if incomplete rather than failing
            q.explanations = null;
          }
        }
      }

      // Rebalance options to avoid all correct answers on the same letter
      const balancedQuestions = rebalanceQuizQuestions(parsed.quiz.questions);

      // Insert quiz metadata
      const { data: quiz, error: quizError } = await supabase
        .from('studio_quizzes')
        .insert({
          notebook_id,
          title: parsed.quiz.title || `${notebook.title} Quiz`,
          total_questions: balancedQuestions.length,
        })
        .select()
        .single();

      if (quizError || !quiz) {
        console.error('Failed to insert quiz:', quizError);
        throw new Error(`Database error: ${quizError?.message || 'Failed to create quiz'}`);
      }

      contentId = quiz.id;
      console.log(`Created quiz: ${contentId}`);

      // Insert quiz questions
      const { error: questionsError } = await supabase
        .from('studio_quiz_questions')
        .insert(
          balancedQuestions.map((q: any, idx: number) => ({
            quiz_id: quiz.id,
            question: q.question,
            options: q.options,
            correct_answer: q.correct,
            hint: q.hint || null,
            explanation: null,
            explanations: q.explanations || null,
            display_order: idx,
          }))
        );

      if (questionsError) {
        console.error('Failed to insert quiz questions:', questionsError);
        // Clean up orphaned quiz to prevent partial failure
        await supabase.from('studio_quizzes').delete().eq('id', quiz.id);
        console.log(`Cleaned up orphaned quiz: ${quiz.id}`);
        throw new Error(`Database error: ${questionsError.message}`);
      }

      generatedCount = parsed.quiz.questions.length;
      console.log(`Inserted ${generatedCount} quiz questions`);
    }

    // 11. PUSH NOTIFICATION (fire-and-forget)
    const pushConfig = sanitizedContentType === 'flashcards'
      ? {
          contentType: 'flashcards' as const,
          title: 'Flashcards ready',
          body: `${generatedCount} flashcards ready for "${notebook.title}".`,
          data: { notebookId: notebook_id, setId: contentId },
        }
      : {
          contentType: 'quiz' as const,
          title: 'Quiz ready',
          body: `"${notebook.title}" is ready for testing.`,
          data: { quizId: contentId, notebookId: notebook_id },
        };
    sendGenerationReadyPush({ supabase, userId: user.id, ...pushConfig })
      .catch((e) => console.error('Push send failed:', e));

    // 12. INCREMENT QUOTA (atomic)
    await incrementQuota(supabase, user.id, 'studio');
    console.log('Quota incremented');

    // 13. LOG USAGE
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

    console.log('Usage logged');

    // 14. Return success
    const response: GenerateStudioResponse = {
      success: true,
      notebook_id,
      content_type: sanitizedContentType,
      generated_count: generatedCount,
      content_id: contentId,
      message: `Successfully generated ${generatedCount} ${sanitizedContentType}`,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error generating studio content:', error);

    // Capture error in Sentry
    await captureException(error, {
      user_id: user?.id,
      notebook_id,
      content_type,
      operation: 'generate-studio-content'
    });

    // Log failed attempt
    try {
      const supabaseUrl = getRequiredEnv('SUPABASE_URL');
      const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from('usage_logs').insert({
        user_id: null, // May not have user context at this point
        job_type: 'studio',
        status: 'error',
        error_message: error.message,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

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
 * Content classification interface for type safety
 */
interface ContentClassification {
  type: 'past_paper' | 'lecture_notes' | 'textbook_chapter' | 'article' | 'video_transcript' | 'general';
  exam_relevance: 'high' | 'medium' | 'low';
  detected_format: 'multiple_choice' | 'short_answer' | 'essay' | 'mixed' | null;
  subject_area: string | null;
}

/**
 * Content summary interface for multi-material awareness
 */
interface ContentSummary {
  material_count: number;
  has_past_paper: boolean;
  has_notes: boolean;
  has_video?: boolean;
  material_types: string[];
  exam_relevance: 'high' | 'medium' | 'low';
  primary_subject?: string;
}

/**
 * Get system prompt for LLM based on content type, classification, summary, and study goal
 */
function getSystemPrompt(
  contentType: string,
  count: number,
  educationLevel: string,
  ageBracket: string,
  contentClassification?: ContentClassification,
  contentSummary?: ContentSummary,
  studyGoal: 'exam_prep' | 'retention' | 'quick_review' | 'all' = 'all',
  sourceCount: number = 1
): string {
  const isPastPaper = contentClassification?.type === 'past_paper';
  const subjectArea = contentClassification?.subject_area || contentSummary?.primary_subject || 'this subject';
  const examFormat = contentClassification?.detected_format;
  const examRelevance = contentSummary?.exam_relevance || contentClassification?.exam_relevance || 'medium';

  // Multi-material mode: notebook has multiple sources
  const isMultiMaterial = sourceCount > 1 || (contentSummary && contentSummary.material_count > 1);
  const hasMixedContent = contentSummary?.has_past_paper && contentSummary?.has_notes;

  // HYBRID MODE LOGIC: Combine user goal with content classification
  const isExamMode = studyGoal === 'exam_prep' || (studyGoal !== 'retention' && studyGoal !== 'quick_review' && (isPastPaper || examRelevance === 'high'));
  const isLearningMode = studyGoal === 'retention' && examRelevance !== 'high';
  const isQuickMode = studyGoal === 'quick_review';

  // Build context-aware instructions based on hybrid mode
  let contextInstructions = '';
  let explanationStyle = 'Why this matters for exams';
  let titlePrefix = 'Study';

  if (hasMixedContent) {
    titlePrefix = 'Exam Prep';
    contextInstructions = `
MULTI-SOURCE MODE:
This notebook contains BOTH study notes AND a past paper.
- Use the notes to understand core concepts
- Use the past paper to identify what examiners test
- Generate content that bridges both: explain concepts in exam-ready format
- Pay attention to exam patterns from the past paper`;
  } else if (isExamMode) {
    titlePrefix = isPastPaper ? 'Past Paper Review' : 'Exam Prep';
    explanationStyle = 'Why this matters for exams';
    if (isPastPaper || contentSummary?.has_past_paper) {
      contextInstructions = `
PAST PAPER MODE:
- This material contains actual exam questions from ${subjectArea}
- Extract and adapt the real exam questions as study material
- Generate questions in the SAME STYLE and FORMAT as the source exam
- Note which topics are being tested by the examiner
${examFormat ? `- Match the detected format: ${examFormat}` : ''}`;
    } else {
      contextInstructions = `
EXAM PREP MODE:
- Focus on content likely to be tested
- Highlight exam-relevant concepts and common pitfalls
- Include exam technique tips where relevant`;
    }
  } else if (isLearningMode) {
    titlePrefix = 'Learn';
    explanationStyle = 'Why this matters (in real life)';
    contextInstructions = `
LEARNING MODE:
- Focus on deep understanding and long-term retention
- Emphasize real-world applications and connections
- Use memorable analogies and examples
- AVOID exam-focused language - focus on understanding`;
  } else if (isQuickMode) {
    titlePrefix = 'Quick Review';
    explanationStyle = 'Key takeaway';
    contextInstructions = `
QUICK REFRESH MODE:
- Focus on the most critical concepts only
- Be concise and direct
- Prioritize high-impact information
- Use memory hooks and quick tips`;
  } else {
    // Balanced mode
    titlePrefix = 'Study';
    explanationStyle = 'Why this matters';
    contextInstructions = `
BALANCED MODE:
- Create well-rounded study material
- Mix conceptual understanding with practical application`;
  }

  if (contentType === 'flashcards') {
    return `You are Brigo, an AI Study Coach.

Your task: Create exactly ${count} flashcards from the provided material.

USER CONTEXT:
- Education Level: ${educationLevel}
- Age Group: ${ageBracket}
- Subject: ${subjectArea}
- Study Goal: ${studyGoal === 'exam_prep' ? 'Preparing for exams' : studyGoal === 'retention' ? 'Long-term learning' : studyGoal === 'quick_review' ? 'Quick refresh' : 'General study'}
${isMultiMaterial ? `- Sources: ${contentSummary.material_count} materials (${contentSummary.material_types.join(', ')})` : ''}
${contextInstructions}

OUTPUT FORMAT (JSON only):
{
  "title": "${titlePrefix}: [Topic]",
  "flashcards": [
    {
      "question": "Clear, specific question",
      "answer": "Concise answer (2 sentences max)",
      "explanation": "${explanationStyle}"
    }
  ]
}

GENERATION RULES:
1. Create a balanced difficulty distribution:
   - 40% Easy: Direct recall questions
   - 40% Medium: Application questions
   - 20% Hard: Synthesis questions connecting concepts
2. Tailor complexity for ${educationLevel} students
3. The final flashcard MUST be a synthesis question combining major concepts
${isExamMode ? '4. Focus on high-yield content likely to appear on exams' : isLearningMode ? '4. Focus on building deep understanding and connections' : '4. Balance exam relevance with conceptual understanding'}
${hasMixedContent ? '5. Extract patterns from past paper, explain concepts from notes\n6. Bridge theoretical knowledge with exam-style testing' : isPastPaper && isExamMode ? '5. Extract actual exam questions and rephrase them as flashcards\n6. Include questions that test the same skills as the original exam' : ''}

VOICE GUIDELINES:
- AVOID formal phrases: "according to the material", "based on the reading", "as stated in the text"
- Ask questions directly and conversationally
- Brigo is a friendly study coach, not a formal examiner
- Exception: Use "in your notes" only if testing a definition specific to that material

CRITICAL: Generate EXACTLY ${count} flashcards.`;
  } else {
    return `You are Brigo, an AI Study Coach.

Your task: Create a ${count}-question quiz from the provided material.

USER CONTEXT:
- Education Level: ${educationLevel}
- Age Group: ${ageBracket}
- Subject: ${subjectArea}
- Study Goal: ${studyGoal === 'exam_prep' ? 'Preparing for exams' : studyGoal === 'retention' ? 'Long-term learning' : studyGoal === 'quick_review' ? 'Quick refresh' : 'General study'}
${isMultiMaterial ? `- Sources: ${contentSummary.material_count} materials (${contentSummary.material_types.join(', ')})` : ''}
${contextInstructions}

OUTPUT FORMAT (JSON only):
{
  "quiz": {
    "title": "${titlePrefix}: [Topic]",
    "questions": [
      {
        "question": "Clear question text",
        "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
        "correct": "A",
        "hint": "Study tip if stuck",
        "explanations": {
          "A": "Why correct/incorrect",
          "B": "...", "C": "...", "D": "..."
        }
      }
    ]
  }
}

GENERATION RULES:
1. Structure the quiz with a difficulty progression:
   - First 30%: Knowledge recall (definitions, facts)
   - Middle 40%: Application (case studies, scenarios)
   - Final 30%: Synthesis (connecting concepts)
${isExamMode ? '2. Include 1 "common mistake" question testing exam pitfalls' : '2. Include 1 "tricky concept" question testing common misunderstandings'}
3. Tailor difficulty for ${educationLevel} students
4. The final question MUST be the hardest, tying concepts together
5. Explanations should teach, not just justify the answer
${hasMixedContent ? '6. Match question style to past paper format\n7. Test concepts explained in the notes using exam patterns' : isPastPaper && isExamMode ? '6. Match the style and format of the original exam questions\n7. Include questions that test the exact same concepts as the past paper' : ''}

VOICE GUIDELINES:
- AVOID formal phrases: "according to the material", "based on the reading", "as stated in the text", "the passage mentions"
- Ask questions directly and conversationally
- Brigo is a friendly study coach, not a standardized test
- Write like you're quizzing a friend, not administering an exam

CRITICAL: Generate EXACTLY ${count} questions.`;
  }
}

/**
 * Get user prompt with material content
 */
function getUserPrompt(
  contentType: string,
  count: number,
  notebookTitle: string,
  materialContent: string,
  sourceCount: number = 1
): string {
  if (contentType === 'flashcards') {
    return `Generate ${count} flashcards from ${sourceCount > 1 ? `these ${sourceCount} study sources` : 'this study material'}.

Material Title: ${notebookTitle}

${sourceCount > 1 ? 'Sources Context' : 'Material Content'}:
${materialContent}

${sourceCount > 1 ? `Analyze content from all ${sourceCount} sources, identify key topics across sources, and ` : ''}Generate exactly ${count} flashcards covering all major topics. Return ONLY the JSON response, no other text.`;
  } else {
    return `Generate a ${count}-question quiz from ${sourceCount > 1 ? `these ${sourceCount} study sources` : 'this study material'}.

Material Title: ${notebookTitle}

${sourceCount > 1 ? 'Sources Context' : 'Material Content'}:
${materialContent}

${sourceCount > 1 ? `Analyze content from all ${sourceCount} sources, identify recurring topics, and ` : ''}Generate exactly ${count} quiz questions covering all major topics. Return ONLY the JSON response, no other text.`;
  }
}

/**
 * Shuffle options per question and avoid all correct answers sharing the same letter.
 * Preserves option/explanation pairing and remaps the correct letter accordingly.
 */
function rebalanceQuizQuestions(questions: any[]): any[] {
  const LETTERS = ['A', 'B', 'C', 'D'] as const;

  const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  let attempt = 0;
  const maxAttempts = 5;
  let result: any[] = [];

  do {
    attempt++;
    result = questions.map((q: any) => {
      const entries = LETTERS.map((key) => ({
        key,
        text: q.options?.[key],
        explanation: q.explanations ? q.explanations[key] : undefined,
        isCorrect: q.correct === key,
      }));

      const shuffled = shuffle(entries);
      const newOptions: Record<string, string> = {};
      const newExplanations: Record<string, string> | null = q.explanations ? {} : null;
      let newCorrect = 'A';

      shuffled.forEach((entry, idx) => {
        const newKey = LETTERS[idx];
        newOptions[newKey] = entry.text;
        if (newExplanations) {
          newExplanations[newKey] = entry.explanation ?? '';
        }
        if (entry.isCorrect) {
          newCorrect = newKey;
        }
      });

      return {
        ...q,
        options: newOptions,
        correct: newCorrect,
        explanations: q.explanations ? newExplanations : null,
      };
    });
  } while (
    attempt < maxAttempts &&
    result.length > 0 &&
    result.every((q) => q.correct === result[0].correct)
  );

  return result;
}
