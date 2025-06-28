'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../ui/use-toast';
import {
  Search,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Users,
  Activity
} from 'lucide-react';

interface FinancialTransaction {
  id: string;
  correlationId: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  fromUserId?: string;
  toUserId?: string;
  description: string;
  createdAt: string;
  completedAt?: string;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  metadata: Record<string, any>;
}

interface TransactionChain {
  id: string;
  rootTransactionId: string;
  correlationId: string;
  totalAmount: number;
  currency: string;
  status: string;
  payerUserId: string;
  recipientUserIds: string[];
  transactions: FinancialTransaction[];
  startedAt: string;
  completedAt?: string;
}

export default function TransactionTrackingDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'transaction' | 'chain' | 'user' | 'correlation'>('transaction');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter a search query",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const adminKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY;
      let url = '/api/admin/transaction-tracking?';
      
      switch (searchType) {
        case 'transaction':
          url += `action=get_transaction&transactionId=${encodeURIComponent(searchQuery)}`;
          break;
        case 'chain':
          url += `action=get_chain&rootTransactionId=${encodeURIComponent(searchQuery)}`;
          break;
        case 'user':
          url += `action=get_user_transactions&userId=${encodeURIComponent(searchQuery)}&limit=20`;
          break;
        case 'correlation':
          url += `action=get_by_correlation&correlationId=${encodeURIComponent(searchQuery)}`;
          break;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${adminKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Search failed');
      }

      setSearchResults(result.data);
      
      toast({
        title: "Search Completed",
        description: `Found ${Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0} result(s)`
      });

    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'completed' ? 'default' : 
                   status === 'failed' ? 'destructive' : 
                   status === 'processing' ? 'secondary' : 'outline';
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderTransaction = (transaction: FinancialTransaction) => (
    <Card key={transaction.id} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {transaction.type.replace(/_/g, ' ').toUpperCase()}
          </CardTitle>
          {getStatusBadge(transaction.status)}
        </div>
        <CardDescription className="text-xs">
          ID: {transaction.id} | Correlation: {transaction.correlationId}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Amount:</span> {formatAmount(transaction.amount, transaction.currency)}
          </div>
          <div>
            <span className="font-medium">Created:</span> {formatDate(transaction.createdAt)}
          </div>
          {transaction.fromUserId && (
            <div>
              <span className="font-medium">From:</span> {transaction.fromUserId}
            </div>
          )}
          {transaction.toUserId && (
            <div>
              <span className="font-medium">To:</span> {transaction.toUserId}
            </div>
          )}
        </div>
        <div className="mt-3">
          <span className="font-medium">Description:</span> {transaction.description}
        </div>
        {transaction.stripeInvoiceId && (
          <div className="mt-2 flex items-center gap-2">
            <ExternalLink className="h-3 w-3" />
            <span className="text-xs">Stripe Invoice: {transaction.stripeInvoiceId}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderTransactionChain = (chain: TransactionChain) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Transaction Chain
        </CardTitle>
        <CardDescription>
          Root: {chain.rootTransactionId} | Correlation: {chain.correlationId}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold">{formatAmount(chain.totalAmount, chain.currency)}</div>
            <div className="text-sm text-muted-foreground">Total Amount</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{chain.transactions.length}</div>
            <div className="text-sm text-muted-foreground">Transactions</div>
          </div>
          <div className="text-center">
            {getStatusBadge(chain.status)}
            <div className="text-sm text-muted-foreground mt-1">Status</div>
          </div>
        </div>
        
        <div className="space-y-4">
          <h4 className="font-medium">Transaction Flow:</h4>
          {chain.transactions.map((transaction, index) => (
            <div key={transaction.id} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div className="flex-1">
                {renderTransaction(transaction)}
              </div>
              {index < chain.transactions.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transaction Tracking</h2>
          <p className="text-muted-foreground">
            End-to-end financial transaction visibility across all systems
          </p>
        </div>
      </div>

      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter transaction ID, user ID, or correlation ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as any)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="transaction">Single Transaction</option>
              <option value="chain">Transaction Chain</option>
              <option value="user">User Transactions</option>
              <option value="correlation">By Correlation ID</option>
            </select>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            {searchType === 'chain' && searchResults ? (
              renderTransactionChain(searchResults)
            ) : Array.isArray(searchResults) ? (
              searchResults.length > 0 ? (
                <div className="space-y-4">
                  {searchResults.map(renderTransaction)}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found
                </div>
              )
            ) : searchResults ? (
              renderTransaction(searchResults)
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No results found
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
