class WebSocketManager {
    constructor() {
        this.socket = io('https://tradedash.onrender.com', {
            path: '/ws',
            transports: ['websocket']
        });

        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.socket.on('connect', () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);
            console.log('WebSocket connected');

            // Request MT5 login immediately after connecting
            this.sendMT5Credentials();
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this.updateConnectionStatus(false);
            this.attemptReconnect();
            console.log('WebSocket disconnected');
        });

        // Backend asks for MT5 credentials
        this.socket.on('mt5_init_request', () => {
            console.log('Received MT5 init request from backend');
            this.sendMT5Credentials();
        });

        // Status updates from the backend
        this.socket.on('status', (data) => {
            console.log(`Status update: ${data.message}`);
            this.showNotification(data.message);
        });

        // Trade updates from the backend
        this.socket.on('trade_update', (data) => {
            if (data.type === 'trade_update') {
                this.updateTradeHistory(data.trade);
                this.showNotification(`New trade: ${data.trade.type} ${data.trade.symbol}`);
            }
        });
    }

    sendMT5Credentials() {
        const accountId = document.getElementById('accountId').value;
        const password = document.getElementById('password').value;
        const server = document.getElementById('server').value;

        if (!accountId || !password || !server) {
            console.error('Missing MT5 login credentials');
            return;
        }

        console.log('Sending MT5 credentials to backend...');
        this.socket.emit('mt5_init_response', {
            account_id: accountId,
            password: password,
            server: server
        });
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
                this.socket.connect();
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
