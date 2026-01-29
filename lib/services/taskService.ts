import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import type { DailyTask, TaskProgress } from '@/lib/store/types';

// Type definition for award_task_points RPC response
interface AwardTaskPointsResponse {
  success: boolean;
  already_completed?: boolean;
  points_awarded?: number;
  new_total_points?: number;
  new_stage?: number;
  error?: string;
  error_code?: string;
  task_key?: string;
}

// Type definition for log_activity RPC response
interface RewardResult {
  success: boolean;
  points_awarded?: number;
  pet_secured?: boolean;
  reason?: string;
}

interface LogActivityResponse {
  success: boolean;
  activity_id?: string;
  rewards?: {
    study_rewards?: RewardResult;
    pet_security?: RewardResult;
  };
  note?: string;
  error?: string;
}

// Type guard for validating RPC response shape
function isValidAwardResponse(data: unknown): data is AwardTaskPointsResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    typeof (data as AwardTaskPointsResponse).success === 'boolean'
  );
}

export const taskService = {
  /**
   * Get daily tasks for a user
   */
  getDailyTasks: async (userId: string, timezone: string): Promise<DailyTask[]> => {
    try {
      const { data, error } = await supabase.rpc('get_daily_tasks', {
        p_user_id: userId,
        p_timezone: timezone,
      });

      if (error) {
        await handleError(error, {
          operation: 'get_daily_tasks',
          component: 'task-service',
          metadata: { userId, timezone },
        });
        return [];
      }

      return (data as any) || [];
    } catch (error) {
      await handleError(error, {
        operation: 'get_daily_tasks',
        component: 'task-service',
        metadata: { userId, timezone },
      });
      return [];
    }
  },

  /**
   * Get foundational tasks for a user
   */
  getFoundationalTasks: async (userId: string): Promise<DailyTask[]> => {
    try {
      const { data, error } = await supabase.rpc('get_foundational_tasks', {
        p_user_id: userId,
      });

      if (error) {
        await handleError(error, {
          operation: 'get_foundational_tasks',
          component: 'task-service',
          metadata: { userId },
        });
        return [];
      }

      return (data as any) || [];
    } catch (error) {
      await handleError(error, {
        operation: 'get_foundational_tasks',
        component: 'task-service',
        metadata: { userId },
      });
      return [];
    }
  },

  /**
   * Get task progress for a specific task
   * Uses RPC function for timezone-aware daily progress calculation
   * @param userId - The user's ID
   * @param taskKey - The task key (e.g. 'study_flashcards', 'complete_quiz')
   * @param timezone - The user's timezone (default: 'UTC')
   * @returns Current progress value (number)
   */
  getTaskProgress: async (userId: string, taskKey: string, timezone: string = 'UTC'): Promise<TaskProgress> => {
    try {
      const { data, error } = await supabase.rpc('get_task_progress', {
        p_user_id: userId,
        p_task_key: taskKey,
        p_timezone: timezone,
      });

      if (error) {
        await handleError(error, {
          operation: 'get_task_progress',
          component: 'task-service',
          metadata: { userId, taskKey, timezone },
        });
        return { current: 0, goal: 1, unit: 'count', percentage: 0 };
      }

      const result = data as any;
      return {
        current: (result?.current as number) || 0,
        goal: (result?.goal as number) || 1,
        unit: (result?.unit as string) || 'count',
        percentage: (result?.percentage as number) || 0,
      };
    } catch (error) {
      await handleError(error, {
        operation: 'get_task_progress',
        component: 'task-service',
        metadata: { userId, taskKey, timezone },
      });
      return { current: 0, goal: 1, unit: 'count', percentage: 0 };
    }
  },

  /**
   * Award task points via RPC
   */
  awardTaskPoints: async (
    userId: string,
    taskKey: string,
    completionDate: string,
    timezone?: string
  ): Promise<AwardTaskPointsResponse> => {
    try {
      const { data, error } = await supabase.rpc('award_task_points', {
        p_user_id: userId,
        p_task_key: taskKey,
        p_completion_date: completionDate,
        p_timezone: timezone || 'UTC',
      });

      if (error) {
        await handleError(error, {
          operation: 'award_task_points',
          component: 'task-service',
          metadata: { userId, taskKey, completionDate, timezone },
        });
        throw error;
      }

      if (!isValidAwardResponse(data)) {
        const invalidError = new Error('Invalid response from award_task_points RPC');
        await handleError(invalidError, {
          operation: 'award_task_points',
          component: 'task-service',
          metadata: { userId, taskKey, completionDate, timezone },
        });
        throw invalidError;
      }

      return data;
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'award_task_points',
        component: 'task-service',
        metadata: { userId, taskKey, completionDate, timezone },
      });
      throw appError;
    }
  },

  /**
   * Log an activity and process rewards (New Event-Driven system)
   */
  logActivity: async (
    activityType: string,
    metadata: Record<string, any> = {},
    idempotencyKey?: string
  ): Promise<LogActivityResponse> => {
    try {
      const { data, error } = await supabase.rpc('log_activity', {
        p_activity_type: activityType,
        p_metadata: metadata,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        await handleError(error, {
          operation: 'log_activity',
          component: 'task-service',
          metadata: { activityType, idempotencyKey },
        });
        throw error;
      }

      return data as LogActivityResponse;
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'log_activity',
        component: 'task-service',
        metadata: { activityType, idempotencyKey },
      });
      throw appError;
    }
  },
};










