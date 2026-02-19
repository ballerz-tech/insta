import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, RefreshCw, Monitor, Globe, ArrowLeft, ArrowRight, RotateCw } from 'lucide-react';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api';

const BrowserViewerModal = ({ isOpen, onClose, profileName }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [navUrl, setNavUrl] = useState('');
  const [scale, setScale] = useState(1);
  const intervalRef = useRef(null);
  const imgRef = useRef(new Image());

  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  // Take a screenshot and draw it on the canvas
  const captureFrame = useCallback(async () => {
    if (!profileName) return;
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/profiles/${encodeURIComponent(profileName)}/screenshot`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) {
        if (resp.status === 404) { setError('Browser not running yet...'); return; }
        throw new Error(`HTTP ${resp.status}`);
      }
      setError(null);
      setIsConnected(true);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const img = imgRef.current;
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const container = containerRef.current;
        if (!container) return;

        // Scale the canvas to fit the container while preserving aspect ratio
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        const s = Math.min(cw / imgW, ch / imgH, 1);
        setScale(s);
        canvas.width = imgW * s;
        canvas.height = imgH * s;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (err) {
      console.error('Frame error:', err);
      setError('Connecting to browser...');
      setIsConnected(false);
    }
  }, [profileName]);

  // Start/stop polling
  useEffect(() => {
    if (isOpen && profileName) {
      // Initial delay to let Chrome start
      const startDelay = setTimeout(() => {
        captureFrame();
        intervalRef.current = setInterval(captureFrame, 300);
      }, 2000);
      return () => {
        clearTimeout(startDelay);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen, profileName, captureFrame]);

  // Convert canvas click coords to real browser coords
  const canvasToReal = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / scale);
    const y = Math.round((e.clientY - rect.top) / scale);
    return { x, y };
  };

  const sendMouse = async (type, e, extra = {}) => {
    const { x, y } = canvasToReal(e);
    try {
      await fetch(`${API_URL}/profiles/${encodeURIComponent(profileName)}/input/mouse`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ type, x, y, ...extra }),
      });
    } catch {}
  };

  const handleClick = async (e) => {
    await sendMouse('mousePressed', e, { clickCount: 1 });
    await sendMouse('mouseReleased', e, { clickCount: 1 });
    // Trigger immediate screenshot for responsiveness
    setTimeout(captureFrame, 200);
  };

  const handleScroll = async (e) => {
    const { x, y } = canvasToReal(e);
    try {
      await fetch(`${API_URL}/profiles/${encodeURIComponent(profileName)}/input/mouse`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ type: 'scroll', x, y, deltaX: e.deltaX, deltaY: e.deltaY }),
      });
    } catch {}
  };

  const handleKeyDown = async (e) => {
    e.preventDefault();
    const text = e.key.length === 1 ? e.key : '';
    try {
      if (text) {
        await fetch(`${API_URL}/profiles/${encodeURIComponent(profileName)}/input/keyboard`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ type: 'char', text }),
        });
      } else {
        await fetch(`${API_URL}/profiles/${encodeURIComponent(profileName)}/input/keyboard`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ type: 'keyDown', key: e.key, code: e.code }),
        });
        await fetch(`${API_URL}/profiles/${encodeURIComponent(profileName)}/input/keyboard`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ type: 'keyUp', key: e.key, code: e.code }),
        });
      }
    } catch {}
    setTimeout(captureFrame, 100);
  };

  const handleNavigate = async (e) => {
    e.preventDefault();
    if (!navUrl.trim()) return;
    let url = navUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    try {
      await fetch(`${API_URL}/profiles/${encodeURIComponent(profileName)}/navigate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ url }),
      });
      setTimeout(captureFrame, 1000);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <Monitor size={16} className="text-emerald-400" />
        <span className="text-white font-medium text-sm">
          {profileName}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded ${isConnected ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
          {isConnected ? 'Connected' : 'Connecting...'}
        </span>

        {/* URL bar */}
        <form onSubmit={handleNavigate} className="flex-1 flex items-center ml-3 gap-1">
          <div className="flex-1 flex items-center bg-gray-800 rounded px-2">
            <Globe size={13} className="text-gray-500 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={navUrl}
              onChange={(e) => setNavUrl(e.target.value)}
              placeholder="Enter URL and press Enter"
              className="w-full bg-transparent text-white text-sm py-1.5 outline-none placeholder-gray-500"
            />
          </div>
          <button type="submit" className="px-2 py-1.5 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 rounded">
            <RotateCw size={13} />
          </button>
        </form>

        <button
          onClick={() => { captureFrame(); }}
          title="Refresh"
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 rounded"
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-white bg-red-700 hover:bg-red-600 rounded"
        >
          <X size={13} />
          Close
        </button>
      </div>

      {/* Browser canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center bg-gray-950 overflow-hidden relative">
        {error && !isConnected && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-gray-400 text-sm">{error}</p>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onClick={handleClick}
          onWheel={handleScroll}
          onKeyDown={handleKeyDown}
          className="cursor-pointer outline-none"
          style={{ imageRendering: 'auto' }}
        />
      </div>
    </div>
  );
};

export default BrowserViewerModal;
