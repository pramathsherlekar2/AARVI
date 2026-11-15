export interface EmailProviderStatus {
  configured: boolean;
  provider: 'resend' | 'none';
}

export function getEmailProviderStatus(): EmailProviderStatus {
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0) {
    return {configured: true, provider: 'resend'};
  }
  return {configured: false, provider: 'none'};
}

export async function dispatchCareEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{
  delivered: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() || 'Aarvi Care Alerts <onboarding@resend.dev>';

  if (!apiKey) {
    return {
      delivered: false,
      provider: 'none',
      error:
        'Email delivery provider is not configured (RESEND_API_KEY missing in server secrets). Notification remains recorded in the in-app log without claiming email delivery.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });

    const data = (await response.json()) as {id?: string; message?: string; name?: string};
    if (!response.ok) {
      return {
        delivered: false,
        provider: 'resend',
        error: data.message || `Email provider returned HTTP ${response.status}`,
      };
    }

    return {
      delivered: true,
      provider: 'resend',
      messageId: data.id,
    };
  } catch (err) {
    return {
      delivered: false,
      provider: 'resend',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
