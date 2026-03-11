<?php
// lib/openrouter.php
require_once __DIR__ . '/helpers.php';

// Extend execution time to 10 minutes to handle long AI model responses
set_time_limit(600);

function get_api_key() {
    return $_ENV['OPENROUTER_API_KEY'] ?? getenv('OPENROUTER_API_KEY');
}

function fetch_models() {
    $apiKey = get_api_key();
    if (!$apiKey) {
        throw new Exception("OpenRouter API key not found in .env");
    }

    $ch = curl_init('https://openrouter.ai/api/v1/models');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer {$apiKey}",
        "HTTP-Referer: http://localhost:4031", // Optional but recommended by OpenRouter
        "X-Title: Model Testing Platform"
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error || $httpCode !== 200) {
        throw new Exception("Failed to fetch models: " . ($error ?: "HTTP $httpCode"));
    }

    $data = json_decode($response, true);
    return $data['data'] ?? [];
}

function chat_completion($model, $messages, $options = []) {
    $apiKey = get_api_key();
    if (!$apiKey) {
        throw new Exception("OpenRouter API key not found");
    }

    $url = 'https://openrouter.ai/api/v1/chat/completions';
    $payload = array_merge([
        'model' => $model,
        'messages' => $messages
    ], $options);

    $maxRetries = 3;
    $backoff = 1; // seconds

    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer {$apiKey}",
            "Content-Type: application/json",
            "HTTP-Referer: http://localhost:4031",
            "X-Title: Model Testing Platform",
            "X-Title: 600"
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 300);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            $data = json_decode($response, true);
            if (isset($data['choices'][0]['message']['content'])) {
                return $data['choices'][0]['message']['content'];
            }
        }

        if ($attempt < $maxRetries) {
            sleep($backoff);
            $backoff *= 2; // Exponential backoff (1s, 2s, 4s)
        } else {
            throw new Exception("OpenRouter API request failed after $maxRetries attempts. " . ($error ?: "HTTP $httpCode") . " Response: " . $response);
        }
    }
    return null;
}
