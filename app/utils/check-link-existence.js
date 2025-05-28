import { getDoc, doc } from "firebase/firestore";
import { db } from "../../firebase/database";

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
  return typeof id === "string" && id.trim() !== "";
}

export { checkLinkExistence };
