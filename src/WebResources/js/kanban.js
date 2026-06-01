/* =============================================================================
   Liquid Elegance — Kanban App Logic
   ============================================================================= */

/* ── Event API ─────────────────────────────────────────────────────────────── */
window.LiquidElegance = window.LiquidElegance || {};
LiquidElegance.Kanban = {
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
    'use strict';

    if (typeof feather !== 'undefined') feather.replace();

    /* -- Mobile filter toggle --------------------------------------------- */
    var filterToggle = document.getElementById('kanbanFilterToggle');
    var headerRight = document.querySelector('.kanban-header-right');
    if (filterToggle && headerRight) {
        filterToggle.addEventListener('click', function() {
            headerRight.classList.toggle('show');
        });
    }

    var K = LiquidElegance.Kanban;

    /* ── Card data ─────────────────────────────────────────────────────────── */
    var cardData = {
        '1':  { title:'Research competitor pricing models', desc:'Analyze pricing strategies from top 5 competitors and prepare comparison matrix.', labels:['feature'], assignees:['LP'], due:'Jul 20', priority:'low', column:'Backlog', comments:2, attachments:0 },
        '2':  { title:'Set up staging environment', desc:'Configure Docker containers and CI/CD pipeline for staging deployment.', labels:['backend'], assignees:['JW'], due:'Jul 25', priority:'medium', column:'Backlog', comments:5, attachments:1 },
        '3':  { title:'Create brand style guide', desc:'Document colors, typography, and component guidelines for the new brand.', labels:['design'], assignees:['AB'], due:'Aug 1', priority:'low', column:'Backlog', comments:0, attachments:0 },
        '4':  { title:'Integrate analytics SDK', desc:'Add Mixpanel tracking for key user flows and funnel events.', labels:['feature','backend'], assignees:['SC'], due:'Aug 5', priority:'medium', column:'Backlog', comments:3, attachments:2 },
        '5':  { title:'Resolve payment gateway timeout', desc:'Stripe webhook failing after 30s \u2014 causing order confirmation delays.', labels:['urgent','bug'], assignees:['SC','JW'], due:'Jun 28', priority:'high', column:'To Do', comments:8, attachments:3 },
        '6':  { title:'Write API documentation', desc:'Document all REST endpoints with request/response examples using OpenAPI spec.', labels:['feature'], assignees:['MR'], due:'Jul 15', priority:'high', column:'To Do', comments:4, attachments:0 },
        '7':  { title:'Design new onboarding flow', desc:'Create wireframes and high-fidelity mockups for the 3-step onboarding wizard.', labels:['design'], assignees:['LP','AB'], due:'Jul 18', priority:'medium', column:'To Do', comments:6, attachments:5 },
        '8':  { title:'Optimize database queries', desc:'Slow queries on the orders table \u2014 add indexes and refactor N+1 calls.', labels:['backend'], assignees:['JW'], due:'Jul 22', priority:'medium', column:'To Do', comments:2, attachments:0 },
        '9':  { title:'Create email notification templates', desc:'Design responsive HTML templates for transactional emails.', labels:['design','feature'], assignees:['AB'], due:'Jul 30', priority:'low', column:'To Do', comments:1, attachments:0 },
        '10': { title:'Implement user authentication', desc:'Build JWT-based auth with social login (Google, GitHub) and 2FA support.', labels:['feature','urgent'], assignees:['SC','MR'], due:'Jul 5', priority:'high', column:'In Progress', comments:12, attachments:4 },
        '11': { title:'User testing round 3', desc:'Conduct usability tests with 8 participants on the checkout flow redesign.', labels:['design'], assignees:['LP'], due:'Jul 12', priority:'medium', column:'In Progress', comments:7, attachments:2 },
        '12': { title:'Resolve data export CSV encoding', desc:'UTF-8 characters breaking in exported CSV files for international users.', labels:['backend','bug'], assignees:['MR'], due:'Jul 10', priority:'medium', column:'In Progress', comments:3, attachments:0 },
        '13': { title:'Set up project repository', desc:'Initialize monorepo with Turborepo, configure ESLint, Prettier, and Husky hooks.', labels:['backend'], assignees:['JW'], due:'Jun 15', priority:'high', column:'Done', comments:4, attachments:1 },
        '14': { title:'Design landing page mockup', desc:'High-fidelity Figma mockup for the product launch landing page.', labels:['design'], assignees:['AB','LP'], due:'Jun 20', priority:'medium', column:'Done', comments:9, attachments:7 },
        '15': { title:'Configure CI/CD pipeline', desc:'GitHub Actions workflow for automated testing, building, and deployment.', labels:['feature'], assignees:['SC'], due:'Jun 25', priority:'low', column:'Done', comments:3, attachments:0 },
        '16': { title:'Resolve user session persistence', desc:'Sessions expiring prematurely due to Redis TTL misconfiguration.', labels:['bug','backend'], assignees:['MR','JW'], due:'Jun 30', priority:'medium', column:'Done', comments:6, attachments:2 }
    };

    var assigneeNames = {
        'SC': 'Sarah Chen', 'MR': 'Mike Ross', 'LP': 'Lisa Park',
        'JW': 'James Wu', 'AB': 'Anna Bell', 'JD': 'John Doe'
    };

    var assigneeColors = {
        'SC': 'linear-gradient(135deg,var(--le-primary),var(--le-secondary))',
        'MR': 'linear-gradient(135deg,var(--le-success),#059669)',
        'LP': 'linear-gradient(135deg,var(--le-warning),#d97706)',
        'JW': 'linear-gradient(135deg,var(--le-danger),#dc2626)',
        'AB': 'linear-gradient(135deg,var(--le-secondary),var(--le-primary))',
        'JD': 'linear-gradient(135deg,var(--le-primary),var(--le-secondary))'
    };

    var priorityMap = { high: '\uD83D\uDD34 High', medium: '\uD83D\uDFE1 Medium', low: '\uD83D\uDFE2 Low' };
    var columnNames = { backlog:'Backlog', todo:'To Do', inprogress:'In Progress', done:'Done' };
    var nextCardId = 17;

    /* ── Helpers ────────────────────────────────────────────────────────────── */
    function esc(s) { return s.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function getColumnName(col) {
        var t = col.querySelector('.kanban-col-title');
        return t ? t.textContent.trim() : (col.dataset.column || '');
    }

    function updateCounts() {
        document.querySelectorAll('.kanban-column').forEach(function(col) {
            var visibleCards = col.querySelectorAll('.kanban-card:not([style*="display: none"])');
            var countEl = col.querySelector('.kanban-col-count');
            if (countEl) countEl.textContent = visibleCards.length;
        });
    }

    /* ── Filter buttons ────────────────────────────────────────────────────── */
    document.querySelectorAll('.kanban-filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.kanban-filter-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            var filter = this.dataset.filter;
            document.querySelectorAll('.kanban-card').forEach(function(card) {
                if (filter === 'all') {
                    card.style.display = '';
                } else if (filter === 'my') {
                    var a = card.dataset.assignee || '';
                    card.style.display = a.indexOf('SC') !== -1 ? '' : 'none';
                } else if (filter === 'high') {
                    card.style.display = card.dataset.priority === 'high' ? '' : 'none';
                }
            });
            updateCounts();
            K.emit('filter:change', { filter: filter });
        });
    });

    /* ── Add card inline ───────────────────────────────────────────────────── */
    function createNewCardInput(cardList, columnKey) {
        var existing = cardList.querySelector('.kanban-new-card-wrap');
        if (existing) { existing.remove(); return; }

        var wrap = document.createElement('div');
        wrap.className = 'kanban-new-card-wrap';
        wrap.innerHTML = '<input type="text" class="kanban-new-card-input" placeholder="Enter card title..." autofocus>' +
            '<div class="kanban-new-card-actions">' +
            '<button class="kanban-new-card-save">Add</button>' +
            '<button class="kanban-new-card-cancel">Cancel</button>' +
            '</div>';
        cardList.appendChild(wrap);

        var input = wrap.querySelector('input');
        input.focus();

        function addCard() {
            var title = input.value.trim();
            if (!title) { wrap.remove(); return; }
            var id = String(nextCardId++);
            cardData[id] = { title: title, desc:'', labels:[], assignees:['JD'], due:'TBD', priority:'low', column: columnNames[columnKey] || columnKey, comments:0, attachments:0 };

            var card = document.createElement('div');
            card.className = 'glass-inner kanban-card';
            card.setAttribute('draggable', 'true');
            card.dataset.priority = 'low';
            card.dataset.assignee = 'JD';
            card.dataset.cardId = id;
            card.innerHTML = '<div class="kanban-drag-handle">\u22EE\u22EE</div>' +
                '<div class="kanban-card-inner">' +
                '<h4 class="kanban-card-title">' + esc(title) + '</h4>' +
                '<div class="kanban-card-footer">' +
                '<div class="kanban-card-assignees"><div class="kanban-card-assignee" style="background:' + assigneeColors['JD'] + '">JD</div></div>' +
                '<div class="kanban-card-meta"><span class="kanban-priority">\uD83D\uDFE2</span></div>' +
                '</div></div>';
            card.addEventListener('click', function(e) {
                if (!e.target.closest('.kanban-new-card-wrap')) openCardModal(id);
            });
            cardList.insertBefore(card, wrap);
            wrap.remove();
            updateCounts();
            K.emit('card:create', { id: id, title: title, column: columnNames[columnKey] || columnKey, priority: 'low' });
            if (typeof feather !== 'undefined') feather.replace();
        }

        wrap.querySelector('.kanban-new-card-save').addEventListener('click', addCard);
        wrap.querySelector('.kanban-new-card-cancel').addEventListener('click', function() { wrap.remove(); });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') addCard();
            if (e.key === 'Escape') wrap.remove();
        });
    }

    document.querySelectorAll('.kanban-add-card-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var col = this.closest('.kanban-column');
            createNewCardInput(col.querySelector('.kanban-card-list'), col.dataset.column);
        });
    });

    document.querySelectorAll('.add-card-top-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var col = this.closest('.kanban-column');
            createNewCardInput(col.querySelector('.kanban-card-list'), col.dataset.column);
        });
    });

    /* ── Card detail modal ─────────────────────────────────────────────────── */
    function openCardModal(cardId) {
        var data = cardData[cardId];
        if (!data) return;

        document.getElementById('modalCardTitle').textContent = data.title;
        document.getElementById('modalCardDesc').value = data.desc;
        document.getElementById('modalDueDate').textContent = data.due;
        document.getElementById('modalPriority').textContent = priorityMap[data.priority] || data.priority;
        document.getElementById('modalColumn').textContent = data.column;

        var labelsEl = document.getElementById('modalCardLabels');
        labelsEl.innerHTML = '';
        (data.labels || []).forEach(function(l) {
            var span = document.createElement('span');
            span.className = 'kanban-label kanban-label-' + l;
            span.textContent = l.charAt(0).toUpperCase() + l.slice(1);
            labelsEl.appendChild(span);
        });

        var assigneesEl = document.getElementById('modalAssignees');
        assigneesEl.innerHTML = '';
        (data.assignees || []).forEach(function(a) {
            var div = document.createElement('div');
            div.className = 'd-flex align-items-center gap-2';
            div.innerHTML = '<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.5625rem;font-weight:700;color:#fff;background:' + (assigneeColors[a] || assigneeColors['JD']) + ';">' + a + '</div>' +
                '<span style="font-size:0.8125rem;font-weight:600;">' + (assigneeNames[a] || a) + '</span>';
            assigneesEl.appendChild(div);
        });

        updateChecklistProgress();
        var modal = new bootstrap.Modal(document.getElementById('cardDetailModal'));
        modal.show();
    }

    function updateChecklistProgress() {
        var checks = document.querySelectorAll('#modalChecklist input[type="checkbox"]');
        var checked = document.querySelectorAll('#modalChecklist input[type="checkbox"]:checked');
        var pct = checks.length ? Math.round((checked.length / checks.length) * 100) : 0;
        document.getElementById('checklistProgress').style.width = pct + '%';
        checks.forEach(function(cb) {
            var item = cb.closest('.kanban-checklist-item');
            if (cb.checked) item.classList.add('checked');
            else item.classList.remove('checked');
        });
    }

    document.querySelectorAll('#modalChecklist input[type="checkbox"]').forEach(function(cb) {
        cb.addEventListener('change', updateChecklistProgress);
    });

    // Card click listeners
    document.querySelectorAll('.kanban-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.kanban-new-card-wrap')) return;
            openCardModal(this.dataset.cardId);
        });
    });

    /* ── Add Column ────────────────────────────────────────────────────────── */
    document.getElementById('addColumnBtn').addEventListener('click', function() {
        var name = prompt('Enter column name:');
        if (!name || !name.trim()) return;
        var key = name.trim().toLowerCase().replace(/\s+/g, '-');

        var col = document.createElement('div');
        col.className = 'kanban-column';
        col.dataset.column = key;
        col.innerHTML = '<div class="glass-card">' +
            '<div class="kanban-col-header">' +
            '<div class="kanban-col-dot" style="background:var(--le-primary);"></div>' +
            '<span class="kanban-col-title">' + esc(name.trim()) + '</span>' +
            '<span class="kanban-col-count">0</span>' +
            '<div class="kanban-col-actions"><button class="add-card-top-btn" title="Add card"><i data-feather="plus"></i></button><button title="More options"><i data-feather="more-horizontal"></i></button></div>' +
            '</div>' +
            '<div class="kanban-card-list"></div>' +
            '<div class="kanban-col-footer"><button class="kanban-add-card-btn" data-column="' + key + '"><i data-feather="plus"></i> Add a card</button></div>' +
            '</div>';

        document.getElementById('kanbanBoard').appendChild(col);

        col.querySelector('.kanban-add-card-btn').addEventListener('click', function() {
            createNewCardInput(col.querySelector('.kanban-card-list'), key);
        });
        col.querySelector('.add-card-top-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            createNewCardInput(col.querySelector('.kanban-card-list'), key);
        });

        if (typeof feather !== 'undefined') feather.replace();
    });

    /* ======================================================================
       HTML5 Drag & Drop
       ====================================================================== */

    function getDragAfterElement(list, y) {
        var cards = [].slice.call(list.querySelectorAll('.kanban-card:not(.dragging)'));
        return cards.reduce(function(closest, card) {
            var box = card.getBoundingClientRect();
            var offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: card };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    var board = document.getElementById('kanbanBoard');

    board.addEventListener('dragstart', function(e) {
        var card = e.target.closest('.kanban-card');
        if (!card) return;
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.dataset.cardId);
        e.dataTransfer.effectAllowed = 'move';
    });

    board.addEventListener('dragend', function(e) {
        var card = e.target.closest('.kanban-card');
        if (card) card.classList.remove('dragging');
        document.querySelectorAll('.kanban-card-list.drag-over').forEach(function(l) {
            l.classList.remove('drag-over');
        });
    });

    board.addEventListener('dragover', function(e) {
        var list = e.target.closest('.kanban-card-list');
        if (!list) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        list.classList.add('drag-over');
    });

    board.addEventListener('dragleave', function(e) {
        var list = e.target.closest('.kanban-card-list');
        if (!list) return;
        var related = e.relatedTarget;
        if (related && list.contains(related)) return;
        list.classList.remove('drag-over');
    });

    board.addEventListener('drop', function(e) {
        var list = e.target.closest('.kanban-card-list');
        if (!list) return;
        e.preventDefault();
        list.classList.remove('drag-over');

        var cardId = e.dataTransfer.getData('text/plain');
        var card = document.querySelector('.kanban-card[data-card-id="' + cardId + '"]');
        if (!card) return;

        var fromCol = card.closest('.kanban-column');
        var toCol = list.closest('.kanban-column');
        var fromName = fromCol ? getColumnName(fromCol) : '';
        var toName = toCol ? getColumnName(toCol) : '';

        var afterEl = getDragAfterElement(list, e.clientY);
        if (afterEl) {
            list.insertBefore(card, afterEl);
        } else {
            list.appendChild(card);
        }

        var allCards = [].slice.call(list.querySelectorAll('.kanban-card'));
        var position = allCards.indexOf(card);

        if (cardData[cardId]) {
            cardData[cardId].column = toName;
        }

        updateCounts();

        K.emit('card:move', {
            cardId: cardId,
            cardTitle: cardData[cardId] ? cardData[cardId].title : '',
            fromColumn: fromName,
            toColumn: toName,
            position: position
        });
    });

    /* ======================================================================
       Context Menu System
       ====================================================================== */

    var ctxMenu = null;
    var ctxActiveEl = null;

    function getOrCreateCtxMenu() {
        if (ctxMenu) return ctxMenu;
        ctxMenu = document.createElement('div');
        ctxMenu.className = 'le-context-menu';
        document.body.appendChild(ctxMenu);
        return ctxMenu;
    }

    function closeCtxMenu() {
        if (!ctxMenu) return;
        ctxMenu.classList.remove('visible');
        if (ctxActiveEl) {
            ctxActiveEl.classList.remove('ctx-active');
            ctxActiveEl = null;
        }
    }

    function showCtxMenu(x, y, html, activeEl) {
        var menu = getOrCreateCtxMenu();
        menu.innerHTML = html;
        menu.classList.remove('visible');

        if (ctxActiveEl) ctxActiveEl.classList.remove('ctx-active');
        ctxActiveEl = activeEl || null;
        if (ctxActiveEl) ctxActiveEl.classList.add('ctx-active');

        menu.style.left = '0px';
        menu.style.top = '0px';
        menu.style.display = 'block';

        requestAnimationFrame(function() {
            var rect = menu.getBoundingClientRect();
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            var left = x + rect.width > vw ? vw - rect.width - 8 : x;
            var top = y + rect.height > vh ? vh - rect.height - 8 : y;
            if (left < 8) left = 8;
            if (top < 8) top = 8;
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';

            requestAnimationFrame(function() {
                menu.classList.add('visible');
            });
        });

        if (typeof feather !== 'undefined') feather.replace();
    }

    function ctxItem(icon, label, cls) {
        var c = cls ? ' ' + cls : '';
        return '<div class="le-context-menu-item' + c + '" data-action="' + label + '">' +
            '<i data-feather="' + icon + '"></i><span>' + label + '</span></div>';
    }

    function ctxSep() { return '<div class="le-context-menu-sep"></div>'; }
    function ctxHead(label) { return '<div class="le-context-menu-header">' + label + '</div>'; }

    // Close on outside click, Escape, scroll
    document.addEventListener('mousedown', function(e) {
        if (ctxMenu && !ctxMenu.contains(e.target)) closeCtxMenu();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeCtxMenu();
    });
    document.addEventListener('scroll', closeCtxMenu, { capture: true, passive: true });

    /* ── Card Context Menu ─────────────────────────────────────────────────── */
    document.addEventListener('contextmenu', function(e) {
        var card = e.target.closest('.kanban-card');
        if (card) {
            e.preventDefault();
            var cardId = card.dataset.cardId;
            var data = cardData[cardId];
            var title = data ? data.title : 'Card';

            var html = ctxHead('Card Actions') +
                ctxItem('eye', 'View Details') +
                ctxItem('edit-2', 'Edit Card') +
                ctxSep() +
                ctxItem('copy', 'Duplicate') +
                ctxItem('arrow-right', 'Move to \u2192') +
                ctxItem('user-plus', 'Assign Member') +
                ctxSep() +
                ctxItem('flag', 'Set Priority') +
                ctxItem('tag', 'Change Labels') +
                ctxSep() +
                ctxItem('archive', 'Archive Card') +
                ctxItem('trash-2', 'Delete Card', 'danger');

            showCtxMenu(e.clientX, e.clientY, html, card);

            ctxMenu.onclick = function(ev) {
                var item = ev.target.closest('.le-context-menu-item');
                if (!item) return;
                var action = item.dataset.action;
                closeCtxMenu();

                var evData = { cardId: cardId, cardTitle: title, cardEl: card };

                switch (action) {
                    case 'View Details':
                        openCardModal(cardId);
                        K.emit('card:view', evData);
                        break;
                    case 'Edit Card':
                        K.emit('card:edit', evData);
                        break;
                    case 'Duplicate':
                        K.emit('card:duplicate', evData);
                        break;
                    case 'Move to \u2192':
                        K.emit('card:move-to', evData);
                        break;
                    case 'Assign Member':
                        K.emit('card:assign', evData);
                        break;
                    case 'Set Priority':
                        K.emit('card:priority', evData);
                        break;
                    case 'Change Labels':
                        K.emit('card:labels', evData);
                        break;
                    case 'Archive Card':
                        K.emit('card:archive', evData);
                        break;
                    case 'Delete Card':
                        card.remove();
                        delete cardData[cardId];
                        updateCounts();
                        K.emit('card:delete', evData);
                        break;
                }
            };
            return;
        }

        /* ── Column Header Context Menu ────────────────────────────────────── */
        var colHeader = e.target.closest('.kanban-col-header');
        if (colHeader) {
            e.preventDefault();
            var col = colHeader.closest('.kanban-column');
            var colName = getColumnName(col);

            var html2 = ctxHead('Column') +
                ctxItem('edit-2', 'Rename Column') +
                ctxItem('plus', 'Add Card') +
                ctxSep() +
                ctxItem('check-circle', 'Mark All Complete') +
                ctxItem('archive', 'Archive All') +
                ctxSep() +
                ctxItem('trash-2', 'Delete Column', 'danger');

            showCtxMenu(e.clientX, e.clientY, html2, col);

            ctxMenu.onclick = function(ev) {
                var item = ev.target.closest('.le-context-menu-item');
                if (!item) return;
                var action = item.dataset.action;
                closeCtxMenu();

                var evData = { columnEl: col, columnName: colName };

                switch (action) {
                    case 'Rename Column':
                        K.emit('column:rename', evData);
                        break;
                    case 'Add Card':
                        createNewCardInput(col.querySelector('.kanban-card-list'), col.dataset.column);
                        K.emit('column:add-card', evData);
                        break;
                    case 'Mark All Complete':
                        K.emit('column:complete-all', evData);
                        break;
                    case 'Archive All':
                        K.emit('column:archive-all', evData);
                        break;
                    case 'Delete Column':
                        col.remove();
                        K.emit('column:delete', evData);
                        break;
                }
            };
        }
    });

    /* ── Mobile three-dot menu button on kanban cards ─────────────────────── */
    function injectCardMoreBtns() {
        document.querySelectorAll('.kanban-card').forEach(function(card) {
            if (card.querySelector('.kanban-card-more-btn')) return;
            var btn = document.createElement('button');
            btn.className = 'kanban-card-more-btn';
            btn.title = 'More actions';
            btn.innerHTML = '<i data-feather="more-vertical"></i>';
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                closeCtxMenu();

                var cardId = card.dataset.cardId;
                var data = cardData[cardId];
                var title = data ? data.title : 'Card';

                var html = ctxHead('Card Actions') +
                    ctxItem('eye', 'View Details') +
                    ctxItem('edit-2', 'Edit Card') +
                    ctxSep() +
                    ctxItem('copy', 'Duplicate') +
                    ctxItem('arrow-right', 'Move to \u2192') +
                    ctxItem('user-plus', 'Assign Member') +
                    ctxSep() +
                    ctxItem('flag', 'Set Priority') +
                    ctxItem('tag', 'Change Labels') +
                    ctxSep() +
                    ctxItem('archive', 'Archive Card') +
                    ctxItem('trash-2', 'Delete Card', 'danger');

                var rect = btn.getBoundingClientRect();
                showCtxMenu(rect.right - 180, rect.bottom + 4, html, card);

                ctxMenu.onclick = function(ev) {
                    var item = ev.target.closest('.le-context-menu-item');
                    if (!item) return;
                    var action = item.dataset.action;
                    closeCtxMenu();
                    var evData = { cardId: cardId, cardTitle: title, cardEl: card };
                    switch (action) {
                        case 'View Details': openCardModal(cardId); K.emit('card:view', evData); break;
                        case 'Edit Card': K.emit('card:edit', evData); break;
                        case 'Duplicate': K.emit('card:duplicate', evData); break;
                        case 'Move to \u2192': K.emit('card:move-to', evData); break;
                        case 'Assign Member': K.emit('card:assign', evData); break;
                        case 'Set Priority': K.emit('card:priority', evData); break;
                        case 'Change Labels': K.emit('card:labels', evData); break;
                        case 'Archive Card': K.emit('card:archive', evData); break;
                        case 'Delete Card':
                            card.remove(); delete cardData[cardId]; updateCounts();
                            K.emit('card:delete', evData); break;
                    }
                };
            });
            card.querySelector('.kanban-card-inner').appendChild(btn);
        });
        if (typeof feather !== 'undefined') feather.replace();
    }
    injectCardMoreBtns();

    /* ── Init ──────────────────────────────────────────────────────────────── */
    updateCounts();
});
