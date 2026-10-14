import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiHeader, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  IDEMPOTENCY_KEY_HEADER,
  IdempotencyKey,
} from '../../common/decorators/idempotency-key.decorator';
import { UserIdParam } from '../../common/decorators/user-id.decorator';
import { CreateWorkoutsDto } from './dto/create-workouts.dto';
import { LoggedWorkoutsResponse } from './dto/logged-workouts.response';
import { WorkoutsService } from './workouts.service';

export const IDEMPOTENT_REPLAY_HEADER = 'Idempotent-Replayed';

@ApiTags('workouts')
@ApiParam({ name: 'userId', example: 'client-42' })
@Controller('users/:userId/workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: false,
    description: 'Retry-safe key: the same key + body returns the original response',
  })
  @ApiCreatedResponse({ type: LoggedWorkoutsResponse })
  async log(
    @UserIdParam() userId: string,
    @Body() dto: CreateWorkoutsDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoggedWorkoutsResponse> {
    const { response, replayed } = await this.workouts.logWorkouts(userId, dto, idempotencyKey);
    if (replayed) res.setHeader(IDEMPOTENT_REPLAY_HEADER, 'true');
    return response;
  }
}
