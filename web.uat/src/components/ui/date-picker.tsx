import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
  modifiers?: Record<string, (date: Date) => boolean>;
  modifiersClassNames?: Record<string, string>;
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Pick a date",
  disabled,
  className,
  modifiers,
  modifiersClassNames
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
        <div 
          className="bg-background border rounded-lg shadow-lg" 
          style={{ zIndex: 1000, position: 'relative' }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              onSelect?.(selectedDate);
              setOpen(false); // Close the popover after selection
            }}
            disabled={disabled}
            modifiers={modifiers}
            modifiersClassNames={modifiersClassNames}
            initialFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}