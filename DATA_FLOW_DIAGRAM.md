# Data Flow Diagrams - Pattern Edit Operations

## Current State (BROKEN - Data Not Persisted)

### READ Operation (Works Correctly)

```
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                      │
│                    (Vercel Neon Cloud)                      │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │ pattern_definitions  │  │ pattern_implementations  │    │
│  │                      │  │                          │    │
│  │ IMP-001             │  │ uuid: IMP-001-system     │    │
│  │ IMP-002 (LOCF)      │  │ sasCode: "data locf..."  │    │
│  │ ...                 │  │ rCode: "df %>% fill..." │    │
│  │ (30 patterns)       │  │ status: 'active'         │    │
│  └──────────────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ ❌ NOT USED (database ignored)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Mock API Server (localhost:3001)                  │
│           Running: mock-api-server.js                       │
│                                                             │
│  const mockPatterns = [                                     │
│    {                                                        │
│      id: 'IMP-001',                                         │
│      implementations: [...]  ◄── IN-MEMORY ARRAY          │
│    },                                                       │
│    ...                                                      │
│  ];                                                         │
│                                                             │
│  ✅ GET /api/patterns       - Returns mockPatterns         │
│  ✅ GET /api/patterns/:id   - Returns single pattern       │
│  ❌ PUT /api/implementations/:uuid  - NOT IMPLEMENTED      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Vite Proxy: /api → :3001
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Vite Dev Server (localhost:3000)               │
│                    React Frontend                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ useEffect(() => {
                              │   fetch('/api/patterns')
                              │ }, [])
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   usePatterns() Hook                        │
│                                                             │
│  const [patterns, setPatterns] = useState([]);             │
│  const [implementations, setImplementations] = useState([]); │
│                                                             │
│  useEffect(() => {                                          │
│    fetchPatterns();  // ✅ Loads data from API             │
│  }, []);                                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  React Component State                      │
│                                                             │
│  definitions: PatternDefinition[]   ◄── From API           │
│  implementationsList: PatternImplementation[]              │
│                                                             │
│  {                                                          │
│    id: 'IMP-002',                                           │
│    title: 'LOCF',                                           │
│    implementations: [{                                      │
│      uuid: 'IMP-002-system',                                │
│      sasCode: 'data locf; ...',                             │
│      rCode: 'df %>% fill(...)',                             │
│      status: 'active'                                       │
│    }]                                                       │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       UI Renders                            │
│                  Pattern Catalog Display                    │
└─────────────────────────────────────────────────────────────┘
```

### WRITE Operation (BROKEN - Changes Lost)

```
┌─────────────────────────────────────────────────────────────┐
│                    User Action Flow                         │
└─────────────────────────────────────────────────────────────┘
                              │
                    Admin clicks "Edit" button
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SmartEtlForm                            │
│                                                             │
│  User edits:                                                │
│  - SAS Code: "/* UPDATED */ data locf; ..."                │
│  - R Code: "# UPDATED\ndf %>% fill(...)"                   │
│  - Considerations: ["New warning"]                          │
│                                                             │
│  [Submit Button] ◄── User clicks                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ onSubmit → handleSaveImplementation()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            handleSaveImplementation() Function              │
│            Location: index.tsx, Line 1278                   │
│                                                             │
│  const handleSaveImplementation = (newImpl) => {           │
│                                                             │
│    // ✅ Updates React state (in-memory)                   │
│    setImplementationsList(prev => {                         │
│      const index = prev.findIndex(i => i.uuid === newImpl.uuid); │
│      if (index >= 0) {                                      │
│        const updated = [...prev];                           │
│        updated[index] = newImpl; // ⚠️ Only local change  │
│        return updated;                                      │
│      }                                                      │
│    });                                                      │
│                                                             │
│    // ❌ NO API CALL - Missing implementation              │
│    // Should be:                                            │
│    // await fetch(`/api/implementations/${newImpl.uuid}`, { │
│    //   method: 'PUT',                                      │
│    //   body: JSON.stringify(newImpl)                       │
│    // });                                                   │
│                                                             │
│    setView("detail"); // Return to detail view             │
│  };                                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Changes ONLY in browser memory
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               React State Updated (Temporarily)             │
│                                                             │
│  implementationsList: [{                                    │
│    uuid: 'IMP-002-system',                                  │
│    sasCode: '/* UPDATED */ data locf; ...',  ◄── Modified  │
│    rCode: '# UPDATED\ndf %>% fill(...)',     ◄── Modified  │
│    status: 'active'                                         │
│  }]                                                         │
│                                                             │
│  ✅ UI shows updated code immediately                      │
│  ✅ User sees changes in browser                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │
                    User refreshes page OR
                    User logs out and logs back in
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              usePatterns() Runs Again (Page Load)           │
│                                                             │
│  useEffect(() => {                                          │
│    fetch('/api/patterns')  // ◄── Fetches from API again   │
│      .then(data => {                                        │
│        setImplementations(data.patterns);                   │
│      });                                                    │
│  }, []);                                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API returns ORIGINAL data
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Mock API Server (localhost:3001)                  │
│                                                             │
│  mockPatterns = [  ◄── STILL HAS ORIGINAL DATA             │
│    {                                                        │
│      id: 'IMP-002',                                         │
│      implementations: [{                                    │
│        sasCode: 'data locf; ...',  ◄── ORIGINAL (no update) │
│        rCode: 'df %>% fill(...)',  ◄── ORIGINAL (no update) │
│      }]                                                     │
│    }                                                        │
│  ];                                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         React State Overwritten with Original Data          │
│                                                             │
│  implementationsList: [{                                    │
│    uuid: 'IMP-002-system',                                  │
│    sasCode: 'data locf; ...',     ◄── ❌ CHANGES LOST      │
│    rCode: 'df %>% fill(...)',     ◄── ❌ CHANGES LOST      │
│    status: 'active'                                         │
│  }]                                                         │
│                                                             │
│  ❌ All edits disappeared                                  │
│  ❌ User's work is lost                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Expected State (WORKING - Data Persisted)

### WRITE Operation (How It SHOULD Work)

```
┌─────────────────────────────────────────────────────────────┐
│                    User Action Flow                         │
└─────────────────────────────────────────────────────────────┘
                              │
                    Admin clicks "Edit" button
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SmartEtlForm                            │
│                                                             │
│  User edits:                                                │
│  - SAS Code: "/* UPDATED */ data locf; ..."                │
│  - R Code: "# UPDATED\ndf %>% fill(...)"                   │
│                                                             │
│  [Submit Button] ◄── User clicks                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ onSubmit → handleSaveImplementation()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│       handleSaveImplementation() - FIXED VERSION            │
│                                                             │
│  const handleSaveImplementation = async (newImpl) => {     │
│                                                             │
│    // ✅ Step 1: Optimistic UI update                      │
│    setImplementationsList(prev => {                         │
│      const updated = [...prev];                             │
│      updated[index] = newImpl;                              │
│      return updated;                                        │
│    });                                                      │
│                                                             │
│    try {                                                    │
│      // ✅ Step 2: Persist to database via API             │
│      const response = await fetch(                          │
│        `/api/implementations/${newImpl.uuid}`,              │
│        {                                                    │
│          method: 'PUT',                                     │
│          headers: {                                         │
│            'Content-Type': 'application/json',              │
│            'Authorization': `Bearer ${token}`               │
│          },                                                 │
│          body: JSON.stringify({                             │
│            sasCode: newImpl.sasCode,                        │
│            rCode: newImpl.rCode,                            │
│            considerations: newImpl.considerations,          │
│            variations: newImpl.variations                   │
│          })                                                 │
│        }                                                    │
│      );                                                     │
│                                                             │
│      if (!response.ok) throw new Error('Save failed');     │
│                                                             │
│      const { implementation } = await response.json();     │
│                                                             │
│      // ✅ Step 3: Update with server response             │
│      setImplementationsList(prev => {                       │
│        const updated = [...prev];                           │
│        updated[index] = implementation; // Server data      │
│        return updated;                                      │
│      });                                                    │
│                                                             │
│      alert('✅ Changes saved successfully!');               │
│                                                             │
│    } catch (error) {                                        │
│      // ❌ Rollback on error                               │
│      setImplementationsList(originalData);                  │
│      alert('❌ Failed to save: ' + error.message);          │
│    }                                                        │
│  };                                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ PUT request sent
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           PUT /api/implementations/[uuid].ts                │
│           NEW FILE (Story 8 - Not Yet Implemented)          │
│                                                             │
│  export default async function handler(req, res) {         │
│                                                             │
│    // ✅ Authenticate user                                 │
│    const { userId, role } = await verifyToken(req.headers);│
│                                                             │
│    const { uuid } = req.query;                              │
│    const { sasCode, rCode, considerations } = req.body;    │
│                                                             │
│    // ✅ Check permissions                                 │
│    const existing = await db.select()                       │
│      .from(patternImplementations)                          │
│      .where(eq(patternImplementations.uuid, uuid));        │
│                                                             │
│    const isOwner = existing.authorId === userId;           │
│    const isAdmin = role === 'admin';                       │
│                                                             │
│    if (!isOwner && !isAdmin) {                             │
│      return res.status(403).json({                          │
│        error: 'Permission denied'                           │
│      });                                                    │
│    }                                                        │
│                                                             │
│    // ✅ Update database                                   │
│    const updated = await db.update(patternImplementations) │
│      .set({                                                 │
│        sasCode,                                             │
│        rCode,                                               │
│        considerations,                                      │
│        updatedAt: new Date(),                               │
│        status: isAdmin ? 'active' : 'pending'  // Re-approve│
│      })                                                     │
│      .where(eq(patternImplementations.uuid, uuid))         │
│      .returning();                                          │
│                                                             │
│    return res.json({                                        │
│      success: true,                                         │
│      implementation: updated[0]                             │
│    });                                                      │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Database UPDATE query
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Neon)                     │
│                                                             │
│  UPDATE pattern_implementations                             │
│  SET                                                        │
│    sas_code = '/* UPDATED */ data locf; ...',              │
│    r_code = '# UPDATED\ndf %>% fill(...)',                 │
│    updated_at = '2025-12-26 12:30:00',                     │
│    status = 'active'                                        │
│  WHERE uuid = 'IMP-002-system';                             │
│                                                             │
│  ✅ Changes persisted in database                          │
│  ✅ Will survive server restarts                           │
│  ✅ Will survive deployments                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Success response
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Response to Frontend                       │
│                                                             │
│  {                                                          │
│    success: true,                                           │
│    implementation: {                                        │
│      uuid: 'IMP-002-system',                                │
│      sasCode: '/* UPDATED */ data locf; ...',              │
│      rCode: '# UPDATED\ndf %>% fill(...)',                 │
│      updatedAt: '2025-12-26T12:30:00Z',                    │
│      status: 'active'                                       │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Frontend receives confirmation
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              React State Updated with Server Data           │
│                                                             │
│  implementationsList: [{                                    │
│    uuid: 'IMP-002-system',                                  │
│    sasCode: '/* UPDATED */ data locf; ...',  ◄── Confirmed │
│    rCode: '# UPDATED\ndf %>% fill(...)',     ◄── Confirmed │
│    updatedAt: '2025-12-26T12:30:00Z',        ◄── From server│
│    status: 'active'                                         │
│  }]                                                         │
│                                                             │
│  ✅ UI shows success message                               │
│  ✅ Changes confirmed by server                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │
                    User refreshes page OR
                    User logs out and logs back in
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           usePatterns() Runs Again (Page Load)              │
│                                                             │
│  useEffect(() => {                                          │
│    fetch('/api/patterns')  // ◄── Fetches from API         │
│      .then(data => {                                        │
│        setImplementations(data.patterns);                   │
│      });                                                    │
│  }, []);                                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API queries database
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         GET /api/patterns - Queries Database                │
│                                                             │
│  const implementations = await db.select()                  │
│    .from(patternImplementations)                            │
│    .where(eq(patternImplementations.patternId, 'IMP-002')); │
│                                                             │
│  Returns:                                                   │
│  [{                                                         │
│    uuid: 'IMP-002-system',                                  │
│    sasCode: '/* UPDATED */ data locf; ...',  ◄── PERSISTED │
│    rCode: '# UPDATED\ndf %>% fill(...)',     ◄── PERSISTED │
│    updatedAt: '2025-12-26T12:30:00Z',                      │
│    status: 'active'                                         │
│  }]                                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│        React State Loaded with UPDATED Data                 │
│                                                             │
│  implementationsList: [{                                    │
│    uuid: 'IMP-002-system',                                  │
│    sasCode: '/* UPDATED */ data locf; ...',  ◄── ✅ PERSISTED│
│    rCode: '# UPDATED\ndf %>% fill(...)',     ◄── ✅ PERSISTED│
│    status: 'active'                                         │
│  }]                                                         │
│                                                             │
│  ✅ Changes still visible after refresh                    │
│  ✅ Changes still visible after logout/login               │
│  ✅ User's work is preserved                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Comparison

| Aspect | Current (Broken) | Expected (Working) |
|--------|------------------|-------------------|
| **Data Storage** | React state (browser memory) | PostgreSQL database |
| **Edit Handler** | `setImplementationsList()` only | `setImplementationsList()` + API call |
| **API Endpoint** | None (404) | `PUT /api/implementations/:uuid` |
| **Persistence** | Lost on refresh | Survives refresh, logout, restart |
| **Authentication** | None | Clerk JWT token required |
| **Authorization** | None | User owns implementation OR is admin |
| **Status Change** | No change | Contributor edit → status='pending' |
| **Server Response** | N/A | Confirmation with `updatedAt` timestamp |
| **Error Handling** | None | Rollback on failure, user notification |
| **Audit Trail** | None | `updatedAt` timestamp updated |

---

## Timeline of Data Loss

```
Time 0:00  │  Admin edits pattern IMP-002
           │  - Changes SAS code
           │  - Clicks "Save"
           │
Time 0:01  │  handleSaveImplementation() runs
           │  - React state updated ✅
           │  - UI shows changes ✅
           │  - No API call ❌
           │
Time 0:02  │  Admin sees updated code in UI
           │  - Everything looks correct
           │  - Admin assumes changes are saved
           │
Time 0:05  │  Admin logs out
           │
Time 0:10  │  Admin logs back in
           │
Time 0:11  │  usePatterns() fetches from API
           │  - API returns original data
           │  - React state overwritten
           │
Time 0:12  │  Admin views pattern IMP-002
           │  - ❌ Original code is back
           │  - ❌ All edits are gone
           │  - Admin is confused and frustrated
```

---

## Missing Piece - The Write Endpoint

**Current API Structure:**
```
api/
├── patterns.ts             ✅ GET all patterns
├── patterns/
│   └── [id].ts            ✅ GET single pattern
├── analyze.ts             ✅ AI extraction
└── implementations/       ❌ MISSING - This entire directory
    └── [uuid].ts          ❌ MISSING - PUT/PATCH endpoint
```

**Should Be:**
```
api/
├── patterns.ts             ✅ GET all patterns
├── patterns/
│   └── [id].ts            ✅ GET single pattern
├── analyze.ts             ✅ AI extraction
└── implementations/       ⚠️ NEEDS TO BE CREATED
    └── [uuid].ts          ⚠️ NEEDS TO BE CREATED
                           └── Handles: PUT, PATCH
                           └── Validates: Auth, permissions
                           └── Updates: Database
                           └── Returns: Updated implementation
```

---

## Summary

**Problem:**
Frontend updates React state → No API call → No database write → Changes lost on refresh

**Solution:**
Frontend updates React state → API call to backend → Database write → Changes persisted

**Blocker:**
Backend endpoint `PUT /api/implementations/:uuid` does not exist (Story 8 not implemented)

**Next Steps:**
1. Create backend endpoint
2. Add API call to frontend
3. Test end-to-end
4. Deploy to production
