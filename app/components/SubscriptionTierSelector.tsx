import React, { useState, useEffect } from 'react';
import { Check, Medal, Award, Diamond } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';

interface Tier {
  id: string;
  name: string;
  amount: number | string;
  description: string;
  features: string[];
  stripePriceId?: string;
  isCustom?: boolean;
}

interface SubscriptionTierSelectorProps {
  currentTier?: string;
  onTierSelect: (tier: Tier) => void;
}

const SubscriptionTierSelector: React.FC<SubscriptionTierSelectorProps> = ({
  currentTier,
  onTierSelect
}) => {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [selectedTier, setSelectedTier] = useState<string | null>(currentTier || null);
  const [customAmount, setCustomAmount] = useState<number>(100);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const response = await fetch('/api/subscription-tiers');
        if (!response.ok) {
          throw new Error('Failed to fetch subscription tiers');
        }
        const data = await response.json();
        setTiers(data.tiers);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTiers();
  }, []);

  const handleTierSelect = (tier: Tier) => {
    setSelectedTier(tier.id);
    
    // If it's the custom tier, use the custom amount
    if (tier.isCustom) {
      const customTier = {
        ...tier,
        amount: customAmount
      };
      onTierSelect(customTier);
    } else {
      onTierSelect(tier);
    }
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (value >= 50) {
      setCustomAmount(value);
      
      // If diamond tier is already selected, update the tier with new amount
      if (selectedTier === 'diamond') {
        const diamondTier = tiers.find(t => t.id === 'diamond');
        if (diamondTier) {
          onTierSelect({
            ...diamondTier,
            amount: value
          });
        }
      }
    }
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'bronze':
        return <Medal className="h-6 w-6 text-amber-600" />;
      case 'silver':
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 'gold':
        return <Award className="h-6 w-6 text-yellow-400" />;
      case 'diamond':
        return <Diamond className="h-6 w-6 text-blue-400" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
        <p>Error: {error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-200 dark:bg-red-800 rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Choose Your Subscription Tier</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiers.map((tier) => (
          <div 
            key={tier.id}
            className={`
              border rounded-lg p-4 cursor-pointer transition-all
              ${selectedTier === tier.id 
                ? 'border-primary bg-primary/10 shadow-md' 
                : 'border-border hover:border-primary/50'}
            `}
            onClick={() => handleTierSelect(tier)}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center">
                {getTierIcon(tier.id)}
                <h3 className="text-lg font-medium ml-2">{tier.name}</h3>
              </div>
              {selectedTier === tier.id && (
                <Check className="h-5 w-5 text-primary" />
              )}
            </div>
            
            <p className="text-xl font-bold mb-2">
              {tier.isCustom ? `$${customAmount}` : `$${tier.amount}`}
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
            
            <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>
            
            <ul className="space-y-1">
              {tier.features.map((feature, index) => (
                <li key={index} className="text-sm flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  {feature}
                </li>
              ))}
            </ul>
            
            {tier.isCustom && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">
                  Custom amount (min $50)
                </label>
                <div className="flex items-center">
                  <span className="mr-2">$</span>
                  <input
                    type="number"
                    min="50"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    className="w-full p-2 border rounded-md bg-background"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionTierSelector;
