import { getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/database";

async function checkLinkExistence(links) {
  const promises = [];
  const results = {};

  for (let url of links) {
    // Strip "/pages/" from the URL to get the document ID
    const documentId = url.replace("/pages/", "").trim();

    if (isValidDocumentId(documentId)) {
      const docRef = doc(db, "pages", documentId); // Use the documentId, not the full URL
      promises.push(
        getDoc(docRef).then((docSnap) => {
          results[url] = docSnap.exists(); // Use the original URL as the key
        }).catch((error) => {
          console.error("Error getting document:", error);
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
