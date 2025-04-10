// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose limited IPC functions to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Function for Renderer -> Main communication
  send: (channel, data) => {
    // Keep needed channels
    let validSendChannels = ['toggle-fullscreen', 'quit-app'];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.error(`Invalid channel attempted for send: ${channel}`);
    }
  }
  // Receive function removed as it's not currently needed
});

console.log('preload.js executed and API exposed (send only)');
