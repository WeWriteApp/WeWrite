WeWrite is a social wiki where every page you write is a fundraiser. Learn more about us via the links below 👇
- [Bento](https://bento.me/wewrite)
- [Instagram](https://www.instagram.com/getwewrite/)
- [YouTube](https://www.youtube.com/@WeWriteApp)

![17E8B098-9821-4C3F-8A5C-72A6B0042A1B_1_105_c](https://github.com/user-attachments/assets/ce72dc43-145b-43c0-b525-967a523902ca)

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

Currently, the database is in test mode with no security rules. This will be updated as the project progresses.

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

### Lexical Editor
This is the editor that is used to create pages. It is built and maintained as an open-source project by Facebook. It has tons of extensible features and is a great tool for creating a WYSIWYG editor that also allows for custom components. Documentation for this can be found [here](https://lexical.dev/docs/intro). At the time of writing, this is our current selection, but SlateJS is also a great option. Found [here](https://www.slatejs.org/)

## Project Structure

### Pages
NextJS uses a file-based routing system. This means that each file in the pages directory is a route in the application. This is a great way to keep the project organized and easy to navigate. We are not using the Pages router, but instead the App router. This is a custom router that is built on top of the NextJS router. This allows for a more dynamic routing system that can be used for more complex applications. The documentation for this can be found [here](https://nextjs.org/docs/app)

Directories used as pages for context:
- /auth
- /new
- /pages/[id]/edit

### Functions
Firebase functions are serverless functions that can be triggered by database activities or by API calls. These are written in NodeJS and can be used to handle complex operations that are not possible in the client. These are found in the /functions directory. Documentation can be found [here] (https://firebase.google.com/docs/functions)

### Components
Components are reusable pieces of code that can be used throughout the application. These are found in the /components directory.

### Providers
Providers are higher-order components that wrap the application in a context. This is used to provide global state to the application. This is found in the /providers directory.



## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
