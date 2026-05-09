"use client";

export type AreaData = {
  id: string;
  name: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  color: string;
  showBorder: boolean;
};

type Props = {
  area: AreaData;
  selected?: boolean;
  editable?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
};

export function AreaShape({ area: a, selected, editable, onMouseDown, onClick }: Props) {
  const cursor = editable ? "move" : "default";

  return (
    <g style={{ cursor }} onMouseDown={onMouseDown} onClick={onClick}>
      <rect
        x={a.posX}
        y={a.posY}
        width={a.width}
        height={a.height}
        rx={12}
        ry={12}
        fill={a.color}
        opacity={0.4}
        stroke={selected ? "#2563eb" : a.showBorder ? "#94a3b8" : "transparent"}
        strokeWidth={selected ? 2 : 1.5}
        strokeDasharray={a.showBorder && !selected ? "4 4" : undefined}
        pointerEvents="all"
      />
      {/* Etiqueta del área en esquina superior izquierda */}
      <g transform={`translate(${a.posX + 12} ${a.posY + 8})`}>
        <rect
          width={a.name.length * 7 + 16}
          height={18}
          rx={4}
          ry={4}
          fill="rgba(255,255,255,0.9)"
          stroke={selected ? "#2563eb" : "#cbd5e1"}
        />
        <text
          x={8}
          y={9}
          dominantBaseline="middle"
          style={{ fontSize: 10, fontWeight: 600, fill: "#475569" }}
        >
          {a.name}
        </text>
      </g>
    </g>
  );
}
