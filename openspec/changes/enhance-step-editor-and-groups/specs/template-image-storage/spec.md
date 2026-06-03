## ADDED Requirements

### Requirement: Template images live in a managed directory
The main process SHALL maintain a `templates/` directory under `app.getPath('userData')`. The directory SHALL be created at app startup if missing.

#### Scenario: Directory initialized on startup
- **WHEN** the app starts
- **THEN** the `<userData>/templates/` directory exists; if it did not exist, it is created with default permissions

#### Scenario: Directory contents persist across app restarts
- **WHEN** the app is restarted
- **THEN** the `templates/` directory and its contents are intact

### Requirement: Template path normalization on save
For every step save, every `templatePath` value (in IMAGE_MATCH `config.templatePath` and each entry of IMAGE_GROUP `config.templates[].templatePath`) SHALL be normalized to a path inside `<userData>/templates/`.

#### Scenario: External path is copied with a regenerated filename
- **WHEN** the user saves a step with `templatePath = "C:/users/alice/desktop/btn.png"`
- **THEN** the file is copied to `<userData>/templates/<uuid>.png` and the persisted `templatePath` is the new path

#### Scenario: Already-managed path is preserved
- **WHEN** the saved `templatePath` already points inside `<userData>/templates/`
- **THEN** no copy occurs; the path is persisted unchanged

#### Scenario: Multiple templates in a single step all normalize
- **WHEN** the user saves an IMAGE_GROUP step with three templates, two external and one already managed
- **THEN** the two external files are copied, the one managed path is preserved, and the saved config reflects the resulting three paths

### Requirement: Image picker IPC channel
The system SHALL expose an IPC channel `image:pick` that opens an OS file selection dialog filtered to PNG/JPG/JPEG/BMP and returns `{ sourcePath: string | null }`. A null result indicates the user cancelled.

#### Scenario: User picks a file
- **WHEN** the renderer invokes `image:pick` and the user selects `C:/img/x.png`
- **THEN** the response is `{ sourcePath: "C:/img/x.png" }`

#### Scenario: User cancels the dialog
- **WHEN** the renderer invokes `image:pick` and the user cancels
- **THEN** the response is `{ sourcePath: null }`

### Requirement: Image normalization IPC channel
The system SHALL expose an IPC channel `image:normalize` that accepts `{ sourcePath: string }` and returns `{ savedPath: string }`. The handler SHALL copy external files into `templates/` and return managed paths unchanged.

#### Scenario: Normalize an external file
- **WHEN** the renderer invokes `image:normalize` with an external path
- **THEN** the file is copied to `<userData>/templates/<uuid><ext>`; `savedPath` is the new path

#### Scenario: Normalize a managed path
- **WHEN** `sourcePath` already lies inside `<userData>/templates/`
- **THEN** `savedPath === sourcePath`; no file operations occur

#### Scenario: Missing source file rejects
- **WHEN** `sourcePath` points to a non-existent file
- **THEN** the IPC rejects with a descriptive error; the renderer surfaces it inline and does not submit the step save

### Requirement: StepEditor pick button and save flow
StepEditor SHALL render a "选择图片" button next to every `templatePath` input. The save action SHALL call `image:normalize` for every template path before invoking `step:create` or `step:update`.

#### Scenario: Pick button populates the input
- **WHEN** the user clicks "选择图片" and chooses a file
- **THEN** the renderer chains `image:pick` and `image:normalize`, then writes the returned `savedPath` into the input

#### Scenario: Save normalizes all paths
- **WHEN** the user submits the step form with manually-typed paths
- **THEN** the renderer normalizes each path via `image:normalize`; only after all normalizations succeed is the step persisted

#### Scenario: Normalization failure aborts save
- **WHEN** any `image:normalize` call rejects
- **THEN** the form does not submit; an error message is shown next to the offending field
