<?php
// api/generate.php
require_once __DIR__ . '/../lib/openrouter.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'error' => 'POST required'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['requirements']) || empty($input['model'])) {
    json_response(['success' => false, 'error' => 'Missing required fields'], 400);
}

$requirements = $input['requirements'];
$evaluation_angles = $input['evaluation_angles'] ?? '';
$model = $input['model'];

// Load prompt template
$prompt_template = file_get_contents(__DIR__ . '/../data/prompts/generate_test.txt');
$prompt = str_replace('{requirements}', $requirements, $prompt_template);

$messages = [
    ['role' => 'user', 'content' => $prompt]
];

try {
    $response_content = chat_completion($model, $messages);
    
    if (!$response_content) {
        throw new Exception("Empty response from model");
    }

    // Attempt to parse JSON. Sometimes models wrap it in markdown block: ```json ... ```
    $json_str = $response_content;
    
    // Remove markdown code block wrapping if present
    if (preg_match('/```json\s*(.*?)\s*```/is', $json_str, $matches)) {
        $json_str = $matches[1];
    } elseif (preg_match('/```\s*(.*?)\s*```/is', $json_str, $matches)) {
        $json_str = $matches[1];
    }
    
    $parsed_data = json_decode(trim($json_str), true);
    
    if (json_last_error() !== JSON_ERROR_NONE || !$parsed_data || !isset($parsed_data['prompts'])) {
        throw new Exception("Failed to parse valid JSON from response. Raw response: " . substr($response_content, 0, 200));
    }

    // Force exactly 10 if it generated more/less, though prompt asked for 10
    if (count($parsed_data['prompts']) > 10) {
        $parsed_data['prompts'] = array_slice($parsed_data['prompts'], 0, 10);
    }

    // Ensure structure is correct
    $final_data = [
        'title' => $parsed_data['title'] ?? 'Generated Test',
        'requirements' => $requirements,
        'evaluation_angles' => $evaluation_angles,
        'generator_model' => $model,
        'prompts' => $parsed_data['prompts']
    ];

    json_response(['success' => true, 'data' => $final_data]);

} catch (Exception $e) {
    json_response(['success' => false, 'error' => $e->getMessage()], 500);
}
