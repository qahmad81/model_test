<?php
// api/execute.php
require_once __DIR__ . '/../lib/openrouter.php';

// We will use SSE (Server-Sent Events)
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); // Nginx

// Turn off output buffering
@ini_set('output_buffering', 'off');
@ini_set('zlib.output_compression', false);
while (ob_get_level()) { ob_end_flush(); }

function send_sse_msg($data) {
    echo "data: " . json_encode($data) . "\n\n";
    @flush();
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    send_sse_msg(['error' => 'Invalid JSON input']);
    exit;
}

$template_id = $input['template'] ?? '';
$target_model = $input['target_model'] ?? '';
$evaluators = $input['evaluators'] ?? [];
$summarizer = $input['summarizer'] ?? '';

if (!$template_id || !$target_model || empty($evaluators) || !$summarizer) {
    send_sse_msg(['error' => 'Missing required fields']);
    exit;
}

$template_path = __DIR__ . '/../templates/' . basename($template_id) . '.json';
$template_data = read_json_file($template_path);

if (!$template_data || !isset($template_data['prompts'])) {
    send_sse_msg(['error' => 'Template not found or invalid']);
    exit;
}

$safe_model_name = safe_filename($target_model);

// Determine version
$tests_dir = __DIR__ . '/../tests/';
$results_dir = __DIR__ . '/../results/';
$base_name = $template_id . '_' . $safe_model_name;
$v = 1;
while (file_exists($tests_dir . $base_name . '_V' . $v . '.json')) {
    $v++;
}
$filename = $base_name . '_V' . $v;

$test_file = $tests_dir . $filename . '.json';
$result_file = $results_dir . $filename . '.json';

$test_data = [
    'template' => $template_id,
    'model' => $target_model,
    'version' => $v,
    'created_at' => date('c'),
    'qa_pairs' => []
];

// Phase 1: Test Execution
send_sse_msg(['phase' => 'testing', 'status' => 'Starting Phase 1: Execution']);
$prompts = $template_data['prompts'];
$total_prompts = count($prompts);

foreach ($prompts as $idx => $p) {
    $step = $idx + 1;
    send_sse_msg(['phase' => 'testing', 'step' => $step, 'total' => $total_prompts, 'status' => "Asking $target_model Q{$step}..."]);
    
    $messages = [['role' => 'user', 'content' => $p['prompt']]];
    try {
        $response = chat_completion($target_model, $messages);
        $test_data['qa_pairs'][] = [
            'id' => $p['id'] ?? $step,
            'prompt' => $p['prompt'],
            'tested_requirements' => $p['tested_requirements'] ?? '',
            'response' => $response,
            'status' => 'success'
        ];
    } catch (Exception $e) {
        $test_data['qa_pairs'][] = [
            'id' => $p['id'] ?? $step,
            'prompt' => $p['prompt'],
            'tested_requirements' => $p['tested_requirements'] ?? '',
            'response' => "ERROR: " . $e->getMessage(),
            'status' => 'error'
        ];
        send_sse_msg(['phase' => 'testing', 'step' => $step, 'total' => $total_prompts, 'status' => "Error on Q{$step}"]);
    }
}
write_json_file($test_file, $test_data);


// Phase 2: Evaluation
send_sse_msg(['phase' => 'evaluating', 'status' => 'Starting Phase 2: Evaluation']);
$eval_template = file_get_contents(__DIR__ . '/../data/prompts/evaluator.txt');

$qa_text = "";
foreach ($test_data['qa_pairs'] as $idx => $qa) {
    $qa_text .= "Q" . ($idx+1) . ": " . $qa['prompt'] . "\n";
    $qa_text .= "A" . ($idx+1) . ": " . $qa['response'] . "\n\n";
}

$eval_prompt = str_replace(
    ['{evaluation_angles}', '{qa_pairs}'],
    [$template_data['evaluation_angles'], $qa_text],
    $eval_template
);

$result_data = [
    'test_file' => $filename,
    'template' => $template_id,
    'model' => $target_model,
    'created_at' => date('c'),
    'evaluations' => [],
    'summary' => null
];

$total_evals = count($evaluators);
foreach ($evaluators as $idx => $eval_model) {
    if (empty($eval_model)) continue;
    $step = $idx + 1;
    send_sse_msg(['phase' => 'evaluating', 'step' => $step, 'total' => $total_evals, 'status' => "Evaluating with $eval_model..."]);
    
    $messages = [['role' => 'user', 'content' => $eval_prompt]];
    try {
        $response = chat_completion($eval_model, $messages);
        
        // Extract JSON
        $json_str = $response;
        if (preg_match('/```json\s*(.*?)\s*```/is', $json_str, $matches)) $json_str = $matches[1];
        elseif (preg_match('/```\s*(.*?)\s*```/is', $json_str, $matches)) $json_str = $matches[1];
        
        $parsed = json_decode(trim($json_str), true);
        if (!$parsed) throw new Exception("Invalid JSON returned by evaluator");
        
        $result_data['evaluations'][] = [
            'evaluator_model' => $eval_model,
            'data' => $parsed,
            'status' => 'success'
        ];
    } catch (Exception $e) {
        $result_data['evaluations'][] = [
            'evaluator_model' => $eval_model,
            'error' => $e->getMessage(),
            'status' => 'error'
        ];
        send_sse_msg(['phase' => 'evaluating', 'step' => $step, 'total' => $total_evals, 'status' => "Error evaluating with $eval_model"]);
    }
}
write_json_file($result_file, $result_data);


// Phase 3: Summary
send_sse_msg(['phase' => 'summarizing', 'status' => 'Starting Phase 3: Summarizing results']);
$sum_template = file_get_contents(__DIR__ . '/../data/prompts/summarizer.txt');
$evals_text = json_encode($result_data['evaluations'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

$sum_prompt = str_replace('{evaluations}', $evals_text, $sum_template);
$messages = [['role' => 'user', 'content' => $sum_prompt]];

try {
    $response = chat_completion($summarizer, $messages);
    $json_str = $response;
    if (preg_match('/```json\s*(.*?)\s*```/is', $json_str, $matches)) $json_str = $matches[1];
    elseif (preg_match('/```\s*(.*?)\s*```/is', $json_str, $matches)) $json_str = $matches[1];
    
    $parsed = json_decode(trim($json_str), true);
    if (!$parsed) throw new Exception("Invalid JSON returned by summarizer");
    
    $result_data['summary'] = $parsed;
    $result_data['summary']['model'] = $summarizer;
} catch (Exception $e) {
    $result_data['summary'] = [
        'error' => $e->getMessage(),
        'model' => $summarizer
    ];
}

write_json_file($result_file, $result_data);

send_sse_msg(['phase' => 'complete', 'status' => 'All done!', 'result_file' => $filename]);
exit;
