<?php
// api/results.php
require_once __DIR__ . '/../lib/helpers.php';

$results_dir = __DIR__ . '/../results/';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if (isset($_GET['file'])) {
        // Get full result file
        $file = basename($_GET['file']);
        $path = $results_dir . $file . '.json';
        if (file_exists($path)) {
            $data = read_json_file($path);
            json_response(['success' => true, 'data' => $data]);
        } else {
            json_response(['success' => false, 'error' => 'Result not found'], 404);
        }
    } elseif (isset($_GET['template'])) {
        // Get all results for a specific template
        $template = basename($_GET['template']);
        $files = glob($results_dir . $template . '_*.json');
        $results = [];
        
        foreach ($files as $file) {
            $data = read_json_file($file);
            if ($data) {
                $filename = basename($file, '.json');
                $results[] = [
                    'filename' => $filename,
                    'model' => $data['model'] ?? 'Unknown',
                    'created_at' => $data['created_at'] ?? filemtime($file),
                    'summary' => $data['summary'] ?? null
                ];
            }
        }
        
        // Sort newest first
        usort($results, function($a, $b) {
            $timeA = is_numeric($a['created_at']) ? $a['created_at'] : strtotime($a['created_at']);
            $timeB = is_numeric($b['created_at']) ? $b['created_at'] : strtotime($b['created_at']);
            return $timeB - $timeA;
        });
        
        json_response(['success' => true, 'data' => $results]);
    } else {
        json_response(['success' => false, 'error' => 'Missing file or template parameter'], 400);
    }
}

json_response(['success' => false, 'error' => 'Method not allowed'], 405);
