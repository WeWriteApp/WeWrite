const { logger } = require("firebase-functions");
const {
  onValueCreated,
  onValueUpdated,
  onValueDeleted,
} = require("firebase-functions/v2/database");
const functions = require("firebase-functions/v1");
const {getFirestore} = require("firebase-admin/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();
const rtdb = admin.database();

const db = getFirestore();

exports.createUser = functions.auth.user().onCreate((user) => {
  logger.info(`User created: ${user.uid}`);
  return admin.database().ref(`/users/${user.uid}`).set({
    email: user.email,
    uid: user.uid,
    created: new Date().getTime(),
  });
});

// when a page is made in firestore /pages/{pageId}, add it to the users pages in rtdb at /users/{userId}/pages/{pageId}
exports.createPage = functions.firestore.document("/pages/{pageId}").onWrite((change, context) => {
  const pageId = context.params.pageId;
  const page = (change.after.exists) ? change.after.data() : null;
  const userId = (page) ? page.userId : null;

  // if deleted, remove from rtdb
  if (!change.after.exists) {
    let existingUserId = change.before.data().userId;
    console.log("Page deleted, removing from rtdb");
    return rtdb.ref(`/users/${existingUserId}/pages/${pageId}`).remove();
  } else {
    console.log("Page created or updated, adding to rtdb");
    return rtdb.ref(`/users/${userId}/pages/${pageId}`).set(page);
  }
});