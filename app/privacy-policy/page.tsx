import Image from "next/image"
import Link from "next/link"

export const metadata = {
  title: "Privacy Policy - Auto Launch Ads",
}

export default function PrivacyPolicyPage() {
  const lastUpdated = "April 19, 2026"
  const appName = "AdLauncher"
  const contactEmail = "[EMAIL_ADDRESS]"
  const websiteUrl = "https://autolaunchads.com"

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/applogo.webp" alt="Auto Launch Ads" width={28} height={28} />
            <span className="font-heading text-lg font-bold">{appName}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="font-heading text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">1. Introduction</h2>
            <p className="mt-3">
              {appName} (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application and services.
            </p>
            <p className="mt-2">
              By using {appName}, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">2. Information We Collect</h2>

            <h3 className="mt-4 font-semibold text-foreground">2.1 Information You Provide</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Account Information:</strong> Name, email address, and password when you create an account.</li>
              <li><strong>Organization Data:</strong> Organization name and team member information.</li>
              <li><strong>Ad Content:</strong> Creative assets (images, videos), ad copy (headlines, descriptions, primary text), and campaign configurations you create within the platform.</li>
            </ul>

            <h3 className="mt-4 font-semibold text-foreground">2.2 Information from Third-Party Services</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Facebook/Meta Data:</strong> When you connect your Facebook account, we access your Facebook User ID, name, profile picture, email, Facebook Pages, Ad Accounts, Business Managers, and advertising data through the Meta Marketing API.</li>
              <li><strong>Facebook Access Tokens:</strong> We securely store OAuth access tokens to manage your Facebook advertising on your behalf.</li>
            </ul>

            <h3 className="mt-4 font-semibold text-foreground">2.3 Automatically Collected Information</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Usage Data:</strong> Browser type, pages visited, time spent on pages, and other diagnostic data.</li>
              <li><strong>Cookies:</strong> Session cookies for authentication and user preferences.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
            <p className="mt-3">We use the collected information to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Provide, maintain, and improve our services.</li>
              <li>Create and manage your Facebook ad campaigns on your behalf.</li>
              <li>Upload creative assets to Meta&apos;s advertising platform.</li>
              <li>Enable real-time collaboration with your team members.</li>
              <li>Send invitation emails and notifications related to your account.</li>
              <li>Authenticate your identity and manage your session.</li>
              <li>Respond to your inquiries and provide customer support.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">4. Facebook Data Usage</h2>
            <p className="mt-3">
              We access Facebook data solely to provide our advertising management services. Specifically:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>We use <strong>ads_management</strong> to create, edit, and manage ad campaigns on your behalf.</li>
              <li>We use <strong>pages_show_list</strong> and <strong>pages_read_engagement</strong> to display your Facebook Pages and allow you to select which page to advertise from.</li>
              <li>We use <strong>business_management</strong> to access your Business Manager accounts and ad accounts.</li>
              <li>We use <strong>ads_read</strong> to retrieve campaign performance data.</li>
            </ul>
            <p className="mt-2">
              We do not sell, rent, or share your Facebook data with any third parties. We do not use your Facebook data for purposes unrelated to providing our services.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">5. Data Storage and Security</h2>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>Your data is stored securely using Supabase (hosted on AWS infrastructure) with row-level security policies.</li>
              <li>Facebook access tokens are encrypted and stored securely in our database.</li>
              <li>We use HTTPS for all data transmission.</li>
              <li>Access to your organization&apos;s data is restricted to authorized team members only.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">6. Data Sharing</h2>
            <p className="mt-3">We do not sell your personal information. We may share your information only in the following circumstances:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>With Meta/Facebook:</strong> To create and manage advertising campaigns as directed by you.</li>
              <li><strong>With Your Team:</strong> Organization members can view shared creative assets and campaign data within the same organization.</li>
              <li><strong>Service Providers:</strong> We use trusted third-party services (Supabase for database, Resend for email) that process data on our behalf.</li>
              <li><strong>Legal Requirements:</strong> If required by law, regulation, or legal process.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">7. Data Retention</h2>
            <p className="mt-3">
              We retain your data for as long as your account is active or as needed to provide our services. When you delete your organization, all associated data (creatives, campaigns, team members, Facebook connections) is permanently deleted from our systems.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">8. Your Rights</h2>
            <p className="mt-3">You have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Access:</strong> Request a copy of your personal data.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data.</li>
              <li><strong>Deletion:</strong> Delete your account and all associated data at any time through the Settings page.</li>
              <li><strong>Disconnect:</strong> Revoke Facebook access at any time through Settings, which removes stored tokens.</li>
              <li><strong>Data Portability:</strong> Request your data in a machine-readable format.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">9. Cookies</h2>
            <p className="mt-3">
              We use essential cookies only for authentication and session management. We do not use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">10. Children&apos;s Privacy</h2>
            <p className="mt-3">
              Our service is not directed to individuals under the age of 18. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">11. Changes to This Policy</h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-foreground">12. Contact Us</h2>
            <p className="mt-3">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mt-2">
              <strong>Email:</strong>{" "}
              <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                {contactEmail}
              </a>
            </p>
            <p className="mt-1">
              <strong>Website:</strong>{" "}
              <a href={websiteUrl} className="text-primary hover:underline">
                {websiteUrl}
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/applogo.webp" alt="Logo" width={20} height={20} />
            <span className="font-heading text-sm font-semibold">{appName}</span>
          </Link>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {appName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
