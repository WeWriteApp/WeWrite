/**
 * Feature flags system for WeWrite
 * Controls which features are enabled for different users
 */

// Feature flag definitions
export const FEATURE_FLAGS = {
  LINK_INSERTION: 'link_insertion',
  PAYMENTS: 'payments',
  GROUPS: 'groups',
  MAP_VIEW: 'map_view',
  CALENDAR_VIEW: 'calendar_view',
  NOTIFICATIONS: 'notifications',
  USERNAME_MANAGEMENT: 'username_management',
  LINK_FUNCTIONALITY: 'link_functionality',
  // Add more feature flags here as needed
};

// Users who have access to specific features
const FEATURE_ACCESS = {
  [FEATURE_FLAGS.LINK_INSERTION]: [
    'jamiegray2234@gmail.com', // Admin user
    // Add more user emails here to grant access
  ],
  [FEATURE_FLAGS.PAYMENTS]: [
    // PAYMENTS FEATURE DISABLED - No users have access regardless of email
    // This feature is controlled by database feature flags
  ],
  [FEATURE_FLAGS.GROUPS]: [
    'jamiegray2234@gmail.com', // Admin user
    // Add more user emails here to grant access
  ],
  [FEATURE_FLAGS.MAP_VIEW]: [
    'jamiegray2234@gmail.com', // Admin user
    // Add more user emails here to grant access
  ],
  [FEATURE_FLAGS.CALENDAR_VIEW]: [
    'jamiegray2234@gmail.com', // Admin user
    // Add more user emails here to grant access
  ],
  [FEATURE_FLAGS.NOTIFICATIONS]: [
    'jamiegray2234@gmail.com', // Admin user
    // Add more user emails here to grant access
  ],
  [FEATURE_FLAGS.USERNAME_MANAGEMENT]: [
    'jamiegray2234@gmail.com', // Admin user
    // Add more user emails here to grant access
  ],
  [FEATURE_FLAGS.LINK_FUNCTIONALITY]: [
    'jamiegray2234@gmail.com', // Admin user
    // Add more user emails here to grant access
  ],
};

/**
 * Check if a feature is enabled for a specific user
 * @param {string} featureFlag - The feature flag to check
 * @param {string} userEmail - The user's email address
 * @returns {boolean} - Whether the feature is enabled for this user
 */
export const isFeatureEnabled = (featureFlag, userEmail) => {
  if (!featureFlag || !userEmail) {
    return false;
  }

  // Check if the feature flag exists
  if (!FEATURE_ACCESS[featureFlag]) {
    console.warn(`Unknown feature flag: ${featureFlag}`);
    return false;
  }

  // Check if the user has access to this feature
  return FEATURE_ACCESS[featureFlag].includes(userEmail);
};

/**
 * Check if link insertion is enabled for a user
 * @param {string} userEmail - The user's email address
 * @returns {boolean} - Whether link insertion is enabled
 */
export const isLinkInsertionEnabled = (userEmail) => {
  return isFeatureEnabled(FEATURE_FLAGS.LINK_INSERTION, userEmail);
};

/**
 * Get all enabled features for a user
 * @param {string} userEmail - The user's email address
 * @returns {string[]} - Array of enabled feature flags
 */
export const getEnabledFeatures = (userEmail) => {
  if (!userEmail) {
    return [];
  }

  return Object.keys(FEATURE_ACCESS).filter(featureFlag =>
    isFeatureEnabled(featureFlag, userEmail)
  );
};

/**
 * Add a user to a feature flag (for dynamic feature management)
 * @param {string} featureFlag - The feature flag
 * @param {string} userEmail - The user's email address
 */
export const addUserToFeature = (featureFlag, userEmail) => {
  if (!FEATURE_ACCESS[featureFlag]) {
    console.warn(`Unknown feature flag: ${featureFlag}`);
    return;
  }

  if (!FEATURE_ACCESS[featureFlag].includes(userEmail)) {
    FEATURE_ACCESS[featureFlag].push(userEmail);
  }
};

/**
 * Remove a user from a feature flag
 * @param {string} featureFlag - The feature flag
 * @param {string} userEmail - The user's email address
 */
export const removeUserFromFeature = (featureFlag, userEmail) => {
  if (!FEATURE_ACCESS[featureFlag]) {
    console.warn(`Unknown feature flag: ${featureFlag}`);
    return;
  }

  const index = FEATURE_ACCESS[featureFlag].indexOf(userEmail);
  if (index > -1) {
    FEATURE_ACCESS[featureFlag].splice(index, 1);
  }
};
