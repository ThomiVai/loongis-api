import {
  BUSINESS_TIME_ZONE,
  businessHours,
  type BusinessDay,
  type BusinessDaySchedule,
} from "../config/businessHours";

import type {
  StoreOrderMode,
} from "../models/storeSettings.model";

export type StoreOperationalState =
  | "open"
  | "paused"
  | "closed";

export type CalculatedStoreStatus = {
  orderMode: StoreOrderMode;
  scheduleOpen: boolean;
  canOrder: boolean;
  state: StoreOperationalState;
  statusLabel: string;
  detailLabel: string;
};

const MILLISECONDS_PER_DAY =
  24 * 60 * 60 * 1000;

const weekdayFormatter =
  new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        BUSINESS_TIME_ZONE,
      weekday: "long",
    },
  );

const timeFormatter =
  new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        BUSINESS_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
  );

function getBusinessDay(
  date: Date,
): BusinessDay {
  return weekdayFormatter
    .format(date)
    .toLowerCase() as BusinessDay;
}

function getCurrentMinutes(
  date: Date,
): number {
  const parts =
    timeFormatter.formatToParts(
      date,
    );

  const hour = Number(
    parts.find(
      (part) =>
        part.type === "hour",
    )?.value ?? 0,
  );

  const minute = Number(
    parts.find(
      (part) =>
        part.type === "minute",
    )?.value ?? 0,
  );

  return hour * 60 + minute;
}

function convertTimeToMinutes(
  time: string,
): number {
  const [
    hour,
    minute,
  ] = time
    .split(":")
    .map(Number);

  return hour * 60 + minute;
}

function isScheduleOpen(
  currentMinutes: number,
  schedule: BusinessDaySchedule,
): boolean {
  if (
    schedule.isClosed ||
    !schedule.opensAt ||
    !schedule.closesAt
  ) {
    return false;
  }

  const openingMinutes =
    convertTimeToMinutes(
      schedule.opensAt,
    );

  const closingMinutes =
    convertTimeToMinutes(
      schedule.closesAt,
    );

  if (
    closingMinutes >
    openingMinutes
  ) {
    return (
      currentMinutes >=
        openingMinutes &&
      currentMinutes <
        closingMinutes
    );
  }

  return (
    currentMinutes >=
      openingMinutes ||
    currentMinutes <
      closingMinutes
  );
}

function getNextOpeningLabel(
  currentDate: Date,
): string {
  for (
    let dayOffset = 0;
    dayOffset <= 7;
    dayOffset += 1
  ) {
    const candidateDate =
      new Date(
        currentDate.getTime() +
          dayOffset *
            MILLISECONDS_PER_DAY,
      );

    const candidateDay =
      getBusinessDay(
        candidateDate,
      );

    const candidateSchedule =
      businessHours[
        candidateDay
      ];

    if (
      candidateSchedule.isClosed ||
      !candidateSchedule.opensAt
    ) {
      continue;
    }

    if (dayOffset === 0) {
      const currentMinutes =
        getCurrentMinutes(
          currentDate,
        );

      const openingMinutes =
        convertTimeToMinutes(
          candidateSchedule.opensAt,
        );

      if (
        currentMinutes <
        openingMinutes
      ) {
        return `Abrimos hoy a las ${candidateSchedule.opensAt}`;
      }

      continue;
    }

    if (dayOffset === 1) {
      return `Abrimos mañana a las ${candidateSchedule.opensAt}`;
    }

    return `Abrimos el ${candidateSchedule.label.toLowerCase()} a las ${candidateSchedule.opensAt}`;
  }

  return "Consultá nuestros horarios";
}

export function calculateStoreStatus(
  orderMode: StoreOrderMode,
  currentDate = new Date(),
): CalculatedStoreStatus {
  const currentDay =
    getBusinessDay(
      currentDate,
    );

  const currentSchedule =
    businessHours[
      currentDay
    ];

  const scheduleOpen =
    isScheduleOpen(
      getCurrentMinutes(
        currentDate,
      ),
      currentSchedule,
    );

  if (orderMode === "paused") {
    return {
      orderMode,
      scheduleOpen,
      canOrder: false,
      state: "paused",
      statusLabel:
        "Pedidos pausados",
      detailLabel:
        "Por el momento no estamos tomando pedidos.",
    };
  }

  if (orderMode === "open") {
    return {
      orderMode,
      scheduleOpen,
      canOrder: true,
      state: "open",
      statusLabel:
        scheduleOpen
          ? "Abierto ahora"
          : "Pedidos habilitados",
      detailLabel:
        scheduleOpen &&
        currentSchedule.closesAt
          ? `Tomamos pedidos hasta las ${currentSchedule.closesAt}`
          : "Estamos tomando pedidos fuera del horario habitual.",
    };
  }

  if (scheduleOpen) {
    return {
      orderMode,
      scheduleOpen,
      canOrder: true,
      state: "open",
      statusLabel:
        "Abierto ahora",
      detailLabel:
        `Tomamos pedidos hasta las ${currentSchedule.closesAt}`,
    };
  }

  return {
    orderMode,
    scheduleOpen,
    canOrder: false,
    state: "closed",
    statusLabel:
      "Cerrado ahora",
    detailLabel:
      getNextOpeningLabel(
        currentDate,
      ),
  };
}
