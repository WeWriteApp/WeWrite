require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const pageId = process.argv[2] || 'ogYuuQuzcHBfFT1OGSEE';

if (!process.env.GOOGLE_CLOUD_KEY_JSON) {
  console.log('GOOGLE_CLOUD_KEY_JSON not found');
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(process.env.GOOGLE_CLOUD_KEY_JSON, 'base64').toString());
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function checkPage() {
  console.log('=== Checking page:', pageId, '===\n');

  const doc = await db.collection('pages').doc(pageId).get();
  if (!doc.exists) {
    console.log('Page not found');
    return;
  }

  const data = doc.data();
  console.log('Title:', data.title);
  console.log('UserID:', data.userId);

  let content = data.content;
  if (typeof content === 'string') {
    content = JSON.parse(content);
  }

  console.log('\n=== Link/URL Analysis ===');

  content.forEach((node, i) => {
    if (node.type === 'paragraph' && node.children) {
      const hasUrl = node.children.some(c => c.text && /https?:\/\/|www\./i.test(c.text));
      const hasLinks = node.children.some(c => c.type === 'link');

      if (hasUrl || hasLinks) {
        console.log('\n--- Paragraph', i, '---');
        node.children.forEach((c, j) => {
          if (c.type === 'link') {
            console.log(`  [${j}] LINK node:`);
            console.log(`       url: ${c.url}`);
            console.log(`       isExternal: ${c.isExternal}`);
            if (c.children) {
              console.log(`       text: "${c.children.map(ch => ch.text).join('')}"`);
            }
          } else if (c.text) {
            const hasUrlInText = /https?:\/\/|www\./i.test(c.text);
            console.log(`  [${j}] TEXT node${hasUrlInText ? ' (CONTAINS URL!)' : ''}:`);
            console.log(`       "${c.text.substring(0, 80)}${c.text.length > 80 ? '...' : ''}"`);
            if (c.bold) console.log('       (bold)');
            if (c.italic) console.log('       (italic)');
            if (c.underline) console.log('       (underline)');
          }
        });
      }
    }
  });

  console.log('\n=== Full Content JSON ===\n');
  console.log(JSON.stringify(content, null, 2));
}

checkPage()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
