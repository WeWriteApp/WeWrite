"use client";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
  type StorageReference,
  type UploadResult
} from "firebase/storage";
import app from "./config";
import { rtdb } from "./rtdb";
import {
  get,
  ref,
  set,
  push,
  type DatabaseReference
} from "firebase/database";

export const storage: FirebaseStorage = getStorage(app);

// Type definitions for storage operations
interface DocumentData {
  url: string;
  type: string;
  status: string;
  workflowStatus: string;
  name: string;
  uploadDate: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  requestId?: string;
}

type DocumentStatus = "pending" | "approved" | "rejected" | "processing";
type WorkflowStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Upload a document file to Firebase Storage and add metadata to Realtime Database
 *
 * @param imageFile - The file to upload
 * @param owner - The owner/user ID of the document
 * @param requestId - Optional request ID to associate with the document
 * @param status - Document status (default: "pending")
 * @param workflowStatus - Workflow status (default: "pending")
 * @returns The download URL of the uploaded file, or null if upload failed
 */
export const addDocument = async (
  imageFile: File,
  owner: string,
  requestId: string | null = null,
  status: DocumentStatus = "pending",
  workflowStatus: WorkflowStatus = "pending"
): Promise<string | null> => {

  if (!imageFile) {
    return null;
  }
  if (!owner) {
    return null;
  }

  const docRef: StorageReference = storageRef(storage, "documents");
  const fileType = imageFile.type.split("/")[1];
  const fileName = `${new Date().getTime()}.${fileType}`;
  const imageRef: StorageReference = storageRef(docRef, fileName);

  const date = new Date().toISOString();

  try {
    const uploadResult: UploadResult = await uploadBytes(imageRef, imageFile);
    const downloadURL: string = await getDownloadURL(imageRef);

    // Add to database
    const dbDocRef: DatabaseReference = ref(rtdb, "documents");
    const newDocRef: DatabaseReference = push(dbDocRef);

    const docObj: DocumentData = {
      url: downloadURL,
      type: fileType,
      status: status,
      workflowStatus: workflowStatus,
      name: fileName,
      uploadDate: date,
      createdAt: date,
      updatedAt: date,
      owner: owner};

    if (requestId) {
      docObj.requestId = requestId;
    }

    await set(newDocRef, docObj);

    return downloadURL;

  } catch (error) {
    console.error("Error uploading image:", error);

    return null;
  }
};

/**
 * Remove a document from the Realtime Database
 *
 * @param docId - The ID of the document to remove
 * @returns True if successful, undefined if failed
 */
export const removeDocument = async (docId: string): Promise<boolean | undefined> => {
  const docRef: DatabaseReference = ref(rtdb, `documents/${docId}`);
  try {
    await set(docRef, null);
    return true;
  } catch (error) {
    console.error("Error removing document from database:", error);
    return undefined;
  }
};

/**
 * Remove a document from Firebase Storage and the Realtime Database
 *
 * @param path - The storage path of the document to remove
 * @param docId - The database ID of the document to remove
 * @returns True if successful, undefined if failed
 */
export const removeDocFromStorage = async (path: string, docId: string): Promise<boolean | undefined> => {
  const docRef: StorageReference = storageRef(storage, `documents/${path}`);
  try {
    await deleteObject(docRef);
    await removeDocument(docId);

    return true;
  } catch (error) {
    console.error("Error removing document from storage:", error);
    return undefined;
  }
};