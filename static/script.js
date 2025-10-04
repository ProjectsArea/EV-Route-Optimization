// EV Route Navigator - Professional Modern JavaScript

// Global variables
let map;
let currentRouteData = null;
let routeLayers = [];
let isSidebarCollapsed = false;
let isLegendCollapsed = false;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
    initializeFloatingLabels();
    updateBatteryIndicator();
});

// Initialize Leaflet map
function initializeMap() {
    map = L.map('map').setView([17.7, 83.3], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data © OpenStreetMap contributors'
    }).addTo(map);
}

// Initialize all event listeners
function initializeEventListeners() {
    // Form submission
    document.getElementById("routeForm").addEventListener("submit", handleFormSubmit);
    
    // Clear route button
    document.getElementById("clearBtn").addEventListener("click", clearRoute);
    
    // Sidebar toggle
    document.getElementById("sidebarToggle").addEventListener("click", toggleSidebar);
    
    // Legend toggle
    document.getElementById("legendToggle").addEventListener("click", toggleLegend);
    
    // Map controls
    document.getElementById("centerMap").addEventListener("click", centerMapOnRoute);
    document.getElementById("toggleFullscreen").addEventListener("click", toggleFullscreen);
    
    // Input change listeners
    document.getElementById("charge").addEventListener("input", updateBatteryIndicator);
    document.getElementById("range").addEventListener("input", updateBatteryIndicator);
    
    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyboardShortcuts);
}

// Initialize floating labels
function initializeFloatingLabels() {
    const inputs = document.querySelectorAll('.input-container input');
    inputs.forEach(input => {
        // Check if input has value on load
        if (input.value && input.value.trim() !== '') {
            input.classList.add('has-value');
        }
        
        // Add event listeners
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', () => {
            input.parentElement.classList.remove('focused');
            if (input.value && input.value.trim() !== '') {
                input.classList.add('has-value');
            } else {
                input.classList.remove('has-value');
            }
        });
        
        input.addEventListener('input', () => {
            if (input.value && input.value.trim() !== '') {
                input.classList.add('has-value');
            } else {
                input.classList.remove('has-value');
            }
        });
    });
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'Enter':
                e.preventDefault();
                handleFormSubmit(e);
                break;
            case 'r':
                e.preventDefault();
                clearRoute();
                break;
            case 'f':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'l':
                e.preventDefault();
                toggleLegend();
                break;
        }
    }
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    isSidebarCollapsed = !isSidebarCollapsed;
    
    if (isSidebarCollapsed) {
        sidebar.classList.add("collapsed");
    } else {
        sidebar.classList.remove("collapsed");
    }
}

// Toggle legend
function toggleLegend() {
    const legendContent = document.getElementById("legendContent");
    const toggleIcon = document.getElementById("legendToggle").querySelector("i");
    
    isLegendCollapsed = !isLegendCollapsed;
    
    if (isLegendCollapsed) {
        legendContent.classList.add("collapsed");
        toggleIcon.classList.remove("fa-chevron-up");
        toggleIcon.classList.add("fa-chevron-down");
    } else {
        legendContent.classList.remove("collapsed");
        toggleIcon.classList.remove("fa-chevron-down");
        toggleIcon.classList.add("fa-chevron-up");
    }
}

// Update battery indicator
function updateBatteryIndicator() {
    const charge = parseFloat(document.getElementById("charge").value) || 0;
    const batteryLevel = document.getElementById("batteryLevel");
    const batteryIcon = document.getElementById("navBattery").querySelector("i");
    
    batteryLevel.textContent = `${charge}%`;
    
    // Update battery icon
    batteryIcon.className = "fas " + (
        charge > 60 ? "fa-battery-full" :
        charge > 30 ? "fa-battery-half" :
        charge > 10 ? "fa-battery-quarter" : "fa-battery-empty"
    );
    
    // Update color
    const navBattery = document.getElementById("navBattery");
    navBattery.className = "nav-battery " + (
        charge > 60 ? "battery-high" :
        charge > 30 ? "battery-medium" : "battery-low"
    );
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const start = document.getElementById("start").value.trim();
    const end = document.getElementById("end").value.trim();
    const charge = parseFloat(document.getElementById("charge").value);
    const range = parseFloat(document.getElementById("range").value);

    // Validation
    if (!start || !end) {
        showNotification("Please enter both start and destination locations.", "error");
        return;
    }

    if (charge < 0 || charge > 100) {
        showNotification("Battery level must be between 0 and 100%.", "error");
        return;
    }

    if (range < 50 || range > 1000) {
        showNotification("Range must be between 50 and 1000 km.", "error");
        return;
    }

    // Show loading state
    showLoadingState(true);
    
    try {
        const response = await fetch("/plan_route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start, end, charge, range })
        });
        
        const data = await response.json();
        
        if (data.error) {
            showNotification("Error: " + data.error, "error");
            return;
        }

        // Store route data
        currentRouteData = data;
        
        // Clear previous layers
        clearMapLayers();
        
        // Draw route with animations
        await drawAnimatedRoute(data);
        
        // Update route status
        updateRouteStatus(data);
        
        // Show success notification
        showNotification("Route calculated successfully!", "success");
        
    } catch (error) {
        console.error("Error fetching route:", error);
        showNotification("Error fetching route: " + error.message, "error");
    } finally {
        showLoadingState(false);
    }
}

// Show/hide loading state
function showLoadingState(show) {
    const loadingOverlay = document.getElementById("loadingOverlay");
    const planBtn = document.getElementById("planBtn");
    const btnSpinner = document.getElementById("btnSpinner");
    
    if (show) {
        loadingOverlay.classList.add("active");
        planBtn.disabled = true;
        btnSpinner.classList.add("active");
    } else {
        loadingOverlay.classList.remove("active");
        planBtn.disabled = false;
        btnSpinner.classList.remove("active");
    }
}

// Clear route and reset UI
function clearRoute() {
    clearMapLayers();
    currentRouteData = null;
    
    // Hide route status
    document.getElementById("routeStatus").style.display = "none";
    
    // Reset form
    document.getElementById("start").value = "Visakhapatnam";
    document.getElementById("end").value = "Hyderabad";
    document.getElementById("charge").value = "100";
    document.getElementById("range").value = "300";
    
    // Update floating labels
    initializeFloatingLabels();
    updateBatteryIndicator();
    
    showNotification("Route cleared", "info");
}

// Clear all map layers
function clearMapLayers() {
    routeLayers.forEach(layer => {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });
    routeLayers = [];
}

// Draw animated route
async function drawAnimatedRoute(data) {
    const best_coords = data.best_route.coords.map(c => [c[0], c[1]]);
    const battery_profile = data.battery_profile || [];

    // Create enhanced icons
    const startIcon = L.icon({ 
        iconUrl: '/static/icons/start.png', 
        iconSize: [36, 36], 
        iconAnchor: [18, 36],
        className: 'route-marker start-marker'
    });
    
    const endIcon = L.icon({ 
        iconUrl: '/static/icons/end.png', 
        iconSize: [36, 36], 
        iconAnchor: [18, 36],
        className: 'route-marker end-marker'
    });
    
    const chargeRequiredIcon = L.icon({ 
        iconUrl: '/static/icons/plug-red.png', 
        iconSize: [32, 32], 
        iconAnchor: [16, 32],
        className: 'route-marker charging-required-marker'
    });
    
    const chargeNearbyIcon = L.icon({ 
        iconUrl: '/static/icons/plug-orange.png', 
        iconSize: [32, 32], 
        iconAnchor: [16, 32],
        className: 'route-marker charging-nearby-marker'
    });

    // Draw best route with battery gradient and progressive animation
    for (let i = 0; i < best_coords.length - 1; i++) {
        const start_pt = best_coords[i];
        const end_pt = best_coords[i + 1];
        const battery = battery_profile[i];
        
        let color = battery > 60 ? "#059669" : battery > 30 ? "#f59e0b" : "#dc2626";
        
        const polyline = L.polyline([start_pt, end_pt], { 
            color, 
            weight: 6, 
            opacity: 0,
            className: 'route-line'
        }).addTo(map);
        
        // Animate route drawing
        setTimeout(() => {
            polyline.setStyle({ opacity: 0.9 });
        }, i * 30);
        
        routeLayers.push(polyline);
    }

    // Draw alternative routes
    data.all_routes?.forEach((route, index) => {
        if (route === data.best_route) return;
        
        const coords = route.coords.map(c => [c[0], c[1]]);
        const polyline = L.polyline(coords, { 
            color: "#2563eb", 
            weight: 3, 
            dashArray: "10, 10", 
            opacity: 0.6,
            className: 'alternative-route'
        }).addTo(map);
        
        routeLayers.push(polyline);
    });

    // Add start and end markers with enhanced popups
    const startMarker = L.marker(best_coords[0], { icon: startIcon })
        .addTo(map)
        .bindPopup(`
            <div class="marker-popup">
                <h4><i class="fas fa-play-circle"></i> Start Point</h4>
                <p><strong>Location:</strong> ${data.best_route.start || 'Start'}</p>
                <p><strong>Initial Battery:</strong> ${document.getElementById("charge").value}%</p>
            </div>
        `, { className: 'custom-popup' });
    
    const endMarker = L.marker(best_coords[best_coords.length - 1], { icon: endIcon })
        .addTo(map)
        .bindPopup(`
            <div class="marker-popup">
                <h4><i class="fas fa-flag-checkered"></i> Destination</h4>
                <p><strong>Location:</strong> ${data.best_route.end || 'Destination'}</p>
            </div>
        `, { className: 'custom-popup' });
    
    routeLayers.push(startMarker, endMarker);

    // Add required charging stops with staggered animation
    (data.required_stops || []).forEach((stop, index) => {
        setTimeout(() => {
            const marker = L.marker(stop.coords, { icon: chargeRequiredIcon })
                .addTo(map)
                .bindPopup(`
                    <div class="marker-popup charging-stop-popup">
                        <h4><i class="fas fa-charging-station"></i> Required Charging Stop #${index + 1}</h4>
                        <div class="stop-details">
                            <p><strong>Distance since last charge:</strong> ${(stop.distance_from_last || 0).toFixed(1)} km</p>
                            <p><strong>Remaining charge:</strong> ${(stop.remaining_charge || 0).toFixed(1)}%</p>
                            <p><strong>Estimated charging time:</strong> 30-45 minutes</p>
                        </div>
                    </div>
                `, { className: 'custom-popup charging-popup' });
            
            routeLayers.push(marker);
        }, (index + 1) * 200);
    });

    // Add nearby stations with staggered animation
    (data.nearby_stations || []).forEach((station, index) => {
        setTimeout(() => {
            const marker = L.marker(station.coords, { icon: chargeNearbyIcon })
                .addTo(map)
                .bindPopup(`
                    <div class="marker-popup nearby-station-popup">
                        <h4><i class="fas fa-map-marker-alt"></i> ${station.name}</h4>
                        <div class="station-details">
                            <p><strong>Distance from route:</strong> ${(station.distance || 0).toFixed(1)} km</p>
                            <p><strong>Type:</strong> Nearby Charging Station</p>
                            <p><strong>Status:</strong> <span class="status-available">Available</span></p>
                        </div>
                    </div>
                `, { className: 'custom-popup nearby-popup' });
            
            routeLayers.push(marker);
        }, (index + 1) * 150);
    });

    // Fit map to route with padding
    setTimeout(() => {
        const bounds = L.latLngBounds(best_coords);
        map.fitBounds(bounds.pad(0.1));
    }, 500);
}

// Update route status
function updateRouteStatus(data) {
    const statusPanel = document.getElementById("routeStatus");
    const batteryProfile = data.battery_profile || [];
    const requiredStops = data.required_stops || [];
    
    // Calculate arrival battery
    const arrivalBattery = batteryProfile[batteryProfile.length - 1] || 0;
    
    // Update status values
    document.getElementById("arrivalBattery").textContent = `${arrivalBattery.toFixed(1)}%`;
    document.getElementById("chargingStops").textContent = requiredStops.length;
    
    // Update battery color
    const batteryElement = document.getElementById("arrivalBattery");
    batteryElement.className = "status-value " + (
        arrivalBattery > 60 ? "battery-high" :
        arrivalBattery > 30 ? "battery-medium" : "battery-low"
    );
    
    // Update charging stops list
    updateChargingStopsList(requiredStops);
    
    // Show status panel with animation
    statusPanel.style.display = "block";
    statusPanel.classList.add("fade-in");
}

// Update charging stops list
function updateChargingStopsList(stops) {
    const container = document.getElementById("chargingStopsList");
    container.innerHTML = "";
    
    if (stops.length === 0) {
        container.innerHTML = `
            <div class="no-stops">
                <i class="fas fa-check-circle"></i>
                <p>No charging stops required for this route!</p>
            </div>
        `;
        return;
    }
    
    stops.forEach((stop, index) => {
        const stopElement = document.createElement("div");
        stopElement.className = "charging-stop-item";
        stopElement.innerHTML = `
            <div class="stop-icon">
                <i class="fas fa-charging-station"></i>
            </div>
            <div class="stop-info">
                <h4>Charging Stop #${index + 1}</h4>
                <p>Distance: ${(stop.distance_from_last || 0).toFixed(1)} km • Remaining: ${(stop.remaining_charge || 0).toFixed(1)}%</p>
            </div>
        `;
        container.appendChild(stopElement);
    });
}

// Center map on route
function centerMapOnRoute() {
    if (!currentRouteData) {
        showNotification("No route to center on", "info");
        return;
    }
    
    const coords = currentRouteData.best_route.coords.map(c => [c[0], c[1]]);
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds.pad(0.1));
    
    showNotification("Map centered on route", "info");
}

// Toggle fullscreen
function toggleFullscreen() {
    const mapContainer = document.querySelector('.map-container');
    
    if (!document.fullscreenElement) {
        mapContainer.requestFullscreen().then(() => {
            document.getElementById("toggleFullscreen").innerHTML = '<i class="fas fa-compress"></i>';
        });
    } else {
        document.exitFullscreen().then(() => {
            document.getElementById("toggleFullscreen").innerHTML = '<i class="fas fa-expand"></i>';
        });
    }
}

// Show notification
function showNotification(message, type = "info") {
    // Remove existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());
    
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS for enhanced popups
const popupStyles = document.createElement('style');
popupStyles.textContent = `
    .marker-popup h4 {
        color: var(--gray-800);
        margin-bottom: 0.5rem;
        font-size: 1.1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .marker-popup p {
        margin: 0.25rem 0;
        color: var(--gray-600);
        font-size: 0.9rem;
    }
    
    .charging-stop-popup .stop-details {
        background: #fff5f5;
        padding: 0.75rem;
        border-radius: 6px;
        border-left: 3px solid var(--danger);
        margin-top: 0.5rem;
    }
    
    .nearby-station-popup .station-details {
        background: #fff8e1;
        padding: 0.75rem;
        border-radius: 6px;
        border-left: 3px solid var(--warning);
        margin-top: 0.5rem;
    }
    
    .status-available {
        color: var(--success);
        font-weight: 600;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
`;
document.head.appendChild(popupStyles);