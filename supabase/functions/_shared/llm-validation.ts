/**
 * LLM Response Validation Utilities
 * Validates JSON responses from LLM to prevent malicious or malformed data
 */

import { validateString, validateUUIDArray } from './validation.ts';

/**
 * Validate flashcard structure from LLM response
 */
export function validateFlashcard(fc: any, index: number): { isValid: boolean; error?: string; sanitized?: any } {
  if (!fc || typeof fc !== 'object') {
    return {
      isValid: false,
      error: `Flashcard ${index} is not an object`,
    };
  }

  // Validate question
  const questionResult = validateString(fc.question, {
    fieldName: 'question',
    required: true,
    minLength: 3,
    maxLength: 500,
  });
  if (!questionResult.isValid) {
    return {
      isValid: false,
      error: `Flashcard ${index}: ${questionResult.error}`,
    };
  }

  // Validate answer
  const answerResult = validateString(fc.answer, {
    fieldName: 'answer',
    required: true,
    minLength: 1,
    maxLength: 2000,
  });
  if (!answerResult.isValid) {
    return {
      isValid: false,
      error: `Flashcard ${index}: ${answerResult.error}`,
    };
  }

  // Validate explanation (optional)
  let sanitizedExplanation = null;
  if (fc.explanation) {
    const explanationResult = validateString(fc.explanation, {
      fieldName: 'explanation',
      required: false,
      maxLength: 3000,
    });
    if (!explanationResult.isValid) {
      return {
        isValid: false,
        error: `Flashcard ${index}: ${explanationResult.error}`,
      };
    }
    sanitizedExplanation = explanationResult.sanitized;
  }

  // Validate tags (optional array)
  let sanitizedTags: string[] = [];
  if (fc.tags) {
    if (!Array.isArray(fc.tags)) {
      return {
        isValid: false,
        error: `Flashcard ${index}: tags must be an array`,
      };
    }
    if (fc.tags.length > 10) {
      return {
        isValid: false,
        error: `Flashcard ${index}: too many tags (max 10)`,
      };
    }
    for (let i = 0; i < fc.tags.length; i++) {
      const tagResult = validateString(fc.tags[i], {
        fieldName: `tag ${i}`,
        required: true,
        maxLength: 50,
        allowNewlines: false,
      });
      if (!tagResult.isValid) {
        return {
          isValid: false,
          error: `Flashcard ${index}: ${tagResult.error}`,
        };
      }
      sanitizedTags.push(tagResult.sanitized!);
    }
  }

  return {
    isValid: true,
    sanitized: {
      question: questionResult.sanitized,
      answer: answerResult.sanitized,
      explanation: sanitizedExplanation,
      tags: sanitizedTags,
    },
  };
}

/**
 * Validate quiz question structure from LLM response
 */
export function validateQuizQuestion(q: any, index: number): { isValid: boolean; error?: string; sanitized?: any } {
  if (!q || typeof q !== 'object') {
    return {
      isValid: false,
      error: `Quiz question ${index} is not an object`,
    };
  }

  // Validate question text
  const questionResult = validateString(q.question, {
    fieldName: 'question',
    required: true,
    minLength: 10,
    maxLength: 1000,
  });
  if (!questionResult.isValid) {
    return {
      isValid: false,
      error: `Question ${index}: ${questionResult.error}`,
    };
  }

  // Validate options (must be object with A, B, C, D)
  if (!q.options || typeof q.options !== 'object') {
    return {
      isValid: false,
      error: `Question ${index}: options must be an object`,
    };
  }

  const requiredOptions = ['A', 'B', 'C', 'D'];
  const sanitizedOptions: Record<string, string> = {};

  for (const letter of requiredOptions) {
    const optionResult = validateString(q.options[letter], {
      fieldName: `option ${letter}`,
      required: true,
      maxLength: 500,
    });
    if (!optionResult.isValid) {
      return {
        isValid: false,
        error: `Question ${index}: ${optionResult.error}`,
      };
    }
    sanitizedOptions[letter] = optionResult.sanitized!;
  }

  // Validate correct answer
  if (!q.correct || !requiredOptions.includes(q.correct)) {
    return {
      isValid: false,
      error: `Question ${index}: correct answer must be A, B, C, or D`,
    };
  }

  // Validate hint (optional)
  let sanitizedHint = null;
  if (q.hint) {
    const hintResult = validateString(q.hint, {
      fieldName: 'hint',
      required: false,
      maxLength: 500,
    });
    if (!hintResult.isValid) {
      return {
        isValid: false,
        error: `Question ${index}: ${hintResult.error}`,
      };
    }
    sanitizedHint = hintResult.sanitized;
  }

  // Validate explanations (optional)
  let sanitizedExplanations: Record<string, string> | null = null;
  if (q.explanations) {
    if (typeof q.explanations !== 'object') {
      return {
        isValid: false,
        error: `Question ${index}: explanations must be an object`,
      };
    }

    sanitizedExplanations = {};
    for (const letter of requiredOptions) {
      if (q.explanations[letter]) {
        const explResult = validateString(q.explanations[letter], {
          fieldName: `explanation ${letter}`,
          required: false,
          maxLength: 1000,
        });
        if (!explResult.isValid) {
          return {
            isValid: false,
            error: `Question ${index}: ${explResult.error}`,
          };
        }
        sanitizedExplanations[letter] = explResult.sanitized!;
      }
    }

    // If explanations object exists but doesn't have all 4 letters, set to null
    if (Object.keys(sanitizedExplanations).length !== 4) {
      sanitizedExplanations = null;
    }
  }

  return {
    isValid: true,
    sanitized: {
      question: questionResult.sanitized,
      options: sanitizedOptions,
      correct: q.correct,
      hint: sanitizedHint,
      explanations: sanitizedExplanations,
    },
  };
}

/**
 * Validate flashcards array from LLM response
 */
export function validateFlashcardsResponse(
  parsed: any,
  expectedCount: number
): { isValid: boolean; error?: string; sanitized?: any } {
  if (!parsed || typeof parsed !== 'object') {
    return {
      isValid: false,
      error: 'Response is not a valid object',
    };
  }

  // Validate flashcards array exists
  if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
    return {
      isValid: false,
      error: 'Response missing flashcards array',
    };
  }

  // Validate count
  if (parsed.flashcards.length === 0) {
    return {
      isValid: false,
      error: 'Flashcards array is empty',
    };
  }

  if (parsed.flashcards.length > 100) {
    return {
      isValid: false,
      error: `Too many flashcards (${parsed.flashcards.length}, max 100)`,
    };
  }

  // Validate title
  const titleResult = validateString(parsed.title || '', {
    fieldName: 'title',
    required: false,
    maxLength: 200,
    allowNewlines: false,
  });

  // Validate each flashcard
  const sanitizedFlashcards = [];
  for (let i = 0; i < parsed.flashcards.length; i++) {
    const fcResult = validateFlashcard(parsed.flashcards[i], i);
    if (!fcResult.isValid) {
      return {
        isValid: false,
        error: fcResult.error,
      };
    }
    sanitizedFlashcards.push(fcResult.sanitized);
  }

  return {
    isValid: true,
    sanitized: {
      title: titleResult.sanitized || 'Untitled',
      flashcards: sanitizedFlashcards,
    },
  };
}

/**
 * Validate quiz response from LLM
 */
export function validateQuizResponse(
  parsed: any,
  expectedCount: number
): { isValid: boolean; error?: string; sanitized?: any } {
  if (!parsed || typeof parsed !== 'object') {
    return {
      isValid: false,
      error: 'Response is not a valid object',
    };
  }

  // Validate quiz object exists
  if (!parsed.quiz || typeof parsed.quiz !== 'object') {
    return {
      isValid: false,
      error: 'Response missing quiz object',
    };
  }

  // Validate questions array
  if (!parsed.quiz.questions || !Array.isArray(parsed.quiz.questions)) {
    return {
      isValid: false,
      error: 'Quiz missing questions array',
    };
  }

  // Validate count
  if (parsed.quiz.questions.length === 0) {
    return {
      isValid: false,
      error: 'Questions array is empty',
    };
  }

  if (parsed.quiz.questions.length > 50) {
    return {
      isValid: false,
      error: `Too many questions (${parsed.quiz.questions.length}, max 50)`,
    };
  }

  // Validate title
  const titleResult = validateString(parsed.quiz.title || '', {
    fieldName: 'title',
    required: false,
    maxLength: 200,
    allowNewlines: false,
  });

  // Validate each question
  const sanitizedQuestions = [];
  for (let i = 0; i < parsed.quiz.questions.length; i++) {
    const qResult = validateQuizQuestion(parsed.quiz.questions[i], i);
    if (!qResult.isValid) {
      return {
        isValid: false,
        error: qResult.error,
      };
    }
    sanitizedQuestions.push(qResult.sanitized);
  }

  return {
    isValid: true,
    sanitized: {
      quiz: {
        title: titleResult.sanitized || 'Untitled Quiz',
        questions: sanitizedQuestions,
      },
    },
  };
}

/**
 * Validate prediction topic structure from LLM response
 */
export function validatePredictionTopic(topic: any, index: number): { isValid: boolean; error?: string; sanitized?: any } {
  if (!topic || typeof topic !== 'object') {
    return {
      isValid: false,
      error: `Topic ${index} is not an object`,
    };
  }

  // Validate name
  const nameResult = validateString(topic.name, {
    fieldName: 'name',
    required: true,
    minLength: 1,
    maxLength: 200,
  });
  if (!nameResult.isValid) {
    return {
      isValid: false,
      error: `Topic ${index}: ${nameResult.error}`,
    };
  }

  // Validate frequency (should be a number)
  if (typeof topic.frequency !== 'number' || topic.frequency < 0 || topic.frequency > 100) {
    return {
      isValid: false,
      error: `Topic ${index}: frequency must be a number between 0 and 100`,
    };
  }

  // Validate likelihood
  const validLikelihoods = ['high', 'medium', 'low'];
  if (!validLikelihoods.includes(topic.likelihood)) {
    return {
      isValid: false,
      error: `Topic ${index}: likelihood must be high, medium, or low`,
    };
  }

  // Validate trend (optional)
  const validTrends = ['increasing', 'stable', 'decreasing'];
  const sanitizedTrend = validTrends.includes(topic.trend) ? topic.trend : 'stable';

  return {
    isValid: true,
    sanitized: {
      name: nameResult.sanitized,
      frequency: topic.frequency,
      total_papers: typeof topic.total_papers === 'number' ? topic.total_papers : 1,
      likelihood: topic.likelihood,
      trend: sanitizedTrend,
    },
  };
}

/**
 * Validate predicted question structure from LLM response
 */
export function validatePredictedQuestion(q: any, index: number): { isValid: boolean; error?: string; sanitized?: any } {
  if (!q || typeof q !== 'object') {
    return {
      isValid: false,
      error: `Prediction ${index} is not an object`,
    };
  }

  // Validate question
  const questionResult = validateString(q.question, {
    fieldName: 'question',
    required: true,
    minLength: 10,
    maxLength: 2000,
  });
  if (!questionResult.isValid) {
    return {
      isValid: false,
      error: `Prediction ${index}: ${questionResult.error}`,
    };
  }

  // Validate answer
  const answerResult = validateString(q.answer, {
    fieldName: 'answer',
    required: true,
    minLength: 1,
    maxLength: 5000,
  });
  if (!answerResult.isValid) {
    return {
      isValid: false,
      error: `Prediction ${index}: ${answerResult.error}`,
    };
  }

  // Validate topic (optional)
  let sanitizedTopic = 'General';
  if (q.topic) {
    const topicResult = validateString(q.topic, {
      fieldName: 'topic',
      required: false,
      maxLength: 200,
    });
    if (topicResult.isValid && topicResult.sanitized) {
      sanitizedTopic = topicResult.sanitized;
    }
  }

  // Validate question_type
  const validQuestionTypes = ['mcq', 'short_answer', 'essay'];
  const sanitizedQuestionType = validQuestionTypes.includes(q.question_type) ? q.question_type : 'short_answer';

  // Validate confidence
  const validConfidences = ['high', 'medium', 'low'];
  const sanitizedConfidence = validConfidences.includes(q.confidence) ? q.confidence : 'medium';

  // Validate reasoning (optional)
  let sanitizedReasoning = 'Based on content analysis';
  if (q.reasoning) {
    const reasoningResult = validateString(q.reasoning, {
      fieldName: 'reasoning',
      required: false,
      maxLength: 1000,
    });
    if (reasoningResult.isValid && reasoningResult.sanitized) {
      sanitizedReasoning = reasoningResult.sanitized;
    }
  }

  return {
    isValid: true,
    sanitized: {
      question: questionResult.sanitized,
      answer: answerResult.sanitized,
      topic: sanitizedTopic,
      question_type: sanitizedQuestionType,
      confidence: sanitizedConfidence,
      reasoning: sanitizedReasoning,
    },
  };
}

/**
 * Validate exam prediction response from LLM
 */
export function validatePredictionResponse(
  parsed: any
): { isValid: boolean; error?: string; sanitized?: any } {
  if (!parsed || typeof parsed !== 'object') {
    return {
      isValid: false,
      error: 'Response is not a valid object',
    };
  }

  // Validate title
  const titleResult = validateString(parsed.title || '', {
    fieldName: 'title',
    required: false,
    maxLength: 200,
    allowNewlines: false,
  });

  // Validate summary (optional)
  let sanitizedSummary = {
    papers_analyzed: 1,
    exam_structure: {
      mcq: 0,
      short_answer: 0,
      essay: 0,
    },
  };

  if (parsed.summary && typeof parsed.summary === 'object') {
    sanitizedSummary = {
      papers_analyzed: typeof parsed.summary.papers_analyzed === 'number' ? parsed.summary.papers_analyzed : 1,
      exam_structure: {
        mcq: typeof parsed.summary.exam_structure?.mcq === 'number' ? parsed.summary.exam_structure.mcq : 0,
        short_answer: typeof parsed.summary.exam_structure?.short_answer === 'number' ? parsed.summary.exam_structure.short_answer : 0,
        essay: typeof parsed.summary.exam_structure?.essay === 'number' ? parsed.summary.exam_structure.essay : 0,
      },
    };
  }

  // Validate topics array (optional but recommended)
  const sanitizedTopics = [];
  if (parsed.topics && Array.isArray(parsed.topics)) {
    if (parsed.topics.length > 50) {
      return {
        isValid: false,
        error: `Too many topics (${parsed.topics.length}, max 50)`,
      };
    }

    for (let i = 0; i < parsed.topics.length; i++) {
      const topicResult = validatePredictionTopic(parsed.topics[i], i);
      if (!topicResult.isValid) {
        console.warn(`Topic ${i} validation failed:`, topicResult.error);
        // Don't fail entire response for invalid topics, just skip
        continue;
      }
      sanitizedTopics.push(topicResult.sanitized);
    }
  }

  // Validate predictions array (required)
  if (!parsed.predictions || !Array.isArray(parsed.predictions)) {
    return {
      isValid: false,
      error: 'Response missing predictions array',
    };
  }

  if (parsed.predictions.length === 0) {
    return {
      isValid: false,
      error: 'Predictions array is empty',
    };
  }

  if (parsed.predictions.length > 30) {
    return {
      isValid: false,
      error: `Too many predictions (${parsed.predictions.length}, max 30)`,
    };
  }

  const sanitizedPredictions = [];
  for (let i = 0; i < parsed.predictions.length; i++) {
    const predResult = validatePredictedQuestion(parsed.predictions[i], i);
    if (!predResult.isValid) {
      return {
        isValid: false,
        error: predResult.error,
      };
    }
    sanitizedPredictions.push(predResult.sanitized);
  }

  return {
    isValid: true,
    sanitized: {
      title: titleResult.sanitized || 'Exam Predictions',
      summary: sanitizedSummary,
      topics: sanitizedTopics,
      predictions: sanitizedPredictions,
    },
  };
}
