import {
  getDoc,
  doc
} from "firebase/firestore";
import { db } from "../firebase/database";

async function checkLinkExistence(links) {
  const promises = [];
  const results = {};

  for (let url of links) {
    const docRef = doc(db, url);
    promises.push(
      getDoc(docRef).then((doc) => {
        results[url] = doc.exists();
      })
    );
  }

  // Wait for all document checks to complete
  await Promise.all(promises);

  return results;
}


module.exports = {
  checkLinkExistence
}