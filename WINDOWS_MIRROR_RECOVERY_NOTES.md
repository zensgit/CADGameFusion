# Windows Mirror Recovery Notes

## 🔧 Current Status (2025-09-19)
- **Windows continue-on-error**: ENABLED (non-blocking)
- **Retry mechanism**: IMPLEMENTED (3 attempts, exponential backoff)
- **Monitoring**: Windows Nightly workflow added for daily health checks

## 📋 Recovery Steps (When Windows mirrors stabilize)

### 1. Monitor Windows Nightly Health
- Watch the "Windows Nightly - Strict Build Monitor" workflow results
- Look for 3+ consecutive successful runs without mirror errors

### 2. Remove continue-on-error (Keep retry mechanism)
When mirrors are stable, edit `.github/workflows/core-strict-build-tests.yml`:

```yaml
# CURRENT (non-blocking):
continue-on-error: ${{ matrix.os == 'windows-latest' }}

# CHANGE TO (blocking):
# continue-on-error: false  # or remove this line entirely
```

### 3. Alternative: Use Environment Variable Toggle
The workflow has WINDOWS_CONTINUE_ON_ERROR environment variable ready:

```yaml
# Current setup allows easy toggling:
env:
  WINDOWS_CONTINUE_ON_ERROR: 'true'   # Change to 'false' when ready

# And modify continue-on-error to use it:
continue-on-error: ${{ matrix.os == 'windows-latest' && env.WINDOWS_CONTINUE_ON_ERROR == 'true' }}
```

### 4. Verification Steps
After removing continue-on-error:
1. Test with a small PR to verify Windows enforcement
2. Monitor for 1-2 days to ensure stability
3. If issues return, re-enable continue-on-error temporarily

## 🚨 Keep These Permanent Improvements:
- ✅ **Retry mechanism**: Keep the 3-attempt retry for vcpkg operations
- ✅ **Windows Nightly monitoring**: Keep for ongoing health visibility
- ✅ **Separate Windows/Unix vcpkg setup**: Keep for targeted reliability

## 📍 Files to Monitor/Modify:
- `.github/workflows/core-strict-build-tests.yml` (lines 22-24)
- `.github/workflows/windows-nightly.yml` (monitor daily results)
- `docs/Troubleshooting.md` (update Windows mirror section when recovered)

---
*Generated: 2025-09-19 for Windows VCPKG mirror issue recovery planning*