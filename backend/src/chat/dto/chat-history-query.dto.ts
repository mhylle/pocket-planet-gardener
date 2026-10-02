import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

/** Query of GET /api/creatures/:id/chat: one page of history (CHT-04 AC1). */
export class ChatHistoryQueryDto {
  // The page ends before this instant, the createdAt of the oldest message
  // the client has; without it, the latest page.
  @IsOptional()
  @IsISO8601({ strict: true })
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
