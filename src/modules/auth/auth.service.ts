import type { LoginInput, LoginResponse, UserDTO, UserRole } from '@doctor-tracker/shared';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { User } from '../../models/user.model';
import { ApiError } from '../../utils/api-error';

const BCRYPT_ROUNDS = 12;
// Pre-computed hash used to keep timing constant when the email is unknown.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-mitigation', 10);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function signAccessToken(user: { id: string; role: UserRole }): {
  token: string;
  expiresAt: number;
} {
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
  const { exp } = jwt.decode(token) as jwt.JwtPayload;
  return { token, expiresAt: (exp ?? 0) * 1000 };
}

function toUserDTO(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: UserRole;
}): UserDTO {
  return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
}

export async function login({ email, password }: LoginInput): Promise<LoginResponse> {
  const user = await User.findOne({ email }).select('+passwordHash').lean();

  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    // Same message for unknown email and wrong password: no account enumeration.
    throw ApiError.unauthorized('Invalid email or password');
  }

  const dto = toUserDTO(user);
  const { token, expiresAt } = signAccessToken(dto);
  return { user: dto, accessToken: token, expiresAt };
}

export async function getCurrentUser(id: string): Promise<UserDTO> {
  const user = await User.findById(id, { name: 1, email: 1, role: 1 }).lean();
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  return toUserDTO(user);
}
