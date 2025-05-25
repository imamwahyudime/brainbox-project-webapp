document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    // Header
    const themeSelect = document.getElementById('theme-select');
    const exportDataButton = document.getElementById('export-data-button');
    const importDataButton = document.getElementById('import-data-button');
    const importFileInput = document.getElementById('import-file-input');
    const aboutButton = document.getElementById('about-button');

    // Left Panel: Tasks & Projects
    const projectFilterSelect = document.getElementById('project-filter-select');
    const manageProjectsBtn = document.getElementById('manage-projects-btn');
    const viewTaskRecycleBinBtn = document.getElementById('view-task-recycle-bin-btn');
    const tasksSectionHeader = document.getElementById('tasks-section-header');
    const newTaskInput = document.getElementById('new-task-input');
    const addTaskButton = document.getElementById('add-task-button');
    const taskListEl = document.getElementById('task-list'); // Main list for project tasks

    // Right Panel: Schedule
    const scheduleTimelineEl = document.getElementById('schedule-timeline');

    // Edit/Schedule Task Modal
    const editTaskModal = document.getElementById('edit-task-modal');
    const editModalTitle = document.getElementById('edit-modal-title');
    const modalTaskNameDisplay = document.getElementById('modal-task-name-display');
    const modalStartTimeInput = document.getElementById('modal-start-time');
    const modalDurationInput = document.getElementById('modal-duration');
    const modalScheduleDescriptionInput = document.getElementById('modal-schedule-description');
    const modalSaveTaskButton = document.getElementById('modal-save-task-button');
    const modalDeleteTaskButton = document.getElementById('modal-delete-task-button'); // Consider renaming/repurposing
    const modalTaskIdInput = document.getElementById('modal-task-id');

    // About Modal
    const aboutModal = document.getElementById('about-modal');
    const aboutModalCloseButtonInternal = document.getElementById('about-modal-close-button');

    // Project Management Modal
    const projectManagementModal = document.getElementById('project-management-modal');
    const newProjectForm = document.getElementById('new-project-form');
    const newProjectNameInput = document.getElementById('new-project-name-input');
    const projectFormMessage = document.getElementById('project-form-message');
    const modalProjectListEl = document.getElementById('modal-project-list');
    const modalDeletedProjectListEl = document.getElementById('modal-deleted-project-list');
    const modalDeletedProjectMessage = document.getElementById('modal-deleted-project-message');

    // Task Recycle Bin Modal
    const taskRecycleBinModal = document.getElementById('task-recycle-bin-modal');
    const modalTaskRecycleBinListEl = document.getElementById('modal-task-recycle-bin-list');
    const modalTaskRecycleBinMessage = document.getElementById('modal-task-recycle-bin-message');

    // General Modal Close Buttons
    const allCloseButtons = document.querySelectorAll('.modal .close-button');

    // --- State Variables ---
    let projects = [];
    let tasks = []; // Unified task objects
    let appSettings = {
        theme: 'light',
        currentProjectId: null, // Will be set to UNCATEGORIZED_PROJECT_ID initially
        nextProjectIdNum: 1, // For generating numeric part of project IDs
        nextTaskIdNum: 1,    // For generating numeric part of task IDs
    };
    let draggedTaskId = null;


    // --- Constants ---
    const UNCATEGORIZED_PROJECT_ID = 'proj_0';
    const UNCATEGORIZED_PROJECT_NAME = "General Tasks";
    const LOCAL_STORAGE_KEY = 'brainboxProCombinedData_v1';

    // --- Helper Functions ---
    function generateId(prefix, num) {
        return `${prefix}_${num}`;
    }

    function saveState() {
        try {
            const dataToSave = {
                projects: projects,
                tasks: tasks.map(({ isOverlapping, ...rest }) => rest), // Remove transient properties like isOverlapping
                appSettings: appSettings
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
            console.log("State saved:", dataToSave);
        } catch (error) {
            console.error("Error saving state to localStorage:", error);
            displayFlashMessage(document.body, "Could not save data. Local storage might be full or disabled.", 'error', 5000); // Use a general message display
        }
    }

    function loadState() {
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedData) {
                const loadedData = JSON.parse(storedData);
                projects = loadedData.projects || [];
                tasks = loadedData.tasks || [];
                // Merge loaded settings with defaults to ensure new settings are picked up
                appSettings = { ...appSettings, ...(loadedData.appSettings || {}) };

                // Ensure ID counters are at least one greater than the max existing ID
                const maxProjNum = projects.reduce((max, p) => Math.max(max, parseInt(p.id.split('_')[1]) || 0), 0);
                appSettings.nextProjectIdNum = Math.max(appSettings.nextProjectIdNum, maxProjNum + 1);

                const maxTaskNum = tasks.reduce((max, t) => Math.max(max, parseInt(t.id.split('_')[1]) || 0), 0);
                appSettings.nextTaskIdNum = Math.max(appSettings.nextTaskIdNum, maxTaskNum + 1);

                console.log("State loaded.");
            }
        } catch (error) {
            console.error("Error loading state from localStorage:", error);
            projects = [];
            tasks = [];
            // Reset to default settings on error
            appSettings = { theme: 'light', currentProjectId: null, nextProjectIdNum: 1, nextTaskIdNum: 1 };
            displayFlashMessage(document.body, "Could not load saved data. It might be corrupted. Starting fresh.", 'error', 5000);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // Simple flash message - you might want a more robust solution
    function displayFlashMessage(parentElement, message, type = 'success', duration = 4000) {
        const messageEl = document.createElement('div');
        messageEl.className = `flash-message ${type}`;
        messageEl.textContent = message;
        // Style this flash message for visibility
        messageEl.style.position = 'fixed';
        messageEl.style.top = '20px';
        messageEl.style.left = '50%';
        messageEl.style.transform = 'translateX(-50%)';
        messageEl.style.padding = '10px 20px';
        messageEl.style.borderRadius = '5px';
        messageEl.style.zIndex = '2000';
        messageEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        messageEl.style.backgroundColor = type === 'error' ? 'var(--accent-delete)' : 'var(--accent-recover)';
        messageEl.style.color = 'white';

        (parentElement || document.body).appendChild(messageEl);
        setTimeout(() => {
            messageEl.remove();
        }, duration);
    }
    
    // --- Theming Functions ---
    function applyTheme(themeName) {
        document.body.dataset.theme = themeName;
        appSettings.theme = themeName;
        // No saveState() here, it will be saved with other appSettings changes or explicitly
    }

    function handleThemeChange(event) {
        applyTheme(event.target.value);
        saveState(); // Save state when theme changes
    }

    // --- Modal Handling ---
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'block';
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }

    function initModalCloseButtons() {
        allCloseButtons.forEach(button => {
            button.addEventListener('click', () => {
                const modalId = button.dataset.modalId || button.closest('.modal').id;
                if (modalId) closeModal(modalId);
            });
        });
        // Close About modal specifically with its internal button
        if (aboutModalCloseButtonInternal) {
            aboutModalCloseButtonInternal.addEventListener('click', () => closeModal('about-modal'));
        }
         // Close modal on outside click
        window.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                closeModal(event.target.id);
            }
        });
    }

    // --- Project Management ---
    function ensureUncategorizedProject() {
        const uncatProject = projects.find(p => p.id === UNCATEGORIZED_PROJECT_ID);
        if (!uncatProject) {
            projects.unshift({ // Add to the beginning
                id: UNCATEGORIZED_PROJECT_ID,
                name: UNCATEGORIZED_PROJECT_NAME,
                status: 'active',
                createdAt: new Date().toISOString(),
                isDefault: true // Mark as default, cannot be permanently deleted
            });
            // No need to increment nextProjectIdNum for the default one if it's fixed.
        }
        if (!appSettings.currentProjectId || !projects.some(p=>p.id === appSettings.currentProjectId && p.status === 'active')) {
            appSettings.currentProjectId = UNCATEGORIZED_PROJECT_ID;
        }
    }

    function renderProjectFilterDropdown() {
        projectFilterSelect.innerHTML = '';
        const activeProjects = projects.filter(p => p.status === 'active');
        
        activeProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = escapeHTML(project.name);
            if (project.id === appSettings.currentProjectId) {
                option.selected = true;
            }
            projectFilterSelect.appendChild(option);
        });
        if (activeProjects.length === 0 && appSettings.currentProjectId !== UNCATEGORIZED_PROJECT_ID) {
            // This case should ideally not happen if ensureUncategorizedProject works correctly
            // and currentProjectId is reset if its project becomes inactive.
             appSettings.currentProjectId = UNCATEGORIZED_PROJECT_ID; // Fallback
        }
        updateTasksSectionHeader();
    }
    
    function updateTasksSectionHeader() {
        const currentProject = projects.find(p => p.id === appSettings.currentProjectId);
        if (currentProject) {
            tasksSectionHeader.textContent = `Tasks for "${escapeHTML(currentProject.name)}"`;
        } else {
            tasksSectionHeader.textContent = `Tasks`; // Fallback
        }
    }

    function handleProjectFilterChange() {
        const newProjectId = projectFilterSelect.value;
        if (newProjectId && newProjectId !== appSettings.currentProjectId) {
            appSettings.currentProjectId = newProjectId;
            saveState(); // Save current project change
            renderTasksForCurrentProject();
            updateTasksSectionHeader();
        }
    }

    function openProjectManagementModal() {
        renderModalProjectList();
        renderModalDeletedProjectList();
        projectFormMessage.textContent = '';
        newProjectNameInput.value = '';
        openModal('project-management-modal');
    }

    function renderModalProjectList() {
        modalProjectListEl.innerHTML = '';
        projects.filter(p => p.status === 'active' && !p.isDefault).forEach(project => { // Exclude default from deletion/editing here
            const li = document.createElement('li');
            li.dataset.projectId = project.id;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = escapeHTML(project.name);
            li.appendChild(nameSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'item-actions';

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.add('delete-button'); // Existing Brainbox class for delete
            deleteBtn.title = "Move to Recycle Bin";
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Move project "${escapeHTML(project.name)}" to recycle bin? Its tasks will also be moved.`)) {
                    softDeleteProject(project.id);
                }
            });
            actionsDiv.appendChild(deleteBtn);
            li.appendChild(actionsDiv);
            modalProjectListEl.appendChild(li);
        });
        if (!modalProjectListEl.hasChildNodes()) {
             modalProjectListEl.innerHTML = '<p>No active custom projects.</p>';
        }
    }

    function renderModalDeletedProjectList() {
        modalDeletedProjectListEl.innerHTML = '';
        const deletedProjs = projects.filter(p => p.status === 'deleted');
        deletedProjs.sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));

        deletedProjs.forEach(project => {
            const li = document.createElement('li');
            li.dataset.projectId = project.id;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = escapeHTML(project.name);
            li.appendChild(nameSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'item-actions';

            const recoverBtn = document.createElement('button');
            recoverBtn.textContent = 'Recover';
            recoverBtn.classList.add('recover-btn');
            recoverBtn.addEventListener('click', (e) => { e.stopPropagation(); recoverProject(project.id); });
            actionsDiv.appendChild(recoverBtn);

            if (!project.isDefault) { // Default project cannot be permanently deleted
                const permDeleteBtn = document.createElement('button');
                permDeleteBtn.textContent = 'Delete Permanently';
                permDeleteBtn.classList.add('permanent-delete-btn');
                permDeleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`PERMANENTLY DELETE project "${escapeHTML(project.name)}" and ALL its tasks? This cannot be undone.`)) {
                        permanentlyDeleteProject(project.id);
                    }
                });
                actionsDiv.appendChild(permDeleteBtn);
            }
            li.appendChild(actionsDiv);
            modalDeletedProjectListEl.appendChild(li);
        });
        if (deletedProjs.length === 0) {
            modalDeletedProjectListEl.innerHTML = '<p>Project recycle bin is empty.</p>';
        }
        modalDeletedProjectMessage.textContent = '';
    }
    
    function displayModalMessage(modalMessageEl, text, type = 'success') {
        modalMessageEl.textContent = text;
        modalMessageEl.className = `message ${type}`; // Assumes 'success' or 'error' class
        setTimeout(() => {
            modalMessageEl.textContent = '';
            modalMessageEl.className = 'message';
        }, 4000);
    }

    newProjectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const projectName = newProjectNameInput.value.trim();
        if (projectName) {
            if (projects.some(p => p.name.toLowerCase() === projectName.toLowerCase() && p.status === 'active')) {
                displayModalMessage(projectFormMessage, `Project name "${escapeHTML(projectName)}" already exists.`, 'error');
                return;
            }
            addProject(projectName);
            newProjectNameInput.value = '';
            displayModalMessage(projectFormMessage, `Project "${escapeHTML(projectName)}" added.`, 'success');
        } else {
            displayModalMessage(projectFormMessage, 'Project name cannot be empty.', 'error');
        }
    });

    function addProject(name) {
        const newProjId = generateId('proj', appSettings.nextProjectIdNum++);
        const newProject = {
            id: newProjId,
            name: name,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        projects.push(newProject);
        renderModalProjectList();
        renderProjectFilterDropdown(); // Update dropdown
        // Auto-select the new project
        projectFilterSelect.value = newProjId;
        handleProjectFilterChange();
        saveState();
    }

    function softDeleteProject(projectId) {
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1 || projects[projectIndex].isDefault) {
             displayModalMessage(modalDeletedProjectMessage, "Cannot delete default project or project not found.", 'error');
             return;
        }

        projects[projectIndex].status = 'deleted';
        projects[projectIndex].deletedAt = new Date().toISOString();

        // Soft delete associated tasks and unschedule them
        tasks = tasks.map(task => {
            if (task.projectId === projectId && task.status !== 'deleted') { // Don't override if already deleted individually
                return {
                    ...task,
                    status: 'deleted',
                    isCompleted: false, // Reset completion
                    isScheduled: false, // Unschedule
                    startTime: null,
                    duration: null,
                    deletedReason: 'project_soft_deleted',
                    deletedAt: new Date().toISOString()
                };
            }
            return task;
        });

        // If current project is deleted, switch to Uncategorized
        if (appSettings.currentProjectId === projectId) {
            appSettings.currentProjectId = UNCATEGORIZED_PROJECT_ID;
            renderProjectFilterDropdown(); // This will also trigger task list render for new project
            renderTasksForCurrentProject();
        } else {
            renderProjectFilterDropdown(); // Just update dropdown
        }
        
        renderModalProjectList();
        renderModalDeletedProjectList();
        renderScheduleTimeline(); // Update timeline as tasks are unscheduled/deleted
        saveState();
        displayModalMessage(modalDeletedProjectMessage, `Project "${escapeHTML(projects[projectIndex].name)}" moved to recycle bin.`, 'success');
    }

    function recoverProject(projectId) {
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) return;

        projects[projectIndex].status = 'active';
        delete projects[projectIndex].deletedAt;

        // Recover tasks that were deleted because the project was deleted
        tasks = tasks.map(task => {
            if (task.projectId === projectId && task.deletedReason === 'project_soft_deleted') {
                return { ...task, status: 'active', deletedReason: undefined, deletedAt: undefined };
            }
            return task;
        });
        
        renderModalProjectList();
        renderModalDeletedProjectList();
        renderProjectFilterDropdown();
        // If no project is selected or current was just recovered, select it
        if(appSettings.currentProjectId === UNCATEGORIZED_PROJECT_ID || appSettings.currentProjectId === projectId){
            appSettings.currentProjectId = projectId;
            projectFilterSelect.value = projectId;
            handleProjectFilterChange();
        }
        saveState();
        displayModalMessage(modalDeletedProjectMessage, `Project "${escapeHTML(projects[projectIndex].name)}" recovered.`, 'success');
    }

    function permanentlyDeleteProject(projectId) {
        const project = projects.find(p => p.id === projectId);
        if (!project || project.isDefault) {
            displayModalMessage(modalDeletedProjectMessage, "Cannot delete default project or project not found.", 'error');
            return;
        }

        const projectName = project.name;
        projects = projects.filter(p => p.id !== projectId);
        // Permanently delete all tasks associated with this project
        tasks = tasks.filter(task => task.projectId !== projectId);

        if (appSettings.currentProjectId === projectId) { // If current project was deleted
            appSettings.currentProjectId = UNCATEGORIZED_PROJECT_ID;
            projectFilterSelect.value = UNCATEGORIZED_PROJECT_ID; // Ensure dropdown reflects this
            renderTasksForCurrentProject(); // Render tasks for the new current project
        }
        
        renderModalDeletedProjectList();
        renderProjectFilterDropdown(); // Update dropdown as a project is gone
        renderScheduleTimeline(); // Update timeline as tasks might be gone
        saveState();
        displayModalMessage(modalDeletedProjectMessage, `Project "${escapeHTML(projectName)}" and its tasks permanently deleted.`, 'success');
    }

    // --- Task Management (Unified) ---
    function renderTasksForCurrentProject() {
        taskListEl.innerHTML = '';
        if (!appSettings.currentProjectId) {
            taskListEl.innerHTML = '<p>Select a project to see tasks.</p>';
            return;
        }
        const currentProjectTasks = tasks.filter(task => task.projectId === appSettings.currentProjectId && task.status === 'active');
        currentProjectTasks.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));

        if (currentProjectTasks.length === 0) {
            taskListEl.innerHTML = '<p>No active tasks in this project. Add one!</p>';
        } else {
            currentProjectTasks.forEach(task => {
                const li = document.createElement('li');
                li.id = `task-${task.id}`; // For drag and drop reference
                li.dataset.taskId = task.id;
                if (task.isCompleted) li.classList.add('completed'); // Should not happen for active tasks, but defensive
                if (task.isScheduled) li.classList.add('scheduled-in-list'); // Optional: for styling

                li.setAttribute('draggable', 'true');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = task.isCompleted;
                checkbox.addEventListener('change', () => toggleTaskComplete(task.id));
                li.appendChild(checkbox);

                const textSpan = document.createElement('span');
                textSpan.className = 'task-text-content';
                textSpan.textContent = escapeHTML(task.text);
                li.appendChild(textSpan);

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'task-actions';

                const scheduleBtn = document.createElement('button');
                scheduleBtn.textContent = task.isScheduled ? 'Edit Schedule' : 'Schedule';
                scheduleBtn.title = task.isScheduled ? 'Edit schedule details' : 'Schedule this task';
                scheduleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openScheduleModal(task.id, task.isScheduled);
                });
                actionsDiv.appendChild(scheduleBtn);

                const deleteTaskBtn = document.createElement('button');
                deleteTaskBtn.innerHTML = '&#128465;'; // Trash can icon
                deleteTaskBtn.title = "Move task to recycle bin";
                deleteTaskBtn.classList.add('delete-button'); // General delete button style
                deleteTaskBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Move task "${escapeHTML(task.text)}" to the task recycle bin?`)) {
                        softDeleteTask(task.id);
                    }
                });
                actionsDiv.appendChild(deleteTaskBtn);
                li.appendChild(actionsDiv);
                taskListEl.appendChild(li);
            });
        }
    }

    function handleNewTaskSubmit() {
        const taskText = newTaskInput.value.trim();
        if (taskText === '') return;
        if (!appSettings.currentProjectId) {
            displayFlashMessage(taskListEl.parentElement, "Please select a project first or manage projects to create one.", 'error');
            return;
        }
        
        addTask(taskText, appSettings.currentProjectId);
        newTaskInput.value = '';
        newTaskInput.focus();
    }

    function addTask(text, projectId) {
        const newTaskId = generateId('task', appSettings.nextTaskIdNum++);
        const newTask = {
            id: newTaskId,
            projectId: projectId,
            text: text,
            isCompleted: false,
            status: 'active', // active, completed, deleted
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isScheduled: false,
            startTime: null,
            duration: null,
            scheduleDescription: ''
        };
        tasks.push(newTask);
        renderTasksForCurrentProject();
        saveState();
    }

    function toggleTaskComplete(taskId) {
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        tasks[taskIndex].isCompleted = !tasks[taskIndex].isCompleted;
        tasks[taskIndex].updatedAt = new Date().toISOString();

        if (tasks[taskIndex].isCompleted) {
            tasks[taskIndex].status = 'completed';
            tasks[taskIndex].isScheduled = false; // Completed tasks are unscheduled
            tasks[taskIndex].deletedAt = new Date().toISOString(); // Using deletedAt for recycle bin timestamp
            tasks[taskIndex].deletedReason = 'task_completed';
            displayFlashMessage(taskListEl.parentElement, `Task "${escapeHTML(tasks[taskIndex].text)}" marked complete & moved to bin.`, 'success');
        } else { // Should not be possible if "completed" tasks are in bin, but for robustness
            tasks[taskIndex].status = 'active';
            delete tasks[taskIndex].deletedAt;
            delete tasks[taskIndex].deletedReason;
        }
        
        renderTasksForCurrentProject();
        renderScheduleTimeline(); // Update timeline if task was scheduled
        saveState();
    }

    function softDeleteTask(taskId) {
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;
        const task = tasks[taskIndex];

        task.status = 'deleted';
        task.isCompleted = false; // Ensure it's not marked completed if just deleted
        task.isScheduled = false; // Unschedule
        task.deletedAt = new Date().toISOString();
        task.deletedReason = 'individual_deletion';
        
        renderTasksForCurrentProject();
        renderScheduleTimeline(); // Update timeline
        saveState();
        displayFlashMessage(taskListEl.parentElement, `Task "${escapeHTML(task.text)}" moved to recycle bin.`, 'success');
    }
    
    function openTaskRecycleBinModal() {
        renderTaskRecycleBinList();
        modalTaskRecycleBinMessage.textContent = '';
        openModal('task-recycle-bin-modal');
    }

    function renderTaskRecycleBinList() {
        modalTaskRecycleBinListEl.innerHTML = '';
        const deletedAndCompletedTasks = tasks.filter(t => t.status === 'deleted' || t.status === 'completed');
        deletedAndCompletedTasks.sort((a,b) => new Date(b.deletedAt || b.updatedAt) - new Date(a.deletedAt || a.updatedAt)); // Sort by deletion/completion time

        if(deletedAndCompletedTasks.length === 0) {
            modalTaskRecycleBinListEl.innerHTML = '<p>Task recycle bin is empty.</p>';
            return;
        }

        deletedAndCompletedTasks.forEach(task => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = escapeHTML(task.text);
            li.appendChild(nameSpan);

            const statusSpan = document.createElement('span');
            statusSpan.className = 'task-status-info';
            let statusText = task.status === 'completed' ? 'Completed' : 'Deleted';
            if (task.deletedReason === 'project_soft_deleted') statusText += ' (Project in Bin)';
            const project = projects.find(p => p.id === task.projectId);
            statusSpan.textContent = `(${statusText} from ${project ? escapeHTML(project.name) : 'Unknown Project'})`;
            li.appendChild(statusSpan);


            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'item-actions';

            const recoverBtn = document.createElement('button');
            recoverBtn.textContent = 'Recover';
            recoverBtn.classList.add('recover-btn');
            const parentProject = projects.find(p => p.id === task.projectId);
            if (!parentProject || parentProject.status !== 'active') {
                recoverBtn.disabled = true;
                recoverBtn.title = "Parent project is not active or has been deleted.";
            }
            recoverBtn.addEventListener('click', () => recoverTaskFromBin(task.id));
            actionsDiv.appendChild(recoverBtn);

            const permDeleteBtn = document.createElement('button');
            permDeleteBtn.textContent = 'Delete Permanently';
            permDeleteBtn.classList.add('permanent-delete-btn');
            permDeleteBtn.addEventListener('click', () => {
                 if (confirm(`PERMANENTLY DELETE task "${escapeHTML(task.text)}"? This cannot be undone.`)) {
                    permanentlyDeleteTaskFromBin(task.id);
                }
            });
            actionsDiv.appendChild(permDeleteBtn);
            li.appendChild(actionsDiv);
            modalTaskRecycleBinListEl.appendChild(li);
        });
    }

    function recoverTaskFromBin(taskId) {
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
             displayModalMessage(modalTaskRecycleBinMessage, 'Task not found.', 'error');
             return;
        }
        const taskToRecover = tasks[taskIndex];
        const parentProject = projects.find(p => p.id === taskToRecover.projectId);

        if (!parentProject || parentProject.status !== 'active') {
            displayModalMessage(modalTaskRecycleBinMessage, 'Cannot recover: Parent project is deleted or not active.', 'error');
            return;
        }

        taskToRecover.status = 'active';
        taskToRecover.isCompleted = false; // Ensure not completed
        delete taskToRecover.deletedAt;
        delete taskToRecover.deletedReason;
        taskToRecover.updatedAt = new Date().toISOString();
        
        renderTaskRecycleBinList();
        renderTasksForCurrentProject(); // If recovered to current project
        saveState();
        displayModalMessage(modalTaskRecycleBinMessage, `Task "${escapeHTML(taskToRecover.text)}" recovered.`, 'success');
    }

    function permanentlyDeleteTaskFromBin(taskId) {
        const taskText = tasks.find(t=>t.id === taskId)?.text || "Task";
        tasks = tasks.filter(t => t.id !== taskId);
        renderTaskRecycleBinList();
        saveState();
        displayModalMessage(modalTaskRecycleBinMessage, `Task "${escapeHTML(taskText)}" permanently deleted.`, 'success');
    }


    // --- Scheduling & Timeline Functions (Adapted from Brainbox) ---
    // Time formatting functions (from Brainbox, ensure they are here or imported)
    function formatTime(totalMinutes) { // HH:MM
        if (totalMinutes >= 1440) totalMinutes %= 1440;
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    function formatMinutesToHHMM(totalMinutes) { // For time input value
        if (isNaN(totalMinutes)) return "";
        const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
        const minutes = (totalMinutes % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    function formatHHMMToMinutes(hhmm) { // From time input value
        if (!hhmm) return NaN;
        try {
            const [hours, minutes] = hhmm.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
            return (hours * 60) + minutes;
        } catch { return NaN; }
    }

    function createHourSlots() {
        scheduleTimelineEl.innerHTML = ''; // Clear existing
        for (let i = 0; i < 24; i++) {
            const slot = document.createElement('div');
            slot.classList.add('hour-slot');
            slot.dataset.hour = i;
            const label = document.createElement('span');
            label.classList.add('hour-label');
            label.textContent = `${formatTime(i * 60)} - ${formatTime((i + 1) * 60)}`;
            slot.appendChild(label);
            scheduleTimelineEl.appendChild(slot);
        }
    }
    
    function getHourSlotFromY(clientY) {
        const timelineRect = scheduleTimelineEl.getBoundingClientRect();
        const y = clientY - timelineRect.top + scheduleTimelineEl.scrollTop;
        // Assuming 60px per hour as per original Brainbox CSS for .hour-slot
        const hourIndex = Math.floor(y / 60); 
        if (hourIndex < 0 || hourIndex > 23) return null;
        return scheduleTimelineEl.querySelector(`.hour-slot[data-hour="${hourIndex}"]`);
    }

    function renderScheduleTimeline() {
        // Remove only scheduled task elements, not hour slots
        scheduleTimelineEl.querySelectorAll('.scheduled-task').forEach(el => el.remove());

        const tasksToSchedule = tasks.filter(t => t.isScheduled && t.status === 'active' && !t.isCompleted);
        
        // Basic overlap detection (can be improved for multiple overlaps and visual stacking)
        tasksToSchedule.sort((a, b) => a.startTime - b.startTime);
        for(let i=0; i < tasksToSchedule.length; i++) tasksToSchedule[i].isOverlapping = false; // Reset

        for (let i = 0; i < tasksToSchedule.length; i++) {
            for (let j = i + 1; j < tasksToSchedule.length; j++) {
                const taskA = tasksToSchedule[i];
                const taskB = tasksToSchedule[j];
                const endTimeA = taskA.startTime + taskA.duration;
                const endTimeB = taskB.startTime + taskB.duration;
                if (taskA.startTime < endTimeB && endTimeA > taskB.startTime) {
                    tasksToSchedule[i].isOverlapping = true;
                    tasksToSchedule[j].isOverlapping = true;
                }
            }
        }

        tasksToSchedule.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.classList.add('scheduled-task');
            if (task.isOverlapping) taskEl.classList.add('overlapping');
            taskEl.id = `scheduled-${task.id}`;
            taskEl.dataset.taskId = task.id;
            taskEl.style.top = `${task.startTime}px`; // 1px per minute
            taskEl.style.height = `${Math.max(15, task.duration)}px`; // Min height 15px

            const textSpan = document.createElement('span');
            textSpan.classList.add('task-text');
            textSpan.textContent = escapeHTML(task.text);
            taskEl.appendChild(textSpan);

            const timeSpan = document.createElement('span');
            timeSpan.classList.add('task-time');
            timeSpan.textContent = `${formatTime(task.startTime)} - ${formatTime(task.startTime + task.duration)}`;
            taskEl.appendChild(timeSpan);

            // Add project name if multiple projects are common, for clarity
            // const project = projects.find(p => p.id === task.projectId);
            // if (project && project.id !== UNCATEGORIZED_PROJECT_ID) {
            //     const projectSpan = document.createElement('span');
            //     projectSpan.style.fontSize = '0.8em'; projectSpan.style.opacity = '0.7';
            //     projectSpan.textContent = ` (${escapeHTML(project.name)})`;
            //     textSpan.appendChild(projectSpan);
            // }

            taskEl.addEventListener('click', () => openScheduleModal(task.id, true));
            scheduleTimelineEl.appendChild(taskEl);
        });
    }

    // Drag and Drop for Scheduling
    taskListEl.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-text-content') || e.target.closest('li[draggable="true"]')) {
            const taskLi = e.target.closest('li[draggable="true"]');
            if (taskLi && taskLi.dataset.taskId) {
                draggedTaskId = taskLi.dataset.taskId;
                e.dataTransfer.setData('text/plain', draggedTaskId);
                e.dataTransfer.effectAllowed = 'move';
                taskLi.classList.add('dragging');
            }
        } else {
            e.preventDefault();
        }
    });

    taskListEl.addEventListener('dragend', (e) => {
        if (draggedTaskId) {
            const taskLi = document.getElementById(`task-${draggedTaskId}`) || taskListEl.querySelector(`li[data-task-id="${draggedTaskId}"]`);
            if (taskLi) taskLi.classList.remove('dragging');
        }
        draggedTaskId = null;
        clearDropTargets();
    });

    scheduleTimelineEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetSlot = getHourSlotFromY(e.clientY); // Highlight hour slot
        clearDropTargets();
        if (targetSlot) {
            targetSlot.classList.add('drop-target');
        }
    });
    
    scheduleTimelineEl.addEventListener('dragleave', (e) => {
        // Check if the mouse is truly leaving the timeline or just moving between child elements
        if (!scheduleTimelineEl.contains(e.relatedTarget)) {
            clearDropTargets();
        }
    });

    function clearDropTargets() {
        scheduleTimelineEl.querySelectorAll('.hour-slot.drop-target').forEach(el => {
            el.classList.remove('drop-target');
        });
    }

    scheduleTimelineEl.addEventListener('drop', (e) => {
        e.preventDefault();
        clearDropTargets();
        const droppedTaskId = e.dataTransfer.getData('text/plain');
        const taskToSchedule = tasks.find(t => t.id === droppedTaskId);

        if (!taskToSchedule || taskToSchedule.status !== 'active' || taskToSchedule.isCompleted) {
            draggedTaskId = null; return;
        }

        const timelineRect = scheduleTimelineEl.getBoundingClientRect();
        const dropY = e.clientY - timelineRect.top + scheduleTimelineEl.scrollTop;
        const rawMinutes = Math.max(0, Math.min(1439, Math.round(dropY))); // 1440 minutes in a day
        const startMinutes = Math.round(rawMinutes / 15) * 15; // Snap to 15 minute intervals

        draggedTaskId = null; // Reset
        openScheduleModal(taskToSchedule.id, taskToSchedule.isScheduled, startMinutes);
    });


    function openScheduleModal(taskId, isEditingExistingSchedule = false, defaultStartTime = null) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        modalTaskIdInput.value = task.id;
        modalTaskNameDisplay.textContent = escapeHTML(task.text);

        if (isEditingExistingSchedule || task.isScheduled) {
            editModalTitle.textContent = 'Edit Scheduled Task';
            modalStartTimeInput.value = formatMinutesToHHMM(task.startTime);
            modalDurationInput.value = task.duration;
            modalScheduleDescriptionInput.value = task.scheduleDescription || '';
            modalDeleteTaskButton.textContent = 'Unschedule';
            modalDeleteTaskButton.title = 'Remove this task from the schedule';
        } else {
            editModalTitle.textContent = 'Schedule Task';
            modalStartTimeInput.value = defaultStartTime !== null ? formatMinutesToHHMM(defaultStartTime) : '';
            modalDurationInput.value = task.duration || 45; // Default duration or previous if re-scheduling
            modalScheduleDescriptionInput.value = task.scheduleDescription || '';
            modalDeleteTaskButton.textContent = 'Cancel Scheduling'; // Or hide it
            modalDeleteTaskButton.title = 'Cancel scheduling this task';

        }
        openModal('edit-task-modal');
        modalStartTimeInput.focus();
    }
    
    function closeScheduleModal() {
        closeModal('edit-task-modal');
    }

    function handleSaveScheduledTask() {
        const taskId = modalTaskIdInput.value;
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
            displayFlashMessage(editTaskModal, "Task not found.", 'error'); return;
        }

        const newStartTime = formatHHMMToMinutes(modalStartTimeInput.value);
        const newDuration = parseInt(modalDurationInput.value, 10);

        if (isNaN(newStartTime)) {
            displayFlashMessage(editTaskModal, "Invalid start time.", 'error'); return;
        }
        if (isNaN(newDuration) || newDuration <= 0) {
            displayFlashMessage(editTaskModal, "Invalid duration.", 'error'); return;
        }

        tasks[taskIndex].isScheduled = true;
        tasks[taskIndex].startTime = newStartTime;
        tasks[taskIndex].duration = newDuration;
        tasks[taskIndex].scheduleDescription = modalScheduleDescriptionInput.value.trim();
        tasks[taskIndex].updatedAt = new Date().toISOString();
        
        closeScheduleModal();
        renderScheduleTimeline();
        renderTasksForCurrentProject(); // To update "Schedule" button text if needed
        saveState();
    }

    function handleDeleteFromSchedule() { // This now means "Unschedule"
        const taskId = modalTaskIdInput.value;
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        if (tasks[taskIndex].isScheduled) {
            tasks[taskIndex].isScheduled = false;
            tasks[taskIndex].startTime = null;
            tasks[taskIndex].duration = null;
            // tasks[taskIndex].scheduleDescription = ''; // Optionally clear
            tasks[taskIndex].updatedAt = new Date().toISOString();
            displayFlashMessage(taskListEl.parentElement, `Task "${escapeHTML(tasks[taskIndex].text)}" unscheduled.`, 'success');
        }
        
        closeScheduleModal();
        renderScheduleTimeline();
        renderTasksForCurrentProject();
        saveState();
    }

    // --- Import/Export ---
    function exportData() {
        const dataToExport = {
            projects: projects,
            tasks: tasks.map(({ isOverlapping, ...rest }) => rest),
            appSettings: appSettings
        };
        try {
            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `brainbox-combined-data-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            displayFlashMessage(document.body, "Data exported successfully!", 'success');
        } catch (error) {
            console.error("Error exporting data:", error);
            displayFlashMessage(document.body, "Failed to export data.", 'error');
        }
    }

    function importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedRaw = JSON.parse(e.target.result);
                if (!importedRaw || typeof importedRaw !== 'object' || !Array.isArray(importedRaw.projects) || !Array.isArray(importedRaw.tasks) || typeof importedRaw.appSettings !== 'object') {
                    throw new Error("Invalid file format. Required fields (projects, tasks, appSettings) missing or incorrect type.");
                }
                if (confirm("Importing this file will overwrite ALL current data. Are you sure?")) {
                    projects = importedRaw.projects;
                    tasks = importedRaw.tasks;
                    // Carefully merge appSettings to preserve defaults if some are missing in imported file
                    appSettings = { 
                        theme: 'light', currentProjectId: UNCATEGORIZED_PROJECT_ID, nextProjectIdNum:1, nextTaskIdNum:1, // Start with defaults
                        ...importedRaw.appSettings // Override with imported
                    };
                    
                    // Recalculate next IDs based on imported data to prevent collisions
                    const maxProjNum = projects.reduce((max, p) => Math.max(max, parseInt(p.id.split('_')[1]) || 0), 0);
                    appSettings.nextProjectIdNum = Math.max(appSettings.nextProjectIdNum, maxProjNum + 1);
                    const maxTaskNum = tasks.reduce((max, t) => Math.max(max, parseInt(t.id.split('_')[1]) || 0), 0);
                    appSettings.nextTaskIdNum = Math.max(appSettings.nextTaskIdNum, maxTaskNum + 1);

                    initializeAppUI(); // Re-initialize entire UI
                    saveState(); // Save the newly imported state
                    displayFlashMessage(document.body, "Data imported successfully!", 'success');
                }
            } catch (error) {
                console.error("Error importing data:", error);
                displayFlashMessage(document.body, `Failed to import file: ${error.message}`, 'error');
            } finally {
                importFileInput.value = null; // Reset file input
            }
        };
        reader.onerror = () => {
            displayFlashMessage(document.body, "Error reading the selected file.", 'error');
            importFileInput.value = null;
        };
        reader.readAsText(file);
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        themeSelect.addEventListener('change', handleThemeChange);
        aboutButton.addEventListener('click', () => openModal('about-modal'));
        
        projectFilterSelect.addEventListener('change', handleProjectFilterChange);
        manageProjectsBtn.addEventListener('click', openProjectManagementModal);
        viewTaskRecycleBinBtn.addEventListener('click', openTaskRecycleBinModal);

        addTaskButton.addEventListener('click', handleNewTaskSubmit);
        newTaskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleNewTaskSubmit(); });

        modalSaveTaskButton.addEventListener('click', handleSaveScheduledTask);
        modalDeleteTaskButton.addEventListener('click', handleDeleteFromSchedule); // This is "Unschedule" or "Cancel"

        exportDataButton.addEventListener('click', exportData);
        importDataButton.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', importData);
        
        initModalCloseButtons();
    }
    
    // --- Initialization ---
    function initializeAppUI() {
        applyTheme(appSettings.theme); // Apply loaded or default theme
        themeSelect.value = appSettings.theme;
        
        ensureUncategorizedProject(); // Ensure default project exists and currentProjectId is valid
        
        renderProjectFilterDropdown(); // Populates dropdown, sets current project, updates header
        renderTasksForCurrentProject(); // Renders tasks for the current project

        createHourSlots(); // Create timeline structure
        renderScheduleTimeline(); // Render scheduled tasks
    }

    function initializeApp() {
        loadState(); // Load data and settings first
        initializeAppUI(); // Then initialize UI components based on loaded state
        setupEventListeners(); // Setup event listeners last
        console.log("App initialized.");
        console.log("Current Project ID on init:", appSettings.currentProjectId);
        console.log("Projects on init:", projects);
        console.log("Tasks on init:", tasks);

    }

    initializeApp();
});
