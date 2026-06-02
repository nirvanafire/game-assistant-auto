## ADDED Requirements

### Requirement: DevTools shall not auto-open on startup
The application SHALL NOT automatically open DevTools when launching in development mode. DevTools SHALL remain accessible via the standard keyboard shortcut (F12 or Ctrl+Shift+I).

#### Scenario: App starts in development mode
- **WHEN** the application starts with `NODE_ENV_ELECTRON_VITE === 'development'`
- **THEN** DevTools SHALL NOT be opened automatically

#### Scenario: User manually opens DevTools
- **WHEN** the user presses F12 or Ctrl+Shift+I
- **THEN** DevTools SHALL open normally

### Requirement: Menu bar shall be hidden
The default Electron application menu bar SHALL NOT be visible in the main window.

#### Scenario: App starts on Windows
- **WHEN** the application starts on Windows
- **THEN** the menu bar (File, Edit, View, Window, Help) SHALL NOT be displayed

#### Scenario: Keyboard shortcuts remain functional
- **WHEN** the user uses standard keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+A, etc.)
- **THEN** the shortcuts SHALL work despite the menu being hidden

### Requirement: Browser address bar shall be interactive
The BrowserView SHALL NOT cover the address bar toolbar area. The user SHALL be able to click on and type in the URL input field.

#### Scenario: User clicks address bar
- **WHEN** the user clicks on the URL input field in the browser toolbar
- **THEN** the input field SHALL receive focus and the cursor SHALL appear

#### Scenario: User types a URL and navigates
- **WHEN** the user types a URL in the address bar and presses Enter or clicks Go
- **THEN** the BrowserView SHALL navigate to the specified URL
