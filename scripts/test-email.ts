/**
 * Test Resend Email Integration
 * 
 * Run with: bun run scripts/test-email.ts
 * 
 * This sends a test email to verify Resend is working correctly.
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  console.log('🧪 Testing Resend email integration...\n');
  
  // Check if API key is set
  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY is not set in environment variables');
    console.log('   Add it to your .env.local file');
    process.exit(1);
  }
  
  console.log('✅ API key is configured');
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'WeWrite <onboarding@resend.dev>',
      to: 'getwewrite@gmail.com',
      subject: 'WeWrite Email Test ✅',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1 style="color: #000;">Email Test Successful! 🎉</h1>
          <p>If you're reading this, Resend is working correctly for WeWrite.</p>
          <p style="color: #666; font-size: 14px;">
            Sent at: ${new Date().toISOString()}
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            This is a test email from the WeWrite development environment.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('❌ Failed to send email:', error);
      process.exit(1);
    }

    console.log('✅ Test email sent successfully!');
    console.log(`   Email ID: ${data?.id}`);
    console.log('   Recipient: getwewrite@gmail.com');
    console.log('\n📧 Check your inbox to confirm delivery.');
    
  } catch (err) {
    console.error('❌ Error sending email:', err);
    process.exit(1);
  }
}

testEmail();
