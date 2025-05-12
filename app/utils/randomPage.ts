/**
 * Utility for fetching a random page from the database
 */
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Fetches a random public page from the database
 * @returns Promise with the ID of a random page, or null if none found
 */
export async function getRandomPage(): Promise<string | null> {
  try {
    // Query for public pages only
    const pagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true)
    );
    
    const querySnapshot = await getDocs(pagesQuery);
    
    if (querySnapshot.empty) {
      console.log('No public pages found');
      return null;
    }
    
    // Convert to array for random selection
    const pages = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Select a random page
    const randomIndex = Math.floor(Math.random() * pages.length);
    const randomPage = pages[randomIndex];
    
    return randomPage.id;
  } catch (error) {
    console.error('Error fetching random page:', error);
    return null;
  }
}
