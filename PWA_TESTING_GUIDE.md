# Hajiri PWA Testing Guide

## Overview
This guide provides comprehensive testing procedures for the Hajiri Attendance System Progressive Web App (PWA) functionality.

## Prerequisites
- Modern browser (Chrome, Firefox, Safari, Edge)
- Developer tools access
- Local development server running
- Basic understanding of PWA concepts

## Test Categories

### 1. Service Worker Testing

#### Automated Test
```javascript
// Run in browser console
fetch('/test-pwa.js').then(r => r.text()).then(code => eval(code));
```

#### Manual Verification
1. **Registration Check**
   - Open Developer Tools → Application → Service Workers
   - Verify "hajiri-v1" service worker is registered and active
   - Check scope: "/"

2. **Cache Inspection**
   - Navigate to Application → Storage → Cache Storage
   - Verify caches: "hajiri-v1" and "hajiri-api-v1"
   - Check cached resources include HTML, CSS, JS files

3. **Network Interception**
   - Open Network tab in DevTools
   - Navigate through app pages
   - Verify requests show "(from ServiceWorker)" for cached resources

### 2. Offline Functionality Testing

#### Attendance Submission Test
1. **Setup**
   - Navigate to `/mobile-attendance`
   - Login as FOREMAN role user
   - Select site and workers for attendance

2. **Offline Simulation**
   - Open DevTools → Network → Set to "Offline"
   - Attempt to submit attendance
   - Expected: Success message with offline indicator

3. **Data Persistence**
   - Check Application → Storage → IndexedDB → HajiriDB
   - Verify attendance record stored with `synced: false`
   - Check offline indicator shows pending sync count

4. **Sync Testing**
   - Set Network back to "Online"
   - Wait for automatic sync or click "Sync Now"
   - Verify pending count decreases
   - Check server receives attendance data

### 3. PWA Installation Testing

#### Installation Prompt
1. **Chrome/Edge**
   - Look for install icon in address bar
   - Click to trigger install prompt
   - Verify app name, icon, and description

2. **Mobile Browsers**
   - Use "Add to Home Screen" option
   - Verify app appears on home screen
   - Test launch from home screen

#### Post-Installation Verification
1. **Standalone Mode**
   - App opens without browser UI
   - Navigation works properly
   - All features accessible

2. **App Shortcuts**
   - Right-click app icon (desktop)
   - Verify "Mark Attendance" and "Approvals" shortcuts
   - Test shortcut navigation

### 4. Network Resilience Testing

#### Connection Drop Scenarios
1. **During Page Load**
   - Start loading a page
   - Disconnect network mid-load
   - Verify page loads from cache

2. **During API Calls**
   - Initiate API request
   - Disconnect network
   - Verify graceful fallback behavior

3. **Intermittent Connectivity**
   - Toggle network on/off rapidly
   - Verify app maintains state
   - Check sync queue management

### 5. Update Mechanism Testing

#### Service Worker Updates
1. **Deploy New Version**
   - Make code changes
   - Deploy updated service worker
   - Refresh page

2. **Update Notification**
   - Verify update indicator appears
   - Click "Update" button
   - Confirm app reloads with new version

#### Cache Management
1. **Version Control**
   - Check old caches are deleted
   - Verify new cache contains updated resources
   - Test cache invalidation

### 6. Performance Testing

#### Load Time Metrics
1. **First Load**
   - Clear cache and data
   - Measure initial load time
   - Check resource loading waterfall

2. **Subsequent Loads**
   - Navigate through app
   - Verify fast loading from cache
   - Check Time to Interactive (TTI)

#### Offline Performance
1. **Cold Start**
   - App launch while offline
   - Measure load time from cache
   - Verify full functionality

2. **Data Operations**
   - Test IndexedDB read/write speed
   - Verify smooth UI interactions
   - Check memory usage

## Test Data Setup

### User Accounts Needed
- ADMIN: Full system access
- SITE_INCHARGE: Approval permissions
- FOREMAN: Attendance submission
- WORKER: Basic access

### Test Sites and Workers
```sql
-- Create test data
INSERT INTO sites (name, location) VALUES 
  ('Test Site Alpha', 'Location A'),
  ('Test Site Beta', 'Location B');

INSERT INTO workers (name, father_name, site_id) VALUES
  ('Test Worker 1', 'Father 1', 1),
  ('Test Worker 2', 'Father 2', 1);
```

## Expected Results

### Success Criteria
- ✅ Service worker registers and activates
- ✅ Offline attendance submission works
- ✅ Data syncs when online
- ✅ App installs successfully
- ✅ Offline indicator shows correct status
- ✅ Cache strategy works as expected
- ✅ Updates apply smoothly

### Performance Benchmarks
- First load: < 3 seconds
- Cached load: < 1 second
- Offline load: < 2 seconds
- Sync latency: < 5 seconds

## Troubleshooting

### Common Issues

#### Service Worker Not Registering
- Check HTTPS requirement (localhost exempt)
- Verify `/sw.js` file exists and accessible
- Check console for registration errors

#### Offline Storage Failing
- Verify IndexedDB support
- Check browser storage quota
- Clear storage and retry

#### Install Prompt Not Showing
- Verify manifest.json accessibility
- Check manifest validation
- Ensure HTTPS (production)

#### Sync Not Working
- Check network connectivity
- Verify background sync support
- Test manual sync trigger

### Debug Commands
```javascript
// Check service worker status
navigator.serviceWorker.getRegistrations().then(regs => console.log(regs));

// Clear all caches
caches.keys().then(names => Promise.all(names.map(name => caches.delete(name))));

// Check IndexedDB data
// (Run in DevTools Application tab)

// Force sync
navigator.serviceWorker.ready.then(reg => reg.sync.register('background-sync-attendance'));
```

## Reporting

### Test Results Documentation
1. **Create Test Report**
   - Environment details
   - Test execution summary
   - Pass/fail status for each test
   - Performance metrics
   - Issues found and resolutions

2. **Screenshots/Videos**
   - Installation process
   - Offline functionality
   - Sync behavior
   - Error scenarios

3. **Cross-Browser Results**
   - Chrome/Chromium
   - Firefox
   - Safari (if applicable)
   - Mobile browsers

## Conclusion

This testing guide ensures comprehensive validation of PWA functionality across all supported platforms and use cases. Regular execution of these tests maintains app quality and user experience standards.
