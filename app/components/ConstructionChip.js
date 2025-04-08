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
        className="w-full flex justify-center my-6"
        onClick={() => setShowModal(true)}
      >
        <div
          className="flex items-center gap-2 px-4 py-2 text-orange-800 dark:text-orange-300
                    border border-orange-400/40 dark:border-orange-500/40
                    rounded-md cursor-pointer hover:bg-orange-100/20 dark:hover:bg-orange-900/30
                    transition-colors text-sm shadow-sm"
          style={{
            backgroundColor: 'rgba(255, 237, 213, 0.2)', /* 20% orange fill - brighter */
            borderColor: 'rgba(251, 146, 60, 0.4)', /* 40% orange stroke - more saturated */
          }}
        >
          <Construction className="h-4 w-4" />
          <span className="font-medium">WeWrite is under construction</span>
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
    description: "We're still working on getting WeWrite all finished, please donate to help us continue development!",
    action: {
      href: "https://opencollective.com/wewrite-app",
      label: "Support us",
      external: true
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
