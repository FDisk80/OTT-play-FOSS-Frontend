// main.js - Electron Main Process

const { app, BrowserWindow, ipcMain, globalShortcut, Menu, screen } = require('electron');
const path = require('path');
// Use dynamic import for electron-store
// const Store = require('electron-store'); // REMOVED require

// Keep global references
let mainWindow;
let store;

// Define the desired aspect ratio (e.g., 16:9)
const ASPECT_RATIO = 16 / 9;

// Function to send fullscreen state to renderer
function sendFullscreenState(state) {
  if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
    console.log(`Sending fullscreen state to renderer: ${state}`);
    mainWindow.webContents.send('fullscreen-state-changed', state);
  }
}

// Make createWindow async to allow await for dynamic import
async function createWindow() {
  // --- Dynamically import electron-store ---
  const { default: Store } = await import('electron-store');
  store = new Store();
  // ------------------------------------------

  // Get saved window bounds or use defaults
  const defaultBounds = { width: 1024, height: Math.round(1024 / ASPECT_RATIO) };
  const savedBounds = store.get('windowBounds');
  let bounds = (savedBounds && typeof savedBounds === 'object' && savedBounds.width > 100 && savedBounds.height > 100) ? savedBounds : defaultBounds;

  // --- Adjust loaded height based on width and aspect ratio ---
  bounds.height = Math.round(bounds.width / ASPECT_RATIO);
  // --- End Adjustment ---

  console.log('Creating window with bounds:', bounds);

  // Create the main browser window (shell).
  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    resizable: true,
    alwaysOnTop: true, // Default is on
    show: false,
    maximizable: false, // Prevent maximize on double-click
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
      // allowRunningInsecureContent: true // Removed previously
    }
  });

  // --- Set the Aspect Ratio ---
  mainWindow.setAspectRatio(ASPECT_RATIO);
  console.log(`Aspect ratio set to ${ASPECT_RATIO}`);
  // -----------------------------

  // --- Prevent Default OS Context Menu Hook (Windows Only) ---
  // Keeping this attempt as it doesn't interfere with Escape key
  if (process.platform === 'win32') {
    const WM_SYSCOMMAND = 0x0112;
    const SC_KEYMENU = 0xF100;
    const SC_MOUSEMENU = 0xF090;

    mainWindow.hookWindowMessage(WM_SYSCOMMAND, (wParamBuffer) => {
      const wParam = wParamBuffer.readIntLE(0, 4);
      const command = wParam & 0xFFF0;
      // console.log(`WM_SYSCOMMAND received, command: 0x${command.toString(16)}`);
      if (command === SC_KEYMENU || command === SC_MOUSEMENU) {
         console.log(`System menu command (0x${command.toString(16)}) detected, preventing default menu.`);
         return true;
      }
      return false;
    });
    console.log('Windows system menu hook installed (Checking SC_KEYMENU & SC_MOUSEMENU).');
  }
  // --- END Hook ---


  // Load the local index.html
  mainWindow.loadFile('index.html');
  console.log('Window created. Loading index.html shell...');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
      console.log('Window ready-to-show.');
      mainWindow.show();
      console.log('Attempting app.focus()...');
      app.focus({ steal: true });
      sendFullscreenState(mainWindow.isFullScreen());
  });

  // Optional: Open DevTools for the main window (shell)
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  // --- Save Window Bounds Logic ---
  let resizeTimeout;
  const saveBounds = () => { /* ... (same as before) ... */ if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFullScreen() || !store || mainWindow.isMaximized()) { console.log('Skipping bounds save...'); return; } try { const currentBounds = mainWindow.getBounds(); console.log('Saving bounds:', currentBounds); store.set('windowBounds', currentBounds); } catch(e) { console.error("Error saving bounds:", e); } };
  const debouncedSave = () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(saveBounds, 500); };
  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);

  // --- Aspect Ratio / Fullscreen Event Handling ---
  mainWindow.on('leave-full-screen', () => { /* ... (same as before) ... */ if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.setAspectRatio(ASPECT_RATIO); console.log('Re-applied aspect ratio...'); saveBounds(); sendFullscreenState(false); } });
  mainWindow.on('enter-full-screen', () => { /* ... (same as before) ... */ if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.setAspectRatio(0); console.log('Disabled aspect ratio...'); sendFullscreenState(true); } });

  // --- Window Closed Event ---
  mainWindow.on('closed', function () { mainWindow = null; });

  // --- IPC Listeners ---
  ipcMain.on('toggle-fullscreen', (event) => { /* ... (same as before) ... */ if (mainWindow) { mainWindow.setFullScreen(!mainWindow.isFullScreen()); } }); // Removed console log for brevity
  ipcMain.on('quit-app', () => { app.quit(); });
  ipcMain.on('show-context-menu', (event) => { /* ... (same as before) ... */ if (!mainWindow) return; const isAlwaysOnTop = mainWindow.isAlwaysOnTop(); const isFullScreen = mainWindow.isFullScreen(); const template = [ { label: 'Always on Top', type: 'checkbox', checked: isAlwaysOnTop, click: () => { if (mainWindow) mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop()); } }, { label: isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen', click: () => { if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen()); } }, { type: 'separator' }, { label: 'Close', click: () => { app.quit(); } } ]; const menu = Menu.buildFromTemplate(template); menu.popup({ window: mainWindow }); });

} // End of async createWindow function

// --- App Lifecycle Events ---
app.whenReady().then(async () => {
  const chromeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
  console.log(`Setting User Agent fallback to: ${chromeUserAgent}`);
  app.userAgentFallback = chromeUserAgent;

  // --- Global Shortcuts ---

  // --- REMOVED: Escape key shortcut ---
  // globalShortcut.register('Escape', () => {
  //   console.log('Escape key pressed.');
  //   if (mainWindow && mainWindow.isFullScreen()) {
  //       console.log('Exiting fullscreen via Escape.');
  //       mainWindow.setFullScreen(false); // Triggers 'leave-full-screen' event
  //   } else { console.log('Escape pressed but not fullscreen - doing nothing.'); }
  // });
  // --- END REMOVED ---

  // F11 key toggles fullscreen
  globalShortcut.register('F11', () => {
      console.log('F11 key pressed.');
      if (mainWindow) {
          console.log('Toggling fullscreen via F11.');
          mainWindow.setFullScreen(!mainWindow.isFullScreen()); // Triggers enter/leave events
      }
  });

  // Update console log to reflect removed shortcut
  console.log("Registered global shortcuts: F11 (Toggles Fullscreen)");


  await createWindow();
  Menu.setApplicationMenu(null);

  app.on('activate', function () { /* ... (same as before) ... */ if (BrowserWindow.getAllWindows().length === 0) { if (!store) { import('electron-store').then(({ default: Store }) => { store = new Store(); createWindow(); }); } else { createWindow(); } } });
});

app.on('window-all-closed', function () { if (process.platform !== 'darwin') app.quit(); });

app.on('will-quit', () => {
  // --- Save bounds logic (same as before) ---
  if (mainWindow && !mainWindow.isDestroyed() && store && !mainWindow.isFullScreen() && !mainWindow.isMaximized()) {
      try { store.set('windowBounds', mainWindow.getBounds()); console.log('Saved bounds on will-quit:', mainWindow.getBounds()); } catch(e) { console.error("Error saving bounds on quit:", e); }
  } else { console.log('Not saving bounds on quit.'); }

  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
  console.log('App quitting. Global shortcuts unregistered.');
});
