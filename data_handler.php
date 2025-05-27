<?php
// data_handler.php - Handles all data operations for projects, tasks, settings

// --- ADVANCED DEBUGGING WITH OUTPUT BUFFERING & CUSTOM ERROR HANDLING ---
ob_start(); // Start output buffering

error_reporting(E_ALL);
ini_set('display_errors', 1); // Try to display errors (might go into buffer)

$debug_messages = []; // Array to hold our debug messages

// Custom error handler to capture notices/warnings into our debug array
function captureErrorHandler($errno, $errstr, $errfile, $errline) {
    global $debug_messages;
    if ($errno == E_DEPRECATED) {
        return true; 
    }
    $error_message = "PHP Error: [$errno] $errstr in $errfile on line $errline";
    $debug_messages[] = $error_message;
    return false; 
}
set_error_handler("captureErrorHandler");

// --- END ADVANCED DEBUGGING ---

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

require_once 'db_config.php'; // $mysqli connection

$current_user_id = null;
if (!isset($_SESSION['user_id'])) {
    $debug_messages[] = "[data_handler.php] Auth Check: FAILED. No user_id in session. Session data: " . json_encode($_SESSION);
    $buffered_output = ob_get_clean(); 
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Authentication required. Please login.',
        'raw_php_output' => $buffered_output,
        'debug_log' => $debug_messages
    ]);
    exit;
}
$current_user_id = $_SESSION['user_id'];
$debug_messages[] = "[data_handler.php] Auth Check: SUCCESS. User ID: " . $current_user_id . ". Session data: " . json_encode($_SESSION);


$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? $input['action'] ?? null;
$debug_messages[] = "[data_handler.php] Action: " . ($action ?? "Not Set") . ". UserID: " . $current_user_id . ". Input: " . json_encode($input) . ". GET: " . json_encode($_GET);


if (!$mysqli) {
    $debug_messages[] = "[data_handler.php] FATAL: Database connection object (\$mysqli) is null. Check db_config.php and ensure it's included correctly.";
} else if (!($mysqli instanceof mysqli)) {
    $debug_messages[] = "[data_handler.php] FATAL: \$mysqli is not a valid mysqli object. Type: " . gettype($mysqli) . ". Check db_config.php.";
} else if ($mysqli->connect_error) {
    $debug_messages[] = "[data_handler.php] FATAL: Database connection failed: (" . $mysqli->connect_errno . ") " . $mysqli->connect_error;
}


// --- Main Action Switch ---
$response_data = null; 

if (!$mysqli || !($mysqli instanceof mysqli) || $mysqli->connect_error) {
    $response_data = ['success' => false, 'message' => 'Database connection error. Cannot process action.'];
} else {
    switch ($action) {
        case 'get_all_data':
            $response_data = handleGetAllData($mysqli, $current_user_id, $debug_messages);
            break;
        case 'save_app_settings':
            $response_data = handleSaveAppSettings($mysqli, $current_user_id, $input['settings'] ?? [], $debug_messages);
            break;
        case 'add_project':
            $response_data = handleAddProject($mysqli, $current_user_id, $input['project'] ?? null, $debug_messages);
            break;
        case 'soft_delete_project':
            $response_data = handleSoftDeleteProject($mysqli, $current_user_id, $input['projectId'] ?? null, $debug_messages);
            break;
        case 'recover_project':
            $response_data = handleRecoverProject($mysqli, $current_user_id, $input['projectId'] ?? null, $debug_messages);
            break;
        case 'permanently_delete_project':
            $response_data = handlePermanentlyDeleteProject($mysqli, $current_user_id, $input['projectId'] ?? null, $debug_messages);
            break;
        case 'add_task':
            $response_data = handleAddTask($mysqli, $current_user_id, $input['task'] ?? null, $debug_messages);
            break;
        case 'update_task_status':
            $response_data = handleUpdateTask($mysqli, $current_user_id, $input, 'status', $debug_messages);
            break;
        case 'soft_delete_task':
             $response_data = handleUpdateTask($mysqli, $current_user_id, $input, 'soft_delete', $debug_messages);
            break;
        case 'recover_task':
            $response_data = handleUpdateTask($mysqli, $current_user_id, $input, 'recover', $debug_messages);
            break;
        case 'permanently_delete_task':
            $response_data = handlePermanentlyDeleteTask($mysqli, $current_user_id, $input['taskId'] ?? null, $debug_messages);
            break;
        case 'update_task_schedule':
            $response_data = handleUpdateTask($mysqli, $current_user_id, $input, 'schedule', $debug_messages);
            break;
        case 'unschedule_task':
            $response_data = handleUpdateTask($mysqli, $current_user_id, $input, 'unschedule', $debug_messages);
            break;
        case 'import_data':
            $response_data = handleImportData($mysqli, $current_user_id, $input, $debug_messages);
            break;
        default:
            $debug_messages[] = "[data_handler.php] Invalid data action specified: " . ($action ?? "Not Provided");
            $response_data = ['success' => false, 'message' => 'Invalid data action specified.'];
            break;
    }
}

if ($mysqli && $mysqli instanceof mysqli && !$mysqli->connect_error) { 
    $mysqli->close();
    $debug_messages[] = "[data_handler.php] Database connection closed.";
} else {
    $debug_messages[] = "[data_handler.php] Database connection was not closed (either invalid or already closed/failed).";
}

// Final output stage
$final_buffered_output = ob_get_clean(); 
header('Content-Type: application/json');

if (is_array($response_data)) {
    if (!empty($final_buffered_output) && !isset($response_data['raw_php_output'])) { 
         $response_data['raw_php_output'] = $final_buffered_output; 
    } else if (!empty($final_buffered_output) && isset($response_data['raw_php_output'])) {
         $response_data['raw_php_output'] .= " | Additional Final Buffer: " . $final_buffered_output; 
    }

    if (!isset($response_data['debug_log'])) {
        $response_data['debug_log'] = $debug_messages; 
    } else {
        $response_data['debug_log'] = array_merge($response_data['debug_log'], $debug_messages); 
    }
    echo json_encode($response_data);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Server error: Response data was not correctly formed or action handler failed to return array.',
        'action_attempted' => ($action ?? "N/A"),
        'raw_php_output' => $final_buffered_output,
        'debug_log' => $debug_messages
    ]);
}
exit; 

// --- Handler Functions ---

function castTaskForClient(&$taskRow) {
    if (is_array($taskRow)) {
        $taskRow['is_scheduled'] = isset($taskRow['is_scheduled']) ? (int)$taskRow['is_scheduled'] : 0;
        $taskRow['start_time'] = isset($taskRow['start_time']) ? (int)$taskRow['start_time'] : null;
        $taskRow['duration'] = isset($taskRow['duration']) ? (int)$taskRow['duration'] : null;
    }
}

function handleGetAllData($db, $userId, &$debug_messages) {
    $debug_messages[] = "[GetAllData] User $userId: Attempting to get all data.";
    $projects = [];
    $tasks = [];
    $appSettings = null;

    if (!$db || !($db instanceof mysqli) || $db->connect_error) {
        $debug_messages[] = "[GetAllData] DB connection error: " . ($db->connect_error ?? "Unavailable");
        return ['success' => false, 'message' => 'Database connection error.'];
    }

    // Get projects
    $stmt_proj = $db->prepare("SELECT id, name, status, is_default, created_at, updated_at, deleted_at FROM projects WHERE user_id = ? ORDER BY created_at ASC");
    if (!$stmt_proj) {
        $debug_messages[] = "[GetAllData] DB error (proj prep): " . $db->error;
        return ['success' => false, 'message' => 'DB error (proj prep): ' . $db->error];
    }
    $stmt_proj->bind_param("i", $userId);
    if(!$stmt_proj->execute()){
        $error_msg = $stmt_proj->error; $stmt_proj->close();
        $debug_messages[] = "[GetAllData] DB error (proj execute): " . $error_msg;
        return ['success' => false, 'message' => 'DB error (proj execute): ' . $error_msg];
    }
    $result_proj = $stmt_proj->get_result();
    while ($row = $result_proj->fetch_assoc()) {
        $row['is_default'] = (int)$row['is_default']; // Ensure int for consistency
        $row['isDefault'] = (bool)$row['is_default']; // For JS if it uses camelCase
        $projects[] = $row;
    }
    $stmt_proj->close();
    $debug_messages[] = "[GetAllData] Fetched " . count($projects) . " projects.";

    // Get tasks
    $stmt_tasks = $db->prepare("SELECT id, project_id, text, status, created_at, updated_at, deleted_at, deleted_reason, is_scheduled, start_time, duration, schedule_description FROM tasks WHERE user_id = ? ORDER BY created_at ASC");
    if (!$stmt_tasks) {
        $debug_messages[] = "[GetAllData] DB error (task prep): " . $db->error;
        return ['success' => false, 'message' => 'DB error (task prep): ' . $db->error];
    }
    $stmt_tasks->bind_param("i", $userId);
    if(!$stmt_tasks->execute()){
        $error_msg = $stmt_tasks->error; $stmt_tasks->close();
        $debug_messages[] = "[GetAllData] DB error (task execute): " . $error_msg;
        return ['success' => false, 'message' => 'DB error (task execute): ' . $error_msg];
    }
    $result_tasks = $stmt_tasks->get_result();
    while ($row = $result_tasks->fetch_assoc()) {
        castTaskForClient($row); // Ensure numeric types for schedule fields
        $tasks[] = $row;
    }
    $stmt_tasks->close();
    $debug_messages[] = "[GetAllData] Fetched " . count($tasks) . " tasks. First task example: " . (count($tasks) > 0 ? json_encode($tasks[0]) : "No tasks found");

    // Get app settings
    $stmt_settings = $db->prepare("SELECT theme, current_project_id FROM user_app_settings WHERE user_id = ?");
    if (!$stmt_settings) {
        $debug_messages[] = "[GetAllData] DB error (settings prep): " . $db->error;
    } else {
        $stmt_settings->bind_param("i", $userId);
        if ($stmt_settings->execute()) {
            $result_settings = $stmt_settings->get_result();
            if ($settings_row = $result_settings->fetch_assoc()) {
                $appSettings = $settings_row;
            }
        } else {
            $debug_messages[] = "[GetAllData] DB error (settings execute): " . $stmt_settings->error;
        }
        $stmt_settings->close();
    }
    $debug_messages[] = "[GetAllData] AppSettings fetched: " . json_encode($appSettings);
    
    // Ensure uncategorized project exists for the user
    $uncategorizedExists = false;
    foreach ($projects as $p) {
        if ($p['id'] === 'proj_0') {
            $uncategorizedExists = true;
            break;
        }
    }
    if (!$uncategorizedExists) {
        $now = date('Y-m-d H:i:s');
        $uncat_id = 'proj_0';
        $uncat_name = 'General Tasks'; 
        $stmt_add_uncat = $db->prepare("INSERT INTO projects (id, user_id, name, status, is_default, created_at, updated_at) VALUES (?, ?, ?, 'active', 1, ?, ?)"); // Use 1 for TRUE
        if($stmt_add_uncat){
            $stmt_add_uncat->bind_param("sisss", $uncat_id, $userId, $uncat_name, $now, $now);
            if($stmt_add_uncat->execute()){
                $newUncatProject = [ 
                    'id' => $uncat_id, 'user_id' => $userId, 'name' => $uncat_name, 
                    'status' => 'active', 'is_default' => 1, 'isDefault' => true,
                    'created_at' => $now, 'updated_at' => $now, 'deleted_at' => null
                ];
                $projects[] = $newUncatProject;
                $debug_messages[] = "[GetAllData] User $userId: Created default 'General Tasks' project.";
            } else {
                $debug_messages[] = "[GetAllData] User $userId: FAILED to create default 'General Tasks' project: " . $stmt_add_uncat->error;
            }
            $stmt_add_uncat->close();
        } else {
             $debug_messages[] = "[GetAllData] User $userId: FAILED to prepare statement for default 'General Tasks' project: " . $db->error;
        }
    }

    return ['success' => true, 'projects' => $projects, 'tasks' => $tasks, 'appSettings' => $appSettings];
}

function handleSaveAppSettings($db, $userId, $settings, &$debug_messages) {
    if (!$db || !($db instanceof mysqli) || $db->connect_error) { $debug_messages[] = "[SaveAppSettings] DB Error"; return ['success' => false, 'message'=>'DB Error']; }
    $debug_messages[] = "[SaveAppSettings] User $userId: Saving settings: " . json_encode($settings);
    $theme = $settings['theme'] ?? 'light';
    $currentProjectId = $settings['currentProjectId'] ?? null;

    $stmt = $db->prepare("INSERT INTO user_app_settings (user_id, theme, current_project_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE theme = VALUES(theme), current_project_id = VALUES(current_project_id)");
    if (!$stmt) { $debug_messages[] = "[SaveAppSettings] DB Prep Error: " . $db->error; return ['success' => false, 'message' => 'DB Prep Error: ' . $db->error]; }
    $stmt->bind_param("iss", $userId, $theme, $currentProjectId);
    if ($stmt->execute()) {
        $stmt->close();
        $debug_messages[] = "[SaveAppSettings] Settings saved.";
        return ['success' => true, 'message' => 'Settings saved.'];
    } else {
        $error_msg = $stmt->error; $stmt->close();
        $debug_messages[] = "[SaveAppSettings] Failed to save settings: " . $error_msg;
        return ['success' => false, 'message' => 'Failed to save settings: ' . $error_msg];
    }
}

function handleAddProject($db, $userId, $projectData, &$debug_messages) {
    if (!$db || !($db instanceof mysqli) || $db->connect_error) { $debug_messages[] = "[AddProject] DB Error"; return ['success' => false, 'message'=>'DB Error']; }
    if (!$projectData || empty($projectData['name'])) {
        $debug_messages[] = "[AddProject] Project name required.";
        return ['success' => false, 'message' => 'Project name is required.'];
    }
    $debug_messages[] = "[AddProject] User $userId: Adding project. Data: " . json_encode($projectData);

    $stmt_max_id = $db->prepare("SELECT id FROM projects WHERE user_id = ? AND id LIKE 'proj_%' ORDER BY CAST(SUBSTRING(id, 6) AS UNSIGNED) DESC LIMIT 1");
    if(!$stmt_max_id) { $debug_messages[] = "[AddProject] DB max_id_prep Error: " . $db->error; return ['success' => false, 'message' => 'DB max_id_prep Error: ' . $db->error]; }
    $stmt_max_id->bind_param("i", $userId);
    if(!$stmt_max_id->execute()){ $error_msg = $stmt_max_id->error; $stmt_max_id->close(); $debug_messages[]="[AddProject] DB max_id_execute Error: ". $error_msg; return ['success'=>false, 'message'=> $error_msg];}
    $result_max_id = $stmt_max_id->get_result();
    $next_num = 0; // Start with 0 if no projects exist yet, so first is proj_0 (if default isn't made by GetAllData)
                   // Or ensure General Tasks (proj_0) is always made first by GetAllData.
                   // For custom projects, it should be at least 1 higher than max existing.
    if ($row_max_id = $result_max_id->fetch_assoc()) {
        $num_part = intval(substr($row_max_id['id'], 5));
        $next_num = $num_part + 1;
    } else {
        // If no 'proj_X' projects, check if 'proj_0' exists. If not, this might be the first, but GetAllData should handle proj_0.
        // So, if this is the first *custom* project, it should be proj_1 if proj_0 exists.
        // This logic might need refinement if proj_0 is not guaranteed by GetAllData before custom add.
        // For now, assuming proj_0 might be made by GetAllData, so any new custom starts at 1 or higher.
        // Let's ensure next_num is at least 1 if proj_0 is handled elsewhere.
        // For simplicity, if no proj_X, next_num will be 1. This works if proj_0 creation is robust.
         $next_num = $next_num === 0 ? 1 : $next_num; // Ensure at least 1 if no numeric projects found
    }
    $stmt_max_id->close();
    $new_project_id_string = "proj_" . $next_num;
    $debug_messages[] = "[AddProject] Generated project ID: $new_project_id_string";

    $name = $projectData['name'];
    $status = $projectData['status'] ?? 'active';
    $is_default_db = 0; // Custom projects are not default
    $created_at = $projectData['createdAt'] ?? date('Y-m-d H:i:s');
    $updated_at = date('Y-m-d H:i:s');

    $stmt = $db->prepare("INSERT INTO projects (id, user_id, name, status, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt) { $debug_messages[] = "[AddProject] DB Prep Error: " . $db->error; return ['success' => false, 'message' => 'DB Prep Error: ' . $db->error]; }
    $stmt->bind_param("sisssss", $new_project_id_string, $userId, $name, $status, $is_default_db, $created_at, $updated_at);

    if ($stmt->execute()) {
        $returnProject = [
            'id' => $new_project_id_string, 'user_id' => $userId, 'name' => $name, 'status' => $status, 
            'is_default' => $is_default_db, 'isDefault' => (bool)$is_default_db,
            'created_at' => $created_at, 'updated_at' => $updated_at,
            'deleted_at' => null
        ];
        $stmt->close();
        $debug_messages[] = "[AddProject] Project '$name' added with ID $new_project_id_string.";
        return ['success' => true, 'message' => 'Project added.', 'project' => $returnProject];
    } else {
        $error_msg = $stmt->error; $stmt->close();
        $debug_messages[] = "[AddProject] Failed to add project '$name': " . $error_msg;
        return ['success' => false, 'message' => 'Failed to add project: ' . $error_msg];
    }
}

function handleAddTask($db, $userId, $taskData, &$debug_messages) {
    if (!$db || !($db instanceof mysqli) || $db->connect_error) { $debug_messages[] = "[AddTask] DB Error"; return ['success' => false, 'message'=>'DB Error']; }
    if (!$taskData || empty($taskData['text']) || empty($taskData['projectId'])) {
        $debug_messages[] = "[AddTask] Task text/projectId required. Data: " . json_encode($taskData);
        return ['success' => false, 'message' => 'Task text and project ID are required.'];
    }
    $debug_messages[] = "[AddTask] User $userId: Adding task. Data: " . json_encode($taskData);

    $stmt_max_id = $db->prepare("SELECT id FROM tasks WHERE user_id = ? AND id LIKE 'task_%' ORDER BY CAST(SUBSTRING(id, 6) AS UNSIGNED) DESC LIMIT 1");
    if(!$stmt_max_id) { $debug_messages[] = "[AddTask] DB max_id_prep Error: " . $db->error; return ['success' => false, 'message' => 'DB max_id_prep Error: ' . $db->error];}
    $stmt_max_id->bind_param("i", $userId);
    if(!$stmt_max_id->execute()){ $error_msg = $stmt_max_id->error; $stmt_max_id->close(); $debug_messages[]="[AddTask] DB max_id_execute Error: ". $error_msg; return ['success'=>false, 'message'=> $error_msg];}
    $result_max_id = $stmt_max_id->get_result();
    $next_num = 1;
    if($row_max_id = $result_max_id->fetch_assoc()){ $num_part = intval(substr($row_max_id['id'], 5)); $next_num = $num_part + 1; }
    $stmt_max_id->close();
    $new_task_id_string = "task_" . $next_num;
    $debug_messages[] = "[AddTask] Generated task ID: $new_task_id_string";

    $project_id_client = $taskData['projectId']; 
    $text = $taskData['text'];
    $status = 'active'; 
    $now = date('Y-m-d H:i:s');
    $created_at = $now; 
    $updated_at = $now; 
    $is_scheduled_db = isset($taskData['isScheduled']) ? (int)(bool)$taskData['isScheduled'] : 0; 
    $start_time_db = isset($taskData['startTime']) ? (int)$taskData['startTime'] : null; 
    $duration_db = isset($taskData['duration']) ? (int)$taskData['duration'] : null;   
    $schedule_description_db = $taskData['scheduleDescription'] ?? ""; 

    $stmt = $db->prepare("INSERT INTO tasks (id, user_id, project_id, text, status, created_at, updated_at, is_scheduled, start_time, duration, schedule_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt) { $debug_messages[] = "[AddTask] DB Prep Error: " . $db->error; return ['success' => false, 'message' => 'DB Prep Error: ' . $db->error]; }
    $stmt->bind_param("sisssssiiss", $new_task_id_string, $userId, $project_id_client, $text, $status, $created_at, $updated_at, $is_scheduled_db, $start_time_db, $duration_db, $schedule_description_db);

    if ($stmt->execute()) {
        $returnTask = [
             'id' => $new_task_id_string, 'user_id' => (int)$userId, 'project_id' => $project_id_client, 'text' => $text,
             'status' => $status, 'created_at' => $created_at, 'updated_at' => $updated_at,
             'deleted_at' => null, 'deleted_reason' => null,
             'is_scheduled' => $is_scheduled_db, 
             'start_time' => $start_time_db, 
             'duration' => $duration_db,
             'schedule_description' => $schedule_description_db
        ]; 
        $stmt->close();
        $debug_messages[] = "[AddTask] Task '$text' added with ID $new_task_id_string.";
        return ['success' => true, 'message' => 'Task added.', 'task' => $returnTask];
    } else {
        $error_msg = $stmt->error; $stmt->close();
        $debug_messages[] = "[AddTask] Failed to add task '$text': " . $error_msg;
        return ['success' => false, 'message' => 'Failed to add task: ' . $error_msg];
    }
}

function handleUpdateTask($db, $userId, $data, $type, &$debug_messages) {
    if (!$db || !($db instanceof mysqli) || $db->connect_error) { $debug_messages[] = "[UpdateTask] DB Error"; return ['success' => false, 'message'=>'DB Error']; }
    $taskId = $data['taskId'] ?? null;
    if (empty($taskId)) { $debug_messages[] = "[UpdateTask] Task ID required."; return ['success' => false, 'message' => 'Task ID required.']; }
    $debug_messages[] = "[UpdateTask] User $userId: Updating task $taskId, type: $type. Data: " . json_encode($data);
    
    $now = date('Y-m-d H:i:s');
    $setClauses = ["updated_at = ?"];
    $params = [$now]; 
    $paramTypes = "s"; 

    switch ($type) {
        case 'status': 
            $new_status = $data['status'] ?? 'completed';
            $is_scheduled_val = isset($data['isScheduled']) ? (int)(bool)$data['isScheduled'] : 0; 
            $deleted_at_val = $data['deletedAt'] ?? $now;
            $deleted_reason_val = $data['deletedReason'] ?? 'task_completed';

            $setClauses[] = "status = ?"; $params[] = $new_status; $paramTypes .= "s";
            $setClauses[] = "is_scheduled = ?"; $params[] = $is_scheduled_val; $paramTypes .= "i";
            $setClauses[] = "deleted_at = ?"; $params[] = $deleted_at_val; $paramTypes .= "s";
            $setClauses[] = "deleted_reason = ?"; $params[] = $deleted_reason_val; $paramTypes .= "s";
            break;
        case 'soft_delete': 
            $deleted_reason_val_sd = $data['deletedReason'] ?? 'individual_deletion';
            $setClauses[] = "status = 'deleted'";
            $setClauses[] = "is_scheduled = 0"; 
            $setClauses[] = "deleted_at = ?"; $params[] = $now; $paramTypes .= "s";
            $setClauses[] = "deleted_reason = ?"; $params[] = $deleted_reason_val_sd; $paramTypes .= "s";
            break;
        case 'recover':
            $setClauses[] = "status = 'active'";
            $setClauses[] = "deleted_at = NULL";
            $setClauses[] = "deleted_reason = NULL";
            break;
        case 'schedule': 
            $start_time_val = isset($data['startTime']) ? (int)$data['startTime'] : null; 
            $duration_val = isset($data['duration']) ? (int)$data['duration'] : null;   
            $desc_val = $data['scheduleDescription'] ?? "";
            $is_scheduled_db_val = isset($data['isScheduled']) ? (int)(bool)$data['isScheduled'] : 1; 

            $setClauses[] = "is_scheduled = ?"; $params[] = $is_scheduled_db_val; $paramTypes .= "i";
            $setClauses[] = "start_time = ?"; $params[] = $start_time_val; $paramTypes .= (is_null($start_time_val) ? "s" : "i"); // Use 's' for NULL, 'i' for integer
            $setClauses[] = "duration = ?"; $params[] = $duration_val; $paramTypes .= (is_null($duration_val) ? "s" : "i");
            $setClauses[] = "schedule_description = ?"; $params[] = $desc_val; $paramTypes .= "s";
            break;
        case 'unschedule':
            $setClauses[] = "is_scheduled = 0"; 
            $setClauses[] = "start_time = NULL"; $params[] = null; $paramTypes .= "s"; // Bind NULL as string type for safety with bind_param variadic
            $setClauses[] = "duration = NULL"; $params[] = null; $paramTypes .= "s";
            break;
        default:
            $debug_messages[] = "[UpdateTask] Invalid task update type: $type";
            return ['success' => false, 'message' => 'Invalid task update type.'];
    }

    $params[] = $taskId; $paramTypes .= "s";
    $params[] = $userId; $paramTypes .= "i";

    $sql = "UPDATE tasks SET " . implode(", ", $setClauses) . " WHERE id = ? AND user_id = ?";
    $stmt = $db->prepare($sql);
    if (!$stmt) { $debug_messages[] = "[UpdateTask] DB Prep Error for task $taskId: " . $db->error . " SQL: " . $sql; return ['success' => false, 'message' => 'DB Prep Error: ' . $db->error]; }
    
    // For binding NULLs correctly, ensure they are passed as null and typed as 's' or 'i' if column allows null.
    // For bind_param with splat operator, pass actual nulls, not string "NULL"
    $actual_params_for_bind = [];
    foreach($params as $key => $value) {
        if($paramTypes[$key] === 'i' && is_null($value)) {
            // This is tricky. Some MySQL versions/drivers might prefer string 's' for NULL on int columns.
            // For safety, if an int column can be NULL, type it as 's' in $paramTypes when value is null.
            // The current logic in 'schedule' and 'unschedule' should handle this if null is passed.
        }
        $actual_params_for_bind[] = $value;
    }
    $stmt->bind_param($paramTypes, ...$actual_params_for_bind);


    if ($stmt->execute()) {
        $affected_rows = $stmt->affected_rows;
        $stmt->close(); 
        if ($affected_rows > 0) {
            $stmt_fetch = $db->prepare("SELECT id, project_id, text, status, created_at, updated_at, deleted_at, deleted_reason, is_scheduled, start_time, duration, schedule_description FROM tasks WHERE id = ? AND user_id = ?");
            if (!$stmt_fetch) { $debug_messages[] = "[UpdateTask] DB Fetch After Update Error task $taskId: " . $db->error; return ['success' => true, 'message' => 'Task updated, but failed to fetch details.'];}
            $stmt_fetch->bind_param("si", $taskId, $userId);
            if(!$stmt_fetch->execute()){ $error_msg = $stmt_fetch->error; $stmt_fetch->close(); $debug_messages[]="[UpdateTask] DB Fetch after update execute error: ". $error_msg; return ['success'=>true, 'message'=>'Task updated, fetch error.'];}
            $result_fetch = $stmt_fetch->get_result();
            $updatedTask = $result_fetch->fetch_assoc();
            $stmt_fetch->close();
            if ($updatedTask) castTaskForClient($updatedTask);
            
            $debug_messages[] = "[UpdateTask] Successfully updated task $taskId. Type: $type. Updated task data: " . json_encode($updatedTask);
            return ['success' => true, 'message' => 'Task updated.', 'updatedTask' => $updatedTask];
        } else {
            $debug_messages[] = "[UpdateTask] Task $taskId (type: $type) - 0 rows affected. Task might not exist or data was identical.";
            $stmt_check_exists = $db->prepare("SELECT id, project_id, text, status, created_at, updated_at, deleted_at, deleted_reason, is_scheduled, start_time, duration, schedule_description FROM tasks WHERE id = ? AND user_id = ?");
            if (!$stmt_check_exists) { $debug_messages[]="[UpdateTask] Error checking existence for $taskId"; return ['success' => false, 'message' => 'Error checking task existence.']; }
            $stmt_check_exists->bind_param("si", $taskId, $userId);
            if(!$stmt_check_exists->execute()){ $error_msg=$stmt_check_exists->error; $stmt_check_exists->close(); $debug_messages[]="[UpdateTask] Error executing check existence for $taskId: ". $error_msg; return ['success'=>false, 'message'=>'Error exec check task.'];}
            $result_check_exists = $stmt_check_exists->get_result();
            $currentTask = $result_check_exists->fetch_assoc();
            $stmt_check_exists->close();
            if ($currentTask) {
                castTaskForClient($currentTask);
                return ['success' => true, 'message' => 'Task data was already up to date.', 'updatedTask' => $currentTask];
            }
            return ['success' => false, 'message' => 'Task not found.'];
        }
    } else {
        $error_msg = $stmt->error; $stmt->close();
        $debug_messages[] = "[UpdateTask] Failed to update task $taskId (type: $type). Error: " . $error_msg;
        return ['success' => false, 'message' => 'Failed to update task: ' . $error_msg];
    }
}

// Implement other handlers (handleSoftDeleteProject, handleRecoverProject, etc.) with the same pattern:
// 1. Add &$debug_messages parameter.
// 2. Replace error_log() with $debug_messages[] = "...";
// 3. Ensure they return an array e.g., ['success' => true, ...].
// 4. Add DB connection check at the start.
// 5. Cast task objects using castTaskForClient() if they return tasks.

function handleSoftDeleteProject($db, $userId, $projectId, &$debug_messages) {
    if (!$db || !($db instanceof mysqli) || $db->connect_error) { $debug_messages[] = "[SoftDeleteProject] DB Error"; return ['success' => false, 'message'=>'DB Error']; }
    if (empty($projectId)) { $debug_messages[] = "[SoftDeleteProject] Project ID required."; return ['success' => false, 'message' => 'Project ID required.']; }
    $debug_messages[] = "[SoftDeleteProject] User $userId: Soft deleting project $projectId";
    $now = date('Y-m-d H:i:s');
    
    $db->begin_transaction();
    try {
        $stmt_proj = $db->prepare("UPDATE projects SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND is_default = 0"); // is_default is TINYINT
        if (!$stmt_proj) { $db->rollback(); $debug_messages[] = "[SoftDeleteProject] Proj upd prep error: ".$db->error; throw new Exception('DB error (proj upd prep): ' . $db->error); }
        $stmt_proj->bind_param("sssi", $now, $now, $projectId, $userId);
        if(!$stmt_proj->execute()){ $error_msg = $stmt_proj->error; $stmt_proj->close(); $db->rollback(); $debug_messages[]="[SoftDeleteProject] Proj upd exec error: ".$error_msg; throw new Exception($error_msg); }
        $affected_proj_rows = $stmt_proj->affected_rows;
        $stmt_proj->close();
        if ($affected_proj_rows === 0) {
             $debug_messages[] = "[SoftDeleteProject] Project $projectId - not found, is default, or already deleted.";
             // This might not be an error if client logic prevents deleting default.
        }

        $stmt_tasks = $db->prepare("UPDATE tasks SET status = 'deleted', deleted_at = ?, deleted_reason = 'project_soft_deleted', is_scheduled = 0, updated_at = ? WHERE project_id = ? AND user_id = ? AND status != 'deleted'");
        if (!$stmt_tasks) { $db->rollback(); $debug_messages[] = "[SoftDeleteProject] Task upd prep error: ".$db->error; throw new Exception('DB error (task upd prep): ' . $db->error); }
        $stmt_tasks->bind_param("sssi", $now, $now, $projectId, $userId);
        if(!$stmt_tasks->execute()){ $error_msg = $stmt_tasks->error; $stmt_tasks->close(); $db->rollback(); $debug_messages[]="[SoftDeleteProject] Task upd exec error: ".$error_msg; throw new Exception($error_msg); }
        $stmt_tasks->close();

        $db->commit();
        $debug_messages[] = "[SoftDeleteProject] Soft deleted project $projectId and its tasks.";
        return ['success' => true, 'message' => 'Project and its tasks moved to recycle bin.', 'deletedAt' => $now];
    } catch (Exception $e) {
        // $db->rollback(); // Already done in relevant places or automatically on uncommitted transaction
        $debug_messages[] = "[SoftDeleteProject] Error soft deleting project $projectId: " . $e->getMessage();
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

function handleRecoverProject($db, $userId, $projectId, &$debug_messages) {
    if (!$db || !($db instanceof mysqli) || $db->connect_error) { $debug_messages[] = "[RecoverProject] DB Error"; return ['success' => false, 'message'=>'DB Error']; }
    if (empty($projectId)) { $debug_messages[] = "[RecoverProject] Project ID required."; return ['success' => false, 'message' => 'Project ID required.']; }
    $debug_messages[] = "[RecoverProject] User $userId: Recovering project $projectId";
    $now = date('Y-m-d H:i:s');
    $recoveredProject = null;
    $recoveredTasks = [];
    
    $db->begin_transaction();
    try {
        $stmt_proj = $db->prepare("UPDATE projects SET status = 'active', deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'deleted'");
        if (!$stmt_proj) throw new Exception('DB error (proj upd prep): ' . $db->error);
        $stmt_proj->bind_param("ssi", $now, $projectId, $userId);
        if (!$stmt_proj->execute() || $stmt_proj->affected_rows === 0) {
            $stmt_proj->close(); throw new Exception('Failed to recover project or project not found in bin.');
        }
        $stmt_proj->close();
        
        $stmt_fetch_proj = $db->prepare("SELECT id, name, status, is_default, created_at, updated_at, deleted_at FROM projects WHERE id = ? AND user_id = ?");
        if (!$stmt_fetch_proj) throw new Exception('DB error (fetch proj prep): ' . $db->error);
        $stmt_fetch_proj->bind_param("si", $projectId, $userId);
        if(!$stmt_fetch_proj->execute()){ $error_msg = $stmt_fetch_proj->error; $stmt_fetch_proj->close(); throw new Exception($error_msg); }
        $result_fetch_proj = $stmt_fetch_proj->get_result();
        $fetched_project_row = $result_fetch_proj->fetch_assoc();
        $stmt_fetch_proj->close();
        if ($fetched_project_row) {
            $recoveredProject = $fetched_project_row;
            $recoveredProject['is_default'] = (int)$recoveredProject['is_default']; 
            $recoveredProject['isDefault'] = (bool)$recoveredProject['is_default'];
        }


        $stmt_tasks = $db->prepare("UPDATE tasks SET status = 'active', deleted_at = NULL, deleted_reason = NULL, updated_at = ? WHERE project_id = ? AND user_id = ? AND deleted_reason = 'project_soft_deleted'");
        if (!$stmt_tasks) throw new Exception('DB error (task upd prep): ' . $db->error);
        $stmt_tasks->bind_param("ssi", $now, $projectId, $userId);
        if(!$stmt_tasks->execute()){ $error_msg=$stmt_tasks->error; $stmt_tasks->close(); throw new Exception($error_msg);}
        $stmt_tasks->close();

        $stmt_fetch_tasks = $db->prepare("SELECT id, project_id, text, status, created_at, updated_at, deleted_at, deleted_reason, is_scheduled, start_time, duration, schedule_description FROM tasks WHERE project_id = ? AND user_id = ? AND status = 'active'");
        if (!$stmt_fetch_tasks) throw new Exception('DB error (fetch task prep): ' . $db->error);
        $stmt_fetch_tasks->bind_param("si", $projectId, $userId);
        if(!$stmt_fetch_tasks->execute()){ $error_msg=$stmt_fetch_tasks->error; $stmt_fetch_tasks->close(); throw new Exception($error_msg); }
        $result_fetch_tasks = $stmt_fetch_tasks->get_result();
        while($row = $result_fetch_tasks->fetch_assoc()){
            castTaskForClient($row);
            $recoveredTasks[] = $row;
        }
        $stmt_fetch_tasks->close();

        $db->commit();
        $debug_messages[] = "[RecoverProject] Recovered project $projectId. Recovered " . count($recoveredTasks) . " tasks.";
        return ['success' => true, 'message' => 'Project recovered.', 'recoveredProject' => $recoveredProject, 'recoveredTasks' => $recoveredTasks];
    } catch (Exception $e) {
        $db->rollback();
        $debug_messages[] = "[RecoverProject] Error recovering project $projectId: " . $e->getMessage();
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

function handlePermanentlyDeleteProject($db, $userId, $projectId, &$debug_messages) {
    if (!$db || !($db instanceof mysqli) || $db->connect_error) { $debug_messages[] = "[PermDeleteProject] DB Error"; return ['success' => false, 'message'=>'DB Error']; }
    if (empty($projectId)) { $debug_messages[] = "[PermDeleteProject] Project ID required."; return ['success' => false, 'message' => 'Project ID required.']; }
    $debug_messages[] = "[PermDeleteProject] User $userId: Permanently deleting project $projectId";
    
    $db->begin_transaction();
    try {
        $stmt_tasks = $db->prepare("DELETE FROM tasks WHERE project_id = ? AND user_id = ?");
        if (!$stmt_tasks) throw new Exception('DB error (task del prep): ' . $db->error);
        $stmt_tasks->bind_param("si", $projectId, $userId);
        if(!$stmt_tasks->execute()){ $error_msg=$stmt_tasks->error; $stmt_tasks->close(); throw new Exception($error_msg);}
        $stmt_tasks->close();

        $stmt_proj = $db->prepare("DELETE FROM projects WHERE id = ? AND user_id = ? AND is_default = 0"); // is_default is 0 for FALSE
        if (!$stmt_proj) throw new Exception('DB error (proj del prep): ' . $db->error);
        $stmt_proj->bind_param("si", $projectId, $userId);
        if (!$stmt_proj->execute() || $stmt_proj->affected_rows === 0) {
            $stmt_proj->close(); throw new Exception('Failed to delete project, it might be default or not found.');
        }
        $stmt_proj->close();

        $db->commit();
        $debug_messages[] = "[PermDeleteProject] Permanently deleted project $projectId and its tasks.";
        return ['success' => true, 'message' => 'Project and its tasks permanently deleted.'];
    } catch (Exception $e) {
        $db->rollback();
        $debug_messages[] = "[PermDeleteProject] Error permanently deleting project $projectId: " . $e->getMessage();
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

function handlePermanentlyDeleteTask($db, $userId, $taskId, &$debug_messages) {
    if (!$db || !($db instanceof mysqli) || $db->connect_error) { $debug_messages[] = "[PermDeleteTask] DB Error"; return ['success' => false, 'message'=>'DB Error']; }
    if (empty($taskId)) { $debug_messages[] = "[PermDeleteTask] Task ID required."; return ['success' => false, 'message' => 'Task ID required.']; }
    $debug_messages[] = "[PermDeleteTask] User $userId: Permanently deleting task $taskId";

    $stmt = $db->prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?");
    if (!$stmt) { $debug_messages[] = "[PermDeleteTask] DB Prep Error task $taskId: " . $db->error; return ['success' => false, 'message' => 'DB Prep Error: ' . $db->error]; }
    $stmt->bind_param("si", $taskId, $userId);
    if ($stmt->execute()) {
        $affected_rows = $stmt->affected_rows;
        $stmt->close();
        if ($affected_rows > 0) {
            $debug_messages[] = "[PermDeleteTask] Permanently deleted task $taskId.";
            return ['success' => true, 'message' => 'Task permanently deleted.'];
        } else {
            $debug_messages[] = "[PermDeleteTask] Task $taskId not found for permanent deletion.";
            return ['success' => false, 'message' => 'Task not found.'];
        }
    } else {
        $error_msg = $stmt->error; $stmt->close();
        $debug_messages[] = "[PermDeleteTask] Failed to perm_delete_task $taskId. Error: " . $error_msg;
        return ['success' => false, 'message' => 'Failed to delete task: ' . $error_msg];
    }
}

function handleImportData($db, $userId, $data, &$debug_messages) {
    if (!$db || !($db instanceof mysqli) || $db->connect_error) { $debug_messages[] = "[ImportData] DB Error"; return ['success' => false, 'message'=>'DB Error']; }
    $importedProjects = $data['projects'] ?? [];
    $importedTasks = $data['tasks'] ?? [];
    $importedSettings = $data['appSettings'] ?? null;
    $debug_messages[] = "[ImportData] User $userId: Starting data import. " . count($importedProjects) . " projects, " . count($importedTasks) . " tasks.";

    $db->begin_transaction();
    try {
        $stmt_project = $db->prepare("INSERT INTO projects (id, user_id, name, status, is_default, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), status=VALUES(status), is_default=VALUES(is_default), updated_at=VALUES(updated_at), deleted_at=VALUES(deleted_at)");
        if (!$stmt_project) { $db->rollback(); $debug_messages[]="[ImportData] Proj import prep error: ".$db->error; throw new Exception("DB error (project import prep): " . $db->error); }

        foreach ($importedProjects as $p) {
            $p_id = $p['id'] ?? ('imported_proj_' . uniqid());
            $p_name = $p['name'] ?? 'Untitled Project';
            $p_status = $p['status'] ?? 'active';
            $p_is_default_db = isset($p['isDefault']) ? (int)(bool)$p['isDefault'] : (isset($p['is_default']) ? (int)(bool)$p['is_default'] : 0);
            $p_created_at = $p['createdAt'] ?? ($p['created_at'] ?? date('Y-m-d H:i:s'));
            $p_updated_at = date('Y-m-d H:i:s'); 
            $p_deleted_at = $p['deletedAt'] ?? ($p['deleted_at'] ?? null);

            $stmt_project->bind_param("sissssss", $p_id, $userId, $p_name, $p_status, $p_is_default_db, $p_created_at, $p_updated_at, $p_deleted_at);
            if (!$stmt_project->execute()) {
                 $debug_messages[] = "[ImportData] Error importing project ID $p_id: " . $stmt_project->error;
            }
        }
        $stmt_project->close();

        $stmt_task = $db->prepare("INSERT INTO tasks (id, user_id, project_id, text, status, created_at, updated_at, deleted_at, deleted_reason, is_scheduled, start_time, duration, schedule_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE project_id=VALUES(project_id), text=VALUES(text), status=VALUES(status), updated_at=VALUES(updated_at), deleted_at=VALUES(deleted_at), deleted_reason=VALUES(deleted_reason), is_scheduled=VALUES(is_scheduled), start_time=VALUES(start_time), duration=VALUES(duration), schedule_description=VALUES(schedule_description)");
        if (!$stmt_task) { $db->rollback(); $debug_messages[]="[ImportData] Task import prep error: ".$db->error; throw new Exception("DB error (task import prep): " . $db->error); }
        
        foreach ($importedTasks as $t) {
            $t_id = $t['id'] ?? ('imported_task_' . uniqid());
            $t_project_id = $t['projectId'] ?? ($t['project_id'] ?? 'proj_0'); 
            $t_text = $t['text'] ?? 'Untitled Task';
            $t_status = $t['status'] ?? 'active';
            $t_created_at = $t['createdAt'] ?? ($t['created_at'] ?? date('Y-m-d H:i:s'));
            $t_updated_at = date('Y-m-d H:i:s'); 
            $t_deleted_at = $t['deletedAt'] ?? ($t['deleted_at'] ?? null);
            $t_deleted_reason = $t['deletedReason'] ?? ($t['deleted_reason'] ?? null);
            $t_is_scheduled_db = isset($t['isScheduled']) ? (int)(bool)$t['isScheduled'] : (isset($t['is_scheduled']) ? (int)(bool)$t['is_scheduled'] : 0);
            $t_start_time_db = isset($t['startTime']) ? (int)$t['startTime'] : (isset($t['start_time']) ? (int)$t['start_time'] : null);
            $t_duration_db = isset($t['duration']) ? (int)$t['duration'] : null;
            $t_schedule_description = $t['scheduleDescription'] ?? ($t['schedule_description'] ?? "");

            $stmt_task->bind_param("sisssssssiiss", $t_id, $userId, $t_project_id, $t_text, $t_status, $t_created_at, $t_updated_at, $t_deleted_at, $t_deleted_reason, $t_is_scheduled_db, $t_start_time_db, $t_duration_db, $t_schedule_description);
             if (!$stmt_task->execute()) {
                $debug_messages[] = "[ImportData] Error importing task ID $t_id: " . $stmt_task->error;
            }
        }
        $stmt_task->close();

        if ($importedSettings) {
            $theme = $importedSettings['theme'] ?? 'light';
            $currentProjId = $importedSettings['currentProjectId'] ?? ($importedSettings['current_project_id'] ?? null);
             $stmt_settings_import = $db->prepare("INSERT INTO user_app_settings (user_id, theme, current_project_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE theme = VALUES(theme), current_project_id = VALUES(current_project_id)");
            if ($stmt_settings_import) {
                $stmt_settings_import->bind_param("iss", $userId, $theme, $currentProjId);
                $stmt_settings_import->execute(); // Assume success for brevity
                $stmt_settings_import->close();
            } else {
                $debug_messages[] = "[ImportData] Error preparing app settings import statement: " . $db->error;
            }
        }

        $db->commit();
        $debug_messages[] = "[ImportData] Data import process completed.";
        return ['success' => true, 'message' => 'Data import processed.'];
    } catch (Exception $e) {
        $db->rollback(); // Ensure rollback on exception
        $debug_messages[] = "[ImportData] Import failed: " . $e->getMessage();
        return ['success' => false, 'message' => 'Import failed: ' . $e->getMessage()];
    }
}
?>