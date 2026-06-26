import { IsArray, IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ActivateDeviceDto {
  @IsString()
  @IsNotEmpty()
  activationCode!: string;

  @IsString()
  @IsNotEmpty()
  deviceName!: string;

  @IsString()
  @IsIn(['android_tv'])
  deviceType!: string;

  @IsString()
  @IsOptional()
  appVersion?: string;
}

export class CustomerLoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  deviceName?: string;

  @IsString()
  @IsOptional()
  appVersion?: string;
}

export class HeartbeatDto {
  @IsString()
  deviceId!: string;

  @IsString()
  @IsOptional()
  appVersion?: string;

  @IsString()
  @IsOptional()
  currentScreen?: string;

  @IsString()
  @IsOptional()
  currentChannel?: string;

  @IsString()
  @IsOptional()
  playerState?: string;

  @IsObject()
  @IsOptional()
  network?: Record<string, string>;
}

export class OpenStreamDto {
  @IsString()
  channelId!: string;

  @IsString()
  deviceId!: string;

  @IsString()
  @IsOptional()
  @IsIn(['hd', 'sd-480p', 'original'])
  quality?: 'hd' | 'sd-480p' | 'original';
}

export class CloseStreamDto {
  @IsString()
  streamSessionId!: string;
}

export class UpdateFavoritesDto {
  @IsArray()
  @IsString({ each: true })
  channelIds!: string[];
}

export class CreateDvrTimerDto {
  @IsString()
  channelId!: string;

  @IsString()
  title!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
