/* =============================================================================
   Liquid Elegance — Wizard App Logic
   ============================================================================= */

/* ---------------------------------------------------------------------------
   Event API (available before DOMContentLoaded)
   --------------------------------------------------------------------------- */
window.LiquidElegance = window.LiquidElegance || {};
LiquidElegance.Wizard = {
    _handlers: {},
    on(event, fn) { (this._handlers[event] = this._handlers[event] || []).push(fn); return this; },
    off(event, fn) { this._handlers[event] = (this._handlers[event] || []).filter(h => h !== fn); return this; },
    once(event, fn) { const wrap = (data) => { this.off(event, wrap); fn(data); }; return this.on(event, wrap); },
    emit(event, data) {
        (this._handlers[event] || []).forEach(fn => fn(data));
        return this;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    if (typeof feather !== 'undefined') feather.replace();

    const emit = LiquidElegance.Wizard.emit.bind(LiquidElegance.Wizard);

    let currentStep = 1;
    const totalSteps = 4;
    let memberCount = 3;

    const stepEls = [null, document.getElementById('step1'), document.getElementById('step2'), document.getElementById('step3'), document.getElementById('step4')];
    const indicators = document.querySelectorAll('.wizard-step-indicator');
    const progressLine = document.getElementById('progressLine');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const stepInfo = document.getElementById('stepInfo');
    const wizardNav = document.getElementById('wizardNav');
    const successState = document.getElementById('successState');

    /* -- internal utilities ------------------------------------------------ */

    function getStepLabel(step) {
        const ind = indicators[step - 1];
        if (!ind) return '';
        const lbl = ind.querySelector('.step-label');
        return lbl ? lbl.textContent.trim() : '';
    }

    /* -- context-menu utility --------------------------------------------- */

    function createContextMenu(x, y, items) {
        closeContextMenu();
        const menu = document.createElement('div');
        menu.className = 'wizard-ctx-menu';
        Object.assign(menu.style, {
            position: 'fixed',
            left: x + 'px',
            top: y + 'px',
            background: 'var(--le-glass-bg-strong)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--le-glass-border)',
            borderRadius: 'var(--le-radius-md)',
            boxShadow: 'var(--le-shadow-xl)',
            padding: '0.25rem 0',
            minWidth: '180px',
            zIndex: '10000'
        });

        items.forEach(item => {
            if (item.type === 'header') {
                const h = document.createElement('div');
                Object.assign(h.style, {
                    padding: '0.5rem 0.75rem',
                    fontWeight: '600',
                    fontSize: '0.75rem',
                    color: 'var(--le-text-secondary)'
                });
                h.textContent = item.text;
                menu.appendChild(h);
            } else if (item.type === 'separator') {
                const s = document.createElement('div');
                Object.assign(s.style, {
                    height: '1px',
                    background: 'var(--le-glass-border)',
                    margin: '0.25rem 0'
                });
                menu.appendChild(s);
            } else if (item.type === 'item') {
                const row = document.createElement('div');
                Object.assign(row.style, {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    borderRadius: 'var(--le-radius)',
                    margin: '0 0.25rem',
                    transition: 'background .15s'
                });
                if (item.disabled) {
                    row.style.opacity = '0.4';
                    row.style.pointerEvents = 'none';
                }
                if (item.className) row.className = item.className;
                if (item.icon) {
                    const ico = document.createElement('i');
                    ico.setAttribute('data-feather', item.icon);
                    ico.style.width = '14px';
                    ico.style.height = '14px';
                    row.appendChild(ico);
                }
                const span = document.createElement('span');
                span.textContent = item.text;
                row.appendChild(span);
                row.addEventListener('mouseenter', () => { if (!item.disabled) row.style.background = 'rgba(var(--le-primary-rgb), 0.1)'; });
                row.addEventListener('mouseleave', () => { row.style.background = ''; });
                row.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeContextMenu();
                    if (item.action) item.action();
                });
                menu.appendChild(row);
            }
        });

        document.body.appendChild(menu);

        // Keep within viewport
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';

        if (typeof feather !== 'undefined') feather.replace();

        // Close listeners
        const onClickAway = () => closeContextMenu();
        const onEsc = (e) => { if (e.key === 'Escape') closeContextMenu(); };
        setTimeout(() => {
            document.addEventListener('click', onClickAway, { once: true });
            document.addEventListener('keydown', onEsc, { once: true });
        }, 0);

        menu._cleanup = () => {
            document.removeEventListener('click', onClickAway);
            document.removeEventListener('keydown', onEsc);
        };
        return menu;
    }

    function closeContextMenu() {
        const old = document.querySelector('.wizard-ctx-menu');
        if (old) {
            if (old._cleanup) old._cleanup();
            old.remove();
        }
        document.querySelectorAll('.ctx-active').forEach(el => el.classList.remove('ctx-active'));
    }

    /* -- step indicator context-menu -------------------------------------- */

    indicators.forEach((ind, idx) => {
        ind.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const step = idx + 1;
            const label = getStepLabel(step);
            const canGo = step <= currentStep + 1;

            const formGroup = ind.closest('.form-group');
            if (formGroup) formGroup.classList.add('ctx-active');

            createContextMenu(e.clientX, e.clientY, [
                { type: 'header', text: `Step ${step}: ${label}` },
                { type: 'separator' },
                {
                    type: 'item', icon: 'arrow-right', text: 'Go to Step',
                    disabled: !canGo,
                    action() {
                        emit('step:goto', { step, label });
                        window.goToStep(step);
                    }
                },
                {
                    type: 'item', icon: 'check', text: 'Mark Complete',
                    action() {
                        emit('step:complete', { step, label });
                        ind.classList.remove('active');
                        ind.classList.add('done');
                        const circle = ind.querySelector('.step-circle');
                        circle.classList.remove('current', 'upcoming');
                        circle.classList.add('completed');
                        circle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                    }
                },
                {
                    type: 'item', icon: 'rotate-ccw', text: 'Reset Step',
                    action() {
                        emit('step:reset', { step, label });
                        ind.classList.remove('active', 'done');
                        const circle = ind.querySelector('.step-circle');
                        circle.classList.remove('current', 'completed');
                        circle.classList.add('upcoming');
                        circle.textContent = step;
                    }
                }
            ]);
        });
    });

    /* -- core UI ---------------------------------------------------------- */

    function updateUI() {
        // Step content
        for (let i = 1; i <= totalSteps; i++) {
            stepEls[i].classList.toggle('active', i === currentStep);
        }
        // Indicators
        indicators.forEach((ind, idx) => {
            const s = idx + 1;
            const circle = ind.querySelector('.step-circle');
            ind.classList.remove('active', 'done');
            circle.classList.remove('current', 'completed', 'upcoming');
            if (s < currentStep) {
                ind.classList.add('done');
                circle.classList.add('completed');
                circle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            } else if (s === currentStep) {
                ind.classList.add('active');
                circle.classList.add('current');
                circle.textContent = s;
            } else {
                circle.classList.add('upcoming');
                circle.textContent = s;
            }
        });
        // Progress line
        const pct = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressLine.style.width = pct + '%';
        // Buttons
        prevBtn.style.display = currentStep === 1 ? 'none' : '';
        if (currentStep === totalSteps) {
            nextBtn.textContent = 'Launch Project';
            nextBtn.className = 'btn-wizard-launch';
        } else {
            nextBtn.textContent = 'Next';
            nextBtn.className = 'btn-wizard-next';
        }
        stepInfo.textContent = `Step ${currentStep} of ${totalSteps}`;
        if (typeof feather !== 'undefined') feather.replace();
    }

    function validate(step) {
        const errors = [];
        let valid = true;

        if (step === 1) {
            const name = document.getElementById('projectName');
            const err = document.getElementById('projectNameError');
            if (!name.value.trim()) {
                name.classList.add('error');
                err.classList.add('visible');
                name.focus();
                errors.push('Project name is required');
                valid = false;
            } else {
                name.classList.remove('error');
                err.classList.remove('visible');
            }
        }
        if (step === 2) {
            const members = document.querySelectorAll('#teamMembers .team-member-row');
            const err = document.getElementById('teamError');
            if (members.length === 0) {
                err.classList.add('visible');
                errors.push('At least one team member is required');
                valid = false;
            } else {
                err.classList.remove('visible');
            }
        }
        if (step === 4) {
            const cb = document.getElementById('termsCheckbox');
            const err = document.getElementById('termsError');
            if (!cb.checked) {
                err.classList.add('visible');
                errors.push('Terms must be accepted');
                valid = false;
            } else {
                err.classList.remove('visible');
            }
        }

        emit('step:validate', { step, valid, errors });
        return valid;
    }

    function populateReview() {
        const name = document.getElementById('projectName').value || 'Untitled';
        const desc = document.getElementById('projectDesc').value || 'No description';
        const cat = document.getElementById('projectCategory').value;
        const priority = document.querySelector('input[name="priority"]:checked')?.value || 'Medium';
        const startDate = document.getElementById('projectStartDate').value || 'Not set';
        const duration = document.getElementById('projectDuration').value;
        const members = [];
        document.querySelectorAll('#teamMembers .team-member-row').forEach(row => {
            const n = row.querySelector('.member-name')?.textContent || row.querySelector('.glass-input')?.value || 'Unknown';
            const r = row.querySelector('.member-role-select').value;
            members.push(`${n} (${r})`);
        });
        const visibility = document.querySelector('input[name="visibility"]:checked')?.value || 'Private';
        const toggles = [];
        document.querySelectorAll('[data-toggle]').forEach(t => {
            if (t.checked) {
                const labels = { cicd: 'CI/CD', codereview: 'Code Review', branchprotect: 'Branch Protection', autodeploy: 'Auto-deploy' };
                toggles.push(labels[t.dataset.toggle]);
            }
        });
        const integrations = [];
        document.querySelectorAll('#integrationGrid input:checked').forEach(i => integrations.push(i.value));
        const notifications = [];
        document.querySelectorAll('#notifCheckboxes input:checked').forEach(i => notifications.push(i.value));

        document.getElementById('reviewSummary').innerHTML = `
            <div class="review-section">
                <div class="review-section-header"><h6>Project Details</h6><button class="review-edit-link" onclick="goToStep(1)">Edit</button></div>
                <div class="review-grid">
                    <span class="review-label">Name</span><span class="review-value">${name}</span>
                    <span class="review-label">Description</span><span class="review-value">${desc}</span>
                    <span class="review-label">Category</span><span class="review-value">${cat}</span>
                    <span class="review-label">Priority</span><span class="review-value">${priority}</span>
                    <span class="review-label">Start Date</span><span class="review-value">${startDate}</span>
                    <span class="review-label">Duration</span><span class="review-value">${duration}</span>
                </div>
            </div>
            <div class="glass-divider"></div>
            <div class="review-section">
                <div class="review-section-header"><h6>Team</h6><button class="review-edit-link" onclick="goToStep(2)">Edit</button></div>
                <div class="review-grid">
                    <span class="review-label">Team Size</span><span class="review-value">${members.length} members</span>
                    <span class="review-label">Members</span><span class="review-value">${members.join(', ')}</span>
                    <span class="review-label">Visibility</span><span class="review-value">${visibility}</span>
                </div>
            </div>
            <div class="glass-divider"></div>
            <div class="review-section">
                <div class="review-section-header"><h6>Configuration</h6><button class="review-edit-link" onclick="goToStep(3)">Edit</button></div>
                <div class="review-grid">
                    <span class="review-label">Repo Settings</span><span class="review-value">${toggles.length > 0 ? toggles.join(', ') : 'None'}</span>
                    <span class="review-label">Integrations</span><div class="review-tags">${integrations.map(i => '<span class="review-tag">' + i + '</span>').join('') || '<span class="review-value">None</span>'}</div>
                    <span class="review-label">Notifications</span><span class="review-value">${notifications.length > 0 ? notifications.join(', ') : 'None'}</span>
                </div>
            </div>
        `;
    }

    window.goToStep = function(step) {
        const from = currentStep;
        currentStep = step;
        updateUI();
        if (step === 4) populateReview();
        emit('step:change', { from, to: step, stepName: getStepLabel(step) });
    };

    function showSuccess() {
        const projectName = document.getElementById('projectName').value || 'Untitled';
        const teamSize = document.querySelectorAll('#teamMembers .team-member-row').length;
        const integrations = [];
        document.querySelectorAll('#integrationGrid input:checked').forEach(i => integrations.push(i.value));

        stepEls.forEach((el, i) => { if (el) el.classList.remove('active'); });
        wizardNav.style.display = 'none';
        successState.classList.add('active');
        if (typeof feather !== 'undefined') feather.replace();

        emit('wizard:complete', { projectName, teamSize, integrations });

        // Confetti
        const container = successState;
        const colors = ['var(--le-primary)', 'var(--le-success)', 'var(--le-warning)', 'rgb(99,102,241)', 'var(--le-danger)'];
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'confetti-particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.bottom = '40%';
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.animationDelay = Math.random() * 0.5 + 's';
            p.style.animationDuration = (1.5 + Math.random()) + 's';
            container.appendChild(p);
        }
        setTimeout(() => {
            container.querySelectorAll('.confetti-particle').forEach(p => p.remove());
        }, 3500);
    }

    /* -- navigation ------------------------------------------------------- */

    nextBtn.addEventListener('click', () => {
        if (!validate(currentStep)) return;
        if (currentStep === totalSteps) {
            showSuccess();
            return;
        }
        const from = currentStep;
        currentStep++;
        if (currentStep === 4) populateReview();
        updateUI();
        emit('step:change', { from, to: currentStep, stepName: getStepLabel(currentStep) });
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            const from = currentStep;
            currentStep--;
            updateUI();
            emit('step:change', { from, to: currentStep, stepName: getStepLabel(currentStep) });
        }
    });

    /* -- field change delegation ------------------------------------------ */

    stepEls.forEach(el => {
        if (!el) return;
        el.addEventListener('change', (e) => {
            const t = e.target;
            if (t.matches('input, select, textarea')) {
                const field = t.name || t.id || t.className;
                const value = t.type === 'checkbox' ? t.checked : t.value;
                emit('field:change', { field, value });
            }
        });
    });

    /* -- priority pills --------------------------------------------------- */

    document.querySelectorAll('.priority-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.priority-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const radio = pill.querySelector('input[name="priority"]');
            const priority = radio ? radio.value : pill.textContent.trim();
            emit('priority:change', { priority });
        });
    });

    // Size picker
    document.querySelectorAll('.size-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.size-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });

    // Visibility
    document.querySelectorAll('.visibility-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.visibility-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });

    /* -- integration cards ------------------------------------------------ */

    document.querySelectorAll('.integration-card').forEach(card => {
        card.addEventListener('click', () => {
            const cb = card.querySelector('input');
            card.classList.toggle('active', cb.checked);
        });
        card.querySelector('input').addEventListener('change', function() {
            card.classList.toggle('active', this.checked);
            emit('integration:toggle', { name: this.value, enabled: this.checked });
        });
    });

    /* -- notification checkboxes ------------------------------------------ */

    document.querySelectorAll('.notif-check').forEach(nc => {
        nc.addEventListener('click', () => {
            const cb = nc.querySelector('input');
            nc.classList.toggle('active', cb.checked);
        });
        nc.querySelector('input').addEventListener('change', function() {
            nc.classList.toggle('active', this.checked);
        });
    });

    /* -- team members ----------------------------------------------------- */

    // Remove member
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-member');
        if (btn) {
            const row = btn.closest('.team-member-row');
            const index = row.dataset.member || Array.from(row.parentElement.children).indexOf(row);
            row.remove();
            emit('team:remove-member', { index: Number(index) });
        }
    });

    // Add member
    const avatarColors = [
        'linear-gradient(135deg,var(--le-warning),#d97706)',
        'linear-gradient(135deg,var(--le-danger),#dc2626)',
        'linear-gradient(135deg,var(--le-primary),#2563eb)',
        'linear-gradient(135deg,var(--le-success),#059669)',
    ];
    document.getElementById('addMemberBtn').addEventListener('click', () => {
        memberCount++;
        const row = document.createElement('div');
        row.className = 'team-member-row';
        row.dataset.member = memberCount;
        row.innerHTML = `
            <div class="member-avatar" style="background:${avatarColors[memberCount % avatarColors.length]};">?</div>
            <div class="member-info"><input type="text" class="glass-input" placeholder="Member name" style="padding:0.375rem 0.625rem;font-size:0.875rem;"></div>
            <select class="member-role-select"><option value="Owner">Owner</option><option value="Admin">Admin</option><option value="Member" selected>Member</option><option value="Viewer">Viewer</option></select>
            <button class="btn-remove-member" title="Remove"><i data-feather="x" style="width:16px;height:16px;"></i></button>
        `;
        document.getElementById('teamMembers').appendChild(row);
        if (typeof feather !== 'undefined') feather.replace();

        const nameInput = row.querySelector('.glass-input');
        const roleSelect = row.querySelector('.member-role-select');
        emit('team:add-member', { name: nameInput.value || '(unnamed)', role: roleSelect.value });
    });

    /* -- wizard reset (back from success to step 1) ----------------------- */

    successState.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-wizard-reset], .btn-wizard-next, .btn-wizard-launch, a[href]');
        if (btn && successState.classList.contains('active')) {
            const isReset = btn.hasAttribute('data-wizard-reset') ||
                            btn.textContent.trim().toLowerCase().includes('new project') ||
                            btn.textContent.trim().toLowerCase().includes('start over') ||
                            btn.textContent.trim().toLowerCase().includes('create another');
            if (isReset) {
                successState.classList.remove('active');
                wizardNav.style.display = '';
                currentStep = 1;
                updateUI();
                emit('wizard:reset');
            }
        }
    });

    // Init
    updateUI();
});

