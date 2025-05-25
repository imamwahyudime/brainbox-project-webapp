<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Brainstorm & Timebox Pro - Combined</title>
    <link rel="stylesheet" href="style.css">
</head>
<body data-theme="light">

    <header class="app-header">
        <h1>Brainstorm & Timebox</h1>
        <div class="controls">
            <label for="theme-select">Theme:</label>
            <select id="theme-select">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
            </select>
            <button id="export-data-button" title="Export Data">
                <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512" fill="currentColor"><path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/></svg> Export
            </button>
            <button id="import-data-button" title="Import Data">
                <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 576 512" fill="currentColor"><path d="M288 32c-17.7 0-32 14.3-32 32V240H192c-17.7 0-32 14.3-32 32s14.3 32 32 32H256V448c0 17.7 14.3 32 32 32s32-14.3 32-32V272h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320V64c0-17.7-14.3-32-32-32zM0 128C0 92.7 28.7 64 64 64H192V128H64c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V320H64c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V448H64c-35.3 0-64-28.7-64-64V128zM576 384c0 35.3-28.7 64-64 64H448V320h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H448V192h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H448V64h64c35.3 0 64 28.7 64 64V384z"/></svg> Import
            </button>
            <input type="file" id="import-file-input" accept=".json" style="display: none;">
            <button id="about-button" title="About Brainstorm & Timebox Pro">
                <svg xmlns="http://www.w3.org/2000/svg" height="1em" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-144c-17.7 0-32-14.3-32-32s14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32z"/></svg> About
            </button>
        </div>
    </header>

    <div class="app-container">
        <div class="task-project-container"> {/* Was task-list-container */}
            <div class="project-selector-area">
                <label for="project-filter-select">Project:</label>
                <select id="project-filter-select">
                    {/* Options will be populated by JS */}
                </select>
                <button id="manage-projects-btn" class="button-small">Manage Projects</button>
                 <button id="view-task-recycle-bin-btn" class="button-small">Task Bin</button>
            </div>

            <h2 id="tasks-section-header">Tasks</h2> {/* Will be updated by JS */}
            <div class="add-task">
                <input type="text" id="new-task-input" placeholder="Add a new task...">
                <button id="add-task-button" type="button">Add Task</button>
            </div>
            <ul id="task-list">
                {/* Tasks for the selected project will be populated by JS */}
            </ul>
        </div>

        <div class="schedule-container">
            <h2>Schedule</h2>
            <div id="schedule-timeline">
                {/* Timeline slots and scheduled tasks will be populated by JS */}
            </div>
        </div>
    </div>

    <div id="edit-task-modal" class="modal">
        <div class="modal-content">
            <span class="close-button" data-modal-id="edit-task-modal">&times;</span>
            <h3 id="edit-modal-title">Edit Scheduled Task</h3>
            <p><strong>Task:</strong> <span id="modal-task-name-display"></span></p>
            <div>
                <label for="modal-start-time">Start Time (HH:MM):</label>
                <input type="time" id="modal-start-time" required>
            </div>
            <div>
                <label for="modal-duration">Duration (minutes):</label>
                <input type="number" id="modal-duration" min="5" step="5" required>
            </div>
            <div>
                <label for="modal-schedule-description">Description (optional):</label>
                <textarea id="modal-schedule-description" rows="3"></textarea>
            </div>
            <button id="modal-save-task-button" type="button">Save Changes</button>
            <button id="modal-delete-task-button" class="delete-button" type="button">Delete from Schedule</button>
            <input type="hidden" id="modal-task-id"> {/* Unified task ID being edited/scheduled */}
        </div>
    </div>

    <div id="about-modal" class="modal">
        <div class="modal-content">
            <span class="close-button" data-modal-id="about-modal">&times;</span>
            <h3>About Brainstorm & Timebox Pro</h3>
            <p><strong>Version:</strong> 1.0.0 (Combined)</p>
            <p><strong>Creator:</strong> Imam Wahyudi (Brainbox) & AI Assisted Combination</p>
            <p>This application combines project management with timebox scheduling.</p>
            <p>
                <strong>Original Source (Brainbox):</strong>
                <a href="https://github.com/imamwahyudime/brainbox-webapp" target="_blank" rel="noopener noreferrer">
                    github.com/imamwahyudime/brainbox-webapp
                </a>
            </p>
            <div style="text-align: right; margin-top: 20px;">
                 <button id="about-modal-close-button" type="button" class="button-secondary">Close</button>
            </div>
        </div>
    </div>

    <div id="project-management-modal" class="modal">
        <div class="modal-content">
            <span class="close-button" data-modal-id="project-management-modal">&times;</span>
            <h3>Project Management</h3>

            <div class="form-section">
                <h4>Create New Project</h4>
                <form id="new-project-form">
                    <input type="text" id="new-project-name-input" placeholder="New Project Name" required>
                    <button type="submit">Add Project</button>
                </form>
                <p id="project-form-message" class="message"></p>
            </div>

            <div class="list-section">
                <h4>Active Projects</h4>
                <ul id="modal-project-list">
                    {/* Active projects will be listed here by JS */}
                </ul>
            </div>

            <div class="list-section">
                <h4>Deleted Projects (Recycle Bin)</h4>
                <ul id="modal-deleted-project-list">
                    {/* Deleted projects will be listed here by JS */}
                </ul>
                <p id="modal-deleted-project-message" class="message"></p>
            </div>
        </div>
    </div>

    <div id="task-recycle-bin-modal" class="modal">
        <div class="modal-content">
            <span class="close-button" data-modal-id="task-recycle-bin-modal">&times;</span>
            <h3>Task Recycle Bin</h3>
            <ul id="modal-task-recycle-bin-list">
                {/* Soft-deleted tasks will be listed here by JS */}
            </ul>
            <p id="modal-task-recycle-bin-message" class="message"></p>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
