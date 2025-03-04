class WebSocketManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        this.socket = io('https://tradedash.onrender.com', { // Ensure the correct backend URL
            path: '/ws',
            transports: ['websocket']
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.socket.on('connect', () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);
            console.log('WebSocket connected');
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this.updateConnectionStatus(false);
            this.attemptReconnect();
            console.log('WebSocket disconnected');
        });

        // Handle MT5 Initialization Request
        this.socket.on('mt5_init_request', (data) => {
            console.log(data.message); // Log the message or show it as a notification
            this.initiateMT5Login();  // Initiates the MT5 login process
        });

        this.socket.on('status_update', (data) => {
            this.updateConnectionStatus(data.connected);
            this.showNotification(data.message);
        });

        this.socket.on('trade_update', (data) => {
            if (data.type === 'trade_update') {
                updateTradeHistory(data.trade);
                this.showNotification(`New trade: ${data.trade.type} ${data.trade.symbol}`);
            }
        });
    }

    initiateMT5Login() {
        // Collect the MT5 credentials from the form
        const server = document.getElementById('server').value;
        const accountId = document.getElementById('accountId').value;
        const password = document.getElementById('password').value;

        // Send the MT5 login details to the backend
        this.socket.emit('mt5_init_response', {
            server: server,
            accountId: accountId,
            password: password
        });

        console.log('MT5 Initialization started with server:', server);
    }

    updateConnectionStatus(connected) {
        const badge = document.getElementById('connection-badge');
        if (connected) {
            badge.textContent = 'Connected';
            badge.classList.remove('bg-danger');
            badge.classList.add('bg-success', 'connected');
        } else {
            badge.textContent = 'Disconnected';
            badge.classList.remove('bg-success', 'connected');
            badge.classList.add('bg-danger');
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.reconnectAttempts++;
                console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                this.connect();
            }, 5000);
        }
    }

    showNotification(message) {
        const toast = new bootstrap.Toast(document.getElementById('notification-toast'));
        document.querySelector('.toast-body').textContent = message;
        toast.show();
    }
}

const wsManager = new WebSocketManager();
