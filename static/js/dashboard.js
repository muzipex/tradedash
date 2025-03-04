document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const configForm = document.getElementById('config-form');
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    // Initialize WebSocket connection
    wsManager.connect();

    // Toggle password visibility
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.innerHTML = type === 'password' ? 
            '<i class="fas fa-eye"></i>' : 
            '<i class="fas fa-eye-slash"></i>';
    });

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Handle server type selection
    const demoServer = document.getElementById('demoServer');
    const liveServer = document.getElementById('liveServer');
    const serverInput = document.getElementById('server');

    function updateServerPlaceholder() {
        const isDemoSelected = demoServer.checked;
        serverInput.placeholder = isDemoSelected ? 'e.g., MetaQuotes-Demo' : 'e.g., MetaQuotes-Live';
    }

    demoServer.addEventListener('change', updateServerPlaceholder);
    liveServer.addEventListener('change', updateServerPlaceholder);

    // Enhanced form validation
    const validateForm = (form) => {
        const serverType = form.querySelector('input[name="serverType"]:checked').value;
        const serverValue = serverInput.value.toLowerCase();

        // Validate server format based on type
        const isValidServer = serverType === 'demo' ? 
            /^(metaquotes-demo|mt5demo)/i.test(serverValue) :
            /^(metaquotes-live|mt5live)/i.test(serverValue);

        if (!isValidServer) {
            serverInput.setCustomValidity(`Please enter a valid ${serverType} server address`);
        } else {
            serverInput.setCustomValidity('');
        }

        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return false;
        }
        return true;
    };

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validateForm(loginForm)) return;

        const loginData = {
            accountId: document.getElementById('accountId').value,
            password: document.getElementById('password').value,
            server: document.getElementById('server').value,
            serverType: document.querySelector('input[name="serverType"]:checked').value
        };

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const data = await response.json();

            if (response.ok) {
                loginSection.style.display = 'none';
                dashboardSection.style.display = 'block';
                loadDashboardData();
                wsManager.showNotification('Successfully connected to MT5');
            } else {
                wsManager.showNotification(data.message || 'Failed to connect to MT5');
            }
        } catch (error) {
            console.error('Login error:', error);
            wsManager.showNotification('Failed to connect to server');
        }
    });

    // Handle configuration form submission
    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const configData = {
            riskPerTrade: parseFloat(document.getElementById('riskPerTrade').value),
            stopLoss: parseInt(document.getElementById('stopLoss').value),
            takeProfit: parseFloat(document.getElementById('takeProfit').value),
            enabled: document.getElementById('botEnabled').checked
        };

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(configData)
            });

            if (response.ok) {
                wsManager.showNotification('Configuration updated successfully');
            } else {
                const data = await response.json();
                wsManager.showNotification(data.message || 'Failed to update configuration');
            }
        } catch (error) {
            console.error('Config update error:', error);
            wsManager.showNotification('Failed to update configuration');
        }
    });

    // Load dashboard data
    async function loadDashboardData() {
        try {
            // Load configuration
            const configResponse = await fetch('/api/config');
            if (configResponse.ok) {
                const config = await configResponse.json();
                document.getElementById('riskPerTrade').value = config.riskPerTrade;
                document.getElementById('stopLoss').value = config.stopLoss;
                document.getElementById('takeProfit').value = config.takeProfit;
                document.getElementById('botEnabled').checked = config.enabled;
            }

            // Load trades
            const tradesResponse = await fetch('/api/trades');
            if (tradesResponse.ok) {
                const trades = await tradesResponse.json();
                updateTradeHistory(trades);
                chartManager.updatePerformanceChart(trades);
            }

            // Load metrics
            const metricsResponse = await fetch('/api/metrics');
            if (metricsResponse.ok) {
                const metrics = await metricsResponse.json();
                updateMetrics(metrics);
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            wsManager.showNotification('Failed to load dashboard data');
        }
    }

    function updateMetrics(metrics) {
        document.getElementById('winRate').textContent = `${metrics.winRate}%`;
        document.getElementById('profitFactor').textContent = metrics.profitFactor.toFixed(2);
        document.getElementById('drawdown').textContent = `${metrics.drawdown}%`;
    }

    function updateTradeHistory(trades) {
        const tbody = document.getElementById('trade-history');
        const tradesHTML = Array.isArray(trades) ? trades : [trades];

        tradesHTML.forEach(trade => {
            const row = document.createElement('tr');
            const profitClass = trade.profit > 0 ? 'trade-profit-positive' : 'trade-profit-negative';
            const statusClass = trade.status === 'OPEN' ? 'bg-success' : 'bg-secondary';

            row.innerHTML = `
                <td>${trade.id}</td>
                <td>${trade.symbol}</td>
                <td>${trade.type}</td>
                <td>${trade.openPrice}</td>
                <td>${trade.closePrice || '-'}</td>
                <td>${trade.volume}</td>
                <td class="${profitClass}">
                    ${trade.profit ? trade.profit.toFixed(2) : '-'}
                </td>
                <td>
                    <span class="badge ${statusClass}">
                        ${trade.status}
                    </span>
                </td>
                <td>${new Date(trade.openTime).toLocaleString()}</td>
                <td>${trade.closeTime ? new Date(trade.closeTime).toLocaleString() : '-'}</td>
            `;
            tbody.insertBefore(row, tbody.firstChild);
        });
    }

    // Refresh dashboard data periodically
    setInterval(loadDashboardData, 60000);
});