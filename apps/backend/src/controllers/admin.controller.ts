import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CreateActivationCodeDto, CreateCustomerDto, UpdateChannelDto, UpdateCustomerDto, UpdateDeviceDto } from '../dto/admin.dto';
import { StreamGateService } from '../services/streamgate.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly streamGate: StreamGateService) {}

  @Get('customers')
  customers() {
    return this.streamGate.adminCustomers();
  }

  @Post('customers')
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.streamGate.createCustomer(dto);
  }

  @Get('customers/:id')
  customer(@Param('id') id: string) {
    return this.streamGate.adminCustomer(id);
  }

  @Put('customers/:id')
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.streamGate.updateCustomer(id, dto);
  }

  @Post('customers/:id/activation-codes')
  createActivationCode(@Param('id') id: string, @Body() dto: CreateActivationCodeDto) {
    return this.streamGate.createActivationCode(id, dto);
  }

  @Get('devices')
  devices() {
    return this.streamGate.adminDevices();
  }

  @Put('devices/:id')
  updateDevice(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.streamGate.updateDevice(id, dto);
  }

  @Post('devices/:id/block')
  blockDevice(@Param('id') id: string) {
    return this.streamGate.setDeviceStatus(id, 'blocked');
  }

  @Post('devices/:id/reset')
  resetDevice(@Param('id') id: string) {
    return this.streamGate.setDeviceStatus(id, 'reset');
  }

  @Get('channels')
  channels() {
    return this.streamGate.adminChannels();
  }

  @Put('channels/:id')
  updateChannel(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.streamGate.updateChannel(id, dto);
  }

  @Get('packages')
  packages() {
    return this.streamGate.packages();
  }

  @Post('packages')
  createPackage(@Body() body: Record<string, unknown>) {
    return this.streamGate.createPackage(body);
  }

  @Put('packages/:id')
  updatePackage(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.streamGate.updatePackage(id, body);
  }

  @Get('streams/active')
  activeStreams() {
    return this.streamGate.activeStreams();
  }

  @Get('audit-log')
  auditLog() {
    return this.streamGate.auditLog();
  }

  @Get('dashboard')
  dashboard() {
    return this.streamGate.dashboard();
  }
}
