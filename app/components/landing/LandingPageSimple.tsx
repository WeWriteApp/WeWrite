"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Activity, Flame, FileText } from 'lucide-react';
import LandingPageDonationBar from './LandingPageDonationBar';
import { auth } from '../../firebase/config';

const LandingPageSimple = () => {
  const [user, setUser] = useState<any>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  // Check if user is logged in
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  // Handle roadmap scroll navigation
  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    const scrollContainer = document.getElementById('roadmap-scroll-container');
    const scrollLeftBtn = document.getElementById('roadmap-scroll-left');
    const scrollRightBtn = document.getElementById('roadmap-scroll-right');

    if (!scrollContainer || !scrollLeftBtn || !scrollRightBtn) return;

    // Function to check scroll position and update button visibility
    const updateScrollButtons = () => {
      // Show left button only if scrolled
      if (scrollContainer.scrollLeft > 20) {
        scrollLeftBtn.classList.remove('hidden');
      } else {
        scrollLeftBtn.classList.add('hidden');
      }

      // Show right button only if there's more content to scroll
      const hasMoreContent = scrollContainer.scrollWidth > scrollContainer.clientWidth &&
        scrollContainer.scrollLeft < (scrollContainer.scrollWidth - scrollContainer.clientWidth - 20);
      
      if (hasMoreContent) {
        scrollRightBtn.classList.remove('hidden');
      } else {
        scrollRightBtn.classList.add('hidden');
      }
    };

    // Scroll left when left button is clicked
    scrollLeftBtn.addEventListener('click', () => {
      scrollContainer.scrollBy({ left: -300, behavior: 'smooth' });
    });

    // Scroll right when right button is clicked
    scrollRightBtn.addEventListener('click', () => {
      scrollContainer.scrollBy({ left: 300, behavior: 'smooth' });
    });

    // Update button visibility on scroll
    scrollContainer.addEventListener('scroll', updateScrollButtons);
    
    // Initial check
    updateScrollButtons();

    // Check again after images might have loaded
    window.addEventListener('load', updateScrollButtons);
    
    // Check on resize
    window.addEventListener('resize', updateScrollButtons);

    // Cleanup
    return () => {
      scrollContainer.removeEventListener('scroll', updateScrollButtons);
      scrollLeftBtn.removeEventListener('click', () => {});
      scrollRightBtn.removeEventListener('click', () => {});
      window.removeEventListener('load', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Donation Bar for non-logged-in users */}
      <LandingPageDonationBar isLoggedIn={!!user} />
      
      <main className={`${isMobileView ? 'pt-24' : 'pt-20'}`}>
        <div className="container mx-auto px-4">
          <h1>Simple Landing Page</h1>
        </div>
      </main>
    </div>
  );
};

export default LandingPageSimple;
