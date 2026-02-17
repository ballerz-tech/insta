import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

const BulkOperationsModal = ({ isOpen, onClose, onBulkCreate, onBulkDelete, profiles }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [createData, setCreateData] = useState({
    count: 5,
    deviceType: 'ios',
    prefix: 'Profile'
  });
  const [selectedProfiles, setSelectedProfiles] = useState([]);

  const deviceTypes = [
    { value: 'ios', label: 'iOS Devices (iPhone/iPad)' },
    { value: 'android', label: 'Android Devices' },
    { value: 'windows', label: 'Windows Desktop' },
    { value: 'macos', label: 'macOS Desktop' },
    { value: 'random', label: 'Random Mix' }
  ];

  const handleBulkCreate = () => {
    onBulkCreate(createData.count, createData.deviceType, createData.prefix);
    onClose();
  };

  const handleBulkDelete = () => {
    if (selectedProfiles.length === 0) {
      alert('Please select profiles to delete');
      return;
    }
    if (window.confirm(`Delete ${selectedProfiles.length} profiles?`)) {
      onBulkDelete(selectedProfiles);
      setSelectedProfiles([]);
      onClose();
    }
  };

  const toggleProfile = (profileName) => {
    setSelectedProfiles(prev => 
      prev.includes(profileName) 
        ? prev.filter(name => name !== profileName)
        : [...prev, profileName]
    );
  };

  const selectAll = () => {
    setSelectedProfiles(Object.keys(profiles));
  };

  const clearSelection = () => {
    setSelectedProfiles([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-0">
      <div className="bg-white rounded-none shadow-none w-full max-w-2xl max-h-full overflow-y-auto text-gray-900 h-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Bulk Operations</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-none">
            <X size={20} className="text-gray-700" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-none ${activeTab === 'create' ? 'bg-gray-300 text-gray-900' : 'bg-gray-200 text-gray-900'}`}
            >
              <Plus size={16} className="inline mr-2" />
              Bulk Create
            </button>
            <button
              onClick={() => setActiveTab('delete')}
              className={`px-4 py-2 rounded-none ${activeTab === 'delete' ? 'bg-gray-300 text-gray-900' : 'bg-gray-200 text-gray-900'}`}
            >
              <Trash2 size={16} className="inline mr-2" />
              Bulk Delete
            </button>
          </div>

          {activeTab === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Number of Profiles
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={createData.count}
                  onChange={(e) => setCreateData(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Device Type
                </label>
                <select
                  value={createData.deviceType}
                  onChange={(e) => setCreateData(prev => ({ ...prev, deviceType: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  {deviceTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Name Prefix
                </label>
                <input
                  type="text"
                  value={createData.prefix}
                  onChange={(e) => setCreateData(prev => ({ ...prev, prefix: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Profiles will be named: {createData.prefix}_1, {createData.prefix}_2, etc.
                </p>
              </div>
              
              <button
                onClick={handleBulkCreate}
                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-none transition text-gray-900"
              >
                Create {createData.count} Profiles
              </button>
            </div>
          )}

          {activeTab === 'delete' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">
                  Selected: {selectedProfiles.length} / {Object.keys(profiles).length}
                </span>
                <div className="space-x-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-none text-sm text-gray-900"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-none text-sm text-gray-900"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
                <div className="max-h-60 overflow-y-auto border border-gray-600 rounded-none">
                {Object.keys(profiles).map(profileName => (
                  <label key={profileName} className="flex items-center p-3 hover:bg-gray-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProfiles.includes(profileName)}
                      onChange={() => toggleProfile(profileName)}
                      className="mr-3"
                    />
                    <span className="flex-1 text-gray-900">{profileName}</span>
                    <span className="text-xs text-gray-600">
                      {profiles[profileName].proxy ? 'With Proxy' : 'No Proxy'}
                    </span>
                  </label>
                ))}
              </div>
              
              <button
                onClick={handleBulkDelete}
                disabled={selectedProfiles.length === 0}
                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-none transition text-gray-900"
              >
                Delete {selectedProfiles.length} Profiles
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkOperationsModal;