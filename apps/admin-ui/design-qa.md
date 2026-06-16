# Design QA

source visual truth path: `/Users/laijunwei/.codex/generated_images/019ec536-039e-7ba1-b79e-90fb30f84d99/ig_082382a466f9ddcc016a300c988ecc8198940e5fcf4b255e6f.png`

implementation screenshot path: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/admin-ui-1536x1024.png`

viewport: `1536 x 1024`

state: Access Nodes management page, selected row `access-hk-relay-01`, right inspector open.

full-view comparison evidence: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/design-comparison-source-vs-implementation.png`

focused region comparison evidence: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/design-comparison-focused.png`

## Findings

No actionable P0/P1/P2 issues remain.

- Fonts and typography: implementation uses a system enterprise sans stack with Chinese fallbacks. Weight, size, hierarchy, and line height are close to the source. The implementation is slightly crisper than the generated source image, which is acceptable for a real web UI.
- Spacing and layout rhythm: dark sidebar, top status bar, page header, toolbar, resource table, selected row, pagination, and right inspector match the source composition. The implementation uses slightly more conservative table column sizing so it remains usable at 1440-1536 px widths.
- Colors and visual tokens: navy sidebar, white surfaces, pale blue selected row, blue primary actions, amber pending state, and green status dots match the approved Cloud Ops Console direction.
- Image quality and asset fidelity: the source design has no photographic or illustrative assets. Icons are implemented with Tabler Icons rather than custom SVG or placeholder drawings.
- Copy and content: visible page copy, resource names, technical identifiers, status labels, and config preview match the intended Access Nodes management screen.

## Open Questions

- None for this implementation pass.

## Implementation Checklist

- App Shell implemented with dark sidebar and top status bar.
- Access Nodes page implemented with toolbar filters, segmented control, resource table, selected row, pagination, and right inspector.
- Create Relay Access Node drawer implemented with stepper, form controls, preview, and footer actions.
- Interactions verified: open drawer, close drawer, segment filter, search filter, and row selection.
- Build verified with `npm run build`.

## Follow-up Polish

- P3: future iteration can add real backend API binding and loading/empty/error states.
- P3: future iteration can add keyboard shortcuts and advanced filter popover contents.

## Responsive QA

Responsive screenshots:

- Desktop: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/responsive/desktop-1536x1024-final.png`
- Compact desktop / zoom equivalent: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/responsive/compact-1024x900-final.png`
- Tablet: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/responsive/tablet-768x1024-final.png`
- Mobile: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/responsive/mobile-390x844-final.png`

Responsive behavior:

- `1536px`: full cloud-console layout with left sidebar, table, and right inspector.
- `1024px`: compact sidebar, table remains readable, inspector moves below the table.
- `768px`: mobile horizontal navigation appears, table stays available with local horizontal scroll inside the table surface.
- `390px`: table turns into resource cards with field labels, actions stack vertically, drawer becomes full-width.

Overflow check:

- `1536px`: `documentElement.scrollWidth === clientWidth`
- `1024px`: `documentElement.scrollWidth === clientWidth`
- `768px`: `documentElement.scrollWidth === clientWidth`
- `390px`: `documentElement.scrollWidth === clientWidth`

patches made since previous QA pass:

- Reduced sidebar and inspector widths to improve table fit.
- Tightened toolbar columns and table column widths.
- Restored quick actions to one row.
- Captured matched 1536 x 1024 implementation screenshot for final comparison.
- Added responsive behavior for desktop, compact desktop, tablet, and mobile viewports.
- Added mobile horizontal navigation.
- Converted the resource table into labeled resource cards at narrow widths.
- Kept the inspector visible by moving it below the table at compact widths.
- Fixed mobile topbar overflow so the page has no horizontal document scroll at 390px.

final result: passed

## Resource Template QA

Goal:

- Turn the approved Access Nodes screen into a reusable resource-management template.
- Verify that a second page can reuse the same layout, table behavior, inspector shell, toolbar, and responsive rules.

Implemented template pieces:

- `ResourcePage`: shared page structure for header actions, toolbar, table, pagination, and inspector.
- `ResourceToolbar`: shared search, segmented state, and select filters.
- `ResourceTable`: shared grouped table with responsive card mode below `720px`.
- `InspectorShell`, `KeyValueSection`, `QuickActions`, `ConfigPreview`: shared right-side detail surface.

Verified pages:

- Access Nodes: direct / relay access-node management, quick relay drawer, access-node inspector.
- Users: user list, plan/status filters, credential and subscription inspector.

Template screenshots:

- Access Nodes desktop: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/templates/access-desktop-1536x1024.png`
- Access Nodes mobile: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/templates/access-mobile-390x844.png`
- Users desktop: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/templates/users-desktop-1536x1024.png`
- Users compact desktop: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/templates/users-compact-1024x900.png`
- Users mobile: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/templates/users-mobile-390x844.png`

Interaction checks:

- Sidebar navigation switches from Access Nodes to Users and updates active state.
- Mobile navigation remains visible below `860px`.
- Both pages keep `documentElement.scrollWidth === clientWidth` at `390px` and `1024px`.
- Access Nodes mobile uses card mode with 7 rows.
- Users mobile uses card mode with 4 rows.
- Users compact desktop keeps table mode and moves the inspector below the table.

Notes:

- Browser text input automation was blocked by the local virtual clipboard dependency, so this pass focused on navigation, responsive structure, DOM state, and build/test verification.
- The selected inspector item now follows the current filtered row set, so filters do not leave the detail panel pointing at a hidden row.

Command verification:

- `npm test`: passed, 14 tests.
- `npm run build:admin`: passed.
- Local preview `http://127.0.0.1:5173/`: loaded Access Nodes page, 7 rows, inspector `access-hk-relay-01`, `documentElement.scrollWidth === clientWidth` at reset viewport.

result: passed

## All Admin UI QA

Goal:

- Complete every Backend Admin UI entry in the current information architecture.
- Keep the approved cloud-console visual direction.
- Verify that each navigation target renders real UI instead of placeholder content.

Implemented navigation entries:

- 总览
- 用户
- 套餐
- 访问节点
- 代理节点
- 协议入站
- 中转服务器
- 转发规则
- 前端入口
- 订阅入口
- 订阅策略
- 配置发布
- Agent
- 健康检查
- 告警
- 流量统计
- 域名证书
- 审计日志
- 备份恢复
- 系统设置

Implementation notes:

- Resource management pages use the shared `ResourceRoute` / `ResourcePage` / `ResourceTable` / `GenericInspector` template.
- Overview and Settings use dedicated layouts but share the same buttons, status dots, panels, typography, spacing, and responsive rules.
- Sidebar navigation now supports the full page set with vertical scrolling.
- Mobile navigation remains horizontal and all resource tables switch to card mode at narrow widths.

Screenshots:

- Overview desktop: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/all-ui/overview-desktop-1536x1024.png`
- Access Nodes desktop: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/all-ui/access-desktop-1536x1024.png`
- Access Nodes mobile: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/all-ui/access-mobile-390x844.png`
- Settings mobile: `/Users/laijunwei/Documents/kato/apps/admin-ui/qa/all-ui/settings-mobile-390x844.png`

Desktop navigation check:

- Viewport: `1280px`
- Pages checked: 20 / 20
- Placeholder panels: 0
- Every page title matched the active navigation item.
- Every resource page rendered rows.
- `documentElement.scrollWidth === clientWidth` for every page.

Mobile navigation check:

- Viewport: `390 x 844`
- Pages checked: 20 / 20
- Mobile nav display: `flex`
- Placeholder panels: 0
- Every page title matched the active mobile navigation item.
- Every resource page rendered card-mode rows with `.resource-table { display: block }`.
- `documentElement.scrollWidth === clientWidth` for every page.

Command verification:

- `npm test`: passed, 14 tests.
- `npm run build:admin`: passed after all UI changes.
- Local preview `http://127.0.0.1:5173/`: verified with Browser on desktop and mobile widths.

result: passed
