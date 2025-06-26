"use client";

import { db } from "../firebase/database";
import { doc, getDoc, setDoc, collection, getDocs, query, where, limit, writeBatch } from 'firebase/firestore';
import { FeatureFlag } from "../utils/feature-flags";

/**
 * Setup script for feature management
 *
 * This script sets up the necessary database structure for enhanced feature management:
 * 1. Creates a featureMetadata document with creation dates and descriptions
 * 2. Creates a featureHistory collection for tracking changes
 * 3. Creates a featureOverrides collection for user-specific overrides
 */
export async function setupFeatureManagement() {
  try {
    console.log('Setting up feature management...');

    // Get current feature flags
    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (!featureFlagsDoc.exists()) {
      console.log('Feature flags document does not exist, creating...');
      await setDoc(featureFlagsRef, {
        payments: false,
        map_view: false,
        calendar_view: false,
        inactive_subscription: false // Admin testing flag
      });
    }

    const flagsData = featureFlagsDoc.exists() ? featureFlagsDoc.data() : {};

    // Create feature metadata
    const featureMetaRef = doc(db, 'config', 'featureMetadata');
    const featureMetaDoc = await getDoc(featureMetaRef);

    if (!featureMetaDoc.exists()) {
      console.log('Feature metadata document does not exist, creating...');

      const now = new Date().toISOString();
      const metadata = {
        payments: {
          createdAt: now,
          lastModified: now,
          description: 'Enable subscription functionality and UI'
        },

        map_view: {
          createdAt: now,
          lastModified: now,
          description: 'Enable map view for pages with location data'
        },
        calendar_view: {
          createdAt: now,
          lastModified: now,
          description: 'Enable calendar view for activity tracking'
        },
        // groups feature removed
        link_functionality: {
          createdAt: now,
          lastModified: now,
          description: 'Enable link creation and editing in page editors'
        }
      };

      await setDoc(featureMetaRef, metadata);
    } else {
      console.log('Feature metadata document exists, checking for missing features...');

      const metaData = featureMetaDoc.data();
      const now = new Date().toISOString();
      const updates = {};

      // Check for missing features in metadata
      Object.keys(flagsData).forEach(flagId => {
        if (!metaData[flagId]) {
          console.log(`Adding missing metadata for feature: ${flagId}`);
          updates[flagId] = {
            createdAt: now,
            lastModified: now,
            description: getDefaultDescription(flagId)
          };
        }
      });

      // Update metadata if needed
      if (Object.keys(updates).length > 0) {
        await setDoc(featureMetaRef, updates, { merge: true });
      }
    }

    // Check if we have any feature history entries
    console.log('Checking feature history collection...');
    const historyRef = collection(db, 'featureHistory');
    const historyQuery = query(historyRef, limit(1));
    const historySnapshot = await getDocs(historyQuery);

    if (historySnapshot.empty) {
      console.log('No feature history found, creating initial history entries...');

      // Create initial history entries for each feature flag
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      Object.keys(flagsData).forEach(flagId => {
        const historyDocRef = doc(collection(db, 'featureHistory'));
        batch.set(historyDocRef, {
          featureId: flagId,
          timestamp: new Date(),
          adminEmail: 'system',
          action: 'initialized',
          details: `Feature flag initialized with value: ${flagsData[flagId] ? 'enabled' : 'disabled'}`
        });
      });

      await batch.commit();
      console.log('Initial history entries created');
    } else {
      console.log('Feature history collection already exists');
    }

    // Check if we have any feature overrides
    console.log('Checking feature overrides collection...');
    const overridesRef = collection(db, 'featureOverrides');
    const overridesQuery = query(overridesRef, limit(1));
    const overridesSnapshot = await getDocs(overridesQuery);

    if (overridesSnapshot.empty) {
      console.log('No feature overrides found, collection is ready for use');
    } else {
      console.log('Feature overrides collection already exists');
    }

    console.log('Feature management setup complete!');
    return { success: true };
  } catch (error) {
    console.error('Error setting up feature management:', error);
    return { success: false, error };
  }
}

/**
 * Get default description for a feature flag
 */
function getDefaultDescription(flagId) {
  const descriptions = {
    subscription_management: 'Enable subscription functionality and UI',
    map_view: 'Enable map view for pages with location data',
    calendar_view: 'Enable calendar view for activity tracking'
    // groups feature removed
  };

  return descriptions[flagId] || `Feature flag for ${flagId}`;
}

/**
 * Component to run the setup script
 */
export default function SetupFeatureManagement() {
  const [isRunning, setIsRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const runSetup = async () => {
    setIsRunning(true);
    try {
      const result = await setupFeatureManagement();
      setResult(result);
    } catch (error) {
      setResult({ success: false, error });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4 border rounded-md">
      <h2 className="text-lg font-semibold mb-2">Feature Management Setup</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Run this script to set up the necessary database structure for enhanced feature management.
      </p>
      <button
        className="px-4 py-2 bg-primary text-white rounded-md"
        onClick={runSetup}
        disabled={isRunning}
      >
        {isRunning ? 'Running...' : 'Run Setup'}
      </button>
      {result && (
        <div className={`mt-4 p-2 rounded-md ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
          {result.success ? 'Setup completed successfully!' : `Error: ${result.error.message}`}
        </div>
      )}
    </div>
  );
}
