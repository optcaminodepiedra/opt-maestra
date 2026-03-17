"use client";

import { differenceInDays, addDays, format } from "date-fns";

type Room = {
  id: string;
  name: string;
};

type Reservation = {
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guest: {
    fullName: string;
  };
};

export default function OccupancyGrid({
  rooms,
  reservations,
}: {
  rooms: Room[];
  reservations: Reservation[];
}) {
  const start = new Date();
  const days = 14;

  const dates = Array.from({ length: days }).map((_, i) => addDays(start, i));

  function reservationFor(roomId: string, date: Date) {
    return reservations.find((r) => {
      if (r.roomId !== roomId) return false;

      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);

      return date >= checkIn && date < checkOut;
    });
  }

  return (
    <div className="overflow-auto border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Habitación</th>

            {dates.map((d) => (
              <th key={d.toISOString()} className="p-2 text-center">
                {format(d, "dd")}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rooms.map((room) => (
            <tr key={room.id} className="border-t">
              <td className="p-2 font-medium">{room.name}</td>

              {dates.map((d) => {
                const res = reservationFor(room.id, d);

                return (
                  <td key={d.toISOString()} className="p-1 text-center">
                    {res ? (
                      <div className="bg-blue-500 text-white rounded text-xs p-1">
                        {res.guest.fullName}
                      </div>
                    ) : (
                      ""
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
