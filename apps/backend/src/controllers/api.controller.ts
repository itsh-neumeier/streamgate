import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ActivateDeviceDto, CloseStreamDto, CreateDvrTimerDto, HeartbeatDto, OpenStreamDto, UpdateFavoritesDto } from '../dto/api.dto';
import { StreamGateService } from '../services/streamgate.service';

@Controller('api')
export class ApiController {
  constructor(private readonly streamGate: StreamGateService) {}

  @Post('device/activate')
  activate(@Body() dto: ActivateDeviceDto) {
    return this.streamGate.activateDevice(dto);
  }

  @Post('device/logout')
  logout(@Body('deviceId') deviceId: string) {
    return this.streamGate.logout(deviceId);
  }

  @Get('device/config')
  deviceConfig(@Headers('authorization') authorization?: string) {
    return this.streamGate.getDeviceConfig(authorization);
  }

  @Post('device/heartbeat')
  heartbeat(@Body() dto: HeartbeatDto) {
    return this.streamGate.heartbeat(dto);
  }

  @Get('app/bootstrap')
  bootstrap(@Headers('authorization') authorization?: string) {
    return this.streamGate.bootstrap(authorization);
  }

  @Get('channels')
  channels(@Headers('authorization') authorization?: string) {
    return this.streamGate.channels(authorization);
  }

  @Get('channels/favorites')
  favorites() {
    return this.streamGate.favoriteChannels();
  }

  @Put('channels/favorites')
  updateFavorites(@Body() dto: UpdateFavoritesDto) {
    return this.streamGate.updateFavorites(dto.channelIds);
  }

  @Get('channels/groups')
  channelGroups() {
    return this.streamGate.channelGroups();
  }

  @Get('epg/now-next')
  nowNext() {
    return this.streamGate.nowNext();
  }

  @Get('epg/grid')
  epgGrid(@Query('from') from?: string, @Query('to') to?: string) {
    return this.streamGate.epgGrid(from, to);
  }

  @Post('stream/open')
  openStream(@Body() dto: OpenStreamDto, @Headers('authorization') authorization: string | undefined, @Req() request: Request) {
    return this.streamGate.openStream(dto, authorization, request.ip, request.headers['user-agent']);
  }

  @Post('stream/close')
  closeStream(@Body() dto: CloseStreamDto) {
    return this.streamGate.closeStream(dto.streamSessionId);
  }

  @Get('stream/session/:id')
  streamSession(@Param('id') id: string) {
    return this.streamGate.streamSession(id);
  }

  @Get('dvr/recordings')
  recordings(@Headers('authorization') authorization?: string) {
    return this.streamGate.recordings(authorization);
  }

  @Get('dvr/timers')
  timers(@Headers('authorization') authorization?: string) {
    return this.streamGate.timers(authorization);
  }

  @Post('dvr/timers')
  createTimer(@Body() dto: CreateDvrTimerDto, @Headers('authorization') authorization?: string) {
    return this.streamGate.createTimer(dto, authorization);
  }

  @Delete('dvr/timers/:id')
  deleteTimer(@Param('id') id: string, @Headers('authorization') authorization?: string) {
    return this.streamGate.deleteTimer(id, authorization);
  }

  @Delete('dvr/recordings/:id')
  deleteRecording(@Param('id') id: string) {
    return this.streamGate.deleteRecording(id);
  }
}
