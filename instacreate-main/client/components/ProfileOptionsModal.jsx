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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-0">
      <div className="bg-white border border-gray-200 w-full max-w-sm">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Profile Options</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-none transition-colors"
          >
            <X size={18} className="text-gray-700" />
          </button>
        </div>
        
        <div className="p-2">
          <div className="mb-3 px-3 py-2 bg-gray-100 rounded-none">
            <p className="text-sm font-medium text-gray-900 truncate">{profileName}</p>
          </div>
          
          <div className="space-y-1">
            <button
              onClick={() => {
                onViewDetails();
                onClose();
              }}
              className="flex items-center w-full text-left px-3 py-2 text-sm bg-gray-200 text-gray-900 hover:bg-gray-300 rounded-none transition-colors"
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
                className="flex items-center w-full text-left px-3 py-2 text-sm bg-gray-200 text-gray-900 hover:bg-gray-300 rounded-none transition-colors"
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
                className="flex items-center w-full text-left px-3 py-2 text-sm bg-gray-200 text-gray-900 hover:bg-gray-300 rounded-none transition-colors"
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
                className="flex items-center w-full text-left px-3 py-2 text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-none transition-colors"
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
                className="flex items-center w-full text-left px-3 py-2 text-gray-900 bg-gray-200 hover:bg-gray-300 rounded-none transition-colors"
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