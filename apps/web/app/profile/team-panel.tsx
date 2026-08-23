"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  OrganizationInvite,
  OrganizationMember,
} from "@signaldesk/persistence";

import { inviteMemberAction } from "../_actions/invite-member";
import { revokeInviteAction } from "../_actions/revoke-invite";
import { Button } from "../_components/button";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

function isExpired(invite: OrganizationInvite): boolean {
  return invite.status === "pending" && invite.expiresAt.getTime() < Date.now();
}

function inviteStatusLabel(invite: OrganizationInvite): string {
  if (invite.status === "pending" && isExpired(invite)) {
    return "Expired";
  }

  switch (invite.status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "revoked":
      return "Revoked";
    case "expired":
      return "Expired";
    default:
      return invite.status;
  }
}

function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="ghost"
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await revokeInviteAction(inviteId);
            if (result.ok) {
              // This list is server-rendered (listOrganizationInvites,
              // fetched before this click). Refresh so the invite's real
              // status moves it from "Pending" to "Past invites" —
              // matching CreateGoalForm's identical after-write refresh.
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        {isPending ? "Revoking…" : "Revoke"}
      </Button>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function InviteMemberForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("role", role);

      const result = await inviteMemberAction(
        { error: null, message: null },
        formData,
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage(result.message);
      setEmail("");
      // The pending-invites list is server-rendered from data fetched
      // before this submission — refresh so the new invite actually
      // appears without a manual reload (same gap CreateGoalForm's own
      // doc comment describes for its goals list).
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="authForm">
      <div className="authField">
        <label htmlFor="invite-email">Email</label>
        <input
          id="invite-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@example.com"
          required
        />
      </div>

      <div className="authField">
        <label htmlFor="invite-role">Role</label>
        <select
          id="invite-role"
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>

      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="cardActionStatus cardActionStatus-success" role="status">
          {message}
        </p>
      ) : null}

      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}

export function TeamPanel({
  members,
  invites,
  canManage,
}: {
  members: readonly OrganizationMember[];
  invites: readonly OrganizationInvite[];
  canManage: boolean;
}) {
  const pendingInvites = invites.filter(
    (invite) => invite.status === "pending" && !isExpired(invite),
  );
  const otherInvites = invites.filter(
    (invite) => !pendingInvites.includes(invite),
  );

  return (
    <div className="teamPanel">
      <dl className="settingsList">
        {members.map((member) => (
          <div key={member.membershipId}>
            <dt>{member.displayName || member.email || "Unnamed member"}</dt>
            <dd>
              {ROLE_LABELS[member.role] ?? member.role}
              {member.email ? ` · ${member.email}` : ""}
              {member.status !== "active" ? ` · ${member.status}` : ""}
            </dd>
          </div>
        ))}
      </dl>

      {pendingInvites.length > 0 ? (
        <div className="teamPanelInvites">
          <h3>Pending invites</h3>
          <dl className="settingsList">
            {pendingInvites.map((invite) => (
              <div key={invite.id}>
                <dt>{invite.email}</dt>
                <dd>
                  {ROLE_LABELS[invite.role] ?? invite.role} ·{" "}
                  {inviteStatusLabel(invite)}
                  {canManage ? (
                    <RevokeInviteButton inviteId={invite.id} />
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {otherInvites.length > 0 ? (
        <details className="teamPanelHistory">
          <summary>Past invites ({otherInvites.length})</summary>
          <dl className="settingsList">
            {otherInvites.map((invite) => (
              <div key={invite.id}>
                <dt>{invite.email}</dt>
                <dd>
                  {ROLE_LABELS[invite.role] ?? invite.role} ·{" "}
                  {inviteStatusLabel(invite)}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}

      {canManage ? (
        <div className="teamPanelInviteForm">
          <h3>Invite a teammate</h3>
          <InviteMemberForm />
        </div>
      ) : null}
    </div>
  );
}
