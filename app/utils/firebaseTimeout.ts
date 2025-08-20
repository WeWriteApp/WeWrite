/**
 * Firebase Query Timeout Utilities
 * 
 * Provides timeout wrappers for Firebase operations to prevent hanging requests
 */

/**
 * Wraps a Firebase operation with a timeout to prevent hanging
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = 8000,
  operationName: string = 'Firebase operation'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } catch (error: any) {
    if (error.message.includes('timed out')) {
      console.error(`🚨 TIMEOUT: ${operationName} exceeded ${timeoutMs}ms`);
      throw new Error(`Request timeout: ${operationName} took too long to complete`);
    }
    throw error;
  }
}

/**
 * Wraps a Firestore document get operation with timeout
 */
export async function getDocWithTimeout(
  docRef: any,
  timeoutMs: number = 8000
): Promise<any> {
  return withTimeout(
    docRef.get(),
    timeoutMs,
    `Firestore document get (${docRef.path})`
  );
}

/**
 * Wraps a Firestore query with timeout
 */
export async function queryWithTimeout(
  query: any,
  timeoutMs: number = 8000
): Promise<any> {
  return withTimeout(
    query.get(),
    timeoutMs,
    'Firestore query'
  );
}
