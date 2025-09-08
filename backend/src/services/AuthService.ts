import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories';
import { User, UserRole } from '../types/database';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
  expiresIn: number;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'hajiri-secret-key';
  private static readonly SALT_ROUNDS = 10;

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Verify password
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT token
  static generateToken(payload: AuthPayload): string {
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: 86400 }); // 24 hours in seconds
  }

  // Verify JWT token
  static verifyToken(token: string): AuthPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as AuthPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Login user
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials;

    // Find user by email
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const token = this.generateToken(payload);

    // Calculate expiration time in seconds
    const expiresIn = 24 * 60 * 60; // 24 hours

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token,
      expiresIn
    };
  }

  // Register new user (for admin use)
  static async register(userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: UserRole;
  }): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await UserRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(userData.password);

    // Create user
    const newUser = await UserRepository.create({
      name: userData.name,
      email: userData.email,
      password_hash: hashedPassword,
      phone: userData.phone || '',
      role: userData.role || 'FOREMAN',
      is_active: true
    });

    // Generate token
    const payload: AuthPayload = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    };

    const token = this.generateToken(payload);
    const expiresIn = 24 * 60 * 60; // 24 hours

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        is_active: newUser.is_active,
        created_at: newUser.created_at,
        updated_at: newUser.updated_at
      },
      token,
      expiresIn
    };
  }

  // Refresh token
  static async refreshToken(oldToken: string): Promise<AuthResponse> {
    try {
      const payload = this.verifyToken(oldToken);
      
      // Get fresh user data
      const user = await UserRepository.findById(payload.userId);
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      // Generate new token
      const newPayload: AuthPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

    const token = this.generateToken(newPayload);
    const expiresIn = 24 * 60 * 60; // 24 hours

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token,
      expiresIn
    };
    } catch (error) {
      throw new Error('Invalid token for refresh');
    }
  }

  // Get current user from token
  static async getCurrentUser(token: string): Promise<Omit<User, 'password_hash'> | null> {
    try {
      const payload = this.verifyToken(token);
      const user = await UserRepository.findById(payload.userId);
      
      if (!user || !user.is_active) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      };
    } catch (error) {
      return null;
    }
  }
}
