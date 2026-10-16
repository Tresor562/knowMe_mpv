import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

@Injectable()
export class TransactionalEmailService {
  constructor(private readonly config: ConfigService) {}
  private settings() {
    // Zero-dependency Resend integration: the existing NestJS email sender calls
    // the official REST endpoint directly. No API key is ever sent to the client.
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    const endpoint = this.config.get<string>('KNOWME_EMAIL_ENDPOINT')
      || (resendKey ? 'https://api.resend.com/emails' : undefined)
      || this.config.get<string>('ACCOUNT_RECOVERY_EMAIL_ENDPOINT');
    const key = this.config.get<string>('KNOWME_EMAIL_API_KEY')
      || resendKey
      || this.config.get<string>('ACCOUNT_RECOVERY_EMAIL_API_KEY');
    const from = this.config.get<string>('KNOWME_EMAIL_FROM')
      || this.config.get<string>('RESEND_FROM_EMAIL')
      || this.config.get<string>('ACCOUNT_RECOVERY_EMAIL_FROM');
    let url: URL;
    try {
      url = new URL(endpoint || '');
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
    } catch {
      throw new ServiceUnavailableException('Le service email KnowMe est indisponible.');
    }
    const senderEmail = from?.match(/<([^<>]+)>/)?.[1] || from;
    if (!key || !from || /[\r\n]/.test(from) || !senderEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(senderEmail)) {
      throw new ServiceUnavailableException('Le service email KnowMe est indisponible.');
    }
    const testSender = senderEmail.toLowerCase() === 'onboarding@resend.dev';
    const testRecipient = this.config.get<string>('RESEND_TEST_RECIPIENT')?.trim().toLowerCase();
    if (testSender && (!testRecipient || this.config.get<string>('KNOWME_EMAIL_TEST_MODE') !== 'true')) {
      throw new ServiceUnavailableException('Le domaine d’envoi doit être vérifié avant ouverture aux utilisateurs.');
    }
    return { endpoint: url.toString(), key, from, testSender, testRecipient };
  }
  assertReady() { this.settings(); }

  assertCanDeliverTo(to: string) {
    const { testSender, testRecipient } = this.settings();
    // Prevent even creating an account that cannot receive its signup OTP.
    if (testSender && to.trim().toLowerCase() !== testRecipient) {
      throw new ServiceUnavailableException('Les emails de test ne peuvent être envoyés qu’au destinataire autorisé.');
    }
  }

  async send(to: string, subject: string, body: string, code?: string) {
    this.assertCanDeliverTo(to);
    const { endpoint, key, from } = this.settings();
    const html = '<!doctype html><html lang="fr"><body style="margin:0;background:#f1f4f8;padding:24px 12px;font-family:Arial,sans-serif;color:#18212d">'
      + '<main style="max-width:520px;margin:auto;background:#fff;border-radius:22px;padding:30px">'
      + '<div style="font-size:24px;font-weight:800;color:#139c90">KnowMe</div>'
      + '<h1 style="font-size:22px;margin-top:28px">' + escapeHtml(subject) + '</h1>'
      + '<p style="line-height:1.6;font-size:15px">' + escapeHtml(body) + '</p>'
      + (code ? '<p style="letter-spacing:8px;font-size:35px;font-weight:800;text-align:center">' + escapeHtml(code) + '</p>' : '')
      + '<p style="font-size:13px;color:#677684">Ne partagez jamais votre code ou votre mot de passe. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>'
      + '</main></body></html>';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error('delivery failed');
    } catch {
      throw new ServiceUnavailableException('Envoi email indisponible. Réessayez plus tard.');
    }
  }
}
