"use client";

import { ChefHat } from "lucide-react";

export type TableData = {
  id: string;
  name: string;
  capacity: number;
  shape: "SQUARE" | "ROUND" | "RECTANGLE" | "BAR";
  width: number;
  height: number;
  rotation: number;
  posX: number;
  posY: number;
  status?: "FREE" | "OCCUPIED" | "READY_TO_BILL";
  totalCents?: number;
  minutesElapsed?: number;
  pendingKitchen?: number;
  itemCount?: number;
};

const STATUS_FILL = {
  FREE: "#dcfce7",        // green-100
  OCCUPIED: "#fef3c7",    // amber-100
  READY_TO_BILL: "#fee2e2", // red-100
};
const STATUS_STROKE = {
  FREE: "#16a34a",
  OCCUPIED: "#d97706",
  READY_TO_BILL: "#dc2626",
};
const STATUS_TEXT = {
  FREE: "#166534",
  OCCUPIED: "#92400e",
  READY_TO_BILL: "#991b1b",
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(cents / 100);

type Props = {
  table: TableData;
  selected?: boolean;
  editable?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
};

export function TableShape({ table: t, selected, editable, onMouseDown, onClick }: Props) {
  const status = t.status ?? "FREE";
  const fill = STATUS_FILL[status];
  const stroke = STATUS_STROKE[status];
  const textColor = STATUS_TEXT[status];

  const cx = t.width / 2;
  const cy = t.height / 2;
  const transform = `translate(${t.posX} ${t.posY}) rotate(${t.rotation} ${cx} ${cy})`;
  const cursor = editable ? "move" : "pointer";

  // Forma base (rectángulo, círculo, etc.)
  let shapeEl: React.ReactNode;
  switch (t.shape) {
    case "ROUND":
      shapeEl = (
        <ellipse
          cx={cx}
          cy={cy}
          rx={t.width / 2}
          ry={t.height / 2}
          fill={fill}
          stroke={selected ? "#2563eb" : stroke}
          strokeWidth={selected ? 3 : 2}
        />
      );
      break;
    case "BAR":
      shapeEl = (
        <rect
          width={t.width}
          height={t.height}
          rx={t.height / 2}
          ry={t.height / 2}
          fill={fill}
          stroke={selected ? "#2563eb" : stroke}
          strokeWidth={selected ? 3 : 2}
        />
      );
      break;
    case "RECTANGLE":
    case "SQUARE":
    default:
      shapeEl = (
        <rect
          width={t.width}
          height={t.height}
          rx={8}
          ry={8}
          fill={fill}
          stroke={selected ? "#2563eb" : stroke}
          strokeWidth={selected ? 3 : 2}
        />
      );
  }

  // Pulso animado si está lista para cobrar
  const isPulsing = status === "READY_TO_BILL";

  return (
    <g
      transform={transform}
      style={{ cursor }}
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={isPulsing ? "animate-pulse" : ""}
    >
      {shapeEl}

      {/* Nombre mesa centrado */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        style={{ fontSize: Math.min(t.width, t.height) > 100 ? 18 : 14, fontWeight: 700 }}
      >
        {t.name}
      </text>

      {/* Capacidad debajo */}
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        style={{ fontSize: 10, opacity: 0.7 }}
      >
        cap. {t.capacity}
      </text>

      {/* Total $ si tiene orden */}
      {t.totalCents !== undefined && t.totalCents > 0 && (
        <text
          x={cx}
          y={cy + 24}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          style={{ fontSize: 9, fontWeight: 600 }}
        >
          {fmt(t.totalCents)}
        </text>
      )}

      {/* Tiempo en esquina */}
      {t.minutesElapsed !== undefined && t.minutesElapsed > 0 && (
        <text
          x={6}
          y={14}
          fill={t.minutesElapsed > 90 ? "#dc2626" : textColor}
          style={{ fontSize: 9, fontWeight: t.minutesElapsed > 90 ? 700 : 400 }}
        >
          {t.minutesElapsed}m
        </text>
      )}

      {/* Indicador cocina pendiente */}
      {t.pendingKitchen !== undefined && t.pendingKitchen > 0 && (
        <g transform={`translate(${t.width - 18} 4)`}>
          <circle cx={6} cy={6} r={8} fill="#f59e0b" />
          <text x={6} y={6} textAnchor="middle" dominantBaseline="middle" fill="white" style={{ fontSize: 9, fontWeight: 700 }}>
            {t.pendingKitchen}
          </text>
        </g>
      )}
    </g>
  );
}
