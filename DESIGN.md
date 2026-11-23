---
name: photocar.ai
description: A guided car-photo studio for premium dealerships, set in the world of the German registration certificate.
colors:
  paper: "#E8EDE9"
  sheet: "#F4F7F5"
  ink: "#12291F"
  ink2: "#4A5D55"
  rule: "#C5D0CA"
  field: "#788A83"
  action: "#173F33"
  onAction: "#EEF3EF"
  mark: "#A8232B"
  ok: "#1E6A45"
  wait: "#855400"
  guide: "#FFFFFF"
  ready: "#2E9E4F"
typography:
  display:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "40px"
  headline:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "32px"
  title:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "20px"
    fontWeight: 600
  title-row:
    fontFamily: "Barlow Semi Condensed"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "SF Pro, Roboto, system-ui"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
  body-small:
    fontFamily: "SF Pro, Roboto, system-ui"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "SF Pro, Roboto, system-ui"
    fontSize: "14px"
    fontWeight: 600
  code:
    fontFamily: "Overpass Mono"
    fontSize: "11px"
    fontWeight: 600
  value:
    fontFamily: "Overpass Mono"
    fontSize: "14px"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  chip: "3px"
  photo: "8px"
  control: "12px"
spacing:
  "0": "4px"
  "1": "8px"
  "2": "12px"
  "3": "16px"
  "4": "24px"
  "5": "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.onAction}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "50px"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "50px"
  button-danger:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.mark}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "50px"
  text-field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "48px"
  code-chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink2}"
    typography: "{typography.code}"
    rounded: "{rounded.chip}"
    padding: "2px 4px 1px"
  segmented-selected:
    backgroundColor: "{colors.action}"
    textColor: "{colors.onAction}"
    rounded: "{rounded.control}"
    height: "44px"
  nav-row:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "12px 16px"
    height: "48px"
  vehicle-row:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "14px 16px"
  vehicle-row-photo:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.photo}"
    width: "116px"
    height: "87px"
---

# Design System: photocar.ai

## Overview

**Creative North Star: "The Registration Stack"**

Every vehicle reads like its own Zulassungsbescheinigung Teil I. The app takes four things from the document: its sage security-paper palette, its print inks, its density, and its field codes (B, D.1, D.3, E, P.1, P.2, P.3, R). Staff type straight from the paper in their hand. The owner scans the fleet like a stack of registrations. The world stops there. There is no guilloche, no stamp, no seal, no paper texture and no document frame.

The system is flat and quiet so the car photographs carry the colour. One dark action green owns every live state. One registration red is held back for "your work is here". Rows are separated by hairline rules on a single surface level, not boxed into cards. Numerals are monospaced and tabular, so the values line up down the list. Chrome stays native: stack headers, the back gesture, sheets, the share menu and alerts all belong to iOS and Android.

Light appearance only (`userInterfaceStyle: "light"`). Everything is built for outdoor legibility: every text colour meets WCAG AA on both grounds, and a unit test enforces it.

**Key Characteristics:**
- Sage paper ground, a lighter sheet for rows and fields, ink-green print.
- Field-code chips in front of the vehicle facts that the document carries.
- One action green, one reserved red, two status colours (ok, wait).
- Condensed display face for names and titles, a tabular mono for codes and values, the system face for everything you read or type.
- No shadows. Rules and the paper/sheet step carry the structure.

## Colors

A cool, low-chroma sage family with one deep green and one red that are kept rare on purpose.

### Primary
- **Ledger Green** (action): the full-width primary button, the selected segment, the checked box, the selected thumbnail ring, links, the header tint and back arrow, and the chosen row's text and check in choice lists. Any state that is live or chosen uses it.
- **Pale Leaf** (onAction): text and spinners on Ledger Green.

### Secondary
- **Registration Red** (mark): reserved for "your work is here". That covers the next missing exterior shot (the state line), a plate still to check, an error, an invalid field's edge, and the danger button's label. It always appears with words or an icon.

### Tertiary
- **Fertig Green** (ok): the dot and text of a finished vehicle.
- **Amber Wait** (wait): uploads in flight, waiting for processing, and the upload summary under the list title.

### Neutral
- **Security Paper** (paper): the screen ground, the native header background, the splash ground, the icon ground, the fill of code chips, and the pressed state of rows.
- **Sheet** (sheet): the one raised surface. List rows, nav groups, inputs, select fields, choice lists, and secondary buttons sit on it.
- **Document Ink** (ink): primary text, vehicle names, values, and the filled segments of the exterior meter.
- **Second Ink** (ink2): secondary text, hints, the "—" for an empty value, code-chip text, chevrons, placeholders, and ".ai" in the wordmark.
- **Hairline** (rule): decorative separators only. That covers row rules, section top rules, code-chip outlines, the empty meter segments, and separators inside choice lists. It sits at 1.34:1 on paper, so it never carries meaning alone.
- **Field Edge** (field): the edges of interactive controls (text fields, select fields, segmented controls, secondary and danger buttons, checkbox outlines, the outer edge of a choice list) and the dashed no-photo placeholder with its car glyph. It holds at least 3:1 on both paper and sheet.
- **Capture Guide / Capture Ready** (guide, ready): used only on the camera screen, for the silhouette while guiding and once everything holds. They are not part of the paper world.

### Named Rules
**The One Live Colour Rule.** Ledger Green is the only colour for live or chosen state. Nothing else is tinted to say "selected".

**The Your-Work Red Rule.** Registration Red means one thing: the user has something to do here. It is never decoration and never marks an empty value. An empty field shows "—" in Second Ink, not red.

**The Never-Colour-Alone Rule.** Every status colour comes with words (state line, nav-row state, notice) or an icon.

**The AA-On-Both-Grounds Rule.** The text colours (ink, ink2, mark, ok, wait) stay at or above 4.5:1 on paper and on sheet, onAction at or above 4.5:1 on action, and field at or above 3:1 on both grounds. `apps/mobile/src/ui/theme.test.ts` enforces this, so a new text colour has to be added there.

## Typography

**Display Font:** Barlow Semi Condensed 700 / 600 (falls back to the system face if loading fails)
**Body Font:** the system face (SF Pro on iOS, Roboto on Android)
**Label/Mono Font:** Overpass Mono 600 for codes and 500 for values

**Character:** a condensed, slightly technical grotesque for names and headings, like the printed headings on a registration form, next to a monospaced face for the form's codes and numbers. Everything the user reads at length or types stays on the system face and follows the system text size.

Both brand families ship in the JS bundle and load in the root layout while the splash is held. If they fail, the app opens on the system face.

### Hierarchy
- **Display** (Barlow SC 700, 34/40): the list screen's in-content title "Fahrzeuge", drawn by the screen instead of the native large title.
- **Headline** (Barlow SC 700, 28/32): the vehicle name on the vehicle page.
- **Title** (Barlow SC 600, 20): section headings (form sections, studio, account), native header titles, and the no-gallery title.
- **Title-row** (Barlow SC 600, 18/22): the vehicle name in list rows, up to two lines.
- **Body** (system 400, 16/22): body text, button labels (600), input and select values, notices, and nav-row labels.
- **Body-small** (system 400, 14): hints, the nav-row state, state-line text (600 when it is the red next step), and field errors.
- **Label** (system 600, 14): form field labels.
- **Code** (Overpass Mono 600, 11): text inside code chips. 11 is the floor.
- **Value** (Overpass Mono 500, 14, tabular numerals): vehicle facts such as dates (MM/YYYY), kW, km, and "—".

### Named Rules
**The Brand-Face Boundary Rule.** Barlow is used only for titles, vehicle names, the wordmark and the account initials. Overpass Mono is used only for codes and fact values. Body text, buttons and form values are never set in a brand face.

**The Tabular Figures Rule.** Every vehicle value is set in Overpass Mono with tabular numerals, so the columns line up from row to row.

**The Lowercase Wordmark Rule.** "photocar.ai" is always lowercase in Barlow SC 600, with ".ai" in Second Ink. It appears at 19 as the list header's title view, at 28 on sign-in, invite and reset, and on the splash and icon.

## Layout

The app is a single native stack in portrait, with no tab bar. Screens pad by 16 (space 3) at the sides. Form screens stack their content with gaps of 16. The spacing scale is 4, 8, 12, 16, 24, 32. Rows use 14 (12 + 2) for vertical padding and for the photo-to-text gap.

- **Vehicle list:** a header block (display title, optional upload summary in amber, full-width primary button), then edge-to-edge sheet rows. Each row has a 116×87 photo on the left and, beside it, the name, the B / P.2 / km facts and the state line. The facts always appear in that order and in those slots, empty values included.
- **Vehicle page:** a full-bleed 4:3 cover. With no cover it is a 160-high placeholder. Below it come the headline name, the facts (B, P.2, P.3, km), the state line, the Studio primary button, and an edge-to-edge nav group. The native header title is empty because the page's own heading names the car.
- **Forms:** sections sit on the paper ground with a hairline top rule and a title. The fields themselves are the sheet surface.
- **Studio and share:** photo grids of 4:3 tiles with 8 radius, two columns in the studio and three in the share grid.
- **Touch targets:** at least 44 pt. Rows, inputs and buttons are 48 to 50.

## Elevation & Depth

The system is flat. No component casts a shadow, and the native header's shadow is turned off. Depth has exactly two tonal levels: paper (the ground) and sheet (rows, fields, groups). A pressed row drops from sheet back to paper. Any glass or shadow on iOS 26 bar buttons comes from the system, not from this system.

### Named Rules
**The One Surface Level Rule.** There is one surface level per depth. No card goes inside a card, and no sheet panel wraps a group of sheet fields. Alignment and hairlines do the grouping.

## Shapes

- **Controls** (12): buttons, inputs, select fields, segmented controls, choice lists, inset nav groups, and the selected-thumbnail ring.
- **Photos** (8): row photos, grid tiles, and share thumbnails. The vehicle page cover is full-bleed and square-cornered.
- **Code chips** (3): small, nearly square boxes with a 1 px Hairline outline on a paper fill.
- **Round:** state dots (8), the account initials button (36 circle, 48 hit area), and photo check circles.
- **Meter:** eight 14×4 segments with a radius of 2, filled in Document Ink and empty in Hairline.
- **Borders:** 1 px for control edges, hairline width for rules and group edges, 1.5 for checkboxes (24, radius 4), and a dashed 1 px Field Edge for an empty photo slot.

## Components

### Buttons
Quiet, solid and full width.
- **Shape:** gently rounded (12), at least 50 high, with 16 of side padding.
- **Primary:** Ledger Green fill and a Pale Leaf label in system 600 at 16. Use one per screen.
- **Secondary:** a Sheet fill, a 1 px Field Edge outline and an ink label.
- **Danger:** the same outlined shape with a Registration Red label. It is not a red fill.
- **States:** pressed at 0.8 opacity, disabled at 0.45. While loading, a spinner in the label colour replaces the label.

### Chips (Code Chip)
The signature. It is a registration field code in a small outlined box, placed right before what it labels.
- **Style:** paper fill, 1 px Hairline outline, radius 3, Overpass Mono 600 at 11 in Second Ink.
- **Where:** before fact values (the Fact component) and before form labels (FieldLabel, for example "[P.2] Leistung (kW)"). Codes come only from `src/vehicle/fieldCodes.ts`: B, D.1, D.3, E, P.1, P.2, P.3, R. "km" is the only non-document unit allowed in the chip. A field without a code (variant, mileage, owners, HU, equipment, price) gets a plain label starting at the same left edge, with no empty code column.

### Fact
A code chip, a 5 gap, then the value in Overpass Mono 500 at 14 with tabular numerals in ink. A missing value shows "—" in Second Ink. The list shows B, P.2 and km; the page shows B, P.2, P.3 and km. `src/vehicle/facts.ts` produces both.

### State Line
The vehicle's state in one line. `src/vehicle/stateLine.ts` decides it, checking these in order:
- ready: Fertig Green dot and text.
- processing: amber.
- uploads pending: amber.
- shooting with fewer than 8 exterior shots: an eight-segment meter above the text "Außen x/8 · n fehlen" in Registration Red 600, with no dot.
- shooting with all 8 shots: amber "waiting for processing".
- otherwise: a Second Ink dot and "Noch keine Fotos".
Interior shots and data completeness never enter it. Text is system 14.

### Cards / Containers
There are no cards. A **Nav Group** is a sheet strip with hairline top and bottom edges. Its inset variant adds a 12 radius and a hairline frame (the account screen). A **Nav Row** is a body label, an optional small state on the right (ink2, or red 600 for your work), and a 14 chevron in Second Ink. Rows are at least 48 high with 16 side padding and hairline separators.

### Inputs / Fields
- **Text field:** a Sheet fill, a 1 px Field Edge, radius 12, at least 48 high, 12 side padding, system 16 ink text and Second Ink placeholders. A multiline field gets 12 of vertical padding.
- **Error:** the edge turns Registration Red, and the message below is system 14 in red.
- **Select field:** the same box. It opens a native page sheet on paper, with hairline rows, a "clear" first row in Second Ink, the selected row in Ledger Green 600, and a close link in Ledger Green.
- **Choice list:** an inline single choice on Sheet. The outer edge is Field Edge (it is an input), the inner separators are Hairline, and the chosen row shows Ledger Green 600 text and a checkmark icon.
- **Segmented control:** a Sheet strip with a Field Edge outline and radius 12. The selected segment fills with Ledger Green, with a Pale Leaf 600 label. Each segment is at least 44 high.
- **Checkbox:** a 24 box with a 1.5 Field Edge. When checked it fills with Ledger Green and shows a check icon.
- **Labels:** FieldLabel, system 600 at 14 in ink, led by the code chip when there is one. It wraps at large text sizes.

### Notice
`info` is body text in Second Ink, `error` is body text in red, and `attention` is a red exclamation-circle icon with red 600 text. Notices use a polite live region.

### Navigation
The native stack header has a paper background, no shadow, Barlow SC 600 titles in ink, and a Ledger Green tint and back arrow. The list's header carries the wordmark as its title view, plus the account button: the gallery's initials in Barlow SC 600 at 13, Second Ink, in a 36 circle. On Android that circle has a sheet fill and a hairline edge.

### Icons
There is one icon set: SF Symbols on iOS and Material Symbols on Android, through `expo-symbols`. Icons are decorative, and the adjacent text carries the meaning. Unicode glyphs are never used as icons.

### Brand Assets
The icon is an ink outlined code-chip box holding "pc" in Overpass Mono on Security Paper. Android has separate foreground, background and monochrome layers. The splash is the wordmark on Security Paper. All of them are rendered by `apps/mobile/assets/brand/render.swift`, which writes the SVG sources and the PNGs.

## Do's and Don'ts

### Do:
- **Do** put the registration code chip before every fact or form field that the Zulassungsbescheinigung prints, taking the code from `fieldCodes.ts`.
- **Do** keep list rows uniform: photo left, then name, B / P.2 / km, and the state line, always in the same slots, with "—" for unknown values.
- **Do** use the paper ground with sheet rows and fields, separated by hairlines.
- **Do** give every status colour words or an icon, and keep text colours AA on both grounds (`theme.test.ts`).
- **Do** keep native chrome native: the stack header, back gesture, page sheets, share sheet and system alerts.
- **Do** use one full-width Ledger Green primary button per screen.

### Don't:
- **Don't** turn the world into a costume. No guilloche, fake stamps or seals, paper texture, or document frames.
- **Don't** nest cards or wrap sheet fields in a sheet panel.
- **Don't** use Registration Red for empty values, decoration or emphasis. It means "your work is here" only.
- **Don't** add shadows, gradients, coloured left-edge stripes or emoji.
- **Don't** use a Unicode glyph as an icon. Use the SF / Material symbol.
- **Don't** invent a field code. `variant` is not D.2, and a field the document doesn't print gets no chip.
- **Don't** set body text, buttons or form values in Barlow or Overpass Mono.
- **Don't** put photocar.ai branding on shared output. The poster carries the gallery's brand.
