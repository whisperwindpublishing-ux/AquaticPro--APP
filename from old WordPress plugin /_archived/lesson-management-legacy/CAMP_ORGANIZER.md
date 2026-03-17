# Camp Organizer

## Overview

The Camp Organizer is a specialized workspace inside the Lesson Management React app (orange "Camp Organizer" tab). It provides a visual, drag-and-drop interface for managing the assignment of instructors and swimmers across different animal groups without leaving the main dashboard.

## Features

### 1. Camp Selection
- Filter view by selecting a specific camp from the dropdown
- Only shows groups assigned to the selected camp

### 2. Organization by Animal
- Groups are automatically organized by their Animal taxonomy
- Each animal section displays:
  - List of instructors assigned to that animal
  - All groups within that animal
  - Swimmers within each group

### 3. Drag-and-Drop Functionality

#### Moving Instructors
- Instructors can be dragged between groups (even across animals)
- When an instructor is moved they are removed from the source group's roster and inserted exactly where dropped in the destination group
- Visual feedback during dragging with color changes

#### Moving Swimmers
- Swimmers can be dragged between groups (even across different animals)
- Visual feedback during dragging
- Real-time updates to swimmer counts

### 4. Single-User Locking System

The Camp Organizer implements a robust locking mechanism to prevent concurrent editing:

- **Automatic Lock Acquisition**: When a user loads a camp, the system automatically attempts to acquire a lock
- **Lock Duration**: Locks expire after 30 minutes of inactivity
- **Lock Monitoring**: The system checks lock status every 5 seconds
- **Lock Notifications**: 
  - If another user takes the lock, you'll be notified immediately
  - A yellow banner displays who currently has the lock
  - All editing controls are disabled when you don't have the lock

### 5. Change Tracking
- The system tracks all changes made to group assignments
- A blue notification appears when unsaved changes exist
- Changes are only applied when "Save All Changes" is clicked
- Cancel button discards all changes and reverts to original data

### 6. Bulk Save Operation
- All changes are saved in a single operation
- Updates both instructor and swimmer assignments
- Automatically recalculates swimmer_grouping metadata
- Success/error messages provide clear feedback

### 7. Archived Group Toggle
- Archived groups are hidden by default to keep the workspace focused on active rosters
- Use the "Show archived groups" checkbox (next to the camp selector) to explicitly include archived groups
- Archived groups are only fetched from the server when this toggle is enabled, reducing data noise

## Permissions

**Access Control**: Only users with `manage_options` capability (typically Administrators) can open the Camp Organizer tab.

The permission check occurs at multiple levels:
1. Lesson Management dashboard capability (`view_lesson_dashboard`) gates access to the SPA itself
2. Camp Organizer REST API endpoints validate `manage_options`
3. The React component shows an access denied message if the permission probe fails

## Technical Implementation

### Key Files

- `/src/components/CampOrganizer.js` – React component that renders the organizer UI, locking, and drag-and-drop logic
- `/src/index.js` – Registers the orange “Camp Organizer” tab alongside Groups/Swimmers/Evaluations
- `/includes/rest-api.php` – REST API endpoints under `lm/v1/camp-organizer/*`
- `/includes/frontend-assets.php` – Enqueues the single Lesson Management bundle used across all tabs
- `/admin/admin-page.php` – Registers the main Lesson Dashboard menu entry (the organizer now lives inside this page)
- `/package.json` – Builds a single `assets/js/index.js` bundle now that no standalone camp organizer entry point exists

### REST API Endpoints

All endpoints are registered under `/wp-json/lm/v1/camp-organizer/`

#### 1. Check Permission
- **Endpoint**: `GET /check-permission`
- **Purpose**: Check if current user has access
- **Returns**: `{ has_permission: boolean }`

#### 2. Load Camp Data
- **Endpoint**: `GET /load?camp_id={id}`
- **Optional Query Param**: `include_archived=1` to include archived groups (defaults to `0`/false)
- **Purpose**: Fetch all groups organized by animal for a specific camp
- **Returns**: 
```json
{
  "data": {
    "animal_id": {
      "instructors": [1, 2, 3],
      "groups": [
        {
          "id": 123,
          "name": "Group Name",
          "level": "Level 1",
          "instructors": [1],
          "swimmers": [10, 11, 12]
        }
      ]
    }
  },
  "locked": false,
  "locked_by": ""
}
```

#### 3. Save Changes
- **Endpoint**: `POST /save`
- **Body**: 
```json
{
  "camp_id": 5,
  "updates": [
    {
      "group_id": 123,
      "instructors": [1, 2],
      "swimmers": [10, 11, 12, 13]
    }
  ]
}
```
- **Purpose**: Apply all changes to groups
- **Returns**: `{ success: true, message: "..." }`

#### 4. Acquire Lock
- **Endpoint**: `POST /acquire-lock`
- **Body**: `{ camp_id: 5 }`
- **Purpose**: Acquire editing lock for a camp
- **Lock Duration**: 30 minutes
- **Returns**: `{ success: true, message: "Lock acquired" }`

#### 5. Release Lock
- **Endpoint**: `POST /release-lock`
- **Body**: `{ camp_id: 5 }`
- **Purpose**: Release editing lock
- **Returns**: `{ success: true, message: "Lock released" }`

#### 6. Check Lock Status
- **Endpoint**: `GET /check-lock?camp_id={id}`
- **Purpose**: Check current lock status
- **Returns**: `{ locked: boolean, locked_by: "Username" }`

### Lock Implementation Details

Locks are implemented using WordPress transients:
- **Key Format**: `lm_camp_organizer_lock_{camp_id}`
- **Data Stored**: 
```php
[
  'user_id' => 123,
  'user_name' => 'John Doe',
  'timestamp' => 1234567890
]
```
- **Expiration**: 30 minutes (1800 seconds)
- **Automatic Cleanup**: WordPress handles transient expiration automatically

### State Management

The component maintains several state variables:
- `campData` - Current state of all groups and assignments
- `originalData` - Snapshot of data when loaded (for cancel/reset)
- `hasChanges` - Boolean flag indicating unsaved changes
- `isLocked` - Whether another user has the lock
- `lockedBy` - Name of user who has the lock
- `lockCheckInterval` - Interval ID for periodic lock checking

### Drag-and-Drop Implementation

Using `react-beautiful-dnd`:
- Two drag types: `INSTRUCTOR` and `SWIMMER`
- Horizontal droppable zones for instructors
- Vertical droppable zones for swimmers within groups
- Visual feedback with background color changes during drag
- Disabled when locked or user lacks permission

## Usage Workflow

1. **Open** the Lesson Management dashboard (Lessons → Lesson Dashboard) and select the orange **Camp Organizer** tab next to Evaluations
2. **Select** a camp from the dropdown (optionally enable **Show archived groups** if you need to reference past rosters)
3. **Wait** for data to load (lock is automatically acquired)
4. **Organize**:
   - Drag instructors between animals
   - Drag swimmers between groups
5. **Save** by clicking "Save All Changes"
6. **Monitor** the lock status - if someone else needs to edit, navigate away (or switch tabs) to release your lock

## Best Practices

1. **Complete your edits quickly** - Locks expire after 30 minutes
2. **Save regularly** - Don't let unsaved changes accumulate
3. **Navigate away** when done - This releases the lock for others
4. **Check for notifications** - The system will alert you if you lose the lock
5. **Don't refresh** the page with unsaved changes - They will be lost

## Troubleshooting

### Can't Acquire Lock
- Another user is currently editing the camp
- Wait for them to finish or contact them directly
- Locks expire after 30 minutes of inactivity

### Changes Not Saving
- Check if you still have the lock (look for yellow banner)
- Verify you have administrator permissions
- Check browser console for error messages

### Drag-and-Drop Not Working
- Ensure you're not in read-only mode (yellow lock banner)
- Check that you have administrator permissions
- Try refreshing the page and reloading the camp

### Groups Not Appearing
- Verify groups are assigned to the selected camp taxonomy
- Check that groups are published (not drafts)
- Try selecting a different camp and coming back

## Future Enhancements (Potential)

1. Force unlock capability for super admins
2. Lock activity logging
3. Real-time collaborative editing with conflict resolution
4. Undo/redo functionality
5. Bulk instructor assignment tools
6. Print/export camp organization
7. Mobile-responsive improvements
8. Keyboard shortcuts for power users
