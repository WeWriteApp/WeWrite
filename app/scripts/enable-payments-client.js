/**
 * Client-side script to enable payments feature flag
 * This script can be run in the browser console to enable the payments feature flag
 */

// Function to enable payments feature flag from browser console
window.enablePaymentsFeature = async function() {
  try {
    console.log('🔧 Enabling payments feature flag...');
    
    // Import Firebase modules dynamically
    const { db } = await import('../firebase/config.js');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    
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
    
    // Enable payments feature flag
    const updatedFlags = {
      ...currentFlags,
      payments: true,
      map_view: currentFlags.map_view || false,
      calendar_view: currentFlags.calendar_view || false,
      groups: currentFlags.groups !== undefined ? currentFlags.groups : true,
      notifications: currentFlags.notifications || false,
      link_functionality: currentFlags.link_functionality !== undefined ? currentFlags.link_functionality : true,
      daily_notes: currentFlags.daily_notes || false
    };
    
    console.log('💾 Updating feature flags...');
    await setDoc(featureFlagsRef, updatedFlags);
    
    console.log('✅ Payments feature flag enabled successfully!');
    console.log('📊 Updated feature flags:', updatedFlags);
    console.log('🔄 Please refresh the page to see the changes.');
    
    return { success: true, flags: updatedFlags };
    
  } catch (error) {
    console.error('❌ Error enabling payments feature flag:', error);
    return { success: false, error: error.message };
  }
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
