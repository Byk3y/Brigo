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
          duration: number
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
      audio_playback_sessions: {
        Row: {
          audio_overview_id: string
          created_at: string | null
          ended_at: string | null
          id: string
          playback_seconds: number
          started_at: string | null
          user_id: string
        }
        Insert: {
          audio_overview_id: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          playback_seconds?: number
          started_at?: string | null
          user_id: string
        }
        Update: {
          audio_overview_id?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          playback_seconds?: number
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_playback_sessions_audio_overview_id_fkey"
            columns: ["audio_overview_id"]
            isOneToOne: false
            referencedRelation: "audio_overviews"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string | null
          embedding: string
          id: string
          material_id: string
          metadata: Json | null
          notebook_id: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          created_at?: string | null
          embedding: string
          id?: string
          material_id: string
          metadata?: Json | null
          notebook_id: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string | null
          embedding?: string
          id?: string
          material_id?: string
          metadata?: Json | null
          notebook_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embeddings_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_completions: {
        Row: {
          created_at: string | null
          flashcard_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          flashcard_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          flashcard_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_completions_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "studio_flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          answers: Json
          correct_answer: number
          created_at: string | null
          explanation: string | null
          id: string
          notebook_id: string
          qa_hash: string | null
          question: string
          updated_at: string | null
        }
        Insert: {
          answers: Json
          correct_answer: number
          created_at?: string | null
          explanation?: string | null
          id?: string
          notebook_id: string
          qa_hash?: string | null
          question: string
          updated_at?: string | null
        }
        Update: {
          answers?: Json
          correct_answer?: number
          created_at?: string | null
          explanation?: string | null
          id?: string
          notebook_id?: string
          qa_hash?: string | null
          question?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
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
          preview_text: string | null
          processed: boolean | null
          processed_at: string | null
          status: string | null
          storage_path: string | null
          thumbnail: string | null
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
          preview_text?: string | null
          processed?: boolean | null
          processed_at?: string | null
          status?: string | null
          storage_path?: string | null
          thumbnail?: string | null
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
          preview_text?: string | null
          processed?: boolean | null
          processed_at?: string | null
          status?: string | null
          storage_path?: string | null
          thumbnail?: string | null
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
          sources: Json | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          notebook_id: string
          role: string
          sources?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          notebook_id?: string
          role?: string
          sources?: Json | null
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
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          notebook_id: string
          revoked_at: string | null
          role: string | null
          share_key: string | null
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notebook_id: string
          revoked_at?: string | null
          role?: string | null
          share_key?: string | null
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notebook_id?: string
          revoked_at?: string | null
          role?: string | null
          share_key?: string | null
          shared_with_user_id?: string | null
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
          audio_generated_count: number | null
          color: string | null
          created_at: string | null
          embeddings_generated: boolean | null
          emoji: string | null
          flashcard_count: number | null
          id: string
          is_public: boolean | null
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
          audio_generated_count?: number | null
          color?: string | null
          created_at?: string | null
          embeddings_generated?: boolean | null
          emoji?: string | null
          flashcard_count?: number | null
          id?: string
          is_public?: boolean | null
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
          audio_generated_count?: number | null
          color?: string | null
          created_at?: string | null
          embeddings_generated?: boolean | null
          emoji?: string | null
          flashcard_count?: number | null
          id?: string
          is_public?: boolean | null
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
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_states: {
        Row: {
          created_at: string | null
          current_points: number | null
          current_stage: number | null
          id: string
          meta: Json | null
          mood: string | null
          name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_points?: number | null
          current_stage?: number | null
          id?: string
          meta?: Json | null
          mood?: string | null
          name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_points?: number | null
          current_stage?: number | null
          id?: string
          meta?: Json | null
          mood?: string | null
          name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pet_task_completions: {
        Row: {
          completed_at: string | null
          completion_date: string
          created_at: string | null
          id: string
          points_awarded: number
          source: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_date: string
          created_at?: string | null
          id?: string
          points_awarded: number
          source?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_date?: string
          created_at?: string | null
          id?: string
          points_awarded?: number
          source?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pet_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_tasks: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          points: number
          task_key: string
          task_type: string
          title: string
          trigger_event: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          points: number
          task_key: string
          task_type: string
          title: string
          trigger_event?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          points?: number
          task_key?: string
          task_type?: string
          title?: string
          trigger_event?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          completed_at: string | null
          cost_estimate_cents: number | null
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string | null
          material_id: string
          model_used: string | null
          priority: number | null
          retry_count: number | null
          started_at: string | null
          status: string | null
          timeout_seconds: number | null
          token_usage: Json | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          cost_estimate_cents?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string | null
          material_id: string
          model_used?: string | null
          priority?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          timeout_seconds?: number | null
          token_usage?: Json | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          cost_estimate_cents?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string | null
          material_id?: string
          model_used?: string | null
          priority?: number | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          timeout_seconds?: number | null
          token_usage?: Json | null
          updated_at?: string | null
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
      processing_queue: {
        Row: {
          attempt_count: number
          completed_at: string | null
          created_at: string
          error_details: Json | null
          error_message: string | null
          estimated_pages: number | null
          file_size_bytes: number | null
          id: string
          job_type: string
          material_id: string
          max_attempts: number
          next_retry_at: string | null
          notebook_id: string
          priority: number
          processed_pages: number | null
          progress: number
          progress_message: string | null
          result: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["processing_job_status"]
          user_id: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          estimated_pages?: number | null
          file_size_bytes?: number | null
          id?: string
          job_type?: string
          material_id: string
          max_attempts?: number
          next_retry_at?: string | null
          notebook_id: string
          priority?: number
          processed_pages?: number | null
          progress?: number
          progress_message?: string | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_job_status"]
          user_id: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          estimated_pages?: number | null
          file_size_bytes?: number | null
          id?: string
          job_type?: string
          material_id?: string
          max_attempts?: number
          next_retry_at?: string | null
          notebook_id?: string
          priority?: number
          processed_pages?: number | null
          progress?: number
          progress_message?: string | null
          result?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["processing_job_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_queue_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_queue_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          coins: number | null
          created_at: string | null
          expo_push_token: string | null
          first_name: string | null
          id: string
          last_freeze_reset: string | null
          last_name: string | null
          last_notification_sent_at: string | null
          last_streak_date: string | null
          meta: Json | null
          name: string | null
          streak: number | null
          streak_freezes: number | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          coins?: number | null
          created_at?: string | null
          expo_push_token?: string | null
          first_name?: string | null
          id: string
          last_freeze_reset?: string | null
          last_name?: string | null
          last_notification_sent_at?: string | null
          last_streak_date?: string | null
          meta?: Json | null
          name?: string | null
          streak?: number | null
          streak_freezes?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          coins?: number | null
          created_at?: string | null
          expo_push_token?: string | null
          first_name?: string | null
          id?: string
          last_freeze_reset?: string | null
          last_name?: string | null
          last_notification_sent_at?: string | null
          last_streak_date?: string | null
          meta?: Json | null
          name?: string | null
          streak?: number | null
          streak_freezes?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quiz_completions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          quiz_id: string
          score: number
          score_percentage: number
          total_questions: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          quiz_id: string
          score: number
          score_percentage: number
          total_questions: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          quiz_id?: string
          score?: number
          score_percentage?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_completions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "studio_quizzes"
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
        ]
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
          status?: string
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
          display_order: number
          explanation: string | null
          explanations: Json | null
          hint: string | null
          id: string
          options: Json
          question: string
          quiz_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          display_order: number
          explanation?: string | null
          explanations?: Json | null
          hint?: string | null
          id?: string
          options: Json
          question: string
          quiz_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          display_order?: number
          explanation?: string | null
          explanations?: Json | null
          hint?: string | null
          id?: string
          options?: Json
          question?: string
          quiz_id?: string
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
      study_sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          end_at: string | null
          id: string
          notebook_id: string | null
          session_type: string | null
          start_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          end_at?: string | null
          id?: string
          notebook_id?: string | null
          session_type?: string | null
          start_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          end_at?: string | null
          id?: string
          notebook_id?: string | null
          session_type?: string | null
          start_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      suggested_actions: {
        Row: {
          action_type: string
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          label: string
          notebook_id: string
          prompt: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          label: string
          notebook_id: string
          prompt: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          label?: string
          notebook_id?: string
          prompt?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggested_actions_notebook_id_fkey"
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
          model_used: string
          notebook_id: string | null
          output_tokens: number | null
          processing_job_id: string | null
          status: string
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          estimated_cost_cents?: number | null
          id?: string
          input_tokens?: number | null
          job_type: string
          latency_ms?: number | null
          model_used: string
          notebook_id?: string | null
          output_tokens?: number | null
          processing_job_id?: string | null
          status: string
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          estimated_cost_cents?: number | null
          id?: string
          input_tokens?: number | null
          job_type?: string
          latency_ms?: number | null
          model_used?: string
          notebook_id?: string | null
          output_tokens?: number | null
          processing_job_id?: string | null
          status?: string
          total_tokens?: number | null
          user_id?: string
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
            foreignKeyName: "usage_logs_processing_job_id_fkey"
            columns: ["processing_job_id"]
            isOneToOne: false
            referencedRelation: "processing_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_flashcard_progress: {
        Row: {
          id: string
          last_flashcard_id: string | null
          last_index: number
          notebook_id: string
          set_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_flashcard_id?: string | null
          last_index?: number
          notebook_id: string
          set_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_flashcard_id?: string | null
          last_index?: number
          notebook_id?: string
          set_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_flashcard_progress_last_flashcard_id_fkey"
            columns: ["last_flashcard_id"]
            isOneToOne: false
            referencedRelation: "studio_flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_flashcard_progress_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_flashcard_progress_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "studio_flashcard_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          audio_generations_count: number | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          daily_chat_messages_used: number | null
          daily_chat_reset_at: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          studio_generations_count: number | null
          tier: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          audio_generations_count?: number | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          daily_chat_messages_used?: number | null
          daily_chat_reset_at?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          studio_generations_count?: number | null
          tier?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          audio_generations_count?: number | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          daily_chat_messages_used?: number | null
          daily_chat_reset_at?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          studio_generations_count?: number | null
          tier?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
      apply_streak_freeze: {
        Args: { p_timezone?: string; p_user_id: string }
        Returns: Json
      }
      award_task_points: {
        Args: {
          p_completion_date: string
          p_task_key: string
          p_timezone?: string
          p_user_id: string
        }
        Returns: Json
      }
      check_and_increment_chat_usage: {
        Args: { user_id_param: string }
        Returns: {
          allowed: boolean
          is_premium: boolean
          remaining: number
        }[]
      }
      check_streak_reset: {
        Args: { p_timezone?: string; p_user_id: string }
        Returns: Json
      }
      cleanup_old_jobs: { Args: never; Returns: number }
      complete_job: {
        Args: { p_job_id: string; p_result?: Json }
        Returns: undefined
      }
      enqueue_processing_job: {
        Args: {
          p_estimated_pages?: number
          p_file_size_bytes?: number
          p_job_type?: string
          p_material_id: string
          p_notebook_id: string
          p_priority?: number
          p_user_id: string
        }
        Returns: string
      }
      fail_job: {
        Args: {
          p_error_details?: Json
          p_error_message: string
          p_job_id: string
          p_should_retry?: boolean
        }
        Returns: undefined
      }
      get_daily_tasks: {
        Args: { p_timezone?: string; p_user_id: string }
        Returns: Json[]
      }
      get_foundational_tasks: { Args: { p_user_id: string }; Returns: Json }
      get_next_pending_job: {
        Args: never
        Returns: {
          job_id: string
          p_estimated_pages: number
          p_file_size_bytes: number
          p_job_type: string
          p_material_id: string
          p_notebook_id: string
          p_user_id: string
        }[]
      }
      get_task_progress: {
        Args: { p_task_key: string; p_timezone?: string; p_user_id: string }
        Returns: Json
      }
      get_user_quota: {
        Args: { user_id_param: string }
        Returns: {
          audio_jobs_remaining: number
          is_trial_expired: boolean
          status: string
          studio_jobs_remaining: number
          tier: string
          trial_ends_at: string
        }[]
      }
      increment_quota: {
        Args: { quota_type: string; user_id_param: string }
        Returns: undefined
      }
      increment_streak: {
        Args: { p_timezone?: string; p_user_id: string }
        Returns: Json
      }
      merge_profile_meta: {
        Args: { p_new_meta: Json; p_user_id: string }
        Returns: undefined
      }
      search_embeddings: {
        Args: {
          filter_notebook_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          id: string
          material_id: string
          metadata: Json
          similarity: number
        }[]
      }
      update_job_progress: {
        Args: {
          p_job_id: string
          p_message?: string
          p_processed_pages?: number
          p_progress: number
        }
        Returns: undefined
      }
    }
    Enums: {
      processing_job_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      processing_job_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
