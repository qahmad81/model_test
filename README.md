# Model Testing Platform

A web-based AI model testing platform that allows users to create test templates, execute them against various models via OpenRouter, and perform multi-model evaluation and summarization.

## Architecture

- **Backend**: PHP (using `router.php` for the built-in server)
- **Frontend**: Plain JS + Bootstrap 5
- **AI Provider**: OpenRouter API
- **Storage**: JSON-based file storage (`templates/`, `tests/`, `results/`, `cache/`)

## Directory Structure

- `api/`: Backend API endpoints (models, tests, generation, execution, results)
- `assets/`: Frontend JS/CSS (app core, grid, test creation, execution, autocomplete)
- `lib/`: Shared PHP libraries (OpenRouter client, helpers)
- `data/prompts/`: AI prompt templates for generation, evaluation, and summarization
- `cache/`: Cached OpenRouter models list
- `templates/`: Generated test templates
- `tests/`: Raw test execution results (Q&A pairs)
- `results/`: Evaluation results and final summaries

## Core Workflows

1. **Test Generation**: Based on requirements and evaluation angles, a generator model creates 10 specific test prompts.
2. **Test Execution**: A selected examinee model responds to the 10 prompts.
3. **Evaluation**: 4 evaluator models score each response based on the evaluation angles.
4. **Summarization**: A summarizer model synthesizes all evaluations into a final report.

## Environment Requirements

- **PHP**: 8.3.12 (command: `php8`)
- **Composer**: 2.7.9 (command: `composer8`)
- **Local Server**: Run `run_server.bat` (accessible at http://localhost:4031)
- **Configuration**: `.env` file must contain `OPENROUTER_API_KEY`
