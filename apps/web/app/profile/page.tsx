import {
  createDatabasePool,
  getAIProviderConnectionStatus,
  getOrganizationBusinessProfile,
  getOrganizationPreferences,
  listOrganizationInvites,
  listOrganizationMembers,
} from "@signaldesk/persistence";
import type { Metadata } from "next";
import Link from "next/link";

import { ShieldIcon } from "../_components/icons";
import { getCurrentOrganization } from "../_lib/session";
import { AIProviderPanel } from "./ai-provider-panel";
import { BusinessProfileForm } from "./business-profile-form";
import { DeleteOrganizationForm } from "./delete-organization-form";
import { PreferencesForm } from "./preferences-form";
import { TeamPanel } from "./team-panel";

export const dynamic = "force-dynamic";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

export const metadata: Metadata = {
  title: "Profile",
  description: "Account, workspace, security, and preference settings.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { profile: bannerStatus } = await searchParams;
  const session = await getCurrentOrganization();

  if (!session) {
    return (
      <main className="shell appPage" id="main-content">
        <section
          className="pageHero profileHero"
          aria-labelledby="profile-heading"
        >
          <div>
            <p className="sectionKicker">Workspace settings</p>
            <h1 id="profile-heading">Your profile</h1>
            <p>
              Sign in to see your account, workspace, and security settings.
            </p>
          </div>
        </section>

        <aside
          className="honestyNotice"
          aria-labelledby="profile-notice-heading"
        >
          <span className="noticeIcon" aria-hidden="true">
            <ShieldIcon />
          </span>
          <div>
            <h2 id="profile-notice-heading">Not signed in</h2>
            <p>
              <Link href="/login?next=/profile">Sign in</Link> to view your real
              account details, or{" "}
              <Link href="/signup?next=/profile">create an account</Link> if
              you&rsquo;re new here.
            </p>
          </div>
        </aside>
      </main>
    );
  }

  const canManageTeam = session.role === "owner" || session.role === "admin";

  const [businessProfile, preferences, members, invites, aiProviderStatus] =
    await Promise.all([
      getOrganizationBusinessProfile(getPool(), session.organizationId),
      getOrganizationPreferences(getPool(), session.organizationId),
      listOrganizationMembers(getPool(), session.organizationId),
      canManageTeam
        ? listOrganizationInvites(getPool(), session.organizationId)
        : Promise.resolve([]),
      getAIProviderConnectionStatus(
        getPool(),
        session.organizationId,
        "anthropic",
      ),
    ]);

  return (
    <main className="shell appPage" id="main-content">
      <section
        className="pageHero profileHero"
        aria-labelledby="profile-heading"
      >
        <div>
          <p className="sectionKicker">Workspace settings</p>
          <h1 id="profile-heading">Your profile</h1>
          <p>Your real account, workspace, and security settings.</p>
        </div>
      </section>

      {bannerStatus === "export_failed" ? (
        <p className="hubspotSyncStatus hubspotSyncStatus-denied" role="alert">
          Couldn&rsquo;t generate your data export. Please try again.
        </p>
      ) : null}

      <div className="profileGrid">
        <section
          className="settingsCard"
          aria-labelledby="business-profile-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Business rules</p>
              <h2 id="business-profile-heading">Business profile</h2>
            </div>
            <span className="readOnlyBadge">Real, editable</span>
          </div>

          <p>
            Used across the command center: your timezone (date display),
            working days and expected response time (when a lead counts as
            stuck), and high-value threshold (when a stuck lead is critical, not
            just high).
          </p>

          <BusinessProfileForm
            timezone={businessProfile.timezone}
            defaultExpectedResponseHours={
              businessProfile.defaultExpectedResponseHours
            }
            highValueThresholdCents={businessProfile.highValueThresholdCents}
            workingDaysBitmask={businessProfile.workingDaysBitmask}
            industry={businessProfile.industry}
            canEdit={session.role === "owner"}
          />
        </section>

        <section
          className="settingsCard identityCard"
          aria-labelledby="identity-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Identity</p>
              <h2 id="identity-heading">Personal details</h2>
            </div>
            <span className="plannedBadge">Editing planned</span>
          </div>

          <div className="profileIdentity">
            <span className="profileAvatar" aria-hidden="true">
              {session.isAnonymous
                ? "GU"
                : (session.email ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{session.isAnonymous ? "Guest" : session.email}</strong>
              <span>{session.role === "owner" ? "Owner" : session.role}</span>
            </div>
          </div>

          <dl className="settingsList">
            <div>
              <dt>Email</dt>
              <dd>
                {session.isAnonymous ? "None (guest session)" : session.email}
              </dd>
            </div>
            <div>
              <dt>User ID</dt>
              <dd>
                <code>{session.userId}</code>
              </dd>
            </div>
          </dl>
          <p>
            A unique identifier for your account. You won&rsquo;t need it day to
            day — it&rsquo;s here for a future support conversation, not
            something to act on.
          </p>
        </section>

        <section className="settingsCard" aria-labelledby="membership-heading">
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Workspace</p>
              <h2 id="membership-heading">Membership</h2>
            </div>
            <span className="readOnlyBadge">Real, auto-provisioned</span>
          </div>

          <dl className="settingsList">
            <div>
              <dt>Organization ID</dt>
              <dd>
                <code>{session.organizationId}</code>
              </dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{session.role}</dd>
            </div>
            <div>
              <dt>Workspace type</dt>
              <dd>Solo workspace, created automatically when you signed up</dd>
            </div>
          </dl>
          <p>
            A unique identifier for this workspace, for the same reason as your
            User ID above — not something you need to use directly.
          </p>

          <TeamPanel
            members={members}
            invites={invites}
            canManage={canManageTeam}
          />
        </section>

        <section className="settingsCard" aria-labelledby="ai-provider-heading">
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">AI</p>
              <h2 id="ai-provider-heading">AI providers</h2>
            </div>
            <span className="readOnlyBadge">Real, editable</span>
          </div>

          <p>
            Bring your own AI provider key. When connected, this
            workspace&rsquo;s AI investigations run on your own Anthropic
            account/budget instead of the platform default — grants no new
            ability for AI to act on anything; every existing approval gate
            stays exactly as strict.
          </p>

          <AIProviderPanel
            status={aiProviderStatus}
            canManage={canManageTeam}
          />
        </section>

        <section
          className="settingsCard securityCard"
          aria-labelledby="security-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Account safety</p>
              <h2 id="security-heading">Security</h2>
            </div>
            <ShieldIcon className="settingsIcon" />
          </div>

          <ul className="securityList">
            <li>
              <span
                className={`securityState ${session.isAnonymous ? "planned" : "safe"}`}
                aria-hidden="true"
              />
              <div>
                <strong>Authentication</strong>
                <span>
                  {session.isAnonymous
                    ? "Guest session (Supabase anonymous sign-in) — create an account to keep this workspace"
                    : "Supabase Auth, email + password"}
                </span>
              </div>
            </li>
            <li>
              <span className="securityState planned" aria-hidden="true" />
              <div>
                <strong>Social sign-in</strong>
                <span>
                  Google, Slack, LinkedIn, and Facebook sign-in are planned but
                  not available yet
                </span>
              </div>
            </li>
            <li>
              <span className="securityState planned" aria-hidden="true" />
              <div>
                <strong>Multi-factor authentication</strong>
                <span>Not yet enabled</span>
              </div>
            </li>
            <li>
              <span className="securityState safe" aria-hidden="true" />
              <div>
                <strong>Password storage</strong>
                <span>
                  Salted hash held by Supabase Auth; this app never sees it
                </span>
              </div>
            </li>
          </ul>
        </section>

        <section
          className="settingsCard preferencesCard"
          aria-labelledby="preferences-heading"
        >
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Experience</p>
              <h2 id="preferences-heading">Preferences</h2>
            </div>
            <span className="readOnlyBadge">Real, editable</span>
          </div>

          <p>
            Toggle which notifications this workspace receives. Sending the
            actual emails isn&rsquo;t built yet — these preferences are real and
            saved, but nothing is dispatched against them today.
          </p>

          <PreferencesForm
            morningBriefEnabled={preferences.morningBriefEnabled}
            attentionAlertsEnabled={preferences.attentionAlertsEnabled}
            weeklyRecapEnabled={preferences.weeklyRecapEnabled}
            canEdit={session.role === "owner"}
          />
        </section>

        <section className="settingsCard" aria-labelledby="data-heading">
          <div className="settingsCardHeader">
            <div>
              <p className="sectionKicker">Privacy</p>
              <h2 id="data-heading">Your data</h2>
            </div>
            <span className="readOnlyBadge">Real</span>
          </div>

          <p>
            Download everything this workspace has recorded — leads, invoices,
            tasks, messages, support tickets, daily briefs, recent audit events,
            and your subscription — as one JSON file.
          </p>

          <div className="checkoutForm">
            <a className="btn btn-secondary" href="/profile/export">
              Export your data
            </a>
          </div>

          {session.role === "owner" ? (
            <div className="dangerZone">
              <h3>Danger zone</h3>
              <DeleteOrganizationForm />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
