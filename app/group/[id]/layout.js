import { fetchGroupFromFirebase } from "../../firebase/rtdb";
import { isAdminServer } from "../../utils/server-feature-flags";
import { cookies } from "next/headers";

export async function generateMetadata({ params }) {
  try {
    // Properly await the params object
    const unwrappedParams = await params;
    const { id } = unwrappedParams;

    // Check if the groups feature is enabled
    const cookieStore = await cookies();
    const userEmail = cookieStore.get("user_email")?.value;
    const groupsFeatureEnabled = cookieStore.get("feature_groups")?.value === "true";
    const isUserAdmin = isAdminServer(userEmail);

    // Fetch group data
    const group = await fetchGroupFromFirebase(id);

    if (group) {
      const canonicalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/group/${id}`;
      const groupDescription = group.description || group.about 
        ? `${group.name} - ${(group.description || group.about).substring(0, 150)}`
        : `${group.name} - A collaborative group on WeWrite where members write and collaborate together.`;
      
      const memberCount = group.memberCount || (group.members ? Object.keys(group.members).length : 0);
      
      return {
        title: `${group.name} - WeWrite Group`,
        description: groupDescription,
        keywords: `${group.name}, group, collaboration, writing, WeWrite, community, ${memberCount} members`,
        authors: [{ name: group.createdBy || 'WeWrite Community' }],
        creator: group.createdBy || 'WeWrite Community',
        publisher: 'WeWrite',
        alternates: {
          canonical: canonicalUrl,
        },
        robots: {
          index: group.isPublic !== false,
          follow: true,
          googleBot: {
            index: group.isPublic !== false,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
        openGraph: {
          title: `${group.name} - WeWrite Group`,
          description: groupDescription,
          url: canonicalUrl,
          siteName: 'WeWrite',
          type: 'website',
          images: [
            {
              url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/og?type=group&id=${id}`,
              width: 1200,
              height: 630,
              alt: `${group.name} group on WeWrite`,
            }
          ],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${group.name} - WeWrite Group`,
          description: groupDescription,
          images: [`${process.env.NEXT_PUBLIC_BASE_URL}/api/og?type=group&id=${id}`],
        }
      };
    }
  } catch (error) {
    console.error('Error generating group metadata:', error);
  }

  return {
    title: 'Group - WeWrite',
    description: 'Collaborative group on WeWrite - the social wiki where every page is a fundraiser.',
  };
}

export default async function GroupLayout({ children, params }) {
  // Get the group metadata for schema markup
  let schemaMarkup = null;
  
  try {
    const unwrappedParams = await params;
    const { id } = unwrappedParams;
    const group = await fetchGroupFromFirebase(id);

    if (group) {
      const memberCount = group.memberCount || (group.members ? Object.keys(group.members).length : 0);
      
      // Generate schema markup for the group
      schemaMarkup = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: group.name,
        description: group.description || group.about || '',
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/group/${id}`,
        foundingDate: group.createdAt,
        numberOfEmployees: memberCount,
        founder: group.createdBy ? {
          '@type': 'Person',
          name: group.createdBy
        } : undefined,
        parentOrganization: {
          '@type': 'Organization',
          name: 'WeWrite',
          url: process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app'
        },
        sameAs: [`${process.env.NEXT_PUBLIC_BASE_URL}/group/${id}`]
      };
    }
  } catch (error) {
    console.error('Error generating group schema markup:', error);
  }

  return (
    <>
      {schemaMarkup && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schemaMarkup)
          }}
        />
      )}
      {children}
    </>
  );
}
