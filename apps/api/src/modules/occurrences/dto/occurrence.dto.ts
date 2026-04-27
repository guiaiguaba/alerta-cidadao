// apps/api/src/modules/occurrences/dto/occurrence.dto.ts
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsInt,
  IsPositive,
  Min,
  Max,
  IsUUID,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOccurrenceDto {
  @ApiProperty({ example: 4, description: 'ID da categoria' })
  @IsInt()
  @IsPositive()
  categoryId: number;

  @ApiProperty({ example: 'Água subindo na rua', required: false })
  @IsOptional()
  @IsString()
  @Max(1000 as any)
  description?: string;

  @ApiProperty({ example: -22.8486 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: -42.0085 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({ example: 'Rua das Flores, 123', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'centro', required: false })
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiProperty({ example: 'uuid-gerado-offline', required: false })
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

export class UpdateStatusDto {
  @ApiProperty({
    enum: ['open','assigned','in_progress','resolved','rejected','duplicate'],
  })
  @IsIn(['open','assigned','in_progress','resolved','rejected','duplicate'])
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  duplicateOf?: string;
}

export class ListOccurrencesQueryDto {
  @IsOptional()
  @IsIn(['open','assigned','in_progress','resolved','rejected','duplicate'])
  status?: string;

  @IsOptional()
  @IsIn(['critical','high','medium','low'])
  priority?: string;

  @IsOptional()
  @IsString()
  regionCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // bbox=minLat,minLng,maxLat,maxLng
  @IsOptional()
  @IsString()
  bbox?: string;
}

export class SyncBatchDto {
  @ApiProperty({ type: () => [CreateOccurrenceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOccurrenceDto)
  items: (CreateOccurrenceDto & { clientId: string })[];
}

export class AddMediaDto {
  @ApiProperty({ enum: ['report', 'during', 'after'] })
  @IsIn(['report', 'during', 'after'])
  phase: string;
}
