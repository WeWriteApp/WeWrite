"use client";

import React, { useState } from 'react';
import { ComponentShowcase, StateDemo } from './shared';
import { emailStyles } from '@/lib/emailTemplates';

/**
 * Email Component Demos
 *
 * This section showcases the various email components and styles used in WeWrite's
 * email templates. These are inline-styled HTML components for email compatibility.
 */

// Email wrapper preview (simplified for demo)
function EmailPreviewWrapper({ children, title = "Preview" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white">
      {title && (
        <div className="bg-muted/50 px-3 py-1.5 border-b border-border">
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
      )}
      <div className="p-6" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }}>
        {children}
      </div>
    </div>
  );
}

// Email Header Component
function EmailHeader() {
  return (
    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
      <table cellPadding="0" cellSpacing="0" style={{ margin: '0 auto' }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
              <img
                src="https://getwewrite.app/icons/icon-192x192.png"
                alt="WeWrite"
                width="44"
                height="44"
                style={{ display: 'block', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              />
            </td>
            <td style={{ verticalAlign: 'middle' }}>
              <h1 style={{ color: '#000', margin: 0, fontSize: '28px', fontWeight: 600 }}>WeWrite</h1>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Parse CSS string from emailStyles into React CSSProperties
 * This ensures the design system preview matches actual email styles
 */
function parseCssString(cssString: string): React.CSSProperties {
  const style: Record<string, string | number> = {};
  cssString.split(';').forEach(rule => {
    const [prop, value] = rule.split(':').map(s => s.trim());
    if (prop && value) {
      // Convert kebab-case to camelCase
      const camelProp = prop.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      style[camelProp] = value;
    }
  });
  return style as React.CSSProperties;
}

// Primary CTA Button - uses emailStyles from emailTemplates.ts for consistency
function EmailButton({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' }) {
  // Parse the centralized email styles to ensure previews match actual emails
  const styles: Record<string, React.CSSProperties> = {
    primary: parseCssString(emailStyles.button),
    secondary: parseCssString(emailStyles.secondaryButton),
    danger: {
      ...parseCssString(emailStyles.button),
      background: '#cc0000',
    },
  };

  return (
    <a href="#" style={styles[variant]}>
      {children}
    </a>
  );
}

// Stats Box Component
function EmailStatsBox({ value, label, variant = 'default' }: { value: string; label: string; variant?: 'default' | 'success' }) {
  const styles: Record<string, { container: React.CSSProperties; value: React.CSSProperties; label: React.CSSProperties }> = {
    default: {
      container: {
        flex: 1,
        minWidth: '120px',
        background: '#fff',
        border: '1px solid #eee',
        borderRadius: '6px',
        padding: '16px',
        textAlign: 'center',
      },
      value: { fontSize: '24px', fontWeight: 700, color: '#000' },
      label: { fontSize: '12px', color: '#666' },
    },
    success: {
      container: {
        flex: 1,
        minWidth: '120px',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        border: '1px solid #86efac',
        borderRadius: '6px',
        padding: '16px',
        textAlign: 'center',
      },
      value: { fontSize: '24px', fontWeight: 700, color: '#166534' },
      label: { fontSize: '12px', color: '#15803d' },
    },
  };

  return (
    <div style={styles[variant].container}>
      <div style={styles[variant].value}>{value}</div>
      <div style={styles[variant].label}>{label}</div>
    </div>
  );
}

// Earnings Highlight Box
function EmailEarningsHighlight({ amount, label }: { amount: string; label: string }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      borderRadius: '8px',
      padding: '24px',
      margin: '24px 0',
      textAlign: 'center',
    }}>
      <p style={{ color: 'rgba(255,255,255,0.9)', margin: '0 0 8px 0', fontSize: '14px' }}>{label}</p>
      <p style={{ color: '#fff', margin: 0, fontSize: '36px', fontWeight: 700 }}>{amount}</p>
    </div>
  );
}

// Progress Bar Component
function EmailProgressBar({ percentage, label, current, total }: { percentage: number; label: string; current: string; total: string }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      border: '1px solid #86efac',
      borderRadius: '6px',
      padding: '20px',
      margin: '20px 0',
    }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px', color: '#166534' }}>{label}</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>{current} / {total}</span>
        </div>
        <div style={{ background: '#bbf7d0', borderRadius: '9999px', height: '10px', overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            height: '100%',
            width: `${percentage}%`,
            borderRadius: '9999px',
          }} />
        </div>
      </div>
    </div>
  );
}

// Info Box Component
function EmailInfoBox({ children, icon = '💡' }: { children: React.ReactNode; icon?: string }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #eee',
      borderRadius: '6px',
      padding: '16px',
      margin: '20px 0',
    }}>
      <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
        {icon} {children}
      </p>
    </div>
  );
}

// Footer Component
function EmailFooter() {
  return (
    <div style={{ textAlign: 'center', fontSize: '12px', color: '#999' }}>
      <p>&copy; {new Date().getFullYear()} WeWrite. All rights reserved.</p>
      <p>
        <a href="#" style={{ color: '#999' }}>Manage email preferences</a>
        <span style={{ color: '#ccc' }}> | </span>
        <a href="#" style={{ color: '#999' }}>Unsubscribe</a>
      </p>
    </div>
  );
}

// Table Row Component (for payout details, etc.)
function EmailTableRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr>
      <td style={{ padding: '8px 0', color: highlight ? '#166534' : '#15803d' }}>{label}</td>
      <td style={{
        padding: '8px 0',
        textAlign: 'right',
        fontWeight: highlight ? 700 : 400,
        color: '#166534',
        fontSize: highlight ? '18px' : 'inherit',
      }}>{value}</td>
    </tr>
  );
}

export function EmailSection({ id }: { id: string }) {
  const [showDarkMode, setShowDarkMode] = useState(false);

  return (
    <ComponentShowcase
      id={id}
      title="Email Components"
      path="app/lib/emailTemplates.ts"
      description="Inline-styled HTML components used in email templates. These components are designed to work across email clients (Gmail, Apple Mail, Outlook) with proper fallbacks and dark mode support."
    >
      <StateDemo label="Email Header">
        <EmailPreviewWrapper title="Header Component">
          <EmailHeader />
        </EmailPreviewWrapper>
      </StateDemo>

      <StateDemo label="Primary CTA Buttons">
        <EmailPreviewWrapper title="Button Variants">
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <EmailButton variant="primary">Primary Action</EmailButton>
            <EmailButton variant="secondary">Secondary Action</EmailButton>
            <EmailButton variant="danger">Danger Action</EmailButton>
          </div>
        </EmailPreviewWrapper>
      </StateDemo>

      <StateDemo label="Card Containers">
        <div className="grid gap-4">
          <EmailPreviewWrapper title="Default Card">
            <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '24px' }}>
              <h2 style={{ marginTop: 0, color: '#000' }}>Welcome to WeWrite!</h2>
              <p style={{ color: '#333' }}>This is a default card container used for most email content.</p>
            </div>
          </EmailPreviewWrapper>

          <EmailPreviewWrapper title="Success Card">
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1px solid #86efac',
              borderRadius: '8px',
              padding: '24px',
            }}>
              <p style={{ margin: 0, color: '#166534' }}>
                <strong>Success!</strong> Your payout has been processed.
              </p>
            </div>
          </EmailPreviewWrapper>

          <EmailPreviewWrapper title="Info Card">
            <div style={{
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              border: '1px solid #bae6fd',
              borderRadius: '8px',
              padding: '24px',
            }}>
              <p style={{ margin: 0, color: '#0c4a6e' }}>
                <strong>Step 1 of 2:</strong> Verify your email address
              </p>
            </div>
          </EmailPreviewWrapper>

          <EmailPreviewWrapper title="Alert Card">
            <div style={{
              background: '#fff4f4',
              border: '1px solid #ffcccc',
              borderRadius: '8px',
              padding: '24px',
            }}>
              <h2 style={{ marginTop: 0, color: '#cc0000' }}>Security Alert</h2>
              <p style={{ color: '#333' }}>We detected unusual activity on your account.</p>
            </div>
          </EmailPreviewWrapper>
        </div>
      </StateDemo>

      <StateDemo label="Stats Boxes">
        <EmailPreviewWrapper title="Weekly Digest Stats">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <EmailStatsBox value="142" label="Page Views" />
            <EmailStatsBox value="3" label="New Followers" />
            <EmailStatsBox value="$2.50" label="Earned This Week" variant="success" />
          </div>
        </EmailPreviewWrapper>
      </StateDemo>

      <StateDemo label="Earnings Highlight">
        <EmailPreviewWrapper title="First Earnings Celebration">
          <EmailEarningsHighlight amount="$2.50" label="Your first earnings" />
        </EmailPreviewWrapper>
      </StateDemo>

      <StateDemo label="Progress Bar">
        <EmailPreviewWrapper title="Payout Progress">
          <EmailProgressBar
            percentage={50}
            label="Your progress"
            current="$12.50"
            total="$25.00"
          />
        </EmailPreviewWrapper>
      </StateDemo>

      <StateDemo label="Info Box">
        <EmailPreviewWrapper title="Contextual Tips">
          <EmailInfoBox icon="🔒">
            <strong>Safe and secure:</strong> We use Stripe—the same payment system used by millions of businesses—to make sure your money gets to you safely.
          </EmailInfoBox>
          <EmailInfoBox icon="💡">
            <strong>Tips for a great username:</strong> Keep it memorable and easy to spell.
          </EmailInfoBox>
        </EmailPreviewWrapper>
      </StateDemo>

      <StateDemo label="Data Table">
        <EmailPreviewWrapper title="Payout Details">
          <div style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '20px',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <EmailTableRow label="Amount" value="$45.00" highlight />
                <EmailTableRow label="Processed on" value="December 1, 2025" />
                <EmailTableRow label="Expected arrival" value="December 3-5, 2025" />
              </tbody>
            </table>
          </div>
        </EmailPreviewWrapper>
      </StateDemo>

      <StateDemo label="Footer">
        <EmailPreviewWrapper title="Email Footer">
          <EmailFooter />
        </EmailPreviewWrapper>
      </StateDemo>

      <StateDemo label="Complete Email Example">
        <EmailPreviewWrapper title="Payout Processed Email">
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <EmailHeader />
            <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '30px', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, color: '#000' }}>Hey John, your payout is on its way!</h2>
              <p style={{ color: '#333', fontSize: '16px' }}>
                This is the moment that makes it all worth it. We've just sent <strong>$45.00</strong> to your bank account—money you earned by sharing your words with the world.
              </p>

              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '20px',
                margin: '20px 0',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <EmailTableRow label="Amount" value="$45.00" highlight />
                    <EmailTableRow label="Processed on" value="December 1, 2025" />
                    <EmailTableRow label="Expected arrival" value="December 3-5, 2025" />
                  </tbody>
                </table>
              </div>

              <p style={{ color: '#333' }}>
                This is what happens when readers believe in your work. Thank you for being part of WeWrite—keep writing, keep earning, keep being awesome.
              </p>

              <div style={{ textAlign: 'center', margin: '30px 0' }}>
                <EmailButton>Keep Writing →</EmailButton>
              </div>
            </div>
            <EmailFooter />
          </div>
        </EmailPreviewWrapper>
      </StateDemo>

      <StateDemo label="Dark Mode Classes Reference">
        <div className="wewrite-card text-sm space-y-2">
          <p className="text-muted-foreground mb-3">
            These CSS classes are used for dark mode support in email clients that support <code>prefers-color-scheme</code>:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <code className="bg-muted px-2 py-1 rounded">.dark-text</code>
            <span className="text-muted-foreground">Light text color</span>
            <code className="bg-muted px-2 py-1 rounded">.dark-text-muted</code>
            <span className="text-muted-foreground">Muted text color</span>
            <code className="bg-muted px-2 py-1 rounded">.dark-text-heading</code>
            <span className="text-muted-foreground">Heading text (white)</span>
            <code className="bg-muted px-2 py-1 rounded">.dark-card</code>
            <span className="text-muted-foreground">Card background</span>
            <code className="bg-muted px-2 py-1 rounded">.dark-card-inner</code>
            <span className="text-muted-foreground">Nested card background</span>
            <code className="bg-muted px-2 py-1 rounded">.dark-footer</code>
            <span className="text-muted-foreground">Footer text/links</span>
            <code className="bg-muted px-2 py-1 rounded">.dark-link</code>
            <span className="text-muted-foreground">Link color (blue)</span>
            <code className="bg-muted px-2 py-1 rounded">.dark-stat-box</code>
            <span className="text-muted-foreground">Stats box background</span>
            <code className="bg-muted px-2 py-1 rounded">.dark-alert-security</code>
            <span className="text-muted-foreground">Security alert styling</span>
          </div>
        </div>
      </StateDemo>

      <StateDemo label="UTM Tracking Helper">
        <div className="wewrite-card text-sm space-y-3">
          <p className="text-muted-foreground">
            Use <code>addEmailUtm()</code> to add tracking parameters to all email links:
          </p>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`import { addEmailUtm } from '@/lib/emailTemplates';

// Usage
const trackedUrl = addEmailUtm(
  'https://getwewrite.app/settings',
  'verification-reminder',  // utm_campaign
  'verify_button'           // utm_content (optional)
);

// Result:
// https://getwewrite.app/settings?utm_source=email&utm_medium=email&utm_campaign=verification-reminder&utm_content=verify_button`}
          </pre>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
