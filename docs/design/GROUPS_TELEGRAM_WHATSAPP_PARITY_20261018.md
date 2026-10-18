# KnowMe Group Parity — Telegram + WhatsApp (baseline 18 October 2026)
Workstream: design
Coordination-Issue: #699
Functional owners: Messaging #693, Infrastructure #698, Social #694, Profiles #696, Reels/Stories #695.

> **Acceptance contract, not release declaration.** Each capability must have real API persistence,
> permission checks, UI wiring on Web + Android, accessibility, tests, deployment and device evidence.
> A hidden screen, visual toggle or pending PR does not count as delivered.

## Product / UI contract
- Profile: group image (or collage fallback), name, live member count from authoritative membership;
  short description, group avatar upload, role, topic/online status.
- Single compact action ribbon: Message, Search, Notifications, Share, More. 44/48dp touch
  area without oversized filled buttons. *More* contains destructive actions with confirmation.
- Scrolling native tabs: Media, Files, Links, Members, Info, Topics (Topics only when persisted).
  Empty/loading/error/offline/denied states, reliable back navigation, FR/EN, dark/light,
  low-end device, reduced motion/transparency. No invented data, badges or menus.
- Member rows: avatar 40–48, name, role/tag, last-seen status only when consented,
  optional custom member title, local admin menu where authorized.
- Admin tools are in coherent categories: Group Info / Members & Roles / Permissions /
  Invitations & Join Requests / Moderation / Topics / Recent Actions.
- Desktop: profile/sidebar + member/context detail. Mobile: single-screen native push/sheet.
- No direct copy of Telegram or WhatsApp icons/trade dress; original KnowMe artwork and labels.

## Feature inventory and verified baseline
Symbols: **CORE** = code in main, not necessarily deployed; **PR** = unmerged branch;
**NEW** = must be implemented, no functional claim.

### Identity / group basics
| Feature | State | Acceptance |
|---|---|---|
| Group creation and conversation list | CORE | Auth-only creation, group title, member selection |
| Name and description | CORE | PATCH authenticated; only server-authorized actor |
| Group profile/avatar photo/video | NEW | Secure upload, crop/preview, audit/rollback, storage and permissions |
| Group public/private visibility, discoverable link | NEW | Access policy checked on every API read |
| Member count, roster, roles | CORE | Actual membership, not message read-state length |
| Add accepted friends | CORE | Existing server authorization, 100-member current cap |
| Promote/demote ADMIN (owner only) | CORE | Owner cannot be demoted, action logged |
| Remove member / self leave | CORE | Role checked; sockets revoked on removal |
| Transfer ownership / owner leave | NEW | Atomic handover, confirmation and forced reauthorization |
| Editable member titles/tags | NEW | Scoped member display + validation, moderation controls |
| Group member permissions | PR #754 | Server-enforced persisted choices, with role-safe defaults |
| Custom roles / moderator + permissions per role | NEW | Permission matrix, precedence and audit |
| Individual restrictions / temporary bans / appeals | NEW | Expiry, immutable log, reinstatement, server enforcement |

### Moderation / security
| Feature | State | Acceptance |
|---|---|---|
| Per-content send permissions: text/media/stickers/GIF | PR #754 | Backend rejects unauthorized sends on every transport |
| Allow polls / links / invitations / pin / edit info / topics | NEW | Granular rights, user-visible effective permission |
| Slow mode / flood control / automatic rule enforcement | NEW | Server atomic rate limit per member, time window, safe owner override |
| Anti-spam and banned-word rules | NEW | Privacy-aware scanning, appeals, no arbitrary account disclosure |
| Ban/unban/mute member & temporary exceptions | NEW | Time-bound flags and admin action audit |
| Report queue, review, decision/history | NEW | RBAC, receipts, no leak of reporter identity |
| New member join approval / reject | NEW | Pending-only access, idempotent accept/deny |
| Audit log and admin history | NEW | Event/time/actor/undo where safe |
| Public/private history for new members | NEW | Server-scoped message visibility, not only visual toggle |
| Expiring messages/retention, disable forwarding | NEW | Server-side semantics, per-client protections documented |
| End-to-end encryption claims | NOT VERIFIED | Independent cryptographic design/security review, key rotation and migration |
| Security anti-raid/bot rules | NEW | Rate-limits, threat review, human override, transparent failure |

### Invitations / discovery
| Feature | State | Acceptance |
|---|---|---|
| Existing participant-only group deep link | CORE | Link does not grant access automatically |
| Admin invitation link with expiry/usage limit | NEW | Random unguessable token stored hashed, revoke, rate-limit |
| Invite QR, private and public aliases | NEW | Revocable, safe join flow; public content visibility separate |
| Invite analytics and join request queue | NEW | Counts with privacy, no user enumeration |
| Bulk and delegated invitations | NEW | Explicit consent; spam prevention |

### Conversation features
| Feature | State | Acceptance |
|---|---|---|
| Text messages + image/video/audio/docs/stickers/GIF | CORE/PARTIAL | Verify actual transport and rendering Web/Android, sizes |
| Reply, edit, forward, delete, translate, read states | CORE/PARTIAL | Each mode permission-checked and device-tested |
| Message reactions, custom emojis, polls and votes | NEW/PARTIAL | Persisted by user, moderation and privacy |
| Pinned messages, indexed multi-pin banner | NEW/PARTIAL | Permission-checked with deep links |
| Group @mentions, `@all` respecting admin threshold | NEW | Anti-spam, mute override user choice, notifications |
| Telegram-style topics/threads, topic search and moderation | NEW | Child history, permissions, unread, pin/close/reopen |
| Search messages, full-text links, shared media/files | CORE/PARTIAL / PR THIS | Auth-only progressive history search in group info (text/author/file, accent-insensitive), pagination; server-side full-text index is still NEW |
| Shared Media / Files / Links in group information | PR THIS | Authenticated read-only paginated history, deep links and per-user download grants for documents; no multi-GB streaming claims |
| Large file transfer with resume/offline/downloads | NEW/PARTIAL | Upload validation, resumable chunks, storage quotas |
| Drafts, scheduling, reminders, disappearing messages | NEW/PARTIAL | Server-side scheduling, clock drift tests |
| Group voice notes, voice-to-text, voice effects | NEW/PARTIAL | Permission, playback continuity, privacy and quality |
| Bots and mini-apps in group | CORE/PARTIAL | Consent, scoped access, approval, rate-limit, reliable buttons |
| Welcome/goodbye auto text/buttons/media | NEW | Server events & editable per-group template, anti-loop |
| Message history portability, export and reporting | NEW | Privacy, access authorization, safe storage and consent |

### WhatsApp Communities + Telegram Communities
| Feature | State | Acceptance |
|---|---|---|
| Parent communities with multiple groups/channels/bots | NEW | RBAC across parent/child, migration, ownership |
| Announcement-only group with constrained replies | NEW | Admin sends, members react/reply per policy |
| Cross-group announcements & aggregated notifications | NEW | Explicit targeting, no accidental mass spam |
| Group events/calendar/reminders/RSVP | NEW | Timezone, going/maybe/no, edit cancellation, reminders |
| Polls incl multi-choice, anonymous choices, votes | NEW | Anti-fraud, permissions, result privacy |
| Create side chats from existing groups | NEW | Membership consent, no silent sharing |

### Calls / media / social
| Feature | State | Acceptance |
|---|---|---|
| Voice/video group calls, mute/unmute, speaker routing | NEW/PARTIAL | Auth, secure media transport, reconnect, quality |
| Screen sharing, raise hand, reactions & speaker controls | NEW | Device privacy approval, moderator controls |
| Voice chat live/recording/transcription | NEW | Explicit recording consent & access policy |
| Group stories/status, pinned appearance/custom wallpaper | NEW | Asset policies and stories feed routing |
| Group boosts/gifts/member incentives | NEW | Product economics; no arbitrary paid gating of safety |

### Notes for July–August 2026 updates
- Telegram groups gained communities, expiring messages, AI group guardians, welcome messages,
  member titles and improved admin workflows (verify current platform release details before each milestone).
- WhatsApp group updates include member tags, events/reminders, and @all with admin restrictions
  in larger groups. KnowMe must preserve opt-out and avoid flooding muted users.

## Delivery order to avoid broken switches
1. **Reliable existing core**: merge Messaging #754 after Prisma/CI; confirm group data and role guards;
   fix count bug in Web chat header; cross-client member changes, leave and media tabs.
2. **Permissions & join safety**: individual bans/restrictions, server logs, invites,
   approvals, owner transfer, moderation. Backend must precede UI toggles.
3. **Topics & interaction**: pin/multi-pin, polls, mentions and @all, message history, group search.
4. **Communities & calls**: parent groups/announcements, events, voice/video/screensharing, bots.
5. **Delight & extras**: stories, boosts, member tags, appearance packs, backups, retention.
Every row needs tests for owner/admin/member/removed member, unauthorized 401/403/404, concurrency,
race/retry, push/Realtime disconnect, FR/EN, Android/Web parity, tablet/desktop, 320–400px phones,
light/dark, motion reduction, screen reader and tested deployment.

## Current PR boundaries
- Design group profile + shared content: `chat/design/group-info-shared-content` (no API mutations);
  group profile file `apps/web/app/messages/[id]/info/page.tsx`.
- Messaging group server permissions and manage page: PR #754; do not edit its Prisma, API or UI files.
- Other Messaging PRs touch voice player, sticker keyboard and messages; no cross-PR copy/reset.
- Design #743 independently styles shared notification/messaging surfaces; CSS here scoped to group info.
- API group size currently capped at 100 by existing service; **do not promise** Telegram-size
  groups until pagination, architecture and server stress testing support them.

## Product reference anchors
- https://telegram.org/faq
- https://telegram.org/blog/topics-in-groups-collectible-usernames
- https://telegram.org/blog/crafting-android-design-and-more
- https://telegram.org/blog?setln=fr
- https://faq.whatsapp.com/495856382464992
- https://faq.whatsapp.com/526742385997912
- https://about.fb.com/news/2026/08/were-upgrading-your-whatsapp-group-chats/
