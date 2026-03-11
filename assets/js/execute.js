// assets/js/execute.js

window.executeApp = {
    init: async function() {
        this.bindEvents();
        await this.loadTemplates();
        app.applyPreset('standard'); // Default
    },

    bindEvents: function() {
        const form = document.getElementById('form-execute');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.runTest();
        });
    },

    loadTemplates: async function() {
        const select = document.getElementById('exec-template');
        // Prevent clearing the default option entirely if we're just refreshing
        const originalValue = select.value;
        try {
            select.innerHTML = '<option value="">Loading templates...</option>';
            const res = await fetch('/api/tests.php');
            
            if (!res.ok) {
                throw new Error(`HTTP Error: ${res.status}`);
            }
            
            const data = await res.json();
            
            if (data.success) {
                if (data.data.length === 0) {
                    select.innerHTML = '<option value="">No templates found</option>';
                    return;
                }
                select.innerHTML = '<option value="">Select a template...</option>';
                data.data.forEach(t => {
                    select.insertAdjacentHTML('beforeend', `<option value="${t.filename}">${app.escapeHtml(t.title)} (${t.prompts_count} prompts)</option>`);
                });
                // Restore selection if it existed
                if (originalValue && Array.from(select.options).some(opt => opt.value === originalValue)) {
                    select.value = originalValue;
                }
            } else {
                 select.innerHTML = '<option value="">Error: ' + app.escapeHtml(data.error) + '</option>';
                 app.showAlert('Error loading templates: ' + data.error, 'danger');
            }
        } catch (e) {
            console.error('Error in loadTemplates:', e);
            select.innerHTML = '<option value="">Error loading templates</option>';
            app.showAlert('Network error loading test templates.', 'danger');
        }
    },

    runTest: async function() {
        const template = document.getElementById('exec-template').value;
        const targetModel = document.getElementById('exec-target-model').value.trim();
        const summarizer = document.getElementById('exec-summarizer').value.trim();
        
        const evaluators = [];
        for (let i = 1; i <= 4; i++) {
            const val = document.getElementById(`exec-eval-${i}`).value.trim();
            if (val) evaluators.push(val);
        }

        if (!template || !targetModel || !summarizer || evaluators.length === 0) {
            app.showAlert('Please select a template, target model, summarizer, and at least one evaluator.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-run-test');
        btn.disabled = true;
        
        const panel = document.getElementById('exec-progress-panel');
        const resultsPanel = document.getElementById('exec-results-panel');
        const progressBar = document.getElementById('exec-progress-bar');
        const statusText = document.getElementById('exec-status-text');
        const logBox = document.getElementById('exec-log');

        panel.classList.remove('d-none');
        resultsPanel.classList.add('d-none');
        resultsPanel.innerHTML = '';
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        logBox.innerHTML = '';

        const logMsg = (msg) => {
            const d = new Date().toLocaleTimeString();
            logBox.insertAdjacentHTML('beforeend', `<div><span class="text-secondary">[${d}]</span> ${msg}</div>`);
            logBox.scrollTop = logBox.scrollHeight;
            statusText.textContent = msg;
        };

        const payload = { template, target_model: targetModel, evaluators, summarizer };

        try {
            const response = await fetch('/api/execute.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last incomplete line in buffer
                buffer = lines.pop() || '';

                for (let line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.error) {
                                logMsg(`<span class="text-danger">Error: ${data.error}</span>`);
                                app.showAlert(data.error, 'danger');
                                break;
                            }

                            logMsg(data.status || JSON.stringify(data));

                            if (data.phase === 'testing' && data.total) {
                                const p = (data.step / data.total) * 40; // max 40%
                                progressBar.style.width = p + '%';
                                progressBar.textContent = Math.round(p) + '%';
                            } else if (data.phase === 'evaluating' && data.total) {
                                const p = 40 + (data.step / data.total) * 40; // 40-80%
                                progressBar.style.width = p + '%';
                                progressBar.textContent = Math.round(p) + '%';
                            } else if (data.phase === 'summarizing') {
                                progressBar.style.width = '90%';
                                progressBar.textContent = '90%';
                            } else if (data.phase === 'complete') {
                                progressBar.style.width = '100%';
                                progressBar.textContent = '100%';
                                progressBar.classList.remove('progress-bar-animated');
                                progressBar.classList.replace('bg-info', 'bg-success');
                                
                                setTimeout(() => {
                                    panel.classList.add('d-none');
                                    this.loadResultReport(data.result_file);
                                }, 1000);
                            }

                        } catch(e) {}
                    }
                }
            }
        } catch (e) {
            logMsg(`<span class="text-danger">Connection Error: ${e.message}</span>`);
            app.showAlert('Execution failed to complete.', 'danger');
        } finally {
            btn.disabled = false;
        }
    },

    loadResultReport: async function(filename) {
        try {
            app.showLoading('Loading final report...');
            const panel = document.getElementById('exec-results-panel');
            panel.innerHTML = '';
            panel.classList.remove('d-none');

            // Fetch test QA pairs
            const testRes = await fetch(`/api/results.php?file=${filename.replace('results/', 'tests/')}`); 
            // Wait, api/results.php handles tests/? No, api/results.php is for results/.
            // I need to fetch both or just modify results.php to fetch the test too, 
            // actually I can just fetch the result and the test via fetch directly since it's static.
            
            const reqRes = await fetch(`/results/${filename}.json`);
            const reqData = await reqRes.json();
            
            const testFileRes = await fetch(`/tests/${filename}.json`);
            const testData = await testFileRes.json();

            this.renderReport(testData, reqData);

        } catch (e) {
            app.showAlert('Error loading report data', 'danger');
        } finally {
            app.hideLoading();
        }
    },

    renderReport: function(testData, resultData) {
        const panel = document.getElementById('exec-results-panel');
        const summary = resultData.summary;

        const getBadgeClass = (score) => score >= 8 ? 'score-high' : (score >= 5 ? 'score-medium' : 'score-low');

        let html = `
            <div class="card shadow-sm mb-4 border-success">
                <div class="card-header bg-success text-white d-flex justify-content-between align-items-center">
                    <h4 class="m-0">Final Report: ${testData.model}</h4>
                    <span class="fs-4 fw-bold">Score: ${summary.final_score || 'N/A'} / 10</span>
                </div>
                <div class="card-body bg-light">
                    <div class="mb-3">
                        <h6 class="fw-bold text-success">Overall Assessment</h6>
                        <p>${this.formatText(summary.overall_assessment || 'N/A')}</p>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <h6 class="fw-bold text-primary">Strengths</h6>
                            <ul>${(summary.strengths || []).map(s => `<li>${s}</li>`).join('')}</ul>
                        </div>
                        <div class="col-md-6">
                            <h6 class="fw-bold text-danger">Weaknesses</h6>
                            <ul>${(summary.weaknesses || []).map(w => `<li>${w}</li>`).join('')}</ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <h4 class="mb-3">Detailed Q&A Evaluations</h4>
            <div class="accordion" id="report-accordion">
        `;

        testData.qa_pairs.forEach((qa, idx) => {
            const qId = qa.id || (idx + 1);
            
            // Find consensus
            const cons = (summary.per_question_consensus || []).find(c => c.id == qId);
            const consText = cons ? cons.consensus_comment : 'No consensus available';
            const consAvg = cons ? cons.average_score : '?';

            // Find evaluator scores for this question
            let evalHtml = '';
            resultData.evaluations.forEach(ev => {
                if (ev.status === 'error') {
                    evalHtml += `<div class="alert alert-danger py-1 mb-1 small">${ev.evaluator_model}: Error - ${ev.error}</div>`;
                    return;
                }
                const scoreObj = (ev.data.scores || []).find(s => s.id == qId);
                if (scoreObj) {
                    evalHtml += `
                        <div class="d-flex mb-2 align-items-start border-bottom pb-2">
                            <span class="score-badge ${getBadgeClass(scoreObj.score)} me-2 flex-shrink-0">${scoreObj.score}</span>
                            <div>
                                <div class="fw-bold small text-muted">${ev.evaluator_model}</div>
                                <div class="small">${scoreObj.comment}</div>
                            </div>
                        </div>
                    `;
                }
            });

            html += `
                <div class="accordion-item mb-2 shadow-sm border">
                    <h2 class="accordion-header" id="repHead${qId}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#repCol${qId}">
                            <div class="d-flex w-100 justify-content-between align-items-center pe-3">
                                <span><strong>Q${qId}:</strong> ${app.truncate(qa.prompt, 50)}</span>
                                <span class="badge bg-secondary">Avg: ${consAvg}</span>
                            </div>
                        </button>
                    </h2>
                    <div id="repCol${qId}" class="accordion-collapse collapse" data-bs-parent="#report-accordion">
                        <div class="accordion-body">
                            <div class="row">
                                <div class="col-lg-7">
                                    <h6 class="fw-bold">Prompt:</h6>
                                    <div class="bg-light p-2 rounded mb-3 small" style="white-space: pre-wrap;">${app.escapeHtml(qa.prompt)}</div>
                                    <h6 class="fw-bold">Response:</h6>
                                    <div class="bg-light p-2 rounded small" style="white-space: pre-wrap; max-height: 400px; overflow-y: auto;">${app.escapeHtml(qa.response)}</div>
                                </div>
                                <div class="col-lg-5 border-start">
                                    <div class="mb-3 bg-light border p-2 rounded">
                                        <h6 class="fw-bold text-success mb-1">Consensus:</h6>
                                        <div class="small">${consText}</div>
                                    </div>
                                    <h6 class="fw-bold mb-2">Evaluator Scores:</h6>
                                    ${evalHtml || '<div class="text-muted small">No individual scores.</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        panel.innerHTML = html;
        
        // Ensure scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    formatText: function(text) {
        return app.escapeHtml(text).replace(/\n/g, '<br>');
    }
};

window.executeApp.escapeHtml = function(unsafe) {
    if (!unsafe) return '';
    return (unsafe+'')
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};
