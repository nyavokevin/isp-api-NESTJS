import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './auth.dto';

// Seed users (in production: use a real database)
const SEED_USERS = [
  {
    id: '1',
    name: 'Administrateur ISP',
    email: 'admin@isp.mg',
    // password: admin123
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'admin',
  },
  {
    id: '2',
    name: 'Technicien Réseau',
    email: 'tech@isp.mg',
    // password: tech123
    passwordHash: bcrypt.hashSync('tech123', 10),
    role: 'technician',
  },
  {
    id: '3',
    name: 'Agent Commercial',
    email: 'commercial@isp.mg',
    // password: sales123
    passwordHash: bcrypt.hashSync('sales123', 10),
    role: 'sales',
  },
];

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(dto: LoginDto) {
    const user = SEED_USERS.find((u) => u.email === dto.email);
    if (!user) throw new UnauthorizedException('Email ou mot de passe invalide');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email ou mot de passe invalide');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async validateUser(payload: any) {
    return SEED_USERS.find((u) => u.id === payload.sub) || null;
  }

  getProfile(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
