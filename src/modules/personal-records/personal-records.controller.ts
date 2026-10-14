import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserIdParam } from '../../common/decorators/user-id.decorator';
import { ComparePersonalRecordsQuery, PersonalRecordsQuery } from './dto/personal-records.query';
import {
  PersonalRecordsComparisonResponse,
  PersonalRecordsResponse,
} from './dto/personal-records.response';
import { PersonalRecordsService } from './personal-records.service';

@ApiTags('personal-records')
@ApiParam({ name: 'userId', example: 'client-42' })
@Controller('users/:userId/personal-records')
export class PersonalRecordsController {
  constructor(private readonly records: PersonalRecordsService) {}

  @Get()
  @ApiOkResponse({ type: PersonalRecordsResponse })
  get(
    @UserIdParam() userId: string,
    @Query() query: PersonalRecordsQuery,
  ): Promise<PersonalRecordsResponse> {
    return this.records.getRecords(userId, query);
  }

  @Get('compare')
  @ApiOkResponse({ type: PersonalRecordsComparisonResponse })
  compare(
    @UserIdParam() userId: string,
    @Query() query: ComparePersonalRecordsQuery,
  ): Promise<PersonalRecordsComparisonResponse> {
    return this.records.compare(userId, query);
  }
}
