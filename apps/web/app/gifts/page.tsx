'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccountBadges } from '../../components/AccountBadges';
import { apiFetch } from '../../lib/api';
import {
  createSocialGiftIdempotencyKey,
  getSocialGiftCatalog,
  getSocialGiftInbox,
  getSocialGiftPolicy,
  getSocialGiftSent,
  markSocialGiftViewed,
  sendSocialGift,
  SocialGiftDefinition,
  SocialGiftInboxItem,
  SocialGiftPolicy,
  SocialGiftSentItem,
  SocialGiftUser,
  socialGiftRarityLabel
} from '../../lib/social-gifts';
import { useSession } from '../../lib/use-session';

type Friend = {
  friendshipId: string;
  user: SocialGiftUser;
};

type Wallet = {
  balance: number;
};

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function UserSummary({ user }: { user: SocialGiftUser | null }) {
  if (!user) return <span style={{ color: 'var(--muted)' }}>Compte indisponible</span>;
  return (
    <div>
      <strong>{user.displayName}</strong>
      <AccountBadges
        compact
        staff={user.staff as never}
        verification={user.verification as never}
        premium={user.premium as never}
      />
      <div style={{ color: 'var(--muted)', fontSize: 13 }}>@{user.username}</div>
    </div>
  );
}

function GiftVisual({ gift, large = false }: { gift: SocialGiftDefinition; large?: boolean }) {
  return (
    <div
      aria-label={`${gift.name}, ${socialGiftRarityLabel(gift.rarity)}`}
      style={{
        width: large ? 84 : 58,
        height: large ? 84 : 58,
        borderRadius: large ? 28 : 20,
        display: 'grid',
        placeItems: 'center',
        fontSize: large ? 42 : 30,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)'
      }}
    >
      {gift.emoji}
    </div>
  );
}

export default function SocialGiftsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [catalog, setCatalog] = useState<SocialGiftDefinition[]>([]);
  const [policy, setPolicy] = useState<SocialGiftPolicy | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inbox, setInbox] = useState<SocialGiftInboxItem[]>([]);
  const [sent, setSent] = useState<SocialGiftSentItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [recipientId, setRecipientId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [busyGiftKey, setBusyGiftKey] = useState<string | null>(null);
  const [busyInboxId, setBusyInboxId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [giftCatalog, giftPolicy, currentFriends, giftInbox, giftSent, wallet] =
        await Promise.all([
          getSocialGiftCatalog(),
          getSocialGiftPolicy(),
          apiFetch<Friend[]>('/social/friends'),
          getSocialGiftInbox(undefined, 30),
          getSocialGiftSent(undefined, 30),
          apiFetch<Wallet>('/wallet/me')
        ]);
      setCatalog(giftCatalog);
      setPolicy(giftPolicy);
      setFriends(currentFriends);
      setInbox(giftInbox.items);
      setSent(giftSent.items);
      setBalance(wallet.balance);
      setRecipientId((current) =>
        current && currentFriends.some((friend) => friend.user.id === current)
          ? current
          : currentFriends[0]?.user.id ?? ''
      );
    } catch (cause) {
      setStatusMessage(errorMessage(cause, 'Les cadeaux sociaux sont indisponibles.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.user.id === recipientId)?.user ?? null,
    [friends, recipientId]
  );

  async function send(gift: SocialGiftDefinition) {
    if (!recipientId || busyGiftKey) return;
    setBusyGiftKey(gift.key);
    setStatusMessage('');
    try {
      const result = await sendSocialGift(
        {
          recipientId,
          giftKey: gift.key,
          message: messageText.trim() || undefined
        },
        createSocialGiftIdempotencyKey(recipientId, gift.key)
      );
      setBalance(result.senderBalance);
      setMessageText('');
      setStatusMessage(
        result.replayed
          ? 'Ce cadeau avait déjà été envoyé. Aucun second débit n’a été effectué.'
          : `${gift.emoji} ${gift.name} envoyé à ${selectedFriend?.displayName ?? 'ton ami'}.`
      );
      const history = await getSocialGiftSent(undefined, 30);
      setSent(history.items);
    } catch (cause) {
      setStatusMessage(errorMessage(cause, 'Envoi du cadeau impossible.'));
    } finally {
      setBusyGiftKey(null);
    }
  }

  async function markViewed(item: SocialGiftInboxItem) {
    if (item.viewedAt || busyInboxId) return;
    setBusyInboxId(item.id);
    try {
      const result = await markSocialGiftViewed(item.id);
      setInbox((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, viewedAt: result.viewedAt } : entry
        )
      );
    } catch (cause) {
      setStatusMessage(errorMessage(cause, 'Mise à jour impossible.'));
    } finally {
      setBusyInboxId(null);
    }
  }

  if (sessionLoading || !user) {
    return <main className="shell"><p>Chargement des cadeaux…</p></main>;
  }

  return (
    <main className="shell" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 18,
          alignItems: 'flex-start',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <small style={{ color: 'var(--mint)' }}>KMD-034 · CADEAUX SOCIAUX</small>
          <h1 style={{ marginBottom: 8 }}>Offrir un geste visuel à un ami</h1>
          <p style={{ color: 'var(--muted)', maxWidth: 820 }}>
            Chaque cadeau débite le registre KnowCoins du compte expéditeur. Le destinataire ne reçoit
            aucune monnaie, aucun avantage compétitif et aucune permission : seulement un souvenir visuel.
          </p>
        </div>
        <div className="card" style={{ padding: 16, minWidth: 190 }}>
          <small style={{ color: 'var(--muted)' }}>Solde disponible</small>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{balance} KnowCoins</div>
        </div>
      </header>

      {statusMessage ? (
        <p role="status" className="card" style={{ padding: 14, color: 'var(--mint)' }}>
          {statusMessage}
        </p>
      ) : null}

      {loading ? (
        <p>Chargement du catalogue et de tes relations…</p>
      ) : (
        <>
          <section className="card" style={{ padding: 22, marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Destinataire et message</h2>
            {friends.length ? (
              <div className="grid" style={{ gridTemplateColumns: 'minmax(220px,1fr) 2fr' }}>
                <label>
                  <span>Ami destinataire</span>
                  <select
                    className="input"
                    value={recipientId}
                    onChange={(event) => setRecipientId(event.target.value)}
                  >
                    {friends.map((friend) => (
                      <option key={friend.friendshipId} value={friend.user.id}>
                        {friend.user.displayName} (@{friend.user.username})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Petit message, facultatif</span>
                  <input
                    className="input"
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="160 caractères maximum"
                    maxLength={160}
                  />
                </label>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--muted)' }}>
                  Les cadeaux ne peuvent être envoyés qu’à une amitié acceptée.
                </p>
                <Link className="btn" href="/friends">Trouver des amis</Link>
              </div>
            )}
            {selectedFriend ? (
              <div style={{ marginTop: 16 }}>
                <small style={{ color: 'var(--muted)' }}>Sélection actuelle</small>
                <UserSummary user={selectedFriend} />
              </div>
            ) : null}
          </section>

          <section>
            <h2>Catalogue original KnowMe</h2>
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))' }}
            >
              {catalog.map((gift) => {
                const affordable = balance >= gift.priceKnowCoins;
                const disabled = !recipientId || !affordable || busyGiftKey !== null;
                return (
                  <article
                    key={gift.key}
                    className="card"
                    style={{ padding: 20, display: 'grid', gap: 14 }}
                  >
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <GiftVisual gift={gift} large />
                      <div>
                        <small style={{ color: 'var(--muted)' }}>
                          {socialGiftRarityLabel(gift.rarity)}
                        </small>
                        <h3 style={{ margin: '4px 0' }}>{gift.name}</h3>
                        <strong style={{ color: 'var(--mint)' }}>
                          {gift.priceKnowCoins} KnowCoins
                        </strong>
                      </div>
                    </div>
                    <p style={{ color: 'var(--muted)', margin: 0 }}>{gift.description}</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={pill}>Visuel uniquement</span>
                      <span style={pill}>Non revendable</span>
                      <span style={pill}>Aucun gain reçu</span>
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={disabled}
                      onClick={() => void send(gift)}
                    >
                      {busyGiftKey === gift.key
                        ? 'Envoi atomique…'
                        : !recipientId
                          ? 'Choisir un ami'
                          : !affordable
                            ? 'Solde insuffisant'
                            : `Offrir ${gift.emoji}`}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section style={{ marginTop: 34 }}>
            <h2>Cadeaux reçus</h2>
            {inbox.length ? (
              <div className="grid">
                {inbox.map((item) => (
                  <article
                    key={item.id}
                    className="card"
                    style={{
                      padding: 18,
                      display: 'grid',
                      gridTemplateColumns: '64px 1fr auto',
                      gap: 16,
                      alignItems: 'center',
                      borderColor: item.viewedAt ? undefined : 'var(--mint)'
                    }}
                  >
                    <GiftVisual gift={item.gift} />
                    <div>
                      <strong>{item.gift.name}</strong>
                      <UserSummary user={item.sender} />
                      {item.message ? <p style={{ marginBottom: 4 }}>“{item.message}”</p> : null}
                      <small style={{ color: 'var(--muted)' }}>
                        {new Date(item.sentAt).toLocaleString('fr-FR')}
                      </small>
                    </div>
                    <button
                      className="btn"
                      disabled={Boolean(item.viewedAt) || busyInboxId === item.id}
                      onClick={() => void markViewed(item)}
                    >
                      {item.viewedAt ? 'Vu' : busyInboxId === item.id ? 'Ouverture…' : 'Marquer vu'}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)' }}>Aucun cadeau reçu pour le moment.</p>
            )}
          </section>

          <section style={{ marginTop: 34 }}>
            <h2>Cadeaux envoyés</h2>
            {sent.length ? (
              <div className="grid">
                {sent.map((item) => (
                  <article
                    key={item.id}
                    className="card"
                    style={{
                      padding: 18,
                      display: 'grid',
                      gridTemplateColumns: '64px 1fr auto',
                      gap: 16,
                      alignItems: 'center'
                    }}
                  >
                    <GiftVisual gift={item.gift} />
                    <div>
                      <strong>{item.gift.name}</strong>
                      <UserSummary user={item.recipient} />
                      {item.message ? <p style={{ marginBottom: 4 }}>“{item.message}”</p> : null}
                      <small style={{ color: 'var(--muted)' }}>
                        {new Date(item.sentAt).toLocaleString('fr-FR')}
                      </small>
                    </div>
                    <strong>{item.priceKnowCoins} KC</strong>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)' }}>Aucun cadeau envoyé.</p>
            )}
          </section>

          {policy ? (
            <section className="card" style={{ padding: 20, marginTop: 34 }}>
              <h2 style={{ marginTop: 0 }}>Règles anti-abus</h2>
              <p style={{ color: 'var(--muted)' }}>
                Limite : {policy.dailyGiftCountLimit} cadeaux et{' '}
                {policy.dailySpendLimitKnowCoins} KnowCoins par jour. Les prix viennent exclusivement
                du serveur et chaque envoi exige une clé d’idempotence.
              </p>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

const pill = {
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '6px 9px',
  color: 'var(--muted)',
  fontSize: 11
};
