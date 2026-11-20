import type { UserRole } from '@doctor-tracker/shared';

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Locals {
      /** Set by `requireAuth`. */
      user?: AuthUser;
      /** Parsed + validated request parts, set by `validate()`. */
      body?: unknown;
      query?: unknown;
      params?: unknown;
    }
  }
}
