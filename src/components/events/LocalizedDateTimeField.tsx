"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Clock3, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  includeTime?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDatePart(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

function getTime(value: string): { hour: string; minute: string } {
  const match = /T(\d{2}):(\d{2})/.exec(value);
  return {
    hour: match?.[1] ?? "12",
    minute: match?.[2] ?? "00",
  };
}

function buildValue(date: Date, includeTime: boolean, hour: string, minute: string): string {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return includeTime ? `${datePart}T${hour}:${minute}` : datePart;
}

export function LocalizedDateTimeField({
  id,
  value,
  onChange,
  includeTime = true,
  required = false,
  disabled = false,
  placeholder = "Seleccionar fecha",
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = parseDatePart(value);
  const time = getTime(value);

  const minuteOptions = React.useMemo(() => {
    const values = Array.from({ length: 12 }, (_, index) => pad(index * 5));
    if (!values.includes(time.minute)) values.push(time.minute);
    return values.sort();
  }, [time.minute]);

  function selectDate(date: Date | undefined) {
    if (!date) return;
    onChange(buildValue(date, includeTime, time.hour, time.minute));
    if (!includeTime) setOpen(false);
  }

  function changeTime(nextHour: string, nextMinute: string) {
    const date = selected ?? new Date();
    onChange(buildValue(date, true, nextHour, nextMinute));
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "h-10 flex-1 justify-start text-left font-normal",
                !selected && "text-muted-foreground"
              )}
            >
              <CalendarDays className="h-4 w-4" />
              {selected
                ? format(selected, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
                : placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={selectDate}
              locale={es}
              weekStartsOn={1}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {!required && value && !disabled && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange("")}
            aria-label="Limpiar fecha"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {includeTime && (
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          <select
            aria-label="Hora"
            value={time.hour}
            onChange={(event) => changeTime(event.target.value, time.minute)}
            disabled={disabled}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {Array.from({ length: 24 }, (_, hour) => pad(hour)).map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>
          <span className="text-sm font-medium">:</span>
          <select
            aria-label="Minutos"
            value={time.minute}
            onChange={(event) => changeTime(time.hour, event.target.value)}
            disabled={disabled}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {minuteOptions.map((minute) => (
              <option key={minute} value={minute}>
                {minute}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">horario de 24 horas</span>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Fecha en español: día, mes y año{includeTime ? " · hora en formato de 24 horas" : ""}.
      </p>
    </div>
  );
}
