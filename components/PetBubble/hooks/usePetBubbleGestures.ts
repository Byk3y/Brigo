import { useRef, useCallback, useEffect } from 'react';
import { PanResponder, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { useFeedback } from '@/lib/feedback';
import { ANIMATION_CONFIG, PET_SIZE, TOP_PADDING, BOTTOM_PADDING } from '../constants';
import {
  calculateTopLeftBounds,
  clampTopLeftPosition,
  convertTopLeftToCenter,
  convertCenterToTopLeft,
  calculateEdgeSnapTarget,
  getHorizontalInset,
  type Position,
  type ScreenDimensions,
  type SafeAreaInsets,
} from '../utils/positionCalculations';

interface UsePetBubbleGesturesConfig {
  position: Position;
  positionRef: React.MutableRefObject<Position>;
  setPosition: (position: Position | ((prev: Position) => Position)) => void;
  screenDimensions: ScreenDimensions;
  insets: SafeAreaInsets;
  // Animation hooks
  scaleAnim: Animated.Value;
  panX: Animated.Value;
  panY: Animated.Value;
  leftAnim: Animated.Value;
  topAnim: Animated.Value;
  currentPanX: React.MutableRefObject<number>;
  currentPanY: React.MutableRefObject<number>;
  isDragging: React.MutableRefObject<boolean>;
  stopIdleAnimation: () => void;
  scaleUp: () => void;
  scaleDown: (callback?: () => void) => void;
  resetPanValues: (needsResetX: boolean, needsResetY: boolean, callback?: () => void) => void;
  animateEdgeSnap: (needsXAnimation: boolean, needsYAnimation: boolean, callback?: () => void) => void;
  setPanValues: (x: number, y: number) => void;
  setAllAnimatedValues: (position: Position, panXValue: number, panYValue: number) => void;
  startIdleAnimation: () => void;
  scale?: number;
  // Pet state for per-image edge offsets
  stage?: number;
  isDying?: boolean;
}

/**
 * Hook to manage pet bubble gesture handling (drag, tap, edge snapping)
 */
export function usePetBubbleGestures(config: UsePetBubbleGesturesConfig) {
  const { scale = 1.0, stage = 1, isDying: isPetDying = false } = config;
  const router = useRouter();
  const { authUser } = useStore();
  const { play } = useFeedback();
  const hasMoved = useRef(false);

  // Navigation guard to prevent duplicate rapid taps
  const isNavigating = useRef(false);
  const navigationCooldown = useRef<NodeJS.Timeout | null>(null);

  const {
    position,
    positionRef,
    setPosition,
    screenDimensions,
    insets,
    scaleAnim,
    panX,
    panY,
    leftAnim,
    topAnim,
    currentPanX,
    currentPanY,
    isDragging,
    stopIdleAnimation,
    scaleUp,
    scaleDown,
    resetPanValues,
    animateEdgeSnap,
    setPanValues,
    setAllAnimatedValues,
    startIdleAnimation,
  } = config;

  // Use refs to always get latest values in PanResponder handlers (fixes closure issue)
  const screenDimensionsRef = useRef(screenDimensions);
  const insetsRef = useRef(insets);

  // Update refs whenever values change
  useEffect(() => {
    screenDimensionsRef.current = screenDimensions;
  }, [screenDimensions]);

  useEffect(() => {
    insetsRef.current = insets;
  }, [insets]);

  // Cleanup navigation cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (navigationCooldown.current) {
        clearTimeout(navigationCooldown.current);
      }
    };
  }, []);

  const openPetSheet = useCallback(() => {
    if (!authUser) return;

    // Guard against multiple rapid taps
    if (isNavigating.current) {
      return;
    }

    // Set navigation guard
    isNavigating.current = true;

    // Clear any existing cooldown
    if (navigationCooldown.current) {
      clearTimeout(navigationCooldown.current);
    }

    // Play haptic feedback
    play('tap');

    // Navigate to pet sheet
    router.push('/pet-sheet');

    // Reset guard after cooldown period (300ms is enough for navigation to start)
    navigationCooldown.current = setTimeout(() => {
      isNavigating.current = false;
    }, 300);
  }, [authUser, play, router]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only activate if movement is significant (prevents accidental activation)
        const moveDistance = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);
        return moveDistance > ANIMATION_CONFIG.movementThreshold;
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
        hasMoved.current = false; // Reset movement flag
        currentPanX.current = 0; // Reset pan tracking
        currentPanY.current = 0; // Reset pan tracking
        stopIdleAnimation();
        scaleUp();
      },
      onPanResponderMove: (_, gestureState) => {
        // Mark that user has moved
        if (
          Math.abs(gestureState.dx) > ANIMATION_CONFIG.movementDetectionThreshold ||
          Math.abs(gestureState.dy) > ANIMATION_CONFIG.movementDetectionThreshold
        ) {
          hasMoved.current = true;
        }

        // Suppress position updates while still inside the sub-threshold dead
        // zone. iOS's gesture system filters these micro-movements before
        // onPanResponderMove fires, but Android forwards every raw touch
        // sample — so capacitive noise at finger-down would shift the bubble
        // a pixel or two on tap. Once hasMoved flips true, drag behavior is
        // identical to before.
        if (!hasMoved.current) return;

        // Use ref to get latest position (avoids stale closure)
        const currentPos = positionRef.current;
        // Use refs to get latest screen dimensions and insets (fixes closure issue)
        const currentScreenDimensions = screenDimensionsRef.current;
        const currentInsets = insetsRef.current;

        // Calculate the base visual position (top-left corner)
        const size = PET_SIZE * scale;
        const baseLeft = currentPos.x - size / 2;
        const baseTop = currentPos.y - size / 2;

        // Get bounds for top-left corner
        const bounds = calculateTopLeftBounds(currentScreenDimensions, currentInsets, scale);

        // Calculate where the bubble would be with the gesture movement
        const potentialLeft = baseLeft + gestureState.dx;
        const potentialTop = baseTop + gestureState.dy;

        // Clamp the potential position to stay within bounds (creating the "wall" effect)
        const clamped = clampTopLeftPosition(potentialLeft, potentialTop, bounds);

        // Calculate how much we can actually move (the clamped deltas)
        const clampedDx = clamped.left - baseLeft;
        const clampedDy = clamped.top - baseTop;

        // Update pan values with clamped deltas - this creates the "wall" that prevents
        // the bubble from visually entering the edge area
        setPanValues(clampedDx, clampedDy);
      },
      onPanResponderRelease: (_, gestureState) => {
        isDragging.current = false;

        // Detect tap vs drag - use both movement flag and distance
        const totalDistance = Math.sqrt(gestureState.dx ** 2 + gestureState.dy ** 2);
        const isTap = !hasMoved.current && totalDistance < ANIMATION_CONFIG.tapThreshold;

        if (isTap) {
          // Tap detected - only reset if pan values are non-zero to avoid jump
          const needsResetX = Math.abs(currentPanX.current) > 0.1;
          const needsResetY = Math.abs(currentPanY.current) > 0.1;

          resetPanValues(needsResetX, needsResetY, () => {
            startIdleAnimation();
          });
          openPetSheet();
          return;
        }

        // Drag detected - calculate new position with edge snapping
        // Use ref to get latest position (avoids stale closure)
        const currentPos = positionRef.current;
        // Use refs to get latest screen dimensions and insets (fixes closure issue)
        const currentScreenDimensions = screenDimensionsRef.current;
        const currentInsets = insetsRef.current;

        // Calculate the base visual position (top-left corner)
        const size = PET_SIZE * scale;
        const baseLeft = currentPos.x - size / 2;
        const baseTop = currentPos.y - size / 2;

        // Get bounds for top-left corner
        const bounds = calculateTopLeftBounds(currentScreenDimensions, currentInsets, scale);

        // Calculate where the bubble would be with the gesture movement
        const potentialLeft = baseLeft + gestureState.dx;
        const potentialTop = baseTop + gestureState.dy;

        // Clamp the potential position to stay within bounds
        const clamped = clampTopLeftPosition(potentialLeft, potentialTop, bounds);

        // Convert back to center coordinates for position state
        const clampedCenter = {
          x: clamped.left + size / 2,
          y: clamped.top + size / 2,
        };

        // Double-check: Clamp center Y to proper bounds (should match the render bounds)
        const horizontalInset = getHorizontalInset(currentInsets);
        const minCenterY = currentInsets.top + size / 2 + TOP_PADDING;
        const maxCenterY = currentScreenDimensions.height - currentInsets.bottom - size / 2 - BOTTOM_PADDING;
        const finalClampedY = Math.max(minCenterY, Math.min(maxCenterY, clampedCenter.y));

        // Determine which edge to snap to (horizontal only)
        const symmetricTargetX = calculateEdgeSnapTarget(
          clampedCenter.x,
          currentScreenDimensions,
          currentInsets,
          scale,
          stage,
          isPetDying
        );

        // Calculate current position and pan values
        const currentX = currentPos.x;
        const currentY = currentPos.y;
        const currentPanXValue = currentPanX.current;
        const currentPanYValue = currentPanY.current;

        // Calculate current visual position (where bubble actually is on screen)
        const currentVisualX = currentX + currentPanXValue;
        const currentVisualY = currentY + currentPanYValue;

        // Calculate the offset needed to reach target from current visual position
        const visualOffsetX = symmetricTargetX - currentVisualX;
        const visualOffsetY = finalClampedY - currentVisualY;

        // Check which axes need animation
        const needsXAnimation = Math.abs(visualOffsetX) > 0.1;
        const needsYAnimation = Math.abs(visualOffsetY) > 0.1;

        if (!needsXAnimation && !needsYAnimation) {
          // Already at target - need to update position WITHOUT visual jump
          const targetPosition: Position = { x: symmetricTargetX, y: finalClampedY };

          // CRITICAL: Set ALL animated values synchronously BEFORE React state update
          // This prevents layout recalculation flash
          setAllAnimatedValues(targetPosition, 0, 0);

          // Now update position state - React will render but animated values are already correct
          setPosition(targetPosition);
          positionRef.current = targetPosition;

          // Scale back to normal
          scaleDown(() => {
            startIdleAnimation();
          });
          return;
        }

        // CRITICAL FIX: Update position state accounting for current pan values
        // Strategy: Set position to target, but adjust pan values to maintain visual position
        // Then animate pan values to 0, which smoothly moves visual position to target
        const targetPosition: Position = { x: symmetricTargetX, y: finalClampedY };

        // Calculate what pan values should be to maintain current visual position
        // visual = position + pan, so pan = visual - position
        const adjustedPanX = currentVisualX - symmetricTargetX;
        const adjustedPanY = currentVisualY - finalClampedY;

        // CRITICAL FIX: Set ALL animated values synchronously BEFORE any React state update
        // This ensures native animated values are correct when React renders
        // No layout recalculation flash because we're updating animated values, not layout props
        setAllAnimatedValues(targetPosition, adjustedPanX, adjustedPanY);

        // Now update position state - React will render but animated values are already correct
        setPosition(targetPosition);
        positionRef.current = targetPosition;

        // Animate to target
        animateEdgeSnap(needsXAnimation, needsYAnimation, () => {
          startIdleAnimation();
        });
      },
    })
  ).current;

  return {
    panResponder,
  };
}

