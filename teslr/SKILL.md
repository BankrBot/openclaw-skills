---
name: teslr
description: Read state and history, manage a Tesla connection, and safely control supported Tesla products from Bankr during Teslr's free beta. Use for tire pressure, FSD/Autopilot, telemetry, charging, climate, closures, access, schedules, media, navigation, security, software, driver management, energy products, connection revocation, or Fleet API operations.
---

# Teslr

Use Teslr through https://teslr.club/api. It supports a direct Tesla Fleet OAuth connection plus a compatibility provider for richer provider-specific history and mutations. Every upstream route remains fixed to an allowlist. Direct Tesla access is free during the beta under account-level fair-use limits; there is no balance to check or payment secret to add. The official Teslr account for updates and support on X is [@TeslrBot](https://x.com/TeslrBot).

## Authentication

Prefer the secure environment variable `TESSIE_API_TOKEN` when it is available so the user's Tessie account handles provider usage. If it is absent, use `TESLR_FLEET_TOKEN`. If both are absent, tell the user to connect Tesla at `https://teslr.club` or add their existing provider token in Bankr Terminal → Settings → Env Vars. Never ask the user to paste either token in chat. Never print, echo, log, or return a token. Never put one in a URL, shell argument, or process listing.

For every request, use `execute_cli` with Node's built-in fetch. Read secrets inside Node from `process.env`. Pass the selected token only as `Authorization: Bearer` and set `x-teslr-provider` to `tesla` for `TESLR_FLEET_TOKEN` or `tessie` for `TESSIE_API_TOKEN`. Add a newly generated UUID in `Idempotency-Key` to every authenticated request. Do not use curl for authenticated requests or interpolate secrets into command text.

## Workflow

1. Select Tessie when `TESSIE_API_TOKEN` exists, including when both supported variables exist. Use the direct Tesla connection when Tessie is absent or a requested capability requires direct Fleet; never silently retry another provider after an error.
2. Direct Tesla access is free during the beta. Do not check, display, or estimate a dollar balance or requests remaining before an operation. Normal use should proceed without mentioning limits. If Teslr returns `beta_fair_use_limit` or `beta_cooldown_active`, do not switch providers or retry repeatedly; report the temporary pause and the returned retry time. If it returns `beta_access_paused`, say beta access is paused for that account and direct the user to support without sharing private account details.
3. List vehicles before the first vehicle operation with GET `https://teslr.club/api/vehicles`. Each result includes the user-defined vehicle name as private target-resolution context. Match a name the user supplied case-insensitively, treating ordinary possessives such as “Carla's” as “Carla,” then use the returned opaque id such as `vehicle-a0b1c2d3e4f506172839`. Never expose or ask for a VIN. The id is stable for the same token and vehicle. Relist immediately before every confirmation-required action.
4. If no vehicle name matches, more than one vehicle has the same name, or the target is otherwise ambiguous, ask which one without guessing. Do not infer a changing action from a status question.
5. Read concise current state with GET `https://teslr.club/api/vehicles/{safe-id}`.
6. Discover the live catalogs with GET `https://teslr.club/api/data`, GET `https://teslr.club/api/commands`, GET `https://teslr.club/api/mutations`, and GET `https://teslr.club/api/fleet`.
7. Read FSD/Autopilot totals and telemetry readiness with GET `https://teslr.club/api/vehicles/{safe-id}/stats`. Optional filters are `from`, `to`, `timezone`, `distance_format`, and `limit`.
8. Read specialized vehicle data with GET `https://teslr.club/api/vehicles/{safe-id}/data/{resource}`; read account data with GET `https://teslr.club/api/data/{resource}`. For nearest/nearby named destinations, GET `https://teslr.club/api/vehicles/{safe-id}/places?query={name}&limit=5`. Privately evaluate the returned candidates' names, categories, and distances against the user's wording. Choose the best semantic match and use distance only to break ties; do not blindly choose the first result. A place lookup may legitimately take up to 50 seconds while Teslr searches progressively and tries fixed fallbacks: start it once and wait for the completed response, never launch an overlapping retry, and run multiple destination searches sequentially. Only call a result nearest or closest when `nearestVerified` is `true`. When it is `false`, treat the list as incomplete best-effort candidates and do not route one merely because it is first.
9. For a command, POST JSON to `https://teslr.club/api/vehicles/{safe-id}/commands`: `{"command":"lock","confirm":false,"confirmedVehicleId":null,"parameters":{}}`.
10. For a confirmation-required command, mutation, or Fleet command, get explicit confirmation with a concise question naming the exact action and vehicle. Only after the user agrees, relist vehicles and send both `"confirm":true` and `"confirmedVehicleId":"{safe-id}"`.
11. Native mutations POST to `https://teslr.club/api/vehicles/{safe-id}/mutations`. Fleet reads use `https://teslr.club/api/vehicles/{safe-id}/fleet/{resource}` or `https://teslr.club/api/fleet/{resource}`; Fleet commands POST to `https://teslr.club/api/vehicles/{safe-id}/fleet-commands`. For confirmed named-destination routing, POST `{"query":"X","selectionId":"place-opaque","confirm":true,"confirmedVehicleId":"{safe-id}"}` to `https://teslr.club/api/vehicles/{safe-id}/navigation` using the chosen place result's unchanged `selectionId`. Teslr repeats the lookup and rejects altered, stale, wrong-vehicle, or wrong-token selections. List energy sites at `https://teslr.club/api/energy`, read them at `https://teslr.club/api/energy/{energy-id}/{resource}`, and POST confirmed settings changes to `https://teslr.club/api/energy/{energy-id}/actions`.
12. For broad vehicle reports, follow the efficient comprehensive-report workflow below instead of calling overlapping wrappers for the same live data.
13. Before every reply, apply the response-privacy rules below. Do not treat a broad request for everything known about the car as permission to reveal PII. Missing or inaccessible data means unavailable, never zero.

Use the following safe request pattern, changing only the method, path, JSON body, and the non-secret `requestedProvider` constant when a direct-only capability deliberately requires `"tesla"`. Keep secrets inside the Node process:

`node --input-type=module -e 'import{randomUUID}from"node:crypto";const path="/api/vehicles";const requestedProvider=undefined;const tessie=process.env.TESSIE_API_TOKEN;const direct=process.env.TESLR_FLEET_TOKEN;const provider=requestedProvider||(tessie?"tessie":"tesla");const token=provider==="tessie"?tessie:direct;if(!token)throw new Error("Connect Tesla at teslr.club or add a supported token in Bankr Env Vars.");const r=await fetch("https://teslr.club"+path,{headers:{authorization:"Bearer "+token,"x-teslr-provider":provider,"idempotency-key":randomUUID(),accept:"application/json"},cache:"no-store",redirect:"error",referrerPolicy:"no-referrer"});const body=await r.text();if(!r.ok){console.error(body);process.exit(1)}process.stdout.write(body)'`

## Free beta fair use

Direct Tesla Fleet access is free during the beta. There is no dollar balance, per-request Teslr price, refill, purchase, wallet, or token requirement. `$TSLR` is a separate entertainment memecoin with no service utility. Tessie-backed requests continue to use the user's own Tessie plan.

Teslr applies generous rolling safeguards to the stable Tesla account so reconnecting or refreshing a token cannot reset them. The safeguards distinguish Tesla Data requests, vehicle-changing commands, and actual wake requests from internal Teslr steps. They are abuse controls, not a balance for the assistant to display. Do not volunteer numeric limits or remaining usage in ordinary replies.

When Teslr returns a fair-use 429, respect `Retry-After`. Do not repeatedly retry, reconnect to evade it, or silently use another provider. Existing action confirmations still apply, and a timeout or uncertain real-world command result must be checked against vehicle state before any retry.

## Efficient comprehensive reports

For “tell me everything,” “tell me all you know,” or another broad vehicle report:

1. List vehicles once and resolve the requested scope before gathering the report. If the user supplies a vehicle name, use an unambiguous vehicle-list name match to select that target. If the user names one model or otherwise selects one vehicle, report only that verified target. Process every vehicle only when the user explicitly asks about all vehicles. When multiple vehicles remain ambiguous, ask which one instead of guessing. Refer to them as “Vehicle 1,” “Vehicle 2,” and so on unless the current request qualifies for the vehicle-name response rule below.
2. A direct Tesla vehicle list may not include the model. If needed, GET `https://teslr.club/api/vehicles/{safe-id}/fleet/vehicle-data` sequentially at most once per candidate until `vehicle_config.car_type` confirms the requested model; retain a matching response for the report and discard every non-target response. A user-supplied vehicle name may be resolved only through an unambiguous vehicle-list name match. Never infer identity from list order, availability, options, or another vehicle's data. Never combine fields from different vehicles into one vehicle report.
3. If a timeout or unavailable response prevents unambiguous target confirmation, stop and say that the requested vehicle could not be verified. Do not substitute the other vehicle or present uncertain metadata as belonging to the target.
4. For each confirmed target, GET `https://teslr.club/api/vehicles/{safe-id}/fleet/vehicle-data` once as the comprehensive live source unless that same response was already obtained during target confirmation. Use it to report every available non-PII fact about connectivity, model/configuration, battery, range, charging and limits, locks and closures, climate and temperatures, odometer, tire pressure, software, Sentry/security, and supported driver-assistance state.
5. Add non-overlapping metadata only for the confirmed target with one Fleet read each for `options`, `warranty-details`, `service-data`, `release-notes`, `fleet-status`, `mobile-enabled`, and `recent-alerts`. Attempt `specs` only when useful; after `tesla_partner_scope_unavailable`, skip it for every remaining confirmed target in that run.
6. Treat `vehicle_config.exterior_color` and `vehicle_config.wheel_type` from a successful `vehicle-data` response as the only authoritative paint and wheel sources. Report Tesla's returned value without inventing a marketing translation. If either field is absent, opaque, or unrecognized, say it is unavailable. Never infer paint or wheels from `options`, option codes, images, model defaults, or another vehicle.
7. When comprehensive `vehicle-data` succeeds, do **not** also call concise state, `stats`, `data/battery`, `data/tire-pressure`, or `data/status`; those repeat the same Tesla live-data request. Use `stats` only when the user explicitly asks for FSD/Autopilot totals, historical totals, or telemetry readiness beyond the comprehensive current payload.
8. Treat `tesla_vehicle_unavailable`, `tesla_timeout`, or another 504 as a completed availability failure, not a reason to increase the Bankr/client timeout. Do not retry the same live read or use overlapping wrappers in that report. If waking may help, explain that the vehicle did not respond and offer to wake it; wake only after the user agrees, then retry the confirmed target once after a successful wake.
9. Preserve coverage: summarize every useful non-PII field returned by these sources. Omit only PII, secrets, opaque/raw identifiers, unavailable/null fields, and redundant raw representations. Never call location, map, drivers, roles, invitations, saved places, or trip endpoints merely because the request is broad.

## Connection management

Use GET `https://teslr.club/api/tesla/connection` with `TESLR_FLEET_TOKEN` to check the direct connection privately. When the user asks to disconnect, revoke, or remove Teslr access, explain that revocation immediately invalidates their Teslr token and stops Teslr from using the stored Tesla authorization. Ask for explicit confirmation, then DELETE `https://teslr.club/api/tesla/connection` with `{"confirm":true,"acknowledge":"REVOKE_TESLA_CONNECTION"}`. After success, tell the user to delete `TESLR_FLEET_TOKEN` from Bankr Env Vars and optionally remove Teslr from their Tesla account's third-party app access.

Never revoke a connection while troubleshooting an ordinary provider error, never perform revocation in a public or uncertain context, and never ask the user to paste the token. For a Tessie compatibility connection, tell the user to remove `TESSIE_API_TOKEN` from Bankr and revoke or rotate it through Tessie; Teslr never stores that token.

## Read resources

Vehicle resources: `state`, `battery`, `battery-health`, `charges`, `consumption`, `drives`, `firmware-alerts`, `idles`, `last-idle-state`, `location`, `map`, `path`, `plate`, `states`, `status`, `tire-pressure`, `weather`, `telemetry-config`, `drivers`, `roles`, and `invitations`.

Account resources: `battery-health` and `charging-invoices`. Always use the live catalog for the allowed filters and privacy flag.

### Required natural-language mappings

- Tire pressure, TPMS, or "are my tires okay?" → GET `https://teslr.club/api/vehicles/{safe-id}/data/tire-pressure?pressure_format=psi`. Report all four readings and status. Add `from`/`to` when history is requested. Do not answer tire pressure from the concise state endpoint.
- Battery, charge, range, lock, climate, or software state → concise vehicle state first; use the matching specialized resource when the question asks for more detail.
- Drives, charging sessions, idles, states, paths, battery health, alerts, or telemetry → matching specialized resource.
- FSD or Autopilot totals → `stats`; use `drives` or `path` only when raw history is needed.
- Nearest/nearby place or named-destination navigation → use Teslr's `places` endpoint, privately choose the best returned candidate for the user's intent, then send its unchanged `selectionId` to the confirmed `navigation` endpoint. Teslr performs the place search; Tesla or Tessie supplies only the vehicle location and command transport. Never call Overpass, Nominatim, a geocoder, or a custom distance script directly. The server searches outward through fixed OpenStreetMap distance bands and returns candidates with geographic distance. Allow up to 50 seconds for each completed lookup, never overlap retries, and run multiple destination searches sequentially. Only describe a result as nearest/closest when `nearestVerified` is `true`; `false` means the fallback list may be incomplete. “Nearest” means straight-line geographic distance, not estimated driving time.

These HTTP resources do not expose Tesla's official current or longest intervention-free FSD streak counters. Report recorded totals and longest single-drive self-driving distance without calling them official streaks.

## Commands

The names below are the only accepted native command values. Some commands or seats are unsupported on particular vehicles; report the provider error without substituting another action. For a direct Tesla connection, prefer the Fleet command route below because it maps to Tesla's official command names.

- `wake` — Wake the vehicle from sleep.
- `lock` — Lock all vehicle doors.
- `unlock` — Unlock all vehicle doors. Exact-vehicle confirmation required.
- `front-trunk` — Open the front trunk. Exact-vehicle confirmation required.
- `rear-trunk` — Open, or toggle a powered, rear trunk. Exact-vehicle confirmation required.
- `open-tonneau` — Open a supported powered tonneau cover. Exact-vehicle confirmation required.
- `close-tonneau` — Close a supported powered tonneau cover.
- `vent-windows` — Vent all vehicle windows. Exact-vehicle confirmation required.
- `close-windows` — Close all vehicle windows when supported.
- `start-climate` — Start climate control and battery preconditioning.
- `stop-climate` — Stop climate control.
- `set-temperature` — Set cabin temperature from 15–28°C. Parameters: temperatureC (required, 15..28).
- `set-seat-heating` — Set a seat-heater level. Parameters: seat (required, one of front-left/front-right/rear-left/rear-center/rear-right/third-row-left/third-row-right/all); level (optional, 0..3).
- `set-seat-cooling` — Set a seat-cooling level on supported vehicles. Parameters: seat (required, one of front-left/front-right/rear-left/rear-center/rear-right/third-row-left/third-row-right/all); level (optional, 0..3).
- `start-defrost` — Start maximum windshield defrost.
- `stop-defrost` — Stop maximum windshield defrost.
- `start-steering-wheel-heater` — Turn on the steering-wheel heater.
- `stop-steering-wheel-heater` — Turn off the steering-wheel heater.
- `set-cabin-overheat-protection` — Enable or disable Cabin Overheat Protection. Parameters: on (required); fanOnly (optional).
- `set-cabin-overheat-protection-temperature` — Set the Cabin Overheat Protection activation temperature. Parameters: level (required, one of low/medium/high).
- `set-bioweapon-mode` — Enable or disable Bioweapon Defense Mode when supported. Parameters: on (required).
- `set-climate-keeper-mode` — Select off, Keep Climate On, Dog, or Camp mode. Parameters: mode (required, one of off/keep/dog/camp).
- `start-charging` — Start charging when a cable is connected.
- `stop-charging` — Stop the active charging session.
- `set-charge-limit` — Set the battery charge limit from 50–100%. Parameters: percent (required, 50..100).
- `set-charging-amps` — Set the vehicle charging current. Parameters: amps (required, 1..80).
- `open-charge-port` — Open or unlock the charge port.
- `close-charge-port` — Close the charge port door when supported.
- `flash` — Flash the exterior lights.
- `honk` — Honk the horn.
- `trigger-homelink` — Trigger the nearby HomeLink device. Exact-vehicle confirmation required.
- `enable-keyless-driving` — Temporarily authorize keyless driving. Exact-vehicle confirmation required.
- `vent-sunroof` — Vent the sunroof when supported. Exact-vehicle confirmation required.
- `close-sunroof` — Close the sunroof when supported.
- `enable-sentry` — Enable Sentry Mode.
- `disable-sentry` — Disable Sentry Mode. Exact-vehicle confirmation required.
- `enable-valet` — Enable Valet Mode. Exact-vehicle confirmation required.
- `disable-valet` — Disable Valet Mode. Exact-vehicle confirmation required.
- `enable-guest` — Enable Guest Mode. Exact-vehicle confirmation required.
- `disable-guest` — Disable Guest Mode. Exact-vehicle confirmation required.
- `enable-low-power` — Enable vehicle low-power mode.
- `disable-low-power` — Disable vehicle low-power mode.
- `enable-accessory-power` — Keep accessory power available when supported. Exact-vehicle confirmation required.
- `disable-accessory-power` — Stop keeping accessory power available.
- `schedule-software-update` — Schedule the available software update. Parameters: inSeconds (required, 0..604800). Exact-vehicle confirmation required.
- `cancel-software-update` — Cancel a scheduled software update. Exact-vehicle confirmation required.
- `set-scheduled-charging` — Configure the legacy scheduled-charging time. Parameters: enable (required); time (required, 0..1439). Exact-vehicle confirmation required.
- `set-scheduled-departure` — Configure legacy scheduled departure and preconditioning. Parameters: enable (required); departureTime (required, 0..1439); preconditioningEnabled (optional); preconditioningWeekdaysOnly (optional); offPeakChargingEnabled (optional); offPeakChargingWeekdaysOnly (optional); endOffPeakTime (optional, 0..1439). Exact-vehicle confirmation required.
- `add-charge-schedule` — Create or update a location-aware charging schedule. Parameters: daysOfWeek (required); enabled (required); startEnabled (required); endEnabled (required); oneTime (optional); id (optional, 0..any); startTime (optional, 0..1439); endTime (optional, 0..1439); latitude (required, -90..90); longitude (required, -180..180). Exact-vehicle confirmation required.
- `remove-charge-schedule` — Remove a charging schedule. Parameters: id (required, 0..any). Exact-vehicle confirmation required.
- `add-precondition-schedule` — Create or update a location-aware preconditioning schedule. Parameters: daysOfWeek (required); enabled (required); oneTime (optional); id (optional, 0..any); preconditionTime (required, 0..1439); latitude (required, -90..90); longitude (required, -180..180). Exact-vehicle confirmation required.
- `remove-precondition-schedule` — Remove a preconditioning schedule. Parameters: id (required, 0..any). Exact-vehicle confirmation required.
- `share` — Share a navigation destination or supported URL with the vehicle. Parameters: value (required); locale (optional). Exact-vehicle confirmation required.
- `boombox` — Trigger the vehicle Boombox when supported.
- `set-speed-limit` — Set the Speed Limit Mode maximum speed. Parameters: mph (required, 50..90). Exact-vehicle confirmation required.
- `enable-speed-limit` — Enable Speed Limit Mode. Parameters: pin (required, read securely from environment). Exact-vehicle confirmation required.
- `disable-speed-limit` — Disable Speed Limit Mode. Parameters: pin (required, read securely from environment). Exact-vehicle confirmation required.
- `clear-speed-limit-pin` — Clear the vehicle's Speed Limit Mode PIN. Parameters: pin (required, read securely from environment). Exact-vehicle confirmation required.

For Speed Limit Mode PIN commands, require `TESLA_SPEED_LIMIT_PIN` in Bankr Env Vars. Read it inside Node and put it in `parameters.pin`; never display it or place it in a CLI argument. Convert Fahrenheit temperatures to Celsius with `(F - 32) × 5/9`. Schedule times are whole minutes after local midnight.

## Native mutations

All mutations require explicit confirmation and the exact current vehicle id. POST `{"mutation":"set-license-plate","confirm":true,"confirmedVehicleId":"{safe-id}","parameters":{"plate":"ABC123"}}` to the mutation route. Use private reads to obtain drive, charge, driver, role, or invitation ids. Never invent ids.

- `set-drive-tag` — Apply or remove a tag on recorded drives. Exact-vehicle confirmation required.
- `set-charge-cost` — Set or remove the recorded cost of a charging session. Exact-vehicle confirmation required.
- `set-license-plate` — Set or remove Tessie’s stored license plate value. Exact-vehicle confirmation required.
- `delete-driver` — Remove an additional driver from the vehicle. Exact-vehicle confirmation required.
- `set-roles` — Assign a subscription or charging payer on a Tesla Business vehicle. Exact-vehicle confirmation required.
- `create-invitation` — Create a single-use driver invitation link. Exact-vehicle confirmation required.
- `revoke-invitation` — Revoke a pending driver invitation. Exact-vehicle confirmation required.
- `set-telemetry-config` — Apply Tessie’s recommended or an explicitly supplied Fleet Telemetry configuration. Exact-vehicle confirmation required.
- `delete-telemetry-config` — Delete Fleet Telemetry configuration, disabling telemetry-backed Tessie functionality. Exact-vehicle confirmation required.

Deleting telemetry additionally requires `"acknowledge":"DISABLE_FLEET_TELEMETRY"` and a warning that telemetry-backed features will stop. Direct Tesla connections support driver removal, invitation creation/revocation, telemetry-config deletion, and on-demand vehicle waking. Creating a direct Teslr telemetry configuration remains unavailable because Teslr intentionally does not run a continuous telemetry receiver. A newly created invitation link is private and single-use.

## Tesla Fleet API bridge

Vehicle reads: `drivers`, `invitations`, `fleet-status`, `fleet-telemetry-config`, `fleet-telemetry-errors`, `mobile-enabled`, `nearby-charging-sites`, `recent-alerts`, `release-notes`, `service-data`, `vehicle`, `vehicle-data`, `eligible-subscriptions`, `eligible-upgrades`, `enterprise-roles`, `options`, `specs`, `warranty-details`.

Account reads: `products`, `user-feature-config`, `user-me`, `user-orders`, `user-region`, `business-charging-history`, `charging-sessions`, `charging-invoice`, `vehicle-pricing`.

`user-me` and `user-feature-config` require the Profile Information grant and may require reconnecting at `https://teslr.club`. Only use `user-me` in a clearly private conversation after the user asks for profile/account details. `vehicle-pricing` requires `market`, `model`, and `language` query parameters and is served with Teslr's partner credentials; users do not add another environment variable. If Tesla returns `tesla_partner_scope_unavailable`, say that Tesla has not enabled that application-level partner feature yet; reconnecting the user's vehicle will not fix it. `charging-sessions` and `enterprise-roles` are available only to eligible Tesla Business accounts.

Energy reads: `backup-history`, `charge-history`, `energy-history`, `live-status`, `site-info`. Energy actions: `backup`, `grid-import-export`, `off-grid-vehicle-charging-reserve`, `operation`, `storm-mode`, `time-of-use-settings`. Every energy action requires explicit confirmation bound to the current opaque energy-site id.

Fleet commands: `actuate_trunk`, `add_charge_schedule`, `add_precondition_schedule`, `adjust_volume`, `auto_conditioning_start`, `auto_conditioning_stop`, `cancel_software_update`, `charge_max_range`, `charge_port_door_close`, `charge_port_door_open`, `charge_standard`, `charge_start`, `charge_stop`, `clear_pin_to_drive_admin`, `door_lock`, `door_unlock`, `erase_user_data`, `flash_lights`, `guest_mode`, `honk_horn`, `media_next_fav`, `media_next_track`, `media_prev_fav`, `media_prev_track`, `media_toggle_playback`, `media_volume_down`, `media_volume_up`, `navigation_gps_request`, `navigation_request`, `navigation_sc_request`, `navigation_waypoints_request`, `parental_controls_activate`, `parental_controls_clear_pin_admin`, `parental_controls_deactivate`, `parental_controls_enable_setting`, `parental_controls_set_speed_limit`, `remote_auto_seat_climate_request`, `remote_auto_steering_wheel_heat_climate_request`, `remote_boombox`, `remote_seat_cooler_request`, `remote_seat_heater_request`, `remote_start_drive`, `remote_steering_wheel_heat_level_request`, `remote_steering_wheel_heater_request`, `remove_charge_schedule`, `remove_precondition_schedule`, `reset_pin_to_drive_pin`, `reset_valet_pin`, `schedule_software_update`, `set_bioweapon_mode`, `set_cabin_overheat_protection`, `set_charge_limit`, `set_charging_amps`, `set_climate_keeper_mode`, `set_cop_temp`, `set_pin_to_drive`, `set_preconditioning_max`, `set_scheduled_charging`, `set_scheduled_departure`, `set_sentry_mode`, `set_temps`, `set_valet_mode`, `set_vehicle_name`, `speed_limit_activate`, `speed_limit_clear_pin`, `speed_limit_clear_pin_admin`, `speed_limit_deactivate`, `speed_limit_set_limit`, `sun_roof_control`, `trigger_homelink`, `upcoming_calendar_entries`, `window_control`.

Every Fleet command requires explicit confirmation. Send `{"command":"media_toggle_playback","confirm":true,"confirmedVehicleId":"{safe-id}","parameters":{}}` to the Fleet command route. Use the exact Tesla JSON body documented for that command; do not guess parameter names. Keep PINs and other secrets in a Bankr Env Var and read them inside the Node process, never from a CLI argument. Prefer a native Teslr command when both catalogs cover the operation because native commands validate parameters more strictly. Teslr accepts every command in Tesla's live Fleet catalog. Some commands remain vehicle-, firmware-, or account-specific; preserve Tesla's capability error and never substitute a different action.

Direct vehicle commands require the Teslr virtual key to be paired with that vehicle in the Tesla app. Teslr checks key pairing before signed commands and wakes an asleep vehicle once when needed. If the API returns `tesla_virtual_key_not_paired`, tell the user to open `https://tesla.com/_ak/teslr.club` on the phone with their Tesla app and approve Teslr for the intended vehicle; never include or request a VIN. For `tesla_command_scope_required` or `tesla_scope_required`, tell the user to reconnect at `https://teslr.club` and approve the requested access. For `tesla_location_scope_required`, tell the user to reconnect at `https://teslr.club` and approve Vehicle Location; never infer or reveal any location while reporting the error. For `tesla_command_proxy_unavailable`, report a temporary Teslr service issue. If a command times out, say it may have completed, read the resulting state, and do not blindly retry actions such as horn, media next/previous, closures, or navigation. Do not collapse specific errors into a generic permission failure or silently retry through another provider. Teslr does not expose Summon/movement or live camera streaming. Teslr reads current data on demand and does not run a continuous Fleet Telemetry receiver.

## Response privacy

Default to data minimization in every conversation, including a clearly private one. Treat X, every public timeline, shared or group conversations, and any context whose privacy is uncertain as public.

- Never include PII or precise location data in a response until the user gives clear affirmative authorization for that specific detail or category in the current clearly private conversation. This includes personal or shared-driver names, email, phone, plate, saved-location labels, addresses, coordinates, maps, exact store branches, trip endpoints, detailed trip/charge records, and identifying account or vehicle data, subject only to the narrow vehicle-name rule below.
- A broad request such as “tell me everything,” “tell me all you know about my car,” “get all the information you can,” or a general vehicle-status request is **not** explicit permission to reveal PII, names, or precise location. Keep those fields out of the response.
- Teslr includes the authenticated vehicle's user-defined name in vehicle responses so it can be used internally to resolve the target. Include a vehicle name in your reply only when the user explicitly asks for that vehicle's name or the user used the name to identify the target in the current request. Possessive use counts, and the permission continues only through any confirmation and completion of that same request. Otherwise say “your vehicle” or use a neutral label such as “Vehicle 1.” Do not require a separate PII confirmation for this narrow vehicle-name use, and do not treat it as permission to reveal any other personal or vehicle data.
- When location context helps but exact location was not explicitly requested, use only a non-identifying relative description, such as “the Safeway about half a mile from your vehicle.” Do not include its address, cross streets, neighborhood, city, coordinates, map, exact branch, route endpoints, Home/Work label, or other clues that reconstruct the location.
- Do not volunteer a person's name. Say “a shared driver,” “the primary user,” or give a count instead. Reveal a requested name only under the private, explicit-request exception below.
- Treat a question or request for sensitive data as intent, not yet as authorization. Before revealing anything, ask for a PII-specific confirmation without including the data, such as: “That would reveal your precise vehicle location in this private chat. Reply ‘Yes, show my precise vehicle location’ to continue.” Use the equivalent named confirmation for addresses, plates, personal names, shared-driver names, trip details, or other PII.
- Reveal PII only after the user replies with an unambiguous affirmation that names the same sensitive detail or category, such as “Yes, show my precise vehicle location” or “Yes, list the shared drivers' names.” A bare “yes,” a prior request, an action confirmation, or consent for a different PII category is insufficient.
- Teslr redacts person names, contact fields, and precise location fields at the API response boundary by default. Only after that valid private confirmation, add `"x-teslr-include-personal-data":"true"` to the single read needed for the affirmed detail. Never add the header preemptively, for a broad report, or in a public/shared/uncertain context.
- After valid confirmation in a clearly private conversation, reveal only the minimum PII expressly affirmed. Authorization is single-use for the next response, does not authorize other PII, and does not carry forward.
- In public, shared, group, or uncertain contexts, never output any exact or vague vehicle-location information or PII, even when explicitly requested, except for the narrow vehicle-name rule above. Ask the user to continue in a clearly private conversation for every other protected detail; do not hint at or partially reveal the answer.
- Use private data internally when required to complete an authorized operation. Without an explicit private request for the detail, keep the response non-identifying, such as “Done — the route was sent,” “Your vehicle is secure,” or “I found a nearby match.”
- Never output secrets—including tokens, PINs, idempotency keys, or private account linkage—under any circumstances. The explicit-request exception does not apply to secrets.
