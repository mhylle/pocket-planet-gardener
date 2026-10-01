import { Injectable } from '@nestjs/common';
import type {
  DecorationType,
  PlantType,
  Species,
} from '../content/content.types';
import { DECORATIONS } from '../content/decorations';
import { PLANTS } from '../content/plants';
import { SPECIES } from '../content/species';
import type {
  CatalogueDto,
  PublicDecoration,
  PublicPlant,
  PublicSpecies,
} from './dto/catalogue.dto';

// The mappers pick each public field by name instead of spreading, so a
// field added to the content later stays private until it is listed here.

function toPublicPlant(plant: PlantType): PublicPlant {
  return {
    id: plant.id,
    name: plant.name,
    waterPref: plant.waterPref,
    lightPref: plant.lightPref,
    bloomMinutes: plant.bloomMinutes,
    description: plant.description,
    unlockHint: plant.unlockHint,
  };
}

function toPublicDecoration(decoration: DecorationType): PublicDecoration {
  return {
    id: decoration.id,
    name: decoration.name,
    footprintSteps: decoration.footprintSteps,
    description: decoration.description,
    unlockHint: decoration.unlockHint,
  };
}

function toPublicSpecies(species: Species): PublicSpecies {
  return { id: species.id, name: species.name, hint: species.hint };
}

/** The public view of the game content, for the catalogue screen. */
@Injectable()
export class CatalogueService {
  /** Plants, decorations and species in content order. */
  catalogue(): CatalogueDto {
    return {
      plants: PLANTS.map(toPublicPlant),
      decorations: DECORATIONS.map(toPublicDecoration),
      species: SPECIES.map(toPublicSpecies),
    };
  }
}
