# THEME: Design system

Feel: calm, trustworthy, urgent only when it must be.

## Colour tokens
| Token | Hex | Use |
|---|---|---|
| navy | #0B1B3A | Headers, primary buttons, text on light |
| orange | #F26A1B | Accent, key actions, highlights |
| blue | #2F6FDE | Info, links, secondary |
| green | #0F7A5F | OK, resolved, success |
| red | #B91C1C | HIGH risk, flagged |
| amber | #D97706 | MEDIUM, grace |
| rust | #C2500F | Warnings text on cream |
| cream | #FFF6EE | Page background |
| peach | #FDE8D7 | Soft callouts |
| tint | #E8ECF4 | Neutral cards |
| text | #1F2937 | Body |
| gray | #6B7280 | Secondary text |
Dark mode: navy background #0B1B3A, cards #12264D, text #F3F4F6, same accents.

## Status colours (always with icon + label, never colour alone)
ok green check | due/grace amber clock | reminded/pinged orange bell/people | flagged red alert | seenSafe blue shield. Risk: HIGH red, MEDIUM orange, LOW green.

## Typography
Headings: Trebuchet MS Bold (or Inter 700). Body: Calibri/Inter 400-600. Scale: 14, 16, 18, 22, 28, 36. Minimum body 16 px on mobile.

## Layout and components
- 8 px spacing grid; cards radius 12-16 px with thin warm border (#F1D5BF); soft shadow only on modals.
- Primary button: navy fill, white text, 48 px high; destructive: red; the resident "I'm okay" button is huge (full width, 96 px, green).
- Tier badges are pills; "Why this score?" uses horizontal bars plus sentences.
- Map: flood zones translucent blue, clusters translucent red circles, volunteers distinct icons.
- Ribbon "Simulated data" shown whenever the simulator runs; banner "RahatLink suggests. A coordinator decides."
- Wordmark: "Code" navy + "Forge" orange.

## Accessibility
Tap targets >= 48 px, contrast >= 4.5:1, aria labels, Hindi labels for key actions, works one-handed, empty/loading/error states everywhere.

## Motion
Subtle: marker pulse on newly flagged, 150-200 ms transitions, respect prefers-reduced-motion.

## Tagline
"Other apps wait for an SOS. RahatLink notices who went silent."
