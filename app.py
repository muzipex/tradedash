from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
import pandas as pd
import time
import json
from datetime import datetime, timezone
import requests
import logging
import os
import threading
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Flask app with CORS
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {"origins": "*"},
    r"/ws/*": {"origins": "*"}
})

# Set the secret key
app.secret_key = os.environ.get("SESSION_SECRET")

# Configure SQLAlchemy
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# Initialize SocketIO with proper configuration
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    path="/ws",
    logger=True,
    engineio_logger=True,
    async_mode='gevent'
)

# Trading Configurations
TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN', "")
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', "")
SYMBOLS = ["", "", "USDJPYm", "EURJPYm"]
TIMEFRAMES = ["M1", "M5", "M15"]
RISK_PERCENTAGE = 10
STOP_LOSS_PIPS = 50
TARGET_PROFIT_DOLLARS = 1
SESSION_FILTER = [(5, 17)]

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.String(50), unique=True, nullable=False)
    server = db.Column(db.String(100), nullable=False)
    last_login = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    bots = db.relationship('Bot', backref='user', lazy=True)

class Bot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    symbol = db.Column(db.String(20), nullable=False)
    risk_per_trade = db.Column(db.Float, default=RISK_PERCENTAGE)
    stop_loss = db.Column(db.Integer, default=STOP_LOSS_PIPS)
    take_profit = db.Column(db.Float, default=TARGET_PROFIT_DOLLARS)
    enabled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class MT5SMCBot:
    def __init__(self, login, password, server):
        self.login = login
        self.password = password
        self.server = server
        self.connected = False
        self.trades = []
        self.config = {
            "symbol": "USDJPYm",
            "riskPerTrade": RISK_PERCENTAGE,
            "stopLoss": STOP_LOSS_PIPS,
            "takeProfit": TARGET_PROFIT_DOLLARS,
            "enabled": False
        }
        self.monitoring = False
        self.balance = 10000.0

    def validate_mobile_server(self):
        """Validate if the server address matches mobile MT5 format"""
        server_lower = self.server.lower()
        valid_prefixes = ['metaquotes', 'mt5demo', 'mt5live']
        return any(server_lower.startswith(prefix) for prefix in valid_prefixes)

    def connect(self):
        """Mobile MT5 connection"""
        logger.info(f"Attempting mobile MT5 connection to {self.server} with account {self.login}")

        if not self.validate_mobile_server():
            logger.error("Invalid mobile MT5 server format")
            return False

        try:
            # Here you would implement the actual MT5 mobile connection logic
            # For example, make an HTTP request to MT5 mobile's local API endpoint
            self.connected = True
            logger.info("Successfully connected to mobile MT5")

            socketio.emit('status_update', {
                'type': 'status_update',
                'connected': True,
                'message': 'Connected to mobile MT5'
            })

            return True

        except Exception as e:
            logger.error(f"Failed to connect to mobile MT5: {str(e)}")
            return False

    def get_market_data(self, symbol, timeframe, count=50):
        if not self.connected:
            logger.error("Not connected to mobile MT5")
            return None

        try:
            # Here you would implement actual MT5 mobile data fetching
            # For demo, we'll generate sample data
            now = datetime.now()
            dates = pd.date_range(end=now, periods=count, freq='1min')

            base_price = 150.0 if symbol == "USDJPYm" else 165.0
            price = base_price + np.random.normal(0, 0.02, count).cumsum()

            df = pd.DataFrame({
                'time': dates,
                'open': price,
                'high': price + np.random.uniform(0, 0.03, count),
                'low': price - np.random.uniform(0, 0.03, count),
                'close': price + np.random.normal(0, 0.02, count)
            })

            return df

        except Exception as e:
            logger.error(f"Failed to get market data: {str(e)}")
            return None

    def detect_smc_trend(self, df):
        """Smart Money Concepts trend detection"""
        if df is None or df.empty:
            return None

        highs = df["high"].values
        lows = df["low"].values
        closes = df["close"].values

        if len(highs) < 2 or len(lows) < 2 or len(closes) < 2:
            return None

        if highs[-1] > highs[-2] and lows[-1] > lows[-2]:
            return "BUY"
        elif highs[-1] < highs[-2] and lows[-1] < lows[-2]:
            return "SELL"

        if closes[-1] > highs[-2]:
            return "SELL"
        elif closes[-1] < lows[-2]:
            return "BUY"

        return None

    def calculate_lot_size(self, risk_percentage, stop_loss_pips, symbol):
        if not self.connected:
            return 0

        try:
            risk_amount = (risk_percentage / 100) * self.balance
            lot_size = round(risk_amount / (stop_loss_pips * 10), 2)

            min_volume = 0.01
            max_volume = 10.0

            return max(min_volume, min(lot_size, max_volume))

        except Exception as e:
            logger.error(f"Failed to calculate lot size: {str(e)}")
            return 0

    def place_trade(self, symbol, trade_type, lot_size):
        if not self.connected:
            logger.error("Not connected to mobile MT5")
            return None

        try:
            market_data = self.get_market_data(symbol, "M1", 1)
            if market_data is None or market_data.empty:
                logger.error("Failed to get market data for trade placement")
                return None

            current_price = float(market_data['close'].iloc[-1])

            trade = {
                "id": len(self.trades) + 1,
                "symbol": symbol,
                "type": trade_type,
                "openPrice": str(current_price),
                "closePrice": None,
                "volume": str(lot_size),
                "profit": None,
                "status": "OPEN",
                "openTime": datetime.now(timezone.utc).isoformat(),
                "closeTime": None
            }

            self.trades.append(trade)
            logger.info(f"Trade executed: {trade_type} {symbol} - Lot: {lot_size}")
            self.send_telegram_alert(f"Trade executed: {trade_type} {symbol} - Lot: {lot_size}")

            socketio.emit('trade_update', {
                "type": "trade_update",
                "trade": trade
            })

            return trade

        except Exception as e:
            logger.error(f"Failed to place trade: {str(e)}")
            return None

    def send_telegram_alert(self, message):
        if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
            return

        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message}
        try:
            requests.post(url, data=json.dumps(payload), headers={"Content-Type": "application/json"})
        except Exception as e:
            logger.error(f"Failed to send Telegram alert: {e}")

    def is_valid_session(self):
        now = datetime.now(timezone.utc)
        for start_hour, end_hour in SESSION_FILTER:
            if start_hour <= now.hour <= end_hour:
                return True
        return False

    def monitor_trades(self):
        self.monitoring = True
        while self.monitoring and self.config["enabled"]:
            if not self.is_valid_session():
                logger.info("Outside trading session. Waiting...")
                time.sleep(300)
                continue

            for symbol in SYMBOLS:
                for timeframe in TIMEFRAMES:
                    if not self.config["enabled"]:
                        break

                    df = self.get_market_data(symbol, timeframe)
                    if df is not None:
                        decision = self.detect_smc_trend(df)
                        if decision:
                            lot_size = self.calculate_lot_size(
                                self.config["riskPerTrade"],
                                self.config["stopLoss"],
                                symbol
                            )
                            self.place_trade(symbol, decision, lot_size)
                        else:
                            logger.info(f"No trade signal for {symbol} on timeframe {timeframe}")

            time.sleep(60)

    def get_metrics(self):
        closed_trades = [t for t in self.trades if t["status"] == "CLOSED"]
        winning_trades = [t for t in closed_trades if t["profit"] and float(t["profit"]) > 0]

        total_trades = len(closed_trades)
        win_rate = (len(winning_trades) / total_trades * 100) if total_trades > 0 else 0
        profit_factor = sum(float(t["profit"]) for t in winning_trades) if winning_trades else 0
        max_drawdown = abs(min((float(t["profit"]) for t in closed_trades), default=0))

        return {
            "totalTrades": len(self.trades),
            "winRate": round(win_rate, 2),
            "profitFactor": round(profit_factor, 2),
            "drawdown": round(max_drawdown, 2)
        }

# Create bot instance and store mapping
bots = {}

@app.route('/')
def index():
    """Serve the main application page"""
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    """Handle mobile MT5 login and start bot"""
    try:
        data = request.json
        logger.info(f"Mobile MT5 login attempt from {data.get('server')} with account {data.get('accountId')}")

        # Validate server address format
        server = data.get('server', '').lower()
        if not any(env in server for env in ['demo', 'test', 'live']):
            return jsonify({"message": "Please specify if this is a demo or live MT5 mobile server"}), 400

        # Add warning for live server connections
        if 'live' in server:
            logger.warning(f"Attempting to connect to live MT5 server with account {data.get('accountId')}")

        # Create or update user
        user = User.query.filter_by(account_id=data['accountId']).first()
        if not user:
            user = User(account_id=data['accountId'], server=server)
            db.session.add(user)
        else:
            user.last_login = datetime.utcnow()
            user.server = server
        db.session.commit()

        # Create and store bot instance
        bot_key = f"{data['accountId']}_{server}"
        bot = MT5SMCBot(data['accountId'], data['password'], server)
        success = bot.connect()

        if success:
            bots[bot_key] = bot
            session['current_bot'] = bot_key

            # Start the trade monitoring thread
            monitor_thread = threading.Thread(target=bot.monitor_trades, daemon=True)
            monitor_thread.start()

            logger.info("MT5 mobile login successful")
            return jsonify({"message": "Connected successfully to MT5 mobile"})

        logger.error("MT5 mobile login failed")
        return jsonify({"message": "Connection to MT5 mobile failed"}), 401

    except Exception as e:
        logger.error(f"MT5 mobile login error: {str(e)}")
        return jsonify({"message": "Failed to connect to MT5 mobile trading server"}), 500

def get_current_bot():
    """Helper function to get current bot instance"""
    bot_key = session.get('current_bot')
    if not bot_key or bot_key not in bots:
        return None
    return bots[bot_key]

@app.route('/api/trades', methods=['GET'])
def get_trades():
    bot = get_current_bot()
    if not bot or not bot.connected:
        return jsonify({"message": "Not connected to trading server"}), 401
    return jsonify(bot.trades)

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    bot = get_current_bot()
    if not bot or not bot.connected:
        return jsonify({"message": "Not connected to trading server"}), 401
    return jsonify(bot.get_metrics())

@app.route('/api/config', methods=['GET'])
def get_config():
    bot = get_current_bot()
    if not bot or not bot.connected:
        return jsonify({"message": "Not connected to trading server"}), 401
    return jsonify(bot.config)

@app.route('/api/config', methods=['POST'])
def update_config():
    bot = get_current_bot()
    if not bot or not bot.connected:
        return jsonify({"message": "Not connected to trading server"}), 401

    data = request.json
    bot.config.update(data)
    return jsonify(bot.config)

# Handle WebSocket connection
@socketio.on('connect')
def handle_connect():
    logger.info('Client connected via WebSocket')

    # Send an MT5 initialization request to the frontend
    emit('mt5_init_request', {'message': 'Requesting MT5 initialization'})

# Handle MT5 initialization response from the frontend
@socketio.on('mt5_init_response')
def handle_mt5_init_response(data):
    logger.info(f"Received MT5 initialization response: {data}")
    # Here you can handle the initialization with the received data (e.g., login to MT5)
    
    # Assuming you're checking the credentials or performing actions
    if data.get('server') and data.get('accountId') and data.get('password'):
        logger.info("MT5 initialization successful")
        emit('status_update', {
            'connected': True,
            'message': 'MT5 initialized successfully'
        })
    else:
        logger.error("MT5 initialization failed. Missing credentials.")
        emit('status_update', {
            'connected': False,
            'message': 'MT5 initialization failed. Invalid credentials.'
        })

# Handle WebSocket disconnection
@socketio.on('disconnect')
def handle_disconnect():
    logger.info('Client disconnected from WebSocket')
    # Additional logic can go here to handle any necessary clean-up actions
# Create database tables
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, 
                host='0.0.0.0', 
                port=port,
                debug=False,  # Disable debug mode in production
                cors_allowed_origins='*',  # Configure CORS for production
                allow_unsafe_werkzeug=True)  # Required for deployment
