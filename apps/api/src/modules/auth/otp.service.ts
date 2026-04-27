// apps/api/src/modules/auth/otp.service.ts
// Gerencia OTP via SMS (Twilio/AWS SNS) com armazenamento Redis

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from './auth.service';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';

const OTP_TTL_SECONDS = 300;    // 5 minutos
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60; // 1 minuto entre envios

@Injectable()
export class OtpService {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly db: TenantPrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async sendOtp(phone: string, tenantId: string): Promise<void> {
    // Throttle: apenas 1 OTP por minuto por número
    const cooldownKey = `otp:cooldown:${tenantId}:${phone}`;
    const onCooldown = await this.redis.exists(cooldownKey);
    if (onCooldown) {
      throw new BadRequestException(
        'Aguarde 1 minuto antes de solicitar novo código',
      );
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Armazenar no Redis com TTL
    const otpKey = `otp:code:${tenantId}:${phone}`;
    await this.redis.setex(otpKey, OTP_TTL_SECONDS, JSON.stringify({
      code,
      attempts: 0,
      createdAt: new Date().toISOString(),
    }));

    // Cooldown de 1 minuto
    await this.redis.setex(cooldownKey, OTP_COOLDOWN_SECONDS, '1');

    // Enviar SMS
    await this.sendSms(phone, code);
  }

  async verifyOtp(dto: {
    phone: string;
    code: string;
    tenantId: string;
    schemaName: string;
  }) {
    const otpKey = `otp:code:${dto.tenantId}:${dto.phone}`;
    const raw = await this.redis.get(otpKey);

    if (!raw) {
      throw new UnauthorizedException(
        'Código expirado ou não encontrado. Solicite um novo.',
      );
    }

    const otpData = JSON.parse(raw);

    // Verificar tentativas
    if (otpData.attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(otpKey);
      throw new UnauthorizedException(
        'Número de tentativas excedido. Solicite um novo código.',
      );
    }

    // Verificar código
    if (otpData.code !== dto.code) {
      otpData.attempts += 1;
      await this.redis.setex(otpKey, OTP_TTL_SECONDS, JSON.stringify(otpData));
      const remaining = OTP_MAX_ATTEMPTS - otpData.attempts;
      throw new UnauthorizedException(
        `Código incorreto. ${remaining} tentativa(s) restante(s).`,
      );
    }

    // Código válido — remover do Redis
    await this.redis.del(otpKey);

    // Buscar ou criar usuário com esse telefone
    const prisma = await this.db.forTenant(dto.schemaName);

    const [existing] = await prisma.$queryRaw<any[]>`
      SELECT id, role FROM users WHERE phone = ${dto.phone} LIMIT 1
    `;

    if (existing) {
      // Marcar telefone como verificado e retornar tokens
      await prisma.$executeRaw`
        UPDATE users SET phone_verified = true, updated_at = NOW()
        WHERE id = ${existing.id}
      `;
      return this.authService['generateTokens'](
        existing.id,
        dto.tenantId,
        existing.role,
        dto.schemaName,
      );
    } else {
      // Criar novo cidadão com telefone
      return this.authService.register({
        name: dto.phone, // Nome temporário; usuário pode atualizar depois
        phone: dto.phone,
        tenantId: dto.tenantId,
        schemaName: dto.schemaName,
      });
    }
  }

  private async sendSms(phone: string, code: string): Promise<void> {
    const provider = this.config.get<string>('SMS_PROVIDER', 'console');
    const message = `Seu código Alerta Cidadão: ${code}. Válido por 5 minutos.`;

    if (provider === 'console' || process.env.NODE_ENV === 'development') {
      // Desenvolvimento: apenas logar
      console.log(`📱 OTP para ${phone}: ${code}`);
      return;
    }

    if (provider === 'twilio') {
      await this.sendViaTwilio(phone, message);
    } else if (provider === 'aws_sns') {
      await this.sendViaAwsSns(phone, message);
    } else {
      throw new ServiceUnavailableException('Provedor SMS não configurado');
    }
  }

  private async sendViaTwilio(to: string, body: string): Promise<void> {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID')!;
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN')!;
    const from = this.config.get<string>('TWILIO_FROM_NUMBER')!;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      },
    );

    if (!response.ok) {
      const err = await response.json();
      throw new ServiceUnavailableException(`Falha ao enviar SMS: ${err.message}`);
    }
  }

  private async sendViaAwsSns(phone: string, message: string): Promise<void> {
    // Implementar com @aws-sdk/client-sns quando necessário
    throw new ServiceUnavailableException('AWS SNS ainda não configurado');
  }
}
