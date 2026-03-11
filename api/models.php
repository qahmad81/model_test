<?php
// api/models.php
require_once __DIR__ . '/../lib/openrouter.php';

$cache_file = __DIR__ . '/../cache/models.json';
$cache_ttl = 86400; // 24 hours in seconds

$force_refresh = isset($_GET['refresh']) && $_GET['refresh'] == '1';

if (!$force_refresh && file_exists($cache_file)) {
    $file_age = time() - filemtime($cache_file);
    if ($file_age < $cache_ttl) {
        $cached_data = read_json_file($cache_file);
        if ($cached_data) {
            json_response(['success' => true, 'source' => 'cache', 'data' => $cached_data]);
        }
    }
}

try {
    $models = fetch_models();
    
    // Filter and map only essential fields to keep cache small
    $essential_models = array_map(function($model) {
        return [
            'id' => $model['id'],
            'name' => $model['name'],
            'pricing' => $model['pricing'] ?? ['prompt' => '0', 'completion' => '0'],
            'context_length' => $model['context_length'] ?? 0,
            'description' => $model['description'] ?? ''
        ];
    }, $models);

    write_json_file($cache_file, $essential_models);
    
    json_response(['success' => true, 'source' => 'api', 'data' => $essential_models]);
} catch (Exception $e) {
    // Fallback to cache if API fails and cache exists
    if (file_exists($cache_file)) {
        $cached_data = read_json_file($cache_file);
        if ($cached_data) {
            json_response([
                'success' => true, 
                'source' => 'cache_fallback', 
                'warning' => $e->getMessage(),
                'data' => $cached_data
            ]);
        }
    }
    
    json_response(['success' => false, 'error' => $e->getMessage()], 500);
}
