"use client";

import React, { useState } from 'react';
import { Construction } from 'lucide-react';
import PledgeBarModal from './PledgeBarModal';

/**
 * ConstructionChip Component
 *
 * Displays an orange chip that says "WeWrite is under construction"
 * When clicked, it opens a modified support modal
 */
const ConstructionChip = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        className="w-full flex justify-center my-4"
        onClick={() => setShowModal(true)}
      >
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 text-orange-800 dark:text-orange-300
                    border border-orange-300/30 dark:border-orange-500/30
                    rounded cursor-pointer hover:bg-orange-100/10 dark:hover:bg-orange-900/20
                    transition-colors text-xs"
          style={{
            backgroundColor: 'rgba(255, 237, 213, 0.1)', /* 10% orange fill */
            borderColor: 'rgba(251, 146, 60, 0.3)', /* 30% orange stroke */
          }}
        >
          <Construction className="h-3 w-3" />
          <span className="font-normal">WeWrite is under construction</span>
        </div>
      </div>

      {/* Custom PledgeBarModal with construction message */}
      <ConstructionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

/**
 * ConstructionModal Component
 *
 * A modified version of PledgeBarModal specifically for the construction message
 */
const ConstructionModal = ({ isOpen, onClose }) => {
  // Use the same PledgeBarModal component but with custom content
  const customContent = {
    title: "WeWrite is under construction",
    description: "We're still working on getting WeWrite all finished, please become an Early Supporter to help us continue development!",
    action: {
      href: "/support",
      label: "Become a Supporter",
      external: false
    }
  };

  // Sort social links in the specified order: twitter, youtube, instagram
  const sortedSocialLinks = [...(require('../config/social-links').socialLinks)].sort((a, b) => {
    const order = { twitter: 1, youtube: 2, instagram: 3 };
    return order[a.platform] - order[b.platform];
  });

  return (
    <PledgeBarModal
      isOpen={isOpen}
      onClose={onClose}
      isSignedIn={true}
      customContent={customContent}
    />
  );
};

export default ConstructionChip;
