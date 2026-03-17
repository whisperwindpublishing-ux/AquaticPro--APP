# Frontend Shortcode Usage

This document explains how to use the Lesson Management plugin on the frontend of your WordPress site, allowing users to access the app without entering the WordPress admin area.

## Available Shortcodes

### 1. Lesson Management App - `[lesson_management_app]`

This shortcode renders the full React-based Lesson Management application on any page or post.

**Features:**
- Full access to Groups, Swimmers, Evaluations, Skills, Levels, Camps, Animals, and Lesson Types
- Identical functionality to the admin dashboard
- Uses the same permission system (`view_lesson_dashboard` capability)

**Usage:**
1. Create a new WordPress Page (e.g., "Lesson Manager")
2. Add the shortcode: `[lesson_management_app]`
3. Publish the page

**Permissions:**
- Only users with the `view_lesson_dashboard` capability can access this page
- By default, administrators have this capability
- To grant access to other roles, go to: **Lessons → Settings** in the WordPress admin and select the allowed roles

**Access Denied Behavior:**
- Users without permission will see a friendly "Access Denied" message
- The message suggests contacting an administrator

---

### 2. Email Evaluations Page - `[lesson_email_evaluations]`

This shortcode renders the Email Evaluations interface on the frontend, allowing instructors to send evaluation emails without accessing the WordPress admin.

**Features:**
- Send evaluation emails to individual swimmers or groups
- Select from existing evaluations
- Preview and customize email content
- Uses the same permission system (`view_bulk_email_page` capability)

**Usage:**
1. Create a new WordPress Page (e.g., "Email Evaluations")
2. Add the shortcode: `[lesson_email_evaluations]`
3. Publish the page

**Permissions:**
- Only users with the `view_bulk_email_page` capability can access this page
- By default, administrators have this capability
- To grant access to other roles, go to: **Lessons → Email Settings** in the WordPress admin and select the allowed roles

**Access Denied Behavior:**
- Users without permission will see a friendly "Access Denied" message
- The message suggests contacting an administrator

---

## Setting Up a Frontend-Only User Experience

To allow users to manage lessons entirely from the frontend without accessing the WordPress admin:

### Step 1: Create Frontend Pages

1. **Create "Lesson Manager" page:**
   - Go to **Pages → Add New**
   - Title: "Lesson Manager"
   - Content: `[lesson_management_app]`
   - Publish

2. **Create "Email Evaluations" page:**
   - Go to **Pages → Add New**
   - Title: "Email Evaluations"
   - Content: `[lesson_email_evaluations]`
   - Publish

### Step 2: Add Pages to Menu

1. Go to **Appearance → Menus**
2. Create a new menu or edit an existing one (e.g., "Main Navigation" or "Member Menu")
3. Add both pages to the menu:
   - Lesson Manager
   - Email Evaluations
4. Save the menu
5. Assign the menu to a theme location (e.g., Primary Menu)

### Step 3: Configure Permissions

1. **For Lesson Manager:**
   - Go to **Lessons → Settings**
   - Check the user roles that should have access to the lesson management app
   - Save changes

2. **For Email Evaluations:**
   - Go to **Lessons → Email Settings**
   - Check the user roles that should have access to email evaluations
   - Save changes

### Step 4: (Optional) Restrict Admin Access

If you want to completely prevent certain users from accessing the WordPress admin area:

1. Install a plugin like "Admin Menu Editor" or "User Role Editor"
2. Create a custom role (e.g., "Lesson Instructor") based on "Subscriber" or "Author"
3. Grant the custom capabilities:
   - `view_lesson_dashboard`
   - `view_bulk_email_page`
4. Use a plugin to redirect users with this role away from `/wp-admin/` to your frontend "Lesson Manager" page

---

## Example Menu Structure

Here's a suggested menu structure for instructors:

```
Main Menu (for logged-in users)
├── Home
├── Lesson Manager [Frontend App]
├── Email Evaluations [Frontend Email Page]
└── My Account
```

---

## Styling the Frontend Pages

The shortcodes include the same Tailwind CSS styles as the admin dashboard. You may want to add custom CSS to your theme to ensure the frontend pages look cohesive:

```css
/* Add to your theme's style.css or Customizer → Additional CSS */

.lm-frontend-app {
    max-width: 1400px;
    margin: 2rem auto;
    padding: 0 1rem;
}

.lm-frontend-email-page {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 1rem;
}

.lm-access-denied {
    max-width: 600px;
    margin: 3rem auto;
}
```

---

## Troubleshooting

### "Access Denied" message appears for authorized users

1. Check that the user's role has been granted the appropriate capability:
   - **Lessons → Settings** for `view_lesson_dashboard`
   - **Lessons → Email Settings** for `view_bulk_email_page`
2. Log out and log back in to refresh user capabilities
3. Check that the user is logged in

### The React app doesn't load

1. Check browser console for JavaScript errors
2. Verify that the plugin is activated
3. Try clearing browser cache and hard refresh (Ctrl+Shift+R)
4. Check that WordPress REST API is accessible at `/wp-json/lm/v1/`

### Styling looks broken

1. Verify that Tailwind CSS is loaded by checking the page source for `tailwind.css`
2. Check for CSS conflicts with your theme
3. Try adding the custom CSS from the "Styling the Frontend Pages" section above

---

## Security Notes

- Both shortcodes respect WordPress user capabilities and permissions
- All REST API requests are authenticated and use WordPress nonces
- Users without proper permissions cannot access the functionality even if they know the page URL
- The same exclusive editing/lock system applies on both admin and frontend

---

## Additional Resources

- **Main Plugin Settings:** Lessons → Settings
- **Email Configuration:** Lessons → Email Settings
- **WordPress User Roles:** Users → Roles (if using a role editor plugin)
- **REST API Testing:** `/wp-json/lm/v1/`
