import React, { useState, useEffect } from 'react';
import { Users, Layers, Settings, Shield, BarChart3, Globe, Menu, X, UserCog, LogOut } from 'lucide-react';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api';

const Sidebar = ({ isCollapsed, setIsCollapsed, currentPage, setCurrentPage, user, onLogout, profiles = {} }) => {
  const [counts, setCounts] = useState({ profiles: 0, groups: 0, proxies: 0, banned: 0 });

  useEffect(() => {
    fetchCounts();
  }, []);

  // Calculate profile counts from passed profiles prop
  useEffect(() => {
    const total = Object.keys(profiles || {}).length;
    const bannedCount = Object.values(profiles || {}).filter(p => p?.status === 'banned').length;
    const activeCount = total - bannedCount;
    setCounts(prev => ({ ...prev, profiles: activeCount, banned: bannedCount }));
  }, [profiles]);

  const fetchCounts = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Fetch groups
      try {
        const groupsRes = await fetch(`${API_URL}/groups`, { headers });
        if (groupsRes.ok) {
          const groups = await groupsRes.json();
          setCounts(prev => ({ ...prev, groups: Array.isArray(groups) ? groups.length : 0 }));
        }
      } catch (e) { /* ignore */ }
      
      // Fetch proxies
      try {
        const proxiesRes = await fetch(`${API_URL}/proxies`, { headers });
        if (proxiesRes.ok) {
          const proxies = await proxiesRes.json();
          setCounts(prev => ({ ...prev, proxies: Array.isArray(proxies) ? proxies.length : 0 }));
        }
      } catch (e) { /* ignore */ }
      
    } catch (error) {
      console.error('Failed to fetch counts:', error);
    }
  };

  const getMenuItems = () => {
    const baseItems = [];
    const permissions = user?.permissions || [];
    const hasPermission = (permission) => Array.isArray(permissions) && (permissions.includes('all') || permissions.includes(permission));
    
    if (hasPermission('view_profiles')) {
      baseItems.push({ id: 'profiles', icon: Users, label: 'Profiles', count: counts.profiles });
      baseItems.push({ id: 'banned', icon: Shield, label: 'Banned Accounts', count: counts.banned || 0 });
    }
    if (hasPermission('all') || hasPermission('create_profiles')) {
      baseItems.push({ id: 'groups', icon: Layers, label: 'Groups', count: counts.groups });
      baseItems.push({ id: 'proxies', icon: Shield, label: 'Proxies', count: counts.proxies });
    }
    if (hasPermission('view_analytics')) {
      baseItems.push({ id: 'analytics', icon: BarChart3, label: 'Analytics' });
    }
    if (hasPermission('manage_settings')) {
      baseItems.push({ id: 'settings', icon: Settings, label: 'Settings' });
    }
    if (hasPermission('manage_users')) {
      baseItems.push({ id: 'users', icon: UserCog, label: 'User Management' });
    }
    
    return baseItems;
  };
  
  const menuItems = getMenuItems();

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-gray-300 flex flex-col shadow-lg transition-all duration-300`}>
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-300">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
            >
              <Menu size={20} />
            </button>
          ) : (
            <>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Globe className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    WebProxy
                  </h1>
                  <p className="text-xs text-gray-500">Browser Manager</p>
                </div>
              </div>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-2 hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
              >
                <X size={20} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-grow p-4 space-y-2">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={index}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-3 transition-all duration-200 group ${
                isActive
                  ? 'bg-gray-100 border border-gray-200 text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
                <div className={`p-2 transition-colors ${
                  isActive 
                    ? 'bg-gray-700 text-white shadow' 
                    : 'bg-gray-200 group-hover:bg-gray-300'
                }`}>
                  <Icon size={18} />
                </div>
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
              </div>
                {!isCollapsed && item.count && (
                <span className={`px-2 py-1 text-xs font-medium ${
                  isActive
                    ? 'bg-gray-300 text-gray-900'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Section */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-300">
          <div className="flex items-center space-x-3 p-3 bg-gray-100 border border-gray-300 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.username || 'User'}</p>
              <p className="text-xs text-gray-500">{user?.role === 'admin' ? 'Administrator' : 'Staff Member'}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200"
          >
            <div className="p-2 bg-gray-200">
              <LogOut size={18} />
            </div>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;