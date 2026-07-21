# Apple Live Activities / Dynamic Island (external)

Fetched ~2026-07-20. UX reference for RYU dock — not a Mac implementation guide.

## Links

- HIG Live Activities: https://developer.apple.com/design/human-interface-guidelines/live-activities
- ActivityKit display: https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- WWDC23 design talk: https://developer.apple.com/videos/play/wwdc2023/10194/

## Facts for RYU

| Apple | RYU map |
| --- | --- |
| Compact | Idle / quiet presence |
| Minimal | Tight “needs you” / multi-session later |
| Expanded | Permission preview + Allow/Deny |
| Alert only for essential updates | Glow reserved for pending human input |

- Persistent until resolved (Live Activity), not a vanishing toast.
- Expanded = detail + controls (call Accept/Decline analogue).
- Don’t invent a new interaction language; morph compact → expand → collapse.
