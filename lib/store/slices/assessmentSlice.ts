/**
 * Assessment Slice - Manages onboarding assessment state
 * Stores user's learning preferences and study goals
 */

import { StateCreator } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { ProfileMeta } from '../types';

export interface AssessmentSlice {
  // Assessment answers (temporary - cleared after saving to database)
  studyGoal: ProfileMeta['study_goal'] | null;
  learningStyle: ProfileMeta['learning_style'] | null;
  dailyCommitmentMinutes: number | null;

  // Personalization results (generated from answers)
  recommendedMethods: string[];
  personalizedMessage: string;
  petMessage: string;

  // Actions
  setStudyGoal: (goal: ProfileMeta['study_goal']) => void;
  setLearningStyle: (style: ProfileMeta['learning_style']) => void;
  setDailyCommitment: (minutes: number) => void;
  generateRecommendations: () => void;
  saveAssessmentToDatabase: (userId: string) => Promise<void>;
  resetAssessment: () => void;
}

export const createAssessmentSlice: StateCreator<
  AssessmentSlice,
  [],
  [],
  AssessmentSlice
> = (set, get) => ({
  // Initial state
  studyGoal: null,
  learningStyle: null,
  dailyCommitmentMinutes: null,
  recommendedMethods: [],
  personalizedMessage: '',
  petMessage: '',

  // Set study goal
  setStudyGoal: (goal) => {
    set({ studyGoal: goal });
  },

  // Set learning style
  setLearningStyle: (style) => {
    set({ learningStyle: style });
  },

  // Set daily commitment
  setDailyCommitment: (minutes) => {
    set({ dailyCommitmentMinutes: minutes });
  },

  // Generate personalized recommendations based on assessment answers
  generateRecommendations: () => {
    const { learningStyle, studyGoal, dailyCommitmentMinutes } = get();

    const methods: string[] = [];
    let message = '';
    let petMessage = '';

    // Personalize based on learning style
    if (learningStyle === 'practice') {
      methods.push('Quiz Mode', 'Practice Tests', 'Self-Testing');
      message = "You learn best by doing! We'll focus on active practice with quizzes and self-testing.";
    } else if (learningStyle === 'visual') {
      methods.push('Diagrams', 'Mind Maps', 'Visual Summaries');
      message = "You're a visual learner! We'll emphasize charts, diagrams, and visual study aids.";
    } else if (learningStyle === 'reading') {
      methods.push('Flashcards', 'Notes', 'Summaries');
      message = "You love reading! We'll use flashcards and detailed notes to help you learn.";
    } else if (learningStyle === 'auditory') {
      methods.push('Podcasts', 'Audio Guides', 'Listening');
      message = "You're an auditory learner! We'll create tailored podcasts for you.";
    }

    // Personalize pet companion message based on study goal
    if (studyGoal === 'exam_prep') {
      petMessage = "I'll help you ace those exams! Let's crush it together! 🎯";
    } else if (studyGoal === 'retention') {
      petMessage = "I'll help you remember for the long haul! We're building lasting knowledge! 🧠";
    } else if (studyGoal === 'quick_review') {
      petMessage = "I'll keep your reviews quick and effective! Perfect for your busy schedule! ⚡";
    } else if (studyGoal === 'all') {
      petMessage = "I'll adapt to all your study needs! We're in this together! ✨";
    }

    // Add commitment insight to message
    if (dailyCommitmentMinutes) {
      if (dailyCommitmentMinutes <= 15) {
        message += ` ${dailyCommitmentMinutes} minutes a day is perfect for building a consistent habit!`;
      } else if (dailyCommitmentMinutes <= 30) {
        message += ` ${dailyCommitmentMinutes} minutes daily will make a real difference in your learning!`;
      } else {
        message += ` With ${dailyCommitmentMinutes} minutes daily, you're setting yourself up for serious progress!`;
      }
    }

    set({
      recommendedMethods: methods,
      personalizedMessage: message,
      petMessage,
    });
  },

  // Save assessment to database
  saveAssessmentToDatabase: async (userId: string) => {
    try {
      const { studyGoal, learningStyle, dailyCommitmentMinutes } = get();

      if (!studyGoal || !learningStyle || !dailyCommitmentMinutes) {
        console.warn('Assessment incomplete, cannot save');
        return;
      }

      // Use merge_profile_meta to safely update without overwriting existing fields
      const { error } = await supabase.rpc('merge_profile_meta', {
        p_user_id: userId,
        p_new_meta: {
          learning_style: learningStyle,
          study_goal: studyGoal,
          daily_commitment_minutes: dailyCommitmentMinutes,
          commitment_made_at: new Date().toISOString(),
          assessment_completed_at: new Date().toISOString(),
          assessment_version: '1.0',
        },
      });

      if (error) {
        console.error('Failed to save assessment:', error);
        throw error;
      }

      console.log('Assessment saved successfully');
    } catch (error) {
      console.error('Error saving assessment:', error);
      throw error;
    }
  },

  // Reset assessment (after saving or on logout)
  resetAssessment: () => {
    set({
      studyGoal: null,
      learningStyle: null,
      dailyCommitmentMinutes: null,
      recommendedMethods: [],
      personalizedMessage: '',
      petMessage: '',
    });
  },
});
