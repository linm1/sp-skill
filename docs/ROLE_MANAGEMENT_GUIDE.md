# Role Management Guide - Clerk Dashboard

## Quick Reference: How to Change User Roles

### Prerequisites
- Admin access to Clerk Dashboard
- URL: https://dashboard.clerk.com

---

## Step-by-Step: Setting User Roles

### 1. Access Clerk Dashboard
1. Go to https://dashboard.clerk.com
2. Sign in with your Clerk account
3. Select your StatPatternHub application

### 2. Navigate to User Management
1. Click **"Users"** in the left sidebar
2. You'll see a list of all registered users

### 3. Select User to Modify
1. Find the user by:
   - Email address
   - Username
   - Name
2. Click on the user to open their profile

### 4. Edit User Metadata
1. Click the **"Metadata"** tab
2. Locate **"Public metadata"** section
3. Click **"Edit"** button

### 5. Set Role
Add or update the role field:

```json
{
  "role": "admin"
}
```

**Available Roles:**
- `"guest"` - Read-only access
- `"contributor"` - Can create/edit own patterns
- `"premier"` - Full access to all patterns
- `"admin"` - Full access + admin capabilities

### 6. Save Changes
1. Click **"Save"** button
2. Changes take effect immediately
3. User will see new role on next page refresh

---

## Example Metadata Configurations

### New User (Default)
```json
{}
```
*Application will default to "contributor" role*

### Contributor
```json
{
  "role": "contributor"
}
```

### Premier User
```json
{
  "role": "premier"
}
```

### Admin User
```json
{
  "role": "admin"
}
```

### Additional Metadata (Future)
```json
{
  "role": "premier",
  "organization": "Acme Pharma",
  "subscriptionTier": "enterprise",
  "joinedDate": "2025-01-15"
}
```

---

## Role Permissions Matrix

| Feature | Guest | Contributor | Premier | Admin |
|---------|-------|-------------|---------|-------|
| View Catalog | ✅ | ✅ | ✅ | ✅ |
| View Patterns | ✅ | ✅ | ✅ | ✅ |
| Add to Basket | ✅ | ✅ | ✅ | ✅ |
| Contribute Pattern | ❌ | ✅ | ✅ | ✅ |
| Edit Own Pattern | ❌ | ✅ | ✅ | ✅ |
| Edit Any Pattern | ❌ | ❌ | ✅ | ✅ |
| Access Premium Patterns | ❌ | ❌ | ✅ | ✅ |
| Manage Users (Future) | ❌ | ❌ | ❌ | ✅ |
| Approve Patterns (Future) | ❌ | ❌ | ❌ | ✅ |

---

## Common Tasks

### Make Product Owner an Admin
1. Find your account in Clerk Dashboard → Users
2. Edit Public metadata
3. Add: `{ "role": "admin" }`
4. Save

### Upgrade User to Premier
1. Find user in Clerk Dashboard → Users
2. Edit Public metadata
3. Add/update: `{ "role": "premier" }`
4. Save

### Downgrade User to Guest
1. Find user in Clerk Dashboard → Users
2. Edit Public metadata
3. Add/update: `{ "role": "guest" }`
4. Save

### Remove Role (Default to Contributor)
1. Find user in Clerk Dashboard → Users
2. Edit Public metadata
3. Remove the `"role"` field entirely
4. Save (will default to "contributor")

---

## Verifying Role Changes

### In the Application
1. User logs in
2. Top-right navigation shows role badge:
   - **Admin** - Gold/Amber color
   - **Premier** - Purple color
   - **Contributor** - Indigo/Blue color
   - **Guest** - Gray color
3. Role is read-only (no dropdown)

### Testing Permissions
**As Contributor:**
- Click on a pattern
- Should see "Contribute Alternative" button
- Can edit own implementations only

**As Admin:**
- Click on a pattern
- Should see "Contribute Alternative" button
- Can edit any implementation

**As Guest:**
- Click on a pattern
- Should NOT see "Contribute Alternative" button
- Cannot edit anything

---

## Troubleshooting

### User doesn't see role change
**Solution:** Have user refresh the page or sign out and sign back in

### Role shows as "Contributor" even though set to "Admin"
**Check:**
1. Is the JSON valid in Clerk Dashboard?
2. Is the field named exactly `"role"` (case-sensitive)?
3. Is the value exactly `"admin"` (lowercase)?
4. Did you save the changes?

### Role dropdown still appears
**This is a bug!** The dropdown should have been removed.
Check that you're running the latest version of the code.

---

## Security Notes

### ✅ Secure Practices
- Only admin-level Clerk users can change roles
- Role is stored server-side in Clerk's database
- Role cannot be changed by users through the UI
- All role changes are logged by Clerk

### ❌ Avoid These Mistakes
- Don't share Clerk Dashboard credentials
- Don't set everyone as "admin"
- Don't store sensitive data in publicMetadata (it's visible to client)
- Don't forget to verify changes in the application

---

## Future: Admin UI (Sprint 1 Story 5)

### Planned Features
1. **User Management Page** (Admin-only)
   - List all users
   - Search/filter users
   - View current roles
   - Change roles directly in app

2. **Role Change UI**
   ```typescript
   // Example implementation
   const changeUserRole = async (userId: string, newRole: Role) => {
     await fetch('/api/admin/update-role', {
       method: 'POST',
       body: JSON.stringify({ userId, role: newRole })
     });
   };
   ```

3. **Audit Log**
   - Track who changed what role when
   - Display in admin panel
   - Export for compliance

---

## API Reference (Future)

### Update User Role via Backend API
```typescript
import { clerkClient } from '@clerk/clerk-sdk-node';

// Server-side only!
async function updateUserRole(userId: string, role: Role) {
  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      role: role
    }
  });
}

// Usage
await updateUserRole('user_abc123', 'admin');
```

### Bulk Update Roles
```typescript
async function bulkUpdateRoles(updates: { userId: string; role: Role }[]) {
  for (const update of updates) {
    await updateUserRole(update.userId, update.role);
  }
}

// Usage
await bulkUpdateRoles([
  { userId: 'user_123', role: 'premier' },
  { userId: 'user_456', role: 'admin' },
  { userId: 'user_789', role: 'contributor' }
]);
```

---

## Clerk Dashboard URLs

- **Main Dashboard:** https://dashboard.clerk.com
- **Users:** https://dashboard.clerk.com/apps/[YOUR_APP_ID]/users
- **API Keys:** https://dashboard.clerk.com/apps/[YOUR_APP_ID]/api-keys
- **Documentation:** https://clerk.com/docs/users/metadata

---

## Contact

For questions about role management:
- **Technical Issues:** Review `/home/user/sp-skill/SECURITY_FIX_SUMMARY.md`
- **Clerk Documentation:** https://clerk.com/docs/users/metadata
- **Product Owner:** Has admin access to Clerk Dashboard

---

**Last Updated:** 2025-12-26
**Version:** 1.0.0
