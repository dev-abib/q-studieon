import { baseTemplate } from '../base.template';

interface AdminResetPasswordProps {
  name: string;
  resetLink: string;
}

export const adminResetPasswordTemplate = ({
  name,
  resetLink,
}: AdminResetPasswordProps): string => {
  const content = `
    <p style="margin:0 0 6px;font-size:15px;color:#374151;">
      Hi <strong style="color:#111827;">${name}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      We received a request to reset your admin account password. Click the button below to set a new password.
    </p>

    <div style="text-align:center;margin:30px 0;">
      <a href="${resetLink}" target="_blank" style="
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
        Reset Password
      </a>
    </div>

    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      This password reset link expires in 1 hour. If you did not request a password reset, please ignore this email.
    </p>
  `;

  return baseTemplate({
    title: `Reset Your Dwellr Admin Password`,
    content,
  });
};
