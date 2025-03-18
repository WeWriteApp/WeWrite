"use client";

import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '@/app/providers/AuthProvider';
import { getUserSubscription, getUserPledges, updatePledge, deletePledge } from '@/app/firebase/subscription';
import { getCollection } from '@/app/firebase/database';
import { ShimmerEffect } from '@/app/components/ui/skeleton';
import Link from 'next/link';

export default function PledgesPage() {
  const { user } = useContext(AuthContext);
  const [subscription, setSubscription] = useState(null);
  const [pledges, setPledges] = useState([]);
  const [pages, setPages] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [editingPledge, setEditingPledge] = useState(null);
  const [editAmount, setEditAmount] = useState(0);
  
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
          pagesData[doc.id] = { id: doc.id, ...doc.data() };
        });
        setPages(pagesData);
      } catch (error) {
        console.error("Error loading pledges data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      loadData();
    }
  }, [user]);
  
  const handleSavePledge = async () => {
    if (!editingPledge || !user) return;
    
    try {
      // Get current pledge amount
      const currentPledge = pledges.find(p => p.id === editingPledge);
      if (!currentPledge) return;
      
      // Update pledge
      await updatePledge(user.uid, editingPledge, editAmount, currentPledge.amount);
      
      // Update local state
      setPledges(pledges.map(pledge => 
        pledge.id === editingPledge 
          ? { ...pledge, amount: editAmount } 
          : pledge
      ));
      
      // Reset editing state
      setEditingPledge(null);
      setEditAmount(0);
    } catch (error) {
      console.error("Error updating pledge:", error);
    }
  };
  
  const handleDeletePledge = async (pledgeId) => {
    if (!user) return;
    
    const confirmDelete = window.confirm("Are you sure you want to remove this pledge?");
    if (!confirmDelete) return;
    
    try {
      // Get current pledge amount
      const currentPledge = pledges.find(p => p.id === pledgeId);
      if (!currentPledge) return;
      
      // Delete pledge
      await deletePledge(user.uid, pledgeId, currentPledge.amount);
      
      // Update local state
      setPledges(pledges.filter(pledge => pledge.id !== pledgeId));
    } catch (error) {
      console.error("Error deleting pledge:", error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] p-6 rounded-lg">
        <ShimmerEffect className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          <ShimmerEffect className="h-16 w-full rounded-md" />
          <ShimmerEffect className="h-16 w-full rounded-md" />
          <ShimmerEffect className="h-16 w-full rounded-md" />
        </div>
      </div>
    );
  }
  
  const totalPledged = pledges.reduce((sum, pledge) => sum + pledge.amount, 0);
  const subscriptionAmount = subscription?.amount || 0;
  const availableAmount = subscriptionAmount - totalPledged;
  
  return (
    <div className="bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] p-6 rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Manage Pledges</h2>
      
      {/* Subscription summary */}
      <div className="mb-6 p-4 bg-background/60 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-400">Subscription</p>
            <p className="text-xl font-medium">${subscriptionAmount}/mo</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Pledged</p>
            <p className="text-xl font-medium">${totalPledged}/mo</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Available</p>
            <p className="text-xl font-medium">${availableAmount}/mo</p>
          </div>
        </div>
      </div>
      
      {/* Pledges List */}
      {pledges.length > 0 ? (
        <div className="space-y-4">
          {pledges.map((pledge) => {
            const page = pages[pledge.id];
            const isEditing = editingPledge === pledge.id;
            
            return (
              <div key={pledge.id} className="p-4 border border-[rgba(255,255,255,0.1)] rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">
                      {page?.title || 'Unknown Page'}
                    </h3>
                    {page && (
                      <Link 
                        href={`/${pledge.id}`}
                        className="text-sm text-[#0057FF] hover:underline"
                      >
                        View page
                      </Link>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <span className="mr-1">$</span>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          max={availableAmount + pledge.amount}
                          className="w-20 bg-background border border-[rgba(255,255,255,0.2)] rounded px-2 py-1"
                        />
                        <span className="ml-1">/mo</span>
                      </div>
                      <button
                        onClick={handleSavePledge}
                        className="px-3 py-1 bg-[#0057FF] hover:bg-[#0046CC] text-white text-sm rounded transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPledge(null)}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <p className="font-medium">${pledge.amount}/mo</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingPledge(pledge.id);
                            setEditAmount(pledge.amount);
                          }}
                          className="text-sm text-[#0057FF] hover:text-[#0046CC]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePledge(pledge.id)}
                          className="text-sm text-red-500 hover:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">You haven't made any pledges yet.</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-[#0057FF] hover:bg-[#0046CC] text-white rounded-lg transition-colors"
          >
            Browse Pages
          </Link>
        </div>
      )}
    </div>
  );
} 