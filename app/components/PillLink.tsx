import React from 'react';

type PillLinkProps = {
  children: React.ReactNode;
  href: string;
  isPublic: boolean;
  groupId?: string;
  className?: string;
  isOwned?: boolean;
  byline?: string;
  isLoading?: boolean;
  variant?: string;
  label?: string;
};

const PillLink = ({
  children,
  href,
  isPublic,
  groupId = '',
  className = '',
  isOwned = false,
  byline = '',
  isLoading = false,
  variant = 'default',
  label = ''
}: PillLinkProps) => {
  return (
    <a href={href} className={`${className} pill-link`}>
      {children}
    </a>
  );
};

export { PillLink };
export default PillLink;
