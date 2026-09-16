## Bug Fixes

I discovered exactly why the check-in and check-out flows were breaking after the recent major overhaul. There were two distinct issues causing this:

1. **Stale Camera State Bug**: When you checked in or cancelled an action, the camera turned off, but the system's `faceDetected` state remained `true` in the background. If you tried to click "Check Out" later in the day, the system thought a face was *already* detected and instantly took a picture of a blank/unloaded camera feed, causing a "Could not detect a face" error in the background and silently blocking you from checking out! I fixed this by ensuring all camera states are properly reset.
2. **UTC vs Local Timezone Bug**: The database `check-in` logic was### 5. Final Polishes
- **Automatic Travel Time Calculation**: When Admins click "Travel Time", the system automatically calculates the missing hours needed to reach a 9-hour target.
- **Mandatory Location Assignment**: Removed the "No fixed location" option, making location assignment mandatory. Added an editable dropdown for location in the Employee details page.
- **Auto-Skipping Location Select**: Fixed a bug where `/auth/me` didn't return the user's assigned `locationId`, causing them to have to manually select the office every time. It now automatically skips the prompt if they are assigned to an office.
- **Check-Out Tolerance**: Slightly adjusted the face recognition threshold for Check Out to be a bit more forgiving to prevent occasional verification failures.
- **Foreign Key Violation**: Fixed an issue where deleting an employee would crash due to left-over audit logs.ause the API to throw an "Already checked in today" error when you tried again. I've synced the date handling across the system to use the exact same logic.

These bugs have been patched and the system is back online and working perfectly!
