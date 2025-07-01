/**
 * Comprehensive Zoom Prevention Utility
 *
 * This utility provides selective protection against unwanted zoom gestures while
 * preserving legitimate zoom functionality and essential touch interactions.
 *
 * Features:
 * - Prevents double-tap zoom gestures on mobile
 * - Prevents pinch-to-zoom gestures on mobile
 * - Prevents trackpad zoom gestures on desktop
 * - ALLOWS keyboard zoom shortcuts (Ctrl/Cmd + Plus/Minus)
 * - Maintains single-tap functionality
 * - Preserves scrolling and panning
 * - Preserves accessibility features
 * - Works across all browsers
 * - Smart detection of legitimate vs unwanted zoom gestures
 */

let lastTouchEnd = 0;
let touchTimeout: NodeJS.Timeout | null = null;
let initialPinchDistance = 0;
let lastPinchDistance = 0;
let isPinching = false;
let touchStartTime = 0;
let activeTouches: Touch[] = [];

/**
 * Initialize comprehensive zoom prevention
 * Should be called once when the app loads
 */
export function initPreventDoubleClickZoom(): void {
  if (typeof window === 'undefined') return;

  // Prevent double-tap zoom using touchend events
  document.addEventListener('touchend', handleTouchEnd, { passive: false });

  // Prevent double-tap zoom using click events (fallback)
  document.addEventListener('click', handleClick, { passive: false });

  // Comprehensive pinch-to-zoom prevention
  document.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });

  // Prevent context menu on long press (can interfere with touch handling)
  document.addEventListener('contextmenu', handleContextMenu, { passive: false });

  // Prevent trackpad zoom gestures (two-finger zoom on trackpads)
  document.addEventListener('wheel', handleWheel, { passive: false });

  console.log('Comprehensive zoom prevention initialized');
}

/**
 * Handle touch start events to detect pinch gestures
 */
function handleTouchStart(event: TouchEvent): void {
  const touches = Array.from(event.touches);
  activeTouches = touches;
  touchStartTime = Date.now();

  // Reset pinch detection
  isPinching = false;
  initialPinchDistance = 0;
  lastPinchDistance = 0;

  // If multiple touches, prepare for potential pinch detection
  if (touches.length >= 2) {
    const touch1 = touches[0];
    const touch2 = touches[1];

    // Calculate initial distance between touches
    initialPinchDistance = calculateDistance(touch1, touch2);
    lastPinchDistance = initialPinchDistance;

    // Mark as potential pinch gesture
    isPinching = true;

    console.log('Multi-touch detected, monitoring for pinch gesture');
  }
}

/**
 * Handle touch end events to prevent double-tap zoom and clean up pinch detection
 */
function handleTouchEnd(event: TouchEvent): void {
  const now = Date.now();
  const remainingTouches = Array.from(event.touches);

  // Clean up pinch detection when touches end
  if (remainingTouches.length < 2) {
    isPinching = false;
    initialPinchDistance = 0;
    lastPinchDistance = 0;
  }

  // Update active touches
  activeTouches = remainingTouches;

  // Double-tap detection (only for single touch)
  if (remainingTouches.length === 0) {
    // Check if this is a potential double-tap (within 300ms of last touch)
    if (now - lastTouchEnd <= 300) {
      // This is a double-tap, prevent default behavior
      event.preventDefault();
      event.stopPropagation();

      // Clear any pending timeout
      if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
      }

      console.log('Double-tap zoom prevented');
      return;
    }

    lastTouchEnd = now;

    // Set a timeout to reset the double-tap detection
    if (touchTimeout) {
      clearTimeout(touchTimeout);
    }

    touchTimeout = setTimeout(() => {
      lastTouchEnd = 0;
    }, 300);
  }
}

/**
 * Handle click events as a fallback for double-tap prevention
 */
function handleClick(event: MouseEvent): void {
  // Only prevent on touch devices
  if (!('ontouchstart' in window)) return;
  
  const target = event.target as HTMLElement;
  
  // Allow clicks on interactive elements
  if (isInteractiveElement(target)) return;
  
  // Check for rapid successive clicks (potential double-tap)
  const now = Date.now();
  if (now - lastTouchEnd <= 100) {
    event.preventDefault();
    event.stopPropagation();
    console.log('Rapid click zoom prevented');
    return false;
  }
}

/**
 * Handle touch move events to prevent pinch-to-zoom while preserving scrolling
 */
function handleTouchMove(event: TouchEvent): void {
  const touches = Array.from(event.touches);
  activeTouches = touches;

  // Handle multi-touch gestures (potential pinch)
  if (touches.length >= 2 && isPinching) {
    const touch1 = touches[0];
    const touch2 = touches[1];

    // Calculate current distance between touches
    const currentDistance = calculateDistance(touch1, touch2);

    // Check if this is a zoom gesture (significant distance change)
    const distanceChange = Math.abs(currentDistance - lastPinchDistance);
    const distanceChangeRatio = Math.abs(currentDistance - initialPinchDistance) / initialPinchDistance;

    // Prevent zoom if:
    // 1. Distance change is significant (> 10px)
    // 2. Distance change ratio is > 5% (indicates zoom intent)
    // 3. Gesture has been active for more than 100ms (not accidental)
    const gestureTime = Date.now() - touchStartTime;

    if ((distanceChange > 10 || distanceChangeRatio > 0.05) && gestureTime > 100) {
      event.preventDefault();
      event.stopPropagation();
      console.log('Pinch-to-zoom gesture prevented', {
        distanceChange,
        distanceChangeRatio: (distanceChangeRatio * 100).toFixed(1) + '%',
        gestureTime: gestureTime + 'ms'
      });
      return;
    }

    // Update last distance for next comparison
    lastPinchDistance = currentDistance;
  }

  // Allow single-finger scrolling and panning
  if (touches.length === 1) {
    // Single touch - allow normal scrolling
    return;
  }

  // For any other multi-touch scenarios, be conservative and prevent
  if (touches.length > 2) {
    event.preventDefault();
    console.log('Multi-touch gesture (>2 fingers) prevented');
  }
}

/**
 * Handle context menu events (can interfere with touch handling)
 */
function handleContextMenu(event: MouseEvent): void {
  // Only prevent on touch devices during active touch interactions
  if (('ontouchstart' in window) && activeTouches.length > 0) {
    event.preventDefault();
    console.log('Context menu prevented during touch interaction');
  }
}

/**
 * Handle wheel events to prevent trackpad zoom gestures
 */
function handleWheel(event: WheelEvent): void {
  // Prevent trackpad zoom gestures (two-finger zoom on trackpads)
  // These are detected as wheel events with ctrlKey on many systems
  if (event.ctrlKey || event.metaKey) {
    // Check if this is likely a trackpad gesture vs intentional keyboard zoom
    // Trackpad gestures typically have smaller, more frequent deltaY values
    const isLikelyTrackpadGesture = Math.abs(event.deltaY) < 50 && event.deltaX === 0;

    if (isLikelyTrackpadGesture) {
      event.preventDefault();
      console.log('Trackpad zoom gesture prevented');
    }
    // Allow keyboard zoom shortcuts (Ctrl/Cmd + wheel when deltaY is large)
  }

  // Also prevent zoom on wheel events without modifier keys on touch devices
  // This catches some trackpad zoom gestures that don't set ctrlKey
  if (('ontouchstart' in window) && Math.abs(event.deltaY) > 10) {
    const isZoomGesture = event.deltaY !== 0 && event.deltaX === 0 && !event.shiftKey;
    if (isZoomGesture) {
      event.preventDefault();
      console.log('Touch device wheel zoom prevented');
    }
  }
}

/**
 * Calculate distance between two touch points
 */
function calculateDistance(touch1: Touch, touch2: Touch): number {
  const deltaX = touch2.clientX - touch1.clientX;
  const deltaY = touch2.clientY - touch1.clientY;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

/**
 * Check if an element is interactive and should allow normal click behavior
 */
function isInteractiveElement(element: HTMLElement): boolean {
  const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  const interactiveRoles = ['button', 'link', 'menuitem', 'tab'];
  
  // Check tag name
  if (interactiveTags.includes(element.tagName)) return true;
  
  // Check role attribute
  const role = element.getAttribute('role');
  if (role && interactiveRoles.includes(role)) return true;
  
  // Check if element has click handlers
  if (element.onclick || element.getAttribute('onclick')) return true;
  
  // Check if element is focusable
  if (element.tabIndex >= 0) return true;
  
  // Check parent elements (up to 3 levels)
  let parent = element.parentElement;
  let depth = 0;
  while (parent && depth < 3) {
    if (interactiveTags.includes(parent.tagName)) return true;
    const parentRole = parent.getAttribute('role');
    if (parentRole && interactiveRoles.includes(parentRole)) return true;
    parent = parent.parentElement;
    depth++;
  }
  
  return false;
}

/**
 * Clean up event listeners (for testing or component unmounting)
 */
export function cleanupPreventDoubleClickZoom(): void {
  if (typeof window === 'undefined') return;

  document.removeEventListener('touchstart', handleTouchStart);
  document.removeEventListener('touchend', handleTouchEnd);
  document.removeEventListener('touchmove', handleTouchMove);
  document.removeEventListener('click', handleClick);
  document.removeEventListener('contextmenu', handleContextMenu);
  document.removeEventListener('wheel', handleWheel);

  if (touchTimeout) {
    clearTimeout(touchTimeout);
    touchTimeout = null;
  }

  // Reset state
  isPinching = false;
  initialPinchDistance = 0;
  lastPinchDistance = 0;
  activeTouches = [];

  console.log('Comprehensive zoom prevention cleaned up');
}

/**
 * Check if the current device is likely to have double-tap zoom issues
 */
export function needsDoubleClickZoomPrevention(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check for mobile user agent
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Check viewport width (mobile-sized)
  const isMobileViewport = window.innerWidth <= 768;
  
  return hasTouch && (isMobile || isMobileViewport);
}

/**
 * Initialize double-click zoom prevention only if needed
 */
export function conditionallyInitPreventDoubleClickZoom(): void {
  if (needsDoubleClickZoomPrevention()) {
    initPreventDoubleClickZoom();
  } else {
    console.log('Double-click zoom prevention not needed on this device');
  }
}