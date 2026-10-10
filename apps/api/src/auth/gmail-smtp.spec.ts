import { buildGmailRecoveryMime } from './gmail-smtp';

const input = {
  username: 'owner@gmail.com',
  appPassword: 'not-a-real-secret',
  from: 'KnowMe <owner@gmail.com>',
  to: 'recipient@example.com',
  subject: 'Réinitialise ton mot de passe KnowMe',
  html: '<p>Confidentialité: lien de test</p>'
};

describe('Gmail account recovery SMTP MIME', () => {
  it('keeps the sender address while displaying the KnowMe brand', () => {
    const mime = buildGmailRecoveryMime(input);
    expect(mime).toMatch(/^From: =\?UTF-8\?B\?.+\?= <owner@gmail\.com>/);
    expect(mime).toContain('To: <recipient@example.com>');
    expect(mime).toContain('Content-Transfer-Encoding: base64');
    expect(mime).toContain('Auto-Submitted: auto-generated');
    const part = mime.split('\r\n\r\n')[1];
    expect(Buffer.from(part.replace(/\s/g, ''), 'base64').toString('utf8')).toBe(input.html);
  });

  it('refuses sender mismatch', () => {
    expect(() => buildGmailRecoveryMime({ ...input, from: 'KnowMe <other@gmail.com>' })).toThrow();
  });

  it('refuses CRLF header injection', () => {
    expect(() => buildGmailRecoveryMime({ ...input, subject: 'Hello\r\nBcc: secret@other.test' })).toThrow();
    expect(() => buildGmailRecoveryMime({ ...input, to: 'user@site.test\r\nBcc: spam@site.test' })).toThrow();
  });

  it('refuses oversized message bodies and invalid recipients', () => {
    expect(() => buildGmailRecoveryMime({ ...input, html: 'x'.repeat(25001) })).toThrow();
    expect(() => buildGmailRecoveryMime({ ...input, to: 'recipient' })).toThrow();
  });
});
