import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  packageId?: string;
}

export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  packageId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxDevices?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  maxConcurrentStreams?: number;

  @IsBoolean()
  @IsOptional()
  dvrEnabled?: boolean;

  @IsString()
  @IsOptional()
  tvheadendUsername?: string;

  @IsString()
  @IsOptional()
  tvheadendProfile?: string;

  @IsString()
  @IsOptional()
  dvrProfile?: string;
}

export class CreateActivationCodeDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  expiresInHours?: number;
}

export class UpdateDeviceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  updateChannel?: string;

  @IsString()
  @IsOptional()
  startChannelId?: string;

  @IsString()
  @IsOptional()
  streamProfile?: string;
}

export class UpdateChannelDto {
  @IsInt()
  @IsOptional()
  number?: number;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  dvrAllowed?: boolean;
}

export class PreviewStreamDto {
  @IsString()
  channelId!: string;

  @IsString()
  @IsOptional()
  @IsIn(['hd', 'sd-480p'])
  quality?: 'hd' | 'sd-480p';
}

export class UpdatePackageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  channelIds?: string[];
}
