export type BusinessDay =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type BusinessDaySchedule = {
  label: string;
  isClosed: boolean;
  opensAt?: string;
  closesAt?: string;
};

export const BUSINESS_TIME_ZONE =
  "America/Argentina/Buenos_Aires";

export const businessHours: Record<
  BusinessDay,
  BusinessDaySchedule
> = {
  monday: {
    label: "Lunes",
    isClosed: true,
  },

  tuesday: {
    label: "Martes",
    isClosed: true,
  },

  wednesday: {
    label: "Miércoles",
    isClosed: true,
  },

  thursday: {
    label: "Jueves",
    isClosed: false,
    opensAt: "20:00",
    closesAt: "00:00",
  },

  friday: {
    label: "Viernes",
    isClosed: false,
    opensAt: "20:00",
    closesAt: "00:00",
  },

  saturday: {
    label: "Sábado",
    isClosed: false,
    opensAt: "20:00",
    closesAt: "00:00",
  },

  sunday: {
    label: "Domingo",
    isClosed: false,
    opensAt: "20:00",
    closesAt: "00:00",
  },
};
