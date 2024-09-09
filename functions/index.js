const { logger } = require("firebase-functions");
const {
  onValueCreated,
  onValueUpdated,
  onValueDeleted,
} = require("firebase-functions/v2/database");
const functions = require("firebase-functions/v1");
const { getFirestore } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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
exports.createPage = functions.firestore
  .document("/pages/{pageId}")
  .onWrite((change, context) => {
    const pageId = context.params.pageId;
    const page = change.after.exists ? change.after.data() : null;
    const groupId = page ? page.groupId : null;
    const userId = page ? page.userId : null;

    // if deleted, remove from rtdb
    if (!change.after.exists) {
      let existingUserId = change.before.data().userId;
      let existingGroupId = change.before.data().groupId;
      if (existingGroupId) {
        return Promise.all([
          rtdb.ref(`/groups/${existingGroupId}/pages/${pageId}`).remove(),
          rtdb.ref(`/users/${existingUserId}/pages/${pageId}`).remove(),
          rtdb.ref(`/pages/${pageId}`).remove(),
        ]);
      } else {
        return Promise.all([
          rtdb.ref(`/users/${existingUserId}/pages/${pageId}`).remove(),
          rtdb.ref(`/pages/${pageId}`).remove(),
        ]);
      }
    } else {
      if (groupId) {
        return Promise.all([
          rtdb.ref(`/groups/${groupId}/pages/${pageId}`).set(page),
          rtdb.ref(`/users/${userId}/pages/${pageId}`).set(page),
          rtdb.ref(`/pages/${pageId}`).set(page),
        ]);
      } else {
        return Promise.all([
          rtdb.ref(`/users/${userId}/pages/${pageId}`).set(page),
          rtdb.ref(`/pages/${pageId}`).set(page),
        ]);
      }
    }
  });

// groups when added as a member or removed, update the user with the group id
exports.updateGroupMembers = functions.database
  .ref("/groups/{groupId}/members/{userId}")
  .onWrite((change, context) => {
    const userId = context.params.userId;
    const groupId = context.params.groupId;

    if (!change.after.exists) {
      console.log("Group member removed, removing from user");
      return rtdb.ref(`/users/${userId}/groups/${groupId}`).remove();
    } else {
      console.log("Group member added, adding to user");
      return rtdb.ref(`/users/${userId}/groups/${groupId}`).set(true);
    }
  });
