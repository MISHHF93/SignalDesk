import {
  createDatabasePool,
  getOrganizationBusinessProfile,
  getOrganizationPreferences,
} from "@signaldesk/persistence";
import type { Metadata } from "next";
import Link from "next/link";

import { ShieldIcon } from "../_components/icons";
import { getCurrentOrganization } from "../_lib/session";
import { BusinessProfileForm } from "./business-profile-form";
import { PreferencesForm } from "./preferences-form";

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

export default async function ProfilePage() {
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

  const businessProfile = await getOrganizationBusinessProfile(
    getPool(),
    session.organizationId,
  );
  const preferences = await getOrganizationPreferences(
    getPool(),
    session.organizationId,
  );

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
              <dt>Provisioning</dt>
              <dd>One solo organization, created automatically at sign-up</dd>
            </div>
            <div>
              <dt>Team invites</dt>
              <dd>Not built yet</dd>
            </div>
          </dl>
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
                  Scaffolded (Google, Slack, LinkedIn, Facebook) — not yet
                  connected
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
      </div>
    </main>
  );
}
