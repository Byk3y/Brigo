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
        ]
      }
      flashcards: {
        Row: {
          answer: string
          created_at: string | null
          explanation: string | null
          id: string
          material_id: string
          question: string
          study_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          material_id: string
          question: string
          study_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          material_id?: string
          question?: string
          study_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          content: string | null
          created_at: string | null
          external_url: string | null
          id: string
          kind: string
          meta: Json | null
          notebook_id: string | null
          processed: boolean | null
          processed_at: string | null
          status: string | null
          storage_path: string | null
          thumbnail: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          external_url?: string | null
          id?: string
          kind: string
          meta?: Json | null
          notebook_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          status?: string | null
          storage_path?: string | null
          thumbnail?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          external_url?: string | null
          id?: string
          kind?: string
          meta?: Json | null
          notebook_id?: string | null
          processed?: boolean | null
          processed_at?: string | null
          status?: string | null
          storage_path?: string | null
          thumbnail?: string | null
          title?: string | null
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
        ]
      }
      notebook_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          notebook_id: string
          role: string
          sources: string[] | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          notebook_id: string
          role: string
          sources?: string[] | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          notebook_id?: string
          role?: string
          sources?: string[] | null
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
        ]
      }
      notebook_shares: {
        Row: {
          access_level: string
          created_at: string | null
          id: string
          notebook_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_level: string
          created_at?: string | null
          id?: string
          notebook_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string | null
          id?: string
          notebook_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_shares_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          color: string | null
          created_at: string | null
          emoji: string | null
          flashcard_count: number | null
          id: string
          last_studied: string | null
          material_id: string | null
          meta: Json | null
          preview_generated_at: string | null
          progress: number | null
          status: string | null
          studio_jobs_count: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          flashcard_count?: number | null
          id?: string
          last_studied?: string | null
          material_id?: string | null
          meta?: Json | null
          preview_generated_at?: string | null
          progress?: number | null
          status?: string | null
          studio_jobs_count?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          emoji?: string | null
          flashcard_count?: number | null
          id?: string
          last_studied?: string | null
          material_id?: string | null
          meta?: Json | null
          preview_generated_at?: string | null
          progress?: number | null
          status?: string | null
          studio_jobs_count?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_states: {
        Row: {
          created_at: string | null
          id: string
          mood: string
          name: string
          points: number
          stage: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mood: string
          name: string
          points?: number
          stage?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mood?: string
          name?: string
          points?: number
          stage?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          estimated_duration_seconds: number | null
          id: string
          job_type: string
          material_id: string
          priority: number | null
          started_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_duration_seconds?: number | null
          id?: string
          job_type: string
          material_id: string
          priority?: number | null
          started_at?: string | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_duration_seconds?: number | null
          id?: string
          job_type?: string
          material_id?: string
          priority?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_bracket: string | null
          avatar_url: string | null
          coins: number | null
          created_at: string | null
          display_name: string | null
          education_level: string | null
          email: string | null
          expo_push_token: string | null
          first_name: string | null
          id: string
          last_freeze_reset: string | null
          last_name: string | null
          last_streak_date: string | null
          learning_style: string | null
          meta: Json | null
          onboarding_step: number | null
          points: number | null
          streak: number | null
          streak_freezes: number | null
          study_goal: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          age_bracket?: string | null
          avatar_url?: string | null
          coins?: number | null
          created_at?: string | null
          display_name?: string | null
          education_level?: string | null
          email?: string | null
          expo_push_token?: string | null
          first_name?: string | null
          id: string
          last_freeze_reset?: string | null
          last_name?: string | null
          last_streak_date?: string | null
          learning_style?: string | null
          meta?: Json | null
          onboarding_step?: number | null
          points?: number | null
          streak?: number | null
          streak_freezes?: number | null
          study_goal?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          age_bracket?: string | null
          avatar_url?: string | null
          coins?: number | null
          created_at?: string | null
          display_name?: string | null
          education_level?: string | null
          email?: string | null
          expo_push_token?: string | null
          first_name?: string | null
          id?: string
          last_freeze_reset?: string | null
          last_name?: string | null
          last_streak_date?: string | null
          learning_style?: string | null
          meta?: Json | null
          onboarding_step?: number | null
          points?: number | null
          streak?: number | null
          streak_freezes?: number | null
          study_goal?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      studio_exam_predictions: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          notebook_id: string
          report_data: Json | null
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          notebook_id: string
          report_data?: Json | null
          status: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          notebook_id?: string
          report_data?: Json | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_exam_predictions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_flashcard_sets: {
        Row: {
          created_at: string | null
          id: string
          notebook_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notebook_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notebook_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_flashcard_sets_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_flashcards: {
        Row: {
          answer: string
          created_at: string | null
          explanation: string | null
          id: string
          notebook_id: string
          question: string
          set_id: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          notebook_id: string
          question: string
          set_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          notebook_id?: string
          question?: string
          set_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
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
            foreignKeyName: "studio_flashcards_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "studio_flashcard_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_quiz_questions: {
        Row: {
          correct_answer: string
          created_at: string | null
          display_order: number | null
          explanation: string | null
          explanations: Json | null
          hint: string | null
          id: string
          options: Json
          question: string
          quiz_id: string
          updated_at: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          display_order?: number | null
          explanation?: string | null
          explanations?: Json | null
          hint?: string | null
          id?: string
          options: Json
          question: string
          quiz_id: string
          updated_at?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          display_order?: number | null
          explanation?: string | null
          explanations?: Json | null
          hint?: string | null
          id?: string
          options?: Json
          question?: string
          quiz_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "studio_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_quizzes: {
        Row: {
          created_at: string | null
          id: string
          notebook_id: string
          title: string
          total_questions: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notebook_id: string
          title: string
          total_questions: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notebook_id?: string
          title?: string
          total_questions?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_quizzes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          estimated_cost_cents: number | null
          id: string
          input_tokens: number | null
          job_type: string
          latency_ms: number | null
          model_used: string | null
          notebook_id: string | null
          output_tokens: number | null
          status: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          estimated_cost_cents?: number | null
          id?: string
          input_tokens?: number | null
          job_type: string
          latency_ms?: number | null
          model_used?: string | null
          notebook_id?: string | null
          output_tokens?: number | null
          status: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          estimated_cost_cents?: number | null
          id?: string
          input_tokens?: number | null
          job_type?: string
          latency_ms?: number | null
          model_used?: string | null
          notebook_id?: string | null
          output_tokens?: number | null
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
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
      user_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          plan_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          plan_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          plan_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
  | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
> = Database["public"]["Tables"] & Database["public"]["Views"] extends {
  [key in PublicTableNameOrOptions]: {
    Row: infer R
  }
}
  ? R
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][PublicTableNameOrOptions] extends {
  Insert: infer I
}
  ? I
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
> = Database["public"]["Tables"][PublicTableNameOrOptions] extends {
  Update: infer U
}
  ? U
  : never

export type Enums<
  PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
> = Database["public"]["Enums"][PublicEnumNameOrOptions]
