import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service';
import { TransactionRunner } from './transaction-runner';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: 'test' });

function runnerWith(outcomes: (unknown | Error)[]) {
  const $transaction = jest.fn(async () => {
    const next = outcomes.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  const runner = new TransactionRunner({ $transaction } as unknown as PrismaService);
  return { runner, $transaction };
}

describe('TransactionRunner', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());

  it('returns the result of the unit of work', async () => {
    const { runner } = runnerWith(['ok']);

    await expect(runner.run(async () => 'ignored')).resolves.toBe('ok');
  });

  it('retries the whole unit of work on a write conflict (P2034) and then succeeds', async () => {
    const { runner, $transaction } = runnerWith([prismaError('P2034'), prismaError('P2034'), 'ok']);

    await expect(runner.run(async () => 'x')).resolves.toBe('ok');
    expect($transaction).toHaveBeenCalledTimes(3);
  });

  it('gives up after the configured number of retries', async () => {
    const { runner, $transaction } = runnerWith([prismaError('P2034'), prismaError('P2034')]);

    await expect(runner.run(async () => 'x', { retries: 1 })).rejects.toMatchObject({
      code: 'P2034',
    });
    expect($transaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-transient errors (e.g. unique violation)', async () => {
    const { runner, $transaction } = runnerWith([prismaError('P2002'), 'never']);

    await expect(runner.run(async () => 'x')).rejects.toMatchObject({ code: 'P2002' });
    expect($transaction).toHaveBeenCalledTimes(1);
  });
});
