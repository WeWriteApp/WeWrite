/**
 * Utility functions for creating flash animations
 */

/**
 * Creates a subtle green flash animation on the specified element
 * @param {HTMLElement} element - The element to flash
 * @param {Object} options - Animation options
 * @param {number} options.duration - Animation duration in milliseconds (default: 600)
 * @param {string} options.color - Flash color (default: 'rgba(34, 197, 94, 0.15)')
 * @param {string} options.easing - CSS easing function (default: 'ease-out')
 */
export function flashElement(element, options = {}) {
  if (!element) return;

  const {
    duration = 600,
    color = 'rgba(34, 197, 94, 0.15)', // green-500 with 15% opacity
    easing = 'ease-out'
  } = options;

  // Store original background
  const originalBackground = element.style.backgroundColor;
  const originalTransition = element.style.transition;

  // Apply flash effect
  element.style.transition = `background-color ${duration}ms ${easing}`;
  element.style.backgroundColor = color;

  // Remove flash effect after duration
  setTimeout(() => {
    element.style.backgroundColor = originalBackground;
    
    // Clean up transition after animation completes
    setTimeout(() => {
      element.style.transition = originalTransition;
    }, duration);
  }, 100); // Brief delay to ensure the flash is visible
}

/**
 * Creates a green flash animation on the page content area
 * Specifically targets the main content container
 */
export function flashPageContent() {
  // Try multiple selectors to find the main content area
  const selectors = [
    '.page-content',
    '[data-page-content]',
    '.space-y-2.w-full.transition-all', // From SinglePageView
    'main'
  ];

  let targetElement = null;
  
  for (const selector of selectors) {
    targetElement = document.querySelector(selector);
    if (targetElement) break;
  }

  if (targetElement) {
    flashElement(targetElement, {
      duration: 600,
      color: 'rgba(34, 197, 94, 0.12)', // Subtle green flash
      easing: 'ease-out'
    });
  } else {
    console.warn('Could not find page content element to flash');
  }
}

/**
 * Sets up event listener for page save success events
 * Call this once when the page component mounts
 */
export function setupSaveSuccessFlash() {
  const handleSaveSuccess = (event) => {
    console.log('Page save success detected, triggering flash animation');
    flashPageContent();
  };

  // Add event listener
  window.addEventListener('page-save-success', handleSaveSuccess);

  // Return cleanup function
  return () => {
    window.removeEventListener('page-save-success', handleSaveSuccess);
  };
}
