import React, { useEffect } from 'react';
import { Animated, Image } from 'react-native';
import { useStore } from '@/lib/store';
import { PET_SIZE, PET_STAGE_SCALES } from './PetBubble/constants';
import { getPetBubbleImage } from './PetBubble/utils/getPetBubbleImage';
import { usePetBubblePosition } from './PetBubble/hooks/usePetBubblePosition';
import { usePetBubbleAnimations } from './PetBubble/hooks/usePetBubbleAnimations';
import { usePetBubbleGestures } from './PetBubble/hooks/usePetBubbleGestures';
import { getLocalDateString } from '@/lib/utils/time';
import { AttachStep } from 'react-native-spotlight-tour';

export const PetBubble: React.FC = () => {
  const { user, petState, dailyTasks } = useStore();
  // ... (rest of the logic remains the same)
  // Check if secure_pet task is already completed today
  const today = getLocalDateString();
  const secureTask = dailyTasks?.find(t => t.task_key === 'secure_pet');

  const isSecureTaskCompletedToday = secureTask?.completed && (
    !secureTask.completed_at || secureTask.completed_at.startsWith(today)
  );

  const hasUserDataLoaded = user.id !== '' && (user.streak > 0 || user.last_streak_date !== undefined);

  // New users (streak=0, no last_streak_date) should NOT see dying pet
  // Only users with an existing streak that hasn't been secured today are "at risk"
  const isAtRisk = hasUserDataLoaded
    ? (user.streak > 0 && user.last_streak_date !== today && !isSecureTaskCompletedToday)
    : false;

  const recoverableStreak = user.meta?.last_recoverable_streak ?? 0;
  const isStreakLost = user.streak === 0 && recoverableStreak > 0;

  const isDying = isAtRisk || isStreakLost;

  const bubbleImage = getPetBubbleImage(petState.stage, isDying);

  let stageScale = PET_STAGE_SCALES[petState.stage] || 1.0;

  if (isDying && petState.stage === 2) {
    stageScale = 0.85;
  }

  if (isDying && petState.stage === 1) {
    stageScale = 1.15;
  }

  const bubbleSize = PET_SIZE * stageScale;

  const { position, setPosition, positionRef, screenDimensions, insets } = usePetBubblePosition({
    scale: stageScale,
    stage: petState.stage,
    isDying,
  });

  const animations = usePetBubbleAnimations(position, stageScale);

  useEffect(() => {
    animations.updatePosition(position);
  }, [position.x, position.y, animations.updatePosition]);

  const { panResponder } = usePetBubbleGestures({
    position,
    positionRef,
    setPosition,
    screenDimensions,
    insets,
    scale: stageScale,
    stage: petState.stage,
    isDying,
    scaleAnim: animations.scaleAnim,
    panX: animations.panX,
    panY: animations.panY,
    leftAnim: animations.leftAnim,
    topAnim: animations.topAnim,
    currentPanX: animations.currentPanX,
    currentPanY: animations.currentPanY,
    isDragging: animations.isDragging,
    stopIdleAnimation: animations.stopIdleAnimation,
    scaleUp: animations.scaleUp,
    scaleDown: animations.scaleDown,
    resetPanValues: animations.resetPanValues,
    animateEdgeSnap: animations.animateEdgeSnap,
    setPanValues: animations.setPanValues,
    setAllAnimatedValues: animations.setAllAnimatedValues,
    startIdleAnimation: animations.startIdleAnimation,
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: animations.leftAnim,
        top: animations.topAnim,
        transform: [
          { translateX: animations.panX },
          { translateY: animations.panY },
        ],
        zIndex: 50,
      }}
      {...panResponder.panHandlers}
    >
      {/* @ts-ignore - Library type mismatch for children */}
      <AttachStep index={2}>
        <Animated.View
          collapsable={false}
          style={{
            transform: [{ scale: animations.scaleAnim }],
            ...(isDying && {
              shadowColor: '#EF4444',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 12,
              elevation: 8,
            })
          }}
          className="items-center justify-center"
        >
          <Image
            source={bubbleImage}
            style={{ width: bubbleSize, height: bubbleSize }}
            resizeMode="contain"
          />
        </Animated.View>
      </AttachStep>
    </Animated.View>
  );
};


