import re

with open('src/components/TaskCardModal.tsx', 'r') as f:
    content = f.read()

# Remove assignmentType state
content = re.sub(
    r"    // Assignment type toggle\n    const \[assignmentType, setAssignmentType\] = useState<'user' \| 'role'>\(\n        card\.assigned_to_role_id \? 'role' : 'user'\n    \);\n    const \[assignedToRole, setAssignedToRole\] = useState<number \| null>\(card\.assigned_to_role_id \|\| null\);",
    "    const [assignedToRole, setAssignedToRole] = useState<number | null>(card.assigned_to_role_id || null);",
    content
)

# Remove assignmentType from dependency array
content = re.sub(
    r", assignmentType\]\);",
    "]);",
    content
)

# Update saveCardDetailsImmediate function
content = re.sub(
    r"if \(assignmentType === 'user'\) \{\n            updateData\.assigned_to = assignedTo;\n        \} else if \(assignmentType === 'role'\) \{\n            updateData\.assigned_to_role = assignedToRole;\n        \}",
    "assigned_to: assignedTo,\n            assigned_to_role: assignedToRole,",
    content
)

# Update saveCardDetails function - more complex pattern
content = re.sub(
    r"// Only include the assignment field that's currently active\n            if \(assignmentType === 'user'\) \{\n                updateData\.assigned_to = assignedTo;\n            \} else if \(assignmentType === 'role'\) \{\n                updateData\.assigned_to_role = assignedToRole;\n            \}",
    "assigned_to: assignedTo,\n                assigned_to_role: assignedToRole,",
    content
)

with open('src/components/TaskCardModal.tsx', 'w') as f:
    f.write(content)

print("Fixed assignment logic in save functions")
