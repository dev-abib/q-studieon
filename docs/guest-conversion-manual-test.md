# Manual Test Flow: Guest → User Conversion

Use these `curl` commands against your running dev server to manually validate the guest-to-user conversion across all three paths.

**Prerequisites:**
- Server running at `http://localhost:3000`
- `curl`, `jq` installed (or visually parse JSON output)

---

## 1. Guest Login (Prerequisite)

```bash
# Create/get a guest session
curl -s -X POST http://localhost:3000/api/v1/auth/user/guest-login \
  -H "Content-Type: application/json" \
  -H "x-device-id: test-device-001" \
  | jq .
```

**✅ Expected output:**
```json
{
  "message": "Guest login successful",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresAt": "...",
    "id": "ckz..."
  }
}
```

**Save the `accessToken` and `id`** — you'll use them in all conversion tests below.

---

## 2. Verify Guest State (Optional)

```bash
# Use the guest access token to view reports
# Guest reports should return with accessLevel: "guest_preview"
ACCESS_TOKEN="<guest-access-token>"

curl -s -X POST http://localhost:3000/api/v1/report/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "address": "123 Test St",
    "entranceDegrees": 180,
    "latitude": 40.71,
    "longitude": -74.0,
    "entranceLabel": "South"
  }' \
  | jq '.data.accessLevel'
```

**✅ Expected:** `"guest_preview"`

---

## 3A. Register (Email+Password) with guestId

```bash
GUEST_ID="<guest-id-from-step-1>"

curl -s -X POST http://localhost:3000/api/v1/auth/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-user@example.com",
    "password": "StrongP@ss1",
    "confirmPassword": "StrongP@ss1",
    "name": "Test User",
    "termsAndConditions": true,
    "guestId": "'"$GUEST_ID"'"
  }' \
  | jq .
```

**✅ Expected:**
```json
{
  "message": "Account created successfully and sent account verification mail.",
  "data": {
    "name": "Test User",
    "email": "test-user@example.com",
    "profilePicture": null,
    "id": "<same-as-guest-id>",   // ← ID unchanged = reports preserved
    "isGuest": false
  }
}
```

**Verify:**
- `id` matches the original guest `id` (reports preserved)
- `isGuest` is `false`
- You receive a verification email with OTP

**Next step:** Verify the OTP and login:

```bash
# Check your email for the OTP, then:
OTP="<otp-from-email>"

curl -s -X POST http://localhost:3000/api/v1/auth/user/verify-account \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-user@example.com",
    "otp": "'"$OTP"'"
  }' \
  | jq .

# Login to get new tokens
curl -s -X POST http://localhost:3000/api/v1/auth/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-user@example.com",
    "password": "StrongP@ss1"
  }' \
  | jq .
```

---

## 3B. Google Login with guestId

**You need:** A valid Google OAuth access token from your frontend. Run this from your frontend app, get the token, then use it below.

```bash
GOOGLE_TOKEN="<google-oauth-access-token>"
GUEST_ID="<guest-id-from-step-1>"

curl -s -X POST http://localhost:3000/api/v1/auth/user/google-login \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'"$GOOGLE_TOKEN"'",
    "guestId": "'"$GUEST_ID"'"
  }' \
  | jq .
```

**✅ Expected:**
```json
{
  "message": "Google login successful",
  "data": {
    "token": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ..."
    },
    "user": {
      "name": "John Google",
      "email": "john@gmail.com",
      "profilePictureURL": "https://..."
    }
  }
}
```

**Verify:**
- Returns tokens immediately (no OTP needed)
- `isGuest` is `false` (would see in JWT payload: `isGuest: false`)
- User can access full reports without additional verification

**Conflict test** — register with a guestId that already has a real account:

```bash
# Use a guestId that was already converted (from step 3A)
curl -s -X POST http://localhost:3000/api/v1/auth/user/google-login \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'"$GOOGLE_TOKEN"'",
    "guestId": "'"$CONVERTED_GUEST_ID"'"
  }' \
  | jq .
```

**✅ Expected:** `400 Bad Request` with `"Invalid guest session"`

---

## 3C. Apple Login with guestId

**You need:** A valid Apple identity token from your frontend.

```bash
APPLE_TOKEN="<apple-identity-token>"
GUEST_ID="<guest-id-from-step-1>"

curl -s -X POST http://localhost:3000/api/v1/auth/user/apple-login \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'"$APPLE_TOKEN"'",
    "guestId": "'"$GUEST_ID"'"
  }' \
  | jq .
```

**✅ Expected:**
```json
{
  "message": "Apple login successful",
  "data": {
    "token": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ..."
    },
    "user": {
      "name": "Guest_a1b2c3",       // ← Guest name preserved
      "email": "john@icloud.com",
      "profilePictureURL": null
    }
  }
}
```

**Verify:**
- `name` preserves the original guest name (Apple doesn't send a name)
- Returns tokens immediately (no OTP needed)

---

## 4. Verify Conversion Results

### 4A. Check that old guest data is gone

Connect to your database and verify the user record:

```sql
SELECT id, email, name, is_guest, auth_provider, guest_ip, guest_device_id, guest_expires_at
FROM users
WHERE id = '<guest-id>';
```

**✅ Expected after conversion:**
- `is_guest` = `false`
- `guest_ip` = `null`
- `guest_device_id` = `null`
- `guest_expires_at` = `null`
- `auth_provider` = `'local'`, `'google'`, or `'apple'`

### 4B. Verify reports are preserved

```sql
SELECT id, type, status, created_at
FROM reports
WHERE user_id = '<guest-id>';
```

**✅ Expected:** All reports the guest created are still attached to the same user ID.

### 4C. Verify the old guest JWT no longer works with guest-scoped endpoints

```bash
# Try to access subscription endpoint with old guest token
curl -s -X POST http://localhost:3000/api/v1/subscription/create-checkout-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <old-guest-access-token>" \
  -d '{"priceId": "price_xxx"}' \
  | jq .
```

**✅ Expected:** `403 Forbidden` — the converted user isn't a guest anymore but the @NoGuest() guard checks `isGuest` from the token payload. Since the token says `isGuest: true`, it will be rejected. The user must use the new tokens from the conversion flow.

---

## 5. Error Case Testing

### 5A. Invalid guestId

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new@example.com",
    "password": "StrongP@ss1",
    "confirmPassword": "StrongP@ss1",
    "name": "New User",
    "termsAndConditions": true,
    "guestId": "nonexistent-guest-id"
  }' \
  | jq .
```

**✅ Expected:** `400 Bad Request` — `"Guest session not found or has expired"`

### 5B. Expired guestId (guest older than 7 days)

Simulate by directly updating the database:

```sql
UPDATE users SET guest_expires_at = NOW() - INTERVAL '1 day' WHERE id = '<guest-id>';
```

Then try converting → **✅ Expected:** `400 Bad Request`

### 5C. Email conflict during social conversion

Create a real user with `email@example.com` first, then try Google login with a guestId and a Google account whose email is `email@example.com`:

**✅ Expected:** `409 Conflict` — `"An account with this email already exists. Please log in instead."`

---

## Summary Checklist

| Test Case | Status | Notes |
|---|---|---|
| Guest login creates session | ☐ | |
| Register + guestId converts | ☐ | Same ID, isGuest=false |
| Google + guestId converts | ☐ | Returns tokens immediately |
| Apple + guestId converts | ☐ | Preserves guest name |
| Old reports preserved | ☐ | Same user ID |
| Guest fields cleared | ☐ | null after conversion |
| Invalid guestId rejected | ☐ | 400 Bad Request |
| Expired guestId rejected | ☐ | 400 Bad Request |
| Email conflict rejected | ☐ | 409 Conflict |
