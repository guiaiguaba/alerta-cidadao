// apps/api/src/shared/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/jwt-auth.guard';

/** Marca uma rota como pública (sem JWT) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
