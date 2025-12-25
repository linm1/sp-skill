# Sprint 1 Development Plan - StatPatternHub Phase 2

## Sprint Goal

**Replace localStorage with Vercel Postgres backend, seed 20-30 IMP/DER patterns, integrate Clerk authentication, and deliver a working full-stack pattern management system with admin approval workflow.**

---

## User Stories

### Story 1: Pattern Data Seeding
**Priority**: High
**Effort**: Medium
**As a** system administrator
**I want** 20-30 pre-populated IMP and DER patterns in the database
**So that** users have real content to browse and interact with from day one

**Acceptance Criteria:**
- Given the database is empty
- When I run the seed script
- Then 15 IMP patterns and 15 DER patterns are created in `pattern_definitions`
- And each pattern has at least one "System" implementation in `pattern_implementations`
- And all patterns include realistic SAS/R code, considerations, and variations

**Dependencies:** None (database already migrated)

---

### Story 2: Pattern Catalog API (Read Operations)
**Priority**: High
**Effort**: Small
**As a** frontend developer
**I want** GET endpoints to retrieve pattern data
**So that** I can replace localStorage with real database queries

**Acceptance Criteria:**
- Given patterns exist in the database
- When I call `GET /api/patterns`
- Then I receive all pattern definitions with their active implementations
- And I can filter by category using `?category=IMP`
- And I can retrieve a single pattern with `GET /api/patterns/:id`
- And each pattern includes implementation count and author information

**Dependencies:** Story 1 (seed data)

---

### Story 3: Clerk Authentication Integration
**Priority**: High
**Effort**: Large
**As a** user
**I want** to sign up and log in using Clerk
**So that** I can contribute patterns and build my skill basket with a persistent identity

**Acceptance Criteria:**
- Given I am a new user
- When I click "Sign Up" in the navigation
- Then Clerk's sign-up modal appears
- And after successful registration, I am logged in
- And my user profile is created in the `users` table with role="contributor"
- And I can see my name in the navigation bar
- And I can log out and log back in

**Dependencies:** None (can work in parallel with Story 2)

---

### Story 4: User Contribution Submission
**Priority**: High
**Effort**: Medium
**As a** authenticated contributor
**I want** to submit alternative pattern implementations
**So that** I can share my own SAS/R code approaches with the community

**Acceptance Criteria:**
- Given I am logged in as a contributor
- When I view a pattern detail page
- Then I see a "Contribute Alternative" button
- And when I click it, the SmartEtlForm opens
- And after filling the form and submitting
- Then a POST request creates a new implementation with status="pending"
- And my author_id is linked to my user record
- And I see a success message: "Your contribution is pending admin approval"

**Dependencies:** Story 2 (pattern API), Story 3 (Clerk auth)

---

### Story 5: Admin Approval Workflow
**Priority**: Medium
**Effort**: Medium
**As an** admin user
**I want** to review and approve/reject pending contributions
**So that** I can maintain quality control over published patterns

**Acceptance Criteria:**
- Given I am logged in as admin (role="admin")
- When I navigate to `/admin/pending` (new route)
- Then I see all implementations with status="pending"
- And for each, I can click "Approve" or "Reject"
- And when I approve, the status changes to "active" and appears in catalog
- And when I reject, the status changes to "rejected" and author is notified (UI message)

**Dependencies:** Story 3 (Clerk auth), Story 4 (submission API)

---

### Story 6: Frontend Integration - Catalog View
**Priority**: High
**Effort**: Medium
**As a** frontend developer
**I want** to replace localStorage calls with API calls in the Catalog component
**So that** users see real database content

**Acceptance Criteria:**
- Given the frontend loads
- When the Catalog component mounts
- Then it fetches patterns from `GET /api/patterns`
- And displays them in the existing grid layout
- And category filtering works with query parameters
- And search functionality queries the API (not client-side filter)
- And loading states are shown during API calls

**Dependencies:** Story 2 (pattern API)

---

### Story 7: Frontend Integration - Pattern Detail & Basket
**Priority**: Medium
**Effort**: Medium
**As a** user
**I want** my skill basket selections persisted to the database
**So that** I don't lose my curated patterns when I refresh the page

**Acceptance Criteria:**
- Given I am logged in
- When I add a pattern to my basket
- Then a POST request saves it to a `user_baskets` table (or user preferences JSON column)
- And when I refresh the page, my basket is restored from the database
- And when I export, the ZIP contains my selected implementations

**Dependencies:** Story 3 (Clerk auth), Story 6 (frontend integration)

---

### Story 8: Implementation Edit/Update
**Priority**: Low
**Effort**: Small
**As a** contributor
**I want** to edit my own pending or active implementations
**So that** I can fix mistakes or improve my contributions

**Acceptance Criteria:**
- Given I authored an implementation
- When I view it in pattern detail
- Then I see an "Edit" button (if I'm the author or admin)
- And when I submit changes, it updates via `PUT /api/implementations/:uuid`
- And if it was "active", it returns to "pending" status for re-approval
- And admins can edit any implementation without triggering re-approval

**Dependencies:** Story 4 (submission flow)

---

## Implementation Timeline (1-Week Sprint)

### Day 1: Backend Foundation - Seed Data + Read Endpoints
**Focus:** Get data into the database and expose it via API

**Morning (3-4 hours):**
- [ ] Create `/api/seed.ts` endpoint with 30 realistic IMP/DER patterns
- [ ] Write seed data with proper SAS/R code samples
- [ ] Test seed endpoint locally
- [ ] Verify data in Neon console

**Afternoon (3-4 hours):**
- [ ] Create `/api/patterns/index.ts` (GET all patterns)
- [ ] Create `/api/patterns/[id].ts` (GET single pattern)
- [ ] Add category filtering logic
- [ ] Test endpoints with curl/Postman
- [ ] Document request/response schemas

**End of Day Checkpoint:**
✅ 30 patterns seeded in database
✅ GET /api/patterns returns all patterns
✅ GET /api/patterns/IMP-001 returns pattern with implementations

---

### Day 2: Clerk Authentication Setup
**Focus:** Get Clerk working end-to-end

**Morning (3-4 hours):**
- [ ] Create Clerk account and application
- [ ] Install `@clerk/clerk-react` and `@clerk/backend`
- [ ] Add CLERK environment variables to `.env.local`
- [ ] Wrap App in `<ClerkProvider>`
- [ ] Add `<SignInButton>` and `<UserButton>` to Layout
- [ ] Test sign-up/sign-in flow in browser

**Afternoon (3-4 hours):**
- [ ] Create `/api/auth/me.ts` endpoint to get current user
- [ ] Implement just-in-time user provisioning (create DB user on first API call)
- [ ] Create helper function: `getAuthenticatedUser(req)` for API endpoints
- [ ] Test: Sign up → verify user created in database
- [ ] Test: Role assignment (new users default to "contributor")

**End of Day Checkpoint:**
✅ Users can sign up and log in
✅ User data synced to database
✅ API can authenticate requests with Clerk token

---

### Day 3: Backend - Write Endpoints (POST/PUT/PATCH)
**Focus:** Enable contributions and admin actions

**Morning (3-4 hours):**
- [ ] Create `/api/implementations/index.ts` (POST - create implementation)
- [ ] Add authentication middleware
- [ ] Validate pattern_id exists before insert
- [ ] Set status="pending" for new contributions
- [ ] Test: Submit contribution as contributor

**Afternoon (3-4 hours):**
- [ ] Create `/api/implementations/[uuid].ts` (PUT - update)
- [ ] Add authorization check (author or admin)
- [ ] Handle status logic (active → pending if not admin)
- [ ] Create `/api/implementations/[uuid]/status.ts` (PATCH - admin approve/reject)
- [ ] Add admin role check
- [ ] Test approval/rejection flow

**End of Day Checkpoint:**
✅ Contributors can submit new implementations
✅ Authors can edit their implementations
✅ Admins can approve/reject contributions

---

### Day 4: Frontend Integration - Catalog & Detail
**Focus:** Replace localStorage with API calls

**Morning (3-4 hours):**
- [ ] Update App component to fetch from `/api/patterns` on mount
- [ ] Add loading states and error handling
- [ ] Remove `INITIAL_DEFS` and `INITIAL_IMPLS` hardcoded data
- [ ] Update Catalog component to use fetched data
- [ ] Implement category filtering with API query params

**Afternoon (3-4 hours):**
- [ ] Update PatternDetail to fetch single pattern
- [ ] Update SmartEtlForm to POST to `/api/implementations`
- [ ] Add Clerk `useAuth()` hook to get token
- [ ] Show success/error messages after submission
- [ ] Add "Pending approval" badge in UI

**End of Day Checkpoint:**
✅ Catalog displays database patterns
✅ Pattern detail fetches from API
✅ Contribution form submits to backend
✅ Loading/error states work

---

### Day 5: Admin UI + Testing + Polish
**Focus:** Complete admin workflow and polish the experience

**Morning (2-3 hours):**
- [ ] Create simple Admin panel (new route or modal)
- [ ] Show pending implementations list
- [ ] Add Approve/Reject buttons
- [ ] Test admin workflow end-to-end
- [ ] Handle edge cases

**Afternoon (3-4 hours):**
- [ ] Fix bugs found during testing
- [ ] Add user feedback (toasts/notifications for actions)
- [ ] Test all user flows
- [ ] Update README with new setup instructions
- [ ] Prepare demo for stakeholders

**End of Day Checkpoint:**
✅ Admin can approve/reject from UI
✅ All user flows tested
✅ Sprint 1 demo-ready

---

## Critical Files to Create/Modify

### Backend (API Endpoints)
- `/api/seed.ts` - Seed 30 IMP/DER patterns
- `/api/patterns/index.ts` - GET all patterns
- `/api/patterns/[id].ts` - GET single pattern
- `/api/implementations/index.ts` - POST new implementation
- `/api/implementations/[uuid].ts` - PUT update implementation
- `/api/implementations/[uuid]/status.ts` - PATCH approve/reject
- `/api/auth/me.ts` - GET current user
- `/lib/auth.ts` - Auth helper utilities

### Frontend
- `/index.tsx` - Update with Clerk, API calls, remove localStorage

### Configuration
- `.env.local` - Add CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY

---

## Definition of Done

### Sprint 1 is complete when:

#### Infrastructure
- [ ] Vercel Postgres contains 30 seeded patterns (15 IMP, 15 DER)
- [ ] Each pattern has at least one "System" implementation
- [ ] Clerk application configured and integrated

#### Backend API
- [ ] GET /api/patterns returns all patterns with filtering
- [ ] GET /api/patterns/:id returns single pattern
- [ ] POST /api/implementations creates contribution
- [ ] PUT /api/implementations/:uuid updates implementation
- [ ] PATCH /api/implementations/:uuid/status approves/rejects
- [ ] All endpoints handle auth and errors correctly

#### Frontend
- [ ] Catalog fetches from database (not localStorage)
- [ ] Pattern detail fetches from API
- [ ] Users can sign up/log in with Clerk
- [ ] Contributors can submit implementations
- [ ] Submission shows "Pending approval" message
- [ ] Loading/error states display correctly

#### User Flows (Tested)
- [ ] Guest browsing
- [ ] User sign up → contributor role
- [ ] Contributor submits implementation
- [ ] Admin approves implementation
- [ ] Approved implementation appears in UI

#### Documentation
- [ ] README updated with Clerk setup
- [ ] API documentation with examples
- [ ] Known issues documented

---

## Risks & Mitigation

1. **Clerk Setup Complexity** - Follow quickstart exactly, use pre-built components
2. **Seed Data Quality** - Allocate 4-5 hours, use existing patterns as reference
3. **Time Constraint** - Cut admin UI if behind by Day 3, keep API priority
4. **Frontend State** - Keep API integration simple, add React Query later

---

## Next Steps After This Plan

1. Product Owner reviews and approves plan
2. Create GitHub Project board with user stories
3. Begin Day 1 implementation: Seed script + API endpoints
4. Daily check-ins to track progress
