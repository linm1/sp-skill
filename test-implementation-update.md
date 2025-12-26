# Story 8: Implementation Update Endpoint - Test Documentation

## Endpoint Overview

**Endpoint:** `PUT /api/implementations/:uuid`
**Purpose:** Update an existing pattern implementation with authorization and status management

## Implementation Details

### File Created
- **Path:** `C:\Users\kllkt\Documents\Python\sp-skill\api\implementations\[uuid].ts`
- **Status:** ✅ Created and implemented

### Database Schema Verification

All required columns present in `pattern_implementations` table:
- ✅ `uuid` (primary key, uuid type)
- ✅ `pattern_id` (varchar)
- ✅ `author_id` (integer, references users.id)
- ✅ `sas_code` (text)
- ✅ `r_code` (text)
- ✅ `considerations` (text array)
- ✅ `variations` (text array)
- ✅ `status` (varchar: "active", "pending", "rejected")
- ✅ `is_premium` (boolean)
- ✅ `updated_at` (timestamp)

### Authorization Logic

The endpoint implements the following authorization checks:

1. **Authentication Required**: User must be logged in (Clerk JWT)
2. **Ownership Check**: User must be either:
   - The original author (`implementation.authorId === user.id`)
   - OR an admin (`user.role === 'admin'`)

### Status Management Logic

| Current Status | User Role | New Status | Reason |
|---------------|-----------|------------|--------|
| `active` | Contributor/Author | `pending` | Requires re-approval |
| `active` | Admin | `active` | Admin edits don't need approval |
| `pending` | Any authorized | `pending` | Unchanged |
| `rejected` | Any authorized | `rejected` | Unchanged |

### Error Handling

| Status Code | Scenario | Response |
|------------|----------|----------|
| `200` | Success | Updated implementation |
| `400` | Missing UUID | `{ error: 'Implementation UUID is required' }` |
| `400` | Missing sasCode/rCode | `{ error: 'Both sasCode and rCode are required' }` |
| `401` | Not authenticated | `{ error: 'Unauthorized - Please log in' }` |
| `403` | Not author or admin | `{ error: 'Forbidden - You can only edit your own implementations' }` |
| `404` | UUID not found | `{ error: 'Implementation not found', uuid: '...' }` |
| `405` | Wrong HTTP method | `{ error: 'Method not allowed' }` |
| `500` | Database error | `{ error: 'Failed to update implementation', message: '...' }` |

## Testing Instructions

### Prerequisites

1. Start the Vercel dev server:
   ```bash
   npm run dev:api
   ```
   The API server will run on `http://localhost:3001`

2. Get a Clerk authentication token:
   - Open the frontend in browser
   - Login with Clerk
   - Open browser console and run:
     ```javascript
     await window.Clerk.session.getToken()
     ```
   - Copy the token

### Test Case 1: Unauthorized Access (401)

```bash
curl -X PUT http://localhost:3001/api/implementations/test-uuid \
  -H "Content-Type: application/json" \
  -d '{
    "sasCode": "data test;",
    "rCode": "# test"
  }'
```

**Expected Response:**
```json
{
  "error": "Unauthorized - Please log in"
}
```

### Test Case 2: Invalid UUID (400)

```bash
curl -X PUT http://localhost:3001/api/implementations/ \
  -H "Authorization: Bearer <your-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sasCode": "data test;",
    "rCode": "# test"
  }'
```

**Expected Response:**
```json
{
  "error": "Implementation UUID is required"
}
```

### Test Case 3: Missing Required Fields (400)

Replace `<UUID>` with a valid implementation UUID from the database.

```bash
curl -X PUT http://localhost:3001/api/implementations/<UUID> \
  -H "Authorization: Bearer <your-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sasCode": "data test;"
  }'
```

**Expected Response:**
```json
{
  "error": "Both sasCode and rCode are required"
}
```

### Test Case 4: Implementation Not Found (404)

```bash
curl -X PUT http://localhost:3001/api/implementations/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer <your-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sasCode": "data test;",
    "rCode": "# test"
  }'
```

**Expected Response:**
```json
{
  "error": "Implementation not found",
  "uuid": "00000000-0000-0000-0000-000000000000"
}
```

### Test Case 5: Forbidden - Not Author (403)

Try to edit an implementation created by another user.

```bash
curl -X PUT http://localhost:3001/api/implementations/<SOMEONE_ELSE_UUID> \
  -H "Authorization: Bearer <your-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sasCode": "data hacked;",
    "rCode": "# hacked"
  }'
```

**Expected Response:**
```json
{
  "error": "Forbidden - You can only edit your own implementations",
  "authorId": 1,
  "userId": 2
}
```

### Test Case 6: Successful Update (Contributor, Active → Pending)

Update your own implementation that has `status = 'active'`.

```bash
curl -X PUT http://localhost:3001/api/implementations/<YOUR_ACTIVE_UUID> \
  -H "Authorization: Bearer <your-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sasCode": "/* Updated SAS code */\ndata updated;\n  set source;\n  /* New logic */\nrun;",
    "rCode": "# Updated R code\nlibrary(dplyr)\ndf <- df %>% mutate(new_col = 1)",
    "considerations": ["Updated consideration 1", "Edge case X"],
    "variations": ["Variation A"]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Implementation updated and submitted for re-approval",
  "implementation": {
    "uuid": "...",
    "patternId": "IMP-001",
    "authorId": 2,
    "sasCode": "/* Updated SAS code */\ndata updated;\n  set source;\n  /* New logic */\nrun;",
    "rCode": "# Updated R code\nlibrary(dplyr)\ndf <- df %>% mutate(new_col = 1)",
    "considerations": ["Updated consideration 1", "Edge case X"],
    "variations": ["Variation A"],
    "status": "pending",
    "isPremium": false,
    "updatedAt": "2025-12-26T..."
  },
  "statusChanged": true,
  "previousStatus": "active",
  "newStatus": "pending"
}
```

### Test Case 7: Successful Update (Admin, Active → Active)

Admin updates any implementation without status change.

```bash
curl -X PUT http://localhost:3001/api/implementations/<ANY_UUID> \
  -H "Authorization: Bearer <admin-clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sasCode": "/* Admin update */\ndata fixed;",
    "rCode": "# Admin update\ndf <- data.frame()",
    "considerations": ["Fixed by admin"],
    "variations": []
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Implementation updated successfully",
  "implementation": {
    "uuid": "...",
    "status": "active",
    ...
  },
  "statusChanged": false,
  "previousStatus": "active",
  "newStatus": "active"
}
```

### Test Case 8: Wrong HTTP Method (405)

```bash
curl -X GET http://localhost:3001/api/implementations/<UUID> \
  -H "Authorization: Bearer <your-clerk-token>"
```

**Expected Response:**
```json
{
  "error": "Method not allowed"
}
```

## Database Query to Get Test UUIDs

To find UUIDs for testing, use these SQL queries:

```sql
-- Get your own implementations
SELECT uuid, pattern_id, author_name, status
FROM pattern_implementations
WHERE author_id = <your-user-id>;

-- Get implementations by other users
SELECT uuid, pattern_id, author_name, status
FROM pattern_implementations
WHERE author_id != <your-user-id>
LIMIT 5;

-- Get your user ID
SELECT id, clerk_id, email, role
FROM users
WHERE clerk_id = '<your-clerk-id>';
```

## Integration with Frontend

### TypeScript Interface

```typescript
interface UpdateImplementationRequest {
  sasCode: string;
  rCode: string;
  considerations?: string[];
  variations?: string[];
  isPremium?: boolean;
}

interface UpdateImplementationResponse {
  success: true;
  message: string;
  implementation: {
    uuid: string;
    patternId: string;
    authorId: number;
    sasCode: string;
    rCode: string;
    considerations: string[];
    variations: string[];
    status: 'active' | 'pending' | 'rejected';
    isPremium: boolean;
    updatedAt: Date;
  };
  statusChanged: boolean;
  previousStatus: string;
  newStatus: string;
}
```

### Frontend Usage Example

```typescript
async function updateImplementation(uuid: string, data: UpdateImplementationRequest) {
  const token = await window.Clerk.session.getToken();

  const response = await fetch(`/api/implementations/${uuid}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update implementation');
  }

  return await response.json() as UpdateImplementationResponse;
}
```

## Security Features

1. ✅ **JWT Authentication**: Clerk token verification required
2. ✅ **Authorization**: Author or admin check
3. ✅ **Input Validation**: Required field checks
4. ✅ **SQL Injection Protection**: Drizzle ORM parameterized queries
5. ✅ **Status Logic**: Business rules enforced server-side
6. ✅ **Audit Trail**: `updatedAt` timestamp tracked

## Known Limitations

1. No field-level validation (e.g., max length, XSS protection) - rely on database constraints
2. No rate limiting - consider adding for production
3. No versioning/history - each update overwrites previous data
4. No notification system for status changes - future enhancement

## Deliverables Checklist

- ✅ **File created:** `/api/implementations/[uuid].ts`
- ✅ **Authorization checks:** Author or admin only
- ✅ **Status logic:** Implemented per requirements
- ✅ **Database updates:** Using Drizzle ORM
- ✅ **Error handling:** All scenarios covered
- ⏳ **Test results:** Pending manual testing with curl
- ⏳ **Integration:** Pending frontend team

## Next Steps for Testing

1. Start the API server: `npm run dev:api`
2. Login to the frontend and get Clerk token
3. Query database for test UUIDs
4. Run curl commands from test cases above
5. Verify responses match expected outputs
6. Test all status transitions (active→pending, admin edits)
7. Document any issues found

## Notes for Frontend Team

- Endpoint is ready for integration
- Use the TypeScript interfaces provided above
- Handle `statusChanged` flag to show user when re-approval is needed
- Display appropriate messages based on `message` field
- Consider showing status badge (active/pending/rejected)
- Add edit button with condition: `(userIsAuthor || userIsAdmin)`
