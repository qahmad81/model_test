// assets/js/autocomplete.js

class ModelAutocomplete {
    constructor(inputElement, options = {}) {
        this.input = typeof inputElement === 'string' ? document.querySelector(inputElement) : inputElement;
        if (!this.input) return;

        this.input.autocompleter = this; // Attach to DOM element
        
        this.options = Object.assign({
            maxResults: 20,
            debounceTime: 150,
            onSelect: null
        }, options);

        this.wrapper = document.createElement('div');
        this.wrapper.className = 'autocomplete-wrapper';
        this.input.parentNode.insertBefore(this.wrapper, this.input);
        this.wrapper.appendChild(this.input);

        this.dropdown = document.createElement('div');
        this.dropdown.className = 'autocomplete-dropdown';
        this.wrapper.appendChild(this.dropdown);

        this.debounceTimer = null;
        this.currentFocus = -1;
        this.matches = [];

        this.bindEvents();
    }

    bindEvents() {
        this.input.addEventListener('input', (e) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.search(this.input.value);
            }, this.options.debounceTime);
        });

        this.input.addEventListener('keydown', (e) => {
            if (!this.dropdown.classList.contains('show')) return;

            const items = this.dropdown.querySelectorAll('.autocomplete-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.currentFocus++;
                if (this.currentFocus >= items.length) this.currentFocus = 0;
                this.makeActive(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.currentFocus--;
                if (this.currentFocus < 0) this.currentFocus = items.length - 1;
                this.makeActive(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.currentFocus > -1) {
                    items[this.currentFocus].click();
                } else if (items.length === 1) {
                    items[0].click();
                }
            } else if (e.key === 'Escape') {
                this.closeList();
            }
        });

        this.input.addEventListener('focus', () => {
            if (this.input.value.length > 0) {
                this.search(this.input.value);
            } else {
                // Show default/popular or all if empty
                this.search('');
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target !== this.input && e.target !== this.dropdown) {
                this.closeList();
            }
        });
    }

    search(query) {
        const val = query.toLowerCase().trim();
        this.closeList();
        
        if (!window.modelsCache || window.modelsCache.length === 0) return;

        let filtered = window.modelsCache;
        if (val) {
            filtered = window.modelsCache.filter(m => 
                m.id.toLowerCase().includes(val) || 
                m.name.toLowerCase().includes(val)
            );
        }

        // Sort: exact matches or starts-with first, then by context length or id
        if (val) {
            filtered.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aId = a.id.toLowerCase();
                const bId = b.id.toLowerCase();
                
                const aStartsName = aName.startsWith(val) ? 1 : 0;
                const bStartsName = bName.startsWith(val) ? 1 : 0;
                const aStartsId = aId.startsWith(val) ? 1 : 0;
                const bStartsId = bId.startsWith(val) ? 1 : 0;
                
                const scoreA = aStartsName * 2 + aStartsId;
                const scoreB = bStartsName * 2 + bStartsId;
                
                if (scoreA !== scoreB) return scoreB - scoreA;
                return a.id.localeCompare(b.id);
            });
        }

        this.matches = filtered.slice(0, this.options.maxResults);

        if (this.matches.length === 0) {
            const noRes = document.createElement('div');
            noRes.className = 'autocomplete-item text-muted';
            noRes.innerHTML = 'No models found';
            this.dropdown.appendChild(noRes);
        } else {
            this.matches.forEach((model, index) => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                
                let pPrompt = parseFloat(model.pricing?.prompt || 0) * 1000000;
                let pComp = parseFloat(model.pricing?.completion || 0) * 1000000;
                let priceStr = pPrompt === 0 && pComp === 0 ? '<span class="badge bg-success">Free</span>' : 
                    `<small class="text-muted">$${pPrompt.toFixed(2)} / $${pComp.toFixed(2)} per 1M</small>`;
                
                item.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="model-name">${this.highlight(model.name, val)}</span>
                        ${priceStr}
                    </div>
                    <span class="model-id">${this.highlight(model.id, val)}</span>
                `;

                item.addEventListener('click', () => {
                    this.input.value = model.id;
                    this.closeList();
                    if (typeof this.options.onSelect === 'function') {
                        this.options.onSelect(model);
                    }
                    // trigger change event
                    this.input.dispatchEvent(new Event('change'));
                });
                
                this.dropdown.appendChild(item);
            });
        }

        this.dropdown.classList.add('show');
    }

    highlight(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    makeActive(items) {
        items.forEach(item => item.classList.remove('active'));
        if (this.currentFocus >= items.length) this.currentFocus = 0;
        if (this.currentFocus < 0) this.currentFocus = (items.length - 1);
        items[this.currentFocus].classList.add('active');
        items[this.currentFocus].scrollIntoView({ block: 'nearest' });
    }

    closeList() {
        this.dropdown.innerHTML = '';
        this.dropdown.classList.remove('show');
        this.currentFocus = -1;
    }

    setValue(modelId) {
        this.input.value = modelId;
        this.input.dispatchEvent(new Event('change'));
    }

    getValue() {
        return this.input.value;
    }
}