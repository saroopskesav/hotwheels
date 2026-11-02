"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CollectionCar } from "@/lib/types";

const palette = ["#fb593e", "#58b4d7", "#c4d15b", "#64b998", "#d49870", "#8e9bb0"];

export default function AnalyticsView({ cars }: { cars: CollectionCar[] }) {
  const units = cars.reduce((sum, car) => sum + car.quantity, 0);
  const spend = cars.reduce((sum, car) => sum + car.quantity * car.purchasePrice, 0);
  const seriesData = aggregate(cars, (car) => car.series).slice(0, 7);
  const makerData = aggregate(cars, (car) => car.manufacturer).slice(0, 6);
  const yearData = aggregate(cars, (car) => String(car.modelYear)).sort((a, b) => Number(a.name) - Number(b.name)).slice(-8);
  const monthData = new Map<string, number>();
  for (const car of cars) {
    const date = new Date(`${car.addedAt}T12:00:00`);
    const month = Number.isNaN(date.valueOf()) ? "Unknown" : date.toLocaleString("en-CA", { month: "short", year: "2-digit" });
    monthData.set(month, (monthData.get(month) ?? 0) + car.quantity);
  }
  const addedData = Array.from(monthData, ([name, added]) => ({ name, added })).reverse().slice(-8);
  const treasureData = [
    { name: "Regular castings", value: cars.filter((car) => !car.isTreasureHunt && !car.isSuperTreasureHunt).reduce((sum, car) => sum + car.quantity, 0) },
    { name: "Treasure Hunts", value: cars.filter((car) => car.isTreasureHunt && !car.isSuperTreasureHunt).reduce((sum, car) => sum + car.quantity, 0) },
    { name: "Super Treasure Hunts", value: cars.filter((car) => car.isSuperTreasureHunt).reduce((sum, car) => sum + car.quantity, 0) },
  ].filter((item) => item.value > 0);
  const duplicates = cars.reduce((sum, car) => sum + Math.max(0, car.quantity - 1), 0);

  return <section className="page-content analytics-content">
    <div className="preview-notice"><span className="notice-indicator" /><span><strong>Collection insights</strong> &nbsp;Calculated from {cars.length} saved models and {units} total cars. Values use recorded purchase prices.</span></div>
    <div className="analytics-intro"><div><span className="eyebrow">COLLECTOR INTELLIGENCE</span><h2>Collection insights</h2><p>Patterns from the castings you’ve brought home.</p></div><span className="analytics-stamp">YOUR DATA ONLY <i>·</i> NO MARKET ESTIMATES</span></div>
    <div className="analytics-kpis"><article><span>TOTAL CARS</span><b>{units.toLocaleString()}</b><small>Across {cars.length} unique entries</small></article><article><span>UNIQUE MODELS</span><b>{cars.length.toLocaleString()}</b><small>Active garage records</small></article><article><span>RECORDED PURCHASE VALUE</span><b>${spend.toFixed(2)}</b><small>Based on your purchase prices · CAD</small></article><article><span>DUPLICATE UNITS</span><b>{duplicates.toLocaleString()}</b><small>Additional copies in your garage</small></article></div>
    <div className="analytics-chart-grid">
      <ChartPanel eyebrow="BY SERIES" title="Where your collection lives" className="wide-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={seriesData} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}><CartesianGrid stroke="#2b3232" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#919b95", fontSize: 9 }} axisLine={false} tickLine={false} interval={0} /><YAxis allowDecimals={false} tick={{ fill: "#78827d", fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#ffffff08" }} contentStyle={{ background: "#1c2221", border: "1px solid #3b4441", borderRadius: 5, color: "#e5e9e3", fontSize: 10 }} /><Bar dataKey="value" name="Cars" fill="#fb593e" radius={[3, 3, 0, 0]} maxBarSize={33} /></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel eyebrow="RARE FINDS" title="Treasure distribution"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={treasureData.length ? treasureData : [{ name: "No treasure finds yet", value: 1 }]} dataKey="value" nameKey="name" innerRadius="57%" outerRadius="79%" paddingAngle={4} stroke="none">{(treasureData.length ? treasureData : [{ name: "No treasure finds yet", value: 1 }]).map((entry, index) => <Cell key={entry.name} fill={treasureData.length ? palette[index] : "#353d3c"} />)}</Pie><Tooltip contentStyle={{ background: "#1c2221", border: "1px solid #3b4441", borderRadius: 5, color: "#e5e9e3", fontSize: 10 }} /><Legend verticalAlign="bottom" height={34} iconType="circle" iconSize={6} formatter={(value) => <span style={{ color: "#a5aea8", fontSize: 8 }}>{value}</span>} /></PieChart></ResponsiveContainer></ChartPanel>
      <ChartPanel eyebrow="BY MANUFACTURER" title="Makes on your shelf"><ResponsiveContainer width="100%" height="100%"><BarChart data={makerData} layout="vertical" margin={{ top: 5, right: 12, bottom: 2, left: 12 }}><CartesianGrid stroke="#2b3232" strokeDasharray="3 4" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: "#78827d", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={79} tick={{ fill: "#a6afa9", fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#1c2221", border: "1px solid #3b4441", borderRadius: 5, color: "#e5e9e3", fontSize: 10 }} /><Bar dataKey="value" name="Cars" fill="#58b4d7" radius={[0, 3, 3, 0]} maxBarSize={17} /></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel eyebrow="MODEL YEAR" title="Castings by release year"><ResponsiveContainer width="100%" height="100%"><BarChart data={yearData} margin={{ top: 8, right: 8, bottom: 3, left: -22 }}><CartesianGrid stroke="#2b3232" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#919b95", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#78827d", fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#1c2221", border: "1px solid #3b4441", borderRadius: 5, color: "#e5e9e3", fontSize: 10 }} /><Bar dataKey="value" name="Cars" fill="#c4d15b" radius={[3, 3, 0, 0]} maxBarSize={32} /></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel eyebrow="ACQUISITIONS" title="Cars added over time" className="wide-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={addedData} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}><CartesianGrid stroke="#2b3232" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#919b95", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#78827d", fontSize: 9 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#1c2221", border: "1px solid #3b4441", borderRadius: 5, color: "#e5e9e3", fontSize: 10 }} /><Bar dataKey="added" name="Cars added" fill="#64b998" radius={[3, 3, 0, 0]} maxBarSize={33} /></BarChart></ResponsiveContainer></ChartPanel>
    </div>
  </section>;
}

function ChartPanel({ eyebrow, title, className = "", children }: { eyebrow: string; title: string; className?: string; children: React.ReactNode }) {
  return <article className={`analytics-chart ${className}`}><div className="panel-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div></div><div className="chart-content">{children}</div></article>;
}

function aggregate(cars: CollectionCar[], label: (car: CollectionCar) => string) {
  const values = new Map<string, number>();
  for (const car of cars) values.set(label(car), (values.get(label(car)) ?? 0) + car.quantity);
  return Array.from(values, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}