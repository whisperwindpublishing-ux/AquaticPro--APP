import re

with open('src/components/TaskCardModal.tsx', 'r') as f:
    content = f.read()

# Find and replace the entire assignment UI section
old_ui = r'{/\* Assignment \*/}.*?</div>\s*{/\* Location \*/}'

new_ui = '''{/* User Assignment */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <HiOutlineUser className="w-5 h-5" />
                                    Assign to User
                                </label>
                                <select
                                    value={assignedTo || ''}
                                    onChange={(e) => {
                                        setAssignedTo(e.target.value ? Number(e.target.value) : null);
                                    }}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-blue"
                                >
                                    <option value="">Unassigned</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.firstName} {user.lastName}
                                        </option>
                                    ))}
                                </select>
                                {users.length === 0 && (
                                    <p className="text-xs text-gray-500 mt-1">Loading users...</p>
                                )}
                            </div>

                            {/* Role Assignment */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <HiOutlineUser className="w-5 h-5" />
                                    Assign to Role
                                </label>
                                <select
                                    value={assignedToRole || ''}
                                    onChange={(e) => {
                                        setAssignedToRole(e.target.value ? Number(e.target.value) : null);
                                    }}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-blue"
                                >
                                    <option value="">No Role Selected</option>
                                    {roles.map((role) => (
                                        <option key={role.role_id} value={role.role_id}>
                                            {role.role_name} {role.tier ? `(Tier ${role.tier})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Location */}'''

content = re.sub(old_ui, new_ui, content, flags=re.DOTALL)

with open('src/components/TaskCardModal.tsx', 'w') as f:
    f.write(content)

print("Fixed UI section")
