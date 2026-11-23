# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One brand look on iOS and Android. Operating-system behaviour stays native on each platform: back gesture, keyboard, share sheet, system dialogs, permissions. Built with Expo SDK 58 / React Native 0.88.

## Users

**Who:** car dealerships ("Galerien") in a premium segment. The pilot is one dealership in Germany.
- **Gallery owner (Inhaber):** manages the gallery settings (banner, logo, contact numbers), staff and credits. Owns the processing that spends credits and, later, publishing listings.
- **Gallery staff (Personal):** create vehicles, shoot them with their own phones, fill in vehicle data, prepare listing text and share. Staff are often not technical; the app must be usable without help.

**Later:** private car owners may come with the marketplace. They are not users now.

## Product Purpose

photocar.ai turns a phone into a guided car-photo studio:
1. Staff shoot a vehicle anywhere, in any weather, following on-screen guidance (silhouette, angle, auto-capture, quality checks), even offline.
2. The photos are processed into studio images. The background is replaced, the gallery banner covers the plate, and a watermark is added.
3. The app builds the listing: vehicle data, damage map, AI listing text in German/Turkish/English, and reading an inspection report.
4. It shares the result as a poster plus photos plus text to WhatsApp and Instagram, and copies the text for mobile.de.

Success means a gallery produces listing-ready photos and text for a car in one visit to the car, without a photo studio.

## Positioning

**Studio results without a studio:** the car is shot where it stands, in any weather, and comes out looking like a showroom shot with the gallery's own branding on the plate.

**Lineage:** autofox.ai is a similar product but not a reference.

## Operating Context

- **Shooting:** outdoors on the dealership lot, often in bright sun or rain, phone in hand, walking around the car. It works without network in airplane mode; uploads happen later in the office.
- **Studio work, data entry, listing and sharing:** mostly indoors, at a desk or in the showroom.
- **Credits:** one credit per vehicle, charged on its first processing. Credit packages and pricing are not decided yet.
- **Devices:** staff use their own phones, including low-end Android phones and older iPhones.

## Capabilities and Constraints

- **Languages:** the UI is German first, then Turkish and English. Every string exists in all three.
- **Roles:**
  - Owner and staff. Only the owner starts a vehicle's first, credit-charging processing.
  - Staff keep sharing and export.
  - The listing will be published by the owner in the marketplace phase.
- **Data:** the backend is Supabase in the EU (Frankfurt) and GDPR applies. The VIN and the plate never appear on shared output.
- **AI:** the provider is OpenAI. AI calls cost money and run only on explicit user actions.
- **Not built yet:**
  - the marketplace;
  - direct mobile.de upload (needs the gallery's API access);
  - push notifications.

## Brand Commitments

- **Name:** **photocar.ai**, tentative ("for now, may change"). The repository and code name stay bambu-car-app. The publisher is Bambu Games.
- **Logo:** none exists yet. The app icon and splash are still Expo's template images.
- **Audience:** the user wants a professional, premium/luxury feel that matches a high-end dealership audience, with one coherent theme.
- **Voice:** plain and factual. The product is a tool, not a landing page.

## Evidence on Hand

- **Real processed studio output:** an Opel Crossland on the "Studio Dunkel" background with a gallery plate banner (copies in `.superpowers/brainstorm/*/content/car-*.jpg`, from the simulator cache).
- **Share posters** at 4:5 and 9:16.
- **Not on hand:** customer testimonials, pricing and dealership logos. Do not fabricate them.

## Product Principles

1. **The car is the hero.** Every screen gives the vehicle's photos priority over chrome.
2. **Usable without help.** Plain labels, one clear primary action per screen, and states the user can act on.
3. **Works where cars stand.** It stays legible outdoors and keeps working offline.
4. **The gallery's brand, not ours, goes out.** Shared output carries the dealership's banner, logo and contact. photocar.ai stays quiet on shared output.

## Accessibility & Inclusion

- **Legibility:** text stays legible in sunlight; contrast meets WCAG AA at minimum.
- **Touch targets:** at least 44pt.
- **Dynamic type:** respected where the layout allows.
- **Colour:** status is never conveyed by colour alone.
