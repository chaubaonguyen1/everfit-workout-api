import { Module } from '@nestjs/common';
import { UnitConverterService } from './unit-converter.service';

@Module({
  providers: [UnitConverterService],
  exports: [UnitConverterService],
})
export class UnitsModule {}
