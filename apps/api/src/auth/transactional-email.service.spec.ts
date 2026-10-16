import { ServiceUnavailableException } from '@nestjs/common';
import { TransactionalEmailService } from './transactional-email.service';
import * as nodemailer from 'nodemailer';

describe('TransactionalEmailService / Resend', () => {
  afterEach(() => jest.restoreAllMocks());

  function setup(variables: Record<string, string | undefined>) {
    const config = { get: jest.fn((key: string) => variables[key]) };
    return new TransactionalEmailService(config as never);
  }

  it('uses the Resend REST endpoint directly when RESEND_API_KEY is configured', async () => {
    const service = setup({
      RESEND_API_KEY: 're-test-secret',
      RESEND_FROM_EMAIL: 'KnowMe <security@example.com>'
    });
    const sent = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 202 }));
    await service.send('alice@example.com', 'Code de confirmation', 'Bonjour', '012345');
    expect(sent).toHaveBeenCalledTimes(1);
    const [endpoint, init] = sent.mock.calls[0];
    expect(endpoint).toBe('https://api.resend.com/emails');
    const request = JSON.parse(String(init?.body));
    expect(request.from).toBe('KnowMe <security@example.com>');
    expect(request.to).toEqual(['alice@example.com']);
    expect(request.html).toContain('012345');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer re-test-secret');
  });

  it('restricts onboarding@resend.dev to its explicitly configured test recipient', async () => {
    const service = setup({
      RESEND_API_KEY: 're-test-secret',
      RESEND_FROM_EMAIL: 'KnowMe <onboarding@resend.dev>',
      KNOWME_EMAIL_TEST_MODE: 'true',
      RESEND_TEST_RECIPIENT: 'owner@example.com'
    });
    const sent = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 202 }));
    await expect(service.send('stranger@example.com', 'Code', 'Text', '123456'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(sent).not.toHaveBeenCalled();
    await service.send('OWNER@example.com', 'Code', 'Text', '123456');
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it('never enables the testing sender without a test-mode flag and recipient', () => {
    const service = setup({ RESEND_API_KEY: 're-test', RESEND_FROM_EMAIL: 'onboarding@resend.dev' });
    expect(() => service.assertReady()).toThrow(ServiceUnavailableException);
  });

  it('refuses credentials embedded in a provider endpoint and invalid senders', () => {
    const service = setup({
      KNOWME_EMAIL_ENDPOINT: 'https://evil:password@api.resend.com/emails',
      RESEND_API_KEY: 're-test',
      RESEND_FROM_EMAIL: 'bad.sender@example.com'
    });
    expect(() => service.assertReady()).toThrow(ServiceUnavailableException);
  });

  it('escapes untrusted message text before embedding it in HTML', async () => {
    const service = setup({ RESEND_API_KEY: 're-test', RESEND_FROM_EMAIL: 'security@example.com' });
    const sent = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    await service.send('a@example.com', '<script>', '<script>alert(1)</script>');
    const payload = JSON.parse(String(sent.mock.calls[0][1]?.body));
    expect(payload.html).toContain('&lt;script&gt;');
    expect(payload.html).not.toContain('<script>');
  });
  it('sends security codes with the authenticated Gmail address over implicit TLS', async () => {
    const transport = { sendMail: jest.fn().mockResolvedValue({ accepted: ['alice@example.com'] }), close: jest.fn() };
    const create = jest.spyOn(nodemailer, 'createTransport').mockReturnValue(transport as never);
    const service = setup({
      KNOWME_EMAIL_PROVIDER: 'gmail',
      GMAIL_SMTP_USER: 'knowme.notifications@gmail.com',
      GMAIL_SMTP_APP_PASSWORD: 'abcdefghijklmnop',
      GMAIL_SMTP_FROM_NAME: 'KnowMe'
    });
    await service.send('alice@example.com', 'Code de récupération', 'Bonjour', '102938');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'knowme.notifications@gmail.com', pass: 'abcdefghijklmnop' },
      tls: expect.objectContaining({ servername: 'smtp.gmail.com', minVersion: 'TLSv1.2' })
    }));
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: { name: 'KnowMe', address: 'knowme.notifications@gmail.com' },
      to: 'alice@example.com',
      disableUrlAccess: true,
      disableFileAccess: true,
      html: expect.stringContaining('102938')
    }));
    expect(transport.close).toHaveBeenCalled();
  });

  it('does not claim Gmail is configured with the account password or missing app secret', () => {
    const service = setup({
      KNOWME_EMAIL_PROVIDER: 'gmail',
      GMAIL_SMTP_USER: 'security@gmail.com',
      GMAIL_SMTP_APP_PASSWORD: 'ordinarypasswordislong'
    });
    expect(() => service.assertReady()).toThrow(ServiceUnavailableException);
  });

  it('does not silently fallback from Gmail to Resend on SMTP delivery failure', async () => {
    const transport = { sendMail: jest.fn().mockRejectedValue(new Error('535 Auth Failure')), close: jest.fn() };
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue(transport as never);
    const http = jest.spyOn(global, 'fetch');
    const service = setup({
      KNOWME_EMAIL_PROVIDER: 'gmail',
      GMAIL_SMTP_USER: 'security@gmail.com',
      GMAIL_SMTP_APP_PASSWORD: 'abcdefghijklmnop',
      RESEND_API_KEY: 'resend-available'
    });
    await expect(service.send('alice@example.com', 'Code', 'Bonjour', '987654'))
      .rejects.toThrow('Envoi email indisponible');
    expect(http).not.toHaveBeenCalled();
    expect(transport.close).toHaveBeenCalledTimes(1);
  });

});
