/**
 * Pet Service
 * Handles pet state database operations
 */

import { supabase } from '@/lib/supabase';
import { handleError } from '@/lib/errors';
import type { PetState } from '@/lib/store/types';

export const petService = {
  /**
   * Load pet state from database
   */
  loadPetState: async (userId: string): Promise<PetState | null> => {
    try {
      const { data, error } = await supabase
        .from('pet_states')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        await handleError(error, {
          operation: 'load_pet_state',
          component: 'pet-service',
          metadata: { userId },
        });
        return null;
      }

      if (data) {
        return {
          stage: (data as any).current_stage || (data as any).stage,
          points: (data as any).current_points || (data as any).points,
          name: data.name || 'Nova',
          mood: (data.mood as any) || 'happy',
        };
      }

      return null;
    } catch (error) {
      await handleError(error, {
        operation: 'load_pet_state',
        component: 'pet-service',
        metadata: { userId },
      });
      return null;
    }
  },

  /**
   * Save pet state to database
   */
  savePetState: async (userId: string, petState: PetState): Promise<void> => {
    try {
      // Default pet names that should not overwrite custom names
      const DEFAULT_PET_NAMES = ['Nova', 'Sparky', 'Pet', 'Bridget', 'Holian', ''];

      // 1. Fetch current database state to prevent downgrading progress or losing custom name
      const { data: existing } = await supabase
        .from('pet_states')
        .select('current_points, name' as any)
        .eq('user_id', userId)
        .single();

      let pointsToSave = petState.points;
      let nameToSave = petState.name;

      if (existing) {
        const dbPoints = (existing as any).current_points || 0;
        const dbName = (existing as any).name;

        // Points protection: prevent downgrade
        if (petState.points < dbPoints) {
          console.warn(`[PetService] Progress protection: preventing downgrade from ${dbPoints} back to ${petState.points}. Using ${dbPoints}.`);
          pointsToSave = dbPoints;
        }

        // Name protection: if DB has a custom name and incoming name is a default, preserve DB name
        const dbHasCustomName = dbName && dbName.trim() !== '' && !DEFAULT_PET_NAMES.includes(dbName.trim());
        const incomingIsDefault = !petState.name || petState.name.trim() === '' || DEFAULT_PET_NAMES.includes(petState.name.trim());

        if (dbHasCustomName && incomingIsDefault) {
          console.warn(`[PetService] Name protection: preserving custom name "${dbName}" instead of default "${petState.name}".`);
          nameToSave = dbName as string;
        }
      }

      // Create a timeout promise to prevent hanging the UI
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Save pet state timed out after 5s')), 5000)
      );

      const upsertPromise = supabase
        .from('pet_states')
        .upsert(
          {
            user_id: userId,
            current_stage: Math.floor(pointsToSave / 100) + 1,
            current_points: pointsToSave,
            name: nameToSave,
            mood: petState.mood,
          } as any,
          {
            onConflict: 'user_id',
          }
        );

      const { error } = (await Promise.race([upsertPromise, timeoutPromise])) as any;

      if (error) {
        await handleError(error, {
          operation: 'save_pet_state',
          component: 'pet-service',
          metadata: { userId, petState },
        });
        throw error;
      }
    } catch (error) {
      const appError = await handleError(error, {
        operation: 'save_pet_state',
        component: 'pet-service',
        metadata: { userId, petState },
      });
      throw appError;
    }
  },
};










