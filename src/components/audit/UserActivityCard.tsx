"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertOctagon, ArrowRight } from "lucide-react";

interface Props {
  user: {
    userId: string | null;
    userName: string;
    userRole: string | null;
    totalActions: number;
    criticalCount: number;
    highCount: number;
  };
  fromIso: string;
  toIso: string;
}

const ROLE_LABELS: Record<string, string> = {
  MASTER_ADMIN: "Master Admin",
  OWNER: "Dueño",
  SUPERIOR: "Superior",
  ACCOUNTING: "Contabilidad",
  INVENTORY: "Inventario",
  MANAGER_OPS: "Gerente Ops",
  MANAGER_RESTAURANT: "Gerente Restaurante",
  MANAGER_HOTEL: "Gerente Hotel",
  MANAGER_RANCH: "Gerente Rancho",
  MANAGER: "Gerente",
  STAFF_RECEPTION: "Recepción",
  STAFF_WAITER: "Mesero",
  STAFF_KITCHEN: "Cocina",
  STAFF_EXPERIENCES: "Experiencias",
  STAFF: "Staff",
};

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function colorFromName(name: string): string {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-purple-100 text-purple-700",
    "bg-pink-100 text-pink-700",
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function UserActivityCard({ user, fromIso, toIso }: Props) {
  const href = user.userId
    ? `/app/admin/audit/user/${user.userId}?from=${fromIso.slice(0, 10)}&to=${toIso.slice(0, 10)}&preset=custom`
    : "#";

  return (
    <Link href={href} className="block group">
      <Card className="hover:shadow-md transition-shadow border-l-4 border-l-transparent group-hover:border-l-indigo-500">
        <CardContent className="p-3">
          <div className="flex items-start gap-2 mb-2">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-xs shrink-0 ${colorFromName(user.userName)}`}>
              {initials(user.userName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" title={user.userName}>{user.userName}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {ROLE_LABELS[user.userRole ?? ""] ?? user.userRole ?? "Sin rol"}
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold shrink-0">
              {user.totalActions}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t pt-2">
            {user.criticalCount > 0 ? (
              <span className="text-red-700 flex items-center gap-0.5 font-medium">
                <AlertOctagon className="w-3 h-3" /> {user.criticalCount} crít.
              </span>
            ) : null}
            {user.highCount > 0 ? (
              <span className="text-amber-700 flex items-center gap-0.5 font-medium">
                <AlertTriangle className="w-3 h-3" /> {user.highCount} alta
              </span>
            ) : null}
            {user.criticalCount === 0 && user.highCount === 0 && (
              <span className="text-emerald-700">Sin alertas</span>
            )}
            <span className="ml-auto flex items-center gap-0.5 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
              Ver detalle <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
