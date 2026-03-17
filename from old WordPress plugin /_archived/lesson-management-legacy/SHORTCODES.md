# Frontend Shortcodes - Quick Reference

## Shortcode Summary

| Shortcode | Purpose | Required Capability | Usage |
|-----------|---------|-------------------|-------|
| `[lesson_management_app]` | Full React app interface | `view_lesson_dashboard` | Add to any page/post |
| `[lesson_email_evaluations]` | Email evaluations interface | `view_bulk_email_page` | Add to any page/post |

## Quick Setup

### 1. Create Pages
```
Page 1: "Lesson Manager"
Content: [lesson_management_app]

Page 2: "Email Evaluations"  
Content: [lesson_email_evaluations]
```

### 2. Set Permissions
```
Lessons → Settings → Select allowed roles for dashboard
Lessons → Email Settings → Select allowed roles for email
```

### 3. Add to Menu
```
Appearance → Menus → Add both pages to your menu
```

## Permission Capabilities

Both shortcodes check user permissions before displaying content:

- **Lesson Management App**: Requires `view_lesson_dashboard`
- **Email Evaluations**: Requires `view_bulk_email_page`

Configure role permissions in the WordPress admin:
- **Lessons → Settings** (for dashboard access)
- **Lessons → Email Settings** (for email access)

## Features Available

### Lesson Management App (`[lesson_management_app]`)
✓ Manage Groups (with exclusive editing/locks)
✓ Manage Swimmers
✓ Create/Edit Evaluations
✓ Manage Skills and Levels
✓ Manage Camps, Animals, Lesson Types
✓ Real-time conflict detection
✓ Lock takeover system

### Email Evaluations (`[lesson_email_evaluations]`)
✓ Send evaluation emails
✓ Select swimmers/groups
✓ Choose existing evaluations
✓ Preview email content
✓ Bulk email functionality

## Common Use Cases

### For Swim Instructors
Create a "Staff Portal" page with both shortcodes, give instructors the appropriate capabilities, and they never need to see the WordPress admin.

### For Program Directors
Use the dashboard shortcode on a dedicated management page, separate from your main website navigation.

### For Multi-Site Installations
Each site can have its own frontend lesson management interface while sharing the plugin.
