// apps/api/src/modules/auth/dto/register.dto.ts
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'joao@email.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;

  @ApiProperty({ example: '+5522999990000', required: false })
  @IsOptional()
  @Matches(/^\+?[1-9]\d{10,14}$/, { message: 'Telefone inválido' })
  phone?: string;

  @ApiProperty({ minLength: 8, required: false })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Senha deve ter ao menos 8 caracteres' })
  password?: string;

  @ValidateIf(o => !o.email && !o.phone)
  mustHaveEmailOrPhone: never; // Validação customizada no service
}

// =============================================

export class LoginDto {
  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}

// =============================================

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

// =============================================

export class SendOtpDto {
  @ApiProperty({ example: '+5522999990000' })
  @Matches(/^\+?[1-9]\d{10,14}$/, { message: 'Telefone inválido' })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+5522999990000' })
  @Matches(/^\+?[1-9]\d{10,14}$/)
  phone: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'OTP deve ter 6 dígitos' })
  code: string;
}

export class GoogleAuthDto {
  @ApiProperty()
  @IsString()
  idToken: string;  // Token do Google Sign-In
}
