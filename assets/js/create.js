// assets/js/create.js

window.createApp = {
    currentGeneratedData: null,

    init: function() {
        this.bindEvents();
    },

    bindEvents: function() {
        const form = document.getElementById('form-create-test');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.generateTest();
        });

        document.getElementById('btn-save-template').addEventListener('click', async () => {
            await this.saveTemplate();
        });
    },

    generateTest: async function() {
        const reqs = document.getElementById('create-requirements').value.trim();
        const angles = document.getElementById('create-angles').value.trim();
        const model = document.getElementById('create-model').value.trim();

        if (!reqs || !angles || !model) {
            app.showAlert('Please fill all required fields.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-generate');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating (this may take a minute)...';
        app.showLoading('Asking AI to generate prompts...');

        try {
            const res = await fetch('/api/generate.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requirements: reqs,
                    evaluation_angles: angles,
                    model: model
                })
            });
            const result = await res.json();

            if (result.success) {
                this.currentGeneratedData = result.data;
                this.showPreview(result.data);
                app.showAlert('Prompts generated successfully!', 'success');
            } else {
                app.showAlert('Generation failed: ' + result.error, 'danger');
            }
        } catch (e) {
            app.showAlert('Network error during generation', 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Prompts';
            app.hideLoading();
        }
    },

    showPreview: function(data) {
        document.getElementById('create-preview-section').classList.remove('d-none');
        document.getElementById('create-title').value = data.title;
        
        const list = document.getElementById('create-prompts-list');
        list.innerHTML = '';

        data.prompts.forEach((p, idx) => {
            list.insertAdjacentHTML('beforeend', `
                <div class="list-group-item">
                    <div class="mb-2">
                        <strong>Q${idx + 1}:</strong>
                        <textarea class="form-control mt-1 prompt-edit-text" data-idx="${idx}" rows="2">${p.prompt}</textarea>
                    </div>
                    <div class="small">
                        <strong>Tests:</strong> 
                        <input type="text" class="form-control form-control-sm prompt-edit-tests" data-idx="${idx}" value="${p.tested_requirements}">
                    </div>
                </div>
            `);
        });
        
        // Scroll to preview
        document.getElementById('create-preview-section').scrollIntoView({behavior: 'smooth'});
    },

    hidePreview: function() {
        document.getElementById('create-preview-section').classList.add('d-none');
        this.currentGeneratedData = null;
    },

    saveTemplate: async function() {
        if (!this.currentGeneratedData) return;

        // Collect edited values
        const title = document.getElementById('create-title').value.trim();
        if (!title) {
            app.showAlert('Please provide a title.', 'warning');
            return;
        }

        this.currentGeneratedData.title = title;

        document.querySelectorAll('.prompt-edit-text').forEach(ta => {
            const idx = parseInt(ta.dataset.idx);
            this.currentGeneratedData.prompts[idx].prompt = ta.value;
        });

        document.querySelectorAll('.prompt-edit-tests').forEach(inp => {
            const idx = parseInt(inp.dataset.idx);
            this.currentGeneratedData.prompts[idx].tested_requirements = inp.value;
        });

        const btn = document.getElementById('btn-save-template');
        btn.disabled = true;
        app.showLoading('Saving template...');

        try {
            const res = await fetch('/api/tests.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.currentGeneratedData)
            });
            const result = await res.json();

            if (result.success) {
                app.showAlert('Template saved successfully!', 'success');
                // Reset form and UI
                document.getElementById('form-create-test').reset();
                this.hidePreview();
                // Switch to grid
                app.switchTab('grid');
            } else {
                app.showAlert('Failed to save: ' + result.error, 'danger');
            }
        } catch (e) {
            app.showAlert('Network error while saving', 'danger');
        } finally {
            btn.disabled = false;
            app.hideLoading();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    createApp.init();
});
