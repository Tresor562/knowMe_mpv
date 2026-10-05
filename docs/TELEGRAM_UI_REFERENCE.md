# Telegram UI / UX reference for KnowMe

Last reviewed: 2026-10-05.

## Purpose

This document is the durable design reference for KnowMe UI work inspired by Telegram.
It is not a pixel-copy specification. Telegram is used as an implementation-quality reference for:
- clarity;
- tactile native behavior;
- theming depth;
- chat readability;
- motion;
- performance-aware effects;
- visual hierarchy;
- media handling;
- adaptive light/dark behavior.

KnowMe must keep its own identity, brand colors, information architecture, social/AI features and interaction model.

## Authoritative sources to inspect

Official Telegram / Telegram Android:
- https://github.com/DrKLO/Telegram
- https://core.telegram.org/themes
- https://core.telegram.org/api/themes
- https://themes.telegram.org/
- https://telegram.org/blog/android-themes
- https://telegram.org/blog/chat-themes-interactive-emoji-read-receipts
- https://telegram.org/blog/profile-music-gift-themes

Important Android source files:
- TMessagesProj/src/main/java/org/telegram/ui/ActionBar/Theme.java
- TMessagesProj/src/main/java/org/telegram/ui/ThemeActivity.java
- TMessagesProj/src/main/java/org/telegram/ui/ActionBar/BottomSheet.java
- TMessagesProj/src/main/java/org/telegram/ui/ActionBar/AlertDialog.java
- TMessagesProj/src/main/java/org/telegram/ui/ActionBar/ActionBar.java
- TMessagesProj/src/main/java/org/telegram/ui/Components/AvatarDrawable.java
- TMessagesProj/src/main/java/org/telegram/ui/Components/CubicBezierInterpolator.java
- TMessagesProj/src/main/java/org/telegram/ui/Cells/ChatMessageCell.java
- TMessagesProj/src/main/java/org/telegram/messenger/ChatThemeController.java
- TMessagesProj/src/main/java/org/telegram/messenger/SharedConfig.java
- TMessagesProj/src/main/res/values/styles.xml

When memory, screenshots or older notes disagree with live Telegram source, live source wins.

## 1. Core visual language

Telegram's UI should be treated as:
- native-feeling rather than decorative;
- soft, rounded and highly readable;
- low-noise;
- fast and tactile;
- sparse in borders;
- careful with elevation;
- component-driven rather than screen-by-screen styling.

KnowMe translation:
- large but controlled rounding;
- floating controls where appropriate;
- soft surfaces;
- consistent spacing;
- one coherent icon family;
- strong text hierarchy;
- motion that helps continuity rather than drawing attention to itself.

## 2. Theme architecture

Telegram themes are not a simple global palette swap.

The Android client resolves many individual theme keys for:
- window backgrounds;
- secondary backgrounds;
- action bars;
- dialogs;
- sheets;
- list rows;
- primary and secondary text;
- icons;
- selectors / pressed states;
- links;
- chat bubbles;
- service messages;
- avatars;
- stories;
- media surfaces;
- controls.

Telegram cloud themes also have explicit base-theme concepts:
- Classic;
- Day;
- Night;
- Tinted;
- Arctic.

Telegram's theme API can carry:
- accent color;
- outbox accent;
- multiple message colors;
- animated message colors;
- wallpaper;
- wallpaper blur;
- wallpaper motion;
- wallpaper intensity;
- wallpaper rotation;
- up to multiple background colors.

KnowMe rule:
themes must be semantic tokens, not hard-coded screen colors.

Minimum KnowMe token families:
- background.primary
- background.secondary
- surface.base
- surface.raised
- surface.glass
- surface.overlay
- text.primary
- text.secondary
- text.tertiary
- border.subtle
- accent.primary
- accent.secondary
- destructive
- success
- icon.primary
- icon.secondary
- chat.incoming
- chat.outgoing
- chat.service
- selector.pressed
- avatar.palette.*
- story.ring.*
- glass.tint.*

Every screen should consume semantic tokens.

## 3. Light and dark are parallel systems

Telegram does not treat dark mode as a raw color inversion.

KnowMe must preserve:
- geometry;
- component sizes;
- spacing;
- radii;
- interaction patterns;
- icon construction;
- navigation position.

Only these should adapt:
- surfaces;
- text contrast;
- border visibility;
- glass tint;
- shadow intensity;
- accent brightness;
- wallpaper rendering;
- media chrome.

## 4. Glass and blur

Telegram uses real blur in selected surfaces and keeps performance/device support in mind.

Telegram Android has explicit blur-related behavior/settings, including:
- useNewBlur;
- photoViewerBlur;
- blur-capable dialogs/surfaces;
- performance-sensitive decisions.

KnowMe should therefore use three semantic levels:

Glass Soft
- compact icon controls;
- small floating action chips;
- subtle header controls.

Glass Medium
- floating navigation;
- chat composer shell;
- top bars;
- profile action clusters.

Glass Strong
- bottom sheets;
- modal controls;
- media overlays;
- call controls;
- mini-player;
- context menus.

Glass composition:
- actual backdrop blur when supported;
- translucent tint over the blur;
- subtle border;
- soft elevation;
- rounded clipping;
- readable content above it.

Do not fake glass using opacity alone.

Fallback:
- when transparency is reduced, unsupported or too expensive, use an opaque semantic surface with identical geometry.

Do not put blur on every card.

## 5. Shapes and radii

Telegram favors rounded controls and bubbles over sharp rectangles.

KnowMe baseline:
- cards: approximately 24–28 px;
- buttons: approximately 20–24 px;
- inputs: approximately 26–30 px;
- capsules: full radius / pill;
- avatars: circular;
- central floating create action: circular;
- floating nav shell: approximately 28–32 px.

Telegram Android exposes configurable chat bubble radius. Current Android SharedConfig defaults bubbleRadius to 17.

KnowMe may use its own radius scale, but it must be systematic.

## 6. Icon system

Telegram icons are generally:
- simple;
- visually balanced;
- legible at small sizes;
- mostly monochrome in utility contexts;
- consistent within a surface;
- colored by semantic state.

KnowMe rules:
- do not mix unrelated Material / emoji / Font Awesome / random SVG styles;
- one canonical icon system;
- default 22–24 px;
- major action 28–32 px;
- approximately 1.8–2.1 px visual stroke for outline icons;
- active state may use accent, fill, soft background or stronger weight;
- inactive state uses muted semantic color;
- icon containers are circular/rounded only when they are actual controls, not automatically.

## 7. Typography

Telegram prioritizes readability over visual novelty.

Telegram Android current SharedConfig exposes a default fontSize of 16, with larger defaults on some tablet contexts.

KnowMe hierarchy should remain compact:
- Display: 28–34
- Title: 20–24
- Body: 15–17
- Secondary: 13–15
- Caption: 11–13

Use weight, size and contrast before decorative text effects.

Contact/user name > metadata/status.

Do not use futuristic display fonts for core messaging UI.

## 8. Avatars and identity color

Telegram AvatarDrawable uses a defined color categorization:
- red;
- orange;
- green;
- cyan;
- blue;
- violet;
- pink.

It also supports:
- gradients;
- different avatar contexts;
- story avatars;
- saved/replies/system avatars;
- profile-specific color behavior.

KnowMe should implement a deterministic avatar palette:
- stable per identity;
- readable initials fallback;
- optional controlled gradients;
- story ring treatment;
- verified/premium/staff badges outside the avatar rather than cluttering the portrait.

## 9. Chat backgrounds and wallpapers

Telegram chat themes can include:
- custom wallpaper;
- gradients;
- animated message colors;
- motion;
- blur;
- theme-specific day/night versions;
- unique pattern/background combinations.

KnowMe should support:
- original KnowMe outline wallpaper motifs;
- very low opacity for default patterns;
- theme-linked wallpapers;
- user-selected wallpapers;
- light/dark counterpart;
- optional blur;
- optional motion where performance allows.

Default motifs may reference:
- messages;
- audio;
- camera;
- stories;
- AI;
- communities;
- security;
- translation;
but should be custom KnowMe artwork rather than Telegram artwork.

## 10. Chat bubbles

Telegram makes bubbles part of the theme, not isolated hard-coded colors.

KnowMe:
- incoming and outgoing semantic bubble tokens;
- message text must always pass contrast;
- user accent may influence outgoing bubble;
- bubble geometry stays stable across themes;
- selected/replied/edited/reaction states are separate tokens;
- media captions and text messages share a coherent radius language.

## 11. Per-chat themes

Telegram supports themes at chat level and syncs them across devices.

Its theme API and ChatThemeController support conversation-specific theme state.

KnowMe should separate:
- global app theme;
- user accent;
- per-chat appearance;
- wallpaper;
- bubble style;
- optional conversation-specific accent.

A chat theme must not mutate unrelated app chrome.

## 12. Navigation

Telegram's strongest design principle is low-friction navigation:
- clear hierarchy;
- obvious back behavior;
- fast state changes;
- controls placed where expected;
- overlays/sheets used for contextual actions rather than whole-screen detours.

KnowMe current target:
- floating bottom dock;
- Home;
- Discover;
- central Create;
- Messages;
- Profile.

Navigation should look like a floating object rather than a rectangular footer.

## 13. Action bars and floating headers

Telegram keeps headers functional and compact:
- title;
- status/context;
- avatar when relevant;
- only essential actions;
- contextual controls.

KnowMe:
- floating header surfaces can use Glass Soft/Medium;
- avoid oversized decorative headers on utility screens;
- profile and media screens may expand/collapse with motion.

## 14. Bottom sheets, dialogs and context menus

Telegram Android has dedicated BottomSheet and AlertDialog systems rather than ad-hoc modal screens.

KnowMe rules:
- bottom sheet for contextual multi-action choices;
- rounded top/shell;
- backdrop dim;
- drag handle where appropriate;
- clear visual grouping;
- blur/glass on the sheet shell when supported;
- destructive actions remain clearly separated;
- no giant full-screen modal for small tasks.

## 15. Motion

Telegram uses reusable easing/interpolator primitives.

Current Telegram Android CubicBezierInterpolator exposes curves such as:
- default cubic (0.25, 0.1, 0.25, 1);
- ease-out;
- ease-in;
- ease-both;
- ease-out-quint;
- ease-out-back;
- emphasized decelerate / accelerate;
- standard decelerate.

KnowMe motion categories:
- tap feedback: 80–120 ms;
- micro state: 160–180 ms;
- panel/sheet: 220–260 ms;
- large transition: 280–320 ms.

Prefer:
- transform;
- opacity;
- shared element continuity;
- matched avatar transitions;
- spring only when behavior benefits from it.

Avoid:
- arbitrary bouncing;
- slow page fades;
- animations that delay action completion.

## 16. Shared-element continuity

Telegram's newer profile design uses scroll/transition continuity.

KnowMe should use continuity for:
- avatar in conversation -> profile avatar;
- media thumbnail -> viewer;
- story ring -> story viewer;
- chat -> details panel;
- mini-player -> full player.

The user should feel that an element moved/expanded, not that a disconnected page appeared.

## 17. Profiles

Recent Telegram Android profile redesign uses scrolling animations and stronger content organization.

KnowMe profile should be:
- identity-first;
- avatar and cover visually dominant;
- handle, bio and trust badges readable;
- actions compact;
- sections/tabs for content;
- settings as coherent groups, not random cards.

KnowMe may go further with:
- AI identity;
- KnowCoins;
- PLAY;
- deeper visual customization;
- richer social/media identity.

## 18. Stories

Telegram stories influence avatar presentation and interactions.

KnowMe:
- circular avatar;
- distinct story ring;
- create-state clearly separated;
- compact labels;
- story viewer focused on media;
- controls use glass overlays;
- avoid heavy opaque chrome on media.

## 19. Media viewer

Telegram uses media-centric chrome:
- media occupies the visual field;
- surrounding controls are secondary;
- overlays may blur/dim;
- controls disappear/reappear naturally;
- gestures matter.

KnowMe should use:
- edge-to-edge media;
- glass action overlays;
- swipe/tap gestures;
- zoom where relevant;
- smooth thumbnail-to-viewer transition.

## 20. Reactions and animated expressive UI

Telegram supports reactions, animated emoji and fullscreen expressive effects.

KnowMe can use this principle without copying assets:
- lightweight reaction motion;
- haptic/tactile response;
- selective fullscreen celebration for special interactions;
- no animation overload.

## 21. Calls

Call UI should prioritize:
- participant identity;
- call state;
- duration/status;
- mute;
- speaker/audio route;
- video;
- end call.

KnowMe visual treatment:
- blurred/live background when possible;
- strong circular glass controls;
- destructive end-call action clearly distinct;
- labels only where ambiguity exists.

## 22. Accessibility and device capability

Telegram adapts behavior to platform/device capabilities and has many performance toggles.

KnowMe must respect:
- reduce motion;
- reduce transparency;
- high contrast;
- text scaling;
- screen-reader labels;
- sufficient touch targets;
- fallback when blur is unsupported or too expensive;
- RTL;
- light/dark system preference;
- device performance.

## 23. Interaction density

Telegram feels fast partly because it avoids unnecessary chrome.

KnowMe rule:
before adding a card, border, label or icon container, ask whether it improves comprehension.

Preferred:
- whitespace;
- grouping;
- hierarchy;
- one primary action;
- subtle separators.

Avoid:
- every row inside a card;
- every icon inside a colored square;
- heavy shadows;
- repeated gradients;
- excessive badges;
- oversized labels.

## 24. Theme customization model for KnowMe

KnowMe should allow users to customize:
- accent color;
- day/night mode;
- chat wallpaper;
- outgoing bubble tint;
- icon active state;
- optional effects intensity.

Changing accent should update:
- buttons;
- links;
- active tabs;
- switches;
- badges;
- selection indicators;
- outgoing messages;
- supported animations.

It must not randomly recolor every surface.

## 25. KnowMe differentiation

Keep from Telegram:
- readability;
- native feel;
- speed;
- coherent theming;
- rounded geometry;
- context-aware blur;
- high-quality chat UI;
- disciplined motion.

Make KnowMe distinct through:
- KnowMe brand palette;
- deeper accent personalization;
- original wallpaper system;
- KnowMe AI/Nexus integration;
- richer profile identity;
- PLAY and KnowCoins;
- stronger social discovery;
- original icons/assets where required;
- original motion language built on similar quality principles.

## 26. Hard implementation rules for future KnowMe UI work

1. Never hard-code a dark-only or light-only screen palette when semantic tokens exist.
2. Never add a new UI surface before deciding whether it is base, raised, glass or overlay.
3. Never use opacity-only fake blur for a primary glass control.
4. Never mix icon families casually.
5. Never implement a theme as only a list of color substitutions.
6. Never break geometry between light and dark.
7. Never use decorative animation to mask slow behavior.
8. Never overload a messaging screen with cards.
9. Always validate contrast.
10. Always preserve reduce-motion and reduce-transparency fallbacks.
11. Use Telegram source as a quality reference, not as copyrighted asset material.
12. When Telegram source changes materially, update this document rather than relying on old screenshots.

## 27. Verified implementation details worth keeping in mind

From current Telegram Android source:
- default app font size setting: 16;
- default chat bubble radius setting: 17;
- useNewBlur defaults to true;
- photoViewerBlur defaults to true;
- avatar color families map to seven broad hues;
- chat themes are separately managed from the global theme;
- day/night variants are a first-class theme concept;
- themes support wallpaper blur/motion/intensity and multi-color backgrounds;
- reusable cubic-bezier / emphasized motion primitives are used;
- theme customization is per-element and semantic rather than one flat palette.

These are reference facts, not mandatory KnowMe constants.
