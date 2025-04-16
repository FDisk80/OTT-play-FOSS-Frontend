// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose limited IPC functions securely to the renderer process (index.html)
// This version includes the 'receive' function needed for button visuals
contextBridge.exposeInMainWorld('electronAPI', {
  // Function for Renderer -> Main communication
  send: (channel, data) => {
    // Whitelist of channels allowed to be sent from renderer to main
    let validSendChannels = ['toggle-fullscreen', 'quit-app', 'show-context-menu'];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.error(`[Preload] Invalid channel attempted for send: ${channel}`);
    }
  },
  // Function for Main -> Renderer communication
  receive: (channel, func) => {
    // Whitelist of channels allowed to be received from main
    let validReceiveChannels = ['fullscreen-state-changed'];
    if (validReceiveChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` which is sensitive
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      // Return a cleanup function to remove the listener
      return () => {
          ipcRenderer.removeListener(channel, subscription);
          console.log(`[Preload] Removed listener for channel: ${channel}`);
      };
    } else {
       console.error(`[Preload] Invalid channel attempted for receive: ${channel}`);
       return () => {}; // Return empty cleanup function for invalid channels
    }
  }
});

console.log('[Preload] preload.js executed and electronAPI exposed (send & receive)');
