export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audio_feedback: {
        Row: {
          audio_overview_id: string
          created_at: string | null
          id: string
          is_liked: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_overview_id: string
          created_at?: string | null
          id?: string
          is_liked: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_overview_id?: string
          created_at?: string | null
          id?: string
          is_liked?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_feedback_audio_overview_id_fkey"
            columns: ["audio_overview_id"]
            isOneToOne: false
            referencedRelation: "audio_overviews"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_overviews: {
        Row: {
          audio_url: string | null
          completed_at: string | null
          created_at: string | null
          duration: number
          error_message: string | null
          file_size_bytes: number | null
          generation_cost_cents: number | null
          id: string
          llm_tokens: number | null
          notebook_id: string
          script: string
          status: string | null
          storage_path: string
          title: string
          tts_audio_tokens: number | null
          user_id: string
          version: number | null
          voice_config: Json | null
        }
        Insert: {
          audio_url?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration?: number
          error_message?: string | null
          file_size_bytes?: number | null
          generation_cost_cents?: number | null
          id?: string
          llm_tokens?: number | null
          notebook_id: string
          script: string
          status?: string | null
          storage_path: string
          title: string
          tts_audio_tokens?: number | null
          user_id: string
          version?: number | null
          voice_config?: Json | null
        }
        Update: {
          audio_url?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration?: number
          error_message?: string | null
          file_size_bytes?: number | null
          generation_cost_cents?: number | null
          id?: string
          llm_tokens?: number | null
          notebook_id?: string
          script?: string
          status?: string | null
          storage_path?: string
          title?: string
          tts_audio_tokens?: number | null
          user_id?: string
          version?: number | null
          voice_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_overviews_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_overviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          audio_generated: boolean | null
          content: Json
          created_at: string | null
          description: string | null
          id: string
          is_free: boolean | null
          module_id: string
          order_index: number
          status: string | null
          title: string
        }
        Insert: {
          audio_generated?: boolean | null
          content: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_free?: boolean | null
          module_id: string
          order_index: number
          status?: string | null
          title: string
        }
        Update: {
          audio_generated?: boolean | null
          content?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_free?: boolean | null
          module_id?: string
          order_index?: number
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          id: string
          order_index: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          order_index: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string | null
          description: string | null
          exam_id: string
          id: string
          is_published: boolean | null
          level: string | null
          slug: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          exam_id: string
          id?: string
          is_published?: boolean | null
          level?: string | null
          slug: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          exam_id?: string
          id?: string
          is_published?: boolean | null
          level?: string | null
          slug?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          category: string | null
          country: string | null
          created_at: string | null
          id: string
          slug: string
          title: string
        }
        Insert: {
          category?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          slug: string
          title: string
        }
        Update: {
          category?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          slug?: string
          title?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          last_position: number | null
          lesson_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_position?: number | null
          lesson_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          last_position?: number | null
          lesson_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          content: string | null
          content_type: string
          created_at: string | null
          extracted_text: string | null
          id: string
          meta: Json | null
          notebook_id: string
          status: string | null
          storage_path: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          content_type: string
          created_at?: string | null
          extracted_text?: string | null
          id?: string
          meta?: Json | null
          notebook_id: string
          status?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          content_type?: string
          created_at?: string | null
          extracted_text?: string | null
          id?: string
          meta?: Json | null
          notebook_id?: string
          status?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          notebook_id: string
          role: string
          sources: Json
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          notebook_id: string
          role: string
          sources?: Json
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          notebook_id?: string
          role?: string
          sources?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_chat_messages_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          audio_generated_count: number | null
          color: string
          created_at: string | null
          embeddings_generated: boolean | null
          emoji: string
          flashcard_count: number | null
          id: string
          is_public: boolean | null
          last_studied: string | null
          material_id: string | null
          meta: Json | null
          preview_generated_at: string | null
          progress: number | null
          status: string
          studio_jobs_count: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_generated_count?: number | null
          color: string
          created_at?: string | null
          embeddings_generated?: boolean | null
          emoji: string
          flashcard_count?: number | null
          id?: string
          is_public?: boolean | null
          last_studied?: string | null
          material_id?: string | null
          meta?: Json | null
          preview_generated_at?: string | null
          progress?: number | null
          status: string
          studio_jobs_count?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_generated_count?: number | null
          color?: string
          created_at?: string | null
          embeddings_generated?: boolean | null
          emoji?: string
          flashcard_count?: number | null
          id?: string
          is_public?: boolean | null
          last_studied?: string | null
          material_id?: string | null
          meta?: Json | null
          preview_generated_at?: string | null
          progress?: number | null
          status?: string
          studio_jobs_count?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          coins: number | null
          commitment_made_at: string | null
          created_at: string | null
          daily_commitment_minutes: number | null
          expo_push_token: string | null
          first_name: string | null
          has_completed_onboarding: boolean | null
          has_created_notebook: boolean | null
          id: string
          last_freeze_reset: string | null
          last_name: string | null
          last_notification_sent_at: string | null
          last_streak_date: string | null
          learning_style: string | null
          meta: Json | null
          name: string | null
          onboarding_completed_at: string | null
          streak: number | null
          streak_freezes: number | null
          study_goal: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          coins?: number | null
          commitment_made_at?: string | null
          created_at?: string | null
          daily_commitment_minutes?: number | null
          expo_push_token?: string | null
          first_name?: string | null
          has_completed_onboarding?: boolean | null
          has_created_notebook?: boolean | null
          id: string
          last_freeze_reset?: string | null
          last_name?: string | null
          last_notification_sent_at?: string | null
          last_streak_date?: string | null
          learning_style?: string | null
          meta?: Json | null
          name?: string | null
          onboarding_completed_at?: string | null
          streak?: number | null
          streak_freezes?: number | null
          study_goal?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          coins?: number | null
          commitment_made_at?: string | null
          created_at?: string | null
          daily_commitment_minutes?: number | null
          expo_push_token?: string | null
          first_name?: string | null
          has_completed_onboarding?: boolean | null
          has_created_notebook?: boolean | null
          id?: string
          last_freeze_reset?: string | null
          last_name?: string | null
          last_notification_sent_at?: string | null
          last_streak_date?: string | null
          learning_style?: string | null
          meta?: Json | null
          name?: string | null
          onboarding_completed_at?: string | null
          streak?: number | null
          streak_freezes?: number | null
          study_goal?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_question_answers: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "studio_quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_question_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_flashcards: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          is_public: boolean | null
          notebook_id: string
          question: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          notebook_id: string
          question: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          notebook_id?: string
          question?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_flashcards_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_flashcards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_quiz_questions: {
        Row: {
          answer_explanation: string | null
          correct_option_index: number
          created_at: string | null
          id: string
          is_public: boolean | null
          notebook_id: string
          options: string[]
          question_text: string
          user_id: string
        }
        Insert: {
          answer_explanation?: string | null
          correct_option_index: number
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          notebook_id: string
          options: string[]
          question_text: string
          user_id: string
        }
        Update: {
          answer_explanation?: string | null
          correct_option_index?: number
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          notebook_id?: string
          options?: string[]
          question_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_quiz_questions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_quiz_questions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          created_at: string | null
          id: string
          material_id: string | null
          model_used: string
          notebook_id: string | null
          tokens_used: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          model_used: string
          notebook_id?: string | null
          tokens_used: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          model_used?: string
          notebook_id?: string | null
          tokens_used?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_streak_freeze: {
        Args: {
          p_user_id: string
          p_timezone?: string
        }
        Returns: Json
      }
    }
    Enums: {
      processing_job_status: "pending" | "processing" | "completed" | "failed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
