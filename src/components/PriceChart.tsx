'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const PriceChart: React.FC = () => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPriceData = useCallback(async () => {
    try {
      const response = await fetch('/api/price/ETH-BTC');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const newPrice = parseFloat(data.price);
      setCurrentPrice(newPrice);

      if (chartInstance.current) {
        const chart = chartInstance.current;
        const now = new Date();
        const formattedTime = now.toLocaleTimeString();

        chart.data.labels?.push(formattedTime);
        chart.data.datasets[0].data.push(newPrice);

        const maxDataPoints = 100;
        if (chart.data.labels && chart.data.labels.length > maxDataPoints) {
          chart.data.labels.shift();
          chart.data.datasets[0].data.shift();
        }
        chart.update();
      }
    } catch (err) {
      console.error("Failed to fetch price data:", err);
      setError(`Failed to fetch price data: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: [],
            datasets: [
              {
                label: 'ETH/BTC Price',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Time',
                },
              },
              y: {
                title: {
                  display: true,
                  text: 'Price (BTC)',
                },
              },
            },
            plugins: {
              tooltip: {
                mode: 'index',
                intersect: false,
              },
            },
          },
        });
      }
    }

    fetchPriceData();

    const intervalId = setInterval(fetchPriceData, 10000);

    return () => {
      clearInterval(intervalId);
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [fetchPriceData]);

  return (
    <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-md">
      {error && <p className="text-red-500 mb-4">Error: {error}</p>}
      <div className="text-2xl font-bold mb-4">
        Current ETH/BTC Price: {currentPrice !== null ? currentPrice.toFixed(8) : 'Loading...'}
      </div>
      <div style={{ height: '400px' }}>
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
};

export default PriceChart; 