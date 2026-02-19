import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Monitor, RefreshCw } from 'lucide-react';

const VNCViewerModal = ({ isOpen, onClose, profileName }) => {
  const [key, setKey] = useState(0);

  // Build noVNC URL using same hostname as the app but port 6080
  const vncHost = window.location.hostname;
  const vncPort = 6080;
  const vncUrl = `http://${vncHost}:${vncPort}/vnc.html?autoconnect=1&resize=scale&path=websockify`;

  useEffect(() => {
    if (isOpen) {
      // Refresh iframe when opened
      setKey(prev => prev + 1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Monitor size={18} className="text-emerald-400" />
          <span className="text-white font-medium text-sm">
            Live Browser View
            {profileName && <span className="text-gray-400 ml-2">— {profileName}</span>}
          </span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
            {vncHost}:{vncPort}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setKey(prev => prev + 1)}
            title="Refresh viewer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors rounded"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <a
            href={vncUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors rounded"
          >
            <ExternalLink size={13} />
            Open in Tab
          </a>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-red-700 hover:bg-red-600 transition-colors rounded"
          >
            <X size={13} />
            Close
          </button>
        </div>
      </div>

      {/* noVNC iframe */}
      <div className="flex-1 relative bg-black">
        <iframe
          key={key}
          src={vncUrl}
          className="w-full h-full border-0"
          title="VNC Viewer"
          allow="fullscreen"
        />
        {/* Overlay hint shown briefly */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-60 text-white text-xs px-3 py-1.5 rounded pointer-events-none select-none opacity-70">
          Chrome is running inside this panel
        </div>
      </div>
    </div>
  );
};

export default VNCViewerModal;
