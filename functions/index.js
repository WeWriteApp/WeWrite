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
      console.log("Group member update occurred");
      return rtdb.ref(`/groups/${groupId}`).once("value").then((snapshot) => {
        if (snapshot.exists()) {
          console.log("Group member added, adding to user");
          return rtdb.ref(`/users/${userId}/groups/${groupId}`).set(true);
        } else {
          console.log("Group does not exist");
          return null;
        }
      });
    }
  });

// get the members / pages associated with a group and update them
// remove the group from the user https://whimsical.com/cloud-functions-JEhs96YYaP5DhJ8Dfhi4TV@2bsEvpTYSt1HjEGdoL7VQUG5qcaVDsHaUbS
exports.onDeleteGroup = functions.database
  .ref("/groups/{groupId}")
  .onDelete(async (snapshot, context) => {
    const groupId = context.params.groupId;
    const group = snapshot.val();

    try {
      // If these two functions are independent, run them in parallel
      await Promise.all([
        updateUserGroupsInRTDB(groupId, group),
        updatePagesInFirestore(groupId)
      ]);

      console.log(`Group ${groupId} deleted successfully and related records updated.`);
    } catch (error) {
      console.error(`Error deleting group ${groupId}:`, error);
    }
  });

async function updateUserGroupsInRTDB (groupId, group) {
  try {
    let updates = {};
    if (group.members) {
      Object.keys(group.members).forEach((userId) => {
        updates[`/users/${userId}/groups/${groupId}`] = null;
      });
    }
    await rtdb.ref().update(updates);
    console.log("User groups updated successfully");
  } catch (error) {
    console.error("Error updating user groups:", error);
  }
};

async function updatePagesInFirestore(groupId) {
  try {
    const pagesSnapshot = await admin.firestore()
      .collection("pages")
      .where("groupId", "==", groupId)
      .get();

    if (pagesSnapshot.empty) {
      console.log(`No pages found with groupId: ${groupId}`);
      return;
    }

    const batch = admin.firestore().batch();
    let count = 0;

    pagesSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { groupId: null });
      count++;

      // Firestore batch limit is 500. If we reach the limit, commit the batch and create a new one.
      if (count === 500) {
        batch.commit();
        console.log('Committed a batch of 500 updates.');
        batch = admin.firestore().batch(); // Start a new batch
        count = 0; // Reset counter
      }
    });

    // Commit the final batch if there are remaining updates
    if (count > 0) {
      await batch.commit();
      console.log("Remaining pages in Firestore updated successfully");
    }

  } catch (error) {
    console.error("Error updating pages in Firestore:", error);
  }
}

