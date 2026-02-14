# Permission System Test Guide

## Test Users to Create

### 1. Staff - View Only
```json
{
  "username": "viewer",
  "password": "test123",
  "role": "custom",
  "permissions": ["view_profiles"]
}
```
**Expected Access:**
- ✅ Can see profiles list
- ❌ Cannot create profiles
- ❌ Cannot use profiles (launch/close)
- ❌ Cannot delete profiles
- ❌ Cannot access other pages

### 2. Staff - Create Only
```json
{
  "username": "creator",
  "password": "test123", 
  "role": "staff_create_only",
  "permissions": ["view_profiles", "create_profiles"]
}
```
**Expected Access:**
- ✅ Can see profiles list
- ✅ Can create profiles
- ✅ Can rename profiles
- ✅ Can change proxy
- ✅ Can import/export
- ✅ Can bulk create
- ❌ Cannot launch/close profiles
- ❌ Cannot delete profiles
- ❌ Cannot use Instagram automation

### 3. Staff - Create & Use
```json
{
  "username": "user",
  "password": "test123",
  "role": "staff_create_use", 
  "permissions": ["view_profiles", "create_profiles", "use_profiles"]
}
```
**Expected Access:**
- ✅ Can see profiles list
- ✅ Can create profiles
- ✅ Can launch/close profiles
- ✅ Can use Instagram automation
- ✅ Can rename profiles
- ✅ Can change proxy
- ❌ Cannot delete profiles

## Testing Steps

### 1. Create Test Users
1. Login as admin (check documentation for credentials)
2. Go to User Management
3. Create the 3 test users above
4. Logout

### 2. Test View Only User
1. Login as `viewer` / `test123`
2. **Sidebar Check:** Should only see "Profiles" menu item
3. **Profiles Page:** Should see profiles but no action buttons
4. **Profile Options:** Should only see "View Details"

### 3. Test Create Only User  
1. Login as `creator` / `test123`
2. **Sidebar Check:** Should see "Profiles" menu item only
3. **Profiles Page:** Should see "Create Profile", "Bulk Operations", "Import/Export" buttons
4. **Profile Actions:** Should NOT see Launch/Close buttons
5. **Profile Options:** Should see View, Rename, Change Proxy, Disable Proxy (NO Delete)

### 4. Test Create & Use User
1. Login as `user` / `test123`  
2. **Sidebar Check:** Should see "Profiles" menu item only
3. **Profiles Page:** Should see all buttons including "Instagram Automation"
4. **Profile Actions:** Should see Launch/Close buttons
5. **Profile Options:** Should see all options EXCEPT Delete

### 5. Server-Side Verification
Test API endpoints directly:

```bash
# Get token for test user
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"viewer","password":"test123"}'

# Try restricted action (should fail with 403)
curl -X POST http://localhost:4000/api/profiles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","config":{}}'
```

## Expected Results

| User Type | View Profiles | Create | Launch/Close | Delete | User Mgmt | Other Pages |
|-----------|---------------|--------|--------------|--------|-----------|-------------|
| viewer    | ✅            | ❌     | ❌           | ❌     | ❌        | ❌          |
| creator   | ✅            | ✅     | ❌           | ❌     | ❌        | ❌          |
| user      | ✅            | ✅     | ✅           | ❌     | ❌        | ❌          |
| admin     | ✅            | ✅     | ✅           | ✅     | ✅        | ✅          |

## Security Verification

### Frontend Protection
- UI elements hidden based on permissions
- Menu items filtered by role
- Buttons conditionally rendered

### Backend Protection  
- All API endpoints require authentication
- Permission middleware checks user permissions
- 403 Forbidden returned for unauthorized actions

### Token Security
- JWT tokens expire after 24 hours
- Tokens include user permissions
- Invalid tokens rejected with 401 Unauthorized

## Common Issues to Check

1. **Token Storage:** Ensure tokens are properly stored/retrieved
2. **Permission Sync:** Frontend permissions match backend
3. **Route Protection:** All sensitive endpoints protected
4. **UI Consistency:** Hidden elements don't appear on refresh
5. **Error Handling:** Proper error messages for unauthorized actions