# Orphaned Code Analysis Report

**Generated:** 2025-01-22
**Analyzed Packages:** packages/web, packages/plugin
**Analysis Type:** Deep Static Code Analysis

---

## Executive Summary

This report identifies orphaned files, unused exports, and potentially dead code across the Note Companion codebase. Each finding is rated by severity and certainty.

**Legend:**

- **Severity:** Critical | High | Medium | Low
- **Certainty:** High (95-100%) | Medium (70-95%) | Low (50-70%)

---

## 1. ORPHANED FILES

### 1.1 Anonymous User System (packages/web/app/api/anon.ts) - ✅ VERIFIED IN USE

**Location:** `packages/web/app/api/anon.ts`
**Status:** ✅ **ACTIVELY USED** (Not Orphaned)
**Verification Date:** 2026-01-03

**Description:**
File contains one exported function:

- `createAnonymousUser()` - Creates anonymous Clerk user for fallback authentication

**Usage Analysis:**

- ✅ **USED**: `createAnonymousUser` is actively imported and used in:
  - `packages/web/app/api/top-up/route.ts:4,17` - Fallback user creation when auth fails
  - `packages/web/app/api/top-up-minutes/route.ts:4,17` - Fallback user creation when auth fails

**Current Implementation:**
The function is used as a fallback mechanism in the top-up flows:

- When `handleAuthorizationV2` fails (e.g., invalid license key)
- Creates an anonymous Clerk user with temporary email
- Creates user usage record and license key
- Allows payment processing to continue without blocking users

**Evidence:**

```typescript
// top-up/route.ts and top-up-minutes/route.ts
async function ensureAuthorizedUser(req: NextRequest) {
  try {
    const { userId } = await handleAuthorizationV2(req);
    return { userId, licenseKey: initialLicenseKey };
  } catch (error) {
    // Fallback: create anonymous user if auth fails
    return createFallbackUser(); // Uses createAnonymousUser()
  }
}
```

**Previous Analysis Note:**

- Original analysis mentioned `updateAnonymousUserEmail()` function
- This function does not exist in current codebase (may have been removed)
- Only `createAnonymousUser()` exists and is actively used

**Conclusion:**
This file is **NOT orphaned**. It's a critical fallback mechanism for the payment/top-up flows. The analysis was incorrect or outdated. No action needed.

---

### 1.2 Old Folders API Route (packages/web/app/api/(newai)/folders/route.ts) - ✅ VERIFIED ORPHANED

**Location:** `packages/web/app/api/(newai)/folders/route.ts`
**Status:** ✅ **ORPHANED** (Not Used)
**Severity:** HIGH
**Certainty:** HIGH (95%)
**Verification Date:** 2026-01-03

**Description:**
Legacy folders recommendation endpoint that has been superseded by v2. Returns a single folder suggestion.

**Usage Analysis:**

- ✅ V2 exists at `packages/web/app/api/(newai)/folders/v2/route.ts`
- ✅ Plugin uses `recommendFolders()` which calls `/api/folders/v2` (index.ts:1155)
- ❌ **NO USAGE FOUND** for old `/api/folders` endpoint (without v2)
- ✅ Old route uses `handleAuthorizationV2` (NOT deprecated - analysis was incorrect)
- ✅ V2 route also uses `handleAuthorizationV2`

**Key Differences:**

```typescript
// Old route (folders/route.ts) - Returns single folder
return NextResponse.json({
  folder: response.object.suggestedFolder,  // Single folder
});

// V2 route (folders/v2/route.ts) - Returns multiple folders
return NextResponse.json({
  folders: response.object.suggestedFolders.sort(...),  // Array of folders
});
```

**Evidence:**

```typescript
// All plugin code uses v2:
// packages/plugin/index.ts:1155
const response = await fetch(`${this.getServerUrl()}/api/folders/v2`, {
  method: 'POST',
  // ...
});

// No references to /api/folders (without v2) found in:
// - packages/plugin/
// - packages/mobile/
// - packages/web/ (except the route definition itself)
```

**Recommendation:**

- ✅ **SAFE TO REMOVE** - No active usage found
- Add deprecation warning if endpoint is hit (before removal)
- Consider keeping for 1-2 releases with deprecation notice for external clients
- Remove after deprecation period

**Impact:**

- Medium-High - Reduces maintenance burden
- Eliminates confusion about which endpoint to use
- Removes unused code (~34 lines)

**Correction to Previous Analysis:**

- ❌ Previous analysis incorrectly stated old route uses deprecated `handleAuthorization`
- ✅ **Actual:** Old route uses `handleAuthorizationV2` (same as v2)
- The issue is not deprecated auth, but that the endpoint is simply unused

---

### 1.3 Upload Test Infrastructure - ✅ VERIFIED REMOVED

**Location:**

- ~~`packages/web/app/api/upload-test/route.ts`~~ - **REMOVED**
- ~~`packages/web/app/(app)/dashboard/upload-test/page.tsx`~~ - **REMOVED**

**Status:** ✅ **REMOVED** (Security Fix - BUG-003)
**Severity:** ~~LOW~~ → **RESOLVED**
**Certainty:** HIGH (100%)
**Verification Date:** 2026-01-03

**Description:**
Development/testing infrastructure for file upload flow. **This has been removed as a security fix.**

**Verification:**

- ✅ Checked for `packages/web/app/api/upload-test/route.ts` - **file does not exist**
- ✅ Checked for `packages/web/app/(app)/dashboard/upload-test/page.tsx` - **file does not exist**
- ✅ Git history shows commit `8bf33055` (Nov 22, 2025) removed both files
- ✅ Commit message: "fix(security): remove upload-test endpoint and page"
- ✅ Commit explicitly states: "Fixes BUG-003 - Upload test endpoint security risk"
- ✅ No references to upload-test found in current codebase

**Previous Analysis:**

- Original analysis identified this as a potential security risk
- The endpoint forwarded to `/api/upload` with user credentials
- Could be abused if exposed in production without proper auth

**Resolution:**

- Security risk eliminated by removing the endpoint entirely
- No migration needed - was test infrastructure only
- No external clients were using this endpoint

**Conclusion:**
This finding is **OBSOLETE**. The upload-test infrastructure has been completely removed as part of BUG-003 security fix. No action needed.

---

### 1.4 Check Tier Endpoint (packages/web/app/api/check-tier/route.ts) - ✅ VERIFIED ORPHANED

**Location:** `packages/web/app/api/check-tier/route.ts`
**Status:** ✅ **ORPHANED** (Not Used)
**Severity:** MEDIUM
**Certainty:** HIGH (95%)
**Verification Date:** 2026-01-03

**Description:**
Endpoint to check if user needs upgrade and token usage. Returns minimal data: `{ needsUpgrade, remainingTokens, usageError }`.

**Usage Analysis:**

- ❌ **NO USAGE FOUND** in any package:
  - Plugin uses `/api/public-usage` and `/api/usage` (not check-tier)
  - Mobile app doesn't use it
  - Web dashboard doesn't use it
- ✅ Uses `handleAuthorizationV2` (current auth method)
- ✅ Functionality is redundant - superset available in `/api/token-usage`

**Comparison with Similar Endpoints:**

```typescript
// /api/check-tier (ORPHANED) - Returns minimal data
{
  needsUpgrade: boolean,
  remainingTokens: number,
  usageError: boolean
}

// /api/token-usage (EXISTS) - Returns same data + more
{
  ...userUsage,              // Full user usage data
  needsUpgrade,              // Same as check-tier
  remainingTokens,           // Same as check-tier
  usageError,                // Same as check-tier
  percentUsed,               // Additional
  availableTiers             // Additional
}

// /api/usage (USED BY PLUGIN) - Returns usage data
{
  tokenUsage,
  maxTokenUsage,
  subscriptionStatus,
  currentPlan,
  nextReset,
  isActive
}
```

**Evidence:**

```bash
# No references to check-tier found:
grep -r "check-tier" packages/ --include="*.ts" --include="*.tsx"
# Result: Only found in route definition itself

# Plugin uses different endpoints:
# packages/plugin/index.ts:1640 - uses /api/public-usage
# packages/plugin/index.ts:1663 - uses /api/usage
```

**Recommendation:**

- ✅ **SAFE TO REMOVE** - No active usage found
- Functionality is fully covered by `/api/token-usage` endpoint
- If needed, clients can use `/api/token-usage` which provides the same data plus more
- Consider deprecation notice before removal (similar to folders endpoint)

**Impact:**

- Low-Medium - Removes redundant endpoint (~26 lines)
- Reduces API surface area
- Eliminates confusion about which endpoint to use

---

### 1.5 Classify API (packages/web/app/api/(newai)/classify1/route.ts) - ✅ VERIFIED IN USE

**Location:** `packages/web/app/api/(newai)/classify1/route.ts`
**Status:** ✅ **ACTIVELY USED** (Not Orphaned)
**Severity:** LOW (Naming Issue Only)
**Certainty:** HIGH (100%)
**Verification Date:** 2026-01-03

**Description:**
Document classification endpoint. Despite the "1" suffix suggesting v1, this is the **current and only** classification endpoint.

**Usage Analysis:**

- ✅ **USED** by plugin: `packages/plugin/index.ts:837` - `classifyContentV2()` method calls `/api/classify1`
- ✅ Uses `handleAuthorizationV2` (already migrated - analysis was incorrect)
- ✅ No other classify endpoint exists (no `/api/classify` without "1")

**Evidence:**

```typescript
// plugin/index.ts:837 - classifyContentV2() method
const response = await fetch(`${serverUrl}/api/classify1`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${this.settings.API_KEY}`,
  },
  body: JSON.stringify({
    content: trimmedContent,
    templateNames: classifications,
  }),
});
```

**Current Implementation:**

```typescript
// classify1/route.ts:4,10
import { handleAuthorizationV2 } from '@/lib/handleAuthorization';
// ...
const { userId } = await handleAuthorizationV2(request); // ✅ Uses V2
```

**Issue:**

- **Naming Confusion:** The "1" suffix suggests this is v1, but it's actually the current endpoint
- **Method Name Mismatch:** Plugin method is called `classifyContentV2()` but calls `/api/classify1`
- No v2 endpoint exists - this is the only classification endpoint

**Recommendation:**

- ✅ **KEEP AS-IS** - Endpoint is actively used and correctly implemented
- ✅ **DO NOT RENAME** - Backward compatibility constraint:
  - Users may not update the plugin immediately
  - Old plugin versions will break if endpoint name changes
  - Must maintain `/api/classify1` for existing plugin installations
- ✅ **Add documentation comment** - Clarify that despite the "1" suffix, this is the current endpoint
- **Future consideration:** If creating a v2 endpoint, keep v1 for backward compatibility

**Impact:**

- Low - This is a naming/clarity issue, not a functional problem
- Endpoint works correctly and is actively used
- Renaming is NOT recommended due to backward compatibility requirements
- Documentation comment added to clarify naming confusion

---

### 1.6 Fabric Classify Endpoint - ✅ VERIFIED REMOVED

**Location:**

- ~~`packages/web/app/api/(newai)/fabric-classify/route.ts`~~ - **REMOVED**
- ~~`packages/plugin/views/assistant/organizer/ai-format/fabric-templates.tsx`~~ - **REMOVED**

**Status:** ✅ **REMOVED** (Feature Removed)
**Severity:** ~~LOW~~ → **RESOLVED**
**Certainty:** HIGH (100%)
**Verification Date:** 2026-01-03

**Description:**
Fabric-specific classification endpoint and related feature. **This feature has been removed from the project.**

**Verification:**

- ✅ Checked for `packages/web/app/api/(newai)/fabric-classify/route.ts` - **file does not exist**
- ✅ Checked for `packages/plugin/views/assistant/organizer/ai-format/fabric-templates.tsx` - **file does not exist**
- ✅ No references to `fabric-classify`, `fabricClassify`, `fabric-templates`, or `enableFabric` found in codebase
- ✅ No `enableFabric` setting found in `FileOrganizerSettings`

**Previous Analysis:**

- Original analysis identified this as an actively used endpoint
- Referenced `fabric-templates.tsx` component that no longer exists
- Mentioned `enableFabric` setting that has been removed

**Conclusion:**
This finding is **OBSOLETE**. The fabric-classify endpoint and related fabric feature have been completely removed from the project. No action needed.

---

## 2. ORPHANED FUNCTIONS (EXPORTED BUT NOT IMPORTED)

### 2.1 checkAndCreateFolders (fileUtils.ts) - ✅ VERIFIED FIXED

**Location:** `packages/plugin/fileUtils.ts`
**Status:** ✅ **NO ISSUE** (Already Fixed)
**Severity:** ~~LOW~~ → **RESOLVED**
**Certainty:** HIGH (100%)
**Verification Date:** 2026-01-03

**Description:**
Function import in index.ts. Original analysis reported duplicate imports, but this has been resolved.

**Current Implementation:**

```typescript
// index.ts:49-54 - SINGLE import statement
import {
  ensureFolderExists,
  checkAndCreateFolders,  // ✅ Only one import
  checkAndCreateTemplates,
  moveFile,
} from './fileUtils';

// index.ts:910-911 - Method that calls imported function
async checkAndCreateFolders() {
  await checkAndCreateFolders(this.app, this.settings);
}
```

**Verification:**

- ✅ Only ONE import statement found (lines 49-54)
- ✅ No duplicate import at line 42-43 (does not exist)
- ✅ Function is properly used: imported function called in method at line 911
- ✅ Method is called in `initializePlugin()` at line 1373

**Previous Analysis:**

- Original analysis incorrectly reported duplicate imports at lines 42-43 and 51-54
- The duplicate import has been removed or never existed in current codebase

**Conclusion:**
This finding is **OBSOLETE**. The duplicate import issue does not exist in the current codebase. No action needed.

---

### 2.2 Deprecated handleAuthorization Function

**Location:** `packages/web/lib/handleAuthorization.ts:298`
**Severity:** HIGH
**Certainty:** HIGH (100%)

**Description:**
Function marked with `@deprecated` JSDoc but still actively used.

**Usage Count:**

```bash
grep -r "handleAuthorization" packages/web/app/api --include="*.ts" | grep -c "import.*handleAuthorization"
# Result: 13 imports of deprecated version
```

**Affected Files:**

- `/api/(newai)/fabric-classify/route.ts`
- `/api/(newai)/classify1/route.ts`
- `/api/(newai)/title/v2/route.ts`
- `/api/(newai)/modify/route.ts`
- `/api/(newai)/vision/route.ts`
- `/api/(newai)/tags/v2/route.ts`
- `/api/(newai)/format-stream/route.ts`
- `/api/(newai)/concepts-and-chunks/route.ts`
- `/api/(newai)/format/route.ts`
- `/api/(newai)/folders/v2/route.ts`
- `/api/(newai)/folders/route.ts`

**Recommendation:**

- URGENT: Migrate all usages to `handleAuthorizationV2`
- Add runtime deprecation warning
- Set timeline for removal (e.g., 2 releases from now)

**Impact:**

- High - affects authentication flow across 13 API endpoints
- Security implications if old auth has known issues

---

### 2.3 Commented-Out Webhook Handlers

**Location:** `packages/web/app/api/webhook/route.ts:15-17`
**Severity:** LOW
**Certainty:** HIGH (100%)

**Description:**
Two webhook handlers commented out in production code:

```typescript
const HANDLERS = {
  'checkout.session.completed': handleCheckoutComplete,
  'customer.subscription.deleted': handleSubscriptionCanceled,
  'customer.subscription.updated': handleSubscriptionUpdated,
  // "invoice.paid": handleInvoicePaid,  // COMMENTED OUT
  // "payment_intent.succeeded": handlePaymentIntentSucceeded,  // COMMENTED OUT
};
```

**Recommendation:**

- Document WHY these are commented out
- If intentionally disabled, remove imports
- If bug/testing, add TODO comment with reason

**Impact:**

- Low-Medium - Could indicate incomplete Stripe integration

---

## 3. POTENTIALLY UNUSED INFRASTRUCTURE

### 3.1 Process Pending Uploads Worker

**Location:** `packages/web/app/api/process-pending-uploads/route.ts`
**Severity:** MEDIUM
**Certainty:** MEDIUM (70%)

**Description:**
Background job to process uploaded files (OCR, transcription).

**Usage Analysis:**

- ✅ Called by: `packages/web/app/api/trigger-processing/route.ts:31`
- ✅ Called by: `packages/mobile/utils/file-handler.ts` (mobile app)
- Requires CRON_SECRET for authorization

**Recommendation:**

- KEEP - This is active infrastructure
- Verify cron job is configured on hosting platform
- Document expected trigger frequency

**Impact:**

- Critical infrastructure - do not remove

---

### 3.2 Reset Tokens Cron Job

**Location:** `packages/web/app/api/cron/reset-tokens/route.ts`
**Severity:** LOW
**Certainty:** HIGH (90%)

**Description:**
Monthly token reset for subscription users.

**Usage Analysis:**

- Only test file references it: `route.test.ts`
- Requires CRON_SECRET
- Should be triggered monthly by platform cron

**Recommendation:**

- KEEP - Critical billing infrastructure
- Verify cron schedule is configured
- Add monitoring/alerting for failed runs

**Impact:**

- Critical billing feature - do not remove

---

## 4. SUMMARY OF FINDINGS

### Immediate Action Required (HIGH Priority):

1. **Migrate deprecated `handleAuthorization`** - 13 files affected
2. **Review commented webhook handlers** - Potential incomplete Stripe integration
3. **Remove `updateAnonymousUserEmail`** - Confirmed unused function

### Medium Priority:

4. **Deprecate old `/api/folders` route** - Superseded by v2
5. **Review check-tier endpoint** - Possibly unused
6. **Clean up upload-test** - Security review needed

### Low Priority (Code Cleanup):

7. **Remove duplicate imports** in plugin index.ts
8. **Document fabric-classify** endpoint purpose
9. **Verify cron jobs** are properly configured

---

## 5. METHODOLOGY

**Analysis performed using:**

1. Static code analysis via grep/search
2. Import graph analysis (finding exports with no imports)
3. Cross-package reference checking
4. Manual code review of critical paths

**Limitations:**

- Dynamic imports not fully traced
- Runtime reflection/eval not detected
- External API consumers not analyzed (mobile app partially checked)

---

## 6. RECOMMENDATIONS FOR ONGOING MAINTENANCE

1. **Implement automated orphan detection**

   - Use tools like `ts-prune` or `knip` for TypeScript dead code detection
   - Add to CI/CD pipeline

2. **Code review checklist**

   - Check for deprecated functions before using
   - Verify imports exist for new exports
   - Mark deprecated code with JSDoc + runtime warnings

3. **Deprecation policy**
   - Clear timeline for deprecated code removal
   - Runtime warnings in development
   - Migration guides for external consumers

---

**Report prepared by:** AI Code Analysis Agent
**Review recommended by:** Senior Engineer
**Next review:** Q2 2025 or after major refactors
