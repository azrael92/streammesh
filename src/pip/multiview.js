// Multiview PiP Manager for StreamMESH
// Supports Document PiP with fallback popup for unsupported browsers
// iOS Native PiP: Hidden video element for swipe-up handoff

let pipWindow = null;
let currentChannels = [];
let currentLayout = { rows: 1, cols: 1 };
let audioMode = 'single'; // 'single' or 'multi'
let focusedChannel = 0;

// iOS Native PiP support
let hiddenVideoElement = null;
let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
let supportsNativePiP = false;

// Calculate best-fit grid layout for given number of channels
function calculateGridLayout(channelCount) {
  if (channelCount <= 0) return { rows: 1, cols: 1 };
  if (channelCount === 1) return { rows: 1, cols: 1 };
  if (channelCount === 2) return { rows: 1, cols: 2 };
  if (channelCount <= 4) return { rows: 2, cols: 2 };
  if (channelCount <= 6) return { rows: 2, cols: 3 };
  if (channelCount <= 9) return { rows: 3, cols: 3 };
  if (channelCount <= 12) return { rows: 3, cols: 4 };
  return { rows: 4, cols: 4 }; // Max 16 channels
}

// Build Twitch embed URL with proper parent parameter
function buildStreamUrl(channel, parentHost) {
  const url = new URL('https://player.twitch.tv/');
  url.searchParams.set('channel', channel);
  url.searchParams.set('parent', parentHost);
  url.searchParams.set('muted', 'false');
  url.searchParams.set('autoplay', 'true');
  return url.toString();
}

// Initialize iOS Native PiP support
function initIOSNativePiP() {
  if (!isIOS) return false;
  
  // Check if native PiP is supported
  supportsNativePiP = 'pictureInPictureEnabled' in document;
  
  if (supportsNativePiP) {
    // Create hidden video element for iOS PiP handoff
    hiddenVideoElement = document.createElement('video');
    hiddenVideoElement.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    `;
    hiddenVideoElement.muted = true;
    hiddenVideoElement.playsInline = true;
    hiddenVideoElement.setAttribute('playsinline', '');
    hiddenVideoElement.setAttribute('webkit-playsinline', '');
    
    document.body.appendChild(hiddenVideoElement);
    
    console.log('iOS Native PiP initialized');
    return true;
  }
  
  return false;
}

// Update hidden video element for iOS native PiP
function updateHiddenVideoForIOS(channels, parentHost) {
  if (!hiddenVideoElement || !supportsNativePiP) return;
  
  try {
    // For iOS native PiP, we'll use a canvas to create a video stream
    // This gives us the multiview experience in native PiP
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size based on channel count
    const layout = calculateGridLayout(channels.length);
    canvas.width = layout.cols * 160; // 160px per channel
    canvas.height = layout.rows * 90;  // 90px per channel
    
    // Fill background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw channel placeholders (since we can't capture Twitch iframes)
    channels.forEach((channel, index) => {
      const row = Math.floor(index / layout.cols);
      const col = index % layout.cols;
      const x = col * 160;
      const y = row * 90;
      
      // Draw channel box
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(x + 1, y + 1, 158, 88);
      
      // Draw channel name
      ctx.fillStyle = '#fff';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(channel.channel, x + 80, y + 50);
      
      // Draw audio indicator if focused
      if (audioMode === 'single' && index === focusedChannel) {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(x + 5, y + 5, 20, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText('🔊', x + 15, y + 18);
      }
    });
    
    // Convert canvas to video stream
    const stream = canvas.captureStream(30); // 30fps
    hiddenVideoElement.srcObject = stream;
    hiddenVideoElement.play().catch(() => {
      // Video play failed, that's okay for hidden element
    });
    
    // Set video metadata for PiP
    hiddenVideoElement.title = `StreamMESH: ${channels.length} streams`;
    
  } catch (error) {
    console.warn('Failed to update hidden video for iOS PiP:', error);
  }
}

// Create the PiP window content
function createPiPContent(channels, parentHost, isDocPiP = true) {
  const layout = calculateGridLayout(channels.length);
  currentLayout = layout;
  
  const gridStyle = `
    display: grid;
    grid-template-columns: repeat(${layout.cols}, 1fr);
    grid-template-rows: repeat(${layout.rows}, 1fr);
    gap: 1px;
    width: 100%;
    height: 100%;
    background: #000;
    padding: 1px;
  `;
  
  const iframeStyle = `
    width: 100%;
    height: 100%;
    border: 0;
    background: #000;
    min-width: 0;
    min-height: 0;
  `;
  
  const controlsStyle = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.85);
    padding: 6px;
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(8px);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  `;
  
  const buttonStyle = `
    background: #7c3aed;
    border: none;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 50px;
  `;
  
  const buttonHoverStyle = `
    background: #8b5cf6;
    transform: scale(1.05);
  `;
  
  const toggleStyle = `
    background: ${audioMode === 'multi' ? '#10b981' : '#7c3aed'};
    border: none;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 60px;
  `;
  
  // Create grid of iframes
  let iframesHtml = '';
  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const isFocused = i === focusedChannel;
    const muted = audioMode === 'single' ? !isFocused : channel.muted;
    
    iframesHtml += `
      <div class="stream-tile" data-index="${i}" style="position: relative; cursor: pointer;">
        <iframe 
          src="${buildStreamUrl(channel.channel, parentHost)}"
          style="${iframeStyle}"
          allow="autoplay; fullscreen; picture-in-picture"
          ${muted ? 'muted' : ''}
        ></iframe>
        <div class="tile-overlay" style="
          position: absolute;
          top: 2px;
          left: 2px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 600;
          max-width: calc(100% - 4px);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">${channel.channel}</div>
        ${audioMode === 'single' && isFocused ? `
          <div class="audio-indicator" style="
            position: absolute;
            top: 2px;
            right: 2px;
            background: #10b981;
            color: white;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
          ">🔊</div>
        ` : ''}
      </div>
    `;
  }
  
  // Fill remaining grid slots with placeholders
  const totalSlots = layout.rows * layout.cols;
  for (let i = channels.length; i < totalSlots; i++) {
    iframesHtml += `
      <div class="placeholder" style="
        background: #1a1a1a;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        font-size: 12px;
      ">No Stream</div>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>StreamMESH Multiview</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #000;
          color: white;
          overflow: hidden;
          width: 100%;
          height: 100%;
        }
        .stream-tile { 
          position: relative; 
          cursor: pointer;
          overflow: hidden;
        }
        .stream-tile:hover { opacity: 0.9; }
        .stream-tile:active { transform: scale(0.98); }
        button:hover { ${buttonHoverStyle} }
        .controls { ${controlsStyle} }
        .btn { ${buttonStyle} }
        .toggle { ${toggleStyle} }
        .grid { ${gridStyle} }
        iframe { 
          width: 100% !important; 
          height: 100% !important; 
          border: 0 !important;
          background: #000 !important;
        }
      </style>
    </head>
    <body>
      <div class="grid" id="streamGrid">
        ${iframesHtml}
      </div>
      <div class="controls">
        <button class="btn" id="syncBtn">🔄 Sync</button>
        <button class="toggle" id="audioToggle">
          ${audioMode === 'multi' ? '🔊 Multi' : '🔊 Single'}
        </button>
        <button class="btn" id="closeBtn">✕ Close</button>
      </div>
      
      <script>
        // Audio management
        let audioMode = '${audioMode}';
        let focusedChannel = ${focusedChannel};
        let channels = ${JSON.stringify(channels)};
        
        // Handle tile clicks for audio focus
        document.querySelectorAll('.stream-tile').forEach((tile, index) => {
          tile.addEventListener('click', () => {
            if (audioMode === 'single') {
              // Update focused channel
              focusedChannel = index;
              updateAudioFocus();
            } else {
              // Toggle mute for this channel
              const iframe = tile.querySelector('iframe');
              if (iframe.muted) {
                iframe.muted = false;
                tile.querySelector('.tile-overlay').style.background = 'rgba(16, 185, 129, 0.8)';
              } else {
                iframe.muted = true;
                tile.querySelector('.tile-overlay').style.background = 'rgba(0, 0, 0, 0.7)';
              }
            }
          });
        });
        
        function updateAudioFocus() {
          document.querySelectorAll('.stream-tile').forEach((tile, index) => {
            const iframe = tile.querySelector('iframe');
            const audioIndicator = tile.querySelector('.audio-indicator');
            
            if (index === focusedChannel) {
              iframe.muted = false;
              if (audioIndicator) audioIndicator.style.display = 'block';
            } else {
              iframe.muted = true;
              if (audioIndicator) audioIndicator.style.display = 'none';
            }
          });
        }
        
        // Control buttons
        document.getElementById('syncBtn').addEventListener('click', () => {
          // Send sync request to parent window
          if (window.opener) {
            window.opener.postMessage({ type: 'SYNC_REQUEST' }, '*');
          }
        });
        
        document.getElementById('audioToggle').addEventListener('click', () => {
          audioMode = audioMode === 'single' ? 'multi' : 'single';
          const btn = document.getElementById('audioToggle');
          btn.textContent = audioMode === 'multi' ? '🔊 Multi' : '🔊 Single';
          btn.style.background = audioMode === 'multi' ? '#10b981' : '#7c3aed';
          
          if (audioMode === 'single') {
            updateAudioFocus();
          } else {
            // Enable all channels
            document.querySelectorAll('.stream-tile iframe').forEach(iframe => {
              iframe.muted = false;
            });
          }
        });
        
        document.getElementById('closeBtn').addEventListener('click', () => {
          window.close();
        });
        
        // Listen for updates from parent window
        window.addEventListener('message', (event) => {
          if (event.data.type === 'CHANNELS_UPDATE') {
            // Refresh the window with new channels
            window.location.reload();
          }
        });
      </script>
    </body>
    </html>
  `;
}

// Open Document PiP multiview window
export async function openMultiViewPiP(channels, { parentHost, startIndex = 0 } = {}) {
  if (!channels || channels.length === 0) {
    throw new Error('No channels provided');
  }
  
  // Close existing PiP if open
  if (pipWindow) {
    try {
      pipWindow.close();
    } catch {}
    pipWindow = null;
  }
  
  currentChannels = channels;
  focusedChannel = Math.max(0, Math.min(startIndex, channels.length - 1));
  
  // Update hidden video for iOS native PiP
  updateHiddenVideoForIOS(channels, parentHost);
  
  try {
    // On iOS, prefer native PiP if available
    if (isIOS && supportsNativePiP) {
      // For iOS, we don't open a window - just prepare the hidden video
      // User can swipe up to home screen to trigger native PiP
      console.log('iOS Native PiP ready - swipe up to home screen to activate');
      return { type: 'ios-native', video: hiddenVideoElement };
    }
    
    // Try Document PiP first
    if ('documentPictureInPicture' in window) {
      // Calculate optimal PiP size based on channel count
      const layout = calculateGridLayout(channels.length);
      const baseWidth = Math.max(400, layout.cols * 120);
      const baseHeight = Math.max(300, layout.rows * 90);
      
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: Math.min(baseWidth, 1200),
        height: Math.min(baseHeight, 800)
      });
      
      pipWindow = pipWin;
      pipWin.document.write(createPiPContent(channels, parentHost, true));
      pipWin.document.close();
      
      // Handle PiP window close
      pipWin.addEventListener('pagehide', () => {
        pipWindow = null;
      });
      
      return pipWin;
    } else {
      // Fallback to popup window
      return openFallbackPiP(channels, parentHost);
    }
  } catch (error) {
    console.warn('Document PiP failed, using fallback:', error);
    return openFallbackPiP(channels, parentHost);
  }
}

// Fallback popup window for unsupported browsers
function openFallbackPiP(channels, parentHost) {
  const layout = calculateGridLayout(channels.length);
  // Better sizing calculation for popup
  const baseWidth = Math.max(400, layout.cols * 140);
  const baseHeight = Math.max(300, layout.rows * 100);
  const width = Math.min(baseWidth, 1200);
  const height = Math.min(baseHeight, 800);
  
  const popup = window.open(
    '',
    'streammesh_multiview',
    `width=${width},height=${height},resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no`
  );
  
  if (!popup) {
    throw new Error('Popup blocked by browser');
  }
  
  pipWindow = popup;
  popup.document.write(createPiPContent(channels, parentHost, false));
  popup.document.close();
  
  // Handle popup close
  popup.addEventListener('beforeunload', () => {
    pipWindow = null;
  });
  
  return popup;
}

// Close the PiP window
export function closeMultiViewPiP() {
  if (pipWindow) {
    try {
      pipWindow.close();
    } catch {}
    pipWindow = null;
  }
}

// Update channels in the PiP window
export function updatePiPChannels(channels) {
  if (channels) {
    currentChannels = channels;
    
    // Update hidden video for iOS native PiP
    updateHiddenVideoForIOS(channels, window.location.hostname);
    
    // Update existing PiP window if open
    if (pipWindow) {
      try {
        pipWindow.postMessage({ type: 'CHANNELS_UPDATE', channels }, '*');
      } catch (error) {
        console.warn('Failed to update PiP channels:', error);
      }
    }
  }
}

// Check if PiP is currently open
export function isPiPOpen() {
  return pipWindow !== null;
}

// Get current PiP window reference
export function getPiPWindow() {
  return pipWindow;
}

// Initialize PiP system (call this when app starts)
export function initializePiP() {
  // Initialize iOS native PiP support
  initIOSNativePiP();
  
  // Return capabilities
  return {
    supportsDocumentPiP: 'documentPictureInPicture' in window,
    supportsNativePiP: supportsNativePiP,
    isIOS: isIOS
  };
}

// Get current audio mode
export function getAudioMode() {
  return audioMode;
}

// Set audio mode
export function setAudioMode(mode) {
  audioMode = mode;
  if (currentChannels.length > 0) {
    updateHiddenVideoForIOS(currentChannels, window.location.hostname);
  }
} 