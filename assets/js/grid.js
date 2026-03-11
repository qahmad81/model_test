// assets/js/grid.js

window.gridApp = {
    loadData: async function() {
        try {
            app.showLoading('Loading templates...');
            const res = await fetch('/api/tests.php');
            const data = await res.json();
            
            if (data.success) {
                this.renderTable(data.data);
            } else {
                app.showAlert('Failed to load templates: ' + data.error, 'danger');
            }
        } catch (e) {
            app.showAlert('Error loading templates', 'danger');
        } finally {
            app.hideLoading();
        }
    },

    renderTable: function(templates) {
        const tbody = document.querySelector('#tests-table tbody');
        if (templates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No test templates found. Create one to get started!</td></tr>';
            return;
        }

        let html = '';
        templates.forEach(t => {
            html += `
                <tr>
                    <td class="align-middle fw-medium">${this.escapeHtml(t.title)}</td>
                    <td class="align-middle"><span class="badge bg-secondary">${t.prompts_count}</span></td>
                    <td class="align-middle">
                        ${t.runs_count > 0 ? 
                            `<button class="btn btn-sm btn-outline-info" onclick="gridApp.showRuns('${t.filename}')">${t.runs_count} Run(s)</button>` : 
                            `<span class="text-muted small">0</span>`
                        }
                    </td>
                    <td class="align-middle text-muted small">${app.formatDate(t.created_at)}</td>
                    <td class="align-middle text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="gridApp.viewTemplate('${t.filename}')" title="View"><i class="fa-solid fa-eye"></i></button>
                            <button class="btn btn-outline-success" onclick="gridApp.executeTemplate('${t.filename}')" title="Execute Test"><i class="fa-solid fa-play"></i></button>
                            <button class="btn btn-outline-danger" onclick="gridApp.deleteTemplate('${t.filename}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    },

    viewTemplate: async function(filename) {
        try {
            app.showLoading('Loading template details...');
            const res = await fetch(`/api/tests.php?id=${filename}`);
            const data = await res.json();
            
            if (data.success) {
                const t = data.data;
                document.getElementById('view-template-title').textContent = t.title;
                document.getElementById('view-template-reqs').textContent = t.requirements || 'N/A';
                document.getElementById('view-template-angles').textContent = t.evaluation_angles || 'N/A';
                
                let promptsHtml = '';
                if (t.prompts && t.prompts.length > 0) {
                    t.prompts.forEach((p, idx) => {
                        promptsHtml += `
                            <div class="accordion-item">
                                <h2 class="accordion-header" id="heading${idx}">
                                    <button class="accordion-button collapsed py-2" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${idx}">
                                        Q${p.id || (idx+1)}: ${this.truncate(p.prompt, 60)}
                                    </button>
                                </h2>
                                <div id="collapse${idx}" class="accordion-collapse collapse" data-bs-parent="#view-template-prompts">
                                    <div class="accordion-body bg-light">
                                        <div class="mb-2"><strong>Prompt:</strong><br>${this.escapeHtml(p.prompt)}</div>
                                        <div class="small text-muted"><strong>Tests:</strong> ${this.escapeHtml(p.tested_requirements)}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    promptsHtml = '<div class="alert alert-warning">No prompts found.</div>';
                }
                document.getElementById('view-template-prompts').innerHTML = promptsHtml;
                
                // Update execute button
                const btnExec = document.getElementById('btn-execute-from-view');
                btnExec.onclick = () => {
                    bootstrap.Modal.getInstance(document.getElementById('viewTemplateModal')).hide();
                    this.executeTemplate(filename);
                };

                const modal = new bootstrap.Modal(document.getElementById('viewTemplateModal'));
                modal.show();
            } else {
                app.showAlert('Error loading template', 'danger');
            }
        } catch (e) {
            app.showAlert('Network error', 'danger');
        } finally {
            app.hideLoading();
        }
    },

    executeTemplate: function(filename) {
        // Prepare execute tab
        app.switchTab('execute');
        // Will be picked up by execute.js init
        setTimeout(() => {
            const select = document.getElementById('exec-template');
            if (select) {
                select.value = filename;
            }
        }, 500);
    },

    deleteTemplate: async function(filename) {
        if (!confirm('Are you sure you want to delete this test template?')) return;
        
        try {
            app.showLoading('Deleting...');
            const res = await fetch(`/api/tests.php?id=${filename}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                app.showAlert('Template deleted successfully', 'success');
                this.loadData();
            } else {
                app.showAlert('Failed to delete: ' + data.error, 'danger');
            }
        } catch (e) {
            app.showAlert('Network error', 'danger');
        } finally {
            app.hideLoading();
        }
    },

    showRuns: async function(templateFilename) {
        try {
            app.showLoading('Loading runs...');
            const res = await fetch(`/api/results.php?template=${templateFilename}`);
            const data = await res.json();
            
            if (data.success) {
                const list = document.getElementById('runs-list');
                if (data.data.length === 0) {
                    list.innerHTML = '<div class="alert alert-info">No runs found for this template.</div>';
                } else {
                    let html = '';
                    data.data.forEach(run => {
                        const finalScore = run.summary?.final_score || 'N/A';
                        const badgeClass = finalScore >= 8 ? 'bg-success' : (finalScore >= 5 ? 'bg-warning' : 'bg-danger');
                        html += `
                            <a href="#" class="list-group-item list-group-item-action run-row d-flex justify-content-between align-items-center" onclick="gridApp.viewRunReport('${run.filename}'); return false;">
                                <div>
                                    <h6 class="mb-1">${run.model}</h6>
                                    <small class="text-muted">${app.formatDate(run.created_at)}</small>
                                </div>
                                <span class="badge ${badgeClass} rounded-pill fs-6">${finalScore} / 10</span>
                            </a>
                        `;
                    });
                    list.innerHTML = html;
                }
                const modal = new bootstrap.Modal(document.getElementById('runsModal'));
                modal.show();
            }
        } catch (e) {
            app.showAlert('Network error loading runs', 'danger');
        } finally {
            app.hideLoading();
        }
    },

    viewRunReport: function(resultFilename) {
        bootstrap.Modal.getInstance(document.getElementById('runsModal')).hide();
        app.switchTab('execute');
        setTimeout(() => {
            if (window.executeApp) {
                window.executeApp.loadResultReport(resultFilename);
            }
        }, 300);
    },

    escapeHtml: function(unsafe) {
        if (!unsafe) return '';
        return (unsafe+'')
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    },

    truncate: function(str, n) {
        return (str.length > n) ? str.slice(0, n-1) + '&hellip;' : str;
    }
};
