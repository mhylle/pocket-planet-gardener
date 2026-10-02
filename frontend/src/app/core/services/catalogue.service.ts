import { Injectable, computed, inject, signal } from '@angular/core';
import { CatalogueDecoration, CatalogueDto, CataloguePlant } from '../models/catalogue';
import { InventoryItemDto } from '../models/planet-snapshot';
import { ApiService } from './api.service';

/**
 * The game content (plant types, decorations, species) from GET /api/catalogue, fetched once
 * and kept for the session. Lookups return undefined until it has loaded.
 */
@Injectable({ providedIn: 'root' })
export class CatalogueService {
  private readonly api = inject(ApiService);
  private readonly current = signal<CatalogueDto | null>(null);
  private loading = false;

  readonly catalogue = this.current.asReadonly();
  private readonly plants = computed(() => byId(this.current()?.plants ?? []));
  private readonly decorations = computed(() => byId(this.current()?.decorations ?? []));

  /** Fetches the catalogue unless it is loaded or on its way; after a failure it may retry. */
  load(): void {
    if (this.current() || this.loading) {
      return;
    }
    this.loading = true;
    this.api.get<CatalogueDto>('/catalogue').subscribe({
      next: (catalogue) => {
        this.loading = false;
        this.current.set(catalogue);
      },
      error: () => {
        // Names fall back to the item ids until a later load succeeds.
        this.loading = false;
      },
    });
  }

  plant(id: string): CataloguePlant | undefined {
    return this.plants().get(id);
  }

  decoration(id: string): CatalogueDecoration | undefined {
    return this.decorations().get(id);
  }

  /** What the catalogue calls a plant type or decoration, such as "Tulip" or "Lamp post". */
  name(id: string): string {
    return this.plant(id)?.name ?? this.decoration(id)?.name ?? readable(id);
  }

  /** What the player calls an inventory item, such as "Clover seed", "Clover seeds" or "Pond". */
  itemName({ itemType, kind }: Pick<InventoryItemDto, 'itemType' | 'kind'>, count = 1): string {
    if (kind === 'decoration') {
      return this.decoration(itemType)?.name ?? readable(itemType);
    }
    const plant = this.plant(itemType)?.name ?? readable(itemType);
    return `${plant} ${count === 1 ? 'seed' : 'seeds'}`;
  }
}

function byId<T extends { id: string }>(entries: T[]): Map<string, T> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

/** "lamp-post" as "Lamp post", for when the catalogue is not there. */
function readable(id: string): string {
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
