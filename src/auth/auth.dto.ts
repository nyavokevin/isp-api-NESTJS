import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@isp.mg', description: 'Email de connexion' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'admin123', description: 'Mot de passe' })
  @IsString()
  @MinLength(4)
  password: string;
}

export class SessionResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty()
  user: {
    name: string;
    email: string;
    role: string;
  };
}
