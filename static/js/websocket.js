class WebSocketManager {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        this.socket = io('https://your-backend-url.com', {  // Update this URL
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

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connected = false;
            this.updateConnectionStatus(false);
            console.log('WebSocket manually disconnected');
        }
    }
}

const wsManager = new WebSocketManager();
// Example usage of the new disconnect method
// wsManager.disconnect();
