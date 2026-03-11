// assets/js/app.js

window.modelsCache = [];

const app = {
    init: async function() {
        this.bindEvents();
        await this.loadModels();
        this.switchTab('grid');
    },

    bindEvents: function() {
        // Navigation clicks
        document.querySelectorAll('#nav-tabs .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.target.closest('a').dataset.target;
                this.switchTab(target);
            });
        });
    },

    switchTab: function(tabId) {
        // Update nav UI
        document.querySelectorAll('#nav-tabs .nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.target === tabId) {
                link.classList.add('active');
            }
        });

        // Hide all pages
        document.querySelectorAll('.page-section').forEach(page => {
            page.classList.add('d-none');
        });

        // Show target page
        document.getElementById(`page-${tabId}`).classList.remove('d-none');

        // Trigger page specific initializations
        if (tabId === 'grid' && window.gridApp) {
            window.gridApp.loadData();
        } else if (tabId === 'execute' && window.executeApp) {
            window.executeApp.init();
        }
    },

    loadModels: async function(force = false) {
        try {
            this.showLoading('Loading models cache...');
            const url = force ? '/api/models.php?refresh=1' : '/api/models.php';
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                window.modelsCache = data.data;
                // Initialize all autocomplete inputs
                document.querySelectorAll('.model-autocomplete').forEach(input => {
                    if (!input.dataset.autocompleteInitialized) {
                        new ModelAutocomplete(input);
                        input.dataset.autocompleteInitialized = 'true';
                    }
                });
            } else {
                this.showAlert('Error loading models: ' + (data.error || 'Unknown error'), 'danger');
            }
        } catch (e) {
            this.showAlert('Network error loading models', 'danger');
        } finally {
            this.hideLoading();
        }
    },

    showLoading: function(text = 'Loading...') {
        document.getElementById('global-loading-text').textContent = text;
        document.getElementById('global-loading').classList.remove('d-none');
    },

    hideLoading: function() {
        document.getElementById('global-loading').classList.add('d-none');
    },

    showAlert: function(message, type = 'info', autoClose = 5000) {
        const container = document.getElementById('alerts-container');
        const id = 'alert-' + Date.now();
        const alertHtml = `
            <div id="${id}" class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', alertHtml);

        if (autoClose > 0) {
            setTimeout(() => {
                const alertEl = document.getElementById(id);
                if (alertEl) {
                    const bsAlert = new bootstrap.Alert(alertEl);
                    bsAlert.close();
                }
            }, autoClose);
        }
    },

    formatDate: function(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        return d.toLocaleString();
    },

    presets: {
        performance: {
            evaluators: ['google/gemini-2.5-pro', 'anthropic/claude-3.7-sonnet', 'openai/gpt-4o', 'deepseek/deepseek-r1'],
            summarizer: 'anthropic/claude-3.7-sonnet'
        },
        standard: {
            evaluators: ['google/gemini-2.5-flash', 'anthropic/claude-3-5-haiku', 'openai/gpt-4o-mini', 'deepseek/deepseek-chat'],
            summarizer: 'google/gemini-2.5-flash'
        },
        economy: {
            evaluators: ['z-ai/glm-4.7-flash', 'meta-llama/llama-3.1-8b-instruct', 'mistralai/mistral-small-24b-instruct-2501', 'qwen/qwen-2.5-7b-instruct'],
            summarizer: 'z-ai/glm-4.7-flash'
        }
    },

    escapeHtml: function(unsafe) {
        if (!unsafe) return '';
        return (unsafe + '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    truncate: function(str, maxLen) {
        if (!str) return '';
        return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    },

    applyPreset: function(type) {
        if (!this.presets[type]) return;
        const preset = this.presets[type];
        
        for (let i = 1; i <= 4; i++) {
            const input = document.getElementById(`exec-eval-${i}`);
            if (input && input.autocompleter) {
                input.autocompleter.setValue(preset.evaluators[i-1] || '');
            } else if (input) {
                input.value = preset.evaluators[i-1] || '';
            }
        }
        
        const sumInput = document.getElementById('exec-summarizer');
        if (sumInput && sumInput.autocompleter) {
            sumInput.autocompleter.setValue(preset.summarizer);
        } else if (sumInput) {
            sumInput.value = preset.summarizer;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
