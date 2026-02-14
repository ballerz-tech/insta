import React from 'react';
import { X, Eye, Edit, Globe, Ban, Trash2 } from 'lucide-react';

const ProfileOptionsModal = ({ 
  isOpen, 
  onClose, 
  profileName, 
  profileConfig, 
  onViewDetails, 
  onRename, 
  onChangeProxy, 
  onDisableProxy, 
  onDelete,
  userPermissions = []
}) => {
  const hasPermission = (permission) => {
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm backdrop-blur-sm">
        <div className="flex justify-between items-center p-4 border-b border-slate-600">
          <h3 className="text-lg font-semibold text-white">Profile Options</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        
        <div className="p-2">
          <div className="mb-3 px-3 py-2 bg-slate-700/50 rounded-lg">
            <p className="text-sm font-medium text-white truncate">{profileName}</p>
          </div>
          
          <div className="space-y-1">
            <button
              onClick={() => {
                onViewDetails();
                onClose();
              }}
              className="flex items-center w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Eye size={16} className="mr-3" />
              View Details
            </button>
            
            {hasPermission('create_profiles') && (
              <button
                onClick={() => {
                  onRename();
                  onClose();
                }}
                className="flex items-center w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Edit size={16} className="mr-3" />
                Rename Profile
              </button>
            )}
            
            {hasPermission('create_profiles') && (
              <button
                onClick={() => {
                  onChangeProxy();
                  onClose();
                }}
                className="flex items-center w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Globe size={16} className="mr-3" />
                Change Proxy
              </button>
            )}
            
            {hasPermission('create_profiles') && profileConfig.proxy && (
              <button
                onClick={() => {
                  onDisableProxy();
                  onClose();
                }}
                className="flex items-center w-full text-left px-3 py-2 text-sm text-orange-400 hover:bg-orange-500/20 rounded-lg transition-colors"
              >
                <Ban size={16} className="mr-3" />
                Disable Proxy
              </button>
            )}
            
            {hasPermission('delete_profiles') && (
              <button
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="flex items-center w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 size={16} className="mr-3" />
                Delete Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileOptionsModal;