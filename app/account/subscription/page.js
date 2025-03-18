"use client";

import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '@/app/providers/AuthProvider';
import { getUserSubscription, getUserPledges } from '@/app/firebase/subscription';
import { createCheckoutSession, createPortalSession } from '@/app/services/stripeService';
import { getCollection } from '@/app/firebase/database';
import { ShimmerEffect } from '@/app/components/ui/skeleton';

const SubscriptionTiers = [
  { id: 'tier1', name: 'Basic Support', amount: 10 },
  { id: 'tier2', name: 'Standard Support', amount: 20 },
  { id: 'tier3', name: 'Premium Support', amount: 50 },
  { id: 'tier4', name: 'Enthusiast Support', amount: 100 },
];

export default function SubscriptionPage() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [subscription, setSubscription] = useState(null);
  const [pledges, setPledges] = useState([]);
  const [pages, setPages] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState(null);
  
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Fetch subscription data
        const userSubscription = await getUserSubscription(user.uid);
        setSubscription(userSubscription);
        
        // Fetch pledges
        const userPledges = await getUserPledges(user.uid);
        setPledges(userPledges);
        
        // Fetch pages data for pledge titles
        const pagesCollection = await getCollection('pages');
        const pagesData = {};
        pagesCollection.forEach(doc => {
          pagesData[doc.id] = doc.data();
        });
        setPages(pagesData);
        
        // Set default selected tier based on subscription
        if (userSubscription && userSubscription.amount) {
          const tier = SubscriptionTiers.find(t => t.amount === userSubscription.amount);
          if (tier) setSelectedTier(tier.id);
        }
      } catch (error) {
        console.error("Error loading subscription data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (!authLoading && user) {
      loadData();
    }
  }, [user, authLoading]);
  
  const handleSubscribe = async () => {
    if (!user) return;
    
    try {
      const tier = SubscriptionTiers.find(t => t.id === selectedTier);
      if (!tier) return;
      
      // For now, use a fake priceId - this would come from Stripe in production
      const fakePriceId = `price_${tier.id}_${tier.amount}`;
      await createCheckoutSession(fakePriceId, user.uid);
    } catch (error) {
      console.error("Error initiating subscription:", error);
    }
  };
  
  const handleManageSubscription = async () => {
    if (!user || !subscription) return;
    
    try {
      await createPortalSession(user.uid);
    } catch (error) {
      console.error("Error opening subscription portal:", error);
    }
  };
  
  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <ShimmerEffect className="h-8 w-60 mb-6" />
        <div className="grid gap-6">
          <ShimmerEffect className="h-40 w-full rounded-lg" />
          <ShimmerEffect className="h-60 w-full rounded-lg" />
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Subscription</h1>
        <div className="bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] p-6 rounded-lg">
          <p>Please sign in to manage your subscription.</p>
        </div>
      </div>
    );
  }
  
  const totalPledged = pledges.reduce((sum, pledge) => sum + pledge.amount, 0);
  const subscriptionAmount = subscription?.amount || 0;
  const availableAmount = subscriptionAmount - totalPledged;
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Subscription Management</h1>
      
      {/* Subscription Status */}
      <div className="bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] p-6 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Subscription</h2>
        
        {subscription && subscription.status === 'active' ? (
          <div>
            <div className="flex justify-between mb-2">
              <span>Status:</span>
              <span className="font-medium text-green-500">Active</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Amount:</span>
              <span className="font-medium">${subscription.amount}/month</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Pledged:</span>
              <span className="font-medium">${totalPledged}/month</span>
            </div>
            <div className="flex justify-between mb-4">
              <span>Available:</span>
              <span className="font-medium">${availableAmount}/month</span>
            </div>
            
            <button
              onClick={handleManageSubscription}
              className="w-full py-2 bg-[#0057FF] hover:bg-[#0046CC] text-white rounded-lg transition-colors"
            >
              Manage Subscription
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-4">You don't have an active subscription yet.</p>
            
            <div className="space-y-4 mb-6">
              <h3 className="font-medium">Select a subscription tier:</h3>
              {SubscriptionTiers.map((tier) => (
                <div 
                  key={tier.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTier === tier.id 
                      ? 'border-[#0057FF] bg-[#0057FF]/10' 
                      : 'border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]'
                  }`}
                  onClick={() => setSelectedTier(tier.id)}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{tier.name}</span>
                    <span>${tier.amount}/month</span>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleSubscribe}
              disabled={!selectedTier}
              className={`w-full py-2 text-white rounded-lg transition-colors ${
                selectedTier 
                  ? 'bg-[#0057FF] hover:bg-[#0046CC]' 
                  : 'bg-gray-500 cursor-not-allowed'
              }`}
            >
              Subscribe
            </button>
          </div>
        )}
      </div>
      
      {/* Pledges List */}
      {subscription && subscription.status === 'active' && (
        <div className="bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Your Pledges</h2>
          
          {pledges.length > 0 ? (
            <div className="space-y-4">
              {pledges.map((pledge) => {
                const page = pages[pledge.id];
                return (
                  <div key={pledge.id} className="flex justify-between items-center p-3 border-b border-[rgba(255,255,255,0.1)]">
                    <div>
                      <h3 className="font-medium">{page?.title || 'Unknown Page'}</h3>
                      <p className="text-sm text-gray-400">Pledged: ${pledge.amount}/month</p>
                    </div>
                    <button className="text-sm text-[#0057FF] hover:text-[#0046CC]">
                      Adjust
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p>You haven't made any pledges yet.</p>
          )}
        </div>
      )}
    </div>
  );
} 