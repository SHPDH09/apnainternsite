import { sendEmailViaSesApi, canUseSesApi } from './sesSend.js';

type Transporter = {
  sendMail: (opts: Record<string, unknown>) => Promise<unknown>;
};

export async function deliverOutbound(
  mailOptions: Record<string, unknown>,
  transporter: Transporter,
  opts?: { fast?: boolean; bulk?: boolean; attempts?: number; sendWithRetry?: SendWithRetryFn }
): Promise<void> {
  const to = String(mailOptions.to || '').trim();
  const subject = String(mailOptions.subject || '').trim();
  const html = String(mailOptions.html || '');

  if (canUseSesApi()) {
    await sendEmailViaSesApi({ to, subject, html });
    return;
  }

  if (opts?.fast) {
    await transporter.sendMail(mailOptions);
    return;
  }

  if (opts?.sendWithRetry) {
    await opts.sendWithRetry(transporter, mailOptions, opts.attempts ?? 3, { bulk: opts.bulk });
    return;
  }

  await transporter.sendMail(mailOptions);
}

export type SendWithRetryFn = (
  transporter: Transporter,
  mailOptions: Record<string, unknown>,
  attempts?: number,
  retryOpts?: { bulk?: boolean }
) => Promise<unknown>;
