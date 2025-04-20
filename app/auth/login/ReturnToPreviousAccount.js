"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { X } from 'lucide-react';

export default function ReturnToPreviousAccount() {
  const router = useRouter();
  const isAddingAccount = typeof window !== 'undefined' && 
    (sessionStorage.getItem('wewrite_adding_account') === 'true');
  const returnUrl = typeof window !== 'undefined' ? 
    sessionStorage.getItem('wewrite_return_url') : null;

  // Function to return to the previous account/page
  const handleReturn = () => {
    // Clear the adding account flag
    sessionStorage.removeItem('wewrite_adding_account');
    sessionStorage.removeItem('wewrite_return_url');
    
    // Navigate back to the return URL or home page
    if (returnUrl) {
      router.push(returnUrl);
    } else {
      router.push('/');
    }
  };

  // If not adding an account, don't show anything
  if (!isAddingAccount) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-50">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleReturn}
        className="flex items-center gap-1.5"
      >
        <X className="h-4 w-4" />
        <span>Cancel</span>
      </Button>
    </div>
  );
}
