'use client';

/**
 * @deprecated This component is deprecated. Use EmbeddedBankAccountManager instead.
 *
 * This component relies on Stripe Financial Connections which requires additional
 * configuration and has been replaced with embedded Stripe Connect components
 * that provide a better user experience.
 *
 * Migration: Replace BankAccountManager with EmbeddedBankAccountManager
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Wallet,
  Plus,
  Trash2,
  Star,
  StarOff,
  AlertTriangle,
  CheckCircle,
  Loader2,
  CreditCard,
  Building,
  Zap,
  Edit2,
  Check,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useToast } from '../ui/use-toast';



interface BankAccount {
  id: string;
  bankName: string;
  last4: string;
  accountType: string;
  isPrimary: boolean;
  isVerified: boolean;
  routingNumber?: string;
  country: string;
  currency: string;
}

interface BankAccountManagerProps {
  onUpdate?: () => void;
  showTitle?: boolean;
}

export function BankAccountManager({ onUpdate, showTitle = true }: BankAccountManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editingBankName, setEditingBankName] = useState('');



  // Load bank accounts
  const loadBankAccounts = async () => {
    console.log('🔄 [LOAD BANK ACCOUNTS] Starting to load bank accounts...');

    if (!user?.uid) {
      console.log('❌ [LOAD BANK ACCOUNTS] No authenticated user');
      return;
    }

    console.log('✅ [LOAD BANK ACCOUNTS] User authenticated:', user.uid);

    try {
      setLoading(true);
      setError(null);

      console.log('📡 [LOAD BANK ACCOUNTS] Calling bank accounts API...');
      const response = await fetch('/api/stripe/bank-accounts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 [LOAD BANK ACCOUNTS] API response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to load bank accounts: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📥 [LOAD BANK ACCOUNTS] API response data:', data);
      console.log('📥 [LOAD BANK ACCOUNTS] Bank accounts in response:', data.bankAccounts?.length || 0);
      console.log('📥 [LOAD BANK ACCOUNTS] Bank accounts array:', data.bankAccounts);

      setBankAccounts(data.bankAccounts || []);
      console.log('✅ [LOAD BANK ACCOUNTS] State updated with bank accounts');
    } catch (err) {
      console.error('❌ [LOAD BANK ACCOUNTS] Error loading bank accounts:', err);
      setError('Failed to load bank accounts. Please try again.');
    } finally {
      setLoading(false);
      console.log('🏁 [LOAD BANK ACCOUNTS] Loading completed');
    }
  };

  // Set primary bank account
  const setPrimaryBank = async (bankId: string) => {
    try {
      setActionLoading(bankId);
      setError(null);

      const response = await fetch('/api/stripe/bank-accounts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bankAccountId: bankId,
          action: 'setPrimary'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set primary bank account');
      }

      toast({
        title: "Primary Bank Account Updated",
        description: "Your primary bank account has been updated successfully.",
      });

      await loadBankAccounts();
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Error setting primary bank:', err);
      toast({
        title: "Update Failed",
        description: err instanceof Error ? err.message : 'Failed to set primary bank account',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Delete bank account
  const deleteBank = async (bankId: string) => {
    try {
      setActionLoading(bankId);
      setError(null);

      const response = await fetch('/api/stripe/bank-accounts', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bankAccountId: bankId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete bank account');
      }

      toast({
        title: "Bank Account Deleted",
        description: "Your bank account has been deleted successfully.",
      });

      await loadBankAccounts();
      setDeleteConfirm(null);
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Error deleting bank account:', err);
      toast({
        title: "Delete Failed",
        description: err instanceof Error ? err.message : 'Failed to delete bank account',
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Update bank name
  const updateBankName = async (bankAccountId: string, newName: string) => {
    try {
      setActionLoading(bankAccountId);

      const response = await fetch('/api/stripe/bank-accounts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'updateName',
          bankAccountId,
          bankName: newName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update bank name');
      }

      toast({
        title: "Bank Name Updated",
        description: "Your bank name has been updated successfully.",
      });

      // Reload bank accounts
      await loadBankAccounts();
      onUpdate?.();

    } catch (error) {
      console.error('Error updating bank name:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update bank name",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
      setEditingBankId(null);
      setEditingBankName('');
    }
  };

  // Start editing bank name
  const startEditingBankName = (bankId: string, currentName: string) => {
    setEditingBankId(bankId);
    setEditingBankName(currentName);
  };

  // Cancel editing bank name
  const cancelEditingBankName = () => {
    setEditingBankId(null);
    setEditingBankName('');
  };

  // Save bank name
  const saveBankName = async () => {
    if (!editingBankId || !editingBankName.trim()) return;
    await updateBankName(editingBankId, editingBankName.trim());
  };

  const handleConnectBankAccount = async () => {
    console.log('🚀 [BANK CONNECT] Starting bank account connection flow');

    if (!user?.uid) {
      console.error('❌ [BANK CONNECT] No authenticated user found');
      toast({
        title: "Authentication Error",
        description: "Please log in to connect a bank account.",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ [BANK CONNECT] User authenticated:', user.uid);
    setIsConnecting(true);

    try {
      console.log('📡 [BANK CONNECT] Creating Financial Connections session...');

      // Create Financial Connections session
      const response = await fetch('/api/stripe/financial-connections/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
        }),
      });

      console.log('📡 [BANK CONNECT] Session creation response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [BANK CONNECT] Session creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create Financial Connections session');
      }

      const { clientSecret, sessionId } = await response.json();
      console.log('✅ [BANK CONNECT] Session created successfully:', { sessionId, clientSecretLength: clientSecret?.length });

      // Load Stripe.js
      console.log('📦 [BANK CONNECT] Loading Stripe.js...');
      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

      if (!stripe) {
        console.error('❌ [BANK CONNECT] Failed to load Stripe.js');
        throw new Error('Failed to load Stripe');
      }

      console.log('✅ [BANK CONNECT] Stripe.js loaded successfully');

      // Redirect to Financial Connections
      console.log('🔗 [BANK CONNECT] Starting Financial Connections flow...');
      console.log('🔗 [BANK CONNECT] Client secret:', clientSecret ? 'present' : 'missing');
      console.log('🔗 [BANK CONNECT] Session ID:', sessionId);

      const result = await stripe.collectFinancialConnectionsAccounts({
        clientSecret,
      });

      console.log('🔗 [BANK CONNECT] Financial Connections flow completed');
      console.log('🔗 [BANK CONNECT] Result:', result);

      if (result.error) {
        console.error('❌ [BANK CONNECT] Financial Connections error:', result.error);
        throw new Error(result.error.message);
      }

      console.log('✅ [BANK CONNECT] Financial Connections completed successfully');
      console.log('✅ [BANK CONNECT] Session from result:', result.financialConnectionsSession);

      // If we get here, the user completed the flow successfully
      // Retrieve the connected accounts
      console.log('📥 [BANK CONNECT] Retrieving connected accounts...');
      await handleConnectionSuccess(sessionId);

    } catch (error) {
      console.error('❌ [BANK CONNECT] Overall error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : 'Unable to connect your bank account. Please try again.',
        variant: "destructive",
      });
    } finally {
      console.log('🏁 [BANK CONNECT] Flow completed, resetting state');
      setIsConnecting(false);
    }
  };

  const handleConnectionSuccess = async (sessionId: string) => {
    console.log('📥 [RETRIEVE ACCOUNTS] Starting account retrieval for session:', sessionId);

    try {
      console.log('📡 [RETRIEVE ACCOUNTS] Calling retrieve-accounts API...');

      const response = await fetch('/api/stripe/financial-connections/retrieve-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      console.log('📡 [RETRIEVE ACCOUNTS] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [RETRIEVE ACCOUNTS] API error:', errorData);
        throw new Error(errorData.error || 'Failed to retrieve connected accounts');
      }

      const responseData = await response.json();
      console.log('📥 [RETRIEVE ACCOUNTS] API response data:', responseData);
      console.log('📥 [RETRIEVE ACCOUNTS] Full response structure:', JSON.stringify(responseData, null, 2));

      const { accounts } = responseData;
      console.log('📊 [RETRIEVE ACCOUNTS] Accounts received:', accounts?.length || 0);
      console.log('📊 [RETRIEVE ACCOUNTS] Accounts array:', accounts);

      if (accounts && accounts.length > 0) {
        console.log('✅ [RETRIEVE ACCOUNTS] Accounts successfully retrieved:', accounts);

        toast({
          title: "Bank Account Connected",
          description: `Successfully connected ${accounts.length} bank account${accounts.length > 1 ? 's' : ''}.`,
        });

        // Refresh bank accounts list
        console.log('🔄 [RETRIEVE ACCOUNTS] Refreshing bank accounts list...');
        await loadBankAccounts();
        console.log('🔄 [RETRIEVE ACCOUNTS] loadBankAccounts completed');

        if (onUpdate) {
          console.log('🔄 [RETRIEVE ACCOUNTS] Calling onUpdate callback...');
          onUpdate();
        }
        console.log('✅ [RETRIEVE ACCOUNTS] Bank accounts list refreshed');
      } else {
        console.error('❌ [RETRIEVE ACCOUNTS] No accounts in response');
        console.error('❌ [RETRIEVE ACCOUNTS] Response data keys:', Object.keys(responseData));
        throw new Error('No accounts were connected');
      }
    } catch (error) {
      console.error('❌ [RETRIEVE ACCOUNTS] Error:', error);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Failed to retrieve connected accounts',
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadBankAccounts();
  }, [user?.uid]);

  if (!user) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          Please log in to manage your bank accounts.
        </AlertDescription>
      </Alert>
    );
  }

  const canAddMore = bankAccounts.length < 10;
  const primaryBank = bankAccounts.find(bank => bank.isPrimary);



  const content = (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Bank Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Manage your bank accounts for receiving payouts.
          </p>
        </div>
        
        {canAddMore && (
          <Button
            variant="default"
            size="sm"
            onClick={handleConnectBankAccount}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Add Bank Account
              </>
            )}
          </Button>
        )}


      </div>

      {/* Bank Accounts List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading bank accounts...</span>
        </div>
      ) : bankAccounts.length === 0 ? (
        <Card className="border-theme-strong border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No Bank Accounts</h4>
            <p className="text-muted-foreground text-center mb-4">
              Add a bank account to start receiving payouts from your supporters.
            </p>
            <Button
              onClick={handleConnectBankAccount}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Add Your First Bank Account
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bankAccounts.map((bank) => (
            <Card key={bank.id} className={`${bank.isPrimary ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {editingBankId === bank.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingBankName}
                              onChange={(e) => setEditingBankName(e.target.value)}
                              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Enter bank name..."
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveBankName();
                                } else if (e.key === 'Escape') {
                                  cancelEditingBankName();
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={saveBankName}
                              disabled={!editingBankName.trim() || actionLoading === bank.id}
                            >
                              {actionLoading === bank.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditingBankName}
                              disabled={actionLoading === bank.id}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{bank.bankName}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditingBankName(bank.id, bank.bankName)}
                              disabled={actionLoading === bank.id}
                              className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {bank.isPrimary && (
                          <Badge variant="default" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Primary
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {bank.accountType} ••••{bank.last4}
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {bank.isVerified ? 'Verified' : 'Pending verification'} • {bank.currency.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!bank.isPrimary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrimaryBank(bank.id)}
                        disabled={actionLoading === bank.id}
                      >
                        {actionLoading === bank.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Star className="h-4 w-4 mr-1" />
                            Set Primary
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(bank.id)}
                      disabled={actionLoading === bank.id || (bank.isPrimary && bankAccounts.length > 1)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}



      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bank Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bank account? This action cannot be undone.
              {deleteConfirm && bankAccounts.find(b => b.id === deleteConfirm)?.isPrimary &&
                " You'll need to set another bank account as primary before deleting this one."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => deleteConfirm && deleteBank(deleteConfirm)}
              disabled={actionLoading === deleteConfirm}
              variant="destructive"
            >
              {actionLoading === deleteConfirm ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );

  if (!showTitle) {
    return content;
  }



  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Bank Account Management
        </CardTitle>
        <CardDescription>
          Manage your bank accounts for receiving payouts. Set one account as primary for automatic payouts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>


    </Card>
  );
}
