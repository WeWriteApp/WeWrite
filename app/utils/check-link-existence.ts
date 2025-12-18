import { pageApi } from './apiClient';

interface LinkExistenceResults {
  [url: string]: boolean;
}

function isValidDocumentId(id: string): boolean {
  if (typeof id !== "string" || id.trim() === "") {
    return false;
  }

  const invalidChars = /[\/\\]/;
  if (invalidChars.test(id)) {
    return false;
  }

  if (id === "." || id === "..") {
    return false;
  }

  const byteLength = new TextEncoder().encode(id).length;
  if (byteLength < 1 || byteLength > 1500) {
    return false;
  }

  return true;
}

export async function checkLinkExistence(links: string[]): Promise<LinkExistenceResults> {
  const promises: Promise<void>[] = [];
  const results: LinkExistenceResults = {};

  for (const url of links) {
    const documentId = url.replace("/pages/", "").trim();

    if (isValidDocumentId(documentId)) {
      promises.push(
        pageApi.getPage(documentId).then((response) => {
          results[url] = response.success && !!response.data;
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

  await Promise.all(promises);

  return results;
}
