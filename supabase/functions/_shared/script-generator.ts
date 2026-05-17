/**
 * Podcast Script Generator using Gemini 2.5 Flash via OpenRouter
 * Two-stage process:
 *   1. Extract key insights from material (Gemini 2.5 Flash)
 *   2. Generate Dialogue script (Brigo & Pet) (Gemini 2.5 Flash)
 */

import { callLLMWithRetry } from './openrouter.ts';

export interface ScriptGenerationConfig {
  materialContent: string; // Full extracted text from material
  notebookTitle: string; // Title of the notebook
  materialKind?: string; // Type of material (pdf, website, youtube, etc.)
  targetDurationMinutes?: number; // Target audio duration (2-5 minutes for now)
  petName?: string; // Optional pet name (default: "Nova")
  educationLevel?: string; // User education level
  ageBracket?: string; // User age bracket
  studyGoal?: 'exam_prep' | 'retention' | 'quick_review' | 'all'; // User's study intent
  contentClassification?: { // Content type classification from AI
    type: 'past_paper' | 'lecture_notes' | 'textbook_chapter' | 'article' | 'video_transcript' | 'general';
    exam_relevance: 'high' | 'medium' | 'low';
    detected_format: 'multiple_choice' | 'short_answer' | 'essay' | 'mixed' | null;
    subject_area: string | null;
  };
  contentSummary?: { // Multi-material awareness
    material_count: number;
    has_past_paper: boolean;
    has_notes: boolean;
    has_video?: boolean;
    material_types: string[];
    exam_relevance: 'high' | 'medium' | 'low';
    primary_subject?: string;
  };
  sourceCount?: number; // Number of sources being analyzed
}

export interface GeneratedScript {
  script: string; // Full dialogue with speaker labels
  keyInsights: string[]; // Key points extracted (for reference)
  wordCount: number;
  estimatedMinutes: number;
  llmTokens: number; // Total tokens used
  costCents: number; // Estimated cost
  speakerMap: Record<string, string>; // Map speaker names to voices
}

/**
 * Calculate target word count based on material complexity and duration constraints.
 * Optimized for Free Tier stability and premium pacing.
 */
function calculateTargetWordCount(materialContent: string): number {
  const charCount = materialContent.length;
  const wordCount = materialContent.split(/\s+/).length;

  // PREMIUM LOGIC: Scale based on chars to capture density.
  // min 400 words (2.5min), max 1000 words (6min) for now (to avoid timeouts)
  const targetWords = Math.max(400, Math.min(1000, Math.floor(charCount / 20)));

  const estimatedMinutes = targetWords / 160; // Natural podcast pace

  console.log(`[Script Generator] Material: ${wordCount} words (${charCount} chars) → Target: ${estimatedMinutes.toFixed(1)}min (${targetWords} words)`);

  return targetWords;
}

/**
 * Maps database keys to rich persona descriptions for the LLM
 */
function getPersonaGuide(educationLevel: string, ageBracket: string): string {
  const eduMap: Record<string, string> = {
    'middle_school': 'User is a young student. Simplify complex jargon into high-relatability analogies. Avoid being condescending.',
    'high_school': 'User is a teenager prepping for exams. Focus on clear concepts, memory anchors, and "why this matters" for grades/life.',
    'middle_high': 'User is a middle or high school student prepping for exams. Focus on clear concepts, memory anchors, and "why this matters" for grades/life. Keep jargon accessible.',
    'undergrad': 'User is an academic focused on deep retention. Use rigorous logic. Connect insights to research or "exam pitfalls".',
    'college': 'User is a college or university student. Use rigorous, course-appropriate terminology. Connect insights to coursework, research, and exam patterns. Treat them as a serious academic.',
    'grad_school': 'User is a specialist. Use sophisticated terminology. Focus on nuance, high-level synthesis, and theory-to-practice.',
    'professional': 'User is a high-performer. Focus on ROI, strategic application, and efficiency. Use workplace/growth analogies.',
    'lifelong': 'User is learning for pleasure. Focus on the beauty of the concept and historical/global context. Keep it sophisticated and conversational.'
  };

  const ageMap: Record<string, string> = {
    'under_18': 'TONE: Gen Z / Chronically Online. Vibe is "FaceTime with a smart friend". Use slang structures (e.g. "lowkey", "it\'s giving", "main character energy") authentically. Avoid "cringe" by not overdoing it.',
    '18_24': 'TONE: Contemporary/Student. High energy, relatable, and authentic. Use modern analogies (digital culture, social media). Pacing should be fast and punchy.',
    '25_34': 'TONE: Balanced/Professional. High-end educational podcast vibe (like "Hidden Brain"). Sophisticated but accessible. Pacing is natural.',
    '35_44': 'TONE: Established/Executive. Professional masterclass vibe. Focus on depth and maturity. Use business or parenting analogies.',
    '45_plus': 'TONE: Sophisticated/Thoughtful. Measured pacing. Focus on wisdom, legacy, and broader world impact. Masterclass/Executive briefing vibe.'
  };

  const eduGuide = eduMap[educationLevel] || eduMap['lifelong'];
  const ageGuide = ageMap[ageBracket] || ageMap['25_34'];

  return `USER PERSONA:\n- LEVEL: ${eduGuide}\n- STYLE: ${ageGuide}`;
}

/**
 * Stage 1: Extract key insights from material using Gemini 2.5 Flash
 */
async function extractKeyInsights(
  materialContent: string,
  notebookTitle: string,
  educationLevel: string = 'lifelong'
): Promise<{ insights: string[]; tokens: number }> {
  console.log('[Script Generator] Stage 1: Extracting key insights via OpenRouter...');

  const systemPrompt = `You are an expert educational content analyst. Your task is to extract the most important insights from study material for an engaging podcast.

ADAPTIVITY RULE:
- For Professionals/Lifelong Learners: Prioritize strategic "big picture" insights and real-world ROI.
- For Students (Middle/High/Undergrad): Prioritize core definitions, common hurdles, and fundamental mechanisms.

Focus on:
1. Core concepts and definitions
2. Surprising or counterintuitive facts
3. Real-world applications and examples
4. Common misconceptions to clarify
5. Connections to broader topics

Extract 5-7 key insights that cover the full scope of the material.`;

  // Truncate material to keep script generation efficient.
  const truncatedMaterial = materialContent.substring(0, 50000);

  const userPrompt = `Material Title: ${notebookTitle}
User Level: ${educationLevel}

Material Content:
${truncatedMaterial}

Extract 5-7 key insights as clean, conversational statements (NOT numbered, NOT prefixed with "Insight").
Return ONLY a JSON object:
{
  "insights": [
    "The main concept here is...",
    "What's surprising is...",
    "This connects to...",
    ...
  ]
}`;

  try {
    const response = await callLLMWithRetry(
      'audio_script',
      systemPrompt,
      userPrompt,
      { temperature: 0.7 }
    );

    const content = response.content.trim();
    const tokens = response.usage.totalTokens;

    // Extract JSON from response (handle markdown code blocks)
    let jsonString = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonString = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonString);
    console.log(`[Script Generator] Extracted ${parsed.insights.length} insights (${tokens} tokens)`);
    return { insights: parsed.insights, tokens };
  } catch (error: any) {
    console.error('[Script Generator] Stage 1 failed:', error);
    throw new Error(`Failed to extract insights: ${error.message}`);
  }
}

/**
 * Stage 2: Generate Dialogue Script (Brigo & Pet)
 */
async function generateDialogueScript(
  insights: string[],
  notebookTitle: string,
  targetWordCount: number,
  petName: string = 'Nova',
  materialKind?: string,
  educationLevel: string = 'lifelong',
  ageBracket: string = '25_34',
  contentClassification?: ScriptGenerationConfig['contentClassification'],
  contentSummary?: ScriptGenerationConfig['contentSummary'],
  studyGoal?: ScriptGenerationConfig['studyGoal'],
  sourceCount: number = 1
): Promise<{ script: string; tokens: number; speakerMap: Record<string, string> }> {
  console.log(`[Script Generator] Stage 2: Generating dialogue with Brigo and ${petName}...`);

  const brigoName = 'Brigo';
  const speakerMap = {
    [brigoName]: 'Charon',
    [petName]: 'Puck'
  };

  const personaGuide = getPersonaGuide(educationLevel, ageBracket);
  const kindDescriptor = materialKind ? `the ${materialKind}` : 'the material';
  const isPastPaper = contentClassification?.type === 'past_paper' || contentSummary?.has_past_paper;
  const hasMixedContent = contentSummary?.has_past_paper && contentSummary?.has_notes;
  const isMultiSource = sourceCount > 1;
  const subjectArea = contentClassification?.subject_area || contentSummary?.primary_subject || 'this subject';
  const examRelevance = contentSummary?.exam_relevance || contentClassification?.exam_relevance || 'medium';

  // HYBRID MODE LOGIC: Combine user goal with content classification
  // exam_prep always → exam mode
  // retention + high relevance → exam-aware learning
  // retention + low relevance → pure learning
  // quick_review → quick tips mode
  // all/default → content-based decision
  const isExamMode = studyGoal === 'exam_prep' || (studyGoal !== 'retention' && studyGoal !== 'quick_review' && (isPastPaper || examRelevance === 'high'));
  const isLearningMode = studyGoal === 'retention' && examRelevance !== 'high';
  const isQuickMode = studyGoal === 'quick_review';

  console.log(`[Script Generator] Mode: ${isExamMode ? 'EXAM' : isLearningMode ? 'LEARNING' : isQuickMode ? 'QUICK' : 'BALANCED'}`);

  // Adapt intro based on content type AND study goal
  let introRitual: string;
  if (isMultiSource && !hasMixedContent) {
    introRitual = `${brigoName}: Welcome back. I'm ${brigoName}, and ${petName} is here. Today we're covering ${notebookTitle} using ${sourceCount} different sources, so let's see what they all agree on and where they differ.`;
  } else if (hasMixedContent) {
    introRitual = `${brigoName}: Welcome back. I'm ${brigoName}, and ${petName} is here. Today we've got your notes AND a past paper on ${notebookTitle}, so let's connect the theory to what matters most.`;
  } else if (isPastPaper) {
    introRitual = `${brigoName}: Welcome back. I'm ${brigoName}, and ${petName} is here to help me walk you through this ${subjectArea} past paper.`;
  } else if (isQuickMode) {
    introRitual = `${brigoName}: Welcome back. Quick refresh on ${notebookTitle} coming up! ${petName}, let's hit the highlights.`;
  } else {
    introRitual = `${brigoName}: Welcome back. I'm ${brigoName}, and ${petName} is here to help me break down ${notebookTitle}.`;
  }

  // Content-aware instructions based on mode
  let modeInstructions = '';
  if (isMultiSource && !hasMixedContent) {
    modeInstructions = `
MULTI-SOURCE MODE:
- You're analyzing ${sourceCount} different sources on the same topic
- Look for themes that appear across multiple sources
- When sources agree: "All ${sourceCount} sources mention this..." or "This keeps coming up..."
- When sources differ: "Interestingly, one source emphasizes X while another focuses on Y..."
- Synthesize the key takeaways that emerge from combining these sources`;
  } else if (hasMixedContent) {
    modeInstructions = `
MULTI-SOURCE MODE:
- Bridge concepts from notes with exam patterns from the past paper
- For each topic: explain the concept, then show how it might be tested
- Point out: "In the past paper, they asked about this as..."`;
  } else if (isExamMode) {
    modeInstructions = `
EXAM PREP MODE:
- Focus on what's likely to be tested
- Include at least one "If this shows up on a test..." moment
- Point out common mistakes and exam pitfalls
- End with exam-specific study tips`;
  } else if (isLearningMode) {
    modeInstructions = `
LEARNING MODE:
- Focus on deep understanding and retention
- Emphasize "why this matters" in real life, not just tests
- Use memorable analogies and stories
- Connect to broader knowledge and applications
- AVOID exam-specific language unless naturally relevant`;
  } else if (isQuickMode) {
    modeInstructions = `
QUICK REFRESH MODE:
- Be concise and punchy
- Focus on the 3-4 most important takeaways
- Use memory hooks and quick tips
- Keep it fast-paced but friendly`;
  }

  const systemPrompt = `You are a podcast scriptwriter for Brigo, an AI Study Coach.

Two hosts discuss study material:
1. ${brigoName.toUpperCase()}: Knowledgeable, clear, friendly. Explains concepts with authority.
2. ${petName.toUpperCase()}: Curious, relatable. Asks clarifying questions and provides analogies.

${personaGuide}
${modeInstructions}

STRUCTURE:
- OPENING: "${introRitual}" followed by brief friendly banter
- BODY: Flow naturally through the key ideas (DO NOT say "First insight", "Second insight", etc.)
  - Brigo explains concepts conversationally
  - ${petName} adds analogies, asks questions, reacts naturally
- ENDING:
  - One key takeaway to remember
  - A memorable tip from ${petName}
  - Encouraging sign-off

CRITICAL RULES:
1. NEVER say "Insight 1", "Insight 2", "First insight", etc. - flow naturally!
2. Use natural transitions: "Speaking of...", "That reminds me...", "And here's the thing..."
3. Natural reactions: "Exactly!", "Wait, so...", "Oh interesting!"
4. Vary the pattern - don't make every exchange identical
5. ${isExamMode ? 'Mention exam relevance naturally.' : isLearningMode ? 'Focus on understanding, not exams.' : 'Keep it balanced and engaging.'}
6. Target: ${targetWordCount} words`;

  const userPrompt = `Topic: ${notebookTitle}

Key concepts to cover (weave these naturally into conversation):
${insights.map(insight => `• ${insight}`).join('\n')}

Generate a natural, engaging podcast script. Return ONLY the script with "${brigoName}:" and "${petName}:" labels.`;

  try {
    const response = await callLLMWithRetry(
      'audio_script',
      systemPrompt,
      userPrompt,
      { temperature: 0.85 }
    );

    const script = response.content;
    const tokens = response.usage.totalTokens;

    // Clean up any markdown formatting
    const cleanedScript = script.replace(/```.*?\n/g, '').replace(/```/g, '').trim();
    const wordCount = cleanedScript.split(/\s+/).length;

    console.log(`[Script Generator] Generated ${wordCount} word script via OpenRouter (${tokens} tokens)`);

    return { script: cleanedScript, tokens, speakerMap };
  } catch (error: any) {
    console.error('[Script Generator] Stage 2 failed:', error);
    throw new Error(`Failed to generate script: ${error.message}`);
  }
}

/**
 * Generate complete podcast script (two-stage process)
 */
export async function generatePodcastScript(
  config: ScriptGenerationConfig
): Promise<GeneratedScript> {
  const startTime = Date.now();

  try {
    const targetWordCount = calculateTargetWordCount(config.materialContent);

    const { insights, tokens: stage1Tokens } = await extractKeyInsights(
      config.materialContent,
      config.notebookTitle,
      config.educationLevel
    );

    const { script, tokens: stage2Tokens, speakerMap } = await generateDialogueScript(
      insights,
      config.notebookTitle,
      targetWordCount,
      config.petName,
      config.materialKind,
      config.educationLevel,
      config.ageBracket,
      config.contentClassification,
      config.contentSummary,
      config.studyGoal,
      config.sourceCount || 1
    );

    const totalTokens = stage1Tokens + stage2Tokens;
    const wordCount = script.split(/\s+/).length;
    const estimatedMinutes = wordCount / 160;

    const costCents = Math.ceil((totalTokens / 1000) * 0.003 * 100);

    return {
      script,
      keyInsights: insights,
      wordCount,
      estimatedMinutes,
      llmTokens: totalTokens,
      costCents,
      speakerMap
    };
  } catch (error: any) {
    console.error('[Script Generator] Failed:', error);
    throw new Error(`Script generation failed: ${error.message}`);
  }
}

/**
 * Validate generated script format
 */
export function validateScript(script: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const speakerPattern = /^[A-Z][a-zA-Z\s]+:/m;

  if (!speakerPattern.test(script)) {
    errors.push('Script missing speaker labels (Format: "Name: Dialogue")');
  }

  const wordCount = script.split(/\s+/).length;
  if (wordCount < 100) errors.push(`Script too short (${wordCount} words)`);

  return {
    valid: errors.length === 0,
    errors
  };
}
