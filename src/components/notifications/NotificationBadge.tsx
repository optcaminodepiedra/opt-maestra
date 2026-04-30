import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/lib/notifications.actions";

export async function NotificationBadge() {
  let count = 0;
  try {
    count = await getUnreadNotificationCount();
  } catch {
    // Si falla (tabla aún no existe, etc), simplemente no muestra badge
    return null;
  }

  return (
    <Link
      href="/app/notifications"
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition relative"
    >
      <Bell className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">Notificaciones</span>
      {count > 0 && (
        <span className="text-[10px] px-2 py-[2px] rounded-full bg-red-500 text-white font-semibold">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
