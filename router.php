<?php
// router.php - Used for PHP built-in server

// Resolve the requested path
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Serve static files directly
$public_paths = ['/assets/', '/cache/', '/templates/', '/tests/', '/results/'];
foreach ($public_paths as $path) {
    if (strpos($uri, $path) === 0) {
        return false; // Let PHP built-in server handle the static file
    }
}

// Serve root as index.html
if ($uri === '/' || $uri === '/index.html') {
    if (file_exists(__DIR__ . '/index.html')) {
        include __DIR__ . '/index.html';
        return true;
    }
    return false;
}

// Route API requests to api/ directory
if (strpos($uri, '/api/') === 0) {
    $script = __DIR__ . $uri;
    if (!str_ends_with($script, '.php')) {
        $script .= '.php';
    }
    if (file_exists($script)) {
        require_once $script;
        return true;
    } else {
        header('HTTP/1.1 404 Not Found');
        header('Content-Type: application/json');
        echo json_encode(['error' => 'API Endpoint Not Found: ' . basename($script)]);
        return true;
    }
}

// If no matching route, return 404
header("HTTP/1.0 404 Not Found");
echo "404 Not Found";
return true;
