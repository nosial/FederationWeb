/* =============================================================================
   Liquid Elegance — Calendar App Logic
   Full-featured calendar with public API, CRUD, navigation sync, and modern UX.

   PUBLIC API — LiquidElegance.Calendar:
     .on(event, fn)              — subscribe to calendar events
     .off(event, fn)             — unsubscribe
     .once(event, fn)            — subscribe once
     .getEvents(filter?)         — get events (optional filter: {date,category,from,to,search,visibleOnly})
     .getEvent(id)               — get single event by ID
     .addEvent(data)             — add event {title,date,start?,end?,cat?,location?,description?}
     .updateEvent(id, changes)   — update event fields
     .removeEvent(id)            — delete event by ID
     .navigateTo(dateStr)        — navigate all views to a date (YYYY-MM-DD)
     .today()                    — navigate to today
     .next() / .prev()           — navigate forward/back (view-aware)
     .getView() / .setView(v)    — get/set view ('month','week','day')
     .getSelectedDate()          — get selected date string
     .setSelectedDate(dateStr)   — set selected date
     .getActiveFilters()         — get active category filters
     .setFilter(cat, enabled)    — toggle a category filter

   EVENTS EMITTED:
     calendar:ready, date:select, event:click, event:add, event:update,
     event:delete, event:save, event:cancel, event:remind, date:copy,
     date:reminder, view:change, month:navigate, week:navigate, day:navigate,
     navigate:today, filter:change
   ============================================================================= */

window.LiquidElegance = window.LiquidElegance || {};

LiquidElegance.Calendar = {
    _handlers: {},
    _internal: null,
    on(event, fn) { (this._handlers[event] = this._handlers[event] || []).push(fn); return this; },
    off(event, fn) { this._handlers[event] = (this._handlers[event] || []).filter(h => h !== fn); return this; },
    once(event, fn) { const wrap = (data) => { this.off(event, wrap); fn(data); }; return this.on(event, wrap); },
    emit(event, data) {
        (this._handlers[event] || []).forEach(fn => {
            try { fn(data); } catch(_) { /* handler error - skip */ }
        });
        return this;
    },
    getEvents(f)          { return this._internal ? this._internal.getEvents(f) : []; },
    getEvent(id)          { return this._internal ? this._internal.getEvent(id) : null; },
    addEvent(d)           { return this._internal ? this._internal.addEvent(d) : null; },
    updateEvent(id, c)    { return this._internal ? this._internal.updateEvent(id, c) : null; },
    removeEvent(id)       { return this._internal ? this._internal.removeEvent(id) : false; },
    navigateTo(ds)        { if (this._internal) this._internal.navigateTo(ds); return this; },
    today()               { if (this._internal) this._internal.goToday(); return this; },
    next()                { if (this._internal) this._internal.navigateNext(); return this; },
    prev()                { if (this._internal) this._internal.navigatePrev(); return this; },
    getView()             { return this._internal ? this._internal.getView() : null; },
    setView(v)            { if (this._internal) this._internal.setView(v); return this; },
    getSelectedDate()     { return this._internal ? this._internal.getSelectedDate() : null; },
    setSelectedDate(ds)   { if (this._internal) this._internal.setSelectedDate(ds); return this; },
    getActiveFilters()    { return this._internal ? this._internal.getActiveFilters() : []; },
    setFilter(cat, on)    { if (this._internal) this._internal.setFilter(cat, on); return this; },
};

document.addEventListener('DOMContentLoaded', function() {
    if (typeof feather !== 'undefined') feather.replace();

    const Cal = LiquidElegance.Calendar;
    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAY_NAMES_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const DAY_MINI    = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const CAT_COLORS  = { work:'var(--le-primary)', personal:'var(--le-success)', meetings:'rgb(99,102,241)', holidays:'var(--le-warning)', danger:'var(--le-danger)' };
    const CAT_BG      = { work:'rgba(var(--le-primary-rgb),0.15)', personal:'rgba(var(--le-success-rgb),0.15)', meetings:'rgba(99,102,241,0.15)', holidays:'rgba(var(--le-warning-rgb),0.15)', danger:'rgba(var(--le-danger-rgb),0.15)' };
    const CAT_LABELS  = { work:'Work', personal:'Personal', meetings:'Meeting', holidays:'Holiday', danger:'Important' };

    /* ── State ──────────────────────────────────────────────────────────── */
    let currentYear = 2026, currentMonth = 2;
    let miniYear = 2026, miniMonth = 2;
    let currentView = 'month';
    let selectedDate = null;
    let activeFilters = new Set(['work','personal','meetings','holidays']);
    let currentWeekStart = null;
    let editingEventId = null;
    let _nextId = 1;

    // Initialize week start to week containing March 1, 2026
    (function() {
        const d = new Date(currentYear, currentMonth, 1);
        d.setDate(d.getDate() - d.getDay());
        currentWeekStart = new Date(d);
    })();

    /* ── Sample Events ──────────────────────────────────────────────────── */
    const events = [
        { id: _nextId++, title:'Team Standup', date:'2026-03-02', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Team Standup', date:'2026-03-03', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Team Standup', date:'2026-03-04', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Team Standup', date:'2026-03-05', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Team Standup', date:'2026-03-06', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Team Standup', date:'2026-03-09', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Team Standup', date:'2026-03-10', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Team Standup', date:'2026-03-11', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Team Standup', date:'2026-03-12', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Team Standup', date:'2026-03-13', start:'09:00', end:'09:30', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Design Sprint', date:'2026-03-09', start:'10:00', end:'17:00', cat:'meetings', location:'Conf Room A', description:'' },
        { id: _nextId++, title:'Design Sprint', date:'2026-03-10', start:'10:00', end:'17:00', cat:'meetings', location:'Conf Room A', description:'' },
        { id: _nextId++, title:'Design Sprint', date:'2026-03-11', start:'10:00', end:'17:00', cat:'meetings', location:'Conf Room A', description:'' },
        { id: _nextId++, title:'Product Launch', date:'2026-03-20', start:'14:00', end:'16:00', cat:'danger', location:'Main Stage', description:'' },
        { id: _nextId++, title:'Board Meeting', date:'2026-03-18', start:'10:00', end:'12:00', cat:'personal', location:'Boardroom', description:'' },
        { id: _nextId++, title:'Holiday - Company Day Off', date:'2026-03-27', start:'', end:'', cat:'holidays', location:'', description:'' },
        { id: _nextId++, title:'Design Review', date:'2026-03-05', start:'11:30', end:'12:30', cat:'meetings', location:'Room B', description:'' },
        { id: _nextId++, title:'Lunch with Client', date:'2026-03-05', start:'12:30', end:'13:30', cat:'personal', location:'Bistro 42', description:'' },
        { id: _nextId++, title:'Sprint Planning', date:'2026-03-05', start:'14:00', end:'15:30', cat:'work', location:'Conf Room C', description:'' },
        { id: _nextId++, title:'1:1 with Manager', date:'2026-03-05', start:'16:00', end:'16:30', cat:'work', location:'Office 204', description:'' },
        { id: _nextId++, title:'Code Review', date:'2026-03-16', start:'10:00', end:'11:00', cat:'work', location:'Remote', description:'' },
        { id: _nextId++, title:'Sprint Retro', date:'2026-03-19', start:'15:00', end:'16:00', cat:'meetings', location:'Zoom', description:'' },
        { id: _nextId++, title:'Client Demo', date:'2026-03-24', start:'11:00', end:'12:00', cat:'work', location:'Zoom', description:'' },
        { id: _nextId++, title:'Birthday Party', date:'2026-03-28', start:'18:00', end:'21:00', cat:'personal', location:'Home', description:'' },
        { id: _nextId++, title:'Quarterly Review', date:'2026-03-30', start:'09:00', end:'11:00', cat:'meetings', location:'Boardroom', description:'' },
        { id: _nextId++, title:'API Deadline', date:'2026-03-25', start:'', end:'', cat:'danger', location:'', description:'' },
        { id: _nextId++, title:'Team Lunch', date:'2026-03-12', start:'12:00', end:'13:00', cat:'personal', location:'Cafe', description:'' },
    ];

    /* ── Utility Functions ──────────────────────────────────────────────── */
    function fmtDate(y, m, d) {
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    function parseDate(ds) {
        const [y, m, d] = ds.split('-').map(Number);
        return { year: y, month: m - 1, day: d };
    }

    function toDate(ds) {
        const p = parseDate(ds);
        return new Date(p.year, p.month, p.day);
    }

    function dateFromObj(d) {
        return fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function formatTime(t) {
        if (!t) return 'All day';
        const [h, min] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${ampm}`;
    }

    function formatDateLong(ds) {
        const p = parseDate(ds);
        return `${DAY_NAMES_FULL[new Date(p.year, p.month, p.day).getDay()]}, ${MONTH_NAMES[p.month]} ${p.day}, ${p.year}`;
    }

    function formatWeekRange(startDate) {
        const end = new Date(startDate);
        end.setDate(end.getDate() + 6);
        const sm = startDate.getMonth(), sd = startDate.getDate(), sy = startDate.getFullYear();
        const em = end.getMonth(), ed = end.getDate(), ey = end.getFullYear();
        if (sy === ey && sm === em) return `${MONTH_SHORT[sm]} ${sd} – ${ed}, ${sy}`;
        if (sy === ey) return `${MONTH_SHORT[sm]} ${sd} – ${MONTH_SHORT[em]} ${ed}, ${sy}`;
        return `${MONTH_SHORT[sm]} ${sd}, ${sy} – ${MONTH_SHORT[em]} ${ed}, ${ey}`;
    }

    function getWeekStart(d) {
        const r = new Date(d);
        r.setDate(r.getDate() - r.getDay());
        return r;
    }

    function todayStr() {
        const t = new Date();
        return fmtDate(t.getFullYear(), t.getMonth(), t.getDate());
    }

    function isCatVisible(cat) {
        return activeFilters.has(cat === 'danger' ? 'work' : cat);
    }

    function getEventsForDate(ds) {
        return events.filter(e => e.date === ds && isCatVisible(e.cat))
                     .sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));
    }

    /* ── CRUD Operations ──────────────────────────────────────────────── */
    function addEvent(data) {
        const evt = {
            id: _nextId++,
            title: data.title || 'Untitled Event',
            date: data.date || todayStr(),
            start: data.start || '',
            end: data.end || '',
            cat: data.cat || 'work',
            location: data.location || '',
            description: data.description || ''
        };
        events.push(evt);
        Cal.emit('event:add', { ...evt });
        renderAll();
        return { ...evt };
    }

    function updateEvent(id, changes) {
        const idx = events.findIndex(e => e.id === id);
        if (idx === -1) return null;
        const old = { ...events[idx] };
        Object.assign(events[idx], changes);
        events[idx].id = id;
        Cal.emit('event:update', { event: { ...events[idx] }, previous: old });
        renderAll();
        return { ...events[idx] };
    }

    function removeEvent(id) {
        const idx = events.findIndex(e => e.id === id);
        if (idx === -1) return false;
        const removed = events.splice(idx, 1)[0];
        Cal.emit('event:delete', { ...removed });
        renderAll();
        return true;
    }

    function duplicateEvent(id) {
        const src = events.find(e => e.id === id);
        if (!src) return null;
        return addEvent({ ...src, title: src.title + ' (copy)', id: undefined });
    }

    function getEvent(id) {
        const e = events.find(ev => ev.id === id);
        return e ? { ...e } : null;
    }

    function getFilteredEvents(filter) {
        let result = [...events];
        if (filter) {
            if (filter.date) result = result.filter(e => e.date === filter.date);
            if (filter.category) result = result.filter(e => e.cat === filter.category);
            if (filter.from) result = result.filter(e => e.date >= filter.from);
            if (filter.to) result = result.filter(e => e.date <= filter.to);
            if (filter.search) {
                const q = filter.search.toLowerCase();
                result = result.filter(e => e.title.toLowerCase().includes(q) || (e.location && e.location.toLowerCase().includes(q)));
            }
            if (filter.visibleOnly) result = result.filter(e => isCatVisible(e.cat));
        }
        return result.map(e => ({ ...e }));
    }

    /* ── Context Menu Helper ──────────────────────────────────────────── */
    let activeCtxMenu = null;
    let activeCtxTarget = null;

    function closeContextMenu() {
        if (activeCtxMenu) { activeCtxMenu.remove(); activeCtxMenu = null; }
        if (activeCtxTarget) { activeCtxTarget.classList.remove('ctx-active'); activeCtxTarget = null; }
    }

    function createContextMenu(x, y, items) {
        closeContextMenu();
        const menu = document.createElement('div');
        menu.className = 'le-context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        items.forEach(item => {
            if (item.type === 'header') {
                const el = document.createElement('div');
                el.className = 'le-context-menu-header';
                el.textContent = item.text;
                menu.appendChild(el);
            } else if (item.type === 'separator') {
                menu.appendChild(Object.assign(document.createElement('div'), { className: 'le-context-menu-sep' }));
            } else if (item.type === 'item') {
                const el = document.createElement('div');
                el.className = 'le-context-menu-item' + (item.className === 'danger' ? ' danger' : '');
                if (item.icon) {
                    const icon = document.createElement('i');
                    icon.setAttribute('data-feather', item.icon);
                    el.appendChild(icon);
                }
                el.appendChild(Object.assign(document.createElement('span'), { textContent: item.text }));
                el.addEventListener('click', (e) => { e.stopPropagation(); closeContextMenu(); if (item.action) item.action(); });
                menu.appendChild(el);
            }
        });

        document.body.appendChild(menu);
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
            if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';
            menu.classList.add('visible');
        });
        if (typeof feather !== 'undefined') feather.replace();
        activeCtxMenu = menu;
        return menu;
    }

    function buildEventContextMenuItems(evt) {
        return [
            { type: 'header', text: 'Event' },
            { type: 'item', icon: 'eye', text: 'View Details', action() {
                const anchor = document.querySelector(`[data-event-id="${evt.id}"]`);
                showEventPopover(evt.id, anchor || document.body);
            }},
            { type: 'item', icon: 'edit-2', text: 'Edit Event', action() { openEditModal(evt.id); } },
            { type: 'separator' },
            { type: 'item', icon: 'copy', text: 'Duplicate Event', action() { duplicateEvent(evt.id); } },
            { type: 'item', icon: 'calendar', text: 'Reschedule', action() { openEditModal(evt.id); } },
            { type: 'item', icon: 'bell', text: 'Set Reminder', action() { Cal.emit('event:remind', { id: evt.id, title: evt.title, date: evt.date }); } },
            { type: 'separator' },
            { type: 'item', icon: 'trash-2', text: 'Delete Event', className: 'danger', action() { if (confirm(`Delete "${evt.title}"?`)) removeEvent(evt.id); } }
        ];
    }

    document.addEventListener('click', closeContextMenu);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContextMenu(); });

    /* ── Event Detail Popover ──────────────────────────────────────────── */
    let activePopover = null;

    function closePopover() {
        if (activePopover) { activePopover.remove(); activePopover = null; }
    }

    function showEventPopover(eventId, anchorEl) {
        closePopover();
        closeContextMenu();
        const evt = events.find(e => e.id === eventId);
        if (!evt) return;

        const popover = document.createElement('div');
        popover.className = 'le-event-popover';
        popover.innerHTML = `
            <div class="le-event-popover-header">
                <div class="le-event-popover-cat" style="background:${CAT_COLORS[evt.cat] || CAT_COLORS.work}"></div>
                <div class="le-event-popover-title">${evt.title}</div>
                <button class="le-event-popover-close" title="Close">&times;</button>
            </div>
            <div class="le-event-popover-body">
                <div class="le-event-popover-row"><i data-feather="calendar" class="le-icon-14"></i><span>${formatDateLong(evt.date)}</span></div>
                <div class="le-event-popover-row"><i data-feather="clock" class="le-icon-14"></i><span>${evt.start ? formatTime(evt.start) + (evt.end ? ' – ' + formatTime(evt.end) : '') : 'All day'}</span></div>
                ${evt.location ? `<div class="le-event-popover-row"><i data-feather="map-pin" class="le-icon-14"></i><span>${evt.location}</span></div>` : ''}
                <div class="le-event-popover-row"><i data-feather="tag" class="le-icon-14"></i><span>${CAT_LABELS[evt.cat] || evt.cat}</span></div>
                ${evt.description ? `<div class="le-event-popover-desc">${evt.description}</div>` : ''}
            </div>
            <div class="le-event-popover-actions">
                <button class="le-event-popover-btn edit" data-action="edit"><i data-feather="edit-2" class="le-icon-14"></i> Edit</button>
                <button class="le-event-popover-btn duplicate" data-action="duplicate"><i data-feather="copy" class="le-icon-14"></i> Duplicate</button>
                <button class="le-event-popover-btn delete" data-action="delete"><i data-feather="trash-2" class="le-icon-14"></i> Delete</button>
            </div>
        `;

        document.body.appendChild(popover);
        const anchorRect = anchorEl.getBoundingClientRect();
        let top = anchorRect.bottom + 8;
        let left = anchorRect.left;

        requestAnimationFrame(() => {
            const pRect = popover.getBoundingClientRect();
            if (left + pRect.width > window.innerWidth) left = window.innerWidth - pRect.width - 8;
            if (left < 8) left = 8;
            if (top + pRect.height > window.innerHeight) top = anchorRect.top - pRect.height - 8;
            if (top < 8) top = 8;
            popover.style.left = left + 'px';
            popover.style.top = top + 'px';
            popover.classList.add('visible');
        });

        popover.querySelector('.le-event-popover-close').addEventListener('click', closePopover);
        popover.querySelector('[data-action="edit"]').addEventListener('click', () => { closePopover(); openEditModal(eventId); });
        popover.querySelector('[data-action="duplicate"]').addEventListener('click', () => { closePopover(); duplicateEvent(eventId); });
        popover.querySelector('[data-action="delete"]').addEventListener('click', () => {
            closePopover();
            if (confirm(`Delete "${evt.title}"?`)) removeEvent(eventId);
        });

        if (typeof feather !== 'undefined') feather.replace();
        activePopover = popover;
        Cal.emit('event:click', { id: evt.id, title: evt.title, date: evt.date, category: evt.cat });
    }

    document.addEventListener('click', (e) => {
        if (activePopover && !activePopover.contains(e.target) && !e.target.closest('.event-pill') && !e.target.closest('.week-event-block') && !e.target.closest('.day-event-block')) {
            closePopover();
        }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopover(); });

    /* ── Mini Calendar ────────────────────────────────────────────────── */
    function renderMiniCalendar() {
        document.getElementById('miniCalTitle').textContent = `${MONTH_NAMES[miniMonth]} ${miniYear}`;
        const grid = document.getElementById('miniCalGrid');
        grid.innerHTML = '';
        DAY_MINI.forEach(d => {
            const el = document.createElement('div');
            el.className = 'mini-cal-day-name';
            el.textContent = d;
            grid.appendChild(el);
        });
        const firstDay = new Date(miniYear, miniMonth, 1).getDay();
        const daysInMonth = new Date(miniYear, miniMonth + 1, 0).getDate();
        const prevDays = new Date(miniYear, miniMonth, 0).getDate();
        const today = todayStr();

        // Previous month trailing days
        for (let i = 0; i < firstDay; i++) {
            const d = prevDays - firstDay + 1 + i;
            const el = document.createElement('div');
            el.className = 'mini-cal-date other-month';
            el.textContent = d;
            const prevM = miniMonth === 0 ? 11 : miniMonth - 1;
            const prevY = miniMonth === 0 ? miniYear - 1 : miniYear;
            const ds = fmtDate(prevY, prevM, d);
            el.addEventListener('click', () => miniDateClick(ds));
            grid.appendChild(el);
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const el = document.createElement('div');
            el.className = 'mini-cal-date';
            const ds = fmtDate(miniYear, miniMonth, d);
            if (ds === today) el.classList.add('today');
            if (selectedDate === ds) el.classList.add('selected');
            el.textContent = d;
            const dayEvents = events.filter(e => e.date === ds);
            if (dayEvents.length > 0) {
                const dots = document.createElement('div');
                dots.className = 'event-dots';
                [...new Set(dayEvents.map(e => e.cat))].slice(0, 3).forEach(c => {
                    const dot = document.createElement('div');
                    dot.className = 'dot';
                    dot.style.background = CAT_COLORS[c] || CAT_COLORS.work;
                    dots.appendChild(dot);
                });
                el.appendChild(dots);
            }
            el.addEventListener('click', () => miniDateClick(ds));
            grid.appendChild(el);
        }

        // Next month trailing days
        const totalCells = firstDay + daysInMonth;
        const remaining = (7 - totalCells % 7) % 7;
        for (let i = 1; i <= remaining; i++) {
            const el = document.createElement('div');
            el.className = 'mini-cal-date other-month';
            el.textContent = i;
            const nextM = miniMonth === 11 ? 0 : miniMonth + 1;
            const nextY = miniMonth === 11 ? miniYear + 1 : miniYear;
            const ds = fmtDate(nextY, nextM, i);
            el.addEventListener('click', () => miniDateClick(ds));
            grid.appendChild(el);
        }
    }

    // Mini calendar date click → navigates the main calendar
    function miniDateClick(ds) {
        const p = parseDate(ds);
        selectedDate = ds;
        currentYear = p.year;
        currentMonth = p.month;
        miniYear = p.year;
        miniMonth = p.month;
        currentWeekStart = getWeekStart(new Date(p.year, p.month, p.day));
        Cal.emit('date:select', { date: ds, source: 'mini-calendar' });
        updateTitle();
        renderAll();
    }

    /* ── Upcoming Events (dynamic) ────────────────────────────────────── */
    function renderUpcoming() {
        const container = document.getElementById('upcomingEvents');
        const now = new Date();
        const todayS = fmtDate(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowS = fmtDate(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

        // Show events for today & tomorrow; if none, show next 3 upcoming from selected/current month
        let upcoming = events
            .filter(e => (e.date === todayS || e.date === tomorrowS) && isCatVisible(e.cat))
            .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''))
            .slice(0, 6);

        if (upcoming.length === 0) {
            const refDate = selectedDate || fmtDate(currentYear, currentMonth, 1);
            upcoming = events
                .filter(e => e.date >= refDate && isCatVisible(e.cat))
                .sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''))
                .slice(0, 4);
        }

        if (upcoming.length === 0) {
            container.innerHTML = '<div class="upcoming-empty">No upcoming events</div>';
            return;
        }

        container.innerHTML = upcoming.map(e => `
            <div class="upcoming-event" data-event-id="${e.id}">
                <div class="upcoming-event-bar" style="background:${CAT_COLORS[e.cat]}"></div>
                <div class="upcoming-event-info">
                    <div class="upcoming-event-title">${e.title}</div>
                    <div class="upcoming-event-meta">${formatTime(e.start)}${e.location ? ' · ' + e.location : ''}</div>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.upcoming-event').forEach(el => {
            el.addEventListener('click', () => {
                const id = parseInt(el.dataset.eventId);
                showEventPopover(id, el);
            });
        });
    }

    /* ── Month Grid ───────────────────────────────────────────────────── */
    function renderMonthGrid() {
        const grid = document.getElementById('monthGrid');
        grid.innerHTML = '';
        DAY_NAMES.forEach(d => {
            const el = document.createElement('div');
            el.className = 'month-grid-header';
            el.textContent = d;
            grid.appendChild(el);
        });
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
        const today = todayStr();

        for (let i = 0; i < firstDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'month-cell other-month';
            cell.innerHTML = `<div class="date-num">${prevMonthDays - firstDay + 1 + i}</div>`;
            grid.appendChild(cell);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'month-cell';
            cell.setAttribute('tabindex', '0');
            const ds = fmtDate(currentYear, currentMonth, d);
            cell.dataset.date = ds;
            const isToday = ds === today;
            const isSelected = ds === selectedDate;
            if (isToday) cell.classList.add('today-cell');
            if (isSelected) cell.classList.add('selected-cell');
            cell.innerHTML = `<div class="date-num ${isToday ? 'today' : ''}">${d}</div>`;

            const dayEvents = getEventsForDate(ds);
            const maxShow = 3;
            dayEvents.slice(0, maxShow).forEach(evt => {
                const pill = document.createElement('div');
                pill.className = `event-pill cat-${evt.cat}`;
                pill.dataset.eventId = evt.id;
                pill.textContent = evt.title;
                pill.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    showEventPopover(evt.id, pill);
                });

                const moreBtn = document.createElement('button');
                moreBtn.className = 'event-pill-more-btn';
                moreBtn.title = 'More actions';
                moreBtn.innerHTML = '<i data-feather="more-vertical"></i>';
                moreBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    const rect = moreBtn.getBoundingClientRect();
                    activeCtxTarget = pill;
                    pill.classList.add('ctx-active');
                    createContextMenu(rect.right - 180, rect.bottom + 4, buildEventContextMenuItems(evt));
                });
                pill.appendChild(moreBtn);
                cell.appendChild(pill);
            });

            if (dayEvents.length > maxShow) {
                const more = document.createElement('div');
                more.className = 'more-events';
                more.textContent = `+${dayEvents.length - maxShow} more`;
                more.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    selectedDate = ds;
                    currentWeekStart = getWeekStart(toDate(ds));
                    setView('day');
                });
                cell.appendChild(more);
            }

            // Click on empty area → create event
            cell.addEventListener('click', (ev) => {
                if (ev.target.closest('.event-pill') || ev.target.closest('.more-events')) return;
                openCreateModal(ds);
            });

            // Double-click → switch to day view
            cell.addEventListener('dblclick', (ev) => {
                if (ev.target.closest('.event-pill')) return;
                selectedDate = ds;
                currentWeekStart = getWeekStart(toDate(ds));
                setView('day');
            });

            grid.appendChild(cell);
        }

        const totalCells = firstDay + daysInMonth;
        const remaining = (7 - totalCells % 7) % 7;
        for (let i = 1; i <= remaining; i++) {
            const cell = document.createElement('div');
            cell.className = 'month-cell other-month';
            cell.innerHTML = `<div class="date-num">${i}</div>`;
            grid.appendChild(cell);
        }

        // Context menu delegation on month grid
        grid.addEventListener('contextmenu', (e) => {
            const pill = e.target.closest('.event-pill');
            if (pill) {
                e.preventDefault();
                const eventId = parseInt(pill.dataset.eventId);
                const evt = events.find(ev => ev.id === eventId);
                if (!evt) return;
                activeCtxTarget = pill;
                pill.classList.add('ctx-active');
                createContextMenu(e.clientX, e.clientY, buildEventContextMenuItems(evt));
                return;
            }
            const cell = e.target.closest('.month-cell');
            if (cell && !cell.classList.contains('other-month') && cell.dataset.date) {
                e.preventDefault();
                const clickedDate = cell.dataset.date;
                const day = parseDate(clickedDate).day;
                activeCtxTarget = cell;
                cell.classList.add('ctx-active');
                createContextMenu(e.clientX, e.clientY, [
                    { type: 'header', text: `${MONTH_NAMES[currentMonth]} ${day}` },
                    { type: 'item', icon: 'plus', text: 'Create Event', action() { openCreateModal(clickedDate); } },
                    { type: 'item', icon: 'eye', text: 'View Day', action() { selectedDate = clickedDate; currentWeekStart = getWeekStart(toDate(clickedDate)); setView('day'); } },
                    { type: 'separator' },
                    { type: 'item', icon: 'copy', text: 'Copy Date', action() {
                        if (navigator.clipboard) navigator.clipboard.writeText(clickedDate).catch(() => {});
                        Cal.emit('date:copy', { date: clickedDate });
                    }},
                    { type: 'item', icon: 'bell', text: 'Set Reminder', action() { Cal.emit('date:reminder', { date: clickedDate }); } }
                ]);
            }
        });
    }

    /* ── Week View ────────────────────────────────────────────────────── */
    function renderWeekView() {
        const container = document.getElementById('weekView');
        container.innerHTML = '';
        const today = todayStr();
        const weekStart = new Date(currentWeekStart);

        let html = '<div class="week-grid">';
        html += '<div class="week-corner"></div>';
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const ds = dateFromObj(d);
            const isToday = ds === today;
            const isSelected = ds === selectedDate;
            html += `<div class="week-day-header ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${ds}">
                <span class="week-day-name">${DAY_NAMES[i]}</span>
                <span class="week-day-num ${isToday ? 'today-num' : ''}">${d.getDate()}</span>
            </div>`;
        }

        for (let h = 6; h <= 21; h++) {
            html += `<div class="week-time-label">${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}</div>`;
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + i);
                const ds = dateFromObj(d);
                const hourEvents = getEventsForDate(ds).filter(e => {
                    if (!e.start) return h === 8;
                    return parseInt(e.start.split(':')[0]) === h;
                });
                html += `<div class="week-day-col" data-date="${ds}" data-hour="${h}">`;
                hourEvents.forEach(e => {
                    const duration = e.start && e.end ? Math.max(parseInt(e.end.split(':')[0]) - parseInt(e.start.split(':')[0]), 1) : 1;
                    html += `<div class="week-event-block cat-${e.cat}" data-event-id="${e.id}" style="--event-duration:${duration}">
                        <div class="week-event-title">${e.title}</div>
                        <div class="week-event-time">${formatTime(e.start)}${e.end ? ' – ' + formatTime(e.end) : ''}</div>
                    </div>`;
                });
                html += '</div>';
            }
        }
        html += '</div>';
        container.innerHTML = html;

        // Click handlers
        container.querySelectorAll('.week-event-block').forEach(el => {
            el.addEventListener('click', (ev) => {
                ev.stopPropagation();
                showEventPopover(parseInt(el.dataset.eventId), el);
            });
            el.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const evt = events.find(e => e.id === parseInt(el.dataset.eventId));
                if (evt) createContextMenu(ev.clientX, ev.clientY, buildEventContextMenuItems(evt));
            });
        });
        container.querySelectorAll('.week-day-col').forEach(el => {
            el.addEventListener('click', (ev) => {
                if (ev.target.closest('.week-event-block')) return;
                openCreateModal(el.dataset.date, `${String(el.dataset.hour).padStart(2, '0')}:00`);
            });
        });
        container.querySelectorAll('.week-day-header').forEach(el => {
            el.addEventListener('click', () => {
                selectedDate = el.dataset.date;
                currentWeekStart = getWeekStart(toDate(selectedDate));
                setView('day');
            });
        });
    }

    /* ── Day View ─────────────────────────────────────────────────────── */
    function renderDayView() {
        const container = document.getElementById('dayView');
        const ds = selectedDate || todayStr();
        const dayEvents = getEventsForDate(ds);
        const today = todayStr();
        const isToday = ds === today;
        const nowHour = new Date().getHours();

        let html = `<div class="day-header-bar">
            <h6 class="day-header-title">${formatDateLong(ds)}${isToday ? ' <span class="badge-today">Today</span>' : ''}</h6>
            <span class="day-header-count">${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}</span>
        </div>`;
        html += '<div class="day-timeline">';

        for (let h = 6; h <= 21; h++) {
            const hourEvents = dayEvents.filter(e => {
                if (!e.start) return h === 8;
                return parseInt(e.start.split(':')[0]) === h;
            });
            const isNow = isToday && nowHour === h;
            html += `<div class="day-time-row ${isNow ? 'current-hour' : ''}">`;
            html += `<div class="day-time-label">${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}</div>`;
            html += `<div class="day-time-slot" data-date="${ds}" data-hour="${h}">`;
            if (isNow) html += '<div class="day-now-indicator"></div>';
            hourEvents.forEach(e => {
                const duration = e.start && e.end ? Math.max(parseInt(e.end.split(':')[0]) - parseInt(e.start.split(':')[0]), 1) : 1;
                html += `<div class="day-event-block cat-${e.cat}" data-event-id="${e.id}" style="--event-duration:${duration}">
                    <div class="day-event-title">${e.title}</div>
                    <div class="day-event-meta">${formatTime(e.start)}${e.end ? ' – ' + formatTime(e.end) : ''}${e.location ? ' · ' + e.location : ''}</div>
                </div>`;
            });
            html += '</div></div>';
        }

        html += '</div>';
        container.innerHTML = html;

        container.querySelectorAll('.day-event-block').forEach(el => {
            el.addEventListener('click', (ev) => {
                ev.stopPropagation();
                showEventPopover(parseInt(el.dataset.eventId), el);
            });
            el.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const evt = events.find(e => e.id === parseInt(el.dataset.eventId));
                if (evt) createContextMenu(ev.clientX, ev.clientY, buildEventContextMenuItems(evt));
            });
        });
        container.querySelectorAll('.day-time-slot').forEach(el => {
            el.addEventListener('click', (ev) => {
                if (ev.target.closest('.day-event-block')) return;
                openCreateModal(el.dataset.date, `${String(el.dataset.hour).padStart(2, '0')}:00`);
            });
        });
    }

    /* ── Modal (Create / Edit) ────────────────────────────────────────── */
    const eventModalEl = document.getElementById('eventModal');
    const eventBsModal = new bootstrap.Modal(eventModalEl);
    const modalTitle = document.getElementById('eventModalLabel');
    const saveBtn = document.getElementById('eventSaveBtn');

    // Inject delete button into modal footer
    const modalFooter = eventModalEl.querySelector('.modal-footer');
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-modal-delete';
    deleteBtn.id = 'eventDeleteBtn';
    deleteBtn.innerHTML = '<i data-feather="trash-2" class="le-icon-14"></i> Delete';
    deleteBtn.style.display = 'none';
    modalFooter.insertBefore(deleteBtn, modalFooter.firstChild);

    function openCreateModal(dateVal, startTime) {
        editingEventId = null;
        modalTitle.textContent = 'New Event';
        saveBtn.textContent = 'Save Event';
        deleteBtn.style.display = 'none';
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDate').value = dateVal || '';
        document.getElementById('eventStart').value = startTime || '';
        document.getElementById('eventEnd').value = '';
        document.getElementById('eventLocation').value = '';
        document.getElementById('eventDesc').value = '';
        document.getElementById('eventCalendar').value = 'work';
        document.getElementById('eventTitle').style.borderColor = '';
        eventBsModal.show();
        setTimeout(() => document.getElementById('eventTitle').focus(), 200);
    }

    function openEditModal(eventId) {
        const evt = events.find(e => e.id === eventId);
        if (!evt) return;
        editingEventId = eventId;
        modalTitle.textContent = 'Edit Event';
        saveBtn.textContent = 'Update Event';
        deleteBtn.style.display = '';
        document.getElementById('eventTitle').value = evt.title;
        document.getElementById('eventDate').value = evt.date;
        document.getElementById('eventStart').value = evt.start;
        document.getElementById('eventEnd').value = evt.end;
        document.getElementById('eventLocation').value = evt.location || '';
        document.getElementById('eventDesc').value = evt.description || '';
        document.getElementById('eventCalendar').value = evt.cat;
        document.getElementById('eventTitle').style.borderColor = '';
        eventBsModal.show();
        setTimeout(() => document.getElementById('eventTitle').focus(), 200);
    }

    function closeModal() { eventBsModal.hide(); }

    saveBtn.addEventListener('click', () => {
        const title = document.getElementById('eventTitle').value.trim();
        if (!title) {
            document.getElementById('eventTitle').style.borderColor = 'var(--le-danger)';
            return;
        }
        const data = {
            title,
            date: document.getElementById('eventDate').value,
            start: document.getElementById('eventStart').value,
            end: document.getElementById('eventEnd').value,
            cat: document.getElementById('eventCalendar').value,
            location: document.getElementById('eventLocation').value,
            description: document.getElementById('eventDesc').value
        };
        if (editingEventId) {
            updateEvent(editingEventId, data);
            Cal.emit('event:save', { ...data, id: editingEventId, action: 'update' });
        } else {
            const newEvt = addEvent(data);
            Cal.emit('event:save', { ...newEvt, action: 'create' });
        }
        editingEventId = null;
        closeModal();
    });

    deleteBtn.addEventListener('click', () => {
        if (editingEventId) {
            const evt = events.find(e => e.id === editingEventId);
            if (evt && confirm(`Delete "${evt.title}"?`)) {
                removeEvent(editingEventId);
                editingEventId = null;
                closeModal();
            }
        }
    });

    document.getElementById('eventCancelBtn').addEventListener('click', () => {
        Cal.emit('event:cancel', { editingId: editingEventId });
        editingEventId = null;
    });

    document.getElementById('eventTitle').addEventListener('input', function() {
        this.style.borderColor = '';
    });

    /* ── Navigation (view-aware) ──────────────────────────────────────── */
    function updateTitle() {
        const el = document.getElementById('mainCalTitle');
        if (currentView === 'month') {
            el.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
        } else if (currentView === 'week') {
            el.textContent = formatWeekRange(currentWeekStart);
        } else if (currentView === 'day') {
            const ds = selectedDate || todayStr();
            const p = parseDate(ds);
            el.textContent = `${MONTH_NAMES[p.month]} ${p.day}, ${p.year}`;
        }
    }

    function navigatePrev() {
        if (currentView === 'month') {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            miniYear = currentYear; miniMonth = currentMonth;
            Cal.emit('month:navigate', { month: MONTH_NAMES[currentMonth], year: currentYear, direction: -1 });
        } else if (currentView === 'week') {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            currentYear = currentWeekStart.getFullYear();
            currentMonth = currentWeekStart.getMonth();
            miniYear = currentYear; miniMonth = currentMonth;
            Cal.emit('week:navigate', { weekStart: dateFromObj(currentWeekStart), direction: -1 });
        } else if (currentView === 'day') {
            let d = selectedDate ? toDate(selectedDate) : new Date();
            d.setDate(d.getDate() - 1);
            selectedDate = dateFromObj(d);
            currentYear = d.getFullYear(); currentMonth = d.getMonth();
            currentWeekStart = getWeekStart(d);
            miniYear = currentYear; miniMonth = currentMonth;
            Cal.emit('day:navigate', { date: selectedDate, direction: -1 });
        }
        updateTitle();
        renderAll();
    }

    function navigateNext() {
        if (currentView === 'month') {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            miniYear = currentYear; miniMonth = currentMonth;
            Cal.emit('month:navigate', { month: MONTH_NAMES[currentMonth], year: currentYear, direction: 1 });
        } else if (currentView === 'week') {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            currentYear = currentWeekStart.getFullYear();
            currentMonth = currentWeekStart.getMonth();
            miniYear = currentYear; miniMonth = currentMonth;
            Cal.emit('week:navigate', { weekStart: dateFromObj(currentWeekStart), direction: 1 });
        } else if (currentView === 'day') {
            let d = selectedDate ? toDate(selectedDate) : new Date();
            d.setDate(d.getDate() + 1);
            selectedDate = dateFromObj(d);
            currentYear = d.getFullYear(); currentMonth = d.getMonth();
            currentWeekStart = getWeekStart(d);
            miniYear = currentYear; miniMonth = currentMonth;
            Cal.emit('day:navigate', { date: selectedDate, direction: 1 });
        }
        updateTitle();
        renderAll();
    }

    function goToday() {
        const today = new Date();
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
        miniYear = currentYear;
        miniMonth = currentMonth;
        selectedDate = dateFromObj(today);
        currentWeekStart = getWeekStart(today);
        Cal.emit('navigate:today', { date: selectedDate });
        updateTitle();
        renderAll();
    }

    /* ── View Switching ───────────────────────────────────────────────── */
    function setView(view) {
        if (!['month', 'week', 'day'].includes(view)) return;
        const prevView = currentView;
        currentView = view;

        if (view === 'week' && selectedDate) {
            currentWeekStart = getWeekStart(toDate(selectedDate));
        } else if (view === 'week' && !currentWeekStart) {
            currentWeekStart = getWeekStart(new Date(currentYear, currentMonth, 1));
        }
        if (view === 'day' && !selectedDate) {
            selectedDate = todayStr();
        }
        if (view === 'month' && selectedDate) {
            const p = parseDate(selectedDate);
            currentYear = p.year;
            currentMonth = p.month;
            miniYear = currentYear;
            miniMonth = currentMonth;
        }

        Cal.emit('view:change', { view, previousView: prevView });
        document.querySelectorAll('#viewTabs .glass-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
        document.getElementById('monthView').style.display = view === 'month' ? 'flex' : 'none';
        document.getElementById('monthView').classList.toggle('active', view === 'month');
        document.getElementById('weekView').classList.toggle('active', view === 'week');
        document.getElementById('dayView').classList.toggle('active', view === 'day');
        updateTitle();
        renderAll();
    }

    /* ── Keyboard Navigation ──────────────────────────────────────────── */
    document.addEventListener('keydown', (e) => {
        if (!document.getElementById('monthGrid')) return;
        if (e.target.closest('.modal') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        const key = e.key;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
            e.preventDefault();
            if (currentView === 'month') {
                const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[key];
                let d = selectedDate ? toDate(selectedDate) : new Date(currentYear, currentMonth, 1);
                d.setDate(d.getDate() + delta);
                selectedDate = dateFromObj(d);
                if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) {
                    currentYear = d.getFullYear();
                    currentMonth = d.getMonth();
                    miniYear = currentYear;
                    miniMonth = currentMonth;
                    updateTitle();
                }
                currentWeekStart = getWeekStart(d);
                renderAll();
                requestAnimationFrame(() => {
                    const cell = document.querySelector(`.month-cell[data-date="${selectedDate}"]`);
                    if (cell) cell.focus();
                });
            } else if (currentView === 'day') {
                if (key === 'ArrowLeft') navigatePrev();
                else if (key === 'ArrowRight') navigateNext();
            } else if (currentView === 'week') {
                if (key === 'ArrowLeft') navigatePrev();
                else if (key === 'ArrowRight') navigateNext();
            }
        } else if (key === 'Enter' && currentView === 'month' && selectedDate) {
            e.preventDefault();
            currentWeekStart = getWeekStart(toDate(selectedDate));
            setView('day');
        } else if (key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            goToday();
        }
    });

    /* ── Event Listeners ──────────────────────────────────────────────── */
    document.getElementById('createEventBtn').addEventListener('click', () => openCreateModal(selectedDate || ''));
    document.getElementById('mainPrev').addEventListener('click', navigatePrev);
    document.getElementById('mainNext').addEventListener('click', navigateNext);
    document.getElementById('mainTodayBtn').addEventListener('click', goToday);
    document.getElementById('miniPrev').addEventListener('click', () => {
        miniMonth--;
        if (miniMonth < 0) { miniMonth = 11; miniYear--; }
        renderMiniCalendar();
    });
    document.getElementById('miniNext').addEventListener('click', () => {
        miniMonth++;
        if (miniMonth > 11) { miniMonth = 0; miniYear++; }
        renderMiniCalendar();
    });
    document.querySelectorAll('#viewTabs .glass-tab').forEach(tab => {
        tab.addEventListener('click', () => setView(tab.dataset.view));
    });
    document.querySelectorAll('.cal-filter-item input').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) activeFilters.add(cb.value);
            else activeFilters.delete(cb.value);
            Cal.emit('filter:change', { filter: cb.value, enabled: cb.checked, activeFilters: [...activeFilters] });
            renderAll();
        });
    });

    /* ── Render All ───────────────────────────────────────────────────── */
    function renderAll() {
        renderMiniCalendar();
        renderUpcoming();
        renderMonthGrid();
        renderWeekView();
        renderDayView();
        if (typeof feather !== 'undefined') feather.replace();
    }

    /* ── Wire up Public API ───────────────────────────────────────────── */
    Cal._internal = {
        getEvents: getFilteredEvents,
        getEvent,
        addEvent,
        updateEvent,
        removeEvent,
        navigateTo(ds) {
            const p = parseDate(ds);
            selectedDate = ds;
            currentYear = p.year;
            currentMonth = p.month;
            miniYear = p.year;
            miniMonth = p.month;
            currentWeekStart = getWeekStart(new Date(p.year, p.month, p.day));
            updateTitle();
            renderAll();
        },
        goToday,
        navigateNext,
        navigatePrev,
        setView,
        getView() { return currentView; },
        getSelectedDate() { return selectedDate; },
        setSelectedDate(ds) {
            selectedDate = ds;
            if (ds) {
                const p = parseDate(ds);
                currentWeekStart = getWeekStart(new Date(p.year, p.month, p.day));
            }
            renderAll();
        },
        getActiveFilters() { return [...activeFilters]; },
        setFilter(cat, enabled) {
            if (enabled) activeFilters.add(cat);
            else activeFilters.delete(cat);
            const cb = document.querySelector(`.cal-filter-item input[value="${cat}"]`);
            if (cb) cb.checked = enabled;
            Cal.emit('filter:change', { filter: cat, enabled, activeFilters: [...activeFilters] });
            renderAll();
        }
    };

    /* ── Mobile Sidebar ───────────────────────────────────────────────── */
    const calSidebar = document.getElementById('calSidebar');
    const calSidebarToggle = document.getElementById('calSidebarToggle');
    const calSidebarBackdrop = document.getElementById('calSidebarBackdrop');
    const calSidebarClose = document.getElementById('calSidebarClose');
    const calFabCreate = document.getElementById('calFabCreate');

    function openCalSidebar() {
        if (calSidebar) calSidebar.classList.add('show');
        if (calSidebarBackdrop) calSidebarBackdrop.classList.add('show');
        var scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = '-' + scrollY + 'px';
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
        document.body.dataset.calScrollY = scrollY;
    }
    function closeCalSidebar() {
        if (calSidebar) calSidebar.classList.remove('show');
        if (calSidebarBackdrop) calSidebarBackdrop.classList.remove('show');
        var scrollY = parseInt(document.body.dataset.calScrollY || '0', 10);
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
        delete document.body.dataset.calScrollY;
    }

    if (calSidebarToggle) calSidebarToggle.addEventListener('click', openCalSidebar);
    if (calSidebarBackdrop) calSidebarBackdrop.addEventListener('click', closeCalSidebar);
    if (calSidebarClose) calSidebarClose.addEventListener('click', closeCalSidebar);
    if (calFabCreate) calFabCreate.addEventListener('click', () => openCreateModal(selectedDate || ''));

    /* ── Init ─────────────────────────────────────────────────────────── */
    updateTitle();
    renderAll();
    if (typeof feather !== 'undefined') feather.replace();
    Cal.emit('calendar:ready', { view: currentView, month: MONTH_NAMES[currentMonth], year: currentYear });
});

