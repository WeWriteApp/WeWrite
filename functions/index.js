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
    created: new Date().getTime(),
  });
});