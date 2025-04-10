// main.js - Electron Main Process

const { app, BrowserWindow, ipcMain, globalShortcut, Menu, screen } = require('electron');
const path = require('path');
// Use dynamic import for electron-store
// const Store = require('electron-store'); // REMOVED require

// Keep global references
let mainWindow;
// let mainView; // REMOVED BrowserView reference
let store;

// Configuration
// const APP_URL = "http://ottp.eu.org/f/pc/"; // URL loaded by webview in index.html
// const TITLE_BAR_HEIGHT = 30; // Used by index.html layout

// Make createWindow async to allow await for dynamic import
async function createWindow() {
  // --- Dynamically import electron-store ---
  const { default: Store } = await import('electron-store');
  store = new Store();
  // ------------------------------------------

  // Get saved window bounds or use defaults
  const defaultBounds = { width: 1024, height: 768 };
  const savedBounds = store.get('windowBounds');
  const bounds = (savedBounds && typeof savedBounds === 'object' && savedBounds.width > 100 && savedBounds.height > 100) ? savedBounds : defaultBounds;

  console.log('Creating window with bounds:', bounds);

  // Create the main browser window (shell).
  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,       // Keep frameless
    resizable: true,    // Keep resizable
    alwaysOnTop: true, // Keep always on top
    show: false, // Start hidden, show when ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Preload for the shell window (index.html)
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true // Enable <webview> tag
    }
  });

  // Load the local index.html (shell with webview tag)
  mainWindow.loadFile('index.html');
  console.log('Window created. Loading index.html shell (contains webview)...');

  // *** Attempt to focus the app/window AFTER it's ready to show ***
  mainWindow.once('ready-to-show', () => {
      console.log('Window ready-to-show.');
      mainWindow.show(); // Show the window
      console.log('Attempting app.focus()...');
      app.focus({ steal: true }); // Force focus steal on Windows/macOS
      // Optionally, try focusing the window explicitly again after showing
      // setTimeout(() => {
      //     if (mainWindow && !mainWindow.isDestroyed()) {
      //          console.log('Attempting mainWindow.focus() after show.');
      //          mainWindow.focus();
      //     }
      // }, 100); // Short delay after show
  });


  // Keep DevTools commented out unless needed for the shell window
  // mainWindow.webContents.openDevTools();


  // --- Save Window Bounds Logic ---
  let resizeTimeout;
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFullScreen() || !store) { return; }
    try {
        const currentBounds = mainWindow.getBounds();
        store.set('windowBounds', currentBounds);
    } catch(e) { console.error("Error saving bounds:", e); }
  };
  const debouncedSave = () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(saveBounds, 500); };
  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);
  mainWindow.on('leave-full-screen', saveBounds);
  mainWindow.on('closed', function () { saveBounds(); mainWindow = null; }); // No mainView to clear

  // --- IPC Listeners ---
  ipcMain.on('toggle-fullscreen', (event) => {
    if (mainWindow) {
      const isFullScreen = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!isFullScreen);
      // No need to send state back
    }
  });
  ipcMain.on('quit-app', () => { app.quit(); });

} // End of async createWindow function

app.whenReady().then(async () => {
  // Set User Agent globally (still potentially useful for webview)
  const chromeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
  console.log(`Setting User Agent fallback to: ${chromeUserAgent}`);
  app.userAgentFallback = chromeUserAgent; // Apply globally

  // --- Global Shortcuts ---
  globalShortcut.register('Escape', () => {
    console.log('Escape key pressed.');
    if (mainWindow && mainWindow.isFullScreen()) {
        console.log('Exiting fullscreen via Escape.');
        mainWindow.setFullScreen(false);
        // No need to send state back
    } else { console.log('Escape pressed but not fullscreen - doing nothing.'); }
  });
  console.log("Registered global shortcuts: Escape (Exits Fullscreen Only)");


  // Call the async function to initialize store before creating window
  await createWindow();

  Menu.setApplicationMenu(null); // No default menu

  app.on('activate', function () {
     if (BrowserWindow.getAllWindows().length === 0) {
        if (!store) {
             import('electron-store').then(({ default: Store }) => { store = new Store(); createWindow(); })
                 .catch(err => console.error("Failed to import electron-store on activate:", err));
        } else { createWindow(); }
     }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed() && store) {
      try {
        if (!mainWindow.isFullScreen()) {
            const currentBounds = mainWindow.getBounds();
            store.set('windowBounds', currentBounds);
        }
      } catch(e) { console.error("Error saving bounds on quit:", e); }
  }
  globalShortcut.unregisterAll();
  console.log('App quitting. Global shortcuts unregistered.');
});
