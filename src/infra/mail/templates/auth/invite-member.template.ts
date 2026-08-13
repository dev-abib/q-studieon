import { baseTemplate } from '../base.template';

interface InviteMemberEmailProps {
  email: string;
  role: string;
  inviteLink: string;
  invitedByName: string;
}

export const inviteMemberTemplate = ({
  email,
  role,
  inviteLink,
  invitedByName,
}: InviteMemberEmailProps): string => {
  const roleDisplayNames: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Administrator',
    customer_support: 'Customer Support Lead',
    content_manager: 'Content Manager',
    finance: 'Finance Manager',
  };

  const roleTitle = roleDisplayNames[role] || role;

  const content = `
    <p style="margin:0 0 6px;font-size:15px;color:#374151;">
      Hello! You've been invited to join the team.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      <strong style="color:#111827;">${invitedByName}</strong> has invited you (<strong style="color:#111827;">${email}</strong>) to join the Dwellr Admin Portal as a <strong style="color:#f59e0b;">${roleTitle}</strong>.
    </p>

    <div style="text-align:center;margin:30px 0;">
      <a href="${inviteLink}" target="_blank" style="
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: #ffffff;
        padding: 14px 28px;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
        border-radius: 12px;
        display: inline-block;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
      ">
        Accept Invitation & Create Password
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      This link is valid for 7 days. If you were not expecting this invitation, you can safely ignore this email.
    </p>
  `;

  return baseTemplate({
    title: `You're invited to join Dwellr Admin Portal`,
    content,
  });
};
