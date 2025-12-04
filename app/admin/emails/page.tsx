"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { 
  ArrowLeft, 
  Mail, 
  Eye, 
  Search, 
  Loader,
  Shield,
  DollarSign,
  Bell,
  Settings,
  Sparkles,
  ExternalLink,
  Code,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { isAdmin } from '../../utils/isAdmin';
import { FloatingHeader } from '../../components/ui/FloatingCard';
import { useToast } from '../../components/ui/use-toast';

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'notifications' | 'payments' | 'engagement' | 'system';
  subject: string;
}

interface EmailLogEntry {
  id: string;
  templateId: string;
  templateName: string;
  recipientEmail: string;
  recipientUserId?: string;
  recipientUsername?: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced' | 'delivered';
  resendId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  sentAt: string;
  createdAt: string;
}

interface GroupedTemplates {
  authentication: EmailTemplate[];
  payments: EmailTemplate[];
  engagement: EmailTemplate[];
  system: EmailTemplate[];
  notifications: EmailTemplate[];
}

// Trigger status for each template - which ones are actually wired up
const triggerStatus: Record<string, { status: 'active' | 'partial' | 'not-implemented'; description: string }> = {
  'verification': { 
    status: 'not-implemented', 
    description: 'Firebase Auth handles email verification. Custom template not yet integrated.'
  },
  'welcome': { 
    status: 'partial', 
    description: 'Can be sent via API. Auto-trigger on signup not implemented.'
  },
  'password-reset': { 
    status: 'not-implemented', 
    description: 'Firebase Auth handles password reset. Custom template not yet integrated.'
  },
  'notification': { 
    status: 'active', 
    description: 'Generic notifications can be sent via API.'
  },
  'payout-reminder': { 
    status: 'not-implemented', 
    description: 'No cron job set up. Needs Vercel cron or similar.'
  },
  'payout-processed': { 
    status: 'not-implemented', 
    description: 'Stripe webhook integration needed.'
  },
  'subscription-confirmation': { 
    status: 'not-implemented', 
    description: 'Stripe webhook integration needed.'
  },
  'weekly-digest': { 
    status: 'not-implemented', 
    description: 'No cron job set up. Needs Vercel cron or similar.'
  },
  'new-follower': { 
    status: 'not-implemented', 
    description: 'Follow API does not trigger email yet.'
  },
  'page-linked': { 
    status: 'not-implemented', 
    description: 'Link detection does not trigger email yet.'
  },
  'security-alert': { 
    status: 'not-implemented', 
    description: 'Auth events do not trigger security alerts yet.'
  },
};

const categoryConfig = {
  authentication: {
    label: 'Authentication',
    icon: Shield,
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  payments: {
    label: 'Payments',
    icon: DollarSign,
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  engagement: {
    label: 'Engagement',
    icon: Sparkles,
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  system: {
    label: 'System',
    icon: Settings,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  },
  notifications: {
    label: 'Notifications',
    icon: Bell,
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function AdminEmailsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [grouped, setGrouped] = useState<GroupedTemplates | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(true);

  // Check admin access
  useEffect(() => {
    if (!authLoading && user) {
      if (!isAdmin(user.email)) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/emails');
    }
  }, [user, authLoading, router]);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch('/api/admin/email-templates');
        const data = await response.json();
        
        if (data.success) {
          setTemplates(data.templates);
          setGrouped(data.grouped);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
        toast({
          title: 'Error',
          description: 'Failed to load email templates',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    if (user && !authLoading) {
      loadTemplates();
    }
  }, [user, authLoading, toast]);

  // Load template preview and logs
  const loadPreview = async (templateId: string) => {
    setSelectedTemplate(templateId);
    setPreviewLoading(true);
    setPreviewHtml(null);
    setShowCode(false);
    setEmailLogs([]);
    
    try {
      // Load preview and logs in parallel
      const [previewRes, logsRes] = await Promise.all([
        fetch(`/api/admin/email-templates?id=${templateId}&html=true`),
        fetch(`/api/admin/email-logs?templateId=${templateId}&limit=20`),
      ]);
      
      const previewData = await previewRes.json();
      const logsData = await logsRes.json();
      
      if (previewData.success) {
        setPreviewHtml(previewData.template.html);
      }
      
      if (logsData.success) {
        setEmailLogs(logsData.logs || []);
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email preview',
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyHtml = async () => {
    if (previewHtml) {
      await navigator.clipboard.writeText(previewHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'HTML copied to clipboard',
      });
    }
  };

  // Filter templates by search
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);
  const selectedTriggerStatus = selectedTemplate ? triggerStatus[selectedTemplate] : null;

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin(user.email)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-7xl">
        <FloatingHeader className="fixed top-3 left-3 right-3 sm:left-4 sm:right-4 md:left-6 md:right-6 z-40 px-4 py-3 mb-6 flex items-center justify-between lg:relative lg:top-0 lg:left-0 lg:right-0 lg:z-auto lg:mb-6 lg:px-0 lg:py-2">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/admin')}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold leading-tight flex items-center gap-2">
                <Mail className="h-6 w-6" />
                Email Templates
              </h1>
              <p className="text-muted-foreground text-sm flex items-center gap-2">
                Preview and manage email designs
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  Powered by Resend
                </span>
              </p>
            </div>
          </div>
          <a
            href="https://resend.com/emails"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Resend Dashboard
          </a>
        </FloatingHeader>

        <div className="pt-24 lg:pt-0">
          {/* Broadcast Banner */}
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Send a Broadcast</h3>
                  <p className="text-sm text-muted-foreground">Newsletter or product update to all users</p>
                </div>
              </div>
              <Button onClick={() => router.push('/admin/broadcast')}>
                Send Broadcast
              </Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Template List */}
            <div className="w-full lg:w-1/3 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Template Categories */}
              <div className="space-y-6">
                {grouped && Object.entries(categoryConfig).map(([category, config]) => {
                  const categoryTemplates = (grouped as any)[category] || [];
                  const filteredCategoryTemplates = categoryTemplates.filter((t: EmailTemplate) =>
                    filteredTemplates.some(ft => ft.id === t.id)
                  );
                  
                  if (filteredCategoryTemplates.length === 0) return null;
                  
                  const Icon = config.icon;
                  
                  return (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </h3>
                      <div className="space-y-2">
                        {filteredCategoryTemplates.map((template: EmailTemplate) => {
                          const status = triggerStatus[template.id];
                          return (
                            <button
                              key={template.id}
                              onClick={() => loadPreview(template.id)}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${
                                selectedTemplate === template.id
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">{template.name}</p>
                                    {status?.status === 'active' && (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                    )}
                                    {status?.status === 'partial' && (
                                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                                    )}
                                    {status?.status === 'not-implemented' && (
                                      <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {template.subject}
                                  </p>
                                </div>
                                <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No templates found</p>
                </div>
              )}
            </div>

            {/* Preview Panel */}
            <div className="w-full lg:w-2/3">
              {selectedTemplate && selectedTemplateData ? (
                <div className="space-y-4">
                  {/* Template Info */}
                  <div className="wewrite-card">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-xl font-bold">{selectedTemplateData.name}</h2>
                          <Badge className={categoryConfig[selectedTemplateData.category].color}>
                            {categoryConfig[selectedTemplateData.category].label}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">{selectedTemplateData.description}</p>
                        <p className="text-sm mt-2">
                          <span className="text-muted-foreground">Subject:</span>{' '}
                          <span className="font-medium">{selectedTemplateData.subject}</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCode(!showCode)}
                          className="gap-1"
                        >
                          <Code className="h-4 w-4" />
                          {showCode ? 'Preview' : 'HTML'}
                        </Button>
                        {showCode && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyHtml}
                            className="gap-1"
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? 'Copied' : 'Copy'}
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Trigger Status */}
                    {selectedTriggerStatus && (
                      <div className={`mt-4 p-3 rounded-lg border ${
                        selectedTriggerStatus.status === 'active' 
                          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                          : selectedTriggerStatus.status === 'partial'
                          ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                          : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      }`}>
                        <div className="flex items-start gap-2">
                          {selectedTriggerStatus.status === 'active' && (
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          )}
                          {selectedTriggerStatus.status === 'partial' && (
                            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                          )}
                          {selectedTriggerStatus.status === 'not-implemented' && (
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className={`font-medium text-sm ${
                              selectedTriggerStatus.status === 'active' 
                                ? 'text-green-800 dark:text-green-200'
                                : selectedTriggerStatus.status === 'partial'
                                ? 'text-yellow-800 dark:text-yellow-200'
                                : 'text-red-800 dark:text-red-200'
                            }`}>
                              {selectedTriggerStatus.status === 'active' && 'Trigger Active'}
                              {selectedTriggerStatus.status === 'partial' && 'Partially Implemented'}
                              {selectedTriggerStatus.status === 'not-implemented' && 'Not Yet Implemented'}
                            </p>
                            <p className={`text-xs mt-0.5 ${
                              selectedTriggerStatus.status === 'active' 
                                ? 'text-green-700 dark:text-green-300'
                                : selectedTriggerStatus.status === 'partial'
                                ? 'text-yellow-700 dark:text-yellow-300'
                                : 'text-red-700 dark:text-red-300'
                            }`}>
                              {selectedTriggerStatus.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview Frame */}
                  <div className="wewrite-card p-0 overflow-hidden">
                    {previewLoading ? (
                      <div className="flex items-center justify-center h-96">
                        <Loader className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : showCode ? (
                      <pre className="p-4 overflow-auto max-h-[600px] text-xs bg-muted/30">
                        <code>{previewHtml}</code>
                      </pre>
                    ) : (
                      <div className="bg-gray-100 dark:bg-gray-900 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden max-w-[600px] mx-auto">
                          <iframe
                            srcDoc={previewHtml || ''}
                            className="w-full h-[500px] border-0"
                            title="Email Preview"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Audit Log */}
                  <div className="wewrite-card">
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">Send History</h3>
                        <Badge variant="secondary" className="ml-2">
                          {emailLogs.length} {emailLogs.length === 1 ? 'email' : 'emails'}
                        </Badge>
                      </div>
                      {showLogs ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {showLogs && (
                      <div className="mt-4">
                        {emailLogs.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No emails sent with this template yet</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {emailLogs.map((log) => (
                              <div
                                key={log.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {log.status === 'sent' || log.status === 'delivered' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      {log.recipientUsername ? (
                                        <Link
                                          href={`/user/${log.recipientUsername}`}
                                          className="font-medium text-sm text-primary hover:underline truncate"
                                        >
                                          @{log.recipientUsername}
                                        </Link>
                                      ) : (
                                        <span className="font-medium text-sm truncate">
                                          {log.recipientEmail}
                                        </span>
                                      )}
                                    </div>
                                    {log.recipientUsername && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {log.recipientEmail}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <Badge 
                                    variant={log.status === 'sent' || log.status === 'delivered' ? 'default' : 'destructive'}
                                    className="text-xs"
                                  >
                                    {log.status}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatRelativeTime(log.sentAt)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Template Location */}
                  <div className="wewrite-card">
                    <h3 className="font-semibold mb-3">Template Location</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      To edit this template, modify the code in:
                    </p>
                    <code className="text-sm bg-muted px-3 py-2 rounded block">
                      app/lib/emailTemplates.ts
                    </code>
                    <p className="text-xs text-muted-foreground mt-3">
                      Look for <code className="bg-muted px-1 rounded">{selectedTemplateData.id}EmailTemplate</code> or search for the template ID.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="wewrite-card flex flex-col items-center justify-center h-96 text-center">
                  <Mail className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Template</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Choose an email template from the list to preview its design and see the send history.
                  </p>
                  
                  {/* Legend */}
                  <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      <span>Active</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      <span>Partial</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                      <span>Not Implemented</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
