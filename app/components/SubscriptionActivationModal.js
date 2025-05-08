"use client";

import * as React from "react";
import Modal from "./ui/modal";
import { Button } from "./ui/button";
import { SocialIcon } from "./ui/social-icon";
import { socialLinks } from "../config/social-links";
import { DollarSign } from "lucide-react";
import { SupporterIcon } from "./SupporterIcon";
import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';

const CustomAmountModal = ({ isOpen, onClose, value, setValue }) => {
  const handleIncrement = () => setValue(v => Math.max(50, v + 10));
  const handleDecrement = () => setValue(v => Math.max(50, v - 10));
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Custom Amount" className="max-w-xs">
      <div className="flex flex-col items-center gap-4 p-4">
        <div className="flex items-center gap-3">
          <button onClick={handleDecrement} className="px-3 py-2 rounded bg-muted text-lg" disabled={value <= 50}>-</button>
          <input
            type="number"
            min={50}
            step={10}
            value={value}
            onChange={e => setValue(Math.max(50, parseInt(e.target.value) || 50))}
            className="w-20 text-center border rounded px-2 py-1 text-lg"
          />
          <button onClick={handleIncrement} className="px-3 py-2 rounded bg-muted text-lg">+</button>
        </div>
        <div className="text-muted-foreground text-sm">Minimum $50/month</div>
        <Button className="w-full mt-2" onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
};

const SubscriptionActivationModal = ({ isOpen, onClose, isSignedIn, customContent }) => {
  // Use customContent if provided, otherwise use default content based on sign-in status
  const content = customContent || (isSignedIn ? {
    title: "Start your subscription",
    description: "Support WeWrite development by activating your subscription. Choose a tier below to get started.",
    action: {
      href: "/subscription",
      label: "View Subscription Tiers",
      external: false
    }
  } : {
    title: "Log in to support this writer",
    description: "Support your favorite writers with monthly donations that help them continue creating great content.",
    action: {
      href: "/auth/login",
      label: "Log in",
      external: false
    }
  });

  // No social links in the login modal
  const [selectedTier, setSelectedTier] = React.useState(null);
  const [showCustomModal, setShowCustomModal] = React.useState(false);
  const [customAmount, setCustomAmount] = React.useState(50);
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleActivate = async () => {
    if (!user || !selectedTier) return;
    setLoading(true);
    setError(null);
    const amount = selectedTier === 1 ? 10 : selectedTier === 2 ? 20 : customAmount;
    try {
      const res = await fetch('/api/activate-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, userId: user.uid }),
      });
      if (res.ok) {
        router.push(`/account/subscription/payment?amount=${amount}`);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to start subscription.');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={content.title}
        className="max-w-sm sm:max-w-md"
      >
        <div className="space-y-6">
          {/* Description */}
          <p className="text-sm text-muted-foreground">
            {content.description}
          </p>

          {/* Subscription Tiers - Horizontally Scrollable */}
          {isSignedIn && (
            <div className="mt-4 mb-6">
              <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                <div className="flex space-x-3 w-max min-w-full">
                  {/* Tier 1 */}
                  <div
                    className={`flex-none w-[200px] h-[260px] p-4 rounded-lg border bg-white dark:bg-gray-800 flex flex-col items-center cursor-pointer transition-all ${selectedTier === 1 ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/60'}`}
                    onClick={() => setSelectedTier(1)}
                  >
                    <div className="mb-4"><SupporterIcon tier="tier1" status="active" size="xl" /></div>
                    <div className="font-medium text-lg mb-1">Tier 1 Subscription</div>
                    <div className="text-sm text-muted-foreground mb-2">$10/mo</div>
                    <div className="flex-1" />
                  </div>
                  {/* Tier 2 */}
                  <div
                    className={`flex-none w-[200px] h-[260px] p-4 rounded-lg border bg-white dark:bg-gray-800 flex flex-col items-center cursor-pointer transition-all ${selectedTier === 2 ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/60'}`}
                    onClick={() => setSelectedTier(2)}
                  >
                    <div className="mb-4"><SupporterIcon tier="tier2" status="active" size="xl" /></div>
                    <div className="font-medium text-lg mb-1">Tier 2 Subscription</div>
                    <div className="text-sm text-muted-foreground mb-2">$20/mo</div>
                    <div className="flex-1" />
                  </div>
                  {/* Tier 3 (Custom) */}
                  <div
                    className={`flex-none w-[200px] h-[260px] p-4 rounded-lg border bg-white dark:bg-gray-800 flex flex-col items-center cursor-pointer transition-all ${selectedTier === 3 ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/60'}`}
                    onClick={() => { setSelectedTier(3); setShowCustomModal(true); }}
                  >
                    <div className="mb-4"><SupporterIcon tier="tier3" status="active" size="xl" /></div>
                    <div className="font-medium text-lg mb-1">Tier 3 Subscription</div>
                    <div className="text-sm text-muted-foreground mb-2">${customAmount}/mo</div>
                    <div className="flex-1" />
                    <div className="text-xs text-muted-foreground mt-2">Custom amount</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div>
            <Button
              className={`w-full ${isSignedIn ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
              size="lg"
              variant={isSignedIn ? "default" : "outline"}
              disabled={isSignedIn && (!selectedTier || loading)}
              onClick={handleActivate}
            >
              {loading ? 'Processing...' : (<>{isSignedIn && <DollarSign className="h-4 w-4 text-white" />}Activate subscription</>)}
            </Button>
            {error && <div className="text-destructive text-sm mt-2 text-center">{error}</div>}
          </div>
        </div>
      </Modal>
      {/* Custom Amount Modal for Tier 3 */}
      <CustomAmountModal isOpen={showCustomModal} onClose={() => setShowCustomModal(false)} value={customAmount} setValue={setCustomAmount} />
    </>
  );
};

export default SubscriptionActivationModal;