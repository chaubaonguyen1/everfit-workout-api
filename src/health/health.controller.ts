import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DomainError, ErrorCode } from '../common/errors';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok'; database: 'up' }> {
    if (!(await this.prisma.ping())) {
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Database is unreachable');
    }
    return { status: 'ok', database: 'up' };
  }
}
