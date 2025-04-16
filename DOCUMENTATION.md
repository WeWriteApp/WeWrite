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

