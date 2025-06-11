/**
 * Client-side script to enable payments feature flag
 * This script can be run in the browser console to enable the payments feature flag
 */

// Function to toggle payments feature flag from browser console
window.togglePaymentsFeature = async function(enable = null) {
  try {
    console.log('🔧 Toggling payments feature flag...');

    // Import Firebase modules dynamically
    const { db } = await import('../firebase/config.js');
    const { doc, setDoc, getDoc, updateDoc } = await import('firebase/firestore');

    console.log('📡 Connecting to Firebase...');

    // Get current feature flags
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    let currentFlags = {};
    if (featureFlagsDoc.exists()) {
      currentFlags = featureFlagsDoc.data();
      console.log('📋 Current feature flags:', currentFlags);
    } else {
      console.log('📋 No feature flags document found, creating new one...');
    }

    // Determine new state
    const currentState = currentFlags.payments || false;
    const newState = enable !== null ? enable : !currentState;

    console.log(`🔄 Changing payments flag from ${currentState} to ${newState}`);

    // Try updateDoc first (more efficient)
    try {
      await updateDoc(featureFlagsRef, {
        payments: newState
      });
      console.log('✅ Updated using updateDoc');
    } catch (updateError) {
      console.log('⚠️ updateDoc failed, trying setDoc approach:', updateError);
      // Fallback to setDoc with merge
      const updatedFlags = {
        ...currentFlags,
        payments: newState,
        map_view: currentFlags.map_view || false,
        calendar_view: currentFlags.calendar_view || false,
        groups: currentFlags.groups !== undefined ? currentFlags.groups : true,
        notifications: currentFlags.notifications || false,
        link_functionality: currentFlags.link_functionality !== undefined ? currentFlags.link_functionality : true,
        daily_notes: currentFlags.daily_notes || false
      };

      await setDoc(featureFlagsRef, updatedFlags);
      console.log('✅ Updated using setDoc');
    }

    console.log(`✅ Payments feature flag ${newState ? 'enabled' : 'disabled'} successfully!`);
    console.log('🔄 Please refresh the page to see the changes.');

    // Trigger a feature flag refresh event
    try {
      window.dispatchEvent(new CustomEvent('featureFlagChanged', {
        detail: { flagId: 'payments', newValue: newState, timestamp: Date.now() }
      }));
      console.log('📡 Dispatched feature flag change event');
    } catch (eventError) {
      console.warn('⚠️ Could not dispatch feature flag change event:', eventError);
    }

    return { success: true, previousState: currentState, newState: newState };

  } catch (error) {
    console.error('❌ Error toggling payments feature flag:', error);
    console.error('🔍 Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
};

// Function to enable payments feature flag from browser console
window.enablePaymentsFeature = async function() {
  return await window.togglePaymentsFeature(true);
};

// Function to disable payments feature flag from browser console
window.disablePaymentsFeature = async function() {
  return await window.togglePaymentsFeature(false);
};

// Function to check current feature flag status
window.checkFeatureFlags = async function() {
  try {
    console.log('🔍 Checking current feature flags...');
    
    // Import Firebase modules dynamically
    const { db } = await import('../firebase/config.js');
    const { doc, getDoc } = await import('firebase/firestore');
    
    console.log('📡 Connecting to Firebase...');
    
    // Get current feature flags
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);
    
    if (featureFlagsDoc.exists()) {
      const flags = featureFlagsDoc.data();
      console.log('📋 Current feature flags:', flags);
      
      // Check specifically for payments flag
      if (flags.payments === true) {
        console.log('✅ Payments feature flag is ENABLED');
      } else {
        console.log('❌ Payments feature flag is DISABLED or not set');
      }
      
      return { success: true, flags };
    } else {
      console.log('❌ No feature flags document found in Firebase');
      return { success: false, error: 'No feature flags document found' };
    }
    
  } catch (error) {
    console.error('❌ Error checking feature flags:', error);
    return { success: false, error: error.message };
  }
};

// Auto-run check on script load
console.log('🚀 Feature flag management script loaded!');
console.log('💡 Available commands:');
console.log('   - checkFeatureFlags() - Check current feature flag status');
console.log('   - enablePaymentsFeature() - Enable payments feature flag');
console.log('');
console.log('🔍 Running automatic feature flag check...');
window.checkFeatureFlags();

// Auto-enable payments feature flag
console.log('🔧 Auto-enabling payments feature flag...');
window.enablePaymentsFeature();
