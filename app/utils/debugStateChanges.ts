'use client';

/**
 * Debug utility to track React state changes that might be causing the allocation bar error
 */

let stateChangeCounter = 0;

export function logStateChange(componentName: string, stateName: string, oldValue: any, newValue: any, extra?: any) {
  stateChangeCounter++;
  
  console.log(`🔄 [StateChange #${stateChangeCounter}] ${componentName}.${stateName}:`, {
    componentName,
    stateName,
    oldValue,
    newValue,
    changed: oldValue !== newValue,
    timestamp: new Date().toISOString(),
    extra,
    stackTrace: new Error().stack?.split('\n').slice(0, 8).join('\n')
  });
}

export function logComponentRender(componentName: string, props?: any, state?: any) {
  console.log(`🎨 [Render] ${componentName}:`, {
    componentName,
    props,
    state,
    timestamp: new Date().toISOString(),
    stackTrace: new Error().stack?.split('\n').slice(0, 5).join('\n')
  });
}

export function logAllocationEvent(eventType: string, data: any) {
  console.log(`💰 [AllocationEvent] ${eventType}:`, {
    eventType,
    data,
    timestamp: new Date().toISOString(),
    stackTrace: new Error().stack?.split('\n').slice(0, 8).join('\n')
  });
}
