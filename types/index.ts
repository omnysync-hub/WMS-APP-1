export type EmployeeRole =
  | "technician"
  | "dispatcher"
  | "accountant"
  | "admin"
  | "storekeeper"
  | "call_center"
  | "hr"
  | "office_staff"
  | string;

export type Employee = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  role: EmployeeRole;
  department?: string | null;
  designation?: string | null;
  employmentType?: string | null;
  faceEnrolled?: boolean;
  status?: string | null;
  joinDate?: string | null;
  reportingManagerId?: string | null;
  reportingManager?: {
    id: string;
    name: string;
    phone?: string | null;
    designation?: string | null;
  } | null;
};

export type JobStatus =
  | "Assigned"
  | "Accepted"
  | "InProgress"
  | "Paused"
  | "CompletedPendingVerification"
  | "Completed"
  | "Cancelled"
  | string;

export type JobItem = {
  id: string;
  name?: string;
  description?: string;
  quantityPlanned?: number;
  quantityActual?: number | null;
  unitPrice?: number;
};

export type Job = {
  id: string;
  jobNumber: string;
  status: JobStatus;
  priority?: string;
  scheduledAt?: string | null;
  customerName?: string;
  customerPhone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  items?: JobItem[];
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
  };
};

export type DispatchRequest = {
  id: string;
  recipientId: string;
  senderName?: string;
  senderRole?: string;
  type: string;
  title: string;
  body: string;
  priority: "urgent" | "high" | "normal" | "low" | string;
  payloadJson?: string | null;
  actionRequired: boolean;
  actionStatus: "pending" | "accepted" | "rejected" | "acknowledged" | string;
  deliveryStatus?: string;
  createdAt: string;
};

export type LeaveBalance = {
  leaveTypeId: string;
  name: string;
  allocated: number;
  used: number;
  remaining: number;
};

export type LeaveRequest = {
  id: string;
  leaveTypeId?: string;
  leaveType?: { name: string } | string;
  startDate: string;
  endDate: string;
  daysCount?: number;
  reason?: string;
  status: "Pending" | "Approved" | "Rejected" | string;
  approvedBy?: string | null;
  createdAt: string;
};

export type GeofenceZone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt?: string;
};

export type AttendanceSubmitPayload = {
  employeeId: string;
  geofenceZoneId?: string;
  lat: number;
  lng: number;
  timestamp: string;
  faceMatchScore: number;
  livenessScore?: number;
  deviceId: string;
  notes?: string;
};

export type AttendanceSubmitResult = {
  status: "accepted" | "accepted-but-flagged" | "rejected";
  code: string;
  message: string;
  log?: AttendanceLog;
  withinGeofence?: boolean;
  distanceMeters?: number;
  flaggedForReview?: boolean;
  flagReason?: string | null;
  calculatedSpeedKmH?: number | null;
  zoneName?: string;
  queued?: boolean;
};

export type AttendanceLog = {
  id: string;
  employeeId: string;
  type?: "check_in" | "check_out" | string;
  timestamp: string;
  lat?: number;
  lng?: number;
  faceMatchScore?: number;
  withinGeofence?: boolean;
  flaggedForReview?: boolean;
  flagReason?: string | null;
  result?: string;
  notes?: string | null;
  deviceId?: string | null;
  geofenceZoneId?: string | null;
  geofenceZone?: { id: string; name: string } | null;
};
