# Premium screen audit

This inventory is based on the current route implementations, not on whether a
file imports a particular widget. `ScreenBackdrop`, `Surface`, shared sheets,
and navigation components are evaluated as a design system together.

## NOT REDESIGNED

None. Every route screen uses the BLACK + GOLD token system, the shared dark
surface/radius/spacing scale, and the current loading, empty, error, and action
states.

## PARTIAL

None after the onboarding visual was made abstract. It no longer presents a
sample person, phone number, or a sample public ID as if it were live data.

## PREMIUM DONE

| Area | Route screens |
| --- | --- |
| Entry | `splash.dart`, `onboarding.dart`, `login.dart`, `register.dart`, `forgot_password.dart`, `verify_email.dart`, `gift_card.dart` |
| App shell | `shell.dart` |
| Home and discovery | `home.dart`, `discover.dart` |
| NFC and IDs | `nfc_center.dart`, `nfc_scan.dart`, `nfc_write.dart`, `id_catalog.dart`, `id_detail.dart`, `qr_share.dart`, `gift_id.dart`, `gift_offers.dart`, `order_card.dart` |
| Profiles | `profile_tab.dart`, `profile_screen.dart`, `edit_profile.dart`, `follow_list.dart`, `profile_stats.dart`, `my_content.dart` |
| Business | `create_company.dart`, `edit_business.dart`, `edit_catalog.dart`, `edit_gallery.dart`, `working_hours.dart`, `product_detail.dart`, `business_stats.dart` |
| Content | `compose.dart`, `post_detail.dart`, `story_viewer.dart`, `reels.dart`, `photo_viewer.dart` |
| Orders and payment | `order_flow.dart`, `my_orders.dart`, `owner_orders.dart`, `payment_screen.dart` |
| Settings and safety | `settings_screen.dart`, `appearance.dart`, `change_password.dart`, `payments_history.dart`, `premium.dart`, `support.dart`, `lock_screen.dart`, `set_pin_screen.dart` |

## Shared components checked

`contact_actions.dart`, `share.dart`, `report_sheet.dart`, `id_chip.dart`, and
`switcher.dart` are sheets/components, not independent route screens. They use
the shared `Surface`, `showSheet`, `FilterChip`, typography, spacing, and
BLACK + GOLD tokens. Their existing real actions remain intact.

## Data integrity boundary

Visual work must not replace any API result with sample data. The only
non-server visual in onboarding is now an explicitly abstract NFCSTORE brand
illustration; profile, company, catalog, order, payment, and content screens
continue to render repository/API values.
