export type EventPaymentTimingValue =
  | "NOT_DEFINED"
  | "BEFORE_EVENT"
  | "AT_EVENT"
  | "AFTER_EVENT"
  | "PARTIAL"
  | "NO_CHARGE";

export type EventPaymentStatusValue =
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "NOT_REQUIRED";

export type EventStatusCreateValue = "DRAFT" | "TENTATIVE" | "CONFIRMED";

export type EventRequirementInput = {
  category?: string;
  description: string;
  quantity?: number | null;
  unit?: string;
  responsibleUserId?: string;
  neededByLocal?: string;
  notes?: string;
};

export type EventCreateData = {
  creator: {
    id: string;
    fullName: string;
    role: string;
  };
  defaultBusinessId: string;
  businesses: Array<{
    id: string;
    name: string;
  }>;
  responsibleUsers: Array<{
    id: string;
    fullName: string;
    role: string;
    primaryBusinessId: string | null;
    businessId: string | null;
  }>;
  requisitions: Array<{
    id: string;
    title: string;
    status: string;
    kind: string;
    neededBy: string | null;
    business: {
      id: string;
      name: string;
    };
  }>;
};

export type CreateEventInput = {
  title: string;
  eventType?: string;
  status: EventStatusCreateValue;
  businessId: string;
  locationBusinessId?: string;
  locationName?: string;
  locationAddress?: string;
  startsAtLocal: string;
  endsAtLocal?: string;
  estimatedGuests: number;
  confirmedGuests: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  responsibleUserId?: string;
  description?: string;
  internalNotes?: string;
  isPrivate: boolean;
  paymentTiming: EventPaymentTimingValue;
  paymentStatus: EventPaymentStatusValue;
  quotedAmount: number;
  paidAmount: number;
  paymentDueLocal?: string;
  paymentNotes?: string;
  requisitionIds: string[];
  requirements: EventRequirementInput[];
};
