import React, { useState, useEffect } from 'react';
import { X, Instagram, Users, Play, TrendingUp } from 'lucide-react';

const InstagramAutomationModal = ({ isOpen, onClose, onSubmit, totalProfiles }) => {
  const [targetUsername, setTargetUsername] = useState('');
  const [profileCount, setProfileCount] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [followStats, setFollowStats] = useState({ totalSuccessful: 0, history: [] });
  const [initialSuccessful, setInitialSuccessful] = useState(0);
  const [poller, setPoller] = useState(null);

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
      // Capture initial count
      const stats = await fetchFollowStats();
      setInitialSuccessful((stats && stats.totalSuccessful) || 0);

      // Start automation (server now returns immediately)
      await onSubmit(targetUsername.replace('@', ''), profileCount);

      // Start polling analytics every second to reflect live updates
      let attempts = 0;
      const maxAttempts = Math.max(60, profileCount * 5); // stop after reasonable time
      const interval = setInterval(async () => {
        attempts += 1;
        const statsNow = await fetchFollowStats();
        const current = (statsNow && statsNow.totalSuccessful) || 0;
        // If we've seen the expected number of new successes, stop polling
        if (current >= (initialSuccessful + profileCount) || attempts >= maxAttempts) {
          clearInterval(interval);
          setPoller(null);
          setIsRunning(false);
          // Optionally close modal when finished
          // onClose();
        }
      }, 1000);
      setPoller(interval);
      alert(`Automation started! ${profileCount} profiles will follow @${targetUsername}`);
    } catch (error) {
      alert('Failed to start automation: ' + error.message);
      setIsRunning(false);
    }
  };

  const fetchFollowStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:4000/api/analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 401) {
          // auth expired or invalid; stop polling silently
          console.warn('Analytics fetch unauthorized (401)');
          return null;
        }
        return null;
      }
      const data = await response.json();
      if (data.instagramFollows) {
        setFollowStats(data.instagramFollows);
        return data.instagramFollows;
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

  // cleanup poller when modal closes
  useEffect(() => {
    return () => {
      if (poller) clearInterval(poller);
    };
  }, [poller]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-0">
      <div className="bg-white rounded-none shadow-none w-full max-w-md text-gray-900 max-h-full flex flex-col h-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Instagram className="text-pink-500" size={24} />
            <h2 className="text-xl font-bold">Instagram Follow Automation</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-none">
            <X size={20} className="text-gray-700" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-100 border border-gray-200 rounded-none p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="text-gray-700" size={16} />
                <span className="text-sm font-medium text-gray-700">Available Profiles</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalProfiles}</p>
              <p className="text-xs text-gray-600">Ready for automation</p>
            </div>
            <div className="bg-gray-100 border border-gray-200 rounded-none p-4">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="text-gray-700" size={16} />
                <span className="text-sm font-medium text-gray-700">Total Successful Follows</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{followStats.totalSuccessful}</p>
              <p className="text-xs text-gray-600">All-time successful follows</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Target Instagram Username
            </label>
            <input
              type="text"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder="@username or username"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-400"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the Instagram username to follow (with or without @)
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Number of Profiles to Use
            </label>
            <input
              type="number"
              min="1"
              max={totalProfiles}
              value={profileCount}
              onChange={(e) => setProfileCount(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-gray-400"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              System will randomly select {profileCount} out of {totalProfiles} profiles
            </p>
          </div>

          {followStats.history.length > 0 && (
            <div className="bg-gray-100 border border-gray-200 rounded-none p-4 max-h-32 overflow-y-auto">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Follow History:</h4>
              <div className="space-y-1">
                {followStats.history.slice(-3).reverse().map((entry, index) => (
                  <div key={index} className="text-xs text-gray-600 flex justify-between">
                    <span>@{entry.target}</span>
                    <span className="text-green-400">{entry.successful}/{entry.attempted}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-100 border border-gray-200 rounded-none p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Automation Features:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Random profile selection for natural behavior</li>
              <li>• Warm-up actions before following (anti-detection)</li>
              <li>• Human-like delays between actions</li>
              <li>• Each profile uses its own proxy and fingerprint</li>
            </ul>
          </div>

          </div>

          <div className="flex justify-end space-x-3 p-6 pt-4 border-t border-gray-200 flex-shrink-0 bg-white">
            <button
              type="button"
              onClick={handleClose}
              disabled={isRunning}
              className="px-6 py-2 rounded-none bg-gray-200 hover:bg-gray-300 disabled:opacity-50 transition text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRunning || totalProfiles === 0}
              className="flex items-center space-x-2 px-6 py-2 rounded-none bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition text-gray-900"
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