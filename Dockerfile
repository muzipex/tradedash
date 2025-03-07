FROM python:3.10-slim

# Install necessary build tools
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the requirements file
COPY requirements.txt .

# Install the dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 5000

# Start the application
CMD ["gunicorn", "-w", "4", "-k", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker", "TradeBotDash.app:app"]
