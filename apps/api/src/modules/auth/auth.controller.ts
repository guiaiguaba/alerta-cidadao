// apps/api/src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  Get,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  SendOtpDto,
  VerifyOtpDto,
  GoogleAuthDto,
} from './dto/auth.dto';
import { TenantRequest } from '../tenants/tenant.middleware';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { Public } from '../../shared/decorators/public.decorator';
import { CurrentUser } from '../../shared/decorators/index';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastro de cidadão' })
  @ApiResponse({ status: 201, description: 'Usuário criado + tokens' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  async register(@Body() dto: RegisterDto, @Req() req: TenantRequest) {
    return this.authService.register({
      ...dto,
      tenantId: req.tenantId,
      schemaName: req.schemaName,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login com email/senha' })
  async login(@Body() dto: LoginDto, @Req() req: TenantRequest) {
    return this.authService.login({
      ...dto,
      tenantId: req.tenantId,
      schemaName: req.schemaName,
    });
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login/Cadastro via Google' })
  async googleAuth(@Body() dto: GoogleAuthDto, @Req() req: TenantRequest) {
    return this.authService.googleAuth({
      idToken: dto.idToken,
      tenantId: req.tenantId,
      schemaName: req.schemaName,
    });
  }

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar OTP via SMS' })
  async sendOtp(@Body() dto: SendOtpDto, @Req() req: TenantRequest) {
    await this.otpService.sendOtp(dto.phone, req.tenantId);
    return { message: 'Código enviado com sucesso' };
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar OTP e obter tokens' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: TenantRequest) {
    return this.otpService.verifyOtp({
      phone: dto.phone,
      code: dto.code,
      tenantId: req.tenantId,
      schemaName: req.schemaName,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token via refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: TenantRequest) {
    return this.authService.refreshTokens({
      refreshToken: dto.refreshToken,
      tenantId: req.tenantId,
      schemaName: req.schemaName,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revogar refresh token' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: TenantRequest,
    @CurrentUser('id') userId: string,
  ) {
    await this.authService.logout({
      refreshToken: dto.refreshToken,
      userId,
      schemaName: req.schemaName,
    });
    return { message: 'Logout realizado com sucesso' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  async me(@CurrentUser() user: any) {
    return user;
  }
}
