import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ListShiftsQueryDto, MissionListQueryDto } from './mission.dto.js';

describe.each([MissionListQueryDto, ListShiftsQueryDto])('%s query limits', Dto => {
  it('accepts an integer supplied in a URL query string', async () => {
    const query = plainToInstance(Dto, { limit: '25' });
    expect(query.limit).toBe(25);
    expect(await validate(query)).toHaveLength(0);
  });

  it.each(['0', '-1', '2.5', 'abc', '201'])('rejects invalid limit %s', async limit => {
    expect((await validate(plainToInstance(Dto, { limit }))).length).toBeGreaterThan(0);
  });
});
