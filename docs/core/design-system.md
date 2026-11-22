# Hatchlane design system

**First release · Responsive web application · Simulated equipment**

At the desk, a reviewer can point to a manhole on a drawing and open its work record. At the opening, an attendant can glance at a phone, read the names of the people inside and record the next exit. Design each screen around the thing the person is working on. The product plan defines permissions, evidence requirements and lifecycle. The architecture defines the server's sources of state and validity. [Product plan](product-plan.md) · [Architecture](architecture.md)

## Screen composition

Give each task one continuous work surface. A drawing needs room to pan. A queue needs rows that line up. A permit needs a readable sequence of fields, decisions and signatures. Adjacent information that describes the same job shares a heading and background. Use whitespace to group related items, and a divider where one record ends and another begins. Reserve raised surfaces for temporary menus and dialogs.

Hatchlane’s recurring visual detail is the **printed asset ID beside the two named access layers**. Set the ID large enough to compare with the physical label. Show the outer solid cover above the inner protective guard in equipment summaries, release and commissioning. Use the order of the physical checks in closeout, inner guard first. On the attendant’s screen, move the roster above the equipment details.

| Workspace | First thing in view | Arrangement |
|---|---|---|
| Sign-in and account setup | Named email and password, or the required password change | Return to the requested workspace after authentication and authorization. Site Admins manage member access and duty eligibility from Site Explorer. |
| Site Explorer | The site drawing, its revision and page | A searchable asset index beside the drawing. Selecting a row or pin opens the same asset detail. On wide screens the detail sits beside the drawing. |
| My permits | Jobs awaiting the signed-in person | A list with asset, permit number, reason for attention, owner and time window. Selecting a row returns to the relevant task. Completed permits remain searchable. |
| Review queue | The submitted work and the decision due | Site Admins open **Review queue** in My permits. Show **Awaiting review** as the permit state. Read scope, time window, team, controls and evidence down one column. Place the decision and its reason after the submitted information. |
| Field permit | The asset, permit and the task owned by this person | One column. An operator sees preparation or evidence entry, a supervisor sees the evidence awaiting a decision, and an attendant sees the roster. All three share the same job history. |
| Simulator | The selected asset, permit, layer and pending request | The facilitator opens **Simulator** from Site Explorer. Keep request decisions, the four independent signal controls, faults and connection state separately labelled. |
| Commissioning | The identified asset and the part being assigned | Start from Explorer. Show the gateway or named layer before scanning a device. Keep each serial beside its assignment and observed feedback through acceptance. |

Desktop navigation has two destinations, **Site Explorer** and **My permits**, with the site name always in view. Put site setup in Explorer and **Review queue** within My permits for Site Admins. On a phone, expose **Scan asset** beside **Enter asset ID** at lookup. Preview the resolved site and asset ID before field confirmation. For an unknown label, different site or device code, explain the result and keep typed ID lookup available. Camera refusal, a damaged label or an unconfirmed drawing pin must leave ID lookup usable. Check permission on saved links and present a link back to the workspace if access has changed.

## The asset detail

Use one heading for the asset and a small table for the layer observations. Align comparable values vertically. Put the owning person and next action on their own line directly below the facts they depend on. This example shows the moment after local acknowledgement, while the outer bolt still reports engaged.

```text
MH-001                                North works
Permit P-014                          Simulation

                       Position       Bolt
Outer solid cover      Closed         Engaged
Inner protective guard Closed         Engaged

Outer release request acknowledged locally at 09:41.
Awaiting outer bolt feedback.
Next action · Simulator facilitator publishes fresh feedback.
```

On an actual screen each observation carries its own source and site time. Keep the example’s two rows on a wide inspector. On a narrow phone, stack the two named layers and repeat the field labels beside their values. A reading can go stale independently of its neighbour. For example, show **Outer bolt · Unknown** with **Last observed engaged at 09:40** beneath it. Keep the current cover observation visible.

Use one labelled marker per asset. An opaque light backing and dark outline keep the ID legible over drawing lines. Selection adds a blue outline and highlights the matching index row. A separate warning symbol and text describe a fault. If MH-002 develops a fault while MH-001 is selected, keep MH-001 open and show **MH-002 · Outer bolt feedback lost** in the index. On a narrow screen, provide the same link above the drawing. Preserve selection and drawing position when returning from detail. Show the drawing revision and page beside its view controls. When a new revision needs pin confirmation, keep the old marker on its original revision and show **Pin awaiting confirmation** in the asset list. The list and typed ID remain available if the PDF cannot load.

## Visual foundations

Use a light canvas with white working surfaces. Let the drawing retain its source colors. Keep the Hatchlane wordmark small in navigation. The asset ID or task title is the largest text in the working area.

| Token | Value | Use |
|---|---|---|
| Canvas / surface | `#F2F4F5` / `#FFFFFF` | Site workspace behind the drawing / permits, lists and inputs |
| Ink / secondary ink | `#17263A` / `#485969` | Titles, values and names / labels, sources and time |
| Divider / control edge | `#D5DCE0` / `#74818C` | Row separation / input and interactive boundaries |
| Action / selection surface | `#244EB5` / `#EAF0FF` | White text on a filled primary button, links and focus rings / selected row with dark text |
| Attention ink / surface | `#704600` / `#FFF3D6` | Missing prerequisite, conflicting evidence or stale reading with a named recovery action |
| Critical ink / surface | `#922C28` / `#FCEBE8` | Active alarm, stopped work or authorization invalidated during work |

Keep normal observed positions in ink. A verified event can use a small check next to its specific description, such as **Inner bolt engagement observed**. Use a clock and time for waiting, a warning triangle and words for attention, and a stop symbol with the reason for stopped work. Never assign the entire asset a safety color. Links inside prose are underlined. Focus uses a 2 px action-colored outline with a 2 px light gap, visible on selected rows and filled buttons.

Use locally available **Geist Sans**, with system sans-serif as fallback. Use tabular figures for times and measurements. Reserve monospace for device serials a technician must compare character by character. Names, actions and asset IDs use the main family. Keep the whole name and the units readable at all widths.

| Type role | Size / line height | Weight |
|---|---|---|
| Asset ID or task title | 28 / 34 px | 650 |
| Section or roster heading | 20 / 26 px | 600 |
| Form value, name, action, field body | 16 / 24 px | 400 for prose, 600 for actions |
| Desk row or field label | 14 / 20 px | 400 or 550 |
| Supporting timestamp or source | 13 / 18 px | 400 |

Use 4 px between a label and its value, 8 px within a field group, 16 px between rows of controls and 24 px between sections. Start with 24 px page insets on a desk and 16 px on a phone. Set fields and buttons to a 6 px radius. Give a form about 64 characters of line length. Left-align labels and prose, right-align comparable measurements, and keep units beside values.

At 1200 px and up, allow a 240 px asset index and a 320 px inspector beside the drawing. From 768 to 1199 px, show detail in place of the index or in a dismissible side sheet. Below 768 px, default to the searchable list and open detail as a page. Keep the drawing available on demand. At 320 px or 200% text zoom, switch to stacked labelled values wherever a row stops fitting. Only the drawing itself needs two-dimensional panning.

## Interaction patterns

**Accounts and access.** Allow password autofill and paste. Sign-in errors use a generic message when credentials are invalid. Show the required password change before opening protected screens. Use a named confirmation for reset or disable, and confirm the outcome to the Site Admin without exposing the temporary credential in history. Keep the requested destination through reauthentication and verify access before showing the record again.

**Permit decisions.** Give each field a visible label. At submission, list missing requirements at the top and link each to the field with its specific error. Preserve entered values. Show **Save draft** separately from **Submit for review** and report the last confirmed save time. Review offers **Approve work request**, **Return for changes** and **Decline request**. Show the returned reason where the operator resumes editing. A reservation conflict shows the permit number and links to the permit for authorized readers. Use the lifecycle names in the product plan. **Approved** holds a reservation, **Active** means field work started, and the entry supervisor's decision stays visible separately. Show the next action and its owner. For a future window, show the start in site time.

**Requesting release.** Label the action **Request outer-lock release** or **Request inner-guard release**. The confirmation includes asset, permit, target and reason. After submitting, keep the pending request in place and show its outcome there. Repeated taps resolve to that request. A local acknowledgement changes the request line only. A denial or timeout shows the reason and the condition for a fresh attempt. Show **Simulation** on equipment and permit views and on each simulator-generated decision or observation, including in history. On the Simulator screen, keep the named asset and target visible through confirmation or denial, and give each bolt and position its own observation action.

**Evidence and authorization.** Put each gas value beside its unit, sample time, location or depth and source. Keep tester, instrument, calibration and bump-check status available within the same reading. Keep observed ventilation periods and interruptions in a separate list. The supervisor can inspect the evidence supporting the decision and see which item is missing, invalid or expired. An invalidated decision displays its reason at the top of the active job. New planned entries and releases are blocked. Keep the stop reason, local emergency contact, roster and exit actions accessible.

**Attendance.** Lead with **Currently inside (2)** followed by two named rows, each with entry time and **Record exit**. The accessible button name includes the person. Place eligible roster members below under **Available for entry** and show the reason when planned entry is held. Keep **Record observed movement** accessible during a hold or closeout and distinct from planned entry. Display discrepancies with event time, recording time and author until reconciliation. On expiry, preserve the names and exit actions in place.

**Stop and recovery.** Keep **Stop work** reachable beside the roster for the attendant and in the job header for the assigned operator and supervisor. Separate it visually from routine actions. Collect a reason with the action and keep it visible on the stopped job. Show **Withdraw approval** to the Site Admin and **Cancel unused permit** to the eligible users, with the specific cancellation blocker if closeout is required. Where a role holder is unavailable, the Site Admin sees the original assignment and records the eligible replacement and reason. The replacement lands on their recovery task.

**Closeout.** Show the named attendant’s all-out confirmation, then inner guard position and bolt, then outer cover position and bolt, operator closeout checks and the supervisor’s signature. For a missing observation, show a concrete reason such as **Awaiting fresh outer-bolt feedback**. An observed entry during closeout clears the all-out confirmation and returns attention to the roster. A stopped, accounted-for job with a failed sensor links the Site Admin to replacement and recommissioning. Keep the reservation visible until closeout completes.

**Commissioning.** Show the selected assignment, current serial and prior serial on replacement. For a serial already in use, keep the input and explain that the serial is assigned. Accepting a replacement waits for fresh feedback. On drawing replacement, show revision and page on placement controls and require an explicit pin confirmation. Keep the photo and GPS capture optional and preserve its accuracy and capture time when supplied.

**History and connectivity.** Use a chronological list with site time, event, actor or equipment source and permit. Include an offset where local times repeat and distinguish observation time from recording time. Show corrections beside their originals. A report arriving after closure appears in history and shows any unresolved restriction on the asset. On connection loss, keep last contact, last confirmed save and unsaved edits distinct. Present actions that require connection as unavailable. On reconnect, reload current state and resolve an uncertain write by operation ID before prompting for a new action. Open the roster for reconciliation where needed.

## Accessibility and release checks

Use WCAG 2.2 AA as the release target. Use native buttons, labelled fields and real headings. Make drawing selection, page controls, pan, zoom and pin placement operable by keyboard. Keep focus visible and unobscured. Modal dialogs contain focus and return it to the invoking control on dismissal. Announce meaningful changes such as a recorded exit or invalidated authorization once, leaving focus and scroll position with the user. Routine telemetry refreshes quietly. Use field targets at least 48 px high, separate adjacent actions and support reduced motion. Require at least 4.5:1 text contrast and 3:1 for essential controls and graphics on their rendered backgrounds. Use the pale divider only for decoration. Test keyboard and screen-reader navigation on the desk and field paths. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

Test design decisions at the same point as their functionality.

| Product slice | Screen-level acceptance |
|---|---|
| 1 · Find and review | Change a temporary password, open a saved permit link, and locate MH-001 by ID on a phone. Return a draft for correction on desktop. On reopening, both people can identify the asset, decision, reason and next owner. |
| 2 · Outer access | A local acknowledgement leaves both observed positions intact. End a pending request by stopping the job, and confirm the reason remains visible. A fault on MH-002 is discoverable while viewing MH-001. The warning is understandable in grayscale. |
| 3 · Authorization and attendance | With two people inside, expire required evidence. From the attendant’s phone, identify both people, the stop reason and each exit action without opening history. |
| 4 · Closeout and recovery | With the roster empty and one stale bolt observation, identify exactly what prevents closure. Hand off a recovery duty and record an unexpected entry. Verify the affected attendant sees reconciliation due and the late report remains visible in history. |
| 5 · Commissioning | With camera and location permissions denied, assign a device by serial. Verify the named layer, signal source and both observed positions before acceptance. Find the resulting asset through the list and its confirmed drawing pin. |
