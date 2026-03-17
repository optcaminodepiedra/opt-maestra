"use client";

import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = {
  es: es,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function ReservationsCalendar({ reservations }: any) {
  const events = reservations.map((r: any) => ({
    title: `${r.guest.fullName} – Hab ${r.room.name}`,
    start: new Date(r.checkIn),
    end: new Date(r.checkOut),
  }));

  return (
    <div className="bg-white rounded-xl border p-4">
      <div style={{ height: 600 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          culture="es"
        />
      </div>
    </div>
  );
}
