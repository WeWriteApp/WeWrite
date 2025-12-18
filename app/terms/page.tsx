import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | WeWrite',
  description: 'WeWrite Terms of Service - Read our terms and conditions for using the WeWrite platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <header className="mb-12">
          <Link href="/" className="text-primary hover:underline text-sm mb-4 inline-block">
            &larr; Back to WeWrite
          </Link>
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">
            Last updated: December 18, 2024
          </p>
        </header>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* 1. Platform Nature */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Platform Nature and Role</h2>
            <p className="text-muted-foreground mb-4">
              WeWrite (&quot;the Platform,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a neutral software infrastructure
              that provides tools for users to create, publish, and share written content. WeWrite operates
              solely as a technology platform and does not:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Exercise editorial control over, endorse, or adopt any User Content as its own speech</li>
              <li>Act as a publisher, broadcaster, or speaker with respect to User Content</li>
              <li>Review, pre-screen, or approve User Content before publication</li>
              <li>Make any representations about the accuracy, legality, or quality of User Content</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              All content posted on WeWrite represents the views and speech of the individual users who
              create it, not the views of WeWrite. We provide the technological means for expression;
              users provide the expression itself.
            </p>
          </section>

          {/* 2. User Responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">2. User Responsibilities and Representations</h2>
            <p className="text-muted-foreground mb-4">
              By using WeWrite, you represent, warrant, and agree that:
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">2.1 Legal Compliance</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                You are solely responsible for ensuring that your use of the Platform and all content
                you create, publish, or transmit complies with all applicable laws, regulations, and
                legal obligations in your jurisdiction and any jurisdiction where your content may be accessed
              </li>
              <li>
                You will not use the Platform for any purpose that is unlawful under the laws applicable to you
              </li>
              <li>
                You understand that legal standards vary by jurisdiction and you bear full responsibility
                for understanding and complying with the laws that apply to you
              </li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">2.2 Sanctions and Export Compliance</h3>
            <p className="text-muted-foreground mb-4">
              You represent and warrant that:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                You are not located in, organized under the laws of, or a resident of any country or
                territory subject to comprehensive U.S. sanctions (currently including Cuba, Iran, North
                Korea, Syria, and the Crimea, Donetsk, and Luhansk regions)
              </li>
              <li>
                You are not identified on the Specially Designated Nationals and Blocked Persons List
                (SDN List) maintained by the U.S. Department of the Treasury&apos;s Office of Foreign Assets
                Control (OFAC), nor are you owned or controlled by any person or entity on such list
              </li>
              <li>
                You will not use the Platform to engage in transactions with, or provide services to,
                any person or entity identified on the SDN List or located in a sanctioned jurisdiction
              </li>
              <li>
                You are solely responsible for ensuring your compliance with all applicable sanctions
                laws, export controls, and anti-money laundering regulations
              </li>
              <li>
                You will not use the Platform to evade or circumvent any applicable sanctions or export control laws
              </li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">2.3 Content Responsibility</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                You retain full ownership of and responsibility for all content you create and publish on the Platform
              </li>
              <li>
                You are solely liable for any legal consequences arising from your content, including
                but not limited to claims of defamation, intellectual property infringement, privacy
                violations, or other tortious or illegal conduct
              </li>
              <li>
                You grant WeWrite only the limited license necessary to technically store, transmit,
                and display your content as part of providing the Platform services
              </li>
            </ul>
          </section>

          {/* 3. Financial Services */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Payment Processing and Financial Services</h2>
            <p className="text-muted-foreground mb-4">
              WeWrite is not a financial institution, money transmitter, or payment processor. All
              payment processing on the Platform is conducted by third-party payment processors
              (currently Stripe, Inc.).
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                WeWrite does not hold, custody, or control user funds at any time
              </li>
              <li>
                All payments flow directly between users through our third-party payment processor
              </li>
              <li>
                You acknowledge that your use of payment features is subject to the terms and conditions
                of our payment processor, which you must separately agree to
              </li>
              <li>
                You are responsible for all tax reporting and compliance obligations related to any
                payments you receive through the Platform
              </li>
              <li>
                WeWrite facilitates connections between users but does not act as an intermediary,
                escrow agent, or guarantor for any financial transactions
              </li>
            </ul>
          </section>

          {/* 4. Content Moderation */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Content Moderation and Platform Discretion</h2>
            <p className="text-muted-foreground mb-4">
              While WeWrite does not pre-screen or editorially control User Content, we reserve the
              right, but not the obligation, to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                Remove or restrict access to content that we determine, in our sole discretion,
                violates these Terms or poses legal risk to the Platform
              </li>
              <li>
                Suspend or terminate accounts that violate these Terms or applicable law
              </li>
              <li>
                Cooperate with law enforcement or legal authorities when required by law or valid legal process
              </li>
              <li>
                Implement technical measures to address platform abuse, spam, or security threats
              </li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Any content moderation actions we take are solely to protect the Platform and do not
              constitute editorial control or adoption of any remaining content as our own speech.
            </p>
          </section>

          {/* 5. Prohibited Uses */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Prohibited Uses</h2>
            <p className="text-muted-foreground mb-4">
              You agree not to use the Platform to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Violate any applicable sanctions, export controls, or anti-money laundering laws</li>
              <li>Engage in transactions with sanctioned persons or jurisdictions</li>
              <li>Distribute content that constitutes child sexual abuse material (CSAM)</li>
              <li>Coordinate or incite imminent violence against specific individuals</li>
              <li>Engage in fraud, impersonation, or deceptive practices</li>
              <li>Interfere with the Platform&apos;s technical infrastructure or security</li>
              <li>Use automated means to access the Platform except as expressly permitted</li>
            </ul>
          </section>

          {/* 6. Disclaimer */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground mb-4 uppercase">
              THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-muted-foreground">
              WeWrite does not warrant that the Platform will be uninterrupted, error-free, or
              secure. We make no representations about the accuracy, reliability, or completeness
              of any User Content or the legality of any user&apos;s activities on the Platform.
            </p>
          </section>

          {/* 7. Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4 uppercase">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WEWRITE AND ITS OFFICERS, DIRECTORS,
              EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS,
              DATA, USE, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM OR
              ANY USER CONTENT, REGARDLESS OF WHETHER SUCH DAMAGES WERE FORESEEABLE OR WHETHER
              WEWRITE WAS ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="text-muted-foreground">
              In no event shall WeWrite&apos;s total liability to you exceed the greater of (a) the
              amounts you have paid to WeWrite in the twelve months preceding the claim, or (b)
              one hundred U.S. dollars ($100).
            </p>
          </section>

          {/* 8. Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify, defend, and hold harmless WeWrite and its officers, directors,
              employees, agents, and affiliates from and against any and all claims, damages,
              obligations, losses, liabilities, costs, and expenses (including reasonable attorneys&apos;
              fees) arising from: (a) your use of the Platform; (b) your User Content; (c) your
              violation of these Terms; (d) your violation of any applicable law, regulation, or
              third-party right; or (e) any claim that your User Content caused damage to a third party.
            </p>
          </section>

          {/* 9. Section 230 Notice */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Interactive Computer Service Notice</h2>
            <p className="text-muted-foreground">
              WeWrite operates as an &quot;interactive computer service&quot; as defined in 47 U.S.C. &sect; 230.
              We provide the technical means for users to post content but do not create or develop
              User Content. Under Section 230 of the Communications Decency Act, providers of
              interactive computer services are generally not treated as the publisher or speaker
              of information provided by users.
            </p>
          </section>

          {/* 10. Dispute Resolution */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Dispute Resolution and Governing Law</h2>
            <p className="text-muted-foreground mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the
              State of Delaware, without regard to its conflict of law provisions.
            </p>
            <p className="text-muted-foreground">
              Any dispute arising from these Terms or your use of the Platform shall be resolved
              through binding arbitration administered by the American Arbitration Association
              under its Commercial Arbitration Rules, except that either party may seek injunctive
              or equitable relief in any court of competent jurisdiction. The arbitration shall
              take place in Delaware, and the arbitrator&apos;s decision shall be final and binding.
            </p>
          </section>

          {/* 11. Modifications */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Modifications to Terms</h2>
            <p className="text-muted-foreground">
              WeWrite reserves the right to modify these Terms at any time. We will provide notice
              of material changes by posting the updated Terms on the Platform and updating the
              &quot;Last updated&quot; date. Your continued use of the Platform after such modifications
              constitutes your acceptance of the updated Terms. If you do not agree to the modified
              Terms, you must discontinue use of the Platform.
            </p>
          </section>

          {/* 12. Severability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Severability</h2>
            <p className="text-muted-foreground">
              If any provision of these Terms is found to be unenforceable or invalid, that
              provision shall be limited or eliminated to the minimum extent necessary, and the
              remaining provisions shall remain in full force and effect.
            </p>
          </section>

          {/* 13. Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
            <p className="text-muted-foreground">
              For questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@wewrite.io" className="text-primary hover:underline">
                legal@wewrite.io
              </a>
              .
            </p>
          </section>

          {/* Acceptance */}
          <section className="border-t pt-8 mt-12">
            <p className="text-muted-foreground text-center">
              By creating an account or using WeWrite, you acknowledge that you have read,
              understood, and agree to be bound by these Terms of Service.
            </p>
          </section>
        </div>

        <footer className="mt-12 pt-8 border-t">
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-primary">
              Privacy Policy
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
