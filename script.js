/* =============================================
   MS Cabs – script.js
   Leaflet map + Nominatim autocomplete + WhatsApp booking
============================================= */

// ── Nominatim helpers ──────────────────────────────────────────────────────────
const NOM = 'https://nominatim.openstreetmap.org';

async function nominatimSearch(query, limit = 5) {
    const url = `${NOM}/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=${limit}&countrycodes=in&addressdetails=1`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!r.ok) return [];
    return r.json();
}

async function nominatimReverse(lat, lng) {
    const url = `${NOM}/reverse?lat=${lat}&lon=${lng}&format=jsonv2`;
    const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!r.ok) throw new Error('reverse failed');
    const d = await r.json();
    return d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function osmPinUrl(lat, lng) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}
function osmRouteUrl(pLat, pLng, dLat, dLng) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${pLat},${pLng};${dLat},${dLng}`;
}

// ── Debounce util ─────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Road factor & Haversine distance (km) ──────────────────────────────────
const ROAD_FACTOR = 1.3;

function haversineKm(lat1, lng1, lat2, lng2) {
    const R  = 6371;
    const dL = (lat2 - lat1) * Math.PI / 180;
    const dG = (lng2 - lng1) * Math.PI / 180;
    const a  = Math.sin(dL / 2) ** 2 +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dG / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── App state ───────────────────────────────────────────────────────────────────
let map         = null;
let ICON_PICKUP = null;
let ICON_DROP   = null;

const state = {
    pickupMarker: null,
    dropMarker:   null,
    pickupCoords: null,
    dropCoords:   null,
    routeLine:    null,
    mode: 'pickup'
};

// ── Build Leaflet icons ─────────────────────────────────────────────────────
function buildIcons() {
    function pin(color, label) {
        return L.divIcon({
            className: '',
            html: `<div class="map-pin" title="${label}">
                     <svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
                       <path d="M12 0C7.58 0 4 3.58 4 8c0 6 8 16 8 16s8-10 8-16c0-4.42-3.58-8-8-8z"
                             fill="${color}" stroke="#fff" stroke-width="1.2"/>
                       <circle cx="12" cy="8" r="3" fill="#fff"/>
                     </svg>
                   </div>`,
            iconSize:    [28, 38],
            iconAnchor:  [14, 38],
            popupAnchor: [0, -40]
        });
    }
    ICON_PICKUP = pin('#22c55e', 'Pickup');
    ICON_DROP   = pin('#ef4444', 'Drop');
}

// ── Map init ────────────────────────────────────────────────────────────────
function initMap() {
    if (typeof L === 'undefined') {
        const el = document.getElementById('map');
        if (el) el.innerHTML = '<p style="padding:20px;text-align:center;color:#666">Map could not load. Please check your internet connection and reload.</p>';
        return;
    }

    buildIcons();

    map = L.map('map', {
        scrollWheelZoom: false,
        // Prevent Leaflet from applying its own tap handler that can misfire on mobile
        tap: false
    }).setView([12.9141, 74.8560], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur',  () => map.scrollWheelZoom.disable());

    // Initial size correction
    requestAnimationFrame(() => map.invalidateSize());

    // Fix layout after any resize or orientation change
    const resizeObserver = new ResizeObserver(() => {
        if (map) map.invalidateSize();
    });
    resizeObserver.observe(document.getElementById('map'));

    window.addEventListener('orientationchange', () => {
        setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    });

    map.on('click', async (e) => {
        if (state.mode === 'pickup') await setPickupCoords(e.latlng.lat, e.latlng.lng, true);
        else                         await setDropCoords(e.latlng.lat,   e.latlng.lng, true);
    });
}

// ── Place / move Pickup marker ─────────────────────────────────────────────────
async function setPickupCoords(lat, lng, doReverse) {
    state.pickupCoords = { lat, lng };
    if (state.pickupMarker) {
        state.pickupMarker.setLatLng([lat, lng]);
    } else {
        state.pickupMarker = L.marker([lat, lng], { icon: ICON_PICKUP, draggable: true })
            .addTo(map).bindPopup('<strong>&#x1F7E2; Pickup</strong>');
        state.pickupMarker.on('dragend', async () => {
            const p = state.pickupMarker.getLatLng();
            await setPickupCoords(p.lat, p.lng, true);
        });
    }
    state.pickupMarker.openPopup();
    if (doReverse) {
        setCoordBadge('pickup', lat, lng, 'Locating…');
        try {
            const addr = await nominatimReverse(lat, lng);
            document.getElementById('pickupAddress').value = addr;
            hideSuggestions('pickup');
            setCoordBadge('pickup', lat, lng, addr.split(',').slice(0, 3).join(','));
        } catch { setCoordBadge('pickup', lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`); }
    }
    updateHiddenFields();
    updateRouteLink();
    map.panTo([lat, lng]);
    if (window.setMode && !state.dropCoords) {
        window.setMode('drop');
    }
}

// ── Place / move Drop marker ──────────────────────────────────────────────────
async function setDropCoords(lat, lng, doReverse) {
    state.dropCoords = { lat, lng };
    if (state.dropMarker) {
        state.dropMarker.setLatLng([lat, lng]);
    } else {
        state.dropMarker = L.marker([lat, lng], { icon: ICON_DROP, draggable: true })
            .addTo(map).bindPopup('<strong>&#x1F534; Drop</strong>');
        state.dropMarker.on('dragend', async () => {
            const p = state.dropMarker.getLatLng();
            await setDropCoords(p.lat, p.lng, true);
        });
    }
    state.dropMarker.openPopup();
    if (doReverse) {
        setCoordBadge('drop', lat, lng, 'Locating…');
        try {
            const addr = await nominatimReverse(lat, lng);
            document.getElementById('destination').value = addr;
            hideSuggestions('drop');
            setCoordBadge('drop', lat, lng, addr.split(',').slice(0, 3).join(','));
        } catch { setCoordBadge('drop', lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`); }
    }
    updateHiddenFields();
    updateRouteLink();
    map.panTo([lat, lng]);
}

// ── Coord badge ────────────────────────────────────────────────────────────────────
function setCoordBadge(type, lat, lng, label) {
    const badge  = document.getElementById(`${type}CoordBadge`);
    const text   = document.getElementById(`${type}CoordText`);
    const link   = document.getElementById(`${type}MapLink`);
    if (!badge || !text || !link) return;
    badge.hidden = false;
    text.textContent = `${label} (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
    link.href = osmPinUrl(lat, lng);
}

// ── Form State Persistence (prevents accidental resets) ──────────────────────
const DRAFT_STORAGE_KEY = 'mscabs_booking_draft_v1';

function saveFormDraft() {
    try {
        const draft = {
            name:          document.getElementById('name')?.value || '',
            phone:         document.getElementById('phone')?.value || '',
            serviceType:   document.getElementById('serviceType')?.value || '',
            vehicleType:   document.getElementById('vehicleType')?.value || '',
            pickupAddress: document.getElementById('pickupAddress')?.value || '',
            destination:   document.getElementById('destination')?.value || '',
            date:          document.getElementById('date')?.value || '',
            time:          document.getElementById('time')?.value || '',
            comments:      document.getElementById('comments')?.value || '',
            pickupLat:     document.getElementById('pickupLat')?.value || '',
            pickupLng:     document.getElementById('pickupLng')?.value || '',
            dropLat:       document.getElementById('dropLat')?.value || '',
            dropLng:       document.getElementById('dropLng')?.value || '',
            pickupMapUrl:  document.getElementById('pickupMapUrl')?.value || '',
            dropMapUrl:    document.getElementById('dropMapUrl')?.value || '',
            routeMapUrl:   document.getElementById('routeMapUrl')?.value || ''
        };
        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (_) {}
}

async function restoreFormDraft() {
    try {
        const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (!draft || typeof draft !== 'object') return;

        ['name', 'phone', 'serviceType', 'vehicleType', 'pickupAddress', 'destination', 'date', 'time', 'comments'].forEach(id => {
            const el = document.getElementById(id);
            if (el && draft[id]) el.value = draft[id];
        });

        // Restore map coordinates & badges if present
        if (draft.pickupLat && draft.pickupLng && map) {
            const lat = parseFloat(draft.pickupLat);
            const lng = parseFloat(draft.pickupLng);
            if (!isNaN(lat) && !isNaN(lng)) {
                await setPickupCoords(lat, lng, false);
                setCoordBadge('pickup', lat, lng, draft.pickupAddress || 'Saved Pickup');
            }
        }
        if (draft.dropLat && draft.dropLng && map) {
            const lat = parseFloat(draft.dropLat);
            const lng = parseFloat(draft.dropLng);
            if (!isNaN(lat) && !isNaN(lng)) {
                await setDropCoords(lat, lng, false);
                setCoordBadge('drop', lat, lng, draft.destination || 'Saved Destination');
            }
        }
    } catch (_) {}
}

// ── Hidden fields + route link ─────────────────────────────────────────────────────
function updateHiddenFields() {
    if (state.pickupCoords) {
        document.getElementById('pickupLat').value    = state.pickupCoords.lat.toFixed(7);
        document.getElementById('pickupLng').value    = state.pickupCoords.lng.toFixed(7);
        document.getElementById('pickupMapUrl').value = osmPinUrl(state.pickupCoords.lat, state.pickupCoords.lng);
    }
    if (state.dropCoords) {
        document.getElementById('dropLat').value    = state.dropCoords.lat.toFixed(7);
        document.getElementById('dropLng').value    = state.dropCoords.lng.toFixed(7);
        document.getElementById('dropMapUrl').value = osmPinUrl(state.dropCoords.lat, state.dropCoords.lng);
    }
    saveFormDraft();
}

function updateRouteLink() {
    const row  = document.getElementById('routeLinkRow');
    const link = document.getElementById('routeLink');
    if (state.pickupCoords && state.dropCoords) {
        const url = osmRouteUrl(
            state.pickupCoords.lat, state.pickupCoords.lng,
            state.dropCoords.lat,   state.dropCoords.lng
        );
        document.getElementById('routeMapUrl').value = url;
        if (link) link.href = url;
        if (row) row.hidden = false;

        // Draw live route line on map
        if (map) {
            if (state.routeLine) {
                map.removeLayer(state.routeLine);
                state.routeLine = null;
            }
            state.routeLine = L.polyline([
                [state.pickupCoords.lat, state.pickupCoords.lng],
                [state.dropCoords.lat,   state.dropCoords.lng]
            ], {
                color: '#121316',
                weight: 4,
                dashArray: '8, 8',
                opacity: 0.85
            }).addTo(map);

            map.fitBounds([
                [state.pickupCoords.lat, state.pickupCoords.lng],
                [state.dropCoords.lat,   state.dropCoords.lng]
            ], { padding: [40, 40], maxZoom: 14 });
        }
    } else {
        if (row) row.hidden = true;
        if (state.routeLine && map) {
            map.removeLayer(state.routeLine);
            state.routeLine = null;
        }
    }
}

// ── Clear pins helper ─────────────────────────────────────────────────────────────
function clearMapPins() {
    if (state.pickupMarker && map) { map.removeLayer(state.pickupMarker); state.pickupMarker = null; }
    if (state.dropMarker && map)   { map.removeLayer(state.dropMarker);   state.dropMarker = null; }
    if (state.routeLine && map)    { map.removeLayer(state.routeLine);    state.routeLine = null; }
    state.pickupCoords = null;
    state.dropCoords = null;
    const pBadge = document.getElementById('pickupCoordBadge');
    const dBadge = document.getElementById('dropCoordBadge');
    if (pBadge) pBadge.hidden = true;
    if (dBadge) dBadge.hidden = true;
    const rRow = document.getElementById('routeLinkRow');
    if (rRow) rRow.hidden = true;
    document.getElementById('pickupAddress').value = '';
    document.getElementById('destination').value = '';
    document.getElementById('pickupLat').value = '';
    document.getElementById('pickupLng').value = '';
    document.getElementById('dropLat').value = '';
    document.getElementById('dropLng').value = '';
    if (map) map.setView([12.9141, 74.8560], 12);
    if (window.setMode) window.setMode('pickup');
    saveFormDraft();
}

// ── Autocomplete suggestions ─────────────────────────────────────────────────────
let activeIndex = { pickup: -1, drop: -1 };

function showSuggestions(type, results) {
    const list = document.getElementById(`${type}Suggestions`);
    if (!results.length) { hideSuggestions(type); return; }
    activeIndex[type] = -1;
    list.innerHTML = '';
    results.forEach((item, i) => {
        const li = document.createElement('li');
        li.className = 'suggestion-item';
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.dataset.index = i;
        const name = item.namedetails && item.namedetails.name
            ? item.namedetails.name
            : item.display_name.split(',')[0];
        li.innerHTML = `<span class="sug-icon"><i class="fa-solid fa-location-dot"></i></span>
                        <span class="sug-text">
                          <strong>${name}</strong>
                          <small>${item.display_name.split(',').slice(1, 4).join(',').trim()}</small>
                        </span>`;
        li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectSuggestion(type, item);
        });
        list.appendChild(li);
    });
    list.hidden = false;
}

function hideSuggestions(type) {
    const list = document.getElementById(`${type}Suggestions`);
    list.hidden = true;
    list.innerHTML = '';
    activeIndex[type] = -1;
}

function highlightItem(type, index) {
    const list  = document.getElementById(`${type}Suggestions`);
    const items = list.querySelectorAll('.suggestion-item');
    items.forEach((el, i) => {
        el.classList.toggle('active', i === index);
        el.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
}

async function selectSuggestion(type, item) {
    const lat  = parseFloat(item.lat);
    const lng  = parseFloat(item.lon);
    const addr = item.display_name;
    if (type === 'pickup') {
        document.getElementById('pickupAddress').value = addr;
        hideSuggestions('pickup');
        if (map) await setPickupCoords(lat, lng, false);
        setCoordBadge('pickup', lat, lng, addr.split(',').slice(0, 3).join(','));
    } else {
        document.getElementById('destination').value = addr;
        hideSuggestions('drop');
        if (map) await setDropCoords(lat, lng, false);
        setCoordBadge('drop', lat, lng, addr.split(',').slice(0, 3).join(','));
    }
    updateHiddenFields();
}

function setupAutocomplete(type, inputId) {
    const input = document.getElementById(inputId);

    const fetchSuggestions = debounce(async (q) => {
        if (q.length < 3) { hideSuggestions(type); return; }
        const results = await nominatimSearch(q, 6);
        showSuggestions(type, results);
    }, 350);

    input.addEventListener('input', () => fetchSuggestions(input.value.trim()));

    input.addEventListener('keydown', (e) => {
        const list  = document.getElementById(`${type}Suggestions`);
        const items = list.querySelectorAll('.suggestion-item');
        if (list.hidden || !items.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex[type] = Math.min(activeIndex[type] + 1, items.length - 1);
            highlightItem(type, activeIndex[type]);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex[type] = Math.max(activeIndex[type] - 1, 0);
            highlightItem(type, activeIndex[type]);
        } else if (e.key === 'Enter') {
            if (activeIndex[type] >= 0) {
                e.preventDefault();
                items[activeIndex[type]].dispatchEvent(new MouseEvent('mousedown'));
            }
        } else if (e.key === 'Escape') {
            hideSuggestions(type);
        }
    });

    input.addEventListener('blur', () => setTimeout(() => hideSuggestions(type), 150));
}

// ── Button loading ────────────────────────────────────────────────────────────────
function btnLoading(btn, on) {
    btn.disabled = on;
    btn.style.opacity = on ? '0.55' : '1';
}

// ── DOMContentLoaded ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    document.getElementById('date').setAttribute('min', new Date().toISOString().split('T')[0]);

    initMap();
    setupAutocomplete('pickup', 'pickupAddress');
    setupAutocomplete('drop',   'destination');
    await restoreFormDraft();

    // Select vehicle type from fleet cards
    document.querySelectorAll('.fleet-spec-card a[href="#booking"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const txt = btn.textContent.toLowerCase();
            const sel = document.getElementById('vehicleType');
            if (txt.includes('suv')) sel.value = 'SUV';
            else if (txt.includes('hatchback')) sel.value = 'Hatchback';
            else if (txt.includes('sedan')) sel.value = 'Sedan';
            saveFormDraft();
        });
    });

    // Map mode toggle
    const modePickupBtn = document.getElementById('modePickup');
    const modeDropBtn   = document.getElementById('modeDrop');
    const mapHint       = document.getElementById('mapHint');

    function setMode(mode) {
        state.mode = mode;
        if (modePickupBtn) modePickupBtn.classList.toggle('active', mode === 'pickup');
        if (modeDropBtn)   modeDropBtn.classList.toggle('active',   mode === 'drop');
        if (mapHint) {
            mapHint.innerHTML = mode === 'pickup'
                ? 'Click on the map to set <strong>Pickup</strong> location in Mangalore'
                : 'Click on the map to set <strong>Drop</strong> destination';
        }
    }
    window.setMode = setMode;

    if (modePickupBtn) modePickupBtn.addEventListener('click', () => setMode('pickup'));
    if (modeDropBtn)   modeDropBtn.addEventListener('click',   () => setMode('drop'));

    // Clear pins & Recenter
    const clearBtn = document.getElementById('clearMapPins');
    if (clearBtn) clearBtn.addEventListener('click', clearMapPins);

    const recenterBtn = document.getElementById('recenterMap');
    if (recenterBtn) recenterBtn.addEventListener('click', () => {
        if (map) {
            if (state.pickupCoords && state.dropCoords) {
                map.fitBounds([
                    [state.pickupCoords.lat, state.pickupCoords.lng],
                    [state.dropCoords.lat,   state.dropCoords.lng]
                ], { padding: [40, 40] });
            } else if (state.pickupCoords) {
                map.setView([state.pickupCoords.lat, state.pickupCoords.lng], 14);
            } else {
                map.setView([12.9141, 74.8560], 12);
            }
        }
    });

    // Preset location chips for Pickup
    document.querySelectorAll('[data-preset-pickup]').forEach(chip => {
        chip.addEventListener('click', async () => {
            const lat = parseFloat(chip.dataset.lat);
            const lng = parseFloat(chip.dataset.lng);
            const name = chip.dataset.presetPickup;
            document.getElementById('pickupAddress').value = name;
            await setPickupCoords(lat, lng, false);
            setCoordBadge('pickup', lat, lng, name);
            if (!state.dropCoords && window.setMode) window.setMode('drop');
            saveFormDraft();
        });
    });

    // Preset location chips for Drop
    document.querySelectorAll('[data-preset-drop]').forEach(chip => {
        chip.addEventListener('click', async () => {
            const lat = parseFloat(chip.dataset.lat);
            const lng = parseFloat(chip.dataset.lng);
            const name = chip.dataset.presetDrop;
            document.getElementById('destination').value = name;
            await setDropCoords(lat, lng, false);
            setCoordBadge('drop', lat, lng, name);
            saveFormDraft();
        });
    });

    // Package cards selection
    document.querySelectorAll('.btn-package-select').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const dest = btn.dataset.dest || '';
            const lat = parseFloat(btn.dataset.lat);
            const lng = parseFloat(btn.dataset.lng);
            const pkg = btn.dataset.pkg || '';
            const service = btn.dataset.service || 'Outstation';
            const vehicle = btn.dataset.vehicle || '';

            document.getElementById('destination').value = dest;
            document.getElementById('serviceType').value = service;
            if (vehicle) document.getElementById('vehicleType').value = vehicle;
            if (pkg) {
                document.getElementById('comments').value = `Booking package: ${pkg} from Mangalore.`;
            }

            // Default pickup if not set
            if (!state.pickupCoords) {
                document.getElementById('pickupAddress').value = 'Mangalore City Center, Karnataka';
                await setPickupCoords(12.9141, 74.8560, false);
                setCoordBadge('pickup', 12.9141, 74.8560, 'Mangalore City');
            }

            if (!isNaN(lat) && !isNaN(lng)) {
                await setDropCoords(lat, lng, false);
                setCoordBadge('drop', lat, lng, dest);
            }

            saveFormDraft();

            const bookingEl = document.getElementById('booking');
            if (bookingEl) {
                window.scrollTo({ top: bookingEl.getBoundingClientRect().top + window.pageYOffset - 70, behavior: 'smooth' });
                if (map) setTimeout(() => map.invalidateSize(), 400);
            }
        });
    });

    // GPS: My Location
    document.getElementById('useMyLocation').addEventListener('click', function () {
        if (!navigator.geolocation) { alert('Geolocation not supported by your browser.'); return; }
        const btn = this;
        btnLoading(btn, true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                await setPickupCoords(pos.coords.latitude, pos.coords.longitude, true);
                setMode('drop');
                btnLoading(btn, false);
            },
            () => { alert('Location access denied.'); btnLoading(btn, false); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });

    // Mobile nav
    const navToggle = document.getElementById('navToggle');
    const navLinks  = document.getElementById('navLinks');
    function closeMobileNav() {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        const icon = navToggle.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars';
    }
    navToggle.addEventListener('click', () => {
        const open = navLinks.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', String(open));
        const icon = navToggle.querySelector('i');
        if (icon) icon.className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileNav));
    document.addEventListener('click', (e) => {
        if (navLinks.classList.contains('open') && !navLinks.contains(e.target) && !navToggle.contains(e.target)) {
            closeMobileNav();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('open')) {
            closeMobileNav();
            navToggle.focus();
        }
    });

    // Phone digits only
    document.getElementById('phone').addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 10);
    });

    // Smooth scroll – also invalidate map size after scroll completes
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
            if (map) setTimeout(() => map.invalidateSize(), 400);
        });
    });

    // Form submit – WhatsApp Redirect & Draft Auto-save
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('input', debounce(saveFormDraft, 250));
        bookingForm.addEventListener('change', saveFormDraft);

        bookingForm.addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (!this.checkValidity()) {
                this.reportValidity();
                return false;
            }

            try {
                submitToWhatsApp({
                    name:          document.getElementById('name').value.trim(),
                    phone:         document.getElementById('phone').value.trim(),
                    serviceType:   document.getElementById('serviceType').value,
                    vehicleType:   document.getElementById('vehicleType').value,
                    pickupAddress: document.getElementById('pickupAddress').value.trim(),
                    destination:   document.getElementById('destination').value.trim(),
                    date:          document.getElementById('date').value,
                    time:          document.getElementById('time').value,
                    comments:      document.getElementById('comments').value.trim(),
                    pickupLat:     document.getElementById('pickupLat').value,
                    pickupLng:     document.getElementById('pickupLng').value,
                    dropLat:       document.getElementById('dropLat').value,
                    dropLng:       document.getElementById('dropLng').value,
                    pickupMapUrl:  document.getElementById('pickupMapUrl').value,
                    dropMapUrl:    document.getElementById('dropMapUrl').value,
                    routeMapUrl:   document.getElementById('routeMapUrl').value
                });
            } catch (err) {
                console.error('Submission error:', err);
                alert('Could not prepare WhatsApp message. Please contact us directly at +91 63618 06210.');
            }
            return false;
        });
    }

    // Google Analytics event tracking on direct contact links
    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
        link.addEventListener('click', () => {
            if (typeof gtag === 'function') {
                gtag('event', 'contact', {
                    method: 'Phone',
                    event_category: 'Engagement',
                    event_label: 'Direct Call'
                });
            }
        });
    });

    document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
        link.addEventListener('click', () => {
            if (typeof gtag === 'function') {
                gtag('event', 'contact', {
                    method: 'WhatsApp',
                    event_category: 'Engagement',
                    event_label: 'Direct WhatsApp Click'
                });
            }
        });
    });
});

// ── WhatsApp submission ─────────────────────────────────────────────────────────
function submitToWhatsApp(data) {
    let estDist = '';
    if (data.pickupLat && data.pickupLng && data.dropLat && data.dropLng) {
        const straightKm = haversineKm(
            parseFloat(data.pickupLat), parseFloat(data.pickupLng),
            parseFloat(data.dropLat),   parseFloat(data.dropLng)
        );
        estDist = `${(straightKm * ROAD_FACTOR).toFixed(1)} km`;
    }

    const lines = [
        '🚖 *Cab Booking Enquiry — MS Cabs Mangalore*',
        '━━━━━━━━━━━━━━━━━━━━',
        `👤 *Name:* ${data.name}`,
        `📱 *Phone:* ${data.phone}`,
        `🏷 *Service:* ${data.serviceType || 'Not specified'}`,
        `🚗 *Vehicle:* ${data.vehicleType || 'Any'}`,
        `📍 *Pickup:* ${data.pickupAddress}`,
        `🏁 *Drop:* ${data.destination}`,
        `🗓 *Date:* ${data.date}`,
        `⏰ *Time:* ${data.time}`
    ];

    if (estDist) {
        lines.push(`📏 *Est. Distance:* ~${estDist}`);
    }
    if (data.comments) {
        lines.push(`💬 *Notes / Requests:* ${data.comments}`);
    }
    if (data.pickupMapUrl) {
        lines.push(`📍 *Pickup Location Link:* ${data.pickupMapUrl}`);
    }
    if (data.dropMapUrl) {
        lines.push(`🏁 *Drop Location Link:* ${data.dropMapUrl}`);
    }
    if (data.routeMapUrl) {
        lines.push(`🗺 *Driving Route Link:* ${data.routeMapUrl}`);
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push('Please confirm cab availability and share the quotation.');

    const text = lines.join('\n');
    const waUrl = `https://wa.me/916361806210?text=${encodeURIComponent(text)}`;

    // Track Google Analytics conversion event
    if (typeof gtag === 'function') {
        gtag('event', 'generate_lead', {
            event_category: 'Booking',
            event_label: data.serviceType || 'Outstation',
            service_type: data.serviceType,
            vehicle_type: data.vehicleType,
            destination: data.destination
        });
    }

    let popupBlocked = false;
    try {
        const win = window.open(waUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            popupBlocked = true;
        }
    } catch (_) {
        popupBlocked = true;
    }

    showSuccessMessage(waUrl, popupBlocked);
    saveFormDraft();
}

// ── Success toast ──────────────────────────────────────────────────────────────
function showSuccessMessage(waUrl, popupBlocked) {
    let msg = document.querySelector('.success-message');
    if (!msg) {
        msg = document.createElement('div');
        msg.className = 'success-message';
        const f = document.getElementById('bookingForm');
        f.insertBefore(msg, f.firstChild);
    }
    msg.innerHTML = `
        <div class="success-status">
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            <span>${popupBlocked ? 'Action Required: Open WhatsApp' : 'Connecting to WhatsApp Dispatch'}</span>
        </div>
        <p>${popupBlocked
            ? 'Your browser prevented opening a new tab automatically. Click the button below to send your booking directly on WhatsApp:'
            : 'Your booking enquiry is formatted. If WhatsApp did not launch automatically, click the button below to confirm with our Mangalore team:'
        }</p>
        <div class="success-actions">
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-block">
                <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
                <span>Open in WhatsApp</span>
            </a>
        </div>
    `;
    msg.classList.add('show');
    msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
