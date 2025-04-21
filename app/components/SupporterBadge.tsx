"use client";

import React from 'react';
import { Shield, Award, Medal, Diamond } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface SupporterBadgeProps {
  tier?: string;
  className?: string;
  showLabel?: boolean;
}

export default function SupporterBadge({ tier, className = '', showLabel = false }: SupporterBadgeProps) {
  if (!tier) return null;

  let badgeContent;
  
  switch (tier.toLowerCase()) {
    case 'bronze':
      badgeContent = {
        icon: <Medal className="h-4 w-4 text-amber-600" />,
        label: 'Bronze Supporter',
        tooltip: 'Bronze Supporter - $10/month',
        bgColor: 'bg-amber-600/10',
        borderColor: 'border-amber-600/20',
        textColor: 'text-amber-600'
      };
      break;
    case 'silver':
      badgeContent = {
        icon: <Award className="h-4 w-4 text-slate-400" />,
        label: 'Silver Supporter',
        tooltip: 'Silver Supporter - $20/month',
        bgColor: 'bg-slate-400/10',
        borderColor: 'border-slate-400/20',
        textColor: 'text-slate-400'
      };
      break;
    case 'gold':
      badgeContent = {
        icon: <Shield className="h-4 w-4 text-yellow-500" />,
        label: 'Gold Supporter',
        tooltip: 'Gold Supporter - $50/month',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/20',
        textColor: 'text-yellow-500'
      };
      break;
    case 'diamond':
      badgeContent = {
        icon: <Diamond className="h-4 w-4 text-blue-400" />,
        label: 'Diamond Supporter',
        tooltip: 'Diamond Supporter - $50+/month',
        bgColor: 'bg-blue-400/10',
        borderColor: 'border-blue-400/20',
        textColor: 'text-blue-400'
      };
      break;
    default:
      return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${badgeContent.bgColor} ${badgeContent.borderColor} border ${className}`}
          >
            {badgeContent.icon}
            {showLabel && (
              <span className={`text-xs font-medium ${badgeContent.textColor}`}>
                {badgeContent.label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{badgeContent.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
