"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { isAdmin } from '../../utils/isAdmin';
import { FloatingHeader } from '../../components/ui/FloatingCard';
import { useToast } from '../../components/ui/use-toast';

interface BroadcastHistory {
  id: string;
  subject: string;
  heading: string;
  sentAt: string;
  recipients: number;
  failed: number;
}

interface AudienceStats {
  total: number;
  subscribed: number;
  unsubscribed: number;
}

export default function AdminBroadcastPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // Form state
  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [testEmail, setTestEmail] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [stats, setStats] = useState<AudienceStats | null>(null);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [confirmSend, setConfirmSend] = useState(false);

  // Check admin access - use user.isAdmin from auth context for consistency
  useEffect(() => {
    if (!authLoading && user) {
      if (!user.isAdmin) {
        router.push('/');
      } else {
        setTestEmail(user.email || '');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/broadcast');
    }
  }, [user, authLoading, router]);

  // Load stats and history
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/broadcast');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to load broadcast data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.isAdmin) {
      loadData();
    }
  }, [user, loadData]);

  // Send test email
  const sendTest = async () => {
    if (!subject || !heading || !body) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in subject, heading, and body',
        variant: 'destructive',
      });
      return;
    }
    
    if (!testEmail) {
      toast({
        title: 'Missing test email',
        description: 'Please enter a test email address',
        variant: 'destructive',
      });
      return;
    }
    
    setSending(true);
    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          heading,
          body,
          ctaText: ctaText || undefined,
          ctaUrl: ctaUrl || undefined,
          testMode: true,
          testEmail,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Test email sent!',
          description: `Check ${testEmail}`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to send test',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // Send broadcast
  const sendBroadcast = async () => {
    if (!subject || !heading || !body) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in subject, heading, and body',
        variant: 'destructive',
      });
      return;
    }
    
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }
    
    setSending(true);
    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          heading,
          body,
          ctaText: ctaText || undefined,
          ctaUrl: ctaUrl || undefined,
          testMode: false,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Broadcast sent!',
          description: `Sent to ${data.sent} recipients${data.failed > 0 ? ` (${data.failed} failed)` : ''}`,
        });
        setConfirmSend(false);
        loadData(); // Refresh history
        
        // Clear form
        setSubject('');
        setHeading('');
        setBody('');
        setCtaText('');
        setCtaUrl('');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Failed to send broadcast',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // Generate preview HTML
  const generatePreviewHtml = () => {
    const baseUrl = 'https://getwewrite.app';
    const ctaSection = ctaText && ctaUrl ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${ctaUrl}" style="background: #000; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
          ${ctaText}
        </a>
      </div>
    ` : '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 30px;">
          <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 12px;">
                <img src="https://getwewrite.app/icons/icon-192x192.png" alt="WeWrite" width="44" height="44" style="display: block; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" />
              </td>
              <td style="vertical-align: middle;">
                <h1 style="color: #000; margin: 0; font-size: 28px; font-weight: 600;">WeWrite</h1>
              </td>
            </tr>
          </table>
        </div>
        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #000;">${heading || 'Your Heading Here'}</h2>
          <div style="color: #333; line-height: 1.7;">
            ${body || '<p>Your email content here...</p>'}
          </div>
          ${ctaSection}
        </div>
        <div style="text-align: center; font-size: 12px; color: #999;">
          <p>© ${new Date().getFullYear()} WeWrite. All rights reserved.</p>
          <p><a href="${baseUrl}/settings" style="color: #999;">Manage email preferences</a></p>
        </div>
      </body>
      </html>
    `;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icon name="Loader" className="text-muted-foreground" />
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Header - hidden on mobile (drawer handles navigation) */}
      <div className="hidden lg:block">
        <FloatingHeader>
          <div className="flex items-center gap-3">
            <Link href="/admin/emails">
              <Button variant="ghost" size="sm">
                <Icon name="ArrowLeft" size={16} className="mr-2" />
                Back to Emails
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <Icon name="Megaphone" size={20} className="text-primary" />
            <span className="font-semibold">Send Broadcast</span>
          </div>
        </FloatingHeader>
      </div>

      <div className="container max-w-6xl mx-auto px-4 pt-6 lg:pt-20 pb-12">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Icon name="Users" size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Icon name="Mail" size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subscribed</p>
                <p className="text-2xl font-bold">{stats?.subscribed || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Icon name="AlertCircle" size={20} className="text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unsubscribed</p>
                <p className="text-2xl font-bold">{stats?.unsubscribed || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Compose Form */}
          <div className="space-y-6">
            <div className="bg-card border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Compose Broadcast</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Subject Line</label>
                  <Input
                    placeholder="e.g., New Features on WeWrite! 🎉"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Heading</label>
                  <Input
                    placeholder="e.g., Exciting Updates Coming Your Way"
                    value={heading}
                    onChange={(e) => setHeading(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Body Content <span className="text-muted-foreground">(HTML supported)</span>
                  </label>
                  <textarea
                    className="w-full min-h-[200px] p-3 rounded-md border bg-background resize-y font-mono text-sm"
                    placeholder={`<p>Hello!</p>\n\n<p>We've been working on some amazing new features:</p>\n\n<ul>\n  <li><strong>Feature 1</strong> - Description</li>\n  <li><strong>Feature 2</strong> - Description</li>\n</ul>\n\n<p>Thank you for being part of our community!</p>`}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      CTA Button Text <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      placeholder="e.g., Explore Now"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      CTA Button URL <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                      placeholder="https://getwewrite.app"
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-sm font-semibold mb-4">Send Options</h3>
              
              <div className="space-y-4">
                {/* Test Send */}
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Test email address"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={sendTest}
                    disabled={sending}
                  >
                    {sending ? (
                      <Icon name="Loader" className="mr-2" />
                    ) : (
                      <Icon name="TestTube" size={16} className="mr-2" />
                    )}
                    Send Test
                  </Button>
                </div>
                
                <div className="border-t pt-4">
                  {confirmSend ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <Icon name="AlertCircle" size={20} className="text-yellow-600" />
                        <span className="text-sm">
                          This will send to <strong>{stats?.subscribed || 0}</strong> subscribed contacts. Are you sure?
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          onClick={sendBroadcast}
                          disabled={sending}
                          className="flex-1"
                        >
                          {sending ? (
                            <Icon name="Loader" className="mr-2" />
                          ) : (
                            <Icon name="Send" size={16} className="mr-2" />
                          )}
                          Yes, Send to All
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setConfirmSend(false)}
                          disabled={sending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={sendBroadcast}
                      disabled={sending || !subject || !heading || !body}
                      className="w-full"
                    >
                      <Icon name="Send" size={16} className="mr-2" />
                      Send Broadcast to {stats?.subscribed || 0} Contacts
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Preview & History */}
          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Preview</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Icon name="Eye" size={16} className="mr-2" />
                  {showPreview ? 'Hide' : 'Show'}
                </Button>
              </div>
              
              {showPreview && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <iframe
                      srcDoc={generatePreviewHtml()}
                      className="w-full h-[500px] border-0"
                      title="Email Preview"
                    />
                  </div>
                </div>
              )}
              
              {!showPreview && (
                <div className="p-8 text-center text-muted-foreground">
                  <Icon name="Eye" size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Click "Show" to preview your email</p>
                </div>
              )}
            </div>

            {/* History */}
            <div className="bg-card border rounded-lg">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Icon name="History" size={20} />
                  Recent Broadcasts
                </h2>
                <Button variant="ghost" size="sm" onClick={loadData}>
                  <Icon name="RefreshCw" size={16} />
                </Button>
              </div>
              
              <div className="divide-y">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Icon name="Megaphone" size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No broadcasts sent yet</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.subject}</p>
                          <p className="text-sm text-muted-foreground truncate">{item.heading}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="whitespace-nowrap">
                            <Icon name="CheckCircle2" size={12} className="mr-1" />
                            {item.recipients} sent
                          </Badge>
                          {item.failed > 0 && (
                            <Badge variant="destructive" className="whitespace-nowrap">
                              {item.failed} failed
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Icon name="Clock" size={12} />
                        {new Date(item.sentAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
