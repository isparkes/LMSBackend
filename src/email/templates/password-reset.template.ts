export function passwordResetTemplate(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Request</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
    <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>

    <p>You have requested to reset your password.</p>

    <p>Click the button below to reset your password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}"
         style="background-color: #007bff;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                display: inline-block;
                font-weight: bold;">
        Reset Password
      </a>
    </div>

    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 3px;">
      ${resetUrl}
    </p>

    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
      <strong>This link will expire in 1 hour.</strong>
    </p>

    <p style="color: #666; font-size: 14px;">
      If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
    </p>

    <p style="color: #999; font-size: 12px; margin-top: 30px;">
      This is an automated email. Please do not reply to this message.
    </p>
  </div>
</body>
</html>
  `;
}
