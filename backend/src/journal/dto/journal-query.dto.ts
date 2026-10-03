import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

/** Query of GET /api/journal: one page of the book (JRN-03 AC1). */
export class JournalQueryDto {
  // The page ends before this instant, the createdAt of the oldest entry the
  // client has; without it, the latest page.
  @IsOptional()
  @IsISO8601({ strict: true })
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
