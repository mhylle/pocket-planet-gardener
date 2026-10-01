import { Equals } from 'class-validator';

/** Body of DELETE /api/planet: the word DELETE, so a stray request removes nothing (ACC-05). */
export class DeletePlanetDto {
  @Equals('DELETE')
  confirm!: 'DELETE';
}
