import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Bell } from "lucide-react";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { getMyNotifications } from "@/lib/notifications.actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const notifications = await getMyNotifications({ limit: 100 });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bell className="w-7 h-7 text-blue-500" />
          Notificaciones
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Avisos del sistema y actualizaciones importantes
        </p>
      </div>

      <NotificationsList
        notifications={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          linkUrl: n.linkUrl,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
          relatedEntityType: n.relatedEntityType,
        }))}
      />
    </div>
  );
}
