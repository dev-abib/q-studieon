import { baseTemplate } from '../base.template';
import { VerificationStatusProps } from '../template.type';

export const accountVerificationConfirmationTemplate = ({
  name,
}: Pick<VerificationStatusProps, 'name'>): string => {
  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="
        display:inline-block;
        width:72px;
        height:72px;
        background:linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%);
        border-radius:50%;
        text-align:center;
        line-height:72px;
        font-size:36px;
        margin-bottom:20px;
        box-shadow:0 4px 24px rgba(16,185,129,0.13);
      ">✓</div>
      <h2 style="
        margin:0 0 8px;
        font-size:22px;
        font-weight:700;
        color:#111827;
        letter-spacing:-0.3px;
      ">Account Verified!</h2>
      <p style="margin:0;font-size:14px;color:#6b7280;">
        You're all set, <strong style="color:#111827;">${name}</strong>
      </p>
    </div>

    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;text-align:center;">
      Your account has been successfully verified. You can now access all features and enjoy the full experience.
    </p>

    <!-- Divider -->
    <div style="border-top:1.5px dashed #d1fae5;margin:0 0 24px;"></div>

    <!-- What's next -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="
          background:#f8faf8;
          border:1.5px solid #d1fae5;
          border-radius:14px;
          padding:20px;
        ">
          <p style="
            margin:0 0 14px;
            font-size:11px;
            font-weight:600;
            color:#16a34a;
            letter-spacing:1.2px;
            text-transform:uppercase;
          ">What's next?</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              {
                icon: '🔐',
                text: 'Log in to your account using your credentials',
              },
              {
                icon: '👤',
                text: 'Complete your profile to get the best experience',
              },
              { icon: '🚀', text: 'Explore all features available to you' },
            ]
              .map(
                ({ icon, text }) => `
              <tr>
                <td style="padding:6px 0;vertical-align:top;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="
                        width:32px;
                        height:32px;
                        background:#ffffff;
                        border:1px solid #d1fae5;
                        border-radius:8px;
                        text-align:center;
                        line-height:32px;
                        font-size:15px;
                        vertical-align:middle;
                        padding-right:12px;
                      ">${icon}</td>
                      <td style="font-size:13px;color:#374151;line-height:1.55;vertical-align:middle;">
                        ${text}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`,
              )
              .join('')}
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="text-align:center;">
          <a href="${process.env.APP_URL as string}" style="
            display:inline-block;
            background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);
            color:#ffffff;
            text-decoration:none;
            font-size:14px;
            font-weight:600;
            padding:13px 36px;
            border-radius:10px;
            letter-spacing:0.2px;
            box-shadow:0 4px 14px rgba(22,163,74,0.25);
          ">Go to Dashboard →</a>
        </td>
      </tr>
    </table>

    <!-- Security Notice -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:10px;
          padding:12px 14px;
        ">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:10px;">
                <div style="
                  width:18px;height:18px;
                  background:#f97316;
                  border-radius:50%;
                  text-align:center;
                  line-height:18px;
                  font-size:10px;
                  font-weight:700;
                  color:#ffffff;
                ">!</div>
              </td>
              <td style="font-size:12.5px;color:#92400e;line-height:1.55;">
                If you did not create this account, please contact our support team immediately.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return baseTemplate({
    title: `Account Verified — ${process.env.MAIL_FROM_NAME as string}`,
    content,
  });
};
