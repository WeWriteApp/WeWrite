import React from 'react';
import { DrawerNavigationStack, DrawerNavigationRoot, DrawerNavigationDetail } from './drawer-navigation-stack';
import { AdaptiveModal } from './adaptive-modal';

interface ModalNavigationStackProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  activeView: string | null;
  children: React.ReactNode;
  className?: string;
  mobileHeight?: string;
  hashId?: string;
  analyticsId?: string;
  showCloseButton?: boolean;
}

/**
 * ModalNavigationStack
 *
 * A modal that supports animated nested flows (slide-in/slide-out) for multi-step flows.
 * Uses DrawerNavigationStack for mobile (drawer) and absolute-positioned stack for desktop.
 */
export function ModalNavigationStack({
  isOpen,
  onClose,
  title,
  subtitle,
  activeView,
  children,
  className = '',
  mobileHeight,
  hashId,
  analyticsId,
  showCloseButton = false,
}: ModalNavigationStackProps) {
  // On mobile, use DrawerNavigationStack inside Drawer
  // On desktop, use DrawerNavigationStack inside Dialog
  return (
    <AdaptiveModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      className={className}
      mobileHeight={mobileHeight}
      hashId={hashId}
      analyticsId={analyticsId}
      showCloseButton={showCloseButton}
    >
      <DrawerNavigationStack activeView={activeView}>
        {children}
      </DrawerNavigationStack>
    </AdaptiveModal>
  );
}

ModalNavigationStack.Root = DrawerNavigationRoot;
ModalNavigationStack.Detail = DrawerNavigationDetail;

export { DrawerNavigationRoot, DrawerNavigationDetail };
