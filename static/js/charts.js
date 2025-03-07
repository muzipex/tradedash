class ChartManager {
    constructor() {
        this.performanceChart = null;
        this.initializeCharts();
    }

    initializeCharts() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        this.performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Account Balance',
                    data: [],
                    borderColor: '#00ff9d',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#ffffff'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                }
            }
        });
    }

    updatePerformanceChart(trades) {
        const dates = trades.map(trade => new Date(trade.openTime).toLocaleDateString());
        const balances = trades.map((trade, index) => {
            const previousTrades = trades.slice(0, index + 1);
            return previousTrades.reduce((acc, t) => acc + (parseFloat(t.profit) || 0), 10000);
        });

        this.performanceChart.data.labels = dates;
        this.performanceChart.data.datasets[0].data = balances;
        this.performanceChart.update();
    }
}

const chartManager = new ChartManager();
