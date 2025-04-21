This is an unstructured roadmap, might prioritize it, might not, just vibe coding using Windsurf and Claude, lmao, so no need to be super strict about project management.

FTUX
- [ ] OpenGraph social preview
  - [x] We have minimal implementation right now
- [ ] Logged out activiation
  - [ ] Page - urge replies or donations
    - [ ] Reply without being logged in, upon save we ask to log in
  - [ ] User - urge exploration
  - [ ] Group - urge exploration

Home page
- [ ] editable sections
- [ ] event tracking on section usage

Groups
- [ ] build core functionality: members of group are able to edit pages in that group
- [ ] Group leaderboards / stats ("replace the group chat")

User page
- [ ] Reply to user?
- [ ] Backlinks for users would be mentions
- [ ] improve tab system

Page
- [ ] Page metadata
  - [ ] Backlinks still not loading
  - [ ] Custom location for each page -> Map view
  - [ ] Custom date for each page -> Timeline view
  - [ ] Page views
  - [ ] Time spent on page
- [ ] Version history
- [ ] Byline

Links
- [x] External links

Search
- [x] Speed improvements
- [ ] Prioritize exact matches
- [ ] Fuzzy search
- [ ] New page from search
- [ ] Reply to page
- [ ] Ability to search for text within pages rather than just titles

Engagement
- [ ] Follow pages / custom activity feed
- [ ] Notifications

Keyboard shortcuts
- [ ] option+up/down to move lines up and down
- [ ] cmd+shift+r to reply ? might collide with browser idk
- [ ] Research browser-safe keyboard shortcuts


Data / events
- [ ] Anything which isn't known via URL route traffic
- [ ] Paragraph layout
- [ ] Page link copied
- [ ] Detect if people are using the PWA, if not encourage them to do so
- [ ] set up dashboards of percentage usage

Design system
- [x] using Shadcn components when possible, should we explore using Stripe components instead? they're very pretty
- [ ] glow card https://codepen.io/jh3y/pen/WNmQXyE

Global nav thoughts
- [ ] editable toolbar on mobile with overflow button
- [ ] user profile / log out / account in top left
- [ ] theme switcher in top right? or new page in top right? activate subscription in top right?


A visitor should be able to reply to a page while logged out. When they try to click, save, we should redirect them to login or create an account. After successful login or account creation, we should redirect back to their page which is now successfully created. These redirects are very important to ensure that the user does not get lost at any point in the process. All these pages should be named correctly for analytics tracking so that we can ensure the funnel does not leak.

A visitor should be able to create pages while logged out.

When we bring back the Paige list component, we need to ensure that the columns sort, globally not just within the current slice. That is, when I sort by oldest, it should do a database query for the oldest, rather than sorting this current selection by oldest.

I want to build some internal admin dashboards. Should we just hardcode the email address of the admin? Or is there a more elegant solution?

## Database Optimization

As we scale, optimizing database usage is critical for both performance and cost efficiency. Here are key strategies we've implemented:

### 1. Caching Strategies
- Implement client-side caching with TTL (time-to-live) for frequently accessed data
- Use localStorage for non-sensitive data with appropriate expiration
- Consider using a service worker for offline capabilities and caching

### 2. Query Optimization
- Only fetch fields you need using `.select()` instead of retrieving entire documents
- Use pagination with appropriate page sizes (we use 200 items per page)
- Implement cursor-based pagination instead of offset pagination for better performance
- Create composite indexes for queries with multiple filters or sorting requirements

### 3. Write Optimization
- Use batch operations for multiple writes instead of individual operations
- Implement transactions for operations that need to be atomic
- Consider denormalizing data for read-heavy operations

### 4. Real-time Listeners
- Limit the scope of real-time listeners to specific documents or narrow queries
- Detach listeners when components unmount to prevent memory leaks
- Consider using more restrictive queries with real-time listeners

### 5. Data Structure
- Denormalize frequently accessed data to reduce the need for joins
- Use subcollections appropriately to organize related data
- Implement TTL (Time-to-Live) for temporary data with cleanup functions

### 6. Cloud Functions
- Use Cloud Functions for aggregation and background processing
- Schedule periodic tasks for data cleanup and maintenance
- Implement server-side operations for complex calculations

### 7. Monitoring and Analysis
- Track query performance and identify bottlenecks
- Analyze usage patterns to optimize frequently used queries
- Regularly review Firebase console for cost and performance metrics

### Example Implementations

```javascript
// Efficient query with field selection
const efficientQuery = await db.collection('pages')
  .where('userId', '==', userId)
  .select('title', 'createdAt', 'isPublic')
  .orderBy('createdAt', 'desc')
  .limit(200)
  .get();

// Batch operations
const batch = db.batch();
userIds.forEach(userId => {
  const userRef = db.collection('users').doc(userId);
  batch.update(userRef, { lastActive: new Date() });
});
await batch.commit();

// Cursor-based pagination
let lastVisible = null;
const getNextBatch = async () => {
  let query = db.collection('pages')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(20);

  if (lastVisible) {
    query = query.startAfter(lastVisible);
  }

  const snapshot = await query.get();
  lastVisible = snapshot.docs[snapshot.docs.length - 1];

  return snapshot.docs.map(doc => doc.data());
};
```

