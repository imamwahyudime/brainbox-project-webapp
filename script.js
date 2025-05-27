document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    // Header
    const themeSelect = document.getElementById('theme-select');
    const exportDataButton = document.getElementById('export-data-button');
    const importDataButton = document.getElementById('import-data-button');
    const importFileInput = document.getElementById('import-file-input');
    const aboutButton = document.getElementById('about-button');
    const userGreetingEl = document.getElementById('user-greeting');
    const logoutButton = document.getElementById('logout-button');
    // showAllTasksButton is now in the project-selector-area, but reference remains the same
    const showAllTasksButton = document.getElementById('show-all-tasks-button');


    // Left Panel: Tasks & Projects
    const projectFilterSelect = document.getElementById('project-filter-select');
    const manageProjectsBtn = document.getElementById('manage-projects-btn');
    const viewTaskRecycleBinBtn = document.getElementById('view-task-recycle-bin-btn');
    const tasksSectionHeader = document.getElementById('tasks-section-header');
    const newTaskInput = document.getElementById('new-task-input');
    const addTaskButton = document.getElementById('add-task-button');
    const taskListEl = document.getElementById('task-list');

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
    const modalDeleteTaskButton = document.getElementById('modal-delete-task-button');
    const modalCompleteTaskButton = document.getElementById('modal-complete-task-button');
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

    const authBlocker = document.getElementById('auth-blocker');
    const appContentWrapper = document.getElementById('app-content-wrapper');


    // --- State Variables ---
    let projects = [];
    let tasks = [];
    let appSettings = {
        theme: 'light',
        currentProjectId: null, // Can also be ALL_TASKS_VIEW_ID
        nextProjectIdNum: 1,
        nextTaskIdNum: 1,
    };
    let draggedTaskId = null;
    let draggedTaskOriginalData = null; // For timeline internal drag
    let isDraggingFromTimeline = false;
    let currentUser = null; // Holds user info after auth


    // --- Constants ---
    const UNCATEGORIZED_PROJECT_ID = 'proj_0';
    const UNCATEGORIZED_PROJECT_NAME = "General Tasks";
    const ALL_TASKS_VIEW_ID = '__ALL_TASKS__'; // Identifier for "All Tasks" view

    // --- API Helper ---
    async function apiRequest(action, data = {}, method = 'POST') {
        let url = '';
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin'
        };

        if (method === 'POST' || method === 'PUT') {
            options.body = JSON.stringify(data);
            url = `data_handler.php?action=${action}`;
            if (action === 'logout' || action === 'check_auth') {
                url = `auth.php?action=${action}`;
            }
        } else if (method === 'GET') {
            const queryParams = new URLSearchParams(data).toString();
            url = `data_handler.php?action=${action}${queryParams ? '&' + queryParams : ''}`;
            if (action === 'check_auth') {
                 url = `auth.php?action=${action}${queryParams ? '&' + queryParams : ''}`;
            }
        }


        try {
            console.log(`API Request: ${method} to ${url}`, method === 'POST' || method === 'PUT' ? data : {});
            const response = await fetch(url, options);
            if (!response.ok) {
                let errorResult = { message: `Server error: ${response.status} ${response.statusText}` };
                try {
                    errorResult = await response.json(); // Try to parse JSON error from server
                } catch (e) {
                    // If response is not JSON (e.g. HTML error page), capture raw text
                    const rawText = await response.text();
                    console.error(`Non-JSON API Error Response Text (${action} to ${url}):`, rawText);
                    errorResult.message = rawText.substring(0, 200) + "... (Check console for full text)"; // Provide snippet
                 }
                console.error(`API Error (${action} to ${url}): ${response.status}`, errorResult.message || response.statusText, errorResult);
                throw new Error(errorResult.message || `Server returned status ${response.status}`);
            }
            const responseData = await response.json();
            console.log(`API Response for ${action}:`, responseData);
            if (responseData.debug_log) {
                console.warn(`PHP Debug Log for ${action} (from apiRequest):`, responseData.debug_log);
            }
            if (responseData.raw_php_output && typeof responseData.raw_php_output === 'string' && responseData.raw_php_output.trim() !== "") {
                console.warn(`Raw PHP Output for ${action} (from apiRequest):`, responseData.raw_php_output);
            }
            return responseData;
        } catch (error) {
            console.error(`Workspace error for ${action} to ${url}:`, error);
            if (action !== 'save_app_settings' && action !== 'check_auth') {
                displayFlashMessage(document.body, `Error communicating with server: ${error.message}`, 'error', 5000);
            }
            throw error;
        }
    }

    // --- Helper Functions ---
    async function syncAppSettings() {
        if (!currentUser) return;
        try {
            const settingsToSync = {
                theme: appSettings.theme,
                // Do not sync ALL_TASKS_VIEW_ID as currentProjectId to server, only actual project IDs or null
                currentProjectId: appSettings.currentProjectId === ALL_TASKS_VIEW_ID ? null : appSettings.currentProjectId,
            };
            await apiRequest('save_app_settings', { settings: settingsToSync });
            console.log("App settings synced with server.");
        } catch (error) {
            // error already logged by apiRequest
        }
    }


    async function loadDataFromServer() {
        try {
            console.log("Attempting to load all data from server...");
            const serverData = await apiRequest('get_all_data', {}, 'GET');

            console.log('Full serverData received in loadDataFromServer:', serverData);
            console.log('Directly checking serverData.tasks in loadDataFromServer:', serverData.tasks);


            if (serverData.success) {
                projects = serverData.projects || [];
                tasks = serverData.tasks || [];

                console.log('Local `tasks` array initialized in loadDataFromServer:', JSON.parse(JSON.stringify(tasks)));


                const serverSettings = serverData.appSettings || {};
                const localTheme = localStorage.getItem('brainboxProTheme');

                appSettings = {
                    theme: localTheme || serverSettings.theme || 'light',
                    currentProjectId: serverSettings.current_project_id || serverSettings.currentProjectId || null,
                    nextProjectIdNum: 1,
                    nextTaskIdNum: 1,
                };

                applyTheme(appSettings.theme);
                themeSelect.value = appSettings.theme;

                console.log("Data processed by client.", {projects, tasks, appSettings});
                await ensureUncategorizedProject();
                initializeAppUI();
            } else {
                let errorMessage = serverData.message || "Failed to load data from server (serverData.success was false).";
                if(serverData.debug_log && serverData.debug_log.length > 0){
                    errorMessage += " Server debug: " + serverData.debug_log.join("; ");
                }
                throw new Error(errorMessage);
            }
        } catch (error) {
            displayFlashMessage(document.body, `Could not load data: ${error.message}`, 'error', 7000);
            authBlocker.style.display = 'flex';
            authBlocker.innerHTML = `<div style="background-color: var(--bg-modal); color: var(--text-primary); padding: 30px; border-radius: 8px; display: inline-block; box-shadow: 0 5px 15px var(--shadow-primary);"><h3 style="margin-bottom: 15px;">Loading Error</h3><p>Could not load application data. Please <a href="login.html" style="color: var(--accent-primary); font-weight: bold;">login again</a> or contact support if the issue persists.</p></div>`;
            appContentWrapper.style.display = 'none';
        }
    }


    function escapeHTML(str) {
        if (str === null || typeof str === 'undefined') return '';
        if (typeof str !== 'string') str = String(str);
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function displayFlashMessage(parentElement, message, type = 'success', duration = 4000) {
        const existingMessages = document.querySelectorAll('.flash-message');
        for (let em of existingMessages) {
            if (em.textContent === message && em.classList.contains(type)) return;
        }

        const messageEl = document.createElement('div');
        messageEl.className = `flash-message ${type}`;
        messageEl.textContent = message;
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
        messageEl.style.textAlign = 'center';


        (parentElement || document.body).appendChild(messageEl);
        setTimeout(() => {
            messageEl.remove();
        }, duration);
    }

    function applyTheme(themeName) {
        document.body.dataset.theme = themeName;
        localStorage.setItem('brainboxProTheme', themeName);
        if (themeSelect.value !== themeName) {
            themeSelect.value = themeName;
        }
    }

    async function handleThemeChange(event) {
        const newTheme = event.target.value;
        applyTheme(newTheme);
        appSettings.theme = newTheme;
        await syncAppSettings();
    }

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
        if (aboutModalCloseButtonInternal) {
            aboutModalCloseButtonInternal.addEventListener('click', () => closeModal('about-modal'));
        }
        window.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                closeModal(event.target.id);
            }
        });
    }

    async function ensureUncategorizedProject() {
        const uncatProject = projects.find(p => p.id === UNCATEGORIZED_PROJECT_ID);
        if (!uncatProject) {
            console.warn(`${UNCATEGORIZED_PROJECT_NAME} (${UNCATEGORIZED_PROJECT_ID}) not found after server load. The server should provide this by default. This might indicate an issue.`);
        }

        const currentProjectIsValid = appSettings.currentProjectId &&
                                    appSettings.currentProjectId !== ALL_TASKS_VIEW_ID && // ALL_TASKS_VIEW_ID is not a real project
                                    projects.some(p => p.id === appSettings.currentProjectId && p.status === 'active');

        if (!currentProjectIsValid && appSettings.currentProjectId !== ALL_TASKS_VIEW_ID) {
            const defaultProj = projects.find(p => p.id === UNCATEGORIZED_PROJECT_ID && p.status === 'active');
            const firstActiveProj = projects.find(p => p.status === 'active');

            const oldCurrentProjectId = appSettings.currentProjectId;
            appSettings.currentProjectId = defaultProj ? defaultProj.id : (firstActiveProj ? firstActiveProj.id : null);

            if (oldCurrentProjectId !== appSettings.currentProjectId) {
                console.log("Updated appSettings.currentProjectId in ensureUncategorizedProject from", oldCurrentProjectId, "to:", appSettings.currentProjectId);
                await syncAppSettings();
            }
        }
    }


    function renderProjectFilterDropdown() {
        projectFilterSelect.innerHTML = '';
        const activeProjects = projects.filter(p => p.status === 'active');
        console.log("Rendering project filter dropdown. Active projects:", activeProjects, "Current appSettings.currentProjectId:", appSettings.currentProjectId);

        // Add a placeholder if "All Tasks" view is active or no specific project is default
        // This placeholder won't be selectable to *trigger* All Tasks view, but reflects it.
        if (appSettings.currentProjectId === ALL_TASKS_VIEW_ID) {
            const option = document.createElement('option');
            option.value = ""; // Or a special value if you want to re-select "All Tasks" via dropdown
            option.textContent = "Showing All Tasks";
            option.disabled = true; // Or remove if you want it to be selectable to clear filter
            projectFilterSelect.appendChild(option);
        }


        if (activeProjects.length === 0 && appSettings.currentProjectId !== ALL_TASKS_VIEW_ID) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No active projects";
            option.disabled = true;
            projectFilterSelect.appendChild(option);
            if (appSettings.currentProjectId !== null && appSettings.currentProjectId !== ALL_TASKS_VIEW_ID) {
                appSettings.currentProjectId = null;
            }
        } else {
            activeProjects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = escapeHTML(project.name);
                projectFilterSelect.appendChild(option);
            });

            // Set selected value
            if (appSettings.currentProjectId && appSettings.currentProjectId !== ALL_TASKS_VIEW_ID && activeProjects.some(p => p.id === appSettings.currentProjectId)) {
                projectFilterSelect.value = appSettings.currentProjectId;
            } else if (appSettings.currentProjectId !== ALL_TASKS_VIEW_ID) { // If current project ID is invalid but not "All Tasks"
                const newCurrent = activeProjects.find(p => p.id === UNCATEGORIZED_PROJECT_ID && p.status === 'active') || (activeProjects.length > 0 ? activeProjects[0] : null);
                if (newCurrent) {
                    appSettings.currentProjectId = newCurrent.id;
                    projectFilterSelect.value = appSettings.currentProjectId;
                } else {
                    appSettings.currentProjectId = null; // No valid project to select
                    projectFilterSelect.value = ""; // Clear selection if nothing else fits
                }
            } else if (appSettings.currentProjectId !== ALL_TASKS_VIEW_ID) { // If currentProjectId is simply null (not ALL_TASKS)
                 projectFilterSelect.value = ""; // Ensure dropdown shows nothing specific selected
            }
        }
        console.log("After renderProjectFilterDropdown, appSettings.currentProjectId:", appSettings.currentProjectId, "Dropdown value:", projectFilterSelect.value);
        updateTasksSectionHeader();
    }

    function updateTasksSectionHeader() {
        if (appSettings.currentProjectId === ALL_TASKS_VIEW_ID) {
            tasksSectionHeader.textContent = 'All Active Tasks';
        } else {
            const currentProject = projects.find(p => p.id === appSettings.currentProjectId);
            if (currentProject) {
                tasksSectionHeader.textContent = `Tasks for "${escapeHTML(currentProject.name)}"`;
            } else {
                tasksSectionHeader.textContent = `Tasks (No project selected)`;
            }
        }
    }

    async function handleProjectFilterChange() {
        const newProjectIdFromDropdown = projectFilterSelect.value;
        const oldProjectId = appSettings.currentProjectId;
        console.log("Project filter changed. New selected project ID from dropdown:", newProjectIdFromDropdown, "Old currentProjectId:", oldProjectId);

        // If user selects an actual project, newProjectIdFromDropdown will be a project ID.
        // If the dropdown was somehow cleared (e.g. no projects), it might be an empty string.
        // We directly use the dropdown's value. The "All Tasks" button handles setting ALL_TASKS_VIEW_ID.
        appSettings.currentProjectId = newProjectIdFromDropdown || null; // "" becomes null

        // Sync if it's a real project ID or null, not for ALL_TASKS_VIEW_ID
        if (appSettings.currentProjectId !== ALL_TASKS_VIEW_ID) {
            await syncAppSettings();
        }
        updateTasksSectionHeader();
        renderTasksForCurrentProject();
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
        projects.filter(p => p.status === 'active' && p.id !== UNCATEGORIZED_PROJECT_ID).forEach(project => {
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
            deleteBtn.classList.add('delete-button');
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
        deletedProjs.sort((a,b) => new Date(b.deletedAt || b.deleted_at || 0) - new Date(a.deletedAt || a.deleted_at || 0));
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

            if (project.id !== UNCATEGORIZED_PROJECT_ID) {
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
        if (!modalMessageEl) return;
        modalMessageEl.textContent = text;
        modalMessageEl.className = `message ${type}`;
        setTimeout(() => {
            modalMessageEl.textContent = '';
            modalMessageEl.className = 'message';
        }, 4000);
    }

    newProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectName = newProjectNameInput.value.trim();
        if (projectName) {
            if (projects.some(p => p.name.toLowerCase() === projectName.toLowerCase() && p.status === 'active')) {
                displayModalMessage(projectFormMessage, `Project name "${escapeHTML(projectName)}" already exists.`, 'error');
                return;
            }
            await addProject(projectName);
            newProjectNameInput.value = '';
        } else {
            displayModalMessage(projectFormMessage, 'Project name cannot be empty.', 'error');
        }
    });

    async function addProject(name) {
        const newProjectData = {
            name: name,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        try {
            const result = await apiRequest('add_project', { project: newProjectData });
            if (result.success && result.project) {
                projects.push(result.project);

                renderModalProjectList();
                renderProjectFilterDropdown();
                appSettings.currentProjectId = result.project.id; // Switch to the new project
                projectFilterSelect.value = result.project.id;
                await handleProjectFilterChange(); // This will sync and render tasks
                displayModalMessage(projectFormMessage, `Project "${escapeHTML(result.project.name)}" added.`, 'success');
            } else {
                throw new Error(result.message || "Failed to add project on server.");
            }
        } catch (error) {
            displayModalMessage(projectFormMessage, `Error adding project: ${error.message}`, 'error');
        }
    }

    async function softDeleteProject(projectId) {
        const project = projects.find(p => p.id === projectId);
        if (!project || project.id === UNCATEGORIZED_PROJECT_ID) {
             displayModalMessage(modalDeletedProjectMessage, "Cannot delete default project or project not found.", 'error');
             return;
        }

        try {
            const result = await apiRequest('soft_delete_project', { projectId });
            if (result.success) {
                const projectIndex = projects.findIndex(p => p.id === projectId);
                if (projectIndex !== -1) {
                    projects[projectIndex].status = 'deleted';
                    projects[projectIndex].deletedAt = result.deletedAt || new Date().toISOString();
                    projects[projectIndex].deleted_at = result.deletedAt || new Date().toISOString();
                }

                tasks = tasks.map(task => {
                    if (task.project_id === projectId && task.status !== 'deleted') {
                        return {
                            ...task,
                            status: 'deleted',
                            is_scheduled: 0,
                            deletedReason: 'project_soft_deleted',
                            deletedAt: result.deletedAt || new Date().toISOString(),
                            deleted_at: result.deletedAt || new Date().toISOString()
                        };
                    }
                    return task;
                });
                
                renderProjectFilterDropdown(); // Re-render dropdown first
                // If the deleted project was the current one (or if in All Tasks view, need to refresh)
                if (appSettings.currentProjectId === projectId || appSettings.currentProjectId === ALL_TASKS_VIEW_ID) {
                    // If it was the current project, try to select another one, or fall back to null
                    if(appSettings.currentProjectId === projectId) {
                        appSettings.currentProjectId = projects.find(p => p.id === UNCATEGORIZED_PROJECT_ID && p.status === 'active')?.id ||
                                                     projects.find(p => p.status === 'active')?.id ||
                                                     null;
                         projectFilterSelect.value = appSettings.currentProjectId || "";
                    }
                    await handleProjectFilterChange(); // This will re-render tasks for new/all view and sync
                }
                // Else, the current view (specific other project) remains valid, just update lists

                renderModalProjectList();
                renderModalDeletedProjectList();
                renderScheduleTimeline();
                displayModalMessage(modalDeletedProjectMessage, `Project "${escapeHTML(project.name)}" moved to recycle bin.`, 'success');
            } else {
                throw new Error(result.message || "Failed to soft delete project.");
            }
        } catch (error) {
            displayModalMessage(modalDeletedProjectMessage, `Error soft deleting project: ${error.message}`, 'error');
        }
    }

    async function recoverProject(projectId) {
         const projectToRecover = projects.find(p => p.id === projectId && p.status === 'deleted');
         if (!projectToRecover) {
            displayModalMessage(modalDeletedProjectMessage, "Project not found in bin or not deleted.", 'error');
            return;
         }

        try {
            const result = await apiRequest('recover_project', { projectId });
            if (result.success && result.recoveredProject && result.recoveredTasks) {
                const projectIndex = projects.findIndex(p => p.id === projectId);
                if(projectIndex !== -1) projects[projectIndex] = result.recoveredProject;
                else projects.push(result.recoveredProject);

                result.recoveredTasks.forEach(recoveredTask => {
                    const taskIndex = tasks.findIndex(t => t.id === recoveredTask.id);
                    if (taskIndex !== -1) {
                        tasks[taskIndex] = recoveredTask;
                    } else {
                        tasks.push(recoveredTask);
                    }
                });

                renderModalProjectList();
                renderModalDeletedProjectList();
                renderProjectFilterDropdown();

                // If not in "All Tasks" view, consider switching to the recovered project
                if (appSettings.currentProjectId !== ALL_TASKS_VIEW_ID) {
                     appSettings.currentProjectId = projectId; // Switch to the recovered project
                     projectFilterSelect.value = projectId;
                }
                // Or, if already in "All Tasks" view, it will just refresh with the new data.
                await handleProjectFilterChange(); // Will sync and re-render tasks

                renderScheduleTimeline();
                displayModalMessage(modalDeletedProjectMessage, `Project "${escapeHTML(result.recoveredProject.name)}" recovered.`, 'success');
            } else {
                throw new Error(result.message || "Failed to recover project.");
            }
        } catch (error) {
             displayModalMessage(modalDeletedProjectMessage, `Error recovering project: ${error.message}`, 'error');
        }
    }

    async function permanentlyDeleteProject(projectId) {
        const project = projects.find(p => p.id === projectId);
        if (!project || project.id === UNCATEGORIZED_PROJECT_ID) {
            displayModalMessage(modalDeletedProjectMessage, "Cannot delete default project or project not found.", 'error');
            return;
        }
        const projectName = project.name;
        try {
            const result = await apiRequest('permanently_delete_project', { projectId });
            if (result.success) {
                projects = projects.filter(p => p.id !== projectId);
                tasks = tasks.filter(task => task.project_id !== projectId);

                renderProjectFilterDropdown(); // Re-render dropdown first
                if (appSettings.currentProjectId === projectId || appSettings.currentProjectId === ALL_TASKS_VIEW_ID) {
                    if(appSettings.currentProjectId === projectId) {
                        appSettings.currentProjectId = projects.find(p => p.id === UNCATEGORIZED_PROJECT_ID && p.status === 'active')?.id ||
                                                     projects.find(p => p.status === 'active')?.id ||
                                                     null;
                        projectFilterSelect.value = appSettings.currentProjectId || "";
                    }
                    await handleProjectFilterChange();
                }

                renderModalDeletedProjectList();
                renderScheduleTimeline();
                displayModalMessage(modalDeletedProjectMessage, `Project "${escapeHTML(projectName)}" and its tasks permanently deleted.`, 'success');
            } else {
                throw new Error(result.message || "Failed to permanently delete project.");
            }
        } catch (error) {
            displayModalMessage(modalDeletedProjectMessage, `Error deleting project: ${error.message}`, 'error');
        }
    }

    // New helper function to create task list items
    function createTaskListItem(task) {
        const li = document.createElement('li');
        li.id = `task-${task.id}`;
        li.dataset.taskId = task.id;
        const isScheduled = task.is_scheduled;
        if (isScheduled) li.classList.add('scheduled-in-list');
        li.setAttribute('draggable', 'true');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = false; // Task status 'completed' means it won't be in 'active' lists.
        checkbox.title = "Mark task as complete";
        checkbox.addEventListener('change', () => toggleTaskComplete(task.id));
        li.appendChild(checkbox);

        const textSpan = document.createElement('span');
        textSpan.className = 'task-text-content';
        textSpan.textContent = escapeHTML(task.text);
        li.appendChild(textSpan);

        // Add project name badge if in "All Tasks" view
        if (appSettings.currentProjectId === ALL_TASKS_VIEW_ID) {
            const projectForTask = projects.find(p => p.id === task.project_id);
            const projectName = projectForTask ? projectForTask.name : 'Unknown Project';

            const projectBadge = document.createElement('span');
            projectBadge.className = 'task-project-badge'; // For styling
            projectBadge.textContent = escapeHTML(projectName);
            // Inline styles for the badge (can also be moved to style.css)
            projectBadge.style.fontSize = '0.75em';
            projectBadge.style.marginLeft = '8px';
            projectBadge.style.padding = '1px 5px';
            projectBadge.style.backgroundColor = 'var(--bg-tertiary)';
            projectBadge.style.color = 'var(--text-secondary)';
            projectBadge.style.borderRadius = '4px';
            projectBadge.style.display = 'inline-block';
            textSpan.appendChild(projectBadge);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'task-actions';

        const scheduleBtn = document.createElement('button');
        scheduleBtn.textContent = isScheduled ? 'Edit Schedule' : 'Schedule';
        scheduleBtn.title = isScheduled ? 'Edit schedule details' : 'Schedule this task';
        scheduleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openScheduleModal(task.id, isScheduled);
        });
        actionsDiv.appendChild(scheduleBtn);

        const deleteTaskBtn = document.createElement('button');
        deleteTaskBtn.innerHTML = '&#128465;'; // Trash icon
        deleteTaskBtn.title = "Move task to recycle bin";
        deleteTaskBtn.classList.add('delete-button');
        deleteTaskBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Move task "${escapeHTML(task.text)}" to the task recycle bin?`)) {
                softDeleteTask(task.id);
            }
        });
        actionsDiv.appendChild(deleteTaskBtn);
        li.appendChild(actionsDiv);
        return li;
    }


    function renderTasksForCurrentProject() {
        taskListEl.innerHTML = '';
        console.log('Rendering tasks. appSettings.currentProjectId:', appSettings.currentProjectId);

        if (appSettings.currentProjectId === ALL_TASKS_VIEW_ID) {
            let allActiveTasksFromAllProjects = [];
            const activeProjects = projects.filter(p => p.status === 'active');

            activeProjects.forEach(project => {
                const projectTasks = tasks.filter(task => task.project_id === project.id && task.status === 'active');
                projectTasks.forEach(pTask => {
                    allActiveTasksFromAllProjects.push(pTask);
                });
            });

            // Sort all tasks: by project name (asc), then by task creation date (asc)
            allActiveTasksFromAllProjects.sort((a, b) => {
                const projectA = projects.find(p => p.id === a.project_id)?.name.toLowerCase() || '\uffff';
                const projectB = projects.find(p => p.id === b.project_id)?.name.toLowerCase() || '\uffff';
                if (projectA < projectB) return -1;
                if (projectA > projectB) return 1;
                return new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0);
            });

            if (allActiveTasksFromAllProjects.length === 0) {
                taskListEl.innerHTML = '<p>No active tasks found across all projects.</p>';
            } else {
                allActiveTasksFromAllProjects.forEach(task => {
                    const li = createTaskListItem(task);
                    taskListEl.appendChild(li);
                });
            }
        } else if (!appSettings.currentProjectId) { // No specific project selected, and not "All Tasks"
            taskListEl.innerHTML = `<p>Select a project to view tasks, or create one.</p>`;
        } else { // A specific project is selected
            const currentProjectTasks = tasks.filter(task => {
                return task.project_id === appSettings.currentProjectId && task.status === 'active';
            });

            console.log('Filtered tasks for current project (' + appSettings.currentProjectId + '):', JSON.parse(JSON.stringify(currentProjectTasks)));
            currentProjectTasks.sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0));

            if (currentProjectTasks.length === 0) {
                taskListEl.innerHTML = '<p>No active tasks in this project. Add one!</p>';
            } else {
                currentProjectTasks.forEach(task => {
                    const li = createTaskListItem(task);
                    taskListEl.appendChild(li);
                });
            }
        }
    }


    async function handleNewTaskSubmit() {
        const taskText = newTaskInput.value.trim();
        if (taskText === '') return;
        if (!appSettings.currentProjectId || appSettings.currentProjectId === ALL_TASKS_VIEW_ID) {
            displayFlashMessage(taskListEl.parentElement, "Please select a specific project first to add a task.", 'error');
            return;
        }

        await addTask(taskText, appSettings.currentProjectId);
        newTaskInput.value = '';
        newTaskInput.focus();
    }

    async function addTask(text, projectId) {
        const newTaskData = {
            projectId: projectId,
            text: text,
        };

        try {
            const result = await apiRequest('add_task', { task: newTaskData });
            if (result.success && result.task) {
                tasks.push(result.task);
                renderTasksForCurrentProject(); // Re-render tasks for the current view
            } else {
                throw new Error(result.message || "Failed to add task on server.");
            }
        } catch (error) {
            displayFlashMessage(taskListEl.parentElement, `Error adding task: ${error.message}`, 'error');
        }
    }

    async function toggleTaskComplete(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const completedAt = new Date().toISOString();
        const updateData = {
            taskId,
            status: 'completed',
            isScheduled: false,
            deletedAt: completedAt,
            deletedReason: 'task_completed'
        };

        try {
            const result = await apiRequest('update_task_status', updateData);
            if (result.success && result.updatedTask) {
                const taskIndex = tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                     tasks[taskIndex] = { ...tasks[taskIndex], ...result.updatedTask };
                } else {
                     tasks.push(result.updatedTask); // Should not happen if task was found initially
                }

                displayFlashMessage(document.body, `Task "${escapeHTML(task.text)}" marked complete.`, 'success');

                renderTasksForCurrentProject(); // Will refresh current view (project or all tasks)
                renderScheduleTimeline();

                if (editTaskModal.style.display === 'block' && modalTaskIdInput.value === taskId) {
                    closeModal('edit-task-modal');
                }

            } else {
                throw new Error(result.message || "Failed to update task status.");
            }
        } catch (error) {
            displayFlashMessage(document.body, `Error completing task: ${error.message}`, 'error');
            renderTasksForCurrentProject(); // Re-render to revert UI changes if needed
        }
    }

    async function softDeleteTask(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        try {
            const result = await apiRequest('soft_delete_task', {
                taskId,
                deletedReason: 'individual_deletion'
            });

            if (result.success && result.updatedTask) {
                 const taskIndex = tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    tasks[taskIndex] = { ...tasks[taskIndex], ...result.updatedTask };
                } else {
                     tasks.push(result.updatedTask);
                }

                renderTasksForCurrentProject();
                renderScheduleTimeline();
                displayFlashMessage(taskListEl.parentElement, `Task "${escapeHTML(task.text)}" moved to recycle bin.`, 'success');
            } else {
                throw new Error(result.message || "Failed to move task to recycle bin.");
            }
        } catch (error) {
            displayFlashMessage(taskListEl.parentElement, `Error deleting task: ${error.message}`, 'error');
        }
    }

    function openTaskRecycleBinModal() {
        renderTaskRecycleBinList();
        modalTaskRecycleBinMessage.textContent = '';
        openModal('task-recycle-bin-modal');
    }

    function renderTaskRecycleBinList() {
        modalTaskRecycleBinListEl.innerHTML = '';
        const deletedAndCompletedTasks = tasks.filter(t => t.status === 'deleted' || t.status === 'completed');
        deletedAndCompletedTasks.sort((a,b) => new Date(b.deletedAt || b.updatedAt || b.deleted_at || b.updated_at || 0) - new Date(a.deletedAt || a.updatedAt || a.deleted_at || a.updated_at || 0));


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
            else if (task.deletedReason === 'individual_deletion') statusText += ' (User Deleted)';
            else if (task.deletedReason === 'task_completed') statusText = 'Completed';


            const project = projects.find(p => p.id === task.project_id);
            statusSpan.textContent = `(${statusText} from ${project ? escapeHTML(project.name) : 'Unknown Project'})`;
            li.appendChild(statusSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'item-actions';
            const recoverBtn = document.createElement('button');
            recoverBtn.textContent = 'Recover';
            recoverBtn.classList.add('recover-btn');
            const parentProject = projects.find(p => p.id === task.project_id);
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

    async function recoverTaskFromBin(taskId) {
        const taskToRecover = tasks.find(t => t.id === taskId && (t.status === 'deleted' || t.status === 'completed'));
        if (!taskToRecover) {
             displayModalMessage(modalTaskRecycleBinMessage, 'Task not found in bin.', 'error');
             return;
        }
        const parentProject = projects.find(p => p.id === taskToRecover.project_id);
        if (!parentProject || parentProject.status !== 'active') {
            displayModalMessage(modalTaskRecycleBinMessage, 'Cannot recover: Parent project is deleted or not active. Please recover project first if needed.', 'error');
            return;
        }

        try {
            const result = await apiRequest('recover_task', { taskId });
            if (result.success && result.updatedTask) {
                const taskIndex = tasks.findIndex(t => t.id === taskId);
                 if (taskIndex !== -1) {
                    tasks[taskIndex] = { ...tasks[taskIndex], ...result.updatedTask };
                 } else {
                     tasks.push(result.updatedTask);
                 }


                renderTaskRecycleBinList();
                // Refresh main task list if the recovered task belongs to the current view (project or "All Tasks")
                if (appSettings.currentProjectId === result.updatedTask.project_id || appSettings.currentProjectId === ALL_TASKS_VIEW_ID) {
                    renderTasksForCurrentProject();
                }
                renderScheduleTimeline();
                displayModalMessage(modalTaskRecycleBinMessage, `Task "${escapeHTML(result.updatedTask.text)}" recovered.`, 'success');
            } else {
                throw new Error(result.message || "Failed to recover task.");
            }
        } catch (error) {
            displayModalMessage(modalTaskRecycleBinMessage, `Error recovering task: ${error.message}`, 'error');
        }
    }

    async function permanentlyDeleteTaskFromBin(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const taskText = task.text;

        try {
            const result = await apiRequest('permanently_delete_task', { taskId });
            if (result.success) {
                tasks = tasks.filter(t => t.id !== taskId);
                renderTaskRecycleBinList();
                displayModalMessage(modalTaskRecycleBinMessage, `Task "${escapeHTML(taskText)}" permanently deleted.`, 'success');
            } else {
                throw new Error(result.message || "Failed to permanently delete task.");
            }
        } catch (error) {
            displayModalMessage(modalTaskRecycleBinMessage, `Error deleting task: ${error.message}`, 'error');
        }
    }

    function formatTime(totalMinutes) {
        if (totalMinutes === null || isNaN(totalMinutes)) return "";
        totalMinutes = Number(totalMinutes);
        if (totalMinutes >= 1440) totalMinutes %= 1440;
        if (totalMinutes < 0) totalMinutes = 1440 + (totalMinutes % 1440);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    function formatMinutesToHHMM(totalMinutes) {
        return formatTime(totalMinutes);
    }
    function formatHHMMToMinutes(hhmm) {
        if (!hhmm || typeof hhmm !== 'string') return NaN;
        try {
            const [hours, minutes] = hhmm.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
            return (hours * 60) + minutes;
        } catch { return NaN; }
    }

    function createHourSlots() {
        scheduleTimelineEl.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const slot = document.createElement('div');
            slot.classList.add('hour-slot');
            slot.dataset.hour = i;
            const label = document.createElement('span');
            label.classList.add('hour-label');
            label.textContent = `${formatTime(i * 60)} - ${formatTime((i + 1) * 60 -1)}`;
            slot.appendChild(label);
            scheduleTimelineEl.appendChild(slot);
        }
    }

    function getHourSlotFromY(clientY) {
        const timelineRect = scheduleTimelineEl.getBoundingClientRect();
        const y = clientY - timelineRect.top + scheduleTimelineEl.scrollTop;
        const hourIndex = Math.floor(y / 60);
        if (hourIndex < 0 || hourIndex > 23) return null;
        return scheduleTimelineEl.querySelector(`.hour-slot[data-hour="${hourIndex}"]`);
    }

    function renderScheduleTimeline() {
        scheduleTimelineEl.querySelectorAll('.scheduled-task').forEach(el => el.remove());

        const tasksToSchedule = tasks.filter(t => {
            const isScheduledFlag = t.is_scheduled;
            const hasValidTime = typeof t.start_time === 'number' && t.start_time !== null &&
                                 typeof t.duration === 'number' && t.duration !== null && t.duration > 0;
            return isScheduledFlag && t.status === 'active' && hasValidTime;
        });

        console.log("Tasks considered for scheduling (after filtering):", JSON.parse(JSON.stringify(tasksToSchedule)));

        tasksToSchedule.sort((a, b) => (a.start_time || 0) - (b.start_time || 0) );

        for(let i=0; i < tasksToSchedule.length; i++) tasksToSchedule[i].isOverlapping = false;

        for (let i = 0; i < tasksToSchedule.length; i++) {
            for (let j = i + 1; j < tasksToSchedule.length; j++) {
                const taskA = tasksToSchedule[i];
                const taskB = tasksToSchedule[j];

                const startTimeA = taskA.start_time;
                const durationA = taskA.duration;
                const startTimeB = taskB.start_time;
                const durationB = taskB.duration;

                const endTimeA = startTimeA + durationA;
                const endTimeB = startTimeB + durationB;

                if (startTimeA < endTimeB && endTimeA > startTimeB) {
                    tasksToSchedule[i].isOverlapping = true;
                    tasksToSchedule[j].isOverlapping = true;
                }
            }
        }

        tasksToSchedule.forEach(task => {
            const taskStartTime = task.start_time;
            const taskDuration = task.duration;

            if (isNaN(taskStartTime) || isNaN(taskDuration) || taskDuration <=0) {
                console.warn(`[Internal Safeguard] Skipping rendering scheduled task ${task.id} ("${escapeHTML(task.text)}") due to invalid time/duration. Start (type ${typeof task.start_time}): ${task.start_time}, Duration (type ${typeof task.duration}): ${task.duration}`);
                return;
            }

            const taskEl = document.createElement('div');
            taskEl.classList.add('scheduled-task');
            taskEl.setAttribute('draggable', 'true');
            if (task.isOverlapping) taskEl.classList.add('overlapping');
            taskEl.id = `scheduled-${task.id}`;
            taskEl.dataset.taskId = task.id;
            taskEl.style.top = `${taskStartTime}px`;
            taskEl.style.height = `${Math.max(15, taskDuration)}px`;
            const textSpanEl = document.createElement('span'); // Renamed to avoid conflict
            textSpanEl.classList.add('task-text');
            textSpanEl.textContent = escapeHTML(task.text);
            taskEl.appendChild(textSpanEl);
            const timeSpan = document.createElement('span');
            timeSpan.classList.add('task-time');
            timeSpan.textContent = `${formatTime(taskStartTime)} - ${formatTime(taskStartTime + taskDuration)}`;
            taskEl.appendChild(timeSpan);
            taskEl.addEventListener('click', () => openScheduleModal(task.id, true));
            scheduleTimelineEl.appendChild(taskEl);
        });
         if (tasksToSchedule.length === 0) {
            console.log("No tasks to render on schedule timeline after filtering.");
        }
    }

    taskListEl.addEventListener('dragstart', (e) => {
        if (e.target.closest('li[draggable="true"]')) {
            const taskLi = e.target.closest('li[draggable="true"]');
            if (taskLi && taskLi.dataset.taskId) {
                draggedTaskId = taskLi.dataset.taskId;
                isDraggingFromTimeline = false;
                draggedTaskOriginalData = null;
                e.dataTransfer.setData('text/plain', draggedTaskId);
                e.dataTransfer.effectAllowed = 'move';
                taskLi.classList.add('dragging');
            }
        } else {
            e.preventDefault();
        }
    });
    taskListEl.addEventListener('dragend', (e) => {
        if (!isDraggingFromTimeline && draggedTaskId) {
            const taskLi = taskListEl.querySelector(`li[data-task-id="${draggedTaskId}"]`);
            if (taskLi) taskLi.classList.remove('dragging');
        }
    });

    scheduleTimelineEl.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('scheduled-task')) {
            const taskEl = e.target;
            draggedTaskId = taskEl.dataset.taskId;
            const task = tasks.find(t => t.id === draggedTaskId);
            if (task) {
                draggedTaskOriginalData = {
                    duration: task.duration,
                    schedule_description: task.schedule_description,
                    is_scheduled: task.is_scheduled
                };
            }
            isDraggingFromTimeline = true;
            e.dataTransfer.setData('text/plain', draggedTaskId);
            e.dataTransfer.effectAllowed = 'move';
            taskEl.classList.add('dragging-from-timeline');
        }
    });

    scheduleTimelineEl.addEventListener('dragend', (e) => {
        if (isDraggingFromTimeline && draggedTaskId) {
            const taskEl = scheduleTimelineEl.querySelector(`#scheduled-${draggedTaskId}`);
            if (taskEl) taskEl.classList.remove('dragging-from-timeline');
        }
        draggedTaskId = null;
        draggedTaskOriginalData = null;
        isDraggingFromTimeline = false;
        clearDropTargets();
    });


    scheduleTimelineEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetSlot = getHourSlotFromY(e.clientY);
        clearDropTargets();
        if (targetSlot) targetSlot.classList.add('drop-target');
    });
    scheduleTimelineEl.addEventListener('dragleave', (e) => {
        if (!scheduleTimelineEl.contains(e.relatedTarget) || !e.relatedTarget.closest('.hour-slot')) {
            clearDropTargets();
        }
    });
    function clearDropTargets() {
        scheduleTimelineEl.querySelectorAll('.hour-slot.drop-target').forEach(el => el.classList.remove('drop-target'));
    }

    scheduleTimelineEl.addEventListener('drop', async (e) => {
        e.preventDefault();
        clearDropTargets();
        const droppedId = e.dataTransfer.getData('text/plain');
        if (!droppedId) return;

        const taskToSchedule = tasks.find(t => t.id === droppedId);
        if (!taskToSchedule || taskToSchedule.status !== 'active') {
            console.warn("Dropped task not found or not active:", droppedId);
            return;
        }

        const timelineRect = scheduleTimelineEl.getBoundingClientRect();
        const dropY = e.clientY - timelineRect.top + scheduleTimelineEl.scrollTop;
        const rawMinutes = Math.max(0, Math.min(1439, Math.round(dropY)));
        const newStartTime = Math.round(rawMinutes / 15) * 15;

        if (isDraggingFromTimeline && draggedTaskOriginalData) {
            // Task was dragged from within the timeline
            if (taskToSchedule.start_time === newStartTime) {
                console.log("Task dropped at the same time slot.");
                return;
            }
            try {
                const result = await apiRequest('update_task_schedule', {
                    taskId: taskToSchedule.id,
                    startTime: newStartTime,
                    duration: draggedTaskOriginalData.duration,
                    scheduleDescription: draggedTaskOriginalData.schedule_description,
                    isScheduled: true
                });
                if (result.success && result.updatedTask) {
                    const taskIndex = tasks.findIndex(t => t.id === taskToSchedule.id);
                    if (taskIndex !== -1) {
                        tasks[taskIndex] = { ...tasks[taskIndex], ...result.updatedTask };
                    }
                    renderScheduleTimeline();
                    renderTasksForCurrentProject();
                } else {
                    throw new Error(result.message || "Failed to update schedule on server.");
                }
            } catch (error) {
                displayFlashMessage(document.body, `Error re-scheduling task: ${error.message}`, 'error');
                renderScheduleTimeline();
            }
        } else {
            // Task was dragged from the task list - Directly schedule
            const defaultDuration = taskToSchedule.duration || 45;
            const defaultDescription = taskToSchedule.schedule_description || "";

            try {
                const result = await apiRequest('update_task_schedule', {
                    taskId: taskToSchedule.id,
                    startTime: newStartTime,
                    duration: defaultDuration,
                    scheduleDescription: defaultDescription,
                    isScheduled: true
                });

                if (result.success && result.updatedTask) {
                    const taskIndex = tasks.findIndex(t => t.id === taskToSchedule.id);
                    if (taskIndex !== -1) {
                        tasks[taskIndex] = { ...tasks[taskIndex], ...result.updatedTask };
                    } else {
                        tasks.push(result.updatedTask);
                    }
                    renderScheduleTimeline();
                    renderTasksForCurrentProject();
                    displayFlashMessage(document.body, `Task "${escapeHTML(result.updatedTask.text)}" scheduled.`, 'success');
                } else {
                    throw new Error(result.message || "Failed to schedule task on server.");
                }
            } catch (error) {
                displayFlashMessage(document.body, `Error scheduling task: ${error.message}`, 'error');
                renderScheduleTimeline();
                renderTasksForCurrentProject();
            }
        }
    });

    function openScheduleModal(taskId, isEditingExistingSchedule = false, defaultStartTime = null) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) {
            console.error("Task not found for scheduling modal:", taskId);
            return;
        }
        modalTaskIdInput.value = task.id;
        modalTaskNameDisplay.textContent = escapeHTML(task.text);
        const isActuallyScheduled = task.is_scheduled;

        if (isEditingExistingSchedule || isActuallyScheduled) {
            editModalTitle.textContent = 'Edit Scheduled Task';
            modalStartTimeInput.value = formatMinutesToHHMM(task.start_time);
            modalDurationInput.value = task.duration || 45;
            modalScheduleDescriptionInput.value = task.schedule_description || '';
            modalDeleteTaskButton.textContent = 'Unschedule';
            modalDeleteTaskButton.title = 'Remove this task from the schedule';
        } else {
            editModalTitle.textContent = 'Schedule Task';
            modalStartTimeInput.value = defaultStartTime !== null ? formatMinutesToHHMM(defaultStartTime) : '';
            modalDurationInput.value = task.duration || 45;
            modalScheduleDescriptionInput.value = task.schedule_description || '';
            modalDeleteTaskButton.textContent = 'Cancel Scheduling'; // Or hide if not applicable
            modalDeleteTaskButton.title = 'Cancel scheduling this task';
        }
        modalCompleteTaskButton.style.display = (task.status === 'active') ? 'inline-block' : 'none';
        openModal('edit-task-modal');
        modalStartTimeInput.focus();
    }
    function closeScheduleModal() { closeModal('edit-task-modal'); }

    async function handleSaveScheduledTask() {
        const taskId = modalTaskIdInput.value;
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) {
            displayFlashMessage(editTaskModal, "Task not found.", 'error'); return;
        }
        const newStartTimeMinutes = formatHHMMToMinutes(modalStartTimeInput.value);
        const newDuration = parseInt(modalDurationInput.value, 10);

        if (isNaN(newStartTimeMinutes)) {
            displayFlashMessage(editTaskModal, "Invalid start time. Please use HH:MM format.", 'error'); return;
        }
        if (isNaN(newDuration) || newDuration <= 0) {
            displayFlashMessage(editTaskModal, "Invalid duration. Must be a positive number of minutes.", 'error'); return;
        }
        const scheduleDescription = modalScheduleDescriptionInput.value.trim();

        try {
            const result = await apiRequest('update_task_schedule', {
                taskId,
                startTime: newStartTimeMinutes,
                duration: newDuration,
                scheduleDescription: scheduleDescription,
                isScheduled: true
            });
            if (result.success && result.updatedTask) {
                tasks[taskIndex] = { ...tasks[taskIndex], ...result.updatedTask };

                closeScheduleModal();
                renderScheduleTimeline();
                renderTasksForCurrentProject();
                displayFlashMessage(document.body, `Task "${escapeHTML(result.updatedTask.text)}" scheduled.`, 'success');
            } else {
                throw new Error(result.message || "Failed to save schedule.");
            }
        } catch (error) {
            displayFlashMessage(editTaskModal, `Error saving schedule: ${error.message}`, 'error');
        }
    }

    async function handleDeleteFromSchedule() {
        const taskId = modalTaskIdInput.value;
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        const task = tasks[taskIndex];

        if (taskIndex === -1 || !(task.is_scheduled)) {
            closeScheduleModal();
            return;
        }

        try {
            const result = await apiRequest('unschedule_task', { taskId });
            if (result.success && result.updatedTask) {
                tasks[taskIndex] = { ...tasks[taskIndex], ...result.updatedTask };

                displayFlashMessage(document.body, `Task "${escapeHTML(task.text)}" unscheduled.`, 'success');
                closeScheduleModal();
                renderScheduleTimeline();
                renderTasksForCurrentProject();
            } else {
                throw new Error(result.message || "Failed to unschedule task.");
            }
        } catch (error) {
            displayFlashMessage(editTaskModal, `Error unscheduling: ${error.message}`, 'error');
        }
    }

    async function handleCompleteTaskFromModal() {
        const taskId = modalTaskIdInput.value;
        if (!taskId) {
            displayFlashMessage(editTaskModal, "No task selected in modal.", 'error');
            return;
        }
        await toggleTaskComplete(taskId);
    }


    function exportData() {
        if (!currentUser) {
            displayFlashMessage(document.body, "Please login to export data.", 'error');
            return;
        }
        const projectsToExport = projects.map(({ isOverlapping, ...rest }) => rest);
        const tasksToExport = tasks.map(({ isOverlapping, ...rest }) => rest);

        const dataToExport = {
            version: "brainbox-pro-db-v1.1",
            exportedAt: new Date().toISOString(),
            user: currentUser.username,
            projects: projectsToExport,
            tasks: tasksToExport,
            appSettings: {
                theme: appSettings.theme,
                currentProjectId: appSettings.currentProjectId === ALL_TASKS_VIEW_ID ? null : appSettings.currentProjectId
            }
        };
        try {
            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `brainbox-pro-data-${currentUser.username}-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            displayFlashMessage(document.body, "Data exported successfully!", 'success');
        } catch (error) {
            console.error("Error exporting data:", error);
            displayFlashMessage(document.body, `Failed to export data: ${error.message}`, 'error');
        }
    }

    async function importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!currentUser) {
            displayFlashMessage(document.body, "Please login to import data.", 'error');
            importFileInput.value = null;
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedRaw = JSON.parse(e.target.result);
                if (!importedRaw || typeof importedRaw !== 'object' ||
                    !Array.isArray(importedRaw.projects) || !Array.isArray(importedRaw.tasks)) {
                    throw new Error("Invalid file format. Required fields (projects, tasks) missing or incorrect type.");
                }

                if (confirm("Importing this file will attempt to ADD its content to your current data on the server. Existing items with the same ID might be updated. Are you sure?")) {
                    const result = await apiRequest('import_data', {
                        projects: importedRaw.projects,
                        tasks: importedRaw.tasks,
                        appSettings: importedRaw.appSettings
                    });

                    if (result.success) {
                        displayFlashMessage(document.body, "Data import processed by server. Reloading all data...", 'success', 5000);
                        await loadDataFromServer();
                    } else {
                        throw new Error(result.message || "Server failed to process import.");
                    }
                }
            } catch (error) {
                console.error("Error importing data:", error);
                displayFlashMessage(document.body, `Failed to import file: ${error.message}`, 'error', 7000);
            } finally {
                importFileInput.value = null;
            }
        };
        reader.onerror = () => {
            displayFlashMessage(document.body, "Error reading the selected file.", 'error');
            importFileInput.value = null;
        };
        reader.readAsText(file);
    }

    function setupEventListeners() {
        themeSelect.addEventListener('change', handleThemeChange);
        aboutButton.addEventListener('click', () => openModal('about-modal'));

        projectFilterSelect.addEventListener('change', handleProjectFilterChange);
        manageProjectsBtn.addEventListener('click', openProjectManagementModal);
        viewTaskRecycleBinBtn.addEventListener('click', openTaskRecycleBinModal);

        addTaskButton.addEventListener('click', handleNewTaskSubmit);
        newTaskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleNewTaskSubmit(); });

        modalSaveTaskButton.addEventListener('click', handleSaveScheduledTask);
        modalDeleteTaskButton.addEventListener('click', handleDeleteFromSchedule);
        modalCompleteTaskButton.addEventListener('click', handleCompleteTaskFromModal);

        exportDataButton.addEventListener('click', exportData);
        importDataButton.addEventListener('click', () => { if (currentUser) importFileInput.click(); else displayFlashMessage(document.body, "Please login to import data.", "error"); });
        importFileInput.addEventListener('change', importData);

        logoutButton.addEventListener('click', logout);
        showAllTasksButton.addEventListener('click', () => { // Modified listener
            appSettings.currentProjectId = ALL_TASKS_VIEW_ID;
            projectFilterSelect.value = ""; // Clear project filter dropdown selection
            // syncAppSettings(); // Optional: if you want "All Tasks" view to be somewhat persistent (usually not for this kind of view)
            updateTasksSectionHeader();
            renderTasksForCurrentProject();
        });

        initModalCloseButtons();
    }

    function initializeAppUI() {
        renderProjectFilterDropdown();
        createHourSlots();
        renderScheduleTimeline();

        appContentWrapper.style.display = 'flex';
        authBlocker.style.display = 'none';

        if (currentUser) {
            userGreetingEl.textContent = `Hi, ${escapeHTML(currentUser.username)}!`;
            userGreetingEl.style.display = 'inline';
            logoutButton.style.display = 'inline-flex';
            showAllTasksButton.style.display = 'inline-flex'; // Ensure it's visible if user is logged in
        } else {
            logoutButton.style.display = 'none';
            showAllTasksButton.style.display = 'none';
            userGreetingEl.style.display = 'none';
        }
        // Initial rendering of tasks based on loaded appSettings.currentProjectId
        updateTasksSectionHeader(); // Call this before renderTasksForCurrentProject
        renderTasksForCurrentProject();
        console.log("App UI initialized for user:", currentUser?.username);
    }

    async function checkAuthentication() {
        try {
            const data = await apiRequest('check_auth', {}, 'GET');

            if (data.success && data.authenticated) {
                currentUser = data.user;
                console.log("User authenticated:", currentUser);
                await loadDataFromServer();
            } else {
                console.log("User not authenticated. Displaying auth blocker.");
                appContentWrapper.style.display = 'none';
                authBlocker.style.display = 'flex';
            }
        } catch (error) {
            appContentWrapper.style.display = 'none';
            authBlocker.innerHTML = `<div style="background-color: var(--bg-modal); color: var(--text-primary); padding: 30px; border-radius: 8px; display: inline-block; box-shadow: 0 5px 15px var(--shadow-primary);"><h3 style="margin-bottom: 15px;">Authentication Error</h3><p>Could not verify your session. Please <a href="login.html" style="color: var(--accent-primary); font-weight: bold;">try logging in</a>.</p></div>`;
            authBlocker.style.display = 'flex';
        }
    }

    async function logout() {
        try {
            const data = await apiRequest('logout', {}, 'POST');
            if (data.success) {
                currentUser = null;
                projects = [];
                tasks = [];
                appSettings.currentProjectId = null;
                window.location.href = 'login.html';
            } else {
                displayFlashMessage(document.body, data.message || "Logout failed.", 'error');
            }
        } catch (error) {
            displayFlashMessage(document.body, "Error during logout. Please try again.", 'error');
        }
    }

    async function initializeApp() {
        setupEventListeners();
        await checkAuthentication();
        console.log("App initialization sequence completed or auth prompt shown.");
    }

    initializeApp();
});