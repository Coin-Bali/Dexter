"use client";

import React, { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

const MAX_DATA_POINTS = 100;

type PricePoint = {
  label: string;
  value: number;
};

const PriceChart: React.FC = () => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);

  useEffect(() => {
    if (chartRef.current) {
      chartInstance.current?.destroy();
      const ctx = chartRef.current.getContext("2d");
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: "line",
          data: {
            labels: [],
            datasets: [
              {
                label: "ETH/BTC Price",
                data: [],
                borderColor: "rgb(75, 192, 192)",
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
                  text: "Time",
                },
              },
              y: {
                title: {
                  display: true,
                  text: "Price (BTC)",
                },
              },
            },
            plugins: {
              tooltip: {
                mode: "index",
                intersect: false,
              },
            },
          },
        });
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchPriceData = async () => {
      try {
        const response = await fetch("/api/price/ETH-BTC", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const newPrice = Number.parseFloat(data.price);
        if (!Number.isFinite(newPrice) || cancelled) {
          return;
        }

        setCurrentPrice(newPrice);
        setError(null);
        setPriceHistory(previous => {
          const next = [
            ...previous,
            {
              label: new Date().toLocaleTimeString(),
              value: newPrice,
            },
          ];

          return next.slice(-MAX_DATA_POINTS);
        });
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error("Failed to fetch price data:", err);
        setError(
          `Failed to fetch price data: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    fetchPriceData();
    const intervalId = setInterval(fetchPriceData, 10000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const chart = chartInstance.current;
    const dataset = chart?.data.datasets[0];

    if (!chart || !dataset) {
      return;
    }

    chart.data.labels = priceHistory.map(point => point.label);
    dataset.data = priceHistory.map(point => point.value);
    chart.update();
  }, [priceHistory]);

  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Market Snapshot</p>
          <h2 className="panel-title">ETH/BTC live chart</h2>
        </div>
      </div>
      {error && <div className="inline-error">Error: {error}</div>}
      <p className="chart-price">
        {currentPrice !== null
          ? `Current ETH/BTC price: ${currentPrice.toFixed(8)}`
          : "Loading current ETH/BTC price..."}
      </p>
      <div className="chart-canvas-wrap">
        <canvas ref={chartRef}></canvas>
      </div>
    </section>
  );
};

export default PriceChart; 