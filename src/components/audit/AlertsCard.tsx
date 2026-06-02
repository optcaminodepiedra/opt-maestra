"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, AlertTriangle, AlertOctagon, Info, ArrowRight } from "lucide-react";

interface Props {
  alerts: Array<{
    severity: "info" | "warning" | "danger";
    title: string;
    detail: string;
    userId?: string;
  }>;
}

const SEVERITY_CFG = {
  info: { icon: Info, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", iconColor: "text-blue-600" },
  warning: { icon: AlertTriangle, bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", iconColor: "text-amber-600" },
  danger: { icon: AlertOctagon, bg: "bg-red-50", border: "border-red-200", text: "text-red-800", iconColor: "text-red-600" },
};

export default function AlertsCard({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <Card className="border-amber-200">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
          <Bell className="w-4 h-4 text-amber-500" />
          Alertas inteligentes
          <span className="text-[10px] text-muted-foreground font-normal">({alerts.length})</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {alerts.map((alert, i) => {
            const cfg = SEVERITY_CFG[alert.severity];
            const Icon = cfg.icon;
            const Wrapper: any = alert.userId ? Link : "div";
            const wrapperProps: any = alert.userId
              ? { href: `/app/admin/audit/user/${alert.userId}` }
              : {};

            return (
              <Wrapper
                key={i}
                {...wrapperProps}
                className={`block rounded-md border ${cfg.border} ${cfg.bg} p-2.5 ${alert.userId ? "hover:shadow-sm transition" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 ${cfg.iconColor} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${cfg.text}`}>{alert.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{alert.detail}</p>
                  </div>
                  {alert.userId && <ArrowRight className={`w-3 h-3 ${cfg.iconColor} shrink-0`} />}
                </div>
              </Wrapper>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
