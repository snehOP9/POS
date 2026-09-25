# EmberServe POS product audit and implementation backlog

This is a page-by-page product backlog derived from the current customer menu, login, cashier, waiter, kitchen, API, operations, and deployment surfaces. Items are intentionally discrete so they can be estimated, designed, implemented, tested, and released independently.

## Customer menu and ordering

- [ ] 001 Show restaurant opening hours and next service window.
- [ ] 002 Display live table-service availability from the scanned QR context.
- [ ] 003 Add a clear allergen disclosure before ordering.
- [ ] 004 Let guests filter by vegetarian, vegan, gluten-free, and allergens.
- [ ] 005 Add cuisine, spice, and dietary search facets.
- [ ] 006 Support menu-item photos supplied by restaurant staff.
- [ ] 007 Show richer item descriptions and ingredient highlights.
- [ ] 008 Show calories and nutrition where configured.
- [ ] 009 Show serving size and shareability guidance.
- [ ] 010 Add estimated preparation time per dish.
- [ ] 011 Show availability countdowns for limited dishes.
- [ ] 012 Suggest relevant modifiers before adding an item.
- [ ] 013 Support modifier groups with min/max selection rules.
- [ ] 014 Support special instructions with length and safety limits.
- [ ] 015 Let guests save favourites without making account creation mandatory.
- [ ] 016 Add recently ordered items for returning guests.
- [ ] 017 Recommend accompaniments from order rules.
- [ ] 018 Recommend allergen-safe substitutes.
- [ ] 019 Let guests choose cutlery and napkin preferences.
- [ ] 020 Let guests add a celebration or occasion note.
- [ ] 021 Support scheduled pickup times.
- [ ] 022 Enforce pickup ordering cut-off windows.
- [ ] 023 Present an address or landmark only for delivery-capable restaurants.
- [ ] 024 Add an explicit gratuity option where legally appropriate.
- [ ] 025 Show a full tax and charge breakdown before submission.
- [ ] 026 Require confirmation when a selected item becomes unavailable.
- [ ] 027 Preserve the cart across reloads with an expiry notice.
- [ ] 028 Recover a cart after a temporary network loss.
- [ ] 029 Add a review-order step for high-value orders.
- [ ] 030 Add an accessible checkout success receipt.

## Customer account, payment, and tracking

- [ ] 031 Offer guest checkout without retaining unnecessary personal data.
- [ ] 032 Provide customer email verification when accounts are enabled.
- [ ] 033 Add password reset and account recovery flows.
- [ ] 034 Support consent-managed marketing preferences.
- [ ] 035 Let customers view and delete retained profile data.
- [ ] 036 Add saved dietary preferences with explicit consent.
- [ ] 037 Support multiple payment choices per restaurant policy.
- [ ] 038 Show payment authorization and failure states clearly.
- [ ] 039 Support retrying a failed payment without duplicating an order.
- [ ] 040 Add a payment receipt download and email option.
- [ ] 041 Show live order stages with timestamps.
- [ ] 042 Show kitchen delay explanations without exposing staff details.
- [ ] 043 Let a guest request a waiter from order tracking.
- [ ] 044 Let a guest request water, cutlery, or the bill.
- [ ] 045 Add a simple issue-report flow for incorrect items.
- [ ] 046 Add a post-meal rating limited to the completed order.
- [ ] 047 Add optional item-level feedback.
- [ ] 048 Let staff reply to a customer issue through approved templates.
- [ ] 049 Provide a QR deep-link that restores the current table context.
- [ ] 050 Detect an expired or invalid table QR and explain the next action.
- [ ] 051 Prevent cross-table ordering from a stale QR token.
- [ ] 052 Display a privacy notice at personal-data collection points.
- [ ] 053 Support multilingual guest menus.
- [ ] 054 Support currency and locale formatting by restaurant configuration.
- [ ] 055 Add a high-contrast customer theme.
- [ ] 056 Add reduced-motion customer interactions.
- [ ] 057 Keep every checkout action usable by keyboard.
- [ ] 058 Announce cart and checkout changes to assistive technology.
- [ ] 059 Add offline menu browsing with a clear stale-data timestamp.
- [ ] 060 Add a customer order lookup using a privacy-safe receipt code.

## Waiter floor service

- [ ] 061 Add a visual floor-plan editor for table placement.
- [ ] 062 Group tables by zone, room, patio, and bar.
- [ ] 063 Support table combinations and splits.
- [ ] 064 Show table capacity and current guests together.
- [ ] 065 Suggest the best available table for a party size.
- [ ] 066 Flag a party that exceeds every available table capacity.
- [ ] 067 Support a waitlist with quoted wait times.
- [ ] 068 Assign waitlist entries to tables in one action.
- [ ] 069 Record accessibility seating requirements.
- [ ] 070 Record high-chair, booster, and stroller needs.
- [ ] 071 Record guest allergy alerts with role-limited visibility.
- [ ] 072 Let staff add a host name for a table session.
- [ ] 073 Allow a waiter to transfer a table to another waiter.
- [ ] 074 Require a reason when transferring active table ownership.
- [ ] 075 Add a configurable table-cleaning state.
- [ ] 076 Add a maintenance/unavailable table state.
- [ ] 077 Add a reservation arriving state.
- [ ] 078 Highlight tables approaching reservation time.
- [ ] 079 Add table turn-time targets by service period.
- [ ] 080 Flag tables exceeding the target turn time.
- [ ] 081 Add course pacing controls for starters, mains, and desserts.
- [ ] 082 Hold and fire individual course items.
- [ ] 083 Send a waiter note to the kitchen with audit history.
- [ ] 084 Show kitchen acknowledgement for waiter notes.
- [ ] 085 Let waiters mark a dish as served by line item.
- [ ] 086 Track partial service for multi-course tables.
- [ ] 087 Add a table-level service checklist.
- [ ] 088 Add one-tap water refill and bill request tasks.
- [ ] 089 Add guest call alerts with acknowledgement.
- [ ] 090 Escalate unacknowledged guest calls to the floor lead.

## Waiter order and handoff workflows

- [ ] 091 Let waiters create a new table order directly from a session.
- [ ] 092 Let waiters add items to an existing open order.
- [ ] 093 Require a reason for removing a sent item.
- [ ] 094 Support manager approval for voids above a threshold.
- [ ] 095 Add item substitutions with customer confirmation state.
- [ ] 096 Show menu availability by kitchen station.
- [ ] 097 Add a low-stock warning before a waiter places an item.
- [ ] 098 Support split bills by guest, item, and custom amount.
- [ ] 099 Support moving individual items between tables.
- [ ] 100 Support merging two active table sessions safely.
- [ ] 101 Preserve audit history for split, move, and merge actions.
- [ ] 102 Add a shared table timeline for all service actions.
- [ ] 103 Show outstanding payment state on the waiter floor plan.
- [ ] 104 Let a waiter request cashier assistance for a table.
- [ ] 105 Notify waiters when a table payment settles.
- [ ] 106 Let waiters reprint a guest bill request.
- [ ] 107 Add a compact mobile floor view for busy service.
- [ ] 108 Add haptic or sound alerts configurable per waiter.
- [ ] 109 Add shift handover notes between waiters.
- [ ] 110 Add a missed-task queue after reconnect.
- [ ] 111 Add conflict resolution when two waiters edit a table.
- [ ] 112 Show who last changed a table session.
- [ ] 113 Add a table-session close confirmation with guest count summary.
- [ ] 114 Suggest next cleaning actions when a session closes.
- [ ] 115 Track no-shows and cancelled reservations.
- [ ] 116 Add a VIP flag with restricted, auditable access.
- [ ] 117 Add service-recovery flags for dissatisfied guests.
- [ ] 118 Add server-specific sales and turn metrics.
- [ ] 119 Add waiter task prioritization by urgency.
- [ ] 120 Add guided onboarding for the table-first workflow.

## Cashier and payments

- [ ] 121 Add register open and close workflows with cash float.
- [ ] 122 Require a counted cash total at shift close.
- [ ] 123 Show expected-versus-counted cash variance.
- [ ] 124 Require a variance reason and manager sign-off.
- [ ] 125 Support multiple cash drawers and register assignment.
- [ ] 126 Add barcode and SKU scanning for menu items.
- [ ] 127 Add keyboard shortcuts with a discoverable shortcut guide.
- [ ] 128 Add customer-facing price display support.
- [ ] 129 Add configurable tax profiles by item and order mode.
- [ ] 130 Add discount types: percentage, fixed, and comp.
- [ ] 131 Require a reason and authority for every discount.
- [ ] 132 Add promotion codes with validity windows.
- [ ] 133 Add happy-hour and time-based pricing rules.
- [ ] 134 Add staff meal and employee discount policies.
- [ ] 135 Support gift cards and stored-value balances.
- [ ] 136 Support refund-to-original-method where possible.
- [ ] 137 Add partial refunds by line item.
- [ ] 138 Require original-payment lookup before refund.
- [ ] 139 Add offline cash mode with reconciliation queue.
- [ ] 140 Block duplicate payment capture with idempotency keys.
- [ ] 141 Add payment terminal pairing and health status.
- [ ] 142 Add QR payment handoff and polling state.
- [ ] 143 Add tip capture and staff tip allocation rules.
- [ ] 144 Support receipts by print, email, SMS, and QR.
- [ ] 145 Add receipt reprint audit events.
- [ ] 146 Add an explicit cash change calculator.
- [ ] 147 Add refund and void queues with approval status.
- [ ] 148 Add cashier notes for disputed payments.
- [ ] 149 Add cashier shift clock-in and break status.
- [ ] 150 Add a guided recovery flow after payment-provider outages.

## Kitchen display and fulfilment

- [ ] 151 Add promised-time and elapsed-time timers per ticket.
- [ ] 152 Highlight tickets at risk of missing service targets.
- [ ] 153 Add per-station preparation capacity limits.
- [ ] 154 Let chefs accept and start individual ticket lines.
- [ ] 155 Support batching similar items across tickets.
- [ ] 156 Add a kitchen expo view for plated dishes.
- [ ] 157 Add a runner handoff state after expo.
- [ ] 158 Add kitchen acknowledgement for newly fired orders.
- [ ] 159 Add explicit out-of-stock actions from the kitchen.
- [ ] 160 Propagate item unavailability to every ordering surface.
- [ ] 161 Add substitute suggestions maintained by kitchen leads.
- [ ] 162 Add allergen and dietary preparation warnings.
- [ ] 163 Require acknowledgement for allergen-sensitive tickets.
- [ ] 164 Add a configurable audible ticket alert.
- [ ] 165 Support bump-bar and touch-friendly controls.
- [ ] 166 Add kitchen display density and font-size settings.
- [ ] 167 Add station-specific printer routing.
- [ ] 168 Print a ticket fallback when the display is offline.
- [ ] 169 Add a re-fire workflow with failure reason.
- [ ] 170 Track waste caused by re-fires and cancellations.
- [ ] 171 Add a delayed-item notification to waiter and customer.
- [ ] 172 Add item-ready versus whole-order-ready semantics.
- [ ] 173 Add kitchen shift notes and prep handover.
- [ ] 174 Add prep-list generation from upcoming reservations.
- [ ] 175 Add daily production and prep completion checklists.
- [ ] 176 Add recipe and plating reference links per item.
- [ ] 177 Add item availability by daypart.
- [ ] 178 Add kitchen performance metrics by station.
- [ ] 179 Add a history view for completed and cancelled tickets.
- [ ] 180 Add a safe reconnect replay for missed real-time updates.

## Manager, configuration, and operations

- [ ] 181 Add a manager dashboard with real-time service health.
- [ ] 182 Add secure staff account creation and deactivation.
- [ ] 183 Add least-privilege permission bundles beyond role names.
- [ ] 184 Add manager approval queues for discounts, voids, and refunds.
- [ ] 185 Add a complete immutable activity audit viewer.
- [ ] 186 Add configurable menu categories and display ordering.
- [ ] 187 Add menu-item create, edit, archive, and restore flows.
- [ ] 188 Add modifier, variant, and recipe configuration screens.
- [ ] 189 Add scheduled menu availability and daypart menus.
- [ ] 190 Add stock and ingredient inventory management.
- [ ] 191 Add supplier, purchase-order, and goods-receipt workflows.
- [ ] 192 Add recipe-costing and margin calculation.
- [ ] 193 Add stock depletion from completed order lines.
- [ ] 194 Add waste, spoilage, and stock-adjustment reasons.
- [ ] 195 Add stock-count sessions and variance review.
- [ ] 196 Add reservation management with deposits and reminders.
- [ ] 197 Add floor-plan layout and zone administration.
- [ ] 198 Add restaurant profile, hours, taxes, and service-charge settings.
- [ ] 199 Add multi-location organization support.
- [ ] 200 Add location-specific menus, prices, and permissions.
- [ ] 201 Add staff scheduling and availability management.
- [ ] 202 Add time-clock and attendance export support.
- [ ] 203 Add daily opening and closing checklists.
- [ ] 204 Add incident reporting for service, safety, and equipment.
- [ ] 205 Add a maintenance ticket workflow for equipment.
- [ ] 206 Add document storage for licenses and inspections.
- [ ] 207 Add configurable notification templates.
- [ ] 208 Add data export and retention controls.
- [ ] 209 Add business settings change approval and audit history.
- [ ] 210 Add manager onboarding and contextual help.

## Reliability, security, analytics, and accessibility

- [ ] 211 Add a readiness endpoint that fails when MongoDB is unavailable.
- [ ] 212 Add database migration version tracking.
- [ ] 213 Add automatic encrypted backup scheduling.
- [ ] 214 Add restore drills with documented recovery objectives.
- [ ] 215 Add structured error monitoring and alert routing.
- [ ] 216 Add uptime, latency, and real-time connection dashboards.
- [ ] 217 Add payment webhook replay protection and reconciliation.
- [ ] 218 Add rate limits by authentication and payment risk class.
- [ ] 219 Add account lockout and administrator unlock controls.
- [ ] 220 Add optional staff multi-factor authentication.
- [ ] 221 Add device/session management and remote sign-out.
- [ ] 222 Add secret rotation procedures and expiry alerts.
- [ ] 223 Add a privacy data inventory and deletion workflow.
- [ ] 224 Add configurable audit-log retention and export.
- [ ] 225 Add automated API contract tests.
- [ ] 226 Add browser end-to-end tests for every role journey.
- [ ] 227 Add visual regression checks for desktop, tablet, and mobile.
- [ ] 228 Add keyboard-only regression tests for all panels.
- [ ] 229 Add screen-reader announcements for real-time changes.
- [ ] 230 Add colour-contrast checks in CI.
- [ ] 231 Add localization extraction and translation review checks.
- [ ] 232 Add a feature-flag system with safe gradual rollouts.
- [ ] 233 Add a canary deployment and rollback procedure.
- [ ] 234 Add synthetic order monitoring without real payment capture.
- [ ] 235 Add sales, labour, and table-turn dashboards.
- [ ] 236 Add menu engineering reports for popularity and margin.
- [ ] 237 Add cancellation, refund, and service-recovery analytics.
- [ ] 238 Add demand forecasting for staffing and prep.
- [ ] 239 Add scheduled end-of-day reports for managers.
- [ ] 240 Add documented incident response and production support ownership.