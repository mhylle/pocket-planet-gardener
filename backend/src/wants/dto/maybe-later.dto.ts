import { IsInt, Min } from 'class-validator';

/** Body of POST /api/wants/:id/maybe-later: the version the client last saw (D-2). */
export class MaybeLaterDto {
  // Versions start at 1.
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
