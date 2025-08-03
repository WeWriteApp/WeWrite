// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { pageApi } from './apiClient';

async function checkLinkExistence(links) {
  const promises = [];
  const results = {};

  for (let url of links) {
    // Strip "/pages/" from the URL to get the document ID
    const documentId = url.replace("/pages/", "").trim();

    if (isValidDocumentId(documentId)) {
      promises.push(
        pageApi.getPage(documentId).then((response) => {
          results[url] = response.success && response.data; // Use the original URL as the key
        }).catch((error) => {
          console.error("🔍 [LINK CHECK] Error checking page existence:", error);
          results[url] = false;
        })
      );
    } else {
      console.warn(`Invalid document ID extracted from URL: ${url}`);
      results[url] = false;
    }
  }

  // Wait for all document checks to complete
  await Promise.all(promises);

  return results;
}

// Helper function to check if a Firestore document ID is valid
function isValidDocumentId(id) {
  if (typeof id !== "string" || id.trim() === "") {
    return false;
  }

  // Firestore document IDs must be valid UTF-8 characters and cannot contain:
  // forward slashes (/), backslashes (\), periods (.), or double periods (..)
  const invalidChars = /[\/\\]/;
  if (invalidChars.test(id)) {
    return false;
  }

  // Cannot be just periods
  if (id === "." || id === "..") {
    return false;
  }

  // Must be 1-1500 bytes when UTF-8 encoded
  const byteLength = new TextEncoder().encode(id).length;
  if (byteLength < 1 || byteLength > 1500) {
    return false;
  }

  return true;
}

export { checkLinkExistence };