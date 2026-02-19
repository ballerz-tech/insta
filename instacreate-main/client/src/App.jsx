// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { MoreVertical, Plus, Eye } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Login from '../components/Login';
import UserManagement from '../components/UserManagement';
import CreateProfileModal from '../components/CreateProfileModal';
import ProfileDetailsModal from '../components/ProfileDetailsModal';
import BulkOperationsModal from '../components/BulkOperationsModal';
import ImportExportModal from '../components/ImportExportModal';
import ChangeProxyModal from '../components/ChangeProxyModal';
import InstagramAutomationModal from '../components/InstagramAutomationModal';
import ProfileOptionsModal from '../components/ProfileOptionsModal';
import BrowserViewerModal from '../components/BrowserViewerModal';
import Groups from '../components/Groups';
import Proxies from '../components/Proxies';
import Analytics from '../components/Analytics';
import Settings from '../components/Settings';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profiles, setProfiles] = useState({});
  const [profileStatus, setProfileStatus] = useState({});

  // --- STATE FOR THE MODALS ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [isChangeProxyModalOpen, setIsChangeProxyModalOpen] = useState(false);
  const [selectedProfileForProxy, setSelectedProfileForProxy] = useState(null);
  const [isInstagramAutomationModalOpen, setIsInstagramAutomationModalOpen] = useState(false);
  const [isProfileOptionsModalOpen, setIsProfileOptionsModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedProfileName, setSelectedProfileName] = useState('');
  const [selectedProfileConfig, setSelectedProfileConfig] = useState(null);
  const [currentPage, setCurrentPage] = useState('profiles');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isBrowserViewerOpen, setIsBrowserViewerOpen] = useState(false);
  const [browserViewerProfile, setBrowserViewerProfile] = useState(null);

  const fetchProfiles = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/profiles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        handleLogout();
        return;
      }
      
      const data = await response.json();
      setProfiles(data);
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Check for existing authentication
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
      // Poll for profile updates every 5 seconds to catch server-side ban detection
      const profilePollInterval = setInterval(() => {
        fetchProfiles();
      }, 5000);
      return () => clearInterval(profilePollInterval);
    }
  }, [fetchProfiles, isAuthenticated]);

  useEffect(() => {
    const fetchStatus = async () => {
      if (Object.keys(profiles).length === 0 || !isAuthenticated) return;
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 401) {
          handleLogout();
          return;
        }
        
        const runningProfiles = await response.json();
        const newStatus = {};
        Object.keys(profiles).forEach(name => {
          newStatus[name] = Array.isArray(runningProfiles) && runningProfiles.includes(name) ? 'running' : 'stopped';
        });
        setProfileStatus(prevStatus => ({ ...prevStatus, ...newStatus }));
      } catch (error) {
        console.error("Failed to fetch status:", error);
      }
    };
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, [profiles, isAuthenticated]);
  


  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    setProfiles({});
    setProfileStatus({});
  };
  
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };
  
  const handleCreate = async (name, config) => {
    try {
      const response = await fetch(`${API_URL}/profiles`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, config }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to create profile: ${errorData.error}`);
        return;
      }
      setIsModalOpen(false);
      fetchProfiles();
    } catch (error) {
      console.error("Failed to create profile:", error);
      alert("Failed to create profile. Check console for details.");
    }
  };

  const handleViewDetails = (name, config) => {
    setSelectedProfile(config);
    setSelectedProfileName(name);
    setIsDetailsModalOpen(true);
  };

  const handleOpenProfileOptions = (name, config) => {
    setSelectedProfileName(name);
    setSelectedProfileConfig(config);
    setIsProfileOptionsModalOpen(true);
  };
  
  const handleDelete = async (name) => {
    if (window.confirm(`Are you sure you want to delete profile "${name}"?`)) {
      try {
        const response = await fetch(`${API_URL}/profiles/delete`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          alert(`Failed to delete profile: ${errorData.error}`);
          return;
        }
        fetchProfiles();
      } catch (error) {
        console.error("Failed to delete profile:", error);
        alert("Failed to delete profile. Check console for details.");
      }
    }
  };

  const handleBulkCreate = async (count, deviceType, prefix) => {
    try {
      const response = await fetch(`${API_URL}/profiles/bulk-create`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ count, deviceType, prefix }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to create profiles: ${errorData.error}`);
        return;
      }
      fetchProfiles();
    } catch (error) {
      console.error("Failed to create profiles:", error);
      alert("Failed to create profiles. Check console for details.");
    }
  };

  const handleBulkDelete = async (names) => {
    try {
      const response = await fetch(`${API_URL}/profiles/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ names }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to delete profiles: ${errorData.error}`);
        return;
      }
      fetchProfiles();
    } catch (error) {
      console.error("Failed to delete profiles:", error);
      alert("Failed to delete profiles. Check console for details.");
    }
  };

  const handleDisableProxy = async (name) => {
    try {
      const response = await fetch(`${API_URL}/profiles/disable-proxy`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to disable proxy: ${errorData.error}`);
        return;
      }
      fetchProfiles();
    } catch (error) {
      console.error("Failed to disable proxy:", error);
      alert("Failed to disable proxy. Check console for details.");
    }
  };

  const handleRename = async (oldName) => {
    const newName = prompt(`Enter new name for profile "${oldName}":`, oldName);
    if (!newName || newName === oldName) return;
    
    try {
      const response = await fetch(`${API_URL}/profiles/rename`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ oldName, newName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to rename profile: ${errorData.error}`);
        return;
      }
      fetchProfiles();
    } catch (error) {
      console.error("Failed to rename profile:", error);
      alert("Failed to rename profile. Check console for details.");
    }
  };

  const handleChangeProxy = (name, config) => {
    setSelectedProfileForProxy({ name: name || selectedProfileName, config: config || selectedProfileConfig });
    setIsChangeProxyModalOpen(true);
  };

  const handleProxyChange = async (newProxy) => {
    try {
      const response = await fetch(`${API_URL}/profiles/change-proxy`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: selectedProfileForProxy.name, proxy: newProxy }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to change proxy: ${errorData.error}`);
        return;
      }
      fetchProfiles();
    } catch (error) {
      console.error("Failed to change proxy:", error);
      alert("Failed to change proxy. Check console for details.");
    }
  };

  const handleInstagramAutomation = async (targetUsername, profileCount) => {
    try {
      const response = await fetch(`${API_URL}/automation/instagram-follow`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ target: targetUsername, count: profileCount }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Automation failed');
      }
    } catch (error) {
      console.error("Instagram automation failed:", error);
      throw error;
    }
  };

  const handleLaunch = async (name) => {
    setProfileStatus(prev => ({ ...prev, [name]: 'opening' }));
    await fetch(`${API_URL}/profiles/launch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    // Open the browser viewer to show the remote Chrome session
    setBrowserViewerProfile(name);
    setIsBrowserViewerOpen(true);
    // Check for ban detection after 3 seconds
    setTimeout(() => {
      fetchProfiles();
    }, 3000);
  };

  const handleClose = async (name) => {
    setProfileStatus(prev => ({ ...prev, [name]: 'closing' }));
    await fetch(`${API_URL}/profiles/close`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
  };

  const getButton = (name) => {
    const status = profileStatus[name];
    if (status === 'opening') return <button className="px-4 py-2 text-sm bg-gradient-to-r from-yellow-500 to-orange-500 text-white cursor-not-allowed shadow-lg">Opening...</button>;
    if (status === 'closing') return <button className="px-4 py-2 text-sm bg-gradient-to-r from-gray-500 to-gray-600 text-white cursor-not-allowed shadow-lg">Closing...</button>;
    if (status === 'running') return <button onClick={() => handleClose(name)} className="px-4 py-2 text-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg transition-all duration-200">Close</button>;
    return <button onClick={() => handleLaunch(name)} className="px-4 py-2 text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg transition-all duration-200">Launch</button>;
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'users':
        return <UserManagement />;
      case 'groups':
        return <Groups />;
      case 'proxies':
        return <Proxies />;
      case 'analytics':
        return <Analytics />;
      case 'settings':
        return <Settings />;
      case 'banned':
        return renderBannedPage();
      default:
        return renderProfilesPage();
    }
  };

  const hasPermission = (permission) => {
    const permissions = user?.permissions || [];
    return Array.isArray(permissions) && (permissions.includes('all') || permissions.includes(permission));
  };
  
  const renderProfilesPage = () => (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Browser Profiles</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasPermission('create_profiles') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-black font-medium px-4 py-2 shadow-sm transition-all duration-150"
            >
                <Plus size={20} className="text-black" />
              <span>Create Profile</span>
            </button>
          )}
          {hasPermission('create_profiles') && (
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-black font-medium px-4 py-2 shadow-sm transition-all duration-150"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
              <span>Bulk Operations</span>
            </button>
          )}
          {hasPermission('create_profiles') && (
            <button
              onClick={() => setIsImportExportModalOpen(true)}
              className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 text-black font-medium px-4 py-2 shadow-sm transition-all duration-150"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" />
              </svg>
              <span>Import/Export</span>
            </button>
          )}
          {hasPermission('use_profiles') && (
            <button
              onClick={() => setIsInstagramAutomationModalOpen(true)}
              disabled={Object.keys(profiles).length === 0}
              className="flex items-center space-x-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-200 disabled:opacity-60 text-black font-medium px-4 py-2 shadow-sm transition-all duration-150 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              <span>Instagram Automation</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 border border-gray-300 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Profiles</p>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(profiles).length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center">
              <Plus className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 border border-gray-300 shadow-lg">
          <div className="flex items-center">
            <div>
              <p className="text-gray-600 text-sm font-medium">Active Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{Object.values(profileStatus).filter(s => s === 'running').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 border border-gray-300 shadow-lg">
          <div className="flex items-center">
            <div>
              <p className="text-gray-600 text-sm font-medium">With Proxy</p>
              <p className="text-2xl font-bold text-gray-900">{Object.values(profiles).filter(p => p.proxy).length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-300 shadow-lg overflow-visible">
        <div className="p-6 border-b border-gray-300">
          <h2 className="text-xl font-semibold text-gray-900">Profile Management</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Profile</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Proxy</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Browser</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Remark</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(() => {
                const active = Object.entries(profiles).filter(([n, c]) => (c?.status || 'active') !== 'banned');
                return (
                  <>
                    {active.map(([name, config]) => (
                      <tr key={name} className="hover:bg-gray-50 transition-all duration-200">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-emerald-600 flex items-center justify-center text-white font-bold text-sm mr-3">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{name}</div>
                              <div className="text-xs text-gray-500">{config?.created_at ? new Date(config.created_at).toLocaleString() : new Date().toLocaleDateString()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {config?.status === 'banned' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                              <div className="w-1.5 h-1.5 rounded-full mr-1.5 bg-red-400"></div>
                              banned
                            </span>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${profileStatus[name] === 'running' ? 'bg-green-100 text-green-800' : 'bg-green-50 text-green-700'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${profileStatus[name] === 'running' ? 'bg-green-400 animate-pulse' : 'bg-green-300'}`}></div>
                              active{profileStatus[name] ? ` • ${profileStatus[name]}` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {config.proxy ? (
                            <span className="inline-flex items-center px-2 py-1 bg-purple-500/20 text-purple-700 text-xs">
                              <div className="w-2 h-2 bg-purple-500 mr-1"></div>
                              Enabled
                            </span>
                          ) : (
                            <span className="text-gray-500">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <span className="inline-flex items-center px-2 py-1 bg-blue-500/20 text-blue-700 text-xs">
                            {config.user_agent ? (
                              config.user_agent.includes('iPhone') || config.user_agent.includes('iPad') ? 'iOS Safari' :
                              config.user_agent.includes('Android') && config.user_agent.includes('Chrome') ? 'Android Chrome' :
                              config.user_agent.includes('Android') && config.user_agent.includes('Firefox') ? 'Android Firefox' :
                              config.user_agent.includes('Chrome') ? 'Chrome' :
                              config.user_agent.includes('Firefox') ? 'Firefox' : 'Safari'
                            ) : 'Random'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{config.remark || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {hasPermission('use_profiles') && getButton(name)}
                            {hasPermission('create_profiles') && (
                              <button onClick={() => handleMarkBanned(name)} className="px-4 py-2 text-sm bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow transition-all duration-200">Mark Banned</button>
                            )}
                            <button
                              onClick={() => handleOpenProfileOptions(name, config)}
                              className="p-2 hover:bg-gray-200 transition-colors"
                            >
                              <MoreVertical size={18} className="text-gray-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const handleRestore = async (name) => {
    if (!window.confirm(`Restore profile '${name}' to active?`)) return;
    try {
      const response = await fetch(`${API_URL}/profiles/status`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, status: 'active' }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to restore profile: ${errorData.error || 'unknown error'}`);
        return;
      }
      setProfiles(prev => {
        const updated = { ...prev };
        if (updated[name]) updated[name] = { ...updated[name], status: 'active' };
        return updated;
      });
    } catch (error) {
      console.error('Failed to restore profile:', error);
      alert('Failed to restore profile. Check console for details.');
    }
  };

  const handleMarkBanned = async (name) => {
    if (!window.confirm(`Mark profile '${name}' as banned?`)) return;
    try {
      const response = await fetch(`${API_URL}/profiles/status`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, status: 'banned' }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to mark profile banned: ${errorData.error || 'unknown error'}`);
        return;
      }
      setProfiles(prev => {
        const updated = { ...prev };
        if (updated[name]) updated[name] = { ...updated[name], status: 'banned' };
        return updated;
      });
    } catch (error) {
      console.error('Failed to mark profile banned:', error);
      alert('Failed to mark profile banned. Check console for details.');
    }
  };

  const renderBannedPage = () => (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Banned Accounts</h1>
          <p className="text-gray-600 mt-1">Profiles marked as banned</p>
        </div>
      </div>

      <div className="bg-white border border-gray-300 shadow-lg overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Profile</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Proxy</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Remark</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Object.entries(profiles).filter(([n,c]) => (c?.status || 'active') === 'banned').map(([name, config]) => (
                <tr key={name} className="hover:bg-gray-50 transition-all duration-200">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white font-bold text-sm mr-3">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{name}</div>
                        <div className="text-xs text-gray-500">{config?.created_at ? new Date(config.created_at).toLocaleString() : '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{config?.created_at ? new Date(config.created_at).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{config?.proxy ? 'Enabled' : 'None'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{config?.remark || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button onClick={() => handleRestore(name)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">Restore</button>
                      {hasPermission('delete_profiles') && (
                        <button onClick={() => handleDelete(name)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }
  // Count only active (non-banned) profiles for automation selection
  const activeProfilesCount = Object.values(profiles).filter(p => (p?.status || 'active') !== 'banned').length;
  
  return (
    <>
      <div className="flex h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 text-gray-900">
        <Sidebar 
          isCollapsed={isCollapsed} 
          setIsCollapsed={setIsCollapsed}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          user={user}
          onLogout={handleLogout}
          profiles={profiles}
        />
        <main className="flex-1 overflow-auto">
          {renderCurrentPage()}
        </main>
      </div>
      
      <CreateProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
      />
      
      <ProfileDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        profile={selectedProfile}
        profileName={selectedProfileName}
      />
      
      <BulkOperationsModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onBulkCreate={handleBulkCreate}
        onBulkDelete={handleBulkDelete}
        profiles={profiles}
      />
      
      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        onImport={() => {
          fetchProfiles();
        }}
      />
      
      <ChangeProxyModal
        isOpen={isChangeProxyModalOpen}
        onClose={() => setIsChangeProxyModalOpen(false)}
        onSubmit={handleProxyChange}
        profileName={selectedProfileForProxy?.name}
        currentProxy={selectedProfileForProxy?.config?.proxy}
      />
      
      <InstagramAutomationModal
        isOpen={isInstagramAutomationModalOpen}
        onClose={() => setIsInstagramAutomationModalOpen(false)}
        onSubmit={handleInstagramAutomation}
        totalProfiles={activeProfilesCount}
      />
      
      <ProfileOptionsModal
        isOpen={isProfileOptionsModalOpen}
        onClose={() => setIsProfileOptionsModalOpen(false)}
        profileName={selectedProfileName}
        profileConfig={selectedProfileConfig}
        onViewDetails={() => handleViewDetails(selectedProfileName, selectedProfileConfig)}
        onRename={() => handleRename(selectedProfileName)}
        onChangeProxy={() => handleChangeProxy(selectedProfileName, selectedProfileConfig)}
        onDisableProxy={() => handleDisableProxy(selectedProfileName)}
        onDelete={() => handleDelete(selectedProfileName)}
        userPermissions={user?.permissions || []}
      />

      <BrowserViewerModal
        isOpen={isBrowserViewerOpen}
        onClose={() => setIsBrowserViewerOpen(false)}
        profileName={browserViewerProfile}
      />
    </>
  );
}

export default App;