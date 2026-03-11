<?php
// api/tests.php
require_once __DIR__ . '/../lib/helpers.php';

$templates_dir = __DIR__ . '/../templates/';
$results_dir = __DIR__ . '/../results/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        // Get single template
        $id = basename($_GET['id']);
        $path = $templates_dir . $id . '.json';
        if (file_exists($path)) {
            $data = read_json_file($path);
            $data['filename'] = $id;
            json_response(['success' => true, 'data' => $data]);
        } else {
            json_response(['success' => false, 'error' => 'Template not found'], 404);
        }
    } else {
        // List all templates
        $files = glob($templates_dir . '*.json');
        $templates = [];
        foreach ($files as $file) {
            $data = read_json_file($file);
            if ($data) {
                $filename = basename($file, '.json');
                
                // Count runs (results files starting with this template name)
                $run_files = glob($results_dir . $filename . '_*.json');
                $runs_count = count($run_files);

                $templates[] = [
                    'filename' => $filename,
                    'title' => $data['title'] ?? 'Untitled',
                    'prompts_count' => isset($data['prompts']) ? count($data['prompts']) : 0,
                    'created_at' => $data['created_at'] ?? date('Y-m-d H:i:s', filemtime($file)),
                    'runs_count' => $runs_count
                ];
            }
        }
        // Sort newest first
        usort($templates, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });
        json_response(['success' => true, 'data' => $templates]);
    }
} elseif ($method === 'DELETE') {
    $id = basename($_GET['id'] ?? '');
    if (!$id) json_response(['success' => false, 'error' => 'Missing ID'], 400);
    
    $path = $templates_dir . $id . '.json';
    if (file_exists($path)) {
        unlink($path);
        json_response(['success' => true]);
    }
    json_response(['success' => false, 'error' => 'File not found'], 404);
} elseif ($method === 'POST' || $method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) json_response(['success' => false, 'error' => 'Invalid JSON'], 400);

    $is_revision = isset($_GET['action']) && $_GET['action'] === 'revision';
    
    $base_title = $input['title'] ?? 'Untitled';
    $safe_title = safe_filename($base_title);
    
    if ($method === 'PUT' && isset($_GET['id']) && !$is_revision) {
        $filename = basename($_GET['id']);
    } else {
        $time_suffix = substr(time(), -4);
        $filename = "{$safe_title}_{$time_suffix}";
    }

    $input['updated_at'] = date('c');
    if ($method === 'POST' || $is_revision) {
        $input['created_at'] = date('c');
    }

    $path = $templates_dir . $filename . '.json';
    write_json_file($path, $input);
    
    json_response(['success' => true, 'filename' => $filename, 'data' => $input]);
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
