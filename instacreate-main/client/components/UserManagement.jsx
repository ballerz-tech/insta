import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Users, Shield } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'staff',
    permissions: []
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const permissionCategories = {
    'Profile Management': [
      { key: 'view_profiles', label: 'View Profiles', description: 'Can see existing profiles' },
      { key: 'create_profiles', label: 'Create Profiles', description: 'Can create new profiles' },
      { key: 'use_profiles', label: 'Use Profiles', description: 'Can launch and close profiles' },
      { key: 'delete_profiles', label: 'Delete Profiles', description: 'Can delete profiles' }
    ],
    'System Management': [
      { key: 'manage_users', label: 'Manage Users', description: 'Can create, edit, and delete users' },
      { key: 'view_analytics', label: 'View Analytics', description: 'Can access analytics dashboard' },
      { key: 'manage_settings', label: 'Manage Settings', description: 'Can modify system settings' }
    ]
  };

  const predefinedRoles = {
    admin: ['all'],
    staff_create_only: ['view_profiles', 'create_profiles'],
    staff_create_use: ['view_profiles', 'create_profiles', 'use_profiles']
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api';
      const response = await fetch(`${API_URL}/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api';
      const url = editingUser 
        ? `${API_URL}/auth/users/${editingUser.id}`
        : `${API_URL}/auth/users`;
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        fetchUsers();
        setIsModalOpen(false);
        resetForm();
      } else {
        const error = await response.json();
        alert(error.error || 'Operation failed');
      }
    } catch (error) {
      alert('Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api';
      const response = await fetch(`${API_URL}/auth/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchUsers();
      } else {
        alert('Failed to delete user');
      }
    } catch (error) {
      alert('Failed to delete user');
    }
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', role: 'staff', permissions: [] });
    setEditingUser(null);
  };

  const handleRoleChange = (role) => {
    setFormData({
      ...formData,
      role,
      permissions: predefinedRoles[role] || []
    });
  };

  const handlePermissionToggle = (permission) => {
    const newPermissions = formData.permissions.includes(permission)
      ? formData.permissions.filter(p => p !== permission)
      : [...formData.permissions, permission];
    
    setFormData({ ...formData, permissions: newPermissions });
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : []
    });
    setIsModalOpen(true);
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'staff_create_only': return 'Staff (Create Only)';
      case 'staff_create_use': return 'Staff (Create & Use)';
      default: return 'Custom Staff';
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            User Management
          </h1>
          <p className="text-gray-600 mt-1">Manage staff accounts and permissions</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Plus size={20} />
          <span>Add User</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-300 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center">
              <Users className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-300 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Administrators</p>
              <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role === 'admin').length}</p>
            </div>
            <div className="w-12 h-12 bg-gray-500/20 flex items-center justify-center">
              <Shield className="text-gray-700" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-300 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Staff Members</p>
              <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role !== 'admin').length}</p>
            </div>
            <div className="w-12 h-12 bg-gray-500/20 flex items-center justify-center">
              <Users className="text-gray-700" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-300 shadow-lg">
        <div className="p-6 border-b border-gray-300">
          <h2 className="text-xl font-semibold text-gray-900">Users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Permissions</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-all duration-200">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 flex items-center justify-center text-gray-700 font-bold text-sm mr-3">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        <div className="text-xs text-gray-600">ID: {user.id.slice(-6)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {getRoleDisplay(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {Array.isArray(user.permissions) && user.permissions.includes('all') ? (
                      <span className="text-purple-600">All Permissions</span>
                    ) : (
                      <span>{Array.isArray(user.permissions) ? user.permissions.length : 0} permissions</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 hover:bg-gray-100 transition-colors"
                      >
                        <Edit size={16} className="text-gray-600" />
                      </button>
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-2 hover:bg-gray-100 transition-colors"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-300 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-300">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password {editingUser && '(leave blank to keep current)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={!editingUser}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Administrator (All Permissions)</option>
                  <option value="staff_create_only">Staff - Create Profiles Only</option>
                  <option value="staff_create_use">Staff - Create & Use Profiles</option>
                  <option value="custom">Custom Permissions</option>
                </select>
              </div>

              {formData.role === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4">Permissions</label>
                  <div className="space-y-6">
                    {Object.entries(permissionCategories).map(([category, permissions]) => (
                      <div key={category}>
                        <h4 className="text-sm font-medium text-blue-600 mb-3">{category}</h4>
                        <div className="grid grid-cols-1 gap-3">
                          {permissions.map((permission) => (
                            <label key={permission.key} className="flex items-start space-x-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.key)}
                                onChange={() => handlePermissionToggle(permission.key)}
                                className="mt-1 w-4 h-4 text-blue-600 bg-white border-gray-300 focus:ring-blue-500"
                              />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{permission.label}</div>
                                <div className="text-xs text-gray-600">{permission.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-300">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white transition-all duration-200 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;