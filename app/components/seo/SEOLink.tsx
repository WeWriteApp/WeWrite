"use client";

import Link from 'next/link';
import { ReactNode, CSSProperties, MouseEvent } from 'react';

declare global {
  interface Window {
    gtag?: (command: string, action: string, params: Record<string, unknown>) => void;
  }
}

interface SEOLinkProps {
  href: string;
  children: ReactNode;
  title?: string;
  rel?: string;
  external?: boolean;
  nofollow?: boolean;
  sponsored?: boolean;
  ugc?: boolean;
  anchor?: string;
  prefetch?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onMouseEnter?: (e: MouseEvent<HTMLAnchorElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLAnchorElement>) => void;
  download?: string;
}

/**
 * SEO-optimized Link component with automatic optimization
 */
export function SEOLink({
  href,
  children,
  title,
  rel,
  external = false,
  nofollow = false,
  sponsored = false,
  ugc = false,
  anchor,
  prefetch = true,
  className = '',
  style = {},
  onClick,
  ...props
}: SEOLinkProps) {
  // Determine if link is external
  const isExternal = external || (href && (href.startsWith('http') || href.startsWith('//')));

  // Build rel attribute
  const buildRel = (): string | undefined => {
    const relParts: string[] = [];

    if (rel) {
      relParts.push(rel);
    }

    if (isExternal) {
      relParts.push('noopener');
    }

    if (nofollow || (isExternal && !sponsored && !ugc)) {
      relParts.push('nofollow');
    }

    if (sponsored) {
      relParts.push('sponsored');
    }

    if (ugc) {
      relParts.push('ugc');
    }

    return relParts.length > 0 ? relParts.join(' ') : undefined;
  };

  const finalRel = buildRel();
  const finalTitle = title || (typeof children === 'string' ? children : undefined);

  // Track link clicks for SEO analytics
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }

    // Track link click
    if (window.gtag) {
      window.gtag('event', 'click', {
        event_category: 'SEO Links',
        event_label: href,
        link_text: anchor || (typeof children === 'string' ? children : 'Unknown'),
        external_link: isExternal,
        link_domain: isExternal ? new URL(href).hostname : window.location.hostname
      });
    }
  };

  // For external links, use regular anchor tag
  if (isExternal) {
    return (
      <a
        href={href}
        title={finalTitle}
        rel={finalRel}
        target="_blank"
        className={`seo-external-link ${className}`}
        style={style}
        onClick={handleClick}
        {...props}
      >
        {children}
      </a>
    );
  }

  // For internal links, use Next.js Link
  return (
    <Link
      href={href}
      title={finalTitle}
      rel={finalRel}
      prefetch={prefetch}
      className={`seo-internal-link ${className}`}
      style={style}
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
}

interface BreadcrumbLinkProps extends Omit<SEOLinkProps, 'children'> {
  children: ReactNode;
  isLast?: boolean;
}

/**
 * Breadcrumb Link component
 */
export function BreadcrumbLink({ href, children, isLast = false, ...props }: BreadcrumbLinkProps) {
  const linkStyle: CSSProperties = {
    textDecoration: isLast ? 'none' : 'underline',
    color: isLast ? '#666' : '#0066cc',
    cursor: isLast ? 'default' : 'pointer'
  };

  if (isLast) {
    return (
      <span
        style={linkStyle}
        aria-current="page"
      >
        {children}
      </span>
    );
  }

  return (
    <SEOLink
      href={href}
      style={linkStyle}
      {...props}
    >
      {children}
    </SEOLink>
  );
}

interface CTALinkProps extends Omit<SEOLinkProps, 'children'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success';
  size?: 'small' | 'medium' | 'large';
  trackingLabel?: string;
}

/**
 * Call-to-Action Link component
 */
export function CTALink({
  href,
  children,
  variant = 'primary',
  size = 'medium',
  trackingLabel,
  onClick,
  ...props
}: CTALinkProps) {
  const variants: Record<string, CSSProperties> = {
    primary: {
      background: 'hsl(var(--primary))',
      color: 'white',
      border: '2px solid hsl(var(--primary))'
    },
    secondary: {
      background: 'transparent',
      color: 'hsl(var(--primary))',
      border: '2px solid hsl(var(--primary))'
    },
    success: {
      background: 'hsl(var(--success))',
      color: 'white',
      border: '2px solid hsl(var(--success))'
    }
  };

  const sizes: Record<string, CSSProperties> = {
    small: { padding: '8px 16px', fontSize: '14px' },
    medium: { padding: '12px 24px', fontSize: '16px' },
    large: { padding: '16px 32px', fontSize: '18px' }
  };

  const style: CSSProperties = {
    ...variants[variant],
    ...sizes[size],
    borderRadius: '4px',
    textDecoration: 'none',
    display: 'inline-block',
    textAlign: 'center',
    transition: 'all 0.2s ease',
    fontWeight: 'bold'
  };

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (window.gtag) {
      window.gtag('event', 'cta_click', {
        event_category: 'CTA',
        event_label: trackingLabel || href,
        cta_variant: variant,
        cta_size: size
      });
    }

    if (onClick) {
      onClick(e);
    }
  };

  return (
    <SEOLink
      href={href}
      style={style}
      onClick={handleClick}
      {...props}
    >
      {children}
    </SEOLink>
  );
}

interface SocialLinkProps extends Omit<SEOLinkProps, 'children'> {
  platform: string;
  username?: string;
  children?: ReactNode;
  showIcon?: boolean;
}

/**
 * Social Media Link component
 */
export function SocialLink({
  platform,
  href,
  username,
  children,
  showIcon = true,
  ...props
}: SocialLinkProps) {
  const platforms: Record<string, { name: string; icon: string }> = {
    twitter: { name: 'Twitter', icon: 'X' },
    facebook: { name: 'Facebook', icon: 'F' },
    instagram: { name: 'Instagram', icon: 'IG' },
    linkedin: { name: 'LinkedIn', icon: 'in' },
    youtube: { name: 'YouTube', icon: 'YT' },
    github: { name: 'GitHub', icon: 'GH' }
  };

  const platformInfo = platforms[platform] || { name: platform, icon: '?' };
  const displayText = children || `${platformInfo.name}${username ? ` - ${username}` : ''}`;
  const linkTitle = `Follow on ${platformInfo.name}${username ? ` - ${username}` : ''}`;

  return (
    <SEOLink
      href={href}
      title={linkTitle}
      external={true}
      rel="noopener nofollow"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none',
        color: '#0066cc'
      }}
      {...props}
    >
      {showIcon && <span>{platformInfo.icon}</span>}
      <span>{displayText}</span>
    </SEOLink>
  );
}

interface DownloadLinkProps extends Omit<SEOLinkProps, 'children' | 'download'> {
  filename?: string;
  fileSize?: string;
  fileType?: string;
  children?: ReactNode;
}

/**
 * Download Link component
 */
export function DownloadLink({
  href,
  filename,
  fileSize,
  fileType,
  children,
  onClick,
  ...props
}: DownloadLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (window.gtag) {
      window.gtag('event', 'file_download', {
        event_category: 'Downloads',
        event_label: filename || href,
        file_type: fileType,
        file_size: fileSize
      });
    }

    if (onClick) {
      onClick(e);
    }
  };

  return (
    <SEOLink
      href={href}
      download={filename}
      title={`Download ${filename || 'file'}${fileSize ? ` (${fileSize})` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none',
        color: '#0066cc'
      }}
      onClick={handleClick}
      {...props}
    >
      <span>Download</span>
      <span>{children || filename || 'Download'}</span>
      {fileSize && <span style={{ fontSize: '0.9em', color: '#666' }}>({fileSize})</span>}
    </SEOLink>
  );
}

interface TagLinkProps extends Omit<SEOLinkProps, 'children'> {
  tag: string;
  count?: number;
}

/**
 * Tag Link component for content categorization
 */
export function TagLink({ tag, href, count, ...props }: TagLinkProps) {
  const tagHref = href || `/tag/${encodeURIComponent(tag)}`;

  return (
    <SEOLink
      href={tagHref}
      style={{
        display: 'inline-block',
        background: '#f0f0f0',
        color: '#333',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        textDecoration: 'none',
        margin: '2px'
      }}
      title={`View all content tagged with "${tag}"${count ? ` (${count} items)` : ''}`}
      {...props}
    >
      #{tag}
      {count && <span style={{ marginLeft: '4px', opacity: 0.7 }}>({count})</span>}
    </SEOLink>
  );
}

interface RelatedLinkProps extends Omit<SEOLinkProps, 'children'> {
  title: string;
  excerpt?: string;
  author?: string;
  date?: string;
  readTime?: number;
}

/**
 * Related Link component for content recommendations
 */
export function RelatedLink({
  href,
  title,
  excerpt,
  author,
  date,
  readTime,
  ...props
}: RelatedLinkProps) {
  return (
    <SEOLink
      href={href}
      style={{
        display: 'block',
        padding: '16px',
        border: '1px solid hsl(var(--border))',
        borderRadius: '8px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'box-shadow 0.2s ease'
      }}
      {...props}
    >
      <h4 style={{ margin: '0 0 8px 0', color: '#0066cc' }}>{title}</h4>
      {excerpt && (
        <p style={{
          margin: '0 0 8px 0',
          color: '#666',
          fontSize: '14px',
          lineHeight: '1.4'
        }}>
          {excerpt}
        </p>
      )}
      <div style={{
        fontSize: '12px',
        color: '#999',
        display: 'flex',
        gap: '12px'
      }}>
        {author && <span>By {author}</span>}
        {date && <span>{date}</span>}
        {readTime && <span>{readTime} min read</span>}
      </div>
    </SEOLink>
  );
}

/**
 * Utility function to optimize existing links for SEO
 */
export function optimizeLinksForSEO(container: Document | Element = document): void {
  if (typeof window === 'undefined') return;

  const links = container.querySelectorAll('a');

  links.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    const isExternal = href.startsWith('http') || href.startsWith('//');

    // Add title if missing
    if (!link.title && link.textContent) {
      link.title = link.textContent.trim();
    }

    // Handle external links
    if (isExternal) {
      if (!link.target) {
        link.target = '_blank';
      }

      const rel = link.getAttribute('rel') || '';
      const relParts = rel.split(' ').filter(Boolean);

      if (!relParts.includes('noopener')) {
        relParts.push('noopener');
      }

      if (!relParts.includes('nofollow') && !relParts.includes('sponsored') && !relParts.includes('ugc')) {
        relParts.push('nofollow');
      }

      link.setAttribute('rel', relParts.join(' '));
    }

    // Track link clicks
    if (!link.onclick) {
      link.addEventListener('click', () => {
        if (window.gtag) {
          window.gtag('event', 'click', {
            event_category: 'Optimized Links',
            event_label: href,
            external_link: isExternal
          });
        }
      });
    }
  });
}
