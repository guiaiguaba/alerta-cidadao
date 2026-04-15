import { Controller, Get, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentTenant } from '../../common/decorators';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Controller('users')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('admin', 'agent')
  findAll(@CurrentTenant() tenant: any) {
    return this.usersService.findAll(tenant.id);
  }

  @Get('me')
  me(@CurrentUser() user: any) {
    return user;
  }

  @Get(':id')
  @Roles('admin')
  findOne(@CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.usersService.findOne(tenant.id, id);
  }

  @Patch(':id/role')
  @Roles('admin')
  updateRole(
    @CurrentTenant() tenant: any,
    @CurrentUser() actor: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(tenant.id, id, dto, actor.role);
  }

  @Delete(':id')
  @Roles('admin')
  deactivate(
    @CurrentTenant() tenant: any,
    @CurrentUser() actor: any,
    @Param('id') id: string,
  ) {
    return this.usersService.deactivate(tenant.id, id, actor.role);
  }
}
