import React, { useState, useEffect } from 'react';
import { X, Instagram, Users, Play, TrendingUp } from 'lucide-react';

const InstagramAutomationModal = ({ isOpen, onClose, onSubmit, totalProfiles }) => {
  const [targetUsername, setTargetUsername] = useState('');
  const [profileCount, setProfileCount] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [followStats, setFollowStats] = useState({ totalSuccessful: 0, history: [] });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!targetUsername.trim()) {
      alert('Please enter a target username');
      return;
    }
    
    if (profileCount < 1 || profileCount > totalProfiles) {
      alert(`Profile count must be between 1 and ${totalProfiles}`);
      return;
    }

    setIsRunning(true);
    try {
      await onSubmit(targetUsername.replace('@', ''), profileCount);
      alert(`Automation started! ${profileCount} profiles will follow @${targetUsername}`);
      fetchFollowStats(); // Refresh stats after automation
      onClose();
    } catch (error) {
      alert('Failed to start automation: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const fetchFollowStats = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/analytics');
      const data = await response.json();
      if (data.instagramFollows) {
        setFollowStats(data.instagramFollows);
      }
    } catch (error) {
      console.error('Failed to fetch follow stats:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFollowStats();
    }
  }, [isOpen]);

  const resetForm = () => {
    setTargetUsername('');
    setProfileCount(1);
    setIsRunning(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-[#1e2024] rounded-lg shadow-xl w-full max-w-md text-gray-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <Instagram className="text-pink-500" size={24} />
            <h2 className="text-xl font-bold">Instagram Follow Automation</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="text-blue-400" size={16} />
                <span className="text-sm font-medium text-blue-400">Available Profiles</span>
              </div>
              <p className="text-2xl font-bold text-white">{totalProfiles}</p>
              <p className="text-xs text-gray-400">Ready for automation</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="text-green-400" size={16} />
                <span className="text-sm font-medium text-green-400">Total Successful Follows</span>
              </div>
              <p className="text-2xl font-bold text-white">{followStats.totalSuccessful}</p>
              <p className="text-xs text-gray-400">All-time successful follows</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Target Instagram Username
            </label>
            <input
              type="text"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder="@username or username"
              className="w-full px-3 py-2 bg-[#2d3035] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the Instagram username to follow (with or without @)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Number of Profiles to Use
            </label>
            <input
              type="number"
              min="1"
              max={totalProfiles}
              value={profileCount}
              onChange={(e) => setProfileCount(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-[#2d3035] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              System will randomly select {profileCount} out of {totalProfiles} profiles
            </p>
          </div>

          {followStats.history.length > 0 && (
            <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4 max-h-32 overflow-y-auto">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Recent Follow History:</h4>
              <div className="space-y-1">
                {followStats.history.slice(-3).reverse().map((entry, index) => (
                  <div key={index} className="text-xs text-gray-400 flex justify-between">
                    <span>@{entry.target}</span>
                    <span className="text-green-400">{entry.successful}/{entry.attempted}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-yellow-400 mb-2">Automation Features:</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Random profile selection for natural behavior</li>
              <li>• Warm-up actions before following (anti-detection)</li>
              <li>• Human-like delays between actions</li>
              <li>• Each profile uses its own proxy and fingerprint</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              disabled={isRunning}
              className="px-6 py-2 rounded-md bg-gray-600 hover:bg-gray-700 disabled:opacity-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRunning || totalProfiles === 0}
              className="flex items-center space-x-2 px-6 py-2 rounded-md bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Play size={16} />
              <span>{isRunning ? 'Starting...' : 'Start Automation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InstagramAutomationModal;