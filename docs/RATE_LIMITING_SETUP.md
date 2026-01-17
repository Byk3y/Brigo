# Rate Limiting Setup Guide

## Overview

Rate limiting has been implemented using Upstash Redis to prevent abuse, control API costs, and ensure fair usage across your edge functions.

## Current Rate Limits

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| `process-material` | 10 requests | 5 minutes | Material upload and processing |
| `generate-studio-content` | 5 requests | 5 minutes | Flashcard/quiz generation |
| `generate-audio-overview` | 3 requests | 10 minutes | Audio overview generation |

## Setup Instructions

### Step 1: Create Upstash Account

1. Go to [upstash.com](https://upstash.com)
2. Sign up for a free account (no credit card required)
3. Verify your email

### Step 2: Create Redis Database

1. After logging in, click **"Create Database"**
2. Configure your database:
   - **Name**: `brigo-rate-limiting` (or any name you prefer)
   - **Type**: Choose **Global** for best performance across regions
     - Alternative: Choose your nearest region (e.g., `us-west-1`) for lower latency
   - **TLS**: Keep enabled (recommended)
3. Click **"Create"**

### Step 3: Get Redis Credentials

After creating the database:

1. You'll see the database dashboard
2. Scroll down to **"REST API"** section
3. Copy these two values:
   - `UPSTASH_REDIS_REST_URL` (looks like: `https://xxx.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (long string starting with `A...`)

### Step 4: Add Secrets to Supabase

You need to add the Upstash credentials to your Supabase project as secrets.

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Edge Functions**
4. Scroll to **Secrets** section
5. Add two secrets:
   - Name: `UPSTASH_REDIS_REST_URL`
     Value: `<paste your URL from Step 3>`
   - Name: `UPSTASH_REDIS_REST_TOKEN`
     Value: `<paste your token from Step 3>`
6. Click **Save**

#### Option B: Using Supabase CLI

```bash
# Set the access token (if not already set)
export SUPABASE_ACCESS_TOKEN=<your-access-token>

# Link to your project (if not already linked)
supabase link --project-ref <your-project-ref>

# Add secrets
supabase secrets set UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
supabase secrets set UPSTASH_REDIS_REST_TOKEN=<your-token>
```

#### Option C: Using Environment Variable (Current Setup)

If you're already using the access token approach:

```bash
SUPABASE_ACCESS_TOKEN=<your-supabase-access-token> supabase secrets set UPSTASH_REDIS_REST_URL=https://xxx.upstash.io

SUPABASE_ACCESS_TOKEN=<your-supabase-access-token> supabase secrets set UPSTASH_REDIS_REST_TOKEN=<your-token>
```

### Step 5: Deploy Edge Functions

After adding the secrets, redeploy your edge functions to pick up the new configuration:

```bash
# Deploy all functions
SUPABASE_ACCESS_TOKEN=<your-supabase-access-token> supabase functions deploy

# Or deploy individually
SUPABASE_ACCESS_TOKEN=<your-supabase-access-token> supabase functions deploy process-material
SUPABASE_ACCESS_TOKEN=<your-supabase-access-token> supabase functions deploy generate-studio-content
SUPABASE_ACCESS_TOKEN=<your-supabase-access-token> supabase functions deploy generate-audio-overview
```

### Step 6: Verify Setup

Test that rate limiting is working:

1. **Option A: Test with your app**
   - Try uploading 11 materials rapidly (should get rate limited on 11th)
   - Or generate 6 quizzes rapidly (should get rate limited on 6th)

2. **Option B: Test with curl**

```bash
# Get your JWT token from the app
TOKEN="<your-jwt-token>"

# Make multiple rapid requests
for i in {1..6}; do
  curl -X POST \
    https://<your-project-ref>.supabase.co/functions/v1/generate-studio-content \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"notebook_id":"<test-notebook-id>","content_type":"quiz"}' \
    && echo "Request $i succeeded"
done
```

Expected result: First 5 requests succeed, 6th returns:
```json
{
  "error": "Too many requests. Please wait before generating more content.",
  "retryAfter": 300,
  "remaining": 0,
  "resetAt": 1734720300
}
```

### Step 7: Monitor Usage

1. Go to your Upstash dashboard
2. Click on your database
3. View **Metrics** tab to see:
   - Request count
   - Latency
   - Storage usage

Free tier provides **10,000 commands/day** - plenty for your current scale.

## Graceful Degradation

If Upstash is unavailable or credentials are missing:
- Rate limiting will be **disabled** (requests allowed through)
- A warning will be logged: `Rate limiting disabled: credentials not configured`
- Your app will continue to function normally
- Quota limits will still be enforced

This ensures your app doesn't break if Redis has issues.

## Troubleshooting

### Rate limiting not working

1. **Check secrets are set**:
   ```bash
   SUPABASE_ACCESS_TOKEN=<your-supabase-access-token> supabase secrets list
   ```
   Should show `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

2. **Check Upstash dashboard** - is your database active?

3. **Check edge function logs**:
   - Look for errors in Supabase dashboard → Edge Functions → Logs
   - Look for "Rate limiting disabled" warnings

### Getting 429 errors when you shouldn't

1. **Check your current usage**:
   - View Upstash dashboard metrics
   - Check which user/endpoint is hitting limits

2. **Adjust limits if needed**:
   - Edit [supabase/functions/_shared/ratelimit.ts](../supabase/functions/_shared/ratelimit.ts)
   - Modify `RATE_LIMITS` constants
   - Redeploy functions

### Upstash free tier exceeded

Free tier: 10,000 commands/day

If you exceed this:
1. **Option A**: Upgrade to paid tier (~$10/month for 100K requests/day)
2. **Option B**: Optimize rate limit checks (already efficient)
3. **Option C**: Switch to regional database for lower command costs

## Cost Breakdown

**Upstash Free Tier:**
- 10,000 commands/day
- Each rate limit check = ~4 commands (ZREMRANGEBYSCORE, ZADD, ZCARD, EXPIRE)
- Supports ~2,500 requests/day
- Free forever

**Paid Tier (if needed):**
- $0.20 per 100K commands
- ~25K requests = $0.20
- Way cheaper than LLM API abuse costs

## Adjusting Rate Limits

To change limits, edit [supabase/functions/_shared/ratelimit.ts](../supabase/functions/_shared/ratelimit.ts):

```typescript
export const RATE_LIMITS = {
  PROCESS_MATERIAL: {
    limit: 10,      // Change this
    window: 300,    // Or this (in seconds)
  },
  GENERATE_STUDIO: {
    limit: 5,
    window: 300,
  },
  GENERATE_AUDIO: {
    limit: 3,
    window: 600,
  },
} as const;
```

Then redeploy:
```bash
SUPABASE_ACCESS_TOKEN=<your-supabase-access-token> supabase functions deploy
```

## Response Format

When rate limited, users receive a `429 Too Many Requests` response:

```json
{
  "error": "Too many requests. Please wait before generating more content.",
  "retryAfter": 180,      // Seconds to wait
  "remaining": 0,         // Requests remaining
  "resetAt": 1734720180   // Unix timestamp when limit resets
}
```

HTTP Headers:
```
Status: 429 Too Many Requests
Retry-After: 180
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1734720180
```

## Next Steps

1. ✅ Complete Upstash setup (Steps 1-4)
2. ✅ Add secrets to Supabase (Step 4)
3. ✅ Deploy edge functions (Step 5)
4. ✅ Verify with tests (Step 6)
5. Monitor usage in Upstash dashboard
6. Consider adding rate limit info to frontend UI (optional)

## Support

- **Upstash**: [docs.upstash.com](https://docs.upstash.com)
- **Supabase Secrets**: [supabase.com/docs/guides/functions/secrets](https://supabase.com/docs/guides/functions/secrets)

---

**Implementation Date**: December 2025
**Status**: ✅ Ready for production
