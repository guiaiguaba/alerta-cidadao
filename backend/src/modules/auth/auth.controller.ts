import { Controller, Post, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SyncUserDto } from './dto/sync-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('sync-user')
  syncUser(@Body() dto: SyncUserDto, @Req() req: any) {
    return this.authService.syncUser(dto, req.tenant);
  }
}
