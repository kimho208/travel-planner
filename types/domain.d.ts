/**
 * WAYPOINT domain contracts.
 * These declarations document the persisted JSON model; the app remains vanilla JavaScript.
 */
export type ISODate = string;
export type CurrencyCode = "KRW" | "JPY" | "USD" | "EUR" | string;

export interface Place {
  id?: string;
  placeId?: string;
  name: string;
  category?: string;
  address?: string;
  location?: { latitude: number; longitude: number };
  latitude?: number;
  longitude?: number;
  time?: string;
  endTime?: string;
  note?: string;
  cost?: number;
  currency?: CurrencyCode;
  source?: "ai" | "places" | "manual" | string;
  verified?: boolean;
}

export interface Day {
  id?: string;
  date: ISODate;
  theme?: string;
  items: Place[];
}

export interface Booking {
  id: string;
  type: "flight" | "hotel" | "transit" | "activity" | "other" | string;
  title: string;
  provider?: string;
  confirmationCode?: string;
  origin?: string;
  destination?: string;
  flightNumber?: string;
  departureAt?: string;
  arrivalAt?: string;
  checkInAt?: string;
  checkOutAt?: string;
  status?: string;
  price?: number | null;
  currency?: CurrencyCode;
  details?: Record<string, unknown>;
}

export interface Expense {
  id: string;
  title: string;
  category?: string;
  amount: number;
  currency: CurrencyCode;
  amountKrw: number;
  rate?: number;
  rateDate?: ISODate;
  paidBy?: string;
  splitType?: "equal" | "custom" | string;
  date: ISODate;
  note?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  category?: string;
  done: boolean;
  priority?: "high" | "normal" | "low" | string;
  dueDate?: ISODate;
  assignee?: string;
  note?: string;
  source?: string;
}

export interface Note {
  id: string;
  title?: string;
  content: string;
  stopId?: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  destination: string;
  startDate: ISODate;
  endDate: ISODate;
  travelers: number;
  targetBudget: number;
  style?: string;
  transport?: string;
  styles?: string[];
  budgetLevel?: "value" | "balanced" | "premium";
  hotelArea?: string;
  preferences?: Record<string, unknown>;
  itinerary: Day[];
  expenses?: Record<string, unknown>;
  expenseItems: Expense[];
  reservations: Booking[];
  checklist: ChecklistItem[];
  notes: Note[];
  savedPlaces?: Place[];
  recommendations?: Place[];
  travelerNames?: string[];
  routeLegs?: Array<{ mode: string; legs: Array<{ durationSeconds: number; distanceMeters: number; provider: string }> }>;
  status: "upcoming" | "completed" | string;
  overview?: string;
  tips?: string[];
  createdAt?: string;
}

export interface LocalCacheV3 {
  schemaVersion: 3;
  trips: Trip[];
  activeId: string | null;
  saved: Place[];
  updatedAt: string;
  pendingSync?: string[];
}
/** Legacy cache shape accepted by the in-place migration. */
export interface LocalCacheV2 {
  schemaVersion?: 2;
  trips: Trip[];
  activeId: string | null;
  saved: Place[];
  updatedAt?: string;
}
