import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { lightStatus, waterStatus } from '../../core/helpers/growth-rules';
import { presentPlant } from '../../core/helpers/plant-presenter';
import {
  StatusText,
  lightText,
  stageText,
  statusLine,
  waterText,
} from '../../core/helpers/status-text';
import { lightAt } from '../../core/helpers/sun-model';
import { CreatureDto } from '../../core/models/creature';
import { CatalogueService } from '../../core/services/catalogue.service';
import { CardTarget, PlacementService } from '../../core/services/placement.service';
import { PlanetStore } from '../../core/services/planet-store.service';
import { SceneService } from '../../scene/scene.service';
import { SkyService } from '../../scene/sky.service';
import { CreatureCardComponent } from '../creature-card/creature-card.component';
import { StatusIconComponent } from '../status-icon/status-icon.component';

/** Room the card needs from the canvas edges, in CSS pixels, so it is never cut off. */
const CARD_HALF_WIDTH = 140;
const CARD_HEIGHT = 200;
/** A creature's card is taller, the more so with its want and its story open. */
const CREATURE_CARD_HEIGHT = 440;

/** What the card shows. */
interface CardView extends CardTarget {
  title: string;
  /** Stage, water and light for a plant; nothing for a decoration. */
  statuses: StatusText[];
  /** A bloom with seeds to collect (GRD-08). */
  ready: boolean;
  /** Opened by a tap, with actions; otherwise it shows what the mouse is over. */
  pinned: boolean;
  /** The creature on a creature's card; null on any other. */
  creature: CreatureDto | null;
}

/**
 * The card for a plant, decoration or creature (NAV-03). Hovering shows what it is and, for a
 * plant, its stage, water and light as icon and words with what would help (GRD-04, SET-04);
 * for a creature, its name over the creature card (AC2). Moving away closes it. A tap (or
 * Enter at the middle of the view) pins it with its actions: "Collect seeds" for a ready bloom
 * (GRD-08 AC2), "Dig up" for a plant (GRD-07 AC1), which first names the creatures whose want
 * needs it and waits for Confirm or Keep it (AC3), "Move" and "Put away" for a decoration
 * (ITM-02), "More" for a creature (CRT-03 AC1). The pinned card takes the focus; Escape or a
 * press anywhere else closes it, and Escape and the actions give the focus back to the
 * planet. The light is worked out here from where the sun is now, so the card follows the sun
 * as it moves.
 */
@Component({
  selector: 'app-info-card',
  imports: [CreatureCardComponent, StatusIconComponent],
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.scss',
  host: {
    '(document:pointerdown)': 'pressed($event)',
    '(document:keydown.escape)': 'escape()',
  },
})
export class InfoCardComponent {
  private readonly store = inject(PlanetStore);
  private readonly catalogue = inject(CatalogueService);
  private readonly scene = inject(SceneService);
  private readonly sky = inject(SkyService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly placement = inject(PlacementService);
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  protected readonly statusLine = statusLine;
  /** Who would notice the pinned plant going, while "Dig up" waits for an answer (GRD-07 AC3). */
  protected readonly warning = linkedSignal<string | null, string | null>({
    source: () => this.placement.card()?.id ?? null,
    computation: () => null,
  });

  protected readonly card = computed<CardView | null>(() => {
    const pinned = this.placement.card();
    const target = pinned ?? this.placement.hoverCard();
    const snapshot = this.store.snapshot();
    if (!target || !snapshot) {
      return null;
    }
    const card = { ...target, ...this.clamp(target), pinned: pinned !== null, creature: null };
    if (target.kind === 'creature') {
      const creature = snapshot.creatures.find(({ id }) => id === target.id);
      return creature
        ? { ...card, title: creature.name, statuses: [], ready: false, creature }
        : null;
    }
    if (target.kind === 'decoration') {
      const decoration = snapshot.decorations.find(({ id }) => id === target.id);
      return decoration
        ? { ...card, title: this.catalogue.name(decoration.type), statuses: [], ready: false }
        : null;
    }
    const plant = snapshot.plants.find(({ id }) => id === target.id);
    if (!plant) {
      return null;
    }
    const type = this.catalogue.plant(plant.type);
    const statuses = [
      stageText(plant.stage, plant.harvestReady),
      waterText(waterStatus(plant.water)),
    ];
    if (type) {
      const light = lightAt(plant, this.sky.sunAngle());
      statuses.push(lightText(lightStatus(type.lightPref, light)));
    }
    const title = this.catalogue.name(plant.type);
    return { ...card, title, statuses, ready: presentPlant(plant).sparkle };
  });

  constructor() {
    // Runs when a card is pinned, and when its dig-up question comes or goes, once its
    // buttons are drawn.
    afterRenderEffect(() => {
      this.warning();
      if (this.placement.card()) {
        this.box()?.nativeElement.querySelector('button')?.focus();
      }
    });
  }

  protected harvest(id: string): void {
    this.scene.focusCanvas();
    void this.placement.harvest(id);
  }

  /** Digs the plant up, unless a creature's want needs it: then it asks first, naming them. */
  protected digUp(id: string, title: string): void {
    const names = this.placement.noticedBy(id).map(({ name }) => name);
    if (names.length === 0) {
      this.confirmDigUp(id);
      return;
    }
    const whose = names.length === 1 ? `${names[0]}'s wish` : 'their wishes';
    this.warning.set(
      `${listOf(names)} will notice — this ${title.toLowerCase()} is part of ${whose}. ` +
        'Dig it up anyway?',
    );
  }

  protected confirmDigUp(id: string): void {
    this.scene.focusCanvas();
    void this.placement.digUp(id);
  }

  protected move(id: string): void {
    this.scene.focusCanvas();
    this.placement.startMove(id);
  }

  protected putAway(id: string): void {
    this.scene.focusCanvas();
    void this.placement.putAway(id);
  }

  protected escape(): void {
    if (this.placement.card()) {
      this.placement.closeCard();
      this.scene.focusCanvas();
    } else {
      this.placement.dismissHoverCard();
    }
  }

  protected pressed(event: PointerEvent): void {
    if (this.placement.card() && !this.host.nativeElement.contains(event.target as Node)) {
      this.placement.closeCard();
    }
  }

  /** The card's spot on the canvas, kept clear of its edges. */
  private clamp({ kind, x, y }: CardTarget): { x: number; y: number } {
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), Math.max(min, max));
    const height = kind === 'creature' ? CREATURE_CARD_HEIGHT : CARD_HEIGHT;
    return {
      x: clamp(x, CARD_HALF_WIDTH, this.scene.width - CARD_HALF_WIDTH),
      y: clamp(y, 0, this.scene.height - height),
    };
  }
}

/** "Mira", "Mira and Sam", "Mira, Sam and Pip". */
function listOf(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
}
