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
const { BigQuery } = require("@google-cloud/bigquery");
admin.initializeApp();
const rtdb = admin.database();
const db = getFirestore();
const bigquery = new BigQuery();

const DATASET_ID = "pages_indexes";
const TABLE_ID = "pages";
require('dotenv').config()

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
  .onWrite(async (change, context) => {
    const pageId = context.params.pageId;
    const page = change.after.exists ? change.after.data() : null;

    const resourcePath = context.resource.name;

    // Check if the update was made to a subcollection (e.g., /pages/{pageId}/versions/{version})
    if (resourcePath.includes('/versions/')) {
      console.log(`Ignoring subcollection update at: ${resourcePath}`);
      return; // Exit early and don't process this update
    }

    if (!change.after.exists) {
      // Document deleted from Firestore
      await deleteFromBigQuery(pageId);
      await deleteFromRTDB(change.before.data(), pageId);
    } else {
      // Avoid unnecessary triggers by checking if data has actually changed
      const beforeData = change.before.data();
      if (beforeData && page && JSON.stringify(beforeData) === JSON.stringify(page)) {
        console.log(`No changes detected for document_id ${pageId}. Skipping upsert.`);
        return;
      }
      // Document created or updated in Firestore
      await upsertToBigQuery(pageId, page);
      await upsertToRTDB(page, pageId);
    }
  });

// groups when added as a member or removed, update the user with the group id
exports.updateGroupMembers = functions.database
  .ref("/groups/{groupId}/members/{userId}")
  .onWrite((change, context) => {
    const userId = context.params.userId;
    const groupId = context.params.groupId;

    if (!change.after.exists) {
      logger.info("Group member removed, removing from user");
      return rtdb.ref(`/users/${userId}/groups/${groupId}`).remove();
    } else {
      logger.info("Group member update occurred");
      return rtdb.ref(`/groups/${groupId}`).once("value").then((snapshot) => {
        if (snapshot.exists()) {
          logger.info("Group member added, adding to user");
          return rtdb.ref(`/users/${userId}/groups/${groupId}`).set(true);
        } else {
          logger.info("Group does not exist");
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

      logger.info(`Group ${groupId} deleted successfully and related records updated.`);
    } catch (error) {
      logger.error(`Error deleting group ${groupId}:`, error);
    }
  });


exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_HOOK_KEY);
  } catch (err) {
    console.log(`⚠️  Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!', paymentIntent);
      const transaction = {
        id: paymentIntent.id,
        amount: paymentIntent.amount_total,
        currency: paymentIntent.currency,
        created: paymentIntent.created,
        status: paymentIntent.status,
        invoice: paymentIntent.invoice,
        subscription: paymentIntent.subscription,
        payment_status: paymentIntent.payment_status,
        customer: paymentIntent.customer,
      }
      const userId = paymentIntent.metadata.userId;
      const type = paymentIntent.metadata.type;

      
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
});


async function updateUserGroupsInRTDB(groupId, group) {
  try {
    let updates = {};
    if (group.members) {
      Object.keys(group.members).forEach((userId) => {
        updates[`/users/${userId}/groups/${groupId}`] = null;
      });
    }
    await rtdb.ref().update(updates);
    logger.info("User groups updated successfully");
  } catch (error) {
    logger.error("Error updating user groups:", error);
  }
};

// Function to delete entries from Realtime Database
async function deleteFromRTDB(existingData, pageId) {
  const existingUserId = existingData.userId;
  const existingGroupId = existingData.groupId;
  const promises = [];

  logger.info(`Deleting page ${pageId} from RTDB`);

  if (existingGroupId) {
    promises.push(
      rtdb.ref(`/groups/${existingGroupId}/pages/${pageId}`).remove(),
    );
  }

  await Promise.all(promises);
  logger.info(`Deleted page ${pageId} from RTDB`);
}

async function updatePagesInFirestore(groupId) {
  try {
    const pagesSnapshot = await admin.firestore()
      .collection("pages")
      .where("groupId", "==", groupId)
      .get();

    if (pagesSnapshot.empty) {
      logger.info(`No pages found with groupId: ${groupId}`);
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
        logger.info('Committed a batch of 500 updates.');
        batch = admin.firestore().batch(); // Start a new batch
        count = 0; // Reset counter
      }
    });

    // Commit the final batch if there are remaining updates
    if (count > 0) {
      await batch.commit();
      logger.info("Remaining pages in Firestore updated successfully");
    }

  } catch (error) {
    logger.error("Error updating pages in Firestore:", error);
  }
}


// Function to delete an entry from BigQuery
async function deleteFromBigQuery(pageId) {
  logger.info(`Deleting entry with document_id ${pageId} from BigQuery`);

  const query = `
    DELETE FROM \`${DATASET_ID}.${TABLE_ID}\`
    WHERE document_id = @pageId
  `;
  const options = {
    query: query,
    params: { pageId: pageId },
  };
  await bigquery.query(options);
  logger.info(`Deleted entry with document_id ${pageId} from BigQuery`);
}

// Function to upsert an entry into BigQuery
async function upsertToBigQuery(pageId, newValue) {
  logger.info(`Upserting entry with document_id ${pageId} into BigQuery`);
  const query = `
    MERGE \`${DATASET_ID}.${TABLE_ID}\` T
    USING (SELECT @document_id AS document_id, @userId AS userId, @groupId AS groupId, @title AS title, @lastModified AS lastModified) S
    ON T.document_id = S.document_id
    WHEN MATCHED THEN
      UPDATE SET T.userId = S.userId, T.groupId = S.groupId, T.title = S.title, T.lastModified = S.lastModified
    WHEN NOT MATCHED THEN
      INSERT (document_id, userId, groupId, title, lastModified)
      VALUES (S.document_id, S.userId, S.groupId, S.title, S.lastModified)
  `;

  // Define the parameter values
  const params = {
    document_id: pageId,
    userId: newValue.userId || null,
    groupId: newValue.groupId || null,
    title: newValue.title || null,
    lastModified: newValue.lastModified ? new Date(newValue.lastModified) : null,
  };

  // Define the parameter types explicitly
  const types = {
    document_id: 'STRING',
    userId: 'STRING',
    groupId: 'STRING',
    title: 'STRING',
    lastModified: 'TIMESTAMP',
  };

  const options = {
    query: query,
    params: params,
    types: types, // Specify the types here
  };

  await bigquery.query(options);
  logger.info(`Upserted entry with document_id ${pageId} into BigQuery`);
}

// Function to upsert entries into Realtime Database
async function upsertToRTDB(page, pageId) {
  const groupId = page.groupId;
  const promises = [];

  logger.info(`Upserting page ${pageId} into RTDB`);
  if (groupId) {
    promises.push(
      rtdb.ref(`/groups/${groupId}/pages/${pageId}`).set(page),
    );
  }

  await Promise.all(promises);
  logger.info(`Upserted page ${pageId} into RTDB`);
}

// Function to receive stripe event
async function stripeHook(result) {


  logger.info(`Upserted page ${result} into RTDB`);
}