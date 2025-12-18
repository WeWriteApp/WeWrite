interface LinkChild {
  text?: string;
  displayText?: string;
}

interface LinkData {
  type?: string;
  id?: string;
  url?: string;
  href?: string;
  text?: string;
  displayText?: string;
  pageId?: string;
  pageTitle?: string;
  originalPageTitle?: string;
  children?: (LinkChild | string)[];
  data?: Partial<LinkData>;
  link?: Partial<LinkData>;
  isUser?: boolean;
  userId?: string;
  username?: string;
  isPageLink?: boolean;
  isExternal?: boolean;
  linkVersion?: number;
  showAuthor?: boolean;
  authorUsername?: string;
  authorUserId?: string;
  authorTier?: string;
  authorSubscriptionStatus?: string;
  authorSubscriptionAmount?: number;
  className?: string;
  isError?: boolean;
}

interface ValidatedLink extends LinkData {
  type: string;
  url: string;
  children: { text: string }[];
  displayText: string;
  linkVersion: number;
  id: string;
}

export function validateLink(linkData: LinkData | null | undefined): ValidatedLink | null {
  if (!linkData) return null;

  try {
    if (linkData === (linkData as unknown as { children: LinkData }).children || linkData === linkData.link) {
      console.warn('Circular reference detected in link data');
      return null;
    }

    let link: LinkData;
    try {
      link = JSON.parse(JSON.stringify(linkData));
    } catch {
      link = { ...linkData };
    }

    if (!link.type) {
      link.type = 'link';
    }

    if (link.link && typeof link.link === 'object') {
      Object.assign(link, link.link);
      delete link.link;
    }

    if (!link.id) {
      link.id = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    if (!link.children || !Array.isArray(link.children) || link.children.length === 0) {
      const displayText = link.text || link.displayText || (link.pageTitle ? link.pageTitle : 'Link');
      link.children = [{ text: displayText }];
    }

    link.children = link.children.map(child => {
      if (typeof child === 'string') {
        return { text: child };
      }
      if (!child.text && child.displayText) {
        return { text: child.displayText };
      }
      if (!child.text) {
        return { text: 'Link' };
      }
      return child as { text: string };
    });

    if (link.data && typeof link.data === 'object') {
      if (link.data.url || link.data.href || link.data.pageId || link.data.displayText) {
        Object.assign(link, link.data);
      }
    }

    if (!link.url) {
      link.url = link.href || '#';
    }

    if (!link.displayText) {
      link.displayText = link.text || link.pageTitle || 'Link';
    }

    if (link.pageTitle && !link.originalPageTitle) {
      link.originalPageTitle = link.pageTitle;
    }

    if (!link.pageId && link.url) {
      let match = link.url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
      if (match) {
        link.pageId = match[1];
        link.url = `/${match[1]}`;
      } else {
        match = link.url.match(/^\/([a-zA-Z0-9-_]+)$/);
        if (match) {
          link.pageId = match[1];
        }
      }
    }

    const isUserLink = link.isUser || link.userId || (link.url && link.url.startsWith('/user/'));
    const isPageLink = link.isPageLink || link.pageId || (link.url && (link.url.startsWith('/pages/') || /^\/[a-zA-Z0-9-_]+$/.test(link.url)));
    const isExternalLink = !isUserLink && !isPageLink && link.url && (link.url.startsWith('http://') || link.url.startsWith('https://'));

    if (isUserLink) {
      link.isUser = true;
      link.isExternal = false;
    } else if (isPageLink) {
      link.isPageLink = true;
      link.isExternal = false;

      if (!link.pageId && link.url) {
        const match = link.url.match(/\/pages\/([a-zA-Z0-9-_]+)/) || link.url.match(/\/([a-zA-Z0-9-_]+)$/);
        if (match) {
          link.pageId = match[1];
        }
      }

      if (link.pageId && (link.pageId === '#' || link.pageId.trim() === '' || link.pageId.includes('#'))) {
        delete link.pageId;
        if (link.url && link.url !== '#') {
          link.isPageLink = false;
          link.isExternal = true;
        }
      }

      if (link.pageTitle && !link.originalPageTitle) {
        link.originalPageTitle = link.pageTitle;
      }

      if (!link.pageTitle && link.pageId) {
        const titleFromText = link.text || (link.children && link.children[0] && 'text' in link.children[0] ? link.children[0].text : undefined);
        if (titleFromText && titleFromText !== 'Link' && titleFromText.trim()) {
          link.pageTitle = titleFromText.trim();
          link.originalPageTitle = titleFromText.trim();
        }
      }
    } else if (isExternalLink) {
      link.isExternal = true;
    }

    if (!link.children || !Array.isArray(link.children) || link.children.length === 0) {
      let text = '';
      if (isPageLink && link.pageTitle) {
        text = link.pageTitle;
      } else if (isUserLink && link.username) {
        text = link.username;
      } else if (link.displayText) {
        text = link.displayText;
      } else if (link.url) {
        text = link.url;
      } else {
        text = 'Link';
      }
      link.children = [{ text }];
    }

    if (!link.displayText) {
      if (link.children && Array.isArray(link.children) && link.children.length > 0) {
        const firstChild = link.children[0];
        if (typeof firstChild === 'object' && 'text' in firstChild && firstChild.text) {
          link.displayText = firstChild.text;
        }
      }

      if (!link.displayText) {
        if (isPageLink && link.pageTitle) {
          link.displayText = link.pageTitle;
          if (!link.originalPageTitle) {
            link.originalPageTitle = link.pageTitle;
          }
        } else if (isUserLink && link.username) {
          link.displayText = link.username;
        } else if (link.url) {
          link.displayText = link.url;
        } else {
          link.displayText = 'Link';
        }
      }
    }

    if (linkData.showAuthor !== undefined) link.showAuthor = linkData.showAuthor;
    if (linkData.authorUsername !== undefined) link.authorUsername = linkData.authorUsername;
    if (linkData.authorUserId !== undefined) link.authorUserId = linkData.authorUserId;
    if (linkData.authorTier !== undefined) link.authorTier = linkData.authorTier;
    if (linkData.authorSubscriptionStatus !== undefined) link.authorSubscriptionStatus = linkData.authorSubscriptionStatus;
    if (linkData.authorSubscriptionAmount !== undefined) link.authorSubscriptionAmount = linkData.authorSubscriptionAmount;

    if (!link.linkVersion) {
      link.linkVersion = 3;
    }

    return link as ValidatedLink;
  } catch (error) {
    const fallbackDisplayText = linkData?.displayText || linkData?.pageTitle ||
      (linkData?.children?.[0] && typeof linkData.children[0] === 'object' && 'text' in linkData.children[0] ? linkData.children[0].text : null) ||
      'Link (Error)';
    return {
      type: 'link',
      url: linkData?.url || '#',
      children: [{ text: fallbackDisplayText }],
      displayText: fallbackDisplayText,
      originalPageTitle: linkData?.pageTitle || linkData?.originalPageTitle || undefined,
      pageId: linkData?.pageId || undefined,
      showAuthor: linkData?.showAuthor || false,
      authorUsername: linkData?.authorUsername || undefined,
      authorUserId: linkData?.authorUserId || undefined,
      authorTier: linkData?.authorTier || undefined,
      authorSubscriptionStatus: linkData?.authorSubscriptionStatus || undefined,
      authorSubscriptionAmount: linkData?.authorSubscriptionAmount || undefined,
      linkVersion: 3,
      isError: true,
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }
}

export function getLinkDisplayText(linkData: LinkData | null | undefined): string {
  if (!linkData) return 'Link';

  if (linkData.text) return linkData.text;
  if (linkData.pageTitle) return linkData.pageTitle;
  if (linkData.displayText) return linkData.displayText;

  if (linkData.children && Array.isArray(linkData.children) && linkData.children.length > 0) {
    const firstChild = linkData.children[0];
    if (typeof firstChild === 'object' && 'text' in firstChild && firstChild.text) {
      return firstChild.text;
    }

    for (const child of linkData.children) {
      if (typeof child === 'object' && 'text' in child && child.text) {
        return child.text;
      }
    }
  }

  if (linkData.url) return linkData.url;

  return 'Link';
}

export function extractPageIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const match = url.match(/\/pages\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];

  const directMatch = url.match(/^\/([a-zA-Z0-9-_]+)$/);
  if (directMatch) return directMatch[1];

  return null;
}
