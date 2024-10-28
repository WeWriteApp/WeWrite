import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import app from "./config";
import { rtdb } from "./rtdb";
import { get, ref, set, push } from "firebase/database";
export const storage = getStorage(app);

export const addDocument = async (imageFile: any, owner: any, requestId = null, status = "pending", workflowStatus = "pending") => {

  if (!imageFile) {
    return;
  }
  if (!owner) {
    return;
  }
  const docRef = storageRef(storage, "documents");
  const fileType = imageFile.type.split("/")[1];
  const fileName = `${new Date().getTime()}.${fileType}`;
  const imageRef = storageRef(docRef, fileName);

  let date = new Date().toISOString();

  try {
    await uploadBytes(imageRef, imageFile);
    const downloadURL = await getDownloadURL(imageRef);

    // Add to database
    const docRef = ref(rtdb, "documents");
    const newDocRef = push(docRef);

    let docObj: any = {
      url: downloadURL,
      type: fileType,
      status: status,
      workflowStatus: workflowStatus,
      name: fileName,
      uploadDate: date,
      createdAt: date,
      updatedAt: date,
      owner: owner,
    }

    if (requestId) {
      docObj.requestId = requestId;
    }

    set(newDocRef, docObj);

    return downloadURL;

  } catch (error) {
    console.error("Error uploading image:", error);

    return null;
  }
};

export const removeDocument = async (docId: string) => {
  const docRef = ref(rtdb, `documents/${docId}`);
  try {
    await set(docRef, null);
    return true;
  } catch (error) {
    console.error("Error removing document from database:", error);
  }
}

export const removeDocFromStorage = async (path: string, docId: string) => {
  const docRef = storageRef(storage, `documents/${path}`);
  try {
    await deleteObject(docRef);
    await removeDocument(docId);

    return true;
  } catch (error) {
    console.error("Error removing document from storage:", error);
  }
}