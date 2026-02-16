import React, { useState, useEffect } from 'react';
import { Plus, Shield, Globe, CheckCircle, XCircle, MoreVertical, Trash2 } from 'lucide-react';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api';

const Proxies = () => {
  const [proxies, setProxies] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProxy, setNewProxy] = useState({ name: '', host: '', port: '', username: '', password: '', type: 'http' });

  useEffect(() => {
    fetchProxies();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchProxies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/proxies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProxies(Array.isArray(data) ? data : []);
      } else {
        setProxies([]);
      }
    } catch (error) {
      console.error('Failed to fetch proxies:', error);
      setProxies([]);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/proxies`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newProxy)
      });
      if (response.ok) {
        setNewProxy({ name: '', host: '', port: '', username: '', password: '', type: 'http' });
        setIsModalOpen(false);
        fetchProxies();
      }
    } catch (error) {
      console.error('Failed to create proxy:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this proxy?')) {
      try {
        console.log('Deleting proxy with ID:', id);
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/proxies/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Delete response status:', response.status);
        if (response.ok) {
          console.log('Proxy deleted successfully');
          // Immediately remove from state
          setProxies(prev => prev.filter(proxy => proxy.id !== id));
          // Also fetch to ensure sync
          fetchProxies();
        } else {
          const errorData = await response.json();
          console.error('Delete failed:', errorData);
          alert('Failed to delete proxy: ' + (errorData.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Failed to delete proxy:', error);
        alert('Failed to delete proxy: ' + error.message);
      }
    }
  };

  const toggleStatus = async (id) => {
    const proxy = proxies.find(p => p.id === id);
    const newStatus = proxy.status === 'active' ? 'inactive' : 'active';
    
    try {
      const response = await fetch(`${API_URL}/proxies/${id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        fetchProxies();
      }
    } catch (error) {
      console.error('Failed to update proxy status:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proxy Management</h1>
          <p className="text-gray-600 mt-1">Manage your proxy servers and connections</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Plus size={20} />
          <span>Add Proxy</span>
        </button>
      </div>

      <div className="bg-white border border-gray-300 shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-300">
          <h2 className="text-xl font-semibold text-gray-900">Proxy Servers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Address</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Country</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {proxies.map((proxy) => (
                <tr key={proxy.id} className="hover:bg-gray-50 transition-all duration-200">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-sm mr-3">
                        <Shield size={20} />
                      </div>
                      <div className="text-sm font-medium text-gray-900">{proxy.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono">{proxy.host}:{proxy.port}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs">
                      {proxy.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleStatus(proxy.id)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        proxy.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {proxy.status === 'active' ? (
                        <CheckCircle size={12} className="mr-1" />
                      ) : (
                        <XCircle size={12} className="mr-1" />
                      )}
                      {proxy.status}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{proxy.country}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(proxy.id)}
                      className="p-2 hover:bg-red-100 transition-colors text-red-600"
                      title="Delete proxy"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 shadow-xl w-full max-w-md border border-gray-300">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Proxy</h2>
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={newProxy.name}
                    onChange={(e) => setNewProxy({...newProxy, name: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    value={newProxy.type}
                    onChange={(e) => setNewProxy({...newProxy, type: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks5">SOCKS5</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Host</label>
                  <input
                    type="text"
                    value={newProxy.host}
                    onChange={(e) => setNewProxy({...newProxy, host: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Port</label>
                  <input
                    type="text"
                    value={newProxy.port}
                    onChange={(e) => setNewProxy({...newProxy, port: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={newProxy.username}
                    onChange={(e) => setNewProxy({...newProxy, username: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Optional for HTTP/HTTPS"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={newProxy.password}
                    onChange={(e) => setNewProxy({...newProxy, password: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="Optional for HTTP/HTTPS"
                  />
                </div>
              </div>
              <div className="mb-6">
                <p className="text-xs text-gray-600">
                  💡 SOCKS5 proxies with username/password authentication are fully supported. 
                  Leave credentials empty for proxies without authentication.
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white transition"
                >
                  Add Proxy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Proxies;