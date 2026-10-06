import { Component, inject } from '@angular/core';
import { MotionPreferenceService } from '../../core/services/motion-preference.service';
import { RECEIPT_MS, ReceiptService } from '../../core/services/receipt.service';

/**
 * Small notes such as "+1 Clover seed" that float down into the inventory and fade (ITM-01
 * AC3). With reduced motion they only fade in and out (SET-03).
 */
@Component({
  selector: 'app-receipt-toast',
  templateUrl: './receipt-toast.component.html',
  styleUrl: './receipt-toast.component.scss',
  host: { '[style.--receipt-ms]': 'duration' },
})
export class ReceiptToastComponent {
  protected readonly receipts = inject(ReceiptService).receipts;
  protected readonly still = inject(MotionPreferenceService).reduced;
  protected readonly duration = `${RECEIPT_MS}ms`;
}
