# Letter of Intent (LOI) Email Template Placeholders

This document describes the available placeholders for customizing the Letter of Intent email template sent to new hires.

## Overview

When sending a Letter of Intent to new hires, the email template supports dynamic placeholders that are automatically replaced with actual values based on the applicant's information and their assigned job roles and pay configuration.

## Available Placeholders

### Employee Information
| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{employee_first_name}}` | Employee's first name | John |
| `{{employee_last_name}}` | Employee's last name | Doe |
| `{{employee_full_name}}` | Full name | John Doe |
| `{{employee_email}}` | Email address | john.doe@example.com |
| `{{employee_phone}}` | Phone number | (555) 123-4567 |
| `{{employee_dob}}` | Date of birth (formatted) | January 15, 2000 |
| `{{employee_address}}` | Mailing address | 123 Main St, City, ST 12345 |

### Job Role Information
| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{job_roles}}` | All assigned job roles (comma-separated) | Head Lifeguard, Swim Instructor |
| `{{position}}` | Alias for `{{job_roles}}` | Head Lifeguard, Swim Instructor |

**Note:** If the applicant has been approved but not yet assigned job roles, this will display: "New Hire (pending job role assignment)"

### Pay Rate Information

These placeholders require:
1. The applicant has been approved and converted to a WordPress user
2. The user has been assigned job roles (Admin → Users List)
3. Pay configuration has been set up (Admin → Pay Configuration)

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{pay_breakdown}}` | **Complete pay breakdown (RECOMMENDED)** - Auto-generates formatted list with all pay components | See example below |
| `{{total_pay_rate}}` | Total hourly pay rate only | $15.50/hr |
| `{{base_rate}}` | Base hourly rate only | $12.00/hr |
| `{{role_bonus}}` | Job role bonus with role name | $2.50/hr (Head Lifeguard) |
| `{{additional_bonuses}}` | Other bonuses (longevity, time-based) | Longevity: $1.00/hr (3 years) |

**💡 Recommended Usage:** Use the single `{{pay_breakdown}}` placeholder instead of manually writing out each component. It automatically includes all applicable pay items in a formatted list.

**`{{pay_breakdown}}` Output Example:**
```
Your Projected Pay Rate: $15.50/hr

Pay Breakdown:
• Base Rate: $12.00/hr
• Job Role Bonus: $2.50/hr (Head Lifeguard)
• Longevity Bonus: $1.00/hr (3 years)
```

**Fallback Values:**
- If pay configuration is not available: Shows "TBD" with message about pending job assignment
- Individual items only appear if they have a value > $0.00

### Organization Information
| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{organization_name}}` | Organization name | AquaticPro Community Center |
| `{{organization_address}}` | Organization address | 456 Pool Lane, City, ST 12345 |
| `{{organization_phone}}` | Organization phone | (555) 987-6543 |
| `{{organization_email}}` | Organization email | info@aquaticpro.org |
| `{{sender_name}}` | LOI sender's name | Jane Smith |
| `{{sender_title}}` | LOI sender's title | Aquatics Director |

### System Information
| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{current_date}}` | Current date (when email is sent) | January 5, 2026 |
| `{{signature}}` | Digital signature image | (Image only shown in PDF) |

## Default Email Template

```
Hello {{employee_first_name}},

Please find attached your Letter of Intent for the {{job_roles}} position(s) at {{organization_name}}.

{{pay_breakdown}}

Please review the letter and keep it for your records. If you need a work permit, please provide this letter to your school counselor.

If you have any questions, please don't hesitate to reach out.

Best regards,
{{sender_name}}
{{organization_name}}
```

## Example Rendered Email

**When sent to an approved applicant with assigned roles:**

```
Hello John,

Please find attached your Letter of Intent for the Head Lifeguard, Swim Instructor position(s) at AquaticPro Community Center.

Your Projected Pay Rate: $15.50/hr

Pay Breakdown:
• Base Rate: $12.00/hr
• Job Role Bonus: $2.50/hr (Head Lifeguard)
• Additional Bonuses: Longevity: $1.00/hr (3 years)

Please review the letter and keep it for your records. If you need a work permit, please provide this letter to your school counselor.

If you have any questions, please don't hesitate to reach out.
Longevity Bonus: $1.00/hr (3 years)

Please review the letter and keep it for your records. If you need a work permit, please provide this letter to your school counselor.

If you have any questions, please don't hesitate to reach out.

Best regards,
Jane Smith
AquaticPro Community Center
```

**When sent to a pending applicant (not yet approved):**

```
Hello John,

Please find attached your Letter of Intent for the New Hire (pending job role assignment) position(s) at AquaticPro Community Center.

Your Projected Pay Rate: TBD/hr

Pay rate details will be provided after job role assignment.
Best regards,
Jane Smith
AquaticPro Community Center
```

## Workflow Recommendations

### Option 1: Send LOI Before Approval (Work Permit Cases)
For applicants who need work permits (to provide to school counselor):
1. Send LOI immediately after application submission
2. Pay information will show "TBD" and "None"
3. Applicant receives letter for work permit processing
4. After approval, assign job roles and pay configuration
5. **Resend LOI** with actual pay rates using the resend button

### Option 2: Send LOI After Job Assignment (Standard)
For standard hiring workflow:
1. Approve application (creates WordPress user)
2. Assign job roles (Admin → Users List → Bulk Edit or Edit User)
3. Verify pay configuration is correct
4. Send LOI with complete pay breakdown
5. Applicant receives accurate pay information

### Resending LOI
You can resend the LOI at any time:
- Click the **Send LOI button** (becomes "Resend LOI" after first send)
- Updates the LOI with current pay rates and job roles
- Sends fresh copy with latest information
- Useful when pay rates or job assignments change

## Customizing the Template

To customize the email template:
1. Go to **Admin → New Hires**
2. Click **LOI Settings** (gear icon)
3. Edit the **Email Body** field
4. Use any placeholders from the tables above
5. Preview the email to see how it will look
6. Save changes

## Technical Notes

### Pay Calculation
- Pay rates are calculated using `AquaticPro_Seasonal_Returns::calculate_pay_rate()`
- Includes: base rate + role bonus + longevity bonus + time bonuses
- Respects pay cap configuration
- Real-time calculation ensures accuracy

### Role Bonus Display
- Shows the highest-tier role's bonus amount
- Displays role name in parentheses
- If multiple roles, shows the primary role bonus

### Additional Bonuses Breakdown
Shows detailed list of:
- **Longevity Bonus**: Amount and years of service
- **Time-Based Bonuses**: Each bonus name and amount
- If none exist, displays "None"

### Placeholder Behavior
- **Missing data**: Shows empty string or "TBD"
- **No user created**: Job roles and pay show default values
- **Case sensitive**: Use exact placeholder format with curly braces
- **Whitespace**: Placeholders are trimmed automatically

## Related Documentation
- [Pay Configuration Guide](./PRD-SEASONAL_RETURN_PAY_MANAGEMENT.md)
- [New Hire Workflow](./README.md)
- [LOI Settings Configuration](./ADMIN_RESTORATION_GUIDE.md)

## Technical Implementation

### LOI Delivery Method
- **Email contains**: Download link (not PDF attachment)
- **Why**: More reliable delivery across all email providers and hosting configurations
- **Download link**: Secure token-based, expires after 30 days
- **User experience**: Click link → View formatted letter → Print or Save as PDF via browser

### Download Page Features
- Professional formatted Letter of Intent
- "Print / Save as PDF" button in toolbar
- Print-optimized styling
- Works on any device/browser

### Email Example
The email includes a styled call-to-action button linking to the download page:
```
📄 Your Letter of Intent
[View & Download Your Letter]
Click the button above to view your Letter of Intent. 
You can print it or save it as a PDF from your browser.
```

### Technical Details
- **Token storage**: WordPress transients (30 day expiration)
- **URL format**: `yoursite.com/?loi_download={token}&app_id={id}`
- **Security**: Token validated before serving LOI content
- **Browser PDF**: Use Ctrl+P / Cmd+P → "Save as PDF" or browser print dialog
