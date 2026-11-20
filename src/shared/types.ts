import type {
  Condition,
  ErrorCode,
  Gender,
  PatientStatus,
  Specialization,
  UserRole,
} from './constants';

/** Dates travel over JSON as ISO strings. */
export type ISODateString = string;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  user: UserDTO;
  accessToken: string;
  expiresAt: number; // epoch ms
}

export interface DoctorDTO {
  _id: string;
  name: string;
  specialization: Specialization;
  hospital: string;
  phone: string;
  email: string;
  patientCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PatientDTO {
  _id: string;
  name: string;
  age: number;
  gender: Gender;
  phone?: string;
  email?: string;
  condition: Condition;
  status: PatientStatus;
  visitDate: ISODateString;
  notes?: string;
  /** Populated with a minimal projection on list/detail endpoints. */
  doctor: Pick<DoctorDTO, '_id' | 'name' | 'specialization'>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface FilterOptionsDTO {
  specializations: string[];
  hospitals: string[];
  conditions: string[];
}

export interface StatsOverviewDTO {
  totalDoctors: number;
  totalPatients: number;
  newPatients: number;
  newDoctors: number;
  avgPatientsPerDoctor: number;
  criticalPatients: number;
}

export interface TimeseriesPointDTO {
  /** Bucket start as YYYY-MM-DD */
  date: string;
  patients: number;
}

export interface CountByKeyDTO {
  key: string;
  count: number;
}

export interface PatientsPerDoctorDTO {
  _id: string;
  name: string;
  specialization: string;
  patientCount: number;
}
