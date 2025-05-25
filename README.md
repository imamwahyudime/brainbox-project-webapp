# Brainstorm & Timebox Pro - Combined

Brainstorm & Timebox Pro is a web application designed to help you manage your projects, tasks, and schedule all in one place. It combines robust project and task management features with a visual timeline for timeboxing your activities, ensuring you stay organized and productive.

This application is an enhanced version, merging the features of a project management tool (with project creation, task lists per project, and recycle bins) and a timeboxing/scheduling application (drag-and-drop scheduling, visual timeline, theming).

## Features:

* **Project Management:**
    * Create and manage multiple projects.
    * Organize tasks under specific projects.
    * A default "General Tasks" project for quick task additions.
    * Project Recycle Bin: Soft delete projects and recover them later, or delete them permanently.
* **Unified Task Management:**
    * Create tasks with descriptions within the context of a selected project or the "General Tasks" project.
    * Mark tasks as complete.
    * Task Recycle Bin: Soft delete tasks (from active list or when completed) and recover or permanently delete them.
* **Visual Timebox Scheduling:**
    * Schedule tasks onto a 24-hour visual timeline.
    * Drag and drop tasks from your project list directly onto the schedule.
    * Click a task on the schedule to edit its start time, duration, and add a schedule-specific description.
    * Unschedule tasks easily.
    * Visual indication for overlapping tasks on the timeline.
* **Customization & UX:**
    * **Theming:** Switch between Light and Dark themes to suit your preference.
    * **Responsive Design:** Adapts to different screen sizes for use on desktop and mobile devices.
* **Data Management:**
    * **Local Storage:** All your projects, tasks, and settings are saved locally in your browser.
    * **Export Data:** Export all your application data (projects, tasks, settings) to a JSON file for backup or migration.
    * **Import Data:** Import data from a previously exported JSON file, overwriting current data after confirmation.
* **User-Friendly Interface:**
    * Clear separation of project tasks and the main schedule.
    * Modal dialogs for focused actions like project management, task scheduling, and viewing recycle bins.
    * Informative messages for user actions.

## How to Use:

1.  **Open `index.html`:** Simply open the `index.html` file in a modern web browser.
2.  **Manage Projects (Optional but Recommended):**
    * Click the "Manage Projects" button.
    * Create new projects to categorize your work.
    * The "General Tasks" project is available by default.
3.  **Select a Project:** Use the dropdown in the top-left panel to select the project you want to work on.
4.  **Add Tasks:**
    * Type your task into the "Add a new task..." input and press Enter or click "Add Task".
    * The task will be added to the currently selected project and will appear in the list below.
5.  **Schedule Tasks:**
    * **Drag & Drop:** Drag a task from the list in the left panel onto the desired time slot on the schedule timeline in the right panel.
    * **Schedule Button:** Click the "Schedule" (or "Edit Schedule") button next to a task in the list. This will open a modal where you can set the start time and duration.
6.  **Manage Scheduled Tasks:**
    * Click on any task block in the schedule timeline to open the edit modal. You can adjust its time, duration, or unschedule it.
7.  **Complete or Delete Tasks:**
    * Use the checkbox next to a task in the list to mark it as complete. Completed tasks are moved to the Task Recycle Bin.
    * Use the trash icon (soft delete) next to a task to move it to the Task Recycle Bin.
8.  **Recycle Bins:**
    * Access the "Task Bin" or "Manage Projects" (for the project bin) to recover or permanently delete items.
9.  **Customize:**
    * Use the "Theme" dropdown in the header to switch between Light and Dark modes.
10. **Data Backup:**
    * Use the "Export" button in the header to save your data.
    * Use the "Import" button to load data from a file (note: this will overwrite existing data).

## Technology Stack:

* HTML5
* CSS3 (with CSS Variables for theming)
* Vanilla JavaScript (ES6+)

## Future Enhancements (Potential Ideas):

* Task priorities or tags.
* Recurring tasks.
* More advanced overlap handling/visualization on the schedule.
* Drag-to-resize for scheduled task duration on the timeline.
* Drag-to-move for scheduled tasks on the timeline.
* Notifications or reminders.
* Cloud synchronization (requires backend).
