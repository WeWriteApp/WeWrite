import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | WeWrite',
  description: 'WeWrite Privacy Policy - Learn how we collect, use, and protect your information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <header className="mb-12">
          <Link href="/" className="text-primary hover:underline text-sm mb-4 inline-block">
            &larr; Back to WeWrite
          </Link>
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">
            Last updated: December 18, 2024
          </p>
        </header>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* 1. Introduction */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground mb-4">
              WeWrite (&quot;the Platform,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our platform. WeWrite operates as a neutral software infrastructure
              for written content creation and sharing.
            </p>
            <p className="text-muted-foreground">
              By using WeWrite, you consent to the data practices described in this policy. If you do not
              agree with this Privacy Policy, please do not access or use the Platform.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-medium mt-6 mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong>Account Information:</strong> When you create an account, we collect your email
                address, username, and optional profile information such as display name and profile picture.
              </li>
              <li>
                <strong>Content:</strong> Any written content you create, publish, or share on the Platform,
                including drafts, comments, and collaborative contributions.
              </li>
              <li>
                <strong>Payment Information:</strong> If you participate in monetization features, we collect
                information necessary to process payments. Note that payment processing is handled by our
                third-party payment processor (Stripe), and we do not directly store your full payment card details.
              </li>
              <li>
                <strong>Communications:</strong> Information you provide when you contact us for support or
                communicate with other users through the Platform.
              </li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong>Device and Usage Information:</strong> We collect information about your device,
                browser type, operating system, IP address, and how you interact with the Platform.
              </li>
              <li>
                <strong>Analytics Data:</strong> We collect aggregated analytics about page views, reading
                patterns, and engagement metrics to improve the Platform and provide insights to content creators.
              </li>
              <li>
                <strong>Cookies and Similar Technologies:</strong> We use cookies and similar tracking
                technologies to maintain sessions, remember preferences, and analyze Platform usage.
              </li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">2.3 Information from Third Parties</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong>Authentication Providers:</strong> If you sign in through a third-party service
                (such as Google), we receive basic profile information from that service.
              </li>
              <li>
                <strong>Payment Processor:</strong> We receive transaction confirmations and limited account
                status information from Stripe to manage creator payouts and subscriptions.
              </li>
            </ul>
          </section>

          {/* 3. How We Use Your Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Provide, maintain, and improve the Platform and its features</li>
              <li>Process transactions and send related information, including purchase confirmations and invoices</li>
              <li>Send you technical notices, updates, security alerts, and support messages</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Monitor and analyze trends, usage, and activities in connection with the Platform</li>
              <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
              <li>Personalize and improve your experience on the Platform</li>
              <li>Provide content creator analytics and earnings information</li>
              <li>Comply with legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          {/* 4. How We Share Your Information */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">4. How We Share Your Information</h2>
            <p className="text-muted-foreground mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">4.1 Public Content</h3>
            <p className="text-muted-foreground mb-4">
              Content you choose to publish on WeWrite is publicly visible by default. Your username and
              profile information associated with published content are visible to other users and the public.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">4.2 Service Providers</h3>
            <p className="text-muted-foreground mb-4">
              We share information with third-party vendors and service providers who perform services on
              our behalf, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Payment processing (Stripe)</li>
              <li>Cloud hosting and infrastructure (Google Cloud, Firebase)</li>
              <li>Email delivery services</li>
              <li>Analytics and monitoring services</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">4.3 Legal Requirements</h3>
            <p className="text-muted-foreground mb-4">
              We may disclose your information if required to do so by law or in response to valid requests
              by public authorities (e.g., a court or government agency), including to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Comply with a legal obligation</li>
              <li>Protect and defend our rights or property</li>
              <li>Prevent or investigate possible wrongdoing in connection with the Platform</li>
              <li>Protect the personal safety of users or the public</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">4.4 Business Transfers</h3>
            <p className="text-muted-foreground">
              If WeWrite is involved in a merger, acquisition, or sale of assets, your information may be
              transferred as part of that transaction. We will provide notice before your information is
              transferred and becomes subject to a different privacy policy.
            </p>
          </section>

          {/* 5. Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
            <p className="text-muted-foreground mb-4">
              We retain your information for as long as your account is active or as needed to provide you
              services. We will retain and use your information as necessary to comply with our legal
              obligations, resolve disputes, and enforce our agreements.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong>Account Data:</strong> Retained while your account is active. Upon account deletion,
                we remove or anonymize your personal information within 30 days, except as required for legal purposes.
              </li>
              <li>
                <strong>Published Content:</strong> Content you publish remains on the Platform until you
                delete it. Deleted content may persist in backups for up to 90 days.
              </li>
              <li>
                <strong>Financial Records:</strong> Transaction records are retained for 7 years to comply
                with tax and accounting requirements.
              </li>
              <li>
                <strong>Analytics Data:</strong> Aggregated, anonymized analytics data may be retained indefinitely.
              </li>
            </ul>
          </section>

          {/* 6. Your Rights and Choices */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Your Rights and Choices</h2>

            <h3 className="text-xl font-medium mt-6 mb-3">6.1 Account Information</h3>
            <p className="text-muted-foreground mb-4">
              You can access, update, or delete your account information at any time through your account
              settings. You may also contact us to request access to, correction of, or deletion of personal
              information you have provided to us.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">6.2 Email Communications</h3>
            <p className="text-muted-foreground mb-4">
              You can opt out of receiving promotional emails by following the unsubscribe instructions in
              those emails or adjusting your email preferences in your account settings. You will continue
              to receive transactional emails related to your account and purchases.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">6.3 Cookies</h3>
            <p className="text-muted-foreground mb-4">
              Most web browsers are set to accept cookies by default. You can usually choose to set your
              browser to remove or reject cookies, but this may affect certain features or services of the Platform.
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">6.4 Data Portability</h3>
            <p className="text-muted-foreground">
              You may request a copy of your personal data in a commonly used, machine-readable format by
              contacting us at the email address below.
            </p>
          </section>

          {/* 7. Security */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Security</h2>
            <p className="text-muted-foreground mb-4">
              We implement appropriate technical and organizational measures to protect your personal
              information against unauthorized access, alteration, disclosure, or destruction. These measures include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Encryption of data in transit using TLS/SSL</li>
              <li>Encryption of sensitive data at rest</li>
              <li>Regular security assessments and monitoring</li>
              <li>Access controls and authentication requirements</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              However, no method of transmission over the Internet or electronic storage is completely
              secure, and we cannot guarantee absolute security.
            </p>
          </section>

          {/* 8. International Data Transfers */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
            <p className="text-muted-foreground">
              Your information may be transferred to and maintained on servers located outside of your
              state, province, country, or other governmental jurisdiction where data protection laws may
              differ from those in your jurisdiction. By using the Platform, you consent to such transfers.
              We take steps to ensure that your data is treated securely and in accordance with this Privacy Policy.
            </p>
          </section>

          {/* 9. Children's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground">
              WeWrite is not intended for children under the age of 13. We do not knowingly collect personal
              information from children under 13. If we learn we have collected or received personal
              information from a child under 13, we will delete that information. If you believe we might
              have any information from or about a child under 13, please contact us.
            </p>
          </section>

          {/* 10. California Privacy Rights */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">10. California Privacy Rights</h2>
            <p className="text-muted-foreground mb-4">
              If you are a California resident, you have certain rights under the California Consumer
              Privacy Act (CCPA), including the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Know what personal information we collect, use, disclose, and sell</li>
              <li>Request deletion of your personal information</li>
              <li>Opt out of the sale of your personal information (we do not sell personal information)</li>
              <li>Non-discrimination for exercising your CCPA rights</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              To exercise these rights, please contact us using the information below.
            </p>
          </section>

          {/* 11. European Privacy Rights */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">11. European Privacy Rights</h2>
            <p className="text-muted-foreground mb-4">
              If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you
              have certain rights under the General Data Protection Regulation (GDPR), including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Right to access your personal data</li>
              <li>Right to rectification of inaccurate personal data</li>
              <li>Right to erasure (&quot;right to be forgotten&quot;)</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
              <li>Right to withdraw consent</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Our legal basis for processing your personal data depends on the context: we process account
              information to perform our contract with you; we process analytics data based on our legitimate
              interests in improving the Platform; and we process marketing communications based on your consent.
            </p>
          </section>

          {/* 12. Changes to This Policy */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any changes by
              posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. You are
              advised to review this Privacy Policy periodically for any changes. Your continued use of the
              Platform after any modifications indicates your acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* 13. Contact Us */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy or our data practices, please contact us at{' '}
              <a href="mailto:privacy@wewrite.io" className="text-primary hover:underline">
                privacy@wewrite.io
              </a>
              .
            </p>
          </section>

          {/* Acknowledgment */}
          <section className="border-t pt-8 mt-12">
            <p className="text-muted-foreground text-center">
              By using WeWrite, you acknowledge that you have read and understood this Privacy Policy.
            </p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t">
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-primary">
              Terms of Service
            </Link>
            <Link href="/" className="hover:text-primary">
              WeWrite Home
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
