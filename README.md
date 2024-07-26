This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


## Tools & Platforms

### Firebase
Firebase isn't just a database anymore. This is an ecosystem of authentication, storage, databases (both relational and nonrelational) built on top of Google Cloud Platform. For the MVP, we chose Firebase for its ease of implementation and its free tier should be sufficient to handle all activities for free. Current services used for the project.

- Firestore
	- This is the relational database that handles all pages in the system and versions as subcollections. Learn more about Firestore's data model [here](https://firebase.google.com/docs/firestore/data-model)
- Authentication
	- Built-in authentciation for email and password was used for th MVP. This is extendable to a variety of other auth types, but for now this works well.
- Functions
	- Powerful serverless functions that can be hosted as both APIs and be triggered from database activities. A great example would be when an invite is sent, this can trigger invites to be added to multiple collections, notification sends, etc. 

### Vercel
Vercel is a hosting platform for javascript projects. They are the creators and managers of NextJS -- which is the server side rendering engine of the MVP application. This is also where domain name assignment occurs. 

### Github
Github, as all devs know, handles the source code. Vercel is connected to the Github repo and auto deploys when configured to do so.  



## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
